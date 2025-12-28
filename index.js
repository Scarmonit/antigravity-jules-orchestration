import express from 'express';
import dotenv from 'dotenv';
import https from 'https';
import { getIssue, getIssuesByLabel, formatIssueForPrompt } from './lib/github.js';
import { BatchProcessor } from './lib/batch.js';
import { SessionMonitor } from './lib/monitor.js';
import { ollamaCompletion, listOllamaModels, ollamaCodeGeneration, ollamaChat } from './lib/ollama.js';
import { ragIndexDirectory, ragQuery, ragStatus, ragClear } from './lib/rag.js';
import {
  storeSessionOutcome,
  recallContextForTask,
  reinforceSuccessfulPattern,
  checkMemoryHealth,
  getMemoryMaintenanceSchedule,
  searchSessionMemories,
  getRelatedMemories,
  decayOldMemories,
} from './lib/memory-client.js';
import {
  isConfigured as isRenderConfigured,
  connect as renderConnect,
  disconnect as renderDisconnect,
  listServices as renderListServices,
  listDeploys as renderListDeploys,
  getBuildLogs as renderGetBuildLogs,
  getLatestFailedDeploy as renderGetLatestFailedDeploy,
  analyzeErrors as renderAnalyzeErrors,
} from './lib/render-client.js';
import {
  handleWebhook as handleRenderWebhook,
  getAutoFixStatus as getRenderAutoFixStatus,
  setAutoFixEnabled as setRenderAutoFixEnabled,
  addMonitoredService as addRenderMonitoredService,
  removeMonitoredService as removeRenderMonitoredService,
  startAutoFix as startRenderAutoFix,
  startCleanupInterval as startRenderCleanupInterval,
} from './lib/render-autofix.js';
import {
  getSuggestedTasks,
  clearCache as clearSuggestedTasksCache,
  generateFixPrompt as generateSuggestedTaskFixPrompt,
} from './lib/suggested-tasks.js';
import compressionMiddleware from './middleware/compressionMiddleware.js';
import validateRequest from './middleware/validateRequest.js';
import mcpExecuteSchema from './schemas/mcp-execute-schema.js';
import sessionCreateSchema from './schemas/session-create-schema.js';
import { cacheMiddleware, invalidateCaches } from './middleware/cacheMiddleware.js';

dotenv.config();

// HTTP Agent with connection pooling for Jules API
const julesAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5
});

const PORT = process.env.PORT || 3323;
const JULES_API_KEY = process.env.JULES_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;
const VERSION = '2.6.0';

// ============ v2.5.0 INFRASTRUCTURE ============

// LRU Cache with TTL for API response caching
class LRUCache {
  constructor(maxSize = 100, defaultTTL = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) { this.cache.delete(key); return null; }
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }
  set(key, value, ttl = this.defaultTTL) {
    // Fix: only evict if key doesn't already exist
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expires: Date.now() + ttl });
  }
  invalidate(pattern) { for (const key of this.cache.keys()) { if (key.includes(pattern)) this.cache.delete(key); } }
  clear() { this.cache.clear(); }
  stats() { return { size: this.cache.size, maxSize: this.maxSize }; }
}

// Session Queue with Priority
class SessionQueue {
  constructor(maxRetained = 100) { this.queue = []; this.processing = false; this.maxRetained = maxRetained; }
  add(config, priority = 5) {
    const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const item = { id, config, priority, addedAt: new Date().toISOString(), status: 'pending' };
    this.queue.push(item);
    this.queue.sort((a, b) => a.priority - b.priority);
    this._cleanup(); // Clean old completed/failed items
    return item;
  }
  remove(id) { const idx = this.queue.findIndex(i => i.id === id); return idx >= 0 ? this.queue.splice(idx, 1)[0] : null; }
  getNext() { return this.queue.find(i => i.status === 'pending'); }
  markProcessing(id) { const item = this.queue.find(i => i.id === id); if (item) item.status = 'processing'; }
  markComplete(id, sessionId) { const item = this.queue.find(i => i.id === id); if (item) { item.status = 'completed'; item.sessionId = sessionId; item.completedAt = new Date().toISOString(); } this._cleanup(); }
  markFailed(id, error) { const item = this.queue.find(i => i.id === id); if (item) { item.status = 'failed'; item.error = error; item.failedAt = new Date().toISOString(); } this._cleanup(); }
  list() { return this.queue.map(i => ({ id: i.id, title: i.config.title || 'Untitled', priority: i.priority, status: i.status, addedAt: i.addedAt, sessionId: i.sessionId })); }
  stats() { return { total: this.queue.length, pending: this.queue.filter(i => i.status === 'pending').length, processing: this.queue.filter(i => i.status === 'processing').length, completed: this.queue.filter(i => i.status === 'completed').length, failed: this.queue.filter(i => i.status === 'failed').length }; }
  clear() { const cleared = this.queue.filter(i => i.status === 'pending').length; this.queue = this.queue.filter(i => i.status !== 'pending'); return cleared; }
  // Fix memory leak: remove old completed/failed items, keep only maxRetained
  _cleanup() {
    const terminal = this.queue.filter(i => i.status === 'completed' || i.status === 'failed');
    if (terminal.length > this.maxRetained) {
      const toRemove = terminal.slice(0, terminal.length - this.maxRetained);
      toRemove.forEach(item => { const idx = this.queue.indexOf(item); if (idx >= 0) this.queue.splice(idx, 1); });
    }
  }
}

const apiCache = new LRUCache(100, 10000);
const sessionQueue = new SessionQueue();
const sessionTemplates = new Map();

// Structured Logging
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];
function structuredLog(level, message, context = {}) {
  if (LOG_LEVELS[level] > currentLogLevel) return;
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context, correlationId: context.correlationId || 'system' }));
}

// Retry with Exponential Backoff
async function retryWithBackoff(fn, options = {}) {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, correlationId } = options;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (error) {
      lastError = error;
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) throw error;
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000, maxDelay);
        structuredLog('warn', `Retry attempt ${attempt}/${maxRetries}`, { correlationId, delay: Math.round(delay), error: error.message });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

const app = express();
app.use(compressionMiddleware());
app.use(cacheMiddleware);
// Preserve raw body for webhook signature verification
app.use(express.json({
  limit: '1mb',
  strict: true,
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification
    if (req.url.startsWith('/webhooks/')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));

// Circuit Breaker for Jules API
const circuitBreaker = {
  failures: 0,
  lastFailure: null,
  threshold: 5,        // Trip after 5 consecutive failures
  resetTimeout: 60000, // Reset after 1 minute
  isOpen() {
    if (this.failures >= this.threshold) {
      const timeSinceFailure = Date.now() - this.lastFailure;
      if (timeSinceFailure < this.resetTimeout) {
        return true; // Circuit is open, reject requests
      }
      this.failures = 0; // Reset after timeout
    }
    return false;
  },
  recordSuccess() {
    this.failures = 0;
  },
  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
  }
};

// Rate limiting - Simple in-memory implementation
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

app.use('/mcp/', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }

  const requests = rateLimitStore.get(ip).filter(time => time > windowStart);
  requests.push(now);
  rateLimitStore.set(ip, requests);

  if (requests.length > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
      hint: 'Please wait before making more requests'
    });
  }

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX - requests.length);
  next();
});

