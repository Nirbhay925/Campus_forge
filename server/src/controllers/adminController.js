const { pool } = require('../config/db');
const { runIngestionCycle } = require('../services/scraperService');

/**
 * ==============================================================================
 * 1. GET MODERATION QUEUE (GET /api/admin/moderation)
 * ==============================================================================
 * Fetches all pending opportunities awaiting TPO review.
 */
async function getModerationQueue(req, res) {
    try {
        const [pendingJobs] = await pool.query(
            `SELECT i.id, i.title, i.company_name, i.work_mode, i.location,
                    i.stipend_amount, i.min_cgpa, i.eligible_branches, i.apply_url,
                    i.description, i.source, i.created_at, i.deadline,
                    u.full_name AS posted_by_name,
                    f.department AS faculty_dept
             FROM internships i
             LEFT JOIN faculty f ON i.posted_by_faculty_id = f.user_id
             LEFT JOIN users u ON f.user_id = u.id
             WHERE i.verification_status = 'PENDING'
             ORDER BY i.created_at DESC`
        );

        return res.json({
            success: true,
            count: pendingJobs.length,
            pendingJobs
        });
    } catch (error) {
        console.error('Error fetching moderation queue:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error fetching moderation queue.'
        });
    }
}

/**
 * ==============================================================================
 * 2. VERIFY OPPORTUNITY (PATCH /api/admin/moderation/:id/verify)
 * ==============================================================================
 * 1-Click Approval: Turns a PENDING posting into a VERIFIED live posting!
 */
async function verifyOpportunity(req, res) {
    const internshipId = parseInt(req.params.id, 10);
    const adminUserId = req.user.id;

    if (isNaN(internshipId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid internship ID.'
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Update verification status
        const [updateRes] = await connection.query(
            `UPDATE internships 
             SET verification_status = 'VERIFIED', verified_by_admin_id = ?
             WHERE id = ? AND verification_status = 'PENDING'`,
            [adminUserId, internshipId]
        );

        if (updateRes.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Opportunity not found in PENDING queue.'
            });
        }

        // 2. Log in scheduler audit logs for OS viva demonstration
        await connection.query(
            `INSERT INTO scheduler_audit_logs 
             (internship_id, action_type, old_queue, new_queue, aging_score_applied, reason)
             VALUES (?, 'AGING_PROMOTION', 1, 0, 10.00, 'TPO Verification Gate Passed - Promoted to Live Feed')`,
            [internshipId]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: `Opportunity #${internshipId} has been VERIFIED! It is now live on all student feeds.`
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error verifying opportunity:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error verifying opportunity.'
        });
    } finally {
        if (connection) connection.release();
    }
}

/**
 * ==============================================================================
 * 3. REJECT OPPORTUNITY (PATCH /api/admin/moderation/:id/reject)
 * ==============================================================================
 */
async function rejectOpportunity(req, res) {
    const internshipId = parseInt(req.params.id, 10);

    if (isNaN(internshipId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid internship ID.'
        });
    }

    try {
        const [updateRes] = await pool.query(
            "UPDATE internships SET verification_status = 'REJECTED' WHERE id = ?",
            [internshipId]
        );

        if (updateRes.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Opportunity not found.'
            });
        }

        return res.json({
            success: true,
            message: `Opportunity #${internshipId} has been REJECTED and removed from review.`
        });
    } catch (error) {
        console.error('Error rejecting opportunity:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error rejecting opportunity.'
        });
    }
}

/**
 * ==============================================================================
 * 4. TRIGGER SCRAPER CYCLE ON DEMAND (POST /api/admin/trigger-scraper)
 * ==============================================================================
 */
async function triggerScraperCycle(req, res) {
    try {
        const results = await runIngestionCycle();
        return res.json({
            success: true,
            message: 'Autonomous scraper cycle completed successfully!',
            results
        });
    } catch (error) {
        console.error('Error running scraper cycle:', error);
        return res.status(500).json({
            success: false,
            message: 'Scraper engine encountered an error: ' + error.message
        });
    }
}

module.exports = {
    getModerationQueue,
    verifyOpportunity,
    rejectOpportunity,
    triggerScraperCycle
};
