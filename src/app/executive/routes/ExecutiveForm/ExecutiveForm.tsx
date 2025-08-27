'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './ExecutiveForm.css';

interface PastVisit {
  id: number;
  date: string;
  status: 'Pending' | 'Submitted' | 'Reviewed';
  representative: string;
  description?: string;
  adminNote?: string;
}

interface StoreData {
  id: number;
  storeName: string;
  partnerBrands: string[];
  address: string;
  contactPerson: string;
  contactNumber: string;
}

const ExecutiveForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    personMet: 'Mr. Sharma',
    displayChecked: false,
    issuesReported: '',
    nextVisitDate: '2025-03-23',
    remarks: ''
  });
  const [storeData, setStoreData] = useState<StoreData>({
    id: 1,
    storeName: "Lucky Electronics",
    partnerBrands: ["Godrej", "Havells", "Philips"],
    address: "I-441, Govindpuram Ghaziabad, UP",
    contactPerson: "Mr. Sharma",
    contactNumber: "+91 7872356278"
  });

  // Store data mapping based on store ID
  const storeDataMap: { [key: number]: StoreData } = {
    1: {
      id: 1,
      storeName: "Lucky Mobile Gallery",
      partnerBrands: ["Samsung"],
      address: "I-441, Govindpuram Ghaziabad, UP",
      contactPerson: "Mr. Sharma",
      contactNumber: "+91 7872356278"
    },
    2: {
      id: 2,
      storeName: "Techno Hub",
      partnerBrands: ["Godrej"],
      address: "Sector 18, Noida, UP",
      contactPerson: "Mr. Kumar",
      contactNumber: "+91 9876543210"
    },
    3: {
      id: 3,
      storeName: "Digital Express",
      partnerBrands: ["Vivo"],
      address: "Connaught Place, Delhi",
      contactPerson: "Ms. Singh",
      contactNumber: "+91 8765432109"
    }
    // Add more stores as needed
  };

  useEffect(() => {
    const storeId = searchParams.get('storeId');
    if (storeId) {
      const id = parseInt(storeId);
      const selectedStore = storeDataMap[id];
      if (selectedStore) {
        setStoreData(selectedStore);
        setFormData(prev => ({
          ...prev,
          personMet: selectedStore.contactPerson
        }));
      }
    }
  }, [searchParams]);

  const pastVisits: PastVisit[] = [
    {
      id: 1,
      date: "December 28, 2023",
      status: "Pending",
      representative: "Raj Mishra"
    },
    {
      id: 2,
      date: "January 8, 2024",
      status: "Submitted",
      representative: "Raj Mishra",
      description: "Checked display setup and collected feedback on customer preferences. Updated promotional materials."
    },
    {
      id: 3,
      date: "January 15, 2024",
      status: "Reviewed",
      representative: "You",
      description: "Initial visit to establish partnership terms and discuss product placement strategies.",
      adminNote: "Check Samsung Fold Phone in next time Visit"
    },
    {
      id: 4,
      date: "December 28, 2023",
      status: "Submitted",
      representative: "You",
      description: "Initial visit to establish partnership terms and discuss product placement strategies."
    }
  ];

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveDraft = () => {
    console.log('Saving draft:', formData);
    alert('Draft saved successfully!');
  };

  const handleSubmitVisit = () => {
    console.log('Submitting visit:', formData);
    alert('Visit submitted successfully!');
    router.push('/executive/store');
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

  return (
    <div className="executive-form-container">
      <div className="executive-form-content">
        {/* Header */}
        <div className="form-header">
          <button className="back-btn" onClick={() => router.push('/executive/store')}>
            <span className="back-arrow">←</span>
            Back to Stores
          </button>
        </div>

        {/* Title */}
        <div className="form-title-section">
          <h1 className="form-title">Visit Form</h1>
          <p className="form-subtitle">Submit your Visit Report</p>
        </div>

        {/* Store Info Card */}
        <div className="store-info-card">
          <h2 className="store-name">{storeData.storeName}</h2>
          <div className="partner-brands">
            {storeData.partnerBrands.map((brand, index) => (
              <span key={index} className="brand-tag">{brand}</span>
            ))}
          </div>
          <div className="store-details">
            <div className="detail-item">
              <span className="location-icon">📍</span>
              <span>{storeData.address}</span>
            </div>
            <div className="detail-item">
              <span className="person-icon">👤</span>
              <div>
                <div>{storeData.contactPerson}</div>
                <div className="contact-number">{storeData.contactNumber}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Visit Form */}
        <div className="visit-form-card">
          <h3 className="section-title">Log Visit Details</h3>
          
          <div className="form-group">
            <label className="form-label">
              Person Met <span className="required">*</span>
            </label>
            <select 
              className="form-select"
              value={formData.personMet}
              onChange={(e) => handleInputChange('personMet', e.target.value)}
            >
              <option value="Mr. Sharma">Mr. Sharma</option>
              <option value="Ms. Singh">Ms. Singh</option>
              <option value="Mr. Kumar">Mr. Kumar</option>
            </select>
          </div>

          <div className="form-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={formData.displayChecked}
                onChange={(e) => handleInputChange('displayChecked', e.target.checked)}
              />
              <span className="checkmark"></span>
              Display Checked
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Issues Reported</label>
            <textarea
              className="form-textarea"
              placeholder="Describe any issues or observations..."
              value={formData.issuesReported}
              onChange={(e) => handleInputChange('issuesReported', e.target.value)}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Photos Taken</label>
            <div className="photo-upload-area">
              <div className="upload-icon">🖼️</div>
              <div className="upload-text">
                <div>Click to upload photos or drag and drop</div>
                <div className="upload-formats">PNG, JPG up to 10MB</div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Next Visit Date <span className="required">*</span>
            </label>
            <div className="date-input-container">
              <input
                type="date"
                className="form-date"
                value={formData.nextVisitDate}
                onChange={(e) => handleInputChange('nextVisitDate', e.target.value)}
              />
              <span className="calendar-icon">📅</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Remarks</label>
            <textarea
              className="form-textarea"
              placeholder="Additional comments or observations..."
              value={formData.remarks}
              onChange={(e) => handleInputChange('remarks', e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button className="save-draft-btn" onClick={handleSaveDraft}>
              Save Draft
            </button>
            <button className="submit-visit-btn" onClick={handleSubmitVisit}>
              Submit Visit
            </button>
          </div>
        </div>

        {/* Past Visits */}
        <div className="past-visits-card">
          <h3 className="section-title">Past Visits</h3>
          <div className="visits-list">
            {pastVisits.map((visit) => (
              <div key={visit.id} className="visit-item">
                <div className="visit-header">
                  <div className="visit-date-status">
                    <span className="visit-date">{visit.date}</span>
                    <span 
                      className="visit-status"
                      style={{ backgroundColor: getStatusColor(visit.status) }}
                    >
                      {visit.status}
                    </span>
                  </div>
                  <button className="view-details-btn">View Details</button>
                </div>
                <div className="visit-representative">
                  <span className="person-icon">👤</span>
                  <span>{visit.representative}</span>
                </div>
                {visit.description && (
                  <div className="visit-description">
                    {visit.description}
                  </div>
                )}
                {visit.adminNote && (
                  <div className="admin-note">
                    <strong>Admin:</strong> {visit.adminNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveForm;
