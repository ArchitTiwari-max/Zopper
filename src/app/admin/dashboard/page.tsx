'use client';

import React, { useState, useEffect } from 'react';
import { DashboardData, TimeframeOption, BrandFilterOption } from '../types';
import './page.css';

// Mock data for demonstration
const mockDashboardData: DashboardData = {
  totalVisits: {
    count: 1247,
    change: '+12% from last week',
    trend: 'up'
  },
  pendingReviews: {
    count: 23,
    status: 'Needs attention',
    trend: 'warning'
  },
  activeExecutives: {
    count: 18,
    status: 'Currently in field',
    trend: 'active'
  },
  issuesReported: {
    count: 5,
    status: 'Requires resolution',
    trend: 'critical'
  },
  brandData: [
    { id: 1, name: 'OnePlus', logo: 'O', uniqueStores: 23, visits: 12, color: '#1DB584' },
    { id: 2, name: 'Vivo', logo: 'V', uniqueStores: 24, visits: 9, color: '#8B5CF6' },
    { id: 3, name: 'Oppo', logo: 'O', uniqueStores: 24, visits: 7, color: '#F97316' },
    { id: 4, name: 'Realme', logo: 'R', uniqueStores: 26, visits: 6, color: '#EC4899' },
    { id: 5, name: 'Godrej', logo: 'G', uniqueStores: 21, visits: 8, color: '#3B82F6' },
    { id: 6, name: 'Havells', logo: 'H', uniqueStores: 20, visits: 5, color: '#F97316' },
    { id: 7, name: 'Xiaomi', logo: 'X', uniqueStores: 25, visits: 15, color: '#EF4444' }
  ]
};

const AdminDashboardPage: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('Last 30 Days');
  const [selectedBrand, setSelectedBrand] = useState<BrandFilterOption>('All Brands');
  const [dashboardData, setDashboardData] = useState<DashboardData>(mockDashboardData);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Simulate data loading
  useEffect(() => {
    setIsLoading(true);
    // In a real app, you would fetch data from an API here
    setTimeout(() => {
      setDashboardData(mockDashboardData);
      setIsLoading(false);
    }, 500);
  }, [selectedTimeframe]);

  const handleTimeframeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTimeframe(event.target.value as TimeframeOption);
  };

  const handleBrandFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBrand(event.target.value as BrandFilterOption);
  };

  const filteredBrandData = selectedBrand === 'All Brands' 
    ? dashboardData.brandData 
    : dashboardData.brandData.filter(brand => brand.name === selectedBrand);

  if (isLoading) {
    return (
      <div className="dashboard-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-overview">
      <div className="overview-header">
        <div>
          <h2>Dashboard Overview</h2>
          <p>Monitor field activities and track executive performance</p>
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

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon visits">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 9L12 6L16 10L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-content">
            <h3>Total Visits</h3>
            <div className="metric-value">{dashboardData.totalVisits.count.toLocaleString()}</div>
            <div className="metric-change positive">
              {dashboardData.totalVisits.change}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon reviews">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-content">
            <h3>Pending Reviews</h3>
            <div className="metric-value">{dashboardData.pendingReviews.count}</div>
            <div className="metric-status warning">
              {dashboardData.pendingReviews.status}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon executives">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M23 21V19C23 18.1645 22.7155 17.3541 22.2094 16.6978C21.7033 16.0414 20.9999 15.5743 20.2 15.3706" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 3.13C16.8003 3.33284 17.5041 3.79979 18.0106 4.45635C18.5171 5.1129 18.8018 5.92338 18.8018 6.755C18.8018 7.58662 18.5171 8.3971 18.0106 9.05365C17.5041 9.71021 16.8003 10.1772 16 10.38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-content">
            <h3>Active Executives</h3>
            <div className="metric-value">{dashboardData.activeExecutives.count}</div>
            <div className="metric-status active">
              {dashboardData.activeExecutives.status}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon issues">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.29 3.86L1.82 18C1.64486 18.3024 1.55625 18.6453 1.56383 18.9945C1.57141 19.3437 1.67497 19.6829 1.86298 19.9790C2.05099 20.2751 2.31717 20.5164 2.63398 20.6769C2.9508 20.8375 3.30588 20.9116 3.66 20.89H20.34C20.6941 20.9116 21.0492 20.8375 21.366 20.6769C21.6828 20.5164 21.949 20.2751 22.137 19.9790C22.325 19.6829 22.4286 19.3437 22.4362 18.9945C22.4437 18.6453 22.3551 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15433C12.6817 2.98555 12.3438 2.89648 12 2.89648C11.6562 2.89648 11.3183 2.98555 11.0188 3.15433C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="metric-content">
            <h3>Issues Reported</h3>
            <div className="metric-value">{dashboardData.issuesReported.count}</div>
            <div className="metric-status critical">
              {dashboardData.issuesReported.status}
            </div>
          </div>
        </div>
      </div>

      {/* Brand-wise Visits Table */}
      <div className="brand-visits-section">
        <div className="section-header">
          <div className="section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="12" y1="20" x2="12" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="18" y1="20" x2="18" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="6" y1="20" x2="6" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3>Brand-wise Visits</h3>
          </div>
          <div className="brand-filter">
            <select 
              value={selectedBrand} 
              onChange={handleBrandFilterChange}
              className="brand-select"
            >
              <option value="All Brands">All Brands</option>
              {dashboardData.brandData.map(brand => (
                <option key={brand.id} value={brand.name}>{brand.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="brand-visits-table">
          <div className="table-header">
            <div className="header-cell">STORE NAME</div>
            <div className="header-cell">UNIQUE STORES VISITED</div>
            <div className="header-cell">EXECUTIVE</div>
            <div className="header-cell">ASSIGNED TO</div>
          </div>
          
          <div className="table-body">
            {filteredBrandData.map(brand => (
              <div key={brand.id} className="table-row">
                <div className="cell store-name">
                  <div 
                    className="brand-logo" 
                    style={{ backgroundColor: brand.color }}
                    role="img"
                    aria-label={`${brand.name} logo`}
                  >
                    {brand.logo}
                  </div>
                  <span>{brand.name}</span>
                </div>
                <div className="cell">{brand.uniqueStores}</div>
                <div className="cell">
                  <button 
                    className="view-all-btn"
                    onClick={() => {
                      // Handle view all click - could navigate to executives page
                      console.log(`View all executives for ${brand.name}`);
                    }}
                    type="button"
                  >
                    View All
                  </button>
                </div>
                <div className="cell">
                  <span 
                    className="visit-badge" 
                    style={{ backgroundColor: brand.color }}
                  >
                    {brand.visits} visits
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
