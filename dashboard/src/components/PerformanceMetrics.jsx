import React from 'react';
import MetricCard from './MetricCard';
import './MetricsDashboard.css';

/**
 * Performance metrics component displaying response times and cache stats
 */
const PerformanceMetrics = ({ performance = {} }) => {
  const {
    avgResponseTime = 0,
    cacheHitRatio = 0,
    cacheStats = {},
    circuitBreakerStatus = 'closed',
    requestsPerMinute = 0,
    p95ResponseTime = 0,
    activeConnections = 0
  } = performance;

  // Format response time
  const formatTime = (ms) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${Math.round(ms)}ms`;
  };

  // Calculate cache hit percentage
  const cacheHitPercent = Math.round(cacheHitRatio * 100);

  // Circuit breaker color
  const circuitBreakerColor = {
    closed: 'success',
    open: 'danger',
    half_open: 'warning'
  }[circuitBreakerStatus] || 'default';

  // Response time color based on thresholds
  const responseTimeColor = avgResponseTime < 200 ? 'success'
    : avgResponseTime < 500 ? 'warning'
    : 'danger';

  return (
    <div className="metrics-section performance-metrics">
      <h3 className="metrics-section-title">Performance Metrics</h3>

      <div className="metrics-grid">
        <MetricCard
          label="Avg Response Time"
          value={formatTime(avgResponseTime)}
          icon="⚡"
          color={responseTimeColor}
          subtitle={`P95: ${formatTime(p95ResponseTime)}`}
        />

        <MetricCard
          label="Cache Hit Ratio"
          value={`${cacheHitPercent}%`}
          icon="💾"
          color={cacheHitPercent >= 70 ? 'success' : cacheHitPercent >= 40 ? 'warning' : 'default'}
          subtitle={`${cacheStats.hits || 0} hits / ${cacheStats.misses || 0} misses`}
        />

        <MetricCard
          label="Requests/min"
          value={requestsPerMinute}
          icon="📈"
          color="info"
        />

        <MetricCard
          label="Circuit Breaker"
          value={circuitBreakerStatus.replace('_', ' ')}
          icon={circuitBreakerStatus === 'closed' ? '🟢' : circuitBreakerStatus === 'open' ? '🔴' : '🟡'}
          color={circuitBreakerColor}
        />

        <MetricCard
          label="Active Connections"
          value={activeConnections}
          icon="🔗"
          color="default"
        />
      </div>

      {/* Response Time Distribution */}
      {performance.responseTimeDistribution && (
        <div className="response-time-chart">
          <h4>Response Time Distribution</h4>
          <div className="distribution-bars">
            {Object.entries(performance.responseTimeDistribution).map(([range, count]) => (
              <div key={range} className="distribution-bar">
                <div className="bar-label">{range}</div>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${Math.min(100, (count / Math.max(...Object.values(performance.responseTimeDistribution))) * 100)}%`
                    }}
                  />
                </div>
                <div className="bar-count">{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cache Details */}
      <div className="cache-details">
        <h4>Cache Statistics</h4>
        <div className="cache-stats-grid">
          <div className="cache-stat">
            <span className="stat-label">Size</span>
            <span className="stat-value">{cacheStats.size || 0} / {cacheStats.maxSize || 100}</span>
          </div>
          <div className="cache-stat">
            <span className="stat-label">TTL</span>
            <span className="stat-value">{cacheStats.ttl || 10}s</span>
          </div>
          <div className="cache-stat">
            <span className="stat-label">Total Requests</span>
            <span className="stat-value">{(cacheStats.hits || 0) + (cacheStats.misses || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;
