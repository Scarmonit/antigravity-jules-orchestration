/**
 * Batch Processing Module
 * Execute multiple Jules sessions in parallel with progress tracking
 */

/**
 * Batch processor for parallel session execution with progress tracking
 */
export class BatchProcessor {
  /**
   * Create a BatchProcessor instance
   * @param {Function} julesRequest - Function to make Jules API requests
   * @param {Function} createSession - Function to create individual sessions
   */
  constructor(julesRequest, createSession) {
    this.julesRequest = julesRequest;
    this.createSession = createSession;
    /** @type {Map<string, Object>} Map of batch ID to batch state */
    this.batches = new Map();
  }

  /**
   * Generate unique batch ID with timestamp and random suffix
   * @returns {string} Unique batch ID (e.g., "batch_1234567890_abc123")
   */
  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create multiple sessions from task array in parallel batches
   * @param {Array<Object>} tasks - Array of session configuration objects
   * @param {Object} [options={}] - Batch options
   * @param {number} [options.parallel=3] - Max parallel sessions (1-10)
   * @returns {Promise<Object>} Batch result with batchId, created count, failed count, sessions array
   * @throws {Error} If task array is invalid
   */
  async createBatch(tasks, options = {}) {
    const batchId = this.generateBatchId();
    const parallel = options.parallel || 3;
    const results = [];
    const errors = [];

    console.log(`[Batch] Starting batch ${batchId} with ${tasks.length} tasks (parallel: ${parallel})`);

    // Process in chunks based on parallelism
    for (let i = 0; i < tasks.length; i += parallel) {
      const chunk = tasks.slice(i, i + parallel);
      const chunkPromises = chunk.map(async (task, idx) => {
        try {
          console.log(`[Batch] Creating session ${i + idx + 1}/${tasks.length}: ${task.title || 'Untitled'}`);
          const session = await this.createSession(task);
          return { success: true, task, session };
        } catch (error) {
          console.error(`[Batch] Failed to create session for task ${i + idx + 1}:`, error.message);
          return { success: false, task, error: error.message };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach((r) => {
        if (r.success) {
          results.push(r);
        } else {
          errors.push(r);
        }
      });
    }

    // Store batch state
    const batchState = {
      id: batchId,
      createdAt: new Date().toISOString(),
      totalTasks: tasks.length,
      sessions: results.map((r) => ({
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
      errors: errors.map((e) => ({ task: e.task.title, error: e.error }))
    };
  }

  /**
   * Get current status of all sessions in a batch
   * @param {string} batchId - Batch ID to query
   * @returns {Promise<Object>} Batch status with summary and individual session statuses
   * @throws {Error} If batch not found
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
      completed: statuses.filter((s) => s.state === 'COMPLETED').length,
      inProgress: statuses.filter((s) => s.state === 'IN_PROGRESS').length,
      planning: statuses.filter((s) => s.state === 'PLANNING').length,
      failed: statuses.filter((s) => s.state === 'ERROR' || s.state === 'FAILED').length,
      waiting: statuses.filter((s) => s.state === 'WAITING_FOR_APPROVAL').length
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
   * Approve all pending sessions in a batch that are waiting for plan approval
   * @param {string} batchId - Batch ID
   * @returns {Promise<Object>} Approval results with approved/failed counts
   * @throws {Error} If batch status fetch fails
   */
  async approveAllInBatch(batchId) {
    const status = await this.getBatchStatus(batchId);
    const waitingSessions = status.sessions.filter((s) =>
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
      approved: approvalResults.filter((r) => r.approved).length,
      failed: approvalResults.filter((r) => !r.approved).length,
      results: approvalResults
    };
  }

  /**
   * List all created batches with summary information
   * @returns {Array<Object>} Array of batch summaries with id, createdAt, totalTasks, sessionCount, errorCount
   */
  listBatches() {
    return Array.from(this.batches.values()).map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      totalTasks: b.totalTasks,
      sessionCount: b.sessions.length,
      errorCount: b.errors.length
    }));
  }
}

export default BatchProcessor;
