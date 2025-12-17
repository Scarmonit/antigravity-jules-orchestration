---
description: Save a successful Claude CLI command pattern to memory for future reference
argument-hint: [pattern-name] [task-type] [command-details]
---

## Save Command Pattern to Memory

You are saving a successful Claude CLI command pattern for future use.

**Pattern Details Provided:** $ARGUMENTS

## Security Validation (CRITICAL)

**Before storing ANY pattern, scan for sensitive content:**

1. **Credential patterns** - REJECT if input contains:
   - API keys: `sk-`, `ghp_`, `AKIA`, `xoxb-`, `xoxp-`
   - Secrets: `password=`, `secret=`, `api_key=`, `token=`, `Bearer `
   - Connection strings with credentials

2. **Dangerous commands** - REJECT patterns containing:
   - `--dangerously-skip-permissions`
   - `rm -rf /`, `del /f /s /q`, destructive file operations
   - SQL injection patterns

3. **Pattern name validation** - REJECT names containing:
   - Path traversal: `../`, `..\\`
   - Special characters: `<>:"|?*`

**If any check fails**: STOP immediately and inform the user:
> "Security check failed: The pattern contains potentially sensitive or dangerous content. Please remove credentials/dangerous commands before saving."

## Your Task

1. **Parse the input** to extract:
   - Pattern name (e.g., "SecurityAuditPattern")
   - Task type (e.g., "security audit", "API development")
   - The actual command or approach that worked

2. **Enrich the pattern** with best practice observations:
   - Recommended model
   - Key tools needed
   - MCP servers that help
   - Relevant skills/plugins
   - Example command
   - Tips and best practices

3. **Save to memory** using `mcp__memory__create_entities`:

```json
{
  "name": "[PatternName]",
  "entityType": "CLICommandPattern",
  "observations": [
    "Task type: [type]",
    "Recommended model: [model]",
    "Key tools: [tools]",
    "MCP servers: [servers]",
    "Example: [command]",
    "Best practice: [tip]"
  ]
}
```

4. **Confirm save** and explain how to retrieve this pattern later using `/generate-command`

## Example Usage

User runs: `/learn-pattern APITestPattern api-testing "claude --model sonnet -p 'test all endpoints' with playwright MCP"`

You would save:
```json
{
  "name": "APITestPattern",
  "entityType": "CLICommandPattern",
  "observations": [
    "Task type: API testing",
    "Recommended model: sonnet",
    "Key tools: Bash, WebFetch, Task",
    "MCP servers: playwright for browser testing, fetch for API calls",
    "Example: claude --model sonnet -p 'Test all API endpoints for correct responses'",
    "Best practice: Use playwright MCP for integration tests, sequential-thinking for complex test scenarios"
  ]
}
```

Then confirm: "Pattern 'APITestPattern' saved! Next time you run `/generate-command api testing`, this pattern will be used as a reference."
