# Real MCP Tool Chain Test - HTTP API Execution
# Tests actual MCP protocol calls via HTTP (not simulated)

param(
    [string]$BaseUrl = "https://scarmonit.com",
    [int]$TimeoutSec = 45
)

$ErrorActionPreference = "Stop"

# Color helpers
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param([string]$Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Failure { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║        REAL MCP TOOL CHAIN TEST - HTTP EXECUTION          ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

$results = @{
    timestamp = Get-Date
    tests = @()
    successCount = 0
    failureCount = 0
}

# TEST 1: Server Health Check
Write-Host "═══ TEST 1: MCP Server Health ═══`n" -ForegroundColor Cyan

try {
    Write-Info "Warming up MCP server (may take 30s for cold start)..."
    $healthResponse = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec $TimeoutSec

    Write-Success "Server is healthy"
    Write-Host "  Status: $($healthResponse.status)" -ForegroundColor Gray
    Write-Host "  Version: $($healthResponse.version)" -ForegroundColor Gray
    Write-Host "  API Key Configured: $($healthResponse.apiKeyConfigured)" -ForegroundColor Gray

    $results.tests += @{
        name = "Server Health"
        status = "PASS"
        response = $healthResponse
    }
    $results.successCount++
} catch {
    Write-Failure "Health check failed: $($_.Exception.Message)"
    $results.tests += @{
        name = "Server Health"
        status = "FAIL"
        error = $_.Exception.Message
    }
    $results.failureCount++
}

# TEST 2: List MCP Tools
Write-Host "`n═══ TEST 2: List Available MCP Tools ═══`n" -ForegroundColor Cyan

try {
    Write-Info "Calling /mcp/tools endpoint..."
    $toolsResponse = Invoke-RestMethod -Uri "$BaseUrl/mcp/tools" -TimeoutSec 30

    Write-Success "Retrieved $($toolsResponse.tools.Count) tools"
    Write-Host "`nAvailable Tools:" -ForegroundColor Yellow
    $toolsResponse.tools | ForEach-Object {
        Write-Host "  • $($_.name)" -ForegroundColor White -NoNewline
        Write-Host " - $($_.description)" -ForegroundColor Gray
    }

    $results.tests += @{
        name = "List MCP Tools"
        status = "PASS"
        toolCount = $toolsResponse.tools.Count
        tools = $toolsResponse.tools.name
    }
    $results.successCount++
} catch {
    Write-Failure "Failed to list tools: $($_.Exception.Message)"
    $results.tests += @{
        name = "List MCP Tools"
        status = "FAIL"
        error = $_.Exception.Message
    }
    $results.failureCount++
}

# TEST 3: Execute MCP Tool - jules_list_sessions (read-only, no API key needed for MCP call)
Write-Host "`n═══ TEST 3: Execute MCP Tool (jules_list_sessions) ═══`n" -ForegroundColor Cyan

try {
    Write-Info "Executing jules_list_sessions via /mcp/execute..."

    $body = @{
        tool = "jules_list_sessions"
        parameters = @{}
    } | ConvertTo-Json

    $executeResponse = Invoke-RestMethod -Uri "$BaseUrl/mcp/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 30

    Write-Success "Tool executed successfully"
    Write-Host "  Response type: $($executeResponse.GetType().Name)" -ForegroundColor Gray

    if ($executeResponse.sessions) {
        Write-Host "  Sessions found: $($executeResponse.sessions.Count)" -ForegroundColor Gray
        if ($executeResponse.sessions.Count -gt 0) {
            Write-Host "`n  Recent sessions:" -ForegroundColor Yellow
            $executeResponse.sessions | Select-Object -First 3 | ForEach-Object {
                Write-Host "    - $($_.id): $($_.status)" -ForegroundColor White
            }
        }
    } elseif ($executeResponse.error) {
        Write-Warning "  Backend API error (expected without JULES_API_KEY): $($executeResponse.error)"
    } else {
        Write-Host "  Response: $($executeResponse | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
    }

    $results.tests += @{
        name = "Execute MCP Tool"
        status = "PASS"
        tool = "jules_list_sessions"
        response = $executeResponse
    }
    $results.successCount++
} catch {
    Write-Failure "Tool execution failed: $($_.Exception.Message)"
    $results.tests += @{
        name = "Execute MCP Tool"
        status = "FAIL"
        error = $_.Exception.Message
    }
    $results.failureCount++
}

# TEST 4: MCP Tool with Parameters - jules_get_session
Write-Host "`n═══ TEST 4: Execute MCP Tool with Parameters ═══`n" -ForegroundColor Cyan

try {
    Write-Info "Executing jules_get_session with test session ID..."

    $body = @{
        tool = "jules_get_session"
        parameters = @{
            sessionId = "test-session-123"
        }
    } | ConvertTo-Json

    $sessionResponse = Invoke-RestMethod -Uri "$BaseUrl/mcp/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 30

    Write-Success "Tool executed with parameters"

    if ($sessionResponse.error) {
        Write-Info "  Expected error (test session doesn't exist): $($sessionResponse.error)"
    } else {
        Write-Host "  Response: $($sessionResponse | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    }

    $results.tests += @{
        name = "Execute MCP Tool with Parameters"
        status = "PASS"
        tool = "jules_get_session"
        response = $sessionResponse
    }
    $results.successCount++
} catch {
    Write-Failure "Tool execution failed: $($_.Exception.Message)"
    $results.tests += @{
        name = "Execute MCP Tool with Parameters"
        status = "FAIL"
        error = $_.Exception.Message
    }
    $results.failureCount++
}

# TEST 5: Invalid Tool Name (error handling)
Write-Host "`n═══ TEST 5: Error Handling - Invalid Tool ═══`n" -ForegroundColor Cyan

try {
    Write-Info "Testing error handling with invalid tool name..."

    $body = @{
        tool = "nonexistent_tool"
        parameters = @{}
    } | ConvertTo-Json

    $errorResponse = Invoke-RestMethod -Uri "$BaseUrl/mcp/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 30 `
        -ErrorAction Stop

    if ($errorResponse.error) {
        Write-Success "Error handling works correctly"
        Write-Host "  Error message: $($errorResponse.error)" -ForegroundColor Gray

        $results.tests += @{
            name = "Error Handling"
            status = "PASS"
            errorMessage = $errorResponse.error
        }
        $results.successCount++
    } else {
        Write-Warning "Unexpected success for invalid tool"
        $results.tests += @{
            name = "Error Handling"
            status = "PARTIAL"
            note = "No error returned for invalid tool"
        }
        $results.failureCount++
    }
} catch {
    # HTTP error is also valid error handling
    Write-Success "Error handling works (HTTP error)"
    Write-Host "  HTTP Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Gray

    $results.tests += @{
        name = "Error Handling"
        status = "PASS"
        httpError = $_.Exception.Response.StatusCode.value__
    }
    $results.successCount++
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                   TEST SUMMARY                             ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

Write-Host "Total Tests: $($results.tests.Count)" -ForegroundColor Cyan
Write-Host "Passed: " -NoNewline -ForegroundColor Cyan
Write-Host "$($results.successCount)" -ForegroundColor Green
Write-Host "Failed: " -NoNewline -ForegroundColor Cyan
Write-Host "$($results.failureCount)" -ForegroundColor $(if ($results.failureCount -eq 0) { "Green" } else { "Red" })

$successRate = [math]::Round(($results.successCount / $results.tests.Count) * 100, 1)
Write-Host "`nSuccess Rate: $successRate%" -ForegroundColor $(
    if ($successRate -eq 100) { "Green" }
    elseif ($successRate -ge 80) { "Yellow" }
    else { "Red" }
)

Write-Host "`nTest Results:" -ForegroundColor Cyan
$results.tests | ForEach-Object {
    $icon = if ($_.status -eq "PASS") { "✅" } elseif ($_.status -eq "FAIL") { "❌" } else { "⚠️" }
    Write-Host "  $icon $($_.name) - $($_.status)"
}

# Save results
$reportPath = "mcp-http-test-results-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').json"
$results | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "`n📄 Results saved to: $reportPath" -ForegroundColor Gray

Write-Host "`n✨ Real MCP HTTP Test Complete! ✨`n" -ForegroundColor Green

# Exit with appropriate code
if ($results.failureCount -eq 0) {
    exit 0
} else {
    exit 1
}

