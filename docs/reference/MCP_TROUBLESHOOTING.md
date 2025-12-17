# MCP Server Troubleshooting Guide

**Last Updated:** December 1, 2025  
**Purpose:** Resolve common MCP server errors and warnings

---

## 🎯 READ THIS FIRST!

### Most "Errors" Are Actually NORMAL ✅

**If you're seeing these messages - DON'T WORRY, they're SUCCESS messages:**

```
[server stderr] Loaded 4 agent persona(s)
[server stderr] DevOps MCP server started
[server stderr] Filesystem MCP server running
[server stderr] Project Context MCP server running on stdio
Connection state: Running
```

**These are INFO logs, NOT errors!** Your IDE shows them as "warnings" because they come from stderr, but this is how the servers log successful startup.

### The ONLY Real Error

**This is the only actual error you might see:**

```
[llm-framework-self-improve] ERROR: Failed to connect to chromadb
Connection state: Stopped
```

**Impact:** You lose 5 self-improvement tools, but 27 other tools still work perfectly!

**Fix Options:**
- **OPTION 1:** Ignore it (you have 84% of tools working) ✅ RECOMMENDED
- **OPTION 2:** Start Docker Desktop + run `.\scripts\fix-mcp-servers.ps1`

---

## Common Errors & Solutions

### 1. ChromaDB Connection Error ✅ SOLVED

**Error Message:**
```
[llm-framework-self-improve] ERROR: Failed to connect to chromadb
MCP error -32000: Connection closed
```

**Root Cause:** ChromaDB container not running

**Solution:**
```powershell
# Run the fix script (RECOMMENDED)
.\scripts\fix-mcp-servers.ps1

# OR manually:
docker run -d -p 8000:8000 --name chromadb --restart unless-stopped chromadb/chroma:latest
```

**Verify Fix:**
```powershell
docker ps | Select-String chromadb
Test-NetConnection -ComputerName localhost -Port 8000
```

---

### 2. Server Warnings (Normal Behavior)

**Warning Messages:**
```
[scarmonit-architecture][server stderr] Loaded 4 agent persona(s)
[llm-framework-devops][server stderr] DevOps MCP server started
[llm-framework-filesystem][server stderr] Filesystem MCP server running
```

**Status:** ✅ **NOT ERRORS - These are normal info logs**

These "warnings" are actually informational messages from the servers. The IDE marks them as warnings because they come from stderr, but they indicate successful startup.

**What they mean:**
- `Loaded 4 agent persona(s)` = Agents loaded successfully ✅
- `DevOps MCP server started` = Server running ✅  
- `Filesystem MCP server running` = Server operational ✅

**Action Required:** None - servers are working correctly

---

### 3. Connection State Messages (Normal)

**Messages:**
```
[llm-framework-project] Connection state: Running
[scarmonit-architecture] Connection state: Running
[llm-framework-devops] Connection state: Running
```

**Status:** ✅ **GOOD - Servers connected successfully**

These indicate successful connections. You should see "Running" for all servers.

---

### 4. Docker Not Running

**Error:**
```
Cannot connect to Docker daemon
```

**Solution:**
1. Start Docker Desktop
2. Wait for whale icon in system tray to stop animating
3. Run: `.\scripts\fix-mcp-servers.ps1`
4. Restart IDE

---

### 5. Port 8000 Already in Use

**Error:**
```
Port 8000 is already allocated
```

**Solution:**
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Stop the process or use different port
# Then recreate ChromaDB
docker rm -f chromadb
docker run -d -p 8001:8000 --name chromadb chromadb/chroma:latest
```

**Note:** If using port 8001, update your MCP config to use `http://localhost:8001`

---

### 6. Jules API 401 Unauthorized

**Error:**
```
jules_create_session: 401 Unauthorized
```

**Solution:**
```powershell
# Set your API key
$env:JULES_API_KEY = "your-api-key-here"

# Or create .env file:
@"
JULES_API_KEY=your-api-key-here
"@ | Out-File -FilePath .env -Encoding UTF8
```

