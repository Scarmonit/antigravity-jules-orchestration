import assert from 'assert';
import { test, describe, it, beforeEach } from 'node:test';
import { SessionQueue } from '../../lib/session-queue.js';

describe('SessionQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new SessionQueue(2); // Max retained: 2
  });

  it('should add items with priority', () => {
    queue.add({ title: 'Low Priority' }, 10);
    queue.add({ title: 'High Priority' }, 1);

    const next = queue.getNext();
    assert.strictEqual(next.config.title, 'High Priority');
  });

  it('should mark items as processing and complete', () => {
    const item = queue.add({ title: 'Task' });
    queue.markProcessing(item.id);
    assert.strictEqual(queue.list()[0].status, 'processing');

    queue.markComplete(item.id, 'session-123');
    assert.strictEqual(queue.list()[0].status, 'completed');
    assert.strictEqual(queue.list()[0].sessionId, 'session-123');
  });

  it('should cleanup old items', () => {
    // Add 3 completed items, maxRetained is 2
    const item1 = queue.add({ title: '1' });
    queue.markComplete(item1.id, 's1');

    const item2 = queue.add({ title: '2' });
    queue.markComplete(item2.id, 's2');

    const item3 = queue.add({ title: '3' });
    queue.markComplete(item3.id, 's3');

    const list = queue.list();
    assert.strictEqual(list.length, 2);
    assert.ok(list.find(i => i.id === item2.id));
    assert.ok(list.find(i => i.id === item3.id));
    assert.strictEqual(list.find(i => i.id === item1.id), undefined);
  });
});
