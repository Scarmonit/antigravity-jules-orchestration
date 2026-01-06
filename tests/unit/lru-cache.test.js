import assert from 'assert';
import { describe, it } from 'node:test';
import { LRUCache } from '../../lib/lru-cache.js';

describe('LRUCache', () => {
  it('should store and retrieve items', () => {
    const cache = new LRUCache();
    cache.set('key1', 'value1');
    assert.strictEqual(cache.get('key1'), 'value1');
  });

  it('should return null for missing items', () => {
    const cache = new LRUCache();
    assert.strictEqual(cache.get('missing'), null);
  });

  it('should evict LRU items when max size is reached', () => {
    const cache = new LRUCache(2); // Max size 2
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3'); // Should evict key1

    assert.strictEqual(cache.get('key1'), null);
    assert.strictEqual(cache.get('key2'), 'value2');
    assert.strictEqual(cache.get('key3'), 'value3');
  });

  it('should update LRU order on get', () => {
    const cache = new LRUCache(2);
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.get('key1'); // Access key1, making it MRU
    cache.set('key3', 'value3'); // Should evict key2 (now LRU)

    assert.strictEqual(cache.get('key1'), 'value1');
    assert.strictEqual(cache.get('key2'), null);
    assert.strictEqual(cache.get('key3'), 'value3');
  });

  it('should update LRU order on set update', () => {
    const cache = new LRUCache(2);
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key1', 'newValue1'); // Update key1, making it MRU
    cache.set('key3', 'value3'); // Should evict key2

    assert.strictEqual(cache.get('key1'), 'newValue1');
    assert.strictEqual(cache.get('key2'), null);
    assert.strictEqual(cache.get('key3'), 'value3');
  });

  it('should respect TTL', async () => {
    const cache = new LRUCache(100, 10); // 10ms TTL
    cache.set('key1', 'value1');
    assert.strictEqual(cache.get('key1'), 'value1');

    await new Promise(resolve => setTimeout(resolve, 20));
    assert.strictEqual(cache.get('key1'), null);
  });

  it('should invalidate by pattern', () => {
    const cache = new LRUCache();
    cache.set('user:1', 'data1');
    cache.set('user:2', 'data2');
    cache.set('post:1', 'data3');

    cache.invalidate('user:');
    assert.strictEqual(cache.get('user:1'), null);
    assert.strictEqual(cache.get('user:2'), null);
    assert.strictEqual(cache.get('post:1'), 'data3');
  });
});
