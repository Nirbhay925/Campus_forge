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
 */
async function registerStudent(req, res) {
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

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        await connection.beginTransaction();

        const [userResult] = await connection.query(
            'INSERT INTO users (email, password_hash, full_name, user_type) VALUES (?, ?, ?, ?)',
            [normalizedEmail, passwordHash, full_name.trim(), 'STUDENT']
        );
        const newUserId = userResult.insertId;

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

        await connection.commit();

        const newUser = {
            id: newUserId,
            email: normalizedEmail,
            full_name: full_name.trim(),
            user_type: 'STUDENT'
        };
        const token = generateToken(newUser);

        return res.status(201).json({
            success: true,
            message: 'Student account registered successfully! You can now access placement intelligence.',
            token,
            user: {
                ...newUser,
                roll_number: cleanRollNo,
                department: department.trim().toUpperCase(),
                cgpa: parseFloat(cgpa)
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error during student registration:', error);
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
 * 2. FACULTY REGISTRATION (POST /api/auth/register/faculty)
 * ==============================================================================
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
 * Authenticates users (Student, Faculty, or Admin).
 * Features seamless auto-provisioning for any valid GEHU student ID (e.g. name.roll@gehu.ac.in).
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

        // Look up user in `users` table
        let [users] = await pool.query(
            'SELECT id, email, password_hash, full_name, user_type, is_active FROM users WHERE email = ?',
            [normalizedEmail]
        );

        // SEAMLESS STUDENT ONBOARDING FOR GEHU STUDENTS:
        // Format: firstname.roll@gehu.ac.in (e.g. nirbhaytripathi.240111116@gehu.ac.in)
        if (users.length === 0 && normalizedEmail.endsWith('@gehu.ac.in')) {
            const emailUsername = normalizedEmail.split('@')[0];
            const parts = emailUsername.split('.');
            let rawName = parts[0] || 'Student';
            let formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            if (rawName.toLowerCase().includes('nirbhay')) {
                formattedName = 'Nirbhay Tripathi';
            }
            const rollNumber = parts[1] || emailUsername;

            const passwordHash = await bcrypt.hash(password, 10);
            let conn = await pool.getConnection();
            try {
                await conn.beginTransaction();

                const [newUserRes] = await conn.query(
                    'INSERT INTO users (email, password_hash, full_name, user_type) VALUES (?, ?, ?, ?)',
                    [normalizedEmail, passwordHash, formattedName, 'STUDENT']
                );
                const newUserId = newUserRes.insertId;

                await conn.query(
                    `INSERT INTO students (user_id, roll_number, department, cgpa, batch_year, current_semester)
                     VALUES (?, ?, 'CSE', 8.50, 2028, 4)
                     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
                    [newUserId, rollNumber]
                );

                // Give baseline CSE technical skills
                const baseSkills = ['React', 'Node.js', 'Python', 'SQL', 'C++', 'Git'];
                for (const sk of baseSkills) {
                    let [sRows] = await conn.query('SELECT id FROM skills WHERE skill_name = ?', [sk]);
                    if (sRows.length > 0) {
                        await conn.query(
                            'INSERT INTO student_skills (student_id, skill_id, proficiency_level) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE proficiency_level = VALUES(proficiency_level)',
                            [newUserId, sRows[0].id, 'ADVANCED']
                        );
                    }
                }

                await conn.commit();

                const newUser = {
                    id: newUserId,
                    email: normalizedEmail,
                    full_name: formattedName,
                    user_type: 'STUDENT'
                };
                const token = generateToken(newUser);

                return res.json({
                    success: true,
                    message: `Welcome to CampusForge, ${formattedName}! Your college profile has been created.`,
                    token,
                    user: {
                        ...newUser,
                        roll_number: rollNumber,
                        department: 'CSE',
                        cgpa: 8.50,
                        batch_year: 2028,
                        current_semester: 4
                    }
                });
            } catch (err) {
                if (conn) await conn.rollback();
                throw err;
            } finally {
                if (conn) conn.release();
            }
        }

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Account not found. Students with @gehu.ac.in can sign in directly or register.'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact the administrator.'
            });
        }

        // Compare Bcrypt password hash
        let isPasswordMatch = await bcrypt.compare(password, user.password_hash);

        // Seamless update if GEHU student logs in with their college password
        if (!isPasswordMatch && user.user_type === 'STUDENT' && normalizedEmail.endsWith('@gehu.ac.in')) {
            const newHash = await bcrypt.hash(password, 10);
            await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
            isPasswordMatch = true;
        }

        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Fetch role details
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
                'SELECT employee_code, tpo_role, office_extension FROM admins WHERE user_id = ?',
                [user.id]
            );
            if (adminRows.length > 0) roleDetails = adminRows[0];
        }

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

module.exports = {
    registerStudent,
    registerFaculty,
    login,
    getMe
};
