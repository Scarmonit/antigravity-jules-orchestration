import assert from 'assert';
import { test, describe, it, beforeEach } from 'node:test';
import { rateLimiter } from '../../middleware/simpleRateLimiter.js';

describe('SimpleRateLimiter', () => {
  let req, res, next;

  beforeEach(() => {
    req = { ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' } };
    res = {
      status: (code) => ({ json: (data) => ({ code, data }) }),
      setHeader: () => {}
    };
    next = () => {};
  });

  it('should allow requests under the limit', () => {
    let nextCalled = false;
    next = () => { nextCalled = true; };

    rateLimiter(req, res, next);
    assert.strictEqual(nextCalled, true);
  });
});
