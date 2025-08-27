'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import './Settings.css';

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

  return (
    <div className="settings-container">
      <div className="settings-content">
        {/* Header */}
        <div className="settings-header">
          <button className="back-btn" onClick={handleBackToDashboard}>
            <span className="back-arrow">←</span>
            Back to Dashboard
          </button>
        </div>

        {/* Title Section */}
        <div className="settings-title-section">
          <h1 className="settings-title">Settings</h1>
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
      </div>
    </div>
  );
};

export default Settings;
