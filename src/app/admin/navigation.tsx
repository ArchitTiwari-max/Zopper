'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavigationItem } from './types';

const Navigation: React.FC = () => {
  const pathname = usePathname();

  const navigationItems: NavigationItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'icon-dashboard', active: pathname.includes('/admin/dashboard'), href: '/admin/dashboard' },
    { id: 'stores', label: 'Stores', icon: 'icon-stores', active: pathname.includes('/admin/stores'), href: '/admin/stores' },
    { id: 'executives', label: 'Executives', icon: 'icon-executives', active: pathname.includes('/admin/executives'), href: '/admin/executives' },
    { id: 'issues', label: 'Issues', icon: 'icon-issues', active: pathname.includes('/admin/issues'), href: '/admin/issues' },
    { id: 'visit-report', label: 'Physical Visit Report', icon: 'icon-visit-report', active: pathname.includes('/admin/visit-report'), href: '/admin/visit-report' },
    { id: 'digital-report', label: 'Digital Connect Report', icon: 'icon-call', active: pathname.includes('/admin/digital-report'), href: '/admin/digital-report' },
    { id: 'analytics-impact', label: 'Analytics & Impact', icon: 'icon-dashboard', active: pathname.includes('/admin/analytics-impact'), href: '/admin/analytics-impact' },
    { id: 'attendance', label: 'Attendance Tracker', icon: 'icon-attendance', active: pathname.includes('/admin/attendance'), href: '/admin/attendance' }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Link href="/admin/dashboard" className="logo-link" aria-label="SalesDost - Safalta ka Sathi - Go to Admin Dashboard">
          <div className="logo">
            <span className="logo-icon">S</span>
            <div className="logo-text-container">
              <span className="logo-text">SalesDost</span>
              <span className="logo-tagline">Safalta ka Sathi</span>
            </div>
          </div>
        </Link>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {navigationItems.map(item => (
            <li key={item.id}>
              <Link 
                href={item.href} 
                className={`nav-item ${item.active ? 'active' : ''}`}
              >
                <i className={item.icon}></i>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Navigation;
