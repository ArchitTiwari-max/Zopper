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
      <div className="issue-management-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading issue details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="issue-management-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#ef4444' }}>Error: {error}</div>
        </div>
      </div>
    );
  }

  if (!issueData) {
    return (
      <div className="issue-management-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Issue not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="issue-management-overview">
      {/* Header Section */}
      <div className="issue-management-header">
        <div className="back-navigation">
          <Link href="/admin/issues" className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back to Issues
          </Link>
        </div>
      </div>

      <div className="issue-content-grid">
        {/* Left Side - Issue Details */}
        <div className="issue-details-section">
          <div className="issue-card">
            <div className="issue-header">
              <div className="issue-id-section">
                <h3>{issueData.issueId}</h3>
                <div className="issue-badges">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(issueData.status) }}
                  >
                    {issueData.status}
                  </span>
                </div>
              </div>

              <div className="store-name-section">
                <span>{issueData.storeName}</span>
                <button type="button" onClick={() => setShowStoreDetails(!showStoreDetails)} className="view-details-btn">
                  {showStoreDetails ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              {showStoreDetails && (
                <div className="store-details">
                  <div><strong>Brand Associated:</strong> {issueData.brandAssociated}</div>
                  <div><strong>City:</strong> {issueData.city}</div>
                </div>
              )}
            </div>

            <div className="issue-info-grid">
              <div className="info-item">
                <div className="info-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zm2.5-9L12 0 2.5 2v2h19V2z"/>
                  </svg>
                </div>
                <div className="info-content">
                  <span className="info-label">Date Reported:</span>
                  <span className="info-value">{new Date(issueData.dateReported).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="issue-description">
              <h4>Issue Description:</h4>
              <p>{issueData.description}</p>
            </div>
            
            {/* Visit Context Section - Show if issue was created from a visit */}
            {showVisitContext && issueData.visitContext && (
              <div className="visit-context-section">
                <div className="visit-context-header">
                  <h4>Related Visit Information</h4>
                  <button type="button" onClick={() => setShowVisitContext(false)} className="hide-visit-btn">Hide Visit Info</button>
                </div>
                <div className="visit-context-card">
                  <div className="visit-context-details">
                    <div className="visit-detail-grid">
                      <div className="visit-detail-item">
                        <span className="detail-label">Executive:</span>
                        <div className="executive-info">
                          <div className="executive-avatar-mini">
                            {issueData.visitContext.executiveInitials}
                          </div>
                          <span>{issueData.visitContext.executiveName}</span>
                        </div>
                      </div>
                      <div className="visit-detail-item">
                        <span className="detail-label">Person Met:</span>
                        <span className="detail-value">{issueData.visitContext.personMet} ({issueData.visitContext.personRole})</span>
                      </div>
                      <div className="visit-detail-item">
                        <span className="detail-label">Display Checked:</span>
                        <span className="detail-value">
                          {issueData.visitContext.displayChecked ? '✅ Yes' : '❌ No'}
                        </span>
                      </div>
                      <div className="visit-detail-item">
                        <span className="detail-label">Photos Taken:</span>
                        <span className="detail-value">📸 {issueData.visitContext.photosCount}</span>
                      </div>
                    </div>
                    <div className="visit-feedback">
                      <span className="detail-label">Executive Feedback:</span>
                      <div className="feedback-content">"{issueData.visitContext.feedback}"</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!showVisitContext && issueData.visitContext && (
              <button type="button" onClick={() => setShowVisitContext(true)} className="show-visit-btn">Show Visit Info</button>
            )}
          </div>

          {/* Assignment History */}
          <div className="assignment-history-section">
            <div className="section-header">
              <h3>Assignment History</h3>
            </div>

            <div className="assignment-history-table">
              <div className="table-header">
                <div className="header-cell">Executive</div>
                <div className="header-cell">Date Assigned</div>
                <div className="header-cell">Admin Comment</div>
                <div className="header-cell">Status</div>
              </div>
              <div className="table-body">
                {issueData.assignmentHistory.map(assignment => (
                  <div key={assignment.id} className="table-row">
                    <div className="cell executive-cell">
                      <div className="executive-avatar-small">
                        {assignment.executiveInitials}
                      </div>
                      <span className="executive-name">{assignment.executiveName}</span>
                    </div>
                    <div className="cell">
                      {new Date(assignment.dateAssigned).toLocaleDateString()}
                    </div>
                    <div className="cell admin-comment">
                      {assignment.adminComment}
                    </div>
                    <div className="cell">
                      {assignment.status === 'Completed' ? (
                        <button 
                          className="view-report-btn" 
                          type="button"
                          onClick={() => handleViewReport(assignment.id, assignment.executiveName)}
                        >
                          View Report
                        </button>
                      ) : (
                        <span 
                          className="assignment-status-badge"
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
        <div className="admin-action-area">
          <div className="admin-action-card">
            <h3>Admin Action Area</h3>
            
            {/* Add Comment Section */}
            <div className="action-section">
              <label htmlFor="comment-input">Add Comment</label>
              <textarea
                id="comment-input"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Enter your comment here..."
                className="comment-input"
                rows={4}
              />
            </div>

            {/* Select Executive Section */}
            <div className="action-section">
              <label htmlFor="executive-select">Select Executive</label>
              <select
                id="executive-select"
                value={selectedExecutive}
                onChange={(e) => setSelectedExecutive(e.target.value)}
                className="executive-select"
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
            <div className="action-buttons">
              <button 
                className="send-task-btn"
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
                className="mark-solved-btn"
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
      <div className="issue-resolution-report">
        <div className="report-header">
          <div className="report-info">
            <h3>Issue Resolution Report</h3>
            <p>Generate comprehensive report for this issue</p>
          </div>
          <button 
            className="export-report-btn"
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
