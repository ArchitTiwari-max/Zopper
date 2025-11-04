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
            id: userData.id || 'N/A',
            name: userData.executive?.name || userData.admin?.name || 'Not provided',
            email: userData.email || 'N/A',
            username: userData.username || 'N/A', // This should now work
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
    console.log('🚪 Starting logout process...');
    setIsLoggingOut(true);
    
    try {
      console.log('📡 Making logout API call...');
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        console.log('✅ Logout API call successful');
        
        // Clear all cache and user data
        console.log('🧹 Importing and calling clearAllCache...');
        const { clearAllCache } = await import('@/lib/auth');
        clearAllCache();
        
        console.log('🔄 Forcing hard reload to login page...');
        // Force hard reload to login page (bypasses all caches)
        window.location.replace('/?_=' + Date.now());
      } else {
        console.error('❌ Logout API call failed:', response.status, response.statusText);
        throw new Error('Logout failed');
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
      alert('Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="exec-prof-settings-container">
      <div className="exec-prof-settings-content">
        {/* Title Section */}
        <div className="exec-prof-settings-title-section">
          <h1 className="exec-prof-settings-title">Profile</h1>
          <p className="exec-prof-settings-subtitle">Manage your profile and notification preferences</p>
        </div>

        {/* Profile Information Card */}
        <div className="exec-prof-profile-card">
          <div className="exec-prof-profile-card-header">
            <div className="exec-prof-profile-icon">
              <span className="profile-icon-text">👤</span>
            </div>
            <h2 className="exec-prof-profile-card-title">Profile Information</h2>
          </div>

          {isLoadingProfile ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <span>Loading profile...</span>
            </div>
          ) : profileError ? (
            <div className="error-state">
              <span className="exec-prof-error-message">{profileError}</span>
            </div>
          ) : profile ? (
            <div className="exec-prof-profile-form">
              <div className="exec-prof-form-group">
                <label className="exec-prof-form-label">Name</label>
                <input
                  type="text"
                  className="exec-prof-form-input disabled"
                  value={profile.name}
                  disabled
                  readOnly
                />
              </div>

              <div className="exec-prof-form-group">
                <label className="exec-prof-form-label">Email</label>
                <input
                  type="email"
                  className="exec-prof-form-input disabled"
                  value={profile.email}
                  disabled
                  readOnly
                />
                <span className="exec-prof-form-helper">Contact admin to update email address</span>
              </div>

              <div className="exec-prof-form-group">
                <label className="exec-prof-form-label">Username</label>
                <input
                  type="text"
                  className="exec-prof-form-input disabled"
                  value={profile.username || 'Not available'}
                  disabled
                  readOnly
                />
                <span className="exec-prof-form-helper">Username cannot be changed</span>
              </div>

              <div className="exec-prof-form-group">
                <label className="exec-prof-form-label">Contact Number</label>
                <input
                  type="tel"
                  className="exec-prof-form-input disabled"
                  value={profile.contact_number || 'Not provided'}
                  disabled
                  readOnly
                />
                <span className="exec-prof-form-helper">Contact admin to update contact number</span>
              </div>

              <div className="exec-prof-form-group">
                <label className="exec-prof-form-label">Region</label>
                <input
                  type="text"
                  className="exec-prof-form-input disabled"
                  value={profile.region || 'Not specified'}
                  disabled
                  readOnly
                />
                <span className="exec-prof-form-helper">Contact admin to update region</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Notifications Card */}
        <div className="exec-prof-notifications-card">
          <h2 className="exec-prof-notifications-card-title">Notifications</h2>
          
          <div className="exec-prof-notification-settings">
            <div className="exec-prof-notification-item">
              <div className="exec-prof-notification-info">
                <span className="exec-prof-notification-label">Email Notifications</span>
                <span className="exec-prof-notification-description">
                  Receive task updates and announcements via email
                </span>
              </div>
              <div className="exec-prof-toggle-container">
                <label className="exec-prof-toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.emailNotifications}
                    onChange={() => handleNotificationToggle('emailNotifications')}
                  />
                  <span className="exec-prof-toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="exec-prof-notification-item">
              <div className="exec-prof-notification-info">
                <span className="exec-prof-notification-label">Push Notifications</span>
                <span className="exec-prof-notification-description">
                  Get instant alerts for urgent tasks and updates
                </span>
              </div>
              <div className="exec-prof-toggle-container">
                <label className="exec-prof-toggle-switch">
                  <input
                    type="checkbox"
                    checked={notifications.pushNotifications}
                    onChange={() => handleNotificationToggle('pushNotifications')}
                  />
                  <span className="exec-prof-toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Account Management Card */}
        <div className="exec-prof-account-card">
          <h2 className="exec-prof-account-card-title">Account Management</h2>
          
          <div className="exec-prof-account-settings">
            <div className="exec-prof-account-item">
              <div className="exec-prof-account-info">
                <span className="exec-prof-account-label">Sign Out</span>
                <span className="exec-prof-account-description">
                  Sign out from your executive account and return to the login page
                </span>
              </div>
              <div className="exec-prof-logout-container">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="exec-prof-logout-btn"
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
