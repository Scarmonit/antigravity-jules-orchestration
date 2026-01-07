// dashboard/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { RateLimiterMetrics } from './RateLimiterMetrics';
import SessionMetrics from './components/SessionMetrics';
import PerformanceMetrics from './components/PerformanceMetrics';
import ErrorMetrics from './components/ErrorMetrics';
import useMetrics from './hooks/useMetrics';
import Header from './components/Header';
import WorkflowList from './components/workflow/WorkflowList';
import QuickActions from './components/workflow/QuickActions';
import WorkflowTemplates from './components/workflow/WorkflowTemplates';

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

  return (
    <div className="App">
      <Header
        wsConnected={wsConnected}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
      />

      <main>
        {activeTab === 'workflows' && (
          <>
            <RateLimiterMetrics />

            <QuickActions
              executeWorkflow={executeWorkflow}
              executingWorkflow={executingWorkflow}
            />

            <section className="workflows">
              <h2>Active Workflows</h2>
              <WorkflowList workflows={workflows} />
            </section>

            <WorkflowTemplates />
          </>
        )}

        {activeTab === 'metrics' && (
          <div className="metrics-dashboard">
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
