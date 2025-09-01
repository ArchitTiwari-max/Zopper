'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsData, ApprovalTimeOption, RegionOption, TimeZoneOption } from '../types';
import './page.css';

const AdminSettingsPage: React.FC = () => {
  const router = useRouter();
  
  const [settings, setSettings] = useState<SettingsData>({
    autoApprovalTime: '6 hours',
    emailNotifications: true,
    pushNotifications: false,
    defaultRegion: 'North Region',
    timeZone: 'IST (Indian Standard Time)'
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSettingChange = (key: keyof SettingsData, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveSettings = () => {
    // Here you would typically save to an API
    console.log('Saving settings:', settings);
    setHasUnsavedChanges(false);
    // Show success message or toast
  };

  const handleCancel = () => {
    // Reset to original values or reload from server
    setHasUnsavedChanges(false);
  };

  const handleLogout = async () => {
    if (hasUnsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Are you sure you want to logout?');
      if (!confirmed) return;
    }

    setIsLoggingOut(true);
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // Redirect to login page
        window.location.href = '/';
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const approvalTimeOptions: ApprovalTimeOption[] = [
    '1 hour', '2 hours', '4 hours', '6 hours', '12 hours', '24 hours'
  ];

  const regionOptions: RegionOption[] = [
    'North Region', 'South Region', 'East Region', 'West Region', 'Central Region'
  ];

  const timeZoneOptions: TimeZoneOption[] = [
    'IST (Indian Standard Time)', 'UTC', 'GMT'
  ];

  return (
    <div className="settings-overview">
      {/* Header Section */}
      <div className="settings-header">
        <div className="settings-header-content">
          <h2>Setting</h2>
          <p>Manage your system preferences and configurations</p>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="settings-content">
        {/* Auto-approval Time Section */}
        <div className="settings-section">
          <div className="section-icon-header">
            <div className="section-icon auto-approval">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="section-content">
              <h3>Auto-approval Time</h3>
              <p>Set the time period after which store visit reports are automatically approved if no manual action is taken.</p>
            </div>
          </div>

          <div className="setting-control">
            <label htmlFor="approval-timeout">Approval Timeout</label>
            <select
              id="approval-timeout"
              value={settings.autoApprovalTime}
              onChange={(e) => handleSettingChange('autoApprovalTime', e.target.value)}
              className="settings-select"
            >
              {approvalTimeOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notification Preferences Section */}
        <div className="settings-section">
          <div className="section-icon-header">
            <div className="section-icon notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6981 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="section-content">
              <h3>Notification Preferences</h3>
              <p>Choose how you want to receive notifications about store visits, executive reports, and system updates.</p>
            </div>
          </div>

          <div className="notification-controls">
            <div className="notification-item">
              <div className="notification-info">
                <h4>Email Notifications</h4>
                <p>Receive email alerts for new reports, approvals needed, and system maintenance</p>
              </div>
              <div className="toggle-container">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="notification-item">
              <div className="notification-info">
                <h4>Push Notifications</h4>
                <p>Get instant browser notifications for urgent approvals and real-time updates</p>
              </div>
              <div className="toggle-container">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.pushNotifications}
                    onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Regional Settings Section */}
        <div className="settings-section">
          <div className="section-icon-header">
            <div className="section-icon regional">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 2C16.97 2 20.47 8.84 20.47 12S16.97 22 12 22C7.03 22 3.53 15.16 3.53 12S7.03 2 12 2Z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="section-content">
              <h3>Regional Settings</h3>
              <p>Configure region-specific preferences for your administrative area.</p>
            </div>
          </div>

          <div className="regional-controls">
            <div className="setting-control">
              <label htmlFor="default-region">Default Region</label>
              <select
                id="default-region"
                value={settings.defaultRegion}
                onChange={(e) => handleSettingChange('defaultRegion', e.target.value)}
                className="settings-select"
              >
                {regionOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="setting-control">
              <label htmlFor="time-zone">Time Zone</label>
              <select
                id="time-zone"
                value={settings.timeZone}
                onChange={(e) => handleSettingChange('timeZone', e.target.value)}
                className="settings-select"
              >
                {timeZoneOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Account Management Section */}
        <div className="settings-section">
          <div className="section-icon-header">
            <div className="section-icon account">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="section-content">
              <h3>Account Management</h3>
              <p>Manage your account session and security settings.</p>
            </div>
          </div>

          <div className="account-controls">
            <div className="logout-section">
              <div className="logout-info">
                <h4>Sign Out</h4>
                <p>Sign out from your admin account and return to the login page</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="logout-btn"
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <>
                    <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 4.5v5l4-4-4-4v5z" fill="currentColor"/>
                      <path opacity="0.5" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/>
                    </svg>
                    Signing Out...
                  </>
                ) : (
                  'Sign Out'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="settings-actions">
        <button
          type="button"
          onClick={handleCancel}
          className="cancel-btn"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveSettings}
          className="save-btn"
          disabled={!hasUnsavedChanges}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
