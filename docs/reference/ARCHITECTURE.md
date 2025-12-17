# Antigravity + Jules API Orchestration Architecture

## 1. Overview
This project defines the orchestration architecture integrating **Google Jules API** as the core asynchronous coding executor within the **Scarmonit** ecosystem. The system leverages `agent.scarmonit.com` as the central orchestration layer, managing task lifecycles and coordinating with existing infrastructure agents (Cloudflare, Render, Docker).

## 2. High-Level Orchestration Shape
*   **Core Executor**: **Jules API** operates as the "inner loop" coding engine. It is responsible for:
    *   Cloning repositories.
    *   Analyzing project context.
    *   Generating execution plans.
    *   Applying code changes in secure environments.
    *   Creating Pull Requests.
*   **Orchestration Layer**: **agent.scarmonit.com** acts as the thin management layer. It:
    *   Translates incoming events (GitHub, Webhooks) into Jules tasks.
    *   Manages approval flows (Plan -> Approve -> Execute).
    *   Logs decisions and task history.
    *   Exposes a "Mission Control" dashboard for manual intervention.
*   **Infra Agents (Peers)**: Existing agents (Cloudflare, Render, Docker, Zapier) function as peer tools invoked via hooks:
    *   **Pre-run**: Environment setup, config updates.
    *   **Post-run**: Trigger deployments, run integration tests, notify external systems.

## 3. Event Sources & Triggers
The system is event-driven, reacting to multiple sources:

### GitHub Events
*   **Label**: `jules-auto` -> Triggers automated maintenance tasks.
*   **Comment**: `@jules plan this` -> Triggers planning mode for specific issues.
*   **Review**: PR review comments -> Triggers automated fixes or adjustments.

### Monitoring & External
*   **Sentry/Observability**: Webhooks from monitoring tools can trigger remediation tasks (e.g., dependency bumps, simple bug fixes).
*   **CI/CD**: Build failures can trigger analysis tasks.

### Manual Control
*   **Mission Control**: A web interface on `agent.scarmonit.com` allowing operators to:
    *   Start/Stop tasks.
    *   Inspect generated plans.
    *   Override workflows.
    *   Chain multiple agents (e.g., "Stabilize Service X").

## 4. Core Task Types

### A. Code Maintenance
*   **Scope**: Dependency updates, security patches, mechanical refactors, coverage improvements.
*   **Flow**: Event -> Auto-Plan -> Auto-Execute (low risk) or Review Gate -> PR.

### B. Feature Work
*   **Scope**: Bounded feature requests.
*   **Flow**: Event -> Generate Plan -> **Explicit Approval** -> Implementation -> Tests -> PR.

### C. Documentation & Meta
*   **Scope**: Auto-generated API docs, changelogs, architecture digests.
*   **Flow**: Post-Merge Event -> Analyze Changes -> Generate Docs -> Commit/PR.

## 5. Control, Safety, & Review
*   **Approval Gates**: Non-trivial tasks require a "Plan Approved" state before code modification.
*   **Scoping**:
    *   **High-Risk** (Infra/Auth): Constrained templates, strict approval.
    *   **Low-Risk** (UI/Docs): Broader autonomy.
*   **Review Standard**: All Jules output is delivered via Pull Requests, subject to standard CI/CD and human review.

## 6. Integration Stack
*   **Outer Loop**: Browser automation, Zapier, Multi-LLM coordination.
*   **Inner Loop**: Jules API (Coding).
*   **Surface**: `agent.scarmonit.com` (Orchestrator).
