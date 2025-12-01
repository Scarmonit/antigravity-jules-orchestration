# scripts/start-local.ps1
# Run the Jules Orchestrator system locally using Docker Compose

Write-Host "🚀 Starting Jules Orchestrator Locally" -ForegroundColor Cyan
Write-Host "======================================="
Write-Host ""

# Check prerequisites
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Error "docker-compose is required."
    exit 1
}

# Build the dashboard first if dist doesn't exist
if (-not (Test-Path "dashboard/dist")) {
    Write-Host "📦 Building dashboard..." -ForegroundColor Yellow
    Set-Location dashboard
    npm install
    npm run build
    Set-Location ..
}

Write-Host "🐳 Starting services..." -ForegroundColor Yellow
docker-compose up --build -d

Write-Host ""
Write-Host "✅ System is running!" -ForegroundColor Green
Write-Host "   • Dashboard: http://localhost:8080"
Write-Host "   • API:       http://localhost:3000"
Write-Host "   • Grafana:   http://localhost:3001"
Write-Host ""
Write-Host "Logs: docker-compose logs -f"
Write-Host "Stop: docker-compose down"
