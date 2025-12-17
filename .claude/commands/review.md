# Unified Code & Architecture Review

Comprehensive review of MCP implementation, workflows, and architecture using parallel agents.

## Parallel Agent Tasks

### Agent 1: MCP Implementation Review
Review all MCP tools defined in `index.js`:
- `jules_list_sources` - List connected GitHub repositories
- `jules_create_session` - Create new coding session
- `jules_list_sessions` - List all sessions
- `jules_get_session` - Get session details
- `jules_send_message` - Send message to session
- `jules_approve_plan` - Approve execution plan
- `jules_get_activities` - Get session activities

Check for:
- Complete parameter validation
- Proper error handling
- Consistent response formats

Review Jules API integration:
- Check `julesRequest` function implementation
- Verify API endpoint paths
- Check authentication header handling
- Review error response parsing
- Check timeout handling

### Agent 2: MCP Config & Orchestrator
Review MCP configuration in `antigravity-mcp-config.json`:
- Verify tool definitions match implementation
- Check endpoint configurations
- Review capability declarations
- Verify deployment settings

Review `orchestrator-api/src/index.js` MCP implementation:
- Check `/mcp/tools` endpoint
- Review `/mcp/execute` endpoint
- Verify tool execution logic
- Check error handling

### Agent 3: Workflow Templates Review
Validate all workflow templates in `templates/`:
- `dependency-update.json` - Weekly dependency updates
- `bugfix-from-issue.json` - Bug fix automation
- `feature-implementation.json` - Feature implementation
- `security-patch.json` - Security patching
- `documentation-sync.json` - Documentation sync

Check:
- Valid JSON structure
- Required fields present
- Trigger configuration
- Pre/post actions

Review GitHub Actions in `.github/workflows/`:
- `deploy.yml` - Render deployment workflow
- `health-check.yml` - Service health monitoring

Check:
- Proper trigger conditions
- Secret usage
- Job dependencies
- Error handling

### Agent 4: Architecture & Integration Review
Review overall system architecture:
- Component interactions between MCP server, orchestrator, and dashboard
- Data flow patterns
- API dependencies
- Error propagation

Review dashboard integration in `dashboard/src/App.jsx`:
- Quick action buttons
- Workflow execution API calls
- Template display
- Status tracking

Review orchestrator workflow handling:
- GitHub webhook receiver
- WebSocket broadcasting
- Workflow state management
- Database integration

## Output

Provide comprehensive review report with:
- MCP tool coverage analysis
- API integration issues
- Configuration mismatches
- Template validation results
- GitHub Actions issues
- Architecture recommendations
- Integration gaps
- Improvement recommendations
