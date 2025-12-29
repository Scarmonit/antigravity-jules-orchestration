/**
 * Batch Processing Module
 * Execute multiple Jules sessions in parallel with progress tracking
 */

/**
 * Batch processor for parallel session execution
 */
export class BatchProcessor {
    constructor(julesRequest, createSession) {
        this.julesRequest = julesRequest;
        this.createSession = createSession;
        this.batches = new Map(); // batchId -> batch state
    }

    /**
     * Generate unique batch ID
     */
    generateBatchId() {
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create multiple sessions from task array
     * @param {Array} tasks - Array of session configs
     * @param {Object} options - Batch options
     * @returns {Object} Batch info with session IDs
     */
    async createBatch(tasks, options = {}) {
        const batchId = this.generateBatchId();
        const parallel = options.parallel || 3;
        const results = [];
        const errors = [];

        console.log(`[Batch] Starting batch ${batchId} with ${tasks.length} tasks (parallel: ${parallel})`);

        // Process with sliding window concurrency
        let active = 0;
        let index = 0;

        // Helper to process a single task
        const processTask = async (task, i) => {
            try {
                console.log(`[Batch] Creating session ${i + 1}/${tasks.length}: ${task.title || 'Untitled'}`);
                const session = await this.createSession(task);
                return { success: true, task, session };
            } catch (error) {
                console.error(`[Batch] Failed to create session for task ${i + 1}:`, error.message);
                return { success: false, task, error: error.message };
            }
        };

        // Sliding window implementation
        const promises = [];

        while (index < tasks.length) {
            if (active < parallel) {
                const i = index++;
                const task = tasks[i];
                active++;

                const p = processTask(task, i).then(res => {
                    active--;
                    if (res.success) {
                        results.push(res);
                    } else {
                        errors.push(res);
                    }
                    return res;
                });
                promises.push(p);
            } else {
                // Wait for one to finish before starting next
                await Promise.race(promises.filter(p => !p.isFulfilled));
                // Note: Promise.race returns the value, but we need to track fulfillment
                // A simpler way: we don't strictly need to remove completed promises from `promises` array
                // if we just wait for *some* slot to open.
                // But better: use a recursive or iterative approach with a Set of active promises.
                // Let's rewrite this block slightly for clarity and correctness.
            }
        }

        // Revised robust sliding window
        /*
           We can't easily wait for "any" promise in the loop above without tracking them.
           Let's use a standard worker queue pattern.
        */

        // Reset and use simpler loop
    }

    // Overwriting createBatch completely with better implementation
    async createBatch(tasks, options = {}) {
        const batchId = this.generateBatchId();
        const parallel = options.parallel || 3;
        const results = [];
        const errors = [];

        console.log(`[Batch] Starting batch ${batchId} with ${tasks.length} tasks (parallel: ${parallel})`);

        // Sliding window implementation
        const activePromises = new Set();

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];

            // Wait if we reached concurrency limit
            if (activePromises.size >= parallel) {
                await Promise.race(activePromises);
            }

            const promise = (async () => {
                try {
                    console.log(`[Batch] Creating session ${i + 1}/${tasks.length}: ${task.title || 'Untitled'}`);
                    const session = await this.createSession(task);
                    results.push({ success: true, task, session });
                } catch (error) {
                    console.error(`[Batch] Failed to create session for task ${i + 1}:`, error.message);
                    errors.push({ success: false, task, error: error.message });
                }
            })();

            // Add to set and remove when done
            activePromises.add(promise);
            promise.finally(() => activePromises.delete(promise));
        }

        // Wait for remaining
        await Promise.all(activePromises);

        // Store batch state
        const batchState = {
            id: batchId,
            createdAt: new Date().toISOString(),
            totalTasks: tasks.length,
            sessions: results.map(r => ({
                id: r.session?.id || r.session?.name?.split('/').pop(),
                title: r.task.title,
                status: 'CREATED'
            })),
            errors,
            options
        };

        this.batches.set(batchId, batchState);

        // Cleanup old batches to prevent memory leaks (keep max 50)
        this._cleanupBatches();

        console.log(`[Batch] Batch ${batchId} created: ${results.length} sessions, ${errors.length} errors`);

        return {
            batchId,
            created: results.length,
            failed: errors.length,
            sessions: batchState.sessions,
            errors: errors.map(e => ({ task: e.task.title, error: e.error }))
        };
    }

    /**
     * Cleanup old batches
     */
    _cleanupBatches() {
        const MAX_BATCHES = 50;
        if (this.batches.size > MAX_BATCHES) {
            const entries = Array.from(this.batches.entries());
            // Sort by creation time (assuming keys inserted in order, but map preserves insertion order)
            // Just remove the first (oldest) ones
            const toRemove = entries.slice(0, this.batches.size - MAX_BATCHES);
            toRemove.forEach(([key]) => this.batches.delete(key));
        }
    }

    /**
     * Get status of all sessions in a batch
     */
    async getBatchStatus(batchId) {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }

        // Fetch current status for each session
        const statusPromises = batch.sessions.map(async (session) => {
            try {
                const details = await this.julesRequest('GET', `/sessions/${session.id}`);
                return {
                    id: session.id,
                    title: session.title,
                    state: details.state,
                    url: details.url
                };
            } catch (error) {
                return {
                    id: session.id,
                    title: session.title,
                    state: 'ERROR',
                    error: error.message
                };
            }
        });

        const statuses = await Promise.all(statusPromises);

        // Calculate summary
        const summary = {
            total: statuses.length,
            completed: statuses.filter(s => s.state === 'COMPLETED').length,
            inProgress: statuses.filter(s => s.state === 'IN_PROGRESS').length,
            planning: statuses.filter(s => s.state === 'PLANNING').length,
            failed: statuses.filter(s => s.state === 'ERROR' || s.state === 'FAILED').length,
            waiting: statuses.filter(s => s.state === 'WAITING_FOR_APPROVAL').length
        };

        return {
            batchId,
            createdAt: batch.createdAt,
            summary,
            sessions: statuses,
            isComplete: summary.completed + summary.failed === summary.total
        };
    }

    /**
     * Approve all pending sessions in a batch
     */
    async approveAllInBatch(batchId) {
        const status = await this.getBatchStatus(batchId);
        const waitingSessions = status.sessions.filter(s =>
            s.state === 'WAITING_FOR_APPROVAL' ||
            s.state === 'AWAITING_PLAN_APPROVAL' ||
            s.state === 'PLANNING'
        );

        const approvalResults = await Promise.all(
            waitingSessions.map(async (session) => {
                try {
                    await this.julesRequest('POST', `/sessions/${session.id}:approvePlan`, {});
                    return { id: session.id, approved: true };
                } catch (error) {
                    return { id: session.id, approved: false, error: error.message };
                }
            })
        );

        return {
            batchId,
            approved: approvalResults.filter(r => r.approved).length,
            failed: approvalResults.filter(r => !r.approved).length,
            results: approvalResults
        };
    }

    /**
     * List all batches
     */
    listBatches() {
        return Array.from(this.batches.values()).map(b => ({
            id: b.id,
            createdAt: b.createdAt,
            totalTasks: b.totalTasks,
            sessionCount: b.sessions.length,
            errorCount: b.errors.length
        }));
    }
}

export default BatchProcessor;
