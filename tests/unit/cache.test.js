import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import sinon from 'sinon';
import redis from 'redis';

// --- Mock Setup ---
const eventHandlers = {};
const mockRedisClient = {
    on: (event, handler) => {
        eventHandlers[event] = handler;
    },
    connect: sinon.stub().resolves(),
    get: sinon.stub(),
    setEx: sinon.stub(),
    del: sinon.stub(),
};

// Replace the original createClient with a function that returns our mock
sinon.stub(redis, 'createClient').returns(mockRedisClient);

// We need to dynamically import the module under test to apply the mock
async function loadModule() {
    // Bust the module cache to get a fresh instance with our mock
    return await import(`../../middleware/cacheMiddleware.js?v=${Date.now()}`);
}

// --- Test Suite ---
describe('cache middleware', () => {
    let cacheMiddleware;
    let invalidateCache;

    beforeEach(async () => {
        // Reset stubs before each test
        mockRedisClient.connect.resetHistory();
        mockRedisClient.get.reset();
        mockRedisClient.setEx.reset();
        mockRedisClient.del.reset();

        process.env.CACHE_ENABLED = 'true';

        // Load a fresh copy of the module for each test
        const module = await loadModule();
        cacheMiddleware = module.default;
        invalidateCache = module.invalidateCache;

        // Manually trigger the 'connect' event to simulate a successful connection
        if (eventHandlers.connect) {
            eventHandlers.connect();
        }
    });

    it('should call next() if CACHE_ENABLED is false', async () => {
        process.env.CACHE_ENABLED = 'false';
        // Reload the module with the updated env var
        const module = await loadModule();
        const freshCacheMiddleware = module.default;

        const app = express();
        app.use(freshCacheMiddleware);
        app.get('/test', (req, res) => res.send('OK'));

        await request(app).get('/test').expect(200, 'OK');
        assert.strictEqual(mockRedisClient.get.callCount, 0);
    });

    it('should call next() for non-GET requests', async () => {
        const app = express();
        app.use(cacheMiddleware);
        app.post('/test', (req, res) => res.send('OK'));

        await request(app).post('/test').expect(200, 'OK');
        assert.ok(mockRedisClient.get.notCalled);
    });

    it('should return a cached response if one exists', async () => {
        const app = express();
        app.use(cacheMiddleware);
        app.get('/test', (req, res) => res.send('should not be called'));

        const cachedResponse = JSON.stringify({ message: 'cached' });
        mockRedisClient.get.withArgs('cache:/test').resolves(cachedResponse);

        const response = await request(app).get('/test');

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.body, { message: 'cached' });
        assert.strictEqual(response.headers['x-cache'], 'hit');
    });

    it('should cache a response if no cached response exists', async () => {
        const app = express();
        app.use(express.json());
        app.use(cacheMiddleware);
        app.get('/test', (req, res) => res.json({ message: 'not cached' }));

        mockRedisClient.get.withArgs('cache:/test').resolves(null);

        const response = await request(app).get('/test');

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.body, { message: 'not cached' });
        assert.strictEqual(response.headers['x-cache'], 'miss');
        assert.ok(mockRedisClient.setEx.calledOnceWith('cache:/test', 300, JSON.stringify({ message: 'not cached' })));
    });

    it('should use the correct TTL for different paths', async () => {
        const app = express();
        app.use(cacheMiddleware);
        app.get('/mcp/tools', (req, res) => res.json({}));
        app.get('/api/sessions/stats', (req, res) => res.json({}));
        app.get('/api/sessions/active', (req, res) => res.json({}));

        mockRedisClient.get.resolves(null);

        await request(app).get('/mcp/tools');
        assert.ok(mockRedisClient.setEx.calledWith('cache:/mcp/tools', 3600));

        await request(app).get('/api/sessions/stats');
        assert.ok(mockRedisClient.setEx.calledWith('cache:/api/sessions/stats', 30));

        await request(app).get('/api/sessions/active');
        assert.ok(mockRedisClient.setEx.calledWith('cache:/api/sessions/active', 10));
    });

    it('should invalidate the cache', async () => {
        await invalidateCache('/test');
        assert.ok(mockRedisClient.del.calledOnceWith('cache:/test'));
    });
});
