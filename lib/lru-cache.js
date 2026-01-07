import { LRUCache as LRU } from 'lru-cache';

export class LRUCache {
  constructor(maxSize = 100, defaultTTL = 10000) {
    this.cache = new LRU({
      max: maxSize,
      ttl: defaultTTL,
      updateAgeOnGet: false,
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
    // lru-cache v10 keys() returns an iterator
    for (const key of this.cache.keys()) {
        if (typeof key === 'string' && key.includes(pattern)) {
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

export default LRUCache;
