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
  issueStatus: 'Pending' | 'Assigned' | 'Resolved';
  city: string;
  issues: string;
  issueId?: number;
  feedback: string;
  POSMchecked: boolean | null;
}

interface VisitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: AdminVisitData | null;
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
            <h3 className="admin-visit-detail-section-title">Basic Information</h3>
            <div className="admin-visit-detail-grid">
              <div className="admin-visit-detail-item">
                <span className="admin-visit-detail-label">Store Name:</span>
                <span className="admin-visit-detail-value">{visit.storeName}</span>
              </div>
              <div className="admin-visit-detail-item">
                <span className="admin-visit-detail-label">City:</span>
                <span className="admin-visit-detail-value">{visit.city}</span>
              </div>
              <div className="admin-visit-detail-item">
                <span className="admin-visit-detail-label">Visit Date:</span>
                <span className="admin-visit-detail-value">{formatDate(visit.visitDate)}</span>
              </div>
              <div className="admin-visit-detail-item">
                <span className="admin-visit-detail-label">Executive:</span>
                <div className="admin-visit-executive-info">
                  <div 
                    className="admin-visit-executive-avatar"
                    style={{ backgroundColor: visit.avatarColor }}
                  >
                    {visit.executiveInitials}
                  </div>
                  <span className="admin-visit-executive-name">{visit.executiveName}</span>
                </div>
              </div>
              <div className="admin-visit-detail-item">
                <span className="admin-visit-detail-label">Visit Status:</span>
                <span 
                  className="admin-visit-detail-value admin-visit-status-badge"
                  style={{ backgroundColor: getStatusColor(visit.visitStatus), color: 'white', padding: '4px 12px', borderRadius: '4px' }}
                >
                  {visit.visitStatus === 'PENDING_REVIEW' ? 'Pending Review' : 'Reviewed'}
                </span>
              </div>
            </div>
          </div>

          <div className="admin-visit-detail-section">
            <h3 className="admin-visit-detail-section-title">POSM Check</h3>
            <div className="admin-visit-detail-grid">
              <div className="admin-visit-detail-item">
                <span className="admin-visit-detail-label">POSM Available:</span>
                <span className="admin-visit-detail-value">
                  {visit.POSMchecked === null ? 'Not specified' : (visit.POSMchecked ? 'Yes' : 'No')}
                </span>
              </div>
            </div>
          </div>

          <div className="admin-visit-detail-section">
            <h3 className="admin-visit-detail-section-title">Partner Brands</h3>
            <div className="admin-visit-brands-list">
              {visit.partnerBrand.map((brand, index) => (
                <span 
                  key={index} 
                  className="admin-visit-brand-tag"
                  style={{ 
                    backgroundColor: getBrandColor(brand),
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    margin: '2px'
                  }}
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>

          {visit.feedback && visit.feedback !== 'No feedback provided' && (
            <div className="admin-visit-detail-section">
              <h3 className="admin-visit-detail-section-title">Feedback</h3>
              <p className="admin-visit-detail-text">{visit.feedback}</p>
            </div>
          )}

          {visit.issues && visit.issues !== 'None' && (
            <div className="admin-visit-detail-section">
              <h3 className="admin-visit-detail-section-title">Issues Reported</h3>
              <div className="admin-visit-issues-list">
                <div className="admin-visit-issue-item">
                  <div className="admin-visit-issue-header">
                    <span className="admin-visit-issue-details">{visit.issues}</span>
                    <span 
                      className="admin-visit-issue-status-badge"
                      style={{ 
                        backgroundColor: getStatusColor(visit.issueStatus),
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}
                    >
                      {visit.issueStatus}
                    </span>
                  </div>
                  {visit.issueId && (
                    <div className="admin-visit-issue-id">
                      Issue ID: #{visit.issueId}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(!visit.issues || visit.issues === 'None') && (
            <div className="admin-visit-detail-section">
              <h3 className="admin-visit-detail-section-title">Issues Reported</h3>
              <p className="admin-visit-no-issues">No issues reported for this visit.</p>
            </div>
          )}
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