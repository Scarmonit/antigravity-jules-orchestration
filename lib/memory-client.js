/**
 * Semantic Memory Client
 * Client for semantic-memory-mcp API integration
 *
 * Provides persistent semantic memory for Jules sessions:
 * - Store session outcomes and learnings
 * - Recall relevant context before starting tasks
 * - Reinforce successful patterns
 * - Support scheduled memory maintenance
 */

const SEMANTIC_MEMORY_URL = process.env.SEMANTIC_MEMORY_URL || 'https://memory.scarmonit.com';

/**
 * Call a semantic memory tool
 * @param {string} tool - Tool name
 * @param {Object} params - Tool parameters
 * @returns {Promise<Object>} - Tool result
 */
async function callMemoryTool(tool, params = {}) {
  try {
    const response = await fetch(`${SEMANTIC_MEMORY_URL}/mcp/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tool, parameters: params }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Memory API error: ${response.status} - ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[Memory] Tool ${tool} failed:`, error.message);
    // Return graceful failure - memory operations should not block main flow
    return { success: false, error: error.message };
  }
}

/**
 * Store a Jules session outcome as a memory
 * @param {Object} session - Jules session object
 * @param {string} outcome - 'completed' | 'failed'
 * @param {Object} details - Additional details (PR URL, error message, etc.)
 * @returns {Promise<Object>}
 */
export async function storeSessionOutcome(session, outcome, details = {}) {
  const sessionId = session.name?.split('/').pop() || session.id;
  const isSuccess = outcome === 'completed';

  // Build content from session data
  const content = buildSessionMemoryContent(session, outcome, details);

  // Calculate importance based on outcome
  // Successful sessions with PRs are more important
  let importance = 0.5;
  if (isSuccess && details.prUrl) importance = 0.7;
  if (isSuccess && details.merged) importance = 0.85;
  if (!isSuccess) importance = 0.4; // Failed sessions still valuable for learning

  const tags = [
    'jules-session',
    outcome,
    session.automationMode?.toLowerCase() || 'auto',
  ];

  // Add repository tag if available
  const source = session.sourceContext?.source;
  if (source) {
    const repoTag = source.replace('sources/github/', '').replace('/', '-');
    tags.push(`repo-${repoTag}`);
  }

  return await callMemoryTool('store_memory', {
    content,
    summary: `Jules session ${sessionId}: ${outcome}. ${session.title || ''}`,
    tags,
    importance,
    metadata: {
      sessionId,
      outcome,
      prUrl: details.prUrl,
      state: session.state,
      source: session.sourceContext?.source,
      branch: session.sourceContext?.githubRepoContext?.startingBranch,
      createdAt: session.createTime,
    },
    source: 'jules-orchestration',
  });
}

/**
 * Build memory content from session data
 */
function buildSessionMemoryContent(session, outcome, details) {
  const parts = [];

  parts.push(`## Jules Session ${outcome.toUpperCase()}`);

  if (session.title) {
    parts.push(`**Task:** ${session.title}`);
  }

  if (session.prompt) {
    parts.push(`**Prompt:** ${session.prompt.slice(0, 500)}${session.prompt.length > 500 ? '...' : ''}`);
  }

  if (session.sourceContext?.source) {
    parts.push(`**Repository:** ${session.sourceContext.source}`);
  }

  if (outcome === 'completed' && details.prUrl) {
    parts.push(`**PR Created:** ${details.prUrl}`);
    if (details.merged) {
      parts.push(`**Status:** PR Merged Successfully`);
    }
  }

  if (outcome === 'failed' && details.error) {
    parts.push(`**Error:** ${details.error}`);
  }

  if (details.learnings) {
    parts.push(`**Learnings:** ${details.learnings}`);
  }

  return parts.join('\n');
}

/**
 * Recall relevant context before starting a new Jules session
 * @param {string} task - Task description/prompt
 * @param {string} repository - Repository identifier
 * @returns {Promise<Object>} - Relevant memories
 */
