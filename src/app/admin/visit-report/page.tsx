'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDateFilter } from '../contexts/DateFilterContext';
import VisitDetailsModal from '../components/VisitDetailsModal';
import * as XLSX from 'xlsx';
import './page.css';

// Types for visit report
  interface VisitReportData {
  id: string; // ObjectId
  executiveName: string;
  executiveInitials: string;
  avatarColor: string;
  storeName: string;
  storeId: string;
  partnerBrand: string[];
  visitDate: string;
  visitStatus: 'PENDING_REVIEW' | 'REVIEWD';
  reviewerName?: string;
  issueStatus: 'Pending' | 'Assigned' | 'Resolved' | null;
  city: string;
  issues: string;
  issueId?: string;
  feedback: string;
  POSMchecked: boolean | null;
  peopleMet?: Array<{name: string, designation: string, phoneNumber?: string}>;
  imageUrls?: string[];
}

interface VisitReportFilters {
  partnerBrand: string;
  city: string;
  storeName: string;
  executiveName: string;
  visitStatus: string;
  issueStatus: string;
}

// ExpandableText Component
interface ExpandableTextProps {
  text: string;
  maxHeight?: number;
  className?: string;
}

const ExpandableText: React.FC<ExpandableTextProps> = ({
  text,
  maxHeight = 40, // Default max height in pixels
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showViewMore, setShowViewMore] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const element = textRef.current;
      // Check if content height exceeds maxHeight
      if (element.scrollHeight > maxHeight) {
        setShowViewMore(true);
      } else {
        setShowViewMore(false);
      }
    }
  }, [text, maxHeight]);

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  if (!text || text.trim() === '') {
    return null;
  }

  return (
    <div className={`expandable-text-wrapper ${className}`}>
      <div
        ref={textRef}
        className={`expandable-text-content ${isExpanded ? 'expanded' : 'collapsed'}`}
        style={{
          maxHeight: isExpanded ? 'none' : `${maxHeight}px`,
          overflow: 'hidden',
          lineHeight: '1.4'
        }}
      >
        {text}
      </div>
      {showViewMore && (
        <button
          className="view-more-btn"
          onClick={toggleExpanded}
          type="button"
          style={{
            background: 'none',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: '500',
            marginTop: '0.25rem',
            padding: '0',
            textDecoration: 'underline'
          }}
        >
          {isExpanded ? 'View Less' : 'View More'}
        </button>
      )}
    </div>
  );
};

