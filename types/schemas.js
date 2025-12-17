/**
 * Zod Validation Schemas
 * Centralized type-safe validation for MCP tools, API requests, and configurations
 */

import { z } from 'zod';

// ============ ENVIRONMENT VARIABLES ============

export const envSchema = z.object({
  JULES_API_KEY: z.string().min(1, 'JULES_API_KEY is required'),
  GITHUB_TOKEN: z.string().optional(),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3323'),
  DATABASE_URL: z.string().url().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OLLAMA_HOST: z.string().default('http://127.0.0.1:11434'),
  ALIBABA_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

// ============ JULES API SCHEMAS ============

export const julesSessionConfigSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  source: z.string().min(1, 'Source is required').regex(/^sources\/github\/[\w-]+\/[\w-]+$/, 'Source must be in format: sources/github/owner/repo'),
  branch: z.string().optional(),
  title: z.string().max(200).optional(),
  requirePlanApproval: z.boolean().optional().default(false),
  automationMode: z.enum(['AUTO_CREATE_PR', 'NONE']).optional().default('AUTO_CREATE_PR')
});

export const sessionIdSchema = z.string().min(1, 'Session ID is required');

export const messageSchema = z.object({
  sessionId: sessionIdSchema,
  message: z.string().min(1, 'Message cannot be empty')
});

// ============ GITHUB INTEGRATION SCHEMAS ============

export const githubIssueParamsSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  issueNumber: z.number().int().positive('Issue number must be a positive integer'),
  autoApprove: z.boolean().optional().default(false),
  automationMode: z.enum(['AUTO_CREATE_PR', 'NONE']).optional().default('AUTO_CREATE_PR')
});

export const githubLabelParamsSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  label: z.string().min(1, 'Label is required'),
  autoApprove: z.boolean().optional().default(false),
  parallel: z.number().int().positive().max(10).optional().default(3)
});

// ============ BATCH PROCESSING SCHEMAS ============

export const batchTaskSchema = z.object({
  prompt: z.string().min(1),
  source: z.string().min(1),
  title: z.string().optional(),
  requirePlanApproval: z.boolean().optional(),
  automationMode: z.enum(['AUTO_CREATE_PR', 'NONE']).optional()
});

export const batchCreateSchema = z.object({
  tasks: z.array(batchTaskSchema).min(1, 'At least one task is required').max(20, 'Maximum 20 tasks per batch'),
  parallel: z.number().int().positive().max(10).optional().default(3)
});

export const batchIdSchema = z.string().min(1, 'Batch ID is required');

// ============ OLLAMA SCHEMAS ============

export const ollamaCompletionSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  model: z.string().optional().default('qwen2.5-coder:7b'),
  systemPrompt: z.string().optional().default('You are a helpful coding assistant.'),
  stream: z.boolean().optional().default(false)
});

export const ollamaCodeGenerationSchema = z.object({
  task: z.string().min(1, 'Task description is required'),
  language: z.string().optional().default('javascript'),
  context: z.string().optional().default('')
});

export const ollamaChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1)
});

export const ollamaChatSchema = z.object({
  messages: z.array(ollamaChatMessageSchema).min(1, 'At least one message is required'),
  model: z.string().optional().default('qwen2.5-coder:7b')
});

// ============ RAG SCHEMAS ============

export const ragIndexDirectorySchema = z.object({
  directory: z.string().min(1, 'Directory path is required'),
  maxFiles: z.number().int().positive().max(1000).optional().default(100),
  extensions: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional()
});

export const ragQuerySchema = z.object({
  query: z.string().min(1, 'Query is required'),
  model: z.string().optional().default('qwen2.5-coder:7b'),
  topK: z.number().int().positive().max(20).optional().default(5)
});

// ============ QWEN SCHEMAS ============

export const qwenCompletionSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  model: z.enum(['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext', 'qwen-coder-plus']).optional().default('qwen-turbo'),
  maxTokens: z.number().int().positive().max(8000).optional().default(2000),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  systemPrompt: z.string().optional().default('You are a helpful coding assistant.')
});

export const qwenCodeGenerationSchema = z.object({
  task: z.string().min(1, 'Task description is required'),
  language: z.string().optional().default('javascript'),
  context: z.string().optional().default('')
});

// ============ API REQUEST SCHEMAS ============

export const mcpExecuteRequestSchema = z.object({
  tool: z.string().min(1, 'Tool name is required'),
  parameters: z.record(z.any()).optional().default({})
});

// ============ RESPONSE SCHEMAS ============

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    statusCode: z.number().optional(),
    requestId: z.string().optional()
  })
});

export const successResponseSchema = z.object({
  success: z.literal(true),
  result: z.any()
});

// ============ CIRCUIT BREAKER SCHEMA ============

export const circuitBreakerConfigSchema = z.object({
  failures: z.number().int().min(0),
  lastFailure: z.number().nullable(),
  threshold: z.number().int().positive().default(5),
  resetTimeout: z.number().int().positive().default(60000)
});

// ============ RATE LIMIT SCHEMA ============

export const rateLimitConfigSchema = z.object({
  windowMs: z.number().int().positive().default(60000),
  maxRequests: z.number().int().positive().default(100)
});

// ============ TYPE EXPORTS FOR JSDOC ============

/**
 * @typedef {z.infer<typeof envSchema>} EnvConfig
 * @typedef {z.infer<typeof julesSessionConfigSchema>} JulesSessionConfig
 * @typedef {z.infer<typeof githubIssueParamsSchema>} GitHubIssueParams
 * @typedef {z.infer<typeof githubLabelParamsSchema>} GitHubLabelParams
 * @typedef {z.infer<typeof batchTaskSchema>} BatchTask
 * @typedef {z.infer<typeof batchCreateSchema>} BatchCreateParams
 * @typedef {z.infer<typeof ollamaCompletionSchema>} OllamaCompletionParams
 * @typedef {z.infer<typeof ollamaCodeGenerationSchema>} OllamaCodeGenParams
 * @typedef {z.infer<typeof ollamaChatSchema>} OllamaChatParams
 * @typedef {z.infer<typeof ragIndexDirectorySchema>} RagIndexParams
 * @typedef {z.infer<typeof ragQuerySchema>} RagQueryParams
 * @typedef {z.infer<typeof qwenCompletionSchema>} QwenCompletionParams
 * @typedef {z.infer<typeof mcpExecuteRequestSchema>} McpExecuteRequest
 */

// ============ VALIDATION HELPERS ============

/**
 * Validate and parse data with a Zod schema
 * @template T
 * @param {z.ZodSchema<T>} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @returns {T} Parsed and validated data
 * @throws {z.ZodError} If validation fails
 */
export function validate(schema, data) {
  return schema.parse(data);
}

/**
 * Safe validation that returns success/error result
 * @template T
 * @param {z.ZodSchema<T>} schema - Zod schema to validate against
 * @param {unknown} data - Data to validate
 * @returns {{ success: true, data: T } | { success: false, error: z.ZodError }} Validation result
 */
export function safeValidate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Format Zod validation errors for API responses
 * @param {z.ZodError} error - Zod validation error
 * @returns {Object} Formatted error object
 */
export function formatValidationError(error) {
  return {
    message: 'Validation failed',
    errors: error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  };
}
