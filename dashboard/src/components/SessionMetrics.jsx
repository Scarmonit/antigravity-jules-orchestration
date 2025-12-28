import React from 'react';
import MetricCard from './MetricCard';
import './MetricsDashboard.css';

/**
 * Session metrics component displaying success rates and session states
 */
const SessionMetrics = ({ sessions = [], stats = {} }) => {
  // Calculate session metrics
  const totalSessions = stats.total || sessions.length || 0;
  const completedSessions = stats.completed || sessions.filter(s => s.status === 'completed').length || 0;
  const failedSessions = stats.failed || sessions.filter(s => s.status === 'failed').length || 0;
  const activeSessions = stats.running || sessions.filter(s => ['running', 'executing', 'awaiting_approval'].includes(s.status)).length || 0;

  // Calculate success rate
  const finishedSessions = completedSessions + failedSessions;
  const successRate = finishedSessions > 0
    ? Math.round((completedSessions / finishedSessions) * 100)
    : 0;

  // Calculate trend (comparing to previous period if available)
  const previousSuccessRate = stats.previousSuccessRate || null;
  const successTrend = previousSuccessRate !== null
    ? `${successRate > previousSuccessRate ? '+' : ''}${successRate - previousSuccessRate}%`
    : null;
  const successTrendDirection = previousSuccessRate !== null
    ? (successRate > previousSuccessRate ? 'up' : successRate < previousSuccessRate ? 'down' : 'neutral')
    : 'neutral';

  // Session state breakdown
  const sessionsByState = {
    pending: sessions.filter(s => s.status === 'pending').length,
    running: sessions.filter(s => s.status === 'running').length,
    awaiting_approval: sessions.filter(s => s.status === 'awaiting_approval').length,
    executing: sessions.filter(s => s.status === 'executing').length,
    completed: completedSessions,
    failed: failedSessions
  };

  return (
    <div className="metrics-section session-metrics">
      <h3 className="metrics-section-title">Session Metrics</h3>

      <div className="metrics-grid">
        <MetricCard
          label="Success Rate"
          value={`${successRate}%`}
          trend={successTrend}
          trendDirection={successTrendDirection}
          icon="✅"
          color={successRate >= 80 ? 'success' : successRate >= 50 ? 'warning' : 'danger'}
        />

        <MetricCard
          label="Total Sessions"
          value={totalSessions}
          icon="📊"
          color="default"
          subtitle="All time"
        />

        <MetricCard
          label="Active Sessions"
          value={activeSessions}
          icon="🔄"
          color={activeSessions > 0 ? 'info' : 'default'}
          subtitle="Currently running"
        />

        <MetricCard
          label="Completed"
          value={completedSessions}
          icon="✓"
          color="success"
        />

        <MetricCard
          label="Failed"
          value={failedSessions}
          icon="✗"
          color={failedSessions > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Session State Breakdown */}
      <div className="state-breakdown">
        <h4>Sessions by State</h4>
        <div className="state-bars">
          {Object.entries(sessionsByState).map(([state, count]) => (
            count > 0 && (
              <div key={state} className="state-bar-item">
                <span className="state-label">{state.replace('_', ' ')}</span>
                <div className="state-bar">
                  <div
                    className={`state-bar-fill state-${state}`}
                    style={{ width: `${totalSessions > 0 ? (count / totalSessions) * 100 : 0}%` }}
                  />
                </div>
                <span className="state-count">{count}</span>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export default SessionMetrics;
