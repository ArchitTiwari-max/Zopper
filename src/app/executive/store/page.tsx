'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRAGEmoji, RAGStorePerformance } from '@/lib/ragUtils';
import './Store.css';

interface StoreData {
  id: string;
  storeName: string;
  city: string;
  fullAddress?: string;
  partnerBrands: string[];
  partnerBrandTypes: ('A_PLUS' | 'A' | 'B' | 'C' | 'D')[];
  visited: string;
  lastVisitDate: string | null;
  isFlagged: boolean;
}


const Store: React.FC = () => {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [plannedVisitDate, setPlannedVisitDate] = useState<string>(''); // Will be set in useEffect
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // RAG data state
  const [ragData, setRagData] = useState<Map<string, string>>(new Map()); // Map of storeId -> RAG status

  const [filters, setFilters] = useState({
    storeName: '',
    city: 'All Cities',
    partnerBrand: 'All Brands',
    category: 'All Categories',
    sortBy: 'Recently Visited First'
  });
  const [storeData, setStoreData] = useState<StoreData[]>([]);
  const DEFAULT_CATEGORIES = ['All Categories', 'A++', 'A', 'B', 'C', 'D'];
  const DEFAULT_SORT = ['Recently Visited First', 'Store Name A-Z', 'Store Name Z-A', 'City A-Z'];
  const [filterOptions, setFilterOptions] = useState({
    cities: ['All Cities'],
    brands: ['All Brands'],
    categories: DEFAULT_CATEGORIES,
    sortOptions: DEFAULT_SORT,
  });

  // Helper function to format brand type display
  const formatBrandType = (type: string): string => {
    switch (type) {
      case 'A_PLUS': return 'A+';
      case 'A': return 'A';
      case 'B': return 'B';
      case 'C': return 'C';
      case 'D': return 'D';
      default: return '';
    }
  };

  // Helper function to format brands with types
  const formatBrandsWithTypes = (brands: string[], types: ('A_PLUS' | 'A' | 'B' | 'C' | 'D')[]): string => {
    if (brands.length === 0) return 'No brands';

    return brands.map((brand, index) => {
      const type = types[index];
      return type ? `${brand} (${formatBrandType(type)})` : brand;
    }).join(', ');
  };


  // Initialize planned visit date to today (using local date)
  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayLocal = `${year}-${month}-${day}`;
    setPlannedVisitDate(todayLocal);
  }, []);

  // Fetch RAG data from executive RAG analytics API
  const fetchRAGData = async () => {
    try {
      const response = await fetch('/api/executive/rag-analytics?dateRange=7days&ragFilter=all', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.performances) {
          const ragMap = new Map<string, string>();
          data.data.performances.forEach((perf: RAGStorePerformance) => {
            ragMap.set(perf.storeId, perf.attachRAG);
          });
          setRagData(ragMap);
        }
      }
    } catch (error) {
      console.error('Failed to fetch RAG data:', error);
    }
  };

  // Fetch stores data from API
  useEffect(() => {
    fetchStores();
    fetchRAGData();
  }, []);

  const fetchStores = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch store data and filter options in parallel
      const [storeResponse, filterResponse] = await Promise.all([
        fetch('/api/executive/store/data', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        }),
        fetch('/api/executive/store/filter', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        })
      ]);

      if (!storeResponse.ok) {
        throw new Error(`Store data fetch failed: ${storeResponse.status} ${storeResponse.statusText}`);
      }
      if (!filterResponse.ok) {
        throw new Error(`Filter data fetch failed: ${filterResponse.status} ${filterResponse.statusText}`);
      }

      const [storeResult, filterResult] = await Promise.all([
        storeResponse.json(),
        filterResponse.json()
      ]);

      if (storeResult.success && filterResult.success) {
        const stores: StoreData[] = storeResult.data.stores;
        const fo = filterResult.data.filterOptions || {};
        setFilterOptions({
          cities: Array.isArray(fo.cities) && fo.cities.length ? fo.cities : ['All Cities'],
          brands: Array.isArray(fo.brands) && fo.brands.length ? fo.brands : ['All Brands'],
          categories: DEFAULT_CATEGORIES, // keep local list for exec
          sortOptions: Array.isArray(fo.sortOptions) && fo.sortOptions.length ? fo.sortOptions : DEFAULT_SORT,
        });
        setStoreData(stores);
      } else {
        throw new Error(storeResult.error || filterResult.error || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  const toggleStoreFlag = async (e: React.MouseEvent, storeId: string, currentFlag: boolean) => {
    e.stopPropagation(); // Prevent row click

    // Optimistic update
    setStoreData(prev => prev.map(s =>
      s.id === storeId ? { ...s, isFlagged: !currentFlag } : s
    ));

    try {
      const response = await fetch('/api/executive/store/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, isFlagged: !currentFlag })
      });

      if (!response.ok) {
        throw new Error('Failed to update flag');
      }
    } catch (error) {
      console.error('Error toggling flag:', error);
      // Revert on error
      setStoreData(prev => prev.map(s =>
        s.id === storeId ? { ...s, isFlagged: currentFlag } : s
      ));
      alert('Failed to update bookmark');
    }
  };

  const handleCreateVisit = () => {
    setIsCreateMode(true);
  };

  const handleCancel = () => {
    setIsCreateMode(false);
    setSelectedStores([]);
    // Reset to today using local date
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayLocal = `${year}-${month}-${day}`;
    setPlannedVisitDate(todayLocal);
  };

  const handlePreviewAndSend = () => {
    if (selectedStores.length === 0) {
      alert('Please select at least one store before proceeding.');
      return;
    }
    setShowPreview(true);
  };

  const handleSubmitVisitPlan = async () => {
    if (selectedStores.length === 0) return;

    if (!plannedVisitDate) {
      alert('Please select a planned visit date before submitting.');
      return;
    }

    // Validate that the planned date is not in the past (using local date)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayLocal = `${year}-${month}-${day}`;

    if (plannedVisitDate < todayLocal) {
      alert('❌ Past date not allowed. Please select today or a future date.');
      return;
    }

    try {
      setSubmitting(true);

      // Submit visit plan to backend
      const response = await fetch('/api/executive/visit-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          storeIds: selectedStores,
          plannedVisitDate: plannedVisitDate
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(`✅ Visit plan submitted successfully! ${selectedStores.length} stores scheduled for visits.`);
          // Reset state
          setIsCreateMode(false);
          setSelectedStores([]);
          // Reset to today using local date
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayLocal = `${year}-${month}-${day}`;
          setPlannedVisitDate(todayLocal);
          setShowPreview(false);
        } else {
          const errorMessage = result.details ? `${result.error}: ${result.details}` : (result.error || 'Failed to submit visit plan');
          throw new Error(errorMessage);
        }
      } else {
        // Handle HTTP error responses (400, 500, etc.)
        const errorResult = await response.json();
        const errorMessage = errorResult.details ? `${errorResult.error}: ${errorResult.details}` : (errorResult.error || 'Failed to submit visit plan');
        throw new Error(errorMessage);
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to submit visit plan'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedStoreDetails = () => {
    return selectedStores.map(storeId => {
      const store = storeData.find(s => s.id === storeId);
      return store;
    }).filter(store => store !== undefined) as StoreData[];
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

  const handleStoreRowClick = (storeId: string, event: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox or flag button
    if (isCreateMode && (event.target as HTMLElement).closest('.exec-v-form-checkbox-cell')) {
      return;
    }

    // If in create mode, toggle selection instead of navigating
    if (isCreateMode) {
      handleStoreSelection(storeId);
      return;
    }

    // Find the store data for this storeId
    const store = storeData.find(s => s.id === storeId);
    if (!store) {
      alert('Store data not found');
      return;
    }

    // Create URL with store data as parameters
    const params = new URLSearchParams({
      storeId: store.id,
      storeName: store.storeName,
      city: store.city,
      fullAddress: store.fullAddress || '',
      partnerBrands: JSON.stringify(store.partnerBrands)
    });

    // Navigate to executive form with store data
    router.push(`/executive/executive-form?${params.toString()}`);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const filteredStores = storeData.filter(store => {
    const matchesName = store.storeName.toLowerCase().includes(filters.storeName.toLowerCase());
    const matchesCity = filters.city === 'All Cities' || store.city === filters.city;
    const matchesBrand = filters.partnerBrand === 'All Brands' || store.partnerBrands.some(brand => brand === filters.partnerBrand);
    const matchesCategory = (() => {
      if (filters.category === 'All Categories') return true;
      const want = filters.category === 'A++' ? 'A_PLUS' : filters.category;
      return (store.partnerBrandTypes || []).some(t => t === (want as any));
    })();
    return matchesName && matchesCity && matchesBrand && matchesCategory;
  }).sort((a, b) => {
    switch (filters.sortBy) {
      case 'Store Name A-Z':
        return a.storeName.localeCompare(b.storeName);
      case 'Store Name Z-A':
        return b.storeName.localeCompare(a.storeName);
      case 'City A-Z':
        return a.city.localeCompare(b.city);
      default: // Recently Visited First
        // Sort flagged stores to top if using default sort?
        // Let's keep original sort mostly, but maybe prioritize flagged?
        // User didn't ask for sorting.
        return 0;
    }
  });


  return (
    <div className="exec-v-form-container">
      <div className="exec-v-form-content">
        {/* Header Section */}
        <div className="exec-v-form-header">
          <div className="exec-v-form-title-section">
            <h1 className="exec-v-form-title">Assigned Stores</h1>
            <p className="exec-v-form-subtitle">Manage your visits and track progress</p>
          </div>
          {!isCreateMode ? (
            <button className="exec-v-form-create-visit-btn" onClick={handleCreateVisit} disabled={loading}>
              <span className="exec-v-form-plus-icon">+</span>
              Create PJP
            </button>
          ) : (
            <div className="exec-v-form-action-buttons">
              <button className="exec-v-form-preview-send-btn" onClick={handlePreviewAndSend} disabled={loading}>
                Preview And Send
              </button>
              <button className="exec-v-form-cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div className="exec-v-form-filters-section">
          {/* ... existing filters ... */}
          <button
            className={`exec-v-form-filters-toggle ${filtersOpen ? 'active' : ''}`}
            onClick={() => setFiltersOpen(!filtersOpen)}
            disabled={loading}
          >
            <span>Filters</span>
            <span className="exec-v-form-filter-arrow">▼</span>
          </button>

          {filtersOpen && (
            <div className="exec-v-form-filters-panel">
              <div className="exec-v-form-filter-group">
                <label className="exec-v-form-filter-label">Store Name</label>
                <input
                  type="text"
                  className="exec-v-form-filter-input"
                  placeholder="Enter store name..."
                  value={filters.storeName}
                  onChange={(e) => handleFilterChange('storeName', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="exec-v-form-filter-group">
                <label className="exec-v-form-filter-label">Filter by City</label>
                <select
                  className="exec-v-form-filter-select"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  disabled={loading}
                >
                  {filterOptions.cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="exec-v-form-filter-group">
                <label className="exec-v-form-filter-label">Filter by Partner Brand</label>
                <select
                  className="exec-v-form-filter-select"
                  value={filters.partnerBrand}
                  onChange={(e) => handleFilterChange('partnerBrand', e.target.value)}
                  disabled={loading}
                >
                  {filterOptions.brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div className="exec-v-form-filter-group">
                <label className="exec-v-form-filter-label">Category</label>
                <select
                  className="exec-v-form-filter-select"
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  disabled={loading}
                >
                  {filterOptions.categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="exec-v-form-filter-group">
                <label className="exec-v-form-filter-label">Sort By</label>
                <select
                  className="exec-v-form-filter-select"
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  disabled={loading}
                >
                  {filterOptions.sortOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="exec-v-form-table-container">
          {/* Table Header */}
          <div className={`exec-v-form-table-header ${isCreateMode ? 'create-mode' : ''}`}>
            {isCreateMode && (
              <div className="exec-v-form-header-cell exec-v-form-checkbox-header"></div>
            )}
            <div className="exec-v-form-header-cell exec-v-form-store-name-header">STORE NAME</div>
            <div className="exec-v-form-header-cell exec-v-form-partner-header">PARTNER BRANDS</div>
            <div className="exec-v-form-header-cell exec-v-form-sales-header">STORE SALES</div>
            <div className="exec-v-form-header-cell exec-v-form-visited-header">VISITED</div>
          </div>

          {/* Table Body */}
          <div className="exec-v-form-table-body">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading store data...</span>
              </div>
            ) : error ? (
              <div className="exec-v-form-error-state">
                <div className="exec-v-form-error-icon">⚠️</div>
                <p className="exec-v-form-error-text">Error: {error}</p>
                <button className="exec-v-form-retry-btn" onClick={fetchStores}>Retry</button>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="exec-v-form-no-stores-state">
                <div className="exec-v-form-no-stores-icon">🏪</div>
                <p className="exec-v-form-no-stores-text">No stores found matching your criteria</p>
              </div>
            ) : (
              filteredStores.map((store) => (
                <div
                  key={store.id}
                  className={`exec-v-form-table-row 
                    ${isCreateMode ? 'create-mode' : ''} 
                    ${selectedStores.includes(store.id) ? 'selected' : ''} 
                    ${isCreateMode && selectedStores.includes(store.id) && store.isFlagged ? 'flagged-selected' : ''}
                    ${!isCreateMode ? 'clickable' : ''}`}
                  onClick={(e) => handleStoreRowClick(store.id, e)}
                  style={isCreateMode && selectedStores.includes(store.id) && store.isFlagged ? { backgroundColor: '#fef08a' } : {}}
                >
                  {isCreateMode && (
                    <div className="exec-v-form-table-cell exec-v-form-checkbox-cell">
                      <input
                        type="checkbox"
                        className="exec-v-form-store-checkbox"
                        checked={selectedStores.includes(store.id)}
                        onChange={() => handleStoreSelection(store.id)}
                      />
                    </div>
                  )}
                  <div className="exec-v-form-table-cell exec-v-form-store-name-cell">
                    <div className="exec-v-form-store-name-wrapper">
                      <button
                        className="store-flag-btn"
                        onClick={(e) => toggleStoreFlag(e, store.id, store.isFlagged)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          marginRight: '8px',
                          fontSize: '18px',
                          opacity: store.isFlagged ? 1 : 0.3
                        }}
                      >
                        {store.isFlagged ? '⭐' : '☆'}
                      </button>
                      <span className="exec-v-form-store-name-text">{store.storeName} {ragData.get(store.id) && getRAGEmoji(ragData.get(store.id) as 'Red' | 'Amber' | 'Green')}</span>
                      <span className="exec-v-form-store-subtext">{store.city}</span>
                    </div>
                  </div>
                  <div className="exec-v-form-table-cell exec-v-form-partner-cell">
                    <span className="exec-v-form-brand-text">
                      {formatBrandsWithTypes(store.partnerBrands, store.partnerBrandTypes)}
                    </span>
                  </div>
                  <div className="exec-v-form-table-cell exec-v-form-sales-cell">
                    <a
                      className="exec-v-form-sales-link"
                      href={`/executive/sales?store=${encodeURIComponent(store.storeName)}&storeId=${store.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      View Sales
                    </a>
                  </div>
                  <div className="exec-v-form-table-cell exec-v-form-visited-cell" onClick={(e) => e.stopPropagation()}>
                    <span className="exec-v-form-visited-text">{store.visited}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="exec-v-form-modal-overlay">
          <div className="exec-v-form-preview-modal">
            <div className="exec-v-form-modal-header">
              <h2 className="exec-v-form-modal-title">📋 Visit Plan Preview</h2>
              <button
                className="exec-v-form-modal-close-btn"
                onClick={() => setShowPreview(false)}
                disabled={submitting}
              >
                ✕
              </button>
            </div>

            <div className="exec-v-form-modal-body">
              <div className="exec-v-form-preview-summary">
                <p className="exec-v-form-summary-text">
                  You have selected <strong>{selectedStores.length}</strong> {selectedStores.length === 1 ? 'store' : 'stores'} for visits:
                </p>
              </div>

              {/* Planned Visit Date Section */}
              <div className="exec-v-form-date-section">
                <label className="exec-v-form-date-label">
                  📅 <strong>Planned Visit Date</strong> <span className="exec-v-form-required">*</span>
                </label>
                <input
                  type="date"
                  className="exec-v-form-date-input"
                  value={plannedVisitDate}
                  onChange={(e) => setPlannedVisitDate(e.target.value)}
                  min={(() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  })()} // Prevent past dates using local date
                  disabled={submitting}
                  required
                />
                {plannedVisitDate && (
                  <p className="exec-v-form-date-preview">
                    🗓️ Visits scheduled for: <strong>
                      {(() => {
                        const date = new Date(plannedVisitDate);
                        if (isNaN(date.getTime())) return 'Invalid Date';
                        const day = date.getDate().toString().padStart(2, '0');
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        const year = date.getFullYear();
                        const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
                        return `${weekday}, ${day}/${month}/${year}`;
                      })()
                      }
                    </strong>
                  </p>
                )}
              </div>

              <div className="exec-v-form-preview-stores-list">
                {getSelectedStoreDetails().map((store, index) => (
                  <div key={store.id} className="exec-v-form-preview-store-item">
                    <div className="exec-v-form-store-number">{index + 1}</div>
                    <div className="exec-v-form-store-info">
                      <h4 className="exec-v-form-store-name">{store.storeName} {ragData.get(store.id) && getRAGEmoji(ragData.get(store.id) as 'Red' | 'Amber' | 'Green')}</h4>
                      <p className="exec-v-form-store-details">
                        📍 {store.city}
                        {store.fullAddress && ` • ${store.fullAddress}`}
                      </p>
                      <p className="exec-v-form-store-brands">
                        🏢 {formatBrandsWithTypes(store.partnerBrands, store.partnerBrandTypes)}
                      </p>
                      <p className="exec-v-form-store-status">
                        📅 Last Visit: {store.visited}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="exec-v-form-preview-note">
                <p className="exec-v-form-note-text">
                  💡 <strong>Note:</strong> Submitting this visit plan will notify all admins about your intended store visits.
                  They will receive a notification with the list of selected stores.
                </p>
              </div>
            </div>

            <div className="exec-v-form-modal-footer">
              <button
                className="exec-v-form-cancel-modal-btn"
                onClick={() => setShowPreview(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="exec-v-form-send-plan-btn"
                onClick={handleSubmitVisitPlan}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="loading-spinner"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    📤 Send Visit Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Store;
