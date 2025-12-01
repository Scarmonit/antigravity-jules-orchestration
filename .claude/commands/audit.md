# Full Repository Audit

Run a comprehensive parallel audit of the entire repository. Execute these tasks in parallel using multiple agents:

## Parallel Agent Tasks

### Agent 1: Security Audit
Analyze all source files for security vulnerabilities:
- Check for hardcoded secrets or API keys
- Review authentication/authorization patterns
- Scan for injection vulnerabilities (SQL, command, XSS)
- Verify CORS configuration
- Check environment variable handling

### Agent 2: Code Quality Review
Review code quality across all components:
- Check error handling patterns in `index.js`, `orchestrator-api/src/index.js`, `middleware/errorHandler.js`
- Review async/await usage and promise handling
- Verify consistent code style
- Check for code duplication
- Review logging practices

### Agent 3: Dependency Analysis
Analyze package dependencies:
- Check `package.json` for outdated dependencies
- Check `orchestrator-api/package.json` for outdated dependencies
- Check `dashboard/package.json` for outdated dependencies
- Identify security vulnerabilities in dependencies
- Review for unused dependencies

### Agent 4: API Endpoint Review
Review all API endpoints:
- Verify `/health`, `/mcp/tools`, `/mcp/execute` endpoints
- Check request validation
- Review response formats
- Check rate limiting
- Verify proper HTTP status codes

### Agent 5: Documentation Completeness
Check documentation coverage:
- Review README.md accuracy
- Check all markdown files for outdated information
- Verify API documentation matches implementation
- Check workflow template documentation

## Output Format

Provide a consolidated audit report with:
1. Critical issues requiring immediate attention
2. Security recommendations
3. Code quality improvements
4. Dependency updates needed
5. Documentation gaps
