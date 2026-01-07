import React, { memo } from 'react';

// Status color and icon maps
const STATUS_COLORS = {
  pending: '#ffa500',
  running: '#2196f3',
  awaiting_approval: '#ff9800',
  executing: '#4caf50',
  completed: '#4caf50',
  failed: '#f44336'
};

const STATUS_ICONS = {
  pending: '⏳',
  running: '🔄',
  awaiting_approval: '⏸️',
  executing: '⚡',
  completed: '✅',
  failed: '❌'
};

const getStatusColor = (status) => STATUS_COLORS[status] || '#999';
const getStatusIcon = (status) => STATUS_ICONS[status] || '•';

const WorkflowList = ({ workflows }) => {
  return (
    <div className="workflow-list">
      {workflows.map(workflow => (
        <div key={workflow.id} className="workflow-card">
          <div className="workflow-header">
            <span className="workflow-icon" style={{ color: getStatusColor(workflow.status) }}>
              {getStatusIcon(workflow.status)}
            </span>
            <div className="workflow-info">
              <h3>{workflow.context_json.repo_name}</h3>
              <p className="workflow-title">{workflow.context_json.issue_title || workflow.template_name}</p>
            </div>
            <span className="workflow-status" style={{ backgroundColor: getStatusColor(workflow.status) }}>
              {workflow.status}
            </span>
          </div>

          <div className="workflow-details">
            <div className="detail">
              <span className="detail-label">Template:</span>
              <span>{workflow.template_name}</span>
            </div>
            <div className="detail">
              <span className="detail-label">Created:</span>
              <span>{new Date(workflow.created_at).toLocaleString()}</span>
            </div>
            {workflow.pr_url && (
              <div className="detail">
                <a href={workflow.pr_url} target="_blank" rel="noopener noreferrer">
                  View PR →
                </a>
              </div>
            )}
          </div>

          {workflow.status === 'awaiting_approval' && (
            <div className="workflow-actions">
              <button className="approve">✓ Approve</button>
              <button className="reject">✗ Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default memo(WorkflowList);
