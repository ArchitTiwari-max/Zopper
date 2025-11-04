'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './Notifications.css';
import { useNotifications } from './components/contexts/NotificationContext';

const Notifications: React.FC = () => {
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

  // Refresh notifications when page loads
  useEffect(() => {
    refreshNotifications();
  }, []); // Empty dependency array means this runs once when component mounts

  const handleBackToDashboard = () => {
    router.push('/executive');
  };

  // Helper function to get notification icon
  const getNotificationIcon = (type: string, priority: string) => {
    switch (type) {
      case 'VISIT_REVIEWED': return priority === 'HIGH' ? '📝' : '✅';
      case 'ISSUE_ASSIGNED': return '📋';
      case 'ADMIN_COMMENT_ADDED': return '💬';
      case 'SYSTEM_ANNOUNCEMENT': return '📢';
      case 'VISIT_PLAN_ASSIGNED': return '📋';
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
      case 'VISIT_PLAN_ASSIGNED': return 'Visit Plan Assignments';
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
    <div className="exec-notif-notifications-container">
      <div className="exec-notif-notifications-content">
        {/* Header */}
        <div className="exec-notif-notifications-header">
          <button className="exec-notif-back-btn" onClick={handleBackToDashboard}>
            <span className="exec-notif-back-arrow">←</span>
            Back to Dashboard
          </button>
         
        </div>

        {/* Title Section */}
        <div className="exec-notif-notifications-title-section">
          <div className="exec-notif-title-row">
            <h1 className="exec-notif-notifications-title">Notifications</h1>
            <button className="exec-notif-mark-all-read-btn" onClick={markAllAsRead}>
              Mark all read
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="exec-notif-notifications-filters">
          <div className="exec-notif-filter-group">
            <label>Status:</label>
            <div className="exec-notif-filter-tabs">
              <button 
                className={`exec-notif-filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({notifications.length})
              </button>
              <button 
                className={`exec-notif-filter-tab ${filter === 'unread' ? 'active' : ''}`}
                onClick={() => setFilter('unread')}
              >
                Unread ({notifications.filter(n => n.status === 'UNREAD').length})
              </button>
              <button 
                className={`exec-notif-filter-tab ${filter === 'read' ? 'active' : ''}`}
                onClick={() => setFilter('read')}
              >
                Read ({notifications.filter(n => n.status === 'read').length})
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && notifications.length === 0 && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading notifications...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="exec-notif-error-state">
            <h3>Error Loading Notifications</h3>
            <p>{error}</p>
            <button onClick={refreshNotifications} className="exec-notif-retry-btn">
              Try Again
            </button>
          </div>
        )}

        {/* Notifications List */}
        {!loading && !error && (
          <div className="exec-notif-notifications-list">
            {notifications
              .filter(notification => {
                if (filter === 'unread' && notification.status !== 'UNREAD') return false;
                if (filter === 'read' && notification.status !== 'READ') return false;
                return true;
              })
              .map((notification) => (
                <div 
                  key={notification.id} 
                  className={`exec-notif-notification-item ${
                    notification.status === 'UNREAD' ? 'unread' : ''
                  } priority-${notification.priority.toLowerCase()}`}
                  onClick={() => handleViewDetails(notification)}
                >
                  <div className="exec-notif-notification-content">
                    <div className="exec-notif-notification-left">
                      <div className="exec-notif-notification-icon">
                        {getNotificationIcon(notification.type, notification.priority)}
                      </div>
                      <div className="exec-notif-notification-details">
                        <div className="exec-notif-notification-title-row">
                          <h3 className="exec-notif-notification-title">{notification.title}</h3>
                          {notification.status === 'UNREAD' && <span className="exec-notif-unread-dot">●</span>}
                        </div>
                        <p className="exec-notif-notification-description">
                          {(() => {
                            let message = notification.type === 'VISIT_PLAN_ASSIGNED' && notification.metadata?.adminComment 
                              ? notification.message.replace(new RegExp(`\. Comment: ${notification.metadata.adminComment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '')
                              : notification.message;
                            
                            // For visit plan assignments, make store names bold
                            if (notification.type === 'VISIT_PLAN_ASSIGNED' && notification.metadata?.storeNames) {
                              const storeNames = notification.metadata.storeNames;
                              storeNames.forEach(storeName => {
                                // Use case-insensitive regex without word boundaries for names with special chars
                                const escapedStoreName = storeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp(escapedStoreName, 'gi');
                                message = message.replace(regex, (match) => `<strong>${match}</strong>`);
                              });
                              return <span dangerouslySetInnerHTML={{ __html: message }} />;
                            }
                            return message;
                          })()
                          }
                        </p>
                        {notification.type === 'VISIT_PLAN_ASSIGNED' && notification.metadata?.adminComment && (
                          <p className="exec-notif-admin-comment">Admin Comment: {notification.metadata.adminComment}</p>
                        )}
                        <div className="exec-notif-notification-bottom">
                          <div className="exec-notif-meta-left">
                            <span className="exec-notif-notification-time">{getTimeAgo(notification.createdAt)}</span>
                            {(notification.priority === 'HIGH' || notification.priority === 'URGENT') && (
                              <span className={`exec-notif-priority-badge priority-${notification.priority.toLowerCase()}`}>
                                {notification.priority}
                              </span>
                            )}
                          </div>
                          <div className="exec-notif-notification-actions">
                            {notification.status === 'UNREAD' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="exec-notif-mark-read-btn"
                              >
                                Mark as Read
                              </button>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                archiveNotification(notification.id);
                              }}
                              className="exec-notif-archive-btn"
                            >
                              Archive
                            </button>
                          </div>
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
          <div className="exec-notif-empty-state">
            <div className="exec-notif-empty-icon">🔔</div>
            <h3 className="exec-notif-empty-title">No notifications yet</h3>
            <p className="exec-notif-empty-description">When you receive notifications, they'll appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
