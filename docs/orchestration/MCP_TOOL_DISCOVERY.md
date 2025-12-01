# MCP Tool Discovery & Orchestration Guide

## Overview

This document describes the structured workflow for discovering, cataloging, and orchestrating MCP (Model Context Protocol) tools. The workflow ensures systematic tool discovery and optimal tool chain execution for autonomous development tasks.

## 6-Step Orchestration Workflow

### Step 1: Sequential Thinking - Define Objectives

**Purpose:** Establish a clear mental model before taking any action.

**Actions:**
- Define the overall task objective
- Establish success criteria
- Create initial mental model of what's needed
- Identify what information must be gathered first

**Example:**
```
Objective: Automate code review and PR creation for a bug fix
Success Criteria:
  - Bug is identified and understood
  - Fix is implemented correctly
  - Tests pass
  - PR is created with proper description
Initial Model:
  - Need repository access (jules_list_sources)
  - Need to create coding session (jules_create_session)
  - Need to track progress (jules_get_activities)
```

### Step 2: Fetch MCP Documentation

**Purpose:** Understand MCP patterns and best practices for tool chaining.

**Actions:**
- Resolve library IDs for MCP-related documentation
- Fetch documentation on Model Context Protocol patterns
- Review best practices for tool chaining and orchestration

**Key MCP Concepts:**
- **Tools**: Functions exposed by MCP servers that can be invoked
- **Resources**: Data sources that can be read/subscribed to
- **Prompts**: Pre-defined interaction templates
- **Transport**: Communication protocol (HTTP, stdio, etc.)

### Step 3: Inventory MCP Servers

**Purpose:** Enumerate all connected MCP servers and catalog their capabilities.

**Actions:**
1. List all connected MCP servers
2. For each server, catalog:
   - Tool names and descriptions
   - Input parameters (types, required/optional)
   - Output types and formats
   - Tool dependencies and relationships

**Jules MCP Server Tools Inventory:**

| Tool Name | Description | Input Parameters | Output |
|-----------|-------------|------------------|--------|
| `jules_list_sources` | List connected GitHub repositories | None | Array of source objects |
| `jules_create_session` | Create autonomous coding session | prompt*, source*, branch, title, requirePlanApproval, automationMode | Session object |
| `jules_list_sessions` | List all Jules sessions | None | Array of session objects |
| `jules_get_session` | Get specific session details | sessionId* | Session object |
| `jules_send_message` | Send message to session | sessionId*, message* | Message response |
| `jules_approve_plan` | Approve execution plan | sessionId* | Approval confirmation |
| `jules_get_activities` | Get session activities | sessionId* | Array of activity objects |

*Required parameters marked with asterisk

### Step 4: Sequential Thinking - Plan Execution

**Purpose:** Break down the task into discrete steps with tool mappings.

**Actions:**
1. Break down the task into discrete steps
2. Map which MCP tool handles each step
3. Identify dependencies between steps
4. Plan optimal execution order
5. Anticipate failure points and design fallbacks

**Example Execution Plan:**
```
Task: Implement new API endpoint

Steps:
1. [jules_list_sources] → Get available repositories
   - Fallback: Manual source specification
   
2. [jules_create_session] → Create coding session
   - Depends on: Step 1 (source name)
   - Fallback: Retry with different branch
   
3. [jules_get_activities] → Monitor progress (polling)
   - Depends on: Step 2 (session ID)
   
4. [jules_approve_plan] → Approve when plan is ready
   - Depends on: Step 3 (plan state)
   
5. [jules_get_session] → Get final status
   - Depends on: Step 4 (completion)
```

### Step 5: Design Tool Chain

**Purpose:** Create explicit tool chain diagram showing data flow.

**Tool Chain Notation:**
```
[Tool A] → output_field → [Tool B] → output_field → [Tool C] → result
```

