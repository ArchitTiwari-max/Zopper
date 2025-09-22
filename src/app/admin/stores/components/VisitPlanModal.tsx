'use client';

import React, { useState, useEffect } from 'react';

interface Store {
  id: string;
  storeName: string;
  city: string;
  fullAddress?: string;
}

interface Executive {
  id: string;
  name: string;
  email: string;
  region?: string;
  contactNumber: string;
}

interface VisitPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStores: Store[];
  onSubmit: (data: { executiveId: string; adminComment: string; plannedVisitDate: string }) => void;
  isSubmitting?: boolean;
}

const VisitPlanModal: React.FC<VisitPlanModalProps> = ({
  isOpen,
  onClose,
  selectedStores,
  onSubmit,
  isSubmitting = false
}) => {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState<string>('');
  const [adminComment, setAdminComment] = useState<string>('');
  const [plannedVisitDate, setPlannedVisitDate] = useState<string>('');
  const [isLoadingExecutives, setIsLoadingExecutives] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch executives when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchExecutives();
      // Reset form when modal opens
      setSelectedExecutiveId('');
      setAdminComment('');
      // Set default date to today in IST
      const today = new Date();
      // Convert to IST (UTC + 5:30)
      const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
      const istDate = new Date(today.getTime() + istOffset);
      setPlannedVisitDate(istDate.toISOString().split('T')[0]);
      setError(null);
    }
  }, [isOpen]);

  const fetchExecutives = async () => {
    setIsLoadingExecutives(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/visit-plan', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch executives');
      }

      const data = await response.json();
      if (data.success) {
        setExecutives(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch executives');
      }
    } catch (err) {
      console.error('Error fetching executives:', err);
      setError(err instanceof Error ? err.message : 'Failed to load executives');
    } finally {
      setIsLoadingExecutives(false);
    }
  };

  const handleSubmit = () => {
    if (!selectedExecutiveId) {
      setError('Please select an executive to assign the visit plan');
      return;
    }

    if (!plannedVisitDate) {
      setError('Please select a planned visit date');
      return;
    }

    onSubmit({
      executiveId: selectedExecutiveId,
      adminComment: adminComment.trim(),
      plannedVisitDate: plannedVisitDate
    });
  };

  const handleCancel = () => {
    setSelectedExecutiveId('');
    setAdminComment('');
    setPlannedVisitDate('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            color: '#111827', 
            margin: '0 0 8px 0' 
          }}>
            Create Visit Plan
          </h2>
          <p style={{ 
            fontSize: '14px', 
            color: '#6b7280', 
            margin: 0 
          }}>
            Assign {selectedStores.length} store{selectedStores.length > 1 ? 's' : ''} to an executive for visit plan
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Selected Stores */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#374151', 
            margin: '0 0 12px 0' 
          }}>
            Selected Stores ({selectedStores.length})
          </h3>
          <div style={{
            maxHeight: '120px',
            overflowY: 'auto',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            padding: '12px'
          }}>
            {selectedStores.map((store, index) => (
              <div key={store.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: index < selectedStores.length - 1 ? '1px solid #f3f4f6' : 'none'
              }}>
                <div>
                  <div style={{ fontWeight: '500', color: '#111827', fontSize: '14px' }}>
                    {store.storeName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {store.city}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Executive Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Assign to Executive *
          </label>
          {isLoadingExecutives ? (
            <div style={{
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#6b7280'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Loading executives...
            </div>
          ) : (
            <select
              value={selectedExecutiveId}
              onChange={(e) => setSelectedExecutiveId(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="">Select an executive...</option>
              {executives.map(executive => (
                <option key={executive.id} value={executive.id}>
                  {executive.name} ({executive.email}){executive.region ? ` - ${executive.region}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Planned Visit Date */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Planned Visit Date *
          </label>
          <input
            type="date"
            value={plannedVisitDate}
            onChange={(e) => setPlannedVisitDate(e.target.value)}
            min={(() => {
              // Get today's date in IST
              const today = new Date();
              const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
              const istDate = new Date(today.getTime() + istOffset);
              return istDate.toISOString().split('T')[0];
            })()} // Prevent past dates (IST)
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: 'white',
              fontFamily: 'inherit'
            }}
          />
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '4px 0 0 0'
          }}>
            Select the date when the executive should visit these stores
          </p>
        </div>

        {/* Admin Comment */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '8px'
          }}>
            Admin Comment (Optional)
          </label>
          <textarea
            value={adminComment}
            onChange={(e) => setAdminComment(e.target.value)}
            placeholder="Add any instructions or comments for the executive..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: '80px'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            style={{
              padding: '12px 20px',
              backgroundColor: '#f9fafb',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedExecutiveId || !plannedVisitDate || isLoadingExecutives}
            style={{
              padding: '12px 20px',
              backgroundColor: selectedExecutiveId && plannedVisitDate && !isLoadingExecutives ? '#4f46e5' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: selectedExecutiveId && plannedVisitDate && !isLoadingExecutives && !isSubmitting ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSubmitting && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            )}
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VisitPlanModal;
