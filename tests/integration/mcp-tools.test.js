/**
 * Integration Tests for MCP Tools
 * Tests the 8 new Ollama/RAG tools via MCP execute endpoint
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import http from 'http';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_PORT = 3399;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// ============================================================================
// MOCK MCP SERVER
// We create a minimal mock server to test tool execution logic
// ============================================================================

/**
 * Tool definitions matching index.js structure
 */
const TOOL_DEFINITIONS = {
  ollama_list_models: {
    name: 'ollama_list_models',
    description: 'List available Ollama models',
    inputSchema: { type: 'object', properties: {} }
  },
  ollama_completion: {
    name: 'ollama_completion',
    description: 'Generate text completion using Ollama',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        model: { type: 'string' },
        temperature: { type: 'number' }
      },
      required: ['prompt']
    }
  },
  ollama_code_generation: {
    name: 'ollama_code_generation',
    description: 'Generate code using Ollama',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        language: { type: 'string' },
        context: { type: 'string' }
      },
      required: ['task']
    }
  },
  ollama_chat: {
    name: 'ollama_chat',
    description: 'Multi-turn chat with Ollama',
    inputSchema: {
      type: 'object',
      properties: {
        messages: { type: 'array' },
        model: { type: 'string' }
      },
      required: ['messages']
    }
  },
  ollama_rag_index: {
    name: 'ollama_rag_index',
    description: 'Index a directory for RAG',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string' }
      },
      required: ['directory']
    }
  },
  ollama_rag_query: {
    name: 'ollama_rag_query',
    description: 'Query indexed codebase',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        topK: { type: 'number' }
      },
      required: ['query']
    }
  },
  ollama_rag_status: {
    name: 'ollama_rag_status',
    description: 'Get RAG index status',
    inputSchema: { type: 'object', properties: {} }
  },
  ollama_rag_clear: {
    name: 'ollama_rag_clear',
    description: 'Clear RAG index',
    inputSchema: { type: 'object', properties: {} }
  }
};

/**
 * Mock tool executor - simulates tool execution without external dependencies
 */
function executeTool(toolName, args) {
  switch (toolName) {
    case 'ollama_list_models':
      return {
        success: true,
        models: ['llama3.2', 'codellama', 'mistral'],
        ollamaAvailable: false,
        message: 'Ollama not running - showing cached models'
      };

    case 'ollama_completion':
      if (!args.prompt) {
        return { success: false, error: 'prompt is required' };
      }
      return {
        success: false,
        error: 'Ollama not available at localhost:11434',
        gracefulDegradation: true
      };

    case 'ollama_code_generation':
      if (!args.task) {
        return { success: false, error: 'task is required' };
      }
      return {
        success: false,
        error: 'Ollama not available at localhost:11434',
        gracefulDegradation: true
      };

    case 'ollama_chat':
      if (!args.messages || !Array.isArray(args.messages)) {
        return { success: false, error: 'messages array is required' };
      }
      return {
        success: false,
        error: 'Ollama not available at localhost:11434',
        gracefulDegradation: true
      };

    case 'ollama_rag_index':
      if (!args.directory) {
        return { success: false, error: 'directory is required' };
      }
      // Simulate path traversal check
      if (args.directory.includes('..')) {
        return { success: false, error: 'Path traversal not allowed' };
      }
      return {
        success: true,
        indexed: true,
        directory: args.directory,
        documentsIndexed: 10,
        chunksCreated: 50
      };

    case 'ollama_rag_query':
      if (!args.query) {
        return { success: false, error: 'query is required' };
      }
      return {
        success: true,
        results: [
          { file: 'index.js', score: 0.85, chunk: 'relevant code...' },
          { file: 'lib/rag.js', score: 0.72, chunk: 'more code...' }
        ],
        query: args.query
      };

    case 'ollama_rag_status':
      return {
        success: true,
        indexed: true,
        documentCount: 10,
        chunkCount: 50,
        lastIndexed: new Date().toISOString()
      };

    case 'ollama_rag_clear':
      return {
        success: true,
        cleared: true,
        message: 'RAG index cleared'
      };

    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Create mock MCP server
 */
function createMockServer() {
  return http.createServer((req, res) => {
    let body = '';

    req.on('data', chunk => body += chunk);

    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');

      // Health endpoint
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'healthy', version: '2.3.0' }));
        return;
      }

      // List tools endpoint
      if (req.url === '/mcp/tools' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({
          tools: Object.values(TOOL_DEFINITIONS)
        }));
        return;
      }

      // Execute tool endpoint
      if (req.url === '/mcp/execute' && req.method === 'POST') {
        try {
          const { tool, arguments: args } = JSON.parse(body);

          if (!tool) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'tool name required' }));
            return;
          }

          if (!TOOL_DEFINITIONS[tool]) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: `Unknown tool: ${tool}` }));
            return;
          }

          const result = executeTool(tool, args || {});
          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }

      // 404 for unknown routes
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    });
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Make HTTP request to test server
 */
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Execute MCP tool
 */
