/**
 * Unit Tests for RateLimiterMetrics Component
 *
 * Tests cover:
 * - Component rendering with default state
 * - Metric card display
 * - Helper function logic
 *
 * @module tests/RateLimiterMetrics.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RateLimiterMetrics } from './RateLimiterMetrics';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('RateLimiterMetrics Component', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        redisConnected: false,
        uptime: 0,
        redisErrors: 0
      })
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial Rendering', () => {
    it('should render the component with header', async () => {
      await act(async () => {
        render(<RateLimiterMetrics />);
      });
      expect(screen.getByText('Rate Limiter')).toBeInTheDocument();
    });

    it('should display all metric card labels', async () => {
      await act(async () => {
        render(<RateLimiterMetrics />);
      });

      expect(screen.getByText('Requests/sec')).toBeInTheDocument();
      expect(screen.getByText('Allowed')).toBeInTheDocument();
      expect(screen.getByText('Blocked (429)')).toBeInTheDocument();
      expect(screen.getByText('Redis Status')).toBeInTheDocument();
    });

    it('should show requests per second metric value', async () => {
      await act(async () => {
        render(<RateLimiterMetrics />);
      });

      // The requests/sec should show 0.0 initially
      const reqSecCards = screen.getAllByText('0.0');
      expect(reqSecCards.length).toBeGreaterThan(0);
    });
  });

  describe('Data Display', () => {
    it('should display allowed requests count', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 1000,
          allowedRequests: 950,
          blockedRequests: 50,
          redisConnected: true,
          uptime: 3600,
          redisErrors: 0
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        // Wait for fetch to complete
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('950')).toBeInTheDocument();
    });

    it('should display blocked requests count', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 1000,
          allowedRequests: 950,
          blockedRequests: 50,
          redisConnected: true,
          uptime: 3600,
          redisErrors: 0
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should show Connected when Redis is connected', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 100,
          allowedRequests: 100,
          blockedRequests: 0,
          redisConnected: true,
          uptime: 3600,
          redisErrors: 0
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should show Failover when Redis is disconnected', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 100,
          allowedRequests: 100,
          blockedRequests: 0,
          redisConnected: false,
          uptime: 3600,
          redisErrors: 5
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('Failover')).toBeInTheDocument();
    });

    it('should show error count when there are Redis errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 100,
          allowedRequests: 100,
          blockedRequests: 0,
          redisConnected: false,
          uptime: 3600,
          redisErrors: 5
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('5 errors')).toBeInTheDocument();
    });
  });

  describe('Uptime Formatting', () => {
    it('should format uptime in seconds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 100,
          allowedRequests: 100,
          blockedRequests: 0,
          redisConnected: true,
          uptime: 45,
          redisErrors: 0
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('over 45s')).toBeInTheDocument();
    });

    it('should format uptime in minutes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 100,
          allowedRequests: 100,
          blockedRequests: 0,
          redisConnected: true,
          uptime: 300,
          redisErrors: 0
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('over 5m')).toBeInTheDocument();
    });

    it('should format uptime in hours', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 100,
          allowedRequests: 100,
          blockedRequests: 0,
          redisConnected: true,
          uptime: 7200,
          redisErrors: 0
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('over 2.0h')).toBeInTheDocument();
    });
  });

  describe('Block Rate Calculation', () => {
    it('should calculate block rate percentage', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 1000,
          allowedRequests: 900,
          blockedRequests: 100,
          redisConnected: true,
          uptime: 3600,
          redisErrors: 0
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('10.0% block rate')).toBeInTheDocument();
    });

    it('should show 0.0% block rate when no requests', async () => {
      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('0.0% block rate')).toBeInTheDocument();
    });
  });

  describe('Number Formatting', () => {
    it('should format large numbers with locale separator', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          totalRequests: 1500000,
          allowedRequests: 1234567,
          blockedRequests: 265433,
          redisConnected: true,
          uptime: 86400,
          redisErrors: 0
        })
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('1,234,567')).toBeInTheDocument();
      expect(screen.getByText('265,433')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(consoleSpy).toHaveBeenCalled();
      // Component should still render
      expect(screen.getByText('Rate Limiter')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('should handle non-ok response gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      // Component should still render with initial state
      expect(screen.getByText('Rate Limiter')).toBeInTheDocument();
    });
  });

  describe('Polling', () => {
    it('should fetch metrics on component mount', async () => {
      await act(async () => {
        render(<RateLimiterMetrics />);
        await vi.runAllTimersAsync();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/rate-limit/metrics');
    });
  });
});
