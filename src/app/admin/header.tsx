'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

interface PageInfo {
  title: string;
  subtitle: string;
  showTimeframe?: boolean;
  showExport?: boolean;
  showSearch?: boolean;
  customActions?: React.ReactNode;
}

interface HeaderProps {
  currentPage?: string;
}

const Header: React.FC<HeaderProps> = ({ currentPage }) => {
  const pathname = usePathname();
  
  // Dynamic page configuration based on current route
  const getPageInfo = (): PageInfo => {
    // Handle specific store/executive/issue detail pages
    if (pathname.startsWith('/admin/stores/') && pathname !== '/admin/stores') {
      return {
        title: 'Store Visit Report',
        subtitle: 'Comprehensive overview of store visits and executive feedback',
        showExport: true
      };
    }
    
    if (pathname.startsWith('/admin/executives/') && pathname !== '/admin/executives') {
      return {
        title: 'Executive Profile',
        subtitle: 'Detailed view of executive performance and activities',
        showTimeframe: true
      };
    }
    
    if (pathname.startsWith('/admin/issues/') && pathname !== '/admin/issues') {
      return {
        title: 'Issue Management',
        subtitle: 'Comprehensive issue tracking and resolution management'
      };
    }
    
    // Handle main section pages
    switch (pathname) {
      case '/admin/dashboard':
        return {
          title: 'Dashboard',
          subtitle: 'Monitor field activities and track executive performance',
          showTimeframe: true
        };
      case '/admin/stores':
        return {
          title: 'Stores',
          subtitle: 'Manage and monitor partner store relationships',
          showSearch: true,
          showExport: true
        };
      case '/admin/executives':
        return {
          title: 'Executives',
          subtitle: 'Track field executive performance and assignments',
          showSearch: true
        };
      case '/admin/issues':
        return {
          title: 'Issues',
          subtitle: 'Track and resolve store visit issues and concerns',
          showSearch: true
        };
      case '/admin/settings':
        return {
          title: 'Settings',
          subtitle: 'Configure system preferences and notifications'
        };
      default:
        return {
          title: currentPage || 'Dashboard',
          subtitle: 'Admin panel management'
        };
    }
  };
  
  const pageInfo = getPageInfo();
  
  return (
    <header className="dashboard-header">
      <div className="header-left">
        <div className="header-title-section">
          <h1>{pageInfo.title}</h1>
          <p className="header-subtitle">{pageInfo.subtitle}</p>
        </div>
      </div>
      <div className="header-right">
        {/* Dynamic actions based on page */}
        <div className="header-actions">
          {pageInfo.showTimeframe && (
            <div className="header-control">
              <label htmlFor="timeframe-select">Period</label>
              <select id="timeframe-select" className="header-select">
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
                <option value="Last 90 Days">Last 90 Days</option>
              </select>
            </div>
          )}
          
          {pageInfo.showSearch && (
            <div className="header-control">
              <div className="header-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <input 
                  type="text" 
                  placeholder={`Search ${pageInfo.title.toLowerCase()}...`}
                  className="header-search-input"
                />
              </div>
            </div>
          )}
          
          {pageInfo.showExport && (
            <button className="header-export-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Export
            </button>
          )}
          
          {pageInfo.customActions && pageInfo.customActions}
        </div>
        
        {/* Static elements */}
        <div className="header-static">
          <div className="notifications">
            <span className="notification-badge">2</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6981 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="user-profile">
            <div className="user-avatar">AD</div>
            <div className="user-info">
              <span className="user-name">Admin User</span>
              <span className="user-region">North Region</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
