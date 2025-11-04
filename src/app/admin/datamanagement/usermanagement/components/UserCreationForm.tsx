'use client';

import React, { useState } from 'react';
import { UserPlus, User, Shield, Users, Eye, EyeOff } from 'lucide-react';

interface UserCreationFormProps {
  onUserCreated: () => void;
}

interface FormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  name: string;
  contactNumber: string;
  region: string;
}

const UserCreationForm: React.FC<UserCreationFormProps> = ({ onUserCreated }) => {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'EXECUTIVE',
    name: '',
    contactNumber: '',
    region: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const validateForm = (): boolean => {
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }

    if (!formData.password.trim()) {
      setError('Password is required');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
          name: formData.name.trim(),
          contactNumber: formData.contactNumber.trim(),
          region: formData.region.trim() || null
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccessMessage(`${formData.role} user "${formData.username}" created successfully!`);
        
        // Reset form
        setFormData({
          username: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'EXECUTIVE',
          name: '',
          contactNumber: '',
          region: ''
        });
        
        // Notify parent component
        onUserCreated();
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        setError(result.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'EXECUTIVE',
      name: '',
      contactNumber: '',
      region: ''
    });
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="user-mgmt-creation-container">
      <div className="user-mgmt-creation-card">
        <div className="user-mgmt-creation-header">
          <div className="user-mgmt-creation-title-section">
            <UserPlus className="user-mgmt-creation-icon" size={24} />
            <h2 className="user-mgmt-creation-title">Create New User</h2>
          </div>
          <p className="user-mgmt-creation-description">
            Create a new user account with Admin or Executive role.
          </p>
        </div>

        {error && (
          <div className="user-mgmt-alert user-mgmt-alert-error">
            <span className="user-mgmt-alert-icon">⚠️</span>
            {error}
          </div>
        )}

        {successMessage && (
          <div className="user-mgmt-alert user-mgmt-alert-success">
            <span className="user-mgmt-alert-icon">✅</span>
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="user-mgmt-creation-form">
          {/* Role Selection */}
          <div className="user-mgmt-form-group">
            <label className="user-mgmt-form-label">
              User Role <span className="user-mgmt-required">*</span>
            </label>
            <div className="user-mgmt-role-selection">
              <label className="user-mgmt-radio-label">
                <input
                  type="radio"
                  name="role"
                  value="EXECUTIVE"
                  checked={formData.role === 'EXECUTIVE'}
                  onChange={handleInputChange}
                  className="user-mgmt-radio-input"
                />
                <div className="user-mgmt-radio-card">
                  <User size={20} />
                  <span>Executive</span>
                </div>
              </label>
              
              <label className="user-mgmt-radio-label">
                <input
                  type="radio"
                  name="role"
                  value="ADMIN"
                  checked={formData.role === 'ADMIN'}
                  onChange={handleInputChange}
                  className="user-mgmt-radio-input"
                />
                <div className="user-mgmt-radio-card">
                  <Shield size={20} />
                  <span>Admin</span>
                </div>
              </label>
            </div>
          </div>

          {/* Basic Account Info */}
          <div className="user-mgmt-form-row">
            <div className="user-mgmt-form-group">
              <label className="user-mgmt-form-label">
                Username <span className="user-mgmt-required">*</span>
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="user-mgmt-form-input"
                placeholder="Enter username"
                required
              />
            </div>

            <div className="user-mgmt-form-group">
              <label className="user-mgmt-form-label">
                Email <span className="user-mgmt-required">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="user-mgmt-form-input"
                placeholder="Enter email address"
                required
              />
            </div>
          </div>

          {/* Password Fields */}
          <div className="user-mgmt-form-row">
            <div className="user-mgmt-form-group">
              <label className="user-mgmt-form-label">
                Password <span className="user-mgmt-required">*</span>
              </label>
              <div className="user-mgmt-password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="user-mgmt-form-input"
                  placeholder="Enter password (min 6 chars)"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="user-mgmt-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="user-mgmt-form-group">
              <label className="user-mgmt-form-label">
                Confirm Password <span className="user-mgmt-required">*</span>
              </label>
              <div className="user-mgmt-password-input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="user-mgmt-form-input"
                  placeholder="Confirm password"
                  required
                />
                <button
                  type="button"
                  className="user-mgmt-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="user-mgmt-form-group">
            <label className="user-mgmt-form-label">
              Full Name <span className="user-mgmt-required">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="user-mgmt-form-input"
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="user-mgmt-form-row">
            <div className="user-mgmt-form-group">
              <label className="user-mgmt-form-label">Contact Number</label>
              <input
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleInputChange}
                className="user-mgmt-form-input"
                placeholder="Enter contact number"
              />
            </div>

            <div className="user-mgmt-form-group">
              <label className="user-mgmt-form-label">Region</label>
              <input
                type="text"
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                className="user-mgmt-form-input"
                placeholder="Enter region/area"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="user-mgmt-form-actions">
            <button
              type="button"
              onClick={resetForm}
              className="user-mgmt-btn user-mgmt-btn-secondary"
              disabled={isLoading}
            >
              Reset Form
            </button>
            
            <button
              type="submit"
              className="user-mgmt-btn user-mgmt-btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="user-mgmt-loading-spinner" />
                  Creating User...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Create {formData.role} User
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default UserCreationForm;