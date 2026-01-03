
import { test } from 'node:test';
import assert from 'node:assert';
import { chunkText } from '../../rag.js';
import { SessionQueue } from '../../session-queue.js';
import { LRUCache } from '../../lru-cache.js';

test('SessionQueue cleanup works efficiently', async (t) => {
    const queue = new SessionQueue(2); // Retain max 2

    // Add items
    const item1 = queue.add({ title: 'Task 1' });
    const item2 = queue.add({ title: 'Task 2' });
    const item3 = queue.add({ title: 'Task 3' });
    const item4 = queue.add({ title: 'Task 4' });

    // Mark as completed
    queue.markComplete(item1.id, 'session_1');
    queue.markComplete(item2.id, 'session_2');
    queue.markComplete(item3.id, 'session_3');

    // item4 is pending. item1, item2, item3 are completed.
    // Retained should be max 2 completed items.
    // Cleanup happens on modification.

    // item4 is pending, so it stays.
    // completed: 1, 2, 3. Count = 3. Max = 2.
    // Should remove 1 item.
    // In current logic, we removed "slice(0, length - maxRetained)".
    // completed list is [1, 2, 3] (since they were added in that order and queue is sorted by priority, assuming equal priority).
    // slice(0, 1) is [1]. So item 1 should be removed.

    const list = queue.list();
    const ids = list.map(i => i.id);

    assert.strictEqual(list.length, 3); // 1 pending + 2 completed
    assert.ok(ids.includes(item4.id)); // Pending
    assert.ok(ids.includes(item3.id)); // Completed
    assert.ok(ids.includes(item2.id)); // Completed
    assert.ok(!ids.includes(item1.id)); // Removed
});

test('LRUCache evicts efficiently', (t) => {
    const cache = new LRUCache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // Should evict 'a'

    assert.strictEqual(cache.get('a'), null);
    assert.strictEqual(cache.get('b'), 2);
    assert.strictEqual(cache.get('c'), 3);
});

test('RAG chunkText functionality', (t) => {
    const text = "Hello world".repeat(100);
    const chunks = chunkText(text, 100, 10);
    assert.ok(chunks.length > 0);
    assert.ok(chunks[0].content.length <= 100);
});
