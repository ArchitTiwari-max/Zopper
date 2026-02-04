'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import VisitDetailsModal from '../components/VisitDetailsModal';
import HolidayDetailsModal from '../components/HolidayDetailsModal';
import { useDateFilter } from '../contexts/DateFilterContext';
import DateFilter from '@/components/DateFilter/DateFilter';
import * as XLSX from 'xlsx';
import './VisitHistory.css';

interface VisitDetail {
  id: string;
  storeName: string;
  partnerBrand?: string;
  status: 'PENDING_REVIEW' | 'REVIEWD';
  reviewerName?: string;
  personMet: PersonMet[];
  date: string;
  POSMchecked: boolean | null;
  remarks?: string;
  imageUrls: string[];
  adminComment?: string;
  issues: VisitIssue[];
  createdAt: string;
  updatedAt: string;
  representative: string;
  canViewDetails?: boolean;
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

interface HolidayRequest {
  id: string;
  secNames: string[];
  reason: string;
  startDate: string;
  endDate: string;
  status: string;
  submittedAt: string;
  storeName?: string;
  adminComment?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  type?: 'VACATION' | 'WEEK_OFF';
  replacementAvailable?: boolean | null;
}

const VisitHistory: React.FC = () => {
  const { selectedPeriod } = useDateFilter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Data sets for tabs
  const [physicalVisits, setPhysicalVisits] = useState<VisitDetail[]>([]);
  const [digitalVisits, setDigitalVisits] = useState<VisitDetail[]>([]);
  const [holidayRequests, setHolidayRequests] = useState<HolidayRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'PHYSICAL' | 'DIGITAL' | 'HOLIDAY'>('PHYSICAL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
  const [selectedVisitType, setSelectedVisitType] = useState<'PHYSICAL' | 'DIGITAL'>('PHYSICAL');
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [expandedPersonMet, setExpandedPersonMet] = useState<Set<string>>(new Set());
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

        // Fetch physical, digital data, holiday requests, and filter options in parallel
        const [physicalRes, digitalRes, holidayRes, filterResponse] = await Promise.all([
          fetch(`/api/executive/visits/data?period=${encodeURIComponent(selectedPeriod)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }),
          fetch(`/api/executive/digital-visits/data?period=${encodeURIComponent(selectedPeriod)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }),
          fetch('/api/executive/holiday', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }),
          fetch('/api/executive/visits/filter', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          })
        ]);

        if (!physicalRes.ok || !digitalRes.ok || !filterResponse.ok) {
          console.error('Fetch failed:', {
            physical: { ok: physicalRes.ok, status: physicalRes.status, statusText: physicalRes.statusText },
            digital: { ok: digitalRes.ok, status: digitalRes.status, statusText: digitalRes.statusText },
            filter: { ok: filterResponse.ok, status: filterResponse.status, statusText: filterResponse.statusText }
          });
          const errorMsg = `Failed to fetch data: P:${physicalRes.status} D:${digitalRes.status} F:${filterResponse.status}`;
          throw new Error(errorMsg);
        }

        const [physicalResult, digitalResult, holidayResult, filterResult] = await Promise.all([
          physicalRes.json(),
          digitalRes.json(),
          holidayRes.ok ? holidayRes.json() : { data: [] },
          filterResponse.json()
        ]);

