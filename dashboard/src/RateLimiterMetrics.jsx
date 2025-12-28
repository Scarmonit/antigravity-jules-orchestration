import React, { useState, useEffect } from 'react';
import './RateLimiterMetrics.css';

export function RateLimiterMetrics() {
  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    allowedRequests: 0,
    blockedRequests: 0,
    redisConnected: false,
    uptime: 0,
    redisErrors: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/rate-limit/metrics');
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error('Failed to fetch rate limit metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return seconds.toFixed(0) + 's';
    if (seconds < 3600) return (seconds / 60).toFixed(0) + 'm';
    return (seconds / 3600).toFixed(1) + 'h';
  };

  const getBlockRate = () => {
    if (metrics.totalRequests === 0) return '0.0';
    return ((metrics.blockedRequests / metrics.totalRequests) * 100).toFixed(1);
  };

  const getReqPerSec = () => {
    if (!metrics.uptime || metrics.uptime === 0) return '0.0';
    return (metrics.totalRequests / metrics.uptime).toFixed(1);
  };

  const renderMetricValue = (value, className = '') => {
    if (isLoading) {
      return <div className="loading-skeleton" />;
    }
    return <div className={`metric-value ${className}`}>{value}</div>;
  };

  const renderSubtitle = (text) => {
    if (isLoading) {
      return <div className="loading-skeleton subtitle" />;
    }
    return <div className="metric-subtitle">{text}</div>;
  };

  return (
    <section className="rate-limiter-metrics" aria-label="Rate Limiter Statistics">
      <h2>Rate Limiter</h2>
      <div className="metrics-grid" aria-live="polite">
        <div className="metric-card">
          <div className="metric-label">Requests/sec</div>
          {renderMetricValue(getReqPerSec())}
          {renderSubtitle(`over ${formatUptime(metrics.uptime)}`)}
        </div>
        <div className="metric-card">
          <div className="metric-label">Allowed</div>
          {renderMetricValue(metrics.allowedRequests.toLocaleString(), 'allowed')}
          {renderSubtitle('requests passed')}
        </div>
        <div className="metric-card">
          <div className="metric-label">Blocked (429)</div>
          {renderMetricValue(metrics.blockedRequests.toLocaleString(), 'blocked')}
          {renderSubtitle(`${getBlockRate()}% block rate`)}
        </div>
        <div
          className={'metric-card status-card ' + (metrics.redisConnected ? 'connected' : 'disconnected')}
          role="status"
          aria-label={`Redis Status: ${metrics.redisConnected ? 'Connected' : 'Failover'}`}
        >
          <div className="metric-label">Redis Status</div>
          <div className="metric-value status">
            {isLoading ? (
              <div className="loading-skeleton" style={{ width: '80%' }} />
            ) : (
              metrics.redisConnected ? 'Connected' : 'Failover'
            )}
          </div>
          {renderSubtitle(metrics.redisErrors > 0 ? metrics.redisErrors + ' errors' : 'No errors')}
        </div>
      </div>
    </section>
  );
}

export default RateLimiterMetrics;