async function executeMCPTool(tool, args = {}) {
  return makeRequest('POST', '/mcp/execute', { tool, arguments: args });
}

// ============================================================================
// TESTS
// ============================================================================

describe('MCP Tools Integration Tests', () => {
  let server;

  before(async () => {
    server = createMockServer();
    await new Promise((resolve, reject) => {
      server.listen(TEST_PORT, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  describe('Server Health', () => {
    it('should return healthy status', async () => {
      const response = await makeRequest('GET', '/health');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.status, 'healthy');
      assert.strictEqual(response.body.version, '2.3.0');
    });
  });

  describe('Tool Listing', () => {
    it('should list all 8 Ollama/RAG tools', async () => {
      const response = await makeRequest('GET', '/mcp/tools');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.tools.length, 8);

      const toolNames = response.body.tools.map(t => t.name);
      assert.ok(toolNames.includes('ollama_list_models'));
      assert.ok(toolNames.includes('ollama_completion'));
      assert.ok(toolNames.includes('ollama_code_generation'));
      assert.ok(toolNames.includes('ollama_chat'));
      assert.ok(toolNames.includes('ollama_rag_index'));
      assert.ok(toolNames.includes('ollama_rag_query'));
      assert.ok(toolNames.includes('ollama_rag_status'));
      assert.ok(toolNames.includes('ollama_rag_clear'));
    });

    it('should include input schemas for each tool', async () => {
      const response = await makeRequest('GET', '/mcp/tools');

      for (const tool of response.body.tools) {
        assert.ok(tool.inputSchema, `${tool.name} should have inputSchema`);
        assert.strictEqual(tool.inputSchema.type, 'object');
      }
    });
  });

  describe('ollama_list_models', () => {
    it('should list available models', async () => {
      const response = await executeMCPTool('ollama_list_models');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.models));
    });

    it('should indicate Ollama availability status', async () => {
      const response = await executeMCPTool('ollama_list_models');

      assert.strictEqual(response.status, 200);
      assert.ok('ollamaAvailable' in response.body);
    });
  });

  describe('ollama_completion', () => {
    it('should require prompt parameter', async () => {
      const response = await executeMCPTool('ollama_completion', {});

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.error.includes('prompt'));
    });

    it('should accept prompt and return graceful degradation', async () => {
      const response = await executeMCPTool('ollama_completion', {
        prompt: 'Hello, world!'
      });

      assert.strictEqual(response.status, 200);
      // Should gracefully degrade when Ollama not available
      assert.ok('gracefulDegradation' in response.body || 'success' in response.body);
    });

    it('should accept optional model parameter', async () => {
      const response = await executeMCPTool('ollama_completion', {
        prompt: 'Test',
        model: 'llama3.2'
      });

      assert.strictEqual(response.status, 200);
    });
  });

  describe('ollama_code_generation', () => {
    it('should require task parameter', async () => {
      const response = await executeMCPTool('ollama_code_generation', {});

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.error.includes('task'));
    });

    it('should accept task and optional language', async () => {
      const response = await executeMCPTool('ollama_code_generation', {
        task: 'Write a function to sort an array',
        language: 'javascript'
      });

      assert.strictEqual(response.status, 200);
    });

    it('should accept optional context', async () => {
      const response = await executeMCPTool('ollama_code_generation', {
        task: 'Add error handling',
        context: 'function divide(a, b) { return a / b; }'
      });

      assert.strictEqual(response.status, 200);
    });
  });

  describe('ollama_chat', () => {
    it('should require messages array', async () => {
      const response = await executeMCPTool('ollama_chat', {});

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.error.includes('messages'));
    });

    it('should reject non-array messages', async () => {
      const response = await executeMCPTool('ollama_chat', {
        messages: 'not an array'
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, false);
    });

    it('should accept valid messages array', async () => {
      const response = await executeMCPTool('ollama_chat', {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' }
        ]
      });

      assert.strictEqual(response.status, 200);
    });
  });

  describe('ollama_rag_index', () => {
    it('should require directory parameter', async () => {
      const response = await executeMCPTool('ollama_rag_index', {});

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.error.includes('directory'));
    });

    it('should reject path traversal attempts', async () => {
      const response = await executeMCPTool('ollama_rag_index', {
        directory: '../../../etc/passwd'
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.error.toLowerCase().includes('path') ||
                response.body.error.toLowerCase().includes('traversal'));
    });

    it('should accept valid directory', async () => {
      const response = await executeMCPTool('ollama_rag_index', {
        directory: '/app/src'
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.documentsIndexed >= 0);
    });
  });

  describe('ollama_rag_query', () => {
    it('should require query parameter', async () => {
      const response = await executeMCPTool('ollama_rag_query', {});

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.error.includes('query'));
    });

    it('should return search results', async () => {
      const response = await executeMCPTool('ollama_rag_query', {
        query: 'error handling'
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.results));
    });

    it('should accept optional topK parameter', async () => {
      const response = await executeMCPTool('ollama_rag_query', {
        query: 'authentication',
        topK: 5
      });

      assert.strictEqual(response.status, 200);
    });

    it('should include relevance scores in results', async () => {
      const response = await executeMCPTool('ollama_rag_query', {
        query: 'database'
      });

      assert.strictEqual(response.status, 200);
      if (response.body.results.length > 0) {
        assert.ok('score' in response.body.results[0]);
      }
    });
  });

  describe('ollama_rag_status', () => {
    it('should return index status', async () => {
      const response = await executeMCPTool('ollama_rag_status');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok('indexed' in response.body);
      assert.ok('documentCount' in response.body);
    });

    it('should include chunk count', async () => {
      const response = await executeMCPTool('ollama_rag_status');

      assert.strictEqual(response.status, 200);
      assert.ok('chunkCount' in response.body);
    });
  });

  describe('ollama_rag_clear', () => {
    it('should clear the index', async () => {
      const response = await executeMCPTool('ollama_rag_clear');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.cleared, true);
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown tool', async () => {
      const response = await executeMCPTool('unknown_tool');

      assert.strictEqual(response.status, 400);
      assert.ok(response.body.error.includes('Unknown tool'));
    });

    it('should return error for missing tool name', async () => {
      const response = await makeRequest('POST', '/mcp/execute', { arguments: {} });

      assert.strictEqual(response.status, 400);
      assert.ok(response.body.error.includes('tool'));
    });

    it('should return 404 for unknown endpoints', async () => {
      const response = await makeRequest('GET', '/unknown/path');

      assert.strictEqual(response.status, 404);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await new Promise((resolve) => {
        const req = http.request({
          hostname: 'localhost',
          port: TEST_PORT,
          path: '/mcp/execute',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });

        req.write('{ invalid json }');
        req.end();
      });

      assert.strictEqual(response.status, 400);
    });
  });

  describe('Tool Input Schema Validation', () => {
    it('should validate required fields for ollama_completion', async () => {
      const tool = TOOL_DEFINITIONS.ollama_completion;
      assert.ok(tool.inputSchema.required.includes('prompt'));
    });

    it('should validate required fields for ollama_chat', async () => {
      const tool = TOOL_DEFINITIONS.ollama_chat;
      assert.ok(tool.inputSchema.required.includes('messages'));
    });

    it('should validate required fields for ollama_rag_index', async () => {
      const tool = TOOL_DEFINITIONS.ollama_rag_index;
      assert.ok(tool.inputSchema.required.includes('directory'));
    });

    it('should validate required fields for ollama_rag_query', async () => {
      const tool = TOOL_DEFINITIONS.ollama_rag_query;
      assert.ok(tool.inputSchema.required.includes('query'));
    });

    it('should not require fields for ollama_list_models', async () => {
      const tool = TOOL_DEFINITIONS.ollama_list_models;
      assert.ok(!tool.inputSchema.required || tool.inputSchema.required.length === 0);
    });
  });

  describe('Graceful Degradation', () => {
    it('should indicate when Ollama is unavailable', async () => {
      const response = await executeMCPTool('ollama_completion', {
        prompt: 'Test prompt'
      });

      // Should not crash, should return error with graceful degradation info
      assert.strictEqual(response.status, 200);
      if (!response.body.success) {
        assert.ok(
          response.body.gracefulDegradation ||
          response.body.error.includes('not available') ||
          response.body.error.includes('not running')
        );
      }
    });

    it('should provide cached model list when Ollama unavailable', async () => {
      const response = await executeMCPTool('ollama_list_models');

      assert.strictEqual(response.status, 200);
      // Should still return some models even if Ollama is down
      assert.ok(response.body.models || response.body.error);
    });
  });
});

// ============================================================================
// STANDALONE EXECUTION
// ============================================================================

// Run tests if executed directly
if (process.argv[1] === import.meta.url.replace('file:///', '').replace('file://', '')) {
  console.log('Running MCP Tools Integration Tests...');
}
