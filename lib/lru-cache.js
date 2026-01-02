/**
 * LRU Cache with TTL for API response caching
 */
export class LRUCache {
  constructor(maxSize = 100, defaultTTL = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    // Refresh position (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key, value, ttl = this.defaultTTL) {
    if (this.cache.has(key)) {
      // Delete to refresh position (LRU behavior)
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first entry)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expires: Date.now() + ttl });
  }

  invalidate(pattern) {
    if (!pattern) return;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) this.cache.delete(key);
    }
  }

  clear() {
    this.cache.clear();
  }

  stats() {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

export default LRUCache;
