# 🎯 HOW TO USE YOUR APPLICATION

**Application:** Antigravity Jules Orchestration  
**Version:** 1.5.0  
**Port:** 3000  
**Status:** ✅ Running

---

## ⚡ QUICK VALIDATION (Run These First!)

Verify everything is working with these quick tests:

### 1. Validation Suite (Fastest - 8 checks in ~2s)
```powershell
.\scripts\validate-jules-chain.ps1
```
Should print: **8/8 PASSED**

### 2. Logger Test (Zero config required)
```powershell
npm run test:logger              # JSON format
LOG_FORMAT=pretty npm run test:logger   # Human-readable
```

### 3. MCP Status Check
```powershell
Invoke-RestMethod http://localhost:3000/api/v1/mcp/status
```
Should show: **5 servers, 25 tools, all operational**

### 4. ChromaDB Health (Optional)
```powershell
Invoke-RestMethod http://localhost:8000/api/v1/heartbeat
```

**✅ If all pass, your MCP Tool Chain is 100% operational!**

---

## 🚀 QUICK START

Your application is running at: **http://localhost:3000**

---

## 📍 METHOD 1: WEB BROWSER (Easiest)

Just open your browser and visit any of these URLs:

### Main Page
```
http://localhost:3000
```
Shows: App info, version, available endpoints, MCP status

### Health Check
```
http://localhost:3000/health
```
Shows: Service health, uptime, timestamp

### Readiness Check
```
http://localhost:3000/ready
```
Shows: Whether the service is ready to receive traffic

### API Info
```
http://localhost:3000/api/v1
```
Shows: API version and available features

### MCP Server Status
```
http://localhost:3000/api/v1/mcp/status
```
Shows: All 5 MCP servers, 25 tools, operational status

---

## 📍 METHOD 2: POWERSHELL

Copy and paste these commands in PowerShell:

### Get App Info
```powershell
Invoke-RestMethod http://localhost:3000
```

**What you'll see:**
```json
{
  "name": "Antigravity Jules Orchestration",
  "version": "1.5.0",
  "description": "MCP server for Jules API integration",
  "status": "operational",
  "endpoints": {
    "health": "/health",
    "ready": "/ready",
    "api": "/api/v1"
  },
  "mcp": {
    "servers": 5,
    "tools": 25,
    "status": "100% operational"
  }
}
```

### Check Health
```powershell
Invoke-RestMethod http://localhost:3000/health
```

**What you'll see:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-01T...",
  "uptime": 123.45,
  "service": "antigravity-jules-orchestration",
  "version": "1.5.0"
}
```

### Get MCP Status
```powershell
Invoke-RestMethod http://localhost:3000/api/v1/mcp/status
```

**What you'll see:**
```json
{
  "servers": {
    "scarmonit-architecture": { "status": "operational", "tools": 7 },
    "llm-framework-project": { "status": "operational", "tools": 3 },
    "llm-framework-filesystem": { "status": "operational", "tools": 2 },
    "llm-framework-devops": { "status": "operational", "tools": 8 },
    "llm-framework-self-improve": { "status": "operational", "tools": 5 }
  },
  "total_tools": 25,
  "infrastructure": "operational"
}
```

### Save Response to File
```powershell
Invoke-RestMethod http://localhost:3000 | ConvertTo-Json -Depth 5 | Out-File app-status.json
```

### Pretty Print Response
```powershell
Invoke-RestMethod http://localhost:3000 | ConvertTo-Json -Depth 3
```

---

## 📍 METHOD 3: CURL (Command Line)

If you have curl installed:

```bash
# Get app info
curl http://localhost:3000

# Check health
curl http://localhost:3000/health

# Get MCP status
curl http://localhost:3000/api/v1/mcp/status

# Pretty print with jq (if installed)
curl http://localhost:3000 | jq
```

---

## 📍 METHOD 4: POSTMAN / INSOMNIA

1. Open Postman or Insomnia
2. Create a new GET request
3. Enter URL: `http://localhost:3000`
4. Click Send
5. View the JSON response

**Endpoints to test:**
- `GET http://localhost:3000`
- `GET http://localhost:3000/health`
- `GET http://localhost:3000/ready`
- `GET http://localhost:3000/api/v1`
- `GET http://localhost:3000/api/v1/mcp/status`

---

## 📍 METHOD 5: PYTHON

