const { pool } = require('../config/db');
const {
    extractTextFromPDF,
    extractSkillsFromText,
    detectCGPAFromText
} = require('../services/resumeParser');

/**
 * ==============================================================================
 * 1. UPLOAD & PARSE RESUME (POST /api/students/resume)
 * ==============================================================================
 * Receives the uploaded PDF resume buffer, converts to text, detects skills & CGPA,
 * updates MySQL `students` table, and associates skills in `student_skills`.
 */
async function uploadAndParseResume(req, res) {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No resume file uploaded. Please upload a valid .pdf file.'
        });
    }

    const studentUserId = req.user.id; // Injected by authenticateToken JWT middleware

    let connection;
    try {
        // Step 1: Extract plaintext from binary PDF buffer
        const rawText = await extractTextFromPDF(req.file.buffer);

        if (!rawText || rawText.trim().length < 50) {
            return res.status(400).json({
                success: false,
                message: 'Uploaded PDF appears to be empty or unreadable. Please upload a standard text PDF resume.'
            });
        }

        connection = await pool.getConnection();

        // Step 2: Fetch all canonical master skills from MySQL
        const [masterSkills] = await connection.query('SELECT id, skill_name, category FROM skills');

        // Step 3: Run algorithm to match skills & detect CGPA
        const extractedSkills = extractSkillsFromText(rawText, masterSkills);
        const detectedCGPA = detectCGPAFromText(rawText);

        // Step 4: Transaction - Update student table and insert skills
        await connection.beginTransaction();

        // 4A. Update raw resume text in `students`
        await connection.query(
            'UPDATE students SET resume_raw_text = ? WHERE user_id = ?',
            [rawText, studentUserId]
        );

        // 4B. Insert matched skills into `student_skills`
        if (extractedSkills.length > 0) {
            for (const skill of extractedSkills) {
                await connection.query(
                    `INSERT INTO student_skills (student_id, skill_id, proficiency_level, extracted_from_resume)
                     VALUES (?, ?, 'INTERMEDIATE', TRUE)
                     ON DUPLICATE KEY UPDATE extracted_from_resume = TRUE`,
                    [studentUserId, skill.id]
                );
            }
        }

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `Resume parsed successfully! Found ${extractedSkills.length} skills.`,
            detectedCGPA: detectedCGPA,
            extractedSkills: extractedSkills,
            totalSkillsFound: extractedSkills.length,
            resumeSummary: rawText.substring(0, 300) + '...'
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error in uploadAndParseResume:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error processing resume: ' + error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * ==============================================================================
 * 2. GET STUDENT SKILLS (GET /api/students/skills)
 * ==============================================================================
 */
async function getStudentSkills(req, res) {
    try {
        const studentUserId = req.user.id;

        const [skills] = await pool.query(
            `SELECT s.id, s.skill_name, s.category, ss.proficiency_level, ss.extracted_from_resume
             FROM student_skills ss
             JOIN skills s ON ss.skill_id = s.id
             WHERE ss.student_id = ?
             ORDER BY s.skill_name ASC`,
            [studentUserId]
        );

        return res.json({
            success: true,
            count: skills.length,
            skills
        });
    } catch (error) {
        console.error('Error fetching student skills:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error fetching skills.'
        });
    }
}

/**
 * ==============================================================================
 * 3. ADD SKILL MANUALLY (POST /api/students/skills)
 * ==============================================================================
 */
async function addSkillManually(req, res) {
    const { skill_name, proficiency_level } = req.body;
    const studentUserId = req.user.id;

    if (!skill_name || skill_name.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a skill name.'
        });
    }

    try {
        const cleanSkill = skill_name.trim();

        // 1. Look up skill in master table or insert it
        let [skillRows] = await pool.query('SELECT id, skill_name FROM skills WHERE skill_name = ?', [cleanSkill]);
        let skillId;

        if (skillRows.length === 0) {
            const [insertRes] = await pool.query('INSERT INTO skills (skill_name, category) VALUES (?, ?)', [cleanSkill, 'TECHNICAL']);
            skillId = insertRes.insertId;
        } else {
            skillId = skillRows[0].id;
        }

        // 2. Associate with student in student_skills
        const level = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(proficiency_level) ? proficiency_level : 'INTERMEDIATE';
        await pool.query(
            `INSERT INTO student_skills (student_id, skill_id, proficiency_level, extracted_from_resume)
             VALUES (?, ?, ?, FALSE)
             ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level)`,
            [studentUserId, skillId, level]
        );

        return res.status(201).json({
            success: true,
            message: `Skill "${cleanSkill}" added to your profile!`,
            skill: { id: skillId, skill_name: cleanSkill, proficiency_level: level }
        });

    } catch (error) {
        console.error('Error adding skill manually:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error adding skill.'
        });
    }
}