**Example Chain - Bug Fix Workflow:**
```
[jules_list_sources]
        │
        ▼
    sources[]
        │
        ▼
[jules_create_session]
   prompt: "Fix bug #123"
   source: sources[0].name
        │
        ▼
    sessionId
        │
        ├──────────────────────────────┐
        ▼                              ▼
[jules_get_activities]          [jules_get_session]
   (poll for plan)                 (check state)
        │                              │
        ▼                              ▼
   plan_ready?                    state == PLAN_READY
        │
        ▼
[jules_approve_plan]
        │
        ▼
    approved
        │
        ▼
[jules_get_activities]
   (poll until complete)
        │
        ▼
    COMPLETED
```

### Step 6: Execute Chain

**Purpose:** Run the planned chain autonomously, adjusting based on results.

**Execution Principles:**
1. **Sequential execution** for dependent operations
2. **Parallel execution** for independent queries
3. **Error handling** at each step
4. **Progress tracking** with intermediate logging
5. **Adaptive adjustment** based on intermediate results

**Execution Example:**
```javascript
async function executeBugFixWorkflow(bugDescription) {
  // Step 1: Get sources
  const sources = await mcpExecute('jules_list_sources');
  if (!sources.sources?.length) throw new Error('No sources available');
  
  // Step 2: Create session
  const session = await mcpExecute('jules_create_session', {
    prompt: bugDescription,
    source: sources.sources[0].name,
    requirePlanApproval: true
  });
  
  // Step 3: Poll for plan
  let state = 'PENDING';
  while (state !== 'PLAN_READY' && state !== 'COMPLETED') {
    await sleep(5000);
    const status = await mcpExecute('jules_get_session', {
      sessionId: session.name
    });
    state = status.state;
  }
  
  // Step 4: Approve if needed
  if (state === 'PLAN_READY') {
    await mcpExecute('jules_approve_plan', {
      sessionId: session.name
    });
  }
  
  // Step 5: Wait for completion
  while (state !== 'COMPLETED') {
    await sleep(10000);
    const status = await mcpExecute('jules_get_session', {
      sessionId: session.name
    });
    state = status.state;
  }
  
  return status;
}
```

## Tool Dependencies Matrix

| Tool | Depends On | Provides For |
|------|------------|--------------|
| `jules_list_sources` | None | `jules_create_session` |
| `jules_create_session` | `jules_list_sources` | All session-based tools |
| `jules_list_sessions` | None | Reference/Discovery |
| `jules_get_session` | `jules_create_session` | `jules_approve_plan`, monitoring |
| `jules_send_message` | `jules_create_session` | Interactive guidance |
| `jules_approve_plan` | `jules_get_session` (plan ready) | Execution continuation |
| `jules_get_activities` | `jules_create_session` | Progress monitoring |

## Error Handling Patterns

### Retry with Backoff
```javascript
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(baseDelay * Math.pow(2, i));
    }
  }
}
```

### Graceful Degradation
```javascript
async function getSourceWithFallback(preferredRepo) {
  try {
    const sources = await mcpExecute('jules_list_sources');
    const preferred = sources.sources.find(s => s.name.includes(preferredRepo));
    return preferred || sources.sources[0];
  } catch (error) {
    console.warn('Could not fetch sources, using manual specification');
    return { name: `sources/github/${preferredRepo}` };
  }
}
```

## Integration with Antigravity

The Jules MCP Server integrates with Google Antigravity's Agent Manager:

```json
{
  "mcpServers": {
    "jules": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:3323/mcp"
    }
  }
}
```

This enables Antigravity agents to:
1. Discover Jules tools via `/mcp/tools`
2. Execute tools via `/mcp/execute`
3. Chain tools for complex workflows

## Best Practices

1. **Always start with sequential thinking** - Define objectives before execution
2. **Inventory tools before chaining** - Know what's available
3. **Map dependencies explicitly** - Understand data flow
4. **Build in error handling** - Plan for failures
5. **Monitor progress continuously** - Use activity tracking
6. **Log all decisions** - Enable debugging and auditing
