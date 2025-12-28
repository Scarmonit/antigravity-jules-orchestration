import React from 'react';
import MetricCard from './MetricCard';
import './MetricsDashboard.css';

/**
 * Error metrics component displaying error rates and breakdown by type
 */
const ErrorMetrics = ({ errors = {} }) => {
  const {
    totalErrors = 0,
    errorRate = 0,
    errorsByType = {},
    recentErrors = [],
    errorTrend = null
  } = errors;

  // Format error rate as percentage
  const errorRatePercent = (errorRate * 100).toFixed(2);

  // Determine error rate severity
  const errorRateColor = errorRate < 0.01 ? 'success'
    : errorRate < 0.05 ? 'warning'
    : 'danger';

  // Calculate trend direction
  const trendDirection = errorTrend !== null
    ? (errorTrend > 0 ? 'up' : errorTrend < 0 ? 'down' : 'neutral')
    : 'neutral';

  // Error type icons
  const errorTypeIcons = {
    ValidationError: '⚠️',
    AuthenticationError: '🔐',
    AuthorizationError: '🚫',
    NotFoundError: '🔍',
    RateLimitError: '⏱️',
    ExternalServiceError: '🌐',
    TimeoutError: '⏰',
    InternalError: '💥',
    Unknown: '❓'
  };

  // Get top error types sorted by count
  const topErrorTypes = Object.entries(errorsByType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="metrics-section error-metrics">
      <h3 className="metrics-section-title">Error Metrics</h3>

      <div className="metrics-grid">
        <MetricCard
          label="Error Rate"
          value={`${errorRatePercent}%`}
          trend={errorTrend !== null ? `${errorTrend > 0 ? '+' : ''}${(errorTrend * 100).toFixed(2)}%` : null}
          trendDirection={trendDirection}
          icon="📉"
          color={errorRateColor}
        />

        <MetricCard
          label="Total Errors"
          value={totalErrors}
          icon="❌"
          color={totalErrors > 0 ? 'danger' : 'success'}
          subtitle="Last 24h"
        />

        <MetricCard
          label="Error Types"
          value={Object.keys(errorsByType).length}
          icon="📋"
          color="default"
          subtitle="Unique types"
        />
      </div>

      {/* Error Breakdown by Type */}
      {topErrorTypes.length > 0 && (
        <div className="error-breakdown">
          <h4>Errors by Type</h4>
          <div className="error-type-list">
            {topErrorTypes.map(([type, count]) => (
              <div key={type} className="error-type-item">
                <span className="error-type-icon">{errorTypeIcons[type] || '❓'}</span>
                <span className="error-type-name">{type}</span>
                <div className="error-type-bar">
                  <div
                    className="error-type-bar-fill"
                    style={{
                      width: `${totalErrors > 0 ? (count / totalErrors) * 100 : 0}%`
                    }}
                  />
                </div>
                <span className="error-type-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <div className="recent-errors">
          <h4>Recent Errors</h4>
          <div className="error-list">
            {recentErrors.slice(0, 5).map((error, index) => (
              <div key={index} className="error-item">
                <span className="error-time">
                  {new Date(error.timestamp).toLocaleTimeString()}
                </span>
                <span className={`error-status status-${error.statusCode}`}>
                  {error.statusCode}
                </span>
                <span className="error-message">{error.message}</span>
                <span className="error-path">{error.path}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Errors State */}
      {totalErrors === 0 && (
        <div className="no-errors">
          <span className="no-errors-icon">✅</span>
          <span className="no-errors-text">No errors in the last 24 hours</span>
        </div>
      )}
    </div>
  );
};

export default ErrorMetrics;
