'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StoreVisitReport, ExecutiveVisit, VisitFilters, VisitStatusOption } from '../../types';
import '../../styles.css';

// Mock data for store visit report
const getStoreVisitReport = (storeId: string): StoreVisitReport => {
  return {
    storeId: parseInt(storeId),
    storeName: 'Lucky Electronics',
    address: 'I-441, Govindpuram Ghaziabad, UP',
    brands: ['Godrej', 'Havells', 'Philips'],
    visits: [
      {
        id: 1,
        executiveName: 'Ramesh Kumar',
        executiveInitials: 'RK',
        avatarColor: '#3B82F6',
        personMet: 'Mr. Kumar',
        role: 'Store Owner',
        visitDate: '2025-08-01',
        visitTime: '2025-08-01',
        displayChecked: true,
        photosCount: 2,
        feedback: 'Asked for new standee',
        issues: 'No flyer stock',
        status: 'Pending Review',
        reviewStatus: 'Pending Issue'
      },
      {
        id: 2,
        executiveName: 'Neha Sharma',
        executiveInitials: 'NS',
        avatarColor: '#EC4899',
        personMet: 'Mr. Kumar',
        role: 'Store Manager',
        visitDate: '2025-08-15',
        visitTime: '2025-07-30',
        displayChecked: true,
        photosCount: 1,
        feedback: 'Happy with current setup',
        issues: 'None',
        status: 'Reviewed',
        reviewStatus: 'Resolved'
      },
      {
        id: 3,
        executiveName: 'Sunita Yadav',
        executiveInitials: 'SY',
        avatarColor: '#8B5CF6',
        personMet: 'Mr. Kumar',
        role: 'Store Owner',
        visitDate: '2025-08-08',
        visitTime: '2025-07-28',
        displayChecked: false,
        photosCount: 2,
        feedback: 'Need better product visibility',
        issues: 'Display demo req',
        status: 'Reviewed',
        reviewStatus: 'Pending Issue'
      },
      {
        id: 4,
        executiveName: 'Rajesh Singh',
        executiveInitials: 'RS',
        avatarColor: '#F59E0B',
        personMet: 'Mr. Kumar',
        role: 'Store Owner',
        visitDate: '2025-08-12',
        visitTime: '2025-07-26',
        displayChecked: true,
        photosCount: 0,
        feedback: 'Satisfied with service',
        issues: 'Low stock shelf',
        status: 'Pending Review',
        reviewStatus: 'Pending Issue'
      },
      {
        id: 5,
        executiveName: 'Priya Gupta',
        executiveInitials: 'PG',
        avatarColor: '#10B981',
        personMet: 'Mr. Kumar',
        role: 'Store Owner',
        visitDate: '2025-08-20',
        visitTime: '2025-07-22',
        displayChecked: true,
        photosCount: 5,
        feedback: 'Excellent product placement',
        issues: 'WiFi connectivity issues',
        status: 'Reviewed',
        reviewStatus: 'Resolved'
      },
      {
        id: 6,
        executiveName: 'Amit Verma',
        executiveInitials: 'AV',
        avatarColor: '#EF4444',
        personMet: 'Mr. Kumar',
        role: 'Store Owner',
        visitDate: '2025-08-08',
        visitTime: '2025-07-20',
        displayChecked: false,
        photosCount: 1,
        feedback: 'Needs promotional materials',
        issues: 'Missing price tags',
        status: 'Pending Review',
        reviewStatus: 'Pending Issue'
      },
      {
        id: 7,
        executiveName: 'Kavita Sharma',
        executiveInitials: 'KS',
        avatarColor: '#8B5CF6',
        personMet: 'Mr. Kumar',
        role: 'Store Owner',
        visitDate: '2025-08-18',
        visitTime: '2025-07-18',
        displayChecked: true,
        photosCount: 2,
        feedback: 'Good customer response',
        issues: 'WiFi connectivity issues',
        status: 'Reviewed',
        reviewStatus: 'Resolved'
      }
    ]
  };
};

