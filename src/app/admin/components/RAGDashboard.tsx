'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  RAGSummary, 
  RAGInsight
} from '@/lib/ragUtils';

interface RAGAnalyticsResponse {
  success: boolean;
  data: {
    summary: RAGSummary;
    insights: RAGInsight[];
    metadata: {
      dateRange: string;
      storeTypeFilter: string;
      ragFilter: string;
      totalStoresAnalyzed: number;
      filteredCount: number;
    };
  };
  error?: string;
}

const AdminRAGDashboard: React.FC = () => {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<RAGAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    dateRange: '7days',
    storeType: 'all',
    ragFilter: 'all'
  });

  const fetchRAGData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        dateRange: filters.dateRange,
        storeType: filters.storeType,
        ragFilter: filters.ragFilter
      });

      const response = await fetch(`/api/admin/rag-analytics?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: RAGAnalyticsResponse = await response.json();
      
      if (data.success) {
        setAnalytics(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch RAG data');
      }
    } catch (err) {
      console.error('Error fetching RAG data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch RAG data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRAGData();
  }, [filters]);

  const handleFilterChange = (filterType: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  // Navigation functions for clickable cards
  const navigateToPerformancePage = (ragFilter?: string, storeType?: string) => {
    const params = new URLSearchParams({
      dateRange: filters.dateRange,
      storeType: storeType || filters.storeType,
      ragFilter: ragFilter || filters.ragFilter
    });
    router.push(`/admin/rag-performance?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="rag-dashboard">
        <div className="rag-dashboard-header">
          <h2>RAG Store Performance Analytics</h2>
          <p>Analyzing attach rate performance across all stores...</p>
        </div>
        <div className="rag-loading">
          <div className="loading-spinner-large"></div>
          <span>Loading RAG analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rag-dashboard">
        <div className="rag-dashboard-header">
          <h2>RAG Store Performance Analytics</h2>
        </div>
        <div className="rag-error">
          <span className="error-message">Error: {error}</span>
          <button onClick={fetchRAGData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics?.data) {
    return (
      <div className="rag-dashboard">
        <div className="rag-dashboard-header">
          <h2>RAG Store Performance Analytics</h2>
        </div>
        <div className="rag-no-data">
          <span>No RAG data available</span>
        </div>
      </div>
    );
  }

  const { summary, insights, metadata } = analytics.data;

  return (
    <div className="rag-dashboard">
      {/* Header with Filters */}
      <div className="rag-dashboard-header">
        <div className="rag-title-section">
          <h2>RAG Store Performance Analytics</h2>
          <p>Real-time attach rate performance classification</p>
        </div>
        
      </div>

      {/* Summary Cards - All Clickable */}
      <div className="rag-summary-grid">
        <div 
          className="rag-summary-card rag-summary-clickable" 
          onClick={() => navigateToPerformancePage()}
          role="button"
          tabIndex={0}
        >
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <h3>Total Stores</h3>
            <div className="summary-value">{summary.totalStores}</div>
            <div className="summary-description">Stores analyzed</div>
          </div>
        </div>

        <div 
          className="rag-summary-card rag-summary-green rag-summary-clickable" 
          onClick={() => navigateToPerformancePage('green')}
          role="button"
          tabIndex={0}
        >
          <div className="summary-icon">🟢</div>
          <div className="summary-content">
            <h3>Green Performance</h3>
            <div className="summary-value">{summary.greenStores}</div>
            <div className="summary-description">Exceeding targets</div>
          </div>
        </div>

        <div 
          className="rag-summary-card rag-summary-amber rag-summary-clickable" 
          onClick={() => navigateToPerformancePage('amber')}
          role="button"
          tabIndex={0}
        >
          <div className="summary-icon">🟡</div>
          <div className="summary-content">
            <h3>Amber Performance</h3>
            <div className="summary-value">{summary.amberStores}</div>
            <div className="summary-description">Needs attention</div>
          </div>
        </div>

        <div 
          className="rag-summary-card rag-summary-red rag-summary-clickable" 
          onClick={() => navigateToPerformancePage('red')}
          role="button"
          tabIndex={0}
        >
          <div className="summary-icon">🔴</div>
          <div className="summary-content">
            <h3>Red Performance</h3>
            <div className="summary-value">{summary.redStores}</div>
            <div className="summary-description">Action required</div>
          </div>
        </div>

        <div 
          className="rag-summary-card rag-summary-clickable" 
          onClick={() => navigateToPerformancePage()}
          role="button"
          tabIndex={0}
        >
          <div className="summary-icon">📈</div>
          <div className="summary-content">
            <h3>Average Attach Rate</h3>
            <div className="summary-value">{summary.averageAttachRate}%</div>
            <div className="summary-description">Across all stores</div>
          </div>
        </div>

        <div 
          className="rag-summary-card rag-summary-clickable" 
          onClick={() => navigateToPerformancePage()}
          role="button"
          tabIndex={0}
        >
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <h3>Trending Up</h3>
            <div className="summary-value">{summary.improvementStores}</div>
            <div className="summary-description">Improving stores</div>
          </div>
        </div>
      </div>

      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="rag-insights-section">
          <h3>Key Insights</h3>
          <div className="rag-insights-grid">
            {insights.map((insight, index) => (
              <div key={index} className={`rag-insight rag-insight-${insight.type}`}>
                <div className="insight-header">
                  <span className="insight-title">{insight.title}</span>
                  {insight.storeCount && (
                    <span className="insight-count">{insight.storeCount}</span>
                  )}
                </div>
                <p className="insight-message">{insight.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminRAGDashboard;