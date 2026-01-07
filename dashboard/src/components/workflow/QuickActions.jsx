import React, { memo } from 'react';

const QuickActions = ({ executeWorkflow, executingWorkflow }) => {
  return (
    <section className="quick-actions">
      <h2>Quick Actions</h2>
      <div className="action-buttons">
        <button
          onClick={() => executeWorkflow('dependency-update', { repo_name: 'scarmonit/jules-orchestrator' })}
          disabled={executingWorkflow === 'dependency-update'}
          aria-label="Update project dependencies"
        >
          {executingWorkflow === 'dependency-update' ? '⏳ Starting...' : '📦 Update Dependencies'}
        </button>
        <button
          onClick={() => executeWorkflow('documentation-sync', { repo_name: 'scarmonit/jules-orchestrator' })}
          disabled={executingWorkflow === 'documentation-sync'}
          aria-label="Synchronize documentation"
        >
          {executingWorkflow === 'documentation-sync' ? '⏳ Syncing...' : '📝 Sync Docs'}
        </button>
        <button
          onClick={() => executeWorkflow('security-patch', { repo_name: 'scarmonit/jules-orchestrator' })}
          disabled={executingWorkflow === 'security-patch'}
          aria-label="Run security scan"
        >
          {executingWorkflow === 'security-patch' ? '⏳ Scanning...' : '🔒 Security Scan'}
        </button>
      </div>
    </section>
  );
};

export default memo(QuickActions);
