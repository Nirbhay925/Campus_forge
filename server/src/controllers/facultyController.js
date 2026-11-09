const { pool } = require('../config/db');
const { parseWhatsAppMessage } = require('../services/whatsappParser');

/**
 * ==============================================================================
 * 1. PARSE WHATSAPP TEXT PREVIEW (POST /api/faculty/parse-whatsapp)
 * ==============================================================================
 * Takes raw unstructured WhatsApp text and returns auto-extracted fields
 * so the professor can review and confirm before submitting.
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
            message: 'WhatsApp circular parsed successfully!',
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
 * Submits the drive into MySQL `internships` as PENDING for TPO approval,
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
                // Find or insert skill
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
        console.error('Error posting faculty drive:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error posting drive: ' + error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * ==============================================================================
 * 3. GET MY POSTED DRIVES (GET /api/faculty/my-drives)
 * ==============================================================================
 * Allows professor to see their submissions, status (PENDING/VERIFIED), and student clicks.
 */
async function getMyDrives(req, res) {
    const facultyUserId = req.user.id;

    try {
        const [drives] = await pool.query(
            `SELECT i.id, i.title, i.company_name, i.stipend_amount, i.min_cgpa, 
                    i.eligible_branches, i.verification_status, i.created_at, i.deadline,
                    COALESCE(m.apply_clicks, 0) AS total_student_clicks,
                    COALESCE(m.current_queue, 0) AS os_queue
             FROM internships i
             LEFT JOIN mlfq_scheduler_state m ON i.id = m.internship_id
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
            message: 'Internal server error fetching your drives.'
        });
    }
}

module.exports = {
    parseWhatsAppPreview,
    postDrive,
    getMyDrives
};
