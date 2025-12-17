/**
 * Unit Tests for Alibaba Qwen Model Integration
 * Tests the lib/qwen.js module functions
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// ============================================================================
// RECREATED PURE FUNCTIONS FROM lib/qwen.js
// These are extracted/recreated to test logic without external dependencies
// ============================================================================

const QWEN_ENDPOINT = 'dashscope.aliyuncs.com';
const QWEN_PATH = '/api/v1/services/aigc/text-generation/generation';

/**
 * Build request body for Qwen API
 */
function buildQwenRequestBody(params) {
  const {
    prompt,
    model = 'qwen-turbo',
    maxTokens = 2000,
    temperature = 0.7,
    systemPrompt = 'You are a helpful coding assistant.'
  } = params;

  return {
    model: model,
    input: {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    },
    parameters: {
      max_tokens: maxTokens,
      temperature: temperature,
      result_format: 'message'
    }
  };
}

/**
 * Build HTTP request options for Qwen API
 */
function buildQwenRequestOptions(apiKey) {
  return {
    hostname: QWEN_ENDPOINT,
    port: 443,
    path: QWEN_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-SSE': 'disable'
    }
  };
}

/**
 * Parse Qwen API response
 */
function parseQwenResponse(data, model) {
  const response = JSON.parse(data);

  if (response.output) {
    return {
      success: true,
      model: model,
      content: response.output.choices?.[0]?.message?.content || response.output.text,
      usage: response.usage || {},
      requestId: response.request_id
    };
  } else if (response.code) {
    throw new Error(`Qwen API Error: ${response.code} - ${response.message}`);
  } else {
    return {
      success: true,
      model: model,
      content: data,
      raw: true
    };
  }
}

/**
 * List available Qwen models (pure function from module)
 */
