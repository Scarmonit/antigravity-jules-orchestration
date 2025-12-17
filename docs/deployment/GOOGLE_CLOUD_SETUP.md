# 🔐 Google Cloud Service Account Setup - Step-by-Step Guide

## ✅ What's Already Done

- ✅ Code updated with `google-auth-library` integration
- ✅ `orchestrator-api/package.json` includes Google Auth dependency
- ✅ `orchestrator-api/src/index.js` configured with OAuth2 token injection
- ✅ Fallback to `JULES_API_KEY` for legacy support
- ✅ `AUTH_SETUP.md` documentation created

---

## 🎯 What You Need to Do

### **Critical Next Step**: Create Google Service Account

You need to set up Google Cloud credentials for Jules API authentication.

---

## 📋 Quick Setup Checklist

- [ ] Create Google Cloud Project
- [ ] Enable Jules API (or required Google APIs)
- [ ] Create Service Account
- [ ] Download JSON Key
- [ ] Configure Render Environment Variable
- [ ] Verify Deployment

---

## 🚀 Detailed Setup Instructions

### **Step 1: Create Google Cloud Project**

1. **Go to Google Cloud Console**:
   - URL: https://console.cloud.google.com/

2. **Create New Project**:
   - Click "Select a project" (top navigation bar)
   - Click "New Project"
   - **Project Name**: `jules-orchestrator`
   - **Organization**: (Select your org or leave as "No organization")
   - Click "Create"

3. **Wait for Project Creation**:
   - You'll see a notification when it's ready
   - Select the new project from the dropdown

**Expected Result**: ✅ New project `jules-orchestrator` created

---

### **Step 2: Enable Required APIs**

1. **Navigate to APIs & Services**:
   - From the left menu: `APIs & Services` → `Library`

2. **Search and Enable Jules API**:
   - Search for: `Jules API` or `jules.googleapis.com`
   - Click on the API
   - Click "Enable"

   **Note**: If Jules API is not publicly listed, you may need:
   - Access granted by Google
   - Waitlist approval
   - Alternative: Use Application Default Credentials with your Google account

3. **Enable Additional APIs** (if needed):
   - Google Drive API (if Jules needs file access)
   - Cloud Resource Manager API
   - Identity and Access Management (IAM) API

**Expected Result**: ✅ Jules API enabled for your project

---

### **Step 3: Create Service Account**

1. **Navigate to Service Accounts**:
   - From left menu: `IAM & Admin` → `Service Accounts`

2. **Create Service Account**:
   - Click "Create Service Account"
   
   **Service Account Details**:
   - **Name**: `jules-agent`
   - **ID**: `jules-agent` (auto-populated)
   - **Description**: `Service account for Jules API orchestration`
   - Click "Create and Continue"

3. **Grant Permissions**:
   - **Role**: Select one of:
     - `Editor` (broad access - for development)
     - `Jules API User` (if specific role exists)
     - Custom role with Jules permissions
   - Click "Continue"

4. **Grant Users Access** (Optional):
   - Skip this step (click "Done")

**Expected Result**: ✅ Service account `jules-agent@jules-orchestrator.iam.gserviceaccount.com` created

---

### **Step 4: Generate JSON Key**

1. **Access Service Account**:
   - Click on the `jules-agent@...` email in the service accounts list

2. **Create Key**:
   - Go to the "Keys" tab
   - Click "Add Key" → "Create new key"

3. **Download JSON Key**:
   - **Key Type**: Select "JSON"
   - Click "Create"
   - File will download: `jules-orchestrator-xxxxx.json`

4. **Save Securely**:
   - Move to safe location
   - **DO NOT** commit to Git
   - **DO NOT** share publicly

**Expected Result**: ✅ JSON key file downloaded

---

### **Step 5: Configure Render Environment**

#### **Option A: Using Render Dashboard (Recommended)**

1. **Open Render Service**:
   - Go to: https://dashboard.render.com/web/srv-d4mlmna4d50c73ep70sg

2. **Navigate to Environment**:
   - Click on "Environment" tab in left sidebar

3. **Remove Legacy API Key**:
   - Find `JULES_API_KEY` variable
   - Click "Delete" button
   - Confirm deletion

4. **Add Google Credentials**:
   - Click "Add Environment Variable"
   - **Key**: `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   - **Value**: Open your downloaded JSON file, copy **entire content**
   - Click "Save Changes"

5. **Verify Configuration**:
   - Ensure variable shows up in the list
   - Value should be truncated (for security)

**Expected Result**: ✅ `GOOGLE_APPLICATION_CREDENTIALS_JSON` set in Render

#### **Option B: Using Render CLI (Alternative)**

```bash
# Install Render CLI (if not installed)
npm install -g render-cli

# Login
render login

