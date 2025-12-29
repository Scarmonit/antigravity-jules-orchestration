import { test } from 'node:test';
import assert from 'node:assert';
import { BatchProcessor } from '../../lib/batch.js';

test('BatchProcessor performance benchmark', async (t) => {
    // Mock createSession with delays
    const createSession = async (task) => {
        await new Promise(resolve => setTimeout(resolve, task.delay));
        if (task.shouldFail) throw new Error('Task failed');
        return { id: `session-${task.id}`, name: `sessions/${task.id}` };
    };

    const processor = new BatchProcessor(null, createSession);

    // Scenario:
    // Parallelism = 2
    // Task 1: 200ms (Long)
    // Tasks 2-6: 20ms (Short)
    //
    // Chunking (Limit 2):
    // Chunk 1: [T1, T2]. Max(200, 20) = 200ms.
    // Chunk 2: [T3, T4]. Max(20, 20) = 20ms.
    // Chunk 3: [T5, T6]. Max(20, 20) = 20ms.
    // Expected Total (Chunking): 240ms + overhead.
    //
    // Sliding Window (Limit 2):
    // Slot 1: T1 (0-200ms)
    // Slot 2: T2 (0-20), T3 (20-40), T4 (40-60), T5 (60-80), T6 (80-100)
    // All short tasks finish by 100ms.
    // T1 finishes at 200ms.
    // Expected Total (Sliding): 200ms + overhead.

    const tasks = [
        { id: 1, delay: 200, title: 'Long Task' },
        { id: 2, delay: 20, title: 'Short Task 1' },
        { id: 3, delay: 20, title: 'Short Task 2' },
        { id: 4, delay: 20, title: 'Short Task 3' },
        { id: 5, delay: 20, title: 'Short Task 4' },
        { id: 6, delay: 20, title: 'Short Task 5' },
    ];

    const start = Date.now();
    await processor.createBatch(tasks, { parallel: 2 });
    const duration = Date.now() - start;

    console.log(`Batch Processing Duration: ${duration}ms`);

    // Check results count
    const batchId = processor.batches.keys().next().value;
    const batch = processor.batches.get(batchId);
    assert.strictEqual(batch.sessions.length, 6);
});
