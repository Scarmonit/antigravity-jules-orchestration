# 🔍 AUTO-DIAGNOSTICS GUIDE

**Status:** ✅ ENABLED  
**Check Time:** ~0.5 seconds  
**Runs:** Automatically on first script execution per shell session

---

## 🎯 WHAT IS AUTO-DIAGNOSTICS?

Auto-diagnostics is a tiny one-liner that runs **once per PowerShell session** before any MCP script executes. It catches environment problems in ~½ second before they cause script failures.

---

## ✅ WHAT IT CHECKS (4 Quick Tests)

1. **Docker Daemon** - Is Docker running?
2. **ChromaDB** - Is port 8000 accessible? (optional)
3. **Express App** - Is your app responding on port 3000?
4. **Container Status** - Is antigravity-jules-test running?

---

## 🚀 HOW IT WORKS

### Automatic Mode (Already Enabled!)

When you run any MCP script, you'll see:

```
🔍 Quick Environment Check...
  1. Docker daemon... ✅
  2. ChromaDB (port 8000)... ✅
  3. Express app (port 3000)... ✅
  4. Container status... ✅

🟢 Environment OK (4/4 checks passed)
```

Then your script continues normally.

### If Something is Wrong

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

The script **stops immediately**, saving you from cryptic errors later!

---

## 📋 SCRIPTS WITH AUTO-DIAGNOSTICS ENABLED

Auto-diagnostics is now enabled in these key scripts:

✅ `scripts/test-mcp-orchestration.ps1`  
✅ `scripts/test-mcp-chain-jules-session-v3.ps1`  

**The one-liner at the top:**
```powershell
# Auto-diagnostics: runs quick-check on first use in this shell session
if (!$env:AUTO_DIAG) { $env:AUTO_DIAG = 1; &"$PSScriptRoot/quick-check.ps1"; if ($LASTEXITCODE -ne 0) { exit 1 } }
```

---

## 🛠️ MANUAL RUN

You can run diagnostics manually anytime:

```powershell
.\scripts\quick-check.ps1
```

---

## ⚙️ HOW THE ONE-LINER WORKS

```powershell
if (!$env:AUTO_DIAG) {           # Only run if not already checked this session
    $env:AUTO_DIAG = 1;           # Mark as checked
    &"$PSScriptRoot/quick-check.ps1";  # Run diagnostics
    if ($LASTEXITCODE -ne 0) {    # If diagnostics failed
        exit 1                     # Stop the script
    }
}
```

**Key Features:**
- Runs **once per PowerShell session** (not every script)
- Uses `$env:AUTO_DIAG` flag to track if already checked
- Exits immediately if environment is broken
- No overhead on subsequent script runs

---

## 🎨 ADDING TO NEW SCRIPTS

When creating new PowerShell scripts, add this as the **first line** (after param block):

```powershell
#!/usr/bin/env powershell

# Auto-diagnostics: runs quick-check on first use in this shell session
if (!$env:AUTO_DIAG) { $env:AUTO_DIAG = 1; &"$PSScriptRoot/quick-check.ps1"; if ($LASTEXITCODE -ne 0) { exit 1 } }

# Your script starts here
Write-Host "Script is running..."
```

---

## 🌟 GLOBAL POWERSHELL PROFILE (OPTIONAL)

Want auto-diagnostics for **every** PowerShell session?

1. **Find your profile:**
```powershell
$PROFILE
```

2. **Add this line:**
```powershell
# Auto-check MCP environment on shell startup
if (Test-Path "$PSScriptRoot/scripts/quick-check.ps1") {
    if (!$env:AUTO_DIAG) {
        $env:AUTO_DIAG = 1
        &"$PSScriptRoot/scripts/quick-check.ps1"
    }
}
```

Now every new PowerShell window will run diagnostics automatically!

---

## 🔧 CUSTOMIZING CHECKS

Edit `scripts/quick-check.ps1` to add your own checks:

