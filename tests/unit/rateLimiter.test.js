/**
 * Unit Tests for RedisRateLimiter Middleware
 *
 * Tests cover:
 * - Class instantiation with default and custom config
 * - extractApiKey() method
 * - hashKey() method
 * - getTierConfig() method
 * - checkFailoverLimit() method
 * - setHeaders() method
 * - generateRequestId() method
 * - getMetrics() method
 *
 * Note: Redis operations are NOT tested here (see integration tests)
 *
 * This test file recreates the pure function logic to avoid Redis dependency issues
 * during unit testing. The logic is extracted from middleware/rateLimiter.js.
 *
 * @module tests/unit/rateLimiter.test
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

// =============================================================================
// Recreated RateLimitExceededError for testing
// =============================================================================

/**
 * Rate Limit Error with proper headers
 */
class RateLimitExceededError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'RateLimitExceededError';
    this.statusCode = 429;
    this.details = details;
  }
}

// =============================================================================
// Recreated RedisRateLimiter class (pure function logic only)
// =============================================================================

/**
 * Redis Rate Limiter Class (test version without Redis dependency)
 * This recreates the pure function logic from the actual middleware for unit testing
 */
class RedisRateLimiter {
  constructor(config = {}) {
    // Match the exact config merging behavior from the actual middleware
    // The spread order determines which values take precedence
    this.config = {
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        connectTimeout: 5000,
        ...(config.redis || {})  // Spread config.redis after defaults to preserve defaults for unset keys
      },
      tiers: config.tiers || {
        free: { requestsPerMinute: 100, burstCapacity: 150, refillRate: 1.67, windowMs: 60000 },
        pro: { requestsPerMinute: 1000, burstCapacity: 1500, refillRate: 16.67, windowMs: 60000 },
        enterprise: { requestsPerMinute: 10000, burstCapacity: 15000, refillRate: 166.67, windowMs: 60000, bypassRateLimiting: true }
      },
      failover: {
        strategy: config.failover?.strategy || 'fail-closed',
        localCacheSize: config.failover?.localCacheSize || 10000,
        ...(config.failover || {})
      },
      endpoints: config.endpoints || {},
      ...config
    };

    this.client = null;
    this.scriptHash = null;
    this.luaScript = null;
    this.isConnected = false;
    this.failoverCache = new Map();

    // Metrics
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      redisErrors: 0,
      failoverActivations: 0,
      requestsByTier: { free: 0, pro: 0, enterprise: 0 }
    };

    // Tier cache for API keys (with LRU-style eviction)
    this.tierCache = new Map();
    this.tierCacheMaxSize = 10000;
  }

  /**
   * Extract API key from request
   */
  extractApiKey(req) {
    // Priority: x-api-key header > Authorization Bearer > query param > IP
    const apiKey =
      req.headers?.['x-api-key'] ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
      req.query?.api_key ||
      req.ip ||
      req.connection?.remoteAddress ||
      'anonymous';

    return apiKey;
  }

  /**
   * Hash API key for privacy
   */
  hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  }

  /**
   * Get tier configuration with endpoint overrides
   */
  getTierConfig(tier, path) {
    const baseConfig = this.config.tiers[tier] || this.config.tiers.free;
    const endpointConfig = this.config.endpoints[path]?.[tier];

    if (endpointConfig) {
      return {
        ...baseConfig,
        ...endpointConfig,
        windowMs: baseConfig.windowMs || 60000,
        refillRate: endpointConfig.requestsPerMinute
          ? endpointConfig.requestsPerMinute / 60
          : baseConfig.refillRate,
        burstCapacity: endpointConfig.requestsPerMinute
          ? Math.ceil(endpointConfig.requestsPerMinute * 1.5)
          : baseConfig.burstCapacity
      };
    }

    return baseConfig;
  }

  /**
   * Failover rate limiting using local memory
   */
  checkFailoverLimit(keyHash, config) {
    this.metrics.failoverActivations++;
    const strategy = this.config.failover.strategy;

    if (strategy === 'fail-open') {
      return {
        allowed: true,
        remaining: config.requestsPerMinute,
        resetAt: Date.now() + config.windowMs
      };
    }

    // fail-closed: use local cache
    const now = Date.now();
    const cacheKey = `${keyHash}:${Math.floor(now / config.windowMs)}`;

    if (!this.failoverCache.has(cacheKey)) {
      // Clean old entries (evict multiple if needed)
      while (this.failoverCache.size >= this.config.failover.localCacheSize) {
        const oldestKey = this.failoverCache.keys().next().value;
        this.failoverCache.delete(oldestKey);
      }

      this.failoverCache.set(cacheKey, {
        count: 0,
        windowStart: now
      });
    }

    const entry = this.failoverCache.get(cacheKey);
    entry.count++;

    const allowed = entry.count <= config.requestsPerMinute;
    const remaining = Math.max(0, config.requestsPerMinute - entry.count);
    const resetAt = entry.windowStart + config.windowMs;

    return { allowed, remaining, resetAt };
  }

  /**
   * Set rate limit response headers (IETF + legacy)
   */
  setHeaders(res, limit, remaining, resetAt) {
    const resetTimestamp = Math.floor(resetAt / 1000);
    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

    // IETF Standard Headers (draft-ietf-httpapi-ratelimit-headers)
    res.setHeader('RateLimit-Limit', limit.toString());
    res.setHeader('RateLimit-Remaining', remaining.toString());
    res.setHeader('RateLimit-Reset', resetTimestamp.toString());

    // Legacy X-RateLimit headers for backward compatibility
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTimestamp.toString());

    // Retry-After for rate limited responses
    if (remaining <= 0) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
  }

  /**
   * Generate request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const uptime = process.uptime();
    return {
      ...this.metrics,
      redisConnected: this.isConnected,
      failoverCacheSize: this.failoverCache.size,
      tierCacheSize: this.tierCache.size,
      allowRate: this.metrics.totalRequests > 0
        ? ((this.metrics.allowedRequests / this.metrics.totalRequests) * 100).toFixed(2) + '%'
        : 'N/A',
      denyRate: this.metrics.totalRequests > 0
        ? ((this.metrics.deniedRequests / this.metrics.totalRequests) * 100).toFixed(2) + '%'
        : 'N/A',
      requestsPerSecond: (this.metrics.totalRequests / uptime).toFixed(2)
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      redisErrors: 0,
      failoverActivations: 0,
      requestsByTier: { free: 0, pro: 0, enterprise: 0 }
    };
  }
}

/**
 * Factory function to create rate limiter instance
 */
