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

        // Prepare storage for results, ensuring order is preserved via index
        const results = new Array(tasks.length).fill(null);

        console.log(`[Batch] Starting batch ${batchId} with ${tasks.length} tasks (parallel: ${parallel})`);

        // Optimization: Sliding window concurrency (worker pool)
        // Replacing the previous chunked approach (Promise.all on slices) with a worker pool.
        // This eliminates head-of-line blocking where a slow task in a chunk prevents
        // the next chunk from starting, even if other workers are idle.
        // Impact: Reduces total batch time when task durations vary.

        // Create a queue of tasks with their original indices
        const queue = tasks.map((task, index) => ({ task, index }));

        const worker = async () => {
            while (queue.length > 0) {
                // Get next task atomically (single-threaded JS event loop ensures safety)
                const item = queue.shift();
                if (!item) break; // Queue empty

                const { task, index } = item;

                try {
                    console.log(`[Batch] Creating session ${index + 1}/${tasks.length}: ${task.title || 'Untitled'}`);
                    const session = await this.createSession(task);
                    results[index] = { success: true, task, session };
                } catch (error) {
                    console.error(`[Batch] Failed to create session for task ${index + 1}:`, error.message);
                    results[index] = { success: false, task, error: error.message };
                }
            }
        };

        // Start workers
        const numWorkers = Math.min(parallel, tasks.length);
        const workers = [];
        for (let i = 0; i < numWorkers; i++) {
            workers.push(worker());
        }

        // Wait for all workers to finish
        await Promise.all(workers);

        // Separate results and errors while maintaining relative order
        const successfulResults = results.filter(r => r && r.success);
        const errorResults = results.filter(r => r && !r.success);

        // Store batch state
        const batchState = {
            id: batchId,
            createdAt: new Date().toISOString(),
            totalTasks: tasks.length,
            sessions: successfulResults.map(r => ({
                id: r.session?.id || r.session?.name?.split('/').pop(),
                title: r.task.title,
                status: 'CREATED'
            })),
            errors: errorResults,
            options
        };

        this.batches.set(batchId, batchState);

        console.log(`[Batch] Batch ${batchId} created: ${successfulResults.length} sessions, ${errorResults.length} errors`);

        return {
            batchId,
            created: successfulResults.length,
            failed: errorResults.length,
            sessions: batchState.sessions,
            errors: errorResults.map(e => ({ task: e.task.title, error: e.error }))
        };
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
