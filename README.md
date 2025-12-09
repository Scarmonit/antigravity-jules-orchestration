# Antigravity-Jules Orchestration

## Overview
Autonomous AI orchestration architecture combining **Google Antigravity** with the **Jules API** for hands-free development workflows. This system leverages the Model Context Protocol (MCP) for seamless agent coordination.

## Architecture Components

### 1. Google Antigravity Integration
- **Browser Subagent**: Specialized model for browser automation with DOM capture, screenshots, and video recording
- **Agent Modes**: Planning mode for complex tasks with task groups and artifacts; Fast mode for simple operations
- **Workspace Management**: Multi-workspace support with parallel conversation execution
- **Task Lists & Implementation Plans**: Structured approach to complex tasks with approval workflows
- **MCP Store Integration**: Built-in support for connecting to external services and databases

### 2. Jules API Connection
- **Autonomous Coding Sessions**: Create and manage Jules coding sessions directly from AI assistants
- **GitHub Integration**: Connect to repositories through Jules sources
- **Plan Approval Workflow**: Review and approve execution plans before changes
- **Real-time Activity Tracking**: Monitor session progress with detailed activity logs
- **MCP Bridge**: Jules MCP server acts as bridge between AI assistants and Jules API

### 3. MCP Integration Layer
- **Custom MCP Server**: Node.js-based server using Streamable HTTP transport
- **Type-safe Validation**: Zod schemas for runtime validation of all inputs
- **Stateless Architecture**: Optimized for compatibility with multiple MCP clients
- **Tools Available**:
  - `jules_list_sources` - List connected GitHub sources
  - `jules_create_session` - Create new coding sessions
  - `jules_list_sessions` - List all sessions
  - `jules_approve_plan` - Approve execution plans
  - `jules_send_message` - Send messages to active agents
  - `jules_list_activities` - Monitor session activities

## v2.0.0 Features

### GitHub Issue Integration
- **`jules_create_from_issue`**: Creates a Jules session from a GitHub issue.
  - **Endpoint**: `POST /mcp/execute`
  - **Body**:
    ```json
    {
      "tool": "jules_create_from_issue",
      "parameters": {
        "owner": "your-github-org",
        "repo": "your-repo-name",
        "issueNumber": 123
      }
    }
    ```
- **`jules_batch_from_labels`**: Creates Jules sessions from all issues with a given set of labels.
  - **Endpoint**: `POST /mcp/execute`
  - **Body**:
    ```json
    {
      "tool": "jules_batch_from_labels",
      "parameters": {
        "owner": "your-github-org",
        "repo": "your-repo-name",
        "label": "bug"
      }
    }
    ```

### Batch Processing
- **`jules_batch_create`**: Creates a batch of Jules sessions from a list of tasks.
  - **Endpoint**: `POST /mcp/execute`
  - **Body**:
    ```json
    {
      "tool": "jules_batch_create",
      "parameters": {
        "tasks": [
          {
            "prompt": "Fix a bug",
            "source": "sources/github/your-github-org/your-repo-name"
          },
          {
            "prompt": "Implement a feature",
            "source": "sources/github/your-github-org/your-repo-name"
          }
        ]
      }
    }
    ```
- **`jules_batch_status`**: Checks the status of a batch of Jules sessions.
  - **Endpoint**: `POST /mcp/execute`
  - **Body**:
    ```json
    {
      "tool": "jules_batch_status",
      "parameters": {
        "batchId": "your-batch-id"
      }
    }
    ```
- **`jules_batch_approve_all`**: Approves all sessions in a batch.
  - **Endpoint**: `POST /mcp/execute`
  - **Body**:
    ```json
    {
      "tool": "jules_batch_approve_all",
      "parameters": {
        "batchId": "your-batch-id"
      }
    }
    ```

### Session Monitoring
- **`jules_monitor_all`**: Monitors all active Jules sessions.
  - **Endpoint**: `GET /api/sessions/active`
- **`jules_session_timeline`**: Gets a timeline of events for a Jules session.
  - **Endpoint**: `GET /api/sessions/:id/timeline`

## Workflow Architecture

