# MCP Tool Chain Architecture

**Version:** 1.0.0  
**Last Updated:** December 1, 2025  
**Status:** Active Production

## Executive Summary

This document catalogs all 35+ Model Context Protocol (MCP) tools across 5 connected servers and defines executable tool chains for autonomous orchestration workflows.

## MCP Server Inventory

### 1. Jules Orchestration Server
**Base URL:** `https://scarmonit.com`  
**Protocol:** HTTPS  
**Tools:** 7

| Tool Name | Input Types | Output Types | Purpose |
|-----------|-------------|--------------|---------|
| `jules_list_sources` | None | `Array<Source>` | List connected GitHub repositories |
| `jules_create_session` | `prompt: string, source: string, branch?: string, requirePlanApproval?: boolean` | `Session` | Create autonomous coding session |
| `jules_list_sessions` | None | `Array<Session>` | List all Jules sessions |
| `jules_get_session` | `sessionId: string` | `Session` | Get session details |
| `jules_send_message` | `sessionId: string, message: string` | `MessageResponse` | Send message to session |
| `jules_approve_plan` | `sessionId: string` | `ApprovalResponse` | Approve execution plan |
| `jules_get_activities` | `sessionId: string` | `Array<Activity>` | Get session activities/events |

### 2. Scarmonit ARC MCP
**Tools:** 7

| Tool Name | Input Types | Output Types | Purpose |
|-----------|-------------|--------------|---------|
| `list_agents` | `refresh?: boolean` | `Array<Agent>` | List available agent personas |
| `get_agent_instructions` | `agent: string` | `AgentInstructions` | Get full agent instructions |
| `search_agents` | `query: string` | `Array<Agent>` | Search agents by keyword |
| `apply_agent_context` | `agent: string` | `AgentContext` | Get actionable agent summary |
| `diagnose_agents` | None | `DiagnosticReport` | Diagnose agent system |
| `check_datalore_status` | None | `DataloreStatus` | Check Datalore integration |
| `check_system_status` | None | `SystemStatus` | Check infrastructure status |

### 3. LLM Framework MCP
**Tools:** 2

| Tool Name | Input Types | Output Types | Purpose |
|-----------|-------------|--------------|---------|
| `get_project_info` | None | `ProjectInfo` | Get project structure/patterns |
| `get_coding_standards` | None | `CodingStandards` | Get code style guidelines |

### 4. LLM Framework DevOps MCP
**Tools:** 9

| Tool Name | Input Types | Output Types | Purpose |
|-----------|-------------|--------------|---------|
| `create_github_workflow` | `language?: string, deployTarget?: string, includeSecurity?: boolean` | `WorkflowYAML` | Generate GitHub Actions workflow |
| `create_optimized_dockerfile` | `baseImage?: string, packageManager?: string, exposePort?: number` | `Dockerfile` | Generate multi-stage Dockerfile |
| `generate_deployment` | `appName?: string, image?: string, replicas?: number, containerPort?: number` | `K8sManifests` | Generate K8s deployment/service |
| `setup_prometheus` | `jobName?: string, targetHost?: string, metricsPath?: string` | `PrometheusConfig` | Generate Prometheus config |
| `init_project` | `cloud?: string, region?: string, remoteBackend?: boolean` | `TerraformProject` | Generate Terraform project |
| `create_playbook` | `serviceName?: string, packageList?: Array<string>` | `AnsiblePlaybook` | Generate Ansible playbook |
| `health_check` | None | `HealthStatus` | Check DevOps tooling status |
| `scan_dependencies` | `ecosystem?: string, includeSBOM?: boolean` | `ScanResults` | Security vulnerability scan |
| `monitoring_setup_prometheus` | Same as setup_prometheus | Same as setup_prometheus | Alias for setup_prometheus |

### 5. LLM Framework Evolution MCP
**Tools:** 5

| Tool Name | Input Types | Output Types | Purpose |
|-----------|-------------|--------------|---------|
| `analyze_codebase` | `directories?: Array<string>, focusAreas?: Array<string>, projectRoot?: string` | `AnalysisReport` | Analyze code for improvements |
| `generate_improvements` | `filePath?: string, improvementType?: string, maxSuggestions?: number` | `Array<Improvement>` | Generate code improvements |
| `evolve_system` | `autoApply?: boolean, maxImprovements?: number, safetyLevel?: string` | `EvolutionResult` | Autonomous system evolution |
| `learn_from_patterns` | `query: string, topK?: number` | `Array<Pattern>` | Learn from ChromaDB patterns |
| `validate_improvement` | `improvementId: string, runTests?: boolean` | `ValidationResult` | Validate improvement before applying |

