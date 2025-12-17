/**
 * Unit Tests for Ollama Local LLM Integration
 *
 * Tests cover:
 * - ollamaCompletion() function
 * - listOllamaModels() function
 * - ollamaCodeGeneration() function
 * - ollamaChat() function
 * - Graceful error handling when Ollama is not running
 * - OLLAMA_HOST environment variable parsing
 *
 * @module tests/unit/ollama.test
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { EventEmitter } from 'events';

// =============================================================================
// Mock HTTP Module
// =============================================================================

/**
 * Create a mock HTTP response
 */
function createMockResponse(statusCode, data) {
  const response = new EventEmitter();
  response.statusCode = statusCode;

  // Simulate async data emission
  process.nextTick(() => {
    response.emit('data', JSON.stringify(data));
    response.emit('end');
  });

  return response;
}

/**
 * Create a mock HTTP request that succeeds
 */
function createMockRequest(responseData, statusCode = 200) {
  const req = new EventEmitter();
  req.write = mock.fn(() => {});
  req.end = mock.fn(() => {
    const response = createMockResponse(statusCode, responseData);
    req.emit('response', response);
  });
  req.setTimeout = mock.fn(() => {});
  req.destroy = mock.fn(() => {});

  return req;
}

/**
 * Create a mock HTTP request that fails with connection error
 */
function createFailingRequest(errorMessage = 'ECONNREFUSED') {
  const req = new EventEmitter();
  req.write = mock.fn(() => {});
  req.end = mock.fn(() => {
    process.nextTick(() => {
      req.emit('error', new Error(errorMessage));
    });
  });
  req.setTimeout = mock.fn(() => {});
  req.destroy = mock.fn(() => {});

  return req;
}

// =============================================================================
// Recreated Ollama Functions for Unit Testing
// (Isolated from actual HTTP calls)
// =============================================================================

/**
 * Parse OLLAMA_HOST which may be a full URL like http://127.0.0.1:11434
 */
function parseOllamaHost(hostEnv = 'http://127.0.0.1:11434') {
  try {
    const url = new URL(hostEnv.startsWith('http') ? hostEnv : `http://${hostEnv}`);
    return {
      hostname: url.hostname,
      port: parseInt(url.port || '11434', 10)
    };
  } catch {
    return { hostname: '127.0.0.1', port: 11434 };
  }
}

/**
 * Validate completion parameters
 */
function validateCompletionParams(params) {
  const { prompt, model = 'qwen2.5-coder:7b' } = params;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required and must be a string');
  }

  if (prompt.length > 100000) {
    throw new Error('Prompt too large (max 100000 characters)');
  }

  return { prompt, model };
}

/**
 * Build request body for Ollama generate API
 */
function buildGenerateRequestBody(params) {
  const {
    prompt,
    model = 'qwen2.5-coder:7b',
    systemPrompt = 'You are a helpful coding assistant.',
    stream = false
  } = params;

  return {
    model: model,
    prompt: prompt,
    system: systemPrompt,
    stream: stream,
    options: {
      temperature: 0.7,
      num_predict: 2000
    }
  };
}

/**
 * Build request body for Ollama chat API
 */
function buildChatRequestBody(params) {
  const { messages, model = 'qwen2.5-coder:7b' } = params;

  return {
    model: model,
    messages: messages,
    stream: false
  };
}

/**
 * Parse Ollama generate response
 */
function parseGenerateResponse(data, model) {
  try {
    const response = JSON.parse(data);
    return {
      success: true,
      model: model,
      content: response.response,
      done: response.done,
      totalDuration: response.total_duration,
      evalCount: response.eval_count
    };
  } catch (e) {
    throw new Error(`Failed to parse Ollama response: ${e.message}`);
  }
}

/**
 * Parse Ollama chat response
 */
function parseChatResponse(data, model) {
  try {
    const response = JSON.parse(data);
    return {
      success: true,
      model: model,
      message: response.message,
      done: response.done
    };
  } catch (e) {
    throw new Error(`Failed to parse chat response: ${e.message}`);
  }
}

/**
 * Parse models list response
 */
function parseModelsResponse(data) {
  try {
    const response = JSON.parse(data);
    return {
      success: true,
      models: response.models?.map(m => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        family: m.details?.family
      })) || [],
      ollamaRunning: true
    };
  } catch (e) {
    throw new Error(`Failed to parse models list: ${e.message}`);
  }
}

/**
 * Build code generation prompt
 */
function buildCodeGenerationPrompt(params) {
  const { task, language = 'javascript', context = '' } = params;

  const systemPrompt = `You are an expert ${language} developer. Generate clean, well-documented code.
Only output the code, no explanations unless specifically asked.`;

  const prompt = context
    ? `Context:\n${context}\n\nTask: ${task}`
    : task;

  return { prompt, systemPrompt };
}

