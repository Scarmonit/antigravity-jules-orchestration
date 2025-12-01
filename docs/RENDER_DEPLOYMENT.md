# Render Deployment Guide

## 🚀 Automated Deployment

### Step 1: Run Deployment Script
```powershell
cd C:\Users\scarm\AntigravityProjects\antigravity-jules-orchestration
.\scripts\deploy-render.ps1
```

This will:
- ✅ Validate `render.yaml` exists
- 🌐 Open Render dashboard in browser
- 📋 Display configuration summary
- 🔐 Prompt for API keys (optional)

### Step 2: Complete in Render Dashboard
When the browser opens:

1. **Select Repository**: `Scarmonit/antigravity-jules-orchestration`
2. **Choose Branch**: `Scarmonit`
3. **Verify Detection**: Render auto-detects `render.yaml`
4. **Configure Environment Variables**:
   - `JULES_API_KEY`: Your Jules API key *(required)*
   - `GITHUB_TOKEN`: Your GitHub token *(required)*
   - `SLACK_WEBHOOK_URL`: Optional webhook for notifications
5. **Click "Apply"** to start deployment

### Step 3: Wait for Deployment
Render will automatically:
- 🗄️ Provision PostgreSQL database (`orchestrator-db`)
- 🔴 Provision Redis instance (`orchestrator-redis`)
- 🐳 Build Docker image from `orchestrator-api/Dockerfile`
- 🚀 Deploy the web service
- ✅ Run health check at `/api/v1/health`

Typical deployment time: **5-10 minutes**

### Step 4: Verify Deployment
```bash
bash scripts/verify-deployment.sh
# Or specify custom URL:
bash scripts/verify-deployment.sh https://your-service.onrender.com
```

Expected output:
```
✅ Health check passed (HTTP 200)
✅ Database connection OK (HTTP 200)
✅ Redis connection OK (HTTP 200)
🎉 Deployment successful! All systems operational.
```

## 📋 Resources Created

| Resource | Type | Description |
|----------|------|-------------|
| `jules-orchestrator` | Web Service | Main API service (Docker) |
| `orchestrator-db` | PostgreSQL | Primary database |
| `orchestrator-redis` | Redis | Cache & queue system |

## 🔐 Environment Variables

### Required
- **JULES_API_KEY**: Your Jules API authentication key
- **GITHUB_TOKEN**: GitHub personal access token (for API access)

### Auto-Configured
- **DATABASE_URL**: PostgreSQL connection string (from `orchestrator-db`)
- **REDIS_URL**: Redis connection string (from `orchestrator-redis`)

### Optional
- **SLACK_WEBHOOK_URL**: Slack notifications webhook

## 🛠️ Manual Deployment (Alternative)

If automated script fails, deploy manually:

1. **Go to Render Dashboard**: https://dashboard.render.com/
2. **Create New Blueprint**:
   - Click "New +" → "Blueprint"
   - Connect GitHub repo: `Scarmonit/antigravity-jules-orchestration`
   - Select branch: `Scarmonit`
   - Render detects `render.yaml` automatically
3. **Set Environment Variables** (in service settings)
4. **Deploy**

## 📊 Monitoring

### Health Endpoints
- **Main Health**: `GET /api/v1/health`
- **Database**: `GET /api/v1/health/db`
- **Redis**: `GET /api/v1/health/redis`

### Render Dashboard
- **Logs**: View real-time logs in Render dashboard
- **Metrics**: CPU, memory, request metrics available
- **Deploys**: Track deployment history

## 🔧 Troubleshooting

### Deployment Fails
1. Check Render logs for errors
2. Verify `Dockerfile` exists in `orchestrator-api/`
3. Ensure `render.yaml` is valid YAML syntax
4. Confirm environment variables are set

### Health Check Fails
1. Verify service is running (not sleeping)
2. Check database connection string in logs
3. Confirm Redis URL is correct
4. Review application logs for errors

### Database Connection Issues
1. Ensure `DATABASE_URL` is auto-populated
2. Verify database is provisioned successfully
3. Check database user permissions
4. Review PostgreSQL logs in Render

### Redis Connection Issues
1. Ensure `REDIS_URL` is auto-populated
2. Verify Redis instance is running
3. Check maxmemory policy is set correctly
4. Review Redis logs

## 🚦 Rollback

To rollback a failed deployment:
1. Go to Render Dashboard → Service → Deploys
2. Find last successful deployment
3. Click "Redeploy"

## 📚 Additional Resources

- [Render Blueprints Documentation](https://render.com/docs/blueprint-spec)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Docker on Render](https://render.com/docs/docker)
- [PostgreSQL on Render](https://render.com/docs/databases)
- [Redis on Render](https://render.com/docs/redis)

## ✅ Post-Deployment Checklist

- [ ] Deployment completed successfully
- [ ] Health check returns 200 OK
- [ ] Database connection verified
- [ ] Redis connection verified
- [ ] Environment variables configured
- [ ] Logs show no errors
- [ ] Service URL accessible
- [ ] Jules API integration tested

---

**Deployment Script**: `scripts/deploy-render.ps1`  
**Verification Script**: `scripts/verify-deployment.sh`  
**Environment Template**: `.env.render`
