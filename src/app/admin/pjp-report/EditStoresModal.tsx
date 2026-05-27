'use client';

import React, { useState, useEffect } from 'react';
import styles from './EditStoresModal.module.css';

interface Store {
  id: string;
  storeName: string;
  city: string;
  fullAddress: string;
}

interface EditStoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  executiveName: string;
  currentStoreIds: string[];
  onSave: () => void;
}

const EditStoresModal: React.FC<EditStoresModalProps> = ({
  isOpen,
  onClose,
  planId,
  executiveName,
  currentStoreIds,
  onSave
}) => {
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(currentStoreIds);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('All Cities');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchStores();
      setSelectedStoreIds(currentStoreIds);
    }
  }, [isOpen, currentStoreIds]);

  const fetchStores = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/executive/stores');
      const result = await response.json();
      if (result.success) {
        setAllStores(result.stores || []);
      } else {
        setError('Failed to fetch stores');
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError('An error occurred while fetching stores');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStore = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/pjp-report/update-stores', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          storeIds: selectedStoreIds
        }),
      });

      const result = await response.json();
      if (result.success) {
        onSave();
        onClose();
      } else {
        setError(result.error || 'Failed to update stores');
      }
    } catch (err) {
      console.error('Error updating stores:', err);
      setError('An error occurred while updating stores');
    } finally {
      setIsSaving(false);
    }
  };

  // Get unique cities for filter
  const cities = Array.from(new Set(allStores.map(s => s.city).filter(Boolean))).sort();

  // Filter stores based on search and city
  const filteredStores = allStores.filter(store => {
    const matchesSearch = store.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         store.fullAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = cityFilter === 'All Cities' || store.city === cityFilter;
    return matchesSearch && matchesCity;
  });

  // Separate selected and unselected stores
  const selectedStores = filteredStores.filter(s => selectedStoreIds.includes(s.id));
  const unselectedStores = filteredStores.filter(s => !selectedStoreIds.includes(s.id));

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>✏️ Edit PJP Stores</h2>
            <p className={styles.subtitle}>
              Managing stores for <strong>{executiveName}</strong>
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={isSaving}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {error && (
            <div className={styles.errorAlert}>
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          <div className={styles.filters}>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="🔍 Search stores by name or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.cityFilter}>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className={styles.citySelect}
              >
                <option value="All Cities">All Cities</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.selectedCount}>
            <span className={styles.countBadge}>
              {selectedStoreIds.length} store{selectedStoreIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>

          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading stores...</p>
            </div>
          ) : (
            <div className={styles.storesList}>
              {selectedStores.length > 0 && (
                <div className={styles.storeSection}>
                  <h3 className={styles.sectionTitle}>✓ Selected Stores ({selectedStores.length})</h3>
                  <div className={styles.storesGrid}>
                    {selectedStores.map(store => (
                      <div key={store.id} className={`${styles.storeCard} ${styles.selected}`}>
                        <div className={styles.storeInfo}>
                          <h4 className={styles.storeName}>{store.storeName}</h4>
                          <p className={styles.storeCity}>{store.city}</p>
                          {store.fullAddress && (
                            <p className={styles.storeAddress}>{store.fullAddress}</p>
                          )}
                        </div>
                        <button
                          className={styles.removeBtn}
                          onClick={() => handleToggleStore(store.id)}
                          title="Remove store"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unselectedStores.length > 0 && (
                <div className={styles.storeSection}>
                  <h3 className={styles.sectionTitle}>Available Stores ({unselectedStores.length})</h3>
                  <div className={styles.storesGrid}>
                    {unselectedStores.map(store => (
                      <div key={store.id} className={styles.storeCard}>
                        <div className={styles.storeInfo}>
                          <h4 className={styles.storeName}>{store.storeName}</h4>
                          <p className={styles.storeCity}>{store.city}</p>
                          {store.fullAddress && (
                            <p className={styles.storeAddress}>{store.fullAddress}</p>
                          )}
                        </div>
                        <button
                          className={styles.addBtn}
                          onClick={() => handleToggleStore(store.id)}
                          title="Add store"
                        >
                          +
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredStores.length === 0 && (
                <div className={styles.noData}>
                  <p>
                    {searchTerm || cityFilter !== 'All Cities'
                      ? 'No stores found matching your filters'
                      : 'No stores available'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={isSaving || selectedStoreIds.length === 0}
          >
            {isSaving ? 'Saving...' : `Save Changes (${selectedStoreIds.length} stores)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditStoresModal;
