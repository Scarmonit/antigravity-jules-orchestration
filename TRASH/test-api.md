# API Endpoint Testing

Test all API endpoints in the system.

## Parallel Agent Tasks

### Agent 1: Main MCP Server Endpoints
Test endpoints in `index.js`:
```bash
# Root endpoint
curl http://localhost:3323/

# Health check
curl http://localhost:3323/health

# Extended health check
curl http://localhost:3323/api/v1/health

# MCP tools list
curl http://localhost:3323/mcp/tools
```

### Agent 2: MCP Execute Endpoint
Test MCP tool execution:
```bash
# List sources
curl -X POST http://localhost:3323/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "jules_list_sources"}'

# List sessions
curl -X POST http://localhost:3323/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "jules_list_sessions"}'
```

### Agent 3: Orchestrator API Endpoints
Test orchestrator-api endpoints:
```bash
# Root
curl http://localhost:3000/

# Health
curl http://localhost:3000/health

# MCP tools
curl http://localhost:3000/mcp/tools

# Metrics
curl http://localhost:3000/api/v1/metrics
```

### Agent 4: Live Deployment Test
Test live deployment on Render:
```bash
# Health check
curl https://antigravity-jules-orchestration.onrender.com/health

# Root endpoint
curl https://antigravity-jules-orchestration.onrender.com/

# MCP tools
curl https://antigravity-jules-orchestration.onrender.com/mcp/tools
```

## Output

Provide API test report with:
- Endpoint status (pass/fail)
- Response times
- Error details
- Missing endpoints
