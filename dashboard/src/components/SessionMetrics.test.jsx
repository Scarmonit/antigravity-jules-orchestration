import React from 'react';
import { render, screen } from '@testing-library/react';
import SessionMetrics from './SessionMetrics';

describe('SessionMetrics', () => {
  const mockSessions = [
    { id: '1', status: 'completed' },
    { id: '2', status: 'completed' },
    { id: '3', status: 'failed' },
    { id: '4', status: 'running' },
    { id: '5', status: 'pending' }
  ];

  const mockStats = {
    total: 5,
    running: 1,
    completed: 2,
    failed: 1
  };

  it('renders section title', () => {
    render(<SessionMetrics />);
    expect(screen.getByText('Session Metrics')).toBeInTheDocument();
  });

  it('calculates success rate correctly', () => {
    render(<SessionMetrics sessions={mockSessions} stats={mockStats} />);
    // 2 completed out of 3 finished (2 completed + 1 failed) = 67%
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('displays total sessions count', () => {
    render(<SessionMetrics stats={mockStats} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays active sessions count', () => {
    render(<SessionMetrics stats={mockStats} />);
    // 1 running
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays completed sessions count', () => {
    render(<SessionMetrics stats={mockStats} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders state breakdown section', () => {
    render(<SessionMetrics sessions={mockSessions} stats={mockStats} />);
    expect(screen.getByText('Sessions by State')).toBeInTheDocument();
  });

  it('shows session states in breakdown', () => {
    render(<SessionMetrics sessions={mockSessions} stats={mockStats} />);
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('handles empty sessions array', () => {
    render(<SessionMetrics sessions={[]} stats={{}} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('uses stats over calculated values when provided', () => {
    const statsOnly = {
      total: 100,
      running: 10,
      completed: 80,
      failed: 10
    };
    render(<SessionMetrics stats={statsOnly} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
