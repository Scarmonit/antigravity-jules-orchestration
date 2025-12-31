/**
 * MCP Tool Registry
 * Centralized registry for all MCP tools using O(1) Map lookup
 */

import { listOllamaModels, ollamaCompletion, ollamaCodeGeneration, ollamaChat } from './ollama.js';
import { ragIndexDirectory, ragQuery, ragStatus, ragClear } from './rag.js';
import { recallContextForTask, storeSessionOutcome, checkMemoryHealth, getMemoryMaintenanceSchedule, searchSessionMemories, getRelatedMemories, reinforceSuccessfulPattern, decayOldMemories } from './memory-client.js';
import {
    connect as renderConnect,
    disconnect as renderDisconnect,
    isConfigured as isRenderConfigured,
    listServices as renderListServices,
    listDeploys as renderListDeploys,
    getBuildLogs as renderGetBuildLogs,
    getLatestFailedDeploy as renderGetLatestFailedDeploy,
    analyzeErrors as renderAnalyzeErrors
} from './render-client.js';
import {
    getAutoFixStatus as getRenderAutoFixStatus,
    setAutoFixEnabled as setRenderAutoFixEnabled,
    addMonitoredService as addRenderMonitoredService,
    removeMonitoredService as removeRenderMonitoredService,
    startAutoFix as startRenderAutoFix
} from './render-autofix.js';
import {
    getSuggestedTasks,
    clearCache as clearSuggestedTasksCache,
    generateFixPrompt as generateSuggestedTaskFixPrompt
} from './suggested-tasks.js';

export class ToolRegistry {
    constructor() {
        this.registry = new Map();
    }

    register(name, handler) {
        this.registry.set(name, handler);
    }

    get(name) {
        return this.registry.get(name);
    }

    size() {
        return this.registry.size;
    }

