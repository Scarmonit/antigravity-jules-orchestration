import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorMetrics from './ErrorMetrics';

describe('ErrorMetrics', () => {
  const mockErrors = {
    totalErrors: 25,
    errorRate: 0.02,
    errorsByType: {
      ValidationError: 10,
      NotFoundError: 8,
      AuthenticationError: 5,
      InternalError: 2
    },
    recentErrors: [
      { timestamp: '2025-01-01T10:00:00Z', statusCode: 400, message: 'Invalid input', path: '/api/users' },
      { timestamp: '2025-01-01T09:30:00Z', statusCode: 500, message: 'Server error', path: '/api/sessions' }
    ],
    errorTrend: 0.005
  };

  it('renders section title', () => {
    render(<ErrorMetrics />);
    expect(screen.getByText('Error Metrics')).toBeInTheDocument();
  });

  it('displays error rate as percentage', () => {
    render(<ErrorMetrics errors={mockErrors} />);
    expect(screen.getByText('2.00%')).toBeInTheDocument();
  });

  it('displays total errors count', () => {
    render(<ErrorMetrics errors={mockErrors} />);
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('displays unique error types count', () => {
    render(<ErrorMetrics errors={mockErrors} />);
    expect(screen.getByText('4')).toBeInTheDocument(); // 4 unique error types
  });

  it('renders error breakdown section', () => {
    render(<ErrorMetrics errors={mockErrors} />);
    expect(screen.getByText('Errors by Type')).toBeInTheDocument();
  });

  it('shows error types in breakdown', () => {
    render(<ErrorMetrics errors={mockErrors} />);
    expect(screen.getByText('ValidationError')).toBeInTheDocument();
    expect(screen.getByText('NotFoundError')).toBeInTheDocument();
    expect(screen.getByText('AuthenticationError')).toBeInTheDocument();
  });

  it('renders recent errors section', () => {
    render(<ErrorMetrics errors={mockErrors} />);
    expect(screen.getByText('Recent Errors')).toBeInTheDocument();
  });

  it('displays recent error messages', () => {
    render(<ErrorMetrics errors={mockErrors} />);
    expect(screen.getByText('Invalid input')).toBeInTheDocument();
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('displays error paths', () => {
    render(<ErrorMetrics errors={mockErrors} />);
    expect(screen.getByText('/api/users')).toBeInTheDocument();
    expect(screen.getByText('/api/sessions')).toBeInTheDocument();
  });

  it('shows no errors message when totalErrors is 0', () => {
    render(<ErrorMetrics errors={{ totalErrors: 0, errorRate: 0, errorsByType: {}, recentErrors: [] }} />);
    expect(screen.getByText('No errors in the last 24 hours')).toBeInTheDocument();
  });

  it('displays error trend indicator', () => {
    render(<ErrorMetrics errors={mockErrors} />);
    expect(screen.getByText('+0.50%')).toBeInTheDocument();
  });

  it('handles empty errors gracefully', () => {
    render(<ErrorMetrics errors={{}} />);
    expect(screen.getByText('0.00%')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('applies success color for low error rate', () => {
    const lowErrors = { ...mockErrors, errorRate: 0.005 };
    const { container } = render(<ErrorMetrics errors={lowErrors} />);
    expect(container.querySelector('.metric-card-success')).toBeInTheDocument();
  });

  it('applies warning color for medium error rate', () => {
    const mediumErrors = { ...mockErrors, errorRate: 0.03 };
    const { container } = render(<ErrorMetrics errors={mediumErrors} />);
    expect(container.querySelector('.metric-card-warning')).toBeInTheDocument();
  });

  it('applies danger color for high error rate', () => {
    const highErrors = { ...mockErrors, errorRate: 0.1 };
    const { container } = render(<ErrorMetrics errors={highErrors} />);
    expect(container.querySelector('.metric-card-danger')).toBeInTheDocument();
  });
});
