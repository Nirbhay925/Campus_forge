const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { validateStudentRegistration, validateFacultyRegistration } = require('../utils/validation');

/**
 * Helper: Generate a signed JWT (Digital ID Badge)
 */
function generateToken(user) {
    const payload = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        user_type: user.user_type
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'campus_forge_super_secret_jwt_key_2026_gehu', {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
}

/**
 * ==============================================================================
 * 1. STUDENT REGISTRATION (POST /api/auth/register/student)
 * ==============================================================================
 * CONCEPT: Database Transactions (ACID Properties)
 * Because our schema separates `users` and `students`, we must insert into TWO
 * tables in a single atomic transaction. If inserting the student fails, the user
 * insert is automatically rolled back, guaranteeing zero orphaned records.
 */
async function registerStudent(req, res) {
    // Step 1: Input Validation
    const validation = validateStudentRegistration(req.body);
    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed.',
            errors: validation.errors
        });
    }

    const { full_name, email, password, roll_number, department, cgpa, batch_year, current_semester } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const cleanRollNo = roll_number.trim();

    let connection;
    try {
        connection = await pool.getConnection();

        // Step 2: Check for existing email or roll number
        const [existingUser] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            [normalizedEmail]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email address already exists.'
            });
        }

        const [existingStudent] = await connection.query(
            'SELECT user_id FROM students WHERE roll_number = ?',
            [cleanRollNo]
        );
        if (existingStudent.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'A student with this university roll number is already registered.'
            });
        }

        // Step 3: Hash password with Bcrypt (Salt rounds = 10)
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Step 4: Execute Transaction
        await connection.beginTransaction();

        // 4A. Insert into parent `users` table
        const [userResult] = await connection.query(
            'INSERT INTO users (email, password_hash, full_name, user_type) VALUES (?, ?, ?, ?)',
            [normalizedEmail, passwordHash, full_name.trim(), 'STUDENT']
        );
        const newUserId = userResult.insertId;

        // 4B. Insert into child `students` table (1:1 with users)
        await connection.query(
            `INSERT INTO students (user_id, roll_number, department, cgpa, batch_year, current_semester)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                newUserId,
                cleanRollNo,
                department.trim().toUpperCase(),
                parseFloat(cgpa),
                parseInt(batch_year, 10),
                parseInt(current_semester || 1, 10)
            ]
        );

        // Commit both inserts together!
        await connection.commit();

        // Step 5: Issue Digital ID Badge (JWT)
        const newUser = {
            id: newUserId,
            email: normalizedEmail,
            full_name: full_name.trim(),
            user_type: 'STUDENT'
        };
        const token = generateToken(newUser);

        return res.status(201).json({
            success: true,
            message: 'Student account registered successfully! Welcome to CampusForge.',
            token,
            user: {
                ...newUser,
                roll_number: cleanRollNo,
                department: department.trim().toUpperCase(),
                cgpa: parseFloat(cgpa),
                batch_year: parseInt(batch_year, 10)
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback(); // Undo if error occurs
        }
        console.error('Error during student registration:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during registration. Please try again.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * ==============================================================================
 * 2. FACULTY REGISTRATION (POST /api/auth/register/faculty)
 * ==============================================================================
 * CONCEPT: Role Protection via Departmental Secret Passcode
 * Prevents unauthorized students from registering as faculty members.
 */
async function registerFaculty(req, res) {
    const validation = validateFacultyRegistration(req.body);
    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed.',
            errors: validation.errors
        });
    }

    const { full_name, email, password, employee_code, department, designation, cabin_location, phone_number, faculty_secret_code } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const cleanEmpCode = employee_code.trim();

    // Verify Departmental Secret Passcode
    const expectedSecret = process.env.FACULTY_SECRET_CODE || 'GEHU_FAC_2026';
    if (faculty_secret_code !== expectedSecret) {
        return res.status(403).json({
            success: false,
            message: 'Invalid Faculty Secret Passcode. Please contact your Department HOD for the official code.'
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Check duplicate email
        const [existingUser] = await connection.query(
            'SELECT id FROM users WHERE email = ?',
            [normalizedEmail]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email address already exists.'
            });
        }

        // Check duplicate employee code
        const [existingFaculty] = await connection.query(
            'SELECT user_id FROM faculty WHERE employee_code = ?',
            [cleanEmpCode]
        );
        if (existingFaculty.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'A faculty member with this employee code is already registered.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Transaction
        await connection.beginTransaction();

        const [userResult] = await connection.query(
            'INSERT INTO users (email, password_hash, full_name, user_type) VALUES (?, ?, ?, ?)',
            [normalizedEmail, passwordHash, full_name.trim(), 'FACULTY']
        );
        const newUserId = userResult.insertId;

        await connection.query(
            `INSERT INTO faculty (user_id, employee_code, department, designation, cabin_location, phone_number)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                newUserId,
                cleanEmpCode,
                department.trim().toUpperCase(),
                designation.trim(),
                cabin_location ? cabin_location.trim() : null,
                phone_number ? phone_number.trim() : null
            ]
        );

        await connection.commit();

        const newUser = {
            id: newUserId,
            email: normalizedEmail,
            full_name: full_name.trim(),
            user_type: 'FACULTY'
        };
        const token = generateToken(newUser);

        return res.status(201).json({
            success: true,
            message: 'Faculty account registered successfully! You can now post campus drives.',
            token,
            user: {
                ...newUser,
                employee_code: cleanEmpCode,
                department: department.trim().toUpperCase(),
                designation: designation.trim()
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error during faculty registration:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during registration.'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/**
 * ==============================================================================
 * 3. USER LOGIN (POST /api/auth/login)
 * ==============================================================================
 * Authenticates ANY user (Student, Faculty, or Admin) using email and password.
 * Checks password hash, fetches their specialized profile, and returns a JWT badge.
 */
async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Please provide both email and password.'
        });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();

        // Step 1: Look up user in `users` table
        const [users] = await pool.query(
            'SELECT id, email, password_hash, full_name, user_type, is_active FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact the administrator.'
            });
        }

        // Step 2: Compare Bcrypt password hash
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Step 3: Fetch role-specific details from subtype tables
        let roleDetails = {};

        if (user.user_type === 'STUDENT') {
            const [studentRows] = await pool.query(
                'SELECT roll_number, department, cgpa, batch_year, current_semester, resume_url FROM students WHERE user_id = ?',
                [user.id]
            );
            if (studentRows.length > 0) roleDetails = studentRows[0];

        } else if (user.user_type === 'FACULTY') {
            const [facultyRows] = await pool.query(
                'SELECT employee_code, department, designation, cabin_location, phone_number FROM faculty WHERE user_id = ?',
                [user.id]
            );
            if (facultyRows.length > 0) roleDetails = facultyRows[0];

        } else if (user.user_type === 'ADMIN') {
            const [adminRows] = await pool.query(
                'SELECT employee_code, tpo_role, office_extension, can_verify_postings, can_trigger_aging FROM admins WHERE user_id = ?',
                [user.id]
            );
            if (adminRows.length > 0) roleDetails = adminRows[0];
        }

        // Step 4: Issue JWT
        const token = generateToken(user);

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
 * 4. GET CURRENT USER PROFILE (GET /api/auth/me)
 * ==============================================================================
 * Protected route. Reads `req.user` attached by the JWT middleware, fetches fresh
 * profile data from MySQL, and returns it to the client.
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

            // Also fetch student's current skills
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
                'SELECT employee_code, tpo_role, office_extension, can_verify_postings, can_trigger_aging FROM admins WHERE user_id = ?',
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

module.exports = {
    registerStudent,
    registerFaculty,
    login,
    getMe
};
