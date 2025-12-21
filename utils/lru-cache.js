// LRU Cache with TTL for API response caching
import { LRUCache as LRU } from 'lru-cache';

export class LRUCache {
  constructor(maxSize = 100, defaultTTL = 10000) {
    this.cache = new LRU({
      max: maxSize,
      ttl: defaultTTL,
    });
    this.maxSize = maxSize;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttl) {
    this.cache.set(key, value, { ttl });
  }

  invalidate(pattern) {
    // lru-cache doesn't support pattern matching directly efficiently without iterating
    // But since maxSize is small (100), iteration is fine.
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  stats() {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}
