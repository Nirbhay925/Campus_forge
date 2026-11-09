const jwt = require('jsonwebtoken');

/**
 * CONCEPT EXPLANATION: JSON Web Token (JWT) Authentication Middleware
 * -------------------------------------------------------------------
 * When a user logs in, the server generates a cryptographically signed token
 * containing user identity (id, email, user_type). The client sends this token
 * in the HTTP header: "Authorization: Bearer <token>".
 * 
 * This middleware intercepts incoming requests:
 * 1. Checks if the Authorization header is present.
 * 2. Extracts the token string.
 * 3. Verifies token integrity using our secret key (JWT_SECRET).
 * 4. Injects decoded user data into `req.user` for downstream routes.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <TOKEN>"

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access Denied: No authentication token provided.'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'campus_forge_super_secret_jwt_key_2026_gehu', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired authentication token.'
            });
        }
        req.user = user; // Attach authenticated user payload to request
        next();
    });
}

/**
 * CONCEPT EXPLANATION: Role-Based Access Control (RBAC) Guard
 * -----------------------------------------------------------
 * Enforces our 3-tier view separation (STUDENT, FACULTY, ADMIN) at the API level.
 * Example usage: `router.post('/verify', authenticateToken, authorizeRoles('ADMIN'), ...)`
 * 
 * If a Student tries to call a Faculty or Admin endpoint, this middleware immediately
 * blocks the request with HTTP 403 (Forbidden), ensuring strict role isolation.
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
