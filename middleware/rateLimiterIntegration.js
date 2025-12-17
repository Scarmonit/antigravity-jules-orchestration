/**
 * Rate Limiter Integration Module
 *
 * This module provides integration between the Redis Rate Limiter
 * and the existing Express application.
 *
 * Usage in index.js:
 *   import { initializeRateLimiter, getRateLimiterMiddleware, getRateLimiterMetrics } from './middleware/rateLimiterIntegration.js';
 *
 *   // During startup:
 *   await initializeRateLimiter();
 *
 *   // Apply middleware:
 *   app.use('/mcp/', getRateLimiterMiddleware());
 *
 *   // Metrics endpoint:
 *   app.get('/api/rate-limit/metrics', (req, res) => res.json(getRateLimiterMetrics()));
 */

import { RedisRateLimiter } from './rateLimiter.js';
import { RATE_LIMIT_CONFIG } from '../config/rate-limiting.js';

// Singleton rate limiter instance
let rateLimiter = null;

/**
 * Initialize the rate limiter
 * Should be called once during application startup
 */
export async function initializeRateLimiter() {
  if (rateLimiter) {
    console.log('[RateLimiter] Already initialized');
    return rateLimiter;
  }

  try {
    rateLimiter = new RedisRateLimiter(RATE_LIMIT_CONFIG);
    const connected = await rateLimiter.initialize();

    if (connected) {
      console.log('[RateLimiter] Redis rate limiter initialized successfully');
    } else {
      console.log('[RateLimiter] Running in failover mode (no Redis connection)');
    }

    return rateLimiter;
  } catch (error) {
    console.error('[RateLimiter] Failed to initialize:', error.message);
    // Create a fallback rate limiter that uses local memory
    rateLimiter = new RedisRateLimiter({
      ...RATE_LIMIT_CONFIG,
      failover: { strategy: 'fail-closed' }
    });
    return rateLimiter;
  }
}

/**
 * Get the rate limiter middleware
 * Returns an Express middleware function
 */
export function getRateLimiterMiddleware() {
  if (!rateLimiter) {
    console.warn('[RateLimiter] Not initialized, using fallback');
    rateLimiter = new RedisRateLimiter(RATE_LIMIT_CONFIG);
  }
  return rateLimiter.middleware();
}

/**
 * Get rate limiter metrics
 */
export function getRateLimiterMetrics() {
  if (!rateLimiter) {
    return { error: 'Rate limiter not initialized' };
  }
  return rateLimiter.getMetrics();
}

/**
 * Set tier for an API key
 */
export async function setApiKeyTier(apiKey, tier) {
  if (!rateLimiter) {
    throw new Error('Rate limiter not initialized');
  }
  return rateLimiter.setTier(apiKey, tier);
}

/**
 * Get tier for an API key
 */
export async function getApiKeyTier(apiKey) {
  if (!rateLimiter) {
    throw new Error('Rate limiter not initialized');
  }
  return rateLimiter.getTier(apiKey);
}

/**
 * Close the rate limiter connection
 */
export async function closeRateLimiter() {
  if (rateLimiter) {
    await rateLimiter.close();
    rateLimiter = null;
  }
}

/**
 * Check if rate limiter is healthy
 */
export function isRateLimiterHealthy() {
  if (!rateLimiter) {
    return { healthy: false, reason: 'not_initialized' };
  }
  const metrics = rateLimiter.getMetrics();
  return {
    healthy: metrics.redisConnected || metrics.failoverCacheSize > 0,
    redisConnected: metrics.redisConnected,
    mode: metrics.redisConnected ? 'redis' : 'failover',
    metrics
  };
}

export default {
  initializeRateLimiter,
  getRateLimiterMiddleware,
  getRateLimiterMetrics,
  setApiKeyTier,
  getApiKeyTier,
  closeRateLimiter,
  isRateLimiterHealthy
};
