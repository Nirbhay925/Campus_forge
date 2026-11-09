const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Create a connection pool to manage concurrent database queries efficiently
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'campus_forge',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    decimalNumbers: true
});

// Test connection helper
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log(' Connected to MySQL database:', process.env.DB_NAME || 'campus_forge');
        connection.release();
        return true;
    } catch (error) {
        console.error(' MySQL Connection Error:', error.message);
        return false;
    }
}

module.exports = {
    pool,
    testConnection
};
