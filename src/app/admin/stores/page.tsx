'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StoreData, StoreFilters } from '../types';
import VisitPlanModal from './components/VisitPlanModal';
import './page.css';


const AdminStoresPage: React.FC = () => {
  const searchParams = useSearchParams();
  const [storeData, setStoreData] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(true);
  
  // Filter data from API
  const [filterData, setFilterData] = useState<{
    stores: Array<{id: string, name: string, city: string}>;
    executives: Array<{id: string, name: string, region: string}>;
    brands: Array<{id: string, name: string}>;
    cities: string[];
    statuses: string[];
  }>({stores: [], executives: [], brands: [], cities: [], statuses: []});

  const [filters, setFilters] = useState<StoreFilters>({
    partnerBrand: 'All Brands',
    city: 'All City',
    storeName: 'All Store',
    executiveName: 'All Executive',
    visitStatus: 'All Status',
    issueStatus: 'All Status'
  });

  // Visit plan creation state
  const [isCreatingVisitPlan, setIsCreatingVisitPlan] = useState<boolean>(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [showVisitPlanModal, setShowVisitPlanModal] = useState<boolean>(false);
  const [isSubmittingVisitPlan, setIsSubmittingVisitPlan] = useState<boolean>(false);

  // Fetch filter data from API (fast)
  const fetchFilterData = async () => {
    setIsLoadingFilters(true);
    setFilterError(null);
    try {
      const response = await fetch('/api/admin/stores/filters', {
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

  // Fetch store data from API
  const fetchStoreData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      // Send all current filter values as query parameters
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
      
      // Add URL name params if available
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

      const response = await fetch(`/api/admin/stores/data?${params.toString()}`, {
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
      setStoreData(data.stores || []);
    } catch (error) {
      console.error('Failed to fetch store data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load store data');
      setStoreData([]);
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
      if (store && filters.storeName !== store.id) {
        setFilters(prev => ({ ...prev, storeName: store.id }));
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
      if (executive && filters.executiveName !== executive.id) {
        setFilters(prev => ({ ...prev, executiveName: executive.id }));
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
    fetchStoreData();
    
    // Load filter data concurrently (no delay needed since no loading state shown)
    fetchFilterData();
  }, []);

  // Refetch data when filters or search params change
  useEffect(() => {
    fetchStoreData(); // Always prioritize table data
  }, [filters, searchParams]);

  const handleFilterChange = (filterType: keyof StoreFilters, value: string) => {
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

  // Visit plan creation handlers
  const handleCreateVisitPlan = () => {
    setIsCreatingVisitPlan(true);
    setSelectedStores([]);
  };

  const handleCancelVisitPlan = () => {
    setIsCreatingVisitPlan(false);
    setSelectedStores([]);
  };

  const handleStoreSelection = (storeId: string) => {
    setSelectedStores(prev => {
      if (prev.includes(storeId)) {
        return prev.filter(id => id !== storeId);
      } else {
        return [...prev, storeId];
      }
    });
  };

  const handleSelectAndProceed = () => {
    if (selectedStores.length > 0) {
      setShowVisitPlanModal(true);
    }
  };

  const handleVisitPlanSubmit = async (data: { executiveId: string; adminComment: string }) => {
    setIsSubmittingVisitPlan(true);
    try {
      const response = await fetch('/api/admin/visit-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          storeIds: selectedStores,
          executiveId: data.executiveId,
          adminComment: data.adminComment
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // Success - show success message and reset state
        alert(`Visit plan assigned successfully! ${result.message}`);
        
        // Reset all states
        setShowVisitPlanModal(false);
        setIsCreatingVisitPlan(false);
        setSelectedStores([]);
      } else {
        throw new Error(result.error || 'Failed to create visit plan');
      }
    } catch (error) {
      console.error('Error creating visit plan:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create visit plan'}`);
    } finally {
      setIsSubmittingVisitPlan(false);
    }
  };

  const handleVisitPlanModalClose = () => {
    setShowVisitPlanModal(false);
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

  // Get filter options from filter data (not store data for better performance)
  const getFilterOptions = (type: 'brands' | 'cities' | 'stores' | 'executives' | 'statuses'): string[] => {
    switch (type) {
      case 'brands':
        return filterData.brands.map(brand => brand.name);
      case 'cities':
        return filterData.cities;
      case 'stores':
        return filterData.stores.map(store => store.name);
      case 'executives':
        return filterData.executives.map(executive => executive.name);
      case 'statuses':
        return filterData.statuses;
      default:
        return [];
    }
  };

  // Show critical errors immediately
  if (error) {
    return (
      <div className="stores-overview">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '400px', gap: '1rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#ef4444' }}>Error loading stores</div>
          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{error}</div>
          <button 
            onClick={() => fetchStoreData()}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // OPTIMIZED: Show UI immediately, use separate loading states

  // Get executive name for display when filtering by executiveId
  const getExecutiveNameFromId = (executiveId: string): string => {
    const executive = filterData.executives.find(e => e.id === executiveId);
    return executive ? executive.name : 'Unknown Executive';
  };

  // Check if we're filtering by a specific executive from URL
  const urlExecutiveId = searchParams.get('executiveId');
  const isFilteringByExecutive = urlExecutiveId || (filters.executiveName !== 'All Executive' && filters.executiveName !== 'All Executive');
  const currentExecutiveName = urlExecutiveId 
    ? getExecutiveNameFromId(urlExecutiveId)
    : filters.executiveName !== 'All Executive' 
      ? getExecutiveNameFromId(filters.executiveName)
      : null;

  return (
    <div className="stores-overview">
      {/* Executive Filter Header */}
      {isFilteringByExecutive && currentExecutiveName && (
        <div className="executive-filter-header">
          <h2>Stores assigned to {currentExecutiveName}</h2>
        </div>
      )}
      
      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header">
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
        <div className="filters-grid">
          <div className="filter-group">
            <label>Filter by Partner Brand</label>
            <select 
              value={filters.partnerBrand}
              onChange={(e) => handleFilterChange('partnerBrand', e.target.value)}
              className="filter-select"
            >
              <option value="All Brands">All Brands</option>
              {getFilterOptions('brands').map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Filter by City</label>
            <select 
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              className="filter-select"
            >
              <option value="All City">All City</option>
              {getFilterOptions('cities').map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Filter by Store Name</label>
            <select 
              value={filters.storeName}
              onChange={(e) => handleFilterChange('storeName', e.target.value)}
              className="filter-select"
            >
              <option value="All Store">All Store</option>
              {filterData.stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Assigned Executive</label>
            <select 
              value={filters.executiveName}
              onChange={(e) => handleFilterChange('executiveName', e.target.value)}
              className="filter-select"
            >
              <option value="All Executive">All Executive</option>
              {filterData.executives.map(executive => (
                <option key={executive.id} value={executive.id}>{executive.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Filter by Visit Status</label>
            <select 
              value={filters.visitStatus}
              onChange={(e) => handleFilterChange('visitStatus', e.target.value)}
              className="filter-select"
            >
              <option value="All Status">All Status</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="REVIEWD">Reviewed</option>
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
              <option value="Pending">Pending</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>
          )
        )}
        {isCreatingVisitPlan && (
          <div className="visit-plan-actions" style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '16px',
            padding: '16px',
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '8px'
          }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', color: '#0369a1', fontWeight: '500' }}>
              {selectedStores.length > 0 ? `${selectedStores.length} store${selectedStores.length > 1 ? 's' : ''} selected` : 'Select stores to create visit plan'}
            </div>
            <button 
              onClick={handleCancelVisitPlan}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              onClick={handleSelectAndProceed}
              disabled={selectedStores.length === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: selectedStores.length > 0 ? '#059669' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: selectedStores.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              Select and Proceed
            </button>
          </div>
        )}
      </div>

      {/* Create Visit Plan Button - Between filters and table */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '20px',
        marginTop: '16px'
      }}>
        {!isCreatingVisitPlan && (
          <button 
            onClick={handleCreateVisitPlan}
            className="create-visit-plan-btn"
            style={{
              padding: '10px 20px',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4338ca';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#4f46e5';
            }}
          >
            Assign PJP
          </button>
        )}
      </div>

      {/* Stores Table */}
      <div className="stores-table-section">
        <div className="stores-table">
          {/* Always show table header for context */}
          <div className="table-header">
            <div className="header-cell">STORE NAME</div>
            <div className="header-cell">PARTNER BRANDS</div>
            <div className="header-cell">ADDRESS</div>
            <div className="header-cell">ASSIGNED TO</div>
            <div className="header-cell">Pending Reviews</div>
            <div className="header-cell">PENDING ISSUES</div>
          </div>
          
          {/* Table body with loading state */}
          <div className="table-body">
            {isLoading ? (
              <div className="table-loading">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading stores data...</span>
              </div>
            ) : storeData.length > 0 ? (
              storeData.map(store => (
                <div key={store.id} className="table-row">
                  <div className="cell store-name-cell">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isCreatingVisitPlan && (
                        <input
                          type="checkbox"
                          checked={selectedStores.includes(store.id)}
                          onChange={() => handleStoreSelection(store.id)}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#4f46e5',
                            flexShrink: 0
                          }}
                        />
                      )}
                      {isCreatingVisitPlan ? (
                        <span className="store-name-truncated" title={store.storeName}>
                          {store.storeName}
                        </span>
                      ) : (
                        <Link href={`/admin/visit-report?storeId=${store.id}`} className="store-name-link store-name-truncated" title={store.storeName}>
                          {store.storeName}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="cell partner-brands-cell">
                    {store.partnerBrands.map((brand, index) => (
                      <span 
                        key={index}
                        className="brand-tag"
                        style={{ backgroundColor: getBrandColor(brand) }}
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                  <div className="cell">{store.address}</div>
                  <div className="cell">
                    <Link href={`/admin/executives?storeId=${store.id}`} className="view-all-link">
                      View All
                    </Link>
                  </div>
                  <div className="cell">
                    {store.pendingReviews > 0 ? (
                      <span className="count-badge reviews-badge">
                        {store.pendingReviews}
                      </span>
                    ) : (
                      <span className="count-zero">{store.pendingReviews}</span>
                    )}
                  </div>
                  <div className="cell">
                    {store.pendingIssues > 0 ? (
                      <span className="count-badge issues-badge">
                        {store.pendingIssues}
                      </span>
                    ) : (
                      <span className="count-zero">{store.pendingIssues}</span>
                    )}
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
                No stores found matching the selected filters.
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Visit Plan Modal */}
      <VisitPlanModal
        isOpen={showVisitPlanModal}
        onClose={handleVisitPlanModalClose}
        selectedStores={storeData.filter(store => selectedStores.includes(store.id)).map(store => ({
          id: store.id,
          storeName: store.storeName,
          city: store.address // Using address as city for now
        }))}
        onSubmit={handleVisitPlanSubmit}
        isSubmitting={isSubmittingVisitPlan}
      />
    </div>
  );
};

export default AdminStoresPage;
