import React from 'react';
import { render, screen } from '@testing-library/react';
import MetricCard from './MetricCard';

describe('MetricCard', () => {
  it('renders label and value correctly', () => {
    render(<MetricCard label="Test Metric" value="42" />);

    expect(screen.getByText('Test Metric')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<MetricCard label="With Icon" value="100" icon="🎯" />);

    expect(screen.getByText('🎯')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<MetricCard label="Test" value="50" subtitle="Last 24h" />);

    expect(screen.getByText('Last 24h')).toBeInTheDocument();
  });

  it('renders trend indicator when trend is provided', () => {
    render(<MetricCard label="Trend Test" value="75" trend="+5%" trendDirection="up" />);

    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('applies correct color class', () => {
    const { container } = render(<MetricCard label="Color Test" value="100" color="success" />);

    expect(container.querySelector('.metric-card-success')).toBeInTheDocument();
  });

  it('applies correct trend class for up direction', () => {
    const { container } = render(
      <MetricCard label="Up" value="10" trend="+10%" trendDirection="up" />
    );

    expect(container.querySelector('.trend-up')).toBeInTheDocument();
  });

  it('applies correct trend class for down direction', () => {
    const { container } = render(
      <MetricCard label="Down" value="10" trend="-5%" trendDirection="down" />
    );

    expect(container.querySelector('.trend-down')).toBeInTheDocument();
  });

  it('applies neutral trend class by default', () => {
    const { container } = render(
      <MetricCard label="Neutral" value="10" trend="0%" />
    );

    expect(container.querySelector('.trend-neutral')).toBeInTheDocument();
  });

  it('shows up arrow for up trend', () => {
    render(<MetricCard label="Up Arrow" value="10" trend="+5%" trendDirection="up" />);

    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('shows down arrow for down trend', () => {
    render(<MetricCard label="Down Arrow" value="10" trend="-5%" trendDirection="down" />);

    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('shows right arrow for neutral trend', () => {
    render(<MetricCard label="Neutral Arrow" value="10" trend="0%" trendDirection="neutral" />);

    expect(screen.getByText('→')).toBeInTheDocument();
  });
});
