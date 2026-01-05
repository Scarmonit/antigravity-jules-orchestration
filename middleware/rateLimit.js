// Rate limiting - Simple in-memory implementation
import { LRUCache } from 'lru-cache';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

// Use LRU Cache for efficient O(1) storage and automatic cleanup
// Key: IP, Value: Array of timestamps
const rateLimitCache = new LRUCache({
    max: 1000,
    ttl: RATE_LIMIT_WINDOW,
    updateAgeOnGet: true, // Keep active users in cache
});

export default function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    let requests = rateLimitCache.get(ip);
    if (!requests) {
        requests = [];
        rateLimitCache.set(ip, requests);
    }

    // Filter old requests (efficient if array is small, which it is due to limit)
    // Optimization: Since requests are ordered, we can find the cut-off index
    let validStartIndex = 0;
    while(validStartIndex < requests.length && requests[validStartIndex] <= windowStart) {
        validStartIndex++;
    }

    if (validStartIndex > 0) {
        requests.splice(0, validStartIndex);
    }

    // Check if limit exceeded
    if (requests.length >= RATE_LIMIT_MAX) {
        return res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
            hint: 'Please wait before making more requests'
        });
    }

    requests.push(now);
    // Note: LRUCache stores by reference, so pushing to array updates it in cache

    // Explicitly set to refresh TTL if updateAgeOnGet isn't sufficient for array mutations
    // (though updateAgeOnGet works on .get(), which we called)

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
    res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX - requests.length);
    next();
}
