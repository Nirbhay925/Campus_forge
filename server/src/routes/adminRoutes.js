const express = require('express');
const router = express.Router();

const {
    getModerationQueue,
    verifyOpportunity,
    rejectOpportunity,
    triggerScraperCycle,
    triggerAgingCycle,
    getOSTelemetry,
    syncLinkedInCreator,
    getActiveDrives,
    removeActiveInternship
} = require('../controllers/adminController');

const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * ==============================================================================
 * TPO ADMIN API ROUTES
 * Base URL: /api/admin
 * Strictly protected: Only users with role 'ADMIN' can access!
 * ==============================================================================
 */

// 1. Get all pending opportunities awaiting verification
router.get(
    '/moderation',
    authenticateToken,
    authorizeRoles('ADMIN'),
    getModerationQueue
);

// 2. 1-Click Verify an opportunity (goes live for students)
router.patch(
    '/moderation/:id/verify',
    authenticateToken,
    authorizeRoles('ADMIN'),
    verifyOpportunity
);

// 3. 1-Click Reject an opportunity
router.patch(
    '/moderation/:id/reject',
    authenticateToken,
    authorizeRoles('ADMIN'),
    rejectOpportunity
);

// 4. Trigger autonomous scraper ingestion cycle on demand
router.post(
    '/trigger-scraper',
    authenticateToken,
    authorizeRoles('ADMIN'),
    triggerScraperCycle
);

// 5. Trigger OS aging and prioritization cycle
router.post(
    '/trigger-aging',
    authenticateToken,
    authorizeRoles('ADMIN'),
    triggerAgingCycle
);

// 6. Get live system telemetry and audit logs
router.get(
    '/os-telemetry',
    authenticateToken,
    authorizeRoles('ADMIN'),
    getOSTelemetry
);

// 7. Sync authentic internship stream from Krishan Kumar (LinkedIn: @krishan-kumar08)
router.post(
    '/sync-linkedin-creator',
    authenticateToken,
    authorizeRoles('ADMIN'),
    syncLinkedInCreator
);

// 8. Get all active listed drives (runs auto-expiration for passed deadlines)
router.get(
    '/active-drives',
    authenticateToken,
    authorizeRoles('ADMIN'),
    getActiveDrives
);

// 9. TPO Manual Removal of any listed internship
router.delete(
    '/internships/:id',
    authenticateToken,
    authorizeRoles('ADMIN'),
    removeActiveInternship
);

module.exports = router;
