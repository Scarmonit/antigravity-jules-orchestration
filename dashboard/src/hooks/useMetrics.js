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
  const mountedRef = useRef(true);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000;

  // Fetch metrics from REST API - uses functional update to avoid stale closures
  const fetchMetrics = useCallback(async () => {
    if (!mountedRef.current) return;

    const fetchErrors = [];

    try {
      const [sessionsRes, cacheRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/sessions/stats`).catch(err => {
          console.error('Failed to fetch session stats:', err.message);
          fetchErrors.push(`Session stats: ${err.message}`);
          return null;
        }),
        fetch(`${apiBaseUrl}/jules_cache_stats`).catch(err => {
          console.error('Failed to fetch cache stats:', err.message);
          fetchErrors.push(`Cache stats: ${err.message}`);
          return null;
        })
      ]);

      if (!mountedRef.current) return;

      // Use functional update to avoid stale closure
      setMetrics(prev => {
        const newMetrics = { ...prev };

        if (sessionsRes?.ok) {
          sessionsRes.json().then(sessionsData => {
            if (!mountedRef.current) return;
            setMetrics(p => ({
              ...p,
              sessions: sessionsData.sessions || [],
              stats: {
                total: sessionsData.total || 0,
                running: sessionsData.running || 0,
                completed: sessionsData.completed || 0,
                failed: sessionsData.failed || 0
              }
            }));
          }).catch(err => {
            console.error('Failed to parse session stats JSON:', err);
          });
        } else if (sessionsRes) {
          console.warn(`Session stats returned status ${sessionsRes.status}`);
        }

        if (cacheRes?.ok) {
          cacheRes.json().then(cacheData => {
            if (!mountedRef.current) return;
            if (cacheData.success) {
              const cache = cacheData.result.cache || {};
              const hits = cache.hits || 0;
              const misses = cache.misses || 0;
              setMetrics(p => ({
                ...p,
                performance: {
                  ...p.performance,
                  cacheHitRatio: hits + misses > 0 ? hits / (hits + misses) : 0,
                  cacheStats: cache,
                  circuitBreakerStatus: cacheData.result.circuitBreaker?.state || 'closed'
                }
              }));
            }
          }).catch(err => {
            console.error('Failed to parse cache stats JSON:', err);
          });
        } else if (cacheRes) {
          console.warn(`Cache stats returned status ${cacheRes.status}`);
        }

        return newMetrics;
      });

      // Set error state if any fetch failed
      if (fetchErrors.length > 0) {
        setError(`Partial fetch failure: ${fetchErrors.join('; ')}`);
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
      if (mountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiBaseUrl]);

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!wsUrl || wsRef.current?.readyState === WebSocket.OPEN || !mountedRef.current) return;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        console.log('WebSocket connected for metrics');
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0; // Reset on successful connection

        // Clear polling when WebSocket is connected
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

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
                console.warn('Received unknown WebSocket message type:', update.type);
                break;
            }

            return newMetrics;
          });
        } catch (err) {
          const preview = typeof event.data === 'string'
            ? event.data.substring(0, 200)
            : '[non-string data]';
          console.error('Failed to parse WebSocket message:', {
            error: err.message,
            dataPreview: preview,
            dataLength: event.data?.length
          });
        }
      };

      ws.onerror = () => {
        // Note: WebSocket error events don't contain error details for security
        console.error('WebSocket error occurred. URL:', wsUrl, 'ReadyState:', ws.readyState);
        if (mountedRef.current) {
          setError('Real-time connection failed. Using polling fallback.');
        }
      };

      ws.onclose = (event) => {
        console.log(`WebSocket disconnected: code=${event.code}, reason=${event.reason || 'unknown'}`);
        if (!mountedRef.current) return;

        setConnected(false);
        wsRef.current = null;

        // Start polling as fallback
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(fetchMetrics, pollingInterval);
        }

        // Implement exponential backoff with max retries
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.error(`WebSocket reconnection failed after ${MAX_RECONNECT_ATTEMPTS} attempts. Using polling only.`);
          setError('WebSocket connection failed. Using polling fallback.');
          return;
        }

        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
          30000
        );
        reconnectAttemptsRef.current += 1;

        console.log(`Attempting WebSocket reconnection in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connectWebSocket();
          }
        }, delay);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      if (mountedRef.current) {
        setError(err.message);

        // Fall back to polling
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(fetchMetrics, pollingInterval);
        }
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
    mountedRef.current = true;
    fetchMetrics();
    connectWebSocket();

    // Start polling as initial fallback
    pollingIntervalRef.current = setInterval(fetchMetrics, pollingInterval);

    return () => {
      // Cleanup on unmount
      mountedRef.current = false;
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
