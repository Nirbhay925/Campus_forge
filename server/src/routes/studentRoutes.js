const express = require('express');
const router = express.Router();

const {
    uploadAndParseResume,
    getStudentSkills,
    addSkillManually,
    removeSkill,
    getPersonalizedFeed,
    applyToInternship
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

// 5. Get personalized student feed (ranked by Skill Match + OS MLFQ Priority + Aging Boost)
router.get(
    '/feed',
    authenticateToken,
    authorizeRoles('STUDENT'),
    getPersonalizedFeed
);

// 6. Record 'Apply' click for an internship (increments clicks in MLFQ state)
router.post(
    '/apply/:internshipId',
    authenticateToken,
    authorizeRoles('STUDENT'),
    applyToInternship
);

module.exports = router;
