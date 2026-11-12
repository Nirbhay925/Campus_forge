const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { validateStudentRegistration, validateFacultyRegistration } = require('../utils/validation');
const { generateAndSaveOTP, verifyOTP } = require('../services/otpService');

/**
 * Helper: Generate signed JWT with session tracking
 */
function generateToken(user, sessionId = null) {
    const payload = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        user_type: user.user_type,
        session_id: sessionId
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'campus_forge_super_secret_jwt_key_2026_gehu', {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
}

/**
 * ==============================================================================
 * 1. REQUEST REGISTRATION OTP (POST /api/auth/request-otp)
 * ==============================================================================
 * Validates college email and roll number, then sends a 6-digit OTP to @gehu.ac.in.
 */
async function requestRegistrationOTP(req, res) {
    const { email, roll_number } = req.body || {};

    if (!email || !roll_number) {
        return res.status(400).json({
            success: false,
            message: 'Please provide both your official college email and roll number.'
        });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRollNo = roll_number.trim();

    // 1. Enforce Graphic Era Hill University domain
    if (!cleanEmail.endsWith('@gehu.ac.in')) {
        return res.status(400).json({
            success: false,
            message: 'Access Restricted: Only official Graphic Era email addresses (@gehu.ac.in) are permitted.'
        });
    }

    // 2. Validate roll number syntax (e.g. 240111116)
    if (!/^[0-9]{6,12}$/.test(cleanRollNo)) {
        return res.status(400).json({
            success: false,
            message: 'Please enter a valid university roll number (e.g. 240111116).'
        });
    }

    // 3. Check if email or roll number already registered
    try {
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this college email already exists. Please Sign In with your password.'
            });
        }

        const [existingRolls] = await pool.query('SELECT user_id FROM students WHERE roll_number = ?', [cleanRollNo]);
        if (existingRolls.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'A student with this roll number is already registered. Please Sign In.'
            });
        }

        // 4. Dispatch 6-digit OTP
        const otpResult = await generateAndSaveOTP({
            email: cleanEmail,
            roll_number: cleanRollNo
        });

        return res.json({
            success: true,
            message: otpResult.message,
            dev_otp: otpResult.dev_otp
        });

    } catch (error) {
        console.error('Error requesting registration OTP:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error generating verification code. Please try again.'
        });
    }
}

/**
 * ==============================================================================
 * 2. VERIFY OTP & COMPLETE FIRST-TIME REGISTRATION (POST /api/auth/verify-otp-register)
 * ==============================================================================
 * Validates the 6-digit OTP and provisions the student account in MySQL with single-device session lock.
 */
