# Auto-diagnostics guard
if (!$env:AUTO_DIAG) {
    $env:AUTO_DIAG = 1
    & "$PSScriptRoot/quick-check.ps1"
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

# Test MCP Tool Chain: DevOps + Jules Integration
# Chain: init_project → create_github_workflow → create_optimized_dockerfile → health_check

param(
    [string]$Cloud = "aws",
    [string]$Region = "us-east-1",
    [string]$AppName = "antigravity-jules",
    [string]$OutputDir = "./generated-artifacts"
)

$ErrorActionPreference = "Stop"

# Color output helpers
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param([string]$Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Failure { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Info "Created output directory: $OutputDir"
}

# Chain execution state
$ChainState = @{
    StartTime = Get-Date
    Steps = @()
    Artifacts = @()
    Errors = @()
}

# Note: These tools would be called via MCP client in production
# For demonstration, we'll show the tool invocation pattern

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "MCP DevOps Integration Chain Test" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

# STEP 1: Initialize Terraform Project
Write-Host "`n--- STEP 1: Generate Terraform Configuration ---`n" -ForegroundColor Cyan

Write-Info "Invoking: terraform_init_project"
Write-Host "  Cloud: $Cloud" -ForegroundColor Gray
Write-Host "  Region: $Region" -ForegroundColor Gray

# Simulated tool execution
$terraformConfig = @"
# Generated Terraform Configuration
# Cloud: $Cloud
# Region: $Region

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "$Region"
}
"@

$terraformPath = Join-Path $OutputDir "main.tf"
$terraformConfig | Out-File -FilePath $terraformPath -Encoding UTF8
Write-Success "Generated: $terraformPath"
$ChainState.Artifacts += $terraformPath

# STEP 2: Create GitHub Actions Workflow
Write-Host "`n--- STEP 2: Generate GitHub Actions Workflow ---`n" -ForegroundColor Cyan

Write-Info "Invoking: create_github_workflow"
Write-Host "  Language: node" -ForegroundColor Gray
Write-Host "  Deploy Target: docker" -ForegroundColor Gray
Write-Host "  Security Scan: enabled" -ForegroundColor Gray

$workflowYaml = @"
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Security audit
        run: npm audit --audit-level=high

  docker-build:
    runs-on: ubuntu-latest
    needs: build-and-test

    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t $AppName:latest .

      - name: Run security scan
        run: |
          docker run --rm aquasec/trivy image $AppName:latest
"@

$workflowPath = Join-Path $OutputDir "ci-cd-workflow.yml"
$workflowYaml | Out-File -FilePath $workflowPath -Encoding UTF8
Write-Success "Generated: $workflowPath"
$ChainState.Artifacts += $workflowPath

# STEP 3: Create Optimized Dockerfile
Write-Host "`n--- STEP 3: Generate Optimized Dockerfile ---`n" -ForegroundColor Cyan

Write-Info "Invoking: create_optimized_dockerfile"
Write-Host "  Base Image: node:20-alpine" -ForegroundColor Gray
Write-Host "  Package Manager: npm" -ForegroundColor Gray
Write-Host "  Exposed Port: 3323" -ForegroundColor Gray

$dockerfile = @"
# Multi-stage Dockerfile for $AppName

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy dependencies and app from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3323

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3323/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "index.js"]
"@

$dockerfilePath = Join-Path $OutputDir "Dockerfile"
$dockerfile | Out-File -FilePath $dockerfilePath -Encoding UTF8
Write-Success "Generated: $dockerfilePath"
$ChainState.Artifacts += $dockerfilePath

# STEP 4: Generate Kubernetes Manifests
Write-Host "`n--- STEP 4: Generate Kubernetes Deployment ---`n" -ForegroundColor Cyan

Write-Info "Invoking: generate_deployment"
Write-Host "  App Name: $AppName" -ForegroundColor Gray
Write-Host "  Replicas: 2" -ForegroundColor Gray
Write-Host "  Container Port: 3323" -ForegroundColor Gray

$k8sDeployment = @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $AppName
  labels:
    app: $AppName
spec:
  replicas: 2
  selector:
    matchLabels:
      app: $AppName
  template:
    metadata:
      labels:
        app: $AppName
    spec:
      containers:
      - name: $AppName
        image: $AppName:latest
        ports:
        - containerPort: 3323
        env:
        - name: PORT
          value: "3323"
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /health
            port: 3323
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3323
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: $AppName
spec:
  selector:
    app: $AppName
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3323
  type: LoadBalancer
