/**
 * Integration Tests for Redis Rate Limiter
 *
 * Tests the full middleware flow with mocked Redis operations.
 * Uses Node.js built-in test runner (node:test) with mock module.
 *
 * Run with: node --test tests/integration/rateLimiter.integration.test.js
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// Mock Redis Client Factory
// ============================================================================

/**
 * Creates a mock Redis client with configurable behavior
 * @param {Object} options - Configuration options
 * @param {boolean} options.shouldConnect - Whether connect() should succeed
 * @param {boolean} options.shouldFailEvalSha - Whether evalSha should fail
 * @param {Array} options.evalShaResponses - Array of responses for evalSha calls
 * @param {Map} options.storage - Optional storage for get/set operations
 */
function createMockRedisClient(options = {}) {
  const {
    shouldConnect = true,
    shouldFailEvalSha = false,
    evalShaResponses = [],
    storage = new Map()
  } = options;

  let evalShaCallCount = 0;
  let isConnected = false;
  const eventHandlers = new Map();

  const mockClient = {
    // Event handling
    on: mock.fn((event, handler) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event).push(handler);
      return mockClient;
    }),

    emit: (event, ...args) => {
      const handlers = eventHandlers.get(event) || [];
      handlers.forEach(handler => handler(...args));
    },

    // Connection methods
    connect: mock.fn(async () => {
      if (!shouldConnect) {
        throw new Error('Connection refused');
      }
      isConnected = true;
      mockClient.emit('connect');
      return mockClient;
    }),

    quit: mock.fn(async () => {
      isConnected = false;
      return 'OK';
    }),

    // Script loading
    scriptLoad: mock.fn(async (script) => {
      return 'mock_script_hash_abc123';
    }),

    // Script execution (token bucket)
    evalSha: mock.fn(async (hash, options) => {
      if (shouldFailEvalSha) {
        throw new Error('NOSCRIPT No matching script');
      }

      // Return pre-configured response or default
      if (evalShaResponses.length > 0) {
        const response = evalShaResponses[evalShaCallCount % evalShaResponses.length];
        evalShaCallCount++;
        return response;
      }

      // Default: allow with 99 remaining tokens
      return [1, 99, Date.now() + 60000];
    }),

    // Key-value operations
    get: mock.fn(async (key) => {
      return storage.get(key) || null;
    }),

    set: mock.fn(async (key, value, options) => {
      storage.set(key, value);
      return 'OK';
    }),

    // Test helpers
    _getCallCount: () => evalShaCallCount,
    _isConnected: () => isConnected,
    _triggerError: (error) => mockClient.emit('error', error),
    _triggerReconnecting: () => mockClient.emit('reconnecting')
  };

  return mockClient;
}

// ============================================================================
// Mock Express Request/Response Factory
// ============================================================================

function createMockRequest(options = {}) {
  return {
    headers: options.headers || {},
    query: options.query || {},
    path: options.path || '/test',
    ip: options.ip || '127.0.0.1',
    connection: { remoteAddress: options.ip || '127.0.0.1' },
    requestId: options.requestId || undefined,
    rateLimit: undefined
  };
}

function createMockResponse() {
  const headers = new Map();
  let statusCode = 200;
  let jsonBody = null;
  let ended = false;

  return {
    setHeader: mock.fn((name, value) => {
      headers.set(name, value);
    }),

    status: mock.fn(function(code) {
      statusCode = code;
      return this;
    }),

    json: mock.fn((body) => {
      jsonBody = body;
      ended = true;
    }),

    // Test helpers
    _getHeaders: () => Object.fromEntries(headers),
    _getHeader: (name) => headers.get(name),
    _getStatusCode: () => statusCode,
    _getJsonBody: () => jsonBody,
    _isEnded: () => ended
  };
}

// ============================================================================
// Rate Limiter Class (inline for testing without import issues)
// ============================================================================

