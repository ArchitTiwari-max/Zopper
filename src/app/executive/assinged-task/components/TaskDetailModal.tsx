'use client';

import React from 'react';
import { X, MapPin, Calendar, User, FileText } from 'lucide-react';
import './TaskDetailModal.css';

interface StoreDetails {
  id: string;
  storeName: string;
  city: string;
  fullAddress: string | null;
  partnerBrandIds: string[];
}

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: string;
    storeName: string;
    storeDetails: StoreDetails;
    issue: string;
    city: string;
    status: 'Assigned' | 'In_Progress' | 'Completed';
    createdAt: string;
    adminComment?: string;
  } | null;
  onSubmitTask: (taskId: string) => void;
  onViewReport: (taskId: string) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  task,
  onSubmitTask,
  onViewReport
}) => {
  if (!isOpen || !task) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isPending = task.status !== 'Completed';
  const isCompleted = task.status === 'Completed';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Assigned': return '#f59e0b';
      case 'In_Progress': return '#3b82f6';
      case 'Completed': return '#10b981';
      default: return '#64748b';
    }
  };

  return (
    <div className="task-detail-modal-backdrop" onClick={handleBackdropClick}>
      <div className="task-detail-modal">
        <div className="modal-header">
          <div className="header-content">
            <h2 className="modal-title">Task Details</h2>
            <div className="task-meta">
              <span className="task-id">#{task.id.slice(-8)}</span>
              <span 
                className="status-badge"
                style={{ backgroundColor: getStatusColor(task.status) }}
              >
                {task.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {/* Store Information */}
          <div className="detail-section">
            <h3 className="section-title">
              <MapPin size={18} />
              Store Information
            </h3>
            <div className="store-info-grid">
              <div className="info-item">
                <label>Store Name:</label>
                <span>{task.storeName}</span>
              </div>
              <div className="info-item">
                <label>City:</label>
                <span>{task.city}</span>
              </div>
              {task.storeDetails.fullAddress && (
                <div className="info-item full-width">
                  <label>Full Address:</label>
                  <span>{task.storeDetails.fullAddress}</span>
                </div>
              )}
              {task.storeDetails.partnerBrandIds.length > 0 && (
                <div className="info-item">
                  <label>Partner Brands:</label>
                  <span>{task.storeDetails.partnerBrandIds.length} brands</span>
                </div>
              )}
            </div>
          </div>

          {/* Issue Details */}
          <div className="detail-section">
            <h3 className="section-title">
              <FileText size={18} />
              Issue Details
            </h3>
            <div className="issue-content">
              <p>{task.issue}</p>
            </div>
          </div>

          {/* Admin Comment */}
          {task.adminComment && (
            <div className="detail-section">
              <h3 className="section-title">
                <User size={18} />
                Admin Comment
              </h3>
              <div className="admin-comment-content">
                <p>{task.adminComment}</p>
              </div>
            </div>
          )}

          {/* Task Information */}
          <div className="detail-section">
            <h3 className="section-title">
              <Calendar size={18} />
              Task Information
            </h3>
            <div className="task-info-grid">
              <div className="info-item">
                <label>Assigned Date:</label>
                <span>
                  {(() => {
                    // Check if the date is already in dd/mm/yyyy format
                    if (task.createdAt && task.createdAt.includes('/') && task.createdAt.split('/').length === 3) {
                      return task.createdAt;
                    }
                    
                    const date = new Date(task.createdAt);
                    if (isNaN(date.getTime())) return 'Invalid Date';
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}/${month}/${year}`;
                  })()
                  }
                </span>
              </div>
              <div className="info-item">
                <label>Assigned Time:</label>
                <span>
                  {(() => {
                    const date = new Date(task.createdAt);
                    if (isNaN(date.getTime())) return 'Invalid Time';
                    return date.toLocaleTimeString();
                  })()
                  }
                </span>
              </div>
              <div className="info-item">
                <label>Current Status:</label>
                <span 
                  className="status-inline"
                  style={{ color: getStatusColor(task.status) }}
                >
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="footer-actions">
            <button 
              className="cancel-btn" 
              onClick={onClose}
            >
              Close
            </button>
            
            {isPending && (
              <button 
                className="submit-task-btn"
                onClick={() => {
                  onSubmitTask(task.id);
                  onClose();
                }}
              >
                Submit Response
              </button>
            )}
            
            {isCompleted && (
              <button 
                className="view-report-btn"
                onClick={() => {
                  onViewReport(task.id);
                  onClose();
                }}
              >
                View Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
