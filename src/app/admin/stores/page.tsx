'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StoreData, StoreFilters, PartnerBrandOption, CityFilterOption, StoreNameFilterOption, ExecutiveFilterOption, StatusFilterOption, TimeframeOption } from '../types';
import '../styles.css';

// Mock data for stores
const mockStoresData: StoreData[] = [
  {
    id: 1,
    storeName: 'Lucky Mobile Gallery',
    partnerBrands: ['Samsung', 'Vivo'],
    address: 'Ghaziabad, Uttar Pradesh',
    contactPerson: 'Mr. Sharma',
    assignedTo: 'View All',
    pendingReviews: 3,
    pendingIssues: 3,
    city: 'Ghaziabad',
    status: 'Active'
  },
  {
    id: 2,
    storeName: 'Techno Hub',
    partnerBrands: ['Oppo'],
    address: 'Noida Sector 18',
    contactPerson: 'Ms. Anjali',
    assignedTo: 'View All',
    pendingReviews: 2,
    pendingIssues: 2,
    city: 'Noida',
    status: 'Active'
  },
  {
    id: 3,
    storeName: 'Digital Express',
    partnerBrands: ['Vivo', 'Oppo'],
    address: 'Lajpat Nagar, Delhi',
    contactPerson: 'Mr. Raj',
    assignedTo: 'View All',
    pendingReviews: 2,
    pendingIssues: 2,
    city: 'Delhi',
    status: 'Active'
  },
  {
    id: 4,
    storeName: 'Alpha Mobiles',
    partnerBrands: ['Vivo'],
    address: 'Sector 62, Noida',
    contactPerson: 'Mrs. Neha',
    assignedTo: 'View All',
    pendingReviews: 2,
    pendingIssues: 1,
    city: 'Noida',
    status: 'Active'
  },
  {
    id: 5,
    storeName: 'Mobile World',
    partnerBrands: ['Samsung', 'Vivo', 'Oppo'],
    address: 'Connaught Place, Delhi',
    contactPerson: 'Mr. Gupta',
    assignedTo: 'View All',
    pendingReviews: 2,
    pendingIssues: 0,
    city: 'Delhi',
    status: 'Active'
  },
  {
    id: 6,
    storeName: 'Smart Zone',
    partnerBrands: ['Samsung'],
    address: 'Dwarka Sector 21, Delhi',
    contactPerson: 'Ms. Priya',
    assignedTo: 'View All',
    pendingReviews: 0,
    pendingIssues: 0,
    city: 'Delhi',
    status: 'Inactive'
  },
  {
    id: 7,
    storeName: 'Galaxy Store',
    partnerBrands: ['Samsung', 'Oppo'],
    address: 'Gurgaon Sector 14',
    contactPerson: 'Mr. Singh',
    assignedTo: 'View All',
    pendingReviews: 0,
    pendingIssues: 0,
    city: 'Gurgaon',
    status: 'Inactive'
  },
  {
    id: 8,
    storeName: 'Tech Paradise',
    partnerBrands: ['Vivo'],
    address: 'Faridabad Main Market',
    contactPerson: 'Mrs. Kumari',
    assignedTo: 'View All',
    pendingReviews: 0,
    pendingIssues: 0,
    city: 'Faridabad',
    status: 'Inactive'
  }
];

const AdminStoresPage: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('Last 30 Days');
  const [storesData, setStoresData] = useState<StoreData[]>(mockStoresData);
  const [filteredStores, setFilteredStores] = useState<StoreData[]>(mockStoresData);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [filters, setFilters] = useState<StoreFilters>({
    partnerBrand: 'All Brands',
    city: 'All City',
    storeName: 'All Store',
    executiveName: 'All Executive',
    status: 'All Status'
  });

  // Simulate data loading
  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setStoresData(mockStoresData);
      setIsLoading(false);
    }, 500);
  }, [selectedTimeframe]);

  // Apply filters when filters change
  useEffect(() => {
    let filtered = storesData;

    if (filters.partnerBrand !== 'All Brands') {
      filtered = filtered.filter(store => 
        store.partnerBrands.includes(filters.partnerBrand)
      );
    }

    if (filters.city !== 'All City') {
      filtered = filtered.filter(store => store.city === filters.city);
    }

    if (filters.storeName !== 'All Store') {
      filtered = filtered.filter(store => 
        store.storeName.toLowerCase().includes(filters.storeName.toLowerCase())
      );
    }

    if (filters.status !== 'All Status') {
      filtered = filtered.filter(store => store.status === filters.status);
    }

    setFilteredStores(filtered);
  }, [filters, storesData]);

  const handleTimeframeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTimeframe(event.target.value as TimeframeOption);
  };

  const handleFilterChange = (filterType: keyof StoreFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
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

  const getUniqueValues = (key: keyof StoreData): string[] => {
    if (key === 'partnerBrands') {
      const allBrands = storesData.flatMap(store => store.partnerBrands);
      return [...new Set(allBrands)];
    }
    if (key === 'city') {
      return [...new Set(storesData.map(store => store.city))];
    }
    if (key === 'status') {
      return [...new Set(storesData.map(store => store.status))];
    }
    return [];
  };

  if (isLoading) {
    return (
      <div className="stores-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading stores...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="stores-overview">
      {/* Header Section */}
      <div className="stores-header">
        <div className="stores-header-content">
          <h2>Stores</h2>
        </div>
        <div className="date-selector">
          <label htmlFor="timeframe-select">Date</label>
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

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-header">
          <h3>Filters ▼</h3>
        </div>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Filter by Partner Brand</label>
            <select 
              value={filters.partnerBrand}
              onChange={(e) => handleFilterChange('partnerBrand', e.target.value)}
              className="filter-select"
            >
              <option value="All Brands">All Brands</option>
              {getUniqueValues('partnerBrands').map(brand => (
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
              {getUniqueValues('city').map(city => (
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
            </select>
          </div>

          <div className="filter-group">
            <label>Filter by Executive Name</label>
            <select 
              value={filters.executiveName}
              onChange={(e) => handleFilterChange('executiveName', e.target.value)}
              className="filter-select"
            >
              <option value="All Executive">All Executive</option>
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
        </div>
      </div>

      {/* Stores Table */}
      <div className="stores-table-section">
        <div className="stores-table">
          <div className="table-header">
            <div className="header-cell">STORE NAME</div>
            <div className="header-cell">PARTNER BRANDS</div>
            <div className="header-cell">ADDRESS</div>
            <div className="header-cell">CONTACT PERSON</div>
            <div className="header-cell">ASSIGNED TO</div>
            <div className="header-cell">Pending Reviews</div>
            <div className="header-cell">PENDING ISSUES</div>
          </div>
          
          <div className="table-body">
            {filteredStores.map(store => (
              <div key={store.id} className="table-row">
                <div className="cell store-name-cell">
                  <Link href={`/admin/stores/${store.id}`} className="store-name-link">
                    {store.storeName}
                  </Link>
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
                <div className="cell">{store.contactPerson}</div>
                <div className="cell">
                  <button 
                    className="view-all-btn"
                    onClick={() => {
                      console.log(`View executives for ${store.storeName}`);
                    }}
                    type="button"
                  >
                    {store.assignedTo}
                  </button>
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStoresPage;
