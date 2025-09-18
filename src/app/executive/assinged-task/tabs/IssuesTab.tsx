'use client';

import React, { useState, useEffect } from 'react';
import SubmitTaskModal from '../SubmitTaskModal';
import TaskDetailModal from '../components/TaskDetailModal';
import ViewReportModal from '../components/ViewReportModal';

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

interface TasksResponse {
  success: boolean;
  data: {
    tasks: AssignedTask[];
    totalTasks: number;
    pendingTasks: number;
    completedTasks: number;
  };
  error?: string;
}

interface IssuesTabProps {
  onCountUpdate?: () => void;
}

const IssuesTab: React.FC<IssuesTabProps> = ({ onCountUpdate }) => {
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  
  // Modal states
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetailModal, setTaskDetailModal] = useState<{
    isOpen: boolean;
    task: any;
  }>({ isOpen: false, task: null });
  const [viewReportModal, setViewReportModal] = useState<{
    isOpen: boolean;
    taskId: string;
    storeName: string;
  }>({ isOpen: false, taskId: '', storeName: '' });

  // Fetch assigned tasks from API
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async (bustCache = false) => {
    try {
      setLoading(true);
      // Add timestamp to URL to bust cache when needed
      const url = bustCache 
        ? `/api/executive/assigned-tasks/pending-issue?t=${Date.now()}`
        : '/api/executive/assigned-tasks/pending-issue';
        
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication failed. Please login again.');
          return;
        } else if (response.status === 403) {
          setError('Access denied. Executive role required.');
          return;
        } else if (response.status === 404) {
          setError('Executive profile not found.');
          return;
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      const result: TasksResponse = await response.json();
      
      if (result.success) {
        setTasks(result.data.tasks || []);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch tasks');
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  // Modal handlers
  const handleSubmitTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsSubmitModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsSubmitModalOpen(false);
    setSelectedTaskId(null);
  };

  const handleTaskSubmitted = async () => {
    try {
      // Wait a moment for database to update, then refresh data with cache busting
      setTimeout(async () => {
        await fetchTasks(true); // true = bust cache
        if (onCountUpdate) onCountUpdate(); // Update counts in parent
      }, 1000);
    } catch (error) {
      console.error('Error refreshing tasks after submission:', error);
    }
    handleCloseModal();
  };

  const handleViewDetails = (task: AssignedTask) => {
    setTaskDetailModal({ isOpen: true, task });
  };

  const handleCloseTaskDetail = () => {
    setTaskDetailModal({ isOpen: false, task: null });
  };

  const handleViewReport = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setViewReportModal({
        isOpen: true,
        taskId,
        storeName: task.storeName
      });
    }
  };

  const handleCloseViewReport = () => {
    setViewReportModal({ isOpen: false, taskId: '', storeName: '' });
  };

  const handleRetry = () => {
    fetchTasks(true); // Use cache busting for retry
  };

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
    <div className="exec-tasks-issues-panel">
      {loading ? (
        <div className="exec-tasks-issues-loading">
          <div className="exec-tasks-issues-loading-spinner"></div>
          <span className="exec-tasks-issues-loading-text">Loading assigned tasks...</span>
        </div>
      ) : error ? (
        <div className="exec-tasks-issues-error">
          <div className="exec-tasks-issues-error-title">Error</div>
          <div>{error}</div>
          <button 
            onClick={handleRetry} 
            className="exec-tasks-issues-retry-btn"
          >
            Retry
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="exec-tasks-issues-empty">
          <div className="exec-tasks-issues-empty-icon">⚠️</div>
          <h3 className="exec-tasks-issues-empty-title">No Pending Issues</h3>
          <p className="exec-tasks-issues-empty-text">
            You don't have any pending issue assignments at the moment.
            Check back later for new assignments.
          </p>
        </div>
      ) : (
        <div className="exec-tasks-issues-table-container">
          <table className="exec-tasks-issues-table">
            <thead>
              <tr>
                <th>STORE NAME</th>
                <th>ISSUE</th>
                <th>ADMIN COMMENT</th>
                <th>CITY</th>
                <th className="exec-tasks-issues-action-header">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const displayStatus = task.status === 'Completed' || task.hasReport ? 'Submitted' : 'Pending';
                
                return (
                  <tr key={task.id} className={expandedIssues.has(task.id) ? 'exec-tasks-issues-expanded-row' : ''}>
                    <td className="exec-tasks-issues-stores-name">{task.storeName}</td>
                    <td className="exec-tasks-issues-issue">
                      <div className="exec-tasks-issues-issue-container">
                        <span 
                          className={`exec-tasks-issues-issue-text ${task.issue.length > 50 ? 'exec-tasks-issues-expandable' : ''}`}
                          onClick={() => task.issue.length > 50 ? toggleIssueExpansion(task.id) : null}
                        >
                          {expandedIssues.has(task.id) ? task.issue : truncateText(task.issue, 50)}
                        </span>
                      </div>
                    </td>
                    <td className="exec-tasks-issues-admin-comment">
                      <span 
                        className={`exec-tasks-issues-admin-comment-text ${task.adminComment && task.adminComment.length > 30 ? 'exec-tasks-issues-truncated' : ''}`}
                        title={task.adminComment || ''}
                      >
                        {truncateAdminComment(task.adminComment, 30)}
                      </span>
                    </td>
                    <td className="exec-tasks-issues-city">{task.city}</td>
                    <td className="exec-tasks-issues-action-column">
                      <div className="exec-tasks-issues-action-content">
                        <span 
                          className={`exec-tasks-issues-status-badge ${displayStatus.toLowerCase()}`}
                        >
                          {displayStatus}
                        </span>
                        {displayStatus === 'Pending' ? (
                          <button 
                            className="exec-tasks-issues-view-details-btn"
                            onClick={() => handleViewDetails(task)}
                          >
                            View Details
                          </button>
                        ) : (
                          <button 
                            className="exec-tasks-issues-view-report-btn"
                            onClick={() => handleViewReport(task.id)}
                          >
                            View Report
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Submit Task Modal */}
      {isSubmitModalOpen && selectedTaskId && (
        <SubmitTaskModal
          isOpen={isSubmitModalOpen}
          onClose={handleCloseModal}
          taskId={selectedTaskId}
          storeName={tasks.find(t => t.id === selectedTaskId)?.storeName || ''}
          storeDetails={tasks.find(t => t.id === selectedTaskId)?.storeDetails}
          onTaskSubmitted={handleTaskSubmitted}
        />
      )}

      {/* Task Detail Modal */}
      {taskDetailModal.isOpen && taskDetailModal.task && (
        <TaskDetailModal
          isOpen={taskDetailModal.isOpen}
          onClose={handleCloseTaskDetail}
          task={taskDetailModal.task}
          onSubmitTask={handleSubmitTask}
          onViewReport={handleViewReport}
        />
      )}

      {/* View Report Modal */}
      {viewReportModal.isOpen && (
        <ViewReportModal
          isOpen={viewReportModal.isOpen}
          onClose={handleCloseViewReport}
          taskId={viewReportModal.taskId}
          storeName={viewReportModal.storeName}
        />
      )}
    </div>
  );
};

export default IssuesTab;
