'use client';

import React from 'react';
import './VisitDetailsModal.css';

interface AdminVisitData {
  id: number;
  executiveName: string;
  executiveInitials: string;
  avatarColor: string;
  storeName: string;
  partnerBrand: string[];
  visitDate: string;
  visitStatus: 'PENDING_REVIEW' | 'REVIEWD';
  reviewerName?: string; // Admin who reviewed the visit (optional)
  issueStatus: 'Pending' | 'Assigned' | 'Resolved';
  city: string;
  issues: string;
  issueId?: number;
  feedback: string;
  POSMchecked: boolean | null;
  peopleMet?: Array<{name: string, designation: string, phoneNumber?: string}>;
  imageUrls?: string[];
}

interface VisitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: AdminVisitData | null;
  onMarkReviewed?: (visitId: string, requiresFollowUp?: boolean, adminComment?: string) => void;
  isMarkingReviewed?: boolean;
  isDigital?: boolean;
}

const VisitDetailsModal: React.FC<VisitDetailsModalProps> = ({
  isOpen,
  onClose,
  visit,
  onMarkReviewed,
  isMarkingReviewed = false,
  isDigital = false
}) => {
  // All hooks must be declared unconditionally at the top to respect the Rules of Hooks
  const [showFollowUpForm, setShowFollowUpForm] = React.useState(false);
  const [adminComment, setAdminComment] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleMarkReviewWithFollow = () => {
    setShowFollowUpForm(true);
    setAdminComment('Follow-up required for visit remarks'); // Default comment
  };

  const handleSendFollowUp = () => {
    if (onMarkReviewed) {
      onMarkReviewed(visit.id.toString(), true, adminComment.trim());
    }
  };

  const handleCancelFollowUp = () => {
    setShowFollowUpForm(false);
    setAdminComment('');
  };
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING_REVIEW':
        return '#ffc107';
      case 'REVIEWD':
        return '#28a745';
      case 'PENDING':
        return '#ffc107';
      case 'ASSIGNED':
        return '#007bff';
      case 'RESOLVED':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (dateString: string) => {
    // Check if the date is already in dd/mm/yyyy format
    if (dateString && dateString.includes('/') && dateString.split('/').length === 3) {
      // Already formatted, return as is
      return dateString;
    }
    
    // Otherwise, format from ISO date string
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    } else {
      // Reset form state when modal closes
      setShowFollowUpForm(false);
      setAdminComment('');
    }
  }, [isOpen, onClose]);

  if (!isOpen || !visit) {
    return null;
  }

  const handleDelete = async () => {
    const ok = window.confirm('Are you sure you want to delete this visit?');
    if (!ok) return;

    try {
      setIsDeleting(true);
      const endpoint = isDigital 
        ? `/api/executive/digital-visit/${visit.id}`
        : `/api/executive/visits/${visit.id}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete visit');
      onClose();
      setTimeout(() => { if (typeof window !== 'undefined') window.location.reload(); }, 50);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete visit');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div 
      className="admin-visit-modal-overlay" 
      onClick={handleOverlayClick}
      tabIndex={-1}
    >
      <div className="admin-visit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="admin-visit-modal-header">
          <h2 className="admin-visit-modal-title">Visit Details</h2>
          <button className="admin-visit-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="admin-visit-modal-body">
          <div className="admin-visit-detail-section">
            <h3 className="admin-visit-detail-section-title-compact">Basic Information</h3>
            <div className="admin-visit-unified-info-grid">
              <div className="admin-visit-info-card">
                <div className="admin-visit-info-label">Store Name:</div>
                <div className="admin-visit-info-value">{visit.storeName}</div>
              </div>
              <div className="admin-visit-info-card">
                <div className="admin-visit-info-label">{isDigital ? 'Connect Date:' : 'Visit Date:'}</div>
                <div className="admin-visit-info-value">{formatDate(visit.visitDate)}</div>
              </div>
              <div className="admin-visit-info-card">
                <div className="admin-visit-info-label">Status:</div>
                <span 
                  className="admin-visit-status-badge-compact"
                  style={{ backgroundColor: getStatusColor(visit.visitStatus) }}
                >
                  {visit.visitStatus === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'REVIEWED'}
                </span>
              </div>
              {visit.visitStatus === 'REVIEWD' && (
                <div className="admin-visit-info-card">
                  <div className="admin-visit-info-label">Reviewed By:</div>
                  <div className="admin-visit-info-value">{visit.reviewerName || '—'}</div>
                </div>
              )}
              <div className="admin-visit-info-card">
                <div className="admin-visit-info-label">City:</div>
                <div className="admin-visit-info-value">{visit.city}</div>
              </div>
              <div className="admin-visit-info-card">
                <div className="admin-visit-info-label">Executive:</div>
                <div className="admin-visit-executive-info-compact">
                  <div 
                    className="admin-visit-executive-avatar-compact"
                    style={{ backgroundColor: visit.avatarColor }}
                  >
                    {visit.executiveInitials}
                  </div>
                  <span className="admin-visit-executive-name-compact">{visit.executiveName}</span>
                </div>
              </div>
              <div className="admin-visit-info-card">
                <div className="admin-visit-info-label">Partner Brands:</div>
                <div className="admin-visit-brands-inline">
                  {visit.partnerBrand.map((brand, index) => (
                    <span 
                      key={index} 
                      className="admin-visit-brand-tag-compact"
                      style={{ backgroundColor: getBrandColor(brand) }}
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="admin-visit-detail-section">
            <h3 className="admin-visit-detail-section-title-compact">POSM Check</h3>
            <div style={{ maxWidth: '200px' }}>
              <div className="admin-visit-info-card">
                <div className="admin-visit-info-label">POSM Available:</div>
                <div className="admin-visit-info-value">
                  {visit.POSMchecked === null ? 'Not specified' : (visit.POSMchecked ? 'Yes' : 'No')}
                </div>
              </div>
            </div>
          </div>

          {(visit.peopleMet && visit.peopleMet.length > 0) && (
            <div className="admin-visit-detail-section">
              <h3 className="admin-visit-detail-section-title-compact">People Met</h3>
              <div style={{ maxWidth: '400px' }}>
                <div className="admin-visit-info-card">
                  {visit.peopleMet.map((person, index) => (
                    <div key={index} style={{ marginBottom: index < visit.peopleMet.length - 1 ? '12px' : '0' }}>
                      <div className="admin-visit-person-name-bold">{person.name}</div>
                      <div className="admin-visit-person-details-muted">
                        ({person.designation})
                        {person.phoneNumber && (
                          <span>
                            {' • '}
                            <a 
                              href={`tel:${person.phoneNumber}`} 
                              className="admin-visit-phone-link"
                            >
                              📞 {person.phoneNumber}
                            </a>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {visit.imageUrls && visit.imageUrls.length > 0 && (
            <div className="admin-visit-detail-section">
              <h3 className="admin-visit-detail-section-title-compact">Images</h3>
              <div className="admin-visit-images-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                gap: '12px',
                marginTop: '12px'
              }}>
                {visit.imageUrls.map((imageUrl, index) => (
                  <div key={index} className="admin-visit-image-item" style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#f9fafb'
                  }}>
                    <img 
                      src={imageUrl} 
                      alt={`Visit image ${index + 1}`}
                      className="admin-visit-detail-image"
                      style={{
                        width: '100%',
                        height: '120px',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease'
                      }}
                      onClick={() => window.open(imageUrl, '_blank')}
                      onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                      onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                    />
                    <div style={{
                      padding: '8px',
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      textAlign: 'center'
                    }}>
                      Image {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visit.feedback && visit.feedback !== 'No feedback provided' && (
            <div className="admin-visit-detail-section">
              <h3 className="admin-visit-detail-section-title-compact">Remarks</h3>
              <div className="admin-visit-info-card">
                <p className="admin-visit-remarks-content">{visit.feedback}</p>
              </div>
            </div>
          )}

          <div className="admin-visit-detail-section">
            <h3 className="admin-visit-detail-section-title-compact">Issues Reported</h3>
            {visit.issues && visit.issues !== 'None' ? (
              <div className="admin-visit-info-card">
                <div className="admin-visit-issues-header">
                  <span className="admin-visit-issue-text">{visit.issues}</span>
                  <span 
                    className="admin-visit-issue-status-badge-compact"
                    style={{ backgroundColor: getStatusColor(visit.issueStatus) }}
                  >
                    {visit.issueStatus}
                  </span>
                </div>
                {visit.issueId && (
                  <div className="admin-visit-issue-id-compact">
                    Issue ID: #{visit.issueId}
                  </div>
                )}
              </div>
            ) : (
              <div className="admin-visit-info-card">
                <p className="admin-visit-no-issues-compact">No issues reported for this visit.</p>
              </div>
            )}
          </div>

          {/* Action Buttons - only show if visit is pending review */}
          {visit.visitStatus === 'PENDING_REVIEW' && onMarkReviewed && (
            <div className="admin-visit-modal-actions">
              {!showFollowUpForm ? (
                // Initial buttons
                <>
                  <button 
                    className="admin-visit-modal-mark-reviewed-btn"
                    onClick={() => onMarkReviewed(visit.id.toString(), false)}
                    disabled={isMarkingReviewed}
                  >
                    {isMarkingReviewed ? 'Marking...' : 'Mark Reviewed'}
                  </button>
                  {/* Only show follow-up button if visit has remarks */}
                  {visit.feedback && visit.feedback.trim() !== '' && visit.feedback !== 'No feedback provided' && (
                    <button 
                      className="admin-visit-modal-mark-reviewed-follow-btn"
                      onClick={handleMarkReviewWithFollow}
                      disabled={isMarkingReviewed}
                    >
                      Mark Review with Follow
                    </button>
                  )}
                </>
              ) : (
                // Follow-up form
                <>
                  <div className="admin-visit-modal-follow-up-form">
                    <label htmlFor="admin-comment" className="admin-visit-modal-comment-label">
                      Admin Comment:
                    </label>
                    <textarea
                      id="admin-comment"
                      className="admin-visit-modal-comment-textarea"
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      placeholder="Enter your comment for the follow-up issue..."
                      rows={3}
                      disabled={isMarkingReviewed}
                    />
                  </div>
                  <div className="admin-visit-modal-follow-up-buttons">
                    <button 
                      className="admin-visit-modal-cancel-btn"
                      onClick={handleCancelFollowUp}
                      disabled={isMarkingReviewed}
                    >
                      Cancel
                    </button>
                    <button 
                      className="admin-visit-modal-send-btn"
                      onClick={handleSendFollowUp}
                      disabled={isMarkingReviewed || !adminComment.trim()}
                    >
                      {isMarkingReviewed ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="admin-visit-modal-footer">
          <button
            className={`admin-visit-delete-button${isDeleting ? ' disabled' : ''}`}
            onClick={handleDelete}
            disabled={isDeleting}
            title={'Delete this visit'}
          >
            {isDeleting ? 'Deleting...' : 'Delete Visit'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to get brand colors
const getBrandColor = (brand: string): string => {
  const brandColors: Record<string, string> = {
    'Samsung': '#1DB584',
    'Vivo': '#8B5CF6',
    'Oppo': '#F97316',
    'OnePlus': '#1DB584',
    'Realme': '#EC4899',
    'Xiaomi': '#EF4444',
    'Godrej': '#3B82F6',
    'Havells': '#F59E0B',
    'Philips': '#10B981'
  };
  return brandColors[brand] || '#64748b';
};

export default VisitDetailsModal;