    initialize(dependencies) {
        const {
            julesRequest,
            createJulesSession,
            invalidateCaches,
            batchProcessor,
            sessionMonitor,
            sessionQueue,
            apiCache,
            circuitBreaker,
            sessionTemplates,
            createSessionFromIssue,
            createSessionsFromLabel,
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
            processQueue,
            batchRetryFailed,
            getAnalytics,
            storeManualMemory,
            searchMemories
        } = dependencies;

        // Jules API tools
        this.register('jules_list_sources', (p) => julesRequest('GET', '/sources'));
        this.register('jules_create_session', (p) => createJulesSession(p));
        this.register('jules_list_sessions', (p) => julesRequest('GET', '/sessions'));
        this.register('jules_get_session', (p) => julesRequest('GET', '/sessions/' + p.sessionId));
        this.register('jules_send_message', async (p) => {
            const result = await julesRequest('POST', '/sessions/' + p.sessionId + ':sendMessage', { message: p.message });
            invalidateCaches();
            return result;
        });
        this.register('jules_approve_plan', async (p) => {
            const result = await julesRequest('POST', '/sessions/' + p.sessionId + ':approvePlan', {});
            invalidateCaches();
            return result;
        });
        this.register('jules_get_activities', (p) => julesRequest('GET', '/sessions/' + p.sessionId + '/activities'));

        // GitHub Issue Integration
        this.register('jules_create_from_issue', (p) => createSessionFromIssue(p));
        this.register('jules_batch_from_labels', (p) => createSessionsFromLabel(p));

        // Batch Processing
        this.register('jules_batch_create', (p) => batchProcessor.createBatch(p.tasks, { parallel: p.parallel }));
        this.register('jules_batch_status', (p) => batchProcessor.getBatchStatus(p.batchId));
        this.register('jules_batch_approve_all', (p) => batchProcessor.approveAllInBatch(p.batchId));

        // Monitoring
        this.register('jules_monitor_all', (p) => sessionMonitor.monitorAll());
        this.register('jules_session_timeline', (p) => sessionMonitor.getSessionTimeline(p.sessionId));

        // Ollama Local LLM
        this.register('ollama_list_models', (p) => listOllamaModels());
        this.register('ollama_completion', (p) => ollamaCompletion(p));
        this.register('ollama_code_generation', (p) => ollamaCodeGeneration(p));
        this.register('ollama_chat', (p) => ollamaChat(p));

        // RAG Tools
        this.register('ollama_rag_index', (p) => ragIndexDirectory(p));
        this.register('ollama_rag_query', (p) => ragQuery(p));
        this.register('ollama_rag_status', (p) => ragStatus());
        this.register('ollama_rag_clear', (p) => ragClear());

        // Session Management
        this.register('jules_cancel_session', (p) => cancelSession(p.sessionId));
        this.register('jules_retry_session', (p) => retrySession(p.sessionId, p.modifiedPrompt));
        this.register('jules_get_diff', (p) => getSessionDiff(p.sessionId));
        this.register('jules_list_batches', () => batchProcessor.listBatches());
        this.register('jules_delete_session', (p) => deleteSession(p.sessionId));
        this.register('jules_clear_cache', () => { apiCache.clear(); return { success: true, message: 'Cache cleared' }; });
        this.register('jules_cache_stats', () => ({ ...apiCache.stats(), circuitBreaker: { failures: circuitBreaker.failures, isOpen: circuitBreaker.isOpen() } }));
        this.register('jules_cancel_all_active', (p) => cancelAllActiveSessions(p.confirm));

        // Session Templates
        this.register('jules_create_template', (p) => createTemplate(p.name, p.description, p.config));
        this.register('jules_list_templates', () => listTemplates());
        this.register('jules_create_from_template', (p) => createFromTemplate(p.templateName, p.overrides));
        this.register('jules_delete_template', (p) => deleteTemplate(p.name));

        // Session Cloning & Search
        this.register('jules_clone_session', (p) => cloneSession(p.sessionId, p.modifiedPrompt, p.newTitle));
        this.register('jules_search_sessions', (p) => searchSessions(p.query, p.state, p.limit));

        // PR Integration
        this.register('jules_get_pr_status', (p) => getPrStatus(p.sessionId));
        this.register('jules_merge_pr', (p) => mergePr(p.owner, p.repo, p.prNumber, p.mergeMethod));
        this.register('jules_add_pr_comment', (p) => addPrComment(p.owner, p.repo, p.prNumber, p.comment));

        // Session Queue
        this.register('jules_queue_session', (p) => ({ success: true, item: sessionQueue.add(p.config, p.priority) }));
        this.register('jules_get_queue', () => ({ queue: sessionQueue.list(), stats: sessionQueue.stats() }));
        this.register('jules_process_queue', () => processQueue());
        this.register('jules_clear_queue', () => ({ success: true, cleared: sessionQueue.clear() }));

        // Batch Retry & Analytics
        this.register('jules_batch_retry_failed', (p) => batchRetryFailed(p.batchId));
        this.register('jules_get_analytics', (p) => getAnalytics(p.days));

        // Semantic Memory Integration
        this.register('memory_recall_context', (p) => recallContextForTask(p.task, p.repository));
        this.register('memory_store', (p) => storeManualMemory(p));
        this.register('memory_search', (p) => searchMemories(p.query, p.tags));
        this.register('memory_related', (p) => getRelatedMemories(p.memoryId, p.limit));
        this.register('memory_reinforce', (p) => reinforceSuccessfulPattern(p.memoryId, p.boost));
        this.register('memory_forget', (p) => decayOldMemories(p.olderThanDays, p.belowImportance));
        this.register('memory_health', () => checkMemoryHealth().then(healthy => ({ healthy, url: process.env.SEMANTIC_MEMORY_URL || 'not configured' })));
        this.register('memory_maintenance_schedule', () => getMemoryMaintenanceSchedule());

        // Render Integration for Auto-Fix
        this.register('render_connect', (p) => renderConnect(p.apiKey, p.webhookSecret));
        this.register('render_disconnect', () => renderDisconnect());
        this.register('render_status', () => ({ configured: isRenderConfigured(), autoFix: getRenderAutoFixStatus() }));
        this.register('render_list_services', () => renderListServices());
        this.register('render_list_deploys', (p) => renderListDeploys(p.serviceId, p.limit));
        this.register('render_get_build_logs', (p) => renderGetBuildLogs(p.serviceId, p.deployId));
        this.register('render_analyze_failure', async (p) => {
            const failure = await renderGetLatestFailedDeploy(p.serviceId);
            if (!failure.found) return failure;
            return renderAnalyzeErrors(failure.logs);
        });
        this.register('render_autofix_status', () => getRenderAutoFixStatus());
        this.register('render_set_autofix', (p) => setRenderAutoFixEnabled(p.enabled));
        this.register('render_add_monitored_service', (p) => addRenderMonitoredService(p.serviceId));
        this.register('render_remove_monitored_service', (p) => removeRenderMonitoredService(p.serviceId));
        this.register('render_trigger_autofix', async (p) => {
            // Manual trigger for auto-fix on a specific service
            const failure = await renderGetLatestFailedDeploy(p.serviceId);
            if (!failure.found) return { success: false, message: 'No recent failed deploy found' };
            return startRenderAutoFix(
                { serviceId: p.serviceId, deployId: failure.deploy.id, branch: failure.branch },
                createJulesSession,
                (sessionId, msg) => julesRequest('POST', `/sessions/${sessionId}:sendMessage`, msg)
            );
        });

        // Suggested Tasks
        this.register('jules_suggested_tasks', (p) => getSuggestedTasks(p.directory, {
            types: p.types,
            minPriority: p.minPriority,
            limit: p.limit,
            includeGitInfo: p.includeGitInfo
        }));
        this.register('jules_fix_suggested_task', async (p) => {
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
        this.register('jules_clear_suggested_cache', () => clearSuggestedTasksCache());
    }
}

export const toolRegistry = new ToolRegistry();
