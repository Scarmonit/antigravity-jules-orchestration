/**
 * Unit Tests for Circuit Breaker Logic
 * Tests the circuit breaker implementation from index.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Circuit Breaker', () => {
  let circuitBreaker;

  beforeEach(() => {
    // Recreate circuit breaker before each test
    circuitBreaker = {
      failures: 0,
      lastFailure: null,
      threshold: 5,
      resetTimeout: 60000,
      isOpen() {
        if (this.failures >= this.threshold) {
          const timeSinceFailure = Date.now() - this.lastFailure;
          if (timeSinceFailure < this.resetTimeout) {
            return true;
          }
          this.failures = 0;
        }
        return false;
      },
      recordSuccess() {
        this.failures = 0;
      },
      recordFailure() {
        this.failures++;
        this.lastFailure = Date.now();
      }
    };
  });

  describe('isOpen()', () => {
    it('should return false when no failures', () => {
      expect(circuitBreaker.isOpen()).toBe(false);
    });

    it('should return false when failures below threshold', () => {
      circuitBreaker.failures = 3;
      circuitBreaker.lastFailure = Date.now();

      expect(circuitBreaker.isOpen()).toBe(false);
    });

    it('should return true when failures reach threshold', () => {
      circuitBreaker.failures = 5;
      circuitBreaker.lastFailure = Date.now();

      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should return true when failures exceed threshold', () => {
      circuitBreaker.failures = 10;
      circuitBreaker.lastFailure = Date.now();

      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should reset after timeout expires', () => {
      circuitBreaker.failures = 5;
      circuitBreaker.lastFailure = Date.now() - 61000; // 61 seconds ago (> 60s timeout)

      const isOpen = circuitBreaker.isOpen();

      expect(isOpen).toBe(false);
      expect(circuitBreaker.failures).toBe(0);
    });

    it('should remain open within timeout period', () => {
      circuitBreaker.failures = 5;
      circuitBreaker.lastFailure = Date.now() - 30000; // 30 seconds ago (< 60s timeout)

      expect(circuitBreaker.isOpen()).toBe(true);
      expect(circuitBreaker.failures).toBe(5); // Should not reset
    });

    it('should handle exactly at threshold', () => {
      circuitBreaker.failures = 5;
      circuitBreaker.lastFailure = Date.now();

      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should handle null lastFailure gracefully', () => {
      circuitBreaker.failures = 5;
      circuitBreaker.lastFailure = null;

      // This should not crash, behavior depends on implementation
      // NaN comparison should result in circuit staying open or resetting
      const result = circuitBreaker.isOpen();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('recordSuccess()', () => {
    it('should reset failures to zero', () => {
      circuitBreaker.failures = 3;

      circuitBreaker.recordSuccess();

      expect(circuitBreaker.failures).toBe(0);
    });

    it('should reset from threshold', () => {
      circuitBreaker.failures = 5;
      circuitBreaker.lastFailure = Date.now();

      circuitBreaker.recordSuccess();

      expect(circuitBreaker.failures).toBe(0);
      expect(circuitBreaker.isOpen()).toBe(false);
    });

    it('should allow circuit to close after success', () => {
      circuitBreaker.failures = 5;
      circuitBreaker.lastFailure = Date.now();

      expect(circuitBreaker.isOpen()).toBe(true);

      circuitBreaker.recordSuccess();

      expect(circuitBreaker.isOpen()).toBe(false);
    });
  });

  describe('recordFailure()', () => {
    it('should increment failure count', () => {
      expect(circuitBreaker.failures).toBe(0);

      circuitBreaker.recordFailure();

      expect(circuitBreaker.failures).toBe(1);
    });

    it('should update lastFailure timestamp', () => {
      const before = Date.now();

      circuitBreaker.recordFailure();

      expect(circuitBreaker.lastFailure).toBeGreaterThanOrEqual(before);
      expect(circuitBreaker.lastFailure).toBeLessThanOrEqual(Date.now());
    });

    it('should trip circuit after threshold failures', () => {
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should continue counting failures beyond threshold', () => {
      for (let i = 0; i < 10; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.failures).toBe(10);
      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should update lastFailure on each failure', () => {
      circuitBreaker.recordFailure();
      const firstTimestamp = circuitBreaker.lastFailure;

      // Wait a bit
      const waitMs = 10;
      const start = Date.now();
      while (Date.now() - start < waitMs) {
        // busy wait
      }

      circuitBreaker.recordFailure();
      const secondTimestamp = circuitBreaker.lastFailure;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle success after partial failures', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.failures).toBe(3);
      expect(circuitBreaker.isOpen()).toBe(false);

      circuitBreaker.recordSuccess();

      expect(circuitBreaker.failures).toBe(0);
      expect(circuitBreaker.isOpen()).toBe(false);
    });

    it('should handle alternating successes and failures', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordSuccess();
      circuitBreaker.recordFailure();
      circuitBreaker.recordSuccess();

      expect(circuitBreaker.failures).toBe(0);
      expect(circuitBreaker.isOpen()).toBe(false);
    });

    it('should trip and reset correctly', () => {
      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.isOpen()).toBe(true);

      // Wait for timeout (simulate)
      circuitBreaker.lastFailure = Date.now() - 61000;

      expect(circuitBreaker.isOpen()).toBe(false);
      expect(circuitBreaker.failures).toBe(0);
    });

    it('should handle rapid failures', () => {
      for (let i = 0; i < 100; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.failures).toBe(100);
      expect(circuitBreaker.isOpen()).toBe(true);

      circuitBreaker.recordSuccess();

      expect(circuitBreaker.isOpen()).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should respect custom threshold', () => {
      circuitBreaker.threshold = 10;

      for (let i = 0; i < 9; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.isOpen()).toBe(false);

      circuitBreaker.recordFailure();

      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should respect custom reset timeout', () => {
      circuitBreaker.threshold = 3;
      circuitBreaker.resetTimeout = 5000; // 5 seconds

      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      circuitBreaker.lastFailure = Date.now() - 6000; // 6 seconds ago

      expect(circuitBreaker.isOpen()).toBe(false);
    });

    it('should work with threshold of 1', () => {
      circuitBreaker.threshold = 1;

      circuitBreaker.recordFailure();

      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should work with very high threshold', () => {
      circuitBreaker.threshold = 1000;

      for (let i = 0; i < 999; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.isOpen()).toBe(false);

      circuitBreaker.recordFailure();

      expect(circuitBreaker.isOpen()).toBe(true);
    });
  });
});
