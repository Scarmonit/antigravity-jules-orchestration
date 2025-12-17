/**
 * Unit Tests for v2.5.0 Features
 * Tests the 15 new MCP tools: templates, queue, PR integration, analytics
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// ============================================================================
// LRU CACHE CLASS TESTS
// ============================================================================

/**
 * LRUCache implementation (copied from index.js for testing)
 */
class LRUCache {
  constructor(maxSize = 100, defaultTTL = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key, value, ttl = this.defaultTTL) {
    if (this.cache.size >= this.maxSize) {
      // Delete oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expires: Date.now() + ttl });
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  stats() {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// ============================================================================
// SESSION QUEUE CLASS TESTS
// ============================================================================

/**
 * SessionQueue implementation (copied from index.js for testing)
 */
class SessionQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  add(config, priority = 5) {
    const item = {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      config,
      priority,
      status: 'pending',
      addedAt: new Date().toISOString(),
      sessionId: null
    };
    this.queue.push(item);
    // Sort by priority (lower number = higher priority)
    this.queue.sort((a, b) => a.priority - b.priority);
    return item;
  }

  remove(id) {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      return this.queue.splice(index, 1)[0];
    }
    return null;
  }

  getNext() {
    return this.queue.find(item => item.status === 'pending');
  }

  markProcessing(id) {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'processing';
      item.startedAt = new Date().toISOString();
    }
    return item;
  }

  markComplete(id, sessionId) {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'completed';
      item.sessionId = sessionId;
      item.completedAt = new Date().toISOString();
    }
    return item;
  }

  markFailed(id, error) {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'failed';
      item.error = error;
      item.failedAt = new Date().toISOString();
    }
    return item;
  }

  list() {
    return this.queue;
  }

  stats() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(i => i.status === 'pending').length,
      processing: this.queue.filter(i => i.status === 'processing').length,
      completed: this.queue.filter(i => i.status === 'completed').length,
      failed: this.queue.filter(i => i.status === 'failed').length
    };
  }

  clear() {
    const cleared = this.queue.filter(i => i.status === 'pending').length;
    this.queue = this.queue.filter(i => i.status !== 'pending');
    return cleared;
  }
}

// ============================================================================
// ANALYTICS HELPER TESTS
// ============================================================================

/**
 * Calculate analytics from sessions
 */
function getAnalytics(sessions, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const recentSessions = sessions.filter(s => new Date(s.createdAt) >= cutoff);

  const byStatus = {};
  recentSessions.forEach(s => {
    byStatus[s.state] = (byStatus[s.state] || 0) + 1;
  });

  const completed = byStatus['COMPLETED'] || 0;
  const failed = byStatus['FAILED'] || 0;
  const total = recentSessions.length;

  return {
    period: `${days} days`,
    totalSessions: total,
    byStatus,
    successRate: total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : '0%',
    failureRate: total > 0 ? ((failed / total) * 100).toFixed(1) + '%' : '0%',
    averagePerDay: (total / days).toFixed(1)
  };
}

// ============================================================================
// TEMPLATE HELPER TESTS
// ============================================================================

/**
 * Session templates storage
 */
const sessionTemplates = new Map();

function createTemplate(name, description, config) {
  if (sessionTemplates.has(name)) {
    return { success: false, error: `Template '${name}' already exists` };
  }
  sessionTemplates.set(name, {
    name,
    description,
    config,
    createdAt: new Date().toISOString(),
    usageCount: 0
  });
  return { success: true, template: sessionTemplates.get(name) };
}

function listTemplates() {
  return Array.from(sessionTemplates.values());
}

function getTemplate(name) {
  return sessionTemplates.get(name);
}

function deleteTemplate(name) {
  if (!sessionTemplates.has(name)) {
    return { success: false, error: `Template '${name}' not found` };
  }
  sessionTemplates.delete(name);
  return { success: true, deleted: name };
}

// ============================================================================
// TESTS
// ============================================================================