const VisitReportPage: React.FC = () => {
  const searchParams = useSearchParams();
  const { selectedDateFilter } = useDateFilter();
  const [visitData, setVisitData] = useState<VisitReportData[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<VisitReportData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(true);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [markingReviewedId, setMarkingReviewedId] = useState<string | null>(null);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: 'executiveName' | 'storeName' | 'visitDate' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  
  // Filter data from API
  const [filterData, setFilterData] = useState<{
    stores: Array<{id: string, name: string, city: string}>;
    executives: Array<{id: string, name: string, region: string}>;
    brands: Array<{id: string, name: string}>;
    cities: string[];
  }>({stores: [], executives: [], brands: [], cities: []});

  const [filters, setFilters] = useState<VisitReportFilters>({
    partnerBrand: 'All Brands',
    city: 'All City',
    storeName: '', // Changed to empty string for text input search
    executiveName: 'All Executive',
    visitStatus: 'All Status',
    issueStatus: 'All Status'
  });

  // Fetch filter data from API (fast)
  const fetchFilterData = async () => {
    setIsLoadingFilters(true);
    setFilterError(null);
    try {
      const response = await fetch('/api/admin/visit-report/filters', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setFilterData(data);
    } catch (error) {
      console.error('Failed to fetch filter data:', error);
      setFilterError(error instanceof Error ? error.message : 'Failed to load filter data');
    } finally {
      setIsLoadingFilters(false);
    }
  };

  // Fetch ALL visit report data from API (no server-side filtering)
  const fetchVisitReportData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Only pass dateFilter to get all data for client-side filtering
      const params = new URLSearchParams();
      params.append('dateFilter', selectedDateFilter);

      const response = await fetch(`/api/admin/visit-report/data?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setVisitData(data.visits || []);
      // applyFilters will be triggered by visitData change and handle filteredVisits
    } catch (error) {
      console.error('Failed to fetch visit report data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load visit report data');
      setVisitData([]);
      setFilteredVisits([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filters and sorting to existing data (client-side filtering and sorting)
  const applyFilters = () => {
    if (!visitData.length) {
      setFilteredVisits([]);
      return;
    }

    let filtered = visitData.filter(visit => {
      // Filter by partner brand
      if (filters.partnerBrand !== 'All Brands') {
        if (!visit.partnerBrand.includes(filters.partnerBrand)) {
          return false;
        }
      }

      // Filter by city
      if (filters.city !== 'All City') {
        if (visit.city !== filters.city) {
          return false;
        }
      }

      // Filter by store - handle URL storeId and text input independently
      const urlStoreId = searchParams.get('storeId');
      
      if (urlStoreId && urlStoreId !== 'All Store') {
        // Priority: URL storeId filtering (exact match by store ID)
        if (visit.storeId !== urlStoreId) {
          return false;
        }
      } else if (filters.storeName && filters.storeName.trim() !== '') {
        // Text-based store name filtering (partial match, case-insensitive)
        const searchText = filters.storeName.toLowerCase().trim();
        if (!visit.storeName.toLowerCase().includes(searchText)) {
          return false;
        }
      }

      // Filter by executive name
      if (filters.executiveName !== 'All Executive') {
        // If filters.executiveName contains an ID, find the executive name
        const executive = filterData.executives.find(e => e.id === filters.executiveName);
        const executiveNameToMatch = executive ? executive.name : filters.executiveName;
        if (visit.executiveName !== executiveNameToMatch) {
          return false;
        }
      }

      // Filter by visit status
      if (filters.visitStatus !== 'All Status') {
        if (visit.visitStatus !== filters.visitStatus) {
          return false;
        }
      }

      // Filter by issue status
      if (filters.issueStatus !== 'All Status') {
        // Handle the case where visit has no issue status (null)
        if (!visit.issueStatus && filters.issueStatus !== 'None') {
          return false;
        }
        // Handle special case: "Pending" filter includes both Pending and Assigned issues
        if (filters.issueStatus === 'Pending') {
          if (visit.issueStatus !== 'Pending' && visit.issueStatus !== 'Assigned') {
            return false;
          }
        } else {
          // Handle normal case where issue status matches exactly
          if (visit.issueStatus !== filters.issueStatus) {
            return false;
          }
        }
      }

      return true;
    });

    // Apply sorting if a sort column is selected
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
          case 'executiveName':
            aValue = a.executiveName.toLowerCase();
            bValue = b.executiveName.toLowerCase();
            break;
          case 'storeName':
            aValue = a.storeName.toLowerCase();
            bValue = b.storeName.toLowerCase();
            break;
          case 'visitDate':
            aValue = new Date(a.visitDate).getTime();
            bValue = new Date(b.visitDate).getTime();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredVisits(filtered);
  };

  // Initial data fetch on mount
  useEffect(() => {
    fetchFilterData();
    fetchVisitReportData();
  }, []);

  // Set initial filters from URL parameters (separate effect to avoid conflicts)
  useEffect(() => {
    // Only process URL params after filter data is loaded
    if (filterData.stores.length === 0) return;
    
    const urlStoreId = searchParams.get('storeId');
    const urlStoreName = searchParams.get('storeName');
    const urlExecutiveId = searchParams.get('executiveId');
    const urlPartnerBrand = searchParams.get('partnerBrand');
    const urlCity = searchParams.get('city');
    const urlVisitStatus = searchParams.get('visitStatus');
    const urlIssueStatus = searchParams.get('issueStatus');
    
    if (urlStoreId || urlStoreName || urlExecutiveId || urlPartnerBrand || urlCity || urlVisitStatus || urlIssueStatus) {
      // Set storeName from URL if present (for text-based search)
      let storeNameFilter = '';
      if (urlStoreName) {
        storeNameFilter = urlStoreName;
      }
      
      // Use executive ID directly
      let executiveFilter = 'All Executive';
      if (urlExecutiveId && urlExecutiveId !== 'All Executive') {
        // Validate that the executive ID exists in filter data
        const matchingExecutive = filterData.executives.find(exec => exec.id === urlExecutiveId);
        executiveFilter = matchingExecutive ? urlExecutiveId : 'All Executive';
        console.log('[URL DEBUG] Executive ID from URL:', urlExecutiveId, '→ Valid:', !!matchingExecutive);
      }
      
      setFilters(prevFilters => ({
        ...prevFilters,
        partnerBrand: urlPartnerBrand || prevFilters.partnerBrand,
        city: urlCity || prevFilters.city,
        storeName: storeNameFilter, // Set from URL storeName parameter
        executiveName: executiveFilter,
        visitStatus: urlVisitStatus || prevFilters.visitStatus,
        issueStatus: urlIssueStatus || prevFilters.issueStatus
      }));
    }
  }, [filterData.stores, filterData.executives]); // Wait for filter data to be loaded

  // Apply filters and sorting to existing data when filters or sorting changes (but not on initial load)
  useEffect(() => {
    if (visitData.length > 0) { // Only apply filters if we have data
      applyFilters();
    }
  }, [filters, visitData, sortConfig]);

  // Refetch data when date filter changes (requires server-side fetch)
  useEffect(() => {
    if (visitData.length > 0) { // Only refetch if we already have data (not on initial load)
      fetchVisitReportData();
    }
  }, [selectedDateFilter]);


  const handleFilterChange = (filterType: keyof VisitReportFilters, value: string) => {
    const newFilters = {
      ...filters,
      [filterType]: value
    };
    
    setFilters(newFilters);
    
    // Update URL with current filter state
    updateUrlWithFilters(newFilters);
  };

  // Function to update URL based on current filter state
  const updateUrlWithFilters = (currentFilters: VisitReportFilters) => {
    const newUrl = new URL(window.location.href);
    
    // Clear all existing filter params
    newUrl.searchParams.delete('partnerBrand');
    newUrl.searchParams.delete('city');
    newUrl.searchParams.delete('storeName');
    newUrl.searchParams.delete('executiveName');
    newUrl.searchParams.delete('visitStatus');
    newUrl.searchParams.delete('issueStatus');
    newUrl.searchParams.delete('storeId');
    newUrl.searchParams.delete('executiveId');
    
    // Add current filter values to URL (only if not default)
    if (currentFilters.partnerBrand !== 'All Brands') {
      newUrl.searchParams.set('partnerBrand', currentFilters.partnerBrand);
    }
    
    if (currentFilters.city !== 'All City') {
      newUrl.searchParams.set('city', currentFilters.city);
    }
    
    if (currentFilters.visitStatus !== 'All Status') {
      newUrl.searchParams.set('visitStatus', currentFilters.visitStatus);
    }
    
    if (currentFilters.issueStatus !== 'All Status') {
      newUrl.searchParams.set('issueStatus', currentFilters.issueStatus);
    }
    
    // Use storeName parameter for text-based search
    if (currentFilters.storeName && currentFilters.storeName.trim() !== '') {
      newUrl.searchParams.set('storeName', currentFilters.storeName);
    }
    
    if (currentFilters.executiveName !== 'All Executive') {
      newUrl.searchParams.set('executiveId', currentFilters.executiveName);
    }
    
    // Update URL without reloading page
    window.history.pushState({}, '', newUrl.toString());
  };

  const getBrandColor = (brand: string): string => {
    const brandColors: Record<string, string> = {
      'Samsung': '#1DB584',
      'Vivo': '#8B5CF6',
      'Oppo': '#F97316',
      'OnePlus': '#1DB584',
      'Realme': '#EC4899',
      'Xiaomi': '#EF4444',
      'Godrej': '#3B82F6',
      'Havells': '#F59E0B',
      'Philips': '#10B981'
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
      case 'Resolved':
        return 'status-resolved';
      default:
        return 'status-default';
    }
  };

  const getVisitStatusBadgeClass = (status: 'PENDING_REVIEW' | 'REVIEWD'): string => {
    switch (status) {
      case 'PENDING_REVIEW':
        return 'visit-status-pending';
      case 'REVIEWD':
        return 'visit-status-reviewed';
      default:
        return 'visit-status-default';
    }
  };

  // Format visit status for display
  const formatVisitStatus = (status: 'PENDING_REVIEW' | 'REVIEWD'): string => {
    switch (status) {
      case 'PENDING_REVIEW':
        return 'Pending Review';
      case 'REVIEWD':
        return 'Reviewed';
      default:
        return status;
    }
  };

  // Format issue status for display (already properly formatted)
  const formatIssueStatus = (status: 'Pending' | 'Assigned' | 'Resolved' | null): string => {
    return status || 'None';
  };

  // Smart date formatting function for visit dates
  const formatVisitDate = (dateString: string): string => {
    if (!dateString) return dateString;
    
    // Handle different date formats that might come from API
    let visitDate: Date;
    
    // If it's already in dd/mm/yyyy format, parse it correctly
    if (dateString.includes('/') && dateString.split('/').length === 3) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const year = parseInt(parts[2], 10);
        visitDate = new Date(year, month, day);
      } else {
        visitDate = new Date(dateString);
      }
    } else {
      visitDate = new Date(dateString);
    }
    
    // Check if date is valid
    if (isNaN(visitDate.getTime())) {
      return dateString; // Return original if can't parse
    }
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Reset time to compare only dates
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    visitDate.setHours(0, 0, 0, 0);
    
    if (visitDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (visitDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      // Format as dd/mm/yyyy
      const day = visitDate.getDate().toString().padStart(2, '0');
      const month = (visitDate.getMonth() + 1).toString().padStart(2, '0');
      const year = visitDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  const getIssueStatusBadgeClass = (status: 'Pending' | 'Assigned' | 'Resolved' | null): string => {
    if (!status) return 'issue-status-default';
    
    switch (status) {
      case 'Pending':
        return 'issue-status-pending';
      case 'Assigned':
        return 'issue-status-assigned';
      case 'Resolved':
        return 'issue-status-resolved';
      default:
        return 'issue-status-default';
    }
  };

  // Build data for Excel export using the currently filtered rows
  const buildExportAOA = (): (string | number | null)[][] => {
    const headers = [
      'Executive Name',
      'Store Name',
      'City',
      'Partner Brands',
      'Visit Date',
      'Issues',
      'Visit Status',
      'Reviewer',
      'Issue Status'
    ];

    const rows = filteredVisits.map(v => [
      v.executiveName,
      v.storeName,
      v.city,
      (v.partnerBrand || []).join(', '),
      formatVisitDate(v.visitDate),
      v.issues,
      formatVisitStatus(v.visitStatus),
      v.reviewerName || '',
      formatIssueStatus(v.issueStatus)
    ]);

    return [headers, ...rows];
  };

  const handleExportXLS = () => {
    const aoa = buildExportAOA();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths for readability
    (ws as any)['!cols'] = [
      { wch: 22 }, // Executive
      { wch: 28 }, // Store
      { wch: 14 }, // City
      { wch: 24 }, // Brands
      { wch: 14 }, // Date
      { wch: 40 }, // Issues
      { wch: 16 }, // Visit Status
      { wch: 18 }, // Reviewer
      { wch: 16 }  // Issue Status
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VisitReports');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const filename = `visit-reports-${yyyy}-${mm}-${dd}.xls`;
    XLSX.writeFile(wb, filename, { bookType: 'xls' });
  };

  // Get unique values from filter data (not visit data for better performance)
  const getFilterOptions = (type: 'brands' | 'cities' | 'stores' | 'executives'): string[] => {
    switch (type) {
      case 'brands':
        return filterData.brands.map(brand => brand.name);
      case 'cities':
        return filterData.cities;
      case 'stores':
        return filterData.stores.map(store => store.name);
      case 'executives':
        return filterData.executives.map(executive => executive.name);
      default:
        return [];
    }
  };

  // Get all possible visit status options (not just ones in current data)
  const getAllVisitStatusOptions = (): { value: string; label: string }[] => {
    return [
      { value: 'PENDING_REVIEW', label: 'Pending Review' },
      { value: 'REVIEWD', label: 'Reviewed' }
    ];
  };

  // Get all possible issue status options (simplified to match stores page)
  const getAllIssueStatusOptions = (): { value: string; label: string }[] => {
    return [
      { value: 'Pending', label: 'Pending' },
      { value: 'Resolved', label: 'Resolved' }
    ];
  };

  // Sorting functions
  const handleSort = (key: 'executiveName' | 'storeName' | 'visitDate') => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: 'executiveName' | 'storeName' | 'visitDate') => {
    if (sortConfig.key !== columnKey) {
      return '↕️'; // Both arrows when not sorted
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const getIssueIdByText = (issueText: string): number | null => {
    const issueMapping: Record<string, number> = {
      'No flyer stock': 1323,
      'Display demo req': 1324,
      'Low stock shelf': 1325,
      'WiFi connectivity issues': 1322,
      'Missing price tags': 1326,
      'Inventory management': 1327,
      'None': 0
    };
    return issueMapping[issueText] || null;
  };

  // Modal handlers
  const openVisitModal = (visit: VisitReportData) => {
    setSelectedVisit(visit);
    setShowModal(true);
  };

  const closeVisitModal = () => {
    setSelectedVisit(null);
    setShowModal(false);
  };

  // Mark visit as reviewed
  const markAsReviewed = async (visitId: string, adminComment?: string) => {
    setMarkingReviewedId(visitId);
    try {
      const response = await fetch(`/api/admin/visit-report/${visitId}/mark-reviewed`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ adminComment })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const reviewerName: string | undefined = result?.visit?.reviewedByAdmin?.name;
        // Update the local state to reflect the change
        setVisitData(prevVisits => 
          prevVisits.map(visit => 
            visit.id === visitId 
              ? { ...visit, visitStatus: 'REVIEWD' as const, reviewerName }
              : visit
          )
        );
        
        // Also update filtered visits if they exist
        setFilteredVisits(prevVisits => 
          prevVisits.map(visit => 
            visit.id === visitId 
              ? { ...visit, visitStatus: 'REVIEWD' as const, reviewerName }
              : visit
          )
        );
        
        // Show success message
        alert(result.message || 'Visit marked as reviewed successfully!');
      }
    } catch (error) {
      console.error('Error marking visit as reviewed:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to mark visit as reviewed'}`);
    } finally {
      setMarkingReviewedId(null);
    }
  };

  // Show critical errors immediately
  if (error) {
    return (
      <div className="admin-visit-report-overview">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '400px', gap: '1rem' }}>
          <div style={{ fontSize: '1.2rem', color: '#ef4444' }}>Error loading visit reports</div>
          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{error}</div>
          <button 
            onClick={() => fetchVisitReportData()} 
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
    <div className="admin-visit-report-overview">
      {/* Filters Section */}
      <div className="admin-visit-report-filters-section">
        <div className="admin-visit-report-filters-header" onClick={() => setShowFilters(!showFilters)}>
          <h3>Filters {showFilters ? '▼' : '▶'}</h3>
        </div>
        {showFilters && (
          filterError ? (
            <div style={{ padding: '1rem', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', margin: '0.5rem 0' }}>
              Error loading filters: {filterError}
              <button 
                onClick={() => fetchFilterData()}
                style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="admin-visit-report-filters-grid">
              <div className="admin-visit-report-filter-group">
                <label>Filter by Partner Brand</label>
                <select 
                  value={filters.partnerBrand}
                  onChange={(e) => handleFilterChange('partnerBrand', e.target.value)}
                  className="admin-visit-report-filter-select"
                  disabled={isLoadingFilters}
                >
                  <option value="All Brands">{isLoadingFilters ? 'Loading brands...' : 'All Brands'}</option>
                  {!isLoadingFilters && getFilterOptions('brands').map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                {isLoadingFilters && (
                  <div className="filter-loading">
                    <div className="loading-spinner-small"></div>
                  </div>
                )}
              </div>

              <div className="admin-visit-report-filter-group">
                <label>Filter by City</label>
                <select 
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  className="admin-visit-report-filter-select"
                  disabled={isLoadingFilters}
                >
                  <option value="All City">{isLoadingFilters ? 'Loading cities...' : 'All City'}</option>
                  {!isLoadingFilters && getFilterOptions('cities').map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                {isLoadingFilters && (
                  <div className="filter-loading">
                    <div className="loading-spinner-small"></div>
                  </div>
                )}
              </div>

              <div className="admin-visit-report-filter-group">
                <label>Search by Store Name</label>
                <input 
                  type="text"
                  value={filters.storeName}
                  onChange={(e) => handleFilterChange('storeName', e.target.value)}
                  className="admin-visit-report-filter-input"
                  placeholder="Type store name to search..."
                  disabled={isLoadingFilters}
                />
                {isLoadingFilters && (
                  <div className="filter-loading">
                    <div className="loading-spinner-small"></div>
                  </div>
                )}
              </div>

              <div className="admin-visit-report-filter-group">
                <label>Filter by Executive Name</label>
                <select 
                  value={filters.executiveName}
                  onChange={(e) => handleFilterChange('executiveName', e.target.value)}
                  className="admin-visit-report-filter-select"
                  disabled={isLoadingFilters}
                >
                  <option value="All Executive">{isLoadingFilters ? 'Loading executives...' : 'All Executive'}</option>
                  {!isLoadingFilters && filterData.executives.map(executive => (
                    <option key={executive.id} value={executive.id}>{executive.name}</option>
                  ))}
                </select>
                {isLoadingFilters && (
                  <div className="filter-loading">
                    <div className="loading-spinner-small"></div>
                  </div>
                )}
              </div>

              <div className="admin-visit-report-filter-group">
                <label>Filter by Review Status</label>
                <select 
                  value={filters.visitStatus}
                  onChange={(e) => handleFilterChange('visitStatus', e.target.value)}
                  className="admin-visit-report-filter-select"
                >
                  <option value="All Status">All Status</option>
                  {getAllVisitStatusOptions().map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="admin-visit-report-filter-group">
                <label>Filter by Issue Status</label>
                <select 
                  value={filters.issueStatus}
                  onChange={(e) => handleFilterChange('issueStatus', e.target.value)}
                  className="admin-visit-report-filter-select"
                >
                  <option value="All Status">All Status</option>
                  {getAllIssueStatusOptions().map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        )}
      </div>

      {/* Actions - Export */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '12px',
        marginBottom: '12px'
      }}>
        <button
          onClick={handleExportXLS}
          style={{
            padding: '10px 16px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
        >
          Export XLS
        </button>
      </div>

      {/* Visit Reports Table */}
      <div className="admin-visit-report-table-section">
        <div className="admin-visit-report-table">
          {/* Always show table header for context */}
          <div className="admin-visit-report-table-header">
            <div 
              className="admin-visit-report-header-cell sortable-header" 
              onClick={() => handleSort('executiveName')}
            >
              Executive Name <span className="sort-icon">{getSortIcon('executiveName')}</span>
            </div>
            <div 
              className="admin-visit-report-header-cell sortable-header" 
              onClick={() => handleSort('storeName')}
            >
              Store Name <span className="sort-icon">{getSortIcon('storeName')}</span>
            </div>
            <div className="admin-visit-report-header-cell">Partner Brand</div>
            <div 
              className="admin-visit-report-header-cell sortable-header" 
              onClick={() => handleSort('visitDate')}
            >
              Visit Date <span className="sort-icon">{getSortIcon('visitDate')}</span>
            </div>
            <div className="admin-visit-report-header-cell">Issues</div>
            <div className="admin-visit-report-header-cell">Status</div>
            <div className="admin-visit-report-header-cell">Actions</div>
          </div>
          
          {/* Table body with loading state */}
          <div className="admin-visit-report-table-body">
            {isLoading ? (
              <div className="table-loading">
                <div className="loading-spinner-large"></div>
                <span className="loading-text">Loading visit reports data...</span>
              </div>
            ) : filteredVisits.length > 0 ? (
              filteredVisits.map(visit => (
              <div key={visit.id} className="admin-visit-report-table-row">
                <div className="admin-visit-report-cell admin-visit-report-executive-cell">
                  <div 
                    className="admin-visit-report-executive-avatar"
                    style={{ backgroundColor: visit.avatarColor }}
                  >
                    {visit.executiveInitials}
                  </div>
                  <span className="admin-visit-report-executive-name">{visit.executiveName}</span>
                </div>
                
                <div className="admin-visit-report-cell admin-visit-report-store-name-cell">
                  <Link href={`/admin/stores?storeId=${visit.storeId}`} className="admin-visit-report-store-name-link">
                    {visit.storeName}
                  </Link>
                </div>
                
                <div className="admin-visit-report-cell admin-visit-report-partner-brands-cell">
                  {visit.partnerBrand.map((brand, index) => (
                    <span 
                      key={index}
                      className="admin-visit-report-brand-tag"
                      style={{ backgroundColor: getBrandColor(brand) }}
                    >
                      {brand}
                    </span>
                  ))}
                </div>
                
                <div className="admin-visit-report-cell admin-visit-report-date-cell">
                  <span className="admin-visit-report-visit-date">📅 {formatVisitDate(visit.visitDate)}</span>
                </div>
                
                <div className="admin-visit-report-cell admin-visit-report-issues-cell">
                  <div className="admin-visit-report-issues-content">
                    {visit.issues === 'None' ? (
                      <span className="admin-visit-report-no-issues">⚠️ {visit.issues}</span>
                    ) : (
                      <div className="admin-visit-report-issue-link-container">
                        <span className="admin-visit-report-issue-icon">⚠️</span>
                        {visit.issueId ? (
                          <Link 
                            href={`/admin/issues/${visit.issueId}`}
                            className="admin-visit-report-issue-link"
                            title={`View issue: ${visit.issues}`}
                          >
                            <ExpandableText 
                              text={visit.issues} 
                              maxHeight={40}
                              className="issue-expandable-text"
                            />
                          </Link>
                        ) : (
                          <ExpandableText 
                            text={visit.issues} 
                            maxHeight={40}
                            className="admin-visit-report-has-issues issue-expandable-text"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="admin-visit-report-cell admin-visit-report-status-cell">
                  <div className="admin-visit-report-status-badges">
                    <span className={`admin-visit-report-status-badge ${getVisitStatusBadgeClass(visit.visitStatus)}`}>
                      {visit.visitStatus === 'REVIEWD' && visit.reviewerName
                        ? `Reviewed by ${visit.reviewerName}`
                        : formatVisitStatus(visit.visitStatus)}
                    </span>
                    {visit.issueStatus && visit.issues !== 'None' && (
                      <span className={`admin-visit-report-status-badge ${getIssueStatusBadgeClass(visit.issueStatus)}`}>
                        Issue {formatIssueStatus(visit.issueStatus)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="admin-visit-report-cell admin-visit-report-actions-cell">
                  <div className="admin-visit-report-action-buttons-group">
                    <button 
                      className="admin-visit-report-view-details-btn"
                      onClick={() => openVisitModal(visit)}
                    >
                      View Details
                    </button>
                    {visit.visitStatus === 'PENDING_REVIEW' && (
                      <button 
                        className="admin-visit-report-mark-reviewed-btn"
                        onClick={() => markAsReviewed(visit.id)}
                        disabled={markingReviewedId === visit.id}
                        style={{
                          opacity: markingReviewedId === visit.id ? 0.6 : 1,
                          cursor: markingReviewedId === visit.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {markingReviewedId === visit.id ? 'Marking...' : 'Mark Reviewed'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              ))
            ) : (
              <div style={{ 
                padding: '3rem', 
                textAlign: 'center', 
                color: '#64748b', 
                fontSize: '1rem',
                gridColumn: '1 / -1'
              }}>
                No visit reports found matching the selected filters.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visit Details Modal */}
      <VisitDetailsModal
        isOpen={showModal}
        onClose={closeVisitModal}
        visit={selectedVisit}
      />
    </div>
  );
};

export default VisitReportPage;
