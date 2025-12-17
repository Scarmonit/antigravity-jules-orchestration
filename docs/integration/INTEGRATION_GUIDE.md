# Antigravity-Jules Integration Guide

## Overview

This guide provides instructions for testing and verifying the complete integration between Google Antigravity MCP and Jules API through the deployed orchestration service.

## Architecture

```
Google Antigravity (Browser Agent)
          ↓
    MCP Protocol
          ↓
Render Service (scarmonit.com)
          ↓
   Jules API (jules.googleapis.com/v1alpha)
          ↓
   GitHub Repository
```

## Prerequisites

- Jules API Key (`JULES_API_KEY`)
- GitHub repository access
- Antigravity browser agent configured with MCP
- Access to deployed Render service

## Testing the Integration

### 1. Health Check

First, verify the service is running:

```bash
curl https://scarmonit.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "Jules MCP Server",
  "version": "1.0.0",
  "timestamp": "2025-12-01T09:00:00.000Z"
}
```

### 2. Test Jules API Endpoints

#### Create a New Session

```bash
curl -X POST https://scarmonit.com/api/jules/create \
  -H "Content-Type: application/json" \
  -H "X-Jules-API-Key: YOUR_JULES_API_KEY" \
  -d '{
    "repository": "Scarmonit/test-repo",
    "task": "Add README documentation",
    "branch": "main",
    "autoApprove": false
  }'
```

Expected response:
```json
{
  "success": true,
  "session": {
    "sessionId": "...",
    "repository": "Scarmonit/test-repo",
    "status": "created"
  },
  "message": "Jules session created successfully"
}
```

#### List Active Sessions

```bash
curl https://scarmonit.com/api/jules/list \
  -H "X-Jules-API-Key": YOUR_JULES_API_KEY
```

Expected response:
```json
{
  "success": true,
  "sessions": [],
  "count": 0
}
```

#### Get Session Status

```bash
curl https://scarmonit.com/api/jules/status/SESSION_ID \
  -H "X-Jules-API-Key: YOUR_JULES_API_KEY"
```

### 3. Local CLI Testing

Test the Jules automation wrapper locally:

```bash
# Set API key
export JULES_API_KEY="your_api_key_here"

# List sessions
node scripts/jules-auto.js list

# Create session
node scripts/jules-auto.js create Scarmonit/test-repo "Add feature" --auto-approve
```

### 4. Antigravity MCP Integration

#### Configure Antigravity

Add the MCP configuration to your Antigravity settings:

```json
{
  "mcpServers": {
    "jules-orchestration": {
      "baseUrl": "https://scarmonit.com",
      "endpoints": {
        "health": "/health",
        "julesCreate": "/api/jules/create",
        "julesList": "/api/jules/list"
      }
    }
  }
}
```

#### Use from Antigravity

From your Antigravity browser agent, you can now:

1. **Create Jules Session**: Ask Antigravity to create a new coding session
2. **List Sessions**: Query active Jules sessions
3. **Monitor Status**: Check session progress

Example Antigravity command:
```
"Create a Jules session for repository Scarmonit/test-repo to add documentation"
```

## Autonomous Workflows

### Workflow 1: Auto-Deploy on Push

When you push to the `Scarmonit` branch:
1. GitHub Actions runs tests
2. Render auto-deploys the service
3. Service becomes available at the production URL

### Workflow 2: Session Creation & Approval

1. Antigravity receives development task
2. Calls `/api/jules/create` endpoint
3. Jules API creates session
4. User approves execution plan (if `autoApprove: false`)
5. Jules executes changes
6. Changes pushed to GitHub

### Workflow 3: Continuous Monitoring

1. Service health checks run every 15 minutes
2. GitHub Actions monitors deployment status
3. Logs available at Render dashboard

## Troubleshooting

### Service Not Responding

Check Render logs:
```
https://dashboard.render.com/web/srv-d4mlmna4d50c73ep70sg/logs
```

### API Key Issues

Verify environment variable is set:
1. Go to Render dashboard → Environment
2. Check `JULES_API_KEY` is configured
3. Restart service if needed

### Cold Start Delays

Free-tier Render instances spin down after inactivity:
- First request after inactivity may take ~30 seconds
- Subsequent requests are fast
- Consider upgrading to paid tier for always-on service

## Verification Checklist

- [ ] Service health endpoint responds
- [ ] Jules API endpoints return valid responses
- [ ] MCP configuration file is up to date
- [ ] Environment variables are set
- [ ] GitHub Actions workflows run successfully
- [ ] Render deployment is active
- [ ] Local CLI tool works with API key
- [ ] Antigravity can connect to MCP server

## Next Steps

1. **Test End-to-End Flow**: Create a real development task through Antigravity
2. **Monitor Performance**: Check Render logs for response times
3. **Optimize**: Adjust timeouts and retry logic as needed
4. **Scale**: Upgrade Render tier if needed for production use
5. **Secure**: Add rate limiting and additional authentication layers

## API Reference

### POST /api/jules/create
Creates a new Jules coding session.

**Headers:**
- `Content-Type: application/json`
- `X-Jules-API-Key: YOUR_API_KEY`

**Body:**
```json
{
  "repository": "owner/repo",
  "task": "Task description",
  "branch": "main",
  "autoApprove": false
}
```

### GET /api/jules/list
Lists all active Jules sessions.

**Headers:**
- `X-Jules-API-Key: YOUR_API_KEY`

### GET /api/jules/status/:sessionId
Gets status of a specific session.

**Headers:**
- `X-Jules-API-Key: YOUR_API_KEY`

## Support

For issues or questions:
- Check GitHub Issues
- Review Render logs
- Consult Jules API documentation
- Contact Scarmonit@gmail.com
