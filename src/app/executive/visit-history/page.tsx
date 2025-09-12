'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import VisitDetailsModal from '@/components/VisitDetailsModal';
import { useDateFilter } from '../contexts/DateFilterContext';
import DateFilter from '@/components/DateFilter/DateFilter';
import * as XLSX from 'xlsx';
import './VisitHistory.css';

interface VisitDetail {
  id: string;
  storeName: string;
  partnerBrand?: string;
  status: 'PENDING_REVIEW' | 'REVIEWD';
  personMet: PersonMet[];
  date: string;
  displayChecked: boolean;
  remarks?: string;
  imageUrls: string[];
  adminComment?: string;
  issues: VisitIssue[];
  createdAt: string;
  updatedAt: string;
  representative: string;
}

interface PersonMet {
  name: string;
  designation: string;
}

interface VisitIssue {
  id: string;
  details: string;
  status: 'PENDING' | 'ASSIGNED' | 'RESOLVED';
  createdAt: string;
  assigned: IssueAssignment[];
}

interface IssueAssignment {
  id: string;
  adminComment?: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'VIEW_REPORT';
  createdAt: string;
  executiveName: string;
}

const VisitHistory: React.FC = () => {
  const { selectedPeriod } = useDateFilter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visits, setVisits] = useState<VisitDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    storeName: '',
    city: 'All Cities',
    partnerBrand: 'All Brands',
    status: 'All Status',
    sortBy: 'Recent First'
  });
  const [filterOptions, setFilterOptions] = useState({
    cities: ['All Cities'],
    brands: ['All Brands'],
    statuses: ['All Status', 'PENDING_REVIEW', 'REVIEWD'],
    sortOptions: ['Recent First', 'Store Name A-Z', 'Store Name Z-A', 'Status']
  });

  // Filter handler
  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };


  // Handle URL query parameters
  useEffect(() => {
    const brandParam = searchParams.get('brand');
    if (brandParam) {
      setFilters(prev => ({
        ...prev,
        partnerBrand: brandParam
      }));
      // Filter is applied automatically, but panel remains closed
    }
  }, [searchParams]);

  // Fetch visit history from API with separate data and filter endpoints
  useEffect(() => {
    const fetchVisitData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch visit data and filter options in parallel
        const [visitsResponse, filterResponse] = await Promise.all([
          fetch(`/api/executive/visits/data?period=${encodeURIComponent(selectedPeriod)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          }),
          fetch('/api/executive/visits/filter', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include'
          })
        ]);

        if (!visitsResponse.ok || !filterResponse.ok) {
          throw new Error('Failed to fetch visit or filter data');
        }

        const [visitsResult, filterResult] = await Promise.all([
          visitsResponse.json(),
          filterResponse.json()
        ]);
        
        if (visitsResult.success && filterResult.success) {
          setVisits(visitsResult.data || []);
          setFilterOptions(filterResult.data.filterOptions);
        } else {
          throw new Error(visitsResult.error || filterResult.error || 'Failed to fetch data');
        }
      } catch (error) {
        console.error('Error fetching visit history:', error);
        setError(error instanceof Error ? error.message : 'Failed to load visit history');
        setVisits([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVisitData();
  }, [selectedPeriod]);

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING_REVIEW':
        return '#28a745';
      case 'REVIEWD':
        return '#007bff';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const openVisitModal = (visit: VisitDetail) => {
    setSelectedVisit(visit);
    setShowModal(true);
  };

  const closeVisitModal = () => {
    setSelectedVisit(null);
    setShowModal(false);
  };

  const filteredVisits = visits.filter(visit => {
    const matchesName = visit.storeName?.toLowerCase().includes(filters.storeName.toLowerCase());
    const matchesCity = filters.city === 'All Cities' || visit.storeName?.includes(filters.city);
    const matchesBrand = filters.partnerBrand === 'All Brands' || visit.partnerBrand === filters.partnerBrand;
    const matchesStatus = filters.status === 'All Status' || visit.status === filters.status;
    return matchesName && matchesCity && matchesBrand && matchesStatus;
  }).sort((a, b) => {
    switch (filters.sortBy) {
      case 'Store Name A-Z':
        return (a.storeName || '').localeCompare(b.storeName || '');
      case 'Store Name Z-A':
        return (b.storeName || '').localeCompare(a.storeName || '');
      case 'Status':
        return a.status.localeCompare(b.status);
      default: // Recent First
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const handleExportToExcel = () => {
    if (filteredVisits.length === 0) {
      alert('No data to export');
      return;
    }

    try {
      // Get user name from cookie for worksheet name
      const getCookie = (name: string): string | null => {
        if (typeof document === 'undefined') return null;
        
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
          const cookieValue = parts.pop()?.split(';').shift();
          return cookieValue ? decodeURIComponent(cookieValue) : null;
        }
        return null;
      };

      let userName = 'My Visits'; // Default fallback
      try {
        const userInfoCookie = getCookie('userInfo');
        if (userInfoCookie) {
          const userData = JSON.parse(userInfoCookie);
          userName = userData.executive?.name || userData.admin?.name || 'My Visits';
        }
      } catch (error) {
        console.error('Error getting user name for Excel:', error);
      }
      // Prepare data for Excel export
      const excelData = filteredVisits.map((visit, index) => {
        return {
          'S.No': index + 1,
          'Visit ID': visit.id,
          'Store Name': visit.storeName || 'N/A',
          'Partner Brand': visit.partnerBrand || 'N/A',
          'Status': visit.status === 'PENDING_REVIEW' ? 'Pending Review' : 'Reviewed',
          'Display Checked': visit.displayChecked ? 'Yes' : 'No',
          'Visit Date': formatDate(visit.createdAt),
          'Person Met': visit.personMet && visit.personMet.length > 0 
            ? visit.personMet.map((p, index) => `${index + 1}. ${p.name} (${p.designation})`).join('; ') 
            : 'N/A',
          'Total People Met': visit.personMet?.length || 0,
          'Remarks': visit.remarks || 'No remarks',
          'Admin Comment': visit.adminComment || 'No admin comment',
          'Representative': visit.representative || 'N/A',
          'Image URLs': visit.imageUrls?.join('; ') || 'No images',
          'Number of Images': visit.imageUrls?.length || 0,
          'Issues Count': visit.issues?.length || 0,
          'Issues Details': visit.issues?.map(issue => 
            `${issue.details} (Status: ${issue.status})`
          ).join('; ') || 'No issues',
          'Created At': new Date(visit.createdAt).toLocaleString(),
          'Updated At': new Date(visit.updatedAt).toLocaleString()
        };
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better readability
      const columnWidths = [
        { wch: 8 },   // S.No
        { wch: 20 },  // Visit ID
        { wch: 25 },  // Store Name
        { wch: 20 },  // Partner Brand
        { wch: 15 },  // Status
        { wch: 12 },  // Display Checked
        { wch: 12 },  // Visit Date
        { wch: 50 },  // Person Met (combined format)
        { wch: 12 },  // Total People Met
        { wch: 40 },  // Remarks
        { wch: 30 },  // Admin Comment
        { wch: 20 },  // Representative
        { wch: 50 },  // Image URLs
        { wch: 12 },  // Number of Images
        { wch: 12 },  // Issues Count
        { wch: 50 },  // Issues Details
        { wch: 20 },  // Created At
        { wch: 20 }   // Updated At
      ];
      worksheet['!cols'] = columnWidths;

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, userName);

      // Generate filename with current date and person's name
      const currentDate = new Date().toISOString().split('T')[0];
      // Clean the username for filename (replace spaces and special characters)
      const cleanUserName = userName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${cleanUserName}_Visits_Report_${currentDate}.xlsx`;

      // Write and download the file
      XLSX.writeFile(workbook, filename);
      
      console.log(`Excel report exported successfully: ${filename}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export Excel report. Please try again.');
    }
  };

  return (
    <div className="visit-history-container">
      <div className="visit-history-content">
        {/* Header */}
        <div className="history-header">
          <div className="history-title-section">
            <h1 className="history-title">My Visits</h1>
            <p className="history-subtitle">
              Track your store visits and executive feedback
            </p>
          </div>
          <div className="history-date-filter">
            <DateFilter />
          </div>
        </div>

        {/* Filters Section */}
        <div className="filters-section">
          <div className="filters-header">
            <button 
              className={`filters-toggle ${filtersOpen ? 'active' : ''}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
              disabled={loading}
            >
              <span>Filters</span>
              <span className="filter-arrow">▼</span>
            </button>
            
            <button className="export-btn" onClick={handleExportToExcel} disabled={loading}>
              📊 Export
            </button>
          </div>
          
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
                  disabled={loading}
                />
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Filter by City</label>
                <select
                  className="filter-select"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  disabled={loading}
                >
                  {filterOptions.cities.map(city => (
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
                  disabled={loading}
                >
                  {filterOptions.brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Filter by Status</label>
                <select
                  className="filter-select"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  disabled={loading}
                >
                  <option value="All Status">All Status</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="REVIEWD">Reviewed</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Sort By</label>
                <select
                  className="filter-select"
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

        {/* Visit History Table */}
        <div className="visits-container">
          <div className="visits-table-container">
            <table className="visits-table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Partner Brand</th>
                  <th>Person Met</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="loading-state">
                        <div className="loading-spinner-large"></div>
                        <span className="loading-text">Loading visits...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="error-state">
                        <p>Error: {error}</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredVisits.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="no-data-state">
                        <p>No visits found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVisits.map((visit) => (
                    <tr key={visit.id}>
                      <td>
                        <div className="store-cell">
                          <span className="store-name-cell">{visit.storeName || 'N/A'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="brand-cell">
                          <span className="partner-brand-cell">{visit.partnerBrand || 'N/A'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="person-cell">
                          {visit.personMet && visit.personMet.length > 0 ? (
                            <div className="person-met-list">
                              {visit.personMet.map((person, index) => (
                                <div key={index} className="person-met-item">
                                  <span className="person-name">{person.name}</span>
                                  <span className="person-designation">({person.designation})</span>
                                  {index < visit.personMet.length - 1 && <span className="person-separator">, </span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="no-data">-</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="date-cell">
                          <span className="visit-date-table">{formatDate(visit.createdAt)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="action-cell">
                          <span 
                            className="visit-status-badge"
                            style={{ backgroundColor: getStatusColor(visit.status) }}
                          >
                            {visit.status === 'PENDING_REVIEW' ? 'Pending' : 'Reviewed'}
                          </span>
                          <button 
                            className="view-details-btn-table"
                            onClick={() => openVisitModal(visit)}
                          >
                            View Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>


        {/* Visit Details Modal */}
        <VisitDetailsModal
          isOpen={showModal}
          onClose={closeVisitModal}
          visit={selectedVisit}
        />
      </div>
    </div>
  );
};

export default VisitHistory;
