const { pool } = require('../config/db');

/**
 * ==============================================================================
 * CAMPUSFORGE: OPERATING SYSTEM SCHEDULER & AGING ENGINE
 * ==============================================================================
 * Implements real OS scheduling principles to solve Opportunity Starvation:
 * 
 * 1. MULTI-LEVEL FEEDBACK QUEUE (MLFQ):
 *    - Queue 0 (Highest / Urgent): Time Quantum = 48 Hours. (Base Priority: 80)
 *    - Queue 1 (Standard): Time Quantum = 96 Hours. (Base Priority: 50)
 *    - Queue 2 (Low / Background): Time Quantum = 240 Hours. (Base Priority: 20)
 * 
 * 2. DYNAMIC AGING ALGORITHM (Anti-Starvation):
 *    Popular jobs get hundreds of student clicks. Niche / core jobs (like DRDO
 *    Embedded Systems) receive 0 clicks and would starve indefinitely.
 *    The Aging Boost mathematically amplifies neglected jobs:
 *      AgingBoost = alpha * (WaitTimeHours / LifespanHours) * (1 / (1 + ApplyClicks))
 * 
 * 3. PERIODIC PRIORITY BOOST (MLFQ Rule 5):
 *    After epoch interval S (or when starvation counter exceeds threshold),
 *    neglected jobs in Q2 are boosted back to Queue 0 to prevent starvation.
 * 
 * 4. SCHEDULER AUDIT TRAIL:
 *    Every queue transition or starvation rescue is permanently logged to
 *    `scheduler_audit_logs` for external examiner demonstration during viva.
 * ==============================================================================
 */

const QUEUE_CONFIG = {
    0: { name: 'Urgent / Fresh Opportunities', quantumHours: 48, baseScore: 80.0 },
    1: { name: 'Standard Active Drives', quantumHours: 96, baseScore: 50.0 },
    2: { name: 'Background / Niche Drives', quantumHours: 240, baseScore: 20.0 }
};

/**
 * Calculates Dynamic Aging Boost score [0.00 to 50.00]
 * 
 * @param {number} waitTimeHours - Hours elapsed since drive was published
 * @param {number} lifespanHours - Total expected active window until deadline
 * @param {number} applyClicks - Student application / interaction count
 * @returns {number} Boost score rounded to 2 decimal places
 */
function calculateAgingBoost(waitTimeHours, lifespanHours, applyClicks) {
    const alpha = 50.0; // Maximum boost weight
    const safeLifespan = Math.max(24.0, lifespanHours || 336.0); // Minimum 24h lifespan fallback (default 14 days)
    const safeWait = Math.max(0.0, waitTimeHours || 0.0);
    const safeClicks = Math.max(0, applyClicks || 0);

    // As deadline approaches, urgency approaches 1.0
    const urgencyRatio = Math.min(1.0, safeWait / safeLifespan);

    // As clicks remain 0, starvation factor is 1.0; as clicks grow, factor drops toward 0.0
    const starvationFactor = 1.0 / (1.0 + safeClicks);

    const boost = alpha * urgencyRatio * starvationFactor;
    return parseFloat(Math.min(50.0, boost).toFixed(2));
}

/**
 * Computes Final Priority Score [0.00 to 100.00]
 */
function computeFinalPriorityScore(currentQueue, agingBoostScore) {
    const queueBase = QUEUE_CONFIG[currentQueue] ? QUEUE_CONFIG[currentQueue].baseScore : 50.0;
    const finalScore = queueBase + (parseFloat(agingBoostScore) || 0.0);
    return parseFloat(Math.min(100.0, finalScore).toFixed(2));
}

/**
 * Executes a simulated or real Operating System scheduling tick.
 * Evaluates quantum expiration, computes aging boosts, handles starvation,
 * and records transitions in `scheduler_audit_logs`.
 * 
 * @param {Object} options
 * @param {number} options.timeStepHours - Hours simulated in this cycle (default 24)
 * @param {boolean} options.forceEpochBoost - Force MLFQ Rule 5 (Priority boost all Q2 candidates)
 * @param {number} options.starvationThreshold - Starvation counter limit before rescue (default 3)
 */