        if (physicalResult.success && digitalResult.success && filterResult.success) {
          setPhysicalVisits(physicalResult.data || []);
          setDigitalVisits(digitalResult.data || []);
          setHolidayRequests(holidayResult.data || []);
          setFilterOptions(filterResult.data.filterOptions);
        } else {
          throw new Error(physicalResult.error || digitalResult.error || filterResult.error || 'Failed to fetch data');
        }
      } catch (error) {
        console.error('Error fetching visit history:', error);
        setError(error instanceof Error ? error.message : 'Failed to load visit history');
        setPhysicalVisits([]);
        setDigitalVisits([]);
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
      case 'PENDING': return '#ffc107';
      case 'APPROVED': return '#28a745';
      case 'REJECTED': return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (dateString: string) => {
    // Check if the date is already in dd/mm/yyyy format
    if (dateString && dateString.includes('/') && dateString.split('/').length === 3) {
      // Already formatted, return as is
      return dateString;
    }

    // Parse the date
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    // Get today's date and yesterday's date for comparison
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // Reset time to 00:00:00 for accurate date comparison
    const visitDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    // Check if the visit date is today or yesterday
    if (visitDate.getTime() === todayDate.getTime()) {
      return 'Today';
    } else if (visitDate.getTime() === yesterdayDate.getTime()) {
      return 'Yesterday';
    } else {
      // Format to dd/mm/yyyy format for other dates
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  const openVisitModal = (visit: VisitDetail) => {
    setSelectedVisit({ ...visit, canViewDetails: true }); // Ensure compatibility
    if (activeTab === 'PHYSICAL' || activeTab === 'DIGITAL') {
      setSelectedVisitType(activeTab);
    }
    setShowModal(true);
  };

  const closeVisitModal = () => {
    setSelectedVisit(null);
    setShowModal(false);
  };

  const openHolidayModal = (holiday: HolidayRequest) => {
    setSelectedHoliday(holiday);
    setShowHolidayModal(true);
  };

  const closeHolidayModal = () => {
    setSelectedHoliday(null);
    setShowHolidayModal(false);
  };

  const togglePersonMetExpansion = (visitId: string) => {
    setExpandedPersonMet(prev => {
      const newSet = new Set(prev);
      if (newSet.has(visitId)) {
        newSet.delete(visitId);
      } else {
        newSet.add(visitId);
      }
      return newSet;
    });
  };

  // Pick dataset based on active tab
  const dataset = activeTab === 'PHYSICAL' ? physicalVisits : digitalVisits;

  const filteredVisits = dataset.filter(visit => {
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
          'Status': visit.status === 'PENDING_REVIEW' ? 'Pending Review' : (visit.reviewerName ? `Reviewed by ${visit.reviewerName}` : 'Reviewed'),
          'POSM Available': visit.POSMchecked === null ? 'Not specified' : (visit.POSMchecked ? 'Yes' : 'No'),
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
          'Created At': (() => {
            const date = new Date(visit.createdAt);
            if (isNaN(date.getTime())) return 'Invalid Date';
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
          })(),
          'Updated At': (() => {
            const date = new Date(visit.updatedAt);
            if (isNaN(date.getTime())) return 'Invalid Date';
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
          })()
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
    <div className="exec-visits-container">
      <div className="exec-visits-content">
        {/* Header */}
        <div className="exec-visits-header">
          <div className="exec-visits-title-section">
            <h1 className="exec-visits-title">My Visits</h1>
            <p className="exec-visits-subtitle">
              Track your store visits and executive feedback
            </p>
          </div>
          <div className="exec-visits-date-filter">
            <DateFilter />
          </div>
        </div>

        {/* Filters Section */}
        <div className="exec-visits-filters-section">
          <div className="exec-visits-filters-header">
            <button
              className={`exec-visits-filters-toggle ${filtersOpen ? 'active' : ''}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
              disabled={loading}
            >
              <span>Filters</span>
              <span className="exec-visits-filter-arrow">▼</span>
            </button>

            <button className="exec-visits-export-btn" onClick={handleExportToExcel} disabled={loading}>
              📊 Export
            </button>
          </div>

          {/* Tab Bar - Full width below filter header */}
          <div className="exec-visits-tabbar" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <button
              type="button"
              className={`exec-visits-tab ${activeTab === 'PHYSICAL' ? 'active' : ''}`}
              onClick={() => setActiveTab('PHYSICAL')}
            >
              <span className="exec-tab-icon">🏬</span>
              <span className="exec-tab-text">
                <span className="exec-tab-word">Physical</span>
                <span className="exec-tab-visit">&nbsp;Visits</span>
              </span>
            </button>
            <button
              type="button"
              className={`exec-visits-tab ${activeTab === 'DIGITAL' ? 'active' : ''}`}
              onClick={() => setActiveTab('DIGITAL')}
            >
              <span className="exec-tab-icon">📞</span>
              <span className="exec-tab-text">
                <span className="exec-tab-word">Digital</span>
                <span className="exec-tab-visit">&nbsp;Visits</span>
              </span>
            </button>
            <button
              type="button"
              className={`exec-visits-tab ${activeTab === 'HOLIDAY' ? 'active' : ''}`}
              onClick={() => setActiveTab('HOLIDAY')}
            >
              <span className="exec-tab-icon">🏖️</span>
              <span className="exec-tab-text">
                <span className="exec-tab-word">Vacation</span>
                <span className="exec-tab-visit">&nbsp;& Off</span>
              </span>
            </button>
          </div>

          {filtersOpen && (
            <div className="exec-visits-filters-panel">
              <div className="exec-visits-filter-group">
                <label className="exec-visits-filter-label">Store Name</label>
                <input
                  type="text"
                  className="exec-visits-filter-input"
                  placeholder="Enter store name..."
                  value={filters.storeName}
                  onChange={(e) => handleFilterChange('storeName', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="exec-visits-filter-group">
                <label className="exec-visits-filter-label">Filter by City</label>
                <select
                  className="exec-visits-filter-select"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  disabled={loading}
                >
                  {filterOptions.cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="exec-visits-filter-group">
                <label className="exec-visits-filter-label">Filter by Partner Brand</label>
                <select
                  className="exec-visits-filter-select"
                  value={filters.partnerBrand}
                  onChange={(e) => handleFilterChange('partnerBrand', e.target.value)}
                  disabled={loading}
                >
                  {filterOptions.brands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div className="exec-visits-filter-group">
                <label className="exec-visits-filter-label">Filter by Status</label>
                <select
                  className="exec-visits-filter-select"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  disabled={loading}
                >
                  <option value="All Status">All Status</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="REVIEWD">Reviewed</option>
                </select>
              </div>

              <div className="exec-visits-filter-group">
                <label className="exec-visits-filter-label">Sort By</label>
                <select
                  className="exec-visits-filter-select"
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
        <div className="exec-visits-container">
          <div className="exec-visits-table-container">

            {activeTab === 'HOLIDAY' ? (
              <table className="exec-visits-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>SEC Details</th>
                    <th>Store Name</th>
                    <th>Date Range</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="loading-state">
                          <div className="loading-spinner-large"></div>
                          <span className="loading-text">Loading requests...</span>
                        </div>
                      </td>
                    </tr>
                  ) : holidayRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="no-data-state">
                          <p>No vacation requests found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    holidayRequests.map((req) => (
                      <tr key={req.id}>
                        <td data-label="Type">
                          <div className="exec-visits-store-cell">
                            <span
                              className="exec-visits-status-badge"
                              style={{
                                backgroundColor: req.type === 'WEEK_OFF' ? '#17a2b8' : '#6f42c1',
                                color: 'white'
                              }}
                            >
                              {req.type === 'WEEK_OFF' ? 'Week Off' : 'Vacation'}
                            </span>
                          </div>
                        </td>
                        <td data-label="SEC Details">
                          <div className="exec-visits-store-cell">
                            {/* Show just first SEC or count as per space */}
                            <span className="exec-visits-store-name-cell">
                              {req.secNames && req.secNames.length > 0 ? req.secNames[0] + (req.secNames.length > 1 ? ` +${req.secNames.length - 1}` : '') : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td data-label="Store Name">
                          <div className="exec-visits-store-cell">
                            <span className="exec-visits-store-name-cell">{req.storeName || 'N/A'}</span>
                          </div>
                        </td>
                        <td data-label="Date Range">
                          <div className="exec-visits-date-cell">
                            <span className="exec-visits-date-table">
                              {req.type === 'WEEK_OFF' ? (() => {
                                const d = new Date(req.startDate);
                                const day = d.getDate().toString().padStart(2, '0');
                                const month = (d.getMonth() + 1).toString().padStart(2, '0');
                                const year = d.getFullYear();
                                return `${day}/${month}/${year}`;
                              })() : `${formatDate(req.startDate)} - ${formatDate(req.endDate)}`}
                            </span>
                          </div>
                        </td>

                        <td data-label="Action">
                          <div className="exec-visits-action-cell">
                            <button
                              className="exec-visits-view-details-btn"
                              onClick={() => openHolidayModal(req)}
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
            ) : (
              <table className="exec-visits-table">
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
                        <td data-label="Store Name">
                          <div className="exec-visits-store-cell">
                            <span className="exec-visits-store-name-cell">{visit.storeName || 'N/A'}</span>
                          </div>
                        </td>
                        <td data-label="Partner Brand">
                          <div className="exec-visits-brand-cell">
                            <span className="exec-visits-partner-brand-cell">{visit.partnerBrand || 'N/A'}</span>
                          </div>
                        </td>
                        <td data-label="Person Met">
                          <div className="exec-visits-person-cell">
                            {visit.personMet && visit.personMet.length > 0 ? (
                              <div className="exec-visits-person-met-list">
                                {visit.personMet.length === 1 ? (
                                  // Single person - show full details
                                  <div className="exec-visits-person-met-item">
                                    <span className="exec-visits-person-name">{visit.personMet[0].name}</span>
                                    <span className="exec-visits-person-designation">({visit.personMet[0].designation})</span>
                                  </div>
                                ) : visit.personMet.length === 2 ? (
                                  // Two people - show both
                                  <>
                                    <div className="exec-visits-person-met-item">
                                      <span className="exec-visits-person-name">{visit.personMet[0].name}</span>
                                      <span className="exec-visits-person-designation">({visit.personMet[0].designation})</span>
                                    </div>
                                    <div className="exec-visits-person-met-item">
                                      <span className="exec-visits-person-name">{visit.personMet[1].name}</span>
                                      <span className="exec-visits-person-designation">({visit.personMet[1].designation})</span>
                                    </div>
                                  </>
                                ) : (
                                  // Multiple people - show first person + expandable list
                                  <>
                                    <div className="exec-visits-person-met-item">
                                      <span className="exec-visits-person-name">{visit.personMet[0].name}</span>
                                      <span className="exec-visits-person-designation">({visit.personMet[0].designation})</span>
                                    </div>

                                    {expandedPersonMet.has(visit.id) ? (
                                      // Show all additional people when expanded
                                      <>
                                        {visit.personMet.slice(1).map((person, index) => (
                                          <div key={index + 1} className="exec-visits-person-met-item">
                                            <span className="exec-visits-person-name">{person.name}</span>
                                            <span className="exec-visits-person-designation">({person.designation})</span>
                                          </div>
                                        ))}
                                        <div className="exec-visits-person-more" onClick={() => togglePersonMetExpansion(visit.id)}>
                                          <span className="exec-visits-more-count exec-visits-show-less">Show less</span>
                                        </div>
                                      </>
                                    ) : (
                                      // Show "+ X more" button when collapsed
                                      <div className="exec-visits-person-more" onClick={() => togglePersonMetExpansion(visit.id)}>
                                        <span className="exec-visits-more-count">+{visit.personMet.length - 1} more</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="exec-visits-no-data">-</span>
                            )}
                          </div>
                        </td>
                        <td data-label="Date">
                          <div className="exec-visits-date-cell">
                            <span className="exec-visits-date-table">{formatDate(visit.createdAt)}</span>
                          </div>
                        </td>
                        <td data-label="Action">
                          <div className="exec-visits-action-cell">
                            <span
                              className="exec-visits-status-badge"
                              style={{ backgroundColor: getStatusColor(visit.status) }}
                            >
                              {visit.status === 'PENDING_REVIEW'
                                ? 'Pending Review'
                                : (visit.reviewerName ? `Reviewed by ${visit.reviewerName}` : 'Reviewed')}
                            </span>
                            <button
                              className="exec-visits-view-details-btn"
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
            )}
          </div>
        </div>

        {/* Visit Details Modal */}
        <VisitDetailsModal
          isOpen={showModal}
          onClose={closeVisitModal}
          visit={selectedVisit}
          isDigital={selectedVisitType === 'DIGITAL'}
        />

        {/* Holiday Details Modal */}
        <HolidayDetailsModal
          isOpen={showHolidayModal}
          onClose={closeHolidayModal}
          holiday={selectedHoliday}
        />
      </div>
    </div>
  );
};

export default VisitHistory;
