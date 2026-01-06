import assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import fs from 'fs';
import path from 'path';
import { SessionQueue } from '../../lib/session-queue.js';

describe('SessionQueue', () => {
  const TEST_PERSISTENCE_FILE = '.jules/test-session-queue.json';

  beforeEach(() => {
    // Clean up before test
    if (fs.existsSync(TEST_PERSISTENCE_FILE)) {
      fs.unlinkSync(TEST_PERSISTENCE_FILE);
    }
  });

  afterEach(() => {
    // Clean up after test
    if (fs.existsSync(TEST_PERSISTENCE_FILE)) {
      fs.unlinkSync(TEST_PERSISTENCE_FILE);
    }
  });

  it('should add and retrieve items sorted by priority', () => {
    const queue = new SessionQueue(100, TEST_PERSISTENCE_FILE);
    queue.add({ title: 'Low Priority' }, 10);
    queue.add({ title: 'High Priority' }, 1);

    const first = queue.getNext();
    assert.strictEqual(first.priority, 1);
    assert.strictEqual(first.config.title, 'High Priority');
  });

  it('should persist state to file', () => {
    let queue = new SessionQueue(100, TEST_PERSISTENCE_FILE);
    queue.add({ title: 'Persisted Task' }, 5);

    // Create new instance pointing to same file
    queue = new SessionQueue(100, TEST_PERSISTENCE_FILE);
    const item = queue.getNext();
    assert.ok(item);
    assert.strictEqual(item.config.title, 'Persisted Task');
  });

  it('should recover interrupted processing items', () => {
    let queue = new SessionQueue(100, TEST_PERSISTENCE_FILE);
    const item = queue.add({ title: 'Task' }, 5);
    queue.markProcessing(item.id);

    // New instance should revert processing to pending
    queue = new SessionQueue(100, TEST_PERSISTENCE_FILE);
    const recovered = queue.getNext();
    assert.ok(recovered);
    assert.strictEqual(recovered.id, item.id);
    assert.strictEqual(recovered.status, 'pending');
  });

  it('should cleanup old terminal items', () => {
    const queue = new SessionQueue(2, TEST_PERSISTENCE_FILE); // Max retained 2
    const item1 = queue.add({ title: 'Task 1' });
    const item2 = queue.add({ title: 'Task 2' });
    const item3 = queue.add({ title: 'Task 3' });

    queue.markComplete(item1.id, 'session1');
    queue.markComplete(item2.id, 'session2');
    queue.markComplete(item3.id, 'session3');

    const stats = queue.stats();
    assert.strictEqual(stats.completed, 2); // Should only keep last 2
  });

  it('should remove items correctly', () => {
    const queue = new SessionQueue(100, TEST_PERSISTENCE_FILE);
    const item = queue.add({ title: 'Task' });
    assert.strictEqual(queue.stats().total, 1);

    queue.remove(item.id);
    assert.strictEqual(queue.stats().total, 0);
  });
});
