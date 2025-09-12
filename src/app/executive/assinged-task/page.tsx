'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './ExecutiveTodoList.css';
import SubmitTaskModal from './SubmitTaskModal';
import TaskDetailModal from './components/TaskDetailModal';
import ViewReportModal from './components/ViewReportModal';
import IssuesTab from './tabs/IssuesTab';
import VisitsTab from './tabs/VisitsTab';
import TrainingTab from './tabs/TrainingTab';

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

type TaskCategory = 'visit' | 'issues' | 'training';

const ExecutiveTodoList: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TaskCategory>('issues');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Navigation handlers removed - handled by layout Footer component

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


  // Task Detail Modal handlers
  const handleViewDetails = (task: AssignedTask) => {
    setTaskDetailModal({ isOpen: true, task });
  };

  const handleCloseTaskDetail = () => {
    setTaskDetailModal({ isOpen: false, task: null });
  };

  // View Report Modal handlers
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

  // Calculate pending tasks count
  const pendingTasksCount = tasks.filter(task => 
    !task.hasReport && task.status !== 'Completed'
  ).length;

  // Retry handler
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="executive-todo-container">
      {/* Header */}

      {/* Main Content */}
      <main>
        <div className="pending-tasks-section">
          <div className="task-header">
            <div className="task-title-section">
              <h1 className="task-title">Assigned Tasks</h1>
              <p className="task-subtitle">Complete your assigned tasks across different categories</p>
            </div>
          </div>

          {/* Task Tabs */}
          <div className="task-tabs">
            <button 
              className={`tab-btn ${activeTab === 'visit' ? 'active' : ''}`}
              onClick={() => setActiveTab('visit')}
            >
              <span className="tab-icon">🏪</span>
              <span className="tab-label">Pending Visits</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`}
              onClick={() => setActiveTab('issues')}
            >
              <span className="tab-icon">⚠️</span>
              <span className="tab-label">
                Pending Issues
                {pendingTasksCount > 0 && (
                  <span className="tab-count">({pendingTasksCount})</span>
                )}
              </span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'training' ? 'active' : ''}`}
              onClick={() => setActiveTab('training')}
            >
              <span className="tab-icon">📚</span>
              <span className="tab-label">Training Tasks</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'visit' && (
              <VisitsTab />
            )}

            {activeTab === 'issues' && (
              <IssuesTab
                tasks={tasks}
                loading={loading}
                error={error}
                onViewDetails={handleViewDetails}
                onRetry={handleRetry}
              />
            )}

            {activeTab === 'training' && (
              <TrainingTab />
            )}
          </div>
        </div>
      </main>

      {/* Bottom Navigation is handled by the layout Footer component */}
      
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

export default ExecutiveTodoList;
