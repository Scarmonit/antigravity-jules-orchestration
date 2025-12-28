import redis from 'redis';

const CACHE_DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL, 10) || 300;

let redisClient;

export async function initializeRedis() {
  if (process.env.CACHE_ENABLED !== 'true') return null;

  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (redisClient) {
    await redisClient.quit().catch(err => console.error("Error quitting old redis client", err));
  }

  try {
    const client = redis.createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis Error:', err));
    await client.connect();
    redisClient = client;
    console.log('Redis client connected successfully.');
    return redisClient;
  } catch (err) {
    console.error('Failed to initialize Redis client:', err);
    redisClient = null;
    return null;
  }
}

const endpointTTLs = {
  '/mcp/tools': 3600,
  '/api/sessions/stats': 30,
  '/api/sessions/active': 10,
};

function getCacheKey(req) {
  return `cache:${req.method}:${req.originalUrl}`;
}

export async function cacheMiddleware(req, res, next) {
  if (process.env.CACHE_ENABLED !== 'true') {
    return next();
  }

  const client = await initializeRedis();
  if (!client) {
    return next();
  }

  const key = getCacheKey(req);
  const ttl = endpointTTLs[req.path] || CACHE_DEFAULT_TTL;

  try {
    const cachedResponse = await client.get(key);
    if (cachedResponse) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Type', 'application/json');
      res.send(cachedResponse);
      return;
    } else {
      res.setHeader('X-Cache', 'MISS');
      const originalSend = res.send;
      res.send = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const valueToCache = (typeof body === 'string') ? body : JSON.stringify(body);
          client.setEx(key, ttl, valueToCache).catch((err) =>
            console.error('Redis setex error:', err)
          );
        }
        originalSend.apply(res, arguments);
      };
      next();
    }
  } catch (err) {
    console.error('Redis get error:', err);
    next();
  }
}

export async function invalidateCacheForPaths(paths) {
  if (process.env.CACHE_ENABLED !== 'true') {
    return;
  }
  const client = await initializeRedis();
  if (!client) {
    return;
  }
  const keys = paths.map(path => `cache:GET:${path}`);
  if (keys.length === 0) return;
  try {
    await client.del(keys);
  } catch (err) {
    console.error(`Redis del error for keys ${keys.join(', ')}:`, err);
  }
}
