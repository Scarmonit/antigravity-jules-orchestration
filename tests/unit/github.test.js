/**
 * Unit Tests for GitHub Integration Module
 * Tests cover:
 * - githubRequest() HTTP request handling
 * - getIssue() issue fetching with comments
 * - getIssuesByLabel() filtering by labels
 * - formatIssueForPrompt() prompt formatting
 * - getRepoInfo() repository information
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import https from 'https';
import { getIssue, getIssuesByLabel, formatIssueForPrompt, getRepoInfo } from '../../lib/github.js';

// Mock https module
vi.mock('https');

// Helper to create mock response
function createMockResponse(statusCode, data) {
  const response = {
    statusCode,
    on: vi.fn()
  };

  // Set up event handlers
  response.on.mockImplementation((event, handler) => {
    if (event === 'data') {
      setTimeout(() => handler(data), 0);
    } else if (event === 'end') {
      setTimeout(() => handler(), 0);
    }
    return response;
  });

  return response;
}

// Helper to create mock request
function createMockRequest(response, error = null) {
  const request = {
    on: vi.fn(),
    end: vi.fn()
  };

  request.on.mockImplementation((event, handler) => {
    if (event === 'error' && error) {
      setTimeout(() => handler(error), 0);
    }
    return request;
  });

  request.end.mockImplementation(() => {
    // Trigger response callback after end() is called
    if (!error) {
      setTimeout(() => {
        const responseCallback = https.request.mock.calls[https.request.mock.calls.length - 1][1];
        responseCallback(response);
      }, 0);
    }
  });

  return request;
}

describe('GitHub Integration Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getIssue()', () => {
    it('should fetch an issue with all details', async () => {
      const mockIssue = {
        number: 123,
        title: 'Test Issue',
        body: 'This is a test issue',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'priority:high' }],
        user: { login: 'testuser' },
        created_at: '2024-01-01T00:00:00Z',
        html_url: 'https://github.com/owner/repo/issues/123'
      };

      const mockComments = [
        {
          user: { login: 'commenter1' },
          body: 'First comment',
          created_at: '2024-01-02T00:00:00Z'
        }
      ];

      let callCount = 0;
      https.request.mockImplementation((options, callback) => {
        callCount++;
        const data = callCount === 1 ? JSON.stringify(mockIssue) : JSON.stringify(mockComments);
        const response = createMockResponse(200, data);
        return createMockRequest(response);
      });

      const result = await getIssue('owner', 'repo', 123);

      expect(result).toEqual({
        number: 123,
        title: 'Test Issue',
        body: 'This is a test issue',
        state: 'open',
        labels: ['bug', 'priority:high'],
        author: 'testuser',
        createdAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/owner/repo/issues/123',
        comments: [{
          author: 'commenter1',
          body: 'First comment',
          createdAt: '2024-01-02T00:00:00Z'
        }]
      });
    });

    it('should handle missing issue body', async () => {
      const mockIssue = {
        number: 123,
        title: 'Test Issue',
        body: null,
        state: 'open',
        labels: [],
        user: { login: 'testuser' },
        created_at: '2024-01-01T00:00:00Z',
        html_url: 'https://github.com/owner/repo/issues/123'
      };

      https.request.mockImplementation((options, callback) => {
        const data = options.path.includes('/comments')
          ? JSON.stringify([])
          : JSON.stringify(mockIssue);
        const response = createMockResponse(200, data);
        return createMockRequest(response);
      });

      const result = await getIssue('owner', 'repo', 123);

      expect(result.body).toBe('');
    });

    it('should handle comment fetch failure gracefully', async () => {
      const mockIssue = {
        number: 123,
        title: 'Test Issue',
        body: 'Body',
        state: 'open',
        labels: [],
        user: { login: 'testuser' },
        created_at: '2024-01-01T00:00:00Z',
        html_url: 'https://github.com/owner/repo/issues/123'
      };

      https.request.mockImplementation((options, callback) => {
        if (options.path.includes('/comments')) {
          const response = createMockResponse(403, 'Forbidden');
          return createMockRequest(response);
        }
        const response = createMockResponse(200, JSON.stringify(mockIssue));
        return createMockRequest(response);
      });

      const result = await getIssue('owner', 'repo', 123);

      expect(result.comments).toEqual([]);
    });

    it('should include Authorization header when token provided', async () => {
      const mockIssue = {
        number: 123,
        title: 'Test',
        state: 'open',
        labels: [],
        user: { login: 'user' },
        created_at: '2024-01-01T00:00:00Z',
        html_url: 'https://example.com'
      };

      https.request.mockImplementation((options, callback) => {
        expect(options.headers.Authorization).toBe('token test-token');
        const data = options.path.includes('/comments')
          ? JSON.stringify([])
          : JSON.stringify(mockIssue);
        const response = createMockResponse(200, data);
        return createMockRequest(response);
      });

      await getIssue('owner', 'repo', 123, 'test-token');
    });
  });

  describe('getIssuesByLabel()', () => {
    it('should fetch issues with specific label', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Bug 1',
          body: 'Body 1',
          labels: [{ name: 'bug' }],
          user: { login: 'user1' },
          html_url: 'https://github.com/owner/repo/issues/1'
        },
        {
          number: 2,
          title: 'Bug 2',
          body: 'Body 2',
          labels: [{ name: 'bug' }, { name: 'critical' }],
          user: { login: 'user2' },
          html_url: 'https://github.com/owner/repo/issues/2'
        }
      ];

      https.request.mockImplementation((options, callback) => {
        expect(options.path).toContain('labels=bug');
        expect(options.path).toContain('state=open');
        const response = createMockResponse(200, JSON.stringify(mockIssues));
        return createMockRequest(response);
      });

      const result = await getIssuesByLabel('owner', 'repo', 'bug');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        number: 1,
        title: 'Bug 1',
        body: 'Body 1',
        labels: ['bug'],
        author: 'user1',
        url: 'https://github.com/owner/repo/issues/1'
      });
    });

    it('should handle empty label correctly (URL encoding)', async () => {
      https.request.mockImplementation((options, callback) => {
        expect(options.path).toContain('labels=');
        const response = createMockResponse(200, JSON.stringify([]));
        return createMockRequest(response);
      });

      await getIssuesByLabel('owner', 'repo', '');
    });

    it('should handle labels with special characters', async () => {
      https.request.mockImplementation((options, callback) => {
        expect(options.path).toContain(encodeURIComponent('bug: critical'));
        const response = createMockResponse(200, JSON.stringify([]));
        return createMockRequest(response);
      });

      await getIssuesByLabel('owner', 'repo', 'bug: critical');
    });
  });

  describe('formatIssueForPrompt()', () => {
    it('should format issue with all details', () => {
      const issue = {
        number: 42,
        title: 'Fix authentication bug',
        body: 'Users cannot login with valid credentials',
        labels: ['bug', 'security'],
        comments: [
          { author: 'user1', body: 'I can reproduce this issue' },
          { author: 'user2', body: 'Same problem here' },
          { author: 'user3', body: 'Possible solution: check password hash' }
        ]
      };

      const result = formatIssueForPrompt(issue);

      expect(result).toContain('Fix GitHub Issue #42: Fix authentication bug');
      expect(result).toContain('Users cannot login with valid credentials');
      expect(result).toContain('bug, security');
      expect(result).toContain('@user1: I can reproduce this issue');
      expect(result).toContain('@user2: Same problem here');
      expect(result).toContain('@user3: Possible solution: check password hash');
      expect(result).toContain('Analyze the issue and identify the root cause');
    });

    it('should handle issue without labels', () => {
      const issue = {
        number: 1,
        title: 'Test',
        body: 'Body'
      };

      const result = formatIssueForPrompt(issue);

      expect(result).not.toContain('## Labels');
      expect(result).toContain('## Issue Description');
    });

    it('should handle issue without comments', () => {
      const issue = {
        number: 1,
        title: 'Test',
        body: 'Body'
      };

      const result = formatIssueForPrompt(issue);

      expect(result).not.toContain('## Discussion Context');
    });

    it('should show only last 3 comments', () => {
      const issue = {
        number: 1,
        title: 'Test',
        body: 'Body',
        comments: [
          { author: 'user1', body: 'Comment 1' },
          { author: 'user2', body: 'Comment 2' },
          { author: 'user3', body: 'Comment 3' },
          { author: 'user4', body: 'Comment 4' },
          { author: 'user5', body: 'Comment 5' }
        ]
      };

      const result = formatIssueForPrompt(issue);

      expect(result).toContain('@user3');
      expect(result).toContain('@user4');
      expect(result).toContain('@user5');
      expect(result).not.toContain('@user1');
      expect(result).not.toContain('@user2');
    });

    it('should truncate long comments to 200 characters', () => {
      const longComment = 'x'.repeat(250);
      const issue = {
        number: 1,
        title: 'Test',
        body: 'Body',
        comments: [
          { author: 'user1', body: longComment }
        ]
      };

      const result = formatIssueForPrompt(issue);

      expect(result).toContain('x'.repeat(200) + '...');
      expect(result).not.toContain('x'.repeat(250));
    });

    it('should include instructions section', () => {
      const issue = {
        number: 1,
        title: 'Test',
        body: 'Body'
      };

      const result = formatIssueForPrompt(issue);

      expect(result).toContain('## Instructions');
      expect(result).toContain('Analyze the issue and identify the root cause');
      expect(result).toContain('Implement a fix that addresses the problem');
      expect(result).toContain('Add appropriate tests to prevent regression');
      expect(result).toContain('Update any relevant documentation');
    });
  });

  describe('getRepoInfo()', () => {
    it('should fetch repository information', async () => {
      const mockRepo = {
        name: 'test-repo',
        full_name: 'owner/test-repo',
        description: 'A test repository',
        default_branch: 'main',
        stargazers_count: 100,
        language: 'JavaScript'
      };

      https.request.mockImplementation((options, callback) => {
        expect(options.path).toBe('/repos/owner/test-repo');
        const response = createMockResponse(200, JSON.stringify(mockRepo));
        return createMockRequest(response);
      });

      const result = await getRepoInfo('owner', 'test-repo');

      expect(result).toEqual(mockRepo);
    });

    it('should handle API errors', async () => {
      https.request.mockImplementation((options, callback) => {
        const response = createMockResponse(404, 'Not Found');
        return createMockRequest(response);
      });

      await expect(getRepoInfo('owner', 'nonexistent')).rejects.toThrow('GitHub API error: 404');
    });

    it('should include token in Authorization header', async () => {
      https.request.mockImplementation((options, callback) => {
        expect(options.headers.Authorization).toBe('token my-token');
        const response = createMockResponse(200, JSON.stringify({}));
        return createMockRequest(response);
      });

      await getRepoInfo('owner', 'repo', 'my-token');
    });
  });

  describe('githubRequest() error handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('ECONNREFUSED');

      https.request.mockImplementation((options, callback) => {
        return createMockRequest(null, networkError);
      });

      await expect(getRepoInfo('owner', 'repo')).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle malformed JSON responses', async () => {
      https.request.mockImplementation((options, callback) => {
        const response = createMockResponse(200, 'invalid json {');
        return createMockRequest(response);
      });

      // Should return the raw data when JSON parsing fails
      const result = await getRepoInfo('owner', 'repo');
      expect(result).toBe('invalid json {');
    });

    it('should handle 401 Unauthorized', async () => {
      https.request.mockImplementation((options, callback) => {
        const response = createMockResponse(401, JSON.stringify({ message: 'Bad credentials' }));
        return createMockRequest(response);
      });

      await expect(getRepoInfo('owner', 'repo')).rejects.toThrow('GitHub API error: 401');
    });

    it('should handle 403 Rate Limit Exceeded', async () => {
      https.request.mockImplementation((options, callback) => {
        const response = createMockResponse(403, JSON.stringify({ message: 'Rate limit exceeded' }));
        return createMockRequest(response);
      });

      await expect(getRepoInfo('owner', 'repo')).rejects.toThrow('GitHub API error: 403');
    });
  });
});
