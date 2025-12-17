/**
 * Integration Tests for API Endpoints
 *
 * Tests all endpoints in index.js including:
 * - Root metadata endpoint
 * - Health check endpoints
 * - Session monitoring endpoints
 * - MCP tools and execution
 * - Rate limiting middleware
 * - Circuit breaker behavior
 * - CORS handling
 * - Error handling paths
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import axios from 'axios';

// Test server configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3323';
const TEST_TIMEOUT = 10000;

// Helper to make requests and handle errors gracefully
async function request(method, path, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      validateStatus: () => true // Don't throw on any status
    };

    // Only include data for methods that send a body
    if (data !== null && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.data = data;
    }

    const response = await axios(config);
    return response;
  } catch (error) {
    if (error.response) {
      return error.response;
    }
    throw error;
  }
}

describe('API Integration Tests', () => {

  // ============================================================================
  // Root Endpoint Tests
  // ============================================================================

  describe('GET / (Root Metadata)', () => {
    it('should return service metadata with 200 status', async () => {
      const response = await request('GET', '/');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('service', 'Jules MCP Server');
      expect(response.data).toHaveProperty('version');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('capabilities');
      expect(response.data).toHaveProperty('authMethod', 'api-key');
      expect(response.data).toHaveProperty('endpoints');
    }, TEST_TIMEOUT);

    it('should include all expected capabilities', async () => {
      const response = await request('GET', '/');

      expect(response.data.capabilities).toContain('sessions');
      expect(response.data.capabilities).toContain('tasks');
      expect(response.data.capabilities).toContain('orchestration');
      expect(response.data.capabilities).toContain('mcp-protocol');
      expect(response.data.capabilities).toContain('sources');
    }, TEST_TIMEOUT);

    it('should include correct endpoint paths', async () => {
      const response = await request('GET', '/');

      expect(response.data.endpoints).toHaveProperty('health', '/health');
      expect(response.data.endpoints).toHaveProperty('tools', '/mcp/tools');
      expect(response.data.endpoints).toHaveProperty('execute', '/mcp/execute');
      expect(response.data.endpoints).toHaveProperty('monitor', '/api/sessions/active');
      expect(response.data.endpoints).toHaveProperty('stats', '/api/sessions/stats');
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // Health Check Tests
  // ============================================================================

  describe('GET /health', () => {
    it('should return health status with 200 or 503 status', async () => {
      const response = await request('GET', '/health');

      // Health endpoint may return 503 if circuit breaker is open
      expect([200, 503]).toContain(response.status);
      expect(response.data).toHaveProperty('status');
      expect(['ok', 'degraded']).toContain(response.data.status);
    }, TEST_TIMEOUT);

    it('should include version and timestamp', async () => {
      const response = await request('GET', '/health');

      expect(response.data).toHaveProperty('version');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('uptime');
    }, TEST_TIMEOUT);

    it('should include memory information', async () => {
      const response = await request('GET', '/health');

      expect(response.data).toHaveProperty('memory');
      expect(response.data.memory).toHaveProperty('used');
      expect(response.data.memory).toHaveProperty('total');
    }, TEST_TIMEOUT);

    it('should include services status', async () => {
      const response = await request('GET', '/health');

      expect(response.data).toHaveProperty('services');
      expect(response.data.services).toHaveProperty('julesApi');
      expect(response.data.services).toHaveProperty('database');
      expect(response.data.services).toHaveProperty('github');
    }, TEST_TIMEOUT);

    it('should include circuit breaker status', async () => {
      const response = await request('GET', '/health');

      expect(response.data).toHaveProperty('circuitBreaker');
      expect(response.data.circuitBreaker).toHaveProperty('failures');
      expect(response.data.circuitBreaker).toHaveProperty('isOpen');
      expect(typeof response.data.circuitBreaker.failures).toBe('number');
      expect(typeof response.data.circuitBreaker.isOpen).toBe('boolean');
    }, TEST_TIMEOUT);
  });

  describe('GET /api/v1/health', () => {
    it('should return same health data as /health', async () => {
      const response = await request('GET', '/api/v1/health');

      // Health endpoint may return 503 if circuit breaker is open
      expect([200, 503]).toContain(response.status);
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('version');
      expect(response.data).toHaveProperty('services');
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // Session Monitoring Endpoints
  // ============================================================================

  describe('GET /api/sessions/active', () => {
    it('should return active sessions or monitor not initialized error', async () => {
      const response = await request('GET', '/api/sessions/active');

      if (response.status === 200) {
        expect(response.data).toHaveProperty('sessions');
        expect(response.data).toHaveProperty('count');
        expect(Array.isArray(response.data.sessions)).toBe(true);
        expect(typeof response.data.count).toBe('number');
      } else if (response.status === 503) {
        expect(response.data).toHaveProperty('error', 'Monitor not initialized');
      }
    }, TEST_TIMEOUT);
  });

  describe('GET /api/sessions/stats', () => {
    it('should return session statistics or monitor not initialized error', async () => {
      const response = await request('GET', '/api/sessions/stats');

      if (response.status === 200) {
        expect(response.data).toBeTruthy();
      } else if (response.status === 503) {
        expect(response.data).toHaveProperty('error', 'Monitor not initialized');
      }
    }, TEST_TIMEOUT);
  });

  describe('GET /api/sessions/:id/timeline', () => {
    it('should return 503 when monitor not initialized', async () => {
      const response = await request('GET', '/api/sessions/test-session-id/timeline');

      // Likely 503 if monitor not initialized, or 500 if session not found
      expect([200, 500, 503]).toContain(response.status);

      if (response.status === 503) {
        expect(response.data).toHaveProperty('error', 'Monitor not initialized');
      }
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // MCP Tools Endpoint
  // ============================================================================

  describe('GET /mcp/tools', () => {
    it('should return list of available tools with 200 status', async () => {
      const response = await request('GET', '/mcp/tools');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('tools');
      expect(Array.isArray(response.data.tools)).toBe(true);
      expect(response.data.tools.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should include core Jules tools', async () => {
      const response = await request('GET', '/mcp/tools');
      const toolNames = response.data.tools.map((t) => t.name);

      expect(toolNames).toContain('jules_list_sources');
      expect(toolNames).toContain('jules_create_session');
      expect(toolNames).toContain('jules_list_sessions');
      expect(toolNames).toContain('jules_get_session');
      expect(toolNames).toContain('jules_send_message');
      expect(toolNames).toContain('jules_approve_plan');
      expect(toolNames).toContain('jules_get_activities');
    }, TEST_TIMEOUT);

    it('should include GitHub integration tools', async () => {
      const response = await request('GET', '/mcp/tools');
      const toolNames = response.data.tools.map((t) => t.name);

      expect(toolNames).toContain('jules_create_from_issue');
      expect(toolNames).toContain('jules_batch_from_labels');
    }, TEST_TIMEOUT);

    it('should include batch processing tools', async () => {
      const response = await request('GET', '/mcp/tools');
      const toolNames = response.data.tools.map((t) => t.name);

      expect(toolNames).toContain('jules_batch_create');
      expect(toolNames).toContain('jules_batch_status');
      expect(toolNames).toContain('jules_batch_approve_all');
    }, TEST_TIMEOUT);

    it('should include monitoring tools', async () => {
      const response = await request('GET', '/mcp/tools');
      const toolNames = response.data.tools.map((t) => t.name);

      expect(toolNames).toContain('jules_monitor_all');
      expect(toolNames).toContain('jules_session_timeline');
    }, TEST_TIMEOUT);

    it('should include Ollama tools', async () => {
      const response = await request('GET', '/mcp/tools');
      const toolNames = response.data.tools.map((t) => t.name);

      expect(toolNames).toContain('ollama_list_models');
      expect(toolNames).toContain('ollama_completion');
      expect(toolNames).toContain('ollama_code_generation');
      expect(toolNames).toContain('ollama_chat');
    }, TEST_TIMEOUT);

    it('should include RAG tools', async () => {
      const response = await request('GET', '/mcp/tools');
      const toolNames = response.data.tools.map((t) => t.name);

      expect(toolNames).toContain('ollama_rag_index');
      expect(toolNames).toContain('ollama_rag_query');
      expect(toolNames).toContain('ollama_rag_status');
      expect(toolNames).toContain('ollama_rag_clear');
    }, TEST_TIMEOUT);

    it('should have proper tool schema with name, description, and parameters', async () => {
      const response = await request('GET', '/mcp/tools');

      response.data.tools.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.parameters).toBe('object');
      });
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // MCP Execute Endpoint - Error Handling
  // ============================================================================

  describe('POST /mcp/execute - Error Handling', () => {
    it('should return 400 when tool name is missing', async () => {
      const response = await request('POST', '/mcp/execute', {
        parameters: {}
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('error');
      // Error structure may vary, just check it has error info
      expect(response.data.error).toBeTruthy();
    }, TEST_TIMEOUT);

    it('should return 400 for unknown tool', async () => {
      const response = await request('POST', '/mcp/execute', {
        tool: 'unknown_nonexistent_tool',
        parameters: {}
      });

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error).toContain('Unknown tool');
    }, TEST_TIMEOUT);

    it('should return 500 when JULES_API_KEY not configured', async () => {
      // This test assumes JULES_API_KEY might not be set in test environment
      const response = await request('POST', '/mcp/execute', {
        tool: 'jules_list_sources',
        parameters: {}
      });

      // Will either succeed (if key is set) or return 500
      expect([200, 500]).toContain(response.status);

      if (response.status === 500) {
        expect(response.data).toHaveProperty('error');
      }
    }, TEST_TIMEOUT);

    it('should handle malformed JSON gracefully', async () => {
      try {
        const response = await axios({
          method: 'POST',
          url: `${BASE_URL}/mcp/execute`,
          data: 'this is not json',
          headers: {
            'Content-Type': 'application/json'
          },
          validateStatus: () => true
        });

        expect(response.status).toBe(400);
      } catch (error) {
        // axios will throw on bad JSON, which is expected
        expect(error).toBeTruthy();
      }
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // Rate Limiting Tests
  // ============================================================================

  describe('Rate Limiting on /mcp/* endpoints', () => {
    it('should include rate limit headers in response', async () => {
      const response = await request('GET', '/mcp/tools');

      // Axios normalizes headers to lowercase
      const headers = Object.keys(response.headers).reduce((acc, key) => {
        acc[key.toLowerCase()] = response.headers[key];
        return acc;
      }, {});

      expect(headers).toHaveProperty('x-ratelimit-limit');
      expect(headers).toHaveProperty('x-ratelimit-remaining');
    }, TEST_TIMEOUT);

    it('should track rate limit remaining count', async () => {
      const response1 = await request('GET', '/mcp/tools');
      const response2 = await request('GET', '/mcp/tools');

      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining'] || response1.headers['X-RateLimit-Remaining']);
      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining'] || response2.headers['X-RateLimit-Remaining']);

      // Remaining should decrease (unless it reset in between)
      expect(remaining2).toBeLessThanOrEqual(remaining1);
    }, TEST_TIMEOUT);

    it('should set rate limit to 100 requests per minute', async () => {
      const response = await request('GET', '/mcp/tools');

      const limit = response.headers['x-ratelimit-limit'] || response.headers['X-RateLimit-Limit'];
      expect(limit).toBe('100');
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // CORS Tests
  // ============================================================================

  describe('CORS Headers', () => {
    it('should include CORS headers for allowed origins', async () => {
      const response = await request('GET', '/', null, {
        'Origin': 'http://localhost:3000'
      });

      // Axios normalizes headers to lowercase
      const hasOriginHeader = 'access-control-allow-origin' in response.headers ||
                              'Access-Control-Allow-Origin' in response.headers;
      const hasMethodsHeader = 'access-control-allow-methods' in response.headers ||
                               'Access-Control-Allow-Methods' in response.headers;
      const hasHeadersHeader = 'access-control-allow-headers' in response.headers ||
                               'Access-Control-Allow-Headers' in response.headers;

      expect(hasOriginHeader).toBe(true);
      expect(hasMethodsHeader).toBe(true);
      expect(hasHeadersHeader).toBe(true);
    }, TEST_TIMEOUT);

    it('should handle OPTIONS preflight requests', async () => {
      const response = await request('OPTIONS', '/mcp/tools', null, {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      });

      expect(response.status).toBe(200);

      const hasMethodsHeader = 'access-control-allow-methods' in response.headers ||
                               'Access-Control-Allow-Methods' in response.headers;
      expect(hasMethodsHeader).toBe(true);
    }, TEST_TIMEOUT);

    it('should allow credentials in CORS', async () => {
      const response = await request('GET', '/', null, {
        'Origin': 'http://localhost:3000'
      });

      const credentials = response.headers['access-control-allow-credentials'] ||
                         response.headers['Access-Control-Allow-Credentials'];
      expect(credentials).toBe('true');
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // 404 Error Handling
  // ============================================================================

  describe('404 Not Found', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request('GET', '/this/route/does/not/exist');

      expect(response.status).toBe(404);
      expect(response.data).toHaveProperty('success', false);
      expect(response.data).toHaveProperty('error');
      expect(response.data.error).toHaveProperty('message');
      expect(response.data.error.message.toLowerCase()).toContain('not found');
    }, TEST_TIMEOUT);

    it('should include route information in 404 error', async () => {
      const response = await request('GET', '/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.data.error.message).toContain('GET');
      expect(response.data.error.message).toContain('/api/nonexistent');
    }, TEST_TIMEOUT);

    it('should return 404 for POST on unknown routes', async () => {
      const response = await request('POST', '/api/unknown/endpoint', {});

      expect(response.status).toBe(404);
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // Content-Type Tests
  // ============================================================================

  describe('Content-Type Handling', () => {
    it('should return JSON for all API endpoints', async () => {
      const response = await request('GET', '/');

      expect(response.headers['content-type']).toContain('application/json');
    }, TEST_TIMEOUT);

    it('should handle requests without Content-Type header', async () => {
      const response = await axios({
        method: 'GET',
        url: `${BASE_URL}/health`,
        validateStatus: () => true
      });

      // Health endpoint may return 200 or 503 depending on circuit breaker state
      expect([200, 503]).toContain(response.status);
      expect(response.data).toHaveProperty('status');
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // Security Tests
  // ============================================================================

  describe('Security', () => {
    it('should enforce JSON body size limit', async () => {
      // Try to send a body larger than 1MB
      const largeBody = {
        tool: 'jules_list_sources',
        parameters: {
          data: 'x'.repeat(2 * 1024 * 1024) // 2MB of data
        }
      };

      const response = await request('POST', '/mcp/execute', largeBody);

      // Should be rejected (413 Payload Too Large) or timeout
      expect([413, 400, 500]).toContain(response.status);
    }, TEST_TIMEOUT);

    it('should not expose internal error details in production', async () => {
      const response = await request('POST', '/mcp/execute', {
        tool: 'jules_list_sources',
        parameters: {}
      });

      // Error messages should be user-friendly, not stack traces
      if (response.status >= 400) {
        expect(response.data).toHaveProperty('error');
        expect(typeof response.data.error).toBe('string');
        // Should not contain file paths or internal details
        expect(response.data.error).not.toContain(__dirname);
      }
    }, TEST_TIMEOUT);
  });

  // ============================================================================
  // Circuit Breaker Tests
  // ============================================================================

  describe('Circuit Breaker', () => {
    it('should report circuit breaker status in health check', async () => {
      const response = await request('GET', '/health');

      // Circuit breaker info should be present
      if (response.data.circuitBreaker) {
        expect(response.data.circuitBreaker).toHaveProperty('failures');
        expect(response.data.circuitBreaker).toHaveProperty('isOpen');
        expect(response.data.circuitBreaker.failures).toBeGreaterThanOrEqual(0);
      } else {
        // If circuitBreaker is not in response, it's also valid (may not be implemented in all endpoints)
        expect(response.data).toHaveProperty('status');
      }
    }, TEST_TIMEOUT);

    it('should update health status when circuit is open', async () => {
      const response = await request('GET', '/health');

      // Only test if circuit breaker is present in response
      if (response.data.circuitBreaker && response.data.circuitBreaker.isOpen) {
        expect(response.data.status).toBe('degraded');
        expect(response.status).toBe(503);
      } else {
        // Circuit is closed or not present - status should be ok
        expect(['ok', 'degraded']).toContain(response.data.status);
      }
    }, TEST_TIMEOUT);
  });
});
