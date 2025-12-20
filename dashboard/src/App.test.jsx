import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import App from './App';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.close = vi.fn();
  }
}
global.WebSocket = MockWebSocket;

// Mock fetch
global.fetch = vi.fn();

const MOCK_METRICS = {
  totalRequests: 100,
  allowedRequests: 90,
  blockedRequests: 10,
  redisConnected: true,
  uptime: 3600,
  redisErrors: 0
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock initial workflows fetch
    fetch.mockImplementation((url) => {
      if (url === '/api/v1/workflows') {
        return Promise.resolve({
          json: () => Promise.resolve([]),
        });
      }
      if (url === '/api/rate-limit/metrics') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_METRICS),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({}),
      });
    });
  });

  test('renders Quick Actions', async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('📦 Update Dependencies')).toBeInTheDocument();
  });

  test('shows loading state when executing workflow', async () => {
    let resolveExecution;
    const executionPromise = new Promise((resolve) => {
      resolveExecution = resolve;
    });

    fetch.mockImplementation((url) => {
      if (url === '/api/v1/workflows/execute') {
        return executionPromise.then(() => ({
          json: () => Promise.resolve({ workflow_id: '123' }),
        }));
      }
      // Default mocks for other calls
      if (url === '/api/v1/workflows') {
        return Promise.resolve({ json: () => Promise.resolve([]) });
      }
      if (url === '/api/rate-limit/metrics') {
         return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_METRICS),
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    await act(async () => {
      render(<App />);
    });

    const updateBtn = screen.getByText('📦 Update Dependencies');

    // Click the button
    await act(async () => {
      fireEvent.click(updateBtn);
    });

    // Check if loading state is shown
    expect(updateBtn).toBeDisabled();
    // Use a regex to match both likely options, or specific if decided
    expect(updateBtn).toHaveTextContent(/Starting|Loading|Updating/i);

    // Resolve the promise to finish execution
    await act(async () => {
      resolveExecution();
    });

    // Should be enabled again
    expect(updateBtn).not.toBeDisabled();
    expect(updateBtn).toHaveTextContent('📦 Update Dependencies');
  });
});
