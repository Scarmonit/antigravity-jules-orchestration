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

  return (
    <section className="rate-limiter-metrics" aria-live="polite" aria-busy={isLoading}>
      <h2>Rate Limiter</h2>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Requests/sec</div>
          {isLoading ? (
            <>
              <div className="skeleton text"></div>
              <div className="skeleton subtitle"></div>
            </>
          ) : (
            <>
              <div className="metric-value">{getReqPerSec()}</div>
              <div className="metric-subtitle">over {formatUptime(metrics.uptime)}</div>
            </>
          )}
        </div>
        <div className="metric-card">
          <div className="metric-label">Allowed</div>
          {isLoading ? (
            <>
              <div className="skeleton text"></div>
              <div className="skeleton subtitle"></div>
            </>
          ) : (
            <>
              <div className="metric-value allowed">{metrics.allowedRequests.toLocaleString()}</div>
              <div className="metric-subtitle">requests passed</div>
            </>
          )}
        </div>
        <div className="metric-card">
          <div className="metric-label">Blocked (429)</div>
          {isLoading ? (
            <>
              <div className="skeleton text"></div>
              <div className="skeleton subtitle"></div>
            </>
          ) : (
            <>
              <div className="metric-value blocked">{metrics.blockedRequests.toLocaleString()}</div>
              <div className="metric-subtitle">{getBlockRate()}% block rate</div>
            </>
          )}
        </div>
        <div className={'metric-card status-card ' + (isLoading ? '' : (metrics.redisConnected ? 'connected' : 'disconnected'))}>
          <div className="metric-label">Redis Status</div>
          {isLoading ? (
            <>
              <div className="skeleton text"></div>
              <div className="skeleton subtitle"></div>
            </>
          ) : (
            <>
              <div className="metric-value status">
                {metrics.redisConnected ? 'Connected' : 'Failover'}
              </div>
              <div className="metric-subtitle">
                {metrics.redisErrors > 0 ? metrics.redisErrors + ' errors' : 'No errors'}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default RateLimiterMetrics;
