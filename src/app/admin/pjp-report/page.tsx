'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './page.css';

interface PJPData {
  id: string;
  executiveName: string;
  submittedAt: string;
  plannedVisitDate: string;
  storeNames: string[];
  pjpNotFollowedReason: string;
}

interface ExecutiveOption {
  id: string;
  name: string;
}

const PJPReportPage = () => {
  const [data, setData] = useState<PJPData[]>([]);
  const [executives, setExecutives] = useState<ExecutiveOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [selectedExecutive, setSelectedExecutive] = useState('All Executive');

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate, selectedExecutive]);

  const fetchFilters = async () => {
    try {
      const response = await fetch('/api/admin/pjp-report/filters');
      const result = await response.json();
      if (result.success) {
        setExecutives(result.executives);
      }
    } catch (err) {
      console.error('Error fetching filters:', err);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (selectedExecutive !== 'All Executive') params.append('executiveId', selectedExecutive);

      const response = await fetch(`/api/admin/pjp-report/data?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError('An error occurred while fetching data');
      console.error('Error fetching PJP data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatIST = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateOnlyIST = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleExportXLS = () => {
    const exportData = data.map(item => ({
      'Executive Name': item.executiveName,
      'Submitted At (IST)': formatIST(item.submittedAt),
      'Visit Plan Date (IST)': formatDateOnlyIST(item.plannedVisitDate),
      'Store Names': item.storeNames.join(', '),
      'PJP Not Followed Reason': item.pjpNotFollowedReason
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PJP Report');
    XLSX.writeFile(wb, `PJP_Report_${fromDate}_to_${toDate}.xlsx`);
  };

  return (
    <div className="pjp-report-container">
      <div className="report-header">
        <h1>PJP Report</h1>
        <p className="subtitle">Track Permanent Journey Plans and execution details</p>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Executive</label>
          <select 
            value={selectedExecutive} 
            onChange={(e) => setSelectedExecutive(e.target.value)}
            className="filter-select"
          >
            <option value="All Executive">All Executives</option>
            {executives.map(exec => (
              <option key={exec.id} value={exec.id}>{exec.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>From Date</label>
          <input 
            type="date" 
            value={fromDate} 
            onChange={(e) => setFromDate(e.target.value)}
            className="filter-date"
          />
        </div>

        <div className="filter-group">
          <label>To Date</label>
          <input 
            type="date" 
            value={toDate} 
            onChange={(e) => setToDate(e.target.value)}
            className="filter-date"
          />
        </div>

        <div className="filter-actions">
          <button onClick={handleExportXLS} className="export-btn">
            <span className="icon-download"></span> Export Excel
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading report data...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchData} className="retry-btn">Retry</button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="pjp-table">
            <thead>
              <tr>
                <th>Executive Name</th>
                <th>Submitted At (IST)</th>
                <th>Visit Plan Date (IST)</th>
                <th>Store Names</th>
                <th>PJP Not Followed Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="no-data">No PJP records found for the selected filters.</td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.executiveName}</td>
                    <td>{formatIST(item.submittedAt)}</td>
                    <td>{formatDateOnlyIST(item.plannedVisitDate)}</td>
                    <td>
                      <ul className="store-list">
                        {item.storeNames.map((store, index) => (
                          <li key={index}>{store}</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <span className={`reason-tag ${item.pjpNotFollowedReason === 'N/A' ? 'none' : 'active'}`}>
                        {item.pjpNotFollowedReason}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PJPReportPage;
