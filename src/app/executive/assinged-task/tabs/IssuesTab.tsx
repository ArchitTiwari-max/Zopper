'use client';

import React, { useState } from 'react';

interface StoreDetails {
  id: string;
  storeName: string;
  city: string;
  fullAddress: string | null;
  partnerBrandIds: string[];
}

interface AssignedTask {
  id: string;
  storeName: string;
  storeDetails: StoreDetails;
  issue: string;
  city: string;
  status: 'Assigned' | 'In_Progress' | 'Completed';
  hasReport: boolean;
  createdAt: string;
  assignedAt: string;
  adminComment?: string;
  issueId: string;
  visitId: string;
  storeId: string;
}

interface IssuesTabProps {
  tasks: AssignedTask[];
  loading: boolean;
  error: string | null;
  onViewDetails: (task: AssignedTask) => void;
  onRetry: () => void;
}

const IssuesTab: React.FC<IssuesTabProps> = ({
  tasks,
  loading,
  error,
  onViewDetails,
  onRetry
}) => {
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const toggleIssueExpansion = (taskId: string) => {
    setExpandedIssues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const truncateAdminComment = (text: string | undefined, maxLength: number = 30) => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="tab-panel">
      <div className="table-container">
        <table className="tasks-table">
          <thead>
            <tr>
              <th>STORE NAME</th>
              <th>ISSUE</th>
              <th>ADMIN COMMENT</th>
              <th>CITY</th>
              <th className="action-header">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>
                  <div className="loading-state">
                    <div className="loading-spinner-large"></div>
                    <span className="loading-text">Loading assigned tasks...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5}>
                  <div className="error-state">
                    <p>Error: {error}</p>
                    <button 
                      onClick={onRetry} 
                      className="retry-btn"
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="no-data-state">
                    <span>No assigned issues</span>
                  </div>
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const displayStatus = task.status === 'Completed' || task.hasReport ? 'Submitted' : 'Pending';
                
                return (
                  <tr key={task.id} className={expandedIssues.has(task.id) ? 'expanded-row' : ''}>
                    <td className="store-name">{task.storeName}</td>
                    <td className="issue">
                      <div className="issue-container">
                        <span 
                          className={`issue-text ${task.issue.length > 50 ? 'expandable' : ''}`}
                          onClick={() => task.issue.length > 50 ? toggleIssueExpansion(task.id) : null}
                        >
                          {expandedIssues.has(task.id) ? task.issue : truncateText(task.issue, 50)}
                        </span>
                      </div>
                    </td>
                    <td className="admin-comment">
                      <span 
                        className={`admin-comment-text ${task.adminComment && task.adminComment.length > 30 ? 'truncated' : ''}`}
                        title={task.adminComment || ''}
                      >
                        {truncateAdminComment(task.adminComment, 30)}
                      </span>
                    </td>
                    <td className="city">{task.city}</td>
                    <td className="action-column">
                      <div className="action-content">
                        <span 
                          className={`status-badge ${displayStatus.toLowerCase()}`}
                        >
                          {displayStatus}
                        </span>
                        <button 
                          className="view-details-btn"
                          onClick={() => onViewDetails(task)}
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IssuesTab;
