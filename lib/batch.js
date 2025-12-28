/**
 * Batch Processing Module
 * Execute multiple Jules sessions in parallel with progress tracking
 */

import pLimit from 'p-limit';

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

        const limit = pLimit(parallel);

        const promises = tasks.map((task, idx) => {
            return limit(async () => {
                try {
                    console.log(`[Batch] Creating session ${idx + 1}/${tasks.length}: ${task.title || 'Untitled'}`);
                    const session = await this.createSession(task);
                    return { success: true, task, session };
                } catch (error) {
                    console.error(`[Batch] Failed to create session for task ${idx + 1}:`, error.message);
                    return { success: false, task, error: error.message };
                }
            });
        });

        const taskResults = await Promise.all(promises);

        taskResults.forEach(r => {
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
        this._cleanupBatches(); // Clean old batches to prevent memory leak

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
        // We use pLimit here too to avoid overwhelming the API
        const limit = pLimit(5); // Conservative limit for status checks

        const statusPromises = batch.sessions.map((session) => {
            return limit(async () => {
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

        const limit = pLimit(5);

        const approvalResults = await Promise.all(
            waitingSessions.map((session) => {
                return limit(async () => {
                    try {
                        await this.julesRequest('POST', `/sessions/${session.id}:approvePlan`, {});
                        return { id: session.id, approved: true };
                    } catch (error) {
                        return { id: session.id, approved: false, error: error.message };
                    }
                });
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

    /**
     * Cleanup old batches to prevent memory leaks
     */
    _cleanupBatches() {
        const MAX_BATCHES = 100;
        if (this.batches.size > MAX_BATCHES) {
            // Convert to array, sort by creation time (oldest first)
            const sortedBatches = Array.from(this.batches.entries())
                .sort(([, a], [, b]) => new Date(a.createdAt) - new Date(b.createdAt));

            // Remove oldest 20 batches
            const toRemove = sortedBatches.slice(0, 20);
            toRemove.forEach(([id]) => this.batches.delete(id));
            console.log(`[Batch] Cleaned up ${toRemove.length} old batches`);
        }
    }
}

export default BatchProcessor;
