#!/usr/bin/env python3
"""
Generate PDF documentation from COMMANDS_REFERENCE.md
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.lib import colors
from datetime import datetime
import os

# Colors
PRIMARY_COLOR = HexColor('#2563eb')
SECONDARY_COLOR = HexColor('#64748b')
CODE_BG = HexColor('#f1f5f9')

def create_styles():
    """Create custom paragraph styles."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        'CustomTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=PRIMARY_COLOR,
        spaceAfter=20,
        alignment=1  # Center
    ))

    styles.add(ParagraphStyle(
        'CustomHeading1',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=PRIMARY_COLOR,
        spaceBefore=20,
        spaceAfter=10,
        borderPadding=(0, 0, 5, 0),
        borderWidth=0,
        borderColor=PRIMARY_COLOR
    ))

    styles.add(ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=13,
        textColor=HexColor('#1e40af'),
        spaceBefore=15,
        spaceAfter=8
    ))

    styles.add(ParagraphStyle(
        'CodeBlock',
        parent=styles['Code'],
        fontSize=9,
        fontName='Courier',
        backColor=CODE_BG,
        borderPadding=8,
        spaceBefore=5,
        spaceAfter=5
    ))

    styles.add(ParagraphStyle(
        'BulletItem',
        parent=styles['Normal'],
        fontSize=10,
        leftIndent=20,
        spaceBefore=3,
        spaceAfter=3
    ))

    styles.add(ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=SECONDARY_COLOR,
        alignment=1
    ))

    return styles

