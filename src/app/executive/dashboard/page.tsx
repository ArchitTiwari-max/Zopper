'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDateFilter } from '../contexts/DateFilterContext';
import DateFilter from '@/components/DateFilter/DateFilter';
import './Dashboard.css';
import PartnerBrandTypeVisitsExec from './components/PartnerBrandTypeVisitsExec';

interface Brand {
  id: string;
  name: string;
  category: string | null;
  visits: number;
}

interface DashboardStats {
  brandVisits: Brand[];
  totalVisits: number;
  tasks: {
    pending: number;
    completed: number;
    total: number;
  };
  period: string;
}

interface ApiResponse {
  success: boolean;
  data: DashboardStats;
  error?: string;
}

const Dashboard: React.FC = () => {
  const router = useRouter();
  const { selectedPeriod } = useDateFilter();
  const [brandFilter, setBrandFilter] = useState('All Brands');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Dynamic color palette for brands - 10 colors that cycle
  const colorPalette = [
    { bgColor: '#ff4757', color: '#fff' }, // Red
    { bgColor: '#2ed573', color: '#fff' }, // Green
    { bgColor: '#a55eea', color: '#fff' }, // Purple
    { bgColor: '#ffa502', color: '#fff' }, // Orange
    { bgColor: '#ff6b9d', color: '#fff' }, // Pink
    { bgColor: '#3742fa', color: '#fff' }, // Blue
    { bgColor: '#00d2d3', color: '#fff' }, // Teal
    { bgColor: '#4834d4', color: '#fff' }, // Indigo
    { bgColor: '#ff3838', color: '#fff' }, // Bright Red
    { bgColor: '#2f3542', color: '#fff' }  // Dark Gray
  ];

  // Get brand icon (first letter)
  const getBrandIcon = (brandName: string) => {
    return brandName.charAt(0).toUpperCase();
  };

  // Get brand colors using modulus for dynamic assignment
  const getBrandStyle = (index: number) => {
    return colorPalette[index % colorPalette.length];
  };

  // Fetch dashboard stats
  const fetchDashboardStats = async (period: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/executive/dashboard-stats?period=${encodeURIComponent(period)}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      
      if (result.success) {
        setStats(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch dashboard stats');
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  // Load stats on component mount and when date period changes
  useEffect(() => {
    fetchDashboardStats(selectedPeriod);
  }, [selectedPeriod]);

  // Filter brands based on selected filter
  const filteredBrandVisits = stats ? 
    (brandFilter === 'All Brands' 
      ? stats.brandVisits 
      : stats.brandVisits.filter(brand => brand.name === brandFilter)
    ) : [];

  // Get unique brand names for filter dropdown
  const uniqueBrandNames = stats ? 
    [...new Set(stats.brandVisits.map(brand => brand.name))].sort() : [];

  const handleViewAllStores = () => {
    router.push('/executive/store');
  };

  const handleViewAllTasks = () => {
    router.push('/executive/assinged-task');
  };

  const handleViewAllVisits = () => {
    router.push('/executive/visit-history');
  };

  const handleBrandClick = (brandName: string) => {
    router.push(`/executive/visit-history?brand=${encodeURIComponent(brandName)}`);
  };

  return (
    <div className="exec-dash-container">
      <div className="exec-dash-content">
        {/* Header Section */}
        <div className="exec-dash-header">
          <div className="exec-dash-title-section">
            <h1 className="exec-dash-title">Dashboard</h1>
            <p className="exec-dash-subtitle">Track visits, tasks, and overall progress at a glance</p>
          </div>
          <div className="exec-dash-date-filter">
            <DateFilter />
          </div>
        </div>

        {/* Partner Brand Type Visits (A+, A, B, C, D) - Assigned stores only */}
        <div className="exec-dash-dashboard-card">
          <div className="exec-dash-card-header">
            <div className="exec-dash-card-title-section">
              <div className="exec-dash-chart-icon">🏷️</div>
              <h2 className="exec-dash-card-title">Partner Brand Type Coverage</h2>
            </div>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            <PartnerBrandTypeVisitsExec />
          </div>
        </div>

        {/* Brand-wise Visits Section */}
        <div className="exec-dash-dashboard-card">
          <div className="exec-dash-card-header">
            <div className="exec-dash-card-title-section">
              <div className="exec-dash-chart-icon">📊</div>
              <h2 className="exec-dash-card-title">Brand-wise Visits</h2>
            </div>
            <div className="exec-dash-filters">
              <select 
                className="exec-dash-filter-select"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                disabled={loading}
              >
                <option value="All Brands">All Brands</option>
                {uniqueBrandNames.map(brandName => (
                  <option key={brandName} value={brandName}>{brandName}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="exec-dash-brands-list">
            {loading ? (
              <div className="exec-dash-loading-state">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading brand visits...</span>
              </div>
            ) : error ? (
              <div className="exec-dash-error-state">
                <span>Error: {error}</span>
                <button onClick={() => fetchDashboardStats(selectedPeriod)} className="exec-dash-retry-btn">
                  Retry
                </button>
              </div>
            ) : filteredBrandVisits.length === 0 ? (
              <div className="exec-dash-no-data-state">
                <span>No brand visits found for {selectedPeriod}</span>
              </div>
            ) : (
              filteredBrandVisits.map((brand, index) => {
                const brandStyle = getBrandStyle(index);
                return (
                  <div key={brand.id} className="exec-dash-brand-item exec-dash-clickable-brand" onClick={() => handleBrandClick(brand.name)}>
                    <div className="exec-dash-brand-info">
                      <div 
                        className="exec-dash-brand-icon"
                        style={{ backgroundColor: brandStyle.bgColor, color: brandStyle.color }}
                      >
                        {getBrandIcon(brand.name)}
                      </div>
                      <div className="exec-dash-brand-details">
                        <span className="exec-dash-brand-name">{brand.name}</span>
                        {brand.category && <span className="exec-dash-brand-category">{brand.category}</span>}
                      </div>
                    </div>
                    <div className="exec-dash-visit-badge">
                      {brand.visits} visits
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Total Visits Section */}
        <div className="exec-dash-dashboard-card exec-dash-clickable-card" onClick={handleViewAllVisits}>
          <div className="exec-dash-card-header">
            <div className="exec-dash-card-title-section">
              <div className="exec-dash-location-icon">📍</div>
              <h2 className="exec-dash-card-title">Total Visits</h2>
            </div>
          </div>
          
          <div className="exec-dash-total-visits-content">
            {loading ? (
              <div className="exec-dash-loading-inline">
                <div className="loading-spinner-large"></div>
              </div>
            ) : (
              <div className="exec-dash-total-number">{stats?.totalVisits || 0}</div>
            )}
            <div className="exec-dash-total-description">Total store visits completed</div>
            <button className="exec-dash-view-all-btn exec-dash-desktop-only" onClick={(e) => {e.stopPropagation(); handleViewAllStores();}}>View All Stores</button>
          </div>
        </div>

        {/* Assigned Tasks Section */}
        <div className="exec-dash-dashboard-card exec-dash-clickable-card" onClick={handleViewAllTasks}>
          <div className="exec-dash-card-header">
            <div className="exec-dash-card-title-section">
              <div className="exec-dash-tasks-icon">📋</div>
              <h2 className="exec-dash-card-title">Assigned Tasks</h2>
            </div>
          </div>
          
          <div className="exec-dash-tasks-content">
            {loading ? (
              <div className="exec-dash-loading-inline">
                <div className="loading-spinner-large"></div>
              </div>
            ) : (
              <div className="exec-dash-pending-number">{stats?.tasks.pending || 0}</div>
            )}
            <div className="exec-dash-pending-description">Pending tasks to complete</div>
            <button className="exec-dash-view-all-btn exec-dash-desktop-only" onClick={(e) => {e.stopPropagation(); handleViewAllTasks();}}>View All Tasks</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
