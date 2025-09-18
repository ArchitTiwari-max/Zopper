'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IssueData, IssueComment } from '../../types';
import { Loader2 } from 'lucide-react';
import ViewReportModal from './components/ViewReportModal';
import './page.css';


interface Executive {
  id: string;
  name: string;
  region?: string;
}

const IssueDetailPage: React.FC = () => {
  const params = useParams();
  const issueId = params.id as string;
  
  const [issueData, setIssueData] = useState<IssueData | null>(null);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState<string>('');
  const [selectedExecutive, setSelectedExecutive] = useState<string>('');
  const [showStoreDetails, setShowStoreDetails] = useState<boolean>(false);
  const [showVisitContext, setShowVisitContext] = useState<boolean>(false);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [isMarkingSolved, setIsMarkingSolved] = useState<boolean>(false);
  const [viewReportModal, setViewReportModal] = useState<{
    isOpen: boolean;
    assignmentId: string;
    executiveName: string;
  }>({ isOpen: false, assignmentId: '', executiveName: '' });

  // Load issue data and executives from API
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch issue data and executives in parallel
        const [issueResponse, executivesResponse] = await Promise.all([
          fetch(`/api/admin/issues/${issueId}`),
          fetch('/api/admin/executives/filters')
        ]);
        
        if (!issueResponse.ok) {
          throw new Error(`Failed to fetch issue: ${issueResponse.status}`);
        }
        
        if (!executivesResponse.ok) {
          throw new Error(`Failed to fetch executives: ${executivesResponse.status}`);
        }
        
        const [issueData, executivesData] = await Promise.all([
          issueResponse.json(),
          executivesResponse.json()
        ]);
        
        setIssueData(issueData);
        setExecutives(executivesData.executives || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (issueId) {
      fetchData();
    }
  }, [issueId]);

  const handleAddComment = async () => {
    if (!issueData || !newComment.trim()) return;

    try {
      const response = await fetch(`/api/admin/issues/${issueId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: newComment.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const newCommentData = await response.json();

      // Update the issue data with the new comment
      setIssueData({
        ...issueData,
        comments: [...issueData.comments, newCommentData],
        updatedAt: new Date().toISOString()
      });
      
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    }
  };

  const handleSendTask = async () => {
    if (!issueData || !selectedExecutive || isAssigning) return;

    const executive = executives.find(exec => exec.id === selectedExecutive);
    if (!executive) return;

    setIsAssigning(true);
    try {
      const response = await fetch(`/api/admin/issues/${issueId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          executiveId: selectedExecutive,
          adminComment: newComment.trim() || `Task assigned to ${executive.name}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to assign task');
      }

      const result = await response.json();

      // Update the issue data with the new assignment
      setIssueData({
        ...issueData,
        status: 'Assigned',
        assignmentHistory: [...issueData.assignmentHistory, result.assignment],
        updatedAt: new Date().toISOString()
      });
      
      setSelectedExecutive('');
      setNewComment('');
      alert(`Task successfully assigned to ${executive.name}`);
    } catch (error) {
      console.error('Error assigning task:', error);
      alert('Failed to assign task. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleMarkSolved = async () => {
    if (!issueData || isMarkingSolved) return;

    setIsMarkingSolved(true);
    try {
      const response = await fetch(`/api/admin/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'Resolved',
          resolution: 'Issue resolved by admin'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to mark issue as resolved');
      }

      const result = await response.json();

      // Update the issue data with the updated issue
      setIssueData(result.issue);
      
      alert(`Issue ${issueData.issueId} marked as resolved`);
    } catch (error) {
      console.error('Error marking issue as resolved:', error);
      alert('Failed to mark issue as resolved. Please try again.');
    } finally {
      setIsMarkingSolved(false);
    }
  };

  const handleExportReport = () => {
    if (!issueData) return;
    console.log(`Exporting report for issue ${issueData.issueId}`);
  };

  const handleViewReport = (assignmentId: string, executiveName: string) => {
    setViewReportModal({
      isOpen: true,
      assignmentId,
      executiveName
    });
  };

  const handleCloseViewReport = () => {
    setViewReportModal({ isOpen: false, assignmentId: '', executiveName: '' });
  };


  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'Pending': '#3b82f6',
      'Assigned': '#f59e0b',
      'In Progress': '#8b5cf6',
      'Resolved': '#10b981',
      'Closed': '#64748b'
    };
    return colors[status] || '#64748b';
  };

  const getAssignmentStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'Assigned': '#f59e0b',
      'In Progress': '#3b82f6',
      'Completed': '#10b981',
      'Rejected': '#ef4444'
    };
    return colors[status] || '#64748b';
  };

  if (isLoading) {
    return (
      <div className="admin-issue-detail-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading issue details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-issue-detail-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#ef4444' }}>Error: {error}</div>
        </div>
      </div>
    );
  }

  if (!issueData) {
    return (
      <div className="admin-issue-detail-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Issue not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-issue-detail-overview">
      {/* Header Section */}
      <div className="admin-issue-detail-header">
        <div className="admin-issue-detail-back-navigation">
          <Link href="/admin/issues" className="admin-issue-detail-back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back to Issues
          </Link>
        </div>
      </div>

      <div className="admin-issue-detail-content-grid">
        {/* Left Side - Issue Details */}
        <div className="admin-issue-detail-details-section">
          <div className="admin-issue-detail-card">
            <div className="admin-issue-detail-header">
              <div className="admin-issue-detail-id-section">
                <h3>{issueData.issueId}</h3>
                <div className="admin-issue-detail-badges">
                  <span 
                    className="admin-issue-detail-status-badge"
                    style={{ backgroundColor: getStatusColor(issueData.status) }}
                  >
                    {issueData.status}
                  </span>
                </div>
              </div>

              <div className="admin-issue-detail-store-name-section">
                <span>{issueData.storeName}</span>
                <button type="button" onClick={() => setShowStoreDetails(!showStoreDetails)} className="admin-issue-detail-view-details-btn">
                  {showStoreDetails ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              {showStoreDetails && (
                <div className="admin-issue-detail-store-details">
                  <div><strong>Brand Associated:</strong> {issueData.brandAssociated}</div>
                  <div><strong>City:</strong> {issueData.city}</div>
                </div>
              )}
            </div>

            <div className="admin-issue-detail-info-grid">
              <div className="admin-issue-detail-info-item">
                <div className="admin-issue-detail-info-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zm2.5-9L12 0 2.5 2v2h19V2z"/>
                  </svg>
                </div>
                <div className="admin-issue-detail-info-content">
                  <span className="admin-issue-detail-info-label">Date Reported:</span>
                  <span className="admin-issue-detail-info-value">
                    {(() => {
                      // Check if the date is already in dd/mm/yyyy format
                      if (issueData.dateReported && issueData.dateReported.includes('/') && issueData.dateReported.split('/').length === 3) {
                        // Already formatted, return as is
                        return issueData.dateReported;
                      }
                      
                      // Otherwise, format from ISO date string
                      const date = new Date(issueData.dateReported);
                      if (isNaN(date.getTime())) {
                        return 'Invalid Date';
                      }
                      return date.toLocaleDateString();
                    })()
                    }
                  </span>
                </div>
              </div>
              
              <div className="admin-issue-detail-info-item">
                <div className="admin-issue-detail-info-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div className="admin-issue-detail-info-content">
                  <span className="admin-issue-detail-info-label">Reported by:</span>
                  <span className="admin-issue-detail-info-value">{issueData.reportedBy} ({issueData.reportedByRole})</span>
                </div>
              </div>
            </div>

            <div className="admin-issue-detail-description">
              <h4>Issue Description:</h4>
              <p>{issueData.description}</p>
            </div>
            
            {/* Visit Context Section - Show if issue was created from a visit */}
            {showVisitContext && issueData.visitContext && (
              <div className="admin-issue-detail-visit-context-section">
                <div className="admin-issue-detail-visit-context-header">
                  <h4>Related Visit Information</h4>
                  <button type="button" onClick={() => setShowVisitContext(false)} className="admin-issue-detail-hide-visit-btn">Hide Visit Info</button>
                </div>
                <div className="admin-issue-detail-visit-context-card">
                  <div className="admin-issue-detail-visit-context-details">
                    <div className="admin-issue-detail-visit-detail-grid">
                      <div className="admin-issue-detail-visit-detail-item">
                        <span className="admin-issue-detail-detail-label">Executive:</span>
                        <div className="admin-issue-detail-executive-info">
                          <div className="admin-issue-detail-executive-avatar-mini">
                            {issueData.visitContext.executiveInitials}
                          </div>
                          <span>{issueData.visitContext.executiveName}</span>
                        </div>
                      </div>
                      <div className="admin-issue-detail-visit-detail-item">
                        <span className="admin-issue-detail-detail-label">Person Met:</span>
                        <span className="admin-issue-detail-detail-value">{issueData.visitContext.personMet} ({issueData.visitContext.personRole})</span>
                      </div>
                      <div className="admin-issue-detail-visit-detail-item">
                        <span className="admin-issue-detail-detail-label">Display Checked:</span>
                        <span className="admin-issue-detail-detail-value">
                          {issueData.visitContext.displayChecked ? '✅ Yes' : '❌ No'}
                        </span>
                      </div>
                      <div className="admin-issue-detail-visit-detail-item">
                        <span className="admin-issue-detail-detail-label">Photos Taken:</span>
                        <span className="admin-issue-detail-detail-value">📸 {issueData.visitContext.photosCount}</span>
                      </div>
                    </div>
                    <div className="admin-issue-detail-visit-feedback">
                      <span className="admin-issue-detail-detail-label">Executive Feedback:</span>
                      <div className="admin-issue-detail-feedback-content">"{issueData.visitContext.feedback}"</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!showVisitContext && issueData.visitContext && (
              <button type="button" onClick={() => setShowVisitContext(true)} className="admin-issue-detail-show-visit-btn">Show Visit Info</button>
            )}
          </div>

          {/* Assignment History */}
          <div className="admin-issue-detail-assignment-history-section">
            <div className="admin-issue-detail-section-header">
              <h3>Assignment History</h3>
            </div>

            <div className="admin-issue-detail-assignment-history-table">
              <div className="admin-issue-detail-table-header">
                <div className="admin-issue-detail-header-cell">Executive</div>
                <div className="admin-issue-detail-header-cell">Date Assigned</div>
                <div className="admin-issue-detail-header-cell">Admin Comment</div>
                <div className="admin-issue-detail-header-cell">Status</div>
              </div>
              <div className="admin-issue-detail-table-body">
                {issueData.assignmentHistory.map(assignment => (
                  <div key={assignment.id} className="admin-issue-detail-table-row">
                    <div className="admin-issue-detail-cell admin-issue-detail-executive-cell">
                      <div className="admin-issue-detail-executive-avatar-small">
                        {assignment.executiveInitials}
                      </div>
                      <span className="admin-issue-detail-executive-name">{assignment.executiveName}</span>
                    </div>
                    <div className="admin-issue-detail-cell">
                      {(() => {
                        // Check if the date is already in dd/mm/yyyy format
                        if (assignment.dateAssigned && assignment.dateAssigned.includes('/') && assignment.dateAssigned.split('/').length === 3) {
                          // Already formatted, return as is
                          return assignment.dateAssigned;
                        }
                        
                        // Otherwise, format from ISO date string
                        const date = new Date(assignment.dateAssigned);
                        if (isNaN(date.getTime())) {
                          return 'Invalid Date';
                        }
                        return date.toLocaleDateString();
                      })()
                      }
                    </div>
                    <div className="admin-issue-detail-cell admin-issue-detail-admin-comment">
                      {assignment.adminComment}
                    </div>
                    <div className="admin-issue-detail-cell">
                      {assignment.status === 'Completed' ? (
                        <button 
                          className="admin-issue-detail-view-report-btn" 
                          type="button"
                          onClick={() => handleViewReport(assignment.id, assignment.executiveName)}
                        >
                          View Report
                        </button>
                      ) : (
                        <span 
                          className="admin-issue-detail-assignment-status-badge"
                          style={{ backgroundColor: getAssignmentStatusColor(assignment.status) }}
                        >
                          {assignment.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Admin Action Area */}
        <div className="admin-issue-detail-action-area">
          <div className="admin-issue-detail-action-card">
            <h3>Admin Action Area</h3>
            
            {/* Add Comment Section */}
            <div className="admin-issue-detail-action-section">
              <label htmlFor="comment-input">Add Comment</label>
              <textarea
                id="comment-input"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Enter your comment here..."
                className="admin-issue-detail-comment-input"
                rows={4}
              />
            </div>

            {/* Select Executive Section */}
            <div className="admin-issue-detail-action-section">
              <label htmlFor="executive-select">Select Executive</label>
              <select
                id="executive-select"
                value={selectedExecutive}
                onChange={(e) => setSelectedExecutive(e.target.value)}
                className="admin-issue-detail-executive-select"
              >
                <option value="">Choose an executive...</option>
                {executives.map(executive => (
                  <option key={executive.id} value={executive.id}>
                    {executive.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="admin-issue-detail-action-buttons">
              <button 
                className="admin-issue-detail-send-task-btn"
                onClick={handleSendTask}
                disabled={!selectedExecutive || isAssigning || isMarkingSolved}
                type="button"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Sending Task...
                  </>
                ) : (
                  'Send Task'
                )}
              </button>
              <button 
                className="admin-issue-detail-mark-solved-btn"
                onClick={handleMarkSolved}
                disabled={isAssigning || isMarkingSolved}
                type="button"
              >
                {isMarkingSolved ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Marking as Solved...
                  </>
                ) : (
                  'Mark as Solved'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Issue Resolution Report */}
      <div className="admin-issue-detail-resolution-report">
        <div className="admin-issue-detail-report-header">
          <div className="admin-issue-detail-report-info">
            <h3>Issue Resolution Report</h3>
            <p>Generate comprehensive report for this issue</p>
          </div>
          <button 
            className="admin-issue-detail-export-report-btn"
            onClick={handleExportReport}
            type="button"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* View Report Modal */}
      {viewReportModal.isOpen && (
        <ViewReportModal
          isOpen={viewReportModal.isOpen}
          onClose={handleCloseViewReport}
          assignmentId={viewReportModal.assignmentId}
          executiveName={viewReportModal.executiveName}
          storeName={issueData?.storeName || ''}
        />
      )}
    </div>
  );
};

export default IssueDetailPage;
