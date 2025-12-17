# MCP Server Quick Reference

**Last Updated:** December 1, 2025  
**All Servers:** ✅ OPERATIONAL

---

## 🚨 GETTING ERRORS? RUN THIS FIRST:

```powershell
# Fix all MCP server issues automatically
.\scripts\fix-mcp-servers.ps1

# Then restart your IDE
```

**Common Issue:** ChromaDB not running → Fixed by script above ✅

---

## Quick Status Check

```powershell
# Check ChromaDB (required for self-improvement tools)
docker ps | Select-String chromadb

# Test ChromaDB connection
Test-NetConnection -ComputerName localhost -Port 8000

# View MCP logs in IDE
# IntelliJ: Tools → MCP → View Logs
```

**Note:** Messages in stderr are usually INFO, not errors!

---

## Server Status Summary

✅ **5/5 stdio servers running**  
✅ **1/1 HTTP server operational**  
✅ **ChromaDB connected**  
✅ **32 tools available**

---

## Common Commands

### Start ChromaDB (if stopped)
```powershell
docker start chromadb

# If container doesn't exist:
docker run -d -p 8000:8000 --name chromadb `
  --restart unless-stopped `
  chromadb/chroma:latest
```

### Check All Docker Containers
```powershell
docker ps -a
```

### View ChromaDB Logs
```powershell
docker logs chromadb --tail 50
```

### Restart ChromaDB
```powershell
docker restart chromadb
```

### Stop ChromaDB (if needed)
```powershell
docker stop chromadb
```

---

## MCP Tools Available

### Project Context (3 tools)
- `get_project_info`
- `get_coding_standards`
- `get_file_info`

### Agent Management (7 tools)
- `check_system_status`
- `list_agents`
- `get_agent_instructions`
- `search_agents`
- `apply_agent_context`
- `diagnose_agents`
- `check_datalore_status`

### DevOps Generation (8 tools)
- `create_github_workflow`
- `create_optimized_dockerfile`
- `generate_deployment`
- `setup_prometheus`
- `init_project`
- `create_playbook`
- `health_check`
- `scan_dependencies`

### File Operations (2 tools)
- `read_file`
- `list_directory`

### Code Evolution (5 tools - requires ChromaDB)
- `analyze_codebase`
- `generate_improvements`
- `evolve_system`
- `learn_from_patterns`
- `validate_improvement`

### Jules Sessions (7 tools - HTTP API)
- `jules_list_sources`
- `jules_list_sessions`
- `jules_get_session`
- `jules_create_session` (requires API key)
- `jules_send_message` (requires API key)
- `jules_approve_plan` (requires API key)
- `jules_get_activities`

---

## Troubleshooting

### ChromaDB Connection Error
**Error:** `Failed to connect to chromadb`

**Fix:**
```powershell
# Quick fix (RECOMMENDED)
.\scripts\fix-mcp-servers.ps1

# Manual fix
# Check if running
docker ps | Select-String chromadb

# Start if stopped
docker start chromadb

# If doesn't exist, create it:
docker run -d -p 8000:8000 --name chromadb chromadb/chroma:latest
```

### MCP Server Not Starting
1. Check IDE MCP extension logs
2. Restart IDE
3. Verify server executable paths in MCP config

### Jules API 401 Error
**Fix:**
```powershell
$env:JULES_API_KEY = "your-api-key-here"
```

**📖 Full Troubleshooting Guide:** `docs/MCP_TROUBLESHOOTING.md`

---

## Server Endpoints

| Server | Connection | Endpoint/Port |
|--------|------------|---------------|
| llm-framework-project | stdio | N/A |
| scarmonit-architecture | stdio | N/A |
| llm-framework-devops | stdio | N/A |
| llm-framework-filesystem | stdio | N/A |
| llm-framework-self-improve | stdio + ChromaDB | localhost:8000 |
| jules-orchestration | HTTPS | scarmonit.com |

---

## Health Checks

```powershell
# ChromaDB health
Invoke-RestMethod -Uri http://localhost:8000/api/v1/heartbeat

# Jules API health
Invoke-RestMethod -Uri https://scarmonit.com/health

# Docker containers
docker ps
```

---

## Auto-Start ChromaDB on Boot

```powershell
# Set restart policy
docker update --restart unless-stopped chromadb
```

---

**Status:** ✅ ALL SYSTEMS OPERATIONAL  
**ChromaDB:** ✅ Running on port 8000  
**Total Tools:** 32 available

