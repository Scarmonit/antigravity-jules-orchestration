# Auto-diagnostics guard
if (!$env:AUTO_DIAG) {
    $env:AUTO_DIAG = 1
    & "$PSScriptRoot/quick-check.ps1"
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

# MCP Tool Chain Orchestration Master Script
# Executes all MCP tool chain demonstrations with unified traceId correlation

param(
    [Parameter(HelpMessage="Which chains to test")]
    [ValidateSet("all", "jules-session", "devops-integration", "system-diagnostics")]
    [string]$Chain = "all",

    [Parameter(HelpMessage="Generate detailed reports")]
    [switch]$Detailed = $false,

    [Parameter(HelpMessage="Run in interactive mode")]
    [switch]$Interactive = $true
)

$ErrorActionPreference = "Stop"

# Color output helpers
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param([string]$Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Failure { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Header {
    param([string]$Message)
    Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║ $($Message.PadRight(62)) ║" -ForegroundColor Magenta
    Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta
}

# Structured logging with request correlation
function Write-ChainLog {
    param(
        [string]$Level,
        [string]$Message,
        [hashtable]$Context = @{}
    )

    $logEntry = @{
        timestamp = (Get-Date).ToString("o")
        level = $Level.ToUpper()
        message = $Message
        orchestration = "master"
        traceId = $script:TraceId
        chain = $script:CurrentChain
    }

    foreach ($key in $Context.Keys) {
        $logEntry[$key] = $Context[$key]
    }

    $jsonLog = $logEntry | ConvertTo-Json -Compress

    # Console output (pretty format for humans)
    $icon = switch ($Level) {
        "error" { "❌" }
        "warn"  { "⚠️ " }
        "info"  { "ℹ️ " }
        default { "📝" }
    }

    $color = switch ($Level) {
        "error" { "Red" }
        "warn"  { "Yellow" }
        "info"  { "Cyan" }
        default { "Gray" }
    }

    Write-Host "$icon $Message" -ForegroundColor $color

    # Structured log to file (JSON format for aggregation)
    if ($script:LogFile) {
        $jsonLog | Out-File -FilePath $script:LogFile -Append -Encoding UTF8
    }
}

Clear-Host

Write-Header "MCP Tool Chain Orchestration Test Suite"

# Generate unique traceId for this orchestration run
$script:TraceId = [guid]::NewGuid().ToString()
$script:CurrentChain = "orchestration-master"
$script:LogFile = "mcp-orchestration-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').log"

Write-ChainLog -Level "info" -Message "MCP Tool Discovery & Orchestration Framework" -Context @{
    version = "2.0.0"
    correlationEnabled = $true
}

Write-Host "Version: 2.0.0 (Logger v2.0.0 - Request Correlation)" -ForegroundColor Gray
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "TraceId: $script:TraceId" -ForegroundColor Gray
Write-Host "Log File: $script:LogFile" -ForegroundColor Gray
Write-Host ""

# Orchestration state
$orchestration = @{
    StartTime = Get-Date
    TraceId = $script:TraceId
    Chains = @()
    Results = @{}
    LogFile = $script:LogFile
}

# Display available chains
Write-Info "Available Tool Chains:"
Write-Host "  1. Jules Session Lifecycle (7 tools)" -ForegroundColor Cyan
Write-Host "     Chain: list_sources → create_session → approve_plan → monitor" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. DevOps Integration (9 tools)" -ForegroundColor Cyan
Write-Host "     Chain: terraform → github_actions → dockerfile → kubernetes → prometheus" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. System Diagnostics (7 tools)" -ForegroundColor Cyan
Write-Host "     Chain: system_status + agent_diagnostics + devops_health → analyze" -ForegroundColor Gray
Write-Host ""

# Define chain configurations
$chainConfigs = @{
    "jules-session" = @{
        Name = "Jules Session Lifecycle"
        Script = "test-mcp-chain-jules-session-v2.ps1"  # switched to v2 script
        Duration = "2-30 minutes"
        RequiresAuth = $true
        Interactive = $true
    }
    "devops-integration" = @{
        Name = "DevOps Integration"
        Script = "test-mcp-chain-devops-integration.ps1"
        Duration = "1-2 minutes"
        RequiresAuth = $false
        Interactive = $false
    }
    "system-diagnostics" = @{
        Name = "System Diagnostics"
        Script = "test-mcp-chain-system-diagnostics.ps1"
        Duration = "30 seconds"
        RequiresAuth = $false
        Interactive = $false
    }
}

# Determine which chains to run
$chainsToRun = @()
if ($Chain -eq "all") {
    $chainsToRun = @("system-diagnostics", "devops-integration")  # Exclude jules-session for non-interactive

    if ($Interactive) {
        Write-Warning "Jules Session chain requires API key and manual approval"
        $runJules = Read-Host "Include Jules Session Lifecycle chain? (y/N)"
        if ($runJules -eq "y" -or $runJules -eq "Y") {
            $chainsToRun += "jules-session"
        }
    }
} else {
    $chainsToRun = @($Chain)
}

Write-Info "Executing $($chainsToRun.Count) chain(s)..."
Write-Host ""

# Execute each chain
foreach ($chainKey in $chainsToRun) {
    $config = $chainConfigs[$chainKey]
    $orchestration.Chains += $chainKey

    Write-Header $config.Name

    Write-Info "Estimated Duration: $($config.Duration)"
    Write-Info "Script: $($config.Script)"

    if ($config.RequiresAuth) {
        Write-Warning "This chain requires JULES_API_KEY environment variable"

        if (-not $env:JULES_API_KEY) {
            Write-Failure "JULES_API_KEY not set - skipping chain"
            $orchestration.Results[$chainKey] = @{
                Status = "Skipped"
                Reason = "Missing API key"
            }
            continue
        }
    }

    if ($Interactive -and $config.Interactive) {
        $proceed = Read-Host "Execute this chain? (Y/n)"
        if ($proceed -eq "n" -or $proceed -eq "N") {
            Write-Warning "Chain skipped by user"
            $orchestration.Results[$chainKey] = @{
                Status = "Skipped"
                Reason = "User declined"
            }
            continue
        }
    }

    $scriptPath = Join-Path $PSScriptRoot $config.Script

    if (-not (Test-Path $scriptPath)) {
        Write-Failure "Script not found: $scriptPath"
        $orchestration.Results[$chainKey] = @{
            Status = "Failed"
            Reason = "Script not found"
        }
        continue
    }

    try {
        $chainStart = Get-Date

        $script:CurrentChain = $chainKey
        Write-ChainLog -Level "info" -Message "Starting chain execution" -Context @{
            chain = $chainKey
            chainName = $config.Name
            estimatedDuration = $config.Duration
        }

        # Execute the chain script with traceId propagation
        if ($Detailed) {
            & $scriptPath -Detailed -TraceId $script:TraceId -ParentChain "orchestration-master"
        } else {
            & $scriptPath -TraceId $script:TraceId -ParentChain "orchestration-master"
        }

        $chainDuration = (Get-Date) - $chainStart

        $orchestration.Results[$chainKey] = @{
            Status = "Completed"
            Duration = $chainDuration.TotalSeconds
            Timestamp = Get-Date
        }

        Write-ChainLog -Level "info" -Message "Chain completed successfully" -Context @{
            chain = $chainKey
            duration = $chainDuration.TotalSeconds
            status = "success"
        }

        Write-Success "Chain completed in $([math]::Round($chainDuration.TotalSeconds, 2))s"

    } catch {
        Write-ChainLog -Level "error" -Message "Chain execution failed" -Context @{
            chain = $chainKey
            error = $_.Exception.Message
        }

        Write-Failure "Chain failed: $($_.Exception.Message)"

        $orchestration.Results[$chainKey] = @{
            Status = "Failed"
            Error = $_.Exception.Message
            Timestamp = Get-Date
        }
    }

    Write-Host "`n"

    # Pause between chains (unless last chain)
    if ($chainsToRun.IndexOf($chainKey) -lt ($chainsToRun.Count - 1)) {
        Write-Info "Proceeding to next chain..."
        Start-Sleep -Seconds 2
    }
}

# Final Summary
Write-Header "Orchestration Summary"

$totalDuration = (Get-Date) - $orchestration.StartTime
Write-Info "Total Execution Time: $([math]::Round($totalDuration.TotalSeconds, 2))s"
Write-Info "Chains Executed: $($orchestration.Chains.Count)"

Write-Host "`nResults:" -ForegroundColor Cyan
$orchestration.Results.GetEnumerator() | ForEach-Object {
    $chainName = $chainConfigs[$_.Key].Name
    $result = $_.Value

    $icon = switch ($result.Status) {
        "Completed" { "✅" }
        "Failed" { "❌" }
        "Skipped" { "⏭️" }
        default { "❓" }
    }

    Write-Host "  $icon $chainName - $($result.Status)"

    if ($result.Duration) {
        Write-Host "     Duration: $([math]::Round($result.Duration, 2))s" -ForegroundColor Gray
    }
    if ($result.Error) {
        Write-Host "     Error: $($result.Error)" -ForegroundColor Red
    }
    if ($result.Reason) {
        Write-Host "     Reason: $($result.Reason)" -ForegroundColor Yellow
    }
}

# Success rate
$completed = ($orchestration.Results.Values | Where-Object { $_.Status -eq "Completed" }).Count
$total = $orchestration.Results.Count
$successRate = if ($total -gt 0) { [math]::Round(($completed / $total) * 100, 1) } else { 0 }

Write-Host "`nSuccess Rate: $successRate% ($completed/$total)" -ForegroundColor $(
    if ($successRate -eq 100) { "Green" }
    elseif ($successRate -ge 50) { "Yellow" }
    else { "Red" }
)

# Generate report
if ($Detailed) {
    $reportPath = "orchestration-report-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').json"
    $orchestration | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
    Write-Success "Detailed report saved: $reportPath"
}

Write-Host "`n"
Write-Success "MCP Tool Chain Orchestration Complete!"

Write-Host "`nDocumentation:" -ForegroundColor Gray
Write-Host "  • Tool Chain Architecture: docs/MCP_TOOL_CHAINS.md"
Write-Host "  • Integration Guide: INTEGRATION_GUIDE.md"
Write-Host "  • MCP Configuration: antigravity-mcp-config.json"

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Review generated artifacts in ./generated-artifacts/"
Write-Host "  2. Check orchestration report (if -Detailed flag used)"
Write-Host "  3. Implement production chain executor in orchestrator-api/"
Write-Host "  4. Add monitoring and alerting for chain executions"
Write-Host "  5. Configure ChromaDB for pattern learning"

Write-Host "`n"

# Exit code based on success rate
if ($successRate -eq 100) {
    exit 0
} elseif ($successRate -ge 50) {
    exit 1
} else {
    exit 2
}
