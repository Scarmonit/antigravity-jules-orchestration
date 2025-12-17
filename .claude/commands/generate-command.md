---
description: Generate optimized Claude CLI commands using best practices and available tools
argument-hint: [task-description]
---

## Task Analysis

The user wants to accomplish: **$ARGUMENTS**

## Input Validation

If `$ARGUMENTS` is empty or unclear:
1. Ask the user to provide a more specific task description
2. Offer example task descriptions like: "review PR for security", "write unit tests", "refactor auth module"
3. Suggest breaking complex tasks into smaller components

## Security Validation

**IMPORTANT**: Before processing `$ARGUMENTS`, scan for potentially dangerous content:

1. **Credential patterns** - Reject if input contains:
   - API keys: `sk-`, `ghp_`, `AKIA`, `xoxb-`, `xoxp-`
   - Secrets: `password=`, `secret=`, `api_key=`, `token=`, `Bearer `
   - Connection strings with embedded credentials

2. **Path traversal patterns** - Reject if input contains:
   - Path traversal: `../`, `..\\`
   - Special characters: `<>:"|?*`

3. **Dangerous flags** - NEVER generate commands with `--dangerously-skip-permissions` unless explicitly authorized

4. **Destructive commands** - Warn if input suggests: `rm -rf`, `del /f /s`, `format`, `DROP TABLE`

If detected, STOP and inform the user: "Security check: Your input appears to contain sensitive data or dangerous operations. Please sanitize before proceeding."

## Your Mission

You are an expert Claude CLI command architect. Generate the most effective Claude command for this task using all available resources.

## Step 1: Research Best Practices

Search for relevant documentation and patterns:
- Use the Task tool with `subagent_type='claude-code-guide'` to find applicable features
- Use Grep to search for patterns in existing `.claude/commands/` files
- Check the project's CLAUDE.md for context-specific guidance

If the claude-code-guide agent is unavailable, use WebSearch to find current Claude CLI best practices.

## Step 2: Check Memory for Patterns

Search the memory MCP server for stored patterns:
```bash
# Use mcp__memory__search_nodes with a query matching the task type
# Example queries: "security review", "test writing", "refactoring"
```

**If no patterns found:** This is normal for new task types. Proceed with generating a fresh command and offer to save it afterward.

## Step 3: Analyze Task Requirements

Determine:
- **Complexity Level**: Simple (haiku), Standard (sonnet), Complex (opus)
- **Tool Needs**: What tools are required? (Read, Edit, Bash, Glob, Grep, Task, etc.)
- **MCP Servers**: Would github, memory, playwright, or fetch MCP servers help?
- **Subagent Type**: Would a specialized agent help? (Explore, Plan, code-reviewer, etc.)

### Model Selection Guide

| Complexity | Model | Model ID | Use When |
|------------|-------|----------|----------|
| Simple | Haiku | claude-3-5-haiku-20241022 | Quick tasks, simple queries |
| Standard | Sonnet | claude-sonnet-4-20250514 | Most development tasks |
| Complex | Opus | claude-opus-4-5-20251101 | Architecture, deep analysis |

## Step 4: Match to Available Skills

Consider which skills/plugins apply:

| Task Type | Recommended Skill |
|-----------|-------------------|
| Frontend/UI | `frontend-design:frontend-design` |
| JS Testing | `javascript-typescript:javascript-testing-patterns` |
| Modern JS | `javascript-typescript:modern-javascript-patterns` |
| Node Backend | `javascript-typescript:nodejs-backend-patterns` |
| TypeScript | `javascript-typescript:typescript-advanced-types` |
| Python Testing | `python-development:python-testing-patterns` |
| Async Python | `python-development:async-python-patterns` |
| Python Packaging | `python-development:python-packaging` |
| Python Performance | `python-development:python-performance-optimization` |
| UV Package Manager | `python-development:uv-package-manager` |
| MCP Servers | `document-skills:mcp-builder` |
| Documentation | `document-skills:doc-coauthoring` |
| PDF/DOCX/PPTX | `document-skills:pdf`, `document-skills:docx`, `document-skills:pptx` |
| Algorithmic Art | `document-skills:algorithmic-art` |
| Canvas Design | `document-skills:canvas-design` |
| Theme Styling | `document-skills:theme-factory` |
| Web Artifacts | `document-skills:web-artifacts-builder` |
| Skill Creation | `document-skills:skill-creator` |

## Step 5: Generate the Command

Output a complete, ready-to-use Claude CLI command with:

```bash
claude [options] "prompt"
```

### Command Options to Consider:
- `--model [model-id]` - Model selection (use full model ID for precision)
- `--allowedTools "Tool1,Tool2"` - Restrict to specific tools
- `-p "prompt"` - Direct prompt (non-interactive mode)
- `--verbose` - Enable detailed output for debugging
- `--output-format [text|json|stream-json]` - Output format control

### Caution Flags:
- `--dangerously-skip-permissions` - **USE WITH CAUTION**: Skips all permission prompts. Only use for trusted, automated workflows in controlled environments.

### Include in your response:

1. **The Command**: Ready to copy/paste
2. **Explanation**: Why each option was chosen
3. **Alternative**: A simpler/more complex variant if applicable
4. **Skill Suggestion**: If a skill should be invoked, explain how

## Step 6: Offer to Save Pattern

Ask the user: "Would you like me to save this command pattern to memory for future reference?"

If yes, use `mcp__memory__create_entities` to store:
```json
{
  "name": "[TaskType]Pattern",
  "entityType": "CLICommandPattern",
  "observations": [
    "Task type: [description]",
    "Recommended model: [model]",
    "Key tools: [tools]",
    "MCP servers: [servers]",
    "Example: [command]",
    "Best practice: [tip]"
  ]
}
```

---

## Example Output Format

### For task: "review a pull request for security issues"

**Recommended Command:**
```bash
claude --model claude-sonnet-4-20250514 -p "Review PR #123 focusing on:
- Security vulnerabilities and OWASP top 10 risks
- Input validation and sanitization
- Authentication and authorization issues
- Secrets or credentials in code

Provide specific line-by-line feedback with severity ratings."
```

**Why this configuration:**
- **Model**: Sonnet provides strong analysis with good speed for code review
- **Prompt Structure**: Multi-line for clarity and comprehensive coverage
- **Approach**: Direct prompt for focused, automated review

**Alternative - Using Slash Command:**
```bash
/pr-review-toolkit:review-pr 123
```
This invokes specialized review agents that handle multiple review aspects in parallel.

**Save to memory?** Would you like me to save this security review pattern for future use?

---

## Troubleshooting

**Command not working?**
- Verify all referenced tools are available in your session
- Check that MCP servers are properly configured
- Ensure model IDs are correct for your Claude version

**No results from memory search?**
- This is normal for first-time use
- The pattern library grows as you save successful commands

**Skill not found?**
- Check available skills with `/help`
- Skills may require specific plugins to be installed

---

## Platform Notes

- **Windows (PowerShell/CMD)**: Use double quotes for strings
- **Windows (MSYS/Git Bash)**: Unix-style commands work
- **Linux/macOS**: Standard bash syntax applies

---
*Compatible with: Claude CLI v1.x*
