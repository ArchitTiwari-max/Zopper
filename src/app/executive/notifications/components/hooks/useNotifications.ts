'use client';

import { useState, useEffect } from 'react';

export interface Notification {
  id: number;
  type: 'task' | 'approval' | 'system';
  title: string;
  description?: string;
  timeAgo: string;
  isRead: boolean;
  icon: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      type: 'task',
      title: 'Admin assigned you a new Task',
      timeAgo: '2m ago',
      isRead: false,
      icon: '👤'
    },
    {
      id: 2,
      type: 'approval',
      title: 'Admin approved your visit plan',
      description: 'Talk To Store Owner And send the report to me personally',
      timeAgo: '1 day ago',
      isRead: false,
      icon: '👤'
    },
    {
      id: 3,
      type: 'approval',
      title: 'Admin approved your visit plan',
      timeAgo: '2 day ago',
      isRead: true,
      icon: '👤'
    },
    {
      id: 4,
      type: 'system',
      title: 'System maintenance scheduled',
      description: 'Maintenance on 18th Aug, 1 AM - 3 AM',
      timeAgo: '3 day ago',
      isRead: true,
      icon: '🔧'
    }
  ]);

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  };

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now() // Simple ID generation
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const unreadCount = notifications.filter(notification => !notification.isRead).length;

  // Simulate real-time notifications (optional)
  useEffect(() => {
    const interval = setInterval(() => {
      // This is just for demo - in real app, you'd listen to WebSocket or polling
      const shouldAddNotification = Math.random() < 0.1; // 10% chance every 30 seconds
      
      if (shouldAddNotification && notifications.length < 10) {
        const randomNotifications = [
          {
            type: 'task' as const,
            title: 'New task assigned by Admin',
            timeAgo: 'Just now',
            isRead: false,
            icon: '📋'
          },
          {
            type: 'approval' as const,
            title: 'Visit report approved',
            description: 'Your visit report has been reviewed and approved',
            timeAgo: 'Just now',
            isRead: false,
            icon: '✅'
          },
          {
            type: 'system' as const,
            title: 'System update available',
            timeAgo: 'Just now',
            isRead: false,
            icon: '🔄'
          }
        ];
        
        const randomNotification = randomNotifications[
          Math.floor(Math.random() * randomNotifications.length)
        ];
        
        addNotification(randomNotification);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [notifications.length]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification
  };
};
