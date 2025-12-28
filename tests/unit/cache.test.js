import { test, mock } from 'node:test';
import assert from 'node:assert';
import { cacheMiddleware, invalidateCaches } from '../../middleware/cacheMiddleware.js';

test('cacheMiddleware', async (t) => {
  await t.test('should cache a response', async () => {
    const req = { path: '/api/sessions/active', originalUrl: '/api/sessions/active' };
    const res = {
      setHeader: () => {},
      send: (body) => {
        assert.strictEqual(body, 'test response');
      }
    };
    const next = () => {};

    cacheMiddleware(req, res, next);
    res.send('test response');

    const cachedRes = {
      setHeader: (header, value) => {
        assert.strictEqual(header, 'X-Cache');
        assert.strictEqual(value, 'HIT');
      },
      send: (body) => {
        assert.strictEqual(body, 'test response');
      }
    };
    cacheMiddleware(req, cachedRes, () => {});
  });

  await t.test('should not cache a response for a different path', async () => {
    const req = { path: '/api/sessions/active', originalUrl: '/api/sessions/active' };
    const res = {
      setHeader: () => {},
      send: (body) => {
        assert.strictEqual(body, 'test response');
      }
    };
    const next = () => {};

    cacheMiddleware(req, res, next);
    res.send('test response');

    const req2 = { path: '/api/sessions/stats', originalUrl: '/api/sessions/stats' };
    const res2 = {
      setHeader: (header, value) => {
        assert.strictEqual(header, 'X-Cache');
        assert.strictEqual(value, 'MISS');
      },
      send: () => {}
    };
    cacheMiddleware(req2, res2, () => {});
  });

  await t.test('should invalidate the cache', async () => {
    const req = { path: '/api/sessions/active', originalUrl: '/api/sessions/active' };
    const res = {
      setHeader: () => {},
      send: (body) => {
        assert.strictEqual(body, 'test response');
      }
    };
    const next = () => {};

    cacheMiddleware(req, res, next);
    res.send('test response');

    invalidateCaches();

    const cachedRes = {
      setHeader: (header, value) => {
        assert.strictEqual(header, 'X-Cache');
        assert.strictEqual(value, 'MISS');
      },
      send: () => {}
    };
    cacheMiddleware(req, cachedRes, () => {});
  });
});
