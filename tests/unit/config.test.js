/**
 * Unit Tests for Rate Limiting Configuration
 * Validates configuration structure and values
 */

import { describe, it, expect } from 'vitest';
import RATE_LIMIT_CONFIG from '../../config/rate-limiting.js';

describe('Rate Limiting Configuration', () => {
  describe('Configuration Structure', () => {
    it('should have redis configuration', () => {
      expect(RATE_LIMIT_CONFIG.redis).toBeDefined();
      expect(RATE_LIMIT_CONFIG.redis.url).toBeDefined();
      expect(RATE_LIMIT_CONFIG.redis.connectTimeout).toBe(5000);
      expect(RATE_LIMIT_CONFIG.redis.maxRetriesPerRequest).toBe(3);
    });

    it('should have tier definitions', () => {
      expect(RATE_LIMIT_CONFIG.tiers).toBeDefined();
      expect(RATE_LIMIT_CONFIG.tiers.free).toBeDefined();
      expect(RATE_LIMIT_CONFIG.tiers.pro).toBeDefined();
      expect(RATE_LIMIT_CONFIG.tiers.enterprise).toBeDefined();
    });

    it('should have endpoint overrides', () => {
      expect(RATE_LIMIT_CONFIG.endpoints).toBeDefined();
      expect(typeof RATE_LIMIT_CONFIG.endpoints).toBe('object');
    });

    it('should have failover configuration', () => {
      expect(RATE_LIMIT_CONFIG.failover).toBeDefined();
      expect(RATE_LIMIT_CONFIG.failover.strategy).toBeDefined();
      expect(RATE_LIMIT_CONFIG.failover.localCacheSize).toBe(10000);
    });

    it('should have response configuration', () => {
      expect(RATE_LIMIT_CONFIG.response).toBeDefined();
      expect(RATE_LIMIT_CONFIG.response.includeHeaders).toBe(true);
      expect(RATE_LIMIT_CONFIG.response.useIETFHeaders).toBe(true);
    });

    it('should have key extraction configuration', () => {
      expect(RATE_LIMIT_CONFIG.keyExtraction).toBeDefined();
      expect(RATE_LIMIT_CONFIG.keyExtraction.priority).toBeInstanceOf(Array);
      expect(RATE_LIMIT_CONFIG.keyExtraction.hashAlgorithm).toBe('sha256');
    });
  });

  describe('Free Tier Configuration', () => {
    const freeTier = RATE_LIMIT_CONFIG.tiers.free;

    it('should have correct rate limits', () => {
      expect(freeTier.requestsPerMinute).toBe(100);
      expect(freeTier.burstCapacity).toBe(150);
      expect(freeTier.refillRate).toBe(1.67);
      expect(freeTier.windowMs).toBe(60000);
    });

    it('should have cost per request', () => {
      expect(freeTier.costPerRequest).toBe(1);
    });

    it('should not bypass rate limiting', () => {
      expect(freeTier.bypassRateLimiting).toBe(false);
    });
  });

  describe('Pro Tier Configuration', () => {
    const proTier = RATE_LIMIT_CONFIG.tiers.pro;

    it('should have higher limits than free tier', () => {
      const freeTier = RATE_LIMIT_CONFIG.tiers.free;

      expect(proTier.requestsPerMinute).toBeGreaterThan(freeTier.requestsPerMinute);
      expect(proTier.burstCapacity).toBeGreaterThan(freeTier.burstCapacity);
      expect(proTier.refillRate).toBeGreaterThan(freeTier.refillRate);
    });

    it('should have correct rate limits', () => {
      expect(proTier.requestsPerMinute).toBe(1000);
      expect(proTier.burstCapacity).toBe(1500);
      expect(proTier.refillRate).toBe(16.67);
    });

    it('should not bypass rate limiting', () => {
      expect(proTier.bypassRateLimiting).toBe(false);
    });
  });

  describe('Enterprise Tier Configuration', () => {
    const enterpriseTier = RATE_LIMIT_CONFIG.tiers.enterprise;

    it('should have highest limits', () => {
      const proTier = RATE_LIMIT_CONFIG.tiers.pro;

      expect(enterpriseTier.requestsPerMinute).toBeGreaterThan(proTier.requestsPerMinute);
      expect(enterpriseTier.burstCapacity).toBeGreaterThan(proTier.burstCapacity);
      expect(enterpriseTier.refillRate).toBeGreaterThan(proTier.refillRate);
    });

    it('should bypass rate limiting', () => {
      expect(enterpriseTier.bypassRateLimiting).toBe(true);
    });

    it('should have correct rate limits', () => {
      expect(enterpriseTier.requestsPerMinute).toBe(10000);
      expect(enterpriseTier.burstCapacity).toBe(15000);
      expect(enterpriseTier.refillRate).toBe(166.67);
    });
  });

  describe('Endpoint Overrides', () => {
    it('should have /mcp/execute endpoint', () => {
      const executeEndpoint = RATE_LIMIT_CONFIG.endpoints['/mcp/execute'];
      expect(executeEndpoint).toBeDefined();
      expect(executeEndpoint.free).toBeDefined();
      expect(executeEndpoint.pro).toBeDefined();
      expect(executeEndpoint.enterprise).toBeDefined();
    });

    it('should have lower limits for expensive endpoints', () => {
      const executeEndpoint = RATE_LIMIT_CONFIG.endpoints['/mcp/execute'];
      const baseFree = RATE_LIMIT_CONFIG.tiers.free.requestsPerMinute;

      expect(executeEndpoint.free.requestsPerMinute).toBeLessThan(baseFree);
    });

    it('should have higher cost for expensive endpoints', () => {
      const executeEndpoint = RATE_LIMIT_CONFIG.endpoints['/mcp/execute'];

      expect(executeEndpoint.free.costPerRequest).toBeGreaterThan(1);
    });

    it('should have /api/sessions endpoint', () => {
      const sessionsEndpoint = RATE_LIMIT_CONFIG.endpoints['/api/sessions'];
      expect(sessionsEndpoint).toBeDefined();
    });
  });

  describe('Failover Configuration', () => {
    it('should use environment variable for strategy when set', () => {
      // Note: The actual value depends on env var, we just check it exists
      expect(['fail-open', 'fail-closed']).toContain(RATE_LIMIT_CONFIG.failover.strategy);
    });

    it('should have reasonable cache size', () => {
      expect(RATE_LIMIT_CONFIG.failover.localCacheSize).toBe(10000);
      expect(RATE_LIMIT_CONFIG.failover.localCacheTTL).toBe(60000);
    });
  });

  describe('Key Extraction Priority', () => {
    it('should prioritize x-api-key header first', () => {
      expect(RATE_LIMIT_CONFIG.keyExtraction.priority[0]).toBe('x-api-key');
    });

    it('should have correct priority order', () => {
      const priority = RATE_LIMIT_CONFIG.keyExtraction.priority;

      expect(priority).toEqual([
        'x-api-key',
        'authorization',
        'query.api_key',
        'ip'
      ]);
    });
  });

  describe('Tier Consistency', () => {
    it('all tiers should have same window duration', () => {
      const tiers = RATE_LIMIT_CONFIG.tiers;

      expect(tiers.free.windowMs).toBe(60000);
      expect(tiers.pro.windowMs).toBe(60000);
      expect(tiers.enterprise.windowMs).toBe(60000);
    });

    it('all tiers should have required fields', () => {
      const requiredFields = [
        'requestsPerMinute',
        'burstCapacity',
        'refillRate',
        'windowMs',
        'costPerRequest',
        'bypassRateLimiting'
      ];

      Object.values(RATE_LIMIT_CONFIG.tiers).forEach((tier) => {
        requiredFields.forEach((field) => {
          expect(tier).toHaveProperty(field);
        });
      });
    });

    it('burst capacity should be higher than requests per minute', () => {
      Object.values(RATE_LIMIT_CONFIG.tiers).forEach((tier) => {
        if (!tier.bypassRateLimiting) {
          expect(tier.burstCapacity).toBeGreaterThan(tier.requestsPerMinute);
        }
      });
    });

    it('refill rate should match requests per minute / 60', () => {
      Object.values(RATE_LIMIT_CONFIG.tiers).forEach((tier) => {
        const expectedRefillRate = tier.requestsPerMinute / 60;
        // Allow small floating point differences
        expect(Math.abs(tier.refillRate - expectedRefillRate)).toBeLessThan(0.01);
      });
    });
  });

  describe('Response Configuration', () => {
    it('should include both IETF and legacy headers', () => {
      expect(RATE_LIMIT_CONFIG.response.useIETFHeaders).toBe(true);
      expect(RATE_LIMIT_CONFIG.response.includeLegacyHeaders).toBe(true);
    });

    it('should include headers in response', () => {
      expect(RATE_LIMIT_CONFIG.response.includeHeaders).toBe(true);
    });
  });

  describe('Redis Configuration', () => {
    it('should have default or environment Redis URL', () => {
      expect(RATE_LIMIT_CONFIG.redis.url).toBeDefined();
      expect(typeof RATE_LIMIT_CONFIG.redis.url).toBe('string');
    });

    it('should have reasonable connection timeout', () => {
      expect(RATE_LIMIT_CONFIG.redis.connectTimeout).toBe(5000);
      expect(RATE_LIMIT_CONFIG.redis.connectTimeout).toBeGreaterThan(0);
    });

    it('should have retry configuration', () => {
      expect(RATE_LIMIT_CONFIG.redis.maxRetriesPerRequest).toBe(3);
    });
  });
});
