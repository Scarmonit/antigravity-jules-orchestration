import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for fetching and subscribing to real-time metrics updates
 * @param {string} wsUrl - WebSocket URL for real-time updates
 * @param {string} apiBaseUrl - Base URL for REST API
 * @param {number} pollingInterval - Fallback polling interval in ms (default: 30000)
 */
const useMetrics = (wsUrl, apiBaseUrl = '', pollingInterval = 30000) => {
  const [metrics, setMetrics] = useState({
    sessions: [],
    stats: {
      total: 0,
      running: 0,
      completed: 0,
      failed: 0
    },
    performance: {
      avgResponseTime: 0,
      cacheHitRatio: 0,
      cacheStats: {},
      circuitBreakerStatus: 'closed',
      requestsPerMinute: 0,
      p95ResponseTime: 0,
      activeConnections: 0
    },
    errors: {
      totalErrors: 0,
      errorRate: 0,
      errorsByType: {},
      recentErrors: []
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Fetch metrics from REST API
  const fetchMetrics = useCallback(async () => {
    try {
      const [sessionsRes, cacheRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/sessions/stats`).catch(() => null),
        fetch(`${apiBaseUrl}/jules_cache_stats`).catch(() => null)
      ]);

      const newMetrics = { ...metrics };

      if (sessionsRes?.ok) {
        const sessionsData = await sessionsRes.json();
        newMetrics.sessions = sessionsData.sessions || [];
        newMetrics.stats = {
          total: sessionsData.total || 0,
          running: sessionsData.running || 0,
          completed: sessionsData.completed || 0,
          failed: sessionsData.failed || 0
        };
      }

      if (cacheRes?.ok) {
        const cacheData = await cacheRes.json();
        if (cacheData.success) {
          const cache = cacheData.result.cache || {};
          const hits = cache.hits || 0;
          const misses = cache.misses || 0;
          newMetrics.performance = {
            ...newMetrics.performance,
            cacheHitRatio: hits + misses > 0 ? hits / (hits + misses) : 0,
            cacheStats: cache,
            circuitBreakerStatus: cacheData.result.circuitBreaker?.state || 'closed'
          };
        }
      }

      setMetrics(newMetrics);
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, metrics]);

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!wsUrl || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected for metrics');
        setConnected(true);
        setError(null);

        // Clear polling when WebSocket is connected
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);

          setMetrics(prev => {
            const newMetrics = { ...prev };

            switch (update.type) {
              case 'metrics_update':
                // Full metrics update
                return { ...prev, ...update.data };

              case 'session_update':
              case 'workflow_update':
                // Individual session update
                newMetrics.sessions = prev.sessions.map(s =>
                  s.id === update.session_id || s.id === update.workflow_id
                    ? { ...s, ...update.data }
                    : s
                );
                break;

              case 'stats_update':
                // Stats update
                newMetrics.stats = { ...prev.stats, ...update.data };
                break;

              case 'performance_update':
                // Performance metrics update
                newMetrics.performance = { ...prev.performance, ...update.data };
                break;

              case 'error_update':
                // Error metrics update
                newMetrics.errors = { ...prev.errors, ...update.data };
                break;

              case 'cache_update':
                // Cache stats update
                newMetrics.performance = {
                  ...prev.performance,
                  cacheStats: update.data,
                  cacheHitRatio: update.data.hits + update.data.misses > 0
                    ? update.data.hits / (update.data.hits + update.data.misses)
                    : 0
                };
                break;

              default:
                break;
            }

            return newMetrics;
          });
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        wsRef.current = null;

        // Start polling as fallback
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(fetchMetrics, pollingInterval);
        }

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError(err.message);

      // Fall back to polling
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(fetchMetrics, pollingInterval);
      }
    }
  }, [wsUrl, fetchMetrics, pollingInterval]);

  // Refresh metrics manually
  const refresh = useCallback(() => {
    setLoading(true);
    fetchMetrics();
  }, [fetchMetrics]);

  // Initialize on mount
  useEffect(() => {
    fetchMetrics();
    connectWebSocket();

    // Start polling as initial fallback
    pollingIntervalRef.current = setInterval(fetchMetrics, pollingInterval);

    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchMetrics, connectWebSocket, pollingInterval]);

  return {
    metrics,
    loading,
    error,
    connected,
    refresh
  };
};

export default useMetrics;
