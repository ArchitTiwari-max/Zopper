'use client';

import React, { useState } from 'react';
import './routes/ExecutiveTodoList/ExecutiveTodoList.css';
import NotificationDropdown from '../components/NotificationDropdown/NotificationDropdown';
import { useNotifications } from '../contexts/NotificationContext';

const Header: React.FC = () => {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleNotificationClick = () => {
    setIsNotificationOpen(!isNotificationOpen);
  };

  const handleCloseNotification = () => {
    setIsNotificationOpen(false);
  };

  return (
    <div className="header">
      <div className="logo-container">
        <div className="logo-icon">Z</div>
        <span className="logo-text">ZopperTrack</span>
      </div>
      <div className="header-right">
        <div className="notification-container">
          <div 
            className="notification-bell" 
            onClick={handleNotificationClick}
          >
            <span className="bell-icon">🔔</span>
            {unreadCount > 0 && (
              <span className="notification-count">{unreadCount}</span>
            )}
          </div>
          <NotificationDropdown
            isOpen={isNotificationOpen}
            onClose={handleCloseNotification}
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onMarkAllRead={markAllAsRead}
          />
        </div>
        <div className="profile-avatar">SK</div>
      </div>
    </div>
  );
};

export default Header;
