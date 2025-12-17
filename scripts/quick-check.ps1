# ½-second smoke-test: Docker, ChromaDB, Jules HTTP
$ErrorActionPreference = 'Stop'
try {
    docker ps >$null
    Test-NetConnection localhost -Port 8000 -InformationLevel Quiet >$null
    Invoke-WebRequest https://scarmonit.com/health -UseBasicParsing -TimeoutSec 3 >$null
    Write-Host '🟢 Environment OK' -ForegroundColor Green
    exit 0
} catch {
    Write-Host '🔴 Auto-diagnostics failed' -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