**Note:** Read operations (list_sources, get_session, get_activities) don't require API key

---

### 7. MCP Server Crashes on Startup

**Symptoms:**
- Server shows "Stopped" immediately after "Starting"
- Error in IDE logs

**Solution:**
```powershell
# Check IDE MCP logs for specific error
# Common fixes:

# 1. Restart IDE
# 2. Clear MCP cache (if option available)
# 3. Verify server paths in MCP config
# 4. Check Node.js is installed (for stdio servers)
node --version  # Should show v18+
```

---

### 8. Server Shows "Stopped" After Running

**For llm-framework-self-improve only:**

This happens if ChromaDB isn't running. Use the fix script:
```powershell
.\scripts\fix-mcp-servers.ps1
```

Then restart your IDE.

---

## Quick Diagnostic Commands

### Check All Servers
```powershell
# View IDE logs
# IntelliJ: Tools → MCP → View Logs
# Look for "Connection state: Running" for each server
```

### Check ChromaDB
```powershell
# Is it running?
docker ps | Select-String chromadb

# Test connection
Invoke-RestMethod -Uri http://localhost:8000/api/v1/heartbeat

# View logs
docker logs chromadb --tail 50
```

### Check Docker
```powershell
# Is Docker running?
docker version

# Check all containers
docker ps -a
```

---

## Expected Normal Output

When all servers are working correctly, you should see:

```
[llm-framework-project] Connection state: Running ✅
[scarmonit-architecture] Connection state: Running ✅
[scarmonit-architecture][stderr] Loaded 4 agent persona(s) ✅
[llm-framework-devops] Connection state: Running ✅
[llm-framework-filesystem] Connection state: Running ✅
[llm-framework-self-improve] Connection state: Running ✅
```

**Note:** stderr messages are NORMAL - they're info logs, not errors!

---

## Server Health Checklist

Use this to verify all servers are healthy:

- [ ] Docker Desktop is running
- [ ] ChromaDB container is running (`docker ps | Select-String chromadb`)
- [ ] Port 8000 is accessible (`Test-NetConnection localhost -Port 8000`)
- [ ] IDE shows 5/5 stdio servers with "Running" state
- [ ] Jules API is reachable (HTTP server, always available)
- [ ] No actual ERROR messages (warnings are OK)

---

## When to Restart

**Restart IDE if:**
- You just started ChromaDB
- MCP servers show "Stopped"
- You changed MCP configuration
- Servers were working but stopped

**Restart ChromaDB if:**
- Connection errors persist
- Port 8000 not responding
- After Docker Desktop restart

**Run fix script if:**
- ChromaDB won't start
- Multiple errors after IDE restart
- You're unsure what's wrong

---

## Getting Help

If issues persist after running `.\scripts\fix-mcp-servers.ps1`:

1. **Check IDE MCP Logs:**
   - IntelliJ: Tools → MCP → View Logs
   - Look for actual ERROR (not warning) messages

2. **Verify ChromaDB:**
   ```powershell
   docker logs chromadb --tail 50
   ```

3. **Check Documentation:**
   - `docs/MCP_SERVER_STATUS.md` - Detailed server info
   - `docs/MCP_QUICK_REFERENCE.md` - Common commands
   - `docs/MCP_VALIDATION_REPORT.md` - Complete validation

4. **Run Validation:**
   ```powershell
   .\scripts\validate-jules-chain.ps1
   ```

---

## Summary

**Most "errors" you're seeing are likely:**
1. ✅ Normal stderr info messages (not actual errors)
2. ✅ ChromaDB connection issue (fixed by running `fix-mcp-servers.ps1`)
3. ✅ Server startup messages (indicates success)

**Action Items:**
1. Run: `.\scripts\fix-mcp-servers.ps1`
2. Restart your IDE
3. Verify all servers show "Running"
4. Ignore stderr warnings (they're info logs)

---

**Status:** Most issues are resolved by ensuring ChromaDB is running and restarting IDE.

**Quick Fix:** `.\scripts\fix-mcp-servers.ps1` + Restart IDE = ✅ All Working

