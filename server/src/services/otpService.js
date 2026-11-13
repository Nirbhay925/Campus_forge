const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

/**
 * Configure email transporter for Graphic Era placement cell.
 * Supports:
 * - Direct Gmail integration (EMAIL_SERVICE=gmail, EMAIL_USER, EMAIL_PASS)
 * - Custom College / Institutional SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 */
function getTransporter() {
    const user = process.env.EMAIL_USER || process.env.SMTP_USER;
    const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;

    if (!user || !pass) {
        return null;
    }

    // Gmail service preset (fastest, standard)
    if (process.env.EMAIL_SERVICE === 'gmail' || (!process.env.SMTP_HOST && user.includes('@gmail.com'))) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        });
    }

    // Custom institutional SMTP host
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: { user, pass }
    });
}

/**
 * Generate and dispatch a 6-digit OTP for initial student registration.
 * Dispatches a real email to the student's @gehu.ac.in inbox.
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

        // 4. Dispatch Real Email via Transporter
        const transporter = getTransporter();
        let emailDelivered = false;
        const sender = process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.SMTP_USER || 'placement@gehu.ac.in';

        if (transporter) {
            try {
                const info = await transporter.sendMail({
                    from: `"Graphic Era Placement Cell" <${sender}>`,
                    to: cleanEmail,
                    subject: 'CampusForge: Your Graphic Era Student Verification Code',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Graphic Era Hill University</h2>
                            </div>
                            <p style="color: #475569; font-size: 13px; margin: 4px 0 0 0;">Training & Placement Cell (TPO) • CampusForge Portal</p>
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 18px 0;" />
                            <p style="color: #1e293b; font-size: 15px; margin-bottom: 8px;">Hello Graphic Era Student,</p>
                            <p style="color: #334155; font-size: 14px; line-height: 1.5;">
                                Your one-time verification code to activate your placement account for University Roll Number <strong>${cleanRollNo}</strong> is:
                            </p>
                            <div style="background: #f8fafc; border: 2px dashed #94a3b8; border-radius: 8px; padding: 18px; text-align: center; margin: 22px 0;">
                                <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: monospace;">${otpCode}</span>
                            </div>
                            <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
                                ⏱️ This code is valid for <strong>10 minutes</strong>. This verification is required only once during account creation. In the future, you will sign in directly with your password.
                            </p>
                            <p style="color: #ef4444; font-size: 12px; margin-top: 6px;">
                                ⚠️ Never share this verification code with anyone.
                            </p>
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 18px 0;" />
                            <p style="color: #94a3b8; font-size: 11px; margin: 0;">Graphic Era Hill University, Bhimtal Campus • Uttarakhand</p>
                        </div>
                    `
                });
                emailDelivered = true;
                console.log(`\n📧 [EMAIL DISPATCH SUCCESS] Real verification code delivered to ${cleanEmail}`);
                console.log(`   MessageId: ${info.messageId}\n`);
            } catch (mailErr) {
                console.error('\n❌ [EMAIL DISPATCH ERROR] Failed sending to', cleanEmail, ':', mailErr.message);
                console.error('   Please check your EMAIL_USER and EMAIL_PASS in server/.env\n');
            }
        } else {
            console.warn('\n⚠️ [SMTP CONFIGURATION NOTICE] No email sender configured in server/.env.');
            console.warn('   To send real emails to student inboxes, add EMAIL_USER and EMAIL_PASS to server/.env');
            console.log(`🔑 [SERVER CONSOLE DEBUG] Generated OTP for ${cleanEmail} (Roll ${cleanRollNo}): ${otpCode}\n`);
        }

        return {
            success: true,
            email_delivered: emailDelivered,
            message: emailDelivered 
                ? `Verification code has been sent to your Graphic Era email inbox (${cleanEmail}). Please check your inbox and spam folder.`
                : `Verification code generated for ${cleanEmail}. Please check your college inbox.`
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
                message: 'This verification code has expired. Please request a new code.'
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
