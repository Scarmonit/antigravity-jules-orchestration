import assert from 'assert';
import { test, describe, it, beforeEach } from 'node:test';
import { LRUCache } from '../../lib/lru-cache.js';

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3, 1000); // Size 3, 1s TTL
  });

  it('should store and retrieve values', () => {
    cache.set('a', 1);
    assert.strictEqual(cache.get('a'), 1);
  });

  it('should return null for missing keys', () => {
    assert.strictEqual(cache.get('b'), null);
  });

  it('should evict least recently used items', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // Should evict 'a'

    assert.strictEqual(cache.get('a'), null);
    assert.strictEqual(cache.get('b'), 2);
    assert.strictEqual(cache.get('c'), 3);
    assert.strictEqual(cache.get('d'), 4);
  });

  it('should update LRU order on access', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // Access 'a', making 'b' the LRU
    cache.set('d', 4); // Should evict 'b'

    assert.strictEqual(cache.get('a'), 1);
    assert.strictEqual(cache.get('b'), null);
    assert.strictEqual(cache.get('d'), 4);
  });

  it('should expire items after TTL', async () => {
    cache.set('a', 1, 10); // 10ms TTL
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.strictEqual(cache.get('a'), null);
  });

  it('should clear the cache', () => {
    cache.set('a', 1);
    cache.clear();
    assert.strictEqual(cache.get('a'), null);
    assert.strictEqual(cache.stats().size, 0);
  });
});