### Autonomous Development Loop
1. **Task Initiation**: User provides high-level task in Antigravity
2. **Planning Phase**: Antigravity agent creates implementation plan with task groups
3. **Jules Session Creation**: MCP server creates Jules coding session with appropriate source
4. **Parallel Execution**: 
   - Antigravity manages browser automation and UI interactions
   - Jules handles code generation and repository modifications
5. **Progress Monitoring**: Real-time activity tracking across both systems
6. **Approval Gates**: Implementation plans reviewed before execution
7. **Completion**: Changes merged, tests executed, documentation updated

## Contents

*   **[ARCHITECTURE.md](ARCHITECTURE.md)**: Detailed overview of the system design, event triggers, and integration points.
*   **[docs/orchestration/](docs/orchestration/)**: MCP Tool Discovery & Orchestration documentation.
    *   `MCP_TOOL_DISCOVERY.md`: Comprehensive guide for tool discovery and chaining.
    *   `ORCHESTRATION_PROMPT.md`: Prompt template for AI assistant orchestration.
*   **[templates/](templates/)**: JSON definitions for concrete workflows.
    *   `dependency-update.json`: Weekly automated dependency maintenance.
    *   `bugfix-from-issue.json`: Triggered by `bug-auto` label, requires approval.
    *   `feature-implementation.json`: Triggered by `@jules implement` comment.
    *   `security-patch.json`: High-priority auto-fix for security vulnerabilities.
    *   `documentation-sync.json`: Automated documentation updates on push to main.

## Usage

These templates are designed to be consumed by the `agent.scarmonit.com` orchestrator to spawn Jules instances.

## Installation

### Prerequisites
- Node.js v18+
- Google Antigravity installed ([download](https://antigravity.google/download))
- Jules API account with API key
- GitHub account with connected repositories

### Setup Steps

1. **Clone Repository**
```bash
git clone https://github.com/Scarmonit/antigravity-jules-orchestration.git
cd antigravity-jules-orchestration
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env and add:
# JULES_API_KEY=your_api_key_here
# PORT=3323
# HOST=127.0.0.1
```

4. **Start MCP Server**
```bash
npm run dev
```

5. **Configure Antigravity**
- Open Antigravity
- Navigate to Agent Manager → MCP Servers
- Add configuration:
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

## License
MIT License

## Contact
- Email: Scarmonit@gmail.com
- GitHub: [@Scarmonit](https://github.com/Scarmonit)

## 🚀 AI Model Integrations

### Alibaba Cloud Lingma + Qwen

**Status**: ✅ Integrated (December 2025)

The orchestration now includes **Alibaba Cloud Lingma AI Coding Assistant** and **Qwen LLM models** for enhanced development capabilities.

#### Key Features:
- **IDE-Native Coding**: Lingma VS Code extension (1.9M+ installs, 3.9/5 rating)
- **Free Tier**: 1,000,000 AI tokens via Model Studio
- **Models**: Qwen3-Max, Qwen-Plus, Qwen-MT-Plus, and more
- **ISO 42001 Certified**: Enterprise-grade security

#### Integration Tiers:
1. **Tier 1 - IDE**: Real-time code completion, Ask/Edit/Agent modes
2. **Tier 2 - API**: Custom orchestration via Qwen API endpoints
3. **Tier 3 - Cloud**: ECS instances, Object Storage, Cloud Shell

#### Resources:
- 📄 [Full Integration Guide](ALIBABA_LINGMA_INTEGRATION.md)
- 🔗 [Lingma Product Page](https://www.alibabacloud.com/en/product/lingma)
- 🎯 [Model Studio Console](https://modelstudio.console.alibabacloud.com/)
- 📦 [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=Alibaba-Cloud.tongyi-lingma)

### Multi-Model Strategy

The orchestration uses a hybrid approach:
- **Lingma/Qwen**: IDE-native completion, multi-file edits, code generation
- **Claude**: Complex reasoning, architecture design, code review
- **GPT**: Natural language tasks, documentation, creative problem solving
- **Jules**: Repository modifications, automated coding sessions

This multi-model approach maximizes strengths while minimizing costs and latency.

---
