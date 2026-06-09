'use client';

import React from 'react';
import './VisitDetailsModal.css';

interface PastVisit {
  id: string;
  date: string;
  visitDate?: string;
  status: 'PENDING_REVIEW' | 'REVIEWD';
  representative: string;
  canViewDetails?: boolean;
  personMet: PersonMet[];
  POSMchecked: boolean | null;
  remarks?: string;
  imageUrls: string[];
  adminComment?: string;
  issues: VisitIssue[];
  createdAt: string;
  updatedAt: string;
  storeName: string;
  reviewerName?: string;
  brandVisitDetails?: any[];
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
  isDigital: boolean;
}

const VisitDetailsModal: React.FC<VisitDetailsModalProps> = ({
  isOpen,
  onClose,
  visit,
  isDigital
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
      const endpoint = isDigital
        ? `/api/executive/digital-visit/${visit.id}`
        : `/api/executive/visits/${visit.id}`;
      const res = await fetch(endpoint, {
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
      try { (window as any).dispatchEvent(new CustomEvent('visit-deleted', { detail: { id: visit.id } })); } catch { }
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
                <span className="visit-detail-value">{formatDate(visit.visitDate || visit.createdAt)}</span>
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

          
          {visit.brandVisitDetails && visit.brandVisitDetails.length > 0 ? (
            visit.brandVisitDetails.map((brandInfo: any, index: number) => (
              <div key={index} style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', marginBottom: '16px', backgroundColor: '#f8fafc' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '1.2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>{brandInfo.brandName}</h3>
                
                {brandInfo.POSMchecked !== null && brandInfo.POSMchecked !== undefined && (
                  <div className="visit-detail-section" style={{ marginBottom: '12px', borderBottom: 'none' }}>
                    <span className="visit-detail-label">POSM Available: </span>
                    <span className="visit-detail-value">{brandInfo.POSMchecked ? 'Yes' : 'No'}</span>
                  </div>
                )}

                {brandInfo.peopleMet && brandInfo.peopleMet.length > 0 && (
                  <div className="visit-detail-section" style={{ marginBottom: '12px', borderBottom: 'none' }}>
                    <h4 className="visit-detail-section-title" style={{ fontSize: '1rem', marginTop: '8px' }}>People Met</h4>
                    <div className="visit-people-met-compact-list">
                      {brandInfo.peopleMet.map((person: any, i: number) => (
                        <div key={i} className="visit-person-met-compact-item" style={{ marginBottom: '4px' }}>
                          <span className="visit-person-name"><strong>{person.name === 'SEC' ? person.designation : person.name}</strong></span>
                          <span className="visit-person-details"> ({person.name === 'SEC' ? 'SEC' : person.designation}) {person.phoneNumber && ` • 📞 ${person.phoneNumber}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {brandInfo.remarks && (
                  <div className="visit-detail-section" style={{ marginBottom: '12px', borderBottom: 'none' }}>
                    <h4 className="visit-detail-section-title" style={{ fontSize: '1rem', marginTop: '8px' }}>Remarks</h4>
                    <p className="visit-detail-text">{brandInfo.remarks}</p>
                  </div>
                )}

                {brandInfo.imageUrls && brandInfo.imageUrls.length > 0 && (
                  <div className="visit-detail-section" style={{ marginBottom: '12px', borderBottom: 'none' }}>
                    <h4 className="visit-detail-section-title" style={{ fontSize: '1rem', marginTop: '8px' }}>Images</h4>
                    <div className="visit-images-grid">
                      {brandInfo.imageUrls.map((imageUrl: string, i: number) => (
                        <div key={i} className="visit-image-item">
                          <img src={imageUrl} alt={`Visit image ${i + 1}`} className="visit-detail-image" onClick={() => window.open(imageUrl, '_blank')} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {brandInfo.issuesRaised && brandInfo.issuesRaised.length > 0 && (
                  <div className="visit-detail-section" style={{ marginBottom: '12px', borderBottom: 'none' }}>
                    <h4 className="visit-detail-section-title" style={{ fontSize: '1rem', marginTop: '8px' }}>Issues Raised</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {brandInfo.issuesRaised.map((iss: string, i: number) => (
                        <li key={i} style={{ color: '#dc2626' }}>{iss}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          ) : (
            <>
              {/* Fallback for legacy visits without brandVisitDetails */}
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
                          <strong>{person.name === 'SEC' ? person.designation : person.name}</strong>
                        </span>
                        <span className="visit-person-details">
                          {' '}({person.name === 'SEC' ? 'SEC' : person.designation})
                          {person.phoneNumber && ` • 📞 ${person.phoneNumber}`}
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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
