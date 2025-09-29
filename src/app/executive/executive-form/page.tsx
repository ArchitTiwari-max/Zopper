'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';
import VisitDetailsModal from '../components/VisitDetailsModal';
import './ExecutiveForm.css';

interface PastVisit {
  id: string;
  date: string;
  status: 'PENDING_REVIEW' | 'REVIEWD';
  representative: string;
  canViewDetails: boolean;
  personMet: PersonMet[];
  POSMchecked: boolean | null;
  remarks?: string;
  imageUrls: string[];
  adminComment?: string;
  issues: VisitIssue[];
  createdAt: string;
  updatedAt: string;
  storeName: string;
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
  phoneNumber: string;
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

const ExecutiveFormContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');
  
  // Extract store data from URL parameters
  const getStoreDataFromParams = (): StoreData | null => {
    const storeName = searchParams.get('storeName');
    const city = searchParams.get('city');
    const fullAddress = searchParams.get('fullAddress');
    const partnerBrandsParam = searchParams.get('partnerBrands');
    
    if (!storeId || !storeName || !city) {
      return null;
    }
    
    let partnerBrands: string[] = [];
    try {
      partnerBrands = partnerBrandsParam ? JSON.parse(partnerBrandsParam) : [];
    } catch (error) {
      console.error('Error parsing partner brands:', error);
      partnerBrands = [];
    }
    
    return {
      id: storeId,
      storeName,
      city,
      fullAddress: fullAddress || undefined,
      partnerBrands
    };
  };
  
  const [formData, setFormData] = useState({
    visitDate: '', // Will be set to today in IST
    peopleMet: [] as PersonMet[],
    POSMchecked: null as boolean | null,
    issuesRaised: [] as string[],
    brandsVisited: [] as string[],
    remarks: '',
    uploadedImages: [] as UploadedImage[]
  });
  const [currentBrand, setCurrentBrand] = useState('');
  const [currentPerson, setCurrentPerson] = useState({ name: '', designation: '', phoneNumber: '' });
  const [currentIssue, setCurrentIssue] = useState('');
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [pastVisits, setPastVisits] = useState<PastVisit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<PastVisit | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // LocalStorage key for form data persistence
  const getFormStorageKey = () => `visit-form-data-${storeId}`;

  // Load form data from localStorage and set default visit date
  useEffect(() => {
    if (!storeId) return;
    
    // Set default visit date to today in IST
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const istDate = new Date(today.getTime() + istOffset);
    const defaultVisitDate = istDate.toISOString().split('T')[0];
    
    const savedData = localStorage.getItem(getFormStorageKey());
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setFormData({
          ...parsedData,
          // Only set default visitDate if no saved visitDate exists
          visitDate: parsedData.visitDate || defaultVisitDate
        });
      } catch (error) {
        console.error('Error loading saved form data:', error);
        setFormData(prev => ({ ...prev, visitDate: defaultVisitDate }));
      }
    } else {
      setFormData(prev => ({ ...prev, visitDate: defaultVisitDate }));
    }
    
