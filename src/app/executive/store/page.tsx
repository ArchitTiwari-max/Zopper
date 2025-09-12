'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './Store.css';

interface StoreData {
  id: string;
  storeName: string;
  city: string;
  fullAddress?: string;
  partnerBrands: string[];
  visited: string;
  lastVisitDate: string | null;
}

const Store: React.FC = () => {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    storeName: '',
    city: 'All Cities',
    partnerBrand: 'All Brands',
    sortBy: 'Recently Visited First'
  });
  const [storeData, setStoreData] = useState<StoreData[]>([]);
  const [filterOptions, setFilterOptions] = useState({
    cities: ['All Cities'],
    brands: ['All Brands'],
    sortOptions: ['Recently Visited First', 'Store Name A-Z', 'Store Name Z-A', 'City A-Z']
  });

  // Fetch stores data from API
  useEffect(() => {
    fetchStores();
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

      if (!storeResponse.ok || !filterResponse.ok) {
        throw new Error('Failed to fetch store or filter data');
      }

      const [storeResult, filterResult] = await Promise.all([
        storeResponse.json(),
        filterResponse.json()
      ]);
      
      if (storeResult.success && filterResult.success) {
        setStoreData(storeResult.data.stores);
        setFilterOptions(filterResult.data.filterOptions);
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

  const handleCreateVisit = () => {
    setIsCreateMode(true);
  };

  const handleCancel = () => {
    setIsCreateMode(false);
    setSelectedStores([]);
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
          storeIds: selectedStores
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit visit plan');
      }

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Visit plan submitted successfully! ${selectedStores.length} stores scheduled for visits.`);
        // Reset state
        setIsCreateMode(false);
        setSelectedStores([]);
        setShowPreview(false);
      } else {
        throw new Error(result.error || 'Failed to submit visit plan');
      }
    } catch (error) {
      console.error('Error submitting visit plan:', error);
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
    // Don't navigate if clicking on checkbox in create mode
    if (isCreateMode && (event.target as HTMLElement).tagName === 'INPUT') {
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
    return matchesName && matchesCity && matchesBrand;
  }).sort((a, b) => {
    switch (filters.sortBy) {
      case 'Store Name A-Z':
        return a.storeName.localeCompare(b.storeName);
      case 'Store Name Z-A':
        return b.storeName.localeCompare(a.storeName);
      case 'City A-Z':
        return a.city.localeCompare(b.city);
      default: // Recently Visited First
        return 0; // Keep original order (already sorted by API)
    }
  });

  return (
    <div className="store-container">
      <div className="store-content">
        {/* Header Section */}
        <div className="store-header">
          <div className="store-title-section">
            <h1 className="store-title">Assigned Stores</h1>
            <p className="store-subtitle">Manage your visits and track progress</p>
          </div>
          {!isCreateMode ? (
            <button className="create-visit-btn" onClick={handleCreateVisit} disabled={loading}>
              <span className="plus-icon">+</span>
              Create PJP
            </button>
          ) : (
            <div className="action-buttons">
              <button className="preview-send-btn" onClick={handlePreviewAndSend} disabled={loading}>
                Preview And Send
              </button>
              <button className="cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div className="filters-section">
          <button 
            className={`filters-toggle ${filtersOpen ? 'active' : ''}`}
            onClick={() => setFiltersOpen(!filtersOpen)}
            disabled={loading}
          >
            <span>Filters</span>
            <span className="filter-arrow">▼</span>
          </button>
          
          {filtersOpen && (
            <div className="filters-panel">
              <div className="filter-group">
                <label className="filter-label">Store Name</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Enter store name..."
                  value={filters.storeName}
                  onChange={(e) => handleFilterChange('storeName', e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Filter by City</label>
                <select
                  className="filter-select"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  disabled={loading}
                >
                  {filterOptions.cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Filter by Partner Brand</label>
                <select
                  className="filter-select"
                  value={filters.partnerBrand}
                  onChange={(e) => handleFilterChange('partnerBrand', e.target.value)}
                  disabled={loading}
                >
                  {filterOptions.brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Sort By</label>
                <select
                  className="filter-select"
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
        <div className="store-table-container">
          {/* Table Header */}
          <div className={`table-header ${isCreateMode ? 'create-mode' : ''}`}>
            {isCreateMode && (
              <div className="header-cell checkbox-header"></div>
            )}
            <div className="header-cell store-name-header">STORE NAME</div>
            <div className="header-cell partner-header">PARTNER BRANDS</div>
            <div className="header-cell city-header">CITY</div>
            <div className="header-cell visited-header">VISITED</div>
          </div>

          {/* Table Body */}
          <div className="table-body">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading store data...</span>
              </div>
            ) : error ? (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <p className="error-text">Error: {error}</p>
                <button className="retry-btn" onClick={fetchStores}>Retry</button>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="no-stores-state">
                <div className="no-stores-icon">🏪</div>
                <p className="no-stores-text">No stores found matching your criteria</p>
              </div>
            ) : (
              filteredStores.map((store) => (
                <div 
                  key={store.id} 
                  className={`table-row ${isCreateMode ? 'create-mode' : ''} ${selectedStores.includes(store.id) ? 'selected' : ''} ${!isCreateMode ? 'clickable' : ''}`}
                  onClick={(e) => handleStoreRowClick(store.id, e)}
                >
                  {isCreateMode && (
                    <div className="table-cell checkbox-cell">
                      <input
                        type="checkbox"
                        className="store-checkbox"
                        checked={selectedStores.includes(store.id)}
                        onChange={() => handleStoreSelection(store.id)}
                      />
                    </div>
                  )}
                  <div className="table-cell store-name-cell">
                    <span className="store-name-text">{store.storeName}</span>
                  </div>
                  <div className="table-cell partner-cell">
                    <span className="brand-text">
                      {store.partnerBrands.length > 0 ? store.partnerBrands.join(', ') : 'No brands'}
                    </span>
                  </div>
                  <div className="table-cell city-cell">
                    <span className="city-text">{store.city}</span>
                  </div>
                  <div className="table-cell visited-cell">
                    <span className="visited-text">{store.visited}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="modal-overlay">
          <div className="preview-modal">
            <div className="modal-header">
              <h2 className="modal-title">📋 Visit Plan Preview</h2>
              <button 
                className="modal-close-btn"
                onClick={() => setShowPreview(false)}
                disabled={submitting}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="preview-summary">
                <p className="summary-text">
                  You have selected <strong>{selectedStores.length}</strong> {selectedStores.length === 1 ? 'store' : 'stores'} for visits:
                </p>
              </div>
              
              <div className="preview-stores-list">
                {getSelectedStoreDetails().map((store, index) => (
                  <div key={store.id} className="preview-store-item">
                    <div className="store-number">{index + 1}</div>
                    <div className="store-info">
                      <h4 className="store-name">{store.storeName}</h4>
                      <p className="store-details">
                        📍 {store.city}
                        {store.fullAddress && ` • ${store.fullAddress}`}
                      </p>
                      <p className="store-brands">
                        🏢 {store.partnerBrands.length > 0 ? store.partnerBrands.join(', ') : 'No brands'}
                      </p>
                      <p className="store-status">
                        📅 Last Visit: {store.visited}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="preview-note">
                <p className="note-text">
                  💡 <strong>Note:</strong> Submitting this visit plan will notify all admins about your intended store visits. 
                  They will receive a notification with the list of selected stores.
                </p>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-modal-btn"
                onClick={() => setShowPreview(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                className="send-plan-btn"
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
