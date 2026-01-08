# API Reference

## Health Endpoint

The health endpoint provides service status and configuration information.

### Endpoint

```
GET /health
GET /api/v1/health
```

### Response Schema

```json
{
  "status": "ok",
  "version": "2.6.2",
  "timestamp": "2025-12-17T08:00:00.000Z",
  "uptime": 12345.678,
  "memory": {
    "used": "10MB",
    "total": "12MB"
  },
  "services": {
    "julesApi": "configured",
    "database": "configured",
    "github": "configured"
  },
  "circuitBreaker": {
    "failures": 0,
    "isOpen": false
  }
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Service health status. Always `"ok"` when healthy. |
| `version` | string | Current server version (semver format). |
| `timestamp` | string | ISO 8601 timestamp of the response. |
| `uptime` | number | Server uptime in seconds. |
| `memory.used` | string | Heap memory in use (with MB suffix). |
| `memory.total` | string | Total heap memory (with MB suffix). |
| `services.julesApi` | string | Jules API configuration status. |
| `services.database` | string | Database configuration status. |
| `services.github` | string | GitHub token configuration status. |
| `circuitBreaker.failures` | number | Current failure count for circuit breaker. |
| `circuitBreaker.isOpen` | boolean | Whether circuit breaker is open (blocking requests). |

### Service Status Values

| Value | Description |
|-------|-------------|
| `configured` | Service is properly configured and available. |
| `not_configured` | Required credentials not provided. |
| `circuit_open` | Circuit breaker is open due to failures. |
| `error` | Service encountered an error during check. |
| `unknown` | Status could not be determined. |

### CI/CD Integration

The health-check workflow validates:

1. **Status check**: `grep -q '"status":"ok"'`
2. **Jules API check**: `grep -q '"julesApi":"configured"'`

> **Important**: Changes to this response format require corresponding updates to `.github/workflows/health-check.yml` and `tests/unit/health.test.js`.

### Example Usage

```bash
# Basic health check
curl https://scarmonit.com/health

# Parse with jq
curl -s https://scarmonit.com/health | jq '.services.julesApi'
```

---

## Root Endpoint

### Endpoint

```
GET /
```

### Response

Returns server information and available endpoints.

```json
{
  "name": "Jules MCP Server",
  "version": "2.6.2",
  "description": "MCP server for Jules API integration",
  "endpoints": {
    "health": "/health",
    "tools": "/mcp/tools",
    "execute": "/mcp/execute",
    "monitor": "/api/sessions/active",
    "stats": "/api/sessions/stats"
  }
}
```

---

## MCP Tools Endpoint

### Endpoint

```
GET /mcp/tools
```

### Response

Returns list of all available MCP tools with their descriptions and parameters.

---

## MCP Execute Endpoint

### Endpoint

```
POST /mcp/execute
```

### Request Body

```json
{
  "tool": "tool_name",
  "params": {
    "param1": "value1"
  }
}
```

### Response

Tool-specific response based on the executed tool.

---

## Session Management Endpoints

### List Active Sessions

```
GET /api/sessions/active
```

### Session Statistics

```
GET /api/sessions/stats
```

---

## Contract Testing

Schema validation tests are located at `tests/unit/health.test.js`. These tests ensure:

1. All required fields are present
2. Field values are within expected ranges
3. CI/CD grep patterns will match
4. No deprecated fields (e.g., `apiKeyConfigured`) are present

Run tests with:

```bash
node --test tests/unit/health.test.js
```
