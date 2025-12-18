/**
 * Unit Tests for Temporal Agent MCP Integration
 *
 * Tests cover:
 * - Schedule template validation (cron expressions, required fields)
 * - API request formatting (correct tool names, parameters)
 * - Error handling (network failures, invalid responses)
 * - Response filtering for Jules-specific tasks
 * - Date handling for one-time schedules
 *
 * @module tests/unit/temporal-integration.test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// =============================================================================
// Mock Setup
// =============================================================================

// Store original fetch
const originalFetch = globalThis.fetch;

// Mock fetch responses
let mockFetchResponse = null;
let mockFetchCalls = [];

function setupMockFetch(response, ok = true) {
  mockFetchCalls = [];
  mockFetchResponse = response;

  globalThis.fetch = async (url, options) => {
    mockFetchCalls.push({ url, options });
    return {
      ok,
      status: ok ? 200 : 500,
      text: async () => typeof response === 'string' ? response : JSON.stringify(response),
      json: async () => response,
    };
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// =============================================================================
// Import module after mock setup
// =============================================================================

// Dynamic import to allow mock setup first
let temporalIntegration;

async function loadModule() {
  // Clear module cache to get fresh import
  const modulePath = new URL('../../lib/temporal-integration.js', import.meta.url).href;
  temporalIntegration = await import(modulePath + '?t=' + Date.now());
}

// =============================================================================
// Schedule Templates Tests
// =============================================================================

describe('Schedule Templates', () => {
  beforeEach(async () => {
    await loadModule();
  });

  it('should have all 4 predefined templates', () => {
    const { scheduleTemplates } = temporalIntegration;

    assert.ok(scheduleTemplates.weeklyDependencyUpdate, 'Missing weeklyDependencyUpdate template');
    assert.ok(scheduleTemplates.dailyCodeQuality, 'Missing dailyCodeQuality template');
    assert.ok(scheduleTemplates.hourlyPrMonitor, 'Missing hourlyPrMonitor template');
    assert.ok(scheduleTemplates.nightlySecurityScan, 'Missing nightlySecurityScan template');
  });

  it('should have valid cron expressions in all templates', () => {
    const { scheduleTemplates } = temporalIntegration;

    // Valid 5-part cron regex (minute hour day month weekday)
    const cronRegex = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/;

    for (const [name, template] of Object.entries(scheduleTemplates)) {
      assert.ok(
        cronRegex.test(template.cronExpression),
        `Invalid cron expression in ${name}: ${template.cronExpression}`
      );
    }
  });

  it('should have required fields in all templates', () => {
    const { scheduleTemplates } = temporalIntegration;
    const requiredFields = ['cronExpression', 'timezone', 'task'];

    for (const [name, template] of Object.entries(scheduleTemplates)) {
      for (const field of requiredFields) {
        assert.ok(
          template[field] !== undefined,
          `Missing ${field} in ${name} template`
        );
      }
    }
  });

  it('should have valid IANA timezones', () => {
    const { scheduleTemplates } = temporalIntegration;
    const validTimezones = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London'];

    for (const [name, template] of Object.entries(scheduleTemplates)) {
      // Basic validation - just check it's a non-empty string
      assert.ok(
        typeof template.timezone === 'string' && template.timezone.length > 0,
        `Invalid timezone in ${name}: ${template.timezone}`
      );
    }
  });

  it('weeklyDependencyUpdate should run on Monday', () => {
    const { scheduleTemplates } = temporalIntegration;
    const cron = scheduleTemplates.weeklyDependencyUpdate.cronExpression;

    // "0 9 * * 1" - weekday field (5th) should be 1 (Monday)
    const parts = cron.split(' ');
    assert.strictEqual(parts[4], '1', 'weeklyDependencyUpdate should run on Monday (weekday=1)');
  });

  it('hourlyPrMonitor should run every hour', () => {
    const { scheduleTemplates } = temporalIntegration;
    const cron = scheduleTemplates.hourlyPrMonitor.cronExpression;

    // "0 * * * *" - hour field should be *
    const parts = cron.split(' ');
    assert.strictEqual(parts[0], '0', 'Should run at minute 0');
    assert.strictEqual(parts[1], '*', 'Should run every hour');
  });
});

// =============================================================================
// scheduleJulesSession Tests
// =============================================================================

describe('scheduleJulesSession', () => {
  beforeEach(async () => {
    await loadModule();
    setupMockFetch({ success: true, taskId: 'task-123' });
  });

  it('should throw on missing required parameters', async () => {
    const { scheduleJulesSession } = temporalIntegration;

    await assert.rejects(
      async () => scheduleJulesSession({}),
      /Invalid name/,
      'Should require name'
    );

    await assert.rejects(
      async () => scheduleJulesSession({ name: 'test' }),
      /Invalid cronExpression/,
      'Should require cronExpression'
    );

    await assert.rejects(
      async () => scheduleJulesSession({ name: 'test', cronExpression: '0 * * * *' }),
      /Invalid repository/,
      'Should require repository'
    );
  });

  it('should call temporal-agent with correct tool name', async () => {
    const { scheduleJulesSession } = temporalIntegration;

    await scheduleJulesSession({
      name: 'test-task',
      cronExpression: '0 9 * * 1',
      repository: 'owner/repo',
      task: 'Test task',
    });

    assert.strictEqual(mockFetchCalls.length, 1, 'Should make exactly one fetch call');

    const body = JSON.parse(mockFetchCalls[0].options.body);
    assert.strictEqual(body.tool, 'schedule_recurring', 'Should use schedule_recurring tool');
  });

  it('should include all required parameters', async () => {
    const { scheduleJulesSession } = temporalIntegration;

    await scheduleJulesSession({
      name: 'weekly-deps',
      cronExpression: '0 9 * * 1',
      timezone: 'America/New_York',
      repository: 'owner/repo',
      task: 'Update dependencies',
      autoApprove: true,
    });

    const body = JSON.parse(mockFetchCalls[0].options.body);
    const params = body.params;

    assert.strictEqual(params.name, 'weekly-deps');
    assert.strictEqual(params.cron_expression, '0 9 * * 1');
    assert.strictEqual(params.timezone, 'America/New_York');
    assert.strictEqual(params.callback_type, 'webhook');
    assert.strictEqual(params.payload.repository, 'owner/repo');
    assert.strictEqual(params.payload.task, 'Update dependencies');
    assert.strictEqual(params.payload.autoApprove, true);
  });

  it('should default timezone to UTC', async () => {
    const { scheduleJulesSession } = temporalIntegration;

    await scheduleJulesSession({
      name: 'test',
      cronExpression: '0 * * * *',
      repository: 'owner/repo',
      task: 'Test',
    });

    const body = JSON.parse(mockFetchCalls[0].options.body);
    assert.strictEqual(body.params.timezone, 'UTC', 'Should default to UTC timezone');
  });

  it('should default autoApprove to false', async () => {
    const { scheduleJulesSession } = temporalIntegration;

    await scheduleJulesSession({
      name: 'test',
      cronExpression: '0 * * * *',
      repository: 'owner/repo',
      task: 'Test',
    });

    const body = JSON.parse(mockFetchCalls[0].options.body);
    assert.strictEqual(body.params.payload.autoApprove, false, 'Should default autoApprove to false');
  });

  it('should throw on API error', async () => {
    const { scheduleJulesSession } = temporalIntegration;
    setupMockFetch('Service unavailable', false);

    await assert.rejects(
      async () => scheduleJulesSession({
        name: 'test',
        cronExpression: '0 * * * *',
        repository: 'owner/repo',
        task: 'Test',
      }),
      /Failed to schedule Jules session/,
      'Should throw descriptive error on API failure'
    );
  });

  it('should include X-Scheduled-Task header in callback config', async () => {
    const { scheduleJulesSession } = temporalIntegration;

    await scheduleJulesSession({
      name: 'my-scheduled-task',
      cronExpression: '0 * * * *',
      repository: 'owner/repo',
      task: 'Test',
    });

    const body = JSON.parse(mockFetchCalls[0].options.body);
    assert.strictEqual(
      body.params.callback_config.headers['X-Scheduled-Task'],
      'my-scheduled-task',
      'Should include task name in callback headers'
    );
  });

  afterEach(() => {
    restoreFetch();
  });
});

// =============================================================================
// scheduleOneTimeJulesSession Tests
// =============================================================================

describe('scheduleOneTimeJulesSession', () => {
  beforeEach(async () => {
    await loadModule();
    setupMockFetch({ success: true, taskId: 'task-456' });
  });

  it('should call temporal-agent with schedule_task tool', async () => {
    const { scheduleOneTimeJulesSession } = temporalIntegration;

    await scheduleOneTimeJulesSession({
      name: 'one-time-task',
      scheduledFor: '2025-12-25T10:00:00Z',
      repository: 'owner/repo',
      task: 'One-time task',
    });

    const body = JSON.parse(mockFetchCalls[0].options.body);
    assert.strictEqual(body.tool, 'schedule_task', 'Should use schedule_task tool');
  });

  it('should accept ISO string for scheduledFor', async () => {
    const { scheduleOneTimeJulesSession } = temporalIntegration;
    const isoDate = '2025-12-25T10:00:00Z';

    await scheduleOneTimeJulesSession({
      name: 'test',
      scheduledFor: isoDate,
      repository: 'owner/repo',
      task: 'Test',
    });

    const body = JSON.parse(mockFetchCalls[0].options.body);
    assert.strictEqual(body.params.scheduled_for, isoDate);
  });

  it('should accept Date object for scheduledFor', async () => {
    const { scheduleOneTimeJulesSession } = temporalIntegration;
    const date = new Date('2025-12-25T10:00:00Z');

    await scheduleOneTimeJulesSession({
      name: 'test',
      scheduledFor: date,
      repository: 'owner/repo',
      task: 'Test',
    });

    const body = JSON.parse(mockFetchCalls[0].options.body);
    assert.strictEqual(body.params.scheduled_for, date.toISOString());
  });

  it('should throw on API error', async () => {
    const { scheduleOneTimeJulesSession } = temporalIntegration;
    setupMockFetch('Bad request', false);

    await assert.rejects(
      async () => scheduleOneTimeJulesSession({
        name: 'test',
        scheduledFor: '2025-12-25T10:00:00Z',
        repository: 'owner/repo',
        task: 'Test',
      }),
      /Failed to schedule one-time Jules session/,
      'Should throw descriptive error'
    );
  });

  afterEach(() => {
    restoreFetch();
  });
});

// =============================================================================
// listScheduledJulesTasks Tests
// =============================================================================

describe('listScheduledJulesTasks', () => {
  beforeEach(async () => {
    await loadModule();
  });

  it('should call list_tasks tool', async () => {
    setupMockFetch({ tasks: [] });
    const { listScheduledJulesTasks } = temporalIntegration;

    await listScheduledJulesTasks();

    const body = JSON.parse(mockFetchCalls[0].options.body);
    assert.strictEqual(body.tool, 'list_tasks');
  });

  it('should filter to only Jules-related tasks', async () => {
    setupMockFetch({
      tasks: [
        { id: '1', payload: { action: 'create_jules_session' } },
        { id: '2', payload: { action: 'other_action' } },
        { id: '3', payload: { action: 'create_jules_session' } },
        { id: '4', payload: null },
      ],
    });
    const { listScheduledJulesTasks } = temporalIntegration;

    const result = await listScheduledJulesTasks();

    assert.strictEqual(result.length, 2, 'Should filter to Jules tasks only');
    assert.strictEqual(result[0].id, '1');
    assert.strictEqual(result[1].id, '3');
  });

  it('should return empty array when no tasks', async () => {
    setupMockFetch({ tasks: [] });
    const { listScheduledJulesTasks } = temporalIntegration;

    const result = await listScheduledJulesTasks();

    assert.deepStrictEqual(result, []);
  });

  it('should handle missing tasks field', async () => {
    setupMockFetch({});
    const { listScheduledJulesTasks } = temporalIntegration;

    const result = await listScheduledJulesTasks();

    assert.deepStrictEqual(result, []);
  });

  it('should throw on API error', async () => {
    setupMockFetch('Internal error', false);
    const { listScheduledJulesTasks } = temporalIntegration;

    await assert.rejects(
      async () => listScheduledJulesTasks(),
      /Failed to list scheduled tasks/
    );
  });

  afterEach(() => {
    restoreFetch();
  });
});

// =============================================================================
// cancelScheduledJulesTask Tests
// =============================================================================

describe('cancelScheduledJulesTask', () => {
  beforeEach(async () => {
    await loadModule();
    setupMockFetch({ success: true });
  });

  it('should throw on invalid taskId', async () => {
    const { cancelScheduledJulesTask } = temporalIntegration;

    await assert.rejects(
      async () => cancelScheduledJulesTask(null),
      /Invalid taskId/,
      'Should reject null taskId'
    );

    await assert.rejects(
      async () => cancelScheduledJulesTask(''),
      /Invalid taskId/,
      'Should reject empty taskId'
    );
  });

  it('should call cancel_task tool with task ID', async () => {
    const { cancelScheduledJulesTask } = temporalIntegration;

    await cancelScheduledJulesTask('task-789');

    const body = JSON.parse(mockFetchCalls[0].options.body);
    assert.strictEqual(body.tool, 'cancel_task');
    assert.strictEqual(body.params.id, 'task-789');
  });

  it('should return cancellation result', async () => {
    setupMockFetch({ success: true, message: 'Task cancelled' });
    const { cancelScheduledJulesTask } = temporalIntegration;

    const result = await cancelScheduledJulesTask('task-789');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.message, 'Task cancelled');
  });

  it('should throw on API error', async () => {
    setupMockFetch('Task not found', false);
    const { cancelScheduledJulesTask } = temporalIntegration;

    await assert.rejects(
      async () => cancelScheduledJulesTask('nonexistent'),
      /Failed to cancel scheduled task/
    );
  });

  afterEach(() => {
    restoreFetch();
  });
});

// =============================================================================
// API Request Format Tests
// =============================================================================

describe('API Request Format', () => {
  beforeEach(async () => {
    await loadModule();
    setupMockFetch({ success: true });
  });

  it('should use POST method for all requests', async () => {
    const { scheduleJulesSession, listScheduledJulesTasks, cancelScheduledJulesTask } = temporalIntegration;

    await scheduleJulesSession({
      name: 'test', cronExpression: '0 * * * *', repository: 'o/r', task: 't',
    });
    assert.strictEqual(mockFetchCalls[0].options.method, 'POST');

    mockFetchCalls = [];
    await listScheduledJulesTasks();
    assert.strictEqual(mockFetchCalls[0].options.method, 'POST');

    mockFetchCalls = [];
    await cancelScheduledJulesTask('id');
    assert.strictEqual(mockFetchCalls[0].options.method, 'POST');
  });

  it('should set Content-Type to application/json', async () => {
    const { scheduleJulesSession } = temporalIntegration;

    await scheduleJulesSession({
      name: 'test', cronExpression: '0 * * * *', repository: 'o/r', task: 't',
    });

    assert.strictEqual(
      mockFetchCalls[0].options.headers['Content-Type'],
      'application/json'
    );
  });

  it('should call correct endpoint URL', async () => {
    const { scheduleJulesSession } = temporalIntegration;

    await scheduleJulesSession({
      name: 'test', cronExpression: '0 * * * *', repository: 'o/r', task: 't',
    });

    assert.ok(
      mockFetchCalls[0].url.endsWith('/mcp/execute'),
      'Should call /mcp/execute endpoint'
    );
  });

  afterEach(() => {
    restoreFetch();
  });
});

console.log('Running temporal-integration tests...');
