# 🔐 Google Auth Quick Reference Card

## ⚡ Quick Setup (5 Steps)

### 1. Create Google Cloud Project
```
URL: https://console.cloud.google.com/
Project Name: jules-orchestrator
```

### 2. Enable APIs
```
APIs & Services → Library
Search: "Jules API" or "jules.googleapis.com"
Click: Enable
```

### 3. Create Service Account
```
IAM & Admin → Service Accounts
Name: jules-agent
Role: Editor (or Jules API User)
```

### 4. Download JSON Key
```
Click on: jules-agent@...
Keys tab → Add Key → Create new key
Format: JSON
Save file securely (DO NOT commit to Git)
```

### 5. Configure Render
```
Dashboard: https://dashboard.render.com/web/srv-d4mlmna4d50c73ep70sg
Environment tab:
  - DELETE: JULES_API_KEY
  - ADD: GOOGLE_APPLICATION_CREDENTIALS_JSON
  - VALUE: <paste entire JSON file content>
```

---

## 🤖 Automated Setup Helper

If you have the JSON file downloaded:

```powershell
cd C:\Users\scarm\AntigravityProjects\antigravity-jules-orchestration

# Run automation script
.\scripts\configure-google-auth.ps1 -ServiceAccountJsonPath "C:\path\to\your-service-account.json"

# This will:
# ✅ Validate JSON file
# ✅ Show service account details
# ✅ Copy JSON to clipboard
# ✅ Open Render dashboard
```

Then just paste (Ctrl+V) in Render!

---

## ✅ Verification

After Render redeploys:

```bash
# Test health endpoint
curl https://antigravity-jules-orchestration.onrender.com/health

# Expected:
# {
#   "status": "ok",
#   "apiKeyConfigured": true,
#   "timestamp": "2025-12-01T10:20:00.000Z"
# }
```

Check logs for:
```
✅ "Google Auth initialized successfully"
✅ "Using Google Service Account credentials"
```

---

## 📚 Documentation

- **Full Guide**: `GOOGLE_CLOUD_SETUP.md`
- **Original Auth Setup**: `AUTH_SETUP.md`
- **Integration Verification**: `INTEGRATION_VERIFIED.md`

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Jules API not enabled" | Enable Jules API in Google Cloud Console |
| "Invalid credentials" | Verify JSON is complete, regenerate key |
| "Unauthorized" | Check service account has correct role |
| Still using JULES_API_KEY | Delete JULES_API_KEY from Render, redeploy |

---

## 💡 Why Google Auth?

✅ **Secure**: Tokens auto-refresh every hour  
✅ **No manual rotation**: Google handles lifecycle  
✅ **Auditable**: All calls logged in Google Cloud  
✅ **Standard**: Google Cloud IAM best practices  

---

**Estimated Time**: 10-15 minutes  
**Support**: GOOGLE_CLOUD_SETUP.md
