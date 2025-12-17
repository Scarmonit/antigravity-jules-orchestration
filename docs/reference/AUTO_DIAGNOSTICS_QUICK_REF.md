# 🔍 AUTO-DIAGNOSTICS QUICK REFERENCE

**Status:** ✅ ACTIVE  
**Check Time:** ~0.5s  
**Runs:** Once per PowerShell session

---

## ⚡ QUICK COMMANDS

```powershell
# Run diagnostics manually
.\scripts\quick-check.ps1

# Reset to force recheck
$env:AUTO_DIAG = $null

# Run any MCP script (auto-checks first)
.\scripts\test-mcp-orchestration.ps1
```

---

## ✅ WHAT'S CHECKED

1. **Docker daemon** - Is Docker running?
2. **ChromaDB** - Port 8000 accessible? (optional)
3. **Express app** - Port 3000 responding?
4. **Container** - antigravity-jules-test running?

---

## 🎨 THE ONE-LINER

Add to any new PowerShell script:

```powershell
# Auto-diagnostics: runs quick-check on first use in this shell session
if (!$env:AUTO_DIAG) { $env:AUTO_DIAG = 1; &"$PSScriptRoot/quick-check.ps1"; if ($LASTEXITCODE -ne 0) { exit 1 } }
```

---

## 📖 SUCCESS OUTPUT

```
🔍 Quick Environment Check...
  1. Docker daemon... ✅
  2. ChromaDB (port 8000)... ✅
  3. Express app (port 3000)... ✅
  4. Container status... ✅

🟢 Environment OK (4/4 checks passed)
```

---

## ❌ FAILURE OUTPUT

```
🔍 Quick Environment Check...
  1. Docker daemon... ✅
  2. ChromaDB (port 8000)... ⚠️  (optional)
  3. Express app (port 3000)... ❌

🔴 Auto-diagnostics failed
   Error: Express app not responding on port 3000

   Quick Fixes:
   • Start Docker Desktop
   • Run: docker start antigravity-jules-test
   • Check: docker ps
```

---

## 🚀 ENABLED SCRIPTS

✅ `scripts/test-mcp-orchestration.ps1`  
✅ `scripts/test-mcp-chain-jules-session-v3.ps1`

Add to more scripts using the one-liner above!

---

## 📚 FULL DOCS

- **AUTO_DIAGNOSTICS.md** - Complete guide
- **HOW_TO_USE.md** - Quick validation

---

**Every script run starts with a health check. Problems caught in 0.5s!**

