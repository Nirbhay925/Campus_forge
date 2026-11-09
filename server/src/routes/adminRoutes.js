const express = require('express');
const router = express.Router();

const {
    getModerationQueue,
    verifyOpportunity,
    rejectOpportunity,
    triggerScraperCycle
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

module.exports = router;
