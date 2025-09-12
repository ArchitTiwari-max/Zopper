'use client';

import React, { useState, useEffect } from 'react';
import VisitDetailsModal from '@/components/VisitDetailsModal';
import * as XLSX from 'xlsx';
import './VisitHistory.css';

interface VisitDetail {
  id: string;
  storeName: string;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [visits, setVisits] = useState<VisitDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch visit history from API
  useEffect(() => {
    const fetchVisitHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/executive/visits');
        if (response.ok) {
          const data = await response.json();
          setVisits(data.data || []);
        } else {
          console.log(`Visit history API returned ${response.status}`);
          setVisits([]);
        }
      } catch (error) {
        console.error('Error fetching visit history:', error);
        setError('Failed to load visit history');
        setVisits([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVisitHistory();
  }, []);

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
    const matchesSearch = visit.storeName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' || visit.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportToExcel = () => {
    if (filteredVisits.length === 0) {
      alert('No data to export');
      return;
    }

    try {
      // Prepare data for Excel export
      const excelData = filteredVisits.map((visit, index) => {
        return {
          'S.No': index + 1,
          'Visit ID': visit.id,
          'Store Name': visit.storeName || 'N/A',
          'Status': visit.status === 'PENDING_REVIEW' ? 'Pending Review' : 'Reviewed',
          'Display Checked': visit.displayChecked ? 'Yes' : 'No',
          'Visit Date': formatDate(visit.createdAt),
          'Person Met - Names': visit.personMet?.map(p => p.name).join(', ') || 'N/A',
          'Person Met - Designations': visit.personMet?.map(p => p.designation).join(', ') || 'N/A',
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
        { wch: 15 },  // Status
        { wch: 12 },  // Display Checked
        { wch: 12 },  // Visit Date
        { wch: 30 },  // Person Met - Names
        { wch: 30 },  // Person Met - Designations
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Visit History');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Visit_History_Report_${currentDate}.xlsx`;

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
            <h1 className="history-title">Visit History</h1>
            <p className="history-subtitle">
              Comprehensive overview of store visits and executive feedback
            </p>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="search-filter-section">
          <div className="search-group">
            <input
              type="text"
              className="search-input"
              placeholder="Search by store name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Filter by Status</label>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All Status">All Status ▼</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="REVIEWD">Reviewed</option>
            </select>
          </div>
        </div>

        {/* Visit History Table */}
        <div className="visits-container">
          <div className="visits-table-container">
            <table className="visits-table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Person Met</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="loading-state">
                        <div className="loading-spinner-large"></div>
                        <span className="loading-text">Loading visit history...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="error-state">
                        <p>Error: {error}</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredVisits.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="no-data-state">
                        <p>No history found</p>
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

        {/* Export Section */}
        <div className="export-section">
          <h3 className="export-title">Export Report</h3>
          <p className="export-subtitle">
            Download a comprehensive excel report with all visit data
          </p>
          <button className="export-btn" onClick={handleExportToExcel}>
            📊 Export Report
          </button>
          <div className="export-info">
            <small>Exports {filteredVisits.length} visits with complete details</small>
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
