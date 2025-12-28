import { renderHook, act, waitFor } from '@testing-library/react';
import useMetrics from './useMetrics';

// Mock fetch
global.fetch = jest.fn();

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;

    // Simulate connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  send(data) {
    // Mock send
  }
}

global.WebSocket = MockWebSocket;
WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSED = 3;

describe('useMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessions: [], total: 0 })
      })
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('initializes with default metrics state', () => {
    const { result } = renderHook(() => useMetrics('ws://localhost', '', 30000));

    expect(result.current.metrics).toEqual({
      sessions: [],
      stats: { total: 0, running: 0, completed: 0, failed: 0 },
      performance: expect.any(Object),
      errors: expect.any(Object)
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.connected).toBe(false);
  });

  it('fetches initial metrics on mount', async () => {
    const { result } = renderHook(() => useMetrics('ws://localhost', '', 30000));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('sets connected to true when WebSocket connects', async () => {
    const { result } = renderHook(() => useMetrics('ws://localhost', '', 30000));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    }, { timeout: 100 });
  });

  it('provides refresh function', () => {
    const { result } = renderHook(() => useMetrics('ws://localhost', '', 30000));

    expect(typeof result.current.refresh).toBe('function');
  });

  it('sets loading to false after fetch completes', async () => {
    const { result } = renderHook(() => useMetrics('ws://localhost', '', 30000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles fetch errors gracefully', async () => {
    fetch.mockImplementation(() => Promise.reject(new Error('Network error')));

    const { result } = renderHook(() => useMetrics('ws://localhost', '', 30000));

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('updates metrics on WebSocket message', async () => {
    let ws;
    const originalWebSocket = global.WebSocket;
    global.WebSocket = class extends MockWebSocket {
      constructor(url) {
        super(url);
        ws = this;
      }
    };

    const { result } = renderHook(() => useMetrics('ws://localhost', '', 30000));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    }, { timeout: 100 });

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'stats_update',
          data: { total: 10, running: 2, completed: 7, failed: 1 }
        })
      });
    });

    expect(result.current.metrics.stats).toEqual({
      total: 10,
      running: 2,
      completed: 7,
      failed: 1
    });

    global.WebSocket = originalWebSocket;
  });

  it('handles metrics_update type', async () => {
    let ws;
    const originalWebSocket = global.WebSocket;
    global.WebSocket = class extends MockWebSocket {
      constructor(url) {
        super(url);
        ws = this;
      }
    };

    const { result } = renderHook(() => useMetrics('ws://localhost', '', 30000));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    }, { timeout: 100 });

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'metrics_update',
          data: {
            sessions: [{ id: '1', status: 'completed' }],
            stats: { total: 1, completed: 1 }
          }
        })
      });
    });

    expect(result.current.metrics.sessions).toHaveLength(1);
    expect(result.current.metrics.stats.total).toBe(1);

    global.WebSocket = originalWebSocket;
  });

  it('handles performance_update type', async () => {
    let ws;
    const originalWebSocket = global.WebSocket;
    global.WebSocket = class extends MockWebSocket {
      constructor(url) {
        super(url);
        ws = this;
      }
    };

    const { result } = renderHook(() => useMetrics('ws://localhost', '', 30000));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    }, { timeout: 100 });

    act(() => {
      ws.onmessage({
        data: JSON.stringify({
          type: 'performance_update',
          data: { avgResponseTime: 200, cacheHitRatio: 0.8 }
        })
      });
    });

    expect(result.current.metrics.performance.avgResponseTime).toBe(200);
    expect(result.current.metrics.performance.cacheHitRatio).toBe(0.8);

    global.WebSocket = originalWebSocket;
  });
});
