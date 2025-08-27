'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import './Dashboard.css';

interface BrandVisit {
  id: number;
  name: string;
  icon: string;
  visits: number;
  color: string;
  bgColor: string;
}

const Dashboard: React.FC = () => {
  const router = useRouter();
  const [brandFilter, setBrandFilter] = useState('All Brands');
  const [visitsPeriod, setVisitsPeriod] = useState('Last 30 Days');
  const [totalVisitsPeriod, setTotalVisitsPeriod] = useState('Last 30 Days');

  const allBrandVisits: BrandVisit[] = [
    {
      id: 1,
      name: 'Xiaomi',
      icon: 'X',
      visits: 15,
      color: '#fff',
      bgColor: '#ff4757'
    },
    {
      id: 2,
      name: 'OnePlus',
      icon: 'O',
      visits: 12,
      color: '#fff',
      bgColor: '#2ed573'
    },
    {
      id: 3,
      name: 'Vivo',
      icon: 'V',
      visits: 9,
      color: '#fff',
      bgColor: '#a55eea'
    },
    {
      id: 4,
      name: 'Oppo',
      icon: 'O',
      visits: 7,
      color: '#fff',
      bgColor: '#ffa502'
    },
    {
      id: 5,
      name: 'Realme',
      icon: 'R',
      visits: 6,
      color: '#fff',
      bgColor: '#ff6b9d'
    }
  ];

  // Filter brands based on selected filter
  const filteredBrandVisits = brandFilter === 'All Brands' 
    ? allBrandVisits 
    : allBrandVisits.filter(brand => brand.name === brandFilter);

  // Calculate total visits for the filtered period
  const totalVisitsForPeriod = () => {
    const multiplier = visitsPeriod === 'Last 7 Days' ? 0.3 : visitsPeriod === 'Last 90 Days' ? 3 : 1;
    return Math.round(95 * multiplier);
  };

  const totalVisitsForTotalPeriod = () => {
    const multiplier = totalVisitsPeriod === 'Last 7 Days' ? 0.25 : totalVisitsPeriod === 'Last 90 Days' ? 3.5 : 1;
    return Math.round(95 * multiplier);
  };

  const handleViewAllStores = () => {
    router.push('/executive/store');
  };

  const handleViewAllTasks = () => {
    router.push('/executive/executive-todo-list');
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        {/* Header Section */}
        <div className="dashboard-header">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Track visits, tasks, and overall progress at a glance</p>
        </div>

        {/* Brand-wise Visits Section */}
        <div className="dashboard-card">
          <div className="card-header">
            <div className="card-title-section">
              <div className="chart-icon">📊</div>
              <h2 className="card-title">Brand-wise Visits</h2>
            </div>
            <div className="filters">
              <select 
                className="filter-select"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
              >
                <option value="All Brands">All Brands</option>
                <option value="Xiaomi">Xiaomi</option>
                <option value="OnePlus">OnePlus</option>
                <option value="Vivo">Vivo</option>
                <option value="Oppo">Oppo</option>
                <option value="Realme">Realme</option>
              </select>
              <select 
                className="filter-select"
                value={visitsPeriod}
                onChange={(e) => setVisitsPeriod(e.target.value)}
              >
                <option value="Last 30 Days">Last 30 Days</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 90 Days">Last 90 Days</option>
              </select>
            </div>
          </div>
          
          <div className="brands-list">
            {filteredBrandVisits.map((brand) => (
              <div key={brand.id} className="brand-item">
                <div className="brand-info">
                  <div 
                    className="brand-icon"
                    style={{ backgroundColor: brand.bgColor, color: brand.color }}
                  >
                    {brand.icon}
                  </div>
                  <span className="brand-name">{brand.name}</span>
                </div>
                <div className="visit-badge">
                  {brand.visits} visits
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Visits Section */}
        <div className="dashboard-card">
          <div className="card-header">
            <div className="card-title-section">
              <div className="location-icon">📍</div>
              <h2 className="card-title">Total Visits</h2>
            </div>
            <div className="filters">
              <select 
                className="filter-select"
                value={totalVisitsPeriod}
                onChange={(e) => setTotalVisitsPeriod(e.target.value)}
              >
                <option value="Last 30 Days">Last 30 Days</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 90 Days">Last 90 Days</option>
              </select>
            </div>
          </div>
          
          <div className="total-visits-content">
            <div className="total-number">{totalVisitsForTotalPeriod()}</div>
            <div className="total-description">Total store visits completed</div>
            <button className="view-all-btn" onClick={handleViewAllStores}>View All Stores</button>
          </div>
        </div>

        {/* Assigned Tasks Section */}
        <div className="dashboard-card">
          <div className="card-header">
            <div className="card-title-section">
              <div className="tasks-icon">📋</div>
              <h2 className="card-title">Assigned Tasks</h2>
            </div>
          </div>
          
          <div className="tasks-content">
            <div className="pending-number">12</div>
            <div className="pending-description">Pending tasks to complete</div>
            <button className="view-all-btn" onClick={handleViewAllTasks}>View All Tasks</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
