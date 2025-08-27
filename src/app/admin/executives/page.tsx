'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExecutiveData, ExecutiveFilters, RegionFilterOption, ExecutiveStatusFilterOption, TimeframeOption } from '../types';
import '../styles.css';

// Mock data for executives
const mockExecutivesData: ExecutiveData[] = [
  {
    id: 1,
    name: 'Ramesh Kumar',
    initials: 'RK',
    region: 'East Delhi',
    partnerBrands: ['Samsung', 'Vivo'],
    totalVisits: 42,
    lastVisit: '2025-08-01',
    assignedStores: 'View All',
    status: 'Active',
    avatarColor: '#8B5CF6'
  },
  {
    id: 2,
    name: 'Neha Sharma',
    initials: 'NS',
    region: 'West Delhi',
    partnerBrands: ['Samsung', 'Vivo'],
    totalVisits: 35,
    lastVisit: '2025-07-28',
    assignedStores: 'View All',
    status: 'Active',
    avatarColor: '#EC4899'
  },
  {
    id: 3,
    name: 'Priya Singh',
    initials: 'PS',
    region: 'East Delhi',
    partnerBrands: ['Samsung', 'Vivo', 'Oppo'],
    totalVisits: 38,
    lastVisit: '2025-07-30',
    assignedStores: 'View All',
    status: 'Active',
    avatarColor: '#F59E0B'
  },
  {
    id: 4,
    name: 'Sunita Yadav',
    initials: 'SY',
    region: 'South Delhi',
    partnerBrands: ['Vivo', 'Oppo'],
    totalVisits: 44,
    lastVisit: '2025-08-01',
    assignedStores: 'View All',
    status: 'Active',
    avatarColor: '#8B5CF6'
  },
  {
    id: 5,
    name: 'Ankit Verma',
    initials: 'AV',
    region: 'South Delhi',
    partnerBrands: ['Vivo', 'Oppo'],
    totalVisits: 50,
    lastVisit: '2025-08-02',
    assignedStores: 'View All',
    status: 'Active',
    avatarColor: '#10B981'
  },
  {
    id: 6,
    name: 'Vikash Gupta',
    initials: 'VG',
    region: 'West Delhi',
    partnerBrands: ['Vivo', 'Oppo'],
    totalVisits: 29,
    lastVisit: '2025-07-26',
    assignedStores: 'View All',
    status: 'Inactive',
    avatarColor: '#6B7280'
  },
  {
    id: 7,
    name: 'Rohit Sharma',
    initials: 'RS',
    region: 'North Delhi',
    partnerBrands: ['Vivo', 'Oppo'],
    totalVisits: 33,
    lastVisit: '2025-07-29',
    assignedStores: 'View All',
    status: 'Inactive',
    avatarColor: '#6B7280'
  },
  {
    id: 8,
    name: 'Kavita Jain',
    initials: 'KJ',
    region: 'Central Delhi',
    partnerBrands: ['Vivo', 'Oppo'],
    totalVisits: 43,
    lastVisit: '2025-08-01',
    assignedStores: 'View All',
    status: 'Inactive',
    avatarColor: '#6B7280'
  }
];

const AdminExecutivesPage: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('Last 30 Days');
  const [executivesData, setExecutivesData] = useState<ExecutiveData[]>(mockExecutivesData);
  const [filteredExecutives, setFilteredExecutives] = useState<ExecutiveData[]>(mockExecutivesData);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [filters, setFilters] = useState<ExecutiveFilters>({
    executiveName: '',
    storeName: '',
    region: 'All Regions',
    status: 'All'
  });

  // Simulate data loading
  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setExecutivesData(mockExecutivesData);
      setIsLoading(false);
    }, 500);
  }, [selectedTimeframe]);

  // Apply filters when filters change
  useEffect(() => {
    let filtered = executivesData;

    if (filters.executiveName && filters.executiveName.trim() !== '') {
      filtered = filtered.filter(executive =>
        executive.name.toLowerCase().includes(filters.executiveName.toLowerCase())
      );
    }

    if (filters.region !== 'All Regions') {
      filtered = filtered.filter(executive => executive.region === filters.region);
    }

    if (filters.status !== 'All') {
      filtered = filtered.filter(executive => executive.status === filters.status);
    }

    setFilteredExecutives(filtered);
  }, [filters, executivesData]);

  const handleTimeframeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTimeframe(event.target.value as TimeframeOption);
  };

  const handleFilterChange = (filterType: keyof ExecutiveFilters, value: string) => {
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

  const getUniqueValues = (key: keyof ExecutiveData): string[] => {
    if (key === 'region') {
      return [...new Set(executivesData.map(executive => executive.region))];
    }
    if (key === 'status') {
      return [...new Set(executivesData.map(executive => executive.status))];
    }
    return [];
  };

  if (isLoading) {
    return (
      <div className="executives-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading executives...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="executives-overview">
      {/* Header Section */}
      <div className="executives-header">
        <div className="executives-header-content">
          <h2>Executive Dashboard</h2>
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
          <h3>Filters</h3>
        </div>
        <div className="executives-filters-grid">
          <div className="filter-group">
            <label>Filter by Executive Name</label>
            <input
              type="text"
              placeholder="Search by name..."
              value={filters.executiveName}
              onChange={(e) => handleFilterChange('executiveName', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Filter by Store Name</label>
            <input
              type="text"
              placeholder="Search by store name..."
              value={filters.storeName}
              onChange={(e) => handleFilterChange('storeName', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Filter by Region</label>
            <select 
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
              className="filter-select"
            >
              <option value="All Regions">All Regions</option>
              {getUniqueValues('region').map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Filter by Status</label>
            <select 
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-select"
            >
              <option value="All">All</option>
              {getUniqueValues('status').map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Executives Table */}
      <div className="executives-table-section">
        <div className="executives-table">
          <div className="table-header">
            <div className="header-cell">Name</div>
            <div className="header-cell">Region</div>
            <div className="header-cell">Partner Brands</div>
            <div className="header-cell">Total Visits</div>
            <div className="header-cell">Last Visit</div>
            <div className="header-cell">Assigned Stores</div>
          </div>
          
          <div className="table-body">
            {filteredExecutives.map(executive => (
              <div key={executive.id} className="table-row">
                <div className="cell executive-name-cell">
                  <div className="executive-avatar-container">
                    <div 
                      className="executive-avatar"
                      style={{ backgroundColor: executive.avatarColor }}
                    >
                      {executive.initials}
                    </div>
                    <div className="executive-info">
                      <Link href={`/admin/executives/${executive.id}`} className="executive-name-link">
                        <span className="executive-name">{executive.name}</span>
                      </Link>
                      <span 
                        className={`status-badge ${executive.status.toLowerCase()}`}
                      >
                        {executive.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="cell">{executive.region}</div>
                <div className="cell partner-brands-cell">
                  {executive.partnerBrands.map((brand, index) => (
                    <span 
                      key={index}
                      className="brand-tag"
                      style={{ backgroundColor: getBrandColor(brand) }}
                    >
                      {brand}
                    </span>
                  ))}
                </div>
                <div className="cell">{executive.totalVisits}</div>
                <div className="cell">{executive.lastVisit}</div>
                <div className="cell">
                  <button 
                    className="view-all-btn"
                    onClick={() => {
                      console.log(`View stores for ${executive.name}`);
                    }}
                    type="button"
                  >
                    {executive.assignedStores}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminExecutivesPage;
