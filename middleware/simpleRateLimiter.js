// Rate limiting - Simple in-memory implementation with memory leak fix
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Cleanup interval to remove old IPs from the store
setInterval(() => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  for (const [ip, requests] of rateLimitStore.entries()) {
    // Filter out old requests
    const activeRequests = requests.filter(time => time > windowStart);
    if (activeRequests.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, activeRequests);
    }
  }
}, CLEANUP_INTERVAL);

export function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Optimization: Use in-place modification to avoid array allocation on every request
  let requests = rateLimitStore.get(ip);
  if (!requests) {
    requests = [];
    rateLimitStore.set(ip, requests);
  }

  // Remove old requests (array is sorted by time)
  let removeCount = 0;
  while (removeCount < requests.length && requests[removeCount] <= windowStart) {
    removeCount++;
  }

  if (removeCount > 0) {
    requests.splice(0, removeCount);
  }

  requests.push(now);

  if (requests.length > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
      hint: 'Please wait before making more requests'
    });
  }

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX - requests.length);
  next();
}
