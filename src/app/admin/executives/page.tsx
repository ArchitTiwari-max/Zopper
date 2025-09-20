'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ExecutiveData, ExecutiveFilters, RegionFilterOption, TimeframeOption } from '../types';
import './page.css';
import VisitTicker, { VisitTickerItem } from './components/VisitTicker';
import { useDateFilter } from '../contexts/DateFilterContext';


const AdminExecutivesPage: React.FC = () => {
  const searchParams = useSearchParams();
  const [executivesData, setExecutivesData] = useState<ExecutiveData[]>([]);
  const [filteredExecutives, setFilteredExecutives] = useState<ExecutiveData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { selectedDateFilter } = useDateFilter();
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(true);
  const [isFilterChanging, setIsFilterChanging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(true);

  // Ticker state
  const [recentVisits, setRecentVisits] = useState<VisitTickerItem[]>([]);
  const [isLoadingTicker, setIsLoadingTicker] = useState<boolean>(true);
  const [tickerError, setTickerError] = useState<string | null>(null);
  const tickerInFlight = useRef(false);

  // Filter data from API
  const [filterData, setFilterData] = useState<{
    executives: Array<{id: number, name: string, region: string}>;
    stores: Array<{id: number, name: string, city: string}>;
    cities: string[];
  }>({executives: [], stores: [], cities: []});

  const [filters, setFilters] = useState<ExecutiveFilters>({
    executiveName: 'All Executive',
    storeName: 'All Store'
  });

  // Fetch filter data from API (fast)
  const fetchFilterData = async () => {
    setIsLoadingFilters(true);
    setFilterError(null);
    try {
      const response = await fetch('/api/admin/executives/filters', {
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

  // Fetch ALL executives data from API (no server-side filtering)
  const fetchExecutivesData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // No query parameters - fetch all data for client-side filtering
      const params = new URLSearchParams();
      params.append('dateFilter', selectedDateFilter);
      const response = await fetch(`/api/admin/executives/data?${params.toString()}`, {
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
      setExecutivesData(data.executives || []);
      // applyFilters will be triggered by executivesData change and handle filtering
    } catch (error) {
      console.error('Failed to fetch executives data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load executives data');
      setExecutivesData([]);
    } finally {
      setIsLoading(false);
      setIsFilterChanging(false);
    }
  };

  // Apply filters to existing data (client-side filtering)
  const applyFilters = () => {
    if (!executivesData.length) {
      setFilteredExecutives([]);
      setIsFilterChanging(false);
      return;
    }

    let filtered = executivesData.filter(executive => {
      // Filter by executive name
      if (filters.executiveName !== 'All Executive') {
        // If filters.executiveName contains an ID, find the executive name
        const exec = filterData.executives.find(e => e.id.toString() === filters.executiveName);
        const execNameToMatch = exec ? exec.name : filters.executiveName;
        if (executive.name !== execNameToMatch) {
          return false;
        }
      }

      // Filter by store assignment (check if executive is assigned to this store)
      if (filters.storeName !== 'All Store') {
        console.log(`[STORE FILTER] Executive: ${executive.name}`);
        console.log(`[STORE FILTER] assignedStoreIds:`, executive.assignedStoreIds);
        console.log(`[STORE FILTER] Looking for store ID: ${filters.storeName}`);
        
        // Check if the executive's assignedStoreIds array includes this store ID
        if (!executive.assignedStoreIds || !Array.isArray(executive.assignedStoreIds)) {
          console.log(`[STORE FILTER] No assignedStoreIds or not array - filtering out ${executive.name}`);
          return false;
        }
        
        // Convert all store IDs to strings for comparison
        const assignedStoreIds = executive.assignedStoreIds.map(id => id.toString());
        const targetStoreId = filters.storeName.toString();
        
        console.log(`[STORE FILTER] Assigned store IDs (as strings):`, assignedStoreIds);
        console.log(`[STORE FILTER] Target store ID: ${targetStoreId}`);
        
        // Check if the selected store ID is in the executive's assigned stores
        const isAssigned = assignedStoreIds.includes(targetStoreId);
        console.log(`[STORE FILTER] Is ${executive.name} assigned to store ${targetStoreId}?`, isAssigned);
        
        if (!isAssigned) {
          return false;
        }
      }


      return true;
    });

    setFilteredExecutives(filtered);
    setIsFilterChanging(false);
  };

  // Initial data fetch on mount
  useEffect(() => {
    fetchFilterData();
    fetchExecutivesData();
    fetchRecentVisitsForTicker();
  }, []);

  // Refetch executives on date filter change
  useEffect(() => {
    fetchExecutivesData();
  }, [selectedDateFilter]);

  // Poll ticker every 5 seconds while mounted and refetch on tab focus
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchRecentVisitsForTicker();
    }, 5000);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        fetchRecentVisitsForTicker();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Set initial filters from URL parameters (separate effect to avoid conflicts)
  useEffect(() => {
    // Only process URL params after filter data is loaded
    if (filterData.stores.length === 0 && filterData.executives.length === 0) return;
    
    const urlExecutiveId = searchParams.get('executiveId');
    const urlStoreId = searchParams.get('storeId');
    
    if (urlExecutiveId || urlStoreId) {
      // Use executive ID directly
      let executiveFilter = 'All Executive';
      if (urlExecutiveId && urlExecutiveId !== 'All Executive') {
        // Validate that the executive ID exists in filter data
        const matchingExecutive = filterData.executives.find(exec => exec.id.toString() === urlExecutiveId);
        executiveFilter = matchingExecutive ? urlExecutiveId : 'All Executive';
        console.log('[URL DEBUG] Executive ID from URL:', urlExecutiveId, '→ Valid:', !!matchingExecutive);
      }
      
      // Use store ID directly
      let storeFilter = 'All Store';
      if (urlStoreId && urlStoreId !== 'All Store') {
        // Validate that the store ID exists in filter data
        const matchingStore = filterData.stores.find(store => store.id.toString() === urlStoreId);
        storeFilter = matchingStore ? urlStoreId : 'All Store';
        console.log('[URL DEBUG] Store ID from URL:', urlStoreId, '→ Valid:', !!matchingStore);
      }
      
      setFilters(prevFilters => ({
        ...prevFilters,
        executiveName: executiveFilter,
        storeName: storeFilter
      }));
    }
  }, [filterData.stores, filterData.executives]); // Wait for filter data to be loaded

  // Apply filters to existing data when filters change
  useEffect(() => {
    if (executivesData.length > 0) { // Only apply filters if we have data
      applyFilters();
    }
  }, [filters, executivesData]);

  // Fetch latest 20 visits for ticker
  const fetchRecentVisitsForTicker = async () => {
    if (tickerInFlight.current) return;
    tickerInFlight.current = true;
    try {
      setIsLoadingTicker(prev => prev && true); // keep loading state if first load
      setTickerError(null);
      const params = new URLSearchParams();
      params.append('dateFilter', 'Last 30 Days');
      const res = await fetch(`/api/admin/visit-report/data?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch visit reports' }));
        throw new Error(err.error || 'Failed to fetch visit reports');
      }
      const data = await res.json();
      const visits = Array.isArray(data.visits) ? data.visits : [];
      // API returns most recent first already; map to ticker items and limit to 20
      const tickerItems: VisitTickerItem[] = visits.slice(0, 20).map((v: any) => ({
        visitId: v.id,
        executiveId: v.executiveId,
        username: v.executiveName,
        storeName: v.storeName,
        // We don't have raw createdAt here; compose from dd/mm/yyyy string into Date for formatting (optional)
        visitedAt: v.visitDate,
      }));
      setRecentVisits(tickerItems);
    } catch (e) {
      setTickerError(e instanceof Error ? e.message : 'Failed to load recent visits');
      setRecentVisits([]);
    } finally {
      setIsLoadingTicker(false);
      tickerInFlight.current = false;
    }
  };


  const getBrandColor = (brand: string): string => {
    const brandColors: Record<string, string> = {
      'Samsung': '#1DB584',
      'Vivo': '#8B5CF6',
      'Oppo': '#F97316',
      'OnePlus': '#1DB584',
      'Realme': '#EC4899',
      'Xiaomi': '#EF4444'
    };
    return brandColors[brand] || '#64748b';
  };

  const handleFilterChange = (filterType: keyof ExecutiveFilters, value: string) => {
    setIsFilterChanging(true);
    const newFilters = {
      ...filters,
      [filterType]: value
    };
    
    setFilters(newFilters);
    
    // Update URL with current filter state
    updateUrlWithFilters(newFilters);
  };

  // Function to update URL based on current filter state
  const updateUrlWithFilters = (currentFilters: ExecutiveFilters) => {
    const newUrl = new URL(window.location.href);
    
    // Clear all existing filter params
    newUrl.searchParams.delete('executiveName');
    newUrl.searchParams.delete('storeName');
    newUrl.searchParams.delete('storeId');
    newUrl.searchParams.delete('executiveId');
    
    // Add current filter values to URL using IDs (only if not default)
    
    // Use executive ID in URL
    if (currentFilters.executiveName !== 'All Executive') {
      newUrl.searchParams.set('executiveId', currentFilters.executiveName);
    }
    
    // Use store ID in URL
    if (currentFilters.storeName !== 'All Store') {
      newUrl.searchParams.set('storeId', currentFilters.storeName);
    }
    
    // Update URL without reloading page
    window.history.pushState({}, '', newUrl.toString());
  };

  // Show critical errors immediately
  if (error) {
    return (
      <div className="admin-executives-overview">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '400px', gap: '1rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#ef4444' }}>Error loading executives</div>
          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{error}</div>
          <button 
            onClick={() => fetchExecutivesData()}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // OPTIMIZED: Show UI immediately, use separate loading states

  // Get store name for display when filtering by storeId
  const getStoreNameFromId = (storeId: string): string => {
    const store = filterData.stores.find(s => s.id.toString() === storeId);
    return store ? store.name : 'Unknown Store';
  };

  // Check if we're filtering by a specific store from URL
  const urlStoreId = searchParams.get('storeId');
  const isFilteringByStore = urlStoreId || (filters.storeName !== 'All Store' && filters.storeName !== 'All Store');
  const currentStoreName = urlStoreId 
    ? getStoreNameFromId(urlStoreId)
    : filters.storeName !== 'All Store' 
      ? getStoreNameFromId(filters.storeName)
      : null;

  return (
    <div className="admin-executives-overview">
      {/* Store Filter Header */}
      {isFilteringByStore && currentStoreName && (
        <div className="admin-executives-store-filter-header">
          <h2>Executives assigned to {currentStoreName}</h2>
        </div>
      )}
      
      {/* Filters Section */}
      <div className="admin-executives-filters-section">
        <div className="admin-executives-filters-header">
          <h3 
            onClick={() => setIsFiltersVisible(!isFiltersVisible)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            Filters 
            <span style={{ 
              transform: isFiltersVisible ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}>
              ▼
            </span>
          </h3>
        </div>
        {isFiltersVisible && (
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
        <div className="admin-executives-filters-grid">
          <div className="admin-executives-filter-group">
            <label>Filter by Executive Name</label>
            <select 
              value={filters.executiveName}
              onChange={(e) => handleFilterChange('executiveName', e.target.value)}
              className="admin-executives-filter-select"
            >
              <option value="All Executive">All Executive</option>
              {filterData.executives.map(executive => (
                <option key={executive.id} value={executive.id}>{executive.name}</option>
              ))}
            </select>
          </div>

          <div className="admin-executives-filter-group">
            <label>Filter by Store Assignment</label>
            <select
              value={filters.storeName}
              onChange={(e) => handleFilterChange('storeName', e.target.value)}
              className="admin-executives-filter-select"
            >
              <option value="All Store">All Store</option>
              {filterData.stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>


        </div>
          )
        )}
      </div>

      {/* Recent Visits Ticker */}
      <div style={{ marginBottom: '1rem' }}>
        {isLoadingTicker ? (
          <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading recent visits…</div>
        ) : tickerError ? (
          <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: 6 }}>Failed to load recent visits: {tickerError}</div>
        ) : (
          <VisitTicker visits={recentVisits} autoScroll={false} />
        )}
      </div>

      {/* Executives Table */}
      <div className="admin-executives-table-section">
        <div className="admin-executives-table">
          {/* Always show table header for context */}
          <div className="admin-executives-table-header">
            <div className="admin-executives-header-cell">Name</div>
            <div className="admin-executives-header-cell">Region</div>
            <div className="admin-executives-header-cell">Total Visits</div>
            <div className="admin-executives-header-cell">Last Visit</div>
            <div className="admin-executives-header-cell">Assigned Stores</div>
          </div>
          
          {/* Table body with loading state */}
          <div className="admin-executives-table-body">
            {(isLoading || isFilterChanging) ? (
              <div className="table-loading">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading executives data...</span>
              </div>
            ) : filteredExecutives.length > 0 ? (
              filteredExecutives.map(executive => (
                <div key={executive.id} className="admin-executives-table-row">
                  <div className="admin-executives-cell admin-executives-name-cell">
                    <div className="admin-executives-avatar-container">
                      <div 
                        className="admin-executives-avatar"
                        style={{ backgroundColor: executive.avatarColor }}
                      >
                        {executive.initials}
                      </div>
                      <div className="admin-executives-info">
                        <Link href={`/admin/visit-report?executiveId=${executive.id}`} className="admin-executives-name-link">
                          <span className="admin-executives-name">{executive.name}</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="admin-executives-cell">{executive.region}</div>
                  <div className="admin-executives-cell">{executive.totalVisits}</div>
                  <div className="admin-executives-cell">{executive.lastVisit}</div>
                  <div className="admin-executives-cell">
                    <Link href={`/admin/stores?executiveId=${executive.id}`} className="admin-executives-view-all-link">
                      View All
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
                No executives found matching the selected filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminExecutivesPage;
