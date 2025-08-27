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
    { id: 'settings', label: 'Settings', icon: 'icon-settings', active: pathname.includes('/admin/settings'), href: '/admin/settings' }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">Z</span>
          <span className="logo-text">ZopperTrack</span>
        </div>
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
