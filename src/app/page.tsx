'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import './signin.css';

export default function Home() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/admin/dashboard';
  
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyLoading, setIsVerifyLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // New loading state
  const [userEmail, setUserEmail] = useState(''); // Store email from API response
  
  // Forgot Password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState('email'); // 'email' or 'reset'
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const [forgotPasswordData, setForgotPasswordData] = useState({
    otp: '',
    newPassword: ''
  });
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  // Check if user is already logged in when component mounts
  useEffect(() => {
    checkIfLoggedIn();
  }, []);

  const checkIfLoggedIn = async () => {
    try {
      const response = await fetch('/api/auth/verify-session', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const userRole = data.user.role;
        
        // Redirect to appropriate dashboard based on role
        let redirectUrl;
        if (userRole === 'ADMIN') {
          redirectUrl = '/admin/dashboard';
        } else if (userRole === 'EXECUTIVE') {
          redirectUrl = '/executive/dashboard';
        } else {
          redirectUrl = '/admin/dashboard';
        }
        
        // Don't show login form if redirecting
        window.location.href = redirectUrl;
        return; // Don't set isCheckingAuth to false if redirecting
      }
      // If not logged in, show the login page
    } catch (error) {
      // If there's an error, show the login page
      console.log('User not logged in');
    }
    
    // Only set loading to false if we're not redirecting
    setIsCheckingAuth(false);
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtp(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setUserEmail(result.email); // Store the email from response
        setShowOtpVerification(true);
        alert('OTP sent to your registered email!');
      } else {
        alert(result.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      alert('Error sending OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (!otp) {
      alert('Please enter the OTP');
      return;
    }

    setIsVerifyLoading(true);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail, // Use email from send-otp response
          otp: otp
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Login successful! Welcome ' + result.user.username);
        setShowOtpVerification(false);
        setOtp('');
        
        // Role-based redirection
        const userRole = result.user.role;
        let redirectUrl;
        
        // Always redirect based on user role, ignoring the original redirect parameter
        // This ensures users go to their appropriate dashboard
        if (userRole === 'ADMIN') {
          redirectUrl = '/admin/dashboard';
        } else if (userRole === 'EXECUTIVE') {
          redirectUrl = '/executive/dashboard';
        } else {
          // Fallback for any other roles
          redirectUrl = '/admin/dashboard';
        }
        
        // Small delay to ensure cookies are fully set before redirect
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 100);
      } else {
        alert(result.error || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      alert('Error verifying OTP. Please try again.');
    } finally {
      setIsVerifyLoading(false);
    }
  };

  const handleOtpCancel = () => {
    setShowOtpVerification(false);
    setOtp('');
  };

  // Forgot Password handlers
  const handleForgotPasswordData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForgotPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleForgotPasswordClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim()) {
      alert('Please enter your username first');
      return;
    }

    setIsEmailSending(true);
    setShowForgotPassword(true);
    setForgotPasswordStep('email');
    
    try {
      // Send forgot password email
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setUserEmail(result.email);
        setForgotPasswordStep('reset');
        alert('Password reset OTP sent to your registered email!');
      } else {
        alert(result.error || 'Failed to send reset email');
        setShowForgotPassword(false);
      }
    } catch (error) {
      console.error('Error sending reset email:', error);
      alert('Error sending reset email. Please try again.');
      setShowForgotPassword(false);
    } finally {
      setIsEmailSending(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!forgotPasswordData.otp.trim()) {
      alert('Please enter the OTP');
      return;
    }

    if (!forgotPasswordData.newPassword.trim()) {
      alert('Please enter your new password');
      return;
    }

    if (forgotPasswordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setIsPasswordResetting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          otp: forgotPasswordData.otp,
          newPassword: forgotPasswordData.newPassword
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Password reset successful! You can now sign in with your new password.');
        setShowForgotPassword(false);
        setForgotPasswordData({ otp: '', newPassword: '' });
        setForgotPasswordStep('email');
      } else {
        alert(result.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Error resetting password. Please try again.');
    } finally {
      setIsPasswordResetting(false);
    }
  };

  const handleForgotPasswordCancel = () => {
    setShowForgotPassword(false);
    setForgotPasswordData({ otp: '', newPassword: '' });
    setForgotPasswordStep('email');
  };

  // Show loading screen while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="container">
        <div className="card">
          <div className="logo-section">
            <div className="logo">
              <div className="logo-icon">Z</div>
              <span className="logo-text">ZopperTrack</span>
            </div>
          </div>
          <div className="form-section">
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '200px',
              fontSize: '16px',
              color: '#64748b'
            }}>
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Checking authentication...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="logo-section">
          <div className="logo">
            <div className="logo-icon">Z</div>
            <span className="logo-text">ZopperTrack</span>
          </div>
        </div>
        
        <div className="form-section">
          <h1>Sign In</h1>
          <p className="subtitle">Sign In to continue</p>
          
          <form className="sign-in-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input 
                type="text" 
                id="username" 
                name="username" 
                placeholder="Enter your Username" 
                value={formData.username}
                onChange={handleInputChange}
                disabled={showOtpVerification || showForgotPassword}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-container">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  name="password" 
                  placeholder="Enter your password" 
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={showOtpVerification || showForgotPassword}
                  required 
                />
                <button 
                  type="button" 
                  className="toggle-password" 
                  onClick={togglePassword}
                  disabled={showOtpVerification || showForgotPassword}
                >
                  <svg className="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {showPassword ? (
                      <>
                        <path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5C16.477 5 20.268 7.943 21.542 12C20.268 16.057 16.477 19 12 19C7.523 19 3.732 16.057 2.458 12Z" stroke="currentColor" strokeWidth="2"/>
                        <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2"/>
                      </>
                    ) : (
                      <>
                        <path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5C16.477 5 20.268 7.943 21.542 12C20.268 16.057 16.477 19 12 19C7.523 19 3.732 16.057 2.458 12Z" stroke="currentColor" strokeWidth="2"/>
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              className={`sign-up-btn ${isLoading ? 'loading' : ''}`}
              disabled={showOtpVerification || isLoading || showForgotPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Sending...
                </>
              ) : (
                'Sign In'
              )}
            </button>
            
            <div className="form-footer">
              <a href="#" className="forgot-password" onClick={handleForgotPasswordClick}>Forgot a password?</a>
            </div>
            
            {/* OTP Verification Component */}
            {showOtpVerification && (
              <div className="otp-verification-section">
                <div className="otp-divider"></div>
                <div className="otp-content">
                  <p className="otp-message">Verify OTP sent to registered email</p>
                  <div className="otp-input-group">
                    <input
                      type="text"
                      id="otp"
                      name="otp"
                      placeholder="Enter OTP"
                      value={otp}
                      onChange={handleOtpChange}
                      maxLength={6}
                      className="otp-input"
                    />
                  </div>
                  <div className="otp-buttons">
                    <button 
                      type="button" 
                      onClick={handleOtpVerify} 
                      className={`verify-btn ${isVerifyLoading ? 'loading' : ''}`}
                      disabled={isVerifyLoading}
                    >
                      {isVerifyLoading ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={16} />
                          Verifying...
                        </>
                      ) : (
                        'Verify'
                      )}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleOtpCancel} 
                      className="cancel-btn"
                      disabled={isVerifyLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
      
      {/* Forgot Password Component */}
      {showForgotPassword && (
        <div className="card forgot-password-card">
          <div className="form-section">
            {forgotPasswordStep === 'email' && isEmailSending ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '150px',
                fontSize: '16px',
                color: '#64748b'
              }}>
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Sending reset email...</p>
              </div>
            ) : forgotPasswordStep === 'reset' ? (
              <>
                <h2>Reset Password</h2>
                <p className="subtitle">Enter OTP and new password for: {userEmail}</p>
                
                <div className="forgot-password-form">
                  <div className="form-group">
                    <label htmlFor="forgot-otp">Enter OTP</label>
                    <input 
                      type="text" 
                      id="forgot-otp" 
                      name="otp" 
                      placeholder="Enter OTP from email" 
                      value={forgotPasswordData.otp}
                      onChange={handleForgotPasswordData}
                      maxLength={6}
                      required 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="new-password">New Password</label>
                    <input 
                      type="password" 
                      id="new-password" 
                      name="newPassword" 
                      placeholder="Enter new password" 
                      value={forgotPasswordData.newPassword}
                      onChange={handleForgotPasswordData}
                      minLength={6}
                      required 
                    />
                  </div>
                  
                  <div className="forgot-password-buttons">
                    <button 
                      type="button" 
                      onClick={handlePasswordReset} 
                      className={`verify-btn ${isPasswordResetting ? 'loading' : ''}`}
                      disabled={isPasswordResetting}
                    >
                      {isPasswordResetting ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={16} />
                          Resetting...
                        </>
                      ) : (
                        'Verify & Reset'
                      )}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleForgotPasswordCancel} 
                      className="cancel-btn"
                      disabled={isPasswordResetting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
