# Final Step: Configure Render with Google Service Account
# This script completes the Render configuration

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "🔐 Render Configuration - Final Step" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

# Load the service account JSON
$keyFile = Join-Path $PSScriptRoot "..\jules-service-account-key.json"

if (-not (Test-Path $keyFile)) {
    Write-Host "❌ Service account key file not found!" -ForegroundColor Red
    Write-Host "   Expected: $keyFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Run: .\scripts\setup-google-cloud.ps1 first" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found service account key file" -ForegroundColor Green
Write-Host ""

# Read and validate
try {
    $jsonContent = Get-Content $keyFile -Raw
    $jsonObject = $jsonContent | ConvertFrom-Json
    
    Write-Host "📋 Service Account Details:" -ForegroundColor Cyan
    Write-Host "   Project: $($jsonObject.project_id)" -ForegroundColor White
    Write-Host "   Email: $($jsonObject.client_email)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "❌ Invalid JSON file" -ForegroundColor Red
    exit 1
}

# Copy to clipboard
Set-Clipboard -Value $jsonContent
Write-Host "✅ Service account JSON copied to clipboard!" -ForegroundColor Green
Write-Host ""

# Display instructions
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "📝 Complete These Steps in Render Dashboard:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""
Write-Host "1️⃣  Navigate to Environment tab (opening now...)" -ForegroundColor Cyan
Write-Host ""
Write-Host "2️⃣  Delete the JULES_API_KEY variable:" -ForegroundColor Cyan
Write-Host "   • Find: JULES_API_KEY" -ForegroundColor Gray
Write-Host "   • Click the trash icon" -ForegroundColor Gray
Write-Host "   • Confirm deletion" -ForegroundColor Gray
Write-Host ""
Write-Host "3️⃣  Add new environment variable:" -ForegroundColor Cyan
Write-Host "   • Click: 'Add Environment Variable'" -ForegroundColor Gray
Write-Host "   • Key: GOOGLE_APPLICATION_CREDENTIALS_JSON" -ForegroundColor White
Write-Host "   • Value: <Press Ctrl+V to paste>" -ForegroundColor White
Write-Host ""
Write-Host "4️⃣  Save changes:" -ForegroundColor Cyan
Write-Host "   • Click: 'Save Changes'" -ForegroundColor Gray
Write-Host "   • Wait for automatic redeploy (~2-3 minutes)" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

# Save env value to temp file for reference
$tempFile = Join-Path $env:TEMP "render-env-value.txt"
$jsonContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

Write-Host "💾 JSON also saved to: $tempFile" -ForegroundColor Gray
Write-Host "   (In case clipboard is cleared)" -ForegroundColor Gray
Write-Host ""

# Open Render dashboard
Write-Host "🌐 Opening Render Dashboard..." -ForegroundColor Cyan
Start-Sleep -Seconds 1
Start-Process "https://dashboard.render.com/web/srv-d4mlmna4d50c73ep70sg/env"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "✅ Ready to Configure!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""
Write-Host "📋 Key Information:" -ForegroundColor Cyan
Write-Host "   Variable Name: GOOGLE_APPLICATION_CREDENTIALS_JSON" -ForegroundColor White
Write-Host "   Value: In clipboard (press Ctrl+V)" -ForegroundColor White
Write-Host "   Backup location: $tempFile" -ForegroundColor Gray
Write-Host ""
Write-Host "⏱️  After saving, wait for redeploy to complete" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎯 Verify with:" -ForegroundColor Cyan
Write-Host "   curl https://scarmonit.com/health" -ForegroundColor Gray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta

# Keep window open
Write-Host ""
Write-Host "Press Enter when you've completed the Render configuration..." -ForegroundColor Yellow
Read-Host

# Verify deployment
Write-Host ""
Write-Host "🔍 Verifying deployment..." -ForegroundColor Cyan

Start-Sleep -Seconds 5

try {
    $health = Invoke-RestMethod -Uri "https://scarmonit.com/health" -TimeoutSec 10
    
    Write-Host "✅ Service is responding!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host ($health | ConvertTo-Json) -ForegroundColor White
    Write-Host ""
    
    if ($health.status -eq "ok") {
        Write-Host "🎉 GOOGLE AUTH SETUP COMPLETE!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your service is now using Google Cloud authentication!" -ForegroundColor Cyan
    }
} catch {
    Write-Host "⏳ Service may still be deploying..." -ForegroundColor Yellow
    Write-Host "   Check status at: https://dashboard.render.com/web/srv-d4mlmna4d50c73ep70sg" -ForegroundColor Gray
}

Write-Host ""
