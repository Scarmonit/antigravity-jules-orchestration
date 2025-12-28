import express from 'express';
import { cacheMiddleware } from '../middleware/cacheMiddleware.js';
import validateRequest from '../middleware/validateRequest.js';
import mcpExecuteSchema from '../schemas/mcp-execute-schema.js';

export default function createMcpRoutes({ toolRegistry, JULES_API_KEY }) {
    const router = express.Router();

    // MCP Protocol - List available tools
    router.get('/tools', cacheMiddleware, (req, res) => {
        // Generate tool list from registry keys or keep static?
        // The original code had a static list. To support dynamic tools, we might want to ask the registry.
        // For now, let's keep the static list but ideally it should be generated.
        // Since toolRegistry stores handlers, not descriptions, we might need a separate metadata store or getter.
        // Assuming the static list is fine for now as per original code structure, but we need to move the list here.

        // However, the original code had a HUGE list of tools in /mcp/tools.
        // I should probably copy that list here.

        // A better approach for the future: `toolRegistry` should store metadata too.
        // But for this refactor, I will just copy the static JSON response.

        // Actually, to save space in this output, I'll refer to the static list which I'll define in a separate file or keep here.
        // Let's keep it here for now.

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

    // MCP Protocol - Execute tool with O(1) registry lookup
    router.post('/execute', validateRequest(mcpExecuteSchema), async (req, res, next) => {
        const { tool, parameters = {} } = req.body;

        if (!tool) {
            return res.status(400).json({ error: 'Tool name required' });
        }

        if (!JULES_API_KEY) {
            return res.status(500).json({ error: 'JULES_API_KEY not configured' });
        }

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
            // Pass to global error handler or handle here.
            // The original code returned 500 JSON.
            // We can delegate to next(error) if we want the global handler to format it.
            // But to maintain exact behavior:
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
}
