# Jules Orchestration Server

Node.js Express application acting as an MCP server for Jules API integration. Includes robust RAG (Retrieval-Augmented Generation), parallel batch processing, and Redis-backed rate limiting.

## Features

- **MCP Integration**: Model Context Protocol server for seamless LLM integration.
- **RAG Engine**: Index and search local codebase for context-aware responses.
    - **Persistence**: Index is saved to `.jules/rag-index.json` to survive restarts.
    - **Scalability**: Batched indexing and efficient search.
- **Batch Processing**: Parallel execution of Jules sessions with automated cleanup.
- **Rate Limiting**: Distributed token bucket algorithm using Redis with local LRU failover.
- **Dashboard**: React-based monitoring dashboard.

## Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Server**:
   ```bash
   npm run dev
   ```

3. **Run Tests**:
   - Unit: `npm run test:unit`
   - Integration: `npm run test:integration` (Requires Redis)

## Configuration

- **RAG**: Indexing respects `.gitignore` and `excludePatterns`.
- **Rate Limiting**: Configure tiers in `middleware/rateLimiter.js` or via environment variables.

## Documentation

- **Optimizations**:
    - `lib/rag.js`: Optimized similarity search and persistent index.
    - `lib/batch.js`: Automated memory cleanup for old batches.
    - `middleware/rateLimiter.js`: Uses `lru-cache` for efficient failover.

## Security

- Path traversal protection in RAG.
- Secure API key handling.
- Sanitized logging.
