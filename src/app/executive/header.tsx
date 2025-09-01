'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import './header.css';
import NotificationDropdown from './notifications/components/NotificationDropdown/NotificationDropdown';
import { useNotifications } from './notifications/components/contexts/NotificationContext';

const Header: React.FC = () => {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [userInitials, setUserInitials] = useState('U');
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleNotificationClick = () => {
    setIsNotificationOpen(!isNotificationOpen);
  };

  const handleCloseNotification = () => {
    setIsNotificationOpen(false);
  };

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
    if (!name || name.trim() === '') return 'U';
    
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    
    if (nameParts.length === 0) return 'U';
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
          const userName = userData.executive?.name || userData.admin?.name || '';
          const initials = generateInitials(userName);
          setUserInitials(initials);
        }
      } catch (error) {
        console.error('Error parsing user cookie in header:', error);
        setUserInitials('U'); // Fallback
      }
    };

    // Add a small delay to ensure cookies are available
    setTimeout(loadUserInitials, 100);
  }, []);

  return (
    <div className="header">
      <div className="logo-container">
        <div className="logo-icon">Z</div>
        <span className="logo-text">ZopperTrack</span>
      </div>
      <div className="header-right">
        <div className="notification-container">
          <div className="notifications" onClick={handleNotificationClick}>
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6981 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <NotificationDropdown
            isOpen={isNotificationOpen}
            onClose={handleCloseNotification}
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onMarkAllRead={markAllAsRead}
          />
        </div>
        <Link href="/executive/profile" className="profile-avatar">{userInitials}</Link>
      </div>
    </div>
  );
};

export default Header;
