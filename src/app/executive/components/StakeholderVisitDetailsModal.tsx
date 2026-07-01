'use client';

import React from 'react';
import './VisitDetailsModal.css';

interface PersonMet {
  name: string;
  designation: string;
  phoneNumber?: string;
}

interface StakeholderVisit {
  id: string;
  visitDate: string;
  status: 'PENDING_REVIEW' | 'REVIEWD';
  personMet: PersonMet[];
  remarks?: string;
  imageUrls: string[];
  adminComment?: string;
  createdAt: string;
  executive?: {
    name: string;
  }
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: StakeholderVisit | null;
  brandName: string;
}

const StakeholderVisitDetailsModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  visit,
  brandName
}) => {
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING_REVIEW':
        return '#ffc107';
      case 'REVIEWD':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date not set';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);

  const handleDelete = async () => {
    if (!visit) return;
    const ok = window.confirm('Are you sure you want to delete this stakeholder visit?');
    if (!ok) return;

    try {
      setIsDeleting(true);
      const res = await fetch('/api/executive/stakeholder-visit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: visit.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to delete visit');
      }
      alert('Visit deleted successfully!');
      try {
        // Trigger a custom event to tell the parent component to refresh the data
        (window as any).dispatchEvent(new CustomEvent('stakeholder-visit-deleted', { detail: { id: visit.id } }));
      } catch (e) {
        console.error('Event dispatch failed', e);
      }
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete visit');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !visit) return null;

  return (
    <div
      className="visit-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      tabIndex={-1}
    >
      <div className="visit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="visit-modal-header">
          <h2 className="visit-modal-title">Stakeholder Visit Details</h2>
          <button className="visit-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="visit-modal-body">
          <div className="visit-detail-section">
            <h3 className="visit-detail-section-title">Basic Information</h3>
            <div className="visit-detail-grid">
              <div className="visit-detail-item">
                <span className="visit-detail-label">Brand:</span>
                <span className="visit-detail-value">{brandName}</span>
              </div>
              <div className="visit-detail-item">
                <span className="visit-detail-label">Visit Date:</span>
                <span className="visit-detail-value">{formatDate(visit.visitDate)}</span>
              </div>
              <div className="visit-detail-item">
                <span className="visit-detail-label">Status:</span>
                <span
                  className="visit-detail-value visit-status-badge"
                  style={{ backgroundColor: getStatusColor(visit.status), color: 'white', padding: '2px 8px', borderRadius: '4px' }}
                >
                  {visit.status === 'REVIEWD' ? 'Reviewed' : 'Pending Review'}
                </span>
              </div>
              <div className="visit-detail-item">
                <span className="visit-detail-label">Executive:</span>
                <span className="visit-detail-value">{visit.executive?.name || 'Executive'}</span>
              </div>
            </div>
          </div>

          {Array.isArray(visit.personMet) && visit.personMet.length > 0 && (
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

          {Array.isArray(visit.imageUrls) && visit.imageUrls.length > 0 && (
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

          {visit.adminComment && (
            <div className="visit-detail-section">
              <h3 className="visit-detail-section-title">Admin Comment</h3>
              <p className="visit-detail-text" style={{ color: '#059669', backgroundColor: '#ecfdf5', padding: '8px', borderRadius: '4px' }}>
                {visit.adminComment}
              </p>
            </div>
          )}
        </div>

        <div className="visit-modal-footer" style={{ display: 'flex', justifyContent: visit.status === 'PENDING_REVIEW' ? 'space-between' : 'flex-end', width: '100%' }}>
          {visit.status === 'PENDING_REVIEW' && (
            <button
              className={`visit-delete-button${isDeleting ? ' disabled' : ''}`}
              onClick={handleDelete}
              disabled={isDeleting}
              style={{ padding: '8px 16px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              {isDeleting ? 'Deleting...' : 'Delete Visit'}
            </button>
          )}
          <button
            className="exec-f-sub-submit-visit-btn"
            style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StakeholderVisitDetailsModal;
