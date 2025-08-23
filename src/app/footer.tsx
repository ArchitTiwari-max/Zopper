'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './routes/ExecutiveTodoList/ExecutiveTodoList.css';

const Footer: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="bottom-navigation">
      <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
        <span className="nav-icon">📊</span>
        <span className="nav-label">Dashboard</span>
      </Link>
      <Link href="/store" className={`nav-item ${pathname === '/store' ? 'active' : ''}`}>
        <span className="nav-icon">🏪</span>
        <span className="nav-label">Stores</span>
      </Link>
      <Link href="/visit-history" className={`nav-item ${pathname === '/visit-history' ? 'active' : ''}`}>
        <span className="nav-icon">📋</span>
        <span className="nav-label">History</span>
      </Link>
      <Link href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}>
        <span className="nav-icon">⚙️</span>
        <span className="nav-label">Settings</span>
      </Link>
    </div>
  );
};

export default Footer;
