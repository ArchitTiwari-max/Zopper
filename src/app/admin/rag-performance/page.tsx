'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import './page.css';
import { 
  RAGStorePerformance, 
  RAGSummary, 
  RAGInsight, 
  getRAGColor, 
  getRAGBackgroundColor,
  getRAGEmoji,
  formatStoreType,
  getPerformanceMessage,
  getPerformanceMessageWithContext,
  getTrendMessage,
  getPriorityLevel
} from '@/lib/ragUtils';

interface RAGAnalyticsResponse {
  success: boolean;
  data: {
    performances: RAGStorePerformance[];
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

const RAGPerformancePage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get initial filters from URL parameters
  const [analytics, setAnalytics] = useState<RAGAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    dateRange: searchParams.get('dateRange') || '7days',
    storeType: searchParams.get('storeType') || 'all',
    ragFilter: searchParams.get('ragFilter') || 'all'
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

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams({
      dateRange: filters.dateRange,
      storeType: filters.storeType,
      ragFilter: filters.ragFilter
    });
    
    // Update URL without triggering a page reload
    window.history.replaceState(null, '', `/admin/rag-performance?${params.toString()}`);
  }, [filters]);

  const handleFilterChange = (filterType: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  if (loading) {
    return (
      <div className="rag-performance-page">
        <div className="rag-page-header">
          <div className="rag-breadcrumb">
            <Link href="/admin/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-separator">›</span>
            <span>Store Performance</span>
          </div>
          <h1>RAG Store Performance Details</h1>
          <p>Loading detailed store performance analytics...</p>
        </div>
        <div className="rag-loading">
          <div className="loading-spinner-large"></div>
          <span>Loading performance data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rag-performance-page">
        <div className="rag-page-header">
          <div className="rag-breadcrumb">
            <Link href="/admin/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-separator">›</span>
            <span>Store Performance</span>
          </div>
          <h1>RAG Store Performance Details</h1>
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
      <div className="rag-performance-page">
        <div className="rag-page-header">
          <h1>RAG Store Performance Details</h1>
        </div>
        <div className="rag-no-data">
          <span>No RAG data available</span>
        </div>
      </div>
    );
  }

  const { performances, summary, insights, metadata } = analytics.data;

  return (
    <div className="rag-performance-page">
      {/* Page Header */}
      <div className="rag-page-header">
        <div className="rag-breadcrumb">
          <Link href="/admin/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-separator">›</span>
          <span>Store Performance</span>
        </div>
        <div className="rag-page-title-section">
          <h1>RAG Store Performance Details</h1>
          <p>Detailed attach rate performance analysis and classification</p>
        </div>
        
        <div className="rag-page-filters">
          <select 
            value={filters.dateRange} 
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="rag-filter-select"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="current-month">Current Month</option>
          </select>

          <select 
            value={filters.storeType} 
            onChange={(e) => handleFilterChange('storeType', e.target.value)}
            className="rag-filter-select"
          >
            <option value="all">All Store Types</option>
            <option value="A_PLUS">A+ Stores</option>
            <option value="A">A Stores</option>
            <option value="B">B Stores</option>
            <option value="C">C Stores</option>
            <option value="D">D Stores</option>
          </select>

          <select 
            value={filters.ragFilter} 
            onChange={(e) => handleFilterChange('ragFilter', e.target.value)}
            className="rag-filter-select"
          >
            <option value="all">All Performance</option>
            <option value="green">🟢 Green</option>
            <option value="amber">🟡 Amber</option>
            <option value="red">🔴 Red</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="rag-page-summary">
        <div className="summary-stat">
          <span className="stat-label">Total Analyzed</span>
          <span className="stat-value">{metadata.totalStoresAnalyzed}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Filtered Results</span>
          <span className="stat-value">{metadata.filteredCount}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Average Attach Rate</span>
          <span className="stat-value">{summary.averageAttachRate}%</span>
        </div>
        <div className="summary-stat summary-green">
          <span className="stat-label">🟢 Green</span>
          <span className="stat-value">{summary.greenStores}</span>
        </div>
        <div className="summary-stat summary-amber">
          <span className="stat-label">🟡 Amber</span>
          <span className="stat-value">{summary.amberStores}</span>
        </div>
        <div className="summary-stat summary-red">
          <span className="stat-label">🔴 Red</span>
          <span className="stat-value">{summary.redStores}</span>
        </div>
      </div>

      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="rag-page-insights">
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

      {/* Performance Table */}
      <div className="rag-performance-section">
        <div className="rag-section-header">
          <h3>Store Performance Details</h3>
          <span className="performance-count">
            Showing {performances.length} store{performances.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="rag-performance-table">
          <div className="rag-table-header">
            <div className="rag-header-cell">Store</div>
            <div className="rag-header-cell">Type</div>
            <div className="rag-header-cell">Attach Rate</div>
            <div className="rag-header-cell">Performance</div>
            <div className="rag-header-cell">Trend</div>
            <div className="rag-header-cell">Sales (7 Days)</div>
            <div className="rag-header-cell">Priority</div>
          </div>

          <div className="rag-table-body">
            {performances.length > 0 ? (
              performances.map((performance) => {
                const priority = getPriorityLevel(performance.attachRAG, performance.monthlyTrendRAG);
                return (
                  <div key={performance.storeId} className="rag-table-row">
                    <div className="rag-cell rag-store-info">
                      <div className="store-name">{performance.storeName}</div>
                      <div className="store-city">{performance.city}</div>
                    </div>
                    
                    <div className="rag-cell">
                      <span className="store-type-badge">
                        {formatStoreType(performance.storeType)}
                      </span>
                    </div>
                    
                    <div className="rag-cell">
                      <div className="attach-rate-display">
                        <span className="attach-rate-value">{performance.attachRate}%</span>
                        <span className="attach-rate-comparison">
                          {performance.previousMonthAttach > 0 && (
                            <>
                              {performance.attachRate > performance.previousMonthAttach ? '↗' : 
                               performance.attachRate < performance.previousMonthAttach ? '↘' : '→'}
                              {Math.abs(performance.attachRate - performance.previousMonthAttach).toFixed(1)}%
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <div className="rag-cell">
                      <span 
                        className="rag-status-badge"
                        style={{ 
                          backgroundColor: getRAGBackgroundColor(performance.attachRAG),
                          color: getRAGColor(performance.attachRAG)
                        }}
                      >
                        {getRAGEmoji(performance.attachRAG)} {performance.attachRAG}
                      </span>
                      <div className="performance-message">
                        {getPerformanceMessageWithContext(performance.storeType, performance.attachRate, performance.previousMonthAttach)}
                      </div>
                    </div>
                    
                    <div className="rag-cell">
                      <span 
                        className="rag-trend-badge"
                        style={{ 
                          backgroundColor: getRAGBackgroundColor(performance.monthlyTrendRAG),
                          color: getRAGColor(performance.monthlyTrendRAG)
                        }}
                      >
                        {getRAGEmoji(performance.monthlyTrendRAG)} {getTrendMessage(performance.monthlyTrendRAG)}
                      </span>
                    </div>
                    
                    <div className="rag-cell rag-sales-info">
                      <div className="sales-line">
                        Plans: <strong>{performance.planSales}</strong>
                      </div>
                      <div className="sales-line">
                        Devices: <strong>{performance.deviceSales}</strong>
                      </div>
                      <div className="sales-revenue">
                        ₹{(performance.totalRevenue || 0).toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="rag-cell">
                      <span className={`priority-badge priority-${priority.toLowerCase()}`}>
                        {priority}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rag-no-results">
                <span>No stores match the selected filters</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RAGPerformancePage;