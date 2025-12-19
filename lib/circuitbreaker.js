/**
 * Circuit Breaker for API calls
 */
export class CircuitBreaker {
    constructor(threshold = 5, resetTimeout = 60000) {
        this.failures = 0;
        this.lastFailure = null;
        this.threshold = threshold;
        this.resetTimeout = resetTimeout;
    }

    isOpen() {
        if (this.failures >= this.threshold) {
            const timeSinceFailure = Date.now() - this.lastFailure;
            if (timeSinceFailure < this.resetTimeout) {
                return true;
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
