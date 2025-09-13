'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardData, TimeframeOption, BrandFilterOption } from '../types';
import { useDateFilter } from '../contexts/DateFilterContext';
import './page.css';

// Default empty dashboard data structure
const defaultDashboardData: DashboardData = {
  totalVisits: {
    count: 0,
    change: 'Loading...',
    trend: 'up'
  },
  pendingReviews: {
    count: 0,
    status: 'Loading...',
    trend: 'warning'
  },
  issuesReported: {
    count: 0,
    status: 'Loading...',
    trend: 'critical'
  },
  brandData: []
};

const AdminDashboardPage: React.FC = () => {
  const { selectedDateFilter } = useDateFilter();
  const [selectedBrand, setSelectedBrand] = useState<BrandFilterOption>('All Brands');
  const [dashboardData, setDashboardData] = useState<DashboardData>(defaultDashboardData);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from API with date filter
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/dashboard?dateFilter=${encodeURIComponent(selectedDateFilter)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies for authentication
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setDashboardData(data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
        // Keep default data structure on error
        setDashboardData(defaultDashboardData);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedDateFilter]);



  const handleBrandFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBrand(event.target.value as BrandFilterOption);
  };

  const filteredBrandData = selectedBrand === 'All Brands' 
    ? dashboardData.brandData 
    : dashboardData.brandData.filter(brand => brand.name === selectedBrand);

  // Show message if no brand data is available
  const noBrandData = !isLoading && !error && dashboardData.brandData.length === 0;

  // Show critical errors immediately
  if (error) {
    return (
      <div className="admin-dashboard-overview">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '400px', gap: '1rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#ef4444' }}>Error loading dashboard</div>
          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // OPTIMIZED: Show UI immediately, use separate loading states

  return (
    <div className="admin-dashboard-overview">

      {/* Metrics Cards */}
      <div className="admin-dashboard-metrics-grid">
        <Link href="/admin/visit-report" className="admin-dashboard-metric-card admin-dashboard-metric-card--clickable">
          <div className="admin-dashboard-metric-icon admin-dashboard-metric-icon--visits">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 9L12 6L16 10L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="admin-dashboard-metric-content">
            <h3>Total Visits</h3>
            <div className="admin-dashboard-metric-value">{dashboardData.totalVisits.count.toLocaleString()}</div>
            <div className="admin-dashboard-metric-change admin-dashboard-metric-change--positive">
              {dashboardData.totalVisits.change}
            </div>
          </div>
        </Link>

        <Link href="/admin/visit-report?visitStatus=PENDING_REVIEW" className="admin-dashboard-metric-card admin-dashboard-metric-card--clickable">
          <div className="admin-dashboard-metric-icon admin-dashboard-metric-icon--reviews">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="admin-dashboard-metric-content">
            <h3>Pending Reviews</h3>
            <div className="admin-dashboard-metric-value">{dashboardData.pendingReviews.count}</div>
            <div className="admin-dashboard-metric-status admin-dashboard-metric-status--warning">
              {dashboardData.pendingReviews.status}
            </div>
          </div>
        </Link>

        <Link href="/admin/issues?status=Pending" className="admin-dashboard-metric-card admin-dashboard-metric-card--clickable">
          <div className="admin-dashboard-metric-icon admin-dashboard-metric-icon--issues">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.29 3.86L1.82 18C1.64486 18.3024 1.55625 18.6453 1.56383 18.9945C1.57141 19.3437 1.67497 19.6829 1.86298 19.9790C2.05099 20.2751 2.31717 20.5164 2.63398 20.6769C2.9508 20.8375 3.30588 20.9116 3.66 20.89H20.34C20.6941 20.9116 21.0492 20.8375 21.366 20.6769C21.6828 20.5164 21.949 20.2751 22.137 19.9790C22.325 19.6829 22.4286 19.3437 22.4362 18.9945C22.4437 18.6453 22.3551 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15433C12.6817 2.98555 12.3438 2.89648 12 2.89648C11.6562 2.89648 11.3183 2.98555 11.0188 3.15433C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="admin-dashboard-metric-content">
            <h3>Issues Reported</h3>
            <div className="admin-dashboard-metric-value">{dashboardData.issuesReported.count}</div>
            <div className="admin-dashboard-metric-status admin-dashboard-metric-status--critical">
              {dashboardData.issuesReported.status}
            </div>
          </div>
        </Link>
      </div>

      {/* Brand-wise Visits Table */}
      <div className="admin-dashboard-brand-visits-section">
        <div className="admin-dashboard-section-header">
          <div className="admin-dashboard-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="12" y1="20" x2="12" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="18" y1="20" x2="18" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="6" y1="20" x2="6" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3>Brand-wise Visits</h3>
          </div>
          <div className="admin-dashboard-brand-filter">
            <select 
              value={selectedBrand} 
              onChange={handleBrandFilterChange}
              className="admin-dashboard-brand-select"
              disabled={isLoading}
            >
              <option value="All Brands">{isLoading ? 'Loading brands...' : 'All Brands'}</option>
              {!isLoading && dashboardData.brandData.map(brand => (
                <option key={brand.id} value={brand.name}>{brand.name}</option>
              ))}
            </select>
            {isLoading && (
              <div className="filter-loading">
                <div className="loading-spinner-small"></div>
              </div>
            )}
          </div>
        </div>

        <div className="admin-dashboard-brand-visits-table">
          {/* Always show table header for context */}
          <div className="admin-dashboard-table-header">
            <div className="admin-dashboard-header-cell">STORE NAME</div>
            <div className="admin-dashboard-header-cell">TOTAL BRAND VISITS</div>
            <div className="admin-dashboard-header-cell">UNIQUE STORE VISITS</div>
          </div>
          
          {/* Table body with loading state */}
          <div className="admin-dashboard-table-body">
            {isLoading ? (
              <div className="table-loading">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading brand data...</span>
              </div>
            ) : filteredBrandData.length > 0 ? (
              filteredBrandData.map(brand => (
                <Link 
                  key={brand.id} 
                  href={`/admin/visit-report?partnerBrand=${encodeURIComponent(brand.name)}`}
                  className="admin-dashboard-table-row admin-dashboard-table-row--clickable"
                  aria-label={`View visit reports for ${brand.name} - ${brand.visits} visits from ${brand.uniqueStores} stores`}
                >
                  <div className="admin-dashboard-cell admin-dashboard-cell--store-name">
                    <div 
                      className="admin-dashboard-brand-logo" 
                      style={{ backgroundColor: brand.color }}
                      role="img"
                      aria-label={`${brand.name} logo`}
                    >
                      {brand.logo}
                    </div>
                    <span className="admin-dashboard-brand-name">
                      {brand.name}
                    </span>
                  </div>
                  <div className="admin-dashboard-cell">
                    <span 
                      className="admin-dashboard-visit-badge" 
                      style={{ backgroundColor: brand.color }}
                    >
                      {brand.visits} visits
                    </span>
                  </div>
                  <div className="admin-dashboard-cell">{brand.uniqueStores}</div>
                </Link>
              ))
            ) : (
              <div style={{ 
                padding: '3rem', 
                textAlign: 'center', 
                color: '#64748b', 
                fontSize: '1rem' 
              }}>
                {noBrandData 
                  ? 'No brand data available for the selected time period.' 
                  : 'No brands found matching the selected filter.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
