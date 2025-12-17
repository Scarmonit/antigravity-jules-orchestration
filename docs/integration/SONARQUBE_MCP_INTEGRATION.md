# SonarQube MCP Server Integration

## Overview

Integration guide for adding SonarQube MCP Server to the Antigravity-Jules orchestration system. This enables automated code quality analysis, security scanning, and continuous compliance monitoring within the autonomous development workflow.

## Architecture

### SonarQube MCP Server
- **Purpose**: Bridge between AI assistants and SonarQube for code analysis
- **Protocol**: Model Context Protocol (MCP) over Docker/HTTP
- **Version**: 1.3.0+ (Latest release)
- **Language**: Java-based server with Gradle build system

### Integration Points
1. **Docker Compose**: Multi-container orchestration with sonarqube-mcp service
2. **MCP Client Configuration**: Add sonarqube server to Claude/Copilot MCP config
3. **Jules Orchestrator**: Integrate quality gates into automated coding sessions
4. **CI/CD Pipeline**: Pre-merge quality checks and security scans

## Installation

### 1. Docker-Based Setup (Recommended)

Add to `docker-compose.yml`:

```yaml
services:
  sonarqube-mcp:
    image: mcp/sonarqube:latest
    container_name: sonarqube-mcp-server
    ports:
      - "8080:8080"
    environment:
      # For SonarQube Cloud
      SONARQUBE_TOKEN: ${SONARQUBE_TOKEN}
      SONARQUBE_ORG: ${SONARQUBE_ORG}
      # For SonarQube Server
      # SONARQUBE_URL: ${SONARQUBE_URL}
      SONARQUBE_TRANSPORT: http
      SONARQUBE_HTTP_HOST: 0.0.0.0
      SONARQUBE_HTTP_PORT: 8080
      # Optional: SonarQube for IDE integration
      SONARQUBE_IDE_PORT: ${SONARQUBE_IDE_PORT:-64120}
    networks:
      - jules-network
    restart: unless-stopped
```

### 2. Environment Variables

Add to `.env` file:

```bash
# SonarQube Cloud Configuration
SONARQUBE_TOKEN=your_sonarqube_token_here
SONARQUBE_ORG=your_organization_key

# Or for SonarQube Server
# SONARQUBE_URL=https://your-sonarqube-instance.com
# SONARQUBE_TOKEN=your_user_token_here

# Optional IDE Integration
SONARQUBE_IDE_PORT=64120
```

### 3. MCP Client Configuration

#### For Claude Desktop/Claude Code

Add to `claude_desktop_config.json` or `.claude/config.json`:

```json
{
  "mcpServers": {
    "sonarqube": {
      "url": "http://127.0.0.1:8080/mcp",
      "headers": {
        "SONARQUBE_TOKEN": "your_token_here"
      }
    }
  }
}
```

#### For GitHub Copilot

Add to `.github/copilot/mcp_servers.json`:

```json
{
  "sonarqube": {
    "url": "http://localhost:8080/mcp",
    "headers": {
      "SONARQUBE_TOKEN": "${SONARQUBE_TOKEN}"
    }
  }
}
```

## Available MCP Tools

### Code Analysis
- **analyze_code_snippet**: Analyze code without project context
- **analyze_file_list**: Analyze specific files via SonarQube for IDE
- **toggle_automatic_analysis**: Enable/disable real-time analysis

### Project Management
- **search_my_sonarqube_projects**: List accessible projects
- **get_component_measures**: Retrieve metrics for components
- **list_languages**: Show supported programming languages

### Issue Management
- **search_sonar_issues_in_projects**: Query code quality issues
- **change_sonar_issue_status**: Mark as false positive/accept/reopen
- **search_dependency_risks**: Find security vulnerabilities in dependencies

### Quality Gates
- **get_project_quality_gate_status**: Check quality gate pass/fail
- **list_quality_gates**: View configured quality gates

### Rules & Metrics
- **show_rule**: Get detailed rule information
- **list_rule_repositories**: Browse rule sources
- **search_metrics**: Query available metrics

### Source Code Access
- **get_raw_source**: Retrieve file contents from SonarQube
- **get_scm_info**: Get SCM/git blame information

## Integration with Jules Orchestrator

### Automated Quality Checks

Add quality gate validation to Jules sessions:

```javascript
// In orchestration/jules-routes.js
async function createJulesSession(repoUrl, task) {
  const session = await julesApi.createSession(repoUrl, task);
  
  // Trigger SonarQube analysis after code generation
  await mcpClient.call('sonarqube', 'analyze_file_list', {
    file_absolute_paths: session.modifiedFiles
  });
  
  // Check quality gate status
  const qgStatus = await mcpClient.call('sonarqube', 
    'get_project_quality_gate_status', {
      projectKey: session.projectKey
    }
  );
  
  if (qgStatus.status !== 'OK') {
    await session.sendMessage('Quality gate failed. Review issues before merging.');
  }
  
  return session;
}
```

### Pre-Merge Validation Template

Create `templates/quality-gate-validation.json`:

