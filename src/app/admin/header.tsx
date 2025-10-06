'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDateFilter } from './contexts/DateFilterContext';
import { useNotifications } from './notifications/components/contexts/NotificationContext';

interface PageInfo {
  title: string;
  subtitle: string;
}

interface HeaderProps {
  currentPage?: string;
}

const Header: React.FC<HeaderProps> = ({ currentPage }) => {
  const pathname = usePathname();
  const { selectedDateFilter, setSelectedDateFilter } = useDateFilter();
  const { unreadCount } = useNotifications();
  const [userInitials, setUserInitials] = useState('AD');
  
  // Helper function to get cookie value
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    return null;
  };
  
  // Function to generate initials from name
  const generateInitials = (name: string): string => {
    if (!name || name.trim() === '') return 'AD';
    
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    
    if (nameParts.length === 0) return 'AD';
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    
    // Get first letter of first name and first letter of last name
    const firstInitial = nameParts[0].charAt(0).toUpperCase();
    const lastInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
    
    return firstInitial + lastInitial;
  };
  
  // Load user data from cookie on component mount
  useEffect(() => {
    const loadUserInitials = () => {
      try {
        const userInfoCookie = getCookie('userInfo');
        
        if (userInfoCookie) {
          const userData = JSON.parse(userInfoCookie);
          const userName = userData.admin?.name || userData.name || '';
          const initials = generateInitials(userName);
          setUserInitials(initials);
        }
      } catch (error) {
        console.error('Error parsing user cookie in admin header:', error);
        setUserInitials('AD'); // Fallback
      }
    };
    
    // Add a small delay to ensure cookies are available
    setTimeout(loadUserInitials, 100);
  }, []);
  
  // Dynamic page configuration based on current route
  const getPageInfo = (): PageInfo => {
    // Handle specific store/executive/issue detail pages
    if (pathname.startsWith('/admin/stores/') && pathname !== '/admin/stores') {
      return {
        title: 'Store Visit Report',
        subtitle: 'Comprehensive overview of store visits and executive feedback'
      };
    }
    
    if (pathname.startsWith('/admin/executives/') && pathname !== '/admin/executives') {
      return {
        title: 'Executive Profile',
        subtitle: 'Detailed view of executive performance and activities'
      };
    }
    
    if (pathname.startsWith('/admin/issues/') && pathname !== '/admin/issues') {
      return {
        title: 'Issue Details',
        subtitle: 'View and manage individual issue resolution'
      };
    }
    
    // Handle main section pages
    switch (pathname) {
      case '/admin/dashboard':
        return {
          title: 'Dashboard',
          subtitle: 'Monitor field activities and track executive performance'
        };
      case '/admin/stores':
        return {
          title: 'Stores',
          subtitle: 'Manage and monitor partner store relationships'
        };
      case '/admin/executives':
        return {
          title: 'Executives',
          subtitle: 'Track field executive performance and assignments'
        };
      case '/admin/issues':
        return {
          title: 'Issue Management',
          subtitle: 'Track and resolve store visit issues and concerns'
        };
      case '/admin/visit-report':
        return {
          title: 'Visit Reports',
          subtitle: 'Unified view of all store and executive visits across regions'
        };
      case '/admin/digital-report':
        return {
          title: 'Digital Connect',
          subtitle: 'Manage and review digital visit connects'
        };
      case '/admin/attendance':
        return {
          title: 'Attendance Tracker',
          subtitle: 'Daily submission status by executive'
        };
      case '/admin/settings':
        return {
          title: 'Settings',
          subtitle: 'Configure system preferences and notifications'
        };
      case '/admin/analytics-impact':
        return {
          title: 'Analytics & Impact',
          subtitle: 'Compare before vs after visit impact by brand'
        };
      case '/admin/notifications':
        return {
          title: 'Notification',
          subtitle: 'Manage your notifications and alerts'
        };
      case '/admin/sales':
        return {
          title: 'Sales',
          subtitle: 'Sales monitor of stores'
        };
      case '/admin/datamanagement':
        return {
          title: 'Data Management Dashboard',
          subtitle: 'Comprehensive data import and management for sales, stores, executives, and user administration'
        };
      case '/admin/datamanagement/monthwise':
        return {
          title: 'Monthly Sales Import',
          subtitle: 'Import monthly sales data with device sales, plan sales, and revenue metrics'
        };
      case '/admin/datamanagement/datewise':
        return {
          title: 'Daily Sales Import',
          subtitle: 'Import daily sales data with count of sales and revenue by specific dates'
        };
      case '/admin/datamanagement/storewise':
        return {
          title: 'Store & Executive Import',
          subtitle: 'Import store information and manage executive assignments efficiently'
        };
      case '/admin/datamanagement/usermanagement':
        return {
          title: 'User Management',
          subtitle: 'Create, manage, and export user accounts with comprehensive administrative controls'
        };
      default:
        return {
          title: currentPage || 'Dashboard',
          subtitle: 'Admin panel management'
        };
    }
  };
  
  const pageInfo = getPageInfo();
  
  // Check if current page should show date filter
  const shouldShowDateFilter = () => {
    return pathname === '/admin/dashboard' ||
           pathname === '/admin/stores' ||
           pathname === '/admin/issues' || 
           pathname === '/admin/visit-report' ||
           pathname === '/admin/digital-report' ||
           pathname === '/admin/executives' ||
           pathname === '/admin/attendance' ||
           pathname.startsWith('/admin/issues/');
  };
  
  return (
    <header className="dashboard-header">
      <div className="header-left">
        <div className="header-title-section">
          <h1>{pageInfo.title}</h1>
          <p className="header-subtitle">{pageInfo.subtitle}</p>
        </div>
      </div>
      <div className="header-right">
        {/* Conditional date filter - only show on issues and visit-report pages */}
        {shouldShowDateFilter() && (
          <div className="date-filter-wrapper">
            <select
              id="timeframe-select"
              className="header-select"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value as any)}
            >
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Last 90 Days">Last 90 Days</option>
              <option value="Last Year">Last Year</option>
            </select>
          </div>
        )}
        
        {/* Static elements */}
        <div className="header-static">
          <Link 
            href="/admin/notifications" 
            className="notifications"
            aria-label="View Notifications"
            title="Notifications"
          >
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6981 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link 
            href="/admin/settings" 
            className="user-avatar"
            aria-label="Go to Settings - Admin Profile"
            title="Settings"
          >
            {userInitials}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
