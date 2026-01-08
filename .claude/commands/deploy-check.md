# Pre-Deployment Check

Run parallel pre-deployment checks before pushing to the `Scarmonit` branch.

## Parallel Agent Tasks

### Agent 1: Syntax & Lint Check
Check all JavaScript files for syntax errors:
- Verify `index.js` syntax
- Verify `orchestrator-api/src/index.js` syntax
- Verify `lib/*.js` syntax
- Verify `middleware/*.js` syntax
- Check for ESLint violations in dashboard

### Agent 2: Configuration Validation
Validate all configuration files:
- Check `package.json` validity
- Verify `render.yaml` configuration
- Validate `antigravity-mcp-config.json`
- Check all template JSON files in `templates/`
- Verify `.github/workflows/*.yml` syntax

### Agent 3: Environment Check
Verify environment configuration:
- Check `.env.render` for required variables
- Verify `render-env-vars.txt` completeness
- Check for hardcoded development values
- Verify PORT configuration

### Agent 4: Health Endpoint Verification
Verify health check endpoints are properly configured:
- Check `/health` endpoint in `index.js`
- Check `/api/v1/health` endpoint
- Verify `orchestrator-api` health endpoint
- Check Render health check path in `render.yaml`

### Agent 5: Live Service Health
Run comprehensive health checks across all services:

**Local MCP Server:**
```bash
curl -s http://localhost:3323/health | jq .
```
Verify: Status "ok", API key configured, version current

**Local Orchestrator API:**
```bash
curl -s http://localhost:3000/health | jq .
curl -s http://localhost:3000/api/v1/health | jq .
```
Verify: Database connection, Jules API config, GitHub API config

**Live Render Deployment:**
```bash
curl -s https://scarmonit.com/health
```
Verify: Service responding, no cold start issues, API key configured

**GitHub Actions Status:**
- Review recent workflow runs
- Check health-check workflow results
- Verify deployment status

## Output

Provide a deployment readiness report with:
- GO/NO-GO status
- List of blocking issues
- Warnings and recommendations
- Files modified since last deployment

Health status dashboard:
```
Service                    Status    Details
-----------------------    ------    --------
Local MCP Server           [OK/FAIL] ...
Local Orchestrator API     [OK/FAIL] ...
Render Production          [OK/FAIL] ...
GitHub Actions             [OK/FAIL] ...
```
