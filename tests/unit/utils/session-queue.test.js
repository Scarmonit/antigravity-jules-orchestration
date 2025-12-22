import { test } from 'node:test';
import assert from 'node:assert';
import { SessionQueue } from '../../../utils/session-queue.js';

test('SessionQueue - basic operations', () => {
  const queue = new SessionQueue();

  // Add items
  const item1 = queue.add({ title: 'Task 1' }, 1);
  const item2 = queue.add({ title: 'Task 2' }, 2);

  assert.strictEqual(queue.stats().total, 2);
  assert.strictEqual(queue.stats().pending, 2);

  // Get next item (should be lowest priority number first if ascending, or highest if descending)
  // The code says: this.queue.sort((a, b) => a.priority - b.priority);
  // So smaller number = higher priority? Or just sorted by priority?
  // Usually priority 1 is higher than 5. Let's assume queue processes index 0 first.
  // Code: getNext() { return this.queue.find(i => i.status === 'pending'); }
  // Find returns first element.
  // So sorted by a.priority - b.priority means ascending order.
  // If 1 is high priority and 5 is low, then it works.

  const next = queue.getNext();
  assert.strictEqual(next.id, item1.id);

  // Mark processing
  queue.markProcessing(next.id);
  assert.strictEqual(queue.stats().processing, 1);
  assert.strictEqual(queue.stats().pending, 1);

  // Mark complete
  queue.markComplete(next.id, 'session_123');
  assert.strictEqual(queue.stats().completed, 1);
  assert.strictEqual(queue.stats().processing, 0);

  const completedItem = queue.list().find(i => i.id === item1.id);
  assert.strictEqual(completedItem.status, 'completed');
  assert.strictEqual(completedItem.sessionId, 'session_123');
});

test('SessionQueue - cleanup', () => {
  const queue = new SessionQueue(2); // Max retained 2

  // Add 3 items
  const item1 = queue.add({ title: 'Task 1' });
  const item2 = queue.add({ title: 'Task 2' });
  const item3 = queue.add({ title: 'Task 3' });

  // Complete all
  queue.markComplete(item1.id, 's1');
  queue.markComplete(item2.id, 's2');
  queue.markComplete(item3.id, 's3');

  // Should only have 2 retained
  assert.strictEqual(queue.stats().total, 2);
  // The oldest one (item1) should be removed?
  // _cleanup removes from the beginning of the list of terminal items.
  // queue is sorted by priority. if all same priority, order of insertion.
  const list = queue.list();
  assert.strictEqual(list.length, 2);
  // item1 should be gone
  assert.ok(!list.find(i => i.id === item1.id));
  assert.ok(list.find(i => i.id === item2.id));
  assert.ok(list.find(i => i.id === item3.id));
});