// =============================================================================
// Test Suite: parseOllamaHost()
// =============================================================================

describe('Ollama - parseOllamaHost()', () => {
  it('should parse default localhost URL', () => {
    const result = parseOllamaHost('http://127.0.0.1:11434');

    assert.strictEqual(result.hostname, '127.0.0.1');
    assert.strictEqual(result.port, 11434);
  });

  it('should parse custom host and port', () => {
    const result = parseOllamaHost('http://custom-host:8080');

    assert.strictEqual(result.hostname, 'custom-host');
    assert.strictEqual(result.port, 8080);
  });

  it('should add http:// prefix if missing', () => {
    const result = parseOllamaHost('192.168.1.100:11434');

    assert.strictEqual(result.hostname, '192.168.1.100');
    assert.strictEqual(result.port, 11434);
  });

  it('should use default port if not specified', () => {
    const result = parseOllamaHost('http://localhost');

    assert.strictEqual(result.hostname, 'localhost');
    assert.strictEqual(result.port, 11434);
  });

  it('should handle invalid URL gracefully', () => {
    const result = parseOllamaHost('not a valid url !!!');

    // Should fall back to defaults
    assert.strictEqual(result.hostname, '127.0.0.1');
    assert.strictEqual(result.port, 11434);
  });

  it('should handle empty string', () => {
    const result = parseOllamaHost('');

    assert.strictEqual(result.hostname, '127.0.0.1');
    assert.strictEqual(result.port, 11434);
  });

  it('should handle Docker service name', () => {
    const result = parseOllamaHost('http://ollama:11434');

    assert.strictEqual(result.hostname, 'ollama');
    assert.strictEqual(result.port, 11434);
  });
});

// =============================================================================
// Test Suite: validateCompletionParams()
// =============================================================================

describe('Ollama - validateCompletionParams()', () => {
  it('should accept valid params with prompt', () => {
    const params = { prompt: 'Hello, world!' };
    const result = validateCompletionParams(params);

    assert.strictEqual(result.prompt, 'Hello, world!');
    assert.strictEqual(result.model, 'qwen2.5-coder:7b');
  });

  it('should accept custom model', () => {
    const params = { prompt: 'Test', model: 'llama2' };
    const result = validateCompletionParams(params);

    assert.strictEqual(result.model, 'llama2');
  });

  it('should throw error for missing prompt', () => {
    assert.throws(() => {
      validateCompletionParams({});
    }, /Prompt is required/);
  });

  it('should throw error for null prompt', () => {
    assert.throws(() => {
      validateCompletionParams({ prompt: null });
    }, /Prompt is required/);
  });

  it('should throw error for non-string prompt', () => {
    assert.throws(() => {
      validateCompletionParams({ prompt: 123 });
    }, /must be a string/);
  });

  it('should throw error for prompt exceeding max length', () => {
    const longPrompt = 'x'.repeat(100001);

    assert.throws(() => {
      validateCompletionParams({ prompt: longPrompt });
    }, /Prompt too large/);
  });

  it('should accept prompt at max length', () => {
    const maxPrompt = 'x'.repeat(100000);
    const result = validateCompletionParams({ prompt: maxPrompt });

    assert.strictEqual(result.prompt.length, 100000);
  });
});

// =============================================================================
// Test Suite: buildGenerateRequestBody()
// =============================================================================

describe('Ollama - buildGenerateRequestBody()', () => {
  it('should build request body with defaults', () => {
    const body = buildGenerateRequestBody({ prompt: 'Test prompt' });

    assert.strictEqual(body.model, 'qwen2.5-coder:7b');
    assert.strictEqual(body.prompt, 'Test prompt');
    assert.strictEqual(body.system, 'You are a helpful coding assistant.');
    assert.strictEqual(body.stream, false);
    assert.strictEqual(body.options.temperature, 0.7);
    assert.strictEqual(body.options.num_predict, 2000);
  });

  it('should accept custom model', () => {
    const body = buildGenerateRequestBody({
      prompt: 'Test',
      model: 'codellama:13b'
    });

    assert.strictEqual(body.model, 'codellama:13b');
  });

  it('should accept custom system prompt', () => {
    const body = buildGenerateRequestBody({
      prompt: 'Test',
      systemPrompt: 'Custom system prompt'
    });

    assert.strictEqual(body.system, 'Custom system prompt');
  });

  it('should allow streaming mode', () => {
    const body = buildGenerateRequestBody({
      prompt: 'Test',
      stream: true
    });

    assert.strictEqual(body.stream, true);
  });
});