async function runSchedulingCycle(options = {}) {
    const timeStepHours = options.timeStepHours || 24;
    const forceEpochBoost = options.forceEpochBoost || false;
    const starvationThreshold = options.starvationThreshold || 3;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Fetch all verified opportunities and their current MLFQ states
        const [drives] = await connection.query(`
            SELECT 
                i.id AS internship_id,
                i.title,
                i.company_name,
                i.created_at,
                i.deadline,
                s.current_queue,
                s.quantum_remaining_hours,
                s.total_impressions,
                s.apply_clicks,
                s.starvation_counter,
                s.aging_boost_score,
                s.final_priority_score
            FROM internships i
            JOIN mlfq_scheduler_state s ON i.id = s.internship_id
            WHERE i.verification_status = 'VERIFIED'
        `);

        const telemetryEvents = [];
        let demotionsCount = 0;
        let promotionsCount = 0;

        const now = new Date();

        for (const drive of drives) {
            let currentQueue = drive.current_queue;
            let quantumRemaining = drive.quantum_remaining_hours - timeStepHours;
            let starvationCounter = drive.starvation_counter;
            let actionType = null;
            let oldQueue = currentQueue;
            let newQueue = currentQueue;
            let reason = '';

            // Calculate hours active (wait time) and expected lifespan
            const createdAt = new Date(drive.created_at);
            const waitTimeHours = Math.max(1, (now - createdAt) / (1000 * 60 * 60));
            
            let lifespanHours = 336; // Default 14 days
            if (drive.deadline) {
                const deadlineDate = new Date(drive.deadline);
                lifespanHours = Math.max(24, (deadlineDate - createdAt) / (1000 * 60 * 60));
            }

            // If drive has had ZERO student clicks, its starvation counter increases
            if (drive.apply_clicks === 0) {
                starvationCounter += 1;
            } else {
                // Decay starvation counter if active
                starvationCounter = Math.max(0, starvationCounter - 1);
            }

            // ==============================================================
            // MLFQ STATE MACHINE TRANSITION RULES:
            // ==============================================================

            // RULE A: STARVATION RESCUE / PRIORITY BOOST (MLFQ Rule 5)
            // If in Q2 and starved (or periodic epoch fired), promote to Q0!
            if (currentQueue === 2 && (starvationCounter >= starvationThreshold || forceEpochBoost)) {
                newQueue = 0;
                quantumRemaining = QUEUE_CONFIG[0].quantumHours;
                starvationCounter = 0; // Reset after rescue
                actionType = forceEpochBoost ? 'PRIORITY_BOOST_CYCLE' : 'STARVATION_RESCUE';
                reason = forceEpochBoost 
                    ? 'Global Epoch Priority Boost: All neglected candidates promoted to Q0'
                    : `Starvation Counter reached ${drive.starvation_counter} with 0 clicks: Rescued to Q0`;
                promotionsCount++;
            }
            // RULE B: QUANTUM EXPIRATION DEMOTION Q0 -> Q1
            else if (currentQueue === 0 && quantumRemaining <= 0) {
                newQueue = 1;
                quantumRemaining = QUEUE_CONFIG[1].quantumHours;
                actionType = 'QUANTUM_EXPIRE_DEMOTE';
                reason = `Quantum expired in Q0 (${QUEUE_CONFIG[0].quantumHours}h consumed): Demoted to Q1`;
                demotionsCount++;
            }
            // RULE C: QUANTUM EXPIRATION DEMOTION Q1 -> Q2
            else if (currentQueue === 1 && quantumRemaining <= 0) {
                newQueue = 2;
                quantumRemaining = QUEUE_CONFIG[2].quantumHours;
                actionType = 'QUANTUM_EXPIRE_DEMOTE';
                reason = `Quantum expired in Q1 (${QUEUE_CONFIG[1].quantumHours}h consumed): Demoted to Q2`;
                demotionsCount++;
            }

            // Calculate Dynamic Aging Boost
            const newAgingBoost = calculateAgingBoost(waitTimeHours, lifespanHours, drive.apply_clicks);
            const newFinalScore = computeFinalPriorityScore(newQueue, newAgingBoost);

            // Update MLFQ state in MySQL
            await connection.query(`
                UPDATE mlfq_scheduler_state
                SET current_queue = ?,
                    quantum_remaining_hours = ?,
                    starvation_counter = ?,
                    aging_boost_score = ?,
                    final_priority_score = ?,
                    last_state_change = CURRENT_TIMESTAMP
                WHERE internship_id = ?
            `, [newQueue, quantumRemaining, starvationCounter, newAgingBoost, newFinalScore, drive.internship_id]);

            // If a state transition occurred, write to immutable audit log
            if (actionType) {
                await connection.query(`
                    INSERT INTO scheduler_audit_logs 
                    (internship_id, action_type, old_queue, new_queue, aging_score_applied, reason)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [drive.internship_id, actionType, oldQueue, newQueue, newAgingBoost, reason]);

                telemetryEvents.push({
                    internshipId: drive.internship_id,
                    company: drive.company_name,
                    title: drive.title,
                    actionType,
                    oldQueue,
                    newQueue,
                    agingScore: newAgingBoost,
                    finalScore: newFinalScore,
                    reason
                });
            }
        }

        await connection.commit();

        return {
            success: true,
            totalEvaluated: drives.length,
            timeStepHoursSimulated: timeStepHours,
            promotionsCount,
            demotionsCount,
            telemetryEvents
        };

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error in runSchedulingCycle:', error);
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Returns comprehensive OS dashboard metrics for TPO & examiners:
 * - Queue distribution counts (Q0, Q1, Q2)
 * - Starving opportunities list
 * - Audit logs history
 */
async function getOSDashboardTelemetry() {
    // 1. Queue distribution counts
    const [queueDist] = await pool.query(`
        SELECT 
            current_queue,
            COUNT(*) AS total_jobs,
            AVG(aging_boost_score) AS avg_aging_boost,
            AVG(final_priority_score) AS avg_priority
        FROM mlfq_scheduler_state s
        JOIN internships i ON s.internship_id = i.id
        WHERE i.verification_status = 'VERIFIED'
        GROUP BY current_queue
        ORDER BY current_queue ASC
    `);

    // 2. Starving Opportunities (in Q2 with 0 clicks)
    const [starvingJobs] = await pool.query(`
        SELECT 
            i.id,
            i.title,
            i.company_name,
            i.eligible_branches,
            s.current_queue,
            s.starvation_counter,
            s.apply_clicks,
            s.aging_boost_score,
            s.final_priority_score
        FROM internships i
        JOIN mlfq_scheduler_state s ON i.id = s.internship_id
        WHERE i.verification_status = 'VERIFIED'
          AND s.apply_clicks = 0
        ORDER BY s.starvation_counter DESC, s.aging_boost_score DESC
        LIMIT 10
    `);

    // 3. Recent 20 Audit Log records
    const [auditLogs] = await pool.query(`
        SELECT 
            a.id,
            a.internship_id,
            i.company_name,
            i.title,
            a.action_type,
            a.old_queue,
            a.new_queue,
            a.aging_score_applied,
            a.reason,
            a.executed_at
        FROM scheduler_audit_logs a
        JOIN internships i ON a.internship_id = i.id
        ORDER BY a.executed_at DESC
        LIMIT 20
    `);

    return {
        queueConfig: QUEUE_CONFIG,
        queueDistribution: queueDist,
        starvingJobs,
        recentAuditLogs: auditLogs
    };
}

module.exports = {
    calculateAgingBoost,
    computeFinalPriorityScore,
    runSchedulingCycle,
    getOSDashboardTelemetry,
    QUEUE_CONFIG
};
