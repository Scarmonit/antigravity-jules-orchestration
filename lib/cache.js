import { LRUCache } from 'lru-cache';

/**
 * Wrapper for lru-cache to match the project's interface if needed,
 * or export a configured instance.
 * The project used a custom LRUCache with `get`, `set`, `invalidate`, `clear`, `stats`.
 */

export class ApiCache {
    constructor(maxSize = 100, defaultTTL = 10000) {
        this.cache = new LRUCache({
            max: maxSize,
            ttl: defaultTTL,
        });
        this.defaultTTL = defaultTTL;
    }

    get(key) {
        return this.cache.get(key);
    }

    set(key, value, ttl = this.defaultTTL) {
        this.cache.set(key, value, { ttl });
    }

    invalidate(pattern) {
        // lru-cache doesn't support pattern deletion directly efficiently,
        // but we can iterate if needed or just use `delete`.
        // The original implementation iterated over keys.
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
        return {
            size: this.cache.size,
            maxSize: this.cache.max,
        };
    }
}
