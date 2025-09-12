'use client';

import React, { useState, useEffect } from 'react';
import { X, User, FileText, Camera, Calendar, MapPin } from 'lucide-react';
import './ViewReportModal.css';

interface PersonMet {
  name: string | null;
  designation: string | null;
}

interface AssignmentReport {
  id: string;
  remarks: string;
  personMet: PersonMet;
  photoUrls: string[];
  createdAt: string;
  assignedTask: {
    id: string;
    status: string;
    issue: {
      id: string;
      details: string;
    };
  };
}

interface ViewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  storeName: string;
}

const ViewReportModal: React.FC<ViewReportModalProps> = ({
  isOpen,
  onClose,
  taskId,
  storeName
}) => {
  const [report, setReport] = useState<AssignmentReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchReport();
    }
  }, [isOpen, taskId]);

  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/executive/submit-task?taskId=${taskId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setReport(result.data);
      } else {
        setError(result.error || 'Failed to fetch report');
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const openPhotoViewer = (index: number) => {
    setSelectedPhotoIndex(index);
  };

  const closePhotoViewer = () => {
    setSelectedPhotoIndex(null);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!report || selectedPhotoIndex === null) return;
    
    const newIndex = direction === 'prev' 
      ? (selectedPhotoIndex - 1 + report.photoUrls.length) % report.photoUrls.length
      : (selectedPhotoIndex + 1) % report.photoUrls.length;
    
    setSelectedPhotoIndex(newIndex);
  };

  if (!isOpen) return null;

  return (
    <div className="executive-view-report-modal-backdrop" onClick={handleBackdropClick}>
      <div className="executive-view-report-modal">
        <div className="modal-header">
          <div className="header-content">
            <h2 className="modal-title">Task Report</h2>
            <div className="report-meta">
              <span className="store-name">
                <MapPin size={16} />
                {storeName}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading report...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p className="error-message">{error}</p>
              <button onClick={fetchReport} className="retry-btn">
                Try Again
              </button>
            </div>
          ) : report ? (
            <div className="report-content">
              {/* Report Header */}
              <div className="report-header">
                <div className="report-info">
                  <div className="info-item">
                    <Calendar size={16} />
                    <span>Submitted: {new Date(report.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="info-item">
                    <span className="status-badge completed">
                      {report.assignedTask.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Person Met Section */}
              {(report.personMet.name || report.personMet.designation) && (
                <div className="report-section">
                  <h3 className="section-title">
                    <User size={18} />
                    Person Met
                  </h3>
                  <div className="person-met-info">
                    {report.personMet.name && (
                      <div className="person-detail">
                        <label>Name:</label>
                        <span>{report.personMet.name}</span>
                      </div>
                    )}
                    {report.personMet.designation && (
                      <div className="person-detail">
                        <label>Designation:</label>
                        <span>{report.personMet.designation}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Remarks Section */}
              <div className="report-section">
                <h3 className="section-title">
                  <FileText size={18} />
                  Remarks
                </h3>
                <div className="remarks-content">
                  <p>{report.remarks}</p>
                </div>
              </div>

              {/* Photos Section */}
              {report.photoUrls && report.photoUrls.length > 0 && (
                <div className="report-section">
                  <h3 className="section-title">
                    <Camera size={18} />
                    Photos ({report.photoUrls.length})
                  </h3>
                  <div className="photos-grid">
                    {report.photoUrls.map((photoUrl, index) => (
                      <div 
                        key={index} 
                        className="photo-thumbnail"
                        onClick={() => openPhotoViewer(index)}
                      >
                        <img 
                          src={photoUrl} 
                          alt={`Report photo ${index + 1}`}
                          loading="lazy"
                        />
                        <div className="photo-overlay">
                          <span>View</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issue Details */}
              <div className="report-section">
                <h3 className="section-title">Issue Details</h3>
                <div className="issue-details">
                  <p>{report.assignedTask.issue.details}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-data-state">
              <p>No report data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Photo Viewer Modal */}
      {selectedPhotoIndex !== null && report && (
        <div className="photo-viewer-backdrop" onClick={closePhotoViewer}>
          <div className="photo-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="photo-viewer-header">
              <span className="photo-counter">
                {selectedPhotoIndex + 1} of {report.photoUrls.length}
              </span>
              <button onClick={closePhotoViewer} className="photo-close-btn">
                <X size={24} />
              </button>
            </div>
            <div className="photo-viewer-content">
              <img 
                src={report.photoUrls[selectedPhotoIndex]} 
                alt={`Report photo ${selectedPhotoIndex + 1}`}
              />
              {report.photoUrls.length > 1 && (
                <>
                  <button 
                    className="photo-nav-btn prev" 
                    onClick={() => navigatePhoto('prev')}
                  >
                    ‹
                  </button>
                  <button 
                    className="photo-nav-btn next" 
                    onClick={() => navigatePhoto('next')}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewReportModal;