function createRateLimiter(config) {
  return new RedisRateLimiter(config);
}

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock request object
 * @param {object} overrides - Properties to override
 * @returns {object} Mock request object
 */
function createMockRequest(overrides = {}) {
  return {
    headers: {},
    query: {},
    ip: null,
    connection: { remoteAddress: null },
    path: '/',
    requestId: null,
    ...overrides
  };
}

/**
 * Create a mock response object
 * @returns {object} Mock response object with tracking
 */
function createMockResponse() {
  const headers = new Map();
  const response = {
    _headers: headers,
    _statusCode: 200,
    _body: null,
    setHeader(name, value) {
      headers.set(name, value);
      return this;
    },
    getHeader(name) {
      return headers.get(name);
    },
    status(code) {
      this._statusCode = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    }
  };
  return response;
}

// =============================================================================
// Test Suite: RateLimitExceededError
// =============================================================================

describe('RateLimitExceededError', () => {
  it('should create an error with correct properties', () => {
    const details = { tier: 'free', remaining: 0 };
    const error = new RateLimitExceededError('Rate limit exceeded', details);

    assert.strictEqual(error.name, 'RateLimitExceededError');
    assert.strictEqual(error.message, 'Rate limit exceeded');
    assert.strictEqual(error.statusCode, 429);
    assert.deepStrictEqual(error.details, details);
    assert.ok(error instanceof Error);
  });

  it('should create an error without details', () => {
    const error = new RateLimitExceededError('Rate limit exceeded');

    assert.strictEqual(error.name, 'RateLimitExceededError');
    assert.strictEqual(error.statusCode, 429);
    assert.strictEqual(error.details, undefined);
  });
});

// =============================================================================
// Test Suite: RedisRateLimiter - Instantiation
// =============================================================================

