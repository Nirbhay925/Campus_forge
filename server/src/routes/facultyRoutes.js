const express = require('express');
const router = express.Router();

const {
    parseWhatsAppPreview,
    postDrive,
    getMyDrives
} = require('../controllers/facultyController');

const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * ==============================================================================
 * FACULTY API ROUTES
 * Base URL: /api/faculty
 * Strictly protected: Only users with role 'FACULTY' or 'ADMIN' can access!
 * ==============================================================================
 */

// 1. Preview raw WhatsApp circular auto-extraction
router.post(
    '/parse-whatsapp',
    authenticateToken,
    authorizeRoles('FACULTY', 'ADMIN'),
    parseWhatsAppPreview
);

// 2. Submit new campus drive
router.post(
    '/post-drive',
    authenticateToken,
    authorizeRoles('FACULTY', 'ADMIN'),
    postDrive
);

// 3. View my posted drives and student engagement
router.get(
    '/my-drives',
    authenticateToken,
    authorizeRoles('FACULTY', 'ADMIN'),
    getMyDrives
);

module.exports = router;
