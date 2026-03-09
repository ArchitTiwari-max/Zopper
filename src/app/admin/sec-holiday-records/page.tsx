'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
    replacementAvailable?: boolean | null;
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
    const [recordTypeFilter, setRecordTypeFilter] = useState('ALL');

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
                if (!res.ok) {
                    console.error('API Error Status:', res.status, res.statusText);
                    let errorData;
                    try {
                        errorData = await res.json();
                    } catch (e) {
                        const text = await res.text().catch(() => 'No response body');
                        console.error('API Error Raw Text:', text);
                        errorData = { details: `Server Error (${res.status}): ${text}` };
                    }
                    console.error('API Error JSON:', errorData);
                    throw new Error(errorData.details || errorData.error || 'Failed to fetch holiday requests');
                }

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

    const handleExportExcel = () => {
        if (!requests || requests.length === 0) {
            alert('No data to export');
            return;
        }

        const dataToExport = requests.map(req => ({
            'SEC Details': req.secDetails,
            'Request Type': req.type === 'WEEK_OFF' ? 'Week Off' : 'Vacation',
            'Start Date': formatDate(req.startDate),
            'End Date': formatDate(req.endDate),
            'Reason': req.reason,
            'Replacement Available': req.type === 'WEEK_OFF' ? 'N/A' : (req.replacementAvailable ? 'Available' : 'Not Available'),
            'Store Name': req.storeName,
            'Submitted By': req.submittedBy,
            'Submitted On': formatDate(req.submittedAt)
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Holiday Requests");
        XLSX.writeFile(wb, `Holiday_Requests_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="sec-holiday-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div className="filters-header" onClick={() => setIsFiltersVisible(!isFiltersVisible)} style={{ marginBottom: 0 }}>
                    <h3>
                        Filters
                        <span style={{ transform: isFiltersVisible ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '12px', marginLeft: '5px' }}>▼</span>
                    </h3>
                </div>
                <button
                    onClick={handleExportExcel}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <span>📊</span> Download Excel
                </button>
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
                            style={{ borderColor: recordTypeFilter === 'WEEK_OFF' ? '#17a2b8' : recordTypeFilter === 'ALL' ? '#28a745' : '#6f42c1' }}
                        >
                            <option value="ALL">All Records</option>
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
                            <th>{recordTypeFilter === 'WEEK_OFF' ? 'Week Off Date' : recordTypeFilter === 'ALL' ? 'Period / Date' : 'Vacation Period'}</th>
                            <th>Reason</th>
                            <th>Store</th>
                            <th>Replacement</th>
                            <th>Submitted By</th>
                            <th>Submitted On</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={8}>
                                    <div className="loading-container">
                                        <div className="spinner"></div>
                                        <span>Loading records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : requests.length === 0 ? (
                            <tr>
                                <td colSpan={8}>
                                    <div className="no-data">
                                        No metrics found matching your filters.
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
                                        {req.type === 'WEEK_OFF'
                                            ? <span className="badge badge-weekoff">{formatDate(req.startDate)} (Week Off)</span>
                                            : <span>{formatDate(req.startDate)} - {formatDate(req.endDate)}</span>
                                        }
                                    </td>
                                    <td>{req.reason}</td>
                                    <td>{req.storeName}</td>
                                    <td>
                                        {req.type === 'WEEK_OFF' ? '-' : (req.replacementAvailable === true ? 'Available' : (req.replacementAvailable === false ? 'Not Available' : 'N/A'))}
                                    </td>
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
                            {selectedRequest.type !== 'WEEK_OFF' && (
                                <div className="detail-row">
                                    <span className="detail-label">Replacement Available</span>
                                    <span className="detail-value">
                                        {selectedRequest.replacementAvailable === true ? 'Available' : selectedRequest.replacementAvailable === false ? 'Not Available' : 'N/A'}
                                    </span>
                                </div>
                            )}
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