function listQwenModels(apiKeyConfigured = false) {
  return {
    models: [
      { id: 'qwen-turbo', description: 'Fast, cost-effective model for simple tasks', tokens: '8K context' },
      { id: 'qwen-plus', description: 'Balanced performance and quality', tokens: '32K context' },
      { id: 'qwen-max', description: 'Most capable model for complex reasoning', tokens: '32K context' },
      { id: 'qwen-max-longcontext', description: 'Extended context for large codebases', tokens: '1M context' },
      { id: 'qwen-coder-plus', description: 'Specialized for code generation', tokens: '128K context' }
    ],
    configured: apiKeyConfigured,
    note: apiKeyConfigured ? 'API key configured' : 'Requires ALIBABA_API_KEY in environment'
  };
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

/**
 * Validate completion parameters
 */
function validateCompletionParams(params) {
  const errors = [];

  if (!params || typeof params !== 'object') {
    errors.push('params must be an object');
    return { valid: false, errors };
  }

  if (!params.prompt || typeof params.prompt !== 'string') {
    errors.push('prompt is required and must be a string');
  }

  if (params.maxTokens !== undefined && (typeof params.maxTokens !== 'number' || params.maxTokens < 1)) {
    errors.push('maxTokens must be a positive number');
  }

  if (params.temperature !== undefined && (typeof params.temperature !== 'number' || params.temperature < 0 || params.temperature > 2)) {
    errors.push('temperature must be a number between 0 and 2');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Qwen Module', () => {
  describe('Constants', () => {
    it('should have correct API endpoint', () => {
      assert.strictEqual(QWEN_ENDPOINT, 'dashscope.aliyuncs.com');
    });

    it('should have correct API path', () => {
      assert.strictEqual(QWEN_PATH, '/api/v1/services/aigc/text-generation/generation');
    });
  });

  describe('buildQwenRequestBody', () => {
    it('should build request with default parameters', () => {
      const result = buildQwenRequestBody({ prompt: 'Hello' });

      assert.strictEqual(result.model, 'qwen-turbo');
      assert.strictEqual(result.parameters.max_tokens, 2000);
      assert.strictEqual(result.parameters.temperature, 0.7);
      assert.strictEqual(result.parameters.result_format, 'message');
      assert.deepStrictEqual(result.input.messages, [
        { role: 'system', content: 'You are a helpful coding assistant.' },
        { role: 'user', content: 'Hello' }
      ]);
    });

    it('should use custom model', () => {
      const result = buildQwenRequestBody({
        prompt: 'Test',
        model: 'qwen-max'
      });

      assert.strictEqual(result.model, 'qwen-max');
    });

    it('should use custom maxTokens', () => {
      const result = buildQwenRequestBody({
        prompt: 'Test',
        maxTokens: 4000
      });

      assert.strictEqual(result.parameters.max_tokens, 4000);
    });

    it('should use custom temperature', () => {
      const result = buildQwenRequestBody({
        prompt: 'Test',
        temperature: 0.3
      });

      assert.strictEqual(result.parameters.temperature, 0.3);
    });

    it('should use custom system prompt', () => {
      const result = buildQwenRequestBody({
        prompt: 'Test',
        systemPrompt: 'You are a Python expert.'
      });

      assert.strictEqual(result.input.messages[0].content, 'You are a Python expert.');
    });

    it('should handle all custom parameters together', () => {
      const result = buildQwenRequestBody({
        prompt: 'Write a function',
        model: 'qwen-coder-plus',
        maxTokens: 8000,
        temperature: 0.2,
        systemPrompt: 'Expert coder'
      });

      assert.strictEqual(result.model, 'qwen-coder-plus');
      assert.strictEqual(result.parameters.max_tokens, 8000);
      assert.strictEqual(result.parameters.temperature, 0.2);
      assert.strictEqual(result.input.messages[0].content, 'Expert coder');
      assert.strictEqual(result.input.messages[1].content, 'Write a function');
    });

    it('should always have exactly 2 messages', () => {
      const result = buildQwenRequestBody({ prompt: 'Test' });

      assert.strictEqual(result.input.messages.length, 2);
      assert.strictEqual(result.input.messages[0].role, 'system');
      assert.strictEqual(result.input.messages[1].role, 'user');
    });
  });

  describe('buildQwenRequestOptions', () => {
    it('should build correct HTTP options', () => {
      const result = buildQwenRequestOptions('test-api-key');

      assert.strictEqual(result.hostname, 'dashscope.aliyuncs.com');
      assert.strictEqual(result.port, 443);
      assert.strictEqual(result.path, '/api/v1/services/aigc/text-generation/generation');
      assert.strictEqual(result.method, 'POST');
    });

    it('should include correct headers', () => {
      const result = buildQwenRequestOptions('my-secret-key');

      assert.strictEqual(result.headers['Content-Type'], 'application/json');
      assert.strictEqual(result.headers['Authorization'], 'Bearer my-secret-key');
      assert.strictEqual(result.headers['X-DashScope-SSE'], 'disable');
    });

    it('should use HTTPS (port 443)', () => {
      const result = buildQwenRequestOptions('key');

      assert.strictEqual(result.port, 443);
    });
  });

  describe('parseQwenResponse', () => {
    it('should parse successful response with choices format', () => {
      const data = JSON.stringify({
        output: {
          choices: [{ message: { content: 'Hello world!' } }]
        },
        usage: { total_tokens: 10 },
        request_id: 'req-123'
      });

      const result = parseQwenResponse(data, 'qwen-turbo');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.model, 'qwen-turbo');
      assert.strictEqual(result.content, 'Hello world!');
      assert.deepStrictEqual(result.usage, { total_tokens: 10 });
      assert.strictEqual(result.requestId, 'req-123');
    });

    it('should parse response with text format (fallback)', () => {
      const data = JSON.stringify({
        output: {
          text: 'Direct text response'
        },
        request_id: 'req-456'
      });

      const result = parseQwenResponse(data, 'qwen-plus');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.content, 'Direct text response');
    });

    it('should prefer choices format over text', () => {
      const data = JSON.stringify({
        output: {
          choices: [{ message: { content: 'From choices' } }],
          text: 'From text'
        }
      });

      const result = parseQwenResponse(data, 'qwen-turbo');

      assert.strictEqual(result.content, 'From choices');
    });

    it('should throw on API error response', () => {
      const data = JSON.stringify({
        code: 'InvalidParameter',
        message: 'The model parameter is invalid.'
      });

      assert.throws(
        () => parseQwenResponse(data, 'qwen-turbo'),
        /Qwen API Error: InvalidParameter - The model parameter is invalid/
      );
    });

    it('should handle empty usage gracefully', () => {
      const data = JSON.stringify({
        output: {
          text: 'Response'
        }
      });

      const result = parseQwenResponse(data, 'qwen-turbo');

      assert.deepStrictEqual(result.usage, {});
    });

    it('should return raw response for unexpected format', () => {
      const rawData = '{"unexpected": "format"}';

      const result = parseQwenResponse(rawData, 'qwen-turbo');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.raw, true);
      assert.strictEqual(result.content, rawData);
    });

    it('should throw on invalid JSON', () => {
      assert.throws(
        () => parseQwenResponse('not json', 'qwen-turbo'),
        /SyntaxError|Unexpected token/
      );
    });

    it('should handle missing request_id', () => {
      const data = JSON.stringify({
        output: { text: 'Response' }
      });

      const result = parseQwenResponse(data, 'qwen-turbo');

      assert.strictEqual(result.requestId, undefined);
    });

    it('should handle empty choices array', () => {
      const data = JSON.stringify({
        output: {
          choices: [],
          text: 'Fallback text'
        }
      });

      const result = parseQwenResponse(data, 'qwen-turbo');

      // Should fall back to text when choices[0] is undefined
      assert.strictEqual(result.content, 'Fallback text');
    });
  });

  describe('listQwenModels', () => {
    it('should return all 5 models', () => {
      const result = listQwenModels(true);

      assert.strictEqual(result.models.length, 5);
    });

    it('should include qwen-turbo model', () => {
      const result = listQwenModels(true);
      const turbo = result.models.find(m => m.id === 'qwen-turbo');

      assert.ok(turbo);
      assert.strictEqual(turbo.tokens, '8K context');
    });

    it('should include qwen-coder-plus model', () => {
      const result = listQwenModels(true);
      const coder = result.models.find(m => m.id === 'qwen-coder-plus');

      assert.ok(coder);
      assert.strictEqual(coder.tokens, '128K context');
      assert.ok(coder.description.toLowerCase().includes('code'));
    });

    it('should include qwen-max-longcontext model', () => {
      const result = listQwenModels(true);
      const longContext = result.models.find(m => m.id === 'qwen-max-longcontext');

      assert.ok(longContext);
      assert.strictEqual(longContext.tokens, '1M context');
    });

    it('should show configured when API key present', () => {
      const result = listQwenModels(true);

      assert.strictEqual(result.configured, true);
      assert.strictEqual(result.note, 'API key configured');
    });

    it('should show not configured when API key missing', () => {
      const result = listQwenModels(false);

      assert.strictEqual(result.configured, false);
      assert.strictEqual(result.note, 'Requires ALIBABA_API_KEY in environment');
    });

    it('should have all required fields for each model', () => {
      const result = listQwenModels(true);

      for (const model of result.models) {
        assert.ok(model.id, 'Model should have id');
        assert.ok(model.description, 'Model should have description');
        assert.ok(model.tokens, 'Model should have tokens');
      }
    });

    it('should have unique model ids', () => {
      const result = listQwenModels(true);
      const ids = result.models.map(m => m.id);
      const uniqueIds = [...new Set(ids)];

      assert.strictEqual(ids.length, uniqueIds.length);
    });
  });

  describe('buildCodeGenerationPrompt', () => {
    it('should build prompt without context', () => {
      const result = buildCodeGenerationPrompt({
        task: 'Write a function to add two numbers'
      });

      assert.strictEqual(result.prompt, 'Write a function to add two numbers');
      assert.ok(result.systemPrompt.includes('javascript'));
    });

    it('should build prompt with context', () => {
      const result = buildCodeGenerationPrompt({
        task: 'Add error handling',
        context: 'function divide(a, b) { return a / b; }'
      });

      assert.ok(result.prompt.includes('Context:'));
      assert.ok(result.prompt.includes('function divide'));
      assert.ok(result.prompt.includes('Task: Add error handling'));
    });

    it('should use specified language in system prompt', () => {
      const result = buildCodeGenerationPrompt({
        task: 'Write a class',
        language: 'python'
      });

      assert.ok(result.systemPrompt.includes('python'));
      assert.ok(!result.systemPrompt.includes('javascript'));
    });

    it('should use javascript as default language', () => {
      const result = buildCodeGenerationPrompt({
        task: 'Write code'
      });

      assert.ok(result.systemPrompt.includes('javascript'));
    });

    it('should include instruction to only output code', () => {
      const result = buildCodeGenerationPrompt({
        task: 'Write code'
      });

      assert.ok(result.systemPrompt.includes('Only output the code'));
    });

    it('should handle empty context as no context', () => {
      const result = buildCodeGenerationPrompt({
        task: 'Write a test',
        context: ''
      });

      // Empty context should NOT include "Context:" prefix
      assert.strictEqual(result.prompt, 'Write a test');
    });

    it('should handle various languages', () => {
      const languages = ['typescript', 'rust', 'go', 'java', 'c++'];

      for (const lang of languages) {
        const result = buildCodeGenerationPrompt({
          task: 'Write code',
          language: lang
        });

        assert.ok(result.systemPrompt.includes(lang), `Should include ${lang}`);
      }
    });
  });

  describe('validateCompletionParams', () => {
    it('should validate correct params', () => {
      const result = validateCompletionParams({
        prompt: 'Hello'
      });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should reject missing prompt', () => {
      const result = validateCompletionParams({});

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('prompt')));
    });

    it('should reject non-string prompt', () => {
      const result = validateCompletionParams({
        prompt: 123
      });

      assert.strictEqual(result.valid, false);
    });

    it('should reject invalid maxTokens', () => {
      const result = validateCompletionParams({
        prompt: 'Test',
        maxTokens: -1
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('maxTokens')));
    });

    it('should reject invalid temperature', () => {
      const result = validateCompletionParams({
        prompt: 'Test',
        temperature: 5
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('temperature')));
    });

    it('should accept valid temperature at boundaries', () => {
      const result0 = validateCompletionParams({
        prompt: 'Test',
        temperature: 0
      });
      const result2 = validateCompletionParams({
        prompt: 'Test',
        temperature: 2
      });

      assert.strictEqual(result0.valid, true);
      assert.strictEqual(result2.valid, true);
    });

    it('should reject null params', () => {
      const result = validateCompletionParams(null);

      assert.strictEqual(result.valid, false);
    });

    it('should reject non-object params', () => {
      const result = validateCompletionParams('string');

      assert.strictEqual(result.valid, false);
    });

    it('should allow optional parameters to be omitted', () => {
      const result = validateCompletionParams({
        prompt: 'Just a prompt'
      });

      assert.strictEqual(result.valid, true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long prompts', () => {
      const longPrompt = 'a'.repeat(100000);
      const result = buildQwenRequestBody({ prompt: longPrompt });

      assert.strictEqual(result.input.messages[1].content.length, 100000);
    });

    it('should handle unicode in prompts', () => {
      const unicodePrompt = '你好世界 🌍 مرحبا';
      const result = buildQwenRequestBody({ prompt: unicodePrompt });

      assert.strictEqual(result.input.messages[1].content, unicodePrompt);
    });

    it('should handle special characters in prompts', () => {
      const specialPrompt = 'Code: `const x = "test\\n"` && more';
      const result = buildQwenRequestBody({ prompt: specialPrompt });

      assert.strictEqual(result.input.messages[1].content, specialPrompt);
    });

    it('should handle temperature at 0 (deterministic)', () => {
      const result = buildQwenRequestBody({
        prompt: 'Test',
        temperature: 0
      });

      assert.strictEqual(result.parameters.temperature, 0);
    });

    it('should handle multiline prompts', () => {
      const multilinePrompt = `Line 1
Line 2
Line 3`;
      const result = buildQwenRequestBody({ prompt: multilinePrompt });

      assert.ok(result.input.messages[1].content.includes('\n'));
    });

    it('should handle code generation with complex context', () => {
      const result = buildCodeGenerationPrompt({
        task: 'Add authentication',
        language: 'typescript',
        context: `
import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('Hello'));
        `.trim()
      });

      assert.ok(result.prompt.includes('import express'));
      assert.ok(result.prompt.includes('Task: Add authentication'));
      assert.ok(result.systemPrompt.includes('typescript'));
    });
  });

  describe('API Error Handling', () => {
    it('should parse rate limit error', () => {
      const data = JSON.stringify({
        code: 'Throttling',
        message: 'Request rate limit exceeded'
      });

      assert.throws(
        () => parseQwenResponse(data, 'qwen-turbo'),
        /Throttling.*rate limit/
      );
    });

    it('should parse authentication error', () => {
      const data = JSON.stringify({
        code: 'InvalidApiKey',
        message: 'The API key is invalid.'
      });

      assert.throws(
        () => parseQwenResponse(data, 'qwen-turbo'),
        /InvalidApiKey/
      );
    });

    it('should parse quota exceeded error', () => {
      const data = JSON.stringify({
        code: 'QuotaExceeded',
        message: 'Your account quota has been exceeded.'
      });

      assert.throws(
        () => parseQwenResponse(data, 'qwen-turbo'),
        /QuotaExceeded/
      );
    });

    it('should preserve model in error context', () => {
      const data = JSON.stringify({
        output: { text: 'Success' }
      });

      const result = parseQwenResponse(data, 'qwen-max');

      assert.strictEqual(result.model, 'qwen-max');
    });
  });

  describe('Model Selection', () => {
    it('should use qwen-turbo for fast tasks', () => {
      const result = buildQwenRequestBody({
        prompt: 'Quick question',
        model: 'qwen-turbo'
      });

      assert.strictEqual(result.model, 'qwen-turbo');
    });

    it('should use qwen-coder-plus for code generation', () => {
      // Simulating what qwenCodeGeneration does
      const codeGenParams = buildCodeGenerationPrompt({
        task: 'Write a sort function',
        language: 'javascript'
      });

      const result = buildQwenRequestBody({
        ...codeGenParams,
        model: 'qwen-coder-plus',
        maxTokens: 4000,
        temperature: 0.3
      });

      assert.strictEqual(result.model, 'qwen-coder-plus');
      assert.strictEqual(result.parameters.max_tokens, 4000);
      assert.strictEqual(result.parameters.temperature, 0.3);
    });

    it('should use qwen-max-longcontext for large codebases', () => {
      const result = buildQwenRequestBody({
        prompt: 'Analyze this large codebase...',
        model: 'qwen-max-longcontext'
      });

      assert.strictEqual(result.model, 'qwen-max-longcontext');
    });
  });
});
