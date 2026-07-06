'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDateFilter } from '../contexts/DateFilterContext';
import '../visit-report/visit-report.css';

interface StakeholderVisitData {
  id: string;
  executiveName: string;
  executiveInitials: string;
  avatarColor: string;
  brandName: string;
  stakeholderDesignation: string;
  state: string;
  visitDate: string;
  nextScheduledDate?: string | null;
  visitStatus: 'PENDING_REVIEW' | 'REVIEWD';
  reviewerName?: string;
  feedback: string;
  peopleMet?: Array<{ name: string; designation: string; phoneNumber?: string }>;
  imageUrls?: string[];
  brands?: string[];
}

interface Filters {
  executiveName: string;
  executiveName: string;
  designation: string;
  visitStatus: string;
}

const StakeholderVisitReportPage: React.FC = () => {
  const { selectedDateFilter } = useDateFilter();
  const [visitData, setVisitData] = useState<StakeholderVisitData[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<StakeholderVisitData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize] = useState(50);
  const [showFilters, setShowFilters] = useState(true);
  const [markingReviewedId, setMarkingReviewedId] = useState<string | null>(null);
  const [selectedVisits, setSelectedVisits] = useState<Set<string>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [selectedVisitDetail, setSelectedVisitDetail] = useState<StakeholderVisitData | null>(null);
  const latestRequestIdRef = useRef<number>(0);

  // Filter options (populated from data)
  const [executives, setExecutives] = useState<Array<{ id: string; name: string }>>([]);

  const [filters, setFilters] = useState<Filters>({
    executiveName: 'All Executive',
    designation: '',
    visitStatus: 'All Status',
  });

  const fetchData = async (pageToFetch = currentPage) => {
    const requestId = ++latestRequestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('dateFilter', selectedDateFilter);
      params.append('page', pageToFetch.toString());
      params.append('limit', pageSize.toString());

      if (filters.executiveName !== 'All Executive') params.append('executiveId', filters.executiveName);
      if (filters.designation) params.append('designation', filters.designation);
      if (filters.visitStatus !== 'All Status') params.append('visitStatus', filters.visitStatus);
      params.append('_ts', String(Date.now()));

      const response = await fetch(`/api/admin/stakeholder-visit-report/data?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        credentials: 'include',
        cache: 'no-store',
      });

      if (requestId !== latestRequestIdRef.current) return;
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `HTTP error: ${response.status}`);
      }

      const data = await response.json();
      const list: StakeholderVisitData[] = data.visits || [];

      if (requestId !== latestRequestIdRef.current) return;

      setVisitData(list);
      setFilteredVisits(list);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
      setCurrentPage(data.page || 1);

      // Build filter options from loaded data
      const execMap = new Map<string, string>();
      list.forEach((v) => {
        if (v.executiveId && v.executiveId !== 'unknown' && v.executiveName) {
          execMap.set(v.executiveId, v.executiveName);
        }
      });
      const execs = Array.from(execMap.entries()).map(([id, name]) => ({ id, name }));
      setExecutives(execs);

    } catch (err) {
      if (requestId === latestRequestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setVisitData([]);
        setFilteredVisits([]);
      }
    } finally {
      if (requestId === latestRequestIdRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, [filters, selectedDateFilter]);

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleMarkReviewed = async (visitId: string) => {
    setMarkingReviewedId(visitId);
    try {
      const res = await fetch(`/api/admin/stakeholder-visit-report/${visitId}/mark-reviewed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adminComment: 'Reviewed' }),
      });
      const data = await res.json();
      if (data.success) {
        setVisitData((prev) => prev.map((v) => v.id === visitId ? { ...v, visitStatus: 'REVIEWD' as const, reviewerName: data.visit?.reviewedByAdmin?.name } : v));
        setFilteredVisits((prev) => prev.map((v) => v.id === visitId ? { ...v, visitStatus: 'REVIEWD' as const } : v));
      }
    } catch (err) {
      alert('Failed to mark as reviewed');
    } finally {
      setMarkingReviewedId(null);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allPendingIds = filteredVisits.filter((v) => v.visitStatus === 'PENDING_REVIEW').map((v) => v.id);
      setSelectedVisits(new Set(allPendingIds));
    } else {
      setSelectedVisits(new Set());
    }
  };

  const handleSelectVisit = (visitId: string, isChecked: boolean) => {
    const next = new Set(selectedVisits);
    isChecked ? next.add(visitId) : next.delete(visitId);
    setSelectedVisits(next);
  };

  const handleBulkApprove = async () => {
    if (selectedVisits.size === 0) return;
    setIsBulkApproving(true);
    const ids = Array.from(selectedVisits);
    let successCount = 0;
    const promises = ids.map((id) =>
      fetch(`/api/admin/stakeholder-visit-report/${id}/mark-reviewed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adminComment: 'Bulk Approved' }),
      }).then((r) => r.json())
    );
    const results = await Promise.allSettled(promises);
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        setVisitData((prev) => prev.map((v) => v.id === ids[idx] ? { ...v, visitStatus: 'REVIEWD' as const } : v));
      }
    });
    alert(`Bulk approved ${successCount} of ${ids.length} visits!`);
    setIsBulkApproving(false);
    setSelectedVisits(new Set());
  };

  const formatVisitDate = (dateString: string): string => {
    if (!dateString) return dateString;
    if (dateString.includes('/') && dateString.split('/').length === 3) return dateString;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === yesterday.getTime()) return 'Yesterday';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="evr-overview">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {isLoading ? 'Loading...' : `${totalRecords} stakeholder visit${totalRecords !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {selectedVisits.size > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              style={{ padding: '0.5rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
            >
              {isBulkApproving ? 'Approving...' : `✅ Bulk Approve (${selectedVisits.size})`}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="evr-filters-section">
        <div className="evr-filters-header" onClick={() => setShowFilters((s) => !s)}>
          <h3>🔍 Filters {showFilters ? '▲' : '▼'}</h3>
        </div>
        {showFilters && (
          <div className="evr-filters-grid">
            <div className="evr-filter-group">
              <label>Designation</label>
              <input
                className="evr-filter-input"
                placeholder="Search designation..."
                value={filters.designation}
                onChange={(e) => handleFilterChange('designation', e.target.value)}
              />
            </div>
            <div className="evr-filter-group">
              <label>Visit Status</label>
              <select className="evr-filter-select" value={filters.visitStatus} onChange={(e) => handleFilterChange('visitStatus', e.target.value)}>
                <option value="All Status">All Status</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="REVIEWD">Reviewed</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="evr-table-section">
        <div className="evr-table">
          {/* Header */}
          <div className="evr-table-header" style={{ gridTemplateColumns: '40px 1.5fr 1.8fr 1fr 1fr 1fr 1fr 1.5fr' }}>
            <div className="evr-header-cell">
              <input
                type="checkbox"
                onChange={handleSelectAll}
                checked={selectedVisits.size > 0 && selectedVisits.size === filteredVisits.filter((v) => v.visitStatus === 'PENDING_REVIEW').length}
              />
            </div>
            <div className="evr-header-cell">Executive</div>
            <div className="evr-header-cell">Stakeholder</div>
            <div className="evr-header-cell">Visit Date</div>
            <div className="evr-header-cell">People Met</div>
            <div className="evr-header-cell">Next Schedule</div>
            <div className="evr-header-cell">Status</div>
            <div className="evr-header-cell">Actions</div>
          </div>

          {/* Body */}
          <div className="evr-table-body">
            {isLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
                Loading visits...
              </div>
            ) : error ? (
              <div className="evr-no-data-message">
                <p>⚠️ {error}</p>
                <button onClick={() => fetchData()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Retry</button>
              </div>
            ) : filteredVisits.length === 0 ? (
              <div className="evr-no-data-message">
                <p>🤝 No stakeholder visits found for the selected filters.</p>
              </div>
            ) : (
              filteredVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="evr-table-row"
                  style={{ gridTemplateColumns: '40px 1.5fr 1.8fr 1fr 1fr 1fr 1fr 1.5fr', cursor: 'pointer' }}
                  onClick={() => setSelectedVisitDetail(visit)}
                >
                  {/* Checkbox */}
                  <div className="evr-cell" onClick={(e) => e.stopPropagation()}>
                    {visit.visitStatus === 'PENDING_REVIEW' && (
                      <input
                        type="checkbox"
                        checked={selectedVisits.has(visit.id)}
                        onChange={(e) => handleSelectVisit(visit.id, e.target.checked)}
                      />
                    )}
                  </div>

                  {/* Executive */}
                  <div className="evr-cell evr-executive-cell">
                    <div className="evr-executive-avatar" style={{ backgroundColor: visit.avatarColor }}>
                      {visit.executiveInitials}
                    </div>
                    <span className="evr-executive-name">{visit.executiveName}</span>
                  </div>

                  {/* Stakeholder */}
                  <div className="evr-cell" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.125rem' }}>
                    <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.875rem' }}>{visit.brandName}</span>
                    <span style={{ fontSize: '0.8125rem', color: '#6366f1', fontWeight: '500' }}>{visit.stakeholderDesignation}</span>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>📍 {visit.state}</span>
                  </div>

                  {/* City Removed from Table */}

                  {/* Visit Date */}
                  <div className="evr-cell evr-date-cell">
                    <span className="evr-visit-date">{formatVisitDate(visit.visitDate)}</span>
                  </div>

                  {/* People Met */}
                  <div className="evr-cell" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.125rem' }}>
                    {(visit.peopleMet || []).slice(0, 2).map((p, i) => (
                      <span key={i} style={{ fontSize: '0.8125rem', color: '#374151' }}>
                        {p.name}{p.designation ? ` (${p.designation})` : ''}
                      </span>
                    ))}
                    {(visit.peopleMet?.length || 0) > 2 && (
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>+{(visit.peopleMet?.length || 0) - 2} more</span>
                    )}
                  </div>

                  {/* Next Schedule */}
                  <div className="evr-cell evr-date-cell" style={{ color: '#6b7280' }}>
                    {visit.nextScheduledDate || '-'}
                  </div>

                  {/* Status */}
                  <div className="evr-cell evr-status-cell">
                    <span className={`evr-status-badge ${visit.visitStatus === 'REVIEWD' ? 'evr-visit-status-reviewed' : 'evr-visit-status-pending'}`}>
                      {visit.visitStatus === 'REVIEWD' ? 'Reviewed' : 'Pending Review'}
                    </span>
                    {visit.reviewerName && (
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.125rem' }}>by {visit.reviewerName}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="evr-cell evr-actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="evr-action-buttons-group">
                      <button
                        className="evr-view-details-btn"
                        onClick={() => setSelectedVisitDetail(visit)}
                      >
                        View Details
                      </button>
                      {visit.visitStatus === 'PENDING_REVIEW' && (
                        <button
                          className="evr-mark-reviewed-btn"
                          onClick={() => handleMarkReviewed(visit.id)}
                          disabled={markingReviewedId === visit.id}
                        >
                          {markingReviewedId === visit.id ? '...' : '✓ Approve'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
            <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
          </div>
        </div>
      )}

      {/* Visit Detail Modal */}
      {selectedVisitDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#1e293b' }}>
                  🤝 Stakeholder Visit Details
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                  by {selectedVisitDetail.executiveName}
                </p>
              </div>
              <button onClick={() => setSelectedVisitDetail(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Stakeholder Info */}
              <div style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '1rem' }}>
                    {selectedVisitDetail.brandName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', color: '#1e293b' }}>{selectedVisitDetail.brandName}</p>
                    <p style={{ margin: '0.125rem 0 0', fontSize: '0.875rem', color: '#6366f1', fontWeight: '500' }}>{selectedVisitDetail.stakeholderDesignation}</p>
                    {selectedVisitDetail.brands && selectedVisitDetail.brands.length > 0 && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {selectedVisitDetail.brands.map((b, i) => (
                          <span key={i} style={{ background: '#e2e8f0', color: '#334155', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500' }}>
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Visit Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.875rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>State</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem', color: '#1e293b', fontWeight: '500' }}>{selectedVisitDetail.state}</p>
                </div>
                <div style={{ padding: '0.875rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visit Date</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem', color: '#1e293b', fontWeight: '500' }}>{formatVisitDate(selectedVisitDetail.visitDate)}</p>
                </div>
                <div style={{ padding: '0.875rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</p>
                  <p style={{ margin: '0.25rem 0 0' }}>
                    <span style={{
                      fontSize: '0.8125rem', padding: '0.125rem 0.5rem', borderRadius: '12px',
                      background: selectedVisitDetail.visitStatus === 'REVIEWD' ? '#dcfce7' : '#fef3c7',
                      color: selectedVisitDetail.visitStatus === 'REVIEWD' ? '#16a34a' : '#d97706',
                      fontWeight: '500'
                    }}>
                      {selectedVisitDetail.visitStatus === 'REVIEWD' ? 'Reviewed' : 'Pending Review'}
                    </span>
                  </p>
                </div>
                {selectedVisitDetail.nextScheduledDate && (
                  <div style={{ padding: '0.875rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', gridColumn: '1 / -1' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Visit</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem', color: '#1e293b', fontWeight: '500' }}>{selectedVisitDetail.nextScheduledDate}</p>
                  </div>
                )}
              </div>

              {/* People Met */}
              {(selectedVisitDetail.peopleMet || []).length > 0 && (
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>👤 People Met</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedVisitDetail.peopleMet!.map((p, i) => (
                      <div key={i} style={{ padding: '0.625rem 0.875rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <span style={{ fontWeight: '600', color: '#166534', fontSize: '0.875rem' }}>{p.name}</span>
                        {p.designation && <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}> — {p.designation}</span>}
                        {p.phoneNumber && <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}> | {p.phoneNumber}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {selectedVisitDetail.feedback && selectedVisitDetail.feedback !== 'No feedback provided' && (
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>💬 Remarks</p>
                  <p style={{ margin: 0, padding: '0.875rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem', color: '#374151', lineHeight: '1.5' }}>
                    {selectedVisitDetail.feedback}
                  </p>
                </div>
              )}

              {/* Photos */}
              {(selectedVisitDetail.imageUrls || []).length > 0 && (
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>📸 Photos</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {selectedVisitDetail.imageUrls!.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Visit photo ${i + 1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setSelectedVisitDetail(null)} style={{ padding: '0.625rem 1.25rem', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                Close
              </button>
              {selectedVisitDetail.visitStatus === 'PENDING_REVIEW' && (
                <button
                  onClick={async () => {
                    await handleMarkReviewed(selectedVisitDetail.id);
                    setSelectedVisitDetail(null);
                  }}
                  disabled={markingReviewedId === selectedVisitDetail.id}
                  style={{ padding: '0.625rem 1.25rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
                >
                  ✓ Mark as Reviewed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default StakeholderVisitReportPage;
