# Antigravity + Jules Orchestration

## Project Overview
**Antigravity + Jules Orchestration** is a comprehensive system designed to orchestrate autonomous AI agents, specifically integrating **Google Antigravity** (browser automation) and **Jules** (coding agent) via the **Model Context Protocol (MCP)**.

The system acts as a central management layer (`agent.scarmonit.com`) that handles task lifecycles, approval flows, and coordination between infrastructure agents (Cloudflare, Render, Docker).

### Architecture
- **Orchestrator (Root):** Node.js-based MCP server and orchestration logic.
- **Jules API (Inner Loop):** A dedicated API service (`orchestrator-api/`) for code execution and repository management.
- **Dashboard:** A React-based web interface (`dashboard/`) for monitoring and manual intervention ("Mission Control").
- **Infrastructure:** Docker Compose setup including PostgreSQL, Redis, Prometheus, and Grafana for local development and monitoring.

## Tech Stack
- **Runtime:** Node.js (ES Modules)
- **Frontend:** React, Vite
- **Backend:** Express (Jules API), Native Node.js (Orchestrator)
- **Database:** PostgreSQL
- **Caching/Queue:** Redis
- **DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, Render

## Key Directories & Files
- `orchestrator-api/`: Source code for the Jules API service.
- `dashboard/`: Source code for the React dashboard.
- `scripts/`: Utility scripts for deployment (`deploy.sh`, `deploy.ps1`), configuration, and testing.
- `generated-artifacts/`: Infrastructure as Code (IaC) files for Kubernetes and Terraform.
- `docker-compose.yml`: Local development environment definition.
- `package.json`: Root configuration, scripts, and dependencies.
- `ARCHITECTURE.md`: Detailed architectural documentation.
- `DEPLOYMENT.md`: Deployment status and guide for Render.

## Development & Usage

### Prerequisites
- Node.js (v18+ recommended)
- Docker & Docker Compose
- Render Account (for deployment)

### Installation
```bash
npm install
```

### Running Locally
**Full Stack (Docker):**
```bash
docker-compose up -d
```

**Orchestrator Only:**
```bash
npm start
```

**Dashboard (Dev Mode):**
```bash
cd dashboard
npm run dev
```

### Key Commands
| Command | Description |
|---------|-------------|
| `npm start` | Starts the main orchestrator/MCP server (`src/index.js`). |
| `npm run start:bridge` | Starts the AI bridge (`src/ai-bridge.js`). |
| `npm run kali:mcp` | Starts the Kali Linux MCP server integration. |
| `npm test` | Runs the test suite (`node --test`). |
| `npm run lint` | Runs ESLint. |
| `npm run format` | Formats code using Prettier. |

### Deployment
The project is configured for deployment on **Render**.
- **Live URL:** `https://scarmonit.com`
- **Deployment Scripts:** See `scripts/` directory for `deploy-render.ps1` or `deploy.sh`.

## Conventions
- **Code Style:** JavaScript ES Modules. Enforced via ESLint and Prettier.
- **Configuration:** Environment variables (support for `.env`). Type-safe config is a goal.
- **Testing:** Native Node.js test runner (`node --test`).
- **MCP Integration:** The system is built around the Model Context Protocol to expose tools and resources to agents.

## Documentation
- `ARCHITECTURE.md`: High-level design and event flows.
- `DEPLOYMENT.md`: Live deployment details and health checks.
- `AGENTS.md`: Definitions of specific agents (Antigravity, Jules).