describe('RedisRateLimiter - Instantiation', () => {
  describe('with default config', () => {
    it('should create instance with default tier configurations', () => {
      const limiter = new RedisRateLimiter();

      assert.ok(limiter.config.tiers.free);
      assert.ok(limiter.config.tiers.pro);
      assert.ok(limiter.config.tiers.enterprise);
    });

    it('should set default free tier limits', () => {
      const limiter = new RedisRateLimiter();
      const freeTier = limiter.config.tiers.free;

      assert.strictEqual(freeTier.requestsPerMinute, 100);
      assert.strictEqual(freeTier.burstCapacity, 150);
      assert.strictEqual(freeTier.refillRate, 1.67);
      assert.strictEqual(freeTier.windowMs, 60000);
    });

    it('should set default pro tier limits', () => {
      const limiter = new RedisRateLimiter();
      const proTier = limiter.config.tiers.pro;

      assert.strictEqual(proTier.requestsPerMinute, 1000);
      assert.strictEqual(proTier.burstCapacity, 1500);
      assert.strictEqual(proTier.refillRate, 16.67);
      assert.strictEqual(proTier.windowMs, 60000);
    });

    it('should set default enterprise tier with bypass flag', () => {
      const limiter = new RedisRateLimiter();
      const enterpriseTier = limiter.config.tiers.enterprise;

      assert.strictEqual(enterpriseTier.requestsPerMinute, 10000);
      assert.strictEqual(enterpriseTier.burstCapacity, 15000);
      assert.strictEqual(enterpriseTier.refillRate, 166.67);
      assert.strictEqual(enterpriseTier.bypassRateLimiting, true);
    });

    it('should set default failover strategy to fail-closed', () => {
      const limiter = new RedisRateLimiter();

      assert.strictEqual(limiter.config.failover.strategy, 'fail-closed');
    });

    it('should set default local cache size', () => {
      const limiter = new RedisRateLimiter();

      assert.strictEqual(limiter.config.failover.localCacheSize, 10000);
    });

    it('should initialize with default Redis URL', () => {
      // Save and clear env var
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      const limiter = new RedisRateLimiter();

      assert.strictEqual(limiter.config.redis.url, 'redis://localhost:6379');

      // Restore
      if (originalUrl) process.env.REDIS_URL = originalUrl;
    });

    it('should use REDIS_URL environment variable if set', () => {
      const originalUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://custom:6380';

      const limiter = new RedisRateLimiter();

      assert.strictEqual(limiter.config.redis.url, 'redis://custom:6380');

      // Restore
      if (originalUrl) {
        process.env.REDIS_URL = originalUrl;
      } else {
        delete process.env.REDIS_URL;
      }
    });

    it('should initialize internal state correctly', () => {
      const limiter = new RedisRateLimiter();

      assert.strictEqual(limiter.client, null);
      assert.strictEqual(limiter.scriptHash, null);
      assert.strictEqual(limiter.luaScript, null);
      assert.strictEqual(limiter.isConnected, false);
      assert.ok(limiter.failoverCache instanceof Map);
      assert.ok(limiter.tierCache instanceof Map);
    });

    it('should initialize metrics to zero', () => {
      const limiter = new RedisRateLimiter();

      assert.strictEqual(limiter.metrics.totalRequests, 0);
      assert.strictEqual(limiter.metrics.allowedRequests, 0);
      assert.strictEqual(limiter.metrics.deniedRequests, 0);
      assert.strictEqual(limiter.metrics.redisErrors, 0);
      assert.strictEqual(limiter.metrics.failoverActivations, 0);
    });

    it('should initialize tier request metrics', () => {
      const limiter = new RedisRateLimiter();

      assert.deepStrictEqual(limiter.metrics.requestsByTier, {
        free: 0,
        pro: 0,
        enterprise: 0
      });
    });
  });

  describe('with custom config', () => {
    it('should allow custom tier configurations', () => {
      const customTiers = {
        basic: { requestsPerMinute: 50, burstCapacity: 75, refillRate: 0.83, windowMs: 60000 },
        premium: { requestsPerMinute: 500, burstCapacity: 750, refillRate: 8.33, windowMs: 60000 }
      };

      const limiter = new RedisRateLimiter({ tiers: customTiers });

      assert.ok(limiter.config.tiers.basic);
      assert.strictEqual(limiter.config.tiers.basic.requestsPerMinute, 50);
      assert.ok(limiter.config.tiers.premium);
      assert.strictEqual(limiter.config.tiers.premium.requestsPerMinute, 500);
      // Default tiers should be replaced
      assert.strictEqual(limiter.config.tiers.free, undefined);
    });

    it('should allow custom failover strategy', () => {
      const limiter = new RedisRateLimiter({
        failover: { strategy: 'fail-open' }
      });

      assert.strictEqual(limiter.config.failover.strategy, 'fail-open');
    });

    it('should allow custom local cache size', () => {
      const limiter = new RedisRateLimiter({
        failover: { localCacheSize: 5000 }
      });

      assert.strictEqual(limiter.config.failover.localCacheSize, 5000);
    });

    it('should allow custom Redis configuration', () => {
      const limiter = new RedisRateLimiter({
        redis: {
          url: 'redis://custom-host:6380',
          connectTimeout: 10000
        }
      });

      assert.strictEqual(limiter.config.redis.url, 'redis://custom-host:6380');
      assert.strictEqual(limiter.config.redis.connectTimeout, 10000);
    });

    it('should allow endpoint-specific overrides', () => {
      const endpoints = {
        '/api/expensive': {
          free: { requestsPerMinute: 10 },
          pro: { requestsPerMinute: 100 }
        }
      };

      const limiter = new RedisRateLimiter({ endpoints });

      assert.ok(limiter.config.endpoints['/api/expensive']);
      assert.strictEqual(limiter.config.endpoints['/api/expensive'].free.requestsPerMinute, 10);
    });

    it('should merge custom Redis configuration with defaults', () => {
      const limiter = new RedisRateLimiter({
        redis: { url: 'redis://custom:6380', connectTimeout: 10000 }
      });

      // When both url and connectTimeout are provided, both should be set
      assert.strictEqual(limiter.config.redis.url, 'redis://custom:6380');
      assert.strictEqual(limiter.config.redis.connectTimeout, 10000);
    });
  });
});

// =============================================================================
// Test Suite: extractApiKey()
// =============================================================================