```powershell
# Check 5: Custom check
$checks.Total++
Write-Host "  5. Your custom check... " -NoNewline
try {
    # Your test here
    Write-Host "✅" -ForegroundColor Green
    $checks.Passed++
} catch {
    Write-Host "❌" -ForegroundColor Red
    $checks.Failed++
}
```

---

## 📊 WHAT GETS CHECKED

### 1. Docker Daemon
```powershell
docker ps 2>&1 | Out-Null
```
- **Why:** All MCP tools need Docker
- **Fix:** Start Docker Desktop

### 2. ChromaDB (Optional)
```powershell
Test-NetConnection localhost -Port 8000 -InformationLevel Quiet
```
- **Why:** Self-improvement features need ChromaDB
- **Fix:** `docker-compose up chromadb`
- **Note:** Doesn't fail if missing (optional feature)

### 3. Express App
```powershell
Invoke-WebRequest "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 3
```
- **Why:** Your API needs to be running
- **Fix:** `docker start antigravity-jules-test`

### 4. Container Status
```powershell
docker ps --filter "name=antigravity-jules-test" --format "{{.Status}}"
```
- **Why:** Verifies your app container is up
- **Fix:** `docker start antigravity-jules-test`

---

## 🎯 BENEFITS

### Before Auto-Diagnostics:
```
❌ Running script...
❌ Error: Cannot connect to Docker
❌ Traceback (10 lines of confusing errors)
❌ Script failed after 30 seconds
```

### After Auto-Diagnostics:
```
✅ Quick check (0.5s)
❌ Docker not running
   Quick Fix: Start Docker Desktop
❌ Script stopped immediately
```

**Time Saved:** 29.5 seconds per failed run!  
**Frustration Saved:** Immeasurable! 🎉

---

## 💡 PRO TIPS

### Reset the Check Flag
If you want to force a recheck in the same session:
```powershell
$env:AUTO_DIAG = $null
.\scripts\your-script.ps1  # Will run diagnostics again
```

### Skip Diagnostics (Not Recommended)
```powershell
$env:AUTO_DIAG = 1  # Set flag before running
.\scripts\your-script.ps1  # Will skip diagnostics
```

### See Verbose Output
Diagnostics already show each check, but for more detail:
```powershell
.\scripts\quick-check.ps1 -Verbose
```

---

## 🐛 TROUBLESHOOTING

### "quick-check.ps1 not found"

**Problem:** Script called from wrong directory  
**Fix:** Use `$PSScriptRoot` in the path:
```powershell
&"$PSScriptRoot/quick-check.ps1"
```

### Diagnostics Never Run

**Problem:** `$env:AUTO_DIAG` is already set  
**Fix:** Reset the flag:
```powershell
$env:AUTO_DIAG = $null
```

### False Positives

**Problem:** Check fails but system is actually fine  
**Fix:** Adjust timeout or remove check in `scripts/quick-check.ps1`

---

## 📈 PERFORMANCE

**Check Time:** ~500ms total
- Docker check: ~100ms
- ChromaDB check: ~100ms  
- Express check: ~200ms
- Container check: ~100ms

**Overhead:** Zero after first run (cached in `$env:AUTO_DIAG`)

---

## 🎊 SUCCESS INDICATORS

When everything is working, you'll see:

```
🔍 Quick Environment Check...
  1. Docker daemon... ✅
  2. ChromaDB (port 8000)... ✅
  3. Express app (port 3000)... ✅
  4. Container status... ✅

🟢 Environment OK (4/4 checks passed)

🚀 Starting MCP Tool Chain...
```

Then your script runs normally with confidence that the environment is ready!

---

## 🚀 NEXT STEPS

1. ✅ **Auto-diagnostics is already enabled** in your main scripts
2. ✅ **Run any MCP script** - diagnostics will run automatically
3. ✅ **See instant feedback** if something is wrong
4. ✅ **Add to new scripts** using the one-liner above

---

**Status:** ✅ AUTO-DIAGNOSTICS ACTIVE  
**Time to First Error:** ~0.5s (instead of 30s+)  
**Developer Happiness:** 📈📈📈

**Every script run now starts with a health check. Problems are caught immediately before they waste your time!**

