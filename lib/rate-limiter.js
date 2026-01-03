export class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.store = new Map();
    // Cleanup interval (every 10 minutes)
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    // Ensure interval doesn't block process exit
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  check(ip) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let requests = this.store.get(ip);
    if (!requests) {
      requests = [];
      this.store.set(ip, requests);
    }

    // Optimization: Remove old requests
    // Find the index of the first request inside the window
    // Since requests are pushed in order, we can find the first valid one.
    // Anything before it is invalid.
    let validStartIndex = 0;
    while (validStartIndex < requests.length && requests[validStartIndex] <= windowStart) {
      validStartIndex++;
    }

    if (validStartIndex > 0) {
      requests.splice(0, validStartIndex);
    }

    if (requests.length >= this.maxRequests) {
      return {
        allowed: false,
        retryAfter: Math.ceil((requests[0] + this.windowMs - now) / 1000),
        remaining: 0,
        limit: this.maxRequests
      };
    }

    requests.push(now);

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
      if (requests.length === 0 || requests[requests.length - 1] <= windowStart) {
        this.store.delete(ip);
      }
    }
  }

  stop() {
    clearInterval(this.cleanupInterval);
  }
}
