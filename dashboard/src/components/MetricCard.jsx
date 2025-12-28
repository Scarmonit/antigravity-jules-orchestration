import React from 'react';
import './MetricsDashboard.css';

/**
 * Reusable metric card component with value, trend indicator, and optional sparkline
 */
const MetricCard = ({
  label,
  value,
  trend,
  trendDirection = 'neutral',
  icon,
  color = 'default',
  subtitle
}) => {
  const getTrendClass = () => {
    if (trendDirection === 'up') return 'trend-up';
    if (trendDirection === 'down') return 'trend-down';
    return 'trend-neutral';
  };

  const getTrendIcon = () => {
    if (trendDirection === 'up') return '\u2191';
    if (trendDirection === 'down') return '\u2193';
    return '\u2192';
  };

  return (
    <div className={`metric-card metric-card-${color}`}>
      <div className="metric-header">
        {icon && <span className="metric-icon">{icon}</span>}
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`metric-trend ${getTrendClass()}`}>
          <span className="trend-icon">{getTrendIcon()}</span>
          <span className="trend-value">{trend}</span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
