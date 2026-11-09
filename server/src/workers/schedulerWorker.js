const { runSchedulingCycle } = require('../services/osScheduler');

/**
 * ==============================================================================
 * OPERATING SYSTEM SCHEDULER BACKGROUND WORKER (Timer Interrupt Simulation)
 * ==============================================================================
 * Simulates real OS clock ticks in the background.
 * Periodically recalculates aging boosts, checks time quantums,
 * and executes priority boost cycles.
 */

let workerInterval = null;

function startSchedulerWorker(intervalMs = 60 * 60 * 1000) { // Default: Every 1 hour
    if (workerInterval) {
        console.log('[OS Scheduler Worker] Already running.');
        return;
    }

    console.log(`[OS Scheduler Worker] Initialized. Background clock tick frequency: ${intervalMs / 1000}s`);

    workerInterval = setInterval(async () => {
        try {
            console.log('[OS Scheduler Worker] Clock tick: running scheduling cycle...');
            const results = await runSchedulingCycle({ timeStepHours: 1 });
            if (results.demotionsCount > 0 || results.promotionsCount > 0) {
                console.log(`[OS Scheduler Worker] Transitions: ${results.promotionsCount} promoted, ${results.demotionsCount} demoted.`);
            }
        } catch (err) {
            console.error('[OS Scheduler Worker] Error executing clock tick:', err.message);
        }
    }, intervalMs);
}

function stopSchedulerWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
        console.log('[OS Scheduler Worker] Stopped.');
    }
}

module.exports = {
    startSchedulerWorker,
    stopSchedulerWorker
};
