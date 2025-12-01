# Claude Code Project Context

## Project Overview

**antigravity-jules-orchestration** is an MCP (Model Context Protocol) server that integrates Google's Jules API with Antigravity for autonomous AI development workflows. It enables hands-free coding sessions, automated PR creation, and orchestrated development tasks.

## Architecture

```
antigravity-jules-orchestration/
├── index.js                    # Main MCP server (Express, port 3323)
├── orchestrator-api/           # Full orchestrator API with PostgreSQL, WebSockets
│   ├── src/index.js           # API server with GitHub webhooks
│   └── src/metrics.js         # Prometheus metrics
├── dashboard/                  # React Mission Control dashboard
│   └── src/App.jsx            # Main dashboard component
├── orchestration/
│   └── routes/jules.js        # Express routes for Jules API
├── middleware/
│   └── errorHandler.js        # Comprehensive error handling
├── scripts/                    # Deployment & automation scripts
├── templates/                  # Workflow templates (JSON)
└── .github/workflows/         # CI/CD pipelines
```

## Key Components

### MCP Server (index.js)
- Express server on port 3323
- Jules API tools: `jules_list_sources`, `jules_create_session`, `jules_list_sessions`, `jules_get_session`, `jules_send_message`, `jules_approve_plan`, `jules_get_activities`
- Endpoints: `/health`, `/mcp/tools`, `/mcp/execute`

### Orchestrator API (orchestrator-api/)
- PostgreSQL database for workflow state
- WebSocket support for real-time updates
- GitHub webhook receiver
- Prometheus metrics endpoint

### Workflow Templates
- `dependency-update.json` - Weekly automated dependency maintenance
- `bugfix-from-issue.json` - Auto-fix from labeled GitHub issues
- `feature-implementation.json` - Feature implementation from @jules comment
- `security-patch.json` - Security vulnerability patches
- `documentation-sync.json` - Auto-sync docs on main push

## Development Commands

```bash
# Start MCP server
npm run dev

# Start orchestrator API
cd orchestrator-api && npm start

# Build dashboard
cd dashboard && npm run build
```

## Environment Variables

- `JULES_API_KEY` - Google Jules API key (required)
- `GITHUB_TOKEN` - GitHub personal access token
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3323)
- `SLACK_WEBHOOK_URL` - Slack notifications

## Deployment

- Platform: Render
- Branch: `Scarmonit`
- Health Check: `/health`
- Live URL: `https://antigravity-jules-orchestration.onrender.com`

## Parallel Workflow Agents

Use these slash commands for parallel agent workflows:

- `/audit` - Run full security and code audit
- `/deploy` - Deploy with pre-flight checks
- `/review` - Code review across components
- `/test-api` - Test all API endpoints
- `/health` - Check all service health

## Code Style

- ES Modules (`"type": "module"`)
- Single quotes, semicolons
- 2-space indentation
- Async/await for promises
