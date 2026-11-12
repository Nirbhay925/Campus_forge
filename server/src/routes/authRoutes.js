const express = require('express');
const router = express.Router();

const {
    requestRegistrationOTP,
    verifyAndRegisterStudent,
    registerFaculty,
    login,
    logout,
    getMe
} = require('../controllers/authController');

const { authenticateToken } = require('../middleware/auth');

/**
 * ==============================================================================
 * AUTHENTICATION ROUTES
 * Base URL: /api/auth
 * ==============================================================================
 */

// Step 1: Request 6-digit OTP for first-time GEHU student onboarding
router.post('/request-otp', requestRegistrationOTP);

// Step 2: Verify 6-digit OTP and complete first-time student registration
router.post('/verify-otp-register', verifyAndRegisterStudent);

// Public Route: Register a new faculty member (Requires faculty secret passcode)
router.post('/register/faculty', registerFaculty);

// Public Route: Log in as ANY user (Student, Faculty, or Admin) with single-device lock
router.post('/login', login);

// Protected Route: Logout and release single device lock
router.post('/logout', authenticateToken, logout);

// Protected Route: Get currently logged-in user profile
router.get('/me', authenticateToken, getMe);

module.exports = router;
