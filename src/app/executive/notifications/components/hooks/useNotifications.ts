'use client';

import { useState } from 'react';

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


  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification
  };
};
