const { pool } = require('../config/db');
const {
    runIngestionCycle,
    syncKrishanKumarLinkedInFeed
} = require('../services/scraperService');
const {
    runSchedulingCycle,
    getOSDashboardTelemetry
} = require('../services/osScheduler');

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
                    GROUP_CONCAT(sk.skill_name) AS required_skills
             FROM internships i
             LEFT JOIN users u ON i.posted_by_faculty_id = u.id
             LEFT JOIN internship_required_skills irs ON i.id = irs.internship_id
             LEFT JOIN skills sk ON irs.skill_id = sk.id
             WHERE i.verification_status = 'PENDING'
             GROUP BY i.id
             ORDER BY i.created_at DESC`
        );

        return res.json({
            success: true,
            count: pendingJobs.length,
            opportunities: pendingJobs.map(job => ({
                ...job,
                required_skills: job.required_skills ? job.required_skills.split(',') : []
            }))
        });
    } catch (error) {
        console.error('Error fetching moderation queue:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error fetching moderation queue.'
        });
    }
}

/**
 * ==============================================================================
 * 2. 1-CLICK VERIFY OPPORTUNITY (PATCH /api/admin/moderation/:id/verify)
 * ==============================================================================
 * Approves a pending drive, marks it as VERIFIED, and logs the gatekeeper action.
 */
async function verifyOpportunity(req, res) {
    const internshipId = parseInt(req.params.id);
    const adminUserId = req.user.id;

    if (!internshipId || isNaN(internshipId)) {
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

        // 2. Log in scheduler audit logs for audit trail
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
 * Rejects an invalid or fraudulent circular and archives it.
 */
async function rejectOpportunity(req, res) {
    const internshipId = parseInt(req.params.id);

    if (!internshipId || isNaN(internshipId)) {
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

/**
 * ==============================================================================
 * 5. TRIGGER AGING & SCHEDULING CYCLE (POST /api/admin/trigger-aging)
 * ==============================================================================
 */
async function triggerAgingCycle(req, res) {
    const { time_step_hours, force_epoch_boost, starvation_threshold } = req.body || {};

    try {
        const results = await runSchedulingCycle({
            timeStepHours: parseInt(time_step_hours) || 24,
            forceEpochBoost: Boolean(force_epoch_boost),
            starvationThreshold: parseInt(starvation_threshold) || 3
        });

        return res.json({
            success: true,
            message: `Placement optimization cycle executed! Evaluated ${results.totalEvaluated} drives.`,
            cycleSummary: results
        });
    } catch (error) {
        console.error('Error triggering aging cycle:', error);
        return res.status(500).json({
            success: false,
            message: 'Error executing optimization cycle: ' + error.message
        });
    }
}

/**
 * ==============================================================================
 * 6. GET OS TELEMETRY DASHBOARD (GET /api/admin/os-telemetry)
 * ==============================================================================
 */
async function getOSTelemetry(req, res) {
    try {
        const telemetry = await getOSDashboardTelemetry();
        return res.json({
            success: true,
            telemetry
        });
    } catch (error) {
        console.error('Error fetching OS telemetry:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving system telemetry.'
        });
    }
}

/**
 * ==============================================================================
 * 7. SYNC KRISHAN KUMAR LINKEDIN FEED (POST /api/admin/sync-linkedin-creator)
 * ==============================================================================
 */
async function syncLinkedInCreator(req, res) {
    const { keyword, raw_text } = req.body || {};

    try {
        const results = await syncKrishanKumarLinkedInFeed({
            keyword: keyword || 'internship',
            raw_text: raw_text || null
        });

        return res.json({
            success: true,
            message: `Synced Krishan Kumar LinkedIn feed: ${results.newAdded} new internships added, ${results.skippedDuplicates} duplicates skipped.`,
            results
        });
    } catch (error) {
        console.error('Error syncing Krishan Kumar LinkedIn feed:', error);
        return res.status(500).json({
            success: false,
            message: 'Error syncing LinkedIn feed: ' + error.message
        });
    }
}

/**
 * ==============================================================================
 * 8. GET ACTIVE LISTED DRIVES (GET /api/admin/active-drives)
 * ==============================================================================
 * Returns all verified opportunities currently active on student feeds.
 * Also runs automated background cleanup for expired deadlines!
 */
async function getActiveDrives(req, res) {
    try {
        // Automatically expire drives where deadline has passed
        await pool.query(
            "UPDATE internships SET verification_status = 'REJECTED' WHERE deadline IS NOT NULL AND deadline < NOW() AND verification_status = 'VERIFIED'"
        );

        const [drives] = await pool.query(
            `SELECT i.id, i.title, i.company_name, i.work_mode, i.location,
                    i.stipend_amount, i.min_cgpa, i.eligible_branches, i.apply_url,
                    i.description, i.source, i.created_at, i.deadline,
                    s.apply_clicks, s.total_impressions
             FROM internships i
             LEFT JOIN mlfq_scheduler_state s ON i.id = s.internship_id
             WHERE i.verification_status = 'VERIFIED'
             ORDER BY i.created_at DESC`
        );

        return res.json({
            success: true,
            count: drives.length,
            drives
        });
    } catch (error) {
        console.error('Error fetching active drives:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error fetching active drives.'
        });
    }
}

/**
 * ==============================================================================
 * 9. REMOVE / ARCHIVE ACTIVE DRIVE (DELETE /api/admin/internships/:id)
 * ==============================================================================
 * TPO can remove any active drive from student feeds immediately.
 */
async function removeActiveInternship(req, res) {
    const internshipId = parseInt(req.params.id);

    if (!internshipId || isNaN(internshipId)) {
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

        // Log removal in audit logs
        await pool.query(
            `INSERT INTO scheduler_audit_logs 
             (internship_id, action_type, old_queue, new_queue, aging_score_applied, reason)
             VALUES (?, 'QUANTUM_EXPIRE_DEMOTE', 0, 2, 0.00, 'Manually removed by TPO Placement Cell')`,
            [internshipId]
        );

        return res.json({
            success: true,
            message: `Opportunity #${internshipId} has been successfully removed from the student portal.`
        });
    } catch (error) {
        console.error('Error removing internship:', error);
        return res.status(500).json({
            success: false,
            message: 'Database error removing opportunity.'
        });
    }
}

module.exports = {
    getModerationQueue,
    verifyOpportunity,
    rejectOpportunity,
    triggerScraperCycle,
    triggerAgingCycle,
    getOSTelemetry,
    syncLinkedInCreator,
    getActiveDrives,
    removeActiveInternship
};
