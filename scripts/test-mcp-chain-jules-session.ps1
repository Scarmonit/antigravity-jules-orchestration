# Test MCP Tool Chain: Complete Jules Session Lifecycle
Write-Info "Session ID: $sessionId"
Write-Success "Jules Session Lifecycle Chain Test Complete!"
Write-Host "`n" -ForegroundColor Green

}
    }
        Write-Host "  ❌ $($_.Tool): $($_.Error)"
    $ChainState.Errors | ForEach-Object {
    Write-Host "`nErrors:" -ForegroundColor Red
if ($ChainState.Errors.Count -gt 0) {

}
    Write-Host "  $status $($_.Tool) - $([math]::Round($_.Duration, 2))s"
    $status = if ($_.Success) { "✅" } else { "❌" }
$ChainState.Steps | ForEach-Object {
Write-Host "`nStep Breakdown:" -ForegroundColor Cyan

Write-Info "Errors: $($ChainState.Errors.Count)"
Write-Info "Steps Executed: $($ChainState.Steps.Count)"
Write-Info "Total Duration: $([math]::Round($totalDuration.TotalSeconds, 2))s"
$totalDuration = (Get-Date) - $ChainState.StartTime

Write-Host "========================================`n" -ForegroundColor Magenta
Write-Host "CHAIN EXECUTION SUMMARY" -ForegroundColor Magenta
Write-Host "`n========================================" -ForegroundColor Magenta
# Chain summary

}
    Write-Warning "Failed to retrieve final status"
catch {
}
    Write-Success "Session URL: https://jules.googleapis.com/sessions/$sessionId"
    Write-Info "Final Status: $($finalStatus.status)"

    }
        sessionId = $sessionId
    $finalStatus = Invoke-MCPTool -Tool "jules_get_session" -Parameters @{
try {

Write-Host "========================================`n" -ForegroundColor Magenta
Write-Host "STEP 7: Final Session Status" -ForegroundColor Magenta
Write-Host "`n========================================" -ForegroundColor Magenta
# STEP 7: Final status

}
    Write-Warning "Failed to retrieve activities: $($_.Exception.Message)"
catch {
}
    }
        Write-Host "  [$timestamp] $type - $content..." -ForegroundColor Gray
        $content = $_.content.Substring(0, [Math]::Min(100, $_.content.Length))
        $type = $_.type
        $timestamp = $_.timestamp
    $activities.activities | ForEach-Object {
    Write-Info "Session activities ($($activities.activities.Count) total):"

    }
        sessionId = $sessionId
    $activities = Invoke-MCPTool -Tool "jules_get_activities" -Parameters @{
try {

Write-Host "========================================`n" -ForegroundColor Magenta
Write-Host "STEP 6: Monitor Activities" -ForegroundColor Magenta
Write-Host "`n========================================" -ForegroundColor Magenta
# STEP 6: Get activities and monitor execution

}
    Write-Warning "Plan approval declined by user"
else {
}
    }
        Write-Failure "Failed to approve plan: $($_.Exception.Message)"
    catch {
    }
        Write-Success "Plan approved! Execution started."
        }
            sessionId = $sessionId
        $approvalResult = Invoke-MCPTool -Tool "jules_approve_plan" -Parameters @{
    try {
if ($approval -eq "y" -or $approval -eq "Y") {
$approval = Read-Host "Approve this plan and execute? (y/N)"

Write-Host "========================================`n" -ForegroundColor Magenta
Write-Host "STEP 5: Approve Plan" -ForegroundColor Magenta
Write-Host "`n========================================" -ForegroundColor Magenta
# STEP 5: Approve plan (interactive)

}
    Write-Warning "No plan available in session response"
else {
}
    Write-Host ($sessionStatus.plan | ConvertTo-Json -Depth 5) -ForegroundColor Gray
    Write-Info "Plan Summary:"
if ($sessionStatus.plan) {

Write-Host "========================================`n" -ForegroundColor Magenta
Write-Host "STEP 4: Review Plan" -ForegroundColor Magenta
Write-Host "`n========================================" -ForegroundColor Magenta
# STEP 4: Display plan summary

}
    Write-Info "Session may have completed automatically or encountered an error"
    Write-Failure "Session did not reach AWAITING_APPROVAL state (current: $($sessionStatus.status))"
if ($sessionStatus.status -ne "AWAITING_APPROVAL") {

}
    }
        Write-Warning "Poll attempt $pollAttempt failed: $($_.Exception.Message)"
    catch {
    }
        }
            break
            Write-Warning "Session reached terminal state: $($sessionStatus.status)"
        elseif ($sessionStatus.status -in @("COMPLETED", "FAILED", "CANCELLED")) {
        }
            break
            Write-Success "Plan generated and ready for approval!"
        if ($sessionStatus.status -eq "AWAITING_APPROVAL") {

        Write-Info "Status: $($sessionStatus.status) (Poll $pollAttempt/$maxPollAttempts)"

        }
            sessionId = $sessionId
        $sessionStatus = Invoke-MCPTool -Tool "jules_get_session" -Parameters @{
    try {

    $pollAttempt++
    Start-Sleep -Seconds 5
while ($pollAttempt -lt $maxPollAttempts) {

$sessionStatus = $null
$pollAttempt = 0
$maxPollAttempts = 60  # 5 minutes with 5s intervals

Write-Host "========================================`n" -ForegroundColor Magenta
Write-Host "STEP 3: Wait for Plan Generation" -ForegroundColor Magenta
Write-Host "`n========================================" -ForegroundColor Magenta
# STEP 3: Poll for plan (wait for AWAITING_APPROVAL)

Write-Info "Initial status: $($session.status)"
Write-Success "Session created: $sessionId"
$sessionId = $session.id

}
    requirePlanApproval = $true
    source = $targetSource.name
    prompt = $Prompt
$session = Invoke-MCPTool -Tool "jules_create_session" -Parameters @{
Write-Info "Prompt: $Prompt"

Write-Host "========================================`n" -ForegroundColor Magenta
Write-Host "STEP 2: Create Jules Session" -ForegroundColor Magenta
Write-Host "`n========================================" -ForegroundColor Magenta
# STEP 2: Create Jules session

Write-Success "Selected source: $($targetSource.name)"

}
    exit 1
    $sources.sources | ForEach-Object { Write-Host "  - $($_.name)" }
    Write-Info "Available sources:"
    Write-Failure "No source matching '$SourcePattern' found"
if (-not $targetSource) {

$targetSource = $sources.sources | Where-Object { $_.name -like "*$SourcePattern*" } | Select-Object -First 1

Write-Info "Found $($sources.sources.Count) sources"
$sources = Invoke-MCPTool -Tool "jules_list_sources"

Write-Host "========================================`n" -ForegroundColor Magenta
Write-Host "STEP 1: List Available Sources" -ForegroundColor Magenta
Write-Host "`n========================================" -ForegroundColor Magenta
# STEP 1: List available sources

}
    }
        }
            Start-Sleep -Seconds $backoffSeconds
            Write-Info "Retrying in ${backoffSeconds}s..."
            $backoffSeconds = [math]::Pow(2, $i)
            # Exponential backoff: 1s, 2s, 4s

            }
                throw
                Write-Failure "Tool execution failed after $MaxRetries attempts"
                }
                    Timestamp = Get-Date
                    Error = $errorMessage
                    Tool = $Tool
                $ChainState.Errors += @{
            if ($i -eq $MaxRetries - 1) {

            Write-Warning "Attempt $($i + 1)/$MaxRetries failed: $errorMessage"
            $errorMessage = $_.Exception.Message
        catch {
        }
            return $response
            Write-Success "Tool completed in $([math]::Round($duration.TotalSeconds, 2))s"

            }
                Timestamp = Get-Date
                Success = $true
                Duration = $duration.TotalSeconds
                Parameters = $Parameters
                Tool = $Tool
            $ChainState.Steps += @{
            $duration = (Get-Date) - $stepStart

                -TimeoutSec 30
                -Body $body `
                } `
                    "X-API-Key" = $ApiKey
                    "Content-Type" = "application/json"
                -Headers @{
                -Method POST `
            $response = Invoke-RestMethod -Uri "$BaseUrl/mcp/execute" `

            } | ConvertTo-Json -Depth 10
                parameters = $Parameters
                tool = $Tool
            $body = @{
        try {
    for ($i = 0; $i -lt $MaxRetries; $i++) {

    Write-Info "Executing tool: $Tool"
    $stepStart = Get-Date

    )
        [int]$MaxRetries = 3
        [hashtable]$Parameters = @{},
        [string]$Tool,
    param(
function Invoke-MCPTool {

}
    Errors = @()
    Steps = @()
    StartTime = Get-Date
$ChainState = @{
# Chain execution state

}
    exit 1
    Write-Failure "JULES_API_KEY not found in environment"
if (-not $ApiKey) {
$ApiKey = $env:JULES_API_KEY

}
    }
        }
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    Get-Content .env | ForEach-Object {
if (Test-Path .env) {
# Load environment variables

function Write-Failure { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Warning { param([string]$Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Info { param([string]$Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
# Color output helpers

$ErrorActionPreference = "Stop"

)
    [string]$SourcePattern = "antigravity-jules-orchestration"
    [string]$Prompt = "Add a new health check endpoint at /api/v2/health that returns more detailed system information",
    [string]$BaseUrl = "https://scarmonit.com",
param(

# Chain: list_sources → create_session → get_session → approve_plan → get_activities

