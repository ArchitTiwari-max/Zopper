'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import './Store.css';

interface StoreData {
  id: number;
  storeName: string;
  partnerBrand: string;
  city: string;
  visited: string;
  brandColor: string;
}

const Store: React.FC = () => {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedStores, setSelectedStores] = useState<number[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    storeName: '',
    city: 'All Cities',
    partnerBrand: 'All Brands',
    sortBy: 'Recently Visited First',
    date: '2025-03-23'
  });
  const [storeData, setStoreData] = useState<StoreData[]>([
    {
      id: 1,
      storeName: "Lucky Mobile Gallery",
      partnerBrand: "Samsung",
      city: "Ghaziabad",
      visited: "Today",
      brandColor: "#1f77b4"
    },
    {
      id: 2,
      storeName: "Techno Hub",
      partnerBrand: "Godrej",
      city: "Noida",
      visited: "1 day ago",
      brandColor: "#2ca02c"
    },
    {
      id: 3,
      storeName: "Digital Express",
      partnerBrand: "Vivo",
      city: "Delhi",
      visited: "1 day ago",
      brandColor: "#9467bd"
    },
    {
      id: 4,
      storeName: "Alpha Mobiles",
      partnerBrand: "Xiomi",
      city: "Noida",
      visited: "2 day ago",
      brandColor: "#ff7f0e"
    },
    {
      id: 5,
      storeName: "Mobile World",
      partnerBrand: "Realme",
      city: "Delhi",
      visited: "3 day ago",
      brandColor: "#d62728"
    },
    {
      id: 6,
      storeName: "Smart Zone",
      partnerBrand: "Oppo",
      city: "Delhi",
      visited: "3 day ago",
      brandColor: "#17becf"
    },
    {
      id: 7,
      storeName: "Galaxy Store",
      partnerBrand: "Oneplus",
      city: "Gurgaon",
      visited: "4 day ago",
      brandColor: "#1f77b4"
    },
    {
      id: 8,
      storeName: "Tech Paradise",
      partnerBrand: "Samsung",
      city: "Faridabad",
      visited: "4 day ago",
      brandColor: "#1f77b4"
    },
    {
      id: 9,
      storeName: "Galaxy Store",
      partnerBrand: "Oneplus",
      city: "Gurgaon",
      visited: "4 day ago",
      brandColor: "#1f77b4"
    },
    {
      id: 10,
      storeName: "Galaxy Store",
      partnerBrand: "Oneplus",
      city: "Gurgaon",
      visited: "4 day ago",
      brandColor: "#1f77b4"
    }
  ]);

  // Available filter options
  const cities = ['All Cities', 'Ghaziabad', 'Noida', 'Delhi', 'Gurgaon', 'Faridabad'];
  const brands = ['All Brands', 'Samsung', 'Godrej', 'Vivo', 'Xiomi', 'Realme', 'Oppo', 'Oneplus'];
  const sortOptions = ['Recently Visited First', 'Store Name A-Z', 'Store Name Z-A', 'City A-Z'];

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
    console.log('Selected stores:', selectedStores);
    // Handle preview and send logic here
    alert(`Sending visits for ${selectedStores.length} selected stores`);
    // Reset after sending
    setIsCreateMode(false);
    setSelectedStores([]);
  };

  const handleStoreSelection = (storeId: number) => {
    setSelectedStores(prev => {
      if (prev.includes(storeId)) {
        return prev.filter(id => id !== storeId);
      } else {
        return [...prev, storeId];
      }
    });
  };

  const handleStoreRowClick = (storeId: number, event: React.MouseEvent) => {
    // Don't navigate if clicking on checkbox in create mode or dropdown elements
    if (isCreateMode && (event.target as HTMLElement).tagName === 'INPUT') {
      return;
    }
    
    // Don't navigate if clicking on dropdown elements
    const target = event.target as HTMLElement;
    if (target.closest('.partner-dropdown') || target.closest('.dropdown-menu')) {
      return;
    }
    
    // If in create mode, toggle selection instead of navigating
    if (isCreateMode) {
      handleStoreSelection(storeId);
      return;
    }
    
    // Navigate to executive form
    router.push(`/executive/executive-form?storeId=${storeId}`);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleDropdownToggle = (storeId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setOpenDropdownId(openDropdownId === storeId ? null : storeId);
  };

  const handleBrandChange = (storeId: number, newBrand: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Brand colors mapping
    const brandColors: { [key: string]: string } = {
      'Samsung': '#1f77b4',
      'Godrej': '#2ca02c',
      'Vivo': '#9467bd',
      'Xiomi': '#ff7f0e',
      'Realme': '#d62728',
      'Oppo': '#17becf',
      'Oneplus': '#1f77b4'
    };
    
    // Update the store data with the new brand using state setter
    setStoreData(prevStoreData => 
      prevStoreData.map(store => 
        store.id === storeId 
          ? { 
              ...store, 
              partnerBrand: newBrand, 
              brandColor: brandColors[newBrand] || '#1f77b4' 
            }
          : store
      )
    );
    
    setOpenDropdownId(null);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdownId !== null) {
        setOpenDropdownId(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openDropdownId]);

  const filteredStores = storeData.filter(store => {
    const matchesName = store.storeName.toLowerCase().includes(filters.storeName.toLowerCase());
    const matchesCity = filters.city === 'All Cities' || store.city === filters.city;
    const matchesBrand = filters.partnerBrand === 'All Brands' || store.partnerBrand === filters.partnerBrand;
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
        return 0; // Keep original order for recently visited
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
            <button className="create-visit-btn" onClick={handleCreateVisit}>
              <span className="plus-icon">+</span>
              Create Visit
            </button>
          ) : (
            <div className="action-buttons">
              <button className="preview-send-btn" onClick={handlePreviewAndSend}>
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
                />
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Filter by City</label>
                <select
                  className="filter-select"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                >
                  {cities.map(city => (
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
                >
                  {brands.map(brand => (
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
                >
                  {sortOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Filter By Date</label>
                <div className="date-filter-container">
                  <input
                    type="date"
                    className="filter-date"
                    value={filters.date}
                    onChange={(e) => handleFilterChange('date', e.target.value)}
                  />
                  <span className="date-icon">📅</span>
                </div>
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
            {filteredStores.map((store) => (
              <div 
                key={store.id} 
                className={`table-row ${isCreateMode ? 'create-mode' : ''} ${selectedStores.includes(store.id) ? 'selected' : ''} ${!isCreateMode ? 'clickable' : ''} ${openDropdownId === store.id ? 'dropdown-open' : ''}`}
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
                  <div className="partner-brand">
                    <div 
                      className="partner-dropdown"
                      onClick={(e) => handleDropdownToggle(store.id, e)}
                    >
                      <span 
                        className="brand-text"
                        style={{ color: store.brandColor }}
                      >
                        {store.partnerBrand}
                      </span>
                      <span className="dropdown-arrow">▼</span>
                    </div>
                    {openDropdownId === store.id && (
                      <div className="dropdown-menu">
                        {brands.filter(brand => brand !== 'All Brands').map((brand) => (
                          <div
                            key={brand}
                            className={`dropdown-item ${brand === store.partnerBrand ? 'selected' : ''}`}
                            onClick={(e) => handleBrandChange(store.id, brand, e)}
                          >
                            {brand}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="table-cell city-cell">
                  <span className="city-text">{store.city}</span>
                </div>
                <div className="table-cell visited-cell">
                  <span className="visited-text">{store.visited}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Store;
