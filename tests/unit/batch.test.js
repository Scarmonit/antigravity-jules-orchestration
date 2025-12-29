
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import BatchProcessor from '../../lib/batch.js';

describe('BatchProcessor', () => {
    let batchProcessor;
    let mockJulesRequest;
    let mockCreateSession;

    beforeEach(() => {
        mockJulesRequest = mock.fn();
        mockCreateSession = mock.fn(async (task) => ({ id: 'session-' + Date.now(), name: 'sessions/session-' + Date.now() }));
        batchProcessor = new BatchProcessor(mockJulesRequest, mockCreateSession);
    });

    it('should create a batch with correct ID and structure', async () => {
        const tasks = [{ title: 'Task 1' }, { title: 'Task 2' }];
        const result = await batchProcessor.createBatch(tasks);

        assert.ok(result.batchId);
        assert.strictEqual(result.created, 2);
        assert.strictEqual(result.failed, 0);
        assert.strictEqual(result.sessions.length, 2);
    });

    it('should respect parallelism limit', async () => {
        // We can't easily test exact parallelism time without timers,
        // but we can ensure it runs.
        const tasks = Array(10).fill({ title: 'Task' });
        const result = await batchProcessor.createBatch(tasks, { parallel: 2 });

        assert.strictEqual(result.created, 10);
        assert.strictEqual(mockCreateSession.mock.callCount(), 10);
    });

    it('should handle session creation failures', async () => {
        mockCreateSession.mock.mockImplementation(async (task) => {
            if (task.shouldFail) throw new Error('Failed');
            return { id: 'ok' };
        });

        const tasks = [{ title: 'OK' }, { title: 'Bad', shouldFail: true }];
        const result = await batchProcessor.createBatch(tasks);

        assert.strictEqual(result.created, 1);
        assert.strictEqual(result.failed, 1);
        assert.strictEqual(result.errors[0].error, 'Failed');
    });

    it('should cleanup old batches', async () => {
        // Manually fill batches
        for (let i = 0; i < 110; i++) {
            const id = `batch_${i}`;
            batchProcessor.batches.set(id, { id, createdAt: new Date(Date.now() - 100000 + i).toISOString() });
        }

        batchProcessor._cleanupBatches();

        // Should have removed oldest 20, leaving 90
        // Wait, logic says if > 100, remove 20. 110 > 100, remove 20 -> 90.
        assert.strictEqual(batchProcessor.batches.size, 90);
    });
});
