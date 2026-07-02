'use client';

import React from 'react';
import { AdminLayoutProps } from './types';
import Navigation from './navigation';
import Header from './header';
import { DateFilterProvider } from './contexts/DateFilterContext';
import { AttendanceDateFilterProvider } from './contexts/AttendanceDateFilterContext';
import { NotificationProvider } from './notifications/components/contexts/NotificationContext';
import './globals.css';
import './base.css';

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentPage = 'Dashboard' }) => {
  return (
    <DateFilterProvider>
      <AttendanceDateFilterProvider>
        <NotificationProvider>
          <div className="admin-dashboard">
            {/* Navigation Component */}
            <Navigation />

            {/* Main Content */}
            <div className="main-content">
              {/* Header Component */}
              <Header currentPage={currentPage} />

              {/* Page Content */}
              {children}
            </div>
          </div>
        </NotificationProvider>
      </AttendanceDateFilterProvider>
    </DateFilterProvider>
  );
};

export default AdminLayout;
