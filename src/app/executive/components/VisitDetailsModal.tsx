'use client';

import React from 'react';
import './VisitDetailsModal.css';

interface PastVisit {
  id: string;
  date: string;
  status: 'PENDING_REVIEW' | 'REVIEWD';
  representative: string;
  canViewDetails: boolean;
  personMet: PersonMet[];
  POSMchecked: boolean | null;
  remarks?: string;
  imageUrls: string[];
  adminComment?: string;
  issues: VisitIssue[];
  createdAt: string;
  updatedAt: string;
  storeName: string;
  reviewerName?: string; // Name of the admin who marked the visit as reviewed (optional)
}

interface VisitIssue {
  id: string;
  details: string;
  status: 'PENDING' | 'ASSIGNED' | 'RESOLVED';
  createdAt: string;
  assigned: IssueAssignment[];
}

interface IssueAssignment {
  id: string;
  adminComment?: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'VIEW_REPORT';
  createdAt: string;
  executiveName: string;
}

interface PersonMet {
  name: string;
  designation: string;
  phoneNumber?: string;
}

interface VisitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: PastVisit | null;
}

const VisitDetailsModal: React.FC<VisitDetailsModalProps> = ({
  isOpen,
  onClose,
  visit
}) => {
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
      case 'IN_PROGRESS':
        return '#17a2b8';
      case 'VIEW_REPORT':
        return '#6f42c1';
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
    
    // Otherwise, format to dd/mm/yyyy format
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

  const handleEscapeKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
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
    }
  }, [isOpen, onClose]);

  // NOTE: Hooks must be unconditional. Keep this before any conditional return.
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!isOpen || !visit) {
    return null;
  }

  const handleDelete = async () => {
    if (visit.status === 'REVIEWD') return; // safety
    const ok = window.confirm('Are you sure you want to delete this visit?');
    if (!ok) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/executive/visits/${visit.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete visit');
      }
      // Close and refresh list
      onClose();
      // Soft refresh - let parent re-fetch; fallback to hard reload
      try { (window as any).dispatchEvent(new CustomEvent('visit-deleted', { detail: { id: visit.id } })); } catch {}
      setTimeout(() => { if (typeof window !== 'undefined') window.location.reload(); }, 50);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete visit');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div 
      className="visit-modal-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={handleEscapeKey}
      tabIndex={-1}
    >
      <div className="visit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="visit-modal-header">
          <h2 className="visit-modal-title">Visit Details</h2>
          <button className="visit-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="visit-modal-body">
          <div className="visit-detail-section">
            <h3 className="visit-detail-section-title">Basic Information</h3>
            <div className="visit-detail-grid">
              <div className="visit-detail-item">
                <span className="visit-detail-label">Store Name:</span>
                <span className="visit-detail-value">{visit.storeName || 'Store information not available'}</span>
              </div>
              <div className="visit-detail-item">
                <span className="visit-detail-label">Visit Date:</span>
                <span className="visit-detail-value">{formatDate(visit.createdAt)}</span>
              </div>
              <div className="visit-detail-item">
                <span className="visit-detail-label">Status:</span>
                <span 
                  className="visit-detail-value visit-status-badge"
                  style={{ backgroundColor: getStatusColor(visit.status), color: 'white', padding: '2px 8px', borderRadius: '4px' }}
                >
                  {visit.status === 'PENDING_REVIEW' ? 'Pending Review' : visit.status === 'REVIEWD' ? 'Reviewed' : visit.status}
                </span>
              </div>
              {visit.status === 'REVIEWD' && (
                <div className="visit-detail-item">
                  <span className="visit-detail-label">Reviewed By:</span>
                  <span className="visit-detail-value">{visit.reviewerName || '—'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="visit-detail-section">
            <h3 className="visit-detail-section-title">POSM Check</h3>
            <div className="visit-detail-grid">
              <div className="visit-detail-item">
                <span className="visit-detail-label">POSM Available:</span>
                <span className="visit-detail-value">
                  {visit.POSMchecked === null ? 'Not specified' : (visit.POSMchecked ? 'Yes' : 'No')}
                </span>
              </div>
            </div>
          </div>

          {visit.personMet && visit.personMet.length > 0 && (
            <div className="visit-detail-section">
              <h3 className="visit-detail-section-title">People Met</h3>
              <div className="visit-people-met-compact-list">
                {visit.personMet.map((person, index) => (
                  <div key={index} className="visit-person-met-compact-item" style={{ marginBottom: '8px' }}>
                    <span className="visit-person-name">
                      <strong>{person.name}</strong>
                    </span>
                    <span className="visit-person-details">
                      {' '}({person.designation})
                      {person.phoneNumber && (
                        <>
                          {' • '}
                          <a 
                            href={`tel:${person.phoneNumber}`} 
                            className="visit-phone-link"
                            style={{ 
                              color: '#3b82f6', 
                              textDecoration: 'none',
                              fontSize: '0.875rem'
                            }}
                            onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                            onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                          >
                            📞 {person.phoneNumber}
                          </a>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visit.remarks && (
            <div className="visit-detail-section">
              <h3 className="visit-detail-section-title">Remarks</h3>
              <p className="visit-detail-text">{visit.remarks}</p>
            </div>
          )}

          {visit.adminComment && (
            <div className="visit-detail-section">
              <h3 className="visit-detail-section-title">Admin Comment</h3>
              <p className="visit-detail-text visit-admin-comment">{visit.adminComment}</p>
            </div>
          )}

          {visit.imageUrls && visit.imageUrls.length > 0 && (
            <div className="visit-detail-section">
              <h3 className="visit-detail-section-title">Images</h3>
              <div className="visit-images-grid">
                {visit.imageUrls.map((imageUrl, index) => (
                  <div key={index} className="visit-image-item">
                    <img 
                      src={imageUrl} 
                      alt={`Visit image ${index + 1}`}
                      className="visit-detail-image"
                      onClick={() => window.open(imageUrl, '_blank')}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {visit.issues && visit.issues.length > 0 && (
            <div className="visit-detail-section">
              <h3 className="visit-detail-section-title">Issues Reported</h3>
              <div className="visit-issues-list">
                {visit.issues.map((issue) => (
                  <div key={issue.id} className="visit-issue-detail-item">
                    <div className="visit-issue-header">
                      <span className="visit-issue-details">{issue.details}</span>
                      <span 
                        className="visit-issue-status-badge"
                        style={{ color: getStatusColor(issue.status) }}
                      >
                        {issue.status}
                      </span>
                    </div>
                    <div className="visit-issue-date">
                      Created: {formatDate(issue.createdAt)}
                    </div>
                    {issue.assigned && issue.assigned.length > 0 && (
                      <div className="visit-issue-assignments">
                        <h4>Assignments:</h4>
                        {issue.assigned.map((assignment) => (
                          <div key={assignment.id} className="visit-assignment-item">
                            <div className="visit-assignment-header">
                              <span className="visit-assignment-executive">{assignment.executiveName}</span>
                              <span className="visit-assignment-status">({assignment.status})</span>
                            </div>
                            {assignment.adminComment && (
                              <div className="visit-assignment-comment">
                                <strong>Admin Comment:</strong> {assignment.adminComment}
                              </div>
                            )}
                            <div className="visit-assignment-date">
                              Assigned: {formatDate(assignment.createdAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="visit-modal-footer">
          {visit.status !== 'REVIEWD' && (
            <button
              className={`visit-delete-button${isDeleting ? ' disabled' : ''}`}
              onClick={handleDelete}
              disabled={isDeleting}
              title={'Delete this visit'}
            >
              {isDeleting ? 'Deleting...' : 'Delete Visit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisitDetailsModal;
