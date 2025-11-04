'use client';

import React, { useState, useEffect } from 'react';
import './VPOEditModal.css';

interface Store {
  id: string;
  storeName: string;
  city: string;
  fullAddress?: string;
  partnerBrands: string[];
}

interface AvailableStore {
  id: string;
  storeName: string;
  city: string;
  fullAddress?: string;
  partnerBrands: string[];
}

interface VPOData {
  id: string;
  status: string;
  plannedVisitDate: string;
  createdByRole: string;
  adminComment?: string;
  canEdit: boolean;
  stores: Store[];
}

interface VPOEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  vpoData: VPOData | null;
  onSave: (updatedVPO: any) => void;
  isSubmitting?: boolean;
}

interface ConfirmationDialog {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const VPOEditModal: React.FC<VPOEditModalProps> = ({
  isOpen,
  onClose,
  vpoData,
  onSave,
  isSubmitting = false
}) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [plannedVisitDate, setPlannedVisitDate] = useState<string>('');
  const [availableStores, setAvailableStores] = useState<AvailableStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Store replacement state
  const [replacingStoreId, setReplacingStoreId] = useState<string | null>(null);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationDialog>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  // Initialize modal data when it opens
  useEffect(() => {
    if (isOpen && vpoData) {
      setStores([...vpoData.stores]);
      setPlannedVisitDate(vpoData.plannedVisitDate.split('T')[0]); // Format for date input
      setHasChanges(false);
      setError(null);
      fetchAvailableStores();
    }
  }, [isOpen, vpoData]);

