import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { cacheMiddleware, invalidateCacheForPaths, initializeRedis } from '../../middleware/cacheMiddleware.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import compression from 'compression';
import Joi from 'joi';
import fs from 'fs';
import path from 'path';

// Set env var to enable caching for tests
process.env.CACHE_ENABLED = 'true';

let redisClient;

beforeAll(async () => {
  // Use a separate test database
  process.env.REDIS_URL = process.env.REDIS_URL ? `${process.env.REDIS_URL}/15` : 'redis://localhost:6379/15';
  redisClient = await initializeRedis();
});

afterAll(async () => {
  if (redisClient) {
    await redisClient.quit();
  }
});

beforeEach(async () => {
  // Clear the cache before each test
  if (redisClient) {
    await redisClient.flushDb();
  }
});

// Test Caching Middleware
describe('cacheMiddleware', () => {
  const app = express();
  app.get('/cached-route', cacheMiddleware, (req, res) => {
    res.json({ message: 'This is a cached response' });
  });

  it('should cache a response and return it on the second request', async () => {
    const response1 = await request(app).get('/cached-route');
    expect(response1.headers['x-cache']).toBe('MISS');

    const response2 = await request(app).get('/cached-route');
    expect(response2.headers['x-cache']).toBe('HIT');
    expect(response2.body).toEqual({ message: 'This is a cached response' });
  });

  it('should invalidate the cache', async () => {
    await request(app).get('/cached-route'); // Cache the response
    await invalidateCacheForPaths(['/cached-route']);
    const response = await request(app).get('/cached-route');
    expect(response.headers['x-cache']).toBe('MISS');
  });
});

// Test Validation Middleware
describe('validateRequest', () => {
  const app = express();
  app.use(express.json());

  app.post('/validated-route', validateRequest('mcp-execute'), (req, res) => {
    res.json({ message: 'Validation successful' });
  });

  it('should return a 400 error for an invalid request', async () => {
    const response = await request(app)
      .post('/validated-route')
      .send({ age: 30 });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('should return a 200 for a valid request', async () => {
    const response = await request(app)
      .post('/validated-route')
      .send({ tool: 'jules_create_session', parameters: {} });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Validation successful');
  });
});

// Test Compression Middleware
describe('compressionMiddleware', () => {
  const app = express();
  app.use(compression({ threshold: 0 }));
  app.get('/compressed-route', (req, res) => {
    res.send('This is a compressed response'.repeat(100));
  });

  it('should compress the response', async () => {
    const response = await request(app)
      .get('/compressed-route')
      .set('Accept-Encoding', 'gzip');
    expect(response.headers['content-encoding']).toBe('gzip');
  });
});
