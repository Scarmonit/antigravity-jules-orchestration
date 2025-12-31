// dashboard/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { RateLimiterMetrics } from './RateLimiterMetrics';
import SessionMetrics from './components/SessionMetrics';
import PerformanceMetrics from './components/PerformanceMetrics';
import ErrorMetrics from './components/ErrorMetrics';
import useMetrics from './hooks/useMetrics';

// Status color and icon maps - defined outside component to avoid recreation
const STATUS_COLORS = {
  pending: '#ffa500',
  running: '#2196f3',
  awaiting_approval: '#ff9800',
  executing: '#4caf50',
  completed: '#4caf50',
  failed: '#f44336'
};

const STATUS_ICONS = {
  pending: '⏳',
  running: '🔄',
  awaiting_approval: '⏸️',
  executing: '⚡',
  completed: '✅',
  failed: '❌'
};

function App() {
  const [workflows, setWorkflows] = useState([]);
  const [executingWorkflow, setExecutingWorkflow] = useState(null);
  const [activeTab, setActiveTab] = useState('workflows'); // 'workflows' | 'metrics'

  // Use metrics hook for real-time metrics data (single WebSocket connection)
  const {
    metrics,
    loading: metricsLoading,
    connected: wsConnected,
    refresh: refreshMetrics
  } = useMetrics('wss://agent.scarmonit.com/ws', '');

  // Derive stats from metrics (avoid duplicate state)
  const stats = metrics.stats;

  useEffect(() => {
    // Fetch initial workflows only (WebSocket handled by useMetrics hook)
    fetch('/api/v1/workflows')
      .then(res => res.json())
      .then(data => setWorkflows(data))
      .catch(err => {
        console.error('Failed to fetch workflows:', err);
        setWorkflows([]);
      });
  }, []);

  // Memoized callback to prevent recreation on every render
  const executeWorkflow = useCallback(async (templateName, context) => {
    setExecutingWorkflow(templateName);
    try {
      const response = await fetch('/api/v1/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_name: templateName, context })
      });
      const data = await response.json();
      console.log(`Workflow ${data.workflow_id} started`); // Replace alert with console
    } catch (err) {
      console.error('Failed to execute workflow:', err);
    } finally {
      setExecutingWorkflow(null);
    }
  }, []);

  // Memoized helper functions - O(1) lookup
  const getStatusColor = useCallback((status) => STATUS_COLORS[status] || '#999', []);
  const getStatusIcon = useCallback((status) => STATUS_ICONS[status] || '•', []);

  return (
    <div className="App">
      <header>
        <div className="header-top">
          <h1>🤖 Jules Orchestrator</h1>
          <div className="connection-status">
            <span
              className={`status-indicator ${wsConnected ? 'connected' : 'disconnected'}`}
              aria-hidden="true"
            />
            {wsConnected ? 'Live' : 'Polling'}
          </div>
        </div>
        <nav className="tab-nav" role="tablist" aria-label="Dashboard Sections">
          <button
            id="tab-workflows"
            role="tab"
            aria-selected={activeTab === 'workflows'}
            aria-controls="panel-workflows"
            className={`tab-btn ${activeTab === 'workflows' ? 'active' : ''}`}
            onClick={() => setActiveTab('workflows')}
          >
            📋 Workflows
          </button>
          <button
            id="tab-metrics"
            role="tab"
            aria-selected={activeTab === 'metrics'}
            aria-controls="panel-metrics"
            className={`tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            📊 Metrics
          </button>
        </nav>
        <div className="stats">
          <div className="stat">
            <span className="label">Total</span>
            <span className="value">{stats.total}</span>
          </div>
          <div className="stat">
            <span className="label">Running</span>
            <span className="value running">{stats.running}</span>
          </div>
          <div className="stat">
            <span className="label">Completed</span>
            <span className="value completed">{stats.completed}</span>
          </div>
          <div className="stat">
            <span className="label">Failed</span>
            <span className="value failed">{stats.failed}</span>
          </div>
        </div>
      </header>

      <main>
        {activeTab === 'workflows' && (
          <div
            id="panel-workflows"
            role="tabpanel"
            aria-labelledby="tab-workflows"
          >
            <RateLimiterMetrics />
            <section className="quick-actions">
              <h2>Quick Actions</h2>
              <div className="action-buttons">
                <button
                  onClick={() => executeWorkflow('dependency-update', { repo_name: 'scarmonit/jules-orchestrator' })}
                  disabled={executingWorkflow === 'dependency-update'}
                  aria-label="Update project dependencies"
                >
                  {executingWorkflow === 'dependency-update' ? '⏳ Starting...' : '📦 Update Dependencies'}
                </button>
                <button
                  onClick={() => executeWorkflow('documentation-sync', { repo_name: 'scarmonit/jules-orchestrator' })}
                  disabled={executingWorkflow === 'documentation-sync'}
                  aria-label="Synchronize documentation"
                >
                  {executingWorkflow === 'documentation-sync' ? '⏳ Syncing...' : '📝 Sync Docs'}
                </button>
                <button
                  onClick={() => executeWorkflow('security-patch', { repo_name: 'scarmonit/jules-orchestrator' })}
                  disabled={executingWorkflow === 'security-patch'}
                  aria-label="Run security scan"
                >
                  {executingWorkflow === 'security-patch' ? '⏳ Scanning...' : '🔒 Security Scan'}
                </button>
              </div>
            </section>

            <section className="workflows">
              <h2>Active Workflows</h2>
              <div className="workflow-list">
                {workflows.map(workflow => (
                  <div key={workflow.id} className="workflow-card">
                    <div className="workflow-header">
                      <span
                        className="workflow-icon"
                        style={{ color: getStatusColor(workflow.status) }}
                        role="img"
                        aria-label={`Status: ${workflow.status}`}
                      >
                        {getStatusIcon(workflow.status)}
                      </span>
                      <div className="workflow-info">
                        <h3>{workflow.context_json.repo_name}</h3>
                        <p className="workflow-title">{workflow.context_json.issue_title || workflow.template_name}</p>
                      </div>
                      <span className="workflow-status" style={{ backgroundColor: getStatusColor(workflow.status) }}>
                        {workflow.status}
                      </span>
                    </div>

                    <div className="workflow-details">
                      <div className="detail">
                        <span className="detail-label">Template:</span>
                        <span>{workflow.template_name}</span>
                      </div>
                      <div className="detail">
                        <span className="detail-label">Created:</span>
                        <span>{new Date(workflow.created_at).toLocaleString()}</span>
                      </div>
                      {workflow.pr_url && (
                        <div className="detail">
                          <a href={workflow.pr_url} target="_blank" rel="noopener noreferrer">
                            View PR →
                          </a>
                        </div>
                      )}
                    </div>

                    {workflow.status === 'awaiting_approval' && (
                      <div className="workflow-actions">
                        <button className="approve" aria-label="Approve workflow">✓ Approve</button>
                        <button className="reject" aria-label="Reject workflow">✗ Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="templates">
              <h2>Workflow Templates</h2>
              <div className="template-grid">
                <div className="template-card">
                  <h3>🐛 Bug Fix</h3>
                  <p>Auto-fix from labeled issues</p>
                  <span className="template-trigger">Trigger: bug-auto label</span>
                </div>
                <div className="template-card">
                  <h3>✨ Feature</h3>
                  <p>Implement feature from spec</p>
                  <span className="template-trigger">Trigger: @tools\jules-mcp\dist\client\jules-client.js implement</span>
                </div>
                <div className="template-card">
                  <h3>📦 Dependencies</h3>
                  <p>Weekly update check</p>
                  <span className="template-trigger">Trigger: Monday 2 AM</span>
                </div>
                <div className="template-card">
                  <h3>🔒 Security</h3>
                  <p>Patch vulnerabilities</p>
                  <span className="template-trigger">Trigger: Scanner alert</span>
                </div>
                <div className="template-card">
                  <h3>📝 Docs</h3>
                  <p>Sync documentation</p>
                  <span className="template-trigger">Trigger: main push</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div
            className="metrics-dashboard"
            id="panel-metrics"
            role="tabpanel"
            aria-labelledby="tab-metrics"
          >
            <div className="metrics-header">
              <h2>System Metrics</h2>
              <button
                className="refresh-btn"
                onClick={refreshMetrics}
                disabled={metricsLoading}
              >
                {metricsLoading ? '⏳ Loading...' : '🔄 Refresh'}
              </button>
            </div>

            <SessionMetrics
              sessions={metrics.sessions}
              stats={metrics.stats}
            />

            <PerformanceMetrics
              performance={metrics.performance}
            />

            <ErrorMetrics
              errors={metrics.errors}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
