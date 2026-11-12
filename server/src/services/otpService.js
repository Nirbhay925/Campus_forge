const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Transporter configuration (supports custom college SMTP or Gmail)
function getTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return null;
}

/**
 * Generate and dispatch a 6-digit OTP for initial student registration.
 */
async function generateAndSaveOTP({ email, roll_number }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanRollNo = roll_number.trim();

    // 1. Generate cryptographically strong 6-digit OTP
    const otpCode = String(crypto.randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

    let connection;
    try {
        connection = await pool.getConnection();

        // 2. Invalidate older unverified OTPs for this email
        await connection.query(
            'DELETE FROM email_verifications WHERE email = ? AND is_verified = FALSE',
            [cleanEmail]
        );

        // 3. Save new OTP in database
        await connection.query(
            `INSERT INTO email_verifications (email, roll_number, otp_code, otp_hash, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [cleanEmail, cleanRollNo, otpCode, otpHash, expiresAt]
        );

        // 4. Dispatch Email via SMTP if configured
        const transporter = getTransporter();
        let emailDelivered = false;

        if (transporter) {
            try {
                await transporter.sendMail({
                    from: `"Graphic Era Placement Cell" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: cleanEmail,
                    subject: 'CampusForge: Your Graphic Era Student Verification Code',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                            <h2 style="color: #0f172a; margin-top: 0;">Graphic Era Hill University</h2>
                            <p style="color: #475569; font-size: 14px;">Training & Placement Cell • CampusForge Portal</p>
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                            <p style="color: #1e293b; font-size: 15px;">Hello Student,</p>
                            <p style="color: #334155; font-size: 14px;">Your one-time verification code to activate your placement account for Roll Number <strong>${cleanRollNo}</strong> is:</p>
                            <div style="background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
                                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e3a8a;">${otpCode}</span>
                            </div>
                            <p style="color: #64748b; font-size: 12px;">This code is valid for 10 minutes. This verification is required only once for account creation. Never share this code with anyone.</p>
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
                            <p style="color: #94a3b8; font-size: 11px;">Bhimtal Campus, Graphic Era Hill University</p>
                        </div>
                    `
                });
                emailDelivered = true;
            } catch (mailErr) {
                console.warn('⚠️ SMTP send error (falling back to console):', mailErr.message);
            }
        }

        // 5. Always log OTP to server console for testing convenience
        console.log('\n=============================================================');
        console.log('🔑 [CAMPUSFORGE GEHU AUTH] ONE-TIME VERIFICATION CODE:');
        console.log(`   Email:        ${cleanEmail}`);
        console.log(`   Roll Number:  ${cleanRollNo}`);
        console.log(`   6-Digit OTP:  ${otpCode}`);
        console.log(`   Expires in:   10 minutes`);
        console.log('=============================================================\n');

        return {
            success: true,
            message: emailDelivered 
                ? `Verification code sent to ${cleanEmail}. Please check your inbox.`
                : `Verification code generated for ${cleanEmail}. (Check server console for local testing code: ${otpCode})`,
            dev_otp: otpCode // Enables local testing without SMTP server setup
        };

    } finally {
        if (connection) connection.release();
    }
}

/**
 * Verify a submitted 6-digit OTP code against the database.
 */
async function verifyOTP({ email, otp_code }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = (otp_code || '').trim();

    if (!cleanCode || cleanCode.length !== 6) {
        return {
            success: false,
            message: 'Please enter a valid 6-digit verification code.'
        };
    }

    let connection;
    try {
        connection = await pool.getConnection();

        const [rows] = await connection.query(
            `SELECT id, otp_code, otp_hash, expires_at, is_verified, attempts 
             FROM email_verifications 
             WHERE email = ? AND is_verified = FALSE 
             ORDER BY created_at DESC LIMIT 1`,
            [cleanEmail]
        );

        if (rows.length === 0) {
            return {
                success: false,
                message: 'No pending verification found for this email. Please request a new code.'
            };
        }

        const record = rows[0];

        // Check expiration
        if (new Date() > new Date(record.expires_at)) {
            return {
                success: false,
                message: 'This verification code has expired. Please request a new one.'
            };
        }

        // Check attempts limit
        if (record.attempts >= 5) {
            return {
                success: false,
                message: 'Too many incorrect attempts. Please request a new code.'
            };
        }

        // Validate code match
        if (record.otp_code !== cleanCode) {
            await connection.query(
                'UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?',
                [record.id]
            );
            const remaining = 4 - record.attempts;
            return {
                success: false,
                message: `Incorrect verification code. ${remaining > 0 ? remaining + ' attempts remaining.' : 'Code locked.'}`
            };
        }

        // Mark verified
        await connection.query(
            'UPDATE email_verifications SET is_verified = TRUE WHERE id = ?',
            [record.id]
        );

        return {
            success: true,
            message: 'Verification successful! You can now activate your account.'
        };

    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    generateAndSaveOTP,
    verifyOTP
};
