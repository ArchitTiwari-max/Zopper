'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExecutiveDetailData, ExecutiveDetailFilters, ExecutiveVisitDetail } from '../../types';
import './page.css';

// Mock data for executive details
const mockExecutiveDetailData: Record<number, ExecutiveDetailData> = {
  1: {
    id: 1,
    name: 'Ramesh Kumar',
    employeeId: 'EMP001',
    region: 'East Delhi',
    email: 'ramesh.kumar@zoppertrack.com',
    phone: '+91 9876543210',
    joinDate: '2023-06-15',
    status: 'Active',
    initials: 'RK',
    avatarColor: '#8B5CF6',
    partnerBrands: ['Samsung', 'Vivo'],
    assignedStores: [
      { id: 1, name: 'Lucky Mobile Gallery', address: 'Ghaziabad, Uttar Pradesh', lastVisit: '2025-08-01', totalVisits: 15, pendingReviews: 2, status: 'Active' },
      { id: 2, name: 'Techno Hub', address: 'Noida Sector 18', lastVisit: '2025-07-28', totalVisits: 12, pendingReviews: 1, status: 'Active' },
      { id: 3, name: 'Digital Express', address: 'Lajpat Nagar, Delhi', lastVisit: '2025-07-25', totalVisits: 15, pendingReviews: 1, status: 'Active' }
    ],
    performanceMetrics: {
      totalVisits: 42,
      thisMonth: 8,
      pendingReviews: 4,
      completedReviews: 38,
      averageRating: 4.2,
      storesAssigned: 3,
      issuesReported: 5,
      issuesResolved: 4
    },
    recentVisits: [
      {
        id: 101,
        storeId: 1,
        storeName: 'Lucky Mobile Gallery',
        visitDate: '2025-08-01',
        visitTime: '2:30 PM',
        personMet: 'Mr. Sharma',
        personRole: 'Store Manager',
        purpose: 'Monthly Review',
        feedback: 'Store displays are well organized. Samsung section needs better lighting.',
        issues: 'None',
        photos: 5,
        displaySetup: 'Excellent',
        reviewStatus: 'Reviewed',
        createdAt: '2025-08-01T14:30:00Z'
      },
      {
        id: 102,
        storeId: 2,
        storeName: 'Techno Hub',
        visitDate: '2025-07-28',
        visitTime: '11:00 AM',
        personMet: 'Ms. Anjali',
        personRole: 'Assistant Manager',
        purpose: 'Display Setup Check',
        feedback: 'Good customer engagement. Need to improve Vivo display positioning.',
        issues: 'Display positioning needs adjustment',
        photos: 3,
        displaySetup: 'Good',
        reviewStatus: 'Pending Review',
        createdAt: '2025-07-28T11:00:00Z'
      }
    ]
  },
  2: {
    id: 2,
    name: 'Neha Sharma',
    employeeId: 'EMP002',
    region: 'West Delhi',
    email: 'neha.sharma@zoppertrack.com',
    phone: '+91 9876543211',
    joinDate: '2023-03-20',
    status: 'Active',
    initials: 'NS',
    avatarColor: '#EC4899',
    partnerBrands: ['Samsung', 'Vivo'],
    assignedStores: [
      { id: 4, name: 'Alpha Mobiles', address: 'Sector 62, Noida', lastVisit: '2025-07-28', totalVisits: 18, pendingReviews: 1, status: 'Active' },
      { id: 5, name: 'Mobile World', address: 'Connaught Place, Delhi', lastVisit: '2025-07-26', totalVisits: 17, pendingReviews: 1, status: 'Active' }
    ],
    performanceMetrics: {
      totalVisits: 35,
      thisMonth: 6,
      pendingReviews: 2,
      completedReviews: 33,
      averageRating: 4.5,
      storesAssigned: 2,
      issuesReported: 3,
      issuesResolved: 3
    },
    recentVisits: []
  }
  // Add more executives as needed
};