## Tool Chain Patterns

### Chain 1: Complete Jules Session Lifecycle
**Purpose:** Create, monitor, approve, and track autonomous coding session  
**Execution Mode:** Sequential  
**Duration:** 2-30 minutes (depending on task complexity)

```
[jules_list_sources]
    ↓ Select source
[jules_create_session]
    ↓ sessionId
[jules_get_session]
    ↓ Wait for plan
[jules_approve_plan]
    ↓ Monitor execution
[jules_get_activities]
    ↓ Track progress
[jules_get_session]
    → Final status
```

**Input Contract:**
```typescript
{
  prompt: string;           // Task description
  source: string;          // Format: "sources/github/owner/repo"
  branch?: string;         // Default: repo default branch
  requirePlanApproval: true; // Always require approval
}
```

**Output Contract:**
```typescript
{
  sessionId: string;
  status: 'CREATED' | 'PLANNING' | 'AWAITING_APPROVAL' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  plan?: PlanSummary;
  activities: Array<Activity>;
  result?: ExecutionResult;
}
```

**Error Handling:**
- **401/403 (Auth)** → Verify JULES_API_KEY, retry once
- **404 (Not Found)** → Validate source name, check list_sources
- **500 (Server Error)** → Retry 3x with exponential backoff (1s, 2s, 4s)
- **Timeout** → After 30min, mark as abandoned, manual intervention

**Example Execution:**
```javascript
// Step 1: List available sources
const sources = await mcp.execute('jules_list_sources');
const targetSource = sources.find(s => s.name.includes('antigravity-jules-orchestration'));

// Step 2: Create session
const session = await mcp.execute('jules_create_session', {
  prompt: 'Add health check endpoint to /api/status',
  source: targetSource.name,
  requirePlanApproval: true
});

// Step 3: Poll for plan
let status = await mcp.execute('jules_get_session', { sessionId: session.id });
while (status.status === 'PLANNING') {
  await sleep(5000);
  status = await mcp.execute('jules_get_session', { sessionId: session.id });
}

// Step 4: Approve plan
await mcp.execute('jules_approve_plan', { sessionId: session.id });

// Step 5: Monitor activities
const activities = await mcp.execute('jules_get_activities', { sessionId: session.id });
```

---

### Chain 2: DevOps + Jules Integration
**Purpose:** Generate infrastructure code, create session for implementation  
**Execution Mode:** Sequential  
**Duration:** 5-15 minutes

```
[init_project]
    ↓ Terraform files
[create_github_workflow]
    ↓ CI/CD pipeline
[create_optimized_dockerfile]
    ↓ Container config
[jules_create_session]
    ↓ Implement changes
[health_check]
    → Validation
```

**Input Contract:**
```typescript
{
  cloud: 'aws' | 'gcp' | 'azure';
  region: string;
  repository: string;
}
```

**Output Contract:**
```typescript
{
  terraform: { main: string, providers: string, backend: string };
  workflow: string; // GitHub Actions YAML
  dockerfile: string;
  sessionId: string;
  healthStatus: HealthStatus;
}
```

**Error Handling:**
- **Template Generation Failure** → Fallback to minimal config
- **Jules Session Create Failure** → Save artifacts locally, manual deployment
- **Health Check Failure** → Log warnings, continue (non-blocking)

---

### Chain 3: Code Evolution Pipeline
**Purpose:** Analyze codebase, generate improvements, implement autonomously  
**Execution Mode:** Sequential with validation gates  
**Duration:** 10-45 minutes

```
[analyze_codebase]
    ↓ Analysis report
[generate_improvements]
    ↓ Improvement suggestions
[validate_improvement]
    ↓ Safety check
[jules_create_session]
    ↓ Implement approved improvements
[validate_improvement]
    → Post-implementation validation
```

**Input Contract:**
```typescript
{
  directories: Array<string>;
  focusAreas: Array<'performance' | 'security' | 'testing' | 'documentation'>;
  improvementType: 'error-handling' | 'performance' | 'security' | 'testing';
  autoApply: false; // Conservative mode
}
```

