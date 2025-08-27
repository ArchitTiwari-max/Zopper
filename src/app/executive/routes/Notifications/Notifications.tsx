'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import './Notifications.css';
import { useNotifications } from '../../../../contexts/NotificationContext';

const Notifications: React.FC = () => {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleBackToDashboard = () => {
    router.push('/executive');
  };

  const handleViewDetails = (notificationId: number) => {
    // Mark notification as read when viewing details
    markAsRead(notificationId);
    // Here you could navigate to a detailed view or show a modal
    alert('View Details functionality - detailed notification view');
  };

  return (
    <div className="notifications-container">
      <div className="notifications-content">
        {/* Header */}
        <div className="notifications-header">
          <button className="back-btn" onClick={handleBackToDashboard}>
            <span className="back-arrow">←</span>
            Back to Dashboard
          </button>
         
        </div>

        {/* Title Section */}
        <div className="notifications-title-section">
          <div className="title-row">
            <h1 className="notifications-title">Notifications</h1>
            <button className="mark-all-read-btn" onClick={markAllAsRead}>
              Mark all read
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="notifications-list">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
            >
              <div className="notification-content">
                <div className="notification-left">
                  <div className="notification-icon">
                    {notification.icon}
                  </div>
                  <div className="notification-details">
                    <div className="notification-title-row">
                      <h3 className="notification-title">{notification.title}</h3>
                      {!notification.isRead && <span className="unread-dot">●</span>}
                    </div>
                    {notification.description && (
                      <p className="notification-description">{notification.description}</p>
                    )}
                    <div className="notification-meta">
                      <span className="notification-time">{notification.timeAgo}</span>
                      <button 
                        className="view-details-btn"
                        onClick={() => handleViewDetails(notification.id)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State (if no notifications) */}
        {notifications.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <h3 className="empty-title">No notifications yet</h3>
            <p className="empty-description">When you receive notifications, they'll appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