"@

$k8sPath = Join-Path $OutputDir "k8s-deployment.yml"
$k8sDeployment | Out-File -FilePath $k8sPath -Encoding UTF8
Write-Success "Generated: $k8sPath"
$ChainState.Artifacts += $k8sPath

# STEP 5: Generate Prometheus Configuration
Write-Host "`n--- STEP 5: Generate Prometheus Monitoring ---`n" -ForegroundColor Cyan

Write-Info "Invoking: setup_prometheus"
Write-Host "  Job Name: $AppName" -ForegroundColor Gray
Write-Host "  Metrics Path: /metrics" -ForegroundColor Gray

$prometheusConfig = @"
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: '$AppName'
    static_configs:
      - targets: ['$AppName.default.svc.cluster.local:3323']
    metrics_path: '/metrics'

rule_files:
  - 'alerts.yml'

# Alert rules
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
"@

$prometheusPath = Join-Path $OutputDir "prometheus.yml"
$prometheusConfig | Out-File -FilePath $prometheusPath -Encoding UTF8
Write-Success "Generated: $prometheusPath"
$ChainState.Artifacts += $prometheusPath

# STEP 6: Run Health Check
Write-Host "`n--- STEP 6: DevOps Health Check ---`n" -ForegroundColor Cyan

Write-Info "Invoking: health_check"

$healthStatus = @{
    timestamp = (Get-Date).ToString("o")
    status = @(
        @{ tool = "git"; available = (Get-Command git -ErrorAction SilentlyContinue) -ne $null }
        @{ tool = "node"; available = (Get-Command node -ErrorAction SilentlyContinue) -ne $null }
        @{ tool = "npm"; available = (Get-Command npm -ErrorAction SilentlyContinue) -ne $null }
        @{ tool = "docker"; available = (Get-Command docker -ErrorAction SilentlyContinue) -ne $null }
        @{ tool = "kubectl"; available = (Get-Command kubectl -ErrorAction SilentlyContinue) -ne $null }
    )
}

Write-Host "Tool Availability:" -ForegroundColor Gray
$healthStatus.status | ForEach-Object {
    $icon = if ($_.available) { "✅" } else { "❌" }
    $status = if ($_.available) { "Available" } else { "Not Found" }
    Write-Host "  $icon $($_.tool): $status"
}

# STEP 7: Security Dependency Scan
Write-Host "`n--- STEP 7: Security Dependency Scan ---`n" -ForegroundColor Cyan

Write-Info "Invoking: scan_dependencies"
Write-Host "  Ecosystem: npm" -ForegroundColor Gray
Write-Host "  Include SBOM: true" -ForegroundColor Gray

$scanInstructions = @"
# Dependency Security Scan Instructions

## NPM Audit
npm audit --audit-level=moderate --json > audit-report.json

## Snyk (if available)
snyk test --json > snyk-report.json

## Generate SBOM
npm sbom --output-format cyclonedx --output-file sbom.json

## Trivy Filesystem Scan
trivy fs --security-checks vuln,config . > trivy-report.txt

## Review Results
# Critical vulnerabilities: Block deployment
# High vulnerabilities: Require review
# Medium/Low: Track for future updates
"@

$scanPath = Join-Path $OutputDir "security-scan-instructions.txt"
$scanInstructions | Out-File -FilePath $scanPath -Encoding UTF8
Write-Success "Generated: $scanPath"
$ChainState.Artifacts += $scanPath

# Chain Summary
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "CHAIN EXECUTION SUMMARY" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

$totalDuration = (Get-Date) - $ChainState.StartTime
Write-Info "Total Duration: $([math]::Round($totalDuration.TotalSeconds, 2))s"
Write-Info "Artifacts Generated: $($ChainState.Artifacts.Count)"

Write-Host "`nGenerated Artifacts:" -ForegroundColor Cyan
$ChainState.Artifacts | ForEach-Object {
    Write-Host "  📄 $_" -ForegroundColor Gray
}

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Review generated artifacts in: $OutputDir"
Write-Host "  2. Commit Terraform config to repository"
Write-Host "  3. Add GitHub Actions workflow to .github/workflows/"
Write-Host "  4. Build and test Docker image locally"
Write-Host "  5. Deploy Kubernetes manifests to cluster"
Write-Host "  6. Configure Prometheus monitoring"
Write-Host "  7. Run security scans before deployment"

Write-Host "`n"
Write-Success "DevOps Integration Chain Test Complete!"

