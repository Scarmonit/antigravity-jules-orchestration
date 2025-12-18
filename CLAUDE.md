# Claude Code Project Context

**Version: 2.5.1** | [CHANGELOG](./CHANGELOG.md)

## Project Overview

**antigravity-jules-orchestration** is an MCP (Model Context Protocol) server that integrates Google's Jules API with Antigravity for autonomous AI development workflows. It provides **45 MCP tools** including session templates, priority queues, PR integration, Ollama/RAG, hands-free coding sessions, and orchestrated development tasks.

## What's New in v2.5.1

- **Temporal Agent Integration**: Schedule recurring Jules sessions via temporal-agent-mcp
- **New lib/temporal-integration.js**: Helper functions for scheduled workflows
- **New template**: scheduled-jules-session.json for timed automation

## What's New in v2.5.0

- **15 New MCP Tools**: Templates, cloning, search, PR integration, queue, analytics
- **Session Templates**: Save and reuse session configurations
- **Priority Queue**: Queue sessions with priority-based processing
- **Session Cloning**: Clone successful sessions with modifications
- **Session Search**: Filter sessions by title, state, date
- **PR Integration**: Merge PRs, add comments directly from Jules
- **Batch Retry**: Automatically retry all failed sessions in a batch
- **Analytics Dashboard**: Success rates, trends, performance metrics
- **New Slash Commands**: `/templates`, `/queue`, `/analytics`

## Architecture

```
antigravity-jules-orchestration/
├── index.js                    # Main MCP server (Express, port 3323)
├── orchestrator-api/           # Full orchestrator API with PostgreSQL, WebSockets
│   ├── src/index.js           # API server with GitHub webhooks
│   └── src/metrics.js         # Prometheus metrics
├── dashboard/                  # React Mission Control dashboard
│   └── src/App.jsx            # Main dashboard component
├── lib/
│   ├── batch.js               # Parallel batch processing
│   ├── monitor.js             # Session monitoring & stats
│   ├── github.js              # GitHub API integration
│   ├── ollama.js              # Local Ollama LLM integration
│   ├── rag.js                 # RAG codebase indexing
│   └── temporal-integration.js # Scheduled Jules sessions (NEW)
├── middleware/
│   └── errorHandler.js        # Comprehensive error handling
├── scripts/                    # Deployment & automation scripts
├── templates/                  # Workflow templates (JSON)
└── .github/workflows/         # CI/CD pipelines
```

## MCP Tools Reference (45 tools)

### Jules Core API
| Tool | Description |
|------|-------------|
| `jules_list_sources` | List connected GitHub repositories |
| `jules_create_session` | Create new Jules coding session |
| `jules_list_sessions` | List all sessions |
| `jules_get_session` | Get session details |
| `jules_send_message` | Send message to session |
| `jules_approve_plan` | Approve session plan |
| `jules_get_activities` | Get session activity log |

### Session Management
| Tool | Description |
|------|-------------|
| `jules_cancel_session` | Cancel/abort active session |
| `jules_retry_session` | Retry failed session with optional modified prompt |
| `jules_get_diff` | Get code changes/PR from session |
| `jules_delete_session` | Delete session (cleanup) |
| `jules_cancel_all_active` | Emergency stop all sessions |

### Session Templates (NEW v2.5.0)
| Tool | Description |
|------|-------------|
| `jules_create_template` | Save session config as reusable template |
| `jules_list_templates` | List all saved templates |
| `jules_create_from_template` | Create session from template with overrides |
| `jules_delete_template` | Delete a saved template |

### Session Cloning & Search (NEW v2.5.0)
| Tool | Description |
|------|-------------|
| `jules_clone_session` | Clone session config to create similar session |
| `jules_search_sessions` | Search with filters (title, state, limit) |

### PR Integration (NEW v2.5.0)
| Tool | Description |
|------|-------------|
| `jules_get_pr_status` | Get detailed PR status from session |
| `jules_merge_pr` | Merge PR (squash/merge/rebase) |
| `jules_add_pr_comment` | Add comment to PR |

### Session Queue (NEW v2.5.0)
| Tool | Description |
|------|-------------|
| `jules_queue_session` | Queue session with priority (1-10) |
| `jules_get_queue` | Get current queue and stats |
| `jules_process_queue` | Process next queued item |
| `jules_clear_queue` | Clear all pending queue items |

### Batch Processing
| Tool | Description |
|------|-------------|
| `jules_create_from_issue` | Create session from GitHub issue |
| `jules_batch_from_labels` | Create sessions for all issues with label |
| `jules_batch_create` | Create multiple sessions in parallel |
| `jules_batch_status` | Get batch status |
| `jules_batch_approve_all` | Approve all pending plans in batch |
| `jules_list_batches` | List all batch operations |
| `jules_batch_retry_failed` | Retry all failed sessions in batch (NEW) |