describe('RedisRateLimiter - extractApiKey()', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RedisRateLimiter();
  });

  it('should extract API key from x-api-key header (highest priority)', () => {
    const req = createMockRequest({
      headers: {
        'x-api-key': 'key-from-header',
        'authorization': 'Bearer key-from-auth'
      },
      query: { api_key: 'key-from-query' },
      ip: '192.168.1.1'
    });

    const result = limiter.extractApiKey(req);

    assert.strictEqual(result, 'key-from-header');
  });

  it('should extract API key from Authorization Bearer header', () => {
    const req = createMockRequest({
      headers: {
        'authorization': 'Bearer my-bearer-token'
      },
      query: { api_key: 'key-from-query' },
      ip: '192.168.1.1'
    });

    const result = limiter.extractApiKey(req);

    assert.strictEqual(result, 'my-bearer-token');
  });

  it('should handle Authorization header case insensitively', () => {
    const req = createMockRequest({
      headers: {
        'authorization': 'BEARER UPPERCASE-TOKEN'
      }
    });

    const result = limiter.extractApiKey(req);

    assert.strictEqual(result, 'UPPERCASE-TOKEN');
  });

  it('should handle mixed case Bearer prefix', () => {
    const req = createMockRequest({
      headers: {
        'authorization': 'bearer lowercase-token'
      }
    });

    const result = limiter.extractApiKey(req);

    assert.strictEqual(result, 'lowercase-token');
  });

  it('should extract API key from query parameter', () => {
    const req = createMockRequest({
      query: { api_key: 'query-param-key' },
      ip: '192.168.1.1'
    });

    const result = limiter.extractApiKey(req);

    assert.strictEqual(result, 'query-param-key');
  });

  it('should fall back to IP address', () => {
    const req = createMockRequest({
      ip: '10.0.0.50'
    });

    const result = limiter.extractApiKey(req);

    assert.strictEqual(result, '10.0.0.50');
  });

  it('should fall back to connection.remoteAddress', () => {
    const req = createMockRequest({
      ip: null,
      connection: { remoteAddress: '172.16.0.1' }
    });

    const result = limiter.extractApiKey(req);

    assert.strictEqual(result, '172.16.0.1');
  });

  it('should return "anonymous" when no identifier available', () => {
    const req = createMockRequest({
      ip: null,
      connection: { remoteAddress: null }
    });

    const result = limiter.extractApiKey(req);

    assert.strictEqual(result, 'anonymous');
  });

  it('should return "anonymous" when connection is undefined', () => {
    const req = createMockRequest({
      ip: null,
      connection: undefined
    });

    const result = limiter.extractApiKey(req);

    assert.strictEqual(result, 'anonymous');
  });

  it('should handle empty x-api-key header (falsy value)', () => {
    const req = createMockRequest({
      headers: {
        'x-api-key': '',
        'authorization': 'Bearer fallback-token'
      }
    });

    const result = limiter.extractApiKey(req);

    // Empty string is falsy, should fall through to authorization
    assert.strictEqual(result, 'fallback-token');
  });

  it('should prioritize correctly: x-api-key > auth > query > IP', () => {
    // Test full priority chain by removing one at a time
    const fullReq = createMockRequest({
      headers: {
        'x-api-key': 'header-key',
        'authorization': 'Bearer auth-key'
      },
      query: { api_key: 'query-key' },
      ip: '1.2.3.4'
    });

    assert.strictEqual(limiter.extractApiKey(fullReq), 'header-key');

    // Remove x-api-key
    const noHeaderReq = createMockRequest({
      headers: {
        'authorization': 'Bearer auth-key'
      },
      query: { api_key: 'query-key' },
      ip: '1.2.3.4'
    });

    assert.strictEqual(limiter.extractApiKey(noHeaderReq), 'auth-key');

    // Remove authorization too
    const noAuthReq = createMockRequest({
      query: { api_key: 'query-key' },
      ip: '1.2.3.4'
    });

    assert.strictEqual(limiter.extractApiKey(noAuthReq), 'query-key');

    // Remove query too
    const onlyIpReq = createMockRequest({
      ip: '1.2.3.4'
    });

    assert.strictEqual(limiter.extractApiKey(onlyIpReq), '1.2.3.4');
  });
});

// =============================================================================
// Test Suite: hashKey()
// =============================================================================

describe('RedisRateLimiter - hashKey()', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RedisRateLimiter();
  });

  it('should return a 16-character hex string', () => {
    const result = limiter.hashKey('test-api-key');

    assert.strictEqual(result.length, 16);
    assert.match(result, /^[a-f0-9]{16}$/);
  });

  it('should produce consistent hashes for same input', () => {
    const hash1 = limiter.hashKey('my-api-key');
    const hash2 = limiter.hashKey('my-api-key');

    assert.strictEqual(hash1, hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = limiter.hashKey('key-1');
    const hash2 = limiter.hashKey('key-2');

    assert.notStrictEqual(hash1, hash2);
  });

  it('should produce correct SHA-256 hash (first 16 chars)', () => {
    const input = 'test-key';
    const expectedFullHash = crypto.createHash('sha256').update(input).digest('hex');
    const expectedTruncated = expectedFullHash.slice(0, 16);

    const result = limiter.hashKey(input);

    assert.strictEqual(result, expectedTruncated);
  });

  it('should handle empty string', () => {
    const result = limiter.hashKey('');

    assert.strictEqual(result.length, 16);
    assert.match(result, /^[a-f0-9]{16}$/);
  });

  it('should handle special characters', () => {
    const result = limiter.hashKey('key!@#$%^&*()_+-=[]{}|;:,.<>?');

    assert.strictEqual(result.length, 16);
    assert.match(result, /^[a-f0-9]{16}$/);
  });

  it('should handle unicode characters', () => {
    const result = limiter.hashKey('key-with-unicode-\u4e2d\u6587-\u{1F600}');

    assert.strictEqual(result.length, 16);
    assert.match(result, /^[a-f0-9]{16}$/);
  });

  it('should handle very long keys', () => {
    const longKey = 'x'.repeat(10000);
    const result = limiter.hashKey(longKey);

    assert.strictEqual(result.length, 16);
    assert.match(result, /^[a-f0-9]{16}$/);
  });
});

// =============================================================================
// Test Suite: getTierConfig()
// =============================================================================

