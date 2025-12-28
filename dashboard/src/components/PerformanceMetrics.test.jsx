import React from 'react';
import { render, screen } from '@testing-library/react';
import PerformanceMetrics from './PerformanceMetrics';

describe('PerformanceMetrics', () => {
  const mockPerformance = {
    avgResponseTime: 150,
    cacheHitRatio: 0.75,
    cacheStats: {
      hits: 750,
      misses: 250,
      size: 50,
      maxSize: 100,
      ttl: 10
    },
    circuitBreakerStatus: 'closed',
    requestsPerMinute: 120,
    p95ResponseTime: 300,
    activeConnections: 5
  };

  it('renders section title', () => {
    render(<PerformanceMetrics />);
    expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
  });

  it('displays average response time in ms', () => {
    render(<PerformanceMetrics performance={mockPerformance} />);
    expect(screen.getByText('150ms')).toBeInTheDocument();
  });

  it('displays response time in seconds when >= 1000ms', () => {
    const slowPerformance = { ...mockPerformance, avgResponseTime: 1500 };
    render(<PerformanceMetrics performance={slowPerformance} />);
    expect(screen.getByText('1.50s')).toBeInTheDocument();
  });

  it('displays cache hit ratio as percentage', () => {
    render(<PerformanceMetrics performance={mockPerformance} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('displays cache hits and misses', () => {
    render(<PerformanceMetrics performance={mockPerformance} />);
    expect(screen.getByText('750 hits / 250 misses')).toBeInTheDocument();
  });

  it('displays requests per minute', () => {
    render(<PerformanceMetrics performance={mockPerformance} />);
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('displays circuit breaker status', () => {
    render(<PerformanceMetrics performance={mockPerformance} />);
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('displays active connections', () => {
    render(<PerformanceMetrics performance={mockPerformance} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays cache statistics section', () => {
    render(<PerformanceMetrics performance={mockPerformance} />);
    expect(screen.getByText('Cache Statistics')).toBeInTheDocument();
    expect(screen.getByText('50 / 100')).toBeInTheDocument();
    expect(screen.getByText('10s')).toBeInTheDocument();
  });

  it('shows P95 response time in subtitle', () => {
    render(<PerformanceMetrics performance={mockPerformance} />);
    expect(screen.getByText('P95: 300ms')).toBeInTheDocument();
  });

  it('handles empty performance data gracefully', () => {
    render(<PerformanceMetrics performance={{}} />);
    expect(screen.getByText('0ms')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('applies success color for closed circuit breaker', () => {
    const { container } = render(<PerformanceMetrics performance={mockPerformance} />);
    expect(container.querySelector('.metric-card-success')).toBeInTheDocument();
  });

  it('applies danger color for open circuit breaker', () => {
    const openCircuit = { ...mockPerformance, circuitBreakerStatus: 'open' };
    const { container } = render(<PerformanceMetrics performance={openCircuit} />);
    expect(container.querySelector('.metric-card-danger')).toBeInTheDocument();
  });
});
