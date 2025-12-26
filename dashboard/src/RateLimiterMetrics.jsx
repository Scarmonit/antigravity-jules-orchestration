import { useState, useEffect } from 'react';
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
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/rate-limit/metrics');
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
          setError(null);
        } else {
          setError('Failed to load metrics');
        }
      } catch (error) {
        console.error('Failed to fetch rate limit metrics:', error);
        setError('Connection failed');
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

  if (isLoading) {
    return (
      <section className="rate-limiter-metrics" aria-busy="true">
        <h2>Rate Limiter</h2>
        <div className="metrics-loading">
          <div className="loading-spinner" aria-hidden="true"></div>
          <span className="sr-only">Loading metrics...</span>
          <span aria-hidden="true">Loading metrics...</span>
        </div>
      </section>
    );
  }

  if (error && metrics.totalRequests === 0) {
     return (
      <section className="rate-limiter-metrics">
        <h2>Rate Limiter</h2>
        <div className="metrics-error">
           <span role="img" aria-label="Error">⚠️</span> {error}
        </div>
      </section>
    );
  }

  return (
    <section className="rate-limiter-metrics">
      <h2>Rate Limiter</h2>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Requests/sec</div>
          <div className="metric-value">{getReqPerSec()}</div>
          <div className="metric-subtitle">over {formatUptime(metrics.uptime)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Allowed</div>
          <div className="metric-value allowed">{metrics.allowedRequests.toLocaleString()}</div>
          <div className="metric-subtitle">requests passed</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Blocked (429)</div>
          <div className="metric-value blocked">{metrics.blockedRequests.toLocaleString()}</div>
          <div className="metric-subtitle">{getBlockRate()}% block rate</div>
        </div>
        <div className={'metric-card status-card ' + (metrics.redisConnected ? 'connected' : 'disconnected')}>
          <div className="metric-label">Redis Status</div>
          <div className="metric-value status">
            {metrics.redisConnected ? 'Connected' : 'Failover'}
          </div>
          <div className="metric-subtitle">
            {metrics.redisErrors > 0 ? metrics.redisErrors + ' errors' : 'No errors'}
          </div>
        </div>
      </div>
    </section>
  );
}

export default RateLimiterMetrics;