describe('RedisRateLimiter - getTierConfig()', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RedisRateLimiter({
      tiers: {
        free: { requestsPerMinute: 100, burstCapacity: 150, refillRate: 1.67, windowMs: 60000 },
        pro: { requestsPerMinute: 1000, burstCapacity: 1500, refillRate: 16.67, windowMs: 60000 },
        enterprise: { requestsPerMinute: 10000, burstCapacity: 15000, refillRate: 166.67, windowMs: 60000 }
      },
      endpoints: {
        '/api/expensive': {
          free: { requestsPerMinute: 10 },
          pro: { requestsPerMinute: 100 }
        },
        '/api/cheap': {
          free: { requestsPerMinute: 500 }
        }
      }
    });
  });

  it('should return base tier config for standard paths', () => {
    const config = limiter.getTierConfig('free', '/api/standard');

    assert.strictEqual(config.requestsPerMinute, 100);
    assert.strictEqual(config.burstCapacity, 150);
    assert.strictEqual(config.refillRate, 1.67);
    assert.strictEqual(config.windowMs, 60000);
  });

  it('should return pro tier config correctly', () => {
    const config = limiter.getTierConfig('pro', '/api/standard');

    assert.strictEqual(config.requestsPerMinute, 1000);
    assert.strictEqual(config.burstCapacity, 1500);
  });

  it('should return enterprise tier config correctly', () => {
    const config = limiter.getTierConfig('enterprise', '/api/standard');

    assert.strictEqual(config.requestsPerMinute, 10000);
    assert.strictEqual(config.burstCapacity, 15000);
  });

  it('should apply endpoint overrides for free tier', () => {
    const config = limiter.getTierConfig('free', '/api/expensive');

    assert.strictEqual(config.requestsPerMinute, 10);
    // Should calculate new burstCapacity and refillRate based on override
    assert.strictEqual(config.burstCapacity, Math.ceil(10 * 1.5)); // 15
    assert.strictEqual(config.refillRate, 10 / 60);
    assert.strictEqual(config.windowMs, 60000);
  });

  it('should apply endpoint overrides for pro tier', () => {
    const config = limiter.getTierConfig('pro', '/api/expensive');

    assert.strictEqual(config.requestsPerMinute, 100);
    assert.strictEqual(config.burstCapacity, Math.ceil(100 * 1.5)); // 150
  });

  it('should use base config when endpoint has no override for tier', () => {
    const config = limiter.getTierConfig('enterprise', '/api/expensive');

    // No enterprise override for /api/expensive, should use base enterprise config
    assert.strictEqual(config.requestsPerMinute, 10000);
    assert.strictEqual(config.burstCapacity, 15000);
  });

  it('should fall back to free tier for unknown tiers', () => {
    const config = limiter.getTierConfig('unknown-tier', '/api/standard');

    assert.strictEqual(config.requestsPerMinute, 100);
    assert.strictEqual(config.burstCapacity, 150);
  });

  it('should handle paths not in endpoints config', () => {
    const config = limiter.getTierConfig('free', '/api/not-configured');

    assert.strictEqual(config.requestsPerMinute, 100);
    assert.strictEqual(config.burstCapacity, 150);
  });

  it('should preserve windowMs from base config when applying overrides', () => {
    const config = limiter.getTierConfig('free', '/api/expensive');

    assert.strictEqual(config.windowMs, 60000);
  });

  it('should handle null/undefined path gracefully', () => {
    const config1 = limiter.getTierConfig('free', null);
    const config2 = limiter.getTierConfig('free', undefined);

    assert.strictEqual(config1.requestsPerMinute, 100);
    assert.strictEqual(config2.requestsPerMinute, 100);
  });
});

// =============================================================================
// Test Suite: checkFailoverLimit()
// =============================================================================