const StoreVisitReportPage: React.FC = () => {
  const params = useParams();
  const storeId = params?.id as string;
  
  const [storeData, setStoreData] = useState<StoreVisitReport | null>(null);
  const [filteredVisits, setFilteredVisits] = useState<ExecutiveVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState<VisitFilters>({
    executiveName: '',
    status: 'All Status'
  });

  useEffect(() => {
    if (storeId) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        const data = getStoreVisitReport(storeId);
        setStoreData(data);
        setFilteredVisits(data.visits);
        setIsLoading(false);
      }, 500);
    }
  }, [storeId]);

  // Apply filters when filters change
  useEffect(() => {
    if (!storeData) return;

    let filtered = storeData.visits;

    if (filters.executiveName && filters.executiveName.trim() !== '') {
      filtered = filtered.filter(visit =>
        visit.executiveName.toLowerCase().includes(filters.executiveName.toLowerCase())
      );
    }

    if (filters.status !== 'All Status') {
      filtered = filtered.filter(visit => visit.status === filters.status);
    }

    setFilteredVisits(filtered);
  }, [filters, storeData]);

  const handleFilterChange = (filterType: keyof VisitFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const getBrandColor = (brand: string): string => {
    const brandColors: Record<string, string> = {
      'Godrej': '#3B82F6',
      'Havells': '#F59E0B',
      'Philips': '#10B981',
      'Samsung': '#1DB584',
      'Vivo': '#8B5CF6',
      'Oppo': '#F97316'
    };
    return brandColors[brand] || '#64748b';
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'Pending Review':
        return 'status-pending-review';
      case 'Reviewed':
        return 'status-reviewed';
      case 'Pending Issue':
        return 'status-pending-issue';
      default:
        return 'status-default';
    }
  };

  const getReviewStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'Resolved':
        return 'review-status-resolved';
      case 'Pending Review':
        return 'review-status-pending-review';
      case 'Pending Issue':
        return 'review-status-pending-issue';
      default:
        return 'review-status-default';
    }
  };

  const handleExportReport = () => {
    console.log('Exporting report for store:', storeId);
    // Implement export functionality
  };


  // Create a mapping of issue text to issue IDs for demonstration
  // In a real app, this would come from your backend/database
  const getIssueIdByText = (issueText: string): number | null => {
    const issueMapping: Record<string, number> = {
      'No flyer stock': 1323,
      'Display demo req': 1324,
      'Low stock shelf': 1325, 
      'WiFi connectivity issues': 1322, // This matches our existing issue
      'Missing price tags': 1326,
      'None': 0
    };
    return issueMapping[issueText] || null;
  };

  if (isLoading) {
    return (
      <div className="visit-report-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading store visit report...</div>
        </div>
      </div>
    );
  }

  if (!storeData) {
    return (
      <div className="visit-report-overview">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Store not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="visit-report-overview">
      {/* Header Section */}
      <div className="visit-report-header">
        <div className="back-navigation">
          <Link href="/admin/stores" className="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Stores
          </Link>
        </div>
        <div className="visit-report-title">
          <h2>Store Visit Report</h2>
          <p>Comprehensive overview of store visits and executive feedback</p>
        </div>
      </div>

      {/* Store Information Card */}
      <div className="store-info-card">
        <div className="store-basic-info">
          <h3>{storeData.storeName}</h3>
          <div className="store-brands">
            {storeData.brands.map((brand, index) => (
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
        <div className="store-contact-info">
          <div className="contact-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 7.87827 3.84285 5.84344 5.34315 4.34315C6.84344 2.84285 8.87827 2 11 2H13C15.1217 2 17.1566 2.84285 18.6569 4.34315C19.1571 4.84344 21 7.87827 21 10Z" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>{storeData.address}</span>
          </div>
          {/* <div className="contact-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 16.92V19.92C22 20.52 21.52 21 20.92 21C9.4 21 0 11.6 0 0.0799999C0 -0.52 0.48 -1 1.08 -1H4.08C4.68 -1 5.16 -0.52 5.16 0.0799999C5.16 1.16 5.35 2.23 5.72 3.24C5.82 3.49 5.76 3.77 5.56 3.97L3.84 5.69C5.34 8.75 7.75 11.17 10.81 12.67L12.53 10.95C12.73 10.75 13.01 10.69 13.26 10.79C14.27 11.16 15.34 11.35 16.42 11.35C17.02 11.35 17.5 11.83 17.5 12.43V15.43C17.5 16.03 17.02 16.51 16.42 16.51C16.07 16.89 15.97 16.92 22 16.92Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>{storeData.contactPerson}</span>
          </div>
          <div className="contact-item">
            <span className="contact-phone">{storeData.contactPhone}</span>
          </div> */}
        </div>
      </div>

      {/* Filters Section */}
      <div className="visit-filters-section">
        <div className="visit-filters-grid">
          <div className="filter-group">
            <label>Search Executive Name</label>
            <input
              type="text"
              placeholder="Search by Executive name..."
              value={filters.executiveName}
              onChange={(e) => handleFilterChange('executiveName', e.target.value)}
              className="filter-input"
            />
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
              <option value="Pending Issue">Pending Issue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Visits Table */}
      <div className="visits-table-section">
        <div className="visits-table">
          <div className="table-header">
            <div className="header-cell">Executive</div>
            <div className="header-cell">Person Met</div>
            <div className="header-cell">Visit Info</div>
            <div className="header-cell">Feedback</div>
            <div className="header-cell">Issues</div>
            <div className="header-cell">Date</div>
            <div className="header-cell">Status</div>
            <div className="header-cell">Actions</div>
          </div>
          
          <div className="table-body">
            {filteredVisits.map(visit => (
              <div key={visit.id} className="table-row">
                <div className="cell executive-cell">
                  <div 
                    className="executive-avatar"
                    style={{ backgroundColor: visit.avatarColor }}
                  >
                    {visit.executiveInitials}
                  </div>
                  <span className="executive-name">{visit.executiveName}</span>
                </div>
                
                <div className="cell person-met-cell">
                  <div className="person-info">
                    <span className="person-name">{visit.personMet}</span>
                    <span className="person-role">{visit.role}</span>
                  </div>
                </div>
                
                <div className="cell visit-info-cell">
                  <div className="visit-details">
                    <div className="visit-date">📅 {visit.visitDate}</div>
                    <div className="visit-display">
                      📺 {visit.displayChecked ? 'Display Checked' : 'Not Checked'}
                    </div>
                    <div className="visit-photos">📸 {visit.photosCount} Photos</div>
                  </div>
                </div>
                
                <div className="cell feedback-cell">
                  <span className="feedback-text">{visit.feedback}</span>
                </div>
                
                <div className="cell issues-cell">
                  <div className="issues-content">
                    {visit.issues === 'None' ? (
                      <span className="no-issues">⚠️ {visit.issues}</span>
                    ) : (
                      <div className="issue-link-container">
                        <span className="issue-icon">⚠️</span>
                        {getIssueIdByText(visit.issues) ? (
                          <Link 
                            href={`/admin/issues/${getIssueIdByText(visit.issues)}`}
                            className="issue-link"
                            title={`View issue: ${visit.issues}`}
                          >
                            {visit.issues}
                          </Link>
                        ) : (
                          <span className="has-issues">{visit.issues}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="cell date-cell">
                  <span className="visit-time">📅 {visit.visitTime}</span>
                </div>
                
                <div className="cell status-cell">
                  <div className="status-badges">
                    <span className={`status-badge ${getStatusBadgeClass(visit.status)}`}>
                      {visit.status}
                    </span>
                    <span className={`review-status-badge ${getReviewStatusBadgeClass(visit.reviewStatus)}`}>
                      {visit.reviewStatus}
                    </span>
                  </div>
                </div>
                
                <div className="cell actions-cell">
                  <div className="action-buttons-group">
                    <button className="view-details-btn">
                      View Details
                    </button>
                    {/* Only show Mark Reviewed button if status is not already Reviewed */}
                    {visit.status !== 'Reviewed' && (
                      <button className="mark-reviewed-btn">
                        Mark Reviewed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="export-section">
        <div className="export-info">
          <h3>Export Report</h3>
          <p>Download a comprehensive PDF report of all visit data</p>
        </div>
        <button onClick={handleExportReport} className="export-btn">
          📄 Export Report
        </button>
      </div>
    </div>
  );
};

export default StoreVisitReportPage;