// Initialize modules
let batchProcessor = null;
let sessionMonitor = null;

// CORS - Secure whitelist configuration
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,https://antigravity-jules-orchestration.onrender.com').split(',');

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Request-ID, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Root endpoint - service metadata
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Jules MCP Server',
    version: VERSION,
    timestamp: new Date().toISOString(),
    capabilities: ['sessions', 'tasks', 'orchestration', 'mcp-protocol', 'sources', 'batch', 'monitor', 'github', 'qwen'],
    authMethod: 'api-key',
    endpoints: {
      health: '/health',
      tools: '/mcp/tools',
      execute: '/mcp/execute',
      monitor: '/api/sessions/active',
      stats: '/api/sessions/stats'
    }
  });
});

// Health check endpoint (required by Render)
app.get(['/health', '/api/v1/health'], async (req, res) => {
  const health = {
    status: 'ok',
    version: VERSION,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    },
    services: {
      julesApi: 'unknown',
      database: process.env.DATABASE_URL ? 'configured' : 'not_configured',
      github: GITHUB_TOKEN ? 'configured' : 'not_configured',
      semanticMemory: process.env.SEMANTIC_MEMORY_URL ? 'configured' : 'not_configured'
    },
    circuitBreaker: {
      failures: circuitBreaker.failures,
      isOpen: circuitBreaker.isOpen()
    }
  };

  // Quick test Jules API if configured
  if (JULES_API_KEY) {
    try {
      health.services.julesApi = circuitBreaker.isOpen() ? 'circuit_open' : 'configured';
    } catch (e) {
      health.services.julesApi = 'error';
    }
  } else {
    health.services.julesApi = 'not_configured';
  }

  const allHealthy = health.services.julesApi !== 'error' && !circuitBreaker.isOpen();
  health.status = allHealthy ? 'ok' : 'degraded';

  res.status(allHealthy ? 200 : 503).json(health);
});

// ============ NEW API ENDPOINTS ============

