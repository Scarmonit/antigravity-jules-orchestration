# Jules MCP Server

## Overview
This is an MCP (Model Context Protocol) server that acts as an orchestration layer for Jules, an autonomous coding agent. It connects to the Jules API, GitHub, and other services to manage coding sessions, process tasks, and integrate with development workflows.

## Features
- **Session Management**: Create, monitor, and manage Jules coding sessions.
- **GitHub Integration**: Create sessions from issues, handle PRs, and manage source code.
- **Batch Processing**: Run multiple sessions in parallel with efficient queueing.
- **RAG System**: Index and query your codebase for context-aware responses.
- **Auto-Fix**: Automatically detect and fix build failures (e.g., via Render webhooks).
- **Monitoring**: Real-time status tracking and analytics.
- **Local LLM**: Integration with Ollama for local inference.

## Architecture
- **Server**: Node.js Express server.
- **Tool Registry**: O(1) lookup for MCP tools.
- **Queueing**: Priority-based `SessionQueue` for managing load.
- **Caching**: `LRUCache` for API responses and rate limiting.
- **Resilience**: `CircuitBreaker` and exponential backoff for external API calls.
- **Security**: Rate limiting, strict input validation (Joi), and secure webhook verification.

## Setup

### Prerequisites
- Node.js v18+
- npm or pnpm
- GitHub Token (optional, for GitHub features)
- Jules API Key (required)

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env`:
   ```env
   JULES_API_KEY=your_key_here
   GITHUB_TOKEN=your_token_here
   PORT=3323
   ```

### Running
- Development: `npm run dev`
- Production: `npm start`

## API Endpoints
- `GET /health`: System health check.
- `GET /mcp/tools`: List available MCP tools.
- `POST /mcp/execute`: Execute a tool.
- `GET /api/sessions/active`: List active sessions.
- `GET /api/sessions/stats`: Get session statistics.

## Tools
See `docs/HEALTH.md` for health check details.
Run `npm run mcp:simulated` to test tools in simulated mode.

## Testing
- Unit Tests: `npm test`
- Integration Tests: `npm run test:integration`

## License
MIT
