# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