    // Mark as initialized after loading is complete
    setIsInitialized(true);
  }, [storeId]);

  // Save form data to localStorage whenever it changes (only after initialization)
  useEffect(() => {
    if (!storeId || !isInitialized) return;
    
    localStorage.setItem(getFormStorageKey(), JSON.stringify(formData));
  }, [formData, storeId, isInitialized]);

  // Separate loading states for different sections
  const [storeLoading, setStoreLoading] = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(true);
  
  // Load store data from URL parameters and fetch past visits
  useEffect(() => {
    if (!storeId) {
      setError('Store ID is required');
      setStoreLoading(false);
      return;
    }

    // Load store data from URL parameters
    const loadStoreData = () => {
      setStoreLoading(true);
      const storeDataFromParams = getStoreDataFromParams();
      
      if (storeDataFromParams) {
        setStoreData(storeDataFromParams);
        setError(null);
      } else {
        setError('Store information is missing. Please go back and select a store again.');
      }
      
      setStoreLoading(false);
    };

    const fetchPastVisits = async () => {
      try {
        setVisitsLoading(true);
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
      } finally {
        setVisitsLoading(false);
      }
    };

    loadStoreData();
    fetchPastVisits();
  }, [storeId, searchParams]);

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
    if (!formData.visitDate) {
      alert('Please select a visit date');
      return;
    }

    // Validate visit date (IST)
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istToday = new Date(today.getTime() + istOffset);
    const todayStr = istToday.toISOString().split('T')[0];
    const ninetyDaysAgo = new Date(istToday.getTime() - (90 * 24 * 60 * 60 * 1000));
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];
    
    if (formData.visitDate > todayStr) {
      alert('Visit date cannot be in the future. Please select today or a past date.');
      return;
    }
    
    if (formData.visitDate < ninetyDaysAgoStr) {
      alert('Visit date cannot be more than 90 days ago. Please select a more recent date.');
      return;
    }

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
        visitDate: formData.visitDate,
        personMet: formData.peopleMet,
        POSMchecked: formData.POSMchecked,
        imageUrls: formData.uploadedImages.map(img => img.url),
        brandsVisited: formData.brandsVisited,
        remarks: formData.remarks
      };

      // Include issues if any are raised
      if (formData.issuesRaised.length > 0) {
        visitData.issuesRaised = formData.issuesRaised;
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

  const removeBrand = (brandToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      brandsVisited: prev.brandsVisited.filter(brand => brand !== brandToRemove)
    }));
  };

  // Person management functions
  const addPerson = () => {
    if (currentPerson.name.trim() && currentPerson.designation.trim()) {
      setFormData(prev => ({
        ...prev,
        peopleMet: [...prev.peopleMet, { ...currentPerson }]
      }));
      setCurrentPerson({ name: '', designation: '', phoneNumber: '' });
    }
  };

  const removePerson = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      peopleMet: prev.peopleMet.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handlePersonInputChange = (field: 'name' | 'designation' | 'phoneNumber', value: string) => {
    setCurrentPerson(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Issue management functions
  const addIssue = () => {
    if (currentIssue.trim() && !formData.issuesRaised.includes(currentIssue.trim())) {
      setFormData(prev => ({
        ...prev,
        issuesRaised: [...prev.issuesRaised, currentIssue.trim()]
      }));
      setCurrentIssue('');
    }
  };

  const removeIssue = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      issuesRaised: prev.issuesRaised.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleIssueKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addIssue();
    }
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

  // Show error state only if store loading failed and we have an error
  if (error && !storeLoading && !storeData) {
    return (
      <div className="exec-f-sub-container">
        <div className="exec-f-sub-content">
          <div className="exec-f-sub-error-state">
            <h2>Error Loading Store</h2>
            <p>{error}</p>
            <button onClick={() => router.push('/executive/store')} className="exec-f-sub-back-btn">
              Back to Stores
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exec-f-sub-container">
      <div className="exec-f-sub-content">
        {/* Header */}
        <div className="exec-f-sub-header">
          <button className="exec-f-sub-back-btn" onClick={() => router.push('/executive/store')}>
            <span className="exec-f-sub-back-arrow">←</span>
            Back to Stores
          </button>
        </div>

        {/* Title */}
        <div className="exec-f-sub-title-section">
          <h1 className="exec-f-sub-title">Visit Form</h1>
          <p className="exec-f-sub-subtitle">Submit your Visit Report</p>
        </div>

        {/* Store Info Card */}
        <div className="exec-f-sub-store-info-card">
          {storeLoading ? (
            <div className="loading-text">
              Loading store information...
            </div>
          ) : storeData ? (
            <>
              <h2 className="exec-f-sub-store-name">{storeData.storeName}</h2>
              <div className="exec-f-sub-partner-brands">
                {storeData.partnerBrands.map((brand, index) => (
                  <span key={index} className="exec-f-sub-brand-tag">{brand}</span>
                ))}
              </div>
              <div className="exec-f-sub-store-details">
                <div className="exec-f-sub-detail-item">
                  <span className="exec-f-sub-location-icon">📍</span>
                  <div className="exec-f-sub-address-info">
                    <div className="exec-f-sub-city">{storeData.city}</div>
                    {storeData.fullAddress && (
                      <div className="exec-f-sub-full-address">{storeData.fullAddress}</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="exec-f-sub-error-message">
              Failed to load store information
            </div>
          )}
        </div>

        {/* Visit Form */}
        <div className="exec-f-sub-visit-form-card">
          <h3 className="exec-f-sub-section-title">Log Visit Details</h3>
          
          {/* Visit Date Field */}
          <div className="exec-f-sub-form-group">
            <label className="exec-f-sub-form-label">
              Visit Date <span className="exec-f-sub-required">*</span>
            </label>
            <input
              type="date"
              className="exec-f-sub-form-input exec-f-sub-form-date"
              value={formData.visitDate}
              onChange={(e) => handleInputChange('visitDate', e.target.value)}
              max={(() => {
                // Get today's date in IST for max validation
                const today = new Date();
                const istOffset = 5.5 * 60 * 60 * 1000;
                const istDate = new Date(today.getTime() + istOffset);
                return istDate.toISOString().split('T')[0];
              })()}
              min={(() => {
                // Get date 90 days ago in IST for min validation
                const today = new Date();
                const istOffset = 5.5 * 60 * 60 * 1000;
                const istDate = new Date(today.getTime() + istOffset);
                const ninetyDaysAgo = new Date(istDate.getTime() - (90 * 24 * 60 * 60 * 1000));
                return ninetyDaysAgo.toISOString().split('T')[0];
              })()}
            />
          </div>
          
          <div className="exec-f-sub-form-group">
            <label className="exec-f-sub-form-label">
              Contact Person <span className="exec-f-sub-required">*</span>
            </label>
            <div className="exec-f-sub-people-input-container">
              <div className="exec-f-sub-person-input-wrapper">
                <input
                  type="text"
                  className="exec-f-sub-form-input exec-f-sub-person-name-input"
                  placeholder="Enter person's name"
                  value={currentPerson.name}
                  onChange={(e) => handlePersonInputChange('name', e.target.value)}
                />
                <input
                  type="text"
                  className="exec-f-sub-form-input exec-f-sub-person-designation-input"
                  placeholder="Enter designation"
                  value={currentPerson.designation}
                  onChange={(e) => handlePersonInputChange('designation', e.target.value)}
                />
                <input
                  type="tel"
                  className="exec-f-sub-form-input exec-f-sub-person-phone-input"
                  placeholder="Enter phone number (optional)"
                  value={currentPerson.phoneNumber}
                  onChange={(e) => handlePersonInputChange('phoneNumber', e.target.value)}
                />
                <button
                  type="button"
                  className="exec-f-sub-add-person-btn"
                  onClick={addPerson}
                  disabled={!currentPerson.name.trim() || !currentPerson.designation.trim()}
                >
                  Add
                </button>
              </div>
              {formData.peopleMet.length > 0 && (
                <div className="exec-f-sub-people-list">
                  {formData.peopleMet.map((person, index) => (
                    <div key={index} className="exec-f-sub-person-item">
                      <div className="exec-f-sub-person-details">
                        <span className="exec-f-sub-person-name">{person.name}</span>
                        <span className="exec-f-sub-person-designation">({person.designation})</span>
                        {person.phoneNumber && (
                          <span className="exec-f-sub-person-phone"> - {person.phoneNumber}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="exec-f-sub-remove-person-btn"
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

          <div className="exec-f-sub-form-group">
            <label className="exec-f-sub-form-label">POSM Available</label>
            <div className="exec-f-sub-radio-group">
              <label className="exec-f-sub-radio-option">
                <input
                  type="radio"
                  name="POSMchecked"
                  value="true"
                  checked={formData.POSMchecked === true}
                  onChange={() => handleInputChange('POSMchecked', true)}
                  className="exec-f-sub-radio-input"
                />
                <span className="exec-f-sub-radio-custom"></span>
                <span className="exec-f-sub-radio-label">Yes</span>
              </label>
              <label className="exec-f-sub-radio-option">
                <input
                  type="radio"
                  name="POSMchecked"
                  value="false"
                  checked={formData.POSMchecked === false}
                  onChange={() => handleInputChange('POSMchecked', false)}
                  className="exec-f-sub-radio-input"
                />
                <span className="exec-f-sub-radio-custom"></span>
                <span className="exec-f-sub-radio-label">No</span>
              </label>
            </div>
          </div>

          <div className="exec-f-sub-form-group">
            <label className="exec-f-sub-form-label">Raise Issues if</label>
            <div className="exec-f-sub-issues-input-container">
              <div className="exec-f-sub-issue-input-wrapper">
                <input
                  type="text"
                  className="exec-f-sub-form-input exec-f-sub-issue-input"
                  placeholder="Describe an issue encountered"
                  value={currentIssue}
                  onChange={(e) => setCurrentIssue(e.target.value)}
                  onKeyPress={handleIssueKeyPress}
                />
                <button
                  type="button"
                  className="exec-f-sub-add-issue-btn"
                  onClick={addIssue}
                  disabled={!currentIssue.trim()}
                >
                  Add Issue
                </button>
              </div>
              {formData.issuesRaised.length > 0 && (
                <div className="exec-f-sub-issues-list">
                  {formData.issuesRaised.map((issue, index) => (
                    <div key={index} className="exec-f-sub-issue-item">
                      <span className="exec-f-sub-issue-text">{issue}</span>
                      <button
                        type="button"
                        className="exec-f-sub-remove-issue-btn"
                        onClick={() => removeIssue(index)}
                        title="Remove issue"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="exec-f-sub-form-group">
            <label className="exec-f-sub-form-label">Photos Taken</label>
            <ImageUpload 
              onUpload={handleImageUpload}
              multiple={true}
              maxFiles={5}
              existingImages={formData.uploadedImages}
            />
          </div>

          <div className="exec-f-sub-form-group">
            <label className="exec-f-sub-form-label">
              Brands Visited <span className="exec-f-sub-required">*</span>
            </label>
            <div className="exec-f-sub-brands-input-container">
              <div className="exec-f-sub-brand-input-wrapper">
                <select
                  className="exec-f-sub-form-select exec-f-sub-brand-select"
                  value={""}
                  onChange={(e) => {
                    if (e.target.value) {
                      setCurrentBrand(e.target.value);
                      // Auto-add the selected brand
                      if (e.target.value === 'ALL_BRANDS') {
                        const availableBrands = storeData?.partnerBrands.filter(brand => 
                          !formData.brandsVisited.includes(brand)
                        ) || [];
                        
                        if (availableBrands.length > 0) {
                          setFormData(prev => ({
                            ...prev,
                            brandsVisited: [...prev.brandsVisited, ...availableBrands]
                          }));
                        }
                      } else if (!formData.brandsVisited.includes(e.target.value)) {
                        setFormData(prev => ({
                          ...prev,
                          brandsVisited: [...prev.brandsVisited, e.target.value]
                        }));
                      }
                      setCurrentBrand('');
                    }
                  }}
                  disabled={storeLoading || !storeData}
                >
                  <option value="">
                    {storeLoading ? 'Loading brands...' : 'Select a brand to add...'}
                  </option>
                  {storeData && storeData.partnerBrands.filter(brand => !formData.brandsVisited.includes(brand)).length > 1 && (
                    <option value="ALL_BRANDS">Add All Available Brands</option>
                  )}
                  {storeData && storeData.partnerBrands
                    .filter(brand => !formData.brandsVisited.includes(brand))
                    .sort()
                    .map((brand, index) => (
                      <option key={index} value={brand}>{brand}</option>
                    ))
                  }
                </select>
              </div>
              {formData.brandsVisited.length > 0 && (
                <div className="exec-f-sub-brands-list">
                  {formData.brandsVisited.map((brand, index) => (
                    <div key={index} className="exec-f-sub-brand-item">
                      <span className="exec-f-sub-brand-name">{brand}</span>
                      <button
                        type="button"
                        className="exec-f-sub-remove-brand-btn"
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

          <div className="exec-f-sub-form-group">
            <label className="exec-f-sub-form-label">Remarks</label>
            <textarea
              className="exec-f-sub-form-textarea"
              placeholder="Additional comments or observations..."
              value={formData.remarks}
              onChange={(e) => handleInputChange('remarks', e.target.value)}
              rows={3}
            />
          </div>

          <div className="exec-f-sub-form-actions">
            <button className="exec-f-sub-save-draft-btn" onClick={handleSaveDraft} disabled={submitting}>
              Save Draft
            </button>
            <button 
              className="exec-f-sub-submit-visit-btn" 
              onClick={handleSubmitVisit}
              disabled={submitting || formData.peopleMet.length === 0 || formData.brandsVisited.length === 0}
            >
              {submitting ? 'Submitting...' : 'Submit Visit'}
            </button>
          </div>
        </div>

        {/* Past Visits */}
        <div className="exec-f-sub-past-visits-card">
          <h3 className="exec-f-sub-section-title">Past Visits</h3>
          <div className="exec-f-sub-visits-list">
            {visitsLoading ? (
              <div className="loading-text">
                Loading past visits...
              </div>
            ) : pastVisits.length === 0 ? (
              <div className="exec-f-sub-no-visits">
                <p>No previous visits found for this store.</p>
              </div>
            ) : (
              pastVisits.map((visit) => (
                <div key={visit.id} className="exec-f-sub-visit-item">
                  <div className="exec-f-sub-visit-header">
                    <div className="exec-f-sub-visit-date-status">
                      <span className="exec-f-sub-visit-date">{formatDate(visit.createdAt)}</span>
                      <span 
                        className="exec-f-sub-visit-status"
                        style={{ backgroundColor: getStatusColor(visit.status) }}
                      >
                        {visit.status}
                      </span>
                    </div>
                    {visit.canViewDetails && (
                      <button 
                        className="exec-f-sub-view-details-btn"
                        onClick={() => openVisitModal(visit)}
                      >
                        View Details
                      </button>
                    )}
                  </div>
                  <div className="exec-f-sub-visit-representative">
                    <span className="exec-f-sub-person-icon">👤</span>
                    <span>{visit.representative}</span>
                  </div>
                  {visit.remarks && (
                    <div className="exec-f-sub-visit-description">
                      {visit.remarks}
                    </div>
                  )}
                  {visit.adminComment && (
                    <div className="exec-f-sub-admin-note">
                      <strong>Admin:</strong> {visit.adminComment}
                    </div>
                  )}
                  {visit.issues && visit.issues.length > 0 && (
                    <div className="exec-f-sub-visit-issues">
                      <strong>Issues Reported:</strong>
                      {visit.issues.map((issue) => (
                        <div key={issue.id} className="exec-f-sub-issue-item">
                          <span className="exec-f-sub-issue-details">{issue.details}</span>
                          <span className="exec-f-sub-issue-status" style={{ color: getStatusColor(issue.status) }}>
                            ({issue.status})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {visit.personMet && visit.personMet.length > 0 && (
                    <div className="exec-f-sub-visit-people">
                      <strong>Contact Person:</strong>
                      {visit.personMet.map((person, index) => (
                        <span key={index} className="exec-f-sub-person-met">
                          {person.name} ({person.designation})
                          {person.phoneNumber && ` - ${person.phoneNumber}`}
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

const ExecutiveForm: React.FC = () => {
  return (
    <Suspense fallback={
      <div className="exec-f-sub-container">
        <div className="exec-f-sub-content">
          <div className="loading-text">
            Loading form...
          </div>
        </div>
      </div>
    }>
      <ExecutiveFormContent />
    </Suspense>
  );
};

export default ExecutiveForm;
