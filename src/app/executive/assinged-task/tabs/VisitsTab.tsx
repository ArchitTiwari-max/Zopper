'use client';

import React from 'react';

const VisitsTab: React.FC = () => {
  return (
    <div className="tab-panel">
      <div className="placeholder-content">
        <div className="placeholder-icon">🏪</div>
        <h3>Pending Visit Assignments</h3>
        <p>Visit assignments from admins will appear here.</p>
        <span className="coming-soon">Coming Soon</span>
      </div>
    </div>
  );
};

export default VisitsTab;
