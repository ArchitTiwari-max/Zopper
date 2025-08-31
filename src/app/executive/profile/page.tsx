'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import './profile.css';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
}

const Settings: React.FC = () => {
  const router = useRouter();
  
  // User profile state
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Shubham Kumar',
    email: 'shubham.kumar@company.com',
    phone: '+91 98765 43210'
  });

  // Notification settings state
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: false
  });

  // Form state
  const [emailError, setEmailError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [profileEdited, setProfileEdited] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setProfile(prev => ({ ...prev, email: newEmail }));
    setProfileEdited(true);
    
    if (newEmail && !validateEmail(newEmail)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleNotificationToggle = (type: keyof NotificationSettings) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleSaveProfile = async () => {
    if (emailError || !profile.email) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProfileEdited(false);
      // You would normally make an API call here
      console.log('Profile saved:', profile);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    router.push('/executive');
  };

  const handleLogout = async () => {
    if (profileEdited) {
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

  return (
    <div className="settings-container">
      <div className="settings-content">
        {/* Title Section */}
        <div className="settings-title-section">
          <h1 className="settings-title">Profile</h1>
          <p className="settings-subtitle">Manage your profile and notification preferences</p>
        </div>

        {/* Profile Information Card */}
        <div className="profile-card">
          <div className="profile-card-header">
            <div className="profile-icon">
              <span className="profile-icon-text">👤</span>
            </div>
            <h2 className="profile-card-title">Profile Information</h2>
          </div>

          <div className="profile-form">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-input disabled"
                value={profile.name}
                disabled
                readOnly
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email <span className="required">*</span></label>
              <input
                type="email"
                className={`form-input ${emailError ? 'error' : ''}`}
                value={profile.email}
                onChange={handleEmailChange}
                placeholder="Enter your email address"
              />
              {emailError && <span className="error-message">{emailError}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input disabled"
                value={profile.phone}
                disabled
                readOnly
              />
              <span className="form-helper">Contact admin to update phone number</span>
            </div>

            <button
              className={`save-btn ${!profileEdited || emailError ? 'disabled' : ''}`}
              onClick={handleSaveProfile}
              disabled={!profileEdited || !!emailError || isLoading}
            >
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>

        {/* Notifications Card */}
        <div className="notifications-card">
          <h2 className="notifications-card-title">Notifications</h2>
          
          <div className="notification-settings">
            <div className="notification-item">
              <div className="notification-info">
                <span className="notification-label">Email Notifications</span>
                <span className="notification-description">
                  Receive task updates and announcements via email
                </span>
              </div>
              <div className="toggle-container">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.emailNotifications}
                    onChange={() => handleNotificationToggle('emailNotifications')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="notification-item">
              <div className="notification-info">
                <span className="notification-label">Push Notifications</span>
                <span className="notification-description">
                  Get instant alerts for urgent tasks and updates
                </span>
              </div>
              <div className="toggle-container">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.pushNotifications}
                    onChange={() => handleNotificationToggle('pushNotifications')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Account Management Card */}
        <div className="account-card">
          <h2 className="account-card-title">Account Management</h2>
          
          <div className="account-settings">
            <div className="account-item">
              <div className="account-info">
                <span className="account-label">Sign Out</span>
                <span className="account-description">
                  Sign out from your executive account and return to the login page
                </span>
              </div>
              <div className="logout-container">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="logout-btn"
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <>
                      <div className="logout-spinner"></div>
                      Signing Out...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Sign Out
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
