# Parallel Codebase Exploration

Explore the codebase in parallel to answer questions or prepare for changes.

## Usage

Use this command with a topic argument:
```
/parallel-explore [topic]
```

## Parallel Agent Tasks

### Agent 1: Core Server Analysis
Explore the main MCP server:
- Read `index.js`
- Understand Express setup
- Map all endpoints
- Document tool implementations

### Agent 2: Orchestrator API Analysis
Explore the orchestrator API:
- Read `orchestrator-api/src/index.js`
- Understand database integration
- Map WebSocket functionality
- Document GitHub webhook handling

### Agent 3: Frontend Analysis
Explore the dashboard:
- Read `dashboard/src/App.jsx`
- Understand React component structure
- Map API integrations
- Document state management

### Agent 4: Scripts & Automation
Explore scripts and automation:
- Read `scripts/jules-auto.js`
- Understand deployment scripts
- Map workflow templates
- Document automation capabilities

### Agent 5: Infrastructure
Explore infrastructure configuration:
- Read `render.yaml`
- Understand GitHub Actions
- Map environment configuration
- Document deployment pipeline

## Output

Provide comprehensive exploration report covering:
- Component interactions
- Data flow
- API dependencies
- Configuration requirements
- Potential improvement areas
