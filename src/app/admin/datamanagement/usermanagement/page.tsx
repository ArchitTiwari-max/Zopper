'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, UserPlus, Settings } from 'lucide-react';
import UserCreationForm from './components/UserCreationForm';
import UserListing from './components/UserListing';
import './usermanagement.css';

const UserManagement = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');

  const handleUserCreated = () => {
    // Trigger refresh of user listing
    setRefreshTrigger(prev => prev + 1);
    
    // Optionally switch to listing tab to see the new user
    setTimeout(() => {
      setActiveTab('list');
    }, 1500);
  };

  return (
    <div className="user-mgmt-page-container">
      <div className="user-mgmt-page-content">
        {/* Back Button */}
        <div className="user-mgmt-back-button-section">
          <Link href="/admin/datamanagement" className="user-mgmt-back-button">
            <ArrowLeft size={16} />
            <span>Back to Data Management</span>
          </Link>
        </div>

        {/* Page Header */}
        <div className="user-mgmt-page-header">
          <div className="user-mgmt-page-title-section">
            <Settings className="user-mgmt-page-icon" size={28} />
            <h1 className="user-mgmt-page-title">User Management System</h1>
          </div>
          <p className="user-mgmt-page-description">
            Create and manage system users. Create Admin and Executive accounts with proper role-based access.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="user-mgmt-tab-navigation">
          <button
            onClick={() => setActiveTab('create')}
            className={`user-mgmt-tab-button ${activeTab === 'create' ? 'active' : ''}`}
          >
            <UserPlus size={18} />
            Create User
          </button>
          
          <button
            onClick={() => setActiveTab('list')}
            className={`user-mgmt-tab-button ${activeTab === 'list' ? 'active' : ''}`}
          >
            <Users size={18} />
            Manage Users
          </button>
        </div>

        {/* Tab Content */}
        <div className="user-mgmt-tab-content">
          {activeTab === 'create' && (
            <div className="user-mgmt-tab-panel">
              <UserCreationForm onUserCreated={handleUserCreated} />
            </div>
          )}
          
          {activeTab === 'list' && (
            <div className="user-mgmt-tab-panel">
              <UserListing refreshTrigger={refreshTrigger} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default UserManagement;