// Get active sessions
app.get('/api/sessions/active', cacheMiddleware, async (req, res) => {
  try {
    if (!sessionMonitor) {
      return res.status(503).json({ error: 'Monitor not initialized' });
    }
    const active = await sessionMonitor.getActiveSessions();
    res.json({ sessions: active, count: active.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session statistics
app.get('/api/sessions/stats', cacheMiddleware, async (req, res) => {
  try {
    if (!sessionMonitor) {
      return res.status(503).json({ error: 'Monitor not initialized' });
    }
    const stats = await sessionMonitor.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session timeline
app.get('/api/sessions/:id/timeline', async (req, res) => {
  try {
    if (!sessionMonitor) {
      return res.status(503).json({ error: 'Monitor not initialized' });
    }
    const timeline = await sessionMonitor.getSessionTimeline(req.params.id);
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WEBHOOKS ============

// Render webhook for build failure auto-fix
app.post('/webhooks/render', async (req, res) => {
  console.log('[Webhook] Received Render webhook');

  try {
    const result = await handleRenderWebhook(
      req,
      createJulesSession,
      (sessionId, msg) => julesRequest('POST', `/sessions/${sessionId}:sendMessage`, msg)
    );

    res.status(result.status || 200).json(result);
  } catch (error) {
    console.error('[Webhook] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ MCP TOOLS ============

// MCP Protocol - List available tools
app.get('/mcp/tools', cacheMiddleware, (req, res) => {
  res.json({
    tools: [
      // Original tools
      {
        name: 'jules_list_sources',
        description: 'List all connected GitHub repositories (sources)',
        parameters: {}
      },
      {
        name: 'jules_create_session',
        description: 'Create a new Jules coding session for autonomous development',
        parameters: {
          prompt: { type: 'string', required: true, description: 'Task description/prompt for Jules' },
          source: { type: 'string', required: true, description: 'Source name (e.g., sources/github/owner/repo)' },
          branch: { type: 'string', required: false, description: 'Starting branch (default: repo default)' },
          title: { type: 'string', required: false, description: 'Session title' },
          requirePlanApproval: { type: 'boolean', required: false, description: 'Require approval before execution' },
          automationMode: { type: 'string', required: false, description: 'AUTO_CREATE_PR or NONE' }
        }
      },
      {
        name: 'jules_list_sessions',
        description: 'List all Jules sessions',
        parameters: {}
      },
      {
        name: 'jules_get_session',
        description: 'Get details of a specific session',
        parameters: {
          sessionId: { type: 'string', required: true, description: 'Session ID to retrieve' }
        }
      },
      {
        name: 'jules_send_message',
        description: 'Send a message to an existing Jules session',
        parameters: {
          sessionId: { type: 'string', required: true, description: 'Session ID' },
          message: { type: 'string', required: true, description: 'Message to send' }
        }
      },
      {
        name: 'jules_approve_plan',
        description: 'Approve a session plan to allow execution',
        parameters: {
          sessionId: { type: 'string', required: true, description: 'Session ID to approve' }
        }
      },
      {
        name: 'jules_get_activities',
        description: 'Get activities/events for a session',
        parameters: {
          sessionId: { type: 'string', required: true, description: 'Session ID' }
        }
      },
      // NEW: GitHub Issue Integration
      {
        name: 'jules_create_from_issue',
        description: 'Create a Jules session from a GitHub issue with full context',
        parameters: {
          owner: { type: 'string', required: true, description: 'GitHub repository owner' },
          repo: { type: 'string', required: true, description: 'GitHub repository name' },
          issueNumber: { type: 'number', required: true, description: 'Issue number to process' },
          autoApprove: { type: 'boolean', required: false, description: 'Auto-approve plan (default: false)' },
          automationMode: { type: 'string', required: false, description: 'AUTO_CREATE_PR or NONE' }
        }
      },
      {
        name: 'jules_batch_from_labels',
        description: 'Create sessions for all GitHub issues with a specific label',
        parameters: {
          owner: { type: 'string', required: true, description: 'GitHub repository owner' },
          repo: { type: 'string', required: true, description: 'GitHub repository name' },
          label: { type: 'string', required: true, description: 'Label to filter issues (e.g., "jules-auto")' },
          autoApprove: { type: 'boolean', required: false, description: 'Auto-approve all plans' },
          parallel: { type: 'number', required: false, description: 'Max parallel sessions (default: 3)' }
        }
      },
      // NEW: Batch Processing
      {
        name: 'jules_batch_create',
        description: 'Create multiple Jules sessions in parallel from a task array',
        parameters: {
          tasks: { type: 'array', required: true, description: 'Array of session configs (each with prompt, source, title)' },
          parallel: { type: 'number', required: false, description: 'Max parallel sessions (default: 3)' }
        }
      },
      {
        name: 'jules_batch_status',
        description: 'Get status of all sessions in a batch',
        parameters: {
          batchId: { type: 'string', required: true, description: 'Batch ID from jules_batch_create' }
        }
      },
      {
        name: 'jules_batch_approve_all',
        description: 'Approve all pending plans in a batch',
        parameters: {
          batchId: { type: 'string', required: true, description: 'Batch ID to approve' }
        }
      },
      // NEW: Monitoring
      {
        name: 'jules_monitor_all',
        description: 'Get real-time status of all active sessions with statistics',
        parameters: {}
      },
      {
        name: 'jules_session_timeline',
        description: 'Get detailed activity timeline for a session',
        parameters: {
          sessionId: { type: 'string', required: true, description: 'Session ID' }
        }
      },
      // NEW: Ollama Local LLM Integration
      {
        name: 'ollama_list_models',
        description: 'List available local Ollama models',
        parameters: {}
      },
      {
        name: 'ollama_completion',
        description: 'Generate text using local Ollama models',
        parameters: {
          prompt: { type: 'string', required: true, description: 'Text prompt' },
          model: { type: 'string', required: false, description: 'Model name (default: qwen2.5-coder:7b)' },
          systemPrompt: { type: 'string', required: false, description: 'System prompt' }
        }
      },
      {
        name: 'ollama_code_generation',
        description: 'Generate code using local Qwen2.5-Coder model',
        parameters: {
          task: { type: 'string', required: true, description: 'Code generation task' },
          language: { type: 'string', required: false, description: 'Programming language (default: javascript)' },
          context: { type: 'string', required: false, description: 'Additional context' }
        }
      },
      {
        name: 'ollama_chat',
        description: 'Multi-turn chat with local Ollama model',
        parameters: {
          messages: { type: 'array', required: true, description: 'Array of {role, content} messages' },
          model: { type: 'string', required: false, description: 'Model name (default: qwen2.5-coder:7b)' }
        }
      },
      // NEW: RAG (Retrieval-Augmented Generation)
      {
        name: 'ollama_rag_index',
        description: 'Index a directory for RAG-powered codebase queries',
        parameters: {
          directory: { type: 'string', required: true, description: 'Directory path to index' },
          maxFiles: { type: 'number', required: false, description: 'Max files to index (default: 100)' }
        }
      },
      {
        name: 'ollama_rag_query',
        description: 'Query the indexed codebase with context-aware LLM responses',
        parameters: {
          query: { type: 'string', required: true, description: 'Question about the codebase' },
          model: { type: 'string', required: false, description: 'Model to use (default: qwen2.5-coder:7b)' },
          topK: { type: 'number', required: false, description: 'Number of context chunks (default: 5)' }
        }
      },
      {
        name: 'ollama_rag_status',
        description: 'Get RAG index status and indexed files',
        parameters: {}
      },
      {
        name: 'ollama_rag_clear',
        description: 'Clear the RAG index',
        parameters: {}
      },
      // v2.5.0: Session Management
      { name: 'jules_cancel_session', description: 'Cancel/abort an active session', parameters: { sessionId: { type: 'string', required: true } } },
      { name: 'jules_retry_session', description: 'Retry a failed session', parameters: { sessionId: { type: 'string', required: true }, modifiedPrompt: { type: 'string', required: false } } },
      { name: 'jules_get_diff', description: 'Get code changes from session', parameters: { sessionId: { type: 'string', required: true } } },
      { name: 'jules_list_batches', description: 'List all batch operations', parameters: {} },
      { name: 'jules_delete_session', description: 'Delete a session', parameters: { sessionId: { type: 'string', required: true } } },
      { name: 'jules_cache_stats', description: 'Get cache statistics', parameters: {} },
      { name: 'jules_clear_cache', description: 'Clear API cache', parameters: {} },
      { name: 'jules_cancel_all_active', description: 'Cancel all active sessions', parameters: { confirm: { type: 'boolean', required: true } } },
      // v2.5.0: Session Templates
      { name: 'jules_create_template', description: 'Save session config as template', parameters: { name: { type: 'string', required: true }, description: { type: 'string' }, config: { type: 'object', required: true } } },
      { name: 'jules_list_templates', description: 'List saved templates', parameters: {} },
      { name: 'jules_create_from_template', description: 'Create session from template', parameters: { templateName: { type: 'string', required: true }, overrides: { type: 'object' } } },
      { name: 'jules_delete_template', description: 'Delete a template', parameters: { name: { type: 'string', required: true } } },
      // v2.5.0: Session Cloning & Search
      { name: 'jules_clone_session', description: 'Clone a session config', parameters: { sessionId: { type: 'string', required: true }, modifiedPrompt: { type: 'string' }, newTitle: { type: 'string' } } },
      { name: 'jules_search_sessions', description: 'Search sessions with filters', parameters: { query: { type: 'string' }, state: { type: 'string' }, limit: { type: 'number' } } },
      // v2.5.0: PR Integration
      { name: 'jules_get_pr_status', description: 'Get PR status from session', parameters: { sessionId: { type: 'string', required: true } } },
      { name: 'jules_merge_pr', description: 'Merge a PR', parameters: { owner: { type: 'string', required: true }, repo: { type: 'string', required: true }, prNumber: { type: 'number', required: true }, mergeMethod: { type: 'string' } } },
      { name: 'jules_add_pr_comment', description: 'Add comment to PR', parameters: { owner: { type: 'string', required: true }, repo: { type: 'string', required: true }, prNumber: { type: 'number', required: true }, comment: { type: 'string', required: true } } },
      // v2.5.0: Session Queue
      { name: 'jules_queue_session', description: 'Queue session with priority', parameters: { config: { type: 'object', required: true }, priority: { type: 'number' } } },
      { name: 'jules_get_queue', description: 'Get queue status', parameters: {} },
      { name: 'jules_process_queue', description: 'Process next queued item', parameters: {} },
      { name: 'jules_clear_queue', description: 'Clear queue', parameters: {} },
      // v2.5.0: Analytics
      { name: 'jules_batch_retry_failed', description: 'Retry failed sessions in batch', parameters: { batchId: { type: 'string', required: true } } },
      { name: 'jules_get_analytics', description: 'Get session analytics', parameters: { days: { type: 'number' } } },
      // Semantic Memory Integration (v2.5.2)
      { name: 'memory_recall_context', description: 'Recall relevant memories for a task', parameters: { task: { type: 'string', required: true }, repository: { type: 'string' }, limit: { type: 'number' } } },
      { name: 'memory_store', description: 'Store a memory manually', parameters: { content: { type: 'string', required: true }, summary: { type: 'string' }, tags: { type: 'array' }, importance: { type: 'number' } } },
      { name: 'memory_search', description: 'Search memories by query', parameters: { query: { type: 'string', required: true }, tags: { type: 'array' }, limit: { type: 'number' } } },
      { name: 'memory_related', description: 'Get memories related to a specific memory', parameters: { memoryId: { type: 'string', required: true }, limit: { type: 'number' } } },
      { name: 'memory_reinforce', description: 'Reinforce a memory when a pattern proves successful', parameters: { memoryId: { type: 'string', required: true }, boost: { type: 'number' } } },
      { name: 'memory_forget', description: 'Apply decay to old memories or remove them', parameters: { olderThanDays: { type: 'number' }, belowImportance: { type: 'number' }, soft: { type: 'boolean' }, decayFactor: { type: 'number' } } },
      { name: 'memory_health', description: 'Check semantic memory service health', parameters: {} },
      { name: 'memory_maintenance_schedule', description: 'Get memory maintenance schedule for temporal-agent-mcp', parameters: {} },
      // v2.6.0: Render Integration (Auto-Fix)
      { name: 'render_connect', description: 'Connect Render integration by storing API key', parameters: { apiKey: { type: 'string', required: true, description: 'Render API key (starts with rnd_)' }, webhookSecret: { type: 'string', required: false, description: 'Webhook secret for signature verification' } } },
      { name: 'render_disconnect', description: 'Disconnect Render integration', parameters: {} },
      { name: 'render_status', description: 'Check Render integration status', parameters: {} },
      { name: 'render_list_services', description: 'List all Render services', parameters: {} },
      { name: 'render_list_deploys', description: 'List deploys for a service', parameters: { serviceId: { type: 'string', required: true, description: 'Service ID (srv-xxx)' }, limit: { type: 'number', required: false } } },
      { name: 'render_get_build_logs', description: 'Get build logs for a deploy', parameters: { serviceId: { type: 'string', required: true }, deployId: { type: 'string', required: true } } },
      { name: 'render_analyze_failure', description: 'Analyze a build failure and get fix suggestions', parameters: { serviceId: { type: 'string', required: true } } },
      { name: 'render_autofix_status', description: 'Get auto-fix status and active operations', parameters: {} },
      { name: 'render_set_autofix', description: 'Enable or disable auto-fix for Jules PRs', parameters: { enabled: { type: 'boolean', required: true } } },
      { name: 'render_add_monitored_service', description: 'Add a service to auto-fix monitoring', parameters: { serviceId: { type: 'string', required: true } } },
      { name: 'render_remove_monitored_service', description: 'Remove a service from auto-fix monitoring', parameters: { serviceId: { type: 'string', required: true } } },
      { name: 'render_trigger_autofix', description: 'Manually trigger auto-fix for a failed deploy', parameters: { serviceId: { type: 'string', required: true }, deployId: { type: 'string', required: true } } },
      // v2.6.0: Suggested Tasks
      { name: 'jules_suggested_tasks', description: 'Scan codebase for TODO/FIXME/HACK comments and suggest tasks for Jules', parameters: { directory: { type: 'string', required: true, description: 'Directory to scan' }, types: { type: 'array', required: false, description: 'Filter by comment types (todo, fixme, hack, bug, etc.)' }, minPriority: { type: 'number', required: false, description: 'Minimum priority threshold (1-10)' }, limit: { type: 'number', required: false, description: 'Max tasks to return (default: 20)' }, includeGitInfo: { type: 'boolean', required: false, description: 'Include git blame info for each task' } } },
      { name: 'jules_fix_suggested_task', description: 'Create a Jules session to fix a suggested task', parameters: { directory: { type: 'string', required: true }, taskIndex: { type: 'number', required: true, description: 'Index of task from jules_suggested_tasks result' }, source: { type: 'string', required: true, description: 'GitHub source (sources/github/owner/repo)' } } },
      { name: 'jules_clear_suggested_cache', description: 'Clear suggested tasks cache', parameters: {} }
    ]
  });
});

// O(1) Tool Registry - Map-based lookup replaces O(n) switch statement
// Performance: O(1) lookup vs O(n) switch comparison
const toolRegistry = new Map();

// Register tools lazily (handlers reference functions defined later)
function initializeToolRegistry() {
  // Jules API tools
  toolRegistry.set('jules_list_sources', (p) => julesRequest('GET', '/sources'));
  toolRegistry.set('jules_create_session', (p) => createJulesSession(p));
  toolRegistry.set('jules_list_sessions', (p) => julesRequest('GET', '/sessions'));
  toolRegistry.set('jules_get_session', (p) => julesRequest('GET', '/sessions/' + p.sessionId));
  toolRegistry.set('jules_send_message', async (p) => {
    const result = await julesRequest('POST', '/sessions/' + p.sessionId + ':sendMessage', { message: p.message });
    invalidateCaches();
    return result;
  });
  toolRegistry.set('jules_approve_plan', async (p) => {
    const result = await julesRequest('POST', '/sessions/' + p.sessionId + ':approvePlan', {});
    invalidateCaches();
    return result;
  });
  toolRegistry.set('jules_get_activities', (p) => julesRequest('GET', '/sessions/' + p.sessionId + '/activities'));

  // GitHub Issue Integration
  toolRegistry.set('jules_create_from_issue', (p) => createSessionFromIssue(p));
  toolRegistry.set('jules_batch_from_labels', (p) => createSessionsFromLabel(p));

  // Batch Processing
  toolRegistry.set('jules_batch_create', (p) => batchProcessor.createBatch(p.tasks, { parallel: p.parallel }));
  toolRegistry.set('jules_batch_status', (p) => batchProcessor.getBatchStatus(p.batchId));
  toolRegistry.set('jules_batch_approve_all', (p) => batchProcessor.approveAllInBatch(p.batchId));

  // Monitoring
  toolRegistry.set('jules_monitor_all', (p) => sessionMonitor.monitorAll());
  toolRegistry.set('jules_session_timeline', (p) => sessionMonitor.getSessionTimeline(p.sessionId));

  // Ollama Local LLM
  toolRegistry.set('ollama_list_models', (p) => listOllamaModels());
  toolRegistry.set('ollama_completion', (p) => ollamaCompletion(p));
  toolRegistry.set('ollama_code_generation', (p) => ollamaCodeGeneration(p));
  toolRegistry.set('ollama_chat', (p) => ollamaChat(p));

  // RAG Tools
  toolRegistry.set('ollama_rag_index', (p) => ragIndexDirectory(p));
  toolRegistry.set('ollama_rag_query', (p) => ragQuery(p));
  toolRegistry.set('ollama_rag_status', (p) => ragStatus());
  toolRegistry.set('ollama_rag_clear', (p) => ragClear());

  // v2.5.0: Session Management
  toolRegistry.set('jules_cancel_session', (p) => cancelSession(p.sessionId));
  toolRegistry.set('jules_retry_session', (p) => retrySession(p.sessionId, p.modifiedPrompt));
  toolRegistry.set('jules_get_diff', (p) => getSessionDiff(p.sessionId));
  toolRegistry.set('jules_list_batches', () => batchProcessor.listBatches());
  toolRegistry.set('jules_delete_session', (p) => deleteSession(p.sessionId));
  toolRegistry.set('jules_clear_cache', () => { apiCache.clear(); return { success: true, message: 'Cache cleared' }; });
  toolRegistry.set('jules_cache_stats', () => ({ ...apiCache.stats(), circuitBreaker: { failures: circuitBreaker.failures, isOpen: circuitBreaker.isOpen() } }));
  toolRegistry.set('jules_cancel_all_active', (p) => cancelAllActiveSessions(p.confirm));

  // v2.5.0: Session Templates
  toolRegistry.set('jules_create_template', (p) => createTemplate(p.name, p.description, p.config));
  toolRegistry.set('jules_list_templates', () => listTemplates());
  toolRegistry.set('jules_create_from_template', (p) => createFromTemplate(p.templateName, p.overrides));
  toolRegistry.set('jules_delete_template', (p) => deleteTemplate(p.name));

  // v2.5.0: Session Cloning & Search
  toolRegistry.set('jules_clone_session', (p) => cloneSession(p.sessionId, p.modifiedPrompt, p.newTitle));
  toolRegistry.set('jules_search_sessions', (p) => searchSessions(p.query, p.state, p.limit));

  // v2.5.0: PR Integration
  toolRegistry.set('jules_get_pr_status', (p) => getPrStatus(p.sessionId));
  toolRegistry.set('jules_merge_pr', (p) => mergePr(p.owner, p.repo, p.prNumber, p.mergeMethod));
  toolRegistry.set('jules_add_pr_comment', (p) => addPrComment(p.owner, p.repo, p.prNumber, p.comment));

  // v2.5.0: Session Queue
  toolRegistry.set('jules_queue_session', (p) => ({ success: true, item: sessionQueue.add(p.config, p.priority) }));
  toolRegistry.set('jules_get_queue', () => ({ queue: sessionQueue.list(), stats: sessionQueue.stats() }));
  toolRegistry.set('jules_process_queue', () => processQueue());
  toolRegistry.set('jules_clear_queue', () => ({ success: true, cleared: sessionQueue.clear() }));

  // v2.5.0: Batch Retry & Analytics
  toolRegistry.set('jules_batch_retry_failed', (p) => batchRetryFailed(p.batchId));
  toolRegistry.set('jules_get_analytics', (p) => getAnalytics(p.days));

  // v2.5.2: Semantic Memory Integration
  toolRegistry.set('memory_recall_context', (p) => recallContextForTask(p.task, p.repository));
  toolRegistry.set('memory_store', (p) => storeManualMemory(p));
  toolRegistry.set('memory_search', (p) => searchMemories(p));
  toolRegistry.set('memory_related', (p) => getRelatedMemories(p.memoryId, p.limit));
  toolRegistry.set('memory_reinforce', (p) => reinforceSuccessfulPattern(p.memoryId, p.boost));
  toolRegistry.set('memory_forget', (p) => decayOldMemories(p.olderThanDays, p.belowImportance));
  toolRegistry.set('memory_health', () => checkMemoryHealth().then(healthy => ({ healthy, url: process.env.SEMANTIC_MEMORY_URL || 'not configured' })));
  toolRegistry.set('memory_maintenance_schedule', () => getMemoryMaintenanceSchedule());

  // v2.6.0: Render Integration for Auto-Fix
  toolRegistry.set('render_connect', (p) => renderConnect(p.apiKey, p.webhookSecret));
  toolRegistry.set('render_disconnect', () => renderDisconnect());
  toolRegistry.set('render_status', () => ({ configured: isRenderConfigured(), autoFix: getRenderAutoFixStatus() }));
  toolRegistry.set('render_list_services', () => renderListServices());
  toolRegistry.set('render_list_deploys', (p) => renderListDeploys(p.serviceId, p.limit));
  toolRegistry.set('render_get_build_logs', (p) => renderGetBuildLogs(p.serviceId, p.deployId));
  toolRegistry.set('render_analyze_failure', async (p) => {
    const failure = await renderGetLatestFailedDeploy(p.serviceId);
    if (!failure.found) return failure;
    return renderAnalyzeErrors(failure.logs);
  });
  toolRegistry.set('render_autofix_status', () => getRenderAutoFixStatus());
  toolRegistry.set('render_set_autofix', (p) => setRenderAutoFixEnabled(p.enabled));
  toolRegistry.set('render_add_monitored_service', (p) => addRenderMonitoredService(p.serviceId));
  toolRegistry.set('render_remove_monitored_service', (p) => removeRenderMonitoredService(p.serviceId));
  toolRegistry.set('render_trigger_autofix', async (p) => {
    // Manual trigger for auto-fix on a specific service
    const failure = await renderGetLatestFailedDeploy(p.serviceId);
    if (!failure.found) return { success: false, message: 'No recent failed deploy found' };
    return startRenderAutoFix(
      { serviceId: p.serviceId, deployId: failure.deploy.id, branch: failure.branch },
      createJulesSession,
      (sessionId, msg) => julesRequest('POST', `/sessions/${sessionId}:sendMessage`, msg)
    );
  });

  // v2.6.0: Suggested Tasks
  toolRegistry.set('jules_suggested_tasks', (p) => getSuggestedTasks(p.directory, {
    types: p.types,
    minPriority: p.minPriority,
    limit: p.limit,
    includeGitInfo: p.includeGitInfo
  }));
  toolRegistry.set('jules_fix_suggested_task', async (p) => {
    // Get suggested tasks and find the one at the specified index
    const result = getSuggestedTasks(p.directory, { limit: 100 });
    if (p.taskIndex < 0 || p.taskIndex >= result.tasks.length) {
      return { success: false, error: `Invalid task index: ${p.taskIndex}. Found ${result.tasks.length} tasks.` };
    }
    const task = result.tasks[p.taskIndex];
    const prompt = generateSuggestedTaskFixPrompt(task, p.directory);
    return createJulesSession({
      prompt,
      source: p.source,
      title: `Fix ${task.type}: ${task.text.substring(0, 50)}...`,
      automationMode: 'AUTO_CREATE_PR'
    });
  });
  toolRegistry.set('jules_clear_suggested_cache', () => clearSuggestedTasksCache());
}

// MCP Protocol - Execute tool with O(1) registry lookup
app.post('/mcp/execute', validateRequest(mcpExecuteSchema), async (req, res) => {
  const { tool, parameters = {} } = req.body;

  if (!tool) {
    return res.status(400).json({ error: 'Tool name required' });
  }

  if (!JULES_API_KEY) {
    return res.status(500).json({ error: 'JULES_API_KEY not configured' });
  }

  // O(1) lookup instead of O(n) switch comparison
  const handler = toolRegistry.get(tool);
  if (!handler) {
    return res.status(400).json({ error: 'Unknown tool: ' + tool });
  }

  console.log('[MCP] Executing tool:', tool, parameters);

  try {
    const result = await handler(parameters);
    console.log('[MCP] Tool', tool, 'completed successfully');
    res.json({ success: true, result });
  } catch (error) {
    console.error('[MCP] Tool', tool, 'failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ HELPER FUNCTIONS ============

// Jules API helper - make authenticated request with connection pooling
function julesRequest(method, path, body = null) {
  // Circuit breaker check
  if (circuitBreaker.isOpen()) {
    return Promise.reject(new Error('Circuit breaker is open - Jules API temporarily unavailable'));
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'jules.googleapis.com',
      port: 443,
      path: '/v1alpha' + path,
      method: method,
      agent: julesAgent, // Connection pooling for 25-30% latency reduction
      headers: {
        'X-Goog-Api-Key': JULES_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    console.log('[Jules API]', method, path);

    const req = https.request(options, (response) => {
      let data = '';
      const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB limit
      response.on('data', chunk => {
        data += chunk;
        if (data.length > MAX_RESPONSE_SIZE) {
          response.destroy();
          circuitBreaker.recordFailure();
          reject(new Error('Response too large (exceeded 10MB limit)'));
        }
      });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          circuitBreaker.recordSuccess();
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          circuitBreaker.recordFailure();
          console.error('[Jules API] Error', response.statusCode + ':', data);
          reject(new Error('Jules API error: ' + response.statusCode + ' - ' + data));
        }
      });
    });

    // 30 second timeout to prevent hanging requests
    req.setTimeout(30000, () => {
      req.destroy();
      circuitBreaker.recordFailure();
      reject(new Error('Request timeout after 30 seconds'));
    });

    req.on('error', (err) => {
      circuitBreaker.recordFailure();
      console.error('[Jules API] Request error:', err.message);
      reject(err);
    });

    if (body) {
      const jsonBody = JSON.stringify(body);
      req.setHeader('Content-Length', Buffer.byteLength(jsonBody));
      req.write(jsonBody);
    }
    req.end();
  });
}

// Create a new Jules session with correct API schema
async function createJulesSession(config) {
  const { error } = sessionCreateSchema.validate(config);
  if (error) {
    // Sanitize and format the error to be more user-friendly
    const errorMessage = error.details.map(d => d.message).join(', ');
    const validationError = new Error(`Invalid session configuration: ${errorMessage}`);
    validationError.statusCode = 400; // Bad Request
    throw validationError;
  }
  // Recall relevant context from semantic memory before creating session
  let memoryContext = null;
  if (process.env.SEMANTIC_MEMORY_URL && config.prompt) {
    try {
      const contextResult = await recallContextForTask(config.prompt, config.source);
      if (contextResult.success && contextResult.memories?.length > 0) {
        memoryContext = contextResult;
        structuredLog('info', 'Recalled memory context for session', {
          memoryCount: contextResult.memories.length,
          source: config.source
        });
      }
    } catch (err) {
      structuredLog('warn', 'Failed to recall memory context', { error: err.message });
    }
  }

  // Determine the starting branch - required by Jules API
  let startingBranch = config.branch;

  // If no branch specified, fetch the default branch from source info
  if (!startingBranch) {
    console.log('[Jules API] No branch specified, fetching default branch from source...');
    try {
      const sources = await julesRequest('GET', '/sources');
      const source = sources.sources?.find(s => s.name === config.source);
      if (source?.githubRepo?.defaultBranch?.displayName) {
        startingBranch = source.githubRepo.defaultBranch.displayName;
        console.log('[Jules API] Using default branch:', startingBranch);
      } else {
        // Fallback to common defaults
        startingBranch = 'main';
        console.log('[Jules API] No default branch found, using fallback:', startingBranch);
      }
    } catch (err) {
      console.error('[Jules API] Failed to fetch source info:', err.message);
      startingBranch = 'main';
    }
  }

  // Enhance prompt with memory context if available
  let enhancedPrompt = config.prompt;
  if (memoryContext?.suggestions) {
    enhancedPrompt = `${config.prompt}\n\n---\n${memoryContext.suggestions}`;
    structuredLog('info', 'Enhanced prompt with memory context');
  }

  const sessionData = {
    prompt: enhancedPrompt,
    sourceContext: {
      source: config.source,
      githubRepoContext: {
        startingBranch: startingBranch
      }
    }
  };

  // Add optional fields
  if (config.title) {
    sessionData.title = config.title;
  }
  if (config.requirePlanApproval !== undefined) {
    sessionData.requirePlanApproval = config.requirePlanApproval;
  }
  if (config.automationMode) {
    sessionData.automationMode = config.automationMode;
  }

  console.log('[Jules API] Creating session:', JSON.stringify(sessionData, null, 2));
  const session = await julesRequest('POST', '/sessions', sessionData);
  invalidateCaches();
  return session;
}

// Create session from GitHub issue
async function createSessionFromIssue(params) {
  const { owner, repo, issueNumber, autoApprove = false, automationMode = 'AUTO_CREATE_PR' } = params;

  console.log(`[GitHub] Fetching issue #${issueNumber} from ${owner}/${repo}`);

  // Fetch issue with context
  const issue = await getIssue(owner, repo, issueNumber, GITHUB_TOKEN);

  // Format prompt from issue
  const prompt = formatIssueForPrompt(issue);

  // Create session
  const session = await createJulesSession({
    prompt,
    source: `sources/github/${owner}/${repo}`,
    title: `Fix Issue #${issueNumber}: ${issue.title}`,
    requirePlanApproval: !autoApprove,
    automationMode
  });

  // Auto-approve if requested and session is in planning
  if (autoApprove && session.id) {
    console.log('[Jules] Auto-approving plan...');
    try {
      await julesRequest('POST', `/sessions/${session.id}:approvePlan`, {});
    } catch (e) {
      console.log('[Jules] Could not auto-approve (may not be ready yet):', e.message);
    }
  }

  return {
    session,
    issue: {
      number: issue.number,
      title: issue.title,
      url: issue.url
    }
  };
}

// Create sessions from all issues with a label
async function createSessionsFromLabel(params) {
  const { owner, repo, label, autoApprove = false, parallel = 3 } = params;

  console.log(`[GitHub] Fetching issues with label "${label}" from ${owner}/${repo}`);

  // Fetch all issues with label
  const issues = await getIssuesByLabel(owner, repo, label, GITHUB_TOKEN);

  if (issues.length === 0) {
    return { message: 'No issues found with label: ' + label, sessions: [] };
  }

  console.log(`[GitHub] Found ${issues.length} issues, creating sessions...`);

  // Create tasks for batch processor
  const tasks = issues.map(issue => ({
    prompt: formatIssueForPrompt(issue),
    source: `sources/github/${owner}/${repo}`,
    title: `Fix Issue #${issue.number}: ${issue.title}`,
    requirePlanApproval: !autoApprove,
    automationMode: 'AUTO_CREATE_PR'
  }));

  // Process as batch
  const batchResult = await batchProcessor.createBatch(tasks, { parallel });

  return {
    label,
    issuesProcessed: issues.length,
    ...batchResult
  };
}

// ============ v2.5.0 HELPER FUNCTIONS ============

// Session Management
async function cancelSession(sessionId) {
  structuredLog('info', 'Cancelling session', { sessionId });
  apiCache.invalidate(sessionId);
  const result = await retryWithBackoff(() => julesRequest('POST', `/sessions/${sessionId}:cancel`, {}), { maxRetries: 2 });
  await invalidateCaches('/api/sessions/active');
  await invalidateCaches('/api/sessions/stats');
  return result;
}

async function retrySession(sessionId, modifiedPrompt = null) {
  structuredLog('info', 'Retrying session', { sessionId });
  const original = await julesRequest('GET', `/sessions/${sessionId}`);
  if (!original) throw new Error(`Session ${sessionId} not found`);
  const newSession = await createJulesSession({
    prompt: modifiedPrompt || original.prompt || 'Retry previous task',
    source: original.sourceContext?.source || original.source,
    title: `Retry: ${original.title || sessionId}`,
    requirePlanApproval: original.requirePlanApproval ?? true,
    automationMode: original.automationMode || 'AUTO_CREATE_PR'
  });
  await invalidateCaches('/api/sessions/active');
  await invalidateCaches('/api/sessions/stats');
  return newSession;
}

async function getSessionDiff(sessionId) {
  const session = await julesRequest('GET', `/sessions/${sessionId}`);
  const activities = await julesRequest('GET', `/sessions/${sessionId}/activities`);
  const prActivity = activities.activities?.find(a => a.prCreated);
  return { sessionId, state: session.state, title: session.title, prUrl: prActivity?.prCreated?.url, prCreated: !!prActivity };
}

async function deleteSession(sessionId) {
  apiCache.invalidate(sessionId);
  return await retryWithBackoff(() => julesRequest('DELETE', `/sessions/${sessionId}`), { maxRetries: 2 });
}

async function cancelAllActiveSessions(confirm) {
  if (!confirm) throw new Error('Must pass confirm: true to cancel all sessions');
  const sessions = await sessionMonitor.getActiveSessions();
  const results = await Promise.all(sessions.map(async (s) => {
    const id = s.name?.split('/').pop() || s.id;
    try { await julesRequest('POST', `/sessions/${id}:cancel`, {}); return { id, cancelled: true }; }
    catch (error) { return { id, cancelled: false, error: error.message }; }
  }));
  apiCache.clear();
  await invalidateCaches('/api/sessions/active');
  await invalidateCaches('/api/sessions/stats');
  return { totalAttempted: sessions.length, cancelled: results.filter(r => r.cancelled).length, failed: results.filter(r => !r.cancelled).length, results };
}

// Session Templates
const MAX_TEMPLATES = 100;
function createTemplate(name, description, config) {
  if (!name || !config) throw new Error('Template name and config required');
  if (sessionTemplates.has(name)) throw new Error(`Template "${name}" already exists`);
  if (sessionTemplates.size >= MAX_TEMPLATES) throw new Error(`Template limit reached (max ${MAX_TEMPLATES}). Delete unused templates first.`);
  if (typeof name !== 'string' || name.length > 100) throw new Error('Template name must be a string under 100 characters');
  const template = { name, description: description || '', config, createdAt: new Date().toISOString(), usageCount: 0 };
  sessionTemplates.set(name, template);
  return { success: true, template };
}

function listTemplates() {
  return { templates: Array.from(sessionTemplates.values()), count: sessionTemplates.size };
}

async function createFromTemplate(templateName, overrides = {}) {
  const template = sessionTemplates.get(templateName);
  if (!template) throw new Error(`Template "${templateName}" not found`);
  template.usageCount++;
  return await createJulesSession({ ...template.config, ...overrides });
}

function deleteTemplate(name) {
  if (!sessionTemplates.has(name)) throw new Error(`Template "${name}" not found`);
  sessionTemplates.delete(name);
  return { success: true, message: `Template "${name}" deleted` };
}

// Session Cloning & Search
async function cloneSession(sessionId, modifiedPrompt = null, newTitle = null) {
  const original = await julesRequest('GET', `/sessions/${sessionId}`);
  if (!original) throw new Error(`Session ${sessionId} not found`);
  return await createJulesSession({
    prompt: modifiedPrompt || original.prompt || 'Clone of previous session',
    source: original.sourceContext?.source || original.source,
    title: newTitle || `Clone: ${original.title || sessionId}`,
    requirePlanApproval: original.requirePlanApproval ?? true,
    automationMode: original.automationMode || 'AUTO_CREATE_PR'
  });
}

async function searchSessions(query = null, state = null, limit = 20) {
  const allSessions = await julesRequest('GET', '/sessions');
  let sessions = allSessions.sessions || [];
  if (state) sessions = sessions.filter(s => s.state === state.toUpperCase());
  if (query) { const q = query.toLowerCase(); sessions = sessions.filter(s => (s.title && s.title.toLowerCase().includes(q)) || (s.prompt && s.prompt.toLowerCase().includes(q))); }
  return { sessions: sessions.slice(0, limit), total: sessions.length, filters: { query, state, limit } };
}

// PR Integration - Input Validation
const VALID_MERGE_METHODS = ['merge', 'squash', 'rebase'];
const GITHUB_OWNER_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;
const MAX_COMMENT_LENGTH = 10000;

function validateGitHubParams(owner, repo, prNumber) {
  if (!owner || typeof owner !== 'string' || !GITHUB_OWNER_PATTERN.test(owner)) {
    throw new Error('Invalid GitHub owner: must be alphanumeric with hyphens, 1-39 chars');
  }
  if (!repo || typeof repo !== 'string' || !GITHUB_REPO_PATTERN.test(repo)) {
    throw new Error('Invalid GitHub repository: must be alphanumeric with dots/hyphens/underscores, 1-100 chars');
  }
  if (owner.includes('..') || repo.includes('..') || owner.includes('/') || repo.includes('/')) {
    throw new Error('Invalid parameters: path traversal not allowed');
  }
  if (!Number.isInteger(prNumber) || prNumber < 1 || prNumber > 999999) {
    throw new Error('Invalid PR number: must be integer between 1-999999');
  }
}

async function getPrStatus(sessionId) {
  const session = await julesRequest('GET', `/sessions/${sessionId}`);
  const activities = await julesRequest('GET', `/sessions/${sessionId}/activities`);
  const prActivity = activities.activities?.find(a => a.prCreated);
  if (!prActivity) return { sessionId, prCreated: false, message: 'No PR created' };
  const prUrl = prActivity.prCreated.url;
  // Validate URL format before parsing
  if (!prUrl || typeof prUrl !== 'string' || prUrl.length > 500) {
    return { sessionId, prCreated: true, prUrl, error: 'Invalid PR URL format' };
  }
  try {
    const url = new URL(prUrl);
    if (url.hostname !== 'github.com') return { sessionId, prCreated: true, prUrl, error: 'Not a GitHub URL' };
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 4 || parts[2] !== 'pull') return { sessionId, prCreated: true, prUrl, error: 'Invalid PR URL structure' };
    const [owner, repo, , prNum] = parts;
    const prNumber = parseInt(prNum, 10);
    return { sessionId, prCreated: true, prUrl, owner, repo, prNumber: Number.isNaN(prNumber) ? null : prNumber, sessionState: session.state };
  } catch { return { sessionId, prCreated: true, prUrl, error: 'Failed to parse PR URL' }; }
}

async function mergePr(owner, repo, prNumber, mergeMethod = 'squash') {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not configured');
  validateGitHubParams(owner, repo, prNumber);
  if (!VALID_MERGE_METHODS.includes(mergeMethod)) {
    throw new Error(`Invalid merge method: must be one of ${VALID_MERGE_METHODS.join(', ')}`);
  }
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'api.github.com', path: `/repos/${owner}/${repo}/pulls/${prNumber}/merge`, method: 'PUT',
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Jules-MCP-Server', 'Content-Type': 'application/json' }
    }, (res) => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Store successful merge in semantic memory
          if (process.env.SEMANTIC_MEMORY_URL) {
            try {
              await storeSessionOutcome(
                { title: `PR #${prNumber} merged`, sourceContext: { source: `sources/github/${owner}/${repo}` } },
                'completed',
                { prUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`, merged: true }
              );
              structuredLog('info', 'Stored PR merge in semantic memory', { owner, repo, prNumber });
            } catch (err) {
              structuredLog('warn', 'Failed to store PR merge in memory', { error: err.message });
            }
          }
          resolve({ success: true, merged: true, prNumber });
        } else {
          const errMsg = res.statusCode === 403 ? 'Permission denied' : res.statusCode === 404 ? 'PR not found' : res.statusCode === 422 ? 'PR cannot be merged' : 'Merge failed';
          reject(new Error(errMsg));
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ merge_method: mergeMethod }));
    req.end();
  });
}

async function addPrComment(owner, repo, prNumber, comment) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not configured');
  validateGitHubParams(owner, repo, prNumber);
  if (typeof comment !== 'string' || comment.trim().length === 0) {
    throw new Error('Comment cannot be empty');
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`);
  }
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'api.github.com', path: `/repos/${owner}/${repo}/issues/${prNumber}/comments`, method: 'POST',
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Jules-MCP-Server', 'Content-Type': 'application/json' }
    }, (res) => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ success: true, commentId: JSON.parse(data).id, prNumber });
        else {
          const errMsg = res.statusCode === 403 ? 'Permission denied' : res.statusCode === 404 ? 'PR not found' : 'Failed to add comment';
          reject(new Error(errMsg));
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ body: comment }));
    req.end();
  });
}

// Session Queue
async function processQueue() {
  const next = sessionQueue.getNext();
  if (!next) return { processed: false, message: 'Queue is empty' };
  sessionQueue.markProcessing(next.id);
  try {
    const session = await createJulesSession(next.config);
    const sessionId = session.name?.split('/').pop() || session.id;
    sessionQueue.markComplete(next.id, sessionId);
    return { processed: true, queueId: next.id, sessionId, session };
  } catch (error) {
    sessionQueue.markFailed(next.id, error.message);
    return { processed: false, queueId: next.id, error: error.message };
  }
}

// Batch Retry
async function batchRetryFailed(batchId) {
  const batch = batchProcessor.getBatchStatus(batchId);
  if (!batch) throw new Error(`Batch ${batchId} not found`);
  const failedTasks = batch.sessions?.filter(s => s.status === 'failed' || s.state === 'FAILED') || [];
  if (failedTasks.length === 0) return { message: 'No failed sessions to retry', batchId };
  const results = await Promise.all(failedTasks.map(async (t) => {
    try { const newSession = await retrySession(t.sessionId || t.id); return { originalId: t.sessionId || t.id, newSessionId: newSession.name || newSession.id, success: true }; }
    catch (error) { return { originalId: t.sessionId || t.id, success: false, error: error.message }; }
  }));
  return { batchId, totalRetried: failedTasks.length, successful: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
}

// ============ SEMANTIC MEMORY HELPERS ============

// Store a manual memory
async function storeManualMemory(params) {
  if (!process.env.SEMANTIC_MEMORY_URL) {
    return { success: false, error: 'SEMANTIC_MEMORY_URL not configured' };
  }

  try {
    const response = await fetch(`${process.env.SEMANTIC_MEMORY_URL}/mcp/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'store_memory',
        parameters: {
          content: params.content,
          summary: params.summary,
          tags: params.tags || ['manual', 'jules-orchestration'],
          importance: params.importance || 0.5,
          source: 'jules-orchestration',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Memory API error: ${response.status} - ${error}` };
    }

    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Search memories
async function searchMemories(params) {
  if (!process.env.SEMANTIC_MEMORY_URL) {
    return { success: false, error: 'SEMANTIC_MEMORY_URL not configured' };
  }

  return await searchSessionMemories(params.query, params.tags);
}

// Analytics
async function getAnalytics(days = 7) {
  const allSessions = await julesRequest('GET', '/sessions');
  const sessions = allSessions.sessions || [];
  const cutoffDate = new Date(); cutoffDate.setDate(cutoffDate.getDate() - days);
  const recentSessions = sessions.filter(s => new Date(s.createTime || s.createdAt) >= cutoffDate);
  const byState = {}; for (const s of recentSessions) { const state = s.state || 'UNKNOWN'; byState[state] = (byState[state] || 0) + 1; }
  const completed = byState['COMPLETED'] || 0, failed = byState['FAILED'] || 0, total = recentSessions.length;
  return {
    period: `Last ${days} days`, totalSessions: total, byState,
    successRate: total > 0 ? Math.round((completed / total) * 100) + '%' : 'N/A',
    failureRate: total > 0 ? Math.round((failed / total) * 100) + '%' : 'N/A',
    averagePerDay: Math.round((total / days) * 10) / 10,
    templates: { count: sessionTemplates.size, totalUsage: Array.from(sessionTemplates.values()).reduce((sum, t) => sum + t.usageCount, 0) },
    queue: sessionQueue.stats(), cache: apiCache.stats()
  };
}

// ============ SERVER STARTUP ============

// Global error handler - catches all unhandled errors
app.use((err, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  console.error(`[ERROR][${requestId}] ${err.message}`, err.stack);

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      requestId,
      statusCode
    }
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      statusCode: 404
    }
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Jules MCP Server v' + VERSION + ' running on port ' + PORT);
  console.log('Health check: http://localhost:' + PORT + '/health');
  console.log('MCP Tools: http://localhost:' + PORT + '/mcp/tools');
  console.log('Jules API Key configured: ' + (JULES_API_KEY ? 'Yes' : 'No'));
  console.log('GitHub Token configured: ' + (GITHUB_TOKEN ? 'Yes' : 'No'));

  // Start Render webhook cleanup interval
  startRenderCleanupInterval();

  // Initialize modules after server starts
  batchProcessor = new BatchProcessor(julesRequest, createJulesSession);
  sessionMonitor = new SessionMonitor(julesRequest);

  // Initialize O(1) tool registry (must be after batchProcessor/sessionMonitor)
  initializeToolRegistry();
  console.log('Modules initialized: BatchProcessor, SessionMonitor, ToolRegistry (' + toolRegistry.size + ' tools)');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
