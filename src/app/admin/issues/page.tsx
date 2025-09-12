'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { IssueData, IssueFilters, TimeframeOption } from '../types';
import { useDateFilter } from '../contexts/DateFilterContext';
import './page.css';


const AdminIssuesPage: React.FC = () => {
  const searchParams = useSearchParams();
  const { selectedDateFilter } = useDateFilter();
  const [issuesData, setIssuesData] = useState<IssueData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  
  // Filter data from API
  const [filterData, setFilterData] = useState<{
    stores: Array<{id: string, name: string, city: string}>;
    executives: Array<{id: string, name: string, region: string}>;
    brands: Array<{id: string, name: string}>;
    cities: string[];
    statuses: string[];
  }>({stores: [], executives: [], brands: [], cities: [], statuses: []});

  const [filters, setFilters] = useState<IssueFilters>({
    storeName: 'All Stores',
    status: 'All Status',
    assignedTo: 'All Assignees',
    dateRange: 'Last 30 Days'
  });

  // Fetch filter data from API (fast)
  const fetchFilterData = async () => {
    setIsLoadingFilters(true);
    setFilterError(null);
    try {
      const response = await fetch('/api/admin/issues/filters', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setFilterData(data);
    } catch (error) {
      console.error('Failed to fetch filter data:', error);
      setFilterError(error instanceof Error ? error.message : 'Failed to load filter data');
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Fetch issues data from API
  const fetchIssuesData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('dateFilter', selectedDateFilter);
      
      // Use IDs for backend queries for better performance
      // URL parameters (from other pages) take precedence
      const urlStoreId = searchParams.get('storeId');
      const urlExecutiveId = searchParams.get('executiveId');
      const urlIssueId = searchParams.get('issueId');
      
      if (urlStoreId) {
        params.append('storeId', urlStoreId);
      } else if (filters.storeName !== 'All Stores') {
        params.append('storeId', filters.storeName); // filters.storeName contains store ID
      }
      
      if (urlExecutiveId) {
        params.append('executiveId', urlExecutiveId);
      }
      
      if (urlIssueId) {
        params.append('issueId', urlIssueId);
      }
      
      if (filters.status !== 'All Status') {
        params.append('status', filters.status);
      }

      const response = await fetch(`/api/admin/issues/data?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setIssuesData(data.issues || []);
    } catch (error) {
      console.error('Failed to fetch issues data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load issues data');
      setIssuesData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle URL query parameters and update filter state
  useEffect(() => {
    const storeId = searchParams.get('storeId');
    const executiveId = searchParams.get('executiveId');
    const status = searchParams.get('status');
    
    // Update filter state based on URL params so dropdowns show correct values
    // Store IDs in filter state but display names in UI
    if (storeId && filterData.stores.length > 0) {
      // URL has storeId, use that ID directly for filter state
      if (filters.storeName !== storeId) {
        setFilters(prev => ({ ...prev, storeName: storeId }));
      }
    }
    
    // Handle status query parameter
    if (status && status !== filters.status) {
      setFilters(prev => ({ ...prev, status: status }));
    }
  }, [searchParams, filterData]);

  // OPTIMIZED LOADING: Load both table and filter data concurrently, but prioritize table UI
  useEffect(() => {
    // Load table data first (higher priority for user experience)
    fetchIssuesData();
    
    // Load filter data concurrently (no delay needed since no loading state shown)
    fetchFilterData();
  }, []);

  // Refetch data when filters, date filter, or search params change
  useEffect(() => {
    fetchIssuesData(); // Always prioritize table data
  }, [filters, selectedDateFilter, searchParams]);

  const handleFilterChange = (filterType: keyof IssueFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    
    // When user manually changes filters, clear URL params so their selections take precedence
    if ((filterType === 'storeName') && 
        (searchParams.get('storeId') || searchParams.get('executiveId'))) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('storeId');
      newUrl.searchParams.delete('executiveId');
      newUrl.searchParams.delete('issueId');
      window.history.replaceState({}, '', newUrl.toString());
    }
  };

  // Handle status card clicks to apply filters
  const handleStatusCardClick = (status: string) => {
    handleFilterChange('status', status);
  };


  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'Pending': '#f59e0b',
      'Assigned': '#3b82f6',
      'Resolved': '#10b981'
    };
    return colors[status] || '#64748b';
  };

  // Get filter options from filter data (not issues data for better performance)
  const getFilterOptions = (type: 'stores' | 'statuses'): string[] => {
    switch (type) {
      case 'stores':
        return filterData.stores.map(store => store.name);
      case 'statuses':
        return filterData.statuses;
      default:
        return [];
    }
  };

  // Show critical errors immediately
  if (error) {
    return (
      <div className="issues-overview">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '400px', gap: '1rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#ef4444' }}>Error loading issues</div>
          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{error}</div>
          <button 
            onClick={() => fetchIssuesData()} 
            style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // OPTIMIZED: Show UI immediately, use separate loading states

  return (
    <div className="issues-overview">

      {/* Summary Stats */}
      <div className="issues-stats-grid">
        <div 
          className="stats-card clickable"
          onClick={() => handleStatusCardClick('Pending')}
          title="Click to filter by Pending issues (includes both Pending and Assigned)"
        >
          <div className="stats-icon open">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div className="stats-content">
            <h4>Open Issues</h4>
            <div className="stats-value">{issuesData.filter(issue => issue.status === 'Pending' || issue.status === 'Assigned').length}</div>
          </div>
        </div>

        <div 
          className="stats-card clickable"
          onClick={() => handleStatusCardClick('Assigned')}
          title="Click to filter by Assigned issues only"
        >
          <div className="stats-icon in-progress">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6Z"/>
            </svg>
          </div>
          <div className="stats-content">
            <h4>In Progress</h4>
            <div className="stats-value">{issuesData.filter(issue => issue.status === 'Assigned').length}</div>
          </div>
        </div>

        <div 
          className="stats-card clickable"
          onClick={() => handleStatusCardClick('Resolved')}
          title="Click to filter by Resolved issues only"
        >
          <div className="stats-icon resolved">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
            </svg>
          </div>
          <div className="stats-content">
            <h4>Resolved</h4>
            <div className="stats-value">{issuesData.filter(issue => issue.status === 'Resolved').length}</div>
          </div>
        </div>

      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header">
          <h3>Filters</h3>
        </div>
        {filterError ? (
          <div style={{ padding: '1rem', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', margin: '0.5rem 0' }}>
            Error loading filters: {filterError}
            <button 
              onClick={() => fetchFilterData()}
              style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              Retry
            </button>
          </div>
        ) : (
        <div className="filters-grid">
          <div className="filter-group">
            <label>Filter by Store</label>
            <select 
              value={filters.storeName}
              onChange={(e) => handleFilterChange('storeName', e.target.value)}
              className="filter-select"
            >
              <option value="All Stores">All Stores</option>
              {filterData.stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Filter by Status</label>
            <select 
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-select"
            >
              <option value="All Status">All Status</option>
              {filterData.statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>


        </div>
        )}
      </div>

      {/* Issues Table */}
      <div className="issues-table-section">
        <div className="issues-table">
          {/* Always show table header for context */}
          <div className="table-header">
            <div className="header-cell">ISSUE ID</div>
            <div className="header-cell">STORE</div>
            <div className="header-cell">STATUS</div>
            <div className="header-cell">REPORTED BY</div>
            <div className="header-cell">DATE REPORTED</div>
            <div className="header-cell">ACTIONS</div>
          </div>
          
          {/* Table body with loading state */}
          <div className="table-body">
            {isLoading ? (
              <div className="table-loading">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading issues data...</span>
              </div>
            ) : issuesData.length > 0 ? (
              issuesData.map(issue => (
              <div key={issue.id} className="table-row">
                <div className="cell">
                  <Link href={`/admin/issues/${issue.id}`} className="issue-id-link">
                    {issue.issueId}
                  </Link>
                </div>
                <div className="cell">
                  <div className="store-info">
                    <Link href={`/admin/stores/${issue.storeId}`} className="store-name-link">
                      <strong>{issue.storeName}</strong>
                    </Link>
                    <div className="store-location">{issue.location}</div>
                    <div className="brand-info">{issue.brandAssociated}</div>
                  </div>
                </div>
                <div className="cell">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(issue.status) }}
                  >
                    {issue.status}
                  </span>
                </div>
                <div className="cell">
                  <div className="reporter-info">
                    <div className="reporter-name">{issue.reportedBy}</div>
                    <div className="reporter-role">({issue.reportedByRole})</div>
                  </div>
                </div>
                <div className="cell">
                  {new Date(issue.dateReported).toLocaleDateString()}
                </div>
                <div className="cell actions-cell">
                  <Link href={`/admin/issues/${issue.id}`} className="view-details-btn">
                    View Details
                  </Link>
                </div>
              </div>
              ))
            ) : (
              <div style={{ 
                padding: '3rem', 
                textAlign: 'center', 
                color: '#64748b', 
                fontSize: '1rem',
                gridColumn: '1 / -1'
              }}>
                No issues found matching the selected filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminIssuesPage;
