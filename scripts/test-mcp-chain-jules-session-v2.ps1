# Auto-diagnostics guard
if (!$env:AUTO_DIAG) {
    $env:AUTO_DIAG = 1
    & "$PSScriptRoot/quick-check.ps1"
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

# Test MCP Tool Chain: Complete Jules Session Lifecycle
# Chain: list_sources → create_session → approve_plan → monitor → get_activities
# Request-scoped logging with traceId correlation

param(
    [switch]$Detailed,
    [string]$TraceId = [guid]::NewGuid().ToString(),
    [string]$ParentChain = "standalone",
    [string]$BaseUrl = "https://scarmonit.com",
    [string]$Prompt = "Add a new health check endpoint at /api/v2/health that returns more detailed system information",
    [string]$SourcePattern = "antigravity-jules-orchestration"
)

$ErrorActionPreference = "Stop"

# Color output helpers
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param([string]$Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Failure { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }

# Structured logging with request correlation (child logger pattern)
function Write-JulesLog {
    param(
        [string]$Level,
        [string]$Message,
        [hashtable]$Context = @{}
    )

    $logEntry = @{
        timestamp = (Get-Date).ToString("o")
        level = $Level.ToUpper()
        message = $Message
        chain = "jules-session-lifecycle"
        traceId = $script:TraceId
        parentChain = $script:ParentChain
    }

    foreach ($key in $Context.Keys) {
        $logEntry[$key] = $Context[$key]
    }

    # Console output for humans
    $icon = switch ($Level) {
        "error" { "❌" }
        "warn"  { "⚠️ " }
        "info"  { "ℹ️ " }
        default { "📝" }
    }

    Write-Host "$icon $Message" -ForegroundColor $(
        switch ($Level) {
            "error" { "Red" }
            "warn"  { "Yellow" }
            "info"  { "Cyan" }
            default { "Gray" }
        }
    )
}

# Per-tool child logger
function Write-ToolLog {
    param(
        [string]$Tool,
        [string]$Level,
        [string]$Message,
        [hashtable]$Context = @{}
    )

    $toolContext = @{
        tool = $Tool
    }

    foreach ($key in $Context.Keys) {
        $toolContext[$key] = $Context[$key]
    }

    Write-JulesLog -Level $Level -Message $Message -Context $toolContext
}

# Set script-scoped context
$script:TraceId = $TraceId
$script:ParentChain = $ParentChain

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "Jules Session Lifecycle Chain" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

Write-JulesLog -Level "info" -Message "Jules session lifecycle chain started" -Context @{
    traceIdSource = if ($ParentChain -eq "standalone") { "generated" } else { "inherited" }
    executionMode = if ($Detailed) { "detailed" } else { "standard" }
}

Write-Host "TraceId: $script:TraceId" -ForegroundColor Gray
Write-Host "Parent: $script:ParentChain" -ForegroundColor Gray
Write-Host ""

# Load environment variables from .env file
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

# Check for API key
$ApiKey = $env:JULES_API_KEY
if (-not $ApiKey) {
    Write-JulesLog -Level "error" -Message "JULES_API_KEY environment variable not set" -Context @{
        required = $true
    }
    Write-Failure "JULES_API_KEY environment variable not set"
    Write-Info "Please set your Jules API key:"
    Write-Host '  $env:JULES_API_KEY = "your-api-key-here"' -ForegroundColor Gray
    exit 1
}

Write-JulesLog -Level "info" -Message "API key configured" -Context @{
    keyLength = $ApiKey.Length
}

# Chain state
$ChainState = @{
    StartTime = Get-Date
    TraceId = $script:TraceId
    ParentChain = $script:ParentChain
    Steps = @()
    SessionId = $null
    Errors = @()
}

# MCP Tool invocation helper with real HTTP calls
function Invoke-MCPTool {
    param(
        [string]$Tool,
        [hashtable]$Parameters,
        [int]$MaxRetries = 3
    )

    for ($i = 0; $i -lt $MaxRetries; $i++) {
        $stepStart = Get-Date

        Write-ToolLog -Tool $Tool -Level "info" -Message "Executing tool" -Context $Parameters

        try {
            $body = @{
                tool = $Tool
                parameters = $Parameters
            } | ConvertTo-Json -Depth 10

            $response = Invoke-RestMethod -Uri "$BaseUrl/mcp/execute" `
                -Method POST `
                -Headers @{
                    "Content-Type" = "application/json"
                    "X-API-Key" = $ApiKey
                } `
                -Body $body `
                -TimeoutSec 30

            $duration = (Get-Date) - $stepStart

            Write-ToolLog -Tool $Tool -Level "info" -Message "Tool completed in $([math]::Round($duration.TotalSeconds, 2))s"

            $ChainState.Steps += @{
                Tool = $Tool
                Duration = $duration.TotalSeconds
                Success = $true
                Parameters = $Parameters
                Timestamp = Get-Date
            }

            return $response

        } catch {
            $duration = (Get-Date) - $stepStart
            $errorMessage = $_.Exception.Message

            Write-Warning "Attempt $($i + 1)/$MaxRetries failed: $errorMessage"

            $ChainState.Errors += @{
                Tool = $Tool
                Error = $errorMessage
                Timestamp = Get-Date
            }

            $ChainState.Steps += @{
                Tool = $Tool
                Duration = $duration.TotalSeconds
                Success = $false
                Error = $errorMessage
                Parameters = $Parameters
                Timestamp = Get-Date
            }

            if ($i -eq $MaxRetries - 1) {
                Write-Failure "Tool execution failed after $MaxRetries attempts"
                throw
            }

            # Exponential backoff: 1s, 2s, 4s
            $backoffSeconds = [math]::Pow(2, $i)
            Write-Info "Retrying in ${backoffSeconds}s..."
            Start-Sleep -Seconds $backoffSeconds
        }
    }
}

# STEP 1: List available sources
Write-Host "`n--- STEP 1: List Available Sources ---`n" -ForegroundColor Cyan
Write-JulesLog -Level "info" -Message "Listing available GitHub sources" -Context @{ step = 1 }

try {
    $sources = Invoke-MCPTool -Tool "jules_list_sources" -Parameters @{}
    Write-Info "Found $($sources.sources.Count) sources"

    if ($sources.sources.Count -eq 0) {
        Write-Failure "No sources found"
        exit 1
    }

    Write-Info "Available sources:"
    $sources.sources | ForEach-Object { Write-Host "  - $($_.name)" -ForegroundColor Gray }

    $targetSource = $sources.sources | Where-Object { $_.name -like "*$SourcePattern*" } | Select-Object -First 1
    if (-not $targetSource) {
        Write-Failure "No source matching '$SourcePattern' found"
        Write-Info "Available sources:"
        $sources.sources | ForEach-Object { Write-Host "  - $($_.name)" -ForegroundColor Gray }
        exit 1
    }

    Write-Success "Selected source: $($targetSource.name)"
} catch {
    Write-Failure "Failed to list sources: $($_.Exception.Message)"
    exit 1
}

# STEP 2: Create coding session
Write-Host "`n--- STEP 2: Create Coding Session ---`n" -ForegroundColor Cyan
Write-JulesLog -Level "info" -Message "Creating new coding session" -Context @{ step = 2 }
Write-Info "Prompt: $Prompt"

try {
    $session = Invoke-MCPTool -Tool "jules_create_session" -Parameters @{
        source = $targetSource.name
        prompt = $Prompt
        requirePlanApproval = $true
    }

    $sessionId = $session.id
    $ChainState.SessionId = $sessionId

    Write-Success "Session created: $sessionId"
    Write-Info "Initial status: $($session.status)"
    Write-JulesLog -Level "info" -Message "Session created successfully" -Context @{
        sessionId = $sessionId
        step = 2
    }
} catch {
    Write-Failure "Failed to create session: $($_.Exception.Message)"
    exit 1
}

# STEP 3: Poll for plan (wait for AWAITING_APPROVAL)
Write-Host "`n--- STEP 3: Wait for Plan Generation ---`n" -ForegroundColor Cyan
Write-JulesLog -Level "info" -Message "Waiting for plan generation" -Context @{
    step = 3
    sessionId = $sessionId
}

$pollAttempt = 0
$maxPollAttempts = 60  # 5 minutes with 5s intervals

try {
    do {
        Start-Sleep -Seconds 5
        $pollAttempt++

        try {
            $sessionStatus = Invoke-MCPTool -Tool "jules_get_session" -Parameters @{
                sessionId = $sessionId
            }
        } catch {
            Write-Warning "Poll attempt $pollAttempt failed: $($_.Exception.Message)"
            continue
        }

        Write-Info "Status: $($sessionStatus.status) (Poll $pollAttempt/$maxPollAttempts)"

        if ($sessionStatus.status -eq "AWAITING_APPROVAL") {
            Write-Success "Plan generated and ready for approval!"
            break
        } elseif ($sessionStatus.status -in @("COMPLETED", "FAILED", "CANCELLED")) {
            Write-Warning "Session reached terminal state: $($sessionStatus.status)"
            break
        }
    } while ($pollAttempt -lt $maxPollAttempts)

    if ($sessionStatus.status -ne "AWAITING_APPROVAL") {
        Write-Failure "Session did not reach AWAITING_APPROVAL state (current: $($sessionStatus.status))"
        Write-Info "Session may have completed automatically or encountered an error"
        exit 1
    }
} catch {
    Write-Failure "Failed to poll session status: $($_.Exception.Message)"
    exit 1
}

# STEP 4: Display plan summary
Write-Host "`n--- STEP 4: Review Plan ---`n" -ForegroundColor Cyan
Write-JulesLog -Level "info" -Message "Displaying execution plan" -Context @{
    step = 4
    sessionId = $sessionId
}

if ($sessionStatus.plan) {
    Write-Info "Plan Summary:"
    Write-Host ($sessionStatus.plan | ConvertTo-Json -Depth 5) -ForegroundColor Gray
} else {
    Write-Warning "No plan available in session response"
}

# STEP 5: Approve execution plan (interactive)
Write-Host "`n--- STEP 5: Approve Execution Plan ---`n" -ForegroundColor Cyan
Write-JulesLog -Level "info" -Message "Execution plan ready for approval" -Context @{
    step = 5
    sessionId = $sessionId
    requiresUserApproval = $true
}

$approval = Read-Host "Approve this plan and execute? (y/N)"

if ($approval -eq "y" -or $approval -eq "Y") {
    try {
        $approvalResult = Invoke-MCPTool -Tool "jules_approve_plan" -Parameters @{
            sessionId = $sessionId
        }
        Write-Success "Plan approved! Execution started."
        Write-JulesLog -Level "info" -Message "Execution plan approved" -Context @{
            step = 5
            sessionId = $sessionId
            approved = $true
        }
    } catch {
        Write-Failure "Failed to approve plan: $($_.Exception.Message)"
        exit 1
    }
} else {
    Write-Warning "Plan approval declined by user"
    Write-JulesLog -Level "warn" -Message "Execution plan declined" -Context @{
        step = 5
        sessionId = $sessionId
        approved = $false
    }
    exit 0
}

# STEP 6: Monitor activities
Write-Host "`n--- STEP 6: Monitor Activities ---`n" -ForegroundColor Cyan
Write-JulesLog -Level "info" -Message "Monitoring session activities" -Context @{
    step = 6
    sessionId = $sessionId
}

try {
    $activities = Invoke-MCPTool -Tool "jules_get_activities" -Parameters @{
        sessionId = $sessionId
    }

    Write-Success "Activities retrieved"
    Write-Info "Session activities ($($activities.activities.Count) total):"

    $activities.activities | ForEach-Object {
        $timestamp = $_.timestamp
        $type = $_.type
        $content = $_.content.Substring(0, [Math]::Min(100, $_.content.Length))
        Write-Host "  [$timestamp] $type - $content..." -ForegroundColor Gray
    }
} catch {
    Write-Warning "Failed to retrieve activities: $($_.Exception.Message)"
}

# STEP 7: Final session status
Write-Host "`n--- STEP 7: Final Session Status ---`n" -ForegroundColor Cyan
Write-JulesLog -Level "info" -Message "Retrieving final session status" -Context @{
    step = 7
    sessionId = $sessionId
}

try {
    $finalStatus = Invoke-MCPTool -Tool "jules_get_session" -Parameters @{
        sessionId = $sessionId
    }

    Write-Success "Session URL: https://jules.googleapis.com/sessions/$sessionId"
    Write-Info "Final Status: $($finalStatus.status)"
    Write-JulesLog -Level "info" -Message "Session completed successfully" -Context @{
        sessionId = $sessionId
        status = $finalStatus.status
    }
} catch {
    Write-Warning "Failed to retrieve final status"
}

# Chain summary
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "CHAIN EXECUTION SUMMARY" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

$totalDuration = (Get-Date) - $ChainState.StartTime

Write-Info "Total Duration: $([math]::Round($totalDuration.TotalSeconds, 2))s"
Write-Info "Steps Executed: $($ChainState.Steps.Count)"
Write-Info "Errors: $($ChainState.Errors.Count)"
Write-Info "Session ID: $sessionId"

Write-Host "`nStep Breakdown:" -ForegroundColor Cyan
$ChainState.Steps | ForEach-Object {
    $status = if ($_.Success) { "✅" } else { "❌" }
    Write-Host "  $status $($_.Tool) - $([math]::Round($_.Duration, 2))s"
}

if ($ChainState.Errors.Count -gt 0) {
    Write-Host "`nErrors:" -ForegroundColor Red
    $ChainState.Errors | ForEach-Object {
        Write-Host "  ❌ $($_.Tool): $($_.Error)"
    }
}

Write-JulesLog -Level "info" -Message "Jules session lifecycle chain completed" -Context @{
    totalDuration = $totalDuration.TotalSeconds
    stepsExecuted = $ChainState.Steps.Count
    errors = $ChainState.Errors.Count
    sessionId = $sessionId
    traceId = $script:TraceId
}

Write-Success "Jules Session Lifecycle Chain Test Complete!"
Write-Host "`n" -ForegroundColor Green
