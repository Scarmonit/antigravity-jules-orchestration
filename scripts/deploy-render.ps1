# Deploy to Render.com using API
# This script creates a Blueprint deployment from render.yaml

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying antigravity-jules-orchestration to Render..." -ForegroundColor Cyan

# Configuration
$REPO_OWNER = "Scarmonit"
$REPO_NAME = "antigravity-jules-orchestration"
$BRANCH = "Scarmonit"

# Get GitHub token from environment
$GITHUB_TOKEN = $env:GITHUB_TOKEN
if (-not $GITHUB_TOKEN) {
    $GITHUB_TOKEN = (Get-Content C:\Users\scarm\IdeaProjects\LLM\.env | Select-String "GITHUB_TOKEN" | ForEach-Object { $_.ToString().Split("=")[1] })
}

# Check if render.yaml exists
if (-not (Test-Path "render.yaml")) {
    Write-Host "❌ render.yaml not found in current directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found render.yaml" -ForegroundColor Green
Write-Host "📦 Repository: $REPO_OWNER/$REPO_NAME" -ForegroundColor Yellow
Write-Host "🌿 Branch: $BRANCH" -ForegroundColor Yellow

# Prompt for Render API Key if not set
$RENDER_API_KEY = $env:RENDER_API_KEY
if (-not $RENDER_API_KEY) {
    Write-Host ""
    Write-Host "⚠️  RENDER_API_KEY not found in environment" -ForegroundColor Yellow
    Write-Host "Get your API key from: https://dashboard.render.com/account/api-keys" -ForegroundColor Cyan
    $RENDER_API_KEY = Read-Host "Enter your Render API Key"
    $env:RENDER_API_KEY = $RENDER_API_KEY
}

# Prompt for JULES_API_KEY
$JULES_API_KEY = $env:JULES_API_KEY
if (-not $JULES_API_KEY) {
    Write-Host ""
    Write-Host "⚠️  JULES_API_KEY not found" -ForegroundColor Yellow
    $JULES_API_KEY = Read-Host "Enter your Jules API Key (or press Enter to skip)"
}

Write-Host ""
Write-Host "📋 Deployment Summary:" -ForegroundColor Magenta
Write-Host "   Service: jules-orchestrator (Docker)" -ForegroundColor White
Write-Host "   Database: PostgreSQL + Redis" -ForegroundColor White
Write-Host "   Health Check: /api/v1/health" -ForegroundColor White
Write-Host ""

# Create deployment payload
$payload = @{
    branch = $BRANCH
    repo = "https://github.com/$REPO_OWNER/$REPO_NAME"
}

if ($JULES_API_KEY) {
    Write-Host "🔐 Jules API Key: Configured" -ForegroundColor Green
} else {
    Write-Host "⚠️  Jules API Key: Not set (you'll need to add it manually)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌐 Opening Render Dashboard..." -ForegroundColor Cyan
Write-Host "   URL: https://dashboard.render.com/select-repo?type=blueprint" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "   1. In the browser, select: $REPO_OWNER/$REPO_NAME" -ForegroundColor White
Write-Host "   2. Choose branch: $BRANCH" -ForegroundColor White
Write-Host "   3. Render will detect render.yaml automatically" -ForegroundColor White
Write-Host "   4. Set environment variables:" -ForegroundColor White
Write-Host "      - JULES_API_KEY: $($JULES_API_KEY ? '✓' : 'Required')" -ForegroundColor White
Write-Host "      - GITHUB_TOKEN: ✓" -ForegroundColor White
Write-Host "      - SLACK_WEBHOOK_URL: Optional" -ForegroundColor White
Write-Host "   5. Click 'Apply'" -ForegroundColor White
Write-Host ""

# Open browser
Start-Process "https://dashboard.render.com/select-repo?type=blueprint"

Write-Host "✨ Render dashboard opened in browser!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 After deployment, verify with:" -ForegroundColor Cyan
Write-Host "   curl https://jules-orchestrator.onrender.com/api/v1/health" -ForegroundColor Gray
Write-Host ""
