'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'VISIT_REVIEWED' | 'ISSUE_ASSIGNED' | 'ADMIN_COMMENT_ADDED' | 'SYSTEM_ANNOUNCEMENT' | 'VISIT_PLAN_ASSIGNED';
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  readAt?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  // Related entities
  visit?: {
    id: string;
    store: {
      storeName: string;
    };
  };
  assigned?: {
    id: string;
    issue: {
      details: string;
      visit: {
        store: {
          storeName: string;
        };
      };
    };
  };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setError(null);
      const response = await fetch('/api/notifications?limit=20', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      if (data.success) {
        setNotifications(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch notifications');
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/count', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUnreadCount(data.count || 0);
        }
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const refreshNotifications = async () => {
    setLoading(true);
    await Promise.all([fetchNotifications(), fetchUnreadCount()]);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          notificationIds: [notificationId],
          action: 'markAsRead'
        }),
      });

      if (response.ok) {
        // Optimistically update the UI
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId
              ? { ...notif, status: 'READ' as const, readAt: new Date().toISOString() }
              : notif
          )
        );
        
        // Update unread count
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(notif => notif.status === 'UNREAD')
        .map(notif => notif.id);

      if (unreadIds.length === 0) return;

      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          notificationIds: unreadIds,
          action: 'markAsRead'
        }),
      });

      if (response.ok) {
        // Optimistically update the UI
        setNotifications(prev =>
          prev.map(notif =>
            notif.status === 'UNREAD'
              ? { ...notif, status: 'READ' as const, readAt: new Date().toISOString() }
              : notif
          )
        );
        
        // Reset unread count
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const archiveNotification = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          notificationIds: [notificationId],
          action: 'archive'
        }),
      });

      if (response.ok) {
        // Remove from current list
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        
        // Update unread count if it was unread
        const notification = notifications.find(n => n.id === notificationId);
        if (notification && notification.status === 'UNREAD') {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Error archiving notification:', err);
    }
  };

  // Initial load and periodic refresh
  useEffect(() => {
    refreshNotifications();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    archiveNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