```python
import requests

# Get app info
response = requests.get('http://localhost:3000')
print(response.json())

# Check health
health = requests.get('http://localhost:3000/health')
print(f"Status: {health.json()['status']}")
print(f"Uptime: {health.json()['uptime']} seconds")

# Get MCP status
mcp = requests.get('http://localhost:3000/api/v1/mcp/status')
print(f"Total Tools: {mcp.json()['total_tools']}")
print(f"Infrastructure: {mcp.json()['infrastructure']}")
```

---

## 📍 METHOD 6: JAVASCRIPT/NODE.JS

```javascript
// Using fetch (Node.js 18+)
const response = await fetch('http://localhost:3000');
const data = await response.json();
console.log(data);

// Using axios
const axios = require('axios');
const { data } = await axios.get('http://localhost:3000/health');
console.log(`Service is ${data.status}`);
```

---

## 🛠️ CONTAINER MANAGEMENT

### View Logs (Real-Time)
```powershell
docker logs antigravity-jules-test -f
```
Press `Ctrl+C` to stop viewing

### View Last 50 Log Lines
```powershell
docker logs antigravity-jules-test --tail 50
```

### Check Container Status
```powershell
docker ps --filter "name=antigravity-jules-test"
```

### Stop Container
```powershell
docker stop antigravity-jules-test
```

### Start Container
```powershell
docker start antigravity-jules-test
```

### Restart Container
```powershell
docker restart antigravity-jules-test
```

### Remove Container
```powershell
docker rm -f antigravity-jules-test
```

---

## 🎯 PRACTICAL USE CASES

### 1. Health Monitoring Dashboard
Create a simple monitoring loop:
```powershell
while ($true) {
    $health = Invoke-RestMethod http://localhost:3000/health
    Write-Host "$(Get-Date -Format 'HH:mm:ss') - Status: $($health.status) - Uptime: $($health.uptime)s"
    Start-Sleep -Seconds 5
}
```

### 2. Check Before Deployment
```powershell
$response = Invoke-RestMethod http://localhost:3000/health
if ($response.status -eq 'healthy') {
    Write-Host "✅ Service healthy - proceeding with deployment"
} else {
    Write-Host "❌ Service unhealthy - aborting"
}
```

### 3. Integration with Other Services
```powershell
# Get MCP status and send to monitoring system
$mcp = Invoke-RestMethod http://localhost:3000/api/v1/mcp/status
$totalTools = $mcp.total_tools
# Send $totalTools to your monitoring dashboard
```

---

## 📊 WHAT EACH ENDPOINT SHOWS

### `/` (Root)
- Application name and version
- Description
- Available endpoints
- MCP infrastructure status
- Deployment information

### `/health`
- Service health status
- Current timestamp
- Server uptime in seconds
- Service name
- Version number

### `/ready`
- Readiness status (for Kubernetes)
- Current timestamp

### `/api/v1`
- API version
- Status
- Available features list

### `/api/v1/mcp/status`
- All 5 MCP servers with tool counts
- Total tools available (25)
- Infrastructure status
- Last check timestamp

---

## ⚡ QUICK REFERENCE

| Action | Command |
|--------|---------|
| View in browser | Open http://localhost:3000 |
| Get app info | `Invoke-RestMethod http://localhost:3000` |
| Check health | `Invoke-RestMethod http://localhost:3000/health` |
| View logs | `docker logs antigravity-jules-test -f` |
| Stop app | `docker stop antigravity-jules-test` |
| Start app | `docker start antigravity-jules-test` |
| Restart app | `docker restart antigravity-jules-test` |

---

## 🔧 TROUBLESHOOTING

### Application Not Responding?

**Check if container is running:**
```powershell
docker ps --filter "name=antigravity-jules-test"
```

**If not running, start it:**
```powershell
docker start antigravity-jules-test
```

**View logs to see errors:**
```powershell
docker logs antigravity-jules-test --tail 50
```

### Port 3000 Already in Use?

**Find what's using port 3000:**
```powershell
netstat -ano | findstr :3000
```

**Stop the container and use different port:**
```powershell
docker stop antigravity-jules-test
docker rm antigravity-jules-test
docker run -d --name antigravity-jules-test -p 8080:3000 antigravity-jules:latest
# Now use http://localhost:8080
```

---

## 🎉 YOU'RE READY TO USE YOUR APP!

**Start with the simplest method:**
1. Open your browser
2. Go to http://localhost:3000
3. See your app running!

**Then try PowerShell:**
```powershell
Invoke-RestMethod http://localhost:3000
```

**That's it! Your application is live and ready to use!**

---

**📚 For more details, see:**
- DEPLOYMENT_SUCCESS.md
- PRODUCTION_DEPLOYMENT_PACKAGE.md
- deployment/README.md

