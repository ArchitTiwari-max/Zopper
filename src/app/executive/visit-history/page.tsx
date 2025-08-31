'use client';

import React, { useState, useEffect } from 'react';
import VisitDetailsModal from '@/components/VisitDetailsModal';
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

  const handleExportToPDF = () => {
    alert('Exporting to PDF...');
    // Implement PDF export logic here
  };

  return (
    <div className="visit-history-container">
      <div className="visit-history-content">
        {/* Header */}
        <div className="history-header">
  
          
          <div className="header-subtitle-section">
            <h2 className="detailed-report-title">Detailed Report</h2>
            <p className="detailed-report-subtitle">
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
          {loading ? (
            <div className="loading-state">
              <p>Loading visit history...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>Error: {error}</p>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="no-history">
              <p>No history found</p>
            </div>
          ) : (
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
                  {filteredVisits.map((visit) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Export Section */}
        <div className="export-section">
          <h3 className="export-title">Export Report</h3>
          <p className="export-subtitle">
            Download a comprehensive PDF report of all visit data
          </p>
          <button className="export-btn" onClick={handleExportToPDF}>
            Export to PDF
          </button>
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
