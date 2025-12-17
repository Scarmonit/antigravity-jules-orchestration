#!/usr/bin/env python3
"""
Generate PDF Documentation for Rate Limiter Middleware
Uses reportlab to create professional documentation
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Preformatted, Image
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from datetime import datetime
import os

def create_rate_limiter_docs():
    """Generate the rate limiter documentation PDF."""

    # Output path
    output_path = os.path.join(os.path.dirname(__file__), '..', 'docs', 'rate-limiter-documentation.pdf')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        name='MainTitle',
        parent=styles['Title'],
        fontSize=28,
        spaceAfter=30,
        textColor=HexColor('#1a1a2e')
    ))

    styles.add(ParagraphStyle(
        name='SectionTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceBefore=20,
        spaceAfter=12,
        textColor=HexColor('#16213e')
    ))

    styles.add(ParagraphStyle(
        name='SubSection',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=15,
        spaceAfter=8,
        textColor=HexColor('#0f3460')
    ))

    styles.add(ParagraphStyle(
        name='CodeBlock',
        parent=styles['Code'],
        fontSize=9,
        leftIndent=20,
        backColor=HexColor('#f4f4f4'),
        borderPadding=10
    ))

    story = []

    # ========== COVER PAGE ==========
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("Redis Rate Limiter", styles['MainTitle']))
    story.append(Paragraph("Production Documentation", styles['Heading2']))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("Token Bucket Algorithm with Distributed State", styles['Normal']))
    story.append(Spacer(1, inch))
    story.append(Paragraph(f"Version 1.0.0", styles['Normal']))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    story.append(Paragraph("Jules MCP Server - Antigravity Orchestration", styles['Normal']))
    story.append(PageBreak())

    # ========== TABLE OF CONTENTS ==========
    story.append(Paragraph("Table of Contents", styles['SectionTitle']))
    toc_data = [
        ["1.", "Architecture Overview", "3"],
        ["2.", "Tier Configuration", "4"],
        ["3.", "Integration Guide", "5"],
        ["4.", "Security Audit Results", "6"],
        ["5.", "API Reference", "7"],
        ["6.", "Metrics & Monitoring", "8"],
    ]
    toc_table = Table(toc_data, colWidths=[0.5*inch, 4*inch, 0.5*inch])
    toc_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # ========== 1. ARCHITECTURE OVERVIEW ==========
    story.append(Paragraph("1. Architecture Overview", styles['SectionTitle']))

    story.append(Paragraph("System Architecture", styles['SubSection']))
    story.append(Paragraph(
        "The rate limiter implements a distributed token bucket algorithm using Redis "
        "for state management. It supports per-API-key rate limiting with tiered configurations "
        "and graceful failover to local memory when Redis is unavailable.",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.3*inch))

    # ASCII Architecture Diagram
    arch_diagram = """
    ┌─────────────────────────────────────────────────────────────────┐
    │                     CLIENT REQUEST                               │
    │                           │                                      │
    │                           ▼                                      │
    │              ┌────────────────────────┐                         │
    │              │   Express Middleware    │                         │
    │              │   (rateLimiter.js)      │                         │
    │              └────────────────────────┘                         │
    │                           │                                      │
    │              ┌────────────┴────────────┐                        │
    │              ▼                         ▼                         │
    │   ┌──────────────────┐     ┌──────────────────┐                │
    │   │  Extract API Key  │     │  Get Tier Config  │                │
    │   │  (SHA-256 Hash)   │     │  (free/pro/ent)   │                │
    │   └──────────────────┘     └──────────────────┘                │
    │              │                         │                         │
    │              └────────────┬────────────┘                        │
    │                           ▼                                      │
    │              ┌────────────────────────┐                         │
    │              │     Redis Check         │                         │
    │              │   (Lua Token Bucket)    │◄──────┐                │
    │              └────────────────────────┘       │                 │
    │                      │    │                    │                 │
    │           Connected? │    │ Disconnected       │                 │
    │                      ▼    ▼                    │                 │
    │   ┌──────────────────┐  ┌──────────────────┐  │                 │
    │   │   Redis Cluster   │  │  Failover Cache  │  │                 │
    │   │  (Atomic Lua Ops) │  │  (Local Memory)  │  │                 │
    │   └──────────────────┘  └──────────────────┘  │                 │
    │              │                   │             │                 │
    │              └─────────┬─────────┘             │                 │
    │                        ▼                       │                 │
    │              ┌────────────────────────┐       │                 │
    │              │   Rate Limit Decision   │───────┘                │
    │              │   (Allow / Deny)        │                         │
    │              └────────────────────────┘                         │
    │                        │                                         │
    │           ┌────────────┴────────────┐                           │
    │           ▼                         ▼                            │
    │   ┌──────────────┐         ┌──────────────────┐                 │
    │   │   200 OK      │         │   429 Too Many   │                 │
    │   │ + RateLimit   │         │   + Retry-After  │                 │
    │   │   Headers     │         │   + Error JSON   │                 │
    │   └──────────────┘         └──────────────────┘                 │
    └─────────────────────────────────────────────────────────────────┘
    """

    story.append(Paragraph("Architecture Diagram", styles['SubSection']))
    story.append(Preformatted(arch_diagram, styles['Code']))
    story.append(PageBreak())

    # ========== 2. TIER CONFIGURATION ==========
    story.append(Paragraph("2. Tier Configuration", styles['SectionTitle']))

    story.append(Paragraph(
        "The rate limiter supports three tiers with configurable limits. Each tier uses "
        "the token bucket algorithm with different refill rates and burst capacities.",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.2*inch))

    # Tier Configuration Table
    tier_data = [
        ["Tier", "Requests/Min", "Burst Capacity", "Refill Rate", "Window", "Bypass"],
        ["Free", "100", "150", "1.67/sec", "60s", "No"],
        ["Pro", "1,000", "1,500", "16.67/sec", "60s", "No"],
        ["Enterprise", "10,000", "15,000", "166.67/sec", "60s", "Yes"],
    ]

    tier_table = Table(tier_data, colWidths=[1.1*inch, 1.1*inch, 1.1*inch, 1*inch, 0.7*inch, 0.7*inch])
    tier_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#16213e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, 1), HexColor('#e8f4f8')),
        ('BACKGROUND', (0, 2), (-1, 2), HexColor('#d4edda')),
        ('BACKGROUND', (0, 3), (-1, 3), HexColor('#fff3cd')),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
    ]))
    story.append(tier_table)
    story.append(Spacer(1, 0.3*inch))

    # Endpoint-specific limits
    story.append(Paragraph("Endpoint-Specific Overrides", styles['SubSection']))
    endpoint_data = [
        ["Endpoint", "Free", "Pro", "Enterprise", "Cost Multiplier"],
        ["/mcp/execute", "20/min", "200/min", "2,000/min", "5x / 2x / 1x"],
        ["/api/sessions", "10/min", "100/min", "1,000/min", "10x / 5x / 1x"],
    ]

    endpoint_table = Table(endpoint_data, colWidths=[1.5*inch, 0.9*inch, 0.9*inch, 1*inch, 1.3*inch])
    endpoint_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#0f3460')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(endpoint_table)
    story.append(PageBreak())

    # ========== 3. INTEGRATION GUIDE ==========
    story.append(Paragraph("3. Integration Guide", styles['SectionTitle']))

    story.append(Paragraph("Quick Start", styles['SubSection']))

    integration_code = """
