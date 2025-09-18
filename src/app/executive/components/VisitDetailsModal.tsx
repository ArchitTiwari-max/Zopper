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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  if (!isOpen || !visit) {
    return null;
  }

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
                  {visit.status}
                </span>
              </div>
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
              <div className="visit-people-met-list">
                {visit.personMet.map((person, index) => (
                  <div key={index} className="visit-person-met-item">
                    <span className="visit-person-name">{person.name}</span>
                    <span className="visit-person-designation">({person.designation})</span>
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
      </div>
    </div>
  );
};

export default VisitDetailsModal;
