'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './Notifications.css';
import { useNotifications } from './components/contexts/NotificationContext';

const AdminNotifications: React.FC = () => {
  const router = useRouter();
  const { 
    notifications, 
    loading, 
    error, 
    markAsRead, 
    markAllAsRead, 
    archiveNotification,
    refreshNotifications 
  } = useNotifications();
  
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Refresh notifications when page loads to ensure latest data
  useEffect(() => {
    refreshNotifications();
  }, []); // Empty dependency array means this runs once when component mounts

  const handleBackToDashboard = () => {
    router.push('/admin/dashboard');
  };

  // Helper function to get notification icon
  const getNotificationIcon = (type: string, priority: string) => {
    switch (type) {
      case 'VISIT_REVIEWED': return priority === 'HIGH' ? '📝' : '✅';
      case 'ISSUE_ASSIGNED': return '📋';
      case 'ADMIN_COMMENT_ADDED': return '💬';
      case 'SYSTEM_ANNOUNCEMENT': return '📢';
      default: return '🔔';
    }
  };

  // Helper function to format relative time
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const notificationDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  // Get display title for notification types
  const getTypeDisplayName = (type: string) => {
    switch (type) {
      case 'VISIT_REVIEWED': return 'Visit Reviews';
      case 'ISSUE_ASSIGNED': return 'Issue Assignments';
      case 'ADMIN_COMMENT_ADDED': return 'Admin Comments';
      case 'SYSTEM_ANNOUNCEMENT': return 'System Announcements';
      default: return type;
    }
  };

  const handleViewDetails = (notification: any) => {
    if (notification.status === 'UNREAD') {
      markAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    <div className="notifications-container">
      <div className="notifications-content">
        {/* Title Section */}
        <div className="notifications-title-section">
          <div className="title-row">
            <button className="mark-all-read-btn" onClick={markAllAsRead}>
              Mark all read
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="notif-filters">
          <div className="notif-filter-group">
            <label>Status:</label>
            <div className="notif-filter-tabs">
              <button 
                className={`notif-filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({notifications.length})
              </button>
              <button 
                className={`notif-filter-tab ${filter === 'unread' ? 'active' : ''}`}
                onClick={() => setFilter('unread')}
              >
                Unread ({notifications.filter(n => n.status === 'UNREAD').length})
              </button>
              <button 
                className={`notif-filter-tab ${filter === 'read' ? 'active' : ''}`}
                onClick={() => setFilter('read')}
              >
                Read ({notifications.filter(n => n.status === 'read').length})
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && notifications.length === 0 && (
          <div className="notif-loading-state">
            <div className="loading-spinner"></div>
            <p>Loading notifications...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="notif-error-state">
            <h3>Error Loading Notifications</h3>
            <p>{error}</p>
            <button onClick={refreshNotifications} className="notif-retry-btn">
              Try Again
            </button>
          </div>
        )}

        {/* Notifications List */}
        {!loading && !error && (
          <div className="notifications-list">
            {notifications
              .filter(notification => {
                if (filter === 'unread' && notification.status !== 'UNREAD') return false;
                if (filter === 'read' && notification.status !== 'read') return false;
                return true;
              })
              .map((notification) => (
                <div 
                  key={notification.id} 
                  className={`notification-item ${
                    notification.status === 'UNREAD' ? 'unread' : ''
                  } priority-${notification.priority.toLowerCase()}`}
                  onClick={() => handleViewDetails(notification)}
                >
                  <div className="notification-content">
                    <div className="notification-left">
                      <div className="notification-icon">
                        {getNotificationIcon(notification.type, notification.priority)}
                      </div>
                      <div className="notification-details">
                        <div className="notification-title-row">
                          <h3 className="notification-title">{notification.title}</h3>
                          {notification.status === 'UNREAD' && <span className="unread-dot">●</span>}
                        </div>
                        <p className="notification-description">{notification.message}</p>
                        <div className="notification-meta">
                          <span className="notification-time">{getTimeAgo(notification.createdAt)}</span>
                          <span className="notification-type">
                            {getTypeDisplayName(notification.type)}
                          </span>
                          {(notification.priority === 'HIGH' || notification.priority === 'URGENT') && (
                            <span className={`priority-badge priority-${notification.priority.toLowerCase()}`}>
                              {notification.priority}
                            </span>
                          )}
                        </div>
                        <div className="notification-actions">
                          {notification.status === 'UNREAD' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="mark-read-btn"
                            >
                              Mark as Read
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveNotification(notification.id);
                            }}
                            className="archive-btn"
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && notifications.length === 0 && (
          <div className="notif-empty-state">
            <div className="notif-empty-icon">🔔</div>
            <h3 className="notif-empty-title">No notifications yet</h3>
            <p className="notif-empty-description">When you receive notifications, they'll appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;