async function verifyAndRegisterStudent(req, res) {
    const { 
        email, roll_number, otp_code, full_name, password, 
        department, batch_year, current_semester 
    } = req.body || {};

    if (!email || !roll_number || !otp_code || !full_name || !password) {
        return res.status(400).json({
            success: false,
            message: 'Missing required registration fields. Please fill in all details.'
        });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRollNo = roll_number.trim();
    const cleanName = full_name.trim();

    // 1. Verify OTP code
    const verification = await verifyOTP({ email: cleanEmail, otp_code });
    if (!verification.success) {
        return res.status(400).json({
            success: false,
            message: verification.message
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 2. Hash student password
        const passwordHash = await bcrypt.hash(password, 10);
        const initialSessionId = crypto.randomUUID();
        const userAgent = req.headers['user-agent'] || 'Web Browser';

        // 3. Create user record with single device session lock
        const [userResult] = await connection.query(
            `INSERT INTO users 
             (email, password_hash, full_name, user_type, active_session_token, active_device_info, last_active_at) 
             VALUES (?, ?, ?, 'STUDENT', ?, ?, NOW())`,
            [cleanEmail, passwordHash, cleanName, initialSessionId, userAgent]
        );
        const newUserId = userResult.insertId;

        // 4. Create student profile
        const dept = (department || 'CSE').trim().toUpperCase();
        const batch = parseInt(batch_year, 10) || 2028;
        const sem = parseInt(current_semester, 10) || 4;

        await connection.query(
            `INSERT INTO students (user_id, roll_number, department, cgpa, batch_year, current_semester)
             VALUES (?, ?, ?, 8.50, ?, ?)`,
            [newUserId, cleanRollNo, dept, batch, sem]
        );

        // 5. Seed baseline skills
        const baseSkills = ['React', 'Node.js', 'Python', 'SQL', 'C++', 'Git'];
        for (const sk of baseSkills) {
            let [sRows] = await connection.query('SELECT id FROM skills WHERE skill_name = ?', [sk]);
            if (sRows.length > 0) {
                await connection.query(
                    `INSERT INTO student_skills (student_id, skill_id, proficiency_level) 
                     VALUES (?, ?, 'ADVANCED') 
                     ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level)`,
                    [newUserId, sRows[0].id]
                );
            }
        }

        await connection.commit();

        const newUser = {
            id: newUserId,
            email: cleanEmail,
            full_name: cleanName,
            user_type: 'STUDENT'
        };

        const token = generateToken(newUser, initialSessionId);

        return res.status(201).json({
            success: true,
            message: `Account activated successfully! Welcome to CampusForge, ${cleanName}.`,
            token,
            user: {
                ...newUser,
                roll_number: cleanRollNo,
                department: dept,
                cgpa: 8.50,
                batch_year: batch
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error during student registration:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error activating account: ' + error.message
        });
    } finally {
        if (connection) connection.release();
    }
}

/**
 * ==============================================================================
 * 3. USER LOGIN WITH SINGLE ACTIVE DEVICE LOCK (POST /api/auth/login)
 * ==============================================================================
 * Authenticates users via Email OR Roll Number.
 * Enforces single active session: blocks concurrent logins on other devices unless force_logout is passed.
 */
async function login(req, res) {
    const { email, password, force_logout } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Please provide your College Email/Roll Number and Password.'
        });
    }

    try {
        const identifier = email.trim();
        let user = null;

        // 1. Resolve user by Email OR Roll Number
        if (identifier.includes('@')) {
            const [users] = await pool.query(
                'SELECT * FROM users WHERE email = ?',
                [identifier.toLowerCase()]
            );
            if (users.length > 0) user = users[0];
        } else {
            const [users] = await pool.query(
                `SELECT u.* FROM users u 
                 JOIN students s ON u.id = s.user_id 
                 WHERE s.roll_number = ?`,
                [identifier]
            );
            if (users.length > 0) user = users[0];
        }

        // If user not found
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials. If this is your first time, please click "Register (New Student)" to activate your account with college OTP.'
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended. Please contact the TPO Placement Cell.'
            });
        }

        // 2. Validate Password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Incorrect password. Please try again.'
            });
        }

        // 3. SINGLE ACTIVE DEVICE LOCK CHECK (For Students)
        const userAgent = req.headers['user-agent'] || 'Web Browser';
        const isStudent = user.user_type === 'STUDENT';

        if (isStudent && user.active_session_token && force_logout !== true) {
            // Check if last activity was within 3 hours
            const lastActive = user.last_active_at ? new Date(user.last_active_at) : null;
            const diffHours = lastActive ? (Date.now() - lastActive.getTime()) / (1000 * 60 * 60) : 999;

            if (diffHours < 3) {
                return res.status(409).json({
                    success: false,
                    is_locked: true,
                    active_device: user.active_device_info || 'Another Browser / Device',
                    last_active_at: user.last_active_at,
                    message: 'Access Denied: This student account is already active on another device. To prevent account sharing and impersonation, concurrent sessions are blocked. Please log out from your active device first or click "Force Logout Other Device".'
                });
            }
        }

        // 4. Issue new unique session token and claim exclusive device lock
        const newSessionId = crypto.randomUUID();
        await pool.query(
            `UPDATE users 
             SET active_session_token = ?, active_device_info = ?, last_active_at = NOW() 
             WHERE id = ?`,
            [newSessionId, userAgent, user.id]
        );

        // 5. Fetch role profile details
        let roleDetails = {};
        if (user.user_type === 'STUDENT') {
            const [studentRows] = await pool.query(
                'SELECT roll_number, department, cgpa, batch_year, current_semester, resume_url FROM students WHERE user_id = ?',
                [user.id]
            );
            if (studentRows.length > 0) roleDetails = studentRows[0];

            const [skills] = await pool.query(
                `SELECT s.id, s.skill_name, s.category, ss.proficiency_level 
                 FROM student_skills ss 
                 JOIN skills s ON ss.skill_id = s.id 
                 WHERE ss.student_id = ?`,
                [user.id]
            );
            roleDetails.skills = skills;

        } else if (user.user_type === 'FACULTY') {
            const [facultyRows] = await pool.query(
                'SELECT employee_code, department, designation, cabin_location, phone_number FROM faculty WHERE user_id = ?',
                [user.id]
            );
            if (facultyRows.length > 0) roleDetails = facultyRows[0];

        } else if (user.user_type === 'ADMIN') {
            const [adminRows] = await pool.query(
                'SELECT employee_code, tpo_role, office_extension FROM admins WHERE user_id = ?',
                [user.id]
            );
            if (adminRows.length > 0) roleDetails = adminRows[0];
        }

        const token = generateToken(user, newSessionId);

        return res.json({
            success: true,
            message: `Welcome back, ${user.full_name}!`,
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                user_type: user.user_type,
                ...roleDetails
            }
        });

    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during login.'
        });
    }
}

