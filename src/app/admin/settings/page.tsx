'use client';

import React, { useState, useEffect } from 'react';
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userInitials, setUserInitials] = useState('AD');

  // Helper function to get cookie value
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    return null;
  };

  // Function to generate initials from name
  const generateInitials = (name: string): string => {
    if (!name || name.trim() === '') return 'AD';
    
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    
    if (nameParts.length === 0) return 'AD';
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    
    // Get first letter of first name and first letter of last name
    const firstInitial = nameParts[0].charAt(0).toUpperCase();
    const lastInitial = nameParts[nameParts.length - 1].charAt(0).toUpperCase();
    
    return firstInitial + lastInitial;
  };

  // Load user data from cookie on component mount
  useEffect(() => {
    const loadUserProfile = () => {
      try {
        const userInfoCookie = getCookie('userInfo');
        
        if (userInfoCookie) {
          const userData = JSON.parse(userInfoCookie);
          // Remove ID from the data before setting
          const profileData = { ...userData };
          if (profileData.id) delete profileData.id;
          if (profileData.admin?.id) delete profileData.admin.id;
          
          setUserProfile(profileData);
          
          // Generate initials for avatar
          const userName = userData.admin?.name || userData.name || '';
          const initials = generateInitials(userName);
          setUserInitials(initials);
        }
      } catch (error) {
        console.error('Error parsing user cookie in settings:', error);
        setUserInitials('AD'); // Fallback
      }
    };
    
    // Add a small delay to ensure cookies are available
    setTimeout(loadUserProfile, 100);
  }, []);

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
        // Clear all cache and user data
        const { clearAllCache } = await import('@/lib/auth');
        clearAllCache();
        
        // Force hard reload to login page (bypasses all caches)
        window.location.replace('/?_=' + Date.now());
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

      {/* Settings Sections */}
      <div className="settings-content">
        {/* User Profile Section */}
        <div className="settings-section profile-section">
          <div className="section-icon-header">
            <div className="section-icon profile">
              <div className="profile-avatar">
                {userInitials}
              </div>
            </div>
            <div className="section-content">
              <h3>Profile Information</h3>
              <p>Your account details and profile information from the system.</p>
            </div>
          </div>

          <div className="profile-details">
            {userProfile ? (
              <div className="profile-form">
                {/* Name Field */}
                <div className="profile-field">
                  <label className="profile-field-label">Full Name</label>
                  <input 
                    type="text" 
                    value={userProfile.admin?.name || userProfile.name || ''} 
                    disabled 
                    className="profile-input"
                  />
                </div>

                {/* Username Field */}
                <div className="profile-field">
                  <label className="profile-field-label">Username</label>
                  <input 
                    type="text" 
                    value={userProfile.admin?.username || userProfile.username || 'N/A'} 
                    disabled 
                    className="profile-input"
                  />
                </div>

                {/* Region Field */}
                <div className="profile-field">
                  <label className="profile-field-label">Region</label>
                  <input 
                    type="text" 
                    value={userProfile.admin?.region || userProfile.region || 'N/A'} 
                    disabled 
                    className="profile-input"
                  />
                </div>

                {/* Email Field */}
                <div className="profile-field">
                  <label className="profile-field-label">Registered Email Address</label>
                  <input 
                    type="email" 
                    value={userProfile.admin?.email || userProfile.email || 'N/A'} 
                    disabled 
                    className="profile-input"
                  />
                </div>

                {/* Phone Number Field */}
                <div className="profile-field">
                  <label className="profile-field-label">Phone Number</label>
                  <input 
                    type="tel" 
                    value={userProfile.admin?.contact_number || 'N/A'}
                    disabled 
                    className="profile-input"
                  />
                </div>
              </div>
            ) : (
              <div className="profile-loading">
                <div className="loading-spinner"></div>
                <span>Loading profile information...</span>
              </div>
            )}
          </div>
        </div>
         {/* Data Management Section */}
        <div className="settings-section data-management-section">
          <div className="section-icon-header">
            <div className="section-icon data-management">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 16V8C20.9996 7.64928 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64928 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="7.5,4.21 12,6.81 16.5,4.21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="7.5,19.79 7.5,14.6 3,12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="21,12 16.5,14.6 16.5,19.79" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="12,22.08 12,16.92" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="section-content">
              <h3>Data Management</h3>
              <p>Comprehensive data management including imports, user administration, and system data controls.</p>
            </div>
          </div>

          <div className="data-management-controls">
            <div className="data-management-info">
              <h4>Data Management Dashboard</h4>
              <p>Access the data management dashboard for Excel imports, user management, and comprehensive data administration with real-time progress tracking.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/admin/datamanagement')}
              className="data-management-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="2,17 12,22 22,17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="2,12 12,17 22,12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Go to Data Management
            </button>
          </div>
        </div>
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

    </div>
  );
};

export default AdminSettingsPage;
