'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './NotificationDropdown.css';

interface Notification {
  id: number;
  type: 'task' | 'approval' | 'system';
  title: string;
  description?: string;
  timeAgo: string;
  isRead: boolean;
  icon: string;
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: number) => void;
  onMarkAllRead: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllRead
}) => {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleViewAllNotifications = () => {
    router.push('/notifications');
    onClose();
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    // Handle specific notification actions here
    // For now, we'll just mark as read
  };

  const recentNotifications = notifications.slice(0, 4); // Show only first 4 notifications
  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isOpen) return null;

  return (
    <div className="notification-dropdown" ref={dropdownRef}>
      <div className="notification-dropdown-header">
        <div className="notification-dropdown-title">
          <h3>Notifications</h3>
          {unreadCount > 0 && (
            <span className="unread-count-badge">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button 
            className="mark-all-read-btn-dropdown" 
            onClick={onMarkAllRead}
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="notification-dropdown-content">
        {recentNotifications.length > 0 ? (
          recentNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-dropdown-item ${!notification.isRead ? 'unread' : ''}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-dropdown-icon">
                {notification.icon}
              </div>
              <div className="notification-dropdown-details">
                <div className="notification-dropdown-title-row">
                  <h4 className="notification-dropdown-item-title">
                    {notification.title}
                  </h4>
                  {!notification.isRead && <span className="unread-dot">●</span>}
                </div>
                {notification.description && (
                  <p className="notification-dropdown-description">
                    {notification.description.length > 60 
                      ? `${notification.description.substring(0, 60)}...` 
                      : notification.description
                    }
                  </p>
                )}
                <span className="notification-dropdown-time">
                  {notification.timeAgo}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="notification-dropdown-empty">
            <div className="empty-icon">🔔</div>
            <p>No notifications yet</p>
          </div>
        )}
      </div>

      <div className="notification-dropdown-footer">
        <button 
          className="view-all-btn" 
          onClick={handleViewAllNotifications}
        >
          View All Notifications
          {notifications.length > 4 && (
            <span className="more-count">+{notifications.length - 4}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default NotificationDropdown;