// 1. Import the rate limiter integration module
import {
  initializeRateLimiter,
  getRateLimiterMiddleware,
  getRateLimiterMetrics
} from './middleware/rateLimiterIntegration.js';

// 2. Initialize during application startup
await initializeRateLimiter();

// 3. Apply middleware to protected routes
app.use('/mcp/', getRateLimiterMiddleware());
app.use('/api/', getRateLimiterMiddleware());

// 4. Add metrics endpoint
app.get('/api/rate-limit/metrics', (req, res) => {
  res.json(getRateLimiterMetrics());
});

// 5. Graceful shutdown
process.on('SIGTERM', async () => {
  await closeRateLimiter();
  process.exit(0);
});
"""
    story.append(Preformatted(integration_code, styles['Code']))
    story.append(Spacer(1, 0.2*inch))

    story.append(Paragraph("Environment Variables", styles['SubSection']))
    env_data = [
        ["Variable", "Description", "Default"],
        ["REDIS_URL", "Redis connection string", "redis://localhost:6379"],
        ["RATE_LIMIT_FAILOVER", "Failover strategy", "fail-closed"],
    ]
    env_table = Table(env_data, colWidths=[1.8*inch, 2.5*inch, 1.5*inch])
    env_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#16213e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(env_table)
    story.append(Spacer(1, 0.2*inch))

    story.append(Paragraph("Response Headers", styles['SubSection']))
    headers_data = [
        ["Header", "Description", "Example"],
        ["RateLimit-Limit", "Maximum requests per window", "100"],
        ["RateLimit-Remaining", "Requests remaining in window", "42"],
        ["RateLimit-Reset", "Unix timestamp when window resets", "1702814460"],
        ["Retry-After", "Seconds until next request allowed", "45"],
        ["X-RateLimit-*", "Legacy headers (backward compat)", "Same as above"],
    ]
    headers_table = Table(headers_data, colWidths=[1.5*inch, 2.5*inch, 1.2*inch])
    headers_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#0f3460')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(headers_table)
    story.append(PageBreak())

    # ========== 4. SECURITY AUDIT RESULTS ==========
    story.append(Paragraph("4. Security Audit Results", styles['SectionTitle']))

    story.append(Paragraph(
        "A comprehensive security audit was performed on the rate limiter implementation. "
        "The following areas were analyzed:",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.2*inch))

    # Security findings table
    security_data = [
        ["Category", "Status", "Details"],
        ["API Key Handling", "SECURE", "SHA-256 hashing, no plaintext storage"],
        ["Redis Connection", "SECURE", "Supports TLS via REDIS_URL, auth included"],
        ["Input Validation", "SECURE", "All inputs sanitized, hashed before use"],
        ["DoS Protection", "SECURE", "Cache size limits, LRU eviction"],
        ["Information Disclosure", "LOW RISK", "Tier info in responses (acceptable)"],
        ["Race Conditions", "MITIGATED", "Atomic Lua scripts in Redis"],
        ["Memory Safety", "FIXED", "Added LRU eviction to tier cache"],
    ]

    security_table = Table(security_data, colWidths=[1.5*inch, 1*inch, 3*inch])
    security_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#16213e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        # Status column coloring
        ('BACKGROUND', (1, 1), (1, 1), HexColor('#d4edda')),
        ('BACKGROUND', (1, 2), (1, 2), HexColor('#d4edda')),
        ('BACKGROUND', (1, 3), (1, 3), HexColor('#d4edda')),
        ('BACKGROUND', (1, 4), (1, 4), HexColor('#d4edda')),
        ('BACKGROUND', (1, 5), (1, 5), HexColor('#fff3cd')),
        ('BACKGROUND', (1, 6), (1, 6), HexColor('#d4edda')),
        ('BACKGROUND', (1, 7), (1, 7), HexColor('#d4edda')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(security_table)
    story.append(Spacer(1, 0.3*inch))

    story.append(Paragraph("Vulnerabilities Checked", styles['SubSection']))
    vuln_checks = [
        "SQL Injection - N/A (no SQL queries)",
        "XSS - N/A (JSON-only responses)",
        "CSRF - N/A (API key authentication)",
        "Timing Attacks - Mitigated by key hashing",
        "Denial of Service - Protected by rate limiting itself",
        "Redis Injection - Prevented by parameterized Lua scripts",
    ]
    for check in vuln_checks:
        story.append(Paragraph(f"✓ {check}", styles['Normal']))
    story.append(PageBreak())

    # ========== 5. API REFERENCE ==========
    story.append(Paragraph("5. API Reference", styles['SectionTitle']))

    story.append(Paragraph("RedisRateLimiter Class", styles['SubSection']))

    api_data = [
        ["Method", "Parameters", "Returns", "Description"],
        ["initialize()", "None", "Promise<boolean>", "Connect to Redis, load Lua script"],
        ["middleware()", "None", "Express middleware", "Create rate limiting middleware"],
        ["getTier(apiKey)", "string", "Promise<string>", "Get tier for API key"],
        ["setTier(apiKey, tier)", "string, string", "Promise<boolean>", "Set tier for API key"],
        ["getMetrics()", "None", "object", "Get current metrics"],
        ["close()", "None", "Promise<void>", "Close Redis connection"],
    ]

    api_table = Table(api_data, colWidths=[1.3*inch, 1.2*inch, 1.3*inch, 2*inch])
    api_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#16213e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(api_table)
    story.append(Spacer(1, 0.3*inch))

    story.append(Paragraph("Error Response Format", styles['SubSection']))
    error_json = """
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. You have made too many requests.",
    "type": "https://api.example.com/errors/rate-limit-exceeded"
  },
  "rateLimit": {
    "limit": 100,
    "remaining": 0,
    "reset": 1702814460,
    "retryAfter": 45,
    "tier": "free"
  },
  "requestId": "req_1702814415_abc123",
  "timestamp": "2025-12-16T22:20:15.000Z",
  "help": {
    "message": "Please wait 45 seconds before making another request.",
    "documentationUrl": "https://docs.api.example.com/rate-limits"
  }
}
"""
    story.append(Preformatted(error_json, styles['Code']))
    story.append(PageBreak())

    # ========== 6. METRICS & MONITORING ==========
    story.append(Paragraph("6. Metrics & Monitoring", styles['SectionTitle']))

    story.append(Paragraph(
        "The rate limiter exposes Prometheus-ready metrics for monitoring. "
        "Access metrics via the /api/rate-limit/metrics endpoint.",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.2*inch))

    metrics_data = [
        ["Metric", "Type", "Description"],
        ["totalRequests", "Counter", "Total requests processed"],
        ["allowedRequests", "Counter", "Requests allowed through"],
        ["deniedRequests", "Counter", "Requests denied (429)"],
        ["redisErrors", "Counter", "Redis connection errors"],
        ["failoverActivations", "Counter", "Failover mode activations"],
        ["requestsByTier", "Counter", "Requests per tier (free/pro/enterprise)"],
        ["redisConnected", "Gauge", "Redis connection status"],
        ["failoverCacheSize", "Gauge", "Current failover cache size"],
        ["allowRate", "Gauge", "Percentage of allowed requests"],
        ["denyRate", "Gauge", "Percentage of denied requests"],
        ["requestsPerSecond", "Gauge", "Current request throughput"],
    ]

    metrics_table = Table(metrics_data, colWidths=[1.5*inch, 0.8*inch, 3.5*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#16213e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(metrics_table)
    story.append(Spacer(1, 0.3*inch))

    story.append(Paragraph("Recommended Alerts", styles['SubSection']))
    alerts = [
        ("High Deny Rate", "> 10%", "Indicates potential abuse or misconfigured limits"),
        ("Redis Disconnected", "redisConnected = false", "Rate limiter in failover mode"),
        ("High Failover Cache", "> 5000 entries", "Memory pressure during Redis outage"),
        ("Error Rate Spike", "> 5 errors/min", "Redis connection issues"),
    ]
    for name, condition, description in alerts:
        story.append(Paragraph(f"<b>{name}</b> ({condition}): {description}", styles['Normal']))

    story.append(Spacer(1, 0.5*inch))

    # Footer
    story.append(Paragraph(
        "━" * 60,
        styles['Normal']
    ))
    story.append(Paragraph(
        f"Generated by Claude Code on {datetime.now().strftime('%Y-%m-%d')} | "
        "Jules MCP Server v2.4.0 | Antigravity Orchestration",
        ParagraphStyle(name='Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey)
    ))

    # Build PDF
    doc.build(story)
    print(f"PDF generated: {output_path}")
    return output_path

if __name__ == "__main__":
    create_rate_limiter_docs()
