/**
 * Jules API Client
 * Encapsulates authentication, connection pooling, and error handling for Jules API
 */

import https from 'https';

// HTTP Agent with connection pooling for Jules API
const julesAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 10,
    maxFreeSockets: 5
});

export class JulesClient {
    constructor(apiKey, circuitBreaker) {
        this.apiKey = apiKey;
        this.circuitBreaker = circuitBreaker;
    }

    /**
     * Make authenticated request with connection pooling
     */
    async request(method, path, body = null) {
        // Circuit breaker check
        if (this.circuitBreaker.isOpen()) {
            return Promise.reject(new Error('Circuit breaker is open - Jules API temporarily unavailable'));
        }

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'jules.googleapis.com',
                port: 443,
                path: '/v1alpha' + path,
                method: method,
                agent: julesAgent, // Connection pooling for 25-30% latency reduction
                headers: {
                    'X-Goog-Api-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            };

            console.log('[Jules API]', method, path);

            const req = https.request(options, (response) => {
                let data = '';
                const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB limit
                response.on('data', chunk => {
                    data += chunk;
                    if (data.length > MAX_RESPONSE_SIZE) {
                        response.destroy();
                        this.circuitBreaker.recordFailure();
                        reject(new Error('Response too large (exceeded 10MB limit)'));
                    }
                });
                response.on('end', () => {
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        this.circuitBreaker.recordSuccess();
                        try {
                            resolve(JSON.parse(data));
                        } catch {
                            resolve(data);
                        }
                    } else {
                        this.circuitBreaker.recordFailure();
                        console.error('[Jules API] Error', response.statusCode + ':', data);
                        reject(new Error('Jules API error: ' + response.statusCode + ' - ' + data));
                    }
                });
            });

            // 30 second timeout to prevent hanging requests
            req.setTimeout(30000, () => {
                req.destroy();
                this.circuitBreaker.recordFailure();
                reject(new Error('Request timeout after 30 seconds'));
            });

            req.on('error', (err) => {
                this.circuitBreaker.recordFailure();
                console.error('[Jules API] Request error:', err.message);
                reject(err);
            });

            if (body) {
                const jsonBody = JSON.stringify(body);
                req.setHeader('Content-Length', Buffer.byteLength(jsonBody));
                req.write(jsonBody);
            }
            req.end();
        });
    }
}