# Set environment variable
render env set GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat jules-orchestrator-xxxxx.json)" \
  --service srv-d4mlmna4d50c73ep70sg

# Remove old API key
render env delete JULES_API_KEY --service srv-d4mlmna4d50c73ep70sg
```

---

### **Step 6: Trigger Deployment**

1. **Auto-Deploy**:
   - Render will automatically redeploy when environment variables change
   - Watch the "Events" tab: https://dashboard.render.com/web/srv-d4mlmna4d50c73ep70sg/events

2. **Manual Deploy** (if needed):
   - Click "Manual Deploy" → "Deploy latest commit"

**Expected Result**: ✅ Service redeploying with new credentials

---

### **Step 7: Verify Authentication**

Once deployment completes, test the service:

```bash
# Test health endpoint
curl https://scarmonit.com/health

# Expected response:
# {
#   "status": "ok",
#   "apiKeyConfigured": true,  # Should still be true (Google Auth active)
#   "timestamp": "2025-12-01T10:15:00.000Z"
# }
```

**Check Logs** (if issues):
```bash
# Via Render Dashboard
https://dashboard.render.com/web/srv-d4mlmna4d50c73ep70sg/logs

# Look for:
# ✅ "Google Auth initialized successfully"
# ✅ "Using Google Service Account credentials"
# ❌ "Failed to initialize Google Auth" (troubleshoot if seen)
```

---

## 🔧 Troubleshooting

### **Issue**: "Jules API not found"
**Solution**: 
- Verify Jules API is enabled in Google Cloud Console
- Check you have access/permissions to Jules API
- Contact Google for API access if needed

### **Issue**: "Invalid credentials"
**Solution**:
- Verify JSON key is complete and valid JSON
- Check service account has correct permissions
- Regenerate key if corrupted

### **Issue**: "Unauthorized" errors in logs
**Solution**:
- Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set correctly
- Check service account has `Jules API User` role
- Review IAM permissions in Google Cloud Console

### **Issue**: Service still using `JULES_API_KEY`
**Solution**:
- Confirm `JULES_API_KEY` is deleted from Render
- Check `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set
- Redeploy the service manually

---

## 📊 How It Works

### **Authentication Flow**:

```
1. Service Starts
   ↓
2. Initialize GoogleAuth with JSON credentials
   ↓
3. For each Jules API request:
   - Get fresh OAuth2 token (auto-refreshed)
   - Inject as "Authorization: Bearer <token>" header
   - Send request to jules.googleapis.com
   ↓
4. Google validates token → Jules API responds
```

### **Code Implementation**:

In `orchestrator-api/src/index.js`:

```javascript
// Initialize Google Auth
const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

// Axios interceptor
axios.interceptors.request.use(async (config) => {
  if (config.url.includes('jules.googleapis.com')) {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    config.headers.Authorization = `Bearer ${token.token}`;
  }
  return config;
});
```

---

## 🎯 What Happens After Setup

### **Benefits of Google Auth**:
- ✅ **Secure**: Short-lived tokens (1 hour), auto-refreshed
- ✅ **No Manual Key Rotation**: Google handles token lifecycle
- ✅ **Auditable**: All API calls logged in Google Cloud
- ✅ **Scalable**: Supports multiple environments (dev/prod)
- ✅ **Standard**: Uses Google Cloud IAM best practices

### **Legacy Support**:
- Code still supports `JULES_API_KEY` as fallback
- Useful for testing/development
- Production should use Google Auth

---

## 📚 Additional Resources

- **Google Cloud Console**: https://console.cloud.google.com/
- **Service Account Docs**: https://cloud.google.com/iam/docs/service-accounts
- **google-auth-library**: https://github.com/googleapis/google-auth-library-nodejs
- **Render Environment Vars**: https://render.com/docs/environment-variables

---

## ✅ Success Criteria

You'll know setup is complete when:
- [x] Google Cloud project created
- [x] Service account `jules-agent` exists
- [x] JSON key downloaded and saved securely
- [x] `GOOGLE_APPLICATION_CREDENTIALS_JSON` set in Render
- [x] `JULES_API_KEY` removed from Render (optional)
- [x] Service deployed successfully
- [x] Health check returns `"apiKeyConfigured": true`
- [x] Logs show "Google Auth initialized"
- [x] Jules API calls succeed with OAuth tokens

---

## 🚀 Quick Command Reference

```bash
# Test service health
curl https://scarmonit.com/health

# View Render logs
# (Use Render Dashboard)

# Check environment variables
# Render Dashboard → Environment tab

# Manual deploy
# Render Dashboard → Manual Deploy button
```

---

**Setup Time**: ~10-15 minutes  
**Security**: High (OAuth2 tokens, no long-lived keys)  
**Maintenance**: Low (Google handles token refresh)

**Next Step**: Follow Step 1 above to create your Google Cloud Project! 🎯
