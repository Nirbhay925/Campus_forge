const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

/**
 * CONCEPT EXPLANATION: JSON Web Token (JWT) Authentication Middleware
 * -------------------------------------------------------------------
 * Intercepts incoming requests:
 * 1. Checks for Authorization: Bearer <token>
 * 2. Verifies cryptographic signature
 * 3. Enforces Single Active Device Session (if another device logged in, token is invalidated)
 * 4. Injects decoded user payload into `req.user`
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <TOKEN>"

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access Denied: No authentication token provided.'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'campus_forge_super_secret_jwt_key_2026_gehu', async (err, decoded) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired authentication token.'
            });
        }

        // Single Active Session Validation for Students
        if (decoded.user_type === 'STUDENT' && decoded.session_id) {
            try {
                const [userRows] = await pool.query(
                    'SELECT active_session_token, is_active FROM users WHERE id = ?',
                    [decoded.id]
                );
                if (userRows.length === 0 || !userRows[0].is_active) {
                    return res.status(401).json({
                        success: false,
                        message: 'User account is no longer active.'
                    });
                }
                if (userRows[0].active_session_token && userRows[0].active_session_token !== decoded.session_id) {
                    return res.status(401).json({
                        success: false,
                        session_terminated: true,
                        message: 'Your session was terminated because this account was logged into from another device.'
                    });
                }
            } catch (dbErr) {
                console.warn('Session verification check failed:', dbErr.message);
            }
        }

        req.user = decoded;
        next();
    });
}

/**
 * Role-Based Access Control (RBAC) Guard
 */
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.user_type)) {
            return res.status(403).json({
                success: false,
                message: `Forbidden: This resource requires one of the following roles: [${allowedRoles.join(', ')}]. Your role is: "${req.user ? req.user.user_type : 'NONE'}"`
            });
        }
        next();
    };
}

module.exports = {
    authenticateToken,
    authorizeRoles
};
