const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { pool, testConnection } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// ==============================================================================
// 1. CORE MIDDLEWARE EXPLANATION
// ==============================================================================
// CORS: Allows our React frontend (running on a different port like 5173) to communicate
// with this Express API server without browser security blocks.
app.use(cors());

// Express JSON Parser: Automatically parses incoming JSON request bodies into `req.body`
app.use(express.json());

// Express URL-Encoded Parser: Parses standard HTML form data submissions
app.use(express.urlencoded({ extended: true }));

// Serve static assets (e.g. GEHU campus photos)
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

// ==============================================================================
// 2. ROUTE MOUNTING (PHASE 2 & PHASE 3)
// ==============================================================================
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);

// ==============================================================================
// 3. HEALTH & SYSTEM DIAGNOSTIC ROUTES
// ==============================================================================
app.get('/api/health', async (req, res) => {
    let dbStatus = 'DISCONNECTED';
    try {
        const [rows] = await pool.query('SELECT 1 + 1 AS result');
        if (rows && rows[0].result === 2) {
            dbStatus = 'CONNECTED';
        }
    } catch (err) {
        dbStatus = `ERROR: ${err.message}`;
    }

    res.json({
        success: true,
        project: 'CampusForge API',
        institution: 'Graphic Era Hill University, Bhimtal',
        server: 'Online',
        database: dbStatus,
        timestamp: new Date().toISOString()
    });
});

// Root welcome route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to CampusForge Backend API — Graphic Era Hill University, Bhimtal',
        healthCheck: '/api/health',
        documentation: 'See database/schema.sql and project documentation for full schema'
    });
});

// ==============================================================================
// 3. SERVER STARTUP & DATABASE PING
// ==============================================================================
app.listen(PORT, async () => {
    console.log('===============================================================');
    console.log(`  CAMPUSFORGE BACKEND SERVER RUNNING ON PORT ${PORT}`);
    console.log(`  Institution: Graphic Era Hill University, Bhimtal`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log('===============================================================');
    await testConnection();
});

module.exports = app;
