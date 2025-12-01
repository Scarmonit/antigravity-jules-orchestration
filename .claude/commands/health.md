# Service Health Check

Run comprehensive health checks across all services.

## Parallel Agent Tasks

### Agent 1: Local MCP Server
Check local MCP server health:
```bash
curl -s http://localhost:3323/health | jq .
```
Verify:
- Status is "ok"
- API key is configured
- Version is current

### Agent 2: Local Orchestrator API
Check orchestrator API health:
```bash
curl -s http://localhost:3000/health | jq .
curl -s http://localhost:3000/api/v1/health | jq .
```
Verify:
- Database connection
- Jules API configuration
- GitHub API configuration

### Agent 3: Live Render Deployment
Check production deployment:
```bash
curl -s https://antigravity-jules-orchestration.onrender.com/health
curl -s https://antigravity-jules-orchestration.onrender.com/
```
Verify:
- Service is responding
- No cold start issues
- API key is configured

### Agent 4: GitHub Actions Status
Check CI/CD pipeline status:
- Review recent workflow runs
- Check health-check workflow results
- Verify deployment status

## Output

Provide health status dashboard:
```
Service                    Status    Details
-----------------------    ------    --------
Local MCP Server           [OK/FAIL] ...
Local Orchestrator API     [OK/FAIL] ...
Render Production          [OK/FAIL] ...
GitHub Actions             [OK/FAIL] ...
```
