'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDateFilter } from '../contexts/DateFilterContext';
import VisitDetailsModal from '../components/VisitDetailsModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  previousVisitDate?: string | null;
  nextScheduledDate?: string | null;
  visitStatus: 'PENDING_REVIEW' | 'REVIEWD';
  reviewerName?: string;
  issueStatus: 'Pending' | 'Assigned' | 'Resolved' | null;
  city: string;
  issues: string;
  issueId?: string;
  feedback: string;
  POSMchecked: boolean | null;
  peopleMet?: Array<{ name: string, designation: string, phoneNumber?: string }>;
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedDateFilter } = useDateFilter();
  const isDigital = pathname.includes('/admin/digital-report');
  const baseEndpoint = isDigital ? '/api/admin/digital-report' : '/api/admin/visit-report';
  const [visitData, setVisitData] = useState<VisitReportData[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<VisitReportData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [pageSize] = useState<number>(50);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [markingReviewedId, setMarkingReviewedId] = useState<string | null>(null);
  const [selectedVisits, setSelectedVisits] = useState<Set<string>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState<boolean>(false);


  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allPendingIds = filteredVisits.filter(v => v.visitStatus === 'PENDING_REVIEW').map(v => v.id);
      setSelectedVisits(new Set(allPendingIds));
    } else {
      setSelectedVisits(new Set());
    }
  };

  const handleSelectVisit = (visitId: string, isChecked: boolean) => {
    const newSelected = new Set(selectedVisits);
    if (isChecked) {
      newSelected.add(visitId);
    } else {
      newSelected.delete(visitId);
    }
    setSelectedVisits(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedVisits.size === 0) return;
    setIsBulkApproving(true);

    // Convert to Array
    const idsToApprove = Array.from(selectedVisits);

    // We can do them in parallel or sequentially. Next API handles individual routes.
    let successCount = 0;

    // Here we map over them and resolve all using Promis.allSettled
    const promises = idsToApprove.map(id => fetch(`${baseEndpoint}/${id}/mark-reviewed`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ requiresFollowUp: false, adminComment: 'Bulk Approved' })
    }).then(res => res.json()));

    try {
      const results = await Promise.allSettled(promises);
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
          // Update the localized visit as well efficiently
          const reviewerName = result.value.visit?.reviewedByAdmin?.name;
          setVisitData(prev => prev.map(v => v.id === idsToApprove[idx] ? { ...v, visitStatus: 'REVIEWD' as const, reviewerName } : v));
        }
      });
      alert(`Bulk approved ${successCount} out of ${idsToApprove.length} visits successfully!`);
    } catch (err) {
      console.error("Bulk approve error:", err);
      alert('Error during bulk approve.');
    } finally {
      setIsBulkApproving(false);
      setSelectedVisits(new Set());
    }
  };

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: 'executiveName' | 'storeName' | 'visitDate' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // Filter data from API
  const [filterData, setFilterData] = useState<{
    stores: Array<{ id: string, name: string, city: string }>;
    executives: Array<{ id: string, name: string, region: string }>;
    brands: Array<{ id: string, name: string }>;
    cities: string[];
  }>({ stores: [], executives: [], brands: [], cities: [] });

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

  // Fetch visit report data from API with server-side pagination and filtering
  const fetchVisitReportData = async (pageToFetch = currentPage) => {
    setIsLoading(true);
    setError(null);
    try {
      const effectiveDateFilter = selectedDateFilter;

      try {
        const current = new URL(window.location.href);
        current.searchParams.set('dateFilter', effectiveDateFilter);
        window.history.replaceState({}, '', current.toString());
      } catch { }

      const params = new URLSearchParams();
      params.append('dateFilter', effectiveDateFilter);
      params.append('page', pageToFetch.toString());
      params.append('limit', pageSize.toString());

      if (filters.partnerBrand !== 'All Brands') params.append('partnerBrand', filters.partnerBrand);
      if (filters.city !== 'All City') params.append('city', filters.city);
      if (filters.storeName) params.append('storeName', filters.storeName);
      if (filters.executiveName !== 'All Executive') params.append('executiveId', filters.executiveName);
      if (filters.visitStatus !== 'All Status') params.append('visitStatus', filters.visitStatus);
      if (filters.issueStatus !== 'All Status') params.append('issueStatus', filters.issueStatus);

      params.append('_ts', String(Date.now()));
      
      const response = await fetch(`${baseEndpoint}/data?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include',
        cache: 'no-store'
      });

      if (response.status === 304) {
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const list = data.visits || [];
      
      // Client-side sort for current page if sortConfig is set
      if (sortConfig.key) {
        list.sort((a, b) => {
          let aValue = a[sortConfig.key];
          let bValue = b[sortConfig.key];
          if (sortConfig.key === 'visitDate') {
            aValue = new Date(a.visitDate).getTime();
            bValue = new Date(b.visitDate).getTime();
          } else {
            aValue = String(aValue).toLowerCase();
            bValue = String(bValue).toLowerCase();
          }
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      setVisitData(list);
      setFilteredVisits(list); // They are the same now, as filtering is server-side
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
      setCurrentPage(data.page || 1);
    } catch (error) {
      console.error('Failed to fetch visit report data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load visit report data');
      setVisitData([]);
      setFilteredVisits([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch on mount
  useEffect(() => {
    fetchFilterData();
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

    let newFilters = { ...filters };
    let filtersChanged = false;

    if (urlStoreId || urlStoreName || urlExecutiveId || urlPartnerBrand || urlCity || urlVisitStatus || urlIssueStatus) {
      if (urlStoreName) newFilters.storeName = urlStoreName;

      let executiveFilter = 'All Executive';
      if (urlExecutiveId && urlExecutiveId !== 'All Executive') {
        const matchingExecutive = filterData.executives.find(exec => exec.id === urlExecutiveId);
        executiveFilter = matchingExecutive ? urlExecutiveId : 'All Executive';
      }
      newFilters.executiveName = executiveFilter;
      newFilters.partnerBrand = urlPartnerBrand || newFilters.partnerBrand;
      newFilters.city = urlCity || newFilters.city;
      newFilters.visitStatus = urlVisitStatus || newFilters.visitStatus;
      newFilters.issueStatus = urlIssueStatus || newFilters.issueStatus;
      filtersChanged = true;
    }

    if (filtersChanged) {
      setFilters(newFilters);
    }
  }, [filterData.stores, filterData.executives]); // Wait for filter data to be loaded

  // Refetch data when filters, page, sort or date filter changes
  useEffect(() => {
    fetchVisitReportData(currentPage);
  }, [filters, currentPage, selectedDateFilter, sortConfig.key, sortConfig.direction]);


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

  // Format date for XLS only: always dd/mm/yyyy (no Today/Yesterday)
  const formatDateForXLS = (dateStr: string): string => {
    if (!dateStr) return '';
    // If already dd/mm/yyyy, return as is
    if (dateStr.includes('/') && dateStr.split('/').length === 3) return dateStr;
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    if (dateStr === 'Today') {
      return `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
    }
    if (dateStr === 'Yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      return `${pad(y.getDate())}/${pad(y.getMonth() + 1)}/${y.getFullYear()}`;
    }
    // Fallback: try Date parse
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    return dateStr;
  };

  // Build data for Excel export using the currently filtered rows
  const buildExportAOA = (): (string | number | null)[][] => {
    // Determine maximum photos across filtered visits (cap at 3 to keep sheet compact)
    const maxPhotos = Math.min(3, Math.max(0, ...filteredVisits.map(v => v.imageUrls?.length || 0)));

    const baseHeaders = [
      'Executive Name',
      'Store Name',
      'City',
      'Partner Brands',
      isDigital ? 'Connect Date' : 'Visit Date',
      'Persons Met',
      'POSM Available',
      'Next Schedule',
      'Remarks',
      'Issues',
      'Visit Status',
      'Reviewer',
      'Issue Status'
    ];
    const photoHeaders = Array.from({ length: maxPhotos }, (_, i) => `Photo ${i + 1}`);
    const headers = [...baseHeaders, ...photoHeaders];

    const rows = filteredVisits.map(v => {
      const persons = (v.peopleMet || [])
        .map((p, idx) => `${idx + 1}. ${p.name}${p.designation ? ` (${p.designation})` : ''}${p.phoneNumber ? ` [${p.phoneNumber}]` : ''}`)
        .join('; ');

      const posm = v.POSMchecked === null || v.POSMchecked === undefined
        ? 'Not specified'
        : v.POSMchecked ? 'Yes' : 'No';

      const photoCells = Array.from({ length: maxPhotos }, (_, i) => v.imageUrls?.[i] || '');

      return [
        v.executiveName,
        v.storeName,
        v.city,
        (v.partnerBrand || []).join(', '),
        formatDateForXLS(v.visitDate),
        persons,
        posm,
        v.nextScheduledDate || '',
        v.feedback || 'No feedback provided',
        v.issues,
        formatVisitStatus(v.visitStatus),
        v.reviewerName || '',
        formatIssueStatus(v.issueStatus),
        ...photoCells
      ];
    });

    return [headers, ...rows];
  };

  const handleExportXLS = () => {
    // Build sheet data first
    const aoa = buildExportAOA();
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Add hyperlinks to each photo URL cell
    // Find how many photo columns were added by looking at header row
    const header = aoa[0];
    const photoStartIdx = header.findIndex(h => String(h).startsWith('Photo '));
    const photoCount = photoStartIdx === -1 ? 0 : header.length - photoStartIdx;

    if (photoCount > 0) {
      filteredVisits.forEach((v, rowIdx) => {
        for (let j = 0; j < photoCount; j++) {
          const url = v.imageUrls?.[j];
          if (!url) continue;
          const cellAddr = XLSX.utils.encode_cell({ c: photoStartIdx + j, r: rowIdx + 1 }); // +1 to skip header
          const cell = (ws as any)[cellAddr] || { t: 's', v: url };
          // Display URL text and make it clickable
          cell.v = url;
          cell.l = { Target: url, Tooltip: `Open Photo ${j + 1}` };
          (ws as any)[cellAddr] = cell;
        }
      });
    }

    // Column widths for readability
    (ws as any)['!cols'] = [
      { wch: 22 }, // Executive
      { wch: 28 }, // Store
      { wch: 14 }, // City
      { wch: 24 }, // Brands
      { wch: 12 }, // Date
      { wch: 40 }, // Persons Met
      { wch: 14 }, // POSM
      { wch: 16 }, // Next Schedule
      { wch: 40 }, // Remarks
      { wch: 40 }, // Issues
      { wch: 16 }, // Visit Status
      { wch: 18 }, // Reviewer
      { wch: 16 }, // Issue Status
      ...Array.from({ length: photoCount }, () => ({ wch: 50 })) // Photo columns
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isDigital ? 'DigitalVisitReports' : 'VisitReports');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const filename = `${isDigital ? 'digital-visit-reports' : 'visit-reports'}-${yyyy}-${mm}-${dd}.xlsx`;
    XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Add a title
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text(`${isDigital ? 'Digital Visit Reports' : 'Visit Reports'}`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

    // Group visits by executiveName
    const groupedVisits: Record<string, VisitReportData[]> = {};
    filteredVisits.forEach(visit => {
      const name = visit.executiveName || 'Unknown Executive';
      if (!groupedVisits[name]) groupedVisits[name] = [];
      groupedVisits[name].push(visit);
    });

    let currentY = 35;

    Object.entries(groupedVisits).forEach(([executiveName, visits], index) => {
      if (currentY > 160) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235); // Blue color for executive name
      doc.text(`Executive: ${executiveName} (${visits.length} Visits)`, 14, currentY);
      currentY += 8;

      const headers = [
        'Date',
        'Store',
        'City',
        'Brands',
        'Persons Met',
        'Remarks / Feedback',
        'Issues',
        'Photos',
        'Status'
      ];

      const data = visits.map(v => {
        const persons = (v.peopleMet || [])
          .map((p, idx) => `${idx + 1}. ${p.name}${p.designation ? ` (${p.designation})` : ''}`)
          .join('\n');
        
        const remarks = v.feedback && v.feedback.trim() !== '' ? v.feedback : '-';
        const issues = v.issues && v.issues.trim() !== 'None' ? v.issues : '-';
        
        const photos = (v.imageUrls || [])
          .map((url, idx) => `Photo ${idx + 1}`)
          .join('\n');

        return [
          formatDateForXLS(v.visitDate),
          v.storeName,
          v.city,
          (v.partnerBrand || []).join(', '),
          persons || '-',
          remarks,
          issues,
          photos || '-',
          formatVisitStatus(v.visitStatus)
        ];
      });

      autoTable(doc, {
        head: [headers],
        body: data,
        startY: currentY,
        theme: 'grid',
        rowPageBreak: 'avoid',
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', textColor: [50, 50, 50], valign: 'top' },
        headStyles: { fillColor: [240, 244, 248], textColor: [37, 99, 235], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 22 }, // Date
          1: { cellWidth: 32 }, // Store
          2: { cellWidth: 20 }, // City
          3: { cellWidth: 22 }, // Brands
          4: { cellWidth: 30 }, // Persons Met
          5: { cellWidth: 54 }, // Remarks
          6: { cellWidth: 40 }, // Issues
          7: { cellWidth: 18, textColor: [37, 99, 235] }, // Photos
          8: { cellWidth: 18 }, // Status
        },
        didDrawCell: (dataHook) => {
          if (dataHook.column.index === 7 && dataHook.cell.section === 'body') {
            const rowIndex = dataHook.row.index;
            const visit = visits[rowIndex];
            if (visit && visit.imageUrls && visit.imageUrls.length > 0) {
              const lineSpacing = dataHook.cell.styles.fontSize * 0.3527 * 1.5; // Approx height per line
              let yPos = dataHook.cell.y + dataHook.cell.padding('top') / 2;
              visit.imageUrls.forEach((url) => {
                doc.link(dataHook.cell.x, yPos, dataHook.cell.width, lineSpacing, { url });
                yPos += lineSpacing;
              });
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    });

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const filename = `${isDigital ? 'digital-visit-reports' : 'visit-reports'}-${yyyy}-${mm}-${dd}.pdf`;
    
    doc.save(filename);
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
  const markAsReviewed = async (visitId: string, requiresFollowUp: boolean = false, adminComment?: string) => {
    setMarkingReviewedId(visitId);
    try {
      const response = await fetch(`${baseEndpoint}/${visitId}/mark-reviewed`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          requiresFollowUp,
          adminComment
        })
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
              {/* Store filter first */}
              <div className="admin-visit-report-filter-group">
                <label>Filter by Store Name</label>
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

              {/* Then Partner Brand */}
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

              {/* Then City */}
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

              {/* Then Executive */}
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

              {/* Then other filters */}
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

      {/* Actions - Export and Bulk Approve */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '12px',
        marginBottom: '12px'
      }}>
        <div>
          {selectedVisits.size > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              style={{
                padding: '10px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isBulkApproving ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                opacity: isBulkApproving ? 0.7 : 1
              }}
            >
              {isBulkApproving ? 'Approving...' : `Bulk Approve (${selectedVisits.size})`}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleExportPDF}
            style={{
              padding: '10px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; }}
          >
            Export PDF
          </button>
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
      </div>

      {/* Visit Reports Table */}
      <div className="admin-visit-report-table-section">
        <div className="admin-visit-report-table">
          {/* Always show table header for context */}
          <div className="admin-visit-report-table-header">
            <div className="admin-visit-report-header-cell checkbox-cell" style={{ width: '40px', padding: '0 10px' }}>
              <input
                type="checkbox"
                onChange={handleSelectAll}
                checked={selectedVisits.size > 0 && selectedVisits.size === filteredVisits.filter(v => v.visitStatus === 'PENDING_REVIEW').length && filteredVisits.filter(v => v.visitStatus === 'PENDING_REVIEW').length > 0}
                title="Select all pending visits"
              />
            </div>
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
              {isDigital ? 'Connect Date' : 'Visit Date'} <span className="sort-icon">{getSortIcon('visitDate')}</span>
            </div>
            <div className="admin-visit-report-header-cell">Next Schedule</div>
            <div className="admin-visit-report-header-cell">Issues</div>
            <div className="admin-visit-report-header-cell" style={{ justifyContent: 'center' }}>Sales</div>
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
                  <div className="admin-visit-report-cell checkbox-cell" style={{ width: '40px', padding: '0 10px', display: 'flex', alignItems: 'center' }}>
                    {visit.visitStatus === 'PENDING_REVIEW' && (
                      <input
                        type="checkbox"
                        checked={selectedVisits.has(visit.id)}
                        onChange={(e) => handleSelectVisit(visit.id, e.target.checked)}
                      />
                    )}
                  </div>
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
                    <div className="admin-visit-report-visit-date" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📅 {formatVisitDate(visit.visitDate)}
                    </div>
                    {visit.previousVisitDate && (
                      <div className="admin-visit-report-prev-date" style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                        Prev: {visit.previousVisitDate}
                      </div>
                    )}
                  </div>

                  <div className="admin-visit-report-cell admin-visit-report-next-schedule-cell" style={{ display: 'flex', alignItems: 'center' }}>
                    {visit.nextScheduledDate ? (
                      <span style={{ fontWeight: '500', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        📅 {visit.nextScheduledDate}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
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

                  <div className="admin-visit-report-cell admin-visit-report-status-cell" style={{ display: 'flex', justifyContent: 'center' }}>
                    <Link
                      href={`/admin/sales?storeId=${visit.storeId}&storeName=${encodeURIComponent(visit.storeName)}`}
                      target="_blank"
                    >
                      <button
                        className="admin-visit-report-view-details-btn"
                        style={{ backgroundColor: '#8b5cf6', borderColor: '#7c3aed', color: 'white' }}
                      >
                        View Sales
                      </button>
                    </Link>
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
                          onClick={() => markAsReviewed(visit.id, false)}
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

      {/* Pagination Controls */}
      {totalPages > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || isLoading}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f1f5f9' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 500 }}
          >
            Previous
          </button>
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#475569' }}>
            Page {currentPage} of {totalPages} <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '4px' }}>({totalRecords} total records)</span>
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || isLoading}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: currentPage === totalPages ? '#f1f5f9' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 500 }}
          >
            Next
          </button>
        </div>
      )}

      {/* Visit Details Modal */}
      <VisitDetailsModal
        isOpen={showModal}
        onClose={closeVisitModal}
        visit={selectedVisit}
        onMarkReviewed={markAsReviewed}
        isMarkingReviewed={markingReviewedId === selectedVisit?.id}
        isDigital={isDigital}
      />
    </div>
  );
};

export default VisitReportPage;