  // Fetch available stores for adding/replacing
  const fetchAvailableStores = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/executive/stores', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stores');
      }

      const result = await response.json();
      if (result.success) {
        setAvailableStores(result.data.stores || []);
      } else {
        throw new Error(result.error || 'Failed to fetch stores');
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stores');
    } finally {
      setLoading(false);
    }
  };

  // Check if changes have been made
  const checkForChanges = (newStores: Store[], newDate: string) => {
    if (!vpoData) return false;
    
    const originalDate = vpoData.plannedVisitDate.split('T')[0];
    const dateChanged = newDate !== originalDate;
    
    const storesChanged = 
      newStores.length !== vpoData.stores.length ||
      newStores.some(store => !vpoData.stores.find(orig => orig.id === store.id));
    
    return dateChanged || storesChanged;
  };

  // Handle store removal
  const handleRemoveStore = (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (!store) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Remove Store',
      message: `Are you sure you want to remove "${store.storeName}" from this visit plan?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: () => {
        const newStores = stores.filter(s => s.id !== storeId);
        setStores(newStores);
        setHasChanges(checkForChanges(newStores, plannedVisitDate));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle store replacement
  const handleReplaceStore = (oldStoreId: string) => {
    setReplacingStoreId(oldStoreId);
  };

  const handleReplaceStoreSelect = (newStoreId: string) => {
    const newStore = availableStores.find(s => s.id === newStoreId);
    const oldStore = stores.find(s => s.id === replacingStoreId);
    
    if (!newStore || !oldStore) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Replace Store',
      message: `Replace "${oldStore.storeName}" with "${newStore.storeName}"?`,
      confirmText: 'Replace',
      cancelText: 'Cancel',
      type: 'warning',
      onConfirm: () => {
        const newStores = stores.map(store => 
          store.id === replacingStoreId ? newStore : store
        );
        setStores(newStores);
        setHasChanges(checkForChanges(newStores, plannedVisitDate));
        setReplacingStoreId(null);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        setReplacingStoreId(null);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle adding new store
  const handleAddStore = (newStoreId: string) => {
    const newStore = availableStores.find(s => s.id === newStoreId);
    if (!newStore) return;

    // Check if store is already in the list
    if (stores.some(s => s.id === newStoreId)) {
      setError('This store is already in the visit plan');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Add Store',
      message: `Add "${newStore.storeName}" to this visit plan?`,
      confirmText: 'Add',
      cancelText: 'Cancel',
      type: 'info',
      onConfirm: () => {
        const newStores = [...stores, newStore];
        setStores(newStores);
        setHasChanges(checkForChanges(newStores, plannedVisitDate));
        setError(null);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle date change
  const handleDateChange = (newDate: string) => {
    setPlannedVisitDate(newDate);
    setHasChanges(checkForChanges(stores, newDate));
  };

  // Handle save
  const handleSave = () => {
    if (stores.length === 0) {
      setError('At least one store is required');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Save Changes',
      message: `Save changes to this visit plan? This will update the plan for ${stores.length} ${stores.length === 1 ? 'store' : 'stores'}.`,
      confirmText: 'Save Changes',
      cancelText: 'Cancel',
      type: 'info',
      onConfirm: () => {
        onSave({
          storeIds: stores.map(s => s.id),
          plannedVisitDate: plannedVisitDate
        });
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle close
  const handleClose = () => {
    if (hasChanges && !isSubmitting) {
      setConfirmDialog({
        isOpen: true,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close without saving?',
        confirmText: 'Close Without Saving',
        cancelText: 'Continue Editing',
        type: 'warning',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          onClose();
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      });
    } else {
      onClose();
    }
  };

  // Filter available stores (exclude already selected ones, unless replacing)
  const getFilteredAvailableStores = () => {
    return availableStores.filter(store => 
      !stores.some(s => s.id === store.id) || store.id === replacingStoreId
    );
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (!isOpen || !vpoData) return null;

  return (
    <>
      <div className="vpo-edit-modal-overlay">
        <div className="vpo-edit-modal">
          <div className="vpo-edit-modal-header">
            <h2 className="vpo-edit-modal-title">
              {vpoData.canEdit ? '✏️ Edit Visit Plan' : '👁️ View Visit Plan'}
            </h2>
            <button 
              className="vpo-edit-modal-close-btn"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              ✕
            </button>
          </div>

          <div className="vpo-edit-modal-body">
            {/* Error Message */}
            {error && (
              <div className="vpo-edit-error-message">
                {error}
              </div>
            )}

            {/* Visit Plan Info */}
            <div className="vpo-edit-info-section">
              <div className="vpo-edit-info-item">
                <span className="vpo-edit-info-label">Status:</span>
                <span className={`vpo-edit-status ${vpoData.status.toLowerCase()}`}>
                  {vpoData.status}
                </span>
              </div>
              <div className="vpo-edit-info-item">
                <span className="vpo-edit-info-label">Created by:</span>
                <span className="vpo-edit-created-by">
                  {vpoData.createdByRole === 'ADMIN' ? 'Admin' : 'Executive'}
                </span>
              </div>
            </div>

            {/* Admin Comment (if exists) */}
            {vpoData.adminComment && (
              <div className="vpo-edit-admin-comment">
                <strong>Admin Comment:</strong> {vpoData.adminComment}
              </div>
            )}

            {/* Cannot edit message */}
            {!vpoData.canEdit && (
              <div className="vpo-edit-readonly-notice">
                🔒 This visit plan was assigned by an admin and cannot be edited. You can only view the details.
              </div>
            )}

            {/* Planned Visit Date */}
            <div className="vpo-edit-date-section">
              <label className="vpo-edit-form-label">
                📅 Planned Visit Date
              </label>
              <input
                type="date"
                className="vpo-edit-date-input"
                value={plannedVisitDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={getMinDate()}
                disabled={!vpoData.canEdit || isSubmitting}
              />
            </div>

            {/* Stores List */}
            <div className="vpo-edit-stores-section">
              <h3 className="vpo-edit-section-title">
                🏪 Stores ({stores.length})
              </h3>

              <div className="vpo-edit-stores-list">
                {stores.map((store, index) => (
                  <div key={store.id} className="vpo-edit-store-item">
                    <div className="vpo-edit-store-number">{index + 1}</div>
                    <div className="vpo-edit-store-info">
                      <h4 className="vpo-edit-store-name">{store.storeName}</h4>
                      <p className="vpo-edit-store-location">📍 {store.city}</p>
                      {store.fullAddress && (
                        <p className="vpo-edit-store-address">{store.fullAddress}</p>
                      )}
                      <p className="vpo-edit-store-brands">
                        🏢 {store.partnerBrands.length > 0 ? store.partnerBrands.join(', ') : 'No brands'}
                      </p>
                    </div>
                    
                    {vpoData.canEdit && (
                      <div className="vpo-edit-store-actions">
                        {replacingStoreId === store.id ? (
                          <div className="vpo-edit-replace-dropdown">
                            <select
                              className="vpo-edit-replace-select"
                              onChange={(e) => e.target.value && handleReplaceStoreSelect(e.target.value)}
                              defaultValue=""
                            >
                              <option value="">Select replacement store...</option>
                              {getFilteredAvailableStores().map(availableStore => (
                                <option key={availableStore.id} value={availableStore.id}>
                                  {availableStore.storeName} - {availableStore.city}
                                </option>
                              ))}
                            </select>
                            <button
                              className="vpo-edit-cancel-replace-btn"
                              onClick={() => setReplacingStoreId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              className="vpo-edit-replace-btn"
                              onClick={() => handleReplaceStore(store.id)}
                              disabled={isSubmitting}
                              title="Replace this store"
                            >
                              🔄
                            </button>
                            <button
                              className="vpo-edit-remove-btn"
                              onClick={() => handleRemoveStore(store.id)}
                              disabled={isSubmitting || stores.length <= 1}
                              title={stores.length <= 1 ? "Cannot remove - at least one store required" : "Remove this store"}
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Store */}
              {vpoData.canEdit && (
                <div className="vpo-edit-add-store-section">
                  <h4 className="vpo-edit-add-title">➕ Add New Store</h4>
                  {loading ? (
                    <div className="vpo-edit-loading">Loading available stores...</div>
                  ) : (
                    <select
                      className="vpo-edit-add-select"
                      onChange={(e) => e.target.value && handleAddStore(e.target.value)}
                      value=""
                      disabled={isSubmitting}
                    >
                      <option value="">Select a store to add...</option>
                      {getFilteredAvailableStores().map(store => (
                        <option key={store.id} value={store.id}>
                          {store.storeName} - {store.city}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="vpo-edit-modal-footer">
            <button
              className="vpo-edit-cancel-btn"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {vpoData.canEdit ? 'Cancel' : 'Close'}
            </button>
            
            {vpoData.canEdit && (
              <button
                className="vpo-edit-save-btn"
                onClick={handleSave}
                disabled={isSubmitting || !hasChanges || stores.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <span className="vpo-edit-loading-spinner"></span>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="vpo-edit-confirm-overlay">
          <div className={`vpo-edit-confirm-modal vpo-edit-confirm-${confirmDialog.type || 'info'}`}>
            <div className="vpo-edit-confirm-header">
              <h3 className="vpo-edit-confirm-title">{confirmDialog.title}</h3>
            </div>
            <div className="vpo-edit-confirm-body">
              <p className="vpo-edit-confirm-message">{confirmDialog.message}</p>
            </div>
            <div className="vpo-edit-confirm-footer">
              <button
                className="vpo-edit-confirm-cancel-btn"
                onClick={confirmDialog.onCancel}
              >
                {confirmDialog.cancelText || 'Cancel'}
              </button>
              <button
                className={`vpo-edit-confirm-confirm-btn vpo-edit-confirm-${confirmDialog.type || 'info'}`}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VPOEditModal;