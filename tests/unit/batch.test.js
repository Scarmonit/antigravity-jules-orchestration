/**
 * Unit Tests for Batch Processing Module
 * Tests cover:
 * - BatchProcessor class instantiation
 * - generateBatchId() unique ID generation
 * - createBatch() parallel session creation
 * - getBatchStatus() status aggregation
 * - approveAllInBatch() bulk approval
 * - listBatches() batch listing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchProcessor } from '../../lib/batch.js';

describe('BatchProcessor', () => {
  let mockJulesRequest;
  let mockCreateSession;
  let batchProcessor;

  beforeEach(() => {
    mockJulesRequest = vi.fn();
    mockCreateSession = vi.fn();
    batchProcessor = new BatchProcessor(mockJulesRequest, mockCreateSession);
  });

  describe('constructor', () => {
    it('should initialize with julesRequest and createSession functions', () => {
      expect(batchProcessor.julesRequest).toBe(mockJulesRequest);
      expect(batchProcessor.createSession).toBe(mockCreateSession);
    });

    it('should initialize empty batches Map', () => {
      expect(batchProcessor.batches).toBeInstanceOf(Map);
      expect(batchProcessor.batches.size).toBe(0);
    });
  });

  describe('generateBatchId()', () => {
    it('should generate ID with batch_ prefix', () => {
      const id = batchProcessor.generateBatchId();
      expect(id).toMatch(/^batch_/);
    });

    it('should include timestamp in ID', () => {
      const beforeTime = Date.now();
      const id = batchProcessor.generateBatchId();
      const afterTime = Date.now();

      const timestamp = parseInt(id.split('_')[1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(batchProcessor.generateBatchId());
      }
      expect(ids.size).toBe(100);
    });

    it('should match expected format', () => {
      const id = batchProcessor.generateBatchId();
      expect(id).toMatch(/^batch_\d+_[a-z0-9]{9}$/);
    });
  });

  describe('createBatch()', () => {
    it('should create batch with single task', async () => {
      const tasks = [{ title: 'Task 1', prompt: 'Do something' }];
      const mockSession = { id: 'session-1', name: 'projects/test/sessions/session-1' };

      mockCreateSession.mockResolvedValue(mockSession);

      const result = await batchProcessor.createBatch(tasks);

      expect(result.created).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].id).toBe('session-1');
      expect(result.sessions[0].title).toBe('Task 1');
    });

    it('should create batch with multiple tasks', async () => {
      const tasks = [
        { title: 'Task 1', prompt: 'Do task 1' },
        { title: 'Task 2', prompt: 'Do task 2' },
        { title: 'Task 3', prompt: 'Do task 3' }
      ];

      mockCreateSession.mockImplementation((task) => {
        return Promise.resolve({
          id: `session-${task.title.split(' ')[1]}`,
          name: `projects/test/sessions/session-${task.title.split(' ')[1]}`
        });
      });

      const result = await batchProcessor.createBatch(tasks);

      expect(result.created).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.sessions).toHaveLength(3);
      expect(mockCreateSession).toHaveBeenCalledTimes(3);
    });

    it('should handle parallel execution with custom parallelism', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        title: `Task ${i + 1}`,
        prompt: `Do task ${i + 1}`
      }));

      mockCreateSession.mockImplementation((task) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: `session-${task.title}`,
              name: `projects/test/sessions/session-${task.title}`
            });
          }, 10);
        });
      });

      const result = await batchProcessor.createBatch(tasks, { parallel: 2 });

      expect(result.created).toBe(10);
      expect(result.failed).toBe(0);
    });

    it('should handle task creation failures', async () => {
      const tasks = [
        { title: 'Success 1', prompt: 'Task 1' },
        { title: 'Failure', prompt: 'Task 2' },
        { title: 'Success 2', prompt: 'Task 3' }
      ];

      mockCreateSession.mockImplementation((task) => {
        if (task.title === 'Failure') {
          return Promise.reject(new Error('Session creation failed'));
        }
        return Promise.resolve({
          id: `session-${task.title}`,
          name: `projects/test/sessions/session-${task.title}`
        });
      });

      const result = await batchProcessor.createBatch(tasks);

      expect(result.created).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].task).toBe('Failure');
      expect(result.errors[0].error).toBe('Session creation failed');
    });

    it('should store batch state correctly', async () => {
      const tasks = [{ title: 'Task 1', prompt: 'Do something' }];
      mockCreateSession.mockResolvedValue({ id: 'session-1' });

      const result = await batchProcessor.createBatch(tasks);

      const batch = batchProcessor.batches.get(result.batchId);
      expect(batch).toBeDefined();
      expect(batch.id).toBe(result.batchId);
      expect(batch.totalTasks).toBe(1);
      expect(batch.sessions).toHaveLength(1);
      expect(batch.createdAt).toBeDefined();
    });

    it('should handle default parallelism of 3', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        title: `Task ${i + 1}`,
        prompt: `Prompt ${i + 1}`
      }));

      let activeCalls = 0;
      let maxActiveCalls = 0;

      mockCreateSession.mockImplementation(() => {
        activeCalls++;
        maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
        return new Promise((resolve) => {
          setTimeout(() => {
            activeCalls--;
            resolve({ id: 'session-x' });
          }, 10);
        });
      });

      await batchProcessor.createBatch(tasks);

      // With default parallel=3, max 3 should run at once
      expect(maxActiveCalls).toBeLessThanOrEqual(3);
    });

    it('should handle session with id directly or in name field', async () => {
      const tasks = [
        { title: 'Task 1', prompt: 'Prompt 1' },
        { title: 'Task 2', prompt: 'Prompt 2' }
      ];

      mockCreateSession.mockImplementation((task) => {
        if (task.title === 'Task 1') {
          return Promise.resolve({ id: 'direct-id' });
        }
        return Promise.resolve({ name: 'projects/test/sessions/extracted-id' });
      });

      const result = await batchProcessor.createBatch(tasks);

      expect(result.sessions[0].id).toBe('direct-id');
      expect(result.sessions[1].id).toBe('extracted-id');
    });
  });

  describe('getBatchStatus()', () => {
    it('should throw error for non-existent batch', async () => {
      await expect(batchProcessor.getBatchStatus('non-existent')).rejects.toThrow('Batch non-existent not found');
    });

    it('should return status for batch with single session', async () => {
      const tasks = [{ title: 'Task 1', prompt: 'Prompt 1' }];
      mockCreateSession.mockResolvedValue({ id: 'session-1' });

      const { batchId } = await batchProcessor.createBatch(tasks);

      mockJulesRequest.mockResolvedValue({
        state: 'COMPLETED',
        url: 'https://example.com/session-1'
      });

      const status = await batchProcessor.getBatchStatus(batchId);

      expect(status.batchId).toBe(batchId);
      expect(status.summary.total).toBe(1);
      expect(status.summary.completed).toBe(1);
      expect(status.sessions).toHaveLength(1);
      expect(status.sessions[0].state).toBe('COMPLETED');
    });

    it('should calculate summary correctly', async () => {
      const tasks = Array.from({ length: 6 }, (_, i) => ({
        title: `Task ${i + 1}`,
        prompt: `Prompt ${i + 1}`
      }));

      mockCreateSession.mockImplementation((task, idx) => {
        const num = task.title.split(' ')[1];
        return Promise.resolve({ id: `session-${num}` });
      });

      const { batchId } = await batchProcessor.createBatch(tasks);

      mockJulesRequest.mockImplementation((method, path) => {
        const id = path.split('/')[2];
        const num = parseInt(id.split('-')[1], 10);

        if (num <= 2) return Promise.resolve({ state: 'COMPLETED', url: 'url' });
        if (num <= 4) return Promise.resolve({ state: 'IN_PROGRESS', url: 'url' });
        if (num === 5) return Promise.resolve({ state: 'WAITING_FOR_APPROVAL', url: 'url' });
        return Promise.resolve({ state: 'FAILED', url: 'url' });
      });

      const status = await batchProcessor.getBatchStatus(batchId);

      expect(status.summary.total).toBe(6);
      expect(status.summary.completed).toBe(2);
      expect(status.summary.inProgress).toBe(2);
      expect(status.summary.waiting).toBe(1);
      expect(status.summary.failed).toBe(1);
      expect(status.isComplete).toBe(false);
    });

    it('should mark batch as complete when all sessions are done', async () => {
      const tasks = [
        { title: 'Task 1', prompt: 'Prompt 1' },
        { title: 'Task 2', prompt: 'Prompt 2' }
      ];

      mockCreateSession.mockImplementation((task) => {
        const num = task.title.split(' ')[1];
        return Promise.resolve({ id: `session-${num}` });
      });

      const { batchId } = await batchProcessor.createBatch(tasks);

      mockJulesRequest.mockImplementation((method, path) => {
        const id = path.split('/')[2];
        return id === 'session-1'
          ? Promise.resolve({ state: 'COMPLETED', url: 'url' })
          : Promise.resolve({ state: 'FAILED', url: 'url' });
      });

      const status = await batchProcessor.getBatchStatus(batchId);

      expect(status.isComplete).toBe(true);
    });

    it('should handle session fetch errors gracefully', async () => {
      const tasks = [{ title: 'Task 1', prompt: 'Prompt 1' }];
      mockCreateSession.mockResolvedValue({ id: 'session-1' });

      const { batchId } = await batchProcessor.createBatch(tasks);

      mockJulesRequest.mockRejectedValue(new Error('Network error'));

      const status = await batchProcessor.getBatchStatus(batchId);

      expect(status.sessions[0].state).toBe('ERROR');
      expect(status.sessions[0].error).toBe('Network error');
    });

    it('should include createdAt timestamp', async () => {
      const tasks = [{ title: 'Task 1', prompt: 'Prompt 1' }];
      mockCreateSession.mockResolvedValue({ id: 'session-1' });

      const { batchId } = await batchProcessor.createBatch(tasks);
      mockJulesRequest.mockResolvedValue({ state: 'COMPLETED', url: 'url' });

      const status = await batchProcessor.getBatchStatus(batchId);

      expect(status.createdAt).toBeDefined();
      expect(typeof status.createdAt).toBe('string');
    });
  });

  describe('approveAllInBatch()', () => {
    it('should approve all waiting sessions', async () => {
      const tasks = [
        { title: 'Task 1', prompt: 'Prompt 1' },
        { title: 'Task 2', prompt: 'Prompt 2' }
      ];

      mockCreateSession.mockImplementation((task) => {
        const num = task.title.split(' ')[1];
        return Promise.resolve({ id: `session-${num}` });
      });

      const { batchId } = await batchProcessor.createBatch(tasks);

      mockJulesRequest.mockImplementation((method, path, body) => {
        if (method === 'GET') {
          return Promise.resolve({ state: 'WAITING_FOR_APPROVAL', url: 'url' });
        }
        if (method === 'POST' && path.includes(':approvePlan')) {
          return Promise.resolve({ success: true });
        }
      });

      const result = await batchProcessor.approveAllInBatch(batchId);

      expect(result.batchId).toBe(batchId);
      expect(result.approved).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should only approve sessions in waiting states', async () => {
      const tasks = [
        { title: 'Task 1', prompt: 'Prompt 1' },
        { title: 'Task 2', prompt: 'Prompt 2' },
        { title: 'Task 3', prompt: 'Prompt 3' }
      ];

      mockCreateSession.mockImplementation((task) => {
        const num = task.title.split(' ')[1];
        return Promise.resolve({ id: `session-${num}` });
      });

      const { batchId } = await batchProcessor.createBatch(tasks);

      mockJulesRequest.mockImplementation((method, path) => {
        if (method === 'GET') {
          const id = path.split('/')[2];
          if (id === 'session-1') return Promise.resolve({ state: 'WAITING_FOR_APPROVAL', url: 'url' });
          if (id === 'session-2') return Promise.resolve({ state: 'COMPLETED', url: 'url' });
          return Promise.resolve({ state: 'PLANNING', url: 'url' });
        }
        if (method === 'POST') {
          return Promise.resolve({ success: true });
        }
      });

      const result = await batchProcessor.approveAllInBatch(batchId);

      expect(result.approved).toBe(2); // Only session-1 and session-3
    });

    it('should handle approval failures', async () => {
      const tasks = [
        { title: 'Task 1', prompt: 'Prompt 1' },
        { title: 'Task 2', prompt: 'Prompt 2' }
      ];

      mockCreateSession.mockImplementation((task) => {
        const num = task.title.split(' ')[1];
        return Promise.resolve({ id: `session-${num}` });
      });

      const { batchId } = await batchProcessor.createBatch(tasks);

      mockJulesRequest.mockImplementation((method, path) => {
        if (method === 'GET') {
          return Promise.resolve({ state: 'WAITING_FOR_APPROVAL', url: 'url' });
        }
        if (method === 'POST') {
          const id = path.split('/')[2].split(':')[0];
          if (id === 'session-1') {
            return Promise.reject(new Error('Approval failed'));
          }
          return Promise.resolve({ success: true });
        }
      });

      const result = await batchProcessor.approveAllInBatch(batchId);

      expect(result.approved).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results.find((r) => !r.approved).error).toBe('Approval failed');
    });

    it('should handle AWAITING_PLAN_APPROVAL state', async () => {
      const tasks = [{ title: 'Task 1', prompt: 'Prompt 1' }];
      mockCreateSession.mockResolvedValue({ id: 'session-1' });

      const { batchId } = await batchProcessor.createBatch(tasks);

      mockJulesRequest.mockImplementation((method, path) => {
        if (method === 'GET') {
          return Promise.resolve({ state: 'AWAITING_PLAN_APPROVAL', url: 'url' });
        }
        return Promise.resolve({ success: true });
      });

      const result = await batchProcessor.approveAllInBatch(batchId);

      expect(result.approved).toBe(1);
    });
  });

  describe('listBatches()', () => {
    it('should return empty array when no batches', () => {
      const result = batchProcessor.listBatches();
      expect(result).toEqual([]);
    });

    it('should list all batches', async () => {
      const tasks1 = [{ title: 'Task 1', prompt: 'Prompt 1' }];
      const tasks2 = [
        { title: 'Task 2', prompt: 'Prompt 2' },
        { title: 'Task 3', prompt: 'Prompt 3' }
      ];

      mockCreateSession.mockResolvedValue({ id: 'session-x' });

      await batchProcessor.createBatch(tasks1);
      await batchProcessor.createBatch(tasks2);

      const result = batchProcessor.listBatches();

      expect(result).toHaveLength(2);
      expect(result[0].totalTasks).toBe(1);
      expect(result[0].sessionCount).toBe(1);
      expect(result[1].totalTasks).toBe(2);
      expect(result[1].sessionCount).toBe(2);
    });

    it('should include batch metadata', async () => {
      const tasks = [{ title: 'Task 1', prompt: 'Prompt 1' }];
      mockCreateSession.mockResolvedValue({ id: 'session-x' });

      await batchProcessor.createBatch(tasks);

      const result = batchProcessor.listBatches();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('createdAt');
      expect(result[0]).toHaveProperty('totalTasks');
      expect(result[0]).toHaveProperty('sessionCount');
      expect(result[0]).toHaveProperty('errorCount');
    });

    it('should show error count for failed tasks', async () => {
      const tasks = [
        { title: 'Task 1', prompt: 'Prompt 1' },
        { title: 'Task 2', prompt: 'Prompt 2' }
      ];

      mockCreateSession.mockImplementation((task) => {
        if (task.title === 'Task 1') {
          return Promise.resolve({ id: 'session-1' });
        }
        return Promise.reject(new Error('Failed'));
      });

      await batchProcessor.createBatch(tasks);

      const result = batchProcessor.listBatches();

      expect(result[0].errorCount).toBe(1);
      expect(result[0].sessionCount).toBe(1);
    });
  });
});
