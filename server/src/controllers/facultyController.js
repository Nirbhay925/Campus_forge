const { pool } = require('../config/db');
const { parseWhatsAppMessage } = require('../services/whatsappParser');

/**
 * ==============================================================================
 * 1. PARSE WHATSAPP TEXT PREVIEW (POST /api/faculty/parse-whatsapp)
 * ==============================================================================
 * Takes raw unstructured WhatsApp text and returns auto-extracted fields
 * so the professor can review and confirm before submitting.
 * Supports both single notices and multi-link digests with zero details!
 */
async function parseWhatsAppPreview(req, res) {
    const { raw_message } = req.body;

    if (!raw_message || raw_message.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide raw WhatsApp text to parse.'
        });
    }

    try {
        const parsed = parseWhatsAppMessage(raw_message);
        return res.json({
            success: true,
            message: parsed.isBatch
                ? `Detected ${parsed.count} distinct opportunities in this WhatsApp message!`
                : 'WhatsApp circular parsed successfully!',
            isBatch: parsed.isBatch,
            count: parsed.count,
            opportunities: parsed.opportunities,
            parsedData: parsed
        });
    } catch (error) {
        console.error('Error parsing WhatsApp message:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error parsing message.'
        });
    }
}

/**
 * ==============================================================================
 * 2. POST CAMPUS DRIVE (POST /api/faculty/post-drive)
 * ==============================================================================
 * Submits a single drive into MySQL `internships` as PENDING for TPO approval,
 * and initializes its Operating System queue state in `mlfq_scheduler_state`.
 */
