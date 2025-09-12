'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDateFilter } from '../contexts/DateFilterContext';
import './page.css';

// Types for visit report
interface VisitReportData {
  id: number;
  executiveName: string;
  executiveInitials: string;
  avatarColor: string;
  storeName: string;
  partnerBrand: string[];
  visitDate: string;
  visitStatus: 'PENDING_REVIEW' | 'REVIEWD';
  issueStatus: 'Pending' | 'Assigned' | 'Resolved';
  city: string;
  issues: string;
  issueId?: number;
  feedback: string;
}

interface VisitReportFilters {
  partnerBrand: string;
  city: string;
  storeName: string;
  executiveName: string;
  visitStatus: string;
  issueStatus: string;
}

// Mock data for unified visit reports
const mockVisitData: VisitReportData[] = [
  {
    id: 1,
    executiveName: 'Ramesh Kumar',
    executiveInitials: 'RK',
    avatarColor: '#3B82F6',
    storeName: 'Lucky Electronics',
    partnerBrand: ['Godrej', 'Havells'],
    visitDate: '2025-08-01',
    visitStatus: 'PENDING_REVIEW',
    issueStatus: 'Pending',
    city: 'Ghaziabad',
    issues: 'No flyer stock',
    issueId: 1323,
    feedback: 'Asked for new standee'
  },
  {
    id: 2,
    executiveName: 'Neha Sharma',
    executiveInitials: 'NS',
    avatarColor: '#EC4899',
    storeName: 'Techno Hub',
    partnerBrand: ['Oppo'],
    visitDate: '2025-08-15',
    visitStatus: 'REVIEWD',
    issueStatus: 'Resolved',
    city: 'Noida',
    issues: 'None',
    feedback: 'Happy with current setup'
  },
  {
    id: 3,
    executiveName: 'Sunita Yadav',
    executiveInitials: 'SY',
    avatarColor: '#8B5CF6',
    storeName: 'Digital Express',
    partnerBrand: ['Vivo', 'Oppo'],
    visitDate: '2025-08-08',
    visitStatus: 'REVIEWD',
    issueStatus: 'Assigned',
    city: 'Delhi',
    issues: 'Display demo req',
    issueId: 1324,
    feedback: 'Need better product visibility'
  },
  {
    id: 4,
    executiveName: 'Rajesh Singh',
    executiveInitials: 'RS',
    avatarColor: '#F59E0B',
    storeName: 'Alpha Mobiles',
    partnerBrand: ['Vivo'],
    visitDate: '2025-08-12',
    visitStatus: 'PENDING_REVIEW',
    issueStatus: 'Pending',
    city: 'Noida',
    issues: 'Low stock shelf',
    issueId: 1325,
    feedback: 'Satisfied with service'
  },
  {
    id: 5,
    executiveName: 'Priya Gupta',
    executiveInitials: 'PG',
    avatarColor: '#10B981',
    storeName: 'Mobile World',
    partnerBrand: ['Samsung', 'Vivo', 'Oppo'],
    visitDate: '2025-08-20',
    visitStatus: 'REVIEWD',
    issueStatus: 'Resolved',
    city: 'Delhi',
    issues: 'WiFi connectivity issues',
    issueId: 1322,
    feedback: 'Excellent product placement'
  },
  {
    id: 6,
    executiveName: 'Amit Verma',
    executiveInitials: 'AV',
    avatarColor: '#EF4444',
    storeName: 'Smart Zone',
    partnerBrand: ['Samsung'],
    visitDate: '2025-08-08',
    visitStatus: 'REVIEWD',
    issueStatus: 'Assigned',
    city: 'Delhi',
    issues: 'Missing price tags',
    issueId: 1326,
    feedback: 'Needs promotional materials'
  },
  {
    id: 7,
    executiveName: 'Kavita Sharma',
    executiveInitials: 'KS',
    avatarColor: '#8B5CF6',
    storeName: 'Galaxy Store',
    partnerBrand: ['Samsung', 'Oppo'],
    visitDate: '2025-08-18',
    visitStatus: 'REVIEWD',
    issueStatus: 'Resolved',
    city: 'Gurgaon',
    issues: 'WiFi connectivity issues',
    issueId: 1322,
    feedback: 'Good customer response'
  },
  {
    id: 8,
    executiveName: 'Deepak Mishra',
    executiveInitials: 'DM',
    avatarColor: '#F97316',
    storeName: 'Tech Paradise',
    partnerBrand: ['Vivo'],
    visitDate: '2025-08-25',
    visitStatus: 'PENDING_REVIEW',
    issueStatus: 'Pending',
    city: 'Faridabad',
    issues: 'Inventory management',
    issueId: 1327,
    feedback: 'Store layout needs improvement'
  }
];

