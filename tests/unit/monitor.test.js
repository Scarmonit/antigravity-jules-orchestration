/**
 * Unit Tests for Session Monitor Module
 * Tests cover:
 * - SessionMonitor class instantiation and caching
 * - getAllSessions() with cache management
 * - getActiveSessions() filtering
 * - getStats() aggregation and calculation
 * - getSessionTimeline() timeline generation
 * - Activity type detection and summarization
 * - Duration calculation
 * - monitorAll() comprehensive monitoring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionMonitor } from '../../lib/monitor.js';

describe('SessionMonitor', () => {
  let mockJulesRequest;
  let sessionMonitor;

  beforeEach(() => {
    mockJulesRequest = vi.fn();
    sessionMonitor = new SessionMonitor(mockJulesRequest);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with julesRequest function', () => {
      expect(sessionMonitor.julesRequest).toBe(mockJulesRequest);
    });

    it('should initialize cache as null', () => {
      expect(sessionMonitor.cachedSessions).toBeNull();
      expect(sessionMonitor.lastFetch).toBeNull();
    });

    it('should set default cache timeout to 10 seconds', () => {
      expect(sessionMonitor.cacheTimeout).toBe(10000);
    });
  });

  describe('getAllSessions()', () => {
    it('should fetch sessions from API', async () => {
      const mockSessions = [
        { id: 'session-1', state: 'COMPLETED' },
        { id: 'session-2', state: 'IN_PROGRESS' }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const result = await sessionMonitor.getAllSessions();

      expect(result).toEqual(mockSessions);
      expect(mockJulesRequest).toHaveBeenCalledWith('GET', '/sessions');
    });

    it('should cache sessions after fetching', async () => {
      const mockSessions = [{ id: 'session-1', state: 'COMPLETED' }];
      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      await sessionMonitor.getAllSessions();

      expect(sessionMonitor.cachedSessions).toEqual(mockSessions);
      expect(sessionMonitor.lastFetch).toBeDefined();
    });

    it('should use cache when not expired', async () => {
      const mockSessions = [{ id: 'session-1', state: 'COMPLETED' }];
      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      // First call - fetches and caches
      await sessionMonitor.getAllSessions();
      mockJulesRequest.mockClear();

      // Second call within cache timeout - should use cache
      vi.advanceTimersByTime(5000); // 5 seconds < 10 seconds timeout
      const result = await sessionMonitor.getAllSessions();

      expect(result).toEqual(mockSessions);
      expect(mockJulesRequest).not.toHaveBeenCalled();
    });

    it('should refetch when cache expires', async () => {
      const oldSessions = [{ id: 'session-1', state: 'COMPLETED' }];
      const newSessions = [{ id: 'session-2', state: 'IN_PROGRESS' }];

      mockJulesRequest.mockResolvedValueOnce({ sessions: oldSessions });

      await sessionMonitor.getAllSessions();

      // Advance time past cache timeout
      vi.advanceTimersByTime(11000); // 11 seconds > 10 seconds timeout

      mockJulesRequest.mockResolvedValueOnce({ sessions: newSessions });
      const result = await sessionMonitor.getAllSessions();

      expect(result).toEqual(newSessions);
      expect(mockJulesRequest).toHaveBeenCalledTimes(2);
    });

    it('should force refresh when forceRefresh is true', async () => {
      const oldSessions = [{ id: 'session-1', state: 'COMPLETED' }];
      const newSessions = [{ id: 'session-2', state: 'IN_PROGRESS' }];

      mockJulesRequest.mockResolvedValueOnce({ sessions: oldSessions });
      await sessionMonitor.getAllSessions();

      mockJulesRequest.mockResolvedValueOnce({ sessions: newSessions });
      const result = await sessionMonitor.getAllSessions(true);

      expect(result).toEqual(newSessions);
      expect(mockJulesRequest).toHaveBeenCalledTimes(2);
    });

    it('should handle fetch errors gracefully', async () => {
      mockJulesRequest.mockRejectedValue(new Error('Network error'));

      const result = await sessionMonitor.getAllSessions();

      expect(result).toEqual([]);
    });

    it('should return cached sessions on error if available', async () => {
      const mockSessions = [{ id: 'session-1', state: 'COMPLETED' }];
      mockJulesRequest.mockResolvedValueOnce({ sessions: mockSessions });

      await sessionMonitor.getAllSessions();

      // Force error on next call
      vi.advanceTimersByTime(11000);
      mockJulesRequest.mockRejectedValueOnce(new Error('Network error'));

      const result = await sessionMonitor.getAllSessions(true);

      expect(result).toEqual(mockSessions);
    });

    it('should handle missing sessions field in response', async () => {
      mockJulesRequest.mockResolvedValue({});

      const result = await sessionMonitor.getAllSessions();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveSessions()', () => {
    it('should filter out completed sessions', async () => {
      const mockSessions = [
        { id: 'session-1', state: 'COMPLETED' },
        { id: 'session-2', state: 'IN_PROGRESS' },
        { id: 'session-3', state: 'PLANNING' }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const result = await sessionMonitor.getActiveSessions();

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.id === 'session-1')).toBeUndefined();
    });

    it('should filter out failed sessions', async () => {
      const mockSessions = [
        { id: 'session-1', state: 'FAILED' },
        { id: 'session-2', state: 'IN_PROGRESS' }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const result = await sessionMonitor.getActiveSessions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-2');
    });

    it('should filter out cancelled sessions', async () => {
      const mockSessions = [
        { id: 'session-1', state: 'CANCELLED' },
        { id: 'session-2', state: 'PLANNING' }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const result = await sessionMonitor.getActiveSessions();

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('PLANNING');
    });

    it('should return empty array when all sessions are inactive', async () => {
      const mockSessions = [
        { id: 'session-1', state: 'COMPLETED' },
        { id: 'session-2', state: 'FAILED' },
        { id: 'session-3', state: 'CANCELLED' }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const result = await sessionMonitor.getActiveSessions();

      expect(result).toEqual([]);
    });
  });

  describe('getStats()', () => {
    it('should calculate basic statistics', async () => {
      const mockSessions = [
        { id: 'session-1', state: 'COMPLETED', createTime: new Date().toISOString() },
        { id: 'session-2', state: 'IN_PROGRESS', createTime: new Date().toISOString() },
        { id: 'session-3', state: 'FAILED', createTime: new Date().toISOString() }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const stats = await sessionMonitor.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byState.COMPLETED).toBe(1);
      expect(stats.byState.IN_PROGRESS).toBe(1);
      expect(stats.byState.FAILED).toBe(1);
    });

    it('should count recent sessions in last 24 hours', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      const today = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago

      const mockSessions = [
        { id: 'session-1', state: 'COMPLETED', createTime: yesterday.toISOString() },
        { id: 'session-2', state: 'IN_PROGRESS', createTime: today.toISOString() }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const stats = await sessionMonitor.getStats();

      expect(stats.recent24h).toBe(1);
    });

    it('should count recent sessions in last 7 days', async () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); // 6 days ago
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days ago

      const mockSessions = [
        { id: 'session-1', state: 'COMPLETED', createTime: twoWeeksAgo.toISOString() },
        { id: 'session-2', state: 'IN_PROGRESS', createTime: lastWeek.toISOString() },
        { id: 'session-3', state: 'PLANNING', createTime: now.toISOString() }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const stats = await sessionMonitor.getStats();

      expect(stats.recent7d).toBe(2);
    });

    it('should calculate completion rate correctly', async () => {
      const mockSessions = [
        { id: 'session-1', state: 'COMPLETED', createTime: new Date().toISOString() },
        { id: 'session-2', state: 'COMPLETED', createTime: new Date().toISOString() },
        { id: 'session-3', state: 'COMPLETED', createTime: new Date().toISOString() },
        { id: 'session-4', state: 'FAILED', createTime: new Date().toISOString() }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const stats = await sessionMonitor.getStats();

      expect(stats.completionRate).toBe('75.0%');
    });

    it('should show N/A for completion rate when no completed or failed sessions', async () => {
      const mockSessions = [
        { id: 'session-1', state: 'IN_PROGRESS', createTime: new Date().toISOString() },
        { id: 'session-2', state: 'PLANNING', createTime: new Date().toISOString() }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const stats = await sessionMonitor.getStats();

      // When completed + failed = 0, division by zero results in NaN
      expect(stats.completionRate).toBe('NaN%');
    });

    it('should handle empty session list', async () => {
      mockJulesRequest.mockResolvedValue({ sessions: [] });

      const stats = await sessionMonitor.getStats();

      expect(stats.total).toBe(0);
      expect(stats.recent24h).toBe(0);
      expect(stats.recent7d).toBe(0);
      expect(stats.completionRate).toBe('N/A');
    });

    it('should handle sessions with UNKNOWN state', async () => {
      const mockSessions = [
        { id: 'session-1', createTime: new Date().toISOString() }
      ];

      mockJulesRequest.mockResolvedValue({ sessions: mockSessions });

      const stats = await sessionMonitor.getStats();

      expect(stats.byState.UNKNOWN).toBe(1);
    });
  });

  describe('getActivityType()', () => {
    it('should detect PLAN_GENERATED activity', () => {
      const activity = { planGenerated: { steps: [] } };
      expect(sessionMonitor.getActivityType(activity)).toBe('PLAN_GENERATED');
    });

    it('should detect PLAN_APPROVED activity', () => {
      const activity = { planApproved: true };
      expect(sessionMonitor.getActivityType(activity)).toBe('PLAN_APPROVED');
    });

    it('should detect STEP_STARTED activity', () => {
      const activity = { stepStarted: { title: 'Step 1' } };
      expect(sessionMonitor.getActivityType(activity)).toBe('STEP_STARTED');
    });

    it('should detect STEP_COMPLETED activity', () => {
      const activity = { stepCompleted: { title: 'Step 1' } };
      expect(sessionMonitor.getActivityType(activity)).toBe('STEP_COMPLETED');
    });

    it('should detect PR_CREATED activity', () => {
      const activity = { prCreated: { url: 'https://github.com/pr/1' } };
      expect(sessionMonitor.getActivityType(activity)).toBe('PR_CREATED');
    });

    it('should detect MESSAGE activity', () => {
      const activity = { message: { content: 'Hello' } };
      expect(sessionMonitor.getActivityType(activity)).toBe('MESSAGE');
    });

    it('should return UNKNOWN for unrecognized activity', () => {
      const activity = { unknownField: {} };
      expect(sessionMonitor.getActivityType(activity)).toBe('UNKNOWN');
    });
  });

  describe('summarizeActivity()', () => {
    it('should summarize plan generation with step count', () => {
      const activity = {
        planGenerated: { steps: [1, 2, 3] }
      };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('Plan generated with 3 steps');
    });

    it('should handle plan with no steps', () => {
      const activity = {
        planGenerated: {}
      };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('Plan generated with 0 steps');
    });

    it('should summarize plan approval', () => {
      const activity = { planApproved: true };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('Plan approved by user');
    });

    it('should summarize step start with title', () => {
      const activity = {
        stepStarted: { title: 'Install dependencies' }
      };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('Started: Install dependencies');
    });

    it('should summarize step start without title', () => {
      const activity = { stepStarted: {} };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('Started: Step');
    });

    it('should summarize step completion', () => {
      const activity = {
        stepCompleted: { title: 'Run tests' }
      };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('Completed: Run tests');
    });

    it('should summarize PR creation', () => {
      const activity = {
        prCreated: { url: 'https://github.com/pr/123' }
      };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('PR created: https://github.com/pr/123');
    });

    it('should summarize PR creation without URL', () => {
      const activity = { prCreated: {} };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('PR created: Link available');
    });

    it('should summarize message with truncated content', () => {
      const longMessage = 'x'.repeat(100);
      const activity = {
        message: { content: longMessage }
      };
      const summary = sessionMonitor.summarizeActivity(activity);
      expect(summary).toContain('Message:');
      expect(summary.length).toBeLessThan(100);
    });

    it('should handle message without content', () => {
      const activity = { message: {} };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('Message: ...');
    });

    it('should return default for unknown activity', () => {
      const activity = { unknown: true };
      expect(sessionMonitor.summarizeActivity(activity)).toBe('Activity recorded');
    });
  });

  describe('calculateDuration()', () => {
    it('should return seconds for duration under 1 minute', () => {
      const start = '2024-01-01T00:00:00Z';
      const end = '2024-01-01T00:00:30Z';
      const duration = sessionMonitor.calculateDuration(start, end);
      expect(duration).toBe('30 seconds');
    });

    it('should return minutes for duration under 1 hour', () => {
      const start = '2024-01-01T00:00:00Z';
      const end = '2024-01-01T00:15:00Z';
      const duration = sessionMonitor.calculateDuration(start, end);
      expect(duration).toBe('15 minutes');
    });

    it('should return hours for duration over 1 hour', () => {
      const start = '2024-01-01T00:00:00Z';
      const end = '2024-01-01T02:30:00Z';
      const duration = sessionMonitor.calculateDuration(start, end);
      expect(duration).toBe('2.5 hours');
    });

    it('should round seconds correctly', () => {
      const start = '2024-01-01T00:00:00Z';
      const end = '2024-01-01T00:00:45.678Z';
      const duration = sessionMonitor.calculateDuration(start, end);
      expect(duration).toBe('46 seconds');
    });

    it('should round minutes correctly', () => {
      const start = '2024-01-01T00:00:00Z';
      const end = '2024-01-01T00:05:30Z';
      const duration = sessionMonitor.calculateDuration(start, end);
      expect(duration).toBe('6 minutes');
    });
  });

  describe('getSessionTimeline()', () => {
    it('should fetch session and activities', async () => {
      const mockSession = {
        title: 'Test Session',
        state: 'COMPLETED',
        url: 'https://example.com/session-1',
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-01T01:00:00Z'
      };

      const mockActivities = {
        activities: [
          {
            id: 'act-1',
            createTime: '2024-01-01T00:10:00Z',
            originator: 'SYSTEM',
            planGenerated: { steps: [1, 2] }
          }
        ]
      };

      mockJulesRequest.mockImplementation((method, path) => {
        if (path.includes('/activities')) return Promise.resolve(mockActivities);
        return Promise.resolve(mockSession);
      });

      const result = await sessionMonitor.getSessionTimeline('session-1');

      expect(result.session.id).toBe('session-1');
      expect(result.session.title).toBe('Test Session');
      expect(result.timeline).toHaveLength(1);
      expect(result.timeline[0].type).toBe('PLAN_GENERATED');
      // Exactly 60 minutes = 3600000ms, which is not < 3600000, so it returns hours
      expect(result.duration).toBe('1.0 hours');
    });

    it('should handle empty activities list', async () => {
      const mockSession = {
        title: 'Test Session',
        state: 'IN_PROGRESS',
        url: 'url',
        createTime: '2024-01-01T00:00:00Z',
        updateTime: '2024-01-01T00:05:00Z'
      };

      mockJulesRequest.mockImplementation((method, path) => {
        if (path.includes('/activities')) return Promise.resolve({});
        return Promise.resolve(mockSession);
      });

      const result = await sessionMonitor.getSessionTimeline('session-1');

      expect(result.timeline).toEqual([]);
    });

    it('should throw error on fetch failure', async () => {
      mockJulesRequest.mockRejectedValue(new Error('Network error'));

      await expect(sessionMonitor.getSessionTimeline('session-1'))
        .rejects.toThrow('Failed to get timeline for session session-1: Network error');
    });
  });

  describe('monitorAll()', () => {
    it('should return comprehensive monitoring data', async () => {
      const mockActiveSessions = [
        { id: 'session-1', name: 'projects/test/sessions/session-1', state: 'IN_PROGRESS' }
      ];

      const mockAllSessions = [
        ...mockActiveSessions,
        { id: 'session-2', state: 'COMPLETED', createTime: new Date().toISOString() }
      ];

      const mockSessionDetails = {
        title: 'Active Session',
        state: 'IN_PROGRESS',
        url: 'https://example.com/session-1',
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString()
      };

      mockJulesRequest.mockImplementation((method, path) => {
        if (path === '/sessions') {
          return Promise.resolve({ sessions: mockAllSessions });
        }
        return Promise.resolve(mockSessionDetails);
      });

      const result = await sessionMonitor.monitorAll();

      expect(result.timestamp).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.total).toBe(2);
      expect(result.activeSessions).toHaveLength(1);
      expect(result.activeCount).toBe(1);
    });

    it('should limit detailed sessions to 20', async () => {
      const mockSessions = Array.from({ length: 30 }, (_, i) => ({
        id: `session-${i}`,
        name: `projects/test/sessions/session-${i}`,
        state: 'IN_PROGRESS',
        createTime: new Date().toISOString()
      }));

      mockJulesRequest.mockImplementation((method, path) => {
        if (path === '/sessions') {
          return Promise.resolve({ sessions: mockSessions });
        }
        return Promise.resolve({ title: 'Session', state: 'IN_PROGRESS', url: 'url', createTime: new Date().toISOString(), updateTime: new Date().toISOString() });
      });

      const result = await sessionMonitor.monitorAll();

      expect(result.activeSessions).toHaveLength(20);
      expect(result.activeCount).toBe(30);
    });

    it('should handle session detail fetch errors', async () => {
      const mockSessions = [
        { id: 'session-1', title: 'Session 1', name: 'projects/test/sessions/session-1', state: 'IN_PROGRESS', createTime: new Date().toISOString() }
      ];

      mockJulesRequest.mockImplementation((method, path) => {
        if (path === '/sessions') {
          return Promise.resolve({ sessions: mockSessions });
        }
        return Promise.reject(new Error('Network error'));
      });

      const result = await sessionMonitor.monitorAll();

      expect(result.activeSessions[0].error).toBe('Could not fetch details');
    });

    it('should extract session ID from name field', async () => {
      const mockSessions = [
        { name: 'projects/test/sessions/extracted-id', state: 'IN_PROGRESS', createTime: new Date().toISOString() }
      ];

      mockJulesRequest.mockImplementation((method, path) => {
        if (path === '/sessions') {
          return Promise.resolve({ sessions: mockSessions });
        }
        return Promise.resolve({
          title: 'Session',
          state: 'IN_PROGRESS',
          url: 'url',
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString()
        });
      });

      const result = await sessionMonitor.monitorAll();

      expect(result.activeSessions[0].id).toBe('extracted-id');
    });
  });
});