/**
 * ==============================================================================
 * 4. LOGOUT & RELEASE DEVICE LOCK (POST /api/auth/logout)
 * ==============================================================================
 * Clears active_session_token in MySQL so the student can cleanly log in on another device.
 */
async function logout(req, res) {
    try {
        if (req.user && req.user.id) {
            await pool.query(
                'UPDATE users SET active_session_token = NULL, last_active_at = NOW() WHERE id = ?',
                [req.user.id]
            );
        }
        return res.json({
            success: true,
            message: 'Logged out successfully! Device lock released.'
        });
    } catch (error) {
        console.error('Error during logout:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during logout.'
        });
    }
}

/**
 * ==============================================================================
 * 5. GET CURRENT USER PROFILE (GET /api/auth/me)
 * ==============================================================================
 */
async function getMe(req, res) {
    try {
        const userId = req.user.id;

        const [users] = await pool.query(
            'SELECT id, email, full_name, user_type, is_active, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        const user = users[0];
        let roleDetails = {};

        if (user.user_type === 'STUDENT') {
            const [studentRows] = await pool.query(
                'SELECT roll_number, department, cgpa, batch_year, current_semester, resume_url FROM students WHERE user_id = ?',
                [user.id]
            );
            if (studentRows.length > 0) roleDetails = studentRows[0];

            const [skills] = await pool.query(
                `SELECT s.id, s.skill_name, s.category, ss.proficiency_level 
                 FROM student_skills ss 
                 JOIN skills s ON ss.skill_id = s.id 
                 WHERE ss.student_id = ?`,
                [user.id]
            );
            roleDetails.skills = skills;

        } else if (user.user_type === 'FACULTY') {
            const [facultyRows] = await pool.query(
                'SELECT employee_code, department, designation, cabin_location, phone_number FROM faculty WHERE user_id = ?',
                [user.id]
            );
            if (facultyRows.length > 0) roleDetails = facultyRows[0];

        } else if (user.user_type === 'ADMIN') {
            const [adminRows] = await pool.query(
                'SELECT employee_code, tpo_role, office_extension FROM admins WHERE user_id = ?',
                [user.id]
            );
            if (adminRows.length > 0) roleDetails = adminRows[0];
        }

        return res.json({
            success: true,
            user: {
                ...user,
                ...roleDetails
            }
        });

    } catch (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error fetching profile.'
        });
    }
}

// Backward-compatible faculty registration
async function registerFaculty(req, res) {
    const { full_name, email, password, employee_code, department, designation, cabin_location, phone_number, faculty_secret_code } = req.body || {};
    const expectedSecret = process.env.FACULTY_SECRET_CODE || 'GEHU_FAC_2026';
    if (faculty_secret_code !== expectedSecret) {
        return res.status(403).json({
            success: false,
            message: 'Invalid Faculty Secret Passcode. Please contact Department HOD.'
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const normalizedEmail = email.toLowerCase().trim();
        const cleanEmpCode = employee_code.trim();

        const [existingUser] = await connection.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existingUser.length > 0) {
            return res.status(409).json({ success: false, message: 'Account with this email already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await connection.beginTransaction();

        const [userResult] = await connection.query(
            'INSERT INTO users (email, password_hash, full_name, user_type) VALUES (?, ?, ?, ?)',
            [normalizedEmail, passwordHash, full_name.trim(), 'FACULTY']
        );
        const newUserId = userResult.insertId;

        await connection.query(
            `INSERT INTO faculty (user_id, employee_code, department, designation, cabin_location, phone_number)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [newUserId, cleanEmpCode, department.trim().toUpperCase(), designation.trim(), cabin_location || null, phone_number || null]
        );

        await connection.commit();

        const newUser = { id: newUserId, email: normalizedEmail, full_name: full_name.trim(), user_type: 'FACULTY' };
        const token = generateToken(newUser);

        return res.status(201).json({
            success: true,
            message: 'Faculty account registered successfully!',
            token,
            user: newUser
        });
    } catch (err) {
        if (connection) await connection.rollback();
        return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    requestRegistrationOTP,
    verifyAndRegisterStudent,
    login,
    logout,
    getMe,
    registerFaculty
};
