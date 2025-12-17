/**
 * Production-Ready Redis Rate Limiter Middleware
 * Token Bucket Algorithm with Distributed State
 *
 * Features:
 * - Atomic Redis operations via Lua scripts
 * - Per-API-key rate limiting with tier support
 * - Graceful failover (fail-open/fail-closed)
 * - IETF-compliant response headers
 * - Prometheus-ready metrics
 *
 * @version 1.0.0
 */

import { createClient } from 'redis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Rate Limit Error with proper headers
 */
export class RateLimitExceededError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'RateLimitExceededError';
    this.statusCode = 429;
    this.details = details;
  }
}

/**
 * Redis Rate Limiter Class
 */
export class RedisRateLimiter {
  constructor(config = {}) {
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
   * Initialize Redis connection and load Lua script
   */
  async initialize() {
    try {
      this.client = createClient({
        url: this.config.redis.url,
        socket: {
          connectTimeout: this.config.redis.connectTimeout,
          reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
        }
      });

      this.client.on('error', (err) => {
        console.error('[RateLimiter] Redis error:', {
          message: err.message,
          code: err.code,
          stack: err.stack,
          errno: err.errno,
          syscall: err.syscall
        });
        this.isConnected = false;
        this.metrics.redisErrors++;
      });

      this.client.on('connect', () => {
        console.log('[RateLimiter] Redis connected');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('[RateLimiter] Redis reconnecting...');
      });

      await this.client.connect();

      // Load Lua script
      const scriptPath = join(__dirname, '../redis/token-bucket.lua');
      this.luaScript = readFileSync(scriptPath, 'utf-8');
      this.scriptHash = await this.client.scriptLoad(this.luaScript);

      console.log('[RateLimiter] Initialized with script hash:', this.scriptHash.slice(0, 8) + '...');
      this.isConnected = true;
      return true;
    } catch (error) {
      // Track initialization failure in metrics
      this.metrics.initializationFailed = true;
      this.metrics.initializationError = error.message;

      // Log with FULL error details including stack trace
      console.error('[RateLimiter] CRITICAL: Initialization failed:', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        redisUrl: this.config.redis.url.replace(/\/\/.*@/, '//***@'), // Mask credentials
        failoverStrategy: this.config.failover.strategy
      });

      // Warn loudly about failover mode
      console.warn('[RateLimiter] WARNING: Running in failover mode - rate limiting may be degraded');

      // Alert if fail-closed strategy requires Redis
      if (this.config.failover.strategy === 'fail-closed') {
        console.error('[RateLimiter] fail-closed strategy active - local cache will be used for rate limiting');
      }

      return false;
    }
  }

  /**
   * Express middleware factory
   */
  middleware() {
    return async (req, res, next) => {
      const startTime = Date.now();

      try {
        // Extract API key and determine tier
        const apiKey = this.extractApiKey(req);
        const keyHash = this.hashKey(apiKey);
        const tier = await this.getTier(apiKey);
        const tierConfig = this.getTierConfig(tier, req.path);

        this.metrics.totalRequests++;
        this.metrics.requestsByTier[tier] = (this.metrics.requestsByTier[tier] || 0) + 1;

        // Check if tier bypasses rate limiting
        if (tierConfig.bypassRateLimiting) {
          this.setHeaders(res, tierConfig.requestsPerMinute, tierConfig.requestsPerMinute, Date.now() + 60000);
          req.rateLimit = { tier, allowed: true, bypass: true };
          return next();
        }

        // Check rate limit
        const result = await this.checkRateLimit(keyHash, tier, tierConfig);

        // Set response headers
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
        console.error('[RateLimiter] Middleware error:', error.message);
        this.handleFailover(req, res, next, error);
      }
    };
  }

