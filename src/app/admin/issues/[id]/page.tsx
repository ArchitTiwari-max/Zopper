'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IssueData, IssueComment } from '../../types';
import '../../styles.css';

// Mock data for issues
const mockIssueData: Record<number, IssueData> = {
  1322: {
    id: 1322,
    issueId: '#Issue_Id 1322',
    storeName: 'Lucky Electronics',
    storeId: 2,
    location: 'I-441, Govindpuram Ghaziabad, UP',
    brandAssociated: 'Philips',
    city: 'Ghaziabad',
    dateReported: '2025-08-20',
    reportedBy: 'Priya Gupta',
    reportedByRole: 'Executive',
    status: 'Pending',
    priority: 'High',
    category: 'Technical',
    description: 'WiFi connectivity issues affecting digital promotional displays. Customers unable to access interactive content and promotional offers. Network stability issues causing intermittent disconnections throughout the day.',
    assignmentHistory: [
      {
        id: 1,
        executiveId: 1,
        executiveName: 'Rajesh Kumar',
        executiveInitials: 'RK',
        dateAssigned: '2025-08-21',
        adminComment: 'Investigate network infrastructure and coordinate with IT team',
        status: 'Assigned',
        assignedBy: 'Admin'
      }
    ],
    comments: [
      {
        id: 1,
        authorId: 1,
        authorName: 'Admin User',
        authorRole: 'Admin',
        comment: 'Priority issue - WiFi connectivity affecting customer experience',
        createdAt: '2025-08-21T09:00:00Z'
      },
      {
        id: 2,
        authorId: 3,
        authorName: 'Priya Gupta',
        authorRole: 'Executive',
        comment: 'Store owner reports frequent disconnections during peak hours',
        createdAt: '2025-08-20T15:30:00Z'
      }
    ],
    relatedVisitId: 5,
    visitContext: {
      visitDate: '2025-08-20',
      executiveName: 'Priya Gupta',
      executiveInitials: 'PG',
      personMet: 'Mr. Kumar',
      personRole: 'Store Owner',
      feedback: 'Excellent product placement',
      photosCount: 5,
      displayChecked: true
    },
    createdAt: '2025-08-20T14:00:00Z',
    updatedAt: '2025-08-21T09:00:00Z'
  },
  1323: {
    id: 1323,
    issueId: '#Issue_Id 1323',
    storeName: 'Lucky Electronics',
    storeId: 2,
    location: 'I-441, Govindpuram Ghaziabad, UP',
    brandAssociated: 'Godrej',
    city: 'Ghaziabad',
    dateReported: '2025-08-01',
    reportedBy: 'Ramesh Kumar',
    reportedByRole: 'Executive',
    status: 'Pending',
    priority: 'Medium',
    category: 'Inventory',
    description: 'Store is completely out of promotional flyers and brochures for new product launches. Customer inquiries about product features cannot be properly addressed without marketing materials. Urgent restocking required.',
    assignmentHistory: [
      {
        id: 1,
        executiveId: 2,
        executiveName: 'Neha Sharma',
        executiveInitials: 'NS',
        dateAssigned: '2025-08-02',
        adminComment: 'Coordinate with marketing team for flyer restocking',
        status: 'In Progress',
        assignedBy: 'Admin'
      }
    ],
    comments: [
      {
        id: 1,
        authorId: 1,
        authorName: 'Admin User',
        authorRole: 'Admin',
        comment: 'Coordinating with marketing department for immediate flyer replenishment',
        createdAt: '2025-08-02T10:00:00Z'
      }
    ],
    relatedVisitId: 1,
    visitContext: {
      visitDate: '2025-08-01',
      executiveName: 'Ramesh Kumar',
      executiveInitials: 'RK',
      personMet: 'Mr. Kumar',
      personRole: 'Store Owner',
      feedback: 'Asked for new standee',
      photosCount: 2,
      displayChecked: true
    },
    createdAt: '2025-08-01T16:00:00Z',
    updatedAt: '2025-08-02T10:00:00Z'
  },
  1324: {
    id: 1324,
    issueId: '#Issue_Id 1324',
    storeName: 'Lucky Electronics',
    storeId: 2,
    location: 'I-441, Govindpuram Ghaziabad, UP',
    brandAssociated: 'Havells',
    city: 'Ghaziabad',
    dateReported: '2025-08-08',
    reportedBy: 'Sunita Yadav',
    reportedByRole: 'Executive',
    status: 'Pending',
    priority: 'High',
    category: 'Display',
    description: 'Customer requesting live product demonstration for new electrical appliances. Current display setup does not allow for proper product showcase. Need to arrange demo unit installation and training for store staff.',
    assignmentHistory: [
      {
        id: 1,
        executiveId: 3,
        executiveName: 'Priya Sharma',
        executiveInitials: 'PS',
        dateAssigned: '2025-08-09',
        adminComment: 'Arrange demo unit setup and staff training session',
        status: 'Assigned',
        assignedBy: 'Admin'
      }
    ],
    comments: [
      {
        id: 1,
        authorId: 1,
        authorName: 'Admin User',
        authorRole: 'Admin',
        comment: 'Demo unit request approved. Coordinating with product team.',
        createdAt: '2025-08-09T11:15:00Z'
      }
    ],
    relatedVisitId: 3,
    visitContext: {
      visitDate: '2025-08-08',
      executiveName: 'Sunita Yadav',
      executiveInitials: 'SY',
      personMet: 'Mr. Kumar',
      personRole: 'Store Owner',
      feedback: 'Need better product visibility',
      photosCount: 2,
      displayChecked: false
    },
    createdAt: '2025-08-08T17:30:00Z',
    updatedAt: '2025-08-09T11:15:00Z'
  },
  1325: {
    id: 1325,
    issueId: '#Issue_Id 1325',
    storeName: 'Lucky Electronics',
    storeId: 2,
    location: 'I-441, Govindpuram Ghaziabad, UP',
    brandAssociated: 'Godrej',
    city: 'Ghaziabad',
    dateReported: '2025-08-12',
    reportedBy: 'Rajesh Singh',
    reportedByRole: 'Executive',
    status: 'Pending',
    priority: 'Medium',
    category: 'Inventory',
    description: 'Product shelf positioned too low for customer visibility. Popular items are not easily accessible to customers, affecting sales potential. Shelf reorganization and height adjustment required for better product exposure.',
    assignmentHistory: [
      {
        id: 1,
        executiveId: 5,
        executiveName: 'Amit Verma',
        executiveInitials: 'AV',
        dateAssigned: '2025-08-13',
        adminComment: 'Assess current shelf layout and recommend improvements',
        status: 'Assigned',
        assignedBy: 'Admin'
      }
    ],
    comments: [
      {
        id: 1,
        authorId: 1,
        authorName: 'Admin User',
        authorRole: 'Admin',
        comment: 'Shelf optimization needed to improve product visibility and accessibility',
        createdAt: '2025-08-13T09:45:00Z'
      }
    ],
    relatedVisitId: 4,
    visitContext: {
      visitDate: '2025-08-12',
      executiveName: 'Rajesh Singh',
      executiveInitials: 'RS',
      personMet: 'Mr. Kumar',
      personRole: 'Store Owner',
      feedback: 'Satisfied with service',
      photosCount: 0,
      displayChecked: true
    },
    createdAt: '2025-08-12T18:00:00Z',
    updatedAt: '2025-08-13T09:45:00Z'
  },
  1326: {
    id: 1326,
    issueId: '#Issue_Id 1326',
    storeName: 'Lucky Electronics',
    storeId: 2,
    location: 'I-441, Govindpuram Ghaziabad, UP',
    brandAssociated: 'Philips',
    city: 'Ghaziabad',
    dateReported: '2025-08-08',
    reportedBy: 'Amit Verma',
    reportedByRole: 'Executive',
    status: 'Pending',
    priority: 'Medium',
    category: 'Display',
    description: 'Multiple products displayed without proper price tags or product information labels. Customers unable to identify prices and specifications, leading to confusion and potential sales loss. Complete price tag update required.',
    assignmentHistory: [
      {
        id: 1,
        executiveId: 4,
        executiveName: 'Sunita Yadav',
        executiveInitials: 'SY',
        dateAssigned: '2025-08-09',
        adminComment: 'Provide updated price tags and ensure proper labeling',
        status: 'In Progress',
        assignedBy: 'Admin'
      }
    ],
    comments: [
      {
        id: 1,
        authorId: 1,
        authorName: 'Admin User',
        authorRole: 'Admin',
        comment: 'Updated price list being prepared. Installation scheduled for next visit.',
        createdAt: '2025-08-09T14:20:00Z'
      }
    ],
    relatedVisitId: 6,
    visitContext: {
      visitDate: '2025-08-08',
      executiveName: 'Amit Verma',
      executiveInitials: 'AV',
      personMet: 'Mr. Kumar',
      personRole: 'Store Owner',
      feedback: 'Needs promotional materials',
      photosCount: 1,
      displayChecked: false
    },
    createdAt: '2025-08-08T19:15:00Z',
    updatedAt: '2025-08-09T14:20:00Z'
  }
};

