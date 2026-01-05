// Circuit Breaker for Jules API
export class CircuitBreaker {
  constructor() {
    this.failures = 0;
    this.lastFailure = null;
    this.threshold = 5;        // Trip after 5 consecutive failures
    this.resetTimeout = 60000; // Reset after 1 minute
  }

  isOpen() {
    if (this.failures >= this.threshold) {
      const timeSinceFailure = Date.now() - this.lastFailure;
      if (timeSinceFailure < this.resetTimeout) {
        return true; // Circuit is open, reject requests
      }
      this.failures = 0; // Reset after timeout
    }
    return false;
  }

  recordSuccess() {
    this.failures = 0;
  }

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
  }
}

export const circuitBreaker = new CircuitBreaker();
