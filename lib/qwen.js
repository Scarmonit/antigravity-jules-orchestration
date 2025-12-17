/**
 * Alibaba Qwen Model Integration
 * Provides access to Qwen LLM models via DashScope API
 */

import https from 'https';

const QWEN_ENDPOINT = 'dashscope.aliyuncs.com';
const QWEN_PATH = '/api/v1/services/aigc/text-generation/generation';

/**
 * Call Qwen API for text generation
 */
export async function qwenCompletion(params) {
    const {
        prompt,
        model = 'qwen-turbo',
        maxTokens = 2000,
        temperature = 0.7,
        systemPrompt = 'You are a helpful coding assistant.'
    } = params;

    const apiKey = process.env.ALIBABA_API_KEY;

    if (!apiKey) {
        throw new Error('ALIBABA_API_KEY not configured. Add it to your .env file.');
    }

    const requestBody = {
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

    return new Promise((resolve, reject) => {
        const options = {
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

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);

                    if (response.output) {
                        resolve({
                            success: true,
                            model: model,
                            content: response.output.choices?.[0]?.message?.content || response.output.text,
                            usage: response.usage || {},
                            requestId: response.request_id
                        });
                    } else if (response.code) {
                        reject(new Error(`Qwen API Error: ${response.code} - ${response.message}`));
                    } else {
                        resolve({
                            success: true,
                            model: model,
                            content: data,
                            raw: true
                        });
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Qwen response: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`Qwen request failed: ${e.message}`));
        });

        req.write(JSON.stringify(requestBody));
        req.end();
    });
}

/**
 * List available Qwen models
 */
export function listQwenModels() {
    return {
        models: [
            { id: 'qwen-turbo', description: 'Fast, cost-effective model for simple tasks', tokens: '8K context' },
            { id: 'qwen-plus', description: 'Balanced performance and quality', tokens: '32K context' },
            { id: 'qwen-max', description: 'Most capable model for complex reasoning', tokens: '32K context' },
            { id: 'qwen-max-longcontext', description: 'Extended context for large codebases', tokens: '1M context' },
            { id: 'qwen-coder-plus', description: 'Specialized for code generation', tokens: '128K context' }
        ],
        configured: !!process.env.ALIBABA_API_KEY,
        note: process.env.ALIBABA_API_KEY ? 'API key configured' : 'Requires ALIBABA_API_KEY in environment'
    };
}

/**
 * Generate code using Qwen
 */
export async function qwenCodeGeneration(params) {
    const { task, language = 'javascript', context = '' } = params;

    const systemPrompt = `You are an expert ${language} developer. Generate clean, well-documented code. 
Only output the code, no explanations unless specifically asked.`;

    const prompt = context
        ? `Context:\n${context}\n\nTask: ${task}`
        : task;

    return qwenCompletion({
        prompt,
        systemPrompt,
        model: 'qwen-coder-plus',
        maxTokens: 4000,
        temperature: 0.3
    });
}
