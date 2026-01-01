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

        // Optimization: Use sliding window concurrency instead of chunks
        // This prevents slow tasks in a chunk from blocking fast tasks in the next chunk
        const allResults = new Array(tasks.length);
        let taskIndex = 0;

        const worker = async () => {
            while (taskIndex < tasks.length) {
                const currentIndex = taskIndex++;
                const task = tasks[currentIndex];

                try {
                    console.log(`[Batch] Creating session ${currentIndex + 1}/${tasks.length}: ${task.title || 'Untitled'}`);
                    const session = await this.createSession(task);
                    allResults[currentIndex] = { success: true, task, session };
                } catch (error) {
                    console.error(`[Batch] Failed to create session for task ${currentIndex + 1}:`, error.message);
                    allResults[currentIndex] = { success: false, task, error: error.message };
                }
            }
        };

        const workers = Array(Math.min(parallel, tasks.length))
            .fill(null)
            .map(() => worker());

        await Promise.all(workers);

        // Separate results and errors while preserving input order relative to success/failure logic
        // Note: original implementation pushed to results/errors as chunks completed.
        // We will just filter them out from the ordered array.
        allResults.forEach(r => {
            if (r.success) {
                results.push(r);
            } else {
                errors.push(r);
            }
        });

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