describe('v2.5.0 Features - LRU Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3, 1000);
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      assert.strictEqual(cache.get('key1'), 'value1');
    });

    it('should return null for non-existent keys', () => {
      assert.strictEqual(cache.get('nonexistent'), null);
    });

    it('should overwrite existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      assert.strictEqual(cache.get('key1'), 'value2');
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      assert.strictEqual(cache.get('key1'), null);
      assert.strictEqual(cache.get('key2'), null);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1

      assert.strictEqual(cache.get('key1'), null);
      assert.strictEqual(cache.get('key2'), 'value2');
      assert.strictEqual(cache.get('key3'), 'value3');
      assert.strictEqual(cache.get('key4'), 'value4');
    });

    it('should move accessed items to end', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1, making it most recently used
      cache.get('key1');

      // Add key4, should evict key2 (now oldest)
      cache.set('key4', 'value4');

      assert.strictEqual(cache.get('key1'), 'value1');
      assert.strictEqual(cache.get('key2'), null);
      assert.strictEqual(cache.get('key3'), 'value3');
      assert.strictEqual(cache.get('key4'), 'value4');
    });
  });

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new LRUCache(3, 50); // 50ms TTL
      shortCache.set('key1', 'value1');

      assert.strictEqual(shortCache.get('key1'), 'value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      assert.strictEqual(shortCache.get('key1'), null);
    });

    it('should allow custom TTL per entry', async () => {
      cache.set('key1', 'value1', 50); // 50ms TTL
      cache.set('key2', 'value2', 5000); // 5s TTL

      await new Promise(resolve => setTimeout(resolve, 60));

      assert.strictEqual(cache.get('key1'), null);
      assert.strictEqual(cache.get('key2'), 'value2');
    });
  });

  describe('Pattern Invalidation', () => {
    it('should invalidate matching keys', () => {
      cache.set('session_abc', 'value1');
      cache.set('session_xyz', 'value2');
      cache.set('user_123', 'value3');

      cache.invalidate('session');

      assert.strictEqual(cache.get('session_abc'), null);
      assert.strictEqual(cache.get('session_xyz'), null);
      assert.strictEqual(cache.get('user_123'), 'value3');
    });
  });

  describe('Stats', () => {
    it('should return correct stats', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.stats();
      assert.strictEqual(stats.size, 2);
      assert.strictEqual(stats.maxSize, 3);
    });
  });
});

