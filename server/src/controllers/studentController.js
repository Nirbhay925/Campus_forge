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
            resumeSummary: rawText.substring(0, 300) + '...' // First 300 characters preview
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
 * Allows student to add a skill tag from the master dictionary that was not in their PDF.
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

module.exports = {
    uploadAndParseResume,
    getStudentSkills,
    addSkillManually,
    removeSkill
};
