# 🔐 Google Service Account Setup Script
# Automates Render environment variable configuration

param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceAccountJsonPath,
    
    [Parameter(Mandatory=$false)]
    [string]$RenderServiceId = "srv-d4mlmna4d50c73ep70sg"
)

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "🔐 Google Service Account Configuration" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

# Validate JSON file exists
if (-not (Test-Path $ServiceAccountJsonPath)) {
    Write-Host "❌ Service account JSON file not found: $ServiceAccountJsonPath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found service account JSON file" -ForegroundColor Green
Write-Host ""

# Read and validate JSON
try {
    $jsonContent = Get-Content $ServiceAccountJsonPath -Raw
    $jsonObject = $jsonContent | ConvertFrom-Json
    
    Write-Host "📋 Service Account Details:" -ForegroundColor Cyan
    Write-Host "   Project ID: $($jsonObject.project_id)" -ForegroundColor White
    Write-Host "   Client Email: $($jsonObject.client_email)" -ForegroundColor White
    Write-Host "   Private Key ID: $($jsonObject.private_key_id.Substring(0, 8))..." -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "❌ Invalid JSON file: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Prepare for Render configuration
Write-Host "📝 Render Configuration:" -ForegroundColor Cyan
Write-Host "   Service ID: $RenderServiceId" -ForegroundColor White
Write-Host ""

Write-Host "⚠️  NEXT STEPS - Manual Configuration Required:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1️⃣  Open Render Dashboard:" -ForegroundColor White
Write-Host "   https://dashboard.render.com/web/$RenderServiceId" -ForegroundColor Gray
Write-Host ""
Write-Host "2️⃣  Navigate to Environment tab" -ForegroundColor White
Write-Host ""
Write-Host "3️⃣  Delete existing JULES_API_KEY variable (if present)" -ForegroundColor White
Write-Host ""
Write-Host "4️⃣  Add new environment variable:" -ForegroundColor White
Write-Host "   Key: GOOGLE_APPLICATION_CREDENTIALS_JSON" -ForegroundColor Gray
Write-Host ""
Write-Host "5️⃣  Paste this value (COPIED TO CLIPBOARD):" -ForegroundColor White
Write-Host ""

# Copy to clipboard
Set-Clipboard -Value $jsonContent
Write-Host "✅ JSON content copied to clipboard!" -ForegroundColor Green
Write-Host ""
Write-Host "   Just press Ctrl+V in the Render dashboard!" -ForegroundColor Cyan
Write-Host ""

Write-Host "6️⃣  Save changes in Render" -ForegroundColor White
Write-Host ""
Write-Host "7️⃣  Wait for automatic redeploy (~2-3 minutes)" -ForegroundColor White
Write-Host ""
Write-Host "8️⃣  Verify deployment:" -ForegroundColor White
Write-Host "   curl https://scarmonit.com/health" -ForegroundColor Gray
Write-Host ""

# Open browser
Write-Host "🌐 Opening Render Dashboard..." -ForegroundColor Cyan
Start-Process "https://dashboard.render.com/web/$RenderServiceId/env"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "💡 Configuration Helper Summary:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""
Write-Host "✅ Service Account JSON validated" -ForegroundColor Green
Write-Host "✅ JSON content copied to clipboard" -ForegroundColor Green
Write-Host "✅ Render dashboard opened" -ForegroundColor Green
Write-Host ""
Write-Host "👉 Complete steps 3-8 above in the browser" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 Full Guide: GOOGLE_CLOUD_SETUP.md" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