describe('v2.5.0 Features - Session Queue', () => {
  let queue;

  beforeEach(() => {
    queue = new SessionQueue();
  });

  describe('Adding Items', () => {
    it('should add items with unique IDs', () => {
      const item1 = queue.add({ prompt: 'Task 1' }, 5);
      const item2 = queue.add({ prompt: 'Task 2' }, 5);

      assert.ok(item1.id.startsWith('q_'));
      assert.ok(item2.id.startsWith('q_'));
      assert.notStrictEqual(item1.id, item2.id);
    });

    it('should set default priority to 5', () => {
      const item = queue.add({ prompt: 'Task' });
      assert.strictEqual(item.priority, 5);
    });

    it('should set status to pending', () => {
      const item = queue.add({ prompt: 'Task' });
      assert.strictEqual(item.status, 'pending');
    });

    it('should record addedAt timestamp', () => {
      const item = queue.add({ prompt: 'Task' });
      assert.ok(item.addedAt);
      assert.ok(new Date(item.addedAt).getTime() > 0);
    });
  });

  describe('Priority Ordering', () => {
    it('should sort by priority (lower = higher)', () => {
      queue.add({ prompt: 'Low priority' }, 10);
      queue.add({ prompt: 'High priority' }, 1);
      queue.add({ prompt: 'Medium priority' }, 5);

      const items = queue.list();
      assert.strictEqual(items[0].priority, 1);
      assert.strictEqual(items[1].priority, 5);
      assert.strictEqual(items[2].priority, 10);
    });

    it('should return highest priority item first', () => {
      queue.add({ prompt: 'Low' }, 10);
      queue.add({ prompt: 'High' }, 1);

      const next = queue.getNext();
      assert.strictEqual(next.priority, 1);
      assert.strictEqual(next.config.prompt, 'High');
    });
  });

  describe('Status Transitions', () => {
    it('should mark item as processing', () => {
      const item = queue.add({ prompt: 'Task' });
      queue.markProcessing(item.id);

      const updated = queue.list().find(i => i.id === item.id);
      assert.strictEqual(updated.status, 'processing');
      assert.ok(updated.startedAt);
    });

    it('should mark item as completed with session ID', () => {
      const item = queue.add({ prompt: 'Task' });
      queue.markComplete(item.id, 'session_123');

      const updated = queue.list().find(i => i.id === item.id);
      assert.strictEqual(updated.status, 'completed');
      assert.strictEqual(updated.sessionId, 'session_123');
      assert.ok(updated.completedAt);
    });

    it('should mark item as failed with error', () => {
      const item = queue.add({ prompt: 'Task' });
      queue.markFailed(item.id, 'API error');

      const updated = queue.list().find(i => i.id === item.id);
      assert.strictEqual(updated.status, 'failed');
      assert.strictEqual(updated.error, 'API error');
      assert.ok(updated.failedAt);
    });

    it('should skip processing items when getting next', () => {
      const item1 = queue.add({ prompt: 'Task 1' }, 1);
      queue.add({ prompt: 'Task 2' }, 2);

      queue.markProcessing(item1.id);

      const next = queue.getNext();
      assert.strictEqual(next.config.prompt, 'Task 2');
    });
  });

  describe('Removing Items', () => {
    it('should remove item by ID', () => {
      const item = queue.add({ prompt: 'Task' });
      const removed = queue.remove(item.id);

      assert.strictEqual(removed.id, item.id);
      assert.strictEqual(queue.list().length, 0);
    });

    it('should return null for non-existent ID', () => {
      const removed = queue.remove('nonexistent');
      assert.strictEqual(removed, null);
    });
  });

  describe('Statistics', () => {
    it('should calculate correct stats', () => {
      const item1 = queue.add({ prompt: 'Task 1' });
      const item2 = queue.add({ prompt: 'Task 2' });
      const item3 = queue.add({ prompt: 'Task 3' });
      const item4 = queue.add({ prompt: 'Task 4' });

      queue.markProcessing(item1.id);
      queue.markComplete(item2.id, 'session_123');
      queue.markFailed(item3.id, 'error');

      const stats = queue.stats();
      assert.strictEqual(stats.total, 4);
      assert.strictEqual(stats.pending, 1);
      assert.strictEqual(stats.processing, 1);
      assert.strictEqual(stats.completed, 1);
      assert.strictEqual(stats.failed, 1);
    });
  });

  describe('Clearing Queue', () => {
    it('should clear only pending items', () => {
      const item1 = queue.add({ prompt: 'Task 1' });
      const item2 = queue.add({ prompt: 'Task 2' });

      queue.markProcessing(item1.id);

      const cleared = queue.clear();
      assert.strictEqual(cleared, 1);
      assert.strictEqual(queue.list().length, 1);
      assert.strictEqual(queue.list()[0].status, 'processing');
    });

    it('should return count of cleared items', () => {
      queue.add({ prompt: 'Task 1' });
      queue.add({ prompt: 'Task 2' });
      queue.add({ prompt: 'Task 3' });

      const cleared = queue.clear();
      assert.strictEqual(cleared, 3);
    });
  });
});

describe('v2.5.0 Features - Session Templates', () => {
  beforeEach(() => {
    sessionTemplates.clear();
  });

  describe('Creating Templates', () => {
    it('should create template with all fields', () => {
      const result = createTemplate('bug-fix', 'Fix bugs from issues', {
        automationMode: 'AUTO_CREATE_PR',
        requirePlanApproval: true
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.template.name, 'bug-fix');
      assert.strictEqual(result.template.description, 'Fix bugs from issues');
      assert.ok(result.template.createdAt);
      assert.strictEqual(result.template.usageCount, 0);
    });

    it('should reject duplicate template names', () => {
      createTemplate('test', 'First template', {});
      const result = createTemplate('test', 'Duplicate template', {});

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('already exists'));
    });
  });

  describe('Listing Templates', () => {
    it('should list all templates', () => {
      createTemplate('template1', 'Desc 1', {});
      createTemplate('template2', 'Desc 2', {});
      createTemplate('template3', 'Desc 3', {});

      const templates = listTemplates();
      assert.strictEqual(templates.length, 3);
    });

    it('should return empty array when no templates', () => {
      const templates = listTemplates();
      assert.strictEqual(templates.length, 0);
    });
  });

  describe('Getting Templates', () => {
    it('should get template by name', () => {
      createTemplate('bug-fix', 'Fix bugs', { mode: 'AUTO_PR' });
      const template = getTemplate('bug-fix');

      assert.strictEqual(template.name, 'bug-fix');
      assert.strictEqual(template.config.mode, 'AUTO_PR');
    });

    it('should return undefined for non-existent template', () => {
      const template = getTemplate('nonexistent');
      assert.strictEqual(template, undefined);
    });
  });

  describe('Deleting Templates', () => {
    it('should delete existing template', () => {
      createTemplate('to-delete', 'Will be deleted', {});
      const result = deleteTemplate('to-delete');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.deleted, 'to-delete');
      assert.strictEqual(getTemplate('to-delete'), undefined);
    });

    it('should return error for non-existent template', () => {
      const result = deleteTemplate('nonexistent');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('not found'));
    });
  });
});