**Output Contract:**
```typescript
{
  analysis: AnalysisReport;
  improvements: Array<Improvement>;
  validationResults: Array<ValidationResult>;
  sessionId?: string;
  appliedImprovements: Array<string>;
}
```

**Error Handling:**
- **Analysis Failure** → Skip to manual code review
- **Validation Failure** → Block improvement, log detailed error
- **Jules Session Failure** → Preserve improvement suggestions for manual implementation
- **Post-Validation Failure** → Trigger rollback via Git revert

---

### Chain 4: System Diagnostics & Repair
**Purpose:** Check system health, diagnose issues, apply agent-specific fixes  
**Execution Mode:** Parallel diagnostics → Sequential repair  
**Duration:** 2-10 minutes

```
[check_system_status] ──┐
[diagnose_agents] ───────┼─→ Aggregate results
[health_check] ──────────┘
    ↓ Identify issues
[get_agent_instructions]
    ↓ Load repair context
[apply_agent_context]
    ↓ Execute fixes
[check_system_status]
    → Verification
```

**Input Contract:**
```typescript
{
  includeAgentDiagnostics: boolean;
  includeInfrastructure: boolean;
  autoRepair: boolean;
}
```

**Output Contract:**
```typescript
{
  systemStatus: SystemStatus;
  agentDiagnostics: DiagnosticReport;
  healthStatus: HealthStatus;
  issues: Array<Issue>;
  repairs: Array<RepairAction>;
  finalStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}
```

**Error Handling:**
- **Diagnostic Tool Failure** → Continue with available diagnostics, flag as incomplete
- **Repair Failure** → Log failure, escalate to manual intervention
- **Verification Failure** → Rollback repairs, mark system as degraded

---

### Chain 5: Full Deployment Automation
**Purpose:** End-to-end deployment from code to production with monitoring  
**Execution Mode:** Sequential with parallel monitoring setup  
**Duration:** 15-60 minutes

```
[create_optimized_dockerfile]
    ↓ Container image spec
[create_github_workflow]
    ↓ CI/CD pipeline
[generate_deployment]
    ↓ K8s manifests
[setup_prometheus] ──┐
[scan_dependencies] ─┼─→ Parallel monitoring/security
    ↓ Combined results
[jules_create_session]
    ↓ Implement deployment
[health_check]
    → Production validation
```

**Input Contract:**
```typescript
{
  appName: string;
  repository: string;
  baseImage: string;
  replicas: number;
  deployTarget: 'docker' | 'kubernetes' | 'render';
}
```

**Output Contract:**
```typescript
{
  dockerfile: string;
  workflow: string;
  manifests: { deployment: string, service: string };
  monitoring: PrometheusConfig;
  securityScan: ScanResults;
  sessionId: string;
  deploymentStatus: 'PENDING' | 'DEPLOYED' | 'FAILED';
}
```

**Error Handling:**
- **Dockerfile Generation Failure** → Use default template, warn about optimization
- **Security Scan Critical Issues** → Block deployment, require manual review
- **Deployment Failure** → Rollback to previous version, preserve artifacts
- **Monitoring Setup Failure** → Deploy without monitoring, create follow-up task

## Cross-Chain Patterns

### Pattern: Approval Gates
Insert human approval between tool executions for high-risk operations:

```javascript
const result = await toolA.execute(params);
if (requiresApproval(result)) {
  await waitForApproval(result);
}
const finalResult = await toolB.execute(result);
```

**Use Cases:**
- Jules plan approval before execution
- Deployment to production environments
- Code changes affecting security

### Pattern: Parallel Execution
Execute independent tools concurrently:

```javascript
const [status, diagnostics, health] = await Promise.all([
  mcp.execute('check_system_status'),
  mcp.execute('diagnose_agents'),
  mcp.execute('health_check')
]);
```

**Use Cases:**
- Diagnostic collection
- Multi-environment health checks
- Independent artifact generation

### Pattern: Retry with Backoff
Handle transient failures with exponential backoff:

```javascript
async function executeWithRetry(tool, params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await mcp.execute(tool, params);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s
    }
  }
}
```

**Use Cases:**
- Jules API rate limiting
- Network transient failures
- MCP server cold starts

