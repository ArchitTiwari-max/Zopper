'use client';

import React from 'react';
import { AdminLayoutProps } from './types';
import Navigation from './navigation';
import Header from './header';
import './styles.css';

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentPage = 'Dashboard' }) => {
  return (
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
  );
};

export default AdminLayout;