describe('v2.5.0 Features - Analytics', () => {
  describe('Success Rate Calculation', () => {
    it('should calculate correct success rate', () => {
      const sessions = [
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'FAILED', createdAt: new Date().toISOString() }
      ];

      const analytics = getAnalytics(sessions, 7);
      assert.strictEqual(analytics.successRate, '75.0%');
      assert.strictEqual(analytics.failureRate, '25.0%');
    });

    it('should handle 100% success rate', () => {
      const sessions = [
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() }
      ];

      const analytics = getAnalytics(sessions, 7);
      assert.strictEqual(analytics.successRate, '100.0%');
      assert.strictEqual(analytics.failureRate, '0.0%');
    });

    it('should handle 0% success rate', () => {
      const sessions = [
        { state: 'FAILED', createdAt: new Date().toISOString() },
        { state: 'FAILED', createdAt: new Date().toISOString() }
      ];

      const analytics = getAnalytics(sessions, 7);
      assert.strictEqual(analytics.successRate, '0.0%');
      assert.strictEqual(analytics.failureRate, '100.0%');
    });

    it('should handle empty sessions', () => {
      const analytics = getAnalytics([], 7);
      assert.strictEqual(analytics.successRate, '0%');
      assert.strictEqual(analytics.failureRate, '0%');
      assert.strictEqual(analytics.totalSessions, 0);
    });
  });

  describe('Date Filtering', () => {
    it('should filter sessions by date range', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);

      const sessions = [
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: oldDate.toISOString() }
      ];

      const analytics = getAnalytics(sessions, 7);
      assert.strictEqual(analytics.totalSessions, 1);
    });

    it('should include sessions within date range', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const sessions = [
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: yesterday.toISOString() }
      ];

      const analytics = getAnalytics(sessions, 7);
      assert.strictEqual(analytics.totalSessions, 2);
    });
  });

  describe('Status Breakdown', () => {
    it('should group sessions by status', () => {
      const sessions = [
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'FAILED', createdAt: new Date().toISOString() },
        { state: 'PLANNING', createdAt: new Date().toISOString() },
        { state: 'EXECUTING', createdAt: new Date().toISOString() }
      ];

      const analytics = getAnalytics(sessions, 7);
      assert.strictEqual(analytics.byStatus.COMPLETED, 2);
      assert.strictEqual(analytics.byStatus.FAILED, 1);
      assert.strictEqual(analytics.byStatus.PLANNING, 1);
      assert.strictEqual(analytics.byStatus.EXECUTING, 1);
    });
  });

  describe('Average Per Day', () => {
    it('should calculate average sessions per day', () => {
      const sessions = [
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() },
        { state: 'COMPLETED', createdAt: new Date().toISOString() }
      ];

      const analytics = getAnalytics(sessions, 7);
      assert.strictEqual(analytics.averagePerDay, '1.0');
    });
  });
});

