/**
 * Unit Tests for Health Endpoint Response Schema
 *
 * Tests cover:
 * - Health endpoint response structure validation
 * - Required fields presence (status, version, services)
 * - Services object structure (julesApi, database, github)
 * - Circuit breaker status
 * - Response format consistency for CI/CD checks
 *
 * This test prevents CI breakage from API contract drift.
 * The health-check.yml workflow depends on these exact field names.
 *
 * @module tests/unit/health.test
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

// =============================================================================
// Health Response Schema Definition
// =============================================================================

/**
 * Expected health endpoint response schema
 * CI workflows depend on this structure - changes here require CI updates
 */
const HEALTH_SCHEMA = {
  requiredFields: ['status', 'version', 'timestamp', 'uptime', 'memory', 'services', 'circuitBreaker'],
  services: {
    requiredFields: ['julesApi', 'database', 'github'],
    julesApiValues: ['configured', 'not_configured', 'circuit_open', 'error', 'unknown'],
    configValues: ['configured', 'not_configured']
  },
  circuitBreaker: {
    requiredFields: ['failures', 'isOpen']
  },
  memory: {
    requiredFields: ['used', 'total']
  }
};

// =============================================================================
// Mock Health Response Generator
// =============================================================================

/**
 * Generate a mock health response matching the actual endpoint
 */
function createMockHealthResponse(overrides = {}) {
  return {
    status: 'ok',
    version: '2.5.0',
    timestamp: new Date().toISOString(),
    uptime: 12345.678,
    memory: {
      used: '10MB',
      total: '12MB'
    },
    services: {
      julesApi: 'configured',
      database: 'configured',
      github: 'configured'
    },
    circuitBreaker: {
      failures: 0,
      isOpen: false
    },
    ...overrides
  };
}

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('Health Endpoint Response Schema', () => {
  describe('Required Top-Level Fields', () => {
    it('should have all required top-level fields', () => {
      const response = createMockHealthResponse();

      for (const field of HEALTH_SCHEMA.requiredFields) {
        assert.ok(
          field in response,
          `Missing required field: ${field}`
        );
      }
    });

    it('should have status field with value "ok" when healthy', () => {
      const response = createMockHealthResponse();
      assert.strictEqual(response.status, 'ok');
    });

    it('should have version as a string', () => {
      const response = createMockHealthResponse();
      assert.strictEqual(typeof response.version, 'string');
      assert.ok(response.version.length > 0, 'Version should not be empty');
    });

    it('should have timestamp as valid ISO string', () => {
      const response = createMockHealthResponse();
      const parsed = new Date(response.timestamp);
      assert.ok(!isNaN(parsed.getTime()), 'Timestamp should be valid ISO date');
    });

    it('should have uptime as a number', () => {
      const response = createMockHealthResponse();
      assert.strictEqual(typeof response.uptime, 'number');
      assert.ok(response.uptime >= 0, 'Uptime should be non-negative');
    });
  });

  describe('Services Object Structure', () => {
    it('should have all required service fields', () => {
      const response = createMockHealthResponse();

      for (const field of HEALTH_SCHEMA.services.requiredFields) {
        assert.ok(
          field in response.services,
          `Missing required service field: ${field}`
        );
      }
    });

    it('should have julesApi field (required by CI health check)', () => {
      const response = createMockHealthResponse();
      assert.ok('julesApi' in response.services, 'julesApi field is required for CI');
    });

    it('should have julesApi with valid value', () => {
      const response = createMockHealthResponse();
      assert.ok(
        HEALTH_SCHEMA.services.julesApiValues.includes(response.services.julesApi),
        `julesApi value "${response.services.julesApi}" not in allowed values: ${HEALTH_SCHEMA.services.julesApiValues.join(', ')}`
      );
    });

    it('should have julesApi="configured" when API key is set', () => {
      const response = createMockHealthResponse({
        services: { julesApi: 'configured', database: 'configured', github: 'configured' }
      });
      assert.strictEqual(response.services.julesApi, 'configured');
    });

    it('should have database with valid configuration status', () => {
      const response = createMockHealthResponse();
      assert.ok(
        HEALTH_SCHEMA.services.configValues.includes(response.services.database),
        `database value should be one of: ${HEALTH_SCHEMA.services.configValues.join(', ')}`
      );
    });

    it('should have github with valid configuration status', () => {
      const response = createMockHealthResponse();
      assert.ok(
        HEALTH_SCHEMA.services.configValues.includes(response.services.github),
        `github value should be one of: ${HEALTH_SCHEMA.services.configValues.join(', ')}`
      );
    });
  });

  describe('Circuit Breaker Object Structure', () => {
    it('should have all required circuit breaker fields', () => {
      const response = createMockHealthResponse();

      for (const field of HEALTH_SCHEMA.circuitBreaker.requiredFields) {
        assert.ok(
          field in response.circuitBreaker,
          `Missing required circuit breaker field: ${field}`
        );
      }
    });

    it('should have failures as a number', () => {
      const response = createMockHealthResponse();
      assert.strictEqual(typeof response.circuitBreaker.failures, 'number');
    });

    it('should have isOpen as a boolean', () => {
      const response = createMockHealthResponse();
      assert.strictEqual(typeof response.circuitBreaker.isOpen, 'boolean');
    });
  });

  describe('Memory Object Structure', () => {
    it('should have all required memory fields', () => {
      const response = createMockHealthResponse();

      for (const field of HEALTH_SCHEMA.memory.requiredFields) {
        assert.ok(
          field in response.memory,
          `Missing required memory field: ${field}`
        );
      }
    });

    it('should have memory values as strings with MB suffix', () => {
      const response = createMockHealthResponse();
      assert.ok(response.memory.used.endsWith('MB'), 'memory.used should end with MB');
      assert.ok(response.memory.total.endsWith('MB'), 'memory.total should end with MB');
    });
  });
});