const ExecutiveDetailPage: React.FC = () => {
  const params = useParams();
  const executiveId = parseInt(params.id as string);
  
  const [executiveData, setExecutiveData] = useState<ExecutiveDetailData | null>(null);
  const [filteredVisits, setFilteredVisits] = useState<ExecutiveVisitDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [filters, setFilters] = useState<ExecutiveDetailFilters>({
    storeName: 'All Stores',
    status: 'All Status',
    dateRange: 'Last 30 Days'
  });

  // Load executive data
  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      const data = mockExecutiveDetailData[executiveId];
      setExecutiveData(data || null);
      setIsLoading(false);
    }, 500);
  }, [executiveId]);

  // Apply filters to visits
  useEffect(() => {
    if (!executiveData) return;
    
    let filtered = executiveData.recentVisits;
    
    if (filters.storeName !== 'All Stores') {
      filtered = filtered.filter(visit => 
        visit.storeName.toLowerCase().includes(filters.storeName.toLowerCase())
      );
    }
    
    if (filters.status !== 'All Status') {
      filtered = filtered.filter(visit => visit.reviewStatus === filters.status);
    }
    
    setFilteredVisits(filtered);
  }, [filters, executiveData]);

  const handleFilterChange = (filterType: keyof ExecutiveDetailFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleMarkReviewed = (visitId: number) => {
    if (!executiveData) return;
    
    const updatedVisits = executiveData.recentVisits.map(visit =>
      visit.id === visitId
        ? { ...visit, reviewStatus: 'Reviewed' as const }
        : visit
    );
    
    setExecutiveData({
      ...executiveData,
      recentVisits: updatedVisits
    });
    
    console.log(`Visit ${visitId} marked as reviewed`);
  };

  if (isLoading) {
    return (
      <div className="executive-detail-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading executive details...</div>
        </div>
      </div>
    );
  }

  if (!executiveData) {
    return (
      <div className="executive-detail-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Executive not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="executive-detail-overview">
      {/* Header Section */}
      <div className="executive-detail-header">
        <div className="back-navigation">
          <Link href="/admin/executives" className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back to Executives
          </Link>
        </div>
        <div className="executive-detail-title">
          <h2>{executiveData.name} - Executive Profile</h2>
          <p>Comprehensive performance and activity overview</p>
        </div>
      </div>

      {/* Executive Profile Card */}
      <div className="executive-profile-card">
        <div className="profile-header">
          <div className="profile-avatar-section">
            <div 
              className="profile-avatar"
              style={{ backgroundColor: executiveData.avatarColor }}
            >
              {executiveData.initials}
            </div>
            <div className="profile-basic-info">
              <h3>{executiveData.name}</h3>
              <div className="profile-details">
                <span className="employee-id">ID: {executiveData.employeeId}</span>
                <span className={`status-badge ${executiveData.status.toLowerCase()}`}>
                  {executiveData.status}
                </span>
              </div>
            </div>
          </div>
          <div className="profile-contact-info">
            <div className="contact-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span>{executiveData.region}</span>
            </div>
            <div className="contact-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              <span>{executiveData.email}</span>
            </div>
            <div className="contact-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
              <span>{executiveData.phone}</span>
            </div>
            <div className="contact-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zm2.5-9L12 0 2.5 2v2h19V2z"/>
              </svg>
              <span>Joined: {new Date(executiveData.joinDate).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        <div className="profile-brands">
          <h4>Partner Brands</h4>
          <div className="brands-list">
            {executiveData.partnerBrands.map((brand, index) => (
              <span 
                key={index} 
                className="brand-tag"
                style={{ backgroundColor: getBrandColor(brand) }}
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-metrics-section">
        <h3>Performance Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon visits">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h4>Total Visits</h4>
              <div className="metric-value">{executiveData.performanceMetrics.totalVisits}</div>
              <div className="metric-change positive">This month: {executiveData.performanceMetrics.thisMonth}</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon reviews">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2C6.5,2,2,6.5,2,12s4.5,10,10,10s10-4.5,10-10S17.5,2,12,2z M12,20c-4.4,0-8-3.6-8-8s3.6-8,8-8s8,3.6,8,8S16.4,20,12,20z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h4>Pending Reviews</h4>
              <div className="metric-value">{executiveData.performanceMetrics.pendingReviews}</div>
              <div className="metric-status warning">Completed: {executiveData.performanceMetrics.completedReviews}</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon executives">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h4>Assigned Stores</h4>
              <div className="metric-value">{executiveData.performanceMetrics.storesAssigned}</div>
              <div className="metric-status active">All Active</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon issues">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
            </div>
            <div className="metric-content">
              <h4>Issues Reported</h4>
              <div className="metric-value">{executiveData.performanceMetrics.issuesReported}</div>
              <div className="metric-status active">Resolved: {executiveData.performanceMetrics.issuesResolved}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Stores */}
      <div className="assigned-stores-section">
        <h3>Assigned Stores</h3>
        <div className="stores-grid">
          {executiveData.assignedStores.map((store) => (
            <div key={store.id} className="store-card">
              <div className="store-header">
                <h4>
                  <Link href={`/admin/stores/${store.id}`} className="store-link">
                    {store.name}
                  </Link>
                </h4>
                <span className={`status-badge ${store.status.toLowerCase()}`}>
                  {store.status}
                </span>
              </div>
              <p className="store-address">{store.address}</p>
              <div className="store-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Visits:</span>
                  <span className="stat-value">{store.totalVisits}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Last Visit:</span>
                  <span className="stat-value">{new Date(store.lastVisit).toLocaleDateString()}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Pending Reviews:</span>
                  <span className={`stat-value ${store.pendingReviews > 0 ? 'pending' : 'clear'}`}>
                    {store.pendingReviews}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visit History Filters */}
      <div className="visit-history-filters">
        <h3>Visit History</h3>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Filter by Store</label>
            <select 
              value={filters.storeName}
              onChange={(e) => handleFilterChange('storeName', e.target.value)}
              className="filter-select"
            >
              <option value="All Stores">All Stores</option>
              {executiveData.assignedStores.map(store => (
                <option key={store.id} value={store.name}>{store.name}</option>
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
              <option value="All Status">All Status</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Issues Reported">Issues Reported</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Date Range</label>
            <select 
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="filter-select"
            >
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Last 90 Days">Last 90 Days</option>
              <option value="All Time">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visit History Table */}
      <div className="visit-history-table-section">
        <div className="visit-history-table">
          <div className="table-header">
            <div className="header-cell">STORE</div>
            <div className="header-cell">VISIT DATE</div>
            <div className="header-cell">PERSON MET</div>
            <div className="header-cell">PURPOSE</div>
            <div className="header-cell">FEEDBACK</div>
            <div className="header-cell">STATUS</div>
            <div className="header-cell">ACTIONS</div>
          </div>
          
          <div className="table-body">
            {filteredVisits.length === 0 ? (
              <div className="no-visits">
                <p>No visits found matching the selected filters.</p>
              </div>
            ) : (
              filteredVisits.map(visit => (
                <div key={visit.id} className="table-row">
                  <div className="cell">
                    <Link href={`/admin/stores/${visit.storeId}`} className="store-link">
                      {visit.storeName}
                    </Link>
                  </div>
                  <div className="cell">
                    <div className="visit-date-info">
                      <div className="visit-date">{new Date(visit.visitDate).toLocaleDateString()}</div>
                      <div className="visit-time">{visit.visitTime}</div>
                    </div>
                  </div>
                  <div className="cell">
                    <div className="person-info">
                      <div className="person-name">{visit.personMet}</div>
                      <div className="person-role">{visit.personRole}</div>
                    </div>
                  </div>
                  <div className="cell purpose-cell">
                    {visit.purpose}
                  </div>
                  <div className="cell feedback-cell">
                    {visit.feedback.length > 50 
                      ? `${visit.feedback.substring(0, 50)}...` 
                      : visit.feedback
                    }
                  </div>
                  <div className="cell status-cell">
                    <span className={`review-status-badge review-status-${visit.reviewStatus.toLowerCase().replace(' ', '-')}`}>
                      {visit.reviewStatus}
                    </span>
                  </div>
                  <div className="cell actions-cell">
                    <button 
                      className="view-details-btn"
                      onClick={() => console.log(`View details for visit ${visit.id}`)}
                      type="button"
                    >
                      View Details
                    </button>
                    {visit.reviewStatus === 'Pending Review' && (
                      <button 
                        className="mark-reviewed-btn"
                        onClick={() => handleMarkReviewed(visit.id)}
                        type="button"
                      >
                        Mark Reviewed
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function for brand colors
function getBrandColor(brand: string): string {
  const brandColors: Record<string, string> = {
    'Samsung': '#1DB584',
    'Vivo': '#8B5CF6',
    'Oppo': '#F97316',
    'OnePlus': '#1DB584',
    'Realme': '#EC4899',
    'Xiaomi': '#EF4444'
  };
  return brandColors[brand] || '#64748b';
}

export default ExecutiveDetailPage;