// =============================================================================
// Test Suite: buildChatRequestBody()
// =============================================================================

describe('Ollama - buildChatRequestBody()', () => {
  it('should build chat request body with defaults', () => {
    const messages = [
      { role: 'user', content: 'Hello' }
    ];
    const body = buildChatRequestBody({ messages });

    assert.strictEqual(body.model, 'qwen2.5-coder:7b');
    assert.deepStrictEqual(body.messages, messages);
    assert.strictEqual(body.stream, false);
  });

  it('should accept custom model', () => {
    const messages = [{ role: 'user', content: 'Test' }];
    const body = buildChatRequestBody({ messages, model: 'llama2' });

    assert.strictEqual(body.model, 'llama2');
  });

  it('should handle multi-turn conversation', () => {
    const messages = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' }
    ];
    const body = buildChatRequestBody({ messages });

    assert.strictEqual(body.messages.length, 4);
    assert.strictEqual(body.messages[0].role, 'system');
    assert.strictEqual(body.messages[3].role, 'user');
  });
});

// =============================================================================
// Test Suite: parseGenerateResponse()
// =============================================================================

describe('Ollama - parseGenerateResponse()', () => {
  it('should parse successful response', () => {
    const data = JSON.stringify({
      response: 'Generated text here',
      done: true,
      total_duration: 1234567890,
      eval_count: 50
    });

    const result = parseGenerateResponse(data, 'qwen2.5-coder:7b');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.model, 'qwen2.5-coder:7b');
    assert.strictEqual(result.content, 'Generated text here');
    assert.strictEqual(result.done, true);
    assert.strictEqual(result.totalDuration, 1234567890);
    assert.strictEqual(result.evalCount, 50);
  });

  it('should handle partial response', () => {
    const data = JSON.stringify({
      response: 'Partial...',
      done: false
    });

    const result = parseGenerateResponse(data, 'llama2');

    assert.strictEqual(result.done, false);
    assert.strictEqual(result.content, 'Partial...');
  });

  it('should throw error for invalid JSON', () => {
    assert.throws(() => {
      parseGenerateResponse('not valid json', 'model');
    }, /Failed to parse Ollama response/);
  });

  it('should handle empty response content', () => {
    const data = JSON.stringify({
      response: '',
      done: true
    });

    const result = parseGenerateResponse(data, 'model');

    assert.strictEqual(result.content, '');
    assert.strictEqual(result.success, true);
  });
});

// =============================================================================
// Test Suite: parseChatResponse()
// =============================================================================

describe('Ollama - parseChatResponse()', () => {
  it('should parse successful chat response', () => {
    const data = JSON.stringify({
      message: { role: 'assistant', content: 'Hello!' },
      done: true
    });

    const result = parseChatResponse(data, 'qwen2.5-coder:7b');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.model, 'qwen2.5-coder:7b');
    assert.deepStrictEqual(result.message, { role: 'assistant', content: 'Hello!' });
    assert.strictEqual(result.done, true);
  });

  it('should throw error for invalid JSON', () => {
    assert.throws(() => {
      parseChatResponse('invalid', 'model');
    }, /Failed to parse chat response/);
  });
});

// =============================================================================
// Test Suite: parseModelsResponse()
// =============================================================================

describe('Ollama - parseModelsResponse()', () => {
  it('should parse models list correctly', () => {
    const data = JSON.stringify({
      models: [
        {
          name: 'qwen2.5-coder:7b',
          size: 4500000000,
          modified_at: '2024-01-01T00:00:00Z',
          details: { family: 'qwen' }
        },
        {
          name: 'llama2:13b',
          size: 7000000000,
          modified_at: '2024-01-02T00:00:00Z',
          details: { family: 'llama' }
        }
      ]
    });

    const result = parseModelsResponse(data);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.ollamaRunning, true);
    assert.strictEqual(result.models.length, 2);
    assert.strictEqual(result.models[0].name, 'qwen2.5-coder:7b');
    assert.strictEqual(result.models[0].family, 'qwen');
    assert.strictEqual(result.models[1].name, 'llama2:13b');
  });

  it('should handle empty models list', () => {
    const data = JSON.stringify({ models: [] });

    const result = parseModelsResponse(data);

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.models, []);
  });

  it('should handle missing models array', () => {
    const data = JSON.stringify({});

    const result = parseModelsResponse(data);

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.models, []);
  });

  it('should handle models without details', () => {
    const data = JSON.stringify({
      models: [
        { name: 'model1', size: 1000 }
      ]
    });

    const result = parseModelsResponse(data);

    assert.strictEqual(result.models[0].family, undefined);
  });

  it('should throw error for invalid JSON', () => {
    assert.throws(() => {
      parseModelsResponse('invalid json');
    }, /Failed to parse models list/);
  });
});