async function postDrive(req, res) {
    const {
        title,
        company_name,
        work_mode,
        location,
        stipend_amount,
        min_cgpa,
        eligible_branches,
        apply_url,
        description,
        deadline,
        required_skills // Array of skill names, e.g. ['React', 'Python']
    } = req.body;

    const facultyUserId = req.user.id; // From JWT middleware

    // Basic validation
    if (!title || !company_name || !apply_url || !description) {
        return res.status(400).json({
            success: false,
            message: 'Title, Company Name, Application Link, and Description are required.'
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Insert into `internships` table
        const [insertRes] = await connection.query(
            `INSERT INTO internships 
             (title, company_name, work_mode, location, stipend_amount, min_cgpa, eligible_branches, apply_url, description, source, posted_by_faculty_id, verification_status, deadline)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FACULTY_WHATSAPP', ?, 'PENDING', ?)`,
            [
                title.trim(),
                company_name.trim(),
                work_mode || 'ON_SITE',
                location ? location.trim() : 'On-Campus',
                stipend_amount ? stipend_amount.trim() : 'Unspecified',
                parseFloat(min_cgpa) || 0.0,
                eligible_branches ? eligible_branches.trim() : 'ALL',
                apply_url.trim(),
                description.trim(),
                facultyUserId,
                deadline ? new Date(deadline) : null
            ]
        );

        const newInternshipId = insertRes.insertId;

        // 2. Initialize OS State in `mlfq_scheduler_state`
        // On-campus faculty drives start at Queue 0 (Highest priority, 48h quantum)
        await connection.query(
            `INSERT INTO mlfq_scheduler_state 
             (internship_id, current_queue, quantum_remaining_hours, total_impressions, apply_clicks, starvation_counter, aging_boost_score, final_priority_score)
             VALUES (?, 0, 48, 0, 0, 0, 0.00, 95.00)`,
            [newInternshipId]
        );

        // 3. Connect required skills if provided
        if (Array.isArray(required_skills) && required_skills.length > 0) {
            for (const skillName of required_skills) {
                const cleanName = skillName.trim();
                let [skillRows] = await connection.query('SELECT id FROM skills WHERE skill_name = ?', [cleanName]);
                let skillId;
                if (skillRows.length > 0) {
                    skillId = skillRows[0].id;
                } else {
                    const [newSkill] = await connection.query('INSERT INTO skills (skill_name) VALUES (?)', [cleanName]);
                    skillId = newSkill.insertId;
                }

                await connection.query(
                    `INSERT INTO internship_required_skills (internship_id, skill_id, is_mandatory)
                     VALUES (?, ?, TRUE)
                     ON DUPLICATE KEY UPDATE is_mandatory = TRUE`,
                    [newInternshipId, skillId]
                );
            }
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: 'Campus drive submitted successfully! It has been routed to the Placement Cell (TPO) for verification.',
            internshipId: newInternshipId,
            verificationStatus: 'PENDING'
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error posting drive:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error posting drive.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * ==============================================================================
 * 3. BATCH POST CAMPUS DRIVES (POST /api/faculty/batch-post-drives)
 * ==============================================================================
 * Enables faculty to ingest multiple opportunities from a single multi-link broadcast
 * in one click via a single atomic database transaction!
 */
async function batchPostDrives(req, res) {
    const { opportunities } = req.body;

    if (!Array.isArray(opportunities) || opportunities.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Please provide an array of opportunities to batch-post.'
        });
    }

    const facultyUserId = req.user.id;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const createdDriveIds = [];

        for (const opp of opportunities) {
            const {
                title,
                company_name,
                work_mode,
                location,
                stipend_amount,
                min_cgpa,
                eligible_branches,
                apply_url,
                description,
                deadline,
                required_skills
            } = opp;

            if (!title || !company_name || !apply_url) continue;

            const [insertRes] = await connection.query(
                `INSERT INTO internships 
                 (title, company_name, work_mode, location, stipend_amount, min_cgpa, eligible_branches, apply_url, description, source, posted_by_faculty_id, verification_status, deadline)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FACULTY_WHATSAPP', ?, 'PENDING', ?)`,
                [
                    title.trim(),
                    company_name.trim(),
                    work_mode || 'HYBRID',
                    location ? location.trim() : 'Off-Campus / Multiple Locations',
                    stipend_amount ? stipend_amount.trim() : 'Competitive / Industry Standard',
                    parseFloat(min_cgpa) || 0.0,
                    eligible_branches ? eligible_branches.trim() : 'CSE,IT,ECE',
                    apply_url.trim(),
                    description ? description.trim() : `Off-campus opportunity shared by faculty for ${company_name} - ${title}.`,
                    facultyUserId,
                    deadline ? new Date(deadline) : new Date(Date.now() + 14 * 86400000)
                ]
            );

            const newInternshipId = insertRes.insertId;
            createdDriveIds.push(newInternshipId);

            // Initialize OS State in `mlfq_scheduler_state`
            await connection.query(
                `INSERT INTO mlfq_scheduler_state 
                 (internship_id, current_queue, quantum_remaining_hours, total_impressions, apply_clicks, starvation_counter, aging_boost_score, final_priority_score)
                 VALUES (?, 0, 48, 0, 0, 0, 0.00, 95.00)`,
                [newInternshipId]
            );

            // Connect required skills
            if (Array.isArray(required_skills) && required_skills.length > 0) {
                for (const skillName of required_skills) {
                    const cleanName = skillName.trim();
                    let [skillRows] = await connection.query('SELECT id FROM skills WHERE skill_name = ?', [cleanName]);
                    let skillId;
                    if (skillRows.length > 0) {
                        skillId = skillRows[0].id;
                    } else {
                        const [newSkill] = await connection.query('INSERT INTO skills (skill_name) VALUES (?)', [cleanName]);
                        skillId = newSkill.insertId;
                    }

                    await connection.query(
                        `INSERT INTO internship_required_skills (internship_id, skill_id, is_mandatory)
                         VALUES (?, ?, TRUE)
                         ON DUPLICATE KEY UPDATE is_mandatory = TRUE`,
                        [newInternshipId, skillId]
                    );
                }
            }
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: `Successfully posted ${createdDriveIds.length} opportunities into the TPO moderation queue!`,
            createdCount: createdDriveIds.length,
            driveIds: createdDriveIds,
            verificationStatus: 'PENDING'
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error in batch post drives:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error while batch posting drives.'
        });
    } finally {
        if (connection) connection.release();
    }
}

/**
 * ==============================================================================
 * 4. GET MY POSTED DRIVES (GET /api/faculty/my-drives)
 * ==============================================================================
 * Returns all drives submitted by the logged-in faculty coordinator
 * along with TPO verification status and student impression telemetry.
 */
async function getMyDrives(req, res) {
    const facultyUserId = req.user.id;

    try {
        const [drives] = await pool.query(
            `SELECT 
                i.id,
                i.title,
                i.company_name,
                i.work_mode,
                i.location,
                i.stipend_amount,
                i.min_cgpa,
                i.eligible_branches,
                i.verification_status,
                i.created_at,
                i.deadline,
                s.current_queue,
                s.total_impressions,
                s.apply_clicks
             FROM internships i
             LEFT JOIN mlfq_scheduler_state s ON i.id = s.internship_id
             WHERE i.posted_by_faculty_id = ?
             ORDER BY i.created_at DESC`,
            [facultyUserId]
        );

        return res.json({
            success: true,
            count: drives.length,
            drives
        });
    } catch (error) {
        console.error('Error fetching faculty drives:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error fetching drives.'
        });
    }
}

module.exports = {
    parseWhatsAppPreview,
    postDrive,
    batchPostDrives,
    getMyDrives
};
