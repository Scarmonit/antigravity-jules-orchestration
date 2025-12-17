/**
 * Rate Limiting Configuration
 * Production-ready tiered rate limiting for Jules MCP Server
 */

export const RATE_LIMIT_CONFIG = {
  // Redis connection
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    connectTimeout: 5000,
    maxRetriesPerRequest: 3
  },

  // Tier definitions with token bucket parameters
  tiers: {
    free: {
      requestsPerMinute: 100,
      burstCapacity: 150,
      refillRate: 1.67,           // tokens per second (100/60)
      windowMs: 60000,
      costPerRequest: 1,
      bypassRateLimiting: false
    },
    pro: {
      requestsPerMinute: 1000,
      burstCapacity: 1500,
      refillRate: 16.67,          // tokens per second (1000/60)
      windowMs: 60000,
      costPerRequest: 1,
      bypassRateLimiting: false
    },
    enterprise: {
      requestsPerMinute: 10000,
      burstCapacity: 15000,
      refillRate: 166.67,         // tokens per second (10000/60)
      windowMs: 60000,
      costPerRequest: 1,
      bypassRateLimiting: true    // Enterprise can bypass rate limits
    }
  },

  // Endpoint-specific overrides
  endpoints: {
    '/mcp/execute': {
      free: { requestsPerMinute: 20, costPerRequest: 5 },
      pro: { requestsPerMinute: 200, costPerRequest: 2 },
      enterprise: { requestsPerMinute: 2000, costPerRequest: 1 }
    },
    '/api/sessions': {
      free: { requestsPerMinute: 10, costPerRequest: 10 },
      pro: { requestsPerMinute: 100, costPerRequest: 5 },
      enterprise: { requestsPerMinute: 1000, costPerRequest: 1 }
    }
  },

  // Failover configuration
  failover: {
    strategy: process.env.RATE_LIMIT_FAILOVER || 'fail-closed',
    localCacheSize: 10000,
    localCacheTTL: 60000
  },

  // Response configuration
  response: {
    includeHeaders: true,
    useIETFHeaders: true,
    includeLegacyHeaders: true
  },

  // Key extraction priority
  keyExtraction: {
    priority: ['x-api-key', 'authorization', 'query.api_key', 'ip'],
    hashAlgorithm: 'sha256'
  }
};

export default RATE_LIMIT_CONFIG;
