// Tool Registry - Map-based lookup replaces O(n) switch statement
import { julesRequest } from './jules-client.js';
import { circuitBreaker } from './circuit-breaker.js';
import { LRUCache } from 'lru-cache';
import { invalidateCaches } from '../middleware/cacheMiddleware.js';

// Import all dependencies needed for tools
import {
  listOllamaModels,
  ollamaCompletion,
  ollamaCodeGeneration,
  ollamaChat
} from './ollama.js';
import {
  ragIndexDirectory,
  ragQuery,
  ragStatus,
  ragClear
} from './rag.js';
import {
    storeSessionOutcome,
    recallContextForTask,
    reinforceSuccessfulPattern,
    checkMemoryHealth,
    getMemoryMaintenanceSchedule,
    searchSessionMemories,
    getRelatedMemories,
    decayOldMemories,
} from './memory-client.js';
import {
  isConfigured as isRenderConfigured,
  connect as renderConnect,
  disconnect as renderDisconnect,
  listServices as renderListServices,
  listDeploys as renderListDeploys,
  getBuildLogs as renderGetBuildLogs,
  getLatestFailedDeploy as renderGetLatestFailedDeploy,
  analyzeErrors as renderAnalyzeErrors,
} from './render-client.js';
import {
  handleWebhook as handleRenderWebhook,
  getAutoFixStatus as getRenderAutoFixStatus,
  setAutoFixEnabled as setRenderAutoFixEnabled,
  addMonitoredService as addRenderMonitoredService,
  removeMonitoredService as removeRenderMonitoredService,
  startAutoFix as startRenderAutoFix,
} from './render-autofix.js';
import {
  getSuggestedTasks,
  clearCache as clearSuggestedTasksCache,
  generateFixPrompt as generateSuggestedTaskFixPrompt,
} from './suggested-tasks.js';

const toolRegistry = new Map();

// Helper functions that need to be injected or imported
// (Some were inline in index.js, we need to handle them)
// We will export a function to initialize the registry which accepts dependencies.

export function initializeToolRegistry(dependencies) {
  const {
    createJulesSession,
    createSessionFromIssue,
    createSessionsFromLabel,
    batchProcessor,
    sessionMonitor,
    cancelSession,
    retrySession,
    getSessionDiff,
    deleteSession,
    cancelAllActiveSessions,
    createTemplate,
    listTemplates,
    createFromTemplate,
    deleteTemplate,
    cloneSession,
    searchSessions,
    getPrStatus,
    mergePr,
    addPrComment,
    sessionQueue,
    processQueue,
    batchRetryFailed,
    getAnalytics,
    storeManualMemory,
    searchMemories,
    apiCache
  } = dependencies;

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
  toolRegistry.set('jules_cache_stats', () => {
    // Adapter for lru-cache v10 stats if available or custom object
    const stats = typeof apiCache.info === 'function' ? apiCache.info() : { size: apiCache.size };
    return { ...stats, circuitBreaker: { failures: circuitBreaker.failures, isOpen: circuitBreaker.isOpen() } };
  });
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

  // Capability Enhancement: Health Check Tool
  toolRegistry.set('jules_health_check', async () => {
    const health = {
        julesApi: circuitBreaker.isOpen() ? 'circuit_open' : 'configured',
        github: process.env.GITHUB_TOKEN ? 'configured' : 'not_configured',
        memory: process.env.SEMANTIC_MEMORY_URL ? 'configured' : 'not_configured',
        rag: ragStatus().indexed ? 'indexed' : 'empty'
    };
    return { success: true, health };
  });
}

export function getToolHandler(toolName) {
  return toolRegistry.get(toolName);
}

export function getToolRegistrySize() {
  return toolRegistry.size;
}
