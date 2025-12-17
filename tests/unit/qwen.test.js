/**
 * Unit Tests for Qwen API Integration Module
 * Tests cover: qwenCompletion, listQwenModels, qwenCodeGeneration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import https from 'https';

vi.mock('https');

describe('Qwen Integration Module', () => {
  let mockResponse;
  let mockRequest;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALIBABA_API_KEY = 'test-api-key';

    mockResponse = {
      on: vi.fn(),
      statusCode: 200
    };

    mockRequest = {
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    };
  });

  afterEach(() => {
    delete process.env.ALIBABA_API_KEY;
    vi.restoreAllMocks();
  });

  describe('qwenCompletion()', () => {
    it('should throw error when API key not configured', async () => {
      delete process.env.ALIBABA_API_KEY;

      const { qwenCompletion } = await import('../../lib/qwen.js?' + Math.random());

      await expect(qwenCompletion({ prompt: 'test' })).rejects.toThrow('ALIBABA_API_KEY not configured');
    });

    it('should make request with correct parameters', async () => {
      const { qwenCompletion } = await import('../../lib/qwen.js?' + Math.random());

      https.request = vi.fn().mockImplementation((options, callback) => {
        expect(options.hostname).toBe('dashscope.aliyuncs.com');
        expect(options.path).toBe('/api/v1/services/aigc/text-generation/generation');
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe('Bearer test-api-key');

        mockResponse.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            setTimeout(() => handler(JSON.stringify({
              output: {
                choices: [{ message: { content: 'Generated response' } }]
              },
              usage: { total_tokens: 100 },
              request_id: 'req-123'
            })), 0);
          }
          if (event === 'end') setTimeout(() => handler(), 0);
          return mockResponse;
        });

        mockRequest.end.mockImplementation(() => {
          setTimeout(() => callback(mockResponse), 0);
        });

        return mockRequest;
      });

      const result = await qwenCompletion({
        prompt: 'Write a function',
        model: 'qwen-plus',
        maxTokens: 1000,
        temperature: 0.5
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe('Generated response');
      expect(result.usage.total_tokens).toBe(100);
      expect(result.requestId).toBe('req-123');

      const writtenData = JSON.parse(mockRequest.write.mock.calls[0][0]);
      expect(writtenData.model).toBe('qwen-plus');
      expect(writtenData.input.messages).toHaveLength(2);
      expect(writtenData.parameters.max_tokens).toBe(1000);
      expect(writtenData.parameters.temperature).toBe(0.5);
    });

    it('should use default parameters', async () => {
      const { qwenCompletion } = await import('../../lib/qwen.js?' + Math.random());

      https.request = vi.fn().mockImplementation((options, callback) => {
        mockResponse.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            setTimeout(() => handler(JSON.stringify({
              output: { choices: [{ message: { content: 'Response' } }] }
            })), 0);
          }
          if (event === 'end') setTimeout(() => handler(), 0);
          return mockResponse;
        });

        mockRequest.end.mockImplementation(() => {
          setTimeout(() => callback(mockResponse), 0);
        });

        return mockRequest;
      });

      await qwenCompletion({ prompt: 'test' });

      const writtenData = JSON.parse(mockRequest.write.mock.calls[0][0]);
      expect(writtenData.model).toBe('qwen-turbo');
      expect(writtenData.parameters.max_tokens).toBe(2000);
      expect(writtenData.parameters.temperature).toBe(0.7);
    });

    it('should handle API errors', async () => {
      const { qwenCompletion } = await import('../../lib/qwen.js?' + Math.random());

      https.request = vi.fn().mockImplementation((options, callback) => {
        mockResponse.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            setTimeout(() => handler(JSON.stringify({
              code: 'InvalidApiKey',
              message: 'API key is invalid'
            })), 0);
          }
          if (event === 'end') setTimeout(() => handler(), 0);
          return mockResponse;
        });

        mockRequest.end.mockImplementation(() => {
          setTimeout(() => callback(mockResponse), 0);
        });

        return mockRequest;
      });

      await expect(qwenCompletion({ prompt: 'test' })).rejects.toThrow('Qwen API Error: InvalidApiKey');
    });

    it('should handle network errors', async () => {
      const { qwenCompletion } = await import('../../lib/qwen.js?' + Math.random());

      https.request = vi.fn().mockImplementation((options, callback) => {
        mockRequest.on.mockImplementation((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Network failure')), 0);
          }
          return mockRequest;
        });

        return mockRequest;
      });

      await expect(qwenCompletion({ prompt: 'test' })).rejects.toThrow('Qwen request failed: Network failure');
    });

    it('should handle alternative response format', async () => {
      const { qwenCompletion } = await import('../../lib/qwen.js?' + Math.random());

      https.request = vi.fn().mockImplementation((options, callback) => {
        mockResponse.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            setTimeout(() => handler(JSON.stringify({
              output: { text: 'Direct text response' }
            })), 0);
          }
          if (event === 'end') setTimeout(() => handler(), 0);
          return mockResponse;
        });

        mockRequest.end.mockImplementation(() => {
          setTimeout(() => callback(mockResponse), 0);
        });

        return mockRequest;
      });

      const result = await qwenCompletion({ prompt: 'test' });

      expect(result.content).toBe('Direct text response');
    });
  });

  describe('listQwenModels()', () => {
    it('should return available models', () => {
      // eslint-disable-next-line no-undef
      const { listQwenModels } = require('../../lib/qwen.js');

      const result = listQwenModels();

      expect(result.models).toBeDefined();
      expect(result.models.length).toBeGreaterThan(0);
      expect(result.models[0]).toHaveProperty('id');
      expect(result.models[0]).toHaveProperty('description');
      expect(result.models[0]).toHaveProperty('tokens');
    });

    it('should show API key configured status', () => {
      process.env.ALIBABA_API_KEY = 'my-key';
      // eslint-disable-next-line no-undef
      const { listQwenModels } = require('../../lib/qwen.js');

      const result = listQwenModels();

      expect(result.configured).toBe(true);
      expect(result.note).toContain('API key configured');
    });

    it('should show API key not configured', () => {
      delete process.env.ALIBABA_API_KEY;
      // eslint-disable-next-line no-undef
      const { listQwenModels } = require('../../lib/qwen.js');

      const result = listQwenModels();

      expect(result.configured).toBe(false);
      expect(result.note).toContain('Requires ALIBABA_API_KEY');
    });

    it('should include all model types', () => {
      // eslint-disable-next-line no-undef
      const { listQwenModels } = require('../../lib/qwen.js');

      const result = listQwenModels();

      const modelIds = result.models.map((m) => m.id);
      expect(modelIds).toContain('qwen-turbo');
      expect(modelIds).toContain('qwen-plus');
      expect(modelIds).toContain('qwen-max');
      expect(modelIds).toContain('qwen-coder-plus');
    });
  });

  describe('qwenCodeGeneration()', () => {
    it('should generate code with task and language', async () => {
      const { qwenCodeGeneration } = await import('../../lib/qwen.js?' + Math.random());

      https.request = vi.fn().mockImplementation((options, callback) => {
        mockResponse.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            setTimeout(() => handler(JSON.stringify({
              output: { choices: [{ message: { content: 'def hello():\n    pass' } }] }
            })), 0);
          }
          if (event === 'end') setTimeout(() => handler(), 0);
          return mockResponse;
        });

        mockRequest.end.mockImplementation(() => {
          setTimeout(() => callback(mockResponse), 0);
        });

        return mockRequest;
      });

      const result = await qwenCodeGeneration({
        task: 'Create a hello function',
        language: 'python'
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('def hello()');

      const writtenData = JSON.parse(mockRequest.write.mock.calls[0][0]);
      expect(writtenData.model).toBe('qwen-coder-plus');
      expect(writtenData.parameters.temperature).toBe(0.3);
      expect(writtenData.parameters.max_tokens).toBe(4000);
    });

    it('should include context when provided', async () => {
      const { qwenCodeGeneration } = await import('../../lib/qwen.js?' + Math.random());

      https.request = vi.fn().mockImplementation((options, callback) => {
        mockResponse.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            setTimeout(() => handler(JSON.stringify({
              output: { choices: [{ message: { content: 'code' } }] }
            })), 0);
          }
          if (event === 'end') setTimeout(() => handler(), 0);
          return mockResponse;
        });

        mockRequest.end.mockImplementation(() => {
          setTimeout(() => callback(mockResponse), 0);
        });

        return mockRequest;
      });

      await qwenCodeGeneration({
        task: 'Add logging',
        language: 'javascript',
        context: 'function process() { return data; }'
      });

      const writtenData = JSON.parse(mockRequest.write.mock.calls[0][0]);
      const userMessage = writtenData.input.messages[1].content;
      expect(userMessage).toContain('Context:');
      expect(userMessage).toContain('function process()');
      expect(userMessage).toContain('Task: Add logging');
    });

    it('should use default javascript language', async () => {
      const { qwenCodeGeneration } = await import('../../lib/qwen.js?' + Math.random());

      https.request = vi.fn().mockImplementation((options, callback) => {
        mockResponse.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            setTimeout(() => handler(JSON.stringify({
              output: { choices: [{ message: { content: 'code' } }] }
            })), 0);
          }
          if (event === 'end') setTimeout(() => handler(), 0);
          return mockResponse;
        });

        mockRequest.end.mockImplementation(() => {
          setTimeout(() => callback(mockResponse), 0);
        });

        return mockRequest;
      });

      await qwenCodeGeneration({ task: 'Create function' });

      const writtenData = JSON.parse(mockRequest.write.mock.calls[0][0]);
      const systemMessage = writtenData.input.messages[0].content;
      expect(systemMessage).toContain('javascript');
    });
  });
});
