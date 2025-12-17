# Integration Tests

This directory contains integration tests for the antigravity-jules-orchestration MCP server.

## Test Files

### api.integration.test.js
Comprehensive integration tests for all API endpoints in index.js:
- Root metadata endpoint (GET /)
- Health check endpoints (GET /health, GET /api/v1/health)
- Session monitoring endpoints (GET /api/sessions/active, /stats, /:id/timeline)
- MCP tools endpoint (GET /mcp/tools)
- MCP execute endpoint (POST /mcp/execute)
- Rate limiting middleware
- CORS handling
- Circuit breaker behavior
- Error handling (404, 400, 500)
- Security tests

**Test Count:** 39 tests
**Framework:** Vitest

### rateLimiter.integration.test.js
Integration tests for Redis rate limiter middleware with mocked Redis client.
Tests token bucket algorithm, tier-based limits, failover strategies, and concurrent requests.

**Test Count:** 38 tests
**Framework:** Node.js built-in test runner (node:test)

## Running Tests

### Run all integration tests (Vitest only)
```bash
npm run test:integration
```

### Run specific test file
```bash
npm run test:integration -- tests/integration/api.integration.test.js
```

### Run with custom test server URL
```bash
TEST_BASE_URL=http://localhost:3324 npm run test:integration
```

### Run rate limiter tests (Node test runner)
```bash
node --test tests/integration/rateLimiter.integration.test.js
```

## Test Server Setup

The API integration tests require a running server. You can:

1. **Start server manually:**
   ```bash
   PORT=3324 NODE_ENV=test JULES_API_KEY=test-key node index.js
   ```

2. **Run tests (they will use existing server if running):**
   ```bash
   TEST_BASE_URL=http://localhost:3324 npm run test:integration
   ```

## Test Coverage

### Endpoints Tested

#### Core Endpoints
- ✅ GET / - Service metadata
- ✅ GET /health - Health check with circuit breaker status
- ✅ GET /api/v1/health - Alternative health endpoint
- ✅ GET /api/sessions/active - Active sessions
- ✅ GET /api/sessions/stats - Session statistics
- ✅ GET /api/sessions/:id/timeline - Session timeline

#### MCP Protocol
- ✅ GET /mcp/tools - List all available tools
- ✅ POST /mcp/execute - Execute tool by name

#### Middleware & Features
- ✅ Rate limiting on /mcp/* endpoints
- ✅ CORS headers for allowed origins
- ✅ OPTIONS preflight handling
- ✅ Circuit breaker status reporting
- ✅ 404 error handling
- ✅ Request validation
- ✅ JSON parsing errors
- ✅ Security (body size limits)

### Test Results Summary

All 39 integration tests passing as of last run:
- Root endpoint: 3 tests
- Health checks: 8 tests
- Session monitoring: 3 tests
- MCP tools: 8 tests
- MCP execute: 4 tests
- Rate limiting: 3 tests
- CORS: 3 tests
- 404 handling: 3 tests
- Content-Type: 2 tests
- Security: 1 test
- Circuit breaker: 2 tests

## Notes

- Tests use axios for HTTP requests with `validateStatus: () => true` to capture all status codes
- Health endpoints may return 200 (ok) or 503 (degraded) depending on circuit breaker state
- Rate limiting tests verify headers are present and decreasing
- CORS tests check for both standard and legacy header formats
- Circuit breaker tests verify degraded status when circuit is open
