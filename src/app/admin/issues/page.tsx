'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { IssueData, IssueFilters, TimeframeOption } from '../types';
import '../styles.css';

// Mock data for issues
const mockIssuesData: IssueData[] = [
  {
    id: 1322,
    issueId: '#Issue_Id 1322',
    storeName: 'TechZone Electronics',
    storeId: 2,
    location: 'Shop No. 45, Connaught Place',
    brandAssociated: 'Samsung Mobile',
    city: 'New Delhi',
    dateReported: '2025-01-15',
    reportedBy: 'Priya Singh',
    reportedByRole: 'Executive',
    status: 'Open',
    priority: 'High',
    category: 'Technical',
    description: 'Digital display unit not functioning properly. Screen shows flickering and intermittent connectivity issues.',
    assignmentHistory: [],
    comments: [],
    createdAt: '2025-01-15T09:00:00Z',
    updatedAt: '2025-01-16T10:30:00Z'
  },
  {
    id: 1321,
    issueId: '#Issue_Id 1321',
    storeName: 'Smart Mobile Hub',
    storeId: 1,
    location: 'Ghaziabad, Uttar Pradesh',
    brandAssociated: 'Vivo',
    city: 'Ghaziabad',
    dateReported: '2025-01-14',
    reportedBy: 'Ramesh Kumar',
    reportedByRole: 'Executive',
    status: 'In Progress',
    priority: 'Medium',
    category: 'Display',
    description: 'Brand display not aligned with company guidelines. Signage positioning needs adjustment.',
    assignmentHistory: [],
    comments: [],
    createdAt: '2025-01-14T11:00:00Z',
    updatedAt: '2025-01-15T16:20:00Z'
  },
  {
    id: 1320,
    issueId: '#Issue_Id 1320',
    storeName: 'Digital Express',
    storeId: 3,
    location: 'Lajpat Nagar, Delhi',
    brandAssociated: 'Oppo',
    city: 'Delhi',
    dateReported: '2025-01-13',
    reportedBy: 'Ankit Verma',
    reportedByRole: 'Executive',
    status: 'Resolved',
    priority: 'Low',
    category: 'Customer Service',
    description: 'Customer complaint regarding product information display.',
    assignmentHistory: [],
    comments: [],
    createdAt: '2025-01-13T14:30:00Z',
    updatedAt: '2025-01-14T09:15:00Z'
  },
  {
    id: 1319,
    issueId: '#Issue_Id 1319',
    storeName: 'Mobile World',
    storeId: 5,
    location: 'Connaught Place, Delhi',
    brandAssociated: 'Samsung Mobile',
    city: 'Delhi',
    dateReported: '2025-01-12',
    reportedBy: 'Neha Sharma',
    reportedByRole: 'Executive',
    status: 'Assigned',
    priority: 'Critical',
    category: 'Inventory',
    description: 'Stock display units missing. Urgent restocking required for promotional campaign.',
    assignmentHistory: [],
    comments: [],
    createdAt: '2025-01-12T10:00:00Z',
    updatedAt: '2025-01-13T08:45:00Z'
  }
];

