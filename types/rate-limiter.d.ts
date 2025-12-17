/**
 * TypeScript Type Definitions for Rate Limiter
 */

export interface RateLimitTierConfig {
  requestsPerMinute: number;
  burstCapacity: number;
  refillRate: number;
  windowMs?: number;
  costPerRequest?: number;
  bypassRateLimiting?: boolean;
}

export interface RateLimitEndpointConfig {
  requestsPerMinute?: number;
  costPerRequest?: number;
}

export interface RateLimitConfig {
  redis?: {
    url?: string;
    connectTimeout?: number;
    maxRetriesPerRequest?: number;
  };
  tiers?: {
    free?: RateLimitTierConfig;
    pro?: RateLimitTierConfig;
    enterprise?: RateLimitTierConfig;
    [key: string]: RateLimitTierConfig | undefined;
  };
  endpoints?: {
    [path: string]: {
      [tier: string]: RateLimitEndpointConfig;
    };
  };
  failover?: {
    strategy?: 'fail-open' | 'fail-closed';
    localCacheSize?: number;
    localCacheTTL?: number;
  };
  response?: {
    includeHeaders?: boolean;
    useIETFHeaders?: boolean;
    includeLegacyHeaders?: boolean;
  };
  keyExtraction?: {
    priority?: string[];
    hashAlgorithm?: string;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitInfo {
  tier: string;
  allowed: boolean;
  remaining?: number;
  limit?: number;
  resetAt?: number;
  bypass?: boolean;
  latency?: number;
}

export interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  redisErrors: number;
  failoverActivations: number;
  requestsByTier: {
    free: number;
    pro: number;
    enterprise: number;
    [key: string]: number;
  };
  redisConnected: boolean;
  failoverCacheSize: number;
  tierCacheSize: number;
  allowRate: string;
  denyRate: string;
  requestsPerSecond: string;
}

export interface RateLimitErrorResponse {
  error: {
    code: 'RATE_LIMIT_EXCEEDED' | 'BURST_LIMIT_EXCEEDED' | 'QUOTA_EXCEEDED';
    message: string;
    type?: string;
  };
  rateLimit: {
    limit: number;
    remaining: number;
    reset: number;
    retryAfter: number;
    tier: string;
  };
  requestId: string;
  timestamp: string;
  help?: {
    message?: string;
    documentationUrl?: string;
    upgradeUrl?: string;
  };
}

export interface RateLimitHeaders {
  'RateLimit-Limit': string;
  'RateLimit-Remaining': string;
  'RateLimit-Reset': string;
  'Retry-After'?: string;
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

declare module 'express-serve-static-core' {
  interface Request {
    rateLimit?: RateLimitInfo;
    requestId?: string;
  }
}

export class RedisRateLimiter {
  constructor(config?: RateLimitConfig);
  initialize(): Promise<boolean>;
  middleware(): (req: any, res: any, next: any) => Promise<void>;
  checkRateLimit(keyHash: string, tier: string, config: RateLimitTierConfig): Promise<RateLimitResult>;
  getTier(apiKey: string): Promise<string>;
  setTier(apiKey: string, tier: string): Promise<boolean>;
  getMetrics(): RateLimitMetrics;
  resetMetrics(): void;
  close(): Promise<void>;
}

export function createRateLimiter(config?: RateLimitConfig): RedisRateLimiter;
export default RedisRateLimiter;
