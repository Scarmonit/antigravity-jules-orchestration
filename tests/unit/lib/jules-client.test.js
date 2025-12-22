import { test, mock } from 'node:test';
import assert from 'node:assert';
import { julesRequest, circuitBreaker, retryWithBackoff } from '../../../lib/jules-client.js';

test('circuitBreaker logic', () => {
    // Reset circuit breaker
    circuitBreaker.recordSuccess();
    assert.strictEqual(circuitBreaker.isOpen(), false);

    // Failures below threshold
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    assert.strictEqual(circuitBreaker.isOpen(), false);

    // Failures above threshold
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure();
    circuitBreaker.recordFailure(); // 5th failure
    assert.strictEqual(circuitBreaker.isOpen(), true);

    // Reset logic (simulated by time)
    // We can't easily mock Date.now() without a library or redefining it,
    // but we can check the state reset.
    circuitBreaker.recordSuccess();
    assert.strictEqual(circuitBreaker.isOpen(), false);
});

test('retryWithBackoff logic', async () => {
    let attempts = 0;
    const failingFn = async () => {
        attempts++;
        throw new Error('Fail');
    };

    try {
        await retryWithBackoff(failingFn, { maxRetries: 3, baseDelay: 10 });
    } catch (e) {
        assert.strictEqual(e.message, 'Fail');
    }
    assert.strictEqual(attempts, 3);
});

test('retryWithBackoff success', async () => {
    let attempts = 0;
    const successFn = async () => {
        attempts++;
        if (attempts < 2) throw new Error('Fail');
        return 'Success';
    };

    const result = await retryWithBackoff(successFn, { maxRetries: 3, baseDelay: 10 });
    assert.strictEqual(result, 'Success');
    assert.strictEqual(attempts, 2);
});
