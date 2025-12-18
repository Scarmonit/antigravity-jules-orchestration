/**
 * Temporal Agent MCP Integration
 * Provides helper functions to create scheduled Jules sessions
 */

const TEMPORAL_AGENT_URL = process.env.TEMPORAL_AGENT_URL || 'http://localhost:3324';
const JULES_ORCHESTRATION_URL = process.env.JULES_ORCHESTRATION_URL || 'http://localhost:3323';

/**
 * Validate required string parameter
 * @param {string} value - The value to validate
 * @param {string} name - Parameter name for error messages
 * @throws {Error} If validation fails
 */
function validateRequired(value, name) {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${name}: must be a non-empty string`);
  }
}

/**
 * Validate schedule configuration
 * @param {Object} config - Configuration to validate
 * @param {string[]} requiredFields - List of required field names
 * @throws {Error} If validation fails
 */
function validateConfig(config, requiredFields) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration object is required');
  }
  for (const field of requiredFields) {
    validateRequired(config[field], field);
  }
}

/**
 * Sanitize header values to prevent CRLF injection
 * @param {string} value - Header value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeHeaderValue(value) {
  return String(value).replace(/[\r\n\0]/g, '').trim();
}

/**
 * Schedule a recurring Jules session
 * @param {Object} config - Schedule configuration
 * @param {string} config.name - Unique name for this scheduled task
 * @param {string} config.cronExpression - Cron expression (e.g., "0 9 * * 1" for Monday 9 AM)
 * @param {string} config.timezone - IANA timezone (e.g., "America/New_York")
 * @param {string} config.repository - GitHub repository in owner/repo format
 * @param {string} config.task - Task description for Jules
 * @param {boolean} config.autoApprove - Whether to auto-approve Jules plans
 * @returns {Promise<Object>} - Created task details
 */
export async function scheduleJulesSession(config) {
  // Validate required parameters
  validateConfig(config, ['name', 'cronExpression', 'repository', 'task']);

  const {
    name,
    cronExpression,
    timezone = 'UTC',
    repository,
    task,
    autoApprove = false,
  } = config;

  const response = await fetch(`${TEMPORAL_AGENT_URL}/mcp/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'schedule_recurring',
      params: {
        name,
        cron_expression: cronExpression,
        timezone,
        payload: {
          action: 'create_jules_session',
          repository,
          task,
          autoApprove,
        },
        callback_type: 'webhook',
        callback_config: {
          url: `${JULES_ORCHESTRATION_URL}/api/jules/create`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Scheduled-Task': sanitizeHeaderValue(name),
          },
        },
      },
    }),
  });

  if (!response.ok) {
    // Log detailed error internally but return sanitized message
    const errorBody = await response.text();
    console.error('[Temporal] Schedule failed:', { status: response.status, body: errorBody });
    throw new Error(`Failed to schedule Jules session (status: ${response.status})`);
  }

  return response.json();
}

/**
 * Schedule a one-time Jules session
 * @param {Object} config - Schedule configuration
 * @param {string} config.name - Unique name for this task
 * @param {string|Date} config.scheduledFor - When to run (ISO string or Date)
 * @param {string} config.repository - GitHub repository
 * @param {string} config.task - Task description
 * @param {boolean} config.autoApprove - Auto-approve plans
 * @returns {Promise<Object>} - Created task details
 */
export async function scheduleOneTimeJulesSession(config) {
  // Validate required parameters
  validateConfig(config, ['name', 'repository', 'task']);
  if (!config.scheduledFor) {
    throw new Error('Invalid scheduledFor: must be a Date or ISO string');
  }

  const {
    name,
    scheduledFor,
    repository,
    task,
    autoApprove = false,
  } = config;

  const response = await fetch(`${TEMPORAL_AGENT_URL}/mcp/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'schedule_task',
      params: {
        name,
        scheduled_for: typeof scheduledFor === 'string'
          ? scheduledFor
          : scheduledFor.toISOString(),
        payload: {
          action: 'create_jules_session',
          repository,
          task,
          autoApprove,
        },
        callback_type: 'webhook',
        callback_config: {
          url: `${JULES_ORCHESTRATION_URL}/api/jules/create`,
          method: 'POST',
        },
      },
    }),
  });

  if (!response.ok) {
    // Log detailed error internally but return sanitized message
    const errorBody = await response.text();
    console.error('[Temporal] One-time schedule failed:', { status: response.status, body: errorBody });
    throw new Error(`Failed to schedule one-time Jules session (status: ${response.status})`);
  }

  return response.json();
}

/**
 * List all scheduled Jules tasks
 * @returns {Promise<Array>} - List of scheduled tasks
 */
export async function listScheduledJulesTasks() {
  const response = await fetch(`${TEMPORAL_AGENT_URL}/mcp/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'list_tasks',
      params: {},
    }),
  });

  if (!response.ok) {
    console.error('[Temporal] List tasks failed:', { status: response.status });
    throw new Error(`Failed to list scheduled tasks (status: ${response.status})`);
  }

  const result = await response.json();

  // Filter to only Jules-related tasks
  return result.tasks?.filter(task =>
    task.payload?.action === 'create_jules_session'
  ) || [];
}

/**
 * Cancel a scheduled Jules task
 * @param {string} taskId - Task ID to cancel
 * @returns {Promise<Object>} - Cancellation result
 */
export async function cancelScheduledJulesTask(taskId) {
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Invalid taskId: must be a non-empty string');
  }

  const response = await fetch(`${TEMPORAL_AGENT_URL}/mcp/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'cancel_task',
      params: { id: taskId },
    }),
  });

  if (!response.ok) {
    console.error('[Temporal] Cancel task failed:', { status: response.status, taskId });
    throw new Error(`Failed to cancel scheduled task (status: ${response.status})`);
  }

  return response.json();
}

/**
 * Predefined schedule templates
 */
export const scheduleTemplates = {
  weeklyDependencyUpdate: {
    cronExpression: '0 9 * * 1',
    timezone: 'America/New_York',
    task: 'Update all dependencies to latest secure versions. Run full test suite. Create PR with changelog.',
  },
  dailyCodeQuality: {
    cronExpression: '0 6 * * *',
    timezone: 'UTC',
    task: 'Run static analysis and code quality checks. Identify code smells and suggest refactoring. Report findings.',
  },
  hourlyPrMonitor: {
    cronExpression: '0 * * * *',
    timezone: 'UTC',
    task: 'Check all open PRs. Report status of CI checks. Flag any PRs needing attention.',
  },
  nightlySecurityScan: {
    cronExpression: '0 2 * * *',
    timezone: 'UTC',
    task: 'Run security vulnerability scan. Check for known CVEs in dependencies. Create issues for any findings.',
  },
};

export default {
  scheduleJulesSession,
  scheduleOneTimeJulesSession,
  listScheduledJulesTasks,
  cancelScheduledJulesTask,
  scheduleTemplates,
};
