/**
 * Rate Limiter with memory cleanup
 */
export class RateLimiter {
    constructor(windowMs = 60 * 1000, maxRequests = 100) {
        this.store = new Map();
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;

        // Periodic cleanup to prevent memory leaks
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
    }

    check(ip) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        if (!this.store.has(ip)) {
            this.store.set(ip, []);
        }

        const requests = this.store.get(ip).filter(time => time > windowStart);
        requests.push(now);
        this.store.set(ip, requests);

        if (requests.length > this.maxRequests) {
            return {
                allowed: false,
                retryAfter: Math.ceil(this.windowMs / 1000),
                remaining: 0,
                limit: this.maxRequests
            };
        }

        return {
            allowed: true,
            remaining: this.maxRequests - requests.length,
            limit: this.maxRequests
        };
    }

    cleanup() {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        for (const [ip, requests] of this.store.entries()) {
            const activeRequests = requests.filter(time => time > windowStart);
            if (activeRequests.length === 0) {
                this.store.delete(ip);
            } else {
                this.store.set(ip, activeRequests);
            }
        }
    }

    stop() {
        clearInterval(this.cleanupInterval);
    }
}
