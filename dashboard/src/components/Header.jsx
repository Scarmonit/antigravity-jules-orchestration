import React, { memo } from 'react';

const Header = ({ wsConnected, activeTab, setActiveTab, stats }) => {
  return (
    <header>
      <div className="header-top">
        <h1>🤖 Jules Orchestrator</h1>
        <div className="connection-status">
          <span className={`status-indicator ${wsConnected ? 'connected' : 'disconnected'}`} />
          {wsConnected ? 'Live' : 'Polling'}
        </div>
      </div>
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'workflows' ? 'active' : ''}`}
          onClick={() => setActiveTab('workflows')}
        >
          📋 Workflows
        </button>
        <button
          className={`tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          📊 Metrics
        </button>
      </nav>
      <div className="stats">
        <div className="stat">
          <span className="label">Total</span>
          <span className="value">{stats.total}</span>
        </div>
        <div className="stat">
          <span className="label">Running</span>
          <span className="value running">{stats.running}</span>
        </div>
        <div className="stat">
          <span className="label">Completed</span>
          <span className="value completed">{stats.completed}</span>
        </div>
        <div className="stat">
          <span className="label">Failed</span>
          <span className="value failed">{stats.failed}</span>
        </div>
      </div>
    </header>
  );
};

export default memo(Header);
