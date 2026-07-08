'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './footer.css';
import DostWidget from './components/DostWidget';

const Footer: React.FC = () => {
  const pathname = usePathname();

  return (
    <>
      {/* Bottom nav */}
      <div className="bottom-navigation">
        <Link href="/executive" className={`nav-item ${pathname === '/executive' || pathname === '/executive/dashboard' ? 'active' : ''}`}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </Link>
        <Link href="/executive/store" className={`nav-item ${pathname === '/executive/store' ? 'active' : ''}`}>
          <span className="nav-icon">🏪</span>
          <span className="nav-label">Stores</span>
        </Link>
        <Link href="/executive/assinged-task" className={`nav-item ${pathname === '/executive/assinged-task' ? 'active' : ''}`}>
          <span className="nav-icon">📝</span>
          <span className="nav-label">Tasks</span>
        </Link>
        {/* Insights tab — temporarily hidden */}
        {/* <Link href="/executive/analytics-impact" className={`nav-item ${pathname === '/executive/analytics-impact' ? 'active' : ''}`}>
          <span className="nav-icon">💡</span>
          <span className="nav-label">Insights</span>
        </Link> */}
        <Link href="/executive/stakeholder-visit-form" className={`nav-item ${pathname === '/executive/stakeholder-visit-form' ? 'active' : ''}`}>
          <span className="nav-icon">🤝</span>
          <span className="nav-label">Stakeholders</span>
        </Link>
        <Link href="/executive/visit-history" className={`nav-item ${pathname === '/executive/visit-history' ? 'active' : ''}`}>
          <span className="nav-icon">📋</span>
          <span className="nav-label">My Submissions</span>
        </Link>
      </div>

      {/* Dost widget anchored above footer */}
      <DostWidget />
    </>
  );
};

export default Footer;