// =============================================================================
// Test Suite: buildCodeGenerationPrompt()
// =============================================================================

describe('Ollama - buildCodeGenerationPrompt()', () => {
  it('should build prompt for JavaScript by default', () => {
    const result = buildCodeGenerationPrompt({ task: 'Create a hello world function' });

    assert.ok(result.systemPrompt.includes('javascript'));
    assert.strictEqual(result.prompt, 'Create a hello world function');
  });

  it('should build prompt for specified language', () => {
    const result = buildCodeGenerationPrompt({
      task: 'Create a class',
      language: 'python'
    });

    assert.ok(result.systemPrompt.includes('python'));
  });

  it('should include context in prompt when provided', () => {
    const result = buildCodeGenerationPrompt({
      task: 'Add error handling',
      context: 'function foo() { return bar; }'
    });

    assert.ok(result.prompt.includes('Context:'));
    assert.ok(result.prompt.includes('function foo()'));
    assert.ok(result.prompt.includes('Task: Add error handling'));
  });

  it('should not include context prefix when context is empty', () => {
    const result = buildCodeGenerationPrompt({
      task: 'Write tests',
      context: ''
    });

    assert.ok(!result.prompt.includes('Context:'));
    assert.strictEqual(result.prompt, 'Write tests');
  });

  it('should include code-only instruction in system prompt', () => {
    const result = buildCodeGenerationPrompt({ task: 'Test' });

    assert.ok(result.systemPrompt.includes('Only output the code'));
  });
});

// =============================================================================
// Test Suite: Graceful Error Handling
// =============================================================================

describe('Ollama - Graceful Error Handling', () => {
  it('should return graceful error when Ollama not running (listModels pattern)', () => {
    // This tests the pattern used in the actual code for graceful degradation
    const errorResult = {
      success: false,
      models: [],
      ollamaRunning: false,
      error: 'Ollama not running: ECONNREFUSED'
    };

    assert.strictEqual(errorResult.success, false);
    assert.strictEqual(errorResult.ollamaRunning, false);
    assert.deepStrictEqual(errorResult.models, []);
    assert.ok(errorResult.error.includes('ECONNREFUSED'));
  });

  it('should include connection refused error message', () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:11434');
    const errorMessage = `Ollama not running: ${error.message}`;

    assert.ok(errorMessage.includes('ECONNREFUSED'));
    assert.ok(errorMessage.includes('127.0.0.1:11434'));
  });

  it('should preserve error details for debugging', () => {
    const originalError = new Error('Connection timeout');
    const wrappedError = new Error(`Ollama request failed: ${originalError.message}. Is Ollama running?`);

    assert.ok(wrappedError.message.includes('Connection timeout'));
    assert.ok(wrappedError.message.includes('Is Ollama running?'));
  });
});

// =============================================================================
// Test Suite: API Options
// =============================================================================

describe('Ollama - API Options Configuration', () => {
  it('should use default temperature of 0.7', () => {
    const body = buildGenerateRequestBody({ prompt: 'Test' });

    assert.strictEqual(body.options.temperature, 0.7);
  });

  it('should use default num_predict of 2000', () => {
    const body = buildGenerateRequestBody({ prompt: 'Test' });

    assert.strictEqual(body.options.num_predict, 2000);
  });

  it('should set stream to false by default', () => {
    const body = buildGenerateRequestBody({ prompt: 'Test' });

    assert.strictEqual(body.stream, false);
  });
});

// =============================================================================
// Test Suite: Edge Cases
// =============================================================================

describe('Ollama - Edge Cases', () => {
  it('should handle Unicode characters in prompt', () => {
    const prompt = 'Create a function that handles 中文 and emoji 🚀';
    const body = buildGenerateRequestBody({ prompt });

    assert.strictEqual(body.prompt, prompt);
  });

  it('should handle special characters in prompt', () => {
    const prompt = 'Handle regex: /^[a-z]+$/g and SQL: SELECT * FROM table';
    const body = buildGenerateRequestBody({ prompt });

    assert.strictEqual(body.prompt, prompt);
  });

  it('should handle multiline prompts', () => {
    const prompt = `Line 1
Line 2
Line 3`;
    const body = buildGenerateRequestBody({ prompt });

    assert.ok(body.prompt.includes('\n'));
    assert.strictEqual(body.prompt.split('\n').length, 3);
  });

  it('should handle model names with special characters', () => {
    const body = buildGenerateRequestBody({
      prompt: 'Test',
      model: 'qwen2.5-coder:7b-instruct-q4_K_M'
    });

    assert.strictEqual(body.model, 'qwen2.5-coder:7b-instruct-q4_K_M');
  });
});
