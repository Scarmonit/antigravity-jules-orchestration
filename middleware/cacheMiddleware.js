import redis from 'redis';

const CACHE_ENABLED = process.env.CACHE_ENABLED === 'true';
const CACHE_DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL, 10) || 300;

let redisClient;
let isRedisConnected = false;

if (CACHE_ENABLED) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error', err)
    isRedisConnected = false;
  });

  redisClient.on('connect', () => {
    isRedisConnected = true;
  });

  (async () => {
    try {
      await redisClient.connect();
    } catch (err) {
      console.error('Failed to connect to Redis:', err);
    }
  })();
}

const getCacheKey = (req) => `cache:${req.originalUrl}`;

const getTtlForPath = (path) => {
  if (path === '/mcp/tools') return 3600; // 1 hour
  if (path === '/api/sessions/stats') return 30; // 30 seconds
  if (path === '/api/sessions/active') return 10; // 10 seconds
  return CACHE_DEFAULT_TTL;
};

const cacheMiddleware = async (req, res, next) => {
  if (!CACHE_ENABLED || !isRedisConnected || req.method !== 'GET') {
    return next();
  }

  const key = getCacheKey(req);

  try {
    const cachedResponse = await redisClient.get(key);

    if (cachedResponse) {
      res.setHeader('X-Cache', 'hit');
      return res.send(JSON.parse(cachedResponse));
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }

  res.setHeader('X-Cache', 'miss');
  const originalSend = res.send;
  res.send = (body) => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const ttl = getTtlForPath(req.path);
        redisClient.setEx(key, ttl, body);
      }
    } catch (error) {
      console.error('Cache write error:', error);
    }
    return originalSend.call(res, body);
  };

  next();
};

export const invalidateCache = async (path) => {
  if (!CACHE_ENABLED || !isRedisConnected) return;
  const key = `cache:${path}`;
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error(`Failed to invalidate cache for key "${key}":`, error);
  }
};

export default cacheMiddleware;