// Mock executive data for assignment
const mockExecutives = [
  { id: 1, name: 'Rajesh Kumar', initials: 'RK' },
  { id: 2, name: 'Neha Sharma', initials: 'NS' },
  { id: 3, name: 'Priya Singh', initials: 'PS' },
  { id: 4, name: 'Sunita Yadav', initials: 'SY' },
  { id: 5, name: 'Ankit Verma', initials: 'AV' }
];

const IssueDetailPage: React.FC = () => {
  const params = useParams();
  const issueId = parseInt(params.id as string);
  
  const [issueData, setIssueData] = useState<IssueData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [newComment, setNewComment] = useState<string>('');
  const [selectedExecutive, setSelectedExecutive] = useState<string>('');
  const [showStoreDetails, setShowStoreDetails] = useState<boolean>(false);
  const [showVisitContext, setShowVisitContext] = useState<boolean>(false);

  // Load issue data
  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      const data = mockIssueData[issueId];
      setIssueData(data || null);
      setIsLoading(false);
    }, 500);
  }, [issueId]);

  const handleAddComment = () => {
    if (!issueData || !newComment.trim()) return;

    const comment: IssueComment = {
      id: issueData.comments.length + 1,
      authorId: 0,
      authorName: 'Admin User',
      authorRole: 'Admin',
      comment: newComment.trim(),
      createdAt: new Date().toISOString()
    };

    setIssueData({
      ...issueData,
      comments: [...issueData.comments, comment],
      updatedAt: new Date().toISOString()
    });
    
    setNewComment('');
  };

  const handleSendTask = () => {
    if (!issueData || !selectedExecutive) return;

    const executive = mockExecutives.find(exec => exec.id.toString() === selectedExecutive);
    if (!executive) return;

    console.log(`Sending task to ${executive.name} for issue ${issueData.issueId}`);
  };

  const handleMarkSolved = () => {
    if (!issueData) return;

    setIssueData({
      ...issueData,
      status: 'Resolved',
      resolvedBy: 'Admin User',
      resolvedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log(`Issue ${issueData.issueId} marked as resolved`);
  };

  const handleExportReport = () => {
    if (!issueData) return;
    console.log(`Exporting report for issue ${issueData.issueId}`);
  };

  const getPriorityColor = (priority: string): string => {
    const colors: Record<string, string> = {
      'Low': '#10b981',
      'Medium': '#f59e0b',
      'High': '#ef4444',
      'Critical': '#dc2626'
    };
    return colors[priority] || '#64748b';
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
      {/* <div className="issue-management-header">
        <div className="back-navigation">
          <Link href="/admin/issues" className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back to Issues
          </Link>
        </div>
      </div> */}

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
                        <button className="view-report-btn" type="button">
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
                {mockExecutives.map(executive => (
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
                disabled={!selectedExecutive}
                type="button"
              >
                Send Task
              </button>
              <button 
                className="mark-solved-btn"
                onClick={handleMarkSolved}
                type="button"
              >
                Mark as Solved
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
    </div>
  );
};

export default IssueDetailPage;
