/**
 * Jules API Client Module
 * Encapsulates Jules API interactions, circuit breaking, and session helpers
 */

import https from 'https';
import dotenv from 'dotenv';
import sessionCreateSchema from '../schemas/session-create-schema.js';
import { structuredLog } from './logger.js';
import { recallContextForTask } from './memory-client.js';

dotenv.config();

const JULES_API_KEY = process.env.JULES_API_KEY;

// HTTP Agent with connection pooling for Jules API
const julesAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5
});

// Circuit Breaker for Jules API
export const circuitBreaker = {
  failures: 0,
  lastFailure: null,
  threshold: 5,        // Trip after 5 consecutive failures
  resetTimeout: 60000, // Reset after 1 minute
  isOpen() {
    if (this.failures >= this.threshold) {
      const timeSinceFailure = Date.now() - this.lastFailure;
      if (timeSinceFailure < this.resetTimeout) {
        return true; // Circuit is open, reject requests
      }
      this.failures = 0; // Reset after timeout
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

// Retry with Exponential Backoff
export async function retryWithBackoff(fn, options = {}) {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000, correlationId } = options;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (error) {
      lastError = error;
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) throw error;
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000, maxDelay);
        structuredLog('warn', `Retry attempt ${attempt}/${maxRetries}`, { correlationId, delay: Math.round(delay), error: error.message });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Jules API helper - make authenticated request with connection pooling
export function julesRequest(method, path, body = null) {
  // Circuit breaker check
  if (circuitBreaker.isOpen()) {
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
        'X-Goog-Api-Key': JULES_API_KEY,
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
          circuitBreaker.recordFailure();
          reject(new Error('Response too large (exceeded 10MB limit)'));
        }
      });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          circuitBreaker.recordSuccess();
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          circuitBreaker.recordFailure();
          console.error('[Jules API] Error', response.statusCode + ':', data);
          reject(new Error('Jules API error: ' + response.statusCode + ' - ' + data));
        }
      });
    });

    // 30 second timeout to prevent hanging requests
    req.setTimeout(30000, () => {
      req.destroy();
      circuitBreaker.recordFailure();
      reject(new Error('Request timeout after 30 seconds'));
    });

    req.on('error', (err) => {
      circuitBreaker.recordFailure();
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

// Create a new Jules session with correct API schema
export async function createJulesSession(config, invalidateCachesCallback = () => {}) {
  const { error } = sessionCreateSchema.validate(config);
  if (error) {
    // Sanitize and format the error to be more user-friendly
    const errorMessage = error.details.map(d => d.message).join(', ');
    const validationError = new Error(`Invalid session configuration: ${errorMessage}`);
    validationError.statusCode = 400; // Bad Request
    throw validationError;
  }
  // Recall relevant context from semantic memory before creating session
  let memoryContext = null;
  if (process.env.SEMANTIC_MEMORY_URL && config.prompt) {
    try {
      const contextResult = await recallContextForTask(config.prompt, config.source);
      if (contextResult.success && contextResult.memories?.length > 0) {
        memoryContext = contextResult;
        structuredLog('info', 'Recalled memory context for session', {
          memoryCount: contextResult.memories.length,
          source: config.source
        });
      }
    } catch (err) {
      structuredLog('warn', 'Failed to recall memory context', { error: err.message });
    }
  }

  // Determine the starting branch - required by Jules API
  let startingBranch = config.branch;

  // If no branch specified, fetch the default branch from source info
  if (!startingBranch) {
    console.log('[Jules API] No branch specified, fetching default branch from source...');
    try {
      const sources = await julesRequest('GET', '/sources');
      const source = sources.sources?.find(s => s.name === config.source);
      if (source?.githubRepo?.defaultBranch?.displayName) {
        startingBranch = source.githubRepo.defaultBranch.displayName;
        console.log('[Jules API] Using default branch:', startingBranch);
      } else {
        // Fallback to common defaults
        startingBranch = 'main';
        console.log('[Jules API] No default branch found, using fallback:', startingBranch);
      }
    } catch (err) {
      console.error('[Jules API] Failed to fetch source info:', err.message);
      startingBranch = 'main';
    }
  }

  // Enhance prompt with memory context if available
  let enhancedPrompt = config.prompt;
  if (memoryContext?.suggestions) {
    enhancedPrompt = `${config.prompt}\n\n---\n${memoryContext.suggestions}`;
    structuredLog('info', 'Enhanced prompt with memory context');
  }

  const sessionData = {
    prompt: enhancedPrompt,
    sourceContext: {
      source: config.source,
      githubRepoContext: {
        startingBranch: startingBranch
      }
    }
  };

  // Add optional fields
  if (config.title) {
    sessionData.title = config.title;
  }
  if (config.requirePlanApproval !== undefined) {
    sessionData.requirePlanApproval = config.requirePlanApproval;
  }
  if (config.automationMode) {
    sessionData.automationMode = config.automationMode;
  }

  console.log('[Jules API] Creating session:', JSON.stringify(sessionData, null, 2));
  const session = await julesRequest('POST', '/sessions', sessionData);

  if (invalidateCachesCallback) invalidateCachesCallback();

  return session;
}

export default {
    julesRequest,
    createJulesSession,
    retryWithBackoff,
    circuitBreaker
};
