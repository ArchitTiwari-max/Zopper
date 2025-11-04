'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './ExecutiveTodoList.css';
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

interface CountsResponse {
  success: boolean;
  data: {
    pendingIssuesCount: number;
    pendingVisitsCount: number;
    totalPendingCount: number;
    executiveId: string;
    timestamp: string;
  };
  error?: string;
}

type TaskCategory = 'visit' | 'issues' | 'training';

const ExecutiveTodoList: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get tab from URL query parameter, default to 'visit'
  const getInitialTab = (): TaskCategory => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'visit' || tabParam === 'issues' || tabParam === 'training') {
      return tabParam as TaskCategory;
    }
    return 'visit'; // Default to 'visit' instead of 'issues'
  };
  
  const [activeTab, setActiveTab] = useState<TaskCategory>(getInitialTab());
  const [visitCount, setVisitCount] = useState<number>(0);
  const [issueCount, setIssueCount] = useState<number>(0);

  // Fetch counts from unified API
  const fetchCounts = async () => {
    try {
      const response = await fetch('/api/executive/assigned-tasks/count', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result: CountsResponse = await response.json();
        if (result.success) {
          setVisitCount(result.data.pendingVisitsCount);
          setIssueCount(result.data.pendingIssuesCount);
        }
      }
    } catch (err) {
      console.error('Error fetching counts:', err);
    }
  };

  // Fetch counts on component mount
  useEffect(() => {
    fetchCounts();
  }, []);

  // Update tab when URL parameters change
  useEffect(() => {
    const newTab = getInitialTab();
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [searchParams]);

  // Update URL when tab changes
  useEffect(() => {
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('tab', activeTab);
    const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeTab]);

  // Navigation handlers removed - handled by layout Footer component

  // Refresh counts when tasks are updated (called by tabs)
  const refreshCounts = () => {
    fetchCounts();
  };
  return (
    <div className="exec-tasks-container">
      {/* Header */}

      {/* Main Content */}
      <main>
        <div className="exec-tasks-section">
          <div className="exec-tasks-header">
            <div className="exec-tasks-title-section">
              <h1 className="exec-tasks-title">Pending Tasks</h1>
              <p className="exec-tasks-subtitle">Complete your pending tasks across different categories</p>
            </div>
          </div>

          {/* Task Tabs */}
          <div className="exec-tasks-tabs">
            <button 
              className={`exec-tasks-tab-btn ${activeTab === 'visit' ? 'active' : ''}`}
              onClick={() => setActiveTab('visit')}
            >
              <span className="exec-tasks-tab-icon">🏪</span>
              <span className="exec-tasks-tab-label">
                Pending Visits
                {visitCount > 0 && (
                  <span className="exec-tasks-tab-count">({visitCount})</span>
                )}
              </span>
            </button>
            <button 
              className={`exec-tasks-tab-btn ${activeTab === 'issues' ? 'active' : ''}`}
              onClick={() => setActiveTab('issues')}
            >
              <span className="exec-tasks-tab-icon">⚠️</span>
              <span className="exec-tasks-tab-label">
                Pending Issues
                {issueCount > 0 && (
                  <span className="exec-tasks-tab-count">({issueCount})</span>
                )}
              </span>
            </button>
            <button 
              className={`exec-tasks-tab-btn ${activeTab === 'training' ? 'active' : ''}`}
              onClick={() => setActiveTab('training')}
            >
              <span className="exec-tasks-tab-icon">📚</span>
              <span className="exec-tasks-tab-label">Training Tasks</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="exec-tasks-tab-content">
            {activeTab === 'visit' && (
              <VisitsTab onCountUpdate={refreshCounts} />
            )}

            {activeTab === 'issues' && (
              <IssuesTab onCountUpdate={refreshCounts} />
            )}

            {activeTab === 'training' && (
              <TrainingTab />
            )}
          </div>
        </div>
      </main>

      {/* Bottom Navigation is handled by the layout Footer component */}
    </div>
  );
};

export default ExecutiveTodoList;
