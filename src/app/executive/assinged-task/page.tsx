'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './ExecutiveTodoList.css';
import SubmitTaskModal from './SubmitTaskModal';

interface AssignedTask {
  id: string;
  storeName: string;
  storeDetails: {
    id: string;
    storeName: string;
    city: string;
    fullAddress: string | null;
    partnerBrandIds: string[];
  };
  issue: string;
  city: string;
  status: 'Assigned' | 'In_Progress' | 'Completed';
  hasReport: boolean;
  createdAt: string;
  assignedAt: string;
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

const ExecutiveTodoList: React.FC = () => {
  const router = useRouter();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch assigned tasks from API
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/executive/assigned-tasks', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // Handle different HTTP status codes
          if (response.status === 401) {
            setError('Authentication failed. Please login again.');
            // Optionally redirect to login
            // router.push('/auth/login');
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

    fetchTasks();
  }, []);

  const handleNavigateToDashboard = () => {
    router.push('/executive');
  };

  const handleNavigateToVisitHistory = () => {
    router.push('/executive/visit-history');
  };

  const handleNavigateToSettings = () => {
    router.push('/executive/settings');
  };

  const handleSubmitTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsSubmitModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsSubmitModalOpen(false);
    setSelectedTaskId(null);
  };

  const handleTaskSubmitted = () => {
    // Refresh the task list by re-fetching data
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/executive/assigned-tasks', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result: TasksResponse = await response.json();
          if (result.success) {
            setTasks(result.data.tasks);
          }
        }
      } catch (err) {
        console.error('Error refreshing tasks:', err);
      }
    };

    fetchTasks();
    handleCloseModal();
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

  return (
    <div className="executive-todo-container">
      {/* Header */}

      {/* Main Content */}
      <main>
        <div className="pending-tasks-section">
          <h2 className="section-title">Assigned Tasks</h2>
          <p className="section-subtitle">Complete your assigned store visits and reports</p>

          {/* Table */}
          <div className="table-container">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>STORE NAME</th>
                  <th>ISSUE</th>
                  <th>CITY</th>
                  <th className="action-header">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="loading-row">
                      Loading assigned tasks...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={4} className="error-row">
                      <div className="error-content">
                        <p>Error: {error}</p>
                        <button 
                          onClick={() => window.location.reload()} 
                          className="retry-button-small"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="no-tasks">
                      No assigned tasks
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => {
                    const displayStatus = task.status === 'Completed' || task.hasReport ? 'Submitted' : 'Pending';
                    const isPending = !task.hasReport && task.status !== 'Completed';
                    
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
                        <td className="city">{task.city}</td>
                        <td className="action-column">
                          <div className="action-content">
                            <span 
                              className={`status-badge ${displayStatus.toLowerCase()}`}
                            >
                              {displayStatus}
                            </span>
                            {isPending && (
                              <button 
                                className="view-task-btn"
                                onClick={() => handleSubmitTask(task.id)}
                              >
                                Submit Task
                              </button>
                            )}
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
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-navigation">
        <button className="nav-item" onClick={handleNavigateToDashboard}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>
        <button className="nav-item" onClick={handleNavigateToVisitHistory}>
          <span className="nav-icon">📋</span>
          <span className="nav-label">Visit History</span>
        </button>
        <button className="nav-item" onClick={handleNavigateToSettings}>
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">Settings</span>
        </button>
      </nav>
      
      {/* Submit Task Modal */}
      {isSubmitModalOpen && selectedTaskId && (
        <SubmitTaskModal
          isOpen={isSubmitModalOpen}
          onClose={handleCloseModal}
          taskId={parseInt(selectedTaskId)}
          storeName={tasks.find(t => t.id === selectedTaskId)?.storeName || ''}
          storeDetails={tasks.find(t => t.id === selectedTaskId)?.storeDetails}
          onTaskSubmitted={handleTaskSubmitted}
        />
      )}
    </div>
  );
};

export default ExecutiveTodoList;