export async function recallContextForTask(task, repository) {
  const context = [];

  // Add repository as context if available
  if (repository) {
    const repoTag = repository.replace('sources/github/', '');
    context.push(`repository: ${repoTag}`);
  }

  const result = await callMemoryTool('recall_context', {
    task,
    context,
    limit: 5,
    minScore: 0.3,
  });

  if (result.success && result.result?.memories?.length > 0) {
    console.log(`[Memory] Found ${result.result.memories.length} relevant memories for task`);
    return {
      success: true,
      memories: result.result.memories,
      suggestions: buildContextSuggestions(result.result.memories),
    };
  }

  return { success: true, memories: [], suggestions: null };
}

/**
 * Build suggestions from recalled memories
 */
function buildContextSuggestions(memories) {
  if (!memories || memories.length === 0) return null;

  const parts = ['## Previous Context'];

  for (const memory of memories.slice(0, 3)) {
    parts.push(`- ${memory.summary || memory.content.slice(0, 100)}`);
    if (memory.tags?.includes('failed')) {
      parts.push(`  (Previous attempt failed - consider different approach)`);
    }
  }

  return parts.join('\n');
}

/**
 * Reinforce a memory when a pattern proves successful
 * @param {string} memoryId - UUID of memory to reinforce
 * @param {number} boost - Importance boost (0-0.5)
 * @returns {Promise<Object>}
 */
export async function reinforceSuccessfulPattern(memoryId, boost = 0.15) {
  return await callMemoryTool('reinforce', {
    memoryId,
    boost,
  });
}

/**
 * Search memories for similar past sessions
 * @param {string} query - Search query
 * @param {string[]} tags - Filter tags
 * @returns {Promise<Object>}
 */
export async function searchSessionMemories(query, tags = ['jules-session']) {
  return await callMemoryTool('search_memory', {
    query,
    tags,
    limit: 10,
    minScore: 0.4,
  });
}

/**
 * Apply memory decay to old, low-importance memories
 * Used by scheduled maintenance tasks
 * @param {number} olderThanDays - Age threshold
 * @param {number} belowImportance - Importance threshold
 * @returns {Promise<Object>}
 */
export async function decayOldMemories(olderThanDays = 60, belowImportance = 0.3) {
  return await callMemoryTool('forget', {
    olderThanDays,
    belowImportance,
    soft: true,
    decayFactor: 0.5, // Reduce importance by 50%
  });
}

/**
 * Get memory maintenance configuration for temporal-agent-mcp
 * @returns {Object} - Scheduled task configurations
 */
export function getMemoryMaintenanceSchedule() {
  return {
    dailyDecay: {
      name: 'memory-daily-decay',
      description: 'Apply decay to old low-importance memories',
      schedule: '0 3 * * *', // 3 AM daily
      action: {
        type: 'http',
        url: `${SEMANTIC_MEMORY_URL}/mcp/execute`,
        method: 'POST',
        body: {
          tool: 'forget',
          parameters: {
            olderThanDays: 60,
            belowImportance: 0.2,
            soft: true,
            decayFactor: 0.7,
          },
        },
      },
    },
    weeklyCleanup: {
      name: 'memory-weekly-cleanup',
      description: 'Clean up very low importance memories',
      schedule: '0 4 * * 0', // 4 AM Sunday
      action: {
        type: 'http',
        url: `${SEMANTIC_MEMORY_URL}/mcp/execute`,
        method: 'POST',
        body: {
          tool: 'forget',
          parameters: {
            olderThanDays: 90,
            belowImportance: 0.1,
            soft: true,
            decayFactor: 0.3,
          },
        },
      },
    },
  };
}

/**
 * Check if semantic memory service is available
 * @returns {Promise<boolean>}
 */
export async function checkMemoryHealth() {
  try {
    const response = await fetch(`${SEMANTIC_MEMORY_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const health = await response.json();
      return health.status === 'healthy' || health.status === 'degraded';
    }
    return false;
  } catch (error) {
    console.warn('[Memory] Health check failed:', error.message);
    return false;
  }
}

export default {
  storeSessionOutcome,
  recallContextForTask,
  reinforceSuccessfulPattern,
  searchSessionMemories,
  decayOldMemories,
  getMemoryMaintenanceSchedule,
  checkMemoryHealth,
};
