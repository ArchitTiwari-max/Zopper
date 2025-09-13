'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ExecutiveData, ExecutiveFilters, RegionFilterOption, TimeframeOption } from '../types';
import './page.css';


const AdminExecutivesPage: React.FC = () => {
  const searchParams = useSearchParams();
  const [executivesData, setExecutivesData] = useState<ExecutiveData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(true);

  // Filter data from API
  const [filterData, setFilterData] = useState<{
    executives: Array<{id: number, name: string, region: string}>;
    stores: Array<{id: number, name: string, city: string}>;
    brands: Array<{id: number, name: string}>;
    cities: string[];
  }>({executives: [], stores: [], brands: [], cities: []});

  const [filters, setFilters] = useState<ExecutiveFilters>({
    executiveName: 'All Executive',
    storeName: 'All Store',
    brand: 'All Brands'
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

  // Fetch executives data from API
  const fetchExecutivesData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      // URL parameters (from navigation) take precedence
      const urlStoreId = searchParams.get('storeId');
      const urlExecutiveId = searchParams.get('executiveId');
      const urlStoreName = searchParams.get('storeName');
      const urlExecutiveName = searchParams.get('executiveName');
      
      // Use URL params if available, otherwise use filter state
      if (urlStoreId) {
        params.append('urlStoreId', urlStoreId);
      } else if (filters.storeName !== 'All Store') {
        params.append('storeId', filters.storeName); // filters.storeName contains store ID
      }
      
      if (urlExecutiveId) {
        params.append('urlExecutiveId', urlExecutiveId);
      } else if (filters.executiveName !== 'All Executive') {
        params.append('executiveId', filters.executiveName); // filters.executiveName contains executive ID
      }
      
      // Add URL name params if available (convert to IDs)
      if (urlStoreName && !urlStoreId) {
        const store = filterData.stores.find(s => s.name === urlStoreName);
        if (store) {
          params.append('storeId', store.id.toString());
        }
      }
      if (urlExecutiveName && !urlExecutiveId) {
        const executive = filterData.executives.find(e => e.name === urlExecutiveName);
        if (executive) {
          params.append('executiveId', executive.id.toString());
        }
      }
      
      // Other filters always come from filter state
      if (filters.brand !== 'All Brands') {
        params.append('brandId', filters.brand); // filters.brand contains brand ID
      }

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
    } catch (error) {
      console.error('Failed to fetch executives data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load executives data');
      setExecutivesData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle URL query parameters and update filter state
  useEffect(() => {
    const storeId = searchParams.get('storeId');
    const executiveId = searchParams.get('executiveId');
    const storeName = searchParams.get('storeName');
    const executiveName = searchParams.get('executiveName');
    
    // Update filter state based on URL params so dropdowns show correct values
    // Only update if the values are different to avoid infinite loops
    if (storeName && filters.storeName !== storeName) {
      // URL storeName is a name, need to find corresponding ID for filter state
      const store = filterData.stores.find(s => s.name === storeName);
      if (store && filters.storeName !== store.id.toString()) {
        setFilters(prev => ({ ...prev, storeName: store.id.toString() }));
      }
    } else if (storeId && filterData.stores.length > 0) {
      // URL has storeId, use that ID directly for filter state
      if (filters.storeName !== storeId) {
        setFilters(prev => ({ ...prev, storeName: storeId }));
      }
    }
    
    if (executiveName && filters.executiveName !== executiveName) {
      // URL executiveName is a name, need to find corresponding ID for filter state
      const executive = filterData.executives.find(e => e.name === executiveName);
      if (executive && filters.executiveName !== executive.id.toString()) {
        setFilters(prev => ({ ...prev, executiveName: executive.id.toString() }));
      }
    } else if (executiveId && filterData.executives.length > 0) {
      // URL has executiveId, use that ID directly for filter state
      if (filters.executiveName !== executiveId) {
        setFilters(prev => ({ ...prev, executiveName: executiveId }));
      }
    }
  }, [searchParams, filterData]);

  // OPTIMIZED LOADING: Load both table and filter data concurrently, but prioritize table UI
  useEffect(() => {
    // Load table data first (higher priority for user experience)
    fetchExecutivesData();
    
    // Load filter data concurrently (no delay needed since no loading state shown)
    fetchFilterData();
  }, []);

  // Refetch data when filters or search params change
  useEffect(() => {
    fetchExecutivesData(); // Always prioritize table data
  }, [filters, searchParams]);


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
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    
    // When user manually changes filters, clear URL params so their selections take precedence
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

          <div className="admin-executives-filter-group">
            <label>Filter by Brand</label>
            <select 
              value={filters.brand}
              onChange={(e) => handleFilterChange('brand', e.target.value)}
              className="admin-executives-filter-select"
            >
              <option value="All Brands">All Brands</option>
              {filterData.brands.map(brand => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </div>

        </div>
          )
        )}
      </div>

      {/* Executives Table */}
      <div className="admin-executives-table-section">
        <div className="admin-executives-table">
          {/* Always show table header for context */}
          <div className="admin-executives-table-header">
            <div className="admin-executives-header-cell">Name</div>
            <div className="admin-executives-header-cell">Region</div>
            <div className="admin-executives-header-cell">Partner Brands</div>
            <div className="admin-executives-header-cell">Total Visits</div>
            <div className="admin-executives-header-cell">Last Visit</div>
            <div className="admin-executives-header-cell">Assigned Stores</div>
          </div>
          
          {/* Table body with loading state */}
          <div className="admin-executives-table-body">
            {isLoading ? (
              <div className="table-loading">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading executives data...</span>
              </div>
            ) : executivesData.length > 0 ? (
              executivesData.map(executive => (
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
                  <div className="admin-executives-cell admin-executives-brands-cell">
                    {executive.partnerBrands.map((brand, index) => (
                      <span 
                        key={index}
                        className="admin-executives-brand-tag"
                        style={{ backgroundColor: getBrandColor(brand) }}
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
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