const VisitReportPage: React.FC = () => {
  const searchParams = useSearchParams();
  const { selectedDateFilter } = useDateFilter();
  const [visitData, setVisitData] = useState<VisitReportData[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<VisitReportData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(true);
  
  // Filter data from API
  const [filterData, setFilterData] = useState<{
    stores: Array<{id: string, name: string, city: string}>;
    executives: Array<{id: string, name: string, region: string}>;
    brands: Array<{id: string, name: string}>;
    cities: string[];
  }>({stores: [], executives: [], brands: [], cities: []});

  const [filters, setFilters] = useState<VisitReportFilters>({
    partnerBrand: 'All Brands',
    city: 'All City',
    storeName: 'All Store',
    executiveName: 'All Executive',
    visitStatus: 'All Status',
    issueStatus: 'All Status'
  });

  // Fetch filter data from API (fast)
  const fetchFilterData = async () => {
    setIsLoadingFilters(true);
    setFilterError(null);
    try {
      const response = await fetch('/api/admin/visit-report/filters', {
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

  // Fetch visit report data from API
  const fetchVisitReportData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('dateFilter', selectedDateFilter);
      
      // Send all current filter values as query parameters
      // Use IDs for backend queries for better performance
      
      // URL parameters (from store/executive page navigation) take precedence
      const urlStoreId = searchParams.get('storeId');
      const urlExecutiveId = searchParams.get('executiveId');
      const urlStoreName = searchParams.get('storeName');
      const urlExecutiveName = searchParams.get('executiveName');
      
      // Use URL params if available, otherwise use filter state (which contains IDs)
      if (urlStoreId) {
        params.append('storeId', urlStoreId);
      } else if (filters.storeName !== 'All Store') {
        params.append('storeId', filters.storeName); // filters.storeName contains store ID
      }
      
      if (urlExecutiveId) {
        params.append('executiveId', urlExecutiveId);
      } else if (filters.executiveName !== 'All Executive') {
        params.append('executiveId', filters.executiveName); // filters.executiveName contains executive ID
      }
      
      // Add URL name params if available (for backward compatibility)
      if (urlStoreName && !urlStoreId) {
        params.append('storeName', urlStoreName);
      }
      if (urlExecutiveName && !urlExecutiveId) {
        params.append('executiveName', urlExecutiveName);
      }
      
      // Other filters always come from filter state
      if (filters.partnerBrand !== 'All Brands') {
        params.append('partnerBrand', filters.partnerBrand);
      }
      if (filters.city !== 'All City') {
        params.append('city', filters.city);
      }
      if (filters.visitStatus !== 'All Status') {
        params.append('visitStatus', filters.visitStatus);
      }
      if (filters.issueStatus !== 'All Status') {
        params.append('issueStatus', filters.issueStatus);
      }

      const response = await fetch(`/api/admin/visit-report/data?${params.toString()}`, {
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
      setVisitData(data.visits || []);
      setFilteredVisits(data.visits || []);
    } catch (error) {
      console.error('Failed to fetch visit report data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load visit report data');
      setVisitData([]);
      setFilteredVisits([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle URL query parameters and update filter state
  useEffect(() => {
    // Only process URL params after filter data is loaded
    if (isLoadingFilters || filterData.stores.length === 0) {
      return;
    }

    const storeId = searchParams.get('storeId');
    const executiveId = searchParams.get('executiveId');
    const storeName = searchParams.get('storeName');
    const executiveName = searchParams.get('executiveName');
    const visitStatus = searchParams.get('visitStatus');
    const partnerBrand = searchParams.get('partnerBrand');
    
    let hasUrlParams = false;
    let newFilters = { ...filters };
    
    // Update filter state based on URL params so dropdowns show correct values
    // Store IDs in filter state but display names in UI
    if (storeName && filters.storeName !== storeName) {
      // URL storeName is a name, need to find corresponding ID for filter state
      const store = filterData.stores.find(s => s.name === storeName);
      if (store && filters.storeName !== store.id) {
        newFilters.storeName = store.id;
        hasUrlParams = true;
      }
    } else if (storeId && filterData.stores.length > 0) {
      // URL has storeId, use that ID directly for filter state
      if (filters.storeName !== storeId) {
        newFilters.storeName = storeId;
        hasUrlParams = true;
      }
    }
    
    if (executiveName && filters.executiveName !== executiveName) {
      // URL executiveName is a name, need to find corresponding ID for filter state
      const executive = filterData.executives.find(e => e.name === executiveName);
      if (executive && filters.executiveName !== executive.id) {
        newFilters.executiveName = executive.id;
        hasUrlParams = true;
      }
    } else if (executiveId && filterData.executives.length > 0) {
      // URL has executiveId, use that ID directly for filter state
      if (filters.executiveName !== executiveId) {
        newFilters.executiveName = executiveId;
        hasUrlParams = true;
      }
    }
    
    // Handle visitStatus query parameter
    if (visitStatus && visitStatus !== filters.visitStatus) {
      newFilters.visitStatus = visitStatus;
      hasUrlParams = true;
    }
    
    // Handle partnerBrand query parameter
    if (partnerBrand && partnerBrand !== filters.partnerBrand) {
      newFilters.partnerBrand = partnerBrand;
      hasUrlParams = true;
    }

    // Only update filters if there are actual URL params to process
    if (hasUrlParams) {
      setFilters(newFilters);
    }
  }, [searchParams, filterData, isLoadingFilters]);

  // OPTIMIZED LOADING: Load filter data first, then table data
  useEffect(() => {
    // Load filter data first so URL params can be processed correctly
    fetchFilterData();
  }, []);
  
  // Load table data after filters are potentially updated from URL params
  useEffect(() => {
    // Only fetch data if filter data has been loaded (to avoid race conditions)
    if (!isLoadingFilters) {
      fetchVisitReportData();
    }
  }, [isLoadingFilters]);

  // Refetch data when filters or date filter change (but not on searchParams to avoid double fetch)
  useEffect(() => {
    // Don't fetch immediately if we're still processing URL params
    if (!isLoadingFilters) {
      fetchVisitReportData();
    }
  }, [filters, selectedDateFilter]);


  const handleFilterChange = (filterType: keyof VisitReportFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    
    // When user manually changes filters, we want to clear URL params
    // so their selections take precedence over URL navigation
    // We can do this by updating the URL without the storeId/executiveId params
    if ((filterType === 'storeName' || filterType === 'executiveName') && 
        (searchParams.get('storeId') || searchParams.get('executiveId'))) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('storeId');
      newUrl.searchParams.delete('executiveId');
      newUrl.searchParams.delete('storeName');
      newUrl.searchParams.delete('executiveName');
      window.history.replaceState({}, '', newUrl.toString());
    }
  };

  const getBrandColor = (brand: string): string => {
    const brandColors: Record<string, string> = {
      'Samsung': '#1DB584',
      'Vivo': '#8B5CF6',
      'Oppo': '#F97316',
      'OnePlus': '#1DB584',
      'Realme': '#EC4899',
      'Xiaomi': '#EF4444',
      'Godrej': '#3B82F6',
      'Havells': '#F59E0B',
      'Philips': '#10B981'
    };
    return brandColors[brand] || '#64748b';
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'Pending Review':
        return 'status-pending-review';
      case 'Reviewed':
        return 'status-reviewed';
      case 'Pending Issue':
        return 'status-pending-issue';
      case 'Resolved':
        return 'status-resolved';
      default:
        return 'status-default';
    }
  };

  const getVisitStatusBadgeClass = (status: 'PENDING_REVIEW' | 'REVIEWD'): string => {
    switch (status) {
      case 'PENDING_REVIEW':
        return 'visit-status-pending';
      case 'REVIEWD':
        return 'visit-status-reviewed';
      default:
        return 'visit-status-default';
    }
  };

  // Format visit status for display
  const formatVisitStatus = (status: 'PENDING_REVIEW' | 'REVIEWD'): string => {
    switch (status) {
      case 'PENDING_REVIEW':
        return 'Pending Review';
      case 'REVIEWD':
        return 'Reviewed';
      default:
        return status;
    }
  };

  // Format issue status for display (already properly formatted)
  const formatIssueStatus = (status: 'Pending' | 'Assigned' | 'Resolved'): string => {
    return status;
  };

  const getIssueStatusBadgeClass = (status: 'Pending' | 'Assigned' | 'Resolved'): string => {
    switch (status) {
      case 'Pending':
        return 'issue-status-pending';
      case 'Assigned':
        return 'issue-status-assigned';
      case 'Resolved':
        return 'issue-status-resolved';
      default:
        return 'issue-status-default';
    }
  };

  // Get unique values from filter data (not visit data for better performance)
  const getFilterOptions = (type: 'brands' | 'cities' | 'stores' | 'executives'): string[] => {
    switch (type) {
      case 'brands':
        return filterData.brands.map(brand => brand.name);
      case 'cities':
        return filterData.cities;
      case 'stores':
        return filterData.stores.map(store => store.name);
      case 'executives':
        return filterData.executives.map(executive => executive.name);
      default:
        return [];
    }
  };

  // Get all possible visit status options (not just ones in current data)
  const getAllVisitStatusOptions = (): { value: string; label: string }[] => {
    return [
      { value: 'PENDING_REVIEW', label: 'Pending Review' },
      { value: 'REVIEWD', label: 'Reviewed' }
    ];
  };

  // Get all possible issue status options (simplified to match stores page)
  const getAllIssueStatusOptions = (): { value: string; label: string }[] => {
    return [
      { value: 'Pending', label: 'Pending' },
      { value: 'Resolved', label: 'Resolved' }
    ];
  };

  const getIssueIdByText = (issueText: string): number | null => {
    const issueMapping: Record<string, number> = {
      'No flyer stock': 1323,
      'Display demo req': 1324,
      'Low stock shelf': 1325,
      'WiFi connectivity issues': 1322,
      'Missing price tags': 1326,
      'Inventory management': 1327,
      'None': 0
    };
    return issueMapping[issueText] || null;
  };

  // Show critical errors immediately
  if (error) {
    return (
      <div className="visit-report-overview">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '400px', gap: '1rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#ef4444' }}>Error loading visit reports</div>
          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{error}</div>
          <button 
            onClick={() => fetchVisitReportData()} 
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
    <div className="visit-report-overview">
      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header" onClick={() => setShowFilters(!showFilters)}>
          <h3>Filters {showFilters ? '▼' : '▶'}</h3>
        </div>
        {showFilters && (
          filterError ? (
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
                <label>Filter by Partner Brand</label>
                <select 
                  value={filters.partnerBrand}
                  onChange={(e) => handleFilterChange('partnerBrand', e.target.value)}
                  className="filter-select"
                  disabled={isLoadingFilters}
                >
                  <option value="All Brands">{isLoadingFilters ? 'Loading brands...' : 'All Brands'}</option>
                  {!isLoadingFilters && getFilterOptions('brands').map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                {isLoadingFilters && (
                  <div className="filter-loading">
                    <div className="loading-spinner-small"></div>
                  </div>
                )}
              </div>

              <div className="filter-group">
                <label>Filter by City</label>
                <select 
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  className="filter-select"
                  disabled={isLoadingFilters}
                >
                  <option value="All City">{isLoadingFilters ? 'Loading cities...' : 'All City'}</option>
                  {!isLoadingFilters && getFilterOptions('cities').map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                {isLoadingFilters && (
                  <div className="filter-loading">
                    <div className="loading-spinner-small"></div>
                  </div>
                )}
              </div>

              <div className="filter-group">
                <label>Filter by Store Name</label>
                <select 
                  value={filters.storeName}
                  onChange={(e) => handleFilterChange('storeName', e.target.value)}
                  className="filter-select"
                  disabled={isLoadingFilters}
                >
                  <option value="All Store">{isLoadingFilters ? 'Loading stores...' : 'All Store'}</option>
                  {!isLoadingFilters && filterData.stores.map(store => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
                {isLoadingFilters && (
                  <div className="filter-loading">
                    <div className="loading-spinner-small"></div>
                  </div>
                )}
              </div>

              <div className="filter-group">
                <label>Filter by Executive Name</label>
                <select 
                  value={filters.executiveName}
                  onChange={(e) => handleFilterChange('executiveName', e.target.value)}
                  className="filter-select"
                  disabled={isLoadingFilters}
                >
                  <option value="All Executive">{isLoadingFilters ? 'Loading executives...' : 'All Executive'}</option>
                  {!isLoadingFilters && filterData.executives.map(executive => (
                    <option key={executive.id} value={executive.id}>{executive.name}</option>
                  ))}
                </select>
                {isLoadingFilters && (
                  <div className="filter-loading">
                    <div className="loading-spinner-small"></div>
                  </div>
                )}
              </div>

              <div className="filter-group">
                <label>Filter by Review Status</label>
                <select 
                  value={filters.visitStatus}
                  onChange={(e) => handleFilterChange('visitStatus', e.target.value)}
                  className="filter-select"
                >
                  <option value="All Status">All Status</option>
                  {getAllVisitStatusOptions().map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Filter by Issue Status</label>
                <select 
                  value={filters.issueStatus}
                  onChange={(e) => handleFilterChange('issueStatus', e.target.value)}
                  className="filter-select"
                >
                  <option value="All Status">All Status</option>
                  {getAllIssueStatusOptions().map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        )}
      </div>

      {/* Visit Reports Table */}
      <div className="visits-table-section">
        <div className="visits-table">
          {/* Always show table header for context */}
          <div className="table-header">
            <div className="header-cell">Executive Name</div>
            <div className="header-cell">Store Name</div>
            <div className="header-cell">Partner Brand</div>
            <div className="header-cell">Visit Date</div>
            <div className="header-cell">Issues</div>
            <div className="header-cell">Status</div>
            <div className="header-cell">Actions</div>
          </div>
          
          {/* Table body with loading state */}
          <div className="table-body">
            {isLoading ? (
              <div className="table-loading">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading visit reports data...</span>
              </div>
            ) : filteredVisits.length > 0 ? (
              filteredVisits.map(visit => (
              <div key={visit.id} className="table-row">
                <div className="cell executive-cell">
                  <div 
                    className="executive-avatar"
                    style={{ backgroundColor: visit.avatarColor }}
                  >
                    {visit.executiveInitials}
                  </div>
                  <span className="executive-name">{visit.executiveName}</span>
                </div>
                
                <div className="cell store-name-cell">
                  <Link href={`/admin/stores/${visit.id}`} className="store-name-link">
                    {visit.storeName}
                  </Link>
                </div>
                
                <div className="cell partner-brands-cell">
                  {visit.partnerBrand.map((brand, index) => (
                    <span 
                      key={index}
                      className="brand-tag"
                      style={{ backgroundColor: getBrandColor(brand) }}
                    >
                      {brand}
                    </span>
                  ))}
                </div>
                
                <div className="cell date-cell">
                  <span className="visit-date">📅 {visit.visitDate}</span>
                </div>
                
                <div className="cell issues-cell">
                  <div className="issues-content">
                    {visit.issues === 'None' ? (
                      <span className="no-issues">⚠️ {visit.issues}</span>
                    ) : (
                      <div className="issue-link-container">
                        <span className="issue-icon">⚠️</span>
                        {visit.issueId ? (
                          <Link 
                            href={`/admin/issues?issueId=${visit.issueId}`}
                            className="issue-link"
                            title={`View issue: ${visit.issues}`}
                          >
                            {visit.issues}
                          </Link>
                        ) : (
                          <span className="has-issues">{visit.issues}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="cell status-cell">
                  <div className="status-badges">
                    <span className={`status-badge ${getVisitStatusBadgeClass(visit.visitStatus)}`}>
                      {formatVisitStatus(visit.visitStatus)}
                    </span>
                    <span className={`status-badge ${getIssueStatusBadgeClass(visit.issueStatus)}`}>
                      Issue {formatIssueStatus(visit.issueStatus)}
                    </span>
                  </div>
                </div>
                
                <div className="cell actions-cell">
                  <div className="action-buttons-group">
                    <button className="view-details-btn">
                      View Details
                    </button>
                    {visit.issues !== 'None' && visit.issueId && (
                      <Link 
                        href={`/admin/issues?issueId=${visit.issueId}`}
                        className="view-issue-btn"
                      >
                        View Issue
                      </Link>
                    )}
                    {visit.visitStatus === 'PENDING_REVIEW' && (
                      <button className="mark-reviewed-btn">
                        Mark Reviewed
                      </button>
                    )}
                  </div>
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
                No visit reports found matching the selected filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitReportPage;