const AdminIssuesPage: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('Last 30 Days');
  const [issuesData, setIssuesData] = useState<IssueData[]>(mockIssuesData);
  const [filteredIssues, setFilteredIssues] = useState<IssueData[]>(mockIssuesData);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [filters, setFilters] = useState<IssueFilters>({
    storeName: 'All Stores',
    status: 'All Status',
    priority: 'All Priority',
    category: 'All Category',
    assignedTo: 'All Assignees',
    dateRange: 'Last 30 Days'
  });

  // Simulate data loading
  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setIssuesData(mockIssuesData);
      setIsLoading(false);
    }, 500);
  }, [selectedTimeframe]);

  // Apply filters when filters change
  useEffect(() => {
    let filtered = issuesData;

    if (filters.storeName !== 'All Stores') {
      filtered = filtered.filter(issue => 
        issue.storeName.toLowerCase().includes(filters.storeName.toLowerCase())
      );
    }

    if (filters.status !== 'All Status') {
      filtered = filtered.filter(issue => issue.status === filters.status);
    }

    if (filters.priority !== 'All Priority') {
      filtered = filtered.filter(issue => issue.priority === filters.priority);
    }

    if (filters.category !== 'All Category') {
      filtered = filtered.filter(issue => issue.category === filters.category);
    }

    setFilteredIssues(filtered);
  }, [filters, issuesData]);

  const handleTimeframeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTimeframe(event.target.value as TimeframeOption);
  };

  const handleFilterChange = (filterType: keyof IssueFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
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
      'Open': '#f59e0b',
      'Assigned': '#3b82f6',
      'In Progress': '#8b5cf6',
      'Resolved': '#10b981',
      'Closed': '#64748b'
    };
    return colors[status] || '#64748b';
  };

  const getUniqueValues = (key: keyof IssueData): string[] => {
    if (key === 'storeName') {
      return [...new Set(issuesData.map(issue => issue.storeName))];
    }
    if (key === 'status') {
      return [...new Set(issuesData.map(issue => issue.status))];
    }
    if (key === 'priority') {
      return [...new Set(issuesData.map(issue => issue.priority))];
    }
    if (key === 'category') {
      return [...new Set(issuesData.map(issue => issue.category))];
    }
    return [];
  };

  if (isLoading) {
    return (
      <div className="issues-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading issues...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="issues-overview">
      {/* Header Section */}
      <div className="issues-header">
        <div className="issues-header-content">
          <h2>Issue Management</h2>
          <p>Track and resolve store issues efficiently</p>
        </div>
        <div className="date-selector">
          <label htmlFor="timeframe-select">Date Range</label>
          <select 
            id="timeframe-select"
            value={selectedTimeframe} 
            onChange={handleTimeframeChange}
            className="timeframe-select"
          >
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="Last 90 Days">Last 90 Days</option>
            <option value="Last Year">Last Year</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="issues-stats-grid">
        <div className="stats-card">
          <div className="stats-icon open">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div className="stats-content">
            <h4>Open Issues</h4>
            <div className="stats-value">{filteredIssues.filter(issue => issue.status === 'Open').length}</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon in-progress">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6Z"/>
            </svg>
          </div>
          <div className="stats-content">
            <h4>In Progress</h4>
            <div className="stats-value">{filteredIssues.filter(issue => issue.status === 'In Progress' || issue.status === 'Assigned').length}</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon resolved">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
            </svg>
          </div>
          <div className="stats-content">
            <h4>Resolved</h4>
            <div className="stats-value">{filteredIssues.filter(issue => issue.status === 'Resolved').length}</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-icon critical">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
          </div>
          <div className="stats-content">
            <h4>Critical Issues</h4>
            <div className="stats-value">{filteredIssues.filter(issue => issue.priority === 'Critical').length}</div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header">
          <h3>Filters</h3>
        </div>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Filter by Store</label>
            <select 
              value={filters.storeName}
              onChange={(e) => handleFilterChange('storeName', e.target.value)}
              className="filter-select"
            >
              <option value="All Stores">All Stores</option>
              {getUniqueValues('storeName').map(store => (
                <option key={store} value={store}>{store}</option>
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
              {getUniqueValues('status').map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Filter by Priority</label>
            <select 
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="filter-select"
            >
              <option value="All Priority">All Priority</option>
              {getUniqueValues('priority').map(priority => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Filter by Category</label>
            <select 
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="filter-select"
            >
              <option value="All Category">All Category</option>
              {getUniqueValues('category').map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="issues-table-section">
        <div className="issues-table">
          <div className="table-header">
            <div className="header-cell">ISSUE ID</div>
            <div className="header-cell">STORE</div>
            <div className="header-cell">CATEGORY</div>
            <div className="header-cell">PRIORITY</div>
            <div className="header-cell">STATUS</div>
            <div className="header-cell">REPORTED BY</div>
            <div className="header-cell">DATE REPORTED</div>
            <div className="header-cell">ACTIONS</div>
          </div>
          
          <div className="table-body">
            {filteredIssues.map(issue => (
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
                  <span className="category-badge">
                    {issue.category}
                  </span>
                </div>
                <div className="cell">
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(issue.priority) }}
                  >
                    {issue.priority}
                  </span>
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
                  {issue.status !== 'Resolved' && issue.status !== 'Closed' && (
                    <button 
                      className="quick-assign-btn"
                      onClick={() => console.log(`Quick assign issue ${issue.issueId}`)}
                      type="button"
                    >
                      Quick Assign
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {filteredIssues.length === 0 && (
          <div className="no-issues">
            <p>No issues found matching the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminIssuesPage;
