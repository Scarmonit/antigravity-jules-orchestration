import { LRUCache } from 'lru-cache';

const options = {
  max: 100,
};

const mcpToolsCache = new LRUCache({ ...options, ttl: 3600000 });
const sessionStatsCache = new LRUCache({ ...options, ttl: 30000 });
const sessionActiveCache = new LRUCache({ ...options, ttl: 10000 });

const getCache = (path) => {
  if (path === '/mcp/tools') return mcpToolsCache;
  if (path === '/api/sessions/stats') return sessionStatsCache;
  if (path === '/api/sessions/active') return sessionActiveCache;
  return null;
};

export const cacheMiddleware = (req, res, next) => {
  const cache = getCache(req.path);
  if (!cache) {
    return next();
  }

  const key = req.originalUrl || req.url;
  const cachedResponse = cache.get(key);

  if (cachedResponse) {
    res.setHeader('X-Cache', 'HIT');
    res.send(cachedResponse);
    return;
  }

  res.setHeader('X-Cache', 'MISS');
  const originalSend = res.send;
  res.send = (body) => {
    cache.set(key, body);
    originalSend.call(res, body);
  };

  next();
};

export const invalidateCaches = () => {
  sessionStatsCache.clear();
  sessionActiveCache.clear();
};
