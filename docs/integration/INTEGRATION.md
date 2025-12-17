# MCP Client Integration Guide

This guide explains how to connect various AI clients to the Antigravity-Jules Orchestration MCP Server.

**Server URL:** `https://scarmonit.com`

## 1. Claude Desktop Configuration

To use the Jules orchestration tools within Claude Desktop, edit your configuration file:

**Path:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "jules-orchestrator": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sse-client",
        "--url",
        "https://scarmonit.com/mcp/sse"
      ]
    }
  }
}
```
*Note: The current deployment supports HTTP transport. If using a client requiring stdio, you will need a local bridge. For now, most clients support the HTTP/SSE standard.*

### Using HTTP Direct (Cursor / Custom)

If your client supports direct HTTP MCP endpoints:

- **Server URL:** `https://scarmonit.com/mcp`
- **Auth:** No additional auth required (handled by server-side API keys)

## 2. Cursor Integration

1. Open Cursor Settings (`Ctrl+,` or `Cmd+,`).
2. Navigate to **Features** > **MCP**.
3. Click **Add New MCP Server**.
4. Enter:
   - **Name:** Jules Orchestrator
   - **Type:** HTTP / SSE
   - **URL:** `https://scarmonit.com/mcp/sse`

## 3. Google Antigravity Configuration

Antigravity natively supports this orchestration layer.

1. Open **Agent Manager**.
2. Select **MCP Servers**.
3. Add New Server:
   ```json
   {
     "id": "jules",
     "type": "streamable-http",
     "url": "https://scarmonit.com/mcp"
   }
   ```

## Available Tools

Once connected, the following tools will be available to your AI assistant:

| Tool Name | Description | Usage |
|-----------|-------------|-------|
| `jules_create_session` | Initialize a new coding session | "Start a session for repo scarmonit/test" |
| `jules_list_sessions` | View active development sessions | "Show my active Jules sessions" |
| `jules_get_session` | Get detailed status of a session | "Check progress on session 123" |
| `jules_approve_plan` | Approve a proposed change | "Approve the plan for session 123" |

## Troubleshooting

- **Connection Refused:** Ensure the Render service is active (it may spin down on free tier).
- **Tool Error:** Check the `jules_api_key` validity in the Render dashboard.
- **404 Not Found:** Verify you are using the correct endpoint path (`/mcp/sse` or `/mcp` depending on client).
