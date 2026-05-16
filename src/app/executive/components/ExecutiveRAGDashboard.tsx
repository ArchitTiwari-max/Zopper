'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  RAGSummary, 
  RAGInsight
} from '@/lib/ragUtils';

interface ExecutiveRAGAnalyticsResponse {
  success: boolean;
  data: {
    summary: RAGSummary;
    insights: RAGInsight[];
    metadata: {
      executiveId: string;
      dateRange: string;
      ragFilter: string;
      totalAssignedStores: number;
      filteredCount: number;
    };
  };
  error?: string;
}

const ExecutiveRAGDashboard: React.FC = () => {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<ExecutiveRAGAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    dateRange: '7days',
    ragFilter: 'all',
    brandFilter: 'all'
  });

  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  // Fetch available brands for this executive
  useEffect(() => {
    fetch('/api/executive/brands', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBrands(d.data.map((b: any) => ({ id: b.id, name: b.brandName })));
        }
      })
      .catch(err => console.error('Error fetching brands:', err));
  }, []);

  const fetchRAGData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        dateRange: filters.dateRange,
        ragFilter: filters.ragFilter,
        brandFilter: filters.brandFilter
      });

      const response = await fetch(`/api/executive/rag-analytics?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ExecutiveRAGAnalyticsResponse = await response.json();
      
      console.log('Executive RAG API Response:', data); // Debug log
      
      if (data.success) {
        setAnalytics(data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch RAG data');
      }
    } catch (err) {
      console.error('Error fetching executive RAG data:', err);
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

  // Navigation function for clickable cards
  const navigateToPerformancePage = (ragFilter?: string) => {
    const params = new URLSearchParams({
      dateRange: filters.dateRange,
      ragFilter: ragFilter || filters.ragFilter,
      brandFilter: filters.brandFilter
    });
    router.push(`/executive/rag-performance?${params.toString()}`);
  };

  if (loading && !analytics) {
    return (
      <div className="exec-rag-dashboard">
        <div className="exec-rag-header">
          <div className="exec-rag-title-section">
            <h2>My Store Performance (RAG)</h2>
            <p>Analyzing your assigned stores' attach rate performance...</p>
          </div>
        </div>
        <div className="exec-rag-loading">
          <div className="loading-spinner-large"></div>
          <span>Loading your store analytics...</span>
        </div>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="exec-rag-dashboard">
        <div className="exec-rag-header">
          <div className="exec-rag-title-section">
            <h2>My Store Performance (RAG)</h2>
          </div>
        </div>
        <div className="exec-rag-error">
          <span className="error-message">Error: {error}</span>
          <button onClick={fetchRAGData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = analytics?.data?.summary || { totalStores: 0, greenStores: 0, amberStores: 0, redStores: 0, averageAttachRate: 0, improvementStores: 0 };

  return (
    <div className="exec-rag-dashboard">
      {/* Header with Filters */}
      <div className="exec-rag-header">
        <div className="exec-rag-title-section">
          <h2>My Store Performance (RAG)</h2>
          <p>Performance classification for your assigned stores</p>
        </div>
        
        <div className="exec-rag-filters">
          <select 
            value={filters.dateRange} 
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="exec-rag-filter-select"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="current-month">Current Month</option>
          </select>

          <select 
            value={filters.brandFilter} 
            onChange={(e) => handleFilterChange('brandFilter', e.target.value)}
            className="exec-rag-filter-select"
          >
            <option value="all">All Brands</option>
            {brands.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards - All Clickable */}
      <div className="exec-rag-summary-scroll-container">
        <div className="exec-rag-summary-grid">
        <div 
          className="exec-summary-card exec-summary-clickable" 
          onClick={() => navigateToPerformancePage()}
          role="button"
          tabIndex={0}
        >
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <h3>My Stores</h3>
            <div className="summary-value">{summary.totalStores}</div>
            <div className="summary-description">Stores assigned</div>
          </div>
        </div>

        <div 
          className="exec-summary-card exec-summary-green exec-summary-clickable" 
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
          className="exec-summary-card exec-summary-amber exec-summary-clickable" 
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
          className="exec-summary-card exec-summary-red exec-summary-clickable" 
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
          className="exec-summary-card exec-summary-clickable" 
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
          className="exec-summary-card exec-summary-clickable" 
          onClick={() => navigateToPerformancePage()}
          role="button"
          tabIndex={0}
        >
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <h3>Improving Stores</h3>
            <div className="summary-value">{summary.improvementStores || 0}</div>
            <div className="summary-description">Trending upward</div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveRAGDashboard;