'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';
import VisitDetailsModal from '@/components/VisitDetailsModal';
import './ExecutiveForm.css';

interface PastVisit {
  id: string;
  date: string;
  status: 'PENDING_REVIEW' | 'REVIEWD';
  representative: string;
  personMet: PersonMet[];
  displayChecked: boolean;
  remarks?: string;
  imageUrls: string[];
  adminComment?: string;
  issues: VisitIssue[];
  createdAt: string;
  updatedAt: string;
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

interface PersonMet {
  name: string;
  designation: string;
}

interface UploadedImage {
  url: string;
  public_id: string;
  bytes: number;
  format: string;
}

interface StoreData {
  id: string;
  storeName: string;
  city: string;
  fullAddress?: string;
  partnerBrands: string[];
}

const ExecutiveForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');
  
  const [formData, setFormData] = useState({
    peopleMet: [] as PersonMet[],
    displayChecked: false,
    issuesReported: '',
    brandsVisited: [] as string[],
    remarks: '',
    uploadedImages: [] as UploadedImage[]
  });
  const [currentBrand, setCurrentBrand] = useState('');
  const [currentPerson, setCurrentPerson] = useState({ name: '', designation: '' });
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [pastVisits, setPastVisits] = useState<PastVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<PastVisit | null>(null);
  const [showModal, setShowModal] = useState(false);

  // LocalStorage key for form data persistence
  const getFormStorageKey = () => `visit-form-data-${storeId}`;

