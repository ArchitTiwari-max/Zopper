'use client';

import React, { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import './SubmitTaskModal.css';

interface UploadedImage {
  url: string;
  public_id: string;
  bytes: number;
  format: string;
}

interface PersonMet {
  name: string;
  designation: string;
}

interface StoreDetails {
  id: string;
  storeName: string;
  city: string;
  fullAddress: string | null;
  partnerBrandIds: string[];
}

interface SubmitTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: number;
  storeName: string;
  storeDetails?: StoreDetails;
  onTaskSubmitted: () => void;
}

const SubmitTaskModal: React.FC<SubmitTaskModalProps> = ({
  isOpen,
  onClose,
  taskId,
  storeName,
  storeDetails,
  onTaskSubmitted
}) => {
  const [formData, setFormData] = useState({
    personMet: { name: '', designation: '' } as PersonMet,
    remarks: '',
    photos: [] as UploadedImage[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isStoreExpanded, setIsStoreExpanded] = useState(false);

  // Use store details if available, otherwise just show store name
  const displayStoreDetails = storeDetails || {
    id: '',
    storeName,
    city: '',
    fullAddress: null,
    partnerBrandIds: []
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Remarks is required
    if (!formData.remarks.trim()) {
      newErrors.remarks = 'Remarks are required';
    }

    // Name is required if designation is provided
    if (formData.personMet.designation && !formData.personMet.name.trim()) {
      newErrors.personName = 'Name is required when designation is provided';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePersonMetChange = (field: keyof PersonMet, value: string) => {
    setFormData(prev => ({
      ...prev,
      personMet: {
        ...prev.personMet,
        [field]: value
      }
    }));

    // Clear specific field errors
    if (field === 'name' && errors.personName) {
      setErrors(prev => ({ ...prev, personName: '' }));
    }
  };

  const handleRemarksChange = (value: string) => {
    setFormData(prev => ({ ...prev, remarks: value }));
    
    // Clear remarks error
    if (errors.remarks) {
      setErrors(prev => ({ ...prev, remarks: '' }));
    }
  };

  const handleImageUpload = (images: UploadedImage[]) => {
    setFormData(prev => ({ ...prev, photos: images }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/executive/submit-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          taskId,
          personMet: formData.personMet.name || formData.personMet.designation ? formData.personMet : null,
          remarks: formData.remarks,
          photos: formData.photos
        })
      });

      const result = await response.json();

      if (result.success) {
        onTaskSubmitted();
        onClose();
        // Reset form
        setFormData({
          personMet: { name: '', designation: '' },
          remarks: '',
          photos: []
        });
      } else {
        setErrors({ submit: result.error || 'Failed to submit task' });
      }
    } catch (error) {
      console.error('Submit task error:', error);
      setErrors({ submit: 'Failed to submit task. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="submit-task-modal">
        <div className="modal-header">
          <h2 className="modal-title">Submit Task Report</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="store-info">
            <div className="store-info-header" onClick={() => setIsStoreExpanded(!isStoreExpanded)}>
              <div className="store-basic-info">
                <h3>Store: {displayStoreDetails.storeName}</h3>
                <p>Task ID: #{taskId}</p>
              </div>
              {storeDetails && (
                <button className="expand-store-details-btn" type="button">
                  <span className={`expand-arrow ${isStoreExpanded ? 'expanded' : ''}`}>
                    ▼
                  </span>
                </button>
              )}
            </div>
            
            {isStoreExpanded && storeDetails && (
              <div className="store-details-expanded">
                {displayStoreDetails.fullAddress && (
                  <div className="store-detail-item">
                    <span className="detail-label">Full Address:</span>
                    <span className="detail-value">{displayStoreDetails.fullAddress}</span>
                  </div>
                )}
                {displayStoreDetails.city && (
                  <div className="store-detail-item">
                    <span className="detail-label">City:</span>
                    <span className="detail-value">{displayStoreDetails.city}</span>
                  </div>
                )}
                {displayStoreDetails.partnerBrandIds.length > 0 && (
                  <div className="store-detail-item">
                    <span className="detail-label">Partner Brands:</span>
                    <span className="detail-value">{displayStoreDetails.partnerBrandIds.length} brands</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="submit-form">
            {/* Person Met Section */}
            <div className="form-section">
              <h4 className="section-title">Person Met (Optional)</h4>
              <div className="person-met-fields">
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className={`form-input ${errors.personName ? 'error' : ''}`}
                    value={formData.personMet.name}
                    onChange={(e) => handlePersonMetChange('name', e.target.value)}
                    placeholder="Enter person's name"
                  />
                  {errors.personName && (
                    <span className="error-message">{errors.personName}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.personMet.designation}
                    onChange={(e) => handlePersonMetChange('designation', e.target.value)}
                    placeholder="Enter designation"
                  />
                </div>
              </div>
            </div>

            {/* Remarks Section */}
            <div className="form-section">
              <h4 className="section-title">
                Remarks <span className="required">*</span>
              </h4>
              <div className="form-group">
                <textarea
                  className={`form-textarea ${errors.remarks ? 'error' : ''}`}
                  value={formData.remarks}
                  onChange={(e) => handleRemarksChange(e.target.value)}
                  placeholder="Enter your remarks about the task completion..."
                  rows={4}
                  required
                />
                {errors.remarks && (
                  <span className="error-message">{errors.remarks}</span>
                )}
              </div>
            </div>

            {/* Photo Upload Section */}
            <div className="form-section">
              <h4 className="section-title">Photos (Optional)</h4>
              <ImageUpload
                onUpload={handleImageUpload}
                multiple={true}
                maxFiles={3}
                existingImages={formData.photos}
                className="task-photo-upload"
              />
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="submit-error">
                {errors.submit}
              </div>
            )}

            {/* Form Actions */}
            <div className="form-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="loading-spinner"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Task'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitTaskModal;
