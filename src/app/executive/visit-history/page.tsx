'use client';

import React, { useState } from 'react';
import './VisitHistory.css';

interface VisitDetail {
  id: number;
  storeName: string;
  status: 'Submitted' | 'Reviewed' | 'Pending';
  personMet: string;
  date: string;
  displayChecked: boolean;
  feedback: string;
  issueReported: string;
  nextVisit: string;
  remarks: string;
  photos: string[];
  adminComment: string;
  expanded: boolean;
}

const VisitHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [visits, setVisits] = useState<VisitDetail[]>([
    {
      id: 1,
      storeName: "Lucky Mobile Gallery",
      status: "Submitted",
      personMet: "Mr. Sharma",
      date: "2025-08-01",
      displayChecked: true,
      feedback: "Asked for new standee",
      issueReported: "No flyer stock",
      nextVisit: "2025-08-10",
      remarks: "Requested pricing sheet",
      photos: [],
      adminComment: "",
      expanded: true
    },
    {
      id: 2,
      storeName: "Modern Traders",
      status: "Reviewed",
      personMet: "Ms. Singh",
      date: "2025-07-28",
      displayChecked: true,
      feedback: "Good display setup",
      issueReported: "None",
      nextVisit: "2025-08-15",
      remarks: "Store performing well",
      photos: [],
      adminComment: "Excellent work on display arrangement",
      expanded: false
    },
    {
      id: 3,
      storeName: "TechZone Mobiles",
      status: "Submitted",
      personMet: "Mr. Kumar",
      date: "2025-07-25",
      displayChecked: false,
      feedback: "Need more promotional materials",
      issueReported: "Display not visible",
      nextVisit: "2025-08-05",
      remarks: "Requires attention",
      photos: [],
      adminComment: "",
      expanded: false
    },
    {
      id: 4,
      storeName: "TechZone Mobiles",
      status: "Submitted",
      personMet: "Mr. Kumar",
      date: "2025-07-20",
      displayChecked: true,
      feedback: "Initial setup completed",
      issueReported: "None",
      nextVisit: "2025-08-01",
      remarks: "Good cooperation from store owner",
      photos: [],
      adminComment: "",
      expanded: false
    }
  ]);

  const toggleExpanded = (id: number) => {
    setVisits(visits.map(visit => 
      visit.id === id ? { ...visit, expanded: !visit.expanded } : visit
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return '#ffc107';
      case 'Submitted':
        return '#007bff';
      case 'Reviewed':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const filteredVisits = visits.filter(visit => {
    const matchesSearch = visit.storeName.toLowerCase().includes(searchTerm.toLowerCase());
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
              <option value="Submitted">Submitted</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Visit Cards */}
        <div className="visits-container">
          {filteredVisits.map((visit) => (
            <div key={visit.id} className="visit-card">
              <div className="visit-card-header">
                <div className="store-info">
                  <h3 className="store-name">
                    {visit.storeName}
                    <button 
                      className="expand-btn"
                      onClick={() => toggleExpanded(visit.id)}
                    >
                      {visit.expanded ? '▲' : '▼'}
                    </button>
                  </h3>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(visit.status) }}
                  >
                    {visit.status}
                  </span>
                </div>
              </div>

              {visit.expanded && (
                <div className="visit-details">
                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-icon">👤</span>
                      <div className="detail-content">
                        <span className="detail-label">Person Met:</span>
                        <span className="detail-value">{visit.personMet}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-icon">📅</span>
                      <div className="detail-content">
                        <span className="detail-label">Date:</span>
                        <span className="detail-value">{visit.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-icon">✓</span>
                      <div className="detail-content">
                        <span className="detail-label">Display Checked:</span>
                        <span className="detail-value">{visit.displayChecked ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-icon">💬</span>
                      <div className="detail-content">
                        <span className="detail-label">Feedback:</span>
                        <span className="detail-value">{visit.feedback}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-icon">⚠️</span>
                      <div className="detail-content">
                        <span className="detail-label">Issue Reported:</span>
                        <span className="detail-value">{visit.issueReported}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-icon">📅</span>
                      <div className="detail-content">
                        <span className="detail-label">Next Visit:</span>
                        <span className="detail-value">{visit.nextVisit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-icon">📝</span>
                      <div className="detail-content">
                        <span className="detail-label">Remarks:</span>
                        <span className="detail-value">{visit.remarks}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-icon">📷</span>
                      <div className="detail-content">
                        <span className="detail-label">Photos:</span>
                        <div className="photos-container">
                          <div className="photo-placeholder"></div>
                          <div className="photo-placeholder"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {visit.adminComment && (
                    <div className="admin-comment-section">
                      <label className="admin-comment-label">Admin Comment:</label>
                      <div className="admin-comment-box">
                        {visit.adminComment}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Collapsed Visit Cards */}
          {filteredVisits.filter(visit => !visit.expanded).length > 0 && (
            <div className="collapsed-visits">
              {filteredVisits.filter(visit => !visit.expanded).map((visit) => (
                <div key={`collapsed-${visit.id}`} className="collapsed-visit-card">
                  <div className="collapsed-content">
                    <h4 className="collapsed-store-name">
                      {visit.storeName}
                      <button 
                        className="expand-btn-small"
                        onClick={() => toggleExpanded(visit.id)}
                      >
                        ▶
                      </button>
                    </h4>
                    <span 
                      className="collapsed-status-badge"
                      style={{ backgroundColor: getStatusColor(visit.status) }}
                    >
                      {visit.status}
                    </span>
                  </div>
                </div>
              ))}
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
      </div>
    </div>
  );
};

export default VisitHistory;