/**
 * ==============================================================================
 * 4. REMOVE SKILL (DELETE /api/students/skills/:skillId)
 * ==============================================================================
 */
async function removeSkill(req, res) {
    const skillId = parseInt(req.params.skillId, 10);
    const studentUserId = req.user.id;

    if (isNaN(skillId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid skill ID.'
        });
    }

    try {
        const [result] = await pool.query(
            'DELETE FROM student_skills WHERE student_id = ? AND skill_id = ?',
            [studentUserId, skillId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Skill not found on your profile.'
            });
        }

        return res.json({
            success: true,
            message: 'Skill removed from profile successfully.'
        });

    } catch (error) {
        console.error('Error removing skill:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error removing skill.'
        });
    }
}

/**
 * ==============================================================================
 * 5. GET PERSONALIZED FEED (GET /api/students/feed)
 * ==============================================================================
 * Calculates real-time composite score:
 * TotalScore = (SkillMatch * 0.40) + (FinalPriorityScore * 0.35) + (AgingBoostScore * 0.25)
 * Flags CGPA and department eligibility.
 */
async function getPersonalizedFeed(req, res) {
    const studentUserId = req.user.id;

    try {
        // 1. Fetch student's profile & verified skills
        const [studentRows] = await pool.query(
            'SELECT user_id, roll_number, department, current_semester, cgpa FROM students WHERE user_id = ?',
            [studentUserId]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Student profile not found.' });
        }
        const student = studentRows[0];
        const studentCGPA = parseFloat(student.cgpa) || 0.0;
        const studentDept = (student.department || '').toUpperCase().trim();

        const [studentSkillRows] = await pool.query(
            `SELECT s.id, s.skill_name 
             FROM student_skills ss
             JOIN skills s ON ss.skill_id = s.id
             WHERE ss.student_id = ?`,
            [studentUserId]
        );
        const studentSkillNames = new Set(studentSkillRows.map(s => s.skill_name.toLowerCase()));

        // 2. Fetch all student applications so we can mark 'has_applied'
        const [applications] = await pool.query(
            'SELECT internship_id, status, clicked_at FROM applications_tracker WHERE student_id = ?',
            [studentUserId]
        );
        const appliedMap = new Map(applications.map(a => [a.internship_id, a.status]));

        // 3. Fetch all VERIFIED internships joined with mlfq_scheduler_state and required skills
        const [internships] = await pool.query(`
            SELECT 
                i.id,
                i.title,
                i.company_name,
                i.work_mode,
                i.location,
                i.stipend_amount,
                i.min_cgpa,
                i.eligible_branches,
                i.apply_url,
                i.description,
                i.source,
                i.deadline,
                i.created_at,
                s.current_queue,
                s.quantum_remaining_hours,
                s.total_impressions,
                s.apply_clicks,
                s.starvation_counter,
                s.aging_boost_score,
                s.final_priority_score
            FROM internships i
            JOIN mlfq_scheduler_state s ON i.id = s.internship_id
            WHERE i.verification_status = 'VERIFIED'
            ORDER BY s.final_priority_score DESC
        `);

        // Fetch required skills for all internships
        const [allReqSkills] = await pool.query(`
            SELECT irs.internship_id, s.skill_name, irs.is_mandatory
            FROM internship_required_skills irs
            JOIN skills s ON irs.skill_id = s.id
        `);

        const skillsByJob = new Map();
        for (const item of allReqSkills) {
            if (!skillsByJob.has(item.internship_id)) {
                skillsByJob.set(item.internship_id, []);
            }
            skillsByJob.get(item.internship_id).push(item.skill_name);
        }

        // 4. Compute composite personal match score for each opportunity
        const feed = internships.map(job => {
            const requiredSkills = skillsByJob.get(job.id) || [];
            
            // Calculate matched vs missing skills
            const matchedSkills = [];
            const missingSkills = [];

            for (const rSkill of requiredSkills) {
                if (studentSkillNames.has(rSkill.toLowerCase())) {
                    matchedSkills.push(rSkill);
                } else {
                    missingSkills.push(rSkill);
                }
            }

            let skillMatchPercentage = 100;
            if (requiredSkills.length > 0) {
                skillMatchPercentage = Math.round((matchedSkills.length / requiredSkills.length) * 100);
            }

            // Check CGPA and Branch eligibility
            const minCgpa = parseFloat(job.min_cgpa) || 0.0;
            const meetsCGPA = studentCGPA >= minCgpa;

            let meetsBranch = true;
            if (job.eligible_branches && job.eligible_branches !== 'ALL') {
                const allowedBranches = job.eligible_branches.split(',').map(b => b.trim().toUpperCase());
                meetsBranch = allowedBranches.includes(studentDept) || allowedBranches.includes('ALL');
            }

            const isEligible = meetsCGPA && meetsBranch;
            const eligibilityWarnings = [];
            if (!meetsCGPA) {
                eligibilityWarnings.push(`Requires min ${minCgpa.toFixed(1)} CGPA (Your CGPA: ${studentCGPA.toFixed(1)})`);
            }
            if (!meetsBranch) {
                eligibilityWarnings.push(`Branch restricted to: ${job.eligible_branches}`);
            }

            // Operating System Final Priority & Aging Boost
            const finalPriorityScore = parseFloat(job.final_priority_score) || 50.0;
            const agingBoost = parseFloat(job.aging_boost_score) || 0.0;

            // Composite personal ranking calculation:
            // 40% Skill Match + 35% OS MLFQ Priority + 25% Anti-Starvation Aging Boost
            let compositeRankingScore = (skillMatchPercentage * 0.40) + (finalPriorityScore * 0.35) + (agingBoost * 0.25);
            if (!isEligible) {
                compositeRankingScore = Math.max(0, compositeRankingScore - 25); // Ineligible penalty
            }
            compositeRankingScore = parseFloat(compositeRankingScore.toFixed(2));

            const hasApplied = appliedMap.has(job.id);

            return {
                ...job,
                required_skills: requiredSkills,
                matched_skills: matchedSkills,
                missing_skills: missingSkills,
                skill_match_percentage: skillMatchPercentage,
                is_eligible: isEligible,
                eligibility_warnings: eligibilityWarnings,
                has_applied: hasApplied,
                application_status: appliedMap.get(job.id) || null,
                composite_ranking_score: compositeRankingScore
            };
        });

        // 5. Sort feed descending by composite ranking score
        feed.sort((a, b) => b.composite_ranking_score - a.composite_ranking_score);

        return res.json({
            success: true,
            studentProfile: {
                roll_number: student.roll_number,
                department: student.department,
                cgpa: studentCGPA,
                total_skills: studentSkillRows.length
            },
            count: feed.length,
            feed
        });

    } catch (error) {
        console.error('Error generating personalized feed:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error generating student feed.'
        });
    }
}