### Pattern: Circuit Breaker
Prevent cascading failures:

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      setTimeout(() => { this.state = 'HALF_OPEN'; }, this.timeout);
    }
  }
}
```

**Use Cases:**
- Jules API downtime
- MCP server unavailability
- Database connection failures

## Type Definitions

```typescript
// Common types across all chains
interface Session {
  id: string;
  status: 'CREATED' | 'PLANNING' | 'AWAITING_APPROVAL' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  prompt: string;
  source: string;
  plan?: PlanSummary;
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  sessionId: string;
  type: 'MESSAGE' | 'FILE_CHANGE' | 'EXECUTION' | 'ERROR';
  content: string;
  timestamp: string;
}

interface HealthStatus {
  timestamp: string;
  status: Array<{ tool: string, available: boolean }>;
}

interface SystemStatus {
  status: string;
  website: string;
  dashboard: string;
  infrastructure: {
    docker: string;
    kubernetes: string;
    mcpIntegration: string;
  };
}

interface Improvement {
  id: string;
  filePath: string;
  improvementType: string;
  description: string;
  code: string;
  safety: 'safe' | 'caution' | 'dangerous';
}

interface ValidationResult {
  improvementId: string;
  valid: boolean;
  errors: Array<string>;
  warnings: Array<string>;
  testsPassed: boolean;
}
```

## Best Practices

### 1. Always Validate Inputs
Use schema validation before executing tools:

```javascript
import { z } from 'zod';

const CreateSessionSchema = z.object({
  prompt: z.string().min(10).max(2000),
  source: z.string().regex(/^sources\/github\/[\w-]+\/[\w-]+$/),
  branch: z.string().optional(),
  requirePlanApproval: z.boolean().default(true)
});

const params = CreateSessionSchema.parse(input);
```

### 2. Log All Tool Executions
Use structured logging (never console.log):

```javascript
import logger from './utils/logger.js';

logger.info('Executing tool chain', {
  chain: 'jules-session-lifecycle',
  tool: 'jules_create_session',
  params: { prompt: params.prompt.substring(0, 50) + '...' }
});
```

### 3. Handle Errors Gracefully
Provide actionable error messages:

```javascript
try {
  await mcp.execute('jules_create_session', params);
} catch (error) {
  logger.error('Session creation failed', {
    error: error.message,
    code: error.code,
    suggestion: 'Verify JULES_API_KEY and source availability'
  });
  throw new Error(`Failed to create Jules session: ${error.message}`);
}
```

### 4. Use Connection Pooling
Reuse HTTP connections for MCP servers:

```javascript
import https from 'https';

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5
});

const mcpClient = new MCPClient({ agent });
```

### 5. Implement Timeouts
Prevent hanging operations:

```javascript
const timeoutPromise = (ms) => new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Operation timeout')), ms)
);

const result = await Promise.race([
  mcp.execute('jules_get_session', { sessionId }),
  timeoutPromise(30000) // 30 second timeout
]);
```

## Monitoring & Observability

### Metrics to Track
- **Tool execution duration** (p50, p95, p99)
- **Success/failure rates** per tool
- **Chain completion rates** per pattern
- **Error types distribution**
- **Retry attempts** per tool

### Logging Standards
```javascript
// Structured log format
logger.info('tool_execution_start', {
  tool: 'jules_create_session',
  chain: 'session-lifecycle',
  timestamp: new Date().toISOString(),
  params: sanitizeParams(params)
});

logger.info('tool_execution_complete', {
  tool: 'jules_create_session',
  chain: 'session-lifecycle',
  duration: 1234, // ms
  success: true,
  sessionId: session.id
});
```

### Health Check Integration
```javascript
app.get('/api/health/chains', async (req, res) => {
  const health = await Promise.all([
    checkJulesServerHealth(),
    checkMCPServerHealth('scarmonit-arc'),
    checkMCPServerHealth('llm-framework'),
    checkMCPServerHealth('llm-framework3'),
    checkMCPServerHealth('llm-framework4')
  ]);

  res.json({
    status: health.every(h => h.healthy) ? 'healthy' : 'degraded',
    servers: health,
    timestamp: new Date().toISOString()
  });
});
```

## Security Considerations

### 1. API Key Management
- Store in environment variables (never commit)
- Rotate keys every 90 days
- Use separate keys for dev/staging/prod

### 2. Input Sanitization
```javascript
import { sanitize } from './utils/security.js';