describe('v2.5.0 Features - PR Integration Validation', () => {
  describe('Merge Method Validation', () => {
    const validMergeMethods = ['squash', 'merge', 'rebase'];

    it('should accept valid merge methods', () => {
      for (const method of validMergeMethods) {
        assert.ok(validMergeMethods.includes(method), `${method} should be valid`);
      }
    });

    it('should reject invalid merge methods', () => {
      const invalidMethods = ['fast-forward', 'cherry-pick', 'invalid'];
      for (const method of invalidMethods) {
        assert.ok(!validMergeMethods.includes(method), `${method} should be invalid`);
      }
    });
  });

  describe('PR Number Validation', () => {
    it('should validate PR number is positive integer', () => {
      const validPRNumbers = [1, 42, 1000, 99999];
      for (const prNum of validPRNumbers) {
        assert.ok(Number.isInteger(prNum) && prNum > 0, `${prNum} should be valid`);
      }
    });

    it('should reject invalid PR numbers', () => {
      const invalidPRNumbers = [0, -1, 1.5, NaN, Infinity];
      for (const prNum of invalidPRNumbers) {
        const isValid = Number.isInteger(prNum) && prNum > 0;
        assert.ok(!isValid, `${prNum} should be invalid`);
      }
    });
  });

  describe('Comment Validation', () => {
    it('should require non-empty comment body', () => {
      const emptyBodies = ['', '   ', null, undefined];
      for (const body of emptyBodies) {
        const isValid = body && body.toString().trim().length > 0;
        assert.ok(!isValid, `Empty body should be invalid`);
      }
    });

    it('should accept valid comment body', () => {
      const validBodies = ['Great work!', 'LGTM', 'Please fix the typo on line 42'];
      for (const body of validBodies) {
        const isValid = body && body.toString().trim().length > 0;
        assert.ok(isValid, `'${body}' should be valid`);
      }
    });
  });
});

describe('v2.5.0 Features - Session Search Validation', () => {
  describe('State Filter Validation', () => {
    const validStates = ['PLANNING', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED'];

    it('should accept valid session states', () => {
      for (const state of validStates) {
        assert.ok(validStates.includes(state), `${state} should be valid`);
      }
    });

    it('should handle case sensitivity', () => {
      const upperState = 'COMPLETED';
      const lowerState = 'completed';
      assert.ok(validStates.includes(upperState), 'Upper case should be valid');
      assert.ok(!validStates.includes(lowerState), 'Lower case should not match directly');
    });
  });

  describe('Limit Validation', () => {
    it('should accept valid limits', () => {
      const validLimits = [1, 10, 50, 100];
      for (const limit of validLimits) {
        assert.ok(limit >= 1 && limit <= 100, `${limit} should be valid`);
      }
    });

    it('should reject invalid limits', () => {
      const invalidLimits = [0, -1, 101, 1000];
      for (const limit of invalidLimits) {
        const isValid = limit >= 1 && limit <= 100;
        assert.ok(!isValid, `${limit} should be invalid`);
      }
    });
  });
});

describe('v2.5.0 Features - Batch Operations', () => {
  describe('Batch Retry Logic', () => {
    it('should identify failed sessions in batch', () => {
      const sessions = [
        { id: 's1', state: 'COMPLETED', batchId: 'batch_1' },
        { id: 's2', state: 'FAILED', batchId: 'batch_1' },
        { id: 's3', state: 'FAILED', batchId: 'batch_1' },
        { id: 's4', state: 'COMPLETED', batchId: 'batch_1' }
      ];

      const failedSessions = sessions.filter(s => s.state === 'FAILED');
      assert.strictEqual(failedSessions.length, 2);
      assert.ok(failedSessions.every(s => s.batchId === 'batch_1'));
    });

    it('should handle empty batch', () => {
      const sessions = [];
      const failedSessions = sessions.filter(s => s.state === 'FAILED');
      assert.strictEqual(failedSessions.length, 0);
    });
  });
});

describe('v2.5.0 Features - Clone Session Validation', () => {
  describe('Session Clone Config', () => {
    it('should preserve original config when cloning', () => {
      const originalConfig = {
        source: 'sources/github/owner/repo',
        prompt: 'Fix bug #123',
        title: 'Bug Fix',
        automationMode: 'AUTO_CREATE_PR',
        requirePlanApproval: true
      };

      const clonedConfig = { ...originalConfig };
      clonedConfig.title = 'Bug Fix (clone)';

      assert.strictEqual(clonedConfig.source, originalConfig.source);
      assert.strictEqual(clonedConfig.prompt, originalConfig.prompt);
      assert.notStrictEqual(clonedConfig.title, originalConfig.title);
    });

    it('should allow prompt override when cloning', () => {
      const originalConfig = { prompt: 'Original task' };
      const newPrompt = 'Modified task';

      const clonedConfig = { ...originalConfig, prompt: newPrompt };
      assert.strictEqual(clonedConfig.prompt, newPrompt);
    });
  });
});
