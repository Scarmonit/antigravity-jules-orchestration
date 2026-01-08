# Slash Commands Reference

**Version 2.6.2** | antigravity-jules-orchestration

Quick reference for all available slash commands in the Jules orchestration system.

## Core Commands

### `/status`
Get a comprehensive overview of all Jules sessions, system health, and orchestration status.

```bash
/status
```

**Output:**
- Active sessions with state
- Session statistics (total, completed, in progress, failed)
- System health (circuit breaker, cache, rate limits)
- Quick action suggestions

---

### `/quick-fix [file] [description]`
Fast, streamlined workflow for single-file fixes using Jules autonomous coding.

```bash
/quick-fix src/api/auth.js "Add rate limiting to login endpoint"
/quick-fix lib/utils.ts "Fix TypeScript type error on line 45"
```

**Features:**
- Auto-selects repository
- Creates focused session
- Skips plan approval for speed
- Auto-creates PR

---

### `/session [id] [action]`
Quick session management for Jules coding sessions.

```bash
/session                           # List recent sessions
/session ses_abc123                # View session details
/session ses_abc123 approve        # Approve session plan
/session ses_abc123 cancel         # Cancel session
/session ses_abc123 diff           # View code changes
/session ses_abc123 retry          # Retry failed session
```

**Actions:** `view` (default), `approve`, `cancel`, `retry`, `diff`

---

### `/batch [label] [repo?]`
Quick batch session creation from GitHub issue labels.

```bash
/batch jules-auto                  # Process all "jules-auto" labeled issues
/batch bug my-repo                 # Process "bug" labeled issues in my-repo
/batch enhancement                 # Process enhancement requests
```

**Common Labels:**
- `jules-auto` - Auto-process with Jules
- `bug` - Bug fixes
- `enhancement` - Feature enhancements
- `security` - Security fixes

---

## Workflow Commands

### `/audit`
Run a comprehensive parallel audit of the entire repository.

```bash
/audit
```

**Parallel Agents:**
1. Security Audit - vulnerabilities, secrets, auth patterns
2. Code Quality Review - error handling, async patterns, style
3. Dependency Analysis - outdated, vulnerabilities, unused
4. API Endpoint Review - validation, status codes, rate limiting
5. Documentation Completeness - accuracy, coverage

---

### `/deploy-check`
Pre-deployment validation with live health checks.

```bash
/deploy-check
```

**Checks:**
- Git status (uncommitted changes)
- All tests passing
- No high/critical vulnerabilities
- Health endpoint responding
- All services configured

---

### `/implement-feature [description]`
Feature implementation workflow with planning.

```bash
/implement-feature "Add webhook retry mechanism with exponential backoff"
```

**Steps:**
1. Analyze requirements
2. Create implementation plan
3. Generate code with Jules
4. Create tests
5. Update documentation

---

### `/fix-issues`
Auto-diagnose and fix common issues.

```bash
/fix-issues
```

**Fixes:**
- TypeScript errors
- Linting issues
- Failing tests
- Outdated dependencies
- Missing imports

---

## Security & Testing

### `/security [scope]`
Dedicated security scanning.

```bash
/security                # Full security audit
/security quick          # Fast critical-only scan
/security deps           # Dependency vulnerabilities
/security secrets        # Secret/credential scan
/security api            # API endpoint security
```

**Scope Options:**
- `full` - Complete security audit (default)
- `quick` - Critical issues only
- `deps` - npm audit
- `secrets` - Credential scanning
- `api` - Endpoint security testing

---

### `/test [scope] [options]`
Run all tests with coverage and detailed reporting.

```bash
/test                     # Run all tests
/test backend             # Backend only (270 tests)
/test dashboard           # Dashboard only (17 tests)
/test all --coverage      # With coverage report
```

**Scope:** `all` (default), `backend`, `dashboard`, `unit`, `integration`

---

## Utility Commands

### `/learn-pattern [name] [task] [details]`
Save a successful command pattern to memory for future reference.

```bash
/learn-pattern rate-limit-bypass "Testing rate limits" "Use 5 parallel requests with 100ms delay"
```

---

### `/generate-command [description]`
Generate optimized Claude CLI commands using best practices.

```bash
/generate-command "Refactor the authentication module to use JWT"
```

---

## Quick Reference Table

| Command | Purpose | Example |
|---------|---------|---------|
| `/status` | System overview | `/status` |
| `/quick-fix` | Fast single-file fix | `/quick-fix file.js "fix bug"` |
| `/session` | Session management | `/session abc123 approve` |
| `/batch` | Batch from labels | `/batch jules-auto` |
| `/audit` | Full audit | `/audit` |
| `/deploy-check` | Pre-deploy validation | `/deploy-check` |
| `/implement-feature` | Feature workflow | `/implement-feature "add X"` |
| `/fix-issues` | Auto-fix problems | `/fix-issues` |
| `/security` | Security scan | `/security quick` |
| `/test` | Run tests | `/test all` |
| `/learn-pattern` | Save pattern | `/learn-pattern name task cmd` |
| `/generate-command` | Generate command | `/generate-command "task"` |

---

## Recommended Workflows

### Daily Development
```
1. /status              - Check orchestration state
2. /quick-fix           - Make targeted fixes
3. /test                - Verify changes
4. /deploy-check        - Pre-deployment validation
```

### Batch Processing
```
1. /batch jules-auto    - Process labeled issues
2. /status              - Monitor progress
3. /session [id]        - Review individual sessions
4. /session [id] approve - Approve plans
```

### Security Review
```
1. /security quick      - Fast critical scan
2. /security deps       - Check dependencies
3. /audit               - Full comprehensive audit
4. /fix-issues          - Auto-fix what's possible
```

### Feature Implementation
```
1. /implement-feature   - Plan and implement
2. /test                - Verify tests pass
3. /security            - Security check
4. /deploy-check        - Ready for deployment
```

---

## MCP Tools Integration

These commands leverage the 30 MCP tools available:

**Jules Core:** `jules_list_sources`, `jules_create_session`, `jules_list_sessions`, `jules_get_session`, `jules_send_message`, `jules_approve_plan`, `jules_get_activities`

**Session Management:** `jules_cancel_session`, `jules_retry_session`, `jules_get_diff`, `jules_delete_session`, `jules_cancel_all_active`

**Batch Processing:** `jules_create_from_issue`, `jules_batch_from_labels`, `jules_batch_create`, `jules_batch_status`, `jules_batch_approve_all`, `jules_list_batches`

**Monitoring:** `jules_monitor_all`, `jules_session_timeline`

**Cache:** `jules_cache_stats`, `jules_clear_cache`

**Ollama LLM:** `ollama_list_models`, `ollama_completion`, `ollama_code_generation`, `ollama_chat`

**RAG:** `ollama_rag_index`, `ollama_rag_query`, `ollama_rag_status`, `ollama_rag_clear`
