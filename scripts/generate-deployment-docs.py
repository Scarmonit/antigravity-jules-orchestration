#!/usr/bin/env python3
"""
Generate Deployment Documentation PDF
Domain Migration: antigravity-jules-orchestration.onrender.com -> scarmonit.com
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors
from datetime import datetime
import os

def create_deployment_pdf():
    # Output path
    output_path = os.path.join(os.path.dirname(__file__), '..', 'docs', 'DEPLOYMENT_DOCUMENTATION.pdf')

    # Create the PDF
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )

    # Styles
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        spaceAfter=30,
        textColor=HexColor('#1a1a2e')
    )

    heading1_style = ParagraphStyle(
        'CustomHeading1',
        parent=styles['Heading1'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12,
        textColor=HexColor('#16213e')
    )

    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=13,
        spaceBefore=15,
        spaceAfter=8,
        textColor=HexColor('#0f3460')
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=8,
        leading=14
    )

    code_style = ParagraphStyle(
        'Code',
        parent=styles['Normal'],
        fontSize=9,
        fontName='Courier',
        backColor=HexColor('#f5f5f5'),
        spaceAfter=8,
        leftIndent=20
    )

    # Document content
    story = []

    # Title
    story.append(Paragraph("Jules MCP Server - Deployment Documentation", title_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y')}", body_style))
    story.append(Spacer(1, 20))

    # Domain Migration Section
    story.append(Paragraph("1. Domain Migration Summary", heading1_style))
    story.append(Paragraph(
        "This document details the production domain migration from the Render platform URL to the custom Scarmonit domain.",
        body_style
    ))

    migration_data = [
        ['Property', 'Previous', 'Current'],
        ['Production URL', 'antigravity-jules-orchestration.onrender.com', 'scarmonit.com'],
        ['Health Endpoint', '/health', '/health'],
        ['MCP Tools Endpoint', '/mcp/tools', '/mcp/tools'],
        ['MCP Execute Endpoint', '/mcp/execute', '/mcp/execute'],
        ['SSL/TLS', 'Render Managed', 'Cloudflare Managed'],
        ['CDN', 'None', 'Cloudflare'],
    ]

    migration_table = Table(migration_data, colWidths=[1.5*inch, 2.5*inch, 2*inch])
    migration_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#f8f9fa')),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#dee2e6')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    story.append(migration_table)
    story.append(Spacer(1, 20))

    # Architecture Section
    story.append(Paragraph("2. Production Architecture", heading1_style))

    arch_data = [
        ['Layer', 'Technology', 'Purpose'],
        ['DNS', 'Cloudflare', 'Domain management, SSL termination'],
        ['CDN/Proxy', 'Cloudflare', 'DDoS protection, caching, edge routing'],
        ['Hosting', 'Render', 'Container hosting, auto-deploy'],
        ['Runtime', 'Node.js 18+', 'MCP server execution'],
        ['API', 'Express.js', 'HTTP endpoints, routing'],
        ['External', 'Google Jules API', 'AI coding sessions'],
    ]

    arch_table = Table(arch_data, colWidths=[1.5*inch, 1.8*inch, 2.7*inch])
    arch_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#16213e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#ffffff')),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#dee2e6')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    story.append(arch_table)
    story.append(Spacer(1, 20))

    # API Endpoints Section
    story.append(Paragraph("3. API Endpoints", heading1_style))

    story.append(Paragraph("3.1 Health Check", heading2_style))
    story.append(Paragraph("GET https://scarmonit.com/health", code_style))
    story.append(Paragraph(
        "Returns server health status, version, and configuration state. Used for monitoring and load balancer health checks.",
        body_style
    ))

    story.append(Paragraph("3.2 MCP Tools List", heading2_style))
    story.append(Paragraph("GET https://scarmonit.com/mcp/tools", code_style))
    story.append(Paragraph(
        "Returns list of available MCP tools: jules_list_sources, jules_create_session, jules_list_sessions, jules_get_session, jules_send_message, jules_approve_plan, jules_get_activities.",
        body_style
    ))

    story.append(Paragraph("3.3 MCP Execute", heading2_style))
    story.append(Paragraph("POST https://scarmonit.com/mcp/execute", code_style))
    story.append(Paragraph(
        "Executes MCP tools. Requires X-API-Key header for write operations. Request body: {tool: string, parameters: object}.",
        body_style
    ))

    story.append(PageBreak())

    # Configuration Section
    story.append(Paragraph("4. Environment Configuration", heading1_style))

    env_data = [
        ['Variable', 'Required', 'Description'],
        ['JULES_API_KEY', 'Yes', 'Google Jules API authentication key'],
        ['GOOGLE_APPLICATION_CREDENTIALS_JSON', 'Alt', 'Service account JSON (alternative to API key)'],
        ['PORT', 'No', 'Server port (default: 3323)'],
        ['ALLOWED_ORIGINS', 'No', 'CORS allowed origins (comma-separated)'],
        ['NODE_ENV', 'No', 'Environment (production/development)'],
    ]

    env_table = Table(env_data, colWidths=[2.5*inch, 0.8*inch, 2.7*inch])
    env_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#0f3460')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#f8f9fa')),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#dee2e6')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    story.append(env_table)
    story.append(Spacer(1, 20))

    # Files Updated Section
    story.append(Paragraph("5. Files Updated in Migration", heading1_style))
    story.append(Paragraph(
        "The following files were updated to reference the new production domain (scarmonit.com):",
        body_style
    ))

    files_updated = [
        "CLAUDE.md - Project configuration",
        "index.js - CORS ALLOWED_ORIGINS",
        "antigravity-mcp-config.json - MCP config",
        "DEPLOYMENT.md - Deployment guide",
        "INTEGRATION.md - Integration guide",
        ".github/workflows/health-check.yml - CI/CD",
        "scripts/*.ps1 - PowerShell scripts (12 files)",
        "scripts/*.sh - Shell scripts (2 files)",
        "scripts/*.js - JavaScript scripts (1 file)",
        "docs/*.md - Documentation files (8 files)",
    ]

    for f in files_updated:
        story.append(Paragraph(f"  - {f}", body_style))

    story.append(Spacer(1, 20))

    # Verification Section
    story.append(Paragraph("6. Deployment Verification", heading1_style))

    story.append(Paragraph("6.1 Health Check Verification", heading2_style))
    story.append(Paragraph("curl https://scarmonit.com/health", code_style))
    story.append(Paragraph('Expected: {"status":"ok","version":"2.3.0",...}', body_style))

    story.append(Paragraph("6.2 MCP Tools Verification", heading2_style))
    story.append(Paragraph("curl https://scarmonit.com/mcp/tools", code_style))
    story.append(Paragraph('Expected: {"tools":[...7 jules tools...]}', body_style))

    story.append(Paragraph("6.3 SSL/TLS Verification", heading2_style))
    story.append(Paragraph("curl -I https://scarmonit.com", code_style))
    story.append(Paragraph('Expected: HTTP/2 200, valid SSL certificate from Cloudflare', body_style))

    story.append(Spacer(1, 20))

    # Contact Section
    story.append(Paragraph("7. Support & Monitoring", heading1_style))
    story.append(Paragraph(
        "Production URL: https://scarmonit.com",
        body_style
    ))
    story.append(Paragraph(
        "Health Dashboard: https://dashboard.render.com",
        body_style
    ))
    story.append(Paragraph(
        "DNS Management: https://dash.cloudflare.com",
        body_style
    ))
    story.append(Paragraph(
        "Repository: https://github.com/scarmonit/antigravity-jules-orchestration",
        body_style
    ))

    # Build the PDF
    doc.build(story)
    print(f"PDF generated: {output_path}")
    return output_path

if __name__ == "__main__":
    create_deployment_pdf()