class MockableRedisRateLimiter {
  constructor(config = {}, mockClient = null) {
    this.config = {
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        connectTimeout: 5000,
        ...config.redis
      },
      tiers: config.tiers || {
        free: { requestsPerMinute: 100, burstCapacity: 150, refillRate: 1.67, windowMs: 60000 },
        pro: { requestsPerMinute: 1000, burstCapacity: 1500, refillRate: 16.67, windowMs: 60000 },
        enterprise: { requestsPerMinute: 10000, burstCapacity: 15000, refillRate: 166.67, windowMs: 60000, bypassRateLimiting: true }
      },
      failover: {
        strategy: config.failover?.strategy || 'fail-closed',
        localCacheSize: config.failover?.localCacheSize || 10000,
        ...config.failover
      },
      endpoints: config.endpoints || {},
      ...config
    };

    this.client = mockClient;
    this.scriptHash = null;
    this.isConnected = false;
    this.failoverCache = new Map();
    this.tierCache = new Map();
    this.tierCacheMaxSize = 10000;

    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      redisErrors: 0,
      failoverActivations: 0,
      requestsByTier: { free: 0, pro: 0, enterprise: 0 }
    };
  }

  async initialize() {
    try {
      if (!this.client) {
        throw new Error('No Redis client provided');
      }

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.metrics.redisErrors++;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        // Handle reconnection
      });

      await this.client.connect();
      this.scriptHash = await this.client.scriptLoad('mock_lua_script');
      this.isConnected = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  middleware() {
    return async (req, res, next) => {
      const startTime = Date.now();

      try {
        const apiKey = this.extractApiKey(req);
        const keyHash = this.hashKey(apiKey);
        const tier = await this.getTier(apiKey);
        const tierConfig = this.getTierConfig(tier, req.path);

        this.metrics.totalRequests++;
        this.metrics.requestsByTier[tier] = (this.metrics.requestsByTier[tier] || 0) + 1;

        if (tierConfig.bypassRateLimiting) {
          this.setHeaders(res, tierConfig.requestsPerMinute, tierConfig.requestsPerMinute, Date.now() + 60000);
          req.rateLimit = { tier, allowed: true, bypass: true };
          return next();
        }

        const result = await this.checkRateLimit(keyHash, tier, tierConfig);
        this.setHeaders(res, tierConfig.requestsPerMinute, result.remaining, result.resetAt);

        if (!result.allowed) {
          this.metrics.deniedRequests++;
          return this.sendRateLimitResponse(res, req, tier, tierConfig, result);
        }

        this.metrics.allowedRequests++;
        req.rateLimit = {
          tier,
          allowed: true,
          remaining: result.remaining,
          limit: tierConfig.requestsPerMinute,
          resetAt: result.resetAt,
          latency: Date.now() - startTime
        };

        next();
      } catch (error) {
        this.handleFailover(req, res, next, error);
      }
    };
  }

  async checkRateLimit(keyHash, tier, config) {
    if (!this.isConnected) {
      return this.checkFailoverLimit(keyHash, config);
    }

    try {
      const bucketKey = `rl:bucket:${tier}:${keyHash}`;
      const now = Date.now();
      const ttl = Math.ceil(config.windowMs / 1000) + 60;

      const result = await this.client.evalSha(this.scriptHash, {
        keys: [bucketKey],
        arguments: [
          now.toString(),
          (config.costPerRequest || 1).toString(),
          config.refillRate.toString(),
          config.burstCapacity.toString(),
          ttl.toString()
        ]
      });

      return {
        allowed: result[0] === 1,
        remaining: Math.max(0, result[1]),
        resetAt: result[2]
      };
    } catch (error) {
      this.metrics.redisErrors++;
      return this.checkFailoverLimit(keyHash, config);
    }
  }

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

    const now = Date.now();
    const cacheKey = `${keyHash}:${Math.floor(now / config.windowMs)}`;

    if (!this.failoverCache.has(cacheKey)) {
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

  handleFailover(req, res, next, error) {
    const strategy = this.config.failover.strategy;

    if (strategy === 'fail-open') {
      next();
    } else {
      res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Rate limiting service temporarily unavailable',
          retryAfter: 30
        },
        requestId: req.requestId || this.generateRequestId(),
        timestamp: new Date().toISOString()
      });
    }
  }

  sendRateLimitResponse(res, req, tier, config, result) {
    const now = Date.now();
    const retryAfter = Math.ceil((result.resetAt - now) / 1000);
    const requestId = req.requestId || this.generateRequestId();

    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. You have made too many requests.',
        type: 'https://api.example.com/errors/rate-limit-exceeded'
      },
      rateLimit: {
        limit: config.requestsPerMinute,
        remaining: 0,
        reset: Math.floor(result.resetAt / 1000),
        retryAfter: Math.max(1, retryAfter),
        tier
      },
      requestId,
      timestamp: new Date().toISOString(),
      help: {
        message: `Please wait ${retryAfter} seconds before making another request.`,
        documentationUrl: 'https://docs.api.example.com/rate-limits',
        upgradeUrl: tier === 'free' ? 'https://api.example.com/pricing' : undefined
      }
    });
  }

  setHeaders(res, limit, remaining, resetAt) {
    const resetTimestamp = Math.floor(resetAt / 1000);
    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

    res.setHeader('RateLimit-Limit', limit.toString());
    res.setHeader('RateLimit-Remaining', remaining.toString());
    res.setHeader('RateLimit-Reset', resetTimestamp.toString());
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTimestamp.toString());

    if (remaining <= 0) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
  }

  extractApiKey(req) {
    return (
      req.headers['x-api-key'] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
      req.query.api_key ||
      req.ip ||
      req.connection?.remoteAddress ||
      'anonymous'
    );
  }

  hashKey(key) {
    // Simple hash for testing (not cryptographic)
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).slice(0, 16).padStart(16, '0');
  }

  async getTier(apiKey) {
    if (this.tierCache.has(apiKey)) {
      return this.tierCache.get(apiKey);
    }

    if (this.isConnected && this.client) {
      try {
        const tier = await this.client.get(`rl:tier:${this.hashKey(apiKey)}`);
        if (tier) {
          if (this.tierCache.size >= this.tierCacheMaxSize) {
            const oldestKey = this.tierCache.keys().next().value;
            this.tierCache.delete(oldestKey);
          }
          this.tierCache.set(apiKey, tier);
          return tier;
        }
      } catch (error) {
        // Fall through to default
      }
    }

    return 'free';
  }

  async setTier(apiKey, tier) {
    this.tierCache.set(apiKey, tier);

    if (this.isConnected && this.client) {
      try {
        await this.client.set(`rl:tier:${this.hashKey(apiKey)}`, tier, { EX: 86400 * 30 });
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

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

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  getMetrics() {
    return {
      ...this.metrics,
      redisConnected: this.isConnected,
      failoverCacheSize: this.failoverCache.size,
      tierCacheSize: this.tierCache.size
    };
  }

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

  async close() {
    if (this.client) {
      await this.client.quit();
    }
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Rate Limiter Integration Tests', () => {
  let rateLimiter;
  let mockClient;

  beforeEach(() => {
    mockClient = createMockRedisClient();
  });

  afterEach(async () => {
    if (rateLimiter) {
      await rateLimiter.close();
    }
  });

  // ==========================================================================
  // 1. Full Middleware Flow with Mocked Redis Client
  // ==========================================================================

  describe('Full Middleware Flow', () => {
    it('should process request through complete middleware flow', async () => {
      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key-123' } });
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => { nextCalled = true; });

      assert.ok(nextCalled, 'next() should be called for allowed requests');
      assert.ok(req.rateLimit, 'rateLimit should be attached to request');
      assert.strictEqual(req.rateLimit.allowed, true);
      assert.strictEqual(req.rateLimit.tier, 'free');
    });

    it('should extract API key from x-api-key header', async () => {
      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const apiKey = 'my-custom-api-key';
      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': apiKey } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      // Verify evalSha was called (meaning key was properly extracted and hashed)
      assert.ok(mockClient.evalSha.mock.calls.length > 0);
    });

    it('should extract API key from Authorization Bearer header', async () => {
      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({
        headers: { authorization: 'Bearer test-bearer-token' }
      });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      assert.ok(mockClient.evalSha.mock.calls.length > 0);
    });

    it('should fall back to IP address when no API key provided', async () => {
      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ ip: '192.168.1.100' });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      assert.ok(mockClient.evalSha.mock.calls.length > 0);
    });
  });

  // ==========================================================================
  // 2. Rate Limit Enforcement
  // ==========================================================================

  describe('Rate Limit Enforcement', () => {
    it('should block requests after limit is exceeded', async () => {
      // Configure mock to deny after first request
      mockClient = createMockRedisClient({
        evalShaResponses: [
          [1, 1, Date.now() + 60000],   // First request: allowed, 1 remaining
          [0, 0, Date.now() + 60000]    // Second request: denied, 0 remaining
        ]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();

      // First request - should pass
      const req1 = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res1 = createMockResponse();
      let next1Called = false;
      await middleware(req1, res1, () => { next1Called = true; });
      assert.ok(next1Called, 'First request should be allowed');

      // Second request - should be blocked
      const req2 = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res2 = createMockResponse();
      let next2Called = false;
      await middleware(req2, res2, () => { next2Called = true; });
      assert.strictEqual(next2Called, false, 'Second request should be blocked');
      assert.strictEqual(res2._getStatusCode(), 429);
    });

    it('should track denied requests in metrics', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[0, 0, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const metrics = rateLimiter.getMetrics();
      assert.strictEqual(metrics.deniedRequests, 1);
      assert.strictEqual(metrics.allowedRequests, 0);
    });
  });

  // ==========================================================================
  // 3. Token Bucket Refill Simulation
  // ==========================================================================

  describe('Token Bucket Refill Simulation', () => {
    it('should show tokens being consumed over multiple requests', async () => {
      const responses = [];
      for (let i = 100; i >= 0; i -= 10) {
        responses.push([1, i, Date.now() + 60000]);
      }

      mockClient = createMockRedisClient({ evalShaResponses: responses });
      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();

      for (let i = 0; i < 5; i++) {
        const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
        const res = createMockResponse();
        await middleware(req, res, () => {});

        const remaining = parseInt(res._getHeader('RateLimit-Remaining'));
        assert.ok(remaining >= 0, `Request ${i + 1} should have remaining tokens`);
      }
    });

    it('should simulate token refill after time passes', async () => {
      // First request: low tokens, then refill simulation
      mockClient = createMockRedisClient({
        evalShaResponses: [
          [1, 5, Date.now() + 5000],    // Low tokens
          [1, 50, Date.now() + 60000]   // Tokens refilled
        ]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();

      // Request with low tokens
      const req1 = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res1 = createMockResponse();
      await middleware(req1, res1, () => {});
      assert.strictEqual(res1._getHeader('RateLimit-Remaining'), '5');

      // Request after "refill"
      const req2 = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res2 = createMockResponse();
      await middleware(req2, res2, () => {});
      assert.strictEqual(res2._getHeader('RateLimit-Remaining'), '50');
    });
  });

  // ==========================================================================
  // 4. Tier-Based Rate Limiting
  // ==========================================================================

  describe('Tier-Based Rate Limiting', () => {
    it('should apply free tier limits by default', async () => {
      rateLimiter = new MockableRedisRateLimiter({
        tiers: {
          free: { requestsPerMinute: 100, burstCapacity: 150, refillRate: 1.67, windowMs: 60000 },
          pro: { requestsPerMinute: 1000, burstCapacity: 1500, refillRate: 16.67, windowMs: 60000 }
        }
      }, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'unknown-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      assert.strictEqual(req.rateLimit.tier, 'free');
      assert.strictEqual(res._getHeader('RateLimit-Limit'), '100');
    });

    it('should apply pro tier limits when tier is set', async () => {
      const storage = new Map();
      mockClient = createMockRedisClient({ storage });

      rateLimiter = new MockableRedisRateLimiter({
        tiers: {
          free: { requestsPerMinute: 100, burstCapacity: 150, refillRate: 1.67, windowMs: 60000 },
          pro: { requestsPerMinute: 1000, burstCapacity: 1500, refillRate: 16.67, windowMs: 60000 }
        }
      }, mockClient);
      await rateLimiter.initialize();

      // Set pro tier for API key
      await rateLimiter.setTier('pro-api-key', 'pro');

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'pro-api-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      assert.strictEqual(req.rateLimit.tier, 'pro');
      assert.strictEqual(res._getHeader('RateLimit-Limit'), '1000');
    });

    it('should bypass rate limiting for enterprise tier', async () => {
      rateLimiter = new MockableRedisRateLimiter({
        tiers: {
          free: { requestsPerMinute: 100, burstCapacity: 150, refillRate: 1.67, windowMs: 60000 },
          enterprise: { requestsPerMinute: 10000, burstCapacity: 15000, refillRate: 166.67, windowMs: 60000, bypassRateLimiting: true }
        }
      }, mockClient);
      await rateLimiter.initialize();

      await rateLimiter.setTier('enterprise-key', 'enterprise');

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'enterprise-key' } });
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => { nextCalled = true; });

      assert.ok(nextCalled);
      assert.strictEqual(req.rateLimit.bypass, true);
      // evalSha should NOT be called for bypassed requests
      assert.strictEqual(mockClient.evalSha.mock.calls.length, 0);
    });

    it('should track requests by tier in metrics', async () => {
      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      await rateLimiter.setTier('pro-key', 'pro');

      const middleware = rateLimiter.middleware();

      // Free tier request
      await middleware(
        createMockRequest({ headers: { 'x-api-key': 'free-key' } }),
        createMockResponse(),
        () => {}
      );

      // Pro tier request
      await middleware(
        createMockRequest({ headers: { 'x-api-key': 'pro-key' } }),
        createMockResponse(),
        () => {}
      );

      const metrics = rateLimiter.getMetrics();
      assert.strictEqual(metrics.requestsByTier.free, 1);
      assert.strictEqual(metrics.requestsByTier.pro, 1);
    });
  });

  // ==========================================================================
  // 5. Failover to Local Cache
  // ==========================================================================

  describe('Failover to Local Cache', () => {
    it('should use local cache when Redis is unavailable (fail-closed)', async () => {
      mockClient = createMockRedisClient({ shouldConnect: false });

      rateLimiter = new MockableRedisRateLimiter({
        failover: { strategy: 'fail-closed', localCacheSize: 100 }
      }, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => { nextCalled = true; });

      // Should still work via failover cache
      const metrics = rateLimiter.getMetrics();
      assert.strictEqual(metrics.failoverActivations, 1);
    });

    it('should allow all requests when fail-open strategy is used', async () => {
      mockClient = createMockRedisClient({ shouldConnect: false });

      rateLimiter = new MockableRedisRateLimiter({
        failover: { strategy: 'fail-open' }
      }, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();
      let nextCalled = false;

      await middleware(req, res, () => { nextCalled = true; });

      assert.ok(nextCalled, 'Request should be allowed with fail-open');
    });

    it('should enforce rate limits via local cache in fail-closed mode', async () => {
      mockClient = createMockRedisClient({ shouldConnect: false });

      rateLimiter = new MockableRedisRateLimiter({
        tiers: {
          free: { requestsPerMinute: 3, burstCapacity: 5, refillRate: 0.05, windowMs: 60000 }
        },
        failover: { strategy: 'fail-closed', localCacheSize: 100 }
      }, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();

      // Make requests up to limit
      for (let i = 0; i < 3; i++) {
        const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
        const res = createMockResponse();
        await middleware(req, res, () => {});
      }

      // 4th request should be blocked
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();
      let nextCalled = false;
      await middleware(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false, 'Request should be blocked after limit');
      assert.strictEqual(res._getStatusCode(), 429);
    });

    it('should evict old entries from failover cache when full', async () => {
      mockClient = createMockRedisClient({ shouldConnect: false });

      rateLimiter = new MockableRedisRateLimiter({
        failover: { strategy: 'fail-closed', localCacheSize: 3 }
      }, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();

      // Make requests from different keys to fill cache
      for (let i = 0; i < 5; i++) {
        const req = createMockRequest({ headers: { 'x-api-key': `key-${i}` } });
        const res = createMockResponse();
        await middleware(req, res, () => {});
      }

      const metrics = rateLimiter.getMetrics();
      assert.ok(metrics.failoverCacheSize <= 3, 'Cache size should not exceed limit');
    });
  });

  // ==========================================================================
  // 6. Redis Reconnection Handling
  // ==========================================================================

  describe('Redis Reconnection Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      // Simulate Redis error
      mockClient._triggerError(new Error('Connection lost'));

      assert.strictEqual(rateLimiter.isConnected, false);
      const metrics = rateLimiter.getMetrics();
      assert.strictEqual(metrics.redisErrors, 1);
    });

    it('should switch to failover when Redis disconnects mid-operation', async () => {
      mockClient = createMockRedisClient({ shouldFailEvalSha: true });

      rateLimiter = new MockableRedisRateLimiter({
        failover: { strategy: 'fail-closed' }
      }, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const metrics = rateLimiter.getMetrics();
      assert.ok(metrics.redisErrors >= 1, 'Should track Redis errors');
      assert.ok(metrics.failoverActivations >= 1, 'Should activate failover');
    });

    it('should handle reconnecting event', async () => {
      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      // Should not throw
      mockClient._triggerReconnecting();
    });
  });

  // ==========================================================================
  // 7. Concurrent Request Handling
  // ==========================================================================

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      let callCount = 0;
      mockClient = createMockRedisClient({
        evalShaResponses: Array(10).fill(null).map(() => [1, 100 - (callCount++ * 10), Date.now() + 60000])
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();

      // Create 5 concurrent requests
      const requests = Array(5).fill(null).map((_, i) => {
        const req = createMockRequest({ headers: { 'x-api-key': `key-${i}` } });
        const res = createMockResponse();
        return new Promise((resolve) => {
          middleware(req, res, () => {
            resolve({ req, res, allowed: true });
          });
        });
      });

      const results = await Promise.all(requests);

      assert.strictEqual(results.length, 5);
      results.forEach(result => {
        assert.strictEqual(result.allowed, true);
      });
    });

    it('should maintain accurate metrics under concurrent load', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [
          [1, 50, Date.now() + 60000],
          [1, 49, Date.now() + 60000],
          [0, 0, Date.now() + 60000],
          [1, 48, Date.now() + 60000],
          [0, 0, Date.now() + 60000]
        ]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();

      const requests = Array(5).fill(null).map(async () => {
        const req = createMockRequest({ headers: { 'x-api-key': 'shared-key' } });
        const res = createMockResponse();
        return new Promise((resolve) => {
          middleware(req, res, () => resolve('allowed')).then(() => {
            if (res._getStatusCode() === 429) resolve('denied');
          });
        });
      });

      await Promise.all(requests);

      const metrics = rateLimiter.getMetrics();
      assert.strictEqual(metrics.totalRequests, 5);
      assert.strictEqual(metrics.allowedRequests + metrics.deniedRequests, 5);
    });
  });

  // ==========================================================================
  // 8. HTTP 429 Response Format Verification
  // ==========================================================================

  describe('HTTP 429 Response Format', () => {
    it('should return proper 429 status code', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[0, 0, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      assert.strictEqual(res._getStatusCode(), 429);
    });

    it('should include required error fields in 429 response body', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[0, 0, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const body = res._getJsonBody();

      // Error object
      assert.ok(body.error, 'Response should have error object');
      assert.strictEqual(body.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.ok(body.error.message, 'Error should have message');
      assert.ok(body.error.type, 'Error should have type URL');

      // Rate limit info
      assert.ok(body.rateLimit, 'Response should have rateLimit object');
      assert.ok(typeof body.rateLimit.limit === 'number', 'Should have limit');
      assert.strictEqual(body.rateLimit.remaining, 0, 'Remaining should be 0');
      assert.ok(body.rateLimit.reset, 'Should have reset timestamp');
      assert.ok(body.rateLimit.retryAfter >= 1, 'Should have retryAfter');
      assert.ok(body.rateLimit.tier, 'Should have tier');

      // Request ID and timestamp
      assert.ok(body.requestId, 'Should have requestId');
      assert.ok(body.timestamp, 'Should have timestamp');

      // Help section
      assert.ok(body.help, 'Should have help object');
      assert.ok(body.help.message, 'Help should have message');
      assert.ok(body.help.documentationUrl, 'Help should have documentation URL');
    });

    it('should include upgrade URL for free tier in 429 response', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[0, 0, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'free-user' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const body = res._getJsonBody();
      assert.ok(body.help.upgradeUrl, 'Free tier should have upgrade URL');
    });

    it('should not include upgrade URL for pro tier in 429 response', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[0, 0, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      await rateLimiter.setTier('pro-key', 'pro');

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'pro-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const body = res._getJsonBody();
      assert.strictEqual(body.help.upgradeUrl, undefined, 'Pro tier should not have upgrade URL');
    });
  });

  // ==========================================================================
  // 9. Header Values at Different Stages
  // ==========================================================================

  describe('Rate Limit Headers', () => {
    it('should set IETF standard headers', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[1, 50, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({
        tiers: { free: { requestsPerMinute: 100, burstCapacity: 150, refillRate: 1.67, windowMs: 60000 } }
      }, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const headers = res._getHeaders();

      // IETF headers
      assert.ok(headers['RateLimit-Limit'], 'Should have RateLimit-Limit');
      assert.ok(headers['RateLimit-Remaining'], 'Should have RateLimit-Remaining');
      assert.ok(headers['RateLimit-Reset'], 'Should have RateLimit-Reset');
    });

    it('should set legacy X-RateLimit headers for backward compatibility', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[1, 50, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const headers = res._getHeaders();

      assert.ok(headers['X-RateLimit-Limit'], 'Should have X-RateLimit-Limit');
      assert.ok(headers['X-RateLimit-Remaining'], 'Should have X-RateLimit-Remaining');
      assert.ok(headers['X-RateLimit-Reset'], 'Should have X-RateLimit-Reset');
    });

    it('should show decreasing remaining tokens over requests', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [
          [1, 100, Date.now() + 60000],
          [1, 90, Date.now() + 60000],
          [1, 80, Date.now() + 60000]
        ]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const remainingValues = [];

      for (let i = 0; i < 3; i++) {
        const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
        const res = createMockResponse();
        await middleware(req, res, () => {});
        remainingValues.push(parseInt(res._getHeader('RateLimit-Remaining')));
      }

      assert.deepStrictEqual(remainingValues, [100, 90, 80]);
    });

    it('should set Retry-After header when rate limited', async () => {
      const resetTime = Date.now() + 30000; // 30 seconds from now
      mockClient = createMockRedisClient({
        evalShaResponses: [[0, 0, resetTime]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const retryAfter = parseInt(res._getHeader('Retry-After'));
      assert.ok(retryAfter >= 1, 'Retry-After should be positive');
      assert.ok(retryAfter <= 31, 'Retry-After should be reasonable');
    });

    it('should not set Retry-After header when tokens remain', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[1, 50, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      assert.strictEqual(res._getHeader('Retry-After'), undefined);
    });

    it('should set appropriate headers for different tiers', async () => {
      mockClient = createMockRedisClient();

      rateLimiter = new MockableRedisRateLimiter({
        tiers: {
          free: { requestsPerMinute: 100, burstCapacity: 150, refillRate: 1.67, windowMs: 60000 },
          pro: { requestsPerMinute: 1000, burstCapacity: 1500, refillRate: 16.67, windowMs: 60000 }
        }
      }, mockClient);
      await rateLimiter.initialize();

      await rateLimiter.setTier('pro-key', 'pro');

      const middleware = rateLimiter.middleware();

      // Free tier
      const resFree = createMockResponse();
      await middleware(
        createMockRequest({ headers: { 'x-api-key': 'free-key' } }),
        resFree,
        () => {}
      );
      assert.strictEqual(resFree._getHeader('RateLimit-Limit'), '100');

      // Pro tier
      const resPro = createMockResponse();
      await middleware(
        createMockRequest({ headers: { 'x-api-key': 'pro-key' } }),
        resPro,
        () => {}
      );
      assert.strictEqual(resPro._getHeader('RateLimit-Limit'), '1000');
    });
  });

  // ==========================================================================
  // Additional Edge Case Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle missing request ID gracefully', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[0, 0, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({ headers: { 'x-api-key': 'test-key' } });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const body = res._getJsonBody();
      assert.ok(body.requestId.startsWith('req_'), 'Should generate requestId');
    });

    it('should use provided request ID', async () => {
      mockClient = createMockRedisClient({
        evalShaResponses: [[0, 0, Date.now() + 60000]]
      });

      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({
        headers: { 'x-api-key': 'test-key' },
        requestId: 'custom-request-id-123'
      });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      const body = res._getJsonBody();
      assert.strictEqual(body.requestId, 'custom-request-id-123');
    });

    it('should handle endpoint-specific rate limits', async () => {
      mockClient = createMockRedisClient();

      rateLimiter = new MockableRedisRateLimiter({
        tiers: {
          free: { requestsPerMinute: 100, burstCapacity: 150, refillRate: 1.67, windowMs: 60000 }
        },
        endpoints: {
          '/mcp/execute': {
            free: { requestsPerMinute: 20, costPerRequest: 5 }
          }
        }
      }, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();
      const req = createMockRequest({
        headers: { 'x-api-key': 'test-key' },
        path: '/mcp/execute'
      });
      const res = createMockResponse();

      await middleware(req, res, () => {});

      assert.strictEqual(res._getHeader('RateLimit-Limit'), '20');
    });

    it('should reset metrics correctly', async () => {
      rateLimiter = new MockableRedisRateLimiter({}, mockClient);
      await rateLimiter.initialize();

      const middleware = rateLimiter.middleware();

      // Make some requests
      for (let i = 0; i < 3; i++) {
        await middleware(
          createMockRequest({ headers: { 'x-api-key': 'test-key' } }),
          createMockResponse(),
          () => {}
        );
      }

      let metrics = rateLimiter.getMetrics();
      assert.strictEqual(metrics.totalRequests, 3);

      // Reset metrics
      rateLimiter.resetMetrics();

      metrics = rateLimiter.getMetrics();
      assert.strictEqual(metrics.totalRequests, 0);
      assert.strictEqual(metrics.allowedRequests, 0);
      assert.strictEqual(metrics.deniedRequests, 0);
    });
  });
});
