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
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  // Refresh notifications when page loads to ensure latest data
  useEffect(() => {
    refreshNotifications();
  }, []); // Empty dependency array means this runs once when component mounts

  const handleBackToDashboard = () => {
    router.push('/admin/dashboard');
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
      case 'VISIT_PLAN_SUBMITTED': return null; // Don't show type for visit plans
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

  // Helper function to format planned visit date
  const formatPlannedVisitDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return dateString;
    }
  };

  // Helper function to extract metadata for visit plan notifications
  const getVisitPlanMetadata = (notification: any) => {
    if (notification.type !== 'VISIT_PLAN_SUBMITTED' || !notification.metadata) {
      return null;
    }

    try {
      const metadata = typeof notification.metadata === 'string'
        ? JSON.parse(notification.metadata)
        : notification.metadata;

      return {
        plannedVisitDate: metadata.plannedVisitDate,
        executiveName: metadata.executiveName,
        storeCount: metadata.storeCount,
        storeNames: metadata.storeNames || [],
        flaggedStoreNames: metadata.flaggedStoreNames || [] // Get flagged stores
      };
    } catch {
      return null;
    }
  };

  // Toggle store details expansion
  const toggleStoreExpansion = (notificationId: string) => {
    setExpandedStores(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const renderStoreName = (name: string, flaggedNames: string[]) => {
    const isFlagged = flaggedNames.includes(name);
    return (
      <span key={name} style={isFlagged ? { backgroundColor: '#fef08a', padding: '0 4px', borderRadius: '4px', fontWeight: '500' } : {}}>
        {name} {isFlagged && '⭐'}
      </span>
    );
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
                  className={`notification-item ${notification.status === 'UNREAD' ? 'unread' : ''
                    } priority-${notification.priority.toLowerCase()} ${notification.type === 'VISIT_PLAN_SUBMITTED' ? 'no-click' : ''
                    }`}
                  onClick={notification.type === 'VISIT_PLAN_SUBMITTED' ? undefined : () => handleViewDetails(notification)}
                >
                  <div className="notification-content">
                    <div className="notification-left">
                      <div className="notification-details">
                        <div className="notification-title-row">
                          <h3 className="notification-title">{notification.title}</h3>
                          {notification.status === 'UNREAD' && <span className="unread-dot">●</span>}
                        </div>
                        {/* Only show message for non-visit plan notifications */}
                        {notification.type !== 'VISIT_PLAN_SUBMITTED' && (
                          <p className="notification-description">{notification.message}</p>
                        )}

                        {/* Visit Plan Specific Metadata */}
                        {(() => {
                          const visitPlanMeta = getVisitPlanMetadata(notification);
                          if (visitPlanMeta) {
                            return (
                              <div className="visit-plan-details">
                                {visitPlanMeta.plannedVisitDate && (
                                  <div className="planned-visit-date">
                                    <span className="visit-date-label">Planned Visit:</span>
                                    <span className="visit-date-value">
                                      {formatPlannedVisitDate(visitPlanMeta.plannedVisitDate)}
                                    </span>
                                  </div>
                                )}
                                {visitPlanMeta.executiveName && (
                                  <div className="executive-info">
                                    <span className="executive-label">👤 Executive:</span>
                                    <span className="executive-value">{visitPlanMeta.executiveName}</span>
                                  </div>
                                )}
                                {visitPlanMeta.storeCount > 0 && (
                                  <div className="store-info">
                                    <span className="store-label">🏪 Stores:</span>
                                    <div className="store-value-container">
                                      <span className="store-value">
                                        {visitPlanMeta.storeCount} store{visitPlanMeta.storeCount !== 1 ? 's' : ''}
                                        {visitPlanMeta.storeNames.length > 0 && visitPlanMeta.storeNames.length <= 3 && (
                                          <span className="store-names">
                                            {' - '}
                                            {visitPlanMeta.storeNames.map((name: string, idx: number) => (
                                              <React.Fragment key={idx}>
                                                {idx > 0 && ', '}
                                                {renderStoreName(name, visitPlanMeta.flaggedStoreNames)}
                                              </React.Fragment>
                                            ))}
                                          </span>
                                        )}
                                        {visitPlanMeta.storeNames.length > 3 && !expandedStores.has(notification.id) && (
                                          <span className="store-names">
                                            {' - '}
                                            {visitPlanMeta.storeNames.slice(0, 2).map((name: string, idx: number) => (
                                              <React.Fragment key={idx}>
                                                {idx > 0 && ', '}
                                                {renderStoreName(name, visitPlanMeta.flaggedStoreNames)}
                                              </React.Fragment>
                                            ))}
                                            <button
                                              className="view-stores-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleStoreExpansion(notification.id);
                                              }}
                                            >
                                              +{visitPlanMeta.storeNames.length - 2} more
                                            </button>
                                          </span>
                                        )}
                                        {visitPlanMeta.storeNames.length > 3 && expandedStores.has(notification.id) && (
                                          <span className="store-names-expanded">
                                            {' - '}
                                            {visitPlanMeta.storeNames.map((name: string, idx: number) => (
                                              <React.Fragment key={idx}>
                                                {idx > 0 && ', '}
                                                {renderStoreName(name, visitPlanMeta.flaggedStoreNames)}
                                              </React.Fragment>
                                            ))}
                                            <button
                                              className="hide-stores-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleStoreExpansion(notification.id);
                                              }}
                                            >
                                              Show less
                                            </button>
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <div className="notification-meta">
                          {getTypeDisplayName(notification.type) && (
                            <span className="notification-type">
                              {getTypeDisplayName(notification.type)}
                            </span>
                          )}
                          {(notification.priority === 'HIGH' || notification.priority === 'URGENT') && (
                            <span className={`priority-badge priority-${notification.priority.toLowerCase()}`}>
                              {notification.priority}
                            </span>
                          )}
                        </div>
                        <div className="notification-actions">
                          <span className="notification-time">{getTimeAgo(notification.createdAt)}</span>
                          <div className="action-buttons">
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
