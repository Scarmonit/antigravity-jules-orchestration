import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import Joi from 'joi';

import compressionMiddleware from '../../middleware/compressionMiddleware.js';
import validateRequest from '../../middleware/validateRequest.js';

describe('compression middleware', () => {
    it('should not compress responses when COMPRESSION_ENABLED is not true', async () => {
      process.env.COMPRESSION_ENABLED = 'false';
      const app = express();
      app.use(compressionMiddleware());
      app.get('/', (req, res) => {
        res.send('a'.repeat(2000));
      });

      const response = await request(app).get('/');
      assert.strictEqual(response.headers['content-encoding'], undefined);
    });

    it('should compress responses when COMPRESSION_ENABLED is true', async () => {
      process.env.COMPRESSION_ENABLED = 'true';
      const app = express();
      app.use(compressionMiddleware());
      app.get('/', (req, res) => {
        res.send('a'.repeat(2000));
      });

      const response = await request(app).get('/');
      assert.strictEqual(response.headers['content-encoding'], 'gzip');
    });

    it('should not compress responses below the threshold', async () => {
      process.env.COMPRESSION_ENABLED = 'true';
      const app = express();
      app.use(compressionMiddleware());
      app.get('/', (req, res) => {
        res.send('a'.repeat(100));
      });

      const response = await request(app).get('/');
      assert.strictEqual(response.headers['content-encoding'], undefined);
    });
});

describe('validateRequest middleware', () => {
    const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().min(18).required(),
    });

    it('should call next() if validation passes', async () => {
        const app = express();
        app.use(express.json());
        app.post('/test', validateRequest(schema), (req, res) => {
            res.status(200).send('OK');
        });

        await request(app)
            .post('/test')
            .send({ name: 'John Doe', age: 30 })
            .expect(200, 'OK');
    });

    it('should return 400 if validation fails', async () => {
        const app = express();
        app.use(express.json());
        app.post('/test', validateRequest(schema), (req, res) => {
            res.status(200).send('OK');
        });

        const response = await request(app)
            .post('/test')
            .send({ name: 'John Doe' }); // Missing age

        assert.strictEqual(response.status, 400);
        assert.ok(response.body.errors);
        assert.strictEqual(response.body.errors[0].message, '"age" is required');
    });

    it('should return all errors if validation fails', async () => {
        const app = express();
        app.use(express.json());
        app.post('/test', validateRequest(schema), (req, res) => {
            res.status(200).send('OK');
        });

        const response = await request(app)
            .post('/test')
            .send({ age: 17 }); // Missing name and age is too low

        assert.strictEqual(response.status, 400);
        assert.ok(response.body.errors);
        assert.strictEqual(response.body.errors.length, 2);
    });

    it('should strip unknown properties', async () => {
        const app = express();
        app.use(express.json());
        app.post('/test', validateRequest(schema), (req, res) => {
            res.status(200).json(req.body);
        });

        const response = await request(app)
            .post('/test')
            .send({ name: 'John Doe', age: 30, unknown: 'property' });

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(response.body, { name: 'John Doe', age: 30 });
    });
});
