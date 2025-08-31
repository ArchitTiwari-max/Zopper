'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './assinged-task/ExecutiveTodoList.css';

const Footer: React.FC = () => {
  const pathname = usePathname();

  return (
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
      <Link href="/executive/visit-history" className={`nav-item ${pathname === '/executive/visit-history' ? 'active' : ''}`}>
        <span className="nav-icon">📋</span>
        <span className="nav-label">History</span>
      </Link>
    </div>
  );
};

export default Footer;