### Analytics (NEW v2.5.0)
| Tool | Description |
|------|-------------|
| `jules_get_analytics` | Session analytics (success rate, trends) |

### Monitoring & Cache
| Tool | Description |
|------|-------------|
| `jules_monitor_all` | Real-time status of all sessions |
| `jules_session_timeline` | Detailed activity timeline |
| `jules_cache_stats` | Cache and circuit breaker stats |
| `jules_clear_cache` | Clear API response cache |

### Ollama Local LLM
| Tool | Description |
|------|-------------|
| `ollama_list_models` | List available Ollama models |
| `ollama_completion` | Generate text with local LLM |
| `ollama_code_generation` | Generate code with Qwen2.5-Coder |
| `ollama_chat` | Multi-turn chat |

### RAG (Retrieval-Augmented Generation)
| Tool | Description |
|------|-------------|
| `ollama_rag_index` | Index directory for codebase queries |
| `ollama_rag_query` | Query indexed codebase |
| `ollama_rag_status` | Get index status |
| `ollama_rag_clear` | Clear RAG index |

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/templates` | **NEW** Manage session templates (create, list, use, delete) |
| `/queue` | **NEW** Session queue management (add, process, clear) |
| `/analytics` | **NEW** Analytics dashboard (success rate, trends) |
| `/status` | Jules status dashboard - sessions, stats, health |
| `/quick-fix` | Fast single-file fix workflow |
| `/audit` | Comprehensive security, code quality, dependencies |
| `/review` | Unified MCP, workflow, and architecture review |
| `/deploy-check` | Pre-deployment validation with live health checks |
| `/fix-issues` | Auto-diagnose and fix common issues |
| `/implement-feature` | Feature implementation workflow with planning |

## Development Commands

```bash
# Start MCP server
npm run dev

# Start orchestrator API
cd orchestrator-api && npm start

# Build dashboard
cd dashboard && npm run build

# Run tests
npm test                          # Backend tests
cd dashboard && npm test          # Dashboard tests
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JULES_API_KEY` | Google Jules API key | Yes |
| `GITHUB_TOKEN` | GitHub personal access token | No |
| `DATABASE_URL` | PostgreSQL connection string | No |
| `PORT` | Server port (default: 3323) | No |
| `SLACK_WEBHOOK_URL` | Slack notifications | No |
| `LOG_LEVEL` | Logging level: error/warn/info/debug | No |
| `ALLOWED_ORIGINS` | CORS whitelist (comma-separated) | No |

## Performance Features

### LRU Cache
- 100 item capacity with 10s default TTL
- Automatic invalidation on mutations
- Cache stats via `jules_cache_stats`

### Circuit Breaker
- Trips after 5 consecutive failures
- 60-second reset timeout
- Status visible in health check

### Retry Logic
- 3 retries with exponential backoff
- Jitter to prevent thundering herd
- Skips retry on 4xx errors (except 429)

### Session Queue
- Priority-based processing (1-10, lower = higher)
- Persistent queue state
- Automatic failure handling

## Typical Workflows

### Template-Based Development
```
1. /templates create bug-fix     - Create reusable template
2. jules_create_from_template    - Use template with overrides
3. /analytics                    - Track template usage
```

### Queue-Based Processing
```
1. /queue add 2                  - Add high-priority item
2. /queue add 5                  - Add normal-priority item
3. /queue process                - Process next item
4. /queue                        - Check status
```

### PR Workflow
```
1. jules_create_session          - Create coding session
2. jules_approve_plan            - Approve plan
3. jules_get_pr_status          - Check PR status
4. jules_merge_pr               - Merge when ready
```

### Quick Fix
```
/quick-fix src/api/auth.js "Add rate limiting to login endpoint"
```

### Scheduled Jules Sessions (NEW v2.5.1)
```
// Schedule weekly dependency updates
import { scheduleJulesSession, scheduleTemplates } from './lib/temporal-integration.js';

await scheduleJulesSession({
  name: 'weekly-deps',
  cronExpression: scheduleTemplates.weeklyDependencyUpdate.cronExpression,
  timezone: 'America/New_York',
  repository: 'owner/repo',
  task: scheduleTemplates.weeklyDependencyUpdate.task,
});

// List scheduled Jules tasks
const tasks = await listScheduledJulesTasks();

// Cancel a scheduled task
await cancelScheduledJulesTask(taskId);
```

### Session Search & Clone
```
1. jules_search_sessions         - Find completed sessions
2. jules_clone_session          - Clone successful config
3. Modify prompt and run
```

## Deployment

- Platform: Render
- Branch: `Scarmonit`
- Health Check: `/health`
- Live URL: `https://scarmonit.com`

## Code Style

- ES Modules (`"type": "module"`)
- Single quotes, semicolons
- 2-space indentation
- Async/await for promises