const safePrompt = sanitize(params.prompt, {
  maxLength: 2000,
  allowedPatterns: /^[a-zA-Z0-9\s\-_.,!?]+$/,
  stripHTML: true
});
```

### 3. Rate Limiting
```javascript
import rateLimit from 'express-rate-limit';

const chainLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 chain executions per window
  message: 'Too many chain executions, please try again later'
});

app.post('/api/execute-chain', chainLimiter, handleChainExecution);
```

### 4. Secrets Scanning
Always run dependency scans before deployment:

```javascript
const scanResult = await mcp.execute('scan_dependencies', {
  ecosystem: 'npm',
  includeSBOM: true
});

if (scanResult.criticalVulnerabilities > 0) {
  throw new Error('Critical vulnerabilities detected, deployment blocked');
}
```

## Performance Optimization

### 1. Caching Strategy
```javascript
import { LRUCache } from 'lru-cache';

const sourceCache = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 5 // 5 minutes
});

async function listSourcesCached() {
  const cached = sourceCache.get('sources');
  if (cached) return cached;

  const sources = await mcp.execute('jules_list_sources');
  sourceCache.set('sources', sources);
  return sources;
}
```

### 2. Parallel Execution
Run independent operations concurrently:

```javascript
// ❌ Slow: Sequential
const dockerfile = await mcp.execute('create_optimized_dockerfile');
const workflow = await mcp.execute('create_github_workflow');
const manifests = await mcp.execute('generate_deployment');

// ✅ Fast: Parallel
const [dockerfile, workflow, manifests] = await Promise.all([
  mcp.execute('create_optimized_dockerfile'),
  mcp.execute('create_github_workflow'),
  mcp.execute('generate_deployment')
]);
```

### 3. Response Streaming
For long-running operations, use streaming:

```javascript
app.get('/api/chains/:chainId/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const chain = await executeChain(req.params.chainId);
  
  for await (const event of chain.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  res.end();
});
```

## Troubleshooting Guide

### Common Issues

#### 1. Jules API Authentication Failure
**Symptom:** 401/403 errors when executing Jules tools  
**Diagnosis:**
```javascript
const health = await fetch('https://scarmonit.com/health');
const data = await health.json();
console.log('API Key Configured:', data.apiKeyConfigured);
```
**Solution:**
- Verify `JULES_API_KEY` environment variable is set
- Check key hasn't expired
- Ensure key has correct permissions

#### 2. MCP Server Timeout
**Symptom:** Tool execution hangs or times out  
**Diagnosis:**
```javascript
const health = await mcp.execute('health_check');
// Check which tools are unavailable
```
**Solution:**
- Check MCP server deployment status (Render dashboard)
- Verify network connectivity
- Check for cold start (Render free tier has 30s cold start)
- Implement retry logic with backoff

#### 3. Chain Execution Failure
**Symptom:** Chain stops mid-execution  
**Diagnosis:**
```javascript
// Check chain state in database
const state = await db.query('SELECT * FROM chain_executions WHERE id = $1', [chainId]);
// Review logs for last successful step
```
**Solution:**
- Implement idempotent operations
- Add checkpoints for resumable chains
- Use transaction rollback for atomic chains

#### 4. Session Stuck in PLANNING
**Symptom:** Jules session never transitions from PLANNING to AWAITING_APPROVAL  
**Diagnosis:**
```javascript
const activities = await mcp.execute('jules_get_activities', { sessionId });
// Check for error activities
```
**Solution:**
- Check Jules API status
- Verify source repository accessibility
- Review prompt complexity (may need simplification)
- Set timeout (30 min) and auto-cancel

## Version History

- **1.0.0** (2025-12-01) - Initial documentation with 5 tool chains across 35+ MCP tools
- **1.0.1** (Future) - Add chain composition patterns
- **1.1.0** (Future) - Add dynamic tool discovery
- **2.0.0** (Future) - Add ChromaDB pattern learning integration

## Related Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture overview
- [INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md) - MCP integration patterns
- [antigravity-mcp-config.json](../antigravity-mcp-config.json) - MCP server configuration
- [README.md](../README.md) - Project overview

## Support

For issues with tool chains:
1. Check [Troubleshooting Guide](#troubleshooting-guide)
2. Review [Render deployment logs](https://dashboard.render.com/web/srv-d4mlmna4d50c73ep70sg/logs)
3. Verify [system status](https://agent.scarmonit.com)
4. Contact: scarmonit@gmail.com

