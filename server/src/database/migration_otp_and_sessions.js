const { pool } = require('../config/db');

async function runMigration() {
    console.log('--- RUNNING MIGRATION: OTP VERIFICATIONS & SINGLE ACTIVE DEVICE SESSIONS ---');
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Check and add columns to users table
        const [columns] = await connection.query("SHOW COLUMNS FROM users");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('active_session_token')) {
            console.log('Adding active_session_token column to users...');
            await connection.query("ALTER TABLE users ADD COLUMN active_session_token VARCHAR(255) NULL");
        }

        if (!columnNames.includes('active_device_info')) {
            console.log('Adding active_device_info column to users...');
            await connection.query("ALTER TABLE users ADD COLUMN active_device_info VARCHAR(255) NULL");
        }

        if (!columnNames.includes('last_active_at')) {
            console.log('Adding last_active_at column to users...');
            await connection.query("ALTER TABLE users ADD COLUMN last_active_at TIMESTAMP NULL");
        }

        // 2. Create email_verifications table
        console.log('Ensuring email_verifications table exists...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS email_verifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(150) NOT NULL,
                roll_number VARCHAR(50) NOT NULL,
                otp_code VARCHAR(10) NOT NULL,
                otp_hash VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                is_verified BOOLEAN NOT NULL DEFAULT FALSE,
                attempts INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_verif_email (email),
                INDEX idx_verif_roll (roll_number)
            ) ENGINE=InnoDB;
        `);

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

runMigration();