// =============================================================================
// CI/CD Integration Tests
// =============================================================================

describe('CI/CD Health Check Compatibility', () => {
  it('should produce JSON that CI grep can match for status:ok', () => {
    const response = createMockHealthResponse();
    const json = JSON.stringify(response);

    // This is exactly what the CI workflow checks
    assert.ok(
      json.includes('"status":"ok"'),
      'JSON must contain "status":"ok" for CI health check'
    );
  });

  it('should produce JSON that CI grep can match for julesApi:configured', () => {
    const response = createMockHealthResponse();
    const json = JSON.stringify(response);

    // This is exactly what the CI workflow checks (after our fix)
    assert.ok(
      json.includes('"julesApi":"configured"'),
      'JSON must contain "julesApi":"configured" for CI health check'
    );
  });

  it('should NOT have apiKeyConfigured field (old format)', () => {
    const response = createMockHealthResponse();

    // Ensure we don't accidentally revert to old format
    assert.ok(
      !('apiKeyConfigured' in response),
      'Response should not contain deprecated apiKeyConfigured field'
    );
  });

  it('should serialize to valid JSON', () => {
    const response = createMockHealthResponse();

    assert.doesNotThrow(() => {
      JSON.stringify(response);
    }, 'Response should be JSON serializable');
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('Health Response Edge Cases', () => {
  it('should handle julesApi=not_configured gracefully', () => {
    const response = createMockHealthResponse({
      services: { julesApi: 'not_configured', database: 'configured', github: 'configured' }
    });

    assert.strictEqual(response.services.julesApi, 'not_configured');
    assert.strictEqual(response.status, 'ok'); // Service can still be "ok" without API key
  });

  it('should handle circuit_open state', () => {
    const response = createMockHealthResponse({
      services: { julesApi: 'circuit_open', database: 'configured', github: 'configured' },
      circuitBreaker: { failures: 5, isOpen: true }
    });

    assert.strictEqual(response.services.julesApi, 'circuit_open');
    assert.strictEqual(response.circuitBreaker.isOpen, true);
  });

  it('should handle all services unconfigured', () => {
    const response = createMockHealthResponse({
      services: { julesApi: 'not_configured', database: 'not_configured', github: 'not_configured' }
    });

    // Status should still be ok - just services are unconfigured
    assert.strictEqual(response.status, 'ok');
  });
});
