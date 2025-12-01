# MCP Orchestration Prompt Template

This document defines the structured prompt template for AI assistants to discover, catalog, and orchestrate MCP tools effectively.

## Prompt Template

```markdown
# MCP Tool Discovery & Orchestration Prompt

IMPORTANT: You MUST call tools in the order specified. Do not skip steps.

## Step 1: CALL Sequential Thinking FIRST
→ IMMEDIATELY call the sequential_thinking tool before doing anything else.

Use it to:
- Define the overall task objective
- Establish success criteria  
- Create initial mental model of what's needed
- Identify what information must be gathered first

## Step 2: CALL Context7
→ Call resolve-library-id then get-library-docs for MCP documentation.

Fetch documentation on MCP (Model Context Protocol) patterns and best practices for tool chaining.

## Step 3: Inventory Your MCP Servers
Enumerate every connected MCP server and catalog their tools:
- List all tool names, descriptions, and parameters
- Note input/output types for each tool
- Identify which tools can feed into others

## Step 4: CALL Sequential Thinking Again
→ Call sequential_thinking tool a second time.

Use it to:
- Break down the task into discrete steps
- Map which MCP tool handles each step
- Identify dependencies between steps
- Plan the optimal execution order
- Anticipate failure points and design fallbacks

## Step 5: Design the Chain
Create a tool chain diagram:
[Tool A] → output → [Tool B] → output → [Tool C] → result

## Step 6: Execute
Run the planned chain autonomously, adjusting based on intermediate results.
```

## Implementation Notes

### When to Use This Template

Use this orchestration prompt when:
1. Discovering available MCP tools in a new environment
2. Planning complex multi-tool workflows
3. Debugging tool chain failures
4. Documenting tool dependencies

### Expected Tool Inventory Output

For the Jules MCP Server, Step 3 should produce:

```json
{
  "server": "jules-orchestration",
  "url": "http://localhost:3323",
  "tools": [
    {
      "name": "jules_list_sources",
      "description": "List all connected GitHub repositories (sources)",
      "parameters": {},
      "outputs": ["sources[]"],
      "feedsInto": ["jules_create_session"]
    },
    {
      "name": "jules_create_session",
      "description": "Create a new Jules coding session for autonomous development",
      "parameters": {
        "prompt": { "type": "string", "required": true },
        "source": { "type": "string", "required": true },
        "branch": { "type": "string", "required": false },
        "title": { "type": "string", "required": false },
        "requirePlanApproval": { "type": "boolean", "required": false },
        "automationMode": { "type": "string", "required": false }
      },
      "outputs": ["session.name", "session.state"],
      "feedsInto": ["jules_get_session", "jules_send_message", "jules_approve_plan", "jules_get_activities"]
    },
    {
      "name": "jules_list_sessions",
      "description": "List all Jules sessions",
      "parameters": {},
      "outputs": ["sessions[]"],
      "feedsInto": ["jules_get_session"]
    },
    {
      "name": "jules_get_session",
      "description": "Get details of a specific session",
      "parameters": {
        "sessionId": { "type": "string", "required": true }
      },
      "outputs": ["session.state", "session.plan", "session.result"],
      "feedsInto": ["jules_approve_plan", "decision logic"]
    },
    {
      "name": "jules_send_message",
      "description": "Send a message to an existing Jules session",
      "parameters": {
        "sessionId": { "type": "string", "required": true },
        "message": { "type": "string", "required": true }
      },
      "outputs": ["messageResponse"],
      "feedsInto": []
    },
    {
      "name": "jules_approve_plan",
      "description": "Approve a session plan to allow execution",
      "parameters": {
        "sessionId": { "type": "string", "required": true }
      },
      "outputs": ["approvalConfirmation"],
      "feedsInto": ["jules_get_session", "jules_get_activities"]
    },
    {
      "name": "jules_get_activities",
      "description": "Get activities/events for a session",
      "parameters": {
        "sessionId": { "type": "string", "required": true }
      },
      "outputs": ["activities[]"],
      "feedsInto": ["monitoring decisions"]
    }
  ]
}
```

### Example Tool Chain Diagram (Step 5)

```
Feature Implementation Workflow:

                    ┌─────────────────────┐
                    │  jules_list_sources │
                    └──────────┬──────────┘
                               │
                        sources[].name
                               │
                               ▼
                    ┌─────────────────────┐
                    │ jules_create_session│
                    │  prompt: task desc  │
                    │  source: repo name  │
                    │  approval: true     │
                    └──────────┬──────────┘
                               │
                          session.name
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
    │jules_get_session│ │ (wait loop)  │ │jules_get_activities│
    └────────┬────────┘ └──────────────┘ └────────┬─────────┘
             │                                     │
       session.state                        activities[]
             │                                     │
             └──────────────┬──────────────────────┘
                            │
                    state == PLAN_READY?
                            │
                    ┌───────┴───────┐
                    │      YES      │
                    ▼               │
          ┌─────────────────┐       │
          │jules_approve_plan│      │
          └────────┬────────┘       │
                   │                │
                   └────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ poll until   │
                    │ COMPLETED    │
                    └──────────────┘
                            │
                            ▼
                       RESULT
```

## Validation Checklist

After executing the orchestration prompt, verify:

- [ ] Sequential thinking was called FIRST
- [ ] MCP documentation was retrieved
- [ ] All MCP tools were inventoried with:
  - [ ] Tool names
  - [ ] Descriptions  
  - [ ] Parameter types (required/optional)
  - [ ] Output types
  - [ ] Tool dependencies
- [ ] Sequential thinking was called SECOND for planning
- [ ] Tool chain diagram was created
- [ ] Execution plan includes:
  - [ ] Step sequence
  - [ ] Error handling
  - [ ] Fallback strategies
- [ ] Chain was executed successfully

## Testing the Prompt

Run the test script to validate the orchestration workflow:

```bash
# Start the server first
npm run dev

# In another terminal, run tests
./scripts/test-mcp-orchestration.sh
```

## Troubleshooting

### Common Issues

1. **Tools not discovered**: Ensure MCP server is running at configured URL
2. **Execution fails**: Check JULES_API_KEY is configured
3. **Chain breaks**: Review dependencies in tool inventory
4. **Timeout errors**: Increase polling intervals for long-running tasks