/**
 * ==============================================================================
 * 6. APPLY TO INTERNSHIP (POST /api/students/apply/:internshipId)
 * ==============================================================================
 * Records the student's application in `applications_tracker`,
 * and atomically increments `apply_clicks` and `total_impressions` in `mlfq_scheduler_state`!
 */
async function applyToInternship(req, res) {
    const studentUserId = req.user.id;
    const internshipId = parseInt(req.params.internshipId, 10);

    if (isNaN(internshipId)) {
        return res.status(400).json({ success: false, message: 'Invalid internship ID.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Verify internship exists and is VERIFIED
        const [jobRows] = await connection.query(
            "SELECT id, title, company_name, apply_url FROM internships WHERE id = ? AND verification_status = 'VERIFIED'",
            [internshipId]
        );

        if (jobRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Verified internship not found.'
            });
        }
        const job = jobRows[0];

        // 2. Insert into `applications_tracker`
        await connection.query(
            `INSERT INTO applications_tracker (student_id, internship_id, status)
             VALUES (?, ?, 'CLICKED_APPLY')
             ON DUPLICATE KEY UPDATE status = 'CLICKED_APPLY', clicked_at = CURRENT_TIMESTAMP`,
            [studentUserId, internshipId]
        );

        // 3. Atomically increment apply_clicks and total_impressions in mlfq_scheduler_state
        await connection.query(
            `UPDATE mlfq_scheduler_state
             SET apply_clicks = apply_clicks + 1,
                 total_impressions = total_impressions + 1,
                 last_state_change = CURRENT_TIMESTAMP
             WHERE internship_id = ?`,
            [internshipId]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: `Application recorded for ${job.company_name} - ${job.title}!`,
            apply_url: job.apply_url
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error applying to internship:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error recording application.'
        });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    uploadAndParseResume,
    getStudentSkills,
    addSkillManually,
    removeSkill,
    getPersonalizedFeed,
    applyToInternship
};