```json
{
  "name": "quality-gate-validation",
  "description": "Automated quality gate validation before merge",
  "trigger": {
    "event": "pull_request.opened",
    "conditions": ["base_branch == 'main'"]
  },
  "steps": [
    {
      "action": "sonarqube.analyze_file_list",
      "params": {
        "file_absolute_paths": "{{pr.changed_files}}"
      }
    },
    {
      "action": "sonarqube.get_project_quality_gate_status",
      "params": {
        "projectKey": "{{repository.sonarqube_key}}",
        "pullRequest": "{{pr.number}}"
      }
    },
    {
      "action": "conditional",
      "condition": "quality_gate.status != 'OK'",
      "then": [
        {
          "action": "github.comment",
          "params": {
            "body": "❌ Quality gate failed. Address issues before merging."
          }
        },
        {
          "action": "github.request_changes",
          "params": {
            "body": "Code quality issues detected by SonarQube."
          }
        }
      ]
    }
  ]
}
```

## Multi-Model Code Quality Strategy

### Integration with Other AI Models

```javascript
// Coordinate quality analysis across multiple AI services
const qualityOrchestration = {
  // SonarQube: Static analysis and security
  sonarqube: ['code_analysis', 'security_scan', 'quality_gates'],
  
  // Lingma/Qwen: Code generation with built-in quality checks
  lingma: ['code_completion', 'refactoring', 'test_generation'],
  
  // Claude: Architecture review and complex refactoring
  claude: ['architecture_review', 'security_audit', 'documentation'],
  
  // Jules: Automated implementation with SonarQube integration
  jules: ['code_generation', 'quality_enforcement', 'auto_merge']
};
```

## Deployment Strategy

### Local Development
```bash
# Start SonarQube MCP alongside Jules orchestrator
docker-compose up sonarqube-mcp jules-orchestrator

# Verify MCP server is accessible
curl http://localhost:8080/mcp/health
```

### Render Deployment

Add to `render.yaml`:

```yaml
services:
  - type: web
    name: sonarqube-mcp
    runtime: docker
    dockerfilePath: ./Dockerfile.sonarqube
    envVars:
      - key: SONARQUBE_TOKEN
        sync: false
      - key: SONARQUBE_ORG
        sync: false
      - key: SONARQUBE_TRANSPORT
        value: http
      - key: SONARQUBE_HTTP_HOST
        value: 0.0.0.0
      - key: SONARQUBE_HTTP_PORT
        value: 8080
```

## Security Considerations

### Token Management
- Store SonarQube tokens in environment variables (`.env.render`)
- Use scoped organization tokens (SOT) for SonarQube Cloud
- Rotate tokens every 90 days
- Never commit tokens to Git

### Network Security
- Use HTTPS transport in production
- Configure custom SSL certificates for on-premise SonarQube Server
- Restrict MCP server access to internal network
- Enable telemetry monitoring: `TELEMETRY_DISABLED=false`

### Data Privacy
- SonarQube MCP collects anonymous usage data
- No source code or IP addresses are transmitted
- Disable telemetry if required: `TELEMETRY_DISABLED=true`

## Monitoring & Troubleshooting

### Health Checks
```bash
# Check MCP server status
curl http://localhost:8080/mcp/ping

# View server logs
docker logs sonarqube-mcp-server

# Check storage path
ls -la /var/sonarqube-mcp/logs/
```

### Common Issues

**Issue**: Connection timeout to SonarQube
```bash
# Solution: Verify token and organization
echo $SONARQUBE_TOKEN
echo $SONARQUBE_ORG
```

**Issue**: Quality gate always fails
```bash
# Solution: Check quality gate configuration
curl -H "Authorization: Bearer $SONARQUBE_TOKEN" \
  https://sonarcloud.io/api/qualitygates/show?organization=$SONARQUBE_ORG
```

**Issue**: MCP tools not appearing in Claude
```bash
# Solution: Restart Claude Desktop and verify config
cat ~/.config/Claude/claude_desktop_config.json
```

## Next Steps

1. ✅ **Deploy SonarQube MCP**: Add to docker-compose.yml
2. ✅ **Configure MCP Clients**: Update Claude/Copilot configs
3. ✅ **Create Quality Templates**: Add quality-gate-validation.json
4. ✅ **Integrate with Jules**: Add quality checks to orchestrator
5. ✅ **Setup CI/CD**: Add pre-merge quality gates
6. ✅ **Monitor & Iterate**: Track quality metrics over time

## Resources

- [SonarQube MCP Server GitHub](https://github.com/SonarSource/sonarqube-mcp-server)
- [SonarQube MCP Documentation](https://docs.sonarsource.com/sonarqube-mcp-server)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)
- [SonarQube Web API](https://docs.sonarsource.com/sonarqube-server/extension-guide/web-api)
- [Docker MCP Toolkit](https://www.docker.com/blog/mcp-toolkit-mcp-servers-that-just-work/)

## License

SonarQube MCP Server: SONAR Source-Available License v1.0
Jules Orchestration: MIT License

---

**Last Updated**: December 3, 2025
**Version**: 1.0.0
**Author**: Scarmonit (scarmonit@gmail.com)
