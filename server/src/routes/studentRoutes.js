const express = require('express');
const router = express.Router();

const {
    uploadAndParseResume,
    getStudentSkills,
    addSkillManually,
    removeSkill
} = require('../controllers/studentController');

const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { uploadResumeMiddleware } = require('../middleware/upload');

/**
 * ==============================================================================
 * STUDENT API ROUTES
 * Base URL: /api/students
 * All routes are strictly protected by JWT and limited to students only!
 * ==============================================================================
 */

// 1. Upload & Parse PDF Resume
// Middleware chain: authenticateToken -> authorizeRoles('STUDENT') -> upload.single('resume') -> uploadAndParseResume
router.post(
    '/resume',
    authenticateToken,
    authorizeRoles('STUDENT'),
    uploadResumeMiddleware.single('resume'),
    uploadAndParseResume
);

// 2. Get list of skills associated with the logged-in student
router.get(
    '/skills',
    authenticateToken,
    authorizeRoles('STUDENT'),
    getStudentSkills
);

// 3. Manually add a skill tag
router.post(
    '/skills',
    authenticateToken,
    authorizeRoles('STUDENT'),
    addSkillManually
);

// 4. Remove a skill tag
router.delete(
    '/skills/:skillId',
    authenticateToken,
    authorizeRoles('STUDENT'),
    removeSkill
);

module.exports = router;
