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
  const [filteredStores, setFilteredStores] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(true);
  const [isFilterChanging, setIsFilterChanging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(true);
  
  // Filter data from API
  const [filterData, setFilterData] = useState<{
    stores: Array<{id: string, name: string, city: string}>;
    executives: Array<{id: string, name: string, region: string, assignedStoreIds: string[]}>;
    brands: Array<{id: string, name: string}>;
    cities: string[];
    statuses: string[];
  }>({stores: [], executives: [], brands: [], cities: [], statuses: []});

  const [filters, setFilters] = useState<StoreFilters>({
    partnerBrand: 'All Brands',
    city: 'All City',
    storeName: 'All Store',
    executiveName: 'All Executive',
    showOnlyUnresolvedIssues: false,
    showOnlyUnreviewedVisits: false
  });

  // Visit plan creation state
  const [isCreatingVisitPlan, setIsCreatingVisitPlan] = useState<boolean>(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [showVisitPlanModal, setShowVisitPlanModal] = useState<boolean>(false);
  const [isSubmittingVisitPlan, setIsSubmittingVisitPlan] = useState<boolean>(false);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: 'storeName' | 'city' | 'lastVisit' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

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

  // Fetch ALL stores data from API (no server-side filtering)
  const fetchStoreData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/stores/data', {
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
      setIsFilterChanging(false);
    }
  };

  // Apply filters to existing data (client-side filtering)
  const applyFilters = () => {
    if (!storeData.length) {
      setFilteredStores([]);
      setIsFilterChanging(false);
      return;
    }

    let filtered = storeData.filter(store => {
      // Filter by store name
      if (filters.storeName !== 'All Store') {
        // filters.storeName contains store ID
        if (store.id !== filters.storeName) {
          return false;
        }
      }

      // Filter by partner brand
      if (filters.partnerBrand !== 'All Brands') {
        if (!store.partnerBrands.includes(filters.partnerBrand)) {
          return false;
        }
      }

      // Filter by city
      if (filters.city !== 'All City') {
        if (store.city !== filters.city) {
          return false;
        }
      }

      // Filter by assigned executive
      if (filters.executiveName !== 'All Executive') {
        // filters.executiveName contains executive ID
        // Need to check if this store is assigned to this executive
        const executive = filterData.executives.find(e => e.id === filters.executiveName);
        if (!executive) return false;
        
        // Check if this store's ID is in the executive's assignedStoreIds array
        if (!executive.assignedStoreIds || !executive.assignedStoreIds.includes(store.id)) {
          return false;
        }
      }

      // Filter: Show only stores with unresolved issues
      if (filters.showOnlyUnresolvedIssues && store.pendingIssues === 0) {
        return false;
      }

      // Filter: Show only stores with unreviewed visits
      if (filters.showOnlyUnreviewedVisits && store.pendingReviews === 0) {
        return false;
      }

      return true;
    });

    // Apply sorting if a sort column is selected
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'storeName':
            aValue = a.storeName.toLowerCase();
            bValue = b.storeName.toLowerCase();
            break;
          case 'city':
            aValue = a.city.toLowerCase();
            bValue = b.city.toLowerCase();
            break;
          case 'lastVisit':
            // Handle null values for lastVisit
            if (!a.lastVisit && !b.lastVisit) return 0;
            if (!a.lastVisit) return 1; // Put stores with no visits at the end
            if (!b.lastVisit) return -1; // Put stores with no visits at the end
            aValue = new Date(a.lastVisit).getTime();
            bValue = new Date(b.lastVisit).getTime();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredStores(filtered);
    setIsFilterChanging(false);
  };

  // Function to update URL based on current filter state
  const updateUrlWithFilters = (currentFilters: StoreFilters) => {
    const newUrl = new URL(window.location.href);
    
    // Clear all existing filter params
    newUrl.searchParams.delete('storeId');
    newUrl.searchParams.delete('executiveId');
    newUrl.searchParams.delete('brandId');
    newUrl.searchParams.delete('city');
    newUrl.searchParams.delete('storeName');
    newUrl.searchParams.delete('executiveName');
    newUrl.searchParams.delete('showUnresolvedIssues');
    newUrl.searchParams.delete('showUnreviewedVisits');
    
    // Add current filter values to URL using IDs (only if not default)
    
    // Use store ID in URL
    if (currentFilters.storeName !== 'All Store') {
      newUrl.searchParams.set('storeId', currentFilters.storeName);
    }
    
    // Use executive ID in URL
    if (currentFilters.executiveName !== 'All Executive') {
      newUrl.searchParams.set('executiveId', currentFilters.executiveName);
    }
    
    // Use brand ID in URL (convert brand name to ID)
    if (currentFilters.partnerBrand !== 'All Brands') {
      const brand = filterData.brands.find(b => b.name === currentFilters.partnerBrand);
      if (brand) {
        newUrl.searchParams.set('brandId', brand.id);
      }
    }
    
    // Use city name in URL
    if (currentFilters.city !== 'All City') {
      newUrl.searchParams.set('city', currentFilters.city);
    }
    
    // Add checkbox filter states to URL
    if (currentFilters.showOnlyUnresolvedIssues) {
      newUrl.searchParams.set('showUnresolvedIssues', 'true');
    }
    
    if (currentFilters.showOnlyUnreviewedVisits) {
      newUrl.searchParams.set('showUnreviewedVisits', 'true');
    }
    
    // Update URL without reloading page
    window.history.pushState({}, '', newUrl.toString());
  };

  // Handle URL query parameters (use IDs) and update filter state
  useEffect(() => {
    const storeId = searchParams.get('storeId');
    const executiveId = searchParams.get('executiveId');
    const brandId = searchParams.get('brandId');
    const city = searchParams.get('city');
    const showUnresolvedIssues = searchParams.get('showUnresolvedIssues') === 'true';
    const showUnreviewedVisits = searchParams.get('showUnreviewedVisits') === 'true';

    // Update filter state based on URL params using IDs
    if (storeId && filterData.stores.length > 0 && filters.storeName !== storeId) {
      setFilters(prev => ({ ...prev, storeName: storeId }));
    }

    if (executiveId && filterData.executives.length > 0 && filters.executiveName !== executiveId) {
      setFilters(prev => ({ ...prev, executiveName: executiveId }));
    }

    if (brandId && filterData.brands.length > 0 && filters.partnerBrand !== brandId) {
      // Convert brandId to brand name to match filter type
      const brand = filterData.brands.find(b => b.id === brandId);
      if (brand) {
        setFilters(prev => ({ ...prev, partnerBrand: brand.name }));
      }
    }

    if (city && filters.city !== city) {
      setFilters(prev => ({ ...prev, city: city }));
    }

    // Update checkbox filter states from URL
    if (filters.showOnlyUnresolvedIssues !== showUnresolvedIssues) {
      setFilters(prev => ({ ...prev, showOnlyUnresolvedIssues: showUnresolvedIssues }));
    }

    if (filters.showOnlyUnreviewedVisits !== showUnreviewedVisits) {
      setFilters(prev => ({ ...prev, showOnlyUnreviewedVisits: showUnreviewedVisits }));
    }
  }, [searchParams, filterData]);

  // OPTIMIZED LOADING: Load both table and filter data concurrently, but prioritize table UI
  useEffect(() => {
    // Load table data first (higher priority for user experience)
    fetchStoreData();
    
    // Load filter data concurrently (no delay needed since no loading state shown)
    fetchFilterData();
  }, []);

  // Apply client-side filters and sorting when filters, data, or sorting changes
  useEffect(() => {
    if (storeData.length > 0) {
      applyFilters();
    }
  }, [filters, storeData, sortConfig]);

  // Optionally refetch when search params change if needed (e.g., deep link)
  useEffect(() => {
    // No refetch needed since we always fetch all data; just sync filter state from URL
  }, [searchParams]);

  const handleFilterChange = (filterType: keyof StoreFilters, value: string | boolean) => {
    setIsFilterChanging(true);
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));

    // Update URL with current filter state using IDs
    const newFilters = { ...filters, [filterType]: value } as StoreFilters;
    updateUrlWithFilters(newFilters);
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

  const handleVisitPlanSubmit = async (data: { executiveId: string; adminComment: string; plannedVisitDate: string }) => {
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
          adminComment: data.adminComment,
          plannedVisitDate: data.plannedVisitDate
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

  // Smart date formatting function
  const formatLastVisitDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    
    const visitDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset time to compare only dates
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    visitDate.setHours(0, 0, 0, 0);
    
    if (visitDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (visitDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      // Format as dd/mm/yyyy
      const day = visitDate.getDate().toString().padStart(2, '0');
      const month = (visitDate.getMonth() + 1).toString().padStart(2, '0');
      const year = visitDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  // Sorting functions
  const handleSort = (key: 'storeName' | 'city' | 'lastVisit') => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: 'storeName' | 'city' | 'lastVisit') => {
    if (sortConfig.key !== columnKey) {
      return '↕️'; // Both arrows when not sorted
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
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
      <div className="admin-stores-overview">
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
  const isFilteringByExecutive = urlExecutiveId || (filters.executiveName !== 'All Executive');
  const currentExecutiveName = (() => {
    const id = urlExecutiveId || (filters.executiveName !== 'All Executive' ? filters.executiveName : null);
    if (!id) return null;
    const exec = filterData.executives.find(e => e.id === id);
    return exec ? exec.name : null;
  })();

  return (
    <div className="admin-stores-overview">
      {/* Executive Filter Header */}
      {isFilteringByExecutive && currentExecutiveName && (
        <div className="admin-stores-executive-filter-header">
          <h2>Stores assigned to {currentExecutiveName}</h2>
        </div>
      )}
      
      {/* Filters Section */}
      <div className="admin-stores-filters-section">
        <div className="admin-stores-filters-header">
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
        <>
        <div className="admin-stores-filters-grid">
          <div className="admin-stores-filter-group">
            <label>Filter by Partner Brand</label>
            <select 
              value={filters.partnerBrand}
              onChange={(e) => handleFilterChange('partnerBrand', e.target.value)}
              className="admin-stores-filter-select"
            >
              <option value="All Brands">All Brands</option>
              {getFilterOptions('brands').map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          <div className="admin-stores-filter-group">
            <label>Filter by City</label>
            <select 
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              className="admin-stores-filter-select"
            >
              <option value="All City">All City</option>
              {getFilterOptions('cities').map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div className="admin-stores-filter-group">
            <label>Filter by Store Name</label>
            <select 
              value={filters.storeName}
              onChange={(e) => handleFilterChange('storeName', e.target.value)}
              className="admin-stores-filter-select"
            >
              <option value="All Store">All Store</option>
              {filterData.stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          <div className="admin-stores-filter-group">
            <label>Assigned Executive</label>
            <select 
              value={filters.executiveName}
              onChange={(e) => handleFilterChange('executiveName', e.target.value)}
              className="admin-stores-filter-select"
            >
              <option value="All Executive">All Executive</option>
              {filterData.executives.map(executive => (
                <option key={executive.id} value={executive.id}>{executive.name}</option>
              ))}
            </select>
          </div>

        </div>
        
        {/* Quick Filters - Horizontal Layout */}
        <div className="admin-stores-checkbox-filters" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          marginTop: '12px',
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontWeight: '600', fontSize: '13px', color: '#374151', minWidth: 'fit-content' }}>
            Quick Filters:
          </div>
          
          <label className="admin-stores-checkbox-filter" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            color: '#374151',
            whiteSpace: 'nowrap'
          }}>
            <input 
              type="checkbox" 
              checked={filters.showOnlyUnresolvedIssues}
              onChange={(e) => handleFilterChange('showOnlyUnresolvedIssues', e.target.checked)}
              style={{
                width: '14px',
                height: '14px',
                cursor: 'pointer',
                accentColor: '#3b82f6'
              }}
            />
            Stores with Unresolved issues
          </label>
          
          <label className="admin-stores-checkbox-filter" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            color: '#374151',
            whiteSpace: 'nowrap'
          }}>
            <input 
              type="checkbox" 
              checked={filters.showOnlyUnreviewedVisits}
              onChange={(e) => handleFilterChange('showOnlyUnreviewedVisits', e.target.checked)}
              style={{
                width: '14px',
                height: '14px',
                cursor: 'pointer',
                accentColor: '#3b82f6'
              }}
            />
            Stores with Unreviewed visits
          </label>
        </div>
        </>
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
      <div className="admin-stores-table-section">
        <div className="admin-stores-table">
          {/* Always show table header for context */}
          <div className="admin-stores-table-header">
            <div 
              className="admin-stores-header-cell sortable-header" 
              onClick={() => handleSort('storeName')}
            >
              STORE NAME <span className="sort-icon">{getSortIcon('storeName')}</span>
            </div>
            <div className="admin-stores-header-cell">PARTNER BRANDS</div>
            <div 
              className="admin-stores-header-cell sortable-header" 
              onClick={() => handleSort('city')}
            >
              CITY <span className="sort-icon">{getSortIcon('city')}</span>
            </div>
            <div className="admin-stores-header-cell">ASSIGNED EXECUTIVE</div>
            <div 
              className="admin-stores-header-cell sortable-header" 
              onClick={() => handleSort('lastVisit')}
            >
              LAST VISIT <span className="sort-icon">{getSortIcon('lastVisit')}</span>
            </div>
            <div className="admin-stores-header-cell">PENDING REVIEWS</div>
            <div className="admin-stores-header-cell">PENDING ISSUES</div>
          </div>
          
          {/* Table body with loading state */}
          <div className="admin-stores-table-body">
            {(isLoading || isFilterChanging) ? (
              <div className="table-loading">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading stores data...</span>
              </div>
            ) : filteredStores.length > 0 ? (
              filteredStores.map(store => (
                <div key={store.id} className="admin-stores-table-row">
                  <div className="admin-stores-cell admin-stores-store-name-cell">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', minWidth: 0 }}>
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
                        <span className="admin-stores-store-name-truncated" title={store.storeName}>
                          {store.storeName}
                        </span>
                      ) : (
                        <Link href={`/admin/visit-report?storeId=${store.id}`} className="admin-stores-store-name-link admin-stores-store-name-truncated" title={store.storeName}>
                          {store.storeName}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="admin-stores-cell admin-stores-partner-brands-cell">
                    {store.partnerBrands.map((brand, index) => (
                      <span 
                        key={index}
                        className="admin-stores-brand-tag"
                        style={{ backgroundColor: getBrandColor(brand) }}
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                  <div className="admin-stores-cell admin-stores-address-cell">{store.address}</div>
                  <div className="admin-stores-cell">
                    <Link href={`/admin/executives?storeId=${store.id}`} className="admin-stores-view-all-link">
                      View All
                    </Link>
                  </div>
                  <div className="admin-stores-cell admin-stores-last-visit-cell">
                    <span className="admin-stores-last-visit-text">
                      {formatLastVisitDate(store.lastVisit)}
                    </span>
                  </div>
                  <div className="admin-stores-cell">
                    {store.pendingReviews > 0 ? (
                      <span className="admin-stores-count-badge admin-stores-reviews-badge">
                        {store.pendingReviews}
                      </span>
                    ) : (
                      <span className="admin-stores-count-zero">{store.pendingReviews}</span>
                    )}
                  </div>
                  <div className="admin-stores-cell">
                    {store.pendingIssues > 0 ? (
                      <span className="admin-stores-count-badge admin-stores-issues-badge">
                        {store.pendingIssues}
                      </span>
                    ) : (
                      <span className="admin-stores-count-zero">{store.pendingIssues}</span>
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