  // Load form data from localStorage
  useEffect(() => {
    if (!storeId) return;
    
    const savedData = localStorage.getItem(getFormStorageKey());
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setFormData(parsedData);
      } catch (error) {
        console.error('Error loading saved form data:', error);
      }
    }
  }, [storeId]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (!storeId) return;
    
    localStorage.setItem(getFormStorageKey(), JSON.stringify(formData));
  }, [formData, storeId]);

  // Fetch store data and past visits
  useEffect(() => {
    if (!storeId) {
      setError('Store ID is required');
      setLoading(false);
      return;
    }

    const fetchStoreData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/executive/stores/${storeId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch store data');
        }
        const data = await response.json();
        setStoreData(data);
      } catch (error) {
        console.error('Error fetching store data:', error);
        setError('Failed to load store information');
      } finally {
        setLoading(false);
      }
    };

    const fetchPastVisits = async () => {
      try {
        const response = await fetch(`/api/executive/visitform?storeId=${storeId}`);
        if (response.ok) {
          const data = await response.json();
          setPastVisits(data.data || []);
        } else {
          // Any non-200 response (including 404) - just set empty array
          console.log(`Past visits API returned ${response.status} - no visits available`);
          setPastVisits([]);
        }
      } catch (error) {
        console.log('Past visits fetch failed - this is non-critical:', error);
        // Set empty array as fallback - past visits are not critical for form functionality
        setPastVisits([]);
      }
    };

    fetchStoreData();
    fetchPastVisits();
  }, [storeId]);

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

  const handleSubmitVisit = async () => {
    if (!storeId) {
      alert('Store ID is required');
      return;
    }

    // Basic validation
    if (formData.peopleMet.length === 0) {
      alert('Please add at least one person met');
      return;
    }

    if (formData.brandsVisited.length === 0) {
      alert('Please select at least one brand visited');
      return;
    }

    setSubmitting(true);

    try {
      const visitData: any = {
        storeId,
        personMet: formData.peopleMet,
        displayChecked: formData.displayChecked,
        imageUrls: formData.uploadedImages.map(img => img.url),
        brandsVisited: formData.brandsVisited,
        remarks: formData.remarks
      };

      // Only include issuesReported if it's not empty
      if (formData.issuesReported.trim()) {
        visitData.issuesReported = formData.issuesReported.trim();
      }

      const response = await fetch('/api/executive/visitform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(visitData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit visit');
      }

      const result = await response.json();
      
      // Clear localStorage after successful submission
      localStorage.removeItem(getFormStorageKey());
      
      alert('Visit submitted successfully!');
      router.push('/executive/store');
    } catch (error) {
      console.error('Error submitting visit:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit visit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const addBrand = () => {
    if (currentBrand === 'ALL_BRANDS') {
      // Add all available brands that are not already selected
      const availableBrands = storeData?.partnerBrands.filter(brand => 
        !formData.brandsVisited.includes(brand)
      ) || [];
      
      if (availableBrands.length > 0) {
        setFormData(prev => ({
          ...prev,
          brandsVisited: [...prev.brandsVisited, ...availableBrands]
        }));
      }
      setCurrentBrand('');
    } else if (currentBrand.trim() && !formData.brandsVisited.includes(currentBrand.trim())) {
      setFormData(prev => ({
        ...prev,
        brandsVisited: [...prev.brandsVisited, currentBrand.trim()]
      }));
      setCurrentBrand('');
    }
  };

  const removeBrand = (brandToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      brandsVisited: prev.brandsVisited.filter(brand => brand !== brandToRemove)
    }));
  };

  const handleBrandKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBrand();
    }
  };

  // Person management functions
  const addPerson = () => {
    if (currentPerson.name.trim() && currentPerson.designation.trim()) {
      setFormData(prev => ({
        ...prev,
        peopleMet: [...prev.peopleMet, { ...currentPerson }]
      }));
      setCurrentPerson({ name: '', designation: '' });
    }
  };

  const removePerson = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      peopleMet: prev.peopleMet.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handlePersonInputChange = (field: 'name' | 'designation', value: string) => {
    setCurrentPerson(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Image upload handler
  const handleImageUpload = (images: UploadedImage[]) => {
    setFormData(prev => ({
      ...prev,
      uploadedImages: images
    }));
    console.log('Updated images:', images);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING_REVIEW':
        return '#ffc107';
      case 'REVIEWD':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Modal handlers
  const openVisitModal = (visit: PastVisit) => {
    setSelectedVisit(visit);
    setShowModal(true);
  };

  const closeVisitModal = () => {
    setSelectedVisit(null);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="executive-form-container">
        <div className="executive-form-content">
          <div className="loading-state">Loading Visit Form...</div>
        </div>
      </div>
    );
  }

  if (error || !storeData) {
    return (
      <div className="executive-form-container">
        <div className="executive-form-content">
          <div className="error-state">
            <h2>Error Loading Store</h2>
            <p>{error || 'Store not found'}</p>
            <button onClick={() => router.push('/executive/store')} className="back-btn">
              Back to Stores
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <div className="address-info">
                <div className="city">{storeData.city}</div>
                {storeData.fullAddress && (
                  <div className="full-address">{storeData.fullAddress}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Visit Form */}
        <div className="visit-form-card">
          <h3 className="section-title">Log Visit Details</h3>
          
          <div className="form-group">
            <label className="form-label">
              People Met <span className="required">*</span>
            </label>
            <div className="people-input-container">
              <div className="person-input-wrapper">
                <input
                  type="text"
                  className="form-input person-name-input"
                  placeholder="Enter person's name"
                  value={currentPerson.name}
                  onChange={(e) => handlePersonInputChange('name', e.target.value)}
                />
                <input
                  type="text"
                  className="form-input person-designation-input"
                  placeholder="Enter designation"
                  value={currentPerson.designation}
                  onChange={(e) => handlePersonInputChange('designation', e.target.value)}
                />
                <button
                  type="button"
                  className="add-person-btn"
                  onClick={addPerson}
                  disabled={!currentPerson.name.trim() || !currentPerson.designation.trim()}
                >
                  Add
                </button>
              </div>
              {formData.peopleMet.length > 0 && (
                <div className="people-list">
                  {formData.peopleMet.map((person, index) => (
                    <div key={index} className="person-item">
                      <div className="person-details">
                        <span className="person-name">{person.name}</span>
                        <span className="person-designation">({person.designation})</span>
                      </div>
                      <button
                        type="button"
                        className="remove-person-btn"
                        onClick={() => removePerson(index)}
                        title="Remove person"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            <ImageUpload 
              onUpload={handleImageUpload}
              multiple={true}
              maxFiles={5}
              existingImages={formData.uploadedImages}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Brands Visited <span className="required">*</span>
            </label>
            <div className="brands-input-container">
              <div className="brand-input-wrapper">
                <select
                  className="form-select brand-select"
                  value={currentBrand}
                  onChange={(e) => setCurrentBrand(e.target.value)}
                >
                  <option value="">Select a brand to add...</option>
                  {storeData.partnerBrands.filter(brand => !formData.brandsVisited.includes(brand)).length > 1 && (
                    <option value="ALL_BRANDS">Add All Available Brands</option>
                  )}
                  {storeData.partnerBrands
                    .filter(brand => !formData.brandsVisited.includes(brand))
                    .sort()
                    .map((brand, index) => (
                      <option key={index} value={brand}>{brand}</option>
                    ))
                  }
                </select>
                <button
                  type="button"
                  className="add-brand-btn"
                  onClick={addBrand}
                  disabled={!currentBrand.trim()}
                >
                  Add
                </button>
              </div>
              {formData.brandsVisited.length > 0 && (
                <div className="brands-list">
                  {formData.brandsVisited.map((brand, index) => (
                    <div key={index} className="brand-item">
                      <span className="brand-name">{brand}</span>
                      <button
                        type="button"
                        className="remove-brand-btn"
                        onClick={() => removeBrand(brand)}
                        title="Remove brand"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
            <button className="save-draft-btn" onClick={handleSaveDraft} disabled={submitting}>
              Save Draft
            </button>
            <button 
              className="submit-visit-btn" 
              onClick={handleSubmitVisit}
              disabled={submitting || formData.peopleMet.length === 0 || formData.brandsVisited.length === 0}
            >
              {submitting ? 'Submitting...' : 'Submit Visit'}
            </button>
          </div>
        </div>

        {/* Past Visits */}
        <div className="past-visits-card">
          <h3 className="section-title">Past Visits</h3>
          <div className="visits-list">
            {pastVisits.length === 0 ? (
              <div className="no-visits">
                <p>No previous visits found for this store.</p>
              </div>
            ) : (
              pastVisits.map((visit) => (
                <div key={visit.id} className="visit-item">
                  <div className="visit-header">
                    <div className="visit-date-status">
                      <span className="visit-date">{formatDate(visit.createdAt)}</span>
                      <span 
                        className="visit-status"
                        style={{ backgroundColor: getStatusColor(visit.status) }}
                      >
                        {visit.status}
                      </span>
                    </div>
                    <button 
                      className="view-details-btn"
                      onClick={() => openVisitModal(visit)}
                    >
                      View Details
                    </button>
                  </div>
                  <div className="visit-representative">
                    <span className="person-icon">👤</span>
                    <span>{visit.representative}</span>
                  </div>
                  {visit.remarks && (
                    <div className="visit-description">
                      {visit.remarks}
                    </div>
                  )}
                  {visit.adminComment && (
                    <div className="admin-note">
                      <strong>Admin:</strong> {visit.adminComment}
                    </div>
                  )}
                  {visit.issues && visit.issues.length > 0 && (
                    <div className="visit-issues">
                      <strong>Issues Reported:</strong>
                      {visit.issues.map((issue) => (
                        <div key={issue.id} className="issue-item">
                          <span className="issue-details">{issue.details}</span>
                          <span className="issue-status" style={{ color: getStatusColor(issue.status) }}>
                            ({issue.status})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {visit.personMet && visit.personMet.length > 0 && (
                    <div className="visit-people">
                      <strong>People Met:</strong>
                      {visit.personMet.map((person, index) => (
                        <span key={index} className="person-met">
                          {person.name} ({person.designation})
                          {index < visit.personMet.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
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

export default ExecutiveForm;
