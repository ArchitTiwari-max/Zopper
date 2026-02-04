'use client';

import React, { useState, useEffect } from 'react';
import './page.css';

interface HolidayRequest {
    id: string;
    secDetails: string; // "Name (Phone)"
    submittedBy: string;
    reason: string;
    startDate: string;
    endDate: string;
    storeName: string;
    storeId: string | null;
    submittedAt: string;
    type?: 'VACATION' | 'WEEK_OFF';
}

interface Executive {
    id: string;
    name: string;
}

const SecHolidayRecordsPage: React.FC = () => {
    const [requests, setRequests] = useState<HolidayRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters state
    const [secNameFilter, setSecNameFilter] = useState('');
    const [executiveFilter, setExecutiveFilter] = useState('ALL');
    const [storeNameFilter, setStoreNameFilter] = useState('');
    const [recordTypeFilter, setRecordTypeFilter] = useState('VACATION');

    const [executives, setExecutives] = useState<Executive[]>([]);
    const [isFiltersVisible, setIsFiltersVisible] = useState(true);

    const [selectedRequest, setSelectedRequest] = useState<HolidayRequest | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = (request: HolidayRequest) => {
        setSelectedRequest(request);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedRequest(null);
    };

    // Fetch Executives for Dropdown
    useEffect(() => {
        const fetchExecutives = async () => {
            try {
                const res = await fetch('/api/admin/visit-report/filters');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.executives)) {
                        setExecutives(data.executives.map((e: any) => ({ id: String(e.id), name: e.name })));
                    }
                }
            } catch (err) {
                console.error('Failed to fetch executives', err);
            }
        };
        fetchExecutives();
    }, []);

    // Fetch Holiday Requests when filters change (or debounce them)
    useEffect(() => {
        const fetchRequests = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                if (secNameFilter) params.append('secName', secNameFilter);
                if (executiveFilter !== 'ALL') params.append('executiveId', executiveFilter);
                if (recordTypeFilter !== 'ALL') params.append('type', recordTypeFilter);
                console.log('Fetching params:', params.toString());

                // We aren't filtering storeId on server because we collect storeName text filter on client or server? 
                // My API implemented storeId filter, but user wants to search by Store Name string. 
                // I'll filter Store Name on CLIENT side for now, or update API. 
                // Updating API to search storeName requires joining which my API didn't do efficiently.
                // Let's filter storeName on client side after fetching.

                const res = await fetch(`/api/admin/holiday-requests?${params.toString()}`);
                if (!res.ok) throw new Error('Failed to fetch holiday requests');

                const json = await res.json();
                let data: HolidayRequest[] = json.data || [];

                // Client-side Filter for Store Name
                if (storeNameFilter) {
                    const lowerStore = storeNameFilter.toLowerCase();
                    data = data.filter(r => r.storeName.toLowerCase().includes(lowerStore));
                }

                setRequests(data);
            } catch (err) {
                setError('Error loading records');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce for text inputs
        const timeoutId = setTimeout(() => {
            fetchRequests();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [secNameFilter, executiveFilter, storeNameFilter, recordTypeFilter]);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="sec-holiday-container">
            <div className="filters-header" onClick={() => setIsFiltersVisible(!isFiltersVisible)}>
                <h3>
                    Filters
                    <span style={{ transform: isFiltersVisible ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '12px' }}>▼</span>
                </h3>
            </div>

            {isFiltersVisible && (
                <div className="filters-panel">
                    {/* Record Type Filter */}
                    <div className="filter-group">
                        <label className="filter-label">Record Type</label>
                        <select
                            className="filter-select"
                            value={recordTypeFilter}
                            onChange={(e) => {
                                setRecordTypeFilter(e.target.value);
                                setRequests([]);
                                setIsLoading(true);
                            }}
                            style={{ borderColor: recordTypeFilter === 'WEEK_OFF' ? '#17a2b8' : '#6f42c1' }}
                        >
                            <option value="VACATION">Vacation Records</option>
                            <option value="WEEK_OFF">Week Off Records</option>
                        </select>
                    </div>

                    {/* SEC Name Filter */}
                    <div className="filter-group">
                        <label className="filter-label">SEC Name</label>
                        <input
                            type="text"
                            className="filter-input"
                            placeholder="Search SEC Name..."
                            value={secNameFilter}
                            onChange={(e) => setSecNameFilter(e.target.value)}
                        />
                    </div>

                    {/* Executive Filter */}
                    <div className="filter-group">
                        <label className="filter-label">Submitted By (Executive)</label>
                        <select
                            className="filter-select"
                            value={executiveFilter}
                            onChange={(e) => setExecutiveFilter(e.target.value)}
                        >
                            <option value="ALL">All Executives</option>
                            {executives.map(exec => (
                                <option key={exec.id} value={exec.id}>{exec.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Store Name Filter */}
                    <div className="filter-group">
                        <label className="filter-label">Store Name</label>
                        <input
                            type="text"
                            className="filter-input"
                            placeholder="Type to search Store..."
                            value={storeNameFilter}
                            onChange={(e) => setStoreNameFilter(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {error && (
                <div style={{ color: '#ef4444', marginBottom: '16px', padding: '12px', background: '#fee2e2', borderRadius: '8px' }}>
                    {error}
                </div>
            )}

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>SEC Details</th>
                            <th>{recordTypeFilter === 'WEEK_OFF' ? 'Week Off Date' : 'Vacation Period'}</th>
                            <th>Reason</th>
                            <th>Store</th>
                            <th>Submitted By</th>
                            <th>Submitted On</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={7}>
                                    <div className="loading-container">
                                        <div className="spinner"></div>
                                        <span>Loading records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : requests.length === 0 ? (
                            <tr>
                                <td colSpan={7}>
                                    <div className="no-data">
                                        No {recordTypeFilter === 'WEEK_OFF' ? 'week off' : 'vacation'} records found matching your filters.
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            requests.map((req) => (
                                <tr key={req.id}>
                                    <td>
                                        {req.secDetails.split(', ').map((sec, idx) => (
                                            <span key={idx} className="sec-pill" title={sec}>
                                                {sec}
                                            </span>
                                        ))}
                                    </td>
                                    <td>
                                        {recordTypeFilter === 'WEEK_OFF'
                                            ? formatDate(req.startDate)
                                            : `${formatDate(req.startDate)} - ${formatDate(req.endDate)}`
                                        }
                                    </td>
                                    <td>{req.reason}</td>
                                    <td>{req.storeName}</td>
                                    <td>
                                        <strong>{req.submittedBy}</strong>
                                    </td>
                                    <td style={{ color: '#64748b', fontSize: '13px' }}>
                                        {formatDate(req.submittedAt)}
                                    </td>
                                    <td>
                                        <button
                                            className="view-btn"
                                            onClick={() => openModal(req)}
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && selectedRequest && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Vacation Request Details</h3>
                            <button className="close-btn" onClick={closeModal}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-row">
                                <span className="detail-label">SEC Details</span>
                                <div className="detail-value">
                                    {selectedRequest.secDetails.split(', ').map((sec, idx) => (
                                        <span key={idx} className="sec-pill">{sec}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">
                                    {selectedRequest.type === 'WEEK_OFF' ? 'Week Off Date' : 'Vacation Period'}
                                </span>
                                <span className="detail-value">
                                    {selectedRequest.type === 'WEEK_OFF'
                                        ? formatDate(selectedRequest.startDate)
                                        : `${formatDate(selectedRequest.startDate)} - ${formatDate(selectedRequest.endDate)}`
                                    }
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Reason</span>
                                <span className="detail-value reason-text">{selectedRequest.reason}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Store</span>
                                <span className="detail-value">{selectedRequest.storeName}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Submitted By</span>
                                <span className="detail-value">{selectedRequest.submittedBy}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Submitted On</span>
                                <span className="detail-value">{formatDate(selectedRequest.submittedAt)}</span>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecHolidayRecordsPage;