  /**
   * Check rate limit using Redis or failover cache
   */
  async checkRateLimit(keyHash, tier, config) {
    if (!this.isConnected) {
      return this.checkFailoverLimit(keyHash, config);
    }

    try {
      const bucketKey = `rl:bucket:${tier}:${keyHash}`;
      const now = Date.now();
      const ttl = Math.ceil(config.windowMs / 1000) + 60; // Extra buffer

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
      console.error('[RateLimiter] Redis check failed:', error.message);
      this.metrics.redisErrors++;
      return this.checkFailoverLimit(keyHash, config);
    }
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
   * Handle failover when Redis is unavailable
   */
  handleFailover(req, res, next, error) {
    const strategy = this.config.failover.strategy;

    if (strategy === 'fail-open') {
      console.warn('[RateLimiter] Failover: allowing request (fail-open)');
      next();
    } else {
      console.warn('[RateLimiter] Failover: rate limiter unavailable');
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

  /**
   * Send 429 rate limit response with proper headers and body
   */
  sendRateLimitResponse(res, req, tier, config, result) {
    const now = Date.now();
    const retryAfter = Math.ceil((result.resetAt - now) / 1000);
    const requestId = req.requestId || this.generateRequestId();

    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. You have made too many requests.`,
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
   * Extract API key from request
   */
  extractApiKey(req) {
    // Priority: x-api-key header > Authorization Bearer > query param > IP
    const apiKey =
      req.headers['x-api-key'] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
      req.query.api_key ||
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
   * Get tier for API key (from cache or Redis)
   */
  async getTier(apiKey) {
    // Check cache first
    if (this.tierCache.has(apiKey)) {
      return this.tierCache.get(apiKey);
    }

    // Try Redis if connected
    if (this.isConnected && this.client) {
      try {
        const tier = await this.client.get(`rl:tier:${this.hashKey(apiKey)}`);
        if (tier) {
          // Evict oldest entries if cache is full (LRU-style)
          if (this.tierCache.size >= this.tierCacheMaxSize) {
            const oldestKey = this.tierCache.keys().next().value;
            this.tierCache.delete(oldestKey);
          }
          this.tierCache.set(apiKey, tier);
          return tier;
        }
        // Tier not found in Redis - this is expected for new/unknown users
        // No error, just fall through to default
      } catch (error) {
        // CRITICAL: Track Redis errors during tier lookup
        // This could cause paying customers to be rate-limited as free users
        this.metrics.redisErrors++;
        this.metrics.tierLookupFailures = (this.metrics.tierLookupFailures || 0) + 1;

        console.error('[RateLimiter] CRITICAL: Failed to get tier from Redis - user may be downgraded:', {
          error: error.message,
          stack: error.stack,
          apiKeyHash: this.hashKey(apiKey),
          isConnected: this.isConnected
        });
      }
    }

    return 'free'; // Default tier - only safe for genuinely unknown users
  }

  /**
   * Set tier for API key
   * @returns {Object} Status object with persisted, cached, and reason fields
   */
  async setTier(apiKey, tier) {
    // Validate tier exists in config
    if (!this.config.tiers[tier]) {
      const validTiers = Object.keys(this.config.tiers).join(', ');
      console.error(`[RateLimiter] Invalid tier: ${tier}. Valid tiers: ${validTiers}`);
      return { persisted: false, cached: false, reason: 'invalid_tier', error: `Invalid tier: ${tier}` };
    }

    // Always update local cache for immediate effect
    this.tierCache.set(apiKey, tier);

    if (!this.isConnected || !this.client) {
      console.warn('[RateLimiter] Cannot persist tier to Redis - not connected', {
        apiKeyHash: this.hashKey(apiKey),
        tier,
        isConnected: this.isConnected
      });
      return { persisted: false, cached: true, reason: 'redis_not_connected' };
    }

    try {
      await this.client.set(`rl:tier:${this.hashKey(apiKey)}`, tier, { EX: 86400 * 30 });
      return { persisted: true, cached: true };
    } catch (error) {
      this.metrics.redisErrors++;
      console.error('[RateLimiter] Failed to persist tier to Redis:', {
        error: error.message,
        stack: error.stack,
        apiKeyHash: this.hashKey(apiKey),
        tier
      });
      // Tier is in cache but not persisted - warn the caller
      return { persisted: false, cached: true, reason: 'redis_error', error: error.message };
    }
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

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      console.log('[RateLimiter] Redis connection closed');
    }
  }
}

/**
 * Factory function to create rate limiter instance
 */
export function createRateLimiter(config) {
  return new RedisRateLimiter(config);
}

export default RedisRateLimiter;
