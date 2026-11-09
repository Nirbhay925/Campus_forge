const fs = require('fs');
const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
};

async function runDatabaseSetup() {
    console.log('===============================================================');
    console.log('  CAMPUSFORGE: AUTOMATED DATABASE MIGRATION & SEED RUNNER');
    console.log('===============================================================');
    console.log(`Connecting to MySQL Server on ${dbConfig.host}:${dbConfig.port} as user "${dbConfig.user}"...`);

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log(' Connection established successfully.\n');

        // Step 1: Run Schema SQL
        const schemaPath = path.join(__dirname, 'schema.sql');
        console.log(`[Step 1/2] Executing Schema DDL from: ${path.basename(schemaPath)}...`);
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await connection.query(schemaSql);
        console.log(' All 11 Normalized Tables, Indexes & Foreign Keys Created.\n');

        // Step 2: Run Seed SQL
        const seedsPath = path.join(__dirname, 'seeds.sql');
        console.log(`[Step 2/2] Executing Seed Data from: ${path.basename(seedsPath)}...`);
        const seedsSql = fs.readFileSync(seedsPath, 'utf8');
        await connection.query(seedsSql);
        console.log(' Seed Data Populated (GEHU Accounts, Canonical Skills, Drives, MLFQ Queues).\n');

        // Step 3: Verification & Summary
        await connection.query('USE campus_forge');
        const [tables] = await connection.query('SHOW TABLES');
        
        console.log('---------------------------------------------------------------');
        console.log('  DATABASE VERIFICATION REPORT (campus_forge)');
        console.log('---------------------------------------------------------------');
        for (const row of tables) {
            const tableName = Object.values(row)[0];
            const [countRes] = await connection.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
            console.log(`  • ${tableName.padEnd(28)} : ${countRes[0].total} rows`);
        }
        console.log('---------------------------------------------------------------');
        console.log(' SUCCESS: Database setup completed with zero errors!\n');

    } catch (error) {
        console.error('\n DATABASE SETUP FAILED:');
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('>> Access Denied: Incorrect MySQL root password.');
            console.error('>> Please update DB_PASSWORD in server/.env with your MySQL root password and rerun.\n');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('>> Connection Refused: MySQL Server is not running on port 3306.');
            console.error('>> Please ensure the MySQL service is started.\n');
        } else {
            console.error(error.message);
        }
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runDatabaseSetup();
