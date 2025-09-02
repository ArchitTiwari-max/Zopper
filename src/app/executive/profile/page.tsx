'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './profile.css';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  contact_number: string | null;
  region: string | null;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
}

const Settings: React.FC = () => {
  const router = useRouter();
  
  // User profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Notification settings state
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: false
  });

  // Form state
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

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

  // Load profile data from cookie on component mount
  useEffect(() => {
    const loadProfileFromCookie = () => {
      try {
        setIsLoadingProfile(true);
        console.log('All cookies:', document.cookie);
        
        const userInfoCookie = getCookie('userInfo');
        console.log('UserInfo cookie:', userInfoCookie);
        
        if (userInfoCookie) {
          const userData = JSON.parse(userInfoCookie);
          console.log('Parsed user data:', userData);
          
          // Map the cookie data to profile format
          const profileData: UserProfile = {
            id: userData.id,
            name: userData.executive?.name || userData.admin?.name || 'Unknown',
            email: userData.email,
            username: userData.username,
            contact_number: userData.executive?.contact_number || userData.admin?.contact_number || null,
            region: userData.executive?.region || userData.admin?.region || null
          };
          
          console.log('Mapped profile data:', profileData);
          setProfile(profileData);
          setProfileError(null);
        } else {
          console.log('No userInfo cookie found');
          setProfileError('No user data found. Please login again.');
        }
      } catch (error) {
        console.error('Error parsing user cookie:', error);
        setProfileError('Failed to load profile data. Error: ' + (error as Error).message);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    // Add a small delay to ensure cookies are available
    setTimeout(loadProfileFromCookie, 100);
  }, []);

  const handleNotificationToggle = (type: keyof NotificationSettings) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleLogout = async () => {
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

          {isLoadingProfile ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <span>Loading profile...</span>
            </div>
          ) : profileError ? (
            <div className="error-state">
              <span className="error-message">{profileError}</span>
            </div>
          ) : profile ? (
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
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input disabled"
                  value={profile.email}
                  disabled
                  readOnly
                />
                <span className="form-helper">Contact admin to update email address</span>
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input disabled"
                  value={profile.username}
                  disabled
                  readOnly
                />
                <span className="form-helper">Username cannot be changed</span>
              </div>

              <div className="form-group">
                <label className="form-label">Contact Number</label>
                <input
                  type="tel"
                  className="form-input disabled"
                  value={profile.contact_number || 'Not provided'}
                  disabled
                  readOnly
                />
                <span className="form-helper">Contact admin to update contact number</span>
              </div>

              <div className="form-group">
                <label className="form-label">Region</label>
                <input
                  type="text"
                  className="form-input disabled"
                  value={profile.region || 'Not specified'}
                  disabled
                  readOnly
                />
                <span className="form-helper">Contact admin to update region</span>
              </div>
            </div>
          ) : null}
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
                      <div className="loading-spinner"></div>
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