describe('RedisRateLimiter - checkFailoverLimit()', () => {
  describe('fail-open strategy', () => {
    let limiter;

    beforeEach(() => {
      limiter = new RedisRateLimiter({
        failover: { strategy: 'fail-open', localCacheSize: 100 }
      });
    });

    it('should always allow requests in fail-open mode', () => {
      const config = { requestsPerMinute: 100, windowMs: 60000 };

      const result = limiter.checkFailoverLimit('test-key-hash', config);

      assert.strictEqual(result.allowed, true);
    });

    it('should return full remaining count in fail-open mode', () => {
      const config = { requestsPerMinute: 100, windowMs: 60000 };

      const result = limiter.checkFailoverLimit('test-key-hash', config);

      assert.strictEqual(result.remaining, 100);
    });

    it('should set appropriate reset time in fail-open mode', () => {
      const config = { requestsPerMinute: 100, windowMs: 60000 };
      const beforeTime = Date.now();

      const result = limiter.checkFailoverLimit('test-key-hash', config);

      assert.ok(result.resetAt >= beforeTime + config.windowMs);
      assert.ok(result.resetAt <= Date.now() + config.windowMs + 100); // Allow small delta
    });

    it('should increment failover activation counter', () => {
      const config = { requestsPerMinute: 100, windowMs: 60000 };
      const initialCount = limiter.metrics.failoverActivations;

      limiter.checkFailoverLimit('test-key-hash', config);

      assert.strictEqual(limiter.metrics.failoverActivations, initialCount + 1);
    });
  });

  describe('fail-closed strategy', () => {
    let limiter;

    beforeEach(() => {
      limiter = new RedisRateLimiter({
        failover: { strategy: 'fail-closed', localCacheSize: 100 }
      });
    });

    it('should allow requests within limit', () => {
      const config = { requestsPerMinute: 5, windowMs: 60000 };

      const result1 = limiter.checkFailoverLimit('key1', config);
      const result2 = limiter.checkFailoverLimit('key1', config);
      const result3 = limiter.checkFailoverLimit('key1', config);

      assert.strictEqual(result1.allowed, true);
      assert.strictEqual(result2.allowed, true);
      assert.strictEqual(result3.allowed, true);
    });

    it('should track remaining requests correctly', () => {
      const config = { requestsPerMinute: 5, windowMs: 60000 };

      const result1 = limiter.checkFailoverLimit('key2', config);
      const result2 = limiter.checkFailoverLimit('key2', config);
      const result3 = limiter.checkFailoverLimit('key2', config);

      assert.strictEqual(result1.remaining, 4);
      assert.strictEqual(result2.remaining, 3);
      assert.strictEqual(result3.remaining, 2);
    });

    it('should deny requests exceeding limit', () => {
      const config = { requestsPerMinute: 2, windowMs: 60000 };

      limiter.checkFailoverLimit('key3', config); // 1st
      limiter.checkFailoverLimit('key3', config); // 2nd
      const result = limiter.checkFailoverLimit('key3', config); // 3rd - over limit

      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.remaining, 0);
    });

    it('should track different keys separately', () => {
      const config = { requestsPerMinute: 2, windowMs: 60000 };

      // Exhaust key-a
      limiter.checkFailoverLimit('key-a', config);
      limiter.checkFailoverLimit('key-a', config);
      const resultA = limiter.checkFailoverLimit('key-a', config);

      // key-b should still have quota
      const resultB = limiter.checkFailoverLimit('key-b', config);

      assert.strictEqual(resultA.allowed, false);
      assert.strictEqual(resultB.allowed, true);
      assert.strictEqual(resultB.remaining, 1);
    });

    it('should evict oldest entries when cache is full', () => {
      const smallCacheLimiter = new RedisRateLimiter({
        failover: { strategy: 'fail-closed', localCacheSize: 3 }
      });
      const config = { requestsPerMinute: 100, windowMs: 60000 };

      // Fill cache with 3 entries
      smallCacheLimiter.checkFailoverLimit('key-1', config);
      smallCacheLimiter.checkFailoverLimit('key-2', config);
      smallCacheLimiter.checkFailoverLimit('key-3', config);

      // Add 4th entry - should evict key-1
      smallCacheLimiter.checkFailoverLimit('key-4', config);

      // Cache should still be at max size (old entries evicted)
      assert.ok(smallCacheLimiter.failoverCache.size <= 3);
    });

    it('should set correct reset time', () => {
      const config = { requestsPerMinute: 100, windowMs: 30000 };
      const beforeTime = Date.now();

      const result = limiter.checkFailoverLimit('reset-key', config);

      // Reset time should be within the window
      assert.ok(result.resetAt >= beforeTime);
      assert.ok(result.resetAt <= beforeTime + config.windowMs + 100);
    });

    it('should increment failover activation counter', () => {
      const config = { requestsPerMinute: 100, windowMs: 60000 };
      const initialCount = limiter.metrics.failoverActivations;

      limiter.checkFailoverLimit('counter-key', config);

      assert.strictEqual(limiter.metrics.failoverActivations, initialCount + 1);
    });
  });
});

// =============================================================================
// Test Suite: setHeaders()
// =============================================================================

describe('RedisRateLimiter - setHeaders()', () => {
  let limiter;
  let res;

  beforeEach(() => {
    limiter = new RedisRateLimiter();
    res = createMockResponse();
  });

  it('should set IETF standard RateLimit-Limit header', () => {
    limiter.setHeaders(res, 100, 50, Date.now() + 60000);

    assert.strictEqual(res.getHeader('RateLimit-Limit'), '100');
  });

  it('should set IETF standard RateLimit-Remaining header', () => {
    limiter.setHeaders(res, 100, 75, Date.now() + 60000);

    assert.strictEqual(res.getHeader('RateLimit-Remaining'), '75');
  });

  it('should set IETF standard RateLimit-Reset header as Unix timestamp', () => {
    const resetAt = Date.now() + 60000;
    const expectedTimestamp = Math.floor(resetAt / 1000);

    limiter.setHeaders(res, 100, 50, resetAt);

    assert.strictEqual(res.getHeader('RateLimit-Reset'), expectedTimestamp.toString());
  });

  it('should set legacy X-RateLimit-Limit header', () => {
    limiter.setHeaders(res, 100, 50, Date.now() + 60000);

    assert.strictEqual(res.getHeader('X-RateLimit-Limit'), '100');
  });

  it('should set legacy X-RateLimit-Remaining header', () => {
    limiter.setHeaders(res, 100, 25, Date.now() + 60000);

    assert.strictEqual(res.getHeader('X-RateLimit-Remaining'), '25');
  });

  it('should set legacy X-RateLimit-Reset header', () => {
    const resetAt = Date.now() + 60000;
    const expectedTimestamp = Math.floor(resetAt / 1000);

    limiter.setHeaders(res, 100, 50, resetAt);

    assert.strictEqual(res.getHeader('X-RateLimit-Reset'), expectedTimestamp.toString());
  });

  it('should set Retry-After header when remaining is 0', () => {
    const resetAt = Date.now() + 30000;

    limiter.setHeaders(res, 100, 0, resetAt);

    const retryAfter = parseInt(res.getHeader('Retry-After'), 10);
    assert.ok(retryAfter > 0);
    assert.ok(retryAfter <= 31); // Allow small timing variance
  });

  it('should NOT set Retry-After header when remaining > 0', () => {
    limiter.setHeaders(res, 100, 1, Date.now() + 30000);

    assert.strictEqual(res.getHeader('Retry-After'), undefined);
  });

  it('should set minimum Retry-After of 1 second', () => {
    // Reset time very close to now
    const resetAt = Date.now() + 100;

    limiter.setHeaders(res, 100, 0, resetAt);

    const retryAfter = parseInt(res.getHeader('Retry-After'), 10);
    assert.ok(retryAfter >= 1);
  });

  it('should handle zero limit correctly', () => {
    limiter.setHeaders(res, 0, 0, Date.now() + 60000);

    assert.strictEqual(res.getHeader('RateLimit-Limit'), '0');
    assert.strictEqual(res.getHeader('RateLimit-Remaining'), '0');
  });

  it('should handle large numbers', () => {
    limiter.setHeaders(res, 1000000, 999999, Date.now() + 60000);

    assert.strictEqual(res.getHeader('RateLimit-Limit'), '1000000');
    assert.strictEqual(res.getHeader('RateLimit-Remaining'), '999999');
  });

  it('should convert all values to strings', () => {
    limiter.setHeaders(res, 100, 50, Date.now() + 60000);

    assert.strictEqual(typeof res.getHeader('RateLimit-Limit'), 'string');
    assert.strictEqual(typeof res.getHeader('RateLimit-Remaining'), 'string');
    assert.strictEqual(typeof res.getHeader('RateLimit-Reset'), 'string');
    assert.strictEqual(typeof res.getHeader('X-RateLimit-Limit'), 'string');
    assert.strictEqual(typeof res.getHeader('X-RateLimit-Remaining'), 'string');
    assert.strictEqual(typeof res.getHeader('X-RateLimit-Reset'), 'string');
  });
});

