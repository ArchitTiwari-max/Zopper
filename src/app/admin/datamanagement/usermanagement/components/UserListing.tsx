'use client';

import React, { useState, useEffect } from 'react';
import { Search, Users, User, Shield, Trash2, Mail, Phone, MapPin, Calendar, Filter, RefreshCw, AlertTriangle, Lock, X, Eye, EyeOff, Download, FileSpreadsheet } from 'lucide-react';

interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  adminInfo?: {
    adminId: string;
    name: string;
    contactNumber: string;
    region: string;
  } | null;
  executiveInfo?: {
    executiveId: string;
    name: string;
    contactNumber: string;
    region: string;
  } | null;
}

interface UserListingProps {
  refreshTrigger: number;
}

const UserListing: React.FC<UserListingProps> = ({ refreshTrigger }) => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUserForDeletion, setSelectedUserForDeletion] = useState<{id: string, username: string} | null>(null);
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

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

  // Load current user info
  const loadCurrentUser = () => {
    try {
      const userInfoCookie = getCookie('userInfo');
      if (userInfoCookie) {
        const userData = JSON.parse(userInfoCookie);
        setCurrentUsername(userData.username || null);
      }
    } catch (error) {
      console.error('Error loading current user info:', error);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/admin/users');
      const result = await response.json();
      
      if (result.success) {
        setUsers(result.users);
        setFilteredUsers(result.users);
      } else {
        setError(result.error || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    loadCurrentUser();
  }, [refreshTrigger]);

  // Filter users based on search and role filter
  useEffect(() => {
    let filtered = users;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => {
        const name = user.adminInfo?.name || user.executiveInfo?.name || '';
        return (
          user.username.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          name.toLowerCase().includes(query) ||
          user.id.toLowerCase().includes(query) ||
          (user.adminInfo?.adminId || '').toLowerCase().includes(query) ||
          (user.executiveInfo?.executiveId || '').toLowerCase().includes(query)
        );
      });
    }

    // Apply role filter
    if (roleFilter) {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter]);

  const handleDeleteUser = async (userId: string, username: string) => {
    // Security check: Only test_admin can delete users
    if (currentUsername !== 'test_admin') {
      setError('Access denied: Only test_admin can delete users');
      return;
    }

    // Show password confirmation modal
    setSelectedUserForDeletion({ id: userId, username });
    setShowPasswordModal(true);
    setPasswordConfirmation('');
    setPasswordError('');
  };

  const handlePasswordConfirmation = async () => {
    if (!selectedUserForDeletion || !passwordConfirmation) {
      setPasswordError('Password is required');
      return;
    }

    setIsDeleting(true);
    setError('');
    setPasswordError('');

    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserForDeletion.id,
          confirmationPassword: passwordConfirmation,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Remove user from local state
        setUsers(prev => prev.filter(user => user.id !== selectedUserForDeletion.id));
        setShowPasswordModal(false);
        setSelectedUserForDeletion(null);
        setPasswordConfirmation('');
      } else {
        setPasswordError(result.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setPasswordError('Network error. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setSelectedUserForDeletion(null);
    setPasswordConfirmation('');
    setPasswordError('');
  };

  const handleExportToExcel = async () => {
    setIsExporting(true);
    setError('');

    try {
      const response = await fetch('/api/admin/users/export', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to export users');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
      link.download = `users_report_${dateStr}_${timeStr}.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error exporting users:', error);
      setError(error instanceof Error ? error.message : 'Failed to export users to Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="user-mgmt-listing-container">
        <div className="user-mgmt-loading-state">
          <RefreshCw className="user-mgmt-loading-icon" size={32} />
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-mgmt-listing-container">
      <div className="user-mgmt-listing-header">
        <div className="user-mgmt-listing-title-section">
          <Users className="user-mgmt-listing-icon" size={24} />
          <h2 className="user-mgmt-listing-title">All Users ({filteredUsers.length})</h2>
        </div>
        <p className="user-mgmt-listing-description">
          Manage all system users with search and filter capabilities.
        </p>
      </div>

      {error && (
        <div className="user-mgmt-alert user-mgmt-alert-error">
          <span className="user-mgmt-alert-icon">⚠️</span>
          {error}
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="user-mgmt-controls">
        <div className="user-mgmt-search-wrapper">
          <Search className="user-mgmt-search-icon" size={18} />
          <input
            type="text"
            placeholder="Search by name, username, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="user-mgmt-search-input"
          />
        </div>
        
        <div className="user-mgmt-filter-group">
          <div className="user-mgmt-filter-wrapper">
            <Filter className="user-mgmt-filter-icon" size={16} />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="user-mgmt-filter-select"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admin Only</option>
              <option value="EXECUTIVE">Executive Only</option>
            </select>
          </div>
          
          <button
            onClick={fetchUsers}
            className="user-mgmt-refresh-btn"
            disabled={isLoading}
          >
            <RefreshCw className={`user-mgmt-refresh-icon ${isLoading ? 'spinning' : ''}`} size={16} />
            Refresh
          </button>
          
          <button
            onClick={handleExportToExcel}
            className="user-mgmt-export-btn"
            disabled={isExporting || users.length === 0}
            title={users.length === 0 ? 'No users to export' : 'Export all users to Excel'}
          >
            {isExporting ? (
              <>
                <div className="user-mgmt-export-spinner" />
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheet size={16} />
                Export Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Users Grid */}
      {filteredUsers.length === 0 ? (
        <div className="user-mgmt-empty-state">
          <Users className="user-mgmt-empty-icon" size={48} />
          <h3>No Users Found</h3>
          <p>
            {users.length === 0 
              ? 'No users have been created yet.' 
              : 'No users match your current search or filter criteria.'
            }
          </p>
        </div>
      ) : (
        <div className="user-mgmt-users-grid">
          {filteredUsers.map((user) => {
            const userInfo = user.adminInfo || user.executiveInfo;
            const isAdmin = user.role === 'ADMIN';
            const assignedId = isAdmin ? user.adminInfo?.adminId : user.executiveInfo?.executiveId;
            
            return (
              <div key={user.id} className={`user-mgmt-user-card ${isAdmin ? 'admin' : 'executive'}`}>
                {/* Card Header */}
                <div className="user-mgmt-user-card-header">
                  <div className="user-mgmt-user-role-badge">
                    {isAdmin ? <Shield size={16} /> : <User size={16} />}
                    <span>{user.role}</span>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    className={`user-mgmt-delete-btn ${currentUsername !== 'test_admin' ? 'disabled' : ''}`}
                    disabled={isDeleting || currentUsername !== 'test_admin'}
                    title={currentUsername !== 'test_admin' ? 'Only test_admin can delete users' : 'Delete user'}
                  >
                    {currentUsername !== 'test_admin' ? (
                      <>
                        <Lock size={16} />
                        Restricted
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        Delete
                      </>
                    )}
                  </button>
                </div>

                {/* User Info */}
                <div className="user-mgmt-user-info">
                  <div className="user-mgmt-user-name-section">
                    <h3 className="user-mgmt-user-name">{userInfo?.name || 'No Name'}</h3>
                    <p className="user-mgmt-username">@{user.username}</p>
                  </div>

                  <div className="user-mgmt-user-details">
                    <div className="user-mgmt-detail-item">
                      <span className="user-mgmt-detail-label">User ID:</span>
                      <span className="user-mgmt-detail-value user-id">{user.id}</span>
                    </div>
                    
                    <div className="user-mgmt-detail-item">
                      <span className="user-mgmt-detail-label">{isAdmin ? 'Admin' : 'Executive'} ID:</span>
                      <span className="user-mgmt-detail-value assigned-id">{assignedId || 'N/A'}</span>
                    </div>

                    <div className="user-mgmt-detail-item">
                      <Mail size={14} />
                      <span className="user-mgmt-detail-value">{user.email}</span>
                    </div>

                    {userInfo?.contactNumber && (
                      <div className="user-mgmt-detail-item">
                        <Phone size={14} />
                        <span className="user-mgmt-detail-value">{userInfo.contactNumber}</span>
                      </div>
                    )}

                    {userInfo?.region && (
                      <div className="user-mgmt-detail-item">
                        <MapPin size={14} />
                        <span className="user-mgmt-detail-value">{userInfo.region}</span>
                      </div>
                    )}

                    <div className="user-mgmt-detail-item">
                      <Calendar size={14} />
                      <span className="user-mgmt-detail-value">Created: {formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Footer */}
      <div className="user-mgmt-stats-footer">
        <div className="user-mgmt-stats-item">
          <span className="user-mgmt-stats-label">Total Users:</span>
          <span className="user-mgmt-stats-value">{users.length}</span>
        </div>
        <div className="user-mgmt-stats-item">
          <span className="user-mgmt-stats-label">Admins:</span>
          <span className="user-mgmt-stats-value">{users.filter(u => u.role === 'ADMIN').length}</span>
        </div>
        <div className="user-mgmt-stats-item">
          <span className="user-mgmt-stats-label">Executives:</span>
          <span className="user-mgmt-stats-value">{users.filter(u => u.role === 'EXECUTIVE').length}</span>
        </div>
        {searchQuery || roleFilter ? (
          <div className="user-mgmt-stats-item">
            <span className="user-mgmt-stats-label">Filtered Results:</span>
            <span className="user-mgmt-stats-value">{filteredUsers.length}</span>
          </div>
        ) : null}
      </div>
      
      {/* Export Info */}
      {users.length > 0 && (
        <div className="user-mgmt-export-info">
          <div className="user-mgmt-export-info-header">
            <FileSpreadsheet className="user-mgmt-export-info-icon" size={20} />
            <h3 className="user-mgmt-export-info-title">Excel Export Information</h3>
          </div>
          <div className="user-mgmt-export-info-content">
            <p className="user-mgmt-export-info-description">
              The Excel export will include comprehensive information for all {users.length} users in the system:
            </p>
            <div className="user-mgmt-export-info-grid">
              <div className="user-mgmt-export-info-column">
                <strong>Basic Information:</strong>
                <ul>
                  <li>User ID & Username</li>
                  <li>Email Address</li>
                  <li>Role (Admin/Executive)</li>
                  <li>Full Name</li>
                  <li>Contact Number</li>
                  <li>Region</li>
                </ul>
              </div>
              <div className="user-mgmt-export-info-column">
                <strong>Administrative Data:</strong>
                <ul>
                  <li>Admin ID (for Admins)</li>
                  <li>Executive ID (for Executives)</li>
                  <li>Account Creation Date</li>
                  <li>Last Updated Date</li>
                  <li>Account Status</li>
                </ul>
              </div>
              <div className="user-mgmt-export-info-column">
                <strong>Executive Statistics:</strong>
                <ul>
                  <li>Total Visits Conducted</li>
                  <li>Total Issue Assignments</li>
                  <li>Total Visit Plans</li>
                  <li>Store Assignments</li>
                  <li>Activity Summary</li>
                </ul>
              </div>
            </div>
            <div className="user-mgmt-export-info-note">
              <strong>Note:</strong> The Excel file will contain two sheets - "Users Report" with detailed user data and "Summary" with overall statistics.
            </div>
          </div>
        </div>
      )}
      
      {/* Password Confirmation Modal */}
      {showPasswordModal && (
        <div className="user-mgmt-modal-overlay">
          <div className="user-mgmt-modal">
            <div className="user-mgmt-modal-header">
              <h3 className="user-mgmt-modal-title">
                <AlertTriangle className="user-mgmt-modal-icon" size={20} />
                Confirm User Deletion
              </h3>
              <button
                onClick={closePasswordModal}
                className="user-mgmt-modal-close"
                disabled={isDeleting}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="user-mgmt-modal-body">
              <div className="user-mgmt-modal-warning">
                <p>You are about to delete user: <strong>{selectedUserForDeletion?.username}</strong></p>
                <p>This action cannot be undone. Please enter your password to confirm.</p>
              </div>
              
              <div className="user-mgmt-password-field">
                <label className="user-mgmt-password-label">Your Password</label>
                <div className="user-mgmt-password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    className="user-mgmt-password-input"
                    placeholder="Enter your password"
                    disabled={isDeleting}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePasswordConfirmation();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="user-mgmt-password-toggle"
                    disabled={isDeleting}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                
                {passwordError && (
                  <div className="user-mgmt-password-error">
                    <AlertTriangle size={14} />
                    {passwordError}
                  </div>
                )}
              </div>
            </div>
            
            <div className="user-mgmt-modal-footer">
              <button
                onClick={closePasswordModal}
                className="user-mgmt-modal-cancel"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordConfirmation}
                className="user-mgmt-modal-confirm"
                disabled={isDeleting || !passwordConfirmation}
              >
                {isDeleting ? (
                  <>
                    <div className="user-mgmt-modal-spinner" />
                    Deleting...
                  </>
                ) : (
                  'Delete User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserListing;
