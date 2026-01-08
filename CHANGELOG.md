# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [2.6.2] - 2025-01-08

### Removed
- **Dead Code Cleanup**: Removed 7,000+ lines of unused code
  - `lib/qwen.js` - Alibaba Qwen integration (never imported)
  - `lib/temporal-integration.js` - Scheduled sessions feature (not integrated)
  - `middleware/errorHandler.js` - Error handler (never imported)
  - `middleware/rateLimiter.js` - Redis rate limiter (never imported)
  - `middleware/rateLimiterIntegration.js` - Rate limiter wrapper (never imported)
  - `orchestration/` folder - Legacy orchestration code (superseded)
  - `config/rate-limiting.js` - Rate limiter configuration
  - `docs/rate-limiter-documentation.pdf` - Obsolete documentation
  - `scripts/update-docs-pdf.py` - PDF generator for deleted rate limiter
  - Related test files and scripts

### Changed
- Removed `redis` dependency (only used by removed rate limiter)
- Removed `@modelcontextprotocol/sdk` dependency (never imported)
- Removed `zod` dependency (never imported - project uses joi)
- Updated CLAUDE.md architecture diagram
- Updated `.claude/commands/` to remove deleted file references
- Updated docs/deployment/DEPLOYMENT.md with correct dependency list
- Updated docs/reports/MCP_TOOL_ACCESSIBILITY_MATRIX.md with correct dependencies

## [2.6.1] - 2024-12-19

### Added
- **Semantic Memory Integration**: 8 new MCP tools for persistent AI memory
  - `memory_recall_context` - Recall relevant memories for a task
  - `memory_store` - Store a memory manually
  - `memory_search` - Search memories by query
  - `memory_related` - Get memories related to a specific memory
  - `memory_reinforce` - Reinforce successful patterns
  - `memory_forget` - Apply decay to old memories
  - `memory_health` - Check memory service health
  - `memory_maintenance_schedule` - Get maintenance schedule
- **Memory Integration Tests**: 60 comprehensive tests covering SSRF protection, error sanitization, input validation, all MCP tools, and network failure handling
- New `lib/memory-client.js` with security-hardened memory API client

### Security
- SSRF protection with domain whitelist (memory.scarmonit.com, semantic-memory-mcp.onrender.com, localhost)
- IP address blocking to prevent whitelist bypass
- HTTPS enforcement (except localhost for development)
- Error message sanitization to prevent information disclosure
- Input validation with safe defaults for all memory operations

## [2.6.0] - 2024-12-18

### Added
- **Render Auto-Fix Integration**: Automatically detect and fix build failures on Jules PRs
- **Suggested Tasks Scanner**: Proactively scan codebases for TODO/FIXME/HACK comments
- 15 new MCP tools: Render integration (12) + Suggested Tasks (3)
- Secure credential storage with AES-256-GCM encryption
- Build log analysis with intelligent error pattern recognition
- Webhook receiver at `/webhooks/render` for deployment events
- New `lib/encryption.js`, `lib/render-client.js`, `lib/render-autofix.js`, `lib/suggested-tasks.js`
- `SECURITY.md` documentation

## [2.5.1] - 2024-12-17

### Added
- Temporal Agent Integration for scheduled Jules sessions
- New `lib/temporal-integration.js` helper functions
- `scheduled-jules-session.json` template

## [2.5.0] - 2024-12-17

### Added
- 15 new MCP tools: Templates, cloning, search, PR integration, queue, analytics
- Session Templates for reusable configurations
- Priority Queue with priority-based processing
- Session Cloning and Search capabilities
- PR Integration: Merge PRs, add comments directly
- Batch Retry for failed sessions
- Analytics Dashboard with success rates and trends
- New slash commands: `/templates`, `/queue`, `/analytics`

## [2.3.0] - 2024-12-17

### Added
- Ollama/RAG integration with local LLM support (23 MCP tools total)
- Claude CLI command generator and pattern learning system
- Rate limiter metrics dashboard component with unit tests
- Redis-based rate limiting with fallback to in-memory
- Multi-tier rate limiting for API protection
- Comprehensive test suite (287 tests: 270 backend + 17 dashboard)

### Changed
- Migrated production URL to scarmonit.com
- Updated test configuration for proper backend (node:test) and dashboard (vitest) runners
- Made GitHub Actions JULES_API_KEY check non-blocking (runtime validation is authoritative)
- Enhanced WebSocket heartbeat mechanism for connection health monitoring

### Fixed
- CRITICAL: Webhook signature bypass vulnerability
- CRITICAL: Path traversal vulnerability in file operations
- HIGH: Fixed duplicate HEARTBEAT_INTERVAL declaration causing ES module errors
- HIGH: Addressed security vulnerabilities from PR #9 review
- Fixed React production build test compatibility issues

### Security
- Implemented webhook signature verification with timing-safe comparison
- Added path traversal prevention with strict path validation
- Enhanced CORS configuration for production domains
- Improved rate limiting to prevent abuse

### Performance
- Phase 1: Security hardening and memory optimization
- Phase 2: HIGH priority optimizations for concurrent operations
- Optimized WebSocket connection management with automatic dead connection cleanup

## [1.5.0] - Previous Release

### Features
- Initial MCP server with Jules API integration
- GitHub webhook receiver
- PostgreSQL workflow state management
- React Mission Control dashboard
- Workflow templates for automation

---

For more details, see the [commit history](https://github.com/Scarmingo/antigravity-jules-orchestration/commits/Scarmonit).