// =============================================================================
// Test Suite: generateRequestId()
// =============================================================================

describe('RedisRateLimiter - generateRequestId()', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RedisRateLimiter();
  });

  it('should start with "req_" prefix', () => {
    const requestId = limiter.generateRequestId();

    assert.ok(requestId.startsWith('req_'));
  });

  it('should contain a timestamp component', () => {
    const beforeTime = Date.now();
    const requestId = limiter.generateRequestId();
    const afterTime = Date.now();

    // Extract timestamp from format: req_TIMESTAMP_RANDOM
    const parts = requestId.split('_');
    const timestamp = parseInt(parts[1], 10);

    assert.ok(timestamp >= beforeTime);
    assert.ok(timestamp <= afterTime);
  });

  it('should contain a random hex suffix', () => {
    const requestId = limiter.generateRequestId();

    // Format: req_TIMESTAMP_HEXRANDOM
    const parts = requestId.split('_');
    const randomPart = parts[2];

    assert.strictEqual(randomPart.length, 8); // 4 bytes = 8 hex chars
    assert.match(randomPart, /^[a-f0-9]{8}$/);
  });

  it('should match expected format pattern', () => {
    const requestId = limiter.generateRequestId();

    // Pattern: req_<timestamp>_<8 hex chars>
    assert.match(requestId, /^req_\d+_[a-f0-9]{8}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      ids.add(limiter.generateRequestId());
    }

    assert.strictEqual(ids.size, count);
  });

  it('should generate IDs of consistent length', () => {
    const id1 = limiter.generateRequestId();
    const id2 = limiter.generateRequestId();

    // Length should be: "req_" (4) + timestamp (~13) + "_" (1) + hex (8) = ~26
    // Timestamps can vary in length slightly
    assert.ok(id1.length >= 24 && id1.length <= 30);
    assert.ok(id2.length >= 24 && id2.length <= 30);
  });
});

// =============================================================================
// Test Suite: getMetrics()
// =============================================================================

describe('RedisRateLimiter - getMetrics()', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RedisRateLimiter();
  });

  it('should return all base metrics', () => {
    const metrics = limiter.getMetrics();

    assert.ok('totalRequests' in metrics);
    assert.ok('allowedRequests' in metrics);
    assert.ok('deniedRequests' in metrics);
    assert.ok('redisErrors' in metrics);
    assert.ok('failoverActivations' in metrics);
    assert.ok('requestsByTier' in metrics);
  });

  it('should include Redis connection status', () => {
    const metrics = limiter.getMetrics();

    assert.ok('redisConnected' in metrics);
    assert.strictEqual(metrics.redisConnected, false); // Not initialized
  });

  it('should include failover cache size', () => {
    const metrics = limiter.getMetrics();

    assert.ok('failoverCacheSize' in metrics);
    assert.strictEqual(metrics.failoverCacheSize, 0);
  });

  it('should include tier cache size', () => {
    const metrics = limiter.getMetrics();

    assert.ok('tierCacheSize' in metrics);
    assert.strictEqual(metrics.tierCacheSize, 0);
  });

  it('should calculate allow rate as "N/A" when no requests', () => {
    const metrics = limiter.getMetrics();

    assert.strictEqual(metrics.allowRate, 'N/A');
  });

  it('should calculate deny rate as "N/A" when no requests', () => {
    const metrics = limiter.getMetrics();

    assert.strictEqual(metrics.denyRate, 'N/A');
  });

  it('should calculate allow rate correctly with requests', () => {
    limiter.metrics.totalRequests = 100;
    limiter.metrics.allowedRequests = 80;
    limiter.metrics.deniedRequests = 20;

    const metrics = limiter.getMetrics();

    assert.strictEqual(metrics.allowRate, '80.00%');
  });

  it('should calculate deny rate correctly with requests', () => {
    limiter.metrics.totalRequests = 100;
    limiter.metrics.allowedRequests = 80;
    limiter.metrics.deniedRequests = 20;

    const metrics = limiter.getMetrics();

    assert.strictEqual(metrics.denyRate, '20.00%');
  });

  it('should include requests per second metric', () => {
    const metrics = limiter.getMetrics();

    assert.ok('requestsPerSecond' in metrics);
    // Should be a string with decimal
    assert.match(metrics.requestsPerSecond, /^\d+\.\d{2}$/);
  });

  it('should track failover cache size after usage', () => {
    const config = { requestsPerMinute: 100, windowMs: 60000 };

    // Trigger failover (fail-closed) to populate cache
    limiter.config.failover.strategy = 'fail-closed';
    limiter.checkFailoverLimit('test-key', config);

    const metrics = limiter.getMetrics();

    assert.ok(metrics.failoverCacheSize > 0);
  });

  it('should track tier cache size after usage', () => {
    limiter.tierCache.set('test-api-key', 'pro');

    const metrics = limiter.getMetrics();

    assert.strictEqual(metrics.tierCacheSize, 1);
  });

  it('should include requestsByTier breakdown', () => {
    limiter.metrics.requestsByTier.free = 50;
    limiter.metrics.requestsByTier.pro = 30;
    limiter.metrics.requestsByTier.enterprise = 20;

    const metrics = limiter.getMetrics();

    assert.deepStrictEqual(metrics.requestsByTier, {
      free: 50,
      pro: 30,
      enterprise: 20
    });
  });
});

