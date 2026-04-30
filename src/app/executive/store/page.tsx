'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRAGEmoji, RAGStorePerformance } from '@/lib/ragUtils';
import './Store.css';
import { 
  Menu, 
  ChevronDown, 
  Plus, 
  Sparkles, 
  ClipboardList, 
  Users,
  X
} from 'lucide-react';
import Swal from 'sweetalert2';
import SuggestPJP from './SuggestPJP';
import SubmittedPJPModal from './SubmittedPJPModal';
import UpdateCoordinatesModal from './UpdateCoordinatesModal';

interface StoreData {
  id: string;
  storeName: string;
  city: string;
  fullAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
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
  const [isSuggestMode, setIsSuggestMode] = useState(false);
  const [showSubmittedModal, setShowSubmittedModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [plannedVisitDate, setPlannedVisitDate] = useState<string>(''); // Will be set in useEffect
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [coordinateStore, setCoordinateStore] = useState<StoreData | null>(null);

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

  const checkDeviationAndProceed = async (callback: () => void) => {
    try {
      setLoading(true);
      const res = await fetch('/api/executive/pjp-deviation');
      if (res.ok) {
        const data = await res.json();
        if (data.hasDeviation) {
          setLoading(false);
          Swal.fire({
            title: '⚠️ Action Blocked',
            text: 'You cannot create a new PJP because you have not submitted a reason for your recent unfulfilled PJP. Please provide the reason first.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#6366f1',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Go to Submitted PJPs',
            cancelButtonText: 'Close'
          }).then((result) => {
            if (result.isConfirmed) {
              setShowSubmittedModal(true);
            }
          });
          return;
        }
      }
    } catch (err) {
      console.error('Error checking deviation:', err);
    } finally {
      setLoading(false);
    }
    
    // No deviation or error, proceed
    callback();
  };

  const handleCreateVisit = () => {
    checkDeviationAndProceed(() => setIsCreateMode(true));
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

  const isPastDeadline = (() => {
    if (!plannedVisitDate) return false;
    const parts = plannedVisitDate.split('-');
    if (parts.length !== 3) return false;
    const [year, month, day] = parts.map(Number);
    const deadlineUTC = new Date(Date.UTC(year, month - 1, day, 6, 30, 0, 0));
    return new Date() >= deadlineUTC;
  })();

  // Shared submit function — used by both Create PJP and Suggest PJP
  const submitVisitPlan = async (storeIds: string[], date: string): Promise<void> => {
    if (storeIds.length === 0) return;

    if (!date) {
      alert('Please select a planned visit date before submitting.');
      return;
    }

    // Validate that the planned date is not in the past (using local date)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayLocal = `${year}-${month}-${day}`;

    if (date < todayLocal) {
      alert('❌ Past date not allowed. Please select today or a future date.');
      return;
    }

    try {
      setSubmitting(true);

      const url = editingPlanId 
        ? `/api/executive/visit-plan/${editingPlanId}` 
        : '/api/executive/visit-plan';
      
      const method = editingPlanId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ storeIds, plannedVisitDate: date })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert(`✅ Visit plan submitted successfully! ${storeIds.length} stores scheduled for visits.`);
          // Reset all modes
          setIsCreateMode(false);
          setIsSuggestMode(false);
          setEditingPlanId(null);
          setSelectedStores([]);
          const t = new Date();
          const y = t.getFullYear();
          const mo = String(t.getMonth() + 1).padStart(2, '0');
          const d = String(t.getDate()).padStart(2, '0');
          setPlannedVisitDate(`${y}-${mo}-${d}`);
          setShowPreview(false);
        } else {
          const msg = result.details ? `${result.error}: ${result.details}` : (result.error || 'Failed to submit visit plan');
          throw new Error(msg);
        }
      } else {
        const errResult = await response.json();
        const msg = errResult.details ? `${errResult.error}: ${errResult.details}` : (errResult.error || 'Failed to submit visit plan');
        throw new Error(msg);
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to submit visit plan'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVisitPlan = async () => {
    await submitVisitPlan(selectedStores, plannedVisitDate);
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
            <div className="exec-header-menu-container">
              <button 
                className="exec-header-menu-btn" 
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <Menu size={18} />
                Actions
                <ChevronDown size={14} className={`menu-arrow ${menuOpen ? 'open' : ''}`} />
              </button>

              {menuOpen && (
                <>
                  <div className="exec-menu-overlay" onClick={() => setMenuOpen(false)} />
                  <div className="exec-header-dropdown">
                    <button 
                      className="exec-dropdown-item"
                      onClick={() => { handleCreateVisit(); setMenuOpen(false); }}
                    >
                      <Plus size={16} />
                      Create PJP
                    </button>
                    <button 
                      className="exec-dropdown-item"
                      onClick={() => { setMenuOpen(false); checkDeviationAndProceed(() => setIsSuggestMode(true)); }}
                    >
                      <Sparkles size={16} />
                      Suggest PJP
                    </button>
                    <button 
                      className="exec-dropdown-item"
                      onClick={() => { setShowSubmittedModal(true); setMenuOpen(false); }}
                    >
                      <ClipboardList size={16} />
                      Submitted PJPs
                    </button>
                    
                    <div className="exec-dropdown-divider" />
                    
                    <button 
                      className="exec-dropdown-item primary"
                      onClick={() => { router.push('/executive/alignment'); setMenuOpen(false); }}
                    >
                      <Users size={16} />
                      Store Alignment
                    </button>
                  </div>
                </>
              )}
            </div>
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
                      {!isCreateMode && (
                        <button
                          className="store-coords-btn"
                          title={store.latitude != null ? `Coords: ${store.latitude.toFixed(4)}, ${store.longitude?.toFixed(4)}` : 'No coordinates — click to fix'}
                          onClick={(e) => { e.stopPropagation(); setCoordinateStore(store); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            marginLeft: '4px',
                            fontSize: '15px',
                            opacity: store.latitude != null ? 0.6 : 1,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          📍
                        </button>
                      )}
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

      {/* Suggest PJP Modal */}
      {isSuggestMode && (
        <SuggestPJP
          allStores={storeData.map(s => ({
            id: s.id,
            storeName: s.storeName,
            city: s.city,
            visited: s.visited,
            lastVisitDate: s.lastVisitDate ? s.lastVisitDate.toString() : null,
          }))}
          onClose={() => setIsSuggestMode(false)}
          onSubmit={submitVisitPlan}
          submitting={submitting}
        />
      )}

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
                  💡 <strong>Note:</strong> Submitting this visit plan will notify all admins about your intended store visits. You can edit this plan until 12:00 PM IST of the planned date.
                </p>
                {isPastDeadline && (
                  <div className="exec-v-form-error-state" style={{ marginTop: '12px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                    <div className="exec-v-form-error-icon" style={{ fontSize: '1.2rem' }}>⚠️</div>
                    <p className="exec-v-form-error-text" style={{ margin: 0, color: '#991b1b', fontWeight: '500' }}>
                      <strong>Deadline Passed:</strong> You cannot submit or edit a PJP for this date after 12:00 PM IST.
                    </p>
                  </div>
                )}
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
                disabled={submitting || !plannedVisitDate}
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

      {/* Submitted PJPs Modal */}
      <SubmittedPJPModal
        isOpen={showSubmittedModal}
        onClose={() => setShowSubmittedModal(false)}
        onEdit={(plan) => {
          setShowSubmittedModal(false);
          // Pre-select stores and enter create mode
          const storeIds = plan.stores.map((s: any) => s.id);
          setSelectedStores(storeIds);
          
          // Extract the YYYY-MM-DD format from the ISO string
          const dateString = plan.plannedVisitDate.split('T')[0];
          setPlannedVisitDate(dateString);
          
          setEditingPlanId(plan.id);
          setIsCreateMode(true);
        }}
      />

      {/* Update Coordinates Modal */}
      {coordinateStore && (
        <UpdateCoordinatesModal
          storeId={coordinateStore.id}
          storeName={coordinateStore.storeName}
          city={coordinateStore.city}
          currentLat={coordinateStore.latitude}
          currentLng={coordinateStore.longitude}
          onClose={() => setCoordinateStore(null)}
          onSuccess={(storeId, latitude, longitude) => {
            setStoreData(prev =>
              prev.map(s => s.id === storeId ? { ...s, latitude, longitude } : s)
            );
          }}
        />
      )}
    </div>
  );
};

export default Store;
