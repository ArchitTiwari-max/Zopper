'use client';
import React from 'react';

type TabType = 'PHYSICAL' | 'DIGITAL' | 'HOLIDAY' | 'STAKEHOLDER';

interface Props {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const SubmissionTypeDropdown: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  return (
    <div style={{ margin: '16px 0', width: '100%', maxWidth: '300px' }}>
      <select
        value={activeTab}
        onChange={(e) => setActiveTab(e.target.value as TabType)}
        style={{
          width: '100%',
          padding: '10px 36px 10px 14px',
          borderRadius: '10px',
          border: '1px solid #cbd5e1',
          backgroundColor: '#ffffff',
          fontSize: '0.9rem',
          fontWeight: '600',
          color: '#1e293b',
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          transition: 'all 0.2s ease',
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          backgroundSize: '16px'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#3b82f6';
          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#cbd5e1';
          e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
        }}
      >
        <option value="PHYSICAL">🏢 Physical Visits</option>
        <option value="DIGITAL">💻 Digital Visits</option>
        <option value="STAKEHOLDER">🤝 Stakeholder Visits</option>
        <option value="HOLIDAY">🏖️ Vacation & Off</option>
      </select>
    </div>
  );
};

export default SubmissionTypeDropdown;