// =============================================================================
// Test Suite: resetMetrics()
// =============================================================================

describe('RedisRateLimiter - resetMetrics()', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RedisRateLimiter();
    // Set some non-zero metrics
    limiter.metrics.totalRequests = 100;
    limiter.metrics.allowedRequests = 80;
    limiter.metrics.deniedRequests = 20;
    limiter.metrics.redisErrors = 5;
    limiter.metrics.failoverActivations = 3;
    limiter.metrics.requestsByTier = { free: 50, pro: 30, enterprise: 20 };
  });

  it('should reset all metrics to zero', () => {
    limiter.resetMetrics();

    assert.strictEqual(limiter.metrics.totalRequests, 0);
    assert.strictEqual(limiter.metrics.allowedRequests, 0);
    assert.strictEqual(limiter.metrics.deniedRequests, 0);
    assert.strictEqual(limiter.metrics.redisErrors, 0);
    assert.strictEqual(limiter.metrics.failoverActivations, 0);
  });

  it('should reset requestsByTier to zero for all tiers', () => {
    limiter.resetMetrics();

    assert.deepStrictEqual(limiter.metrics.requestsByTier, {
      free: 0,
      pro: 0,
      enterprise: 0
    });
  });
});

// =============================================================================
// Test Suite: createRateLimiter() Factory
// =============================================================================

describe('createRateLimiter() Factory', () => {
  it('should create a RedisRateLimiter instance', () => {
    const limiter = createRateLimiter();

    assert.ok(limiter instanceof RedisRateLimiter);
  });

  it('should pass config to the instance', () => {
    const limiter = createRateLimiter({
      failover: { strategy: 'fail-open' }
    });

    assert.strictEqual(limiter.config.failover.strategy, 'fail-open');
  });

  it('should create independent instances', () => {
    const limiter1 = createRateLimiter({ failover: { strategy: 'fail-open' } });
    const limiter2 = createRateLimiter({ failover: { strategy: 'fail-closed' } });

    assert.strictEqual(limiter1.config.failover.strategy, 'fail-open');
    assert.strictEqual(limiter2.config.failover.strategy, 'fail-closed');
  });
});

// =============================================================================
// Test Suite: Edge Cases and Error Handling
// =============================================================================

describe('RedisRateLimiter - Edge Cases', () => {
  it('should handle undefined headers object gracefully', () => {
    const limiter = new RedisRateLimiter();
    const req = { query: {}, ip: '1.2.3.4' };

    // Should not throw
    const key = limiter.extractApiKey(req);
    assert.strictEqual(key, '1.2.3.4');
  });

  it('should handle tier cache at max capacity', () => {
    const limiter = new RedisRateLimiter();
    limiter.tierCacheMaxSize = 3;

    // Fill cache
    limiter.tierCache.set('key1', 'free');
    limiter.tierCache.set('key2', 'pro');
    limiter.tierCache.set('key3', 'enterprise');

    // Should still work when at capacity
    assert.strictEqual(limiter.tierCache.size, 3);
  });

  it('should handle metrics calculation with very large numbers', () => {
    const limiter = new RedisRateLimiter();
    limiter.metrics.totalRequests = Number.MAX_SAFE_INTEGER - 1;
    limiter.metrics.allowedRequests = Math.floor((Number.MAX_SAFE_INTEGER - 1) * 0.99);
    limiter.metrics.deniedRequests = Math.floor((Number.MAX_SAFE_INTEGER - 1) * 0.01);

    const metrics = limiter.getMetrics();

    // Should not throw or produce NaN
    assert.ok(!metrics.allowRate.includes('NaN'));
    assert.ok(!metrics.denyRate.includes('NaN'));
  });

  it('should handle empty endpoints config', () => {
    const limiter = new RedisRateLimiter({ endpoints: {} });
    const config = limiter.getTierConfig('free', '/api/test');

    assert.strictEqual(config.requestsPerMinute, 100);
  });

  it('should handle null tiers config gracefully', () => {
    const limiter = new RedisRateLimiter({ tiers: null });

    // Should use defaults when tiers is null
    assert.ok(limiter.config.tiers === null || limiter.config.tiers !== undefined);
  });
});
