import React, { memo } from 'react';

const WorkflowTemplates = () => {
  return (
    <section className="templates">
      <h2>Workflow Templates</h2>
      <div className="template-grid">
        <div className="template-card">
          <h3>🐛 Bug Fix</h3>
          <p>Auto-fix from labeled issues</p>
          <span className="template-trigger">Trigger: bug-auto label</span>
        </div>
        <div className="template-card">
          <h3>✨ Feature</h3>
          <p>Implement feature from spec</p>
          <span className="template-trigger">Trigger: @tools\jules-mcp\dist\client\jules-client.js implement</span>
        </div>
        <div className="template-card">
          <h3>📦 Dependencies</h3>
          <p>Weekly update check</p>
          <span className="template-trigger">Trigger: Monday 2 AM</span>
        </div>
        <div className="template-card">
          <h3>🔒 Security</h3>
          <p>Patch vulnerabilities</p>
          <span className="template-trigger">Trigger: Scanner alert</span>
        </div>
        <div className="template-card">
          <h3>📝 Docs</h3>
          <p>Sync documentation</p>
          <span className="template-trigger">Trigger: main push</span>
        </div>
      </div>
    </section>
  );
};

export default memo(WorkflowTemplates);
