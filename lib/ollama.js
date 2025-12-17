/**
 * Ollama Local LLM Integration
 * Provides access to local LLM models via Ollama API
 */

import http from 'http';

// Parse OLLAMA_HOST which may be a full URL like http://127.0.0.1:11434
function parseOllamaHost() {
  const hostEnv = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
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

const { hostname: OLLAMA_HOST, port: OLLAMA_PORT } = parseOllamaHost();

/**
 * Call Ollama API for text generation using local LLM models
 * @param {Object} params - Completion parameters
 * @param {string} params.prompt - Text prompt
 * @param {string} [params.model='qwen2.5-coder:7b'] - Model name
 * @param {string} [params.systemPrompt='You are a helpful coding assistant.'] - System prompt
 * @param {boolean} [params.stream=false] - Enable streaming
 * @returns {Promise<Object>} Completion result with success, model, content, done
 * @throws {Error} If Ollama is not running or request fails
 */
export async function ollamaCompletion(params) {
  const {
    prompt,
    model = 'qwen2.5-coder:7b',
    systemPrompt = 'You are a helpful coding assistant.',
    stream = false
  } = params;

  const requestBody = {
    model: model,
    prompt: prompt,
    system: systemPrompt,
    stream: stream,
    options: {
      temperature: 0.7,
      num_predict: 2000
    }
  };

  return new Promise((resolve, reject) => {
    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            success: true,
            model: model,
            content: response.response,
            done: response.done,
            totalDuration: response.total_duration,
            evalCount: response.eval_count
          });
        } catch (e) {
          reject(new Error(`Failed to parse Ollama response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Ollama request failed: ${e.message}. Is Ollama running?`));
    });

    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

/**
 * List available Ollama models installed on local machine
 * @returns {Promise<Object>} Models list with success flag, models array, ollamaRunning status
 */
export async function listOllamaModels() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/tags',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            success: true,
            models: response.models?.map((m) => ({
              name: m.name,
              size: m.size,
              modifiedAt: m.modified_at,
              family: m.details?.family
            })) || [],
            ollamaRunning: true
          });
        } catch (e) {
          reject(new Error(`Failed to parse models list: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        success: false,
        models: [],
        ollamaRunning: false,
        error: `Ollama not running: ${e.message}`
      });
    });

    req.end();
  });
}

/**
 * Generate code using Ollama with optimized prompt for code generation
 * @param {Object} params - Code generation parameters
 * @param {string} params.task - Code generation task description
 * @param {string} [params.language='javascript'] - Programming language
 * @param {string} [params.context=''] - Additional context
 * @returns {Promise<Object>} Generated code with metadata
 * @throws {Error} If Ollama is not running or generation fails
 */
export async function ollamaCodeGeneration(params) {
  const { task, language = 'javascript', context = '' } = params;

  const systemPrompt = `You are an expert ${language} developer. Generate clean, well-documented code. 
Only output the code, no explanations unless specifically asked.`;

  const prompt = context
    ? `Context:\n${context}\n\nTask: ${task}`
    : task;

  return ollamaCompletion({
    prompt,
    systemPrompt,
    model: 'qwen2.5-coder:7b'
  });
}

/**
 * Chat with Ollama for multi-turn conversations
 * @param {Object} params - Chat parameters
 * @param {Array<Object>} params.messages - Array of message objects with role and content
 * @param {string} [params.model='qwen2.5-coder:7b'] - Model name
 * @returns {Promise<Object>} Chat response with success, model, message
 * @throws {Error} If Ollama is not running or chat fails
 */
export async function ollamaChat(params) {
  const {
    messages,
    model = 'qwen2.5-coder:7b'
  } = params;

  const requestBody = {
    model: model,
    messages: messages,
    stream: false
  };

  return new Promise((resolve, reject) => {
    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            success: true,
            model: model,
            message: response.message,
            done: response.done
          });
        } catch (e) {
          reject(new Error(`Failed to parse chat response: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Ollama chat failed: ${e.message}. Is Ollama running?`));
    });

    req.write(JSON.stringify(requestBody));
    req.end();
  });
}
