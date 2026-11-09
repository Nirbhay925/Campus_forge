const express = require('express');
const router = express.Router();

const {
    registerStudent,
    registerFaculty,
    login,
    getMe
} = require('../controllers/authController');

const { authenticateToken } = require('../middleware/auth');

/**
 * ==============================================================================
 * AUTHENTICATION ROUTES
 * Base URL: /api/auth
 * ==============================================================================
 */

// Public Route: Register a new student
router.post('/register/student', registerStudent);

// Public Route: Register a new faculty member (Requires faculty secret passcode)
router.post('/register/faculty', registerFaculty);

// Public Route: Log in as ANY user (Student, Faculty, or Admin)
router.post('/login', login);

// Protected Route: Get currently logged-in user profile
// Intercepted by `authenticateToken` middleware before reaching `getMe`
router.get('/me', authenticateToken, getMe);

module.exports = router;
