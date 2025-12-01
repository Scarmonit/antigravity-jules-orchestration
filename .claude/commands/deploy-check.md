# Pre-Deployment Check

Run parallel pre-deployment checks before pushing to the `Scarmonit` branch.

## Parallel Agent Tasks

### Agent 1: Syntax & Lint Check
Check all JavaScript files for syntax errors:
- Verify `index.js` syntax
- Verify `orchestrator-api/src/index.js` syntax
- Verify `orchestration/routes/jules.js` syntax
- Verify `middleware/errorHandler.js` syntax
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

## Output

Provide a deployment readiness report with:
- GO/NO-GO status
- List of blocking issues
- Warnings and recommendations
- Files modified since last deployment