def create_pdf():
    """Generate the PDF document."""
    output_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'docs',
        'COMMANDS_REFERENCE.pdf'
    )

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    styles = create_styles()
    story = []

    # Title Page
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph('Slash Commands Reference', styles['CustomTitle']))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph(
        '<b>antigravity-jules-orchestration</b>',
        ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=14, alignment=1, textColor=SECONDARY_COLOR)
    ))
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph(
        f'Version 2.5.0 | Generated: {datetime.now().strftime("%Y-%m-%d")}',
        styles['Footer']
    ))
    story.append(PageBreak())

    # Table of Contents
    story.append(Paragraph('Table of Contents', styles['CustomHeading1']))
    toc_items = [
        '1. Core Commands',
        '   - /status, /quick-fix, /session, /batch',
        '2. Workflow Commands',
        '   - /audit, /deploy-check, /implement-feature, /fix-issues',
        '3. Security & Testing',
        '   - /security, /test',
        '4. Utility Commands',
        '   - /learn-pattern, /generate-command',
        '5. Quick Reference Table',
        '6. Recommended Workflows',
        '7. MCP Tools Integration',
    ]
    for item in toc_items:
        story.append(Paragraph(item, styles['BulletItem']))
    story.append(PageBreak())

    # Core Commands Section
    story.append(Paragraph('1. Core Commands', styles['CustomHeading1']))

    # /status
    story.append(Paragraph('/status', styles['CustomHeading2']))
    story.append(Paragraph(
        'Get a comprehensive overview of all Jules sessions, system health, and orchestration status.',
        styles['Normal']
    ))
    story.append(Paragraph('<font face="Courier">/status</font>', styles['CodeBlock']))
    story.append(Paragraph('<b>Output:</b>', styles['Normal']))
    for item in ['Active sessions with state', 'Session statistics (total, completed, in progress, failed)',
                 'System health (circuit breaker, cache, rate limits)', 'Quick action suggestions']:
        story.append(Paragraph(f'&bull; {item}', styles['BulletItem']))
    story.append(Spacer(1, 0.2*inch))

    # /quick-fix
    story.append(Paragraph('/quick-fix [file] [description]', styles['CustomHeading2']))
    story.append(Paragraph(
        'Fast, streamlined workflow for single-file fixes using Jules autonomous coding.',
        styles['Normal']
    ))
    story.append(Paragraph(
        '<font face="Courier">/quick-fix src/api/auth.js "Add rate limiting"</font>',
        styles['CodeBlock']
    ))
    story.append(Paragraph('<b>Features:</b>', styles['Normal']))
    for item in ['Auto-selects repository', 'Creates focused session', 'Skips plan approval for speed', 'Auto-creates PR']:
        story.append(Paragraph(f'&bull; {item}', styles['BulletItem']))
    story.append(Spacer(1, 0.2*inch))

    # /session
    story.append(Paragraph('/session [id] [action]', styles['CustomHeading2']))
    story.append(Paragraph('Quick session management for Jules coding sessions.', styles['Normal']))
    story.append(Paragraph(
        '<font face="Courier">/session ses_abc123 approve</font>',
        styles['CodeBlock']
    ))
    story.append(Paragraph('<b>Actions:</b> view (default), approve, cancel, retry, diff', styles['Normal']))
    story.append(Spacer(1, 0.2*inch))

    # /batch
    story.append(Paragraph('/batch [label] [repo?]', styles['CustomHeading2']))
    story.append(Paragraph('Quick batch session creation from GitHub issue labels.', styles['Normal']))
    story.append(Paragraph(
        '<font face="Courier">/batch jules-auto</font>',
        styles['CodeBlock']
    ))
    story.append(Paragraph('<b>Common Labels:</b> jules-auto, bug, enhancement, security', styles['Normal']))
    story.append(PageBreak())

    # Workflow Commands Section
    story.append(Paragraph('2. Workflow Commands', styles['CustomHeading1']))

    # /audit
    story.append(Paragraph('/audit', styles['CustomHeading2']))
    story.append(Paragraph('Run a comprehensive parallel audit of the entire repository.', styles['Normal']))
    story.append(Paragraph('<b>Parallel Agents:</b>', styles['Normal']))
    agents = [
        'Security Audit - vulnerabilities, secrets, auth patterns',
        'Code Quality Review - error handling, async patterns, style',
        'Dependency Analysis - outdated, vulnerabilities, unused',
        'API Endpoint Review - validation, status codes, rate limiting',
        'Documentation Completeness - accuracy, coverage'
    ]
    for i, agent in enumerate(agents, 1):
        story.append(Paragraph(f'{i}. {agent}', styles['BulletItem']))
    story.append(Spacer(1, 0.2*inch))

    # /deploy-check
    story.append(Paragraph('/deploy-check', styles['CustomHeading2']))
    story.append(Paragraph('Pre-deployment validation with live health checks.', styles['Normal']))
    story.append(Paragraph('<b>Checks:</b>', styles['Normal']))
    for item in ['Git status (uncommitted changes)', 'All tests passing', 'No high/critical vulnerabilities',
                 'Health endpoint responding', 'All services configured']:
        story.append(Paragraph(f'&bull; {item}', styles['BulletItem']))
    story.append(Spacer(1, 0.2*inch))

    # /implement-feature
    story.append(Paragraph('/implement-feature [description]', styles['CustomHeading2']))
    story.append(Paragraph('Feature implementation workflow with planning.', styles['Normal']))
    story.append(Paragraph(
        '<font face="Courier">/implement-feature "Add webhook retry mechanism"</font>',
        styles['CodeBlock']
    ))
    story.append(Paragraph('<b>Steps:</b> Analyze requirements, Create plan, Generate code, Create tests, Update docs', styles['Normal']))
    story.append(Spacer(1, 0.2*inch))

    # /fix-issues
    story.append(Paragraph('/fix-issues', styles['CustomHeading2']))
    story.append(Paragraph('Auto-diagnose and fix common issues.', styles['Normal']))
    story.append(Paragraph('<b>Fixes:</b> TypeScript errors, Linting issues, Failing tests, Outdated dependencies, Missing imports', styles['Normal']))
    story.append(PageBreak())

    # Security & Testing Section
    story.append(Paragraph('3. Security & Testing', styles['CustomHeading1']))

    # /security
    story.append(Paragraph('/security [scope]', styles['CustomHeading2']))
    story.append(Paragraph('Dedicated security scanning.', styles['Normal']))
    story.append(Paragraph(
        '<font face="Courier">/security quick</font>',
        styles['CodeBlock']
    ))
    story.append(Paragraph('<b>Scope Options:</b>', styles['Normal']))
    scopes = ['full - Complete security audit (default)', 'quick - Critical issues only',
              'deps - npm audit', 'secrets - Credential scanning', 'api - Endpoint security testing']
    for scope in scopes:
        story.append(Paragraph(f'&bull; {scope}', styles['BulletItem']))
    story.append(Spacer(1, 0.2*inch))

    # /test
    story.append(Paragraph('/test [scope] [options]', styles['CustomHeading2']))
    story.append(Paragraph('Run all tests with coverage and detailed reporting.', styles['Normal']))
    story.append(Paragraph(
        '<font face="Courier">/test all --coverage</font>',
        styles['CodeBlock']
    ))
    story.append(Paragraph('<b>Scope:</b> all (default), backend, dashboard, unit, integration', styles['Normal']))
    story.append(PageBreak())

    # Quick Reference Table
    story.append(Paragraph('4. Quick Reference Table', styles['CustomHeading1']))
    story.append(Spacer(1, 0.1*inch))

    table_data = [
        ['Command', 'Purpose', 'Example'],
        ['/status', 'System overview', '/status'],
        ['/quick-fix', 'Fast single-file fix', '/quick-fix file.js "fix"'],
        ['/session', 'Session management', '/session id approve'],
        ['/batch', 'Batch from labels', '/batch jules-auto'],
        ['/audit', 'Full audit', '/audit'],
        ['/deploy-check', 'Pre-deploy validation', '/deploy-check'],
        ['/implement-feature', 'Feature workflow', '/implement-feature "X"'],
        ['/fix-issues', 'Auto-fix problems', '/fix-issues'],
        ['/security', 'Security scan', '/security quick'],
        ['/test', 'Run tests', '/test all'],
    ]

    table = Table(table_data, colWidths=[1.5*inch, 2*inch, 2.5*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('FONTNAME', (0, 1), (0, -1), 'Courier'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, SECONDARY_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, CODE_BG]),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(PageBreak())

    # Recommended Workflows
    story.append(Paragraph('5. Recommended Workflows', styles['CustomHeading1']))

    workflows = [
        ('Daily Development', ['1. /status - Check orchestration state', '2. /quick-fix - Make targeted fixes',
                               '3. /test - Verify changes', '4. /deploy-check - Pre-deployment validation']),
        ('Batch Processing', ['1. /batch jules-auto - Process labeled issues', '2. /status - Monitor progress',
                              '3. /session [id] - Review individual sessions', '4. /session [id] approve - Approve plans']),
        ('Security Review', ['1. /security quick - Fast critical scan', '2. /security deps - Check dependencies',
                             '3. /audit - Full comprehensive audit', '4. /fix-issues - Auto-fix what\'s possible']),
        ('Feature Implementation', ['1. /implement-feature - Plan and implement', '2. /test - Verify tests pass',
                                    '3. /security - Security check', '4. /deploy-check - Ready for deployment']),
    ]

    for title, steps in workflows:
        story.append(Paragraph(title, styles['CustomHeading2']))
        for step in steps:
            story.append(Paragraph(step, styles['BulletItem']))
        story.append(Spacer(1, 0.15*inch))
    story.append(PageBreak())

    # MCP Tools Integration
    story.append(Paragraph('6. MCP Tools Integration', styles['CustomHeading1']))
    story.append(Paragraph(
        'These commands leverage the 45 MCP tools available in v2.5.0:',
        styles['Normal']
    ))
    story.append(Spacer(1, 0.1*inch))

    tool_categories = [
        ('Jules Core', 'jules_list_sources, jules_create_session, jules_list_sessions, jules_get_session, jules_send_message, jules_approve_plan, jules_get_activities'),
        ('Session Management', 'jules_cancel_session, jules_retry_session, jules_get_diff, jules_delete_session, jules_cancel_all_active'),
        ('Session Templates (NEW)', 'jules_create_template, jules_list_templates, jules_create_from_template, jules_delete_template'),
        ('Session Cloning & Search (NEW)', 'jules_clone_session, jules_search_sessions'),
        ('PR Integration (NEW)', 'jules_get_pr_status, jules_merge_pr, jules_add_pr_comment'),
        ('Session Queue (NEW)', 'jules_queue_session, jules_get_queue, jules_process_queue, jules_clear_queue'),
        ('Batch Processing', 'jules_create_from_issue, jules_batch_from_labels, jules_batch_create, jules_batch_status, jules_batch_approve_all, jules_list_batches, jules_batch_retry_failed'),
        ('Analytics (NEW)', 'jules_get_analytics'),
        ('Monitoring & Cache', 'jules_monitor_all, jules_session_timeline, jules_cache_stats, jules_clear_cache'),
        ('Ollama LLM', 'ollama_list_models, ollama_completion, ollama_code_generation, ollama_chat'),
        ('RAG', 'ollama_rag_index, ollama_rag_query, ollama_rag_status, ollama_rag_clear'),
    ]

    for category, tools in tool_categories:
        story.append(Paragraph(f'<b>{category}:</b>', styles['Normal']))
        story.append(Paragraph(f'<font face="Courier" size="8">{tools}</font>', styles['BulletItem']))
        story.append(Spacer(1, 0.08*inch))

    # Footer
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph(
        f'Generated by antigravity-jules-orchestration v2.5.0 | {datetime.now().strftime("%Y-%m-%d %H:%M")} | https://scarmonit.com',
        styles['Footer']
    ))

    # Build PDF
    doc.build(story)
    print(f'PDF generated: {output_path}')
    return output_path

if __name__ == '__main__':
    create_pdf()
