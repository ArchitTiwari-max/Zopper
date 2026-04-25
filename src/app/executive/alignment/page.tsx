'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  ChevronRight,
  Plus,
  Minus,
  Save,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Phone,
  User,
  ShieldCheck,
  Store,
  Pencil,
  Trash2,
  Link,
  MapPin,
  X
} from 'lucide-react';

import './alignment.css';

// ─── Components ──────────────────────────────────────────────────────────────

const AlignmentPage = () => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const STORES_PER_PAGE = 10;
  const [selectedStore, setSelectedStore] = useState<any | null>(null);
  const [alignmentData, setAlignmentData] = useState<any>(null);
  const [savedAlignmentData, setSavedAlignmentData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [editingPersons, setEditingPersons] = useState<Set<string>>(new Set());

  // Mass Mapping State
  const [mappingRoleName, setMappingRoleName] = useState<string | null>(null);
  const [chainConfig, setChainConfig] = useState<any>(null);

  const [mappingPerson, setMappingPerson] = useState<any>(null);
  const [selectedTargetStores, setSelectedTargetStores] = useState<Set<string>>(new Set());
  const [bulkMapStatus, setBulkMapStatus] = useState<'idle' | 'mapping' | 'success' | 'error'>('idle');

  const getPersonKey = (section: string, rIdx: number, pIdx: number) => `${section}-${rIdx}-${pIdx}`;



  const fetchStores = async () => {
    try {
      const response = await fetch('/api/executive/store/data', { cache: 'no-store' });
      const json = await response.json();
      if (json.success) {
        setStores(json.data.stores);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load Executive's mapped stores
  useEffect(() => {
    fetchStores();
  }, []);

  // Handle store selection and fetch its current alignment from DB
  const handleSelectStore = async (store: any) => {
    setSelectedStore(store);
    setAlignmentData(null);
    setSavedAlignmentData(null);
    setChainConfig(null);
    setSaveStatus('idle');
    setEditingPersons(new Set());

    try {
      const response = await fetch(`/api/executive/alignment?storeId=${store.id}`);
      const json = await response.json();

      if (json.success && json.data) {
        const data = json.data;
        const cfg = data.chainConfig || null;
        setChainConfig(cfg);

        if (data.storeLevel || data.stakeholderLevel) {
          // Existing alignment data found — safely merge with latest config
          let storeLevel = data.storeLevel || [];
          let stakeholderLevel = data.stakeholderLevel || [];

          if (cfg) {
            // Strictly adhere to config roles and order
            storeLevel = (cfg.storeRoles || []).map((cfgRole: any) => {
              const existing = storeLevel.find((r: any) => r.role.toUpperCase() === cfgRole.role.toUpperCase());
              return existing || { role: cfgRole.role, personnel: [] };
            });

            stakeholderLevel = (cfg.stakeholderRoles || []).map((cfgRole: any) => {
              const existing = stakeholderLevel.find((r: any) => r.role.toUpperCase() === cfgRole.role.toUpperCase());
              return existing || { role: cfgRole.role, personnel: [] };
            });
          }

          const mergedData = { ...data, storeLevel, stakeholderLevel };
          setAlignmentData(mergedData);
          setSavedAlignmentData(JSON.parse(JSON.stringify(mergedData)));
        } else if (cfg) {
          // No alignment yet but chain config exists — build default from chain config
          const defaultData = {
            storeId: store.id,
            storeLevel: (cfg.storeRoles || []).map((r: any) => ({ role: r.role, personnel: [] })),
            stakeholderLevel: (cfg.stakeholderRoles || []).map((r: any) => ({ role: r.role, personnel: [] })),
            chainConfig: cfg,
          };
          setAlignmentData(defaultData);
          setSavedAlignmentData(JSON.parse(JSON.stringify(defaultData)));
        } else {
          // No chain config configured — show empty state
          setAlignmentData({ storeId: store.id, storeLevel: [], stakeholderLevel: [], chainConfig: null });
          setSavedAlignmentData({ storeId: store.id, storeLevel: [], stakeholderLevel: [], chainConfig: null });
        }
      }
    } catch (error) {
      console.error('Error fetching alignment:', error);
    }
  };

  const handleAddPerson = (section: 'storeLevel' | 'stakeholderLevel', roleIndex: number) => {
    if (!alignmentData) return;
    const newData = { ...alignmentData };
    const newPersonIndex = newData[section][roleIndex].personnel.length;
    newData[section][roleIndex].personnel.push({ name: '', phone: '' });
    setAlignmentData(newData);
    setEditingPersons(prev => new Set(prev).add(getPersonKey(section, roleIndex, newPersonIndex)));
  };

  const handleRemovePerson = (section: 'storeLevel' | 'stakeholderLevel', roleIndex: number, personIndex: number) => {
    if (!alignmentData) return;
    const newData = { ...alignmentData };
    newData[section][roleIndex].personnel.splice(personIndex, 1);
    setAlignmentData(newData);
    // Also clean up editing state
    const newEditing = new Set(editingPersons);
    newEditing.delete(getPersonKey(section, roleIndex, personIndex));
    setEditingPersons(newEditing);
  };

  const handlePersonChange = (section: 'storeLevel' | 'stakeholderLevel', roleIndex: number, personIndex: number, field: string, value: string) => {
    if (!alignmentData) return;
    const newData = { ...alignmentData };
    newData[section][roleIndex].personnel[personIndex][field] = value;
    setAlignmentData(newData);
  };

  const handleSave = async () => {
    if (!alignmentData || !selectedStore) return;

    setSaving(true);
    setSaveStatus('saving');

    try {
      const response = await fetch('/api/executive/alignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: selectedStore.id,
          storeLevel: alignmentData.storeLevel,
          stakeholderLevel: alignmentData.stakeholderLevel
        })
      });

      const json = await response.json();
      if (json.success) {
        setSaveStatus('success');
        setEditingPersons(new Set()); // Collapse all valid fields into profile boxes directly on submit
        setSavedAlignmentData(JSON.parse(JSON.stringify(alignmentData)));
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenMapping = (roleName: string, person: any) => {
    setMappingRoleName(roleName);
    setMappingPerson(person);
    setSelectedTargetStores(new Set());
    setBulkMapStatus('idle');
  };

  const handleConfirmMapping = async () => {
    if (!mappingRoleName || !mappingPerson || selectedTargetStores.size === 0) return;

    setBulkMapStatus('mapping');
    try {
      const response = await fetch('/api/executive/alignment/bulk-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStoreIds: Array.from(selectedTargetStores),
          roleName: mappingRoleName,
          person: mappingPerson
        })
      });

      const json = await response.json();
      if (json.success) {
        setBulkMapStatus('success');
        setTimeout(() => {
          setMappingRoleName(null);
          setMappingPerson(null);
        }, 1500);
      } else {
        setBulkMapStatus('error');
      }
    } catch (error) {
      setBulkMapStatus('error');
    }
  };


  const calculateProgress = (data = savedAlignmentData) => {
    if (!data || !selectedStore) return { percentage: 0, aligned: 0, total: 0 };

    const cfg = data.chainConfig || chainConfig;
    if (!cfg) return { percentage: 0, aligned: 0, total: 0 };

    const storeLevel = data.storeLevel || [];
    const stakeholderLevel = data.stakeholderLevel || [];
    const allRoles = [...storeLevel, ...stakeholderLevel];
    const total = allRoles.length;

    const isRoleObjAligned = (r: any) => r.personnel && r.personnel.some((p: any) =>
      p.name?.trim() !== '' && /^[0-9]{10}$/.test(p.phone?.trim() || '')
    );
    const aligned = allRoles.filter(isRoleObjAligned).length;

    const isRoleAligned = (roleName: string, levelData: any[]): boolean => {
      const roleEntry = levelData.find((r: any) => r.role?.trim().toUpperCase() === roleName.toUpperCase());
      if (!roleEntry || !roleEntry.personnel) return false;
      return roleEntry.personnel.some((p: any) =>
        p.name?.trim() !== '' && /^[0-9]{10}$/.test(p.phone?.trim() || '')
      );
    };

    let score = 0;
    for (const { role, weight } of (cfg.storeRoles || [])) {
      if (isRoleAligned(role, storeLevel)) score += weight;
    }
    for (const { role, weight } of (cfg.stakeholderRoles || [])) {
      if (isRoleAligned(role, stakeholderLevel)) score += weight;
    }

    const percentage = Math.min(score, 100);
    return { percentage, aligned, total };
  };

  const stats = calculateProgress();

  const filteredStores = stores.filter(s =>
    s.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredStores.length / STORES_PER_PAGE);
  const paginatedStores = filteredStores.slice((currentPage - 1) * STORES_PER_PAGE, currentPage * STORES_PER_PAGE);

  if (loading) {
    return (
      <div className="align-loading">
        <div className="loading-spinner-large"></div>
        <span className="loading-text">Standardizing dashboards...</span>
      </div>
    );
  }

  return (
    <div className="alignment-mgr-container">
      {!selectedStore ? (
        // ─── LIST VIEW ───────────────────────────────────────────────────────
        <div className="alignment-mgr-content">
          <div className="align-header">
            <h1>Staffing Alignment</h1>
            <p>Map and manage personnel for your assigned stores</p>
          </div>

          <div className="align-search-bar">
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search stores by name or city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="align-store-grid">
            {paginatedStores.map(store => (
              <div key={store.id} className="align-store-card" onClick={() => handleSelectStore(store)}>
                <div className="card-icon">
                  <Store size={20} />
                </div>
                <div className="card-info">
                  <h3>{store.storeName}</h3>
                  <span>{store.city}</span>
                </div>
                {store.alignmentScore !== undefined && (
                  <div className={`align-store-score ${store.alignmentScore >= 80 ? 'high' : store.alignmentScore >= 50 ? 'medium' : 'low'}`}>
                    {store.alignmentScore}%
                  </div>
                )}
                <ChevronRight size={18} className="card-arrow" />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="align-pagination">
              <button
                className="align-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="align-page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="align-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        // ─── EDITOR VIEW ─────────────────────────────────────────────────────
        <div className="align-editor-view">
          <div className="align-hud-container">
            <div className="align-hud">
              <div className="hud-stats">
                <div className="hud-metric">
                  <span className="metric-label">Overall Completion</span>
                  <span className={`metric-value ${stats.percentage === 100 ? 'success-text' : ''}`}>
                    {stats.percentage}%
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${stats.percentage === 100 ? 'success-pulse' : ''}`}
                    style={{ width: `${stats.percentage}%` }}
                  ></div>
                </div>
                <div className="hud-info">
                  {stats.percentage === 100 ? (
                    <span className="success-msg">✨ Store Fully Aligned! Great job.</span>
                  ) : (
                    <>{stats.aligned} of {stats.total} roles aligned</>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="editor-nav">
            <button className="back-btn" onClick={() => {
              setSelectedStore(null);
              fetchStores();
            }}>
              <ArrowLeft size={16} />
              <span>Stores List</span>
            </button>
            <div className="store-badge">
              <Store size={14} />
              <span>{selectedStore.storeName}</span>
            </div>
          </div>

          {alignmentData && !chainConfig && alignmentData.storeLevel?.length === 0 ? (
            <div className="align-no-config">
              <ShieldCheck size={48} className="align-no-config-icon" />
              <h3>No Role Template Configured</h3>
              <p>
                An admin needs to set up the role template for <strong>{selectedStore.storeName.split('-')[0].split(' ')[0]}</strong> stores.
              </p>
              <p className="align-no-config-hint">
                Go to <strong>Admin → Data Management → Chain Config</strong> to configure roles and weights for this store chain.
              </p>
            </div>
          ) : alignmentData && (
            <div className="alignment-forms">
              {/* STORE LEVEL SECTION */}
              <section className="align-section">
                <div className="section-title">
                  <div className="section-title-left">
                    <User size={18} />
                    <h3>Store Level Staffing</h3>
                  </div>
                  <div className="section-progress-badge">
                    {savedAlignmentData?.storeLevel.filter((r: any) =>
                      r.personnel && r.personnel.some((p: any) =>
                        p.name?.trim() !== '' &&
                        /^[0-9]{10}$/.test(p.phone?.trim() || '')
                      )
                    ).length || 0} / {alignmentData.storeLevel.length} Aligned
                  </div>
                </div>
                <div className="roles-grid">
                  {alignmentData.storeLevel.map((entry: any, rIdx: number) => (
                    <div key={entry.role} className="role-container">
                      <div className="role-header">
                        <span className="role-name">{entry.role}</span>
                        {(() => {
                          const isAligned = entry.personnel && entry.personnel.some((p: any) =>
                            p.name?.trim() !== '' &&
                            /^[0-9]{10}$/.test(p.phone?.trim() || '')
                          );
                          return (
                            <div className={`align-status ${isAligned ? 'aligned' : 'gap'}`}>
                              {isAligned ? 'ALIGNED' : 'GAP'}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="personnel-list">
                        {entry.personnel.map((p: any, pIdx: number) => {
                          const key = getPersonKey('storeLevel', rIdx, pIdx);
                          const isEditing = editingPersons.has(key);
                          const isValid = p.name?.trim() !== '' && /^[0-9]{10}$/.test(p.phone?.trim() || '');
                          const showProfileBox = isValid && !isEditing;

                          if (showProfileBox) {
                            return (
                              <div key={pIdx} className="profile-box-container" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div className="profile-box" style={{ marginBottom: 0 }}>
                                  <div className="profile-box-avatar">
                                    {p.name.trim().split(' ').slice(0, 2).map((n: string) => n[0]?.toUpperCase()).join('')}
                                  </div>
                                  <div className="profile-box-info">
                                    <span className="profile-box-name">{p.name}</span>
                                    <a href={`tel:${p.phone}`} className="profile-box-phone" onClick={e => e.stopPropagation()}>
                                      <Phone size={11} /> {p.phone}
                                    </a>
                                  </div>
                                  <div className="profile-box-actions">
                                    <button className="profile-btn edit" onClick={() => setEditingPersons(prev => new Set(prev).add(key))} title="Edit">
                                      <Pencil size={13} />
                                    </button>
                                    <button className="profile-btn remove" onClick={() => handleRemovePerson('storeLevel', rIdx, pIdx)} title="Delete">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                                {p.updatedByName && (
                                  <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', paddingLeft: '8px' }}>
                                    updated by {p.updatedByName}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div key={pIdx} className="person-row">
                              <div className="input-with-icon">
                                <User size={14} className="input-icon" />
                                <input
                                  type="text"
                                  placeholder="Full name"
                                  value={p.name}
                                  onChange={(e) => handlePersonChange('storeLevel', rIdx, pIdx, 'name', e.target.value)}
                                />
                              </div>
                              <div className="input-with-icon">
                                <Phone size={14} className="input-icon" />
                                <input
                                  type="tel"
                                  placeholder="Phone number"
                                  maxLength={10}
                                  value={p.phone}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    handlePersonChange('storeLevel', rIdx, pIdx, 'phone', val);
                                  }}
                                />
                              </div>
                              <button className="remove-btn" onClick={() => handleRemovePerson('storeLevel', rIdx, pIdx)}>
                                <Minus size={14} />
                              </button>
                            </div>
                          );
                        })}
                        <div className="role-actions">
                          <button className="add-person-btn" onClick={() => handleAddPerson('storeLevel', rIdx)}>
                            <Plus size={14} /> Add Personnel
                          </button>

                          <button
                            className="role-submit-btn"
                            onClick={handleSave}
                            disabled={saveStatus === 'saving'}
                          >
                            {saveStatus === 'saving' ? 'Saving...' : <><Save size={14} /> Submit</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* STAKEHOLDER LEVEL SECTION */}
              <section className="align-section stakeholder">
                <div className="section-title">
                  <div className="section-title-left">
                    <ShieldCheck size={18} />
                    <h3>Stakeholder Alignment</h3>
                  </div>
                  <div className="section-progress-badge">
                    {savedAlignmentData?.stakeholderLevel.filter((r: any) =>
                      r.personnel && r.personnel.some((p: any) =>
                        p.name?.trim() !== '' &&
                        /^[0-9]{10}$/.test(p.phone?.trim() || '')
                      )
                    ).length || 0} / {alignmentData.stakeholderLevel.length} Aligned
                  </div>
                </div>
                <div className="roles-grid">
                  {alignmentData.stakeholderLevel.map((entry: any, rIdx: number) => (
                    <div key={entry.role} className="role-container">
                      <div className="role-header">
                        <span className="role-name">{entry.role}</span>
                        {(() => {
                          const isAligned = entry.personnel && entry.personnel.some((p: any) => p.name?.trim() !== '' && /^[0-9]{10}$/.test(p.phone?.trim() || ''));
                          return (
                            <div className={`align-status ${isAligned ? 'aligned' : 'gap'}`}>
                              {isAligned ? 'ALIGNED' : 'GAP'}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="personnel-list">
                        {entry.personnel.map((p: any, pIdx: number) => {
                          const key = getPersonKey('stakeholderLevel', rIdx, pIdx);
                          const isEditing = editingPersons.has(key);
                          const isValid = p.name?.trim() !== '' && /^[0-9]{10}$/.test(p.phone?.trim() || '');
                          const showProfileBox = isValid && !isEditing;

                          if (showProfileBox) {
                            return (
                              <div key={pIdx} className="profile-box-container" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div className="profile-box" style={{ marginBottom: 0 }}>
                                  <div className="profile-box-avatar">
                                    {p.name.trim().split(' ').slice(0, 2).map((n: string) => n[0]?.toUpperCase()).join('')}
                                  </div>
                                  <div className="profile-box-info">
                                    <span className="profile-box-name">{p.name}</span>
                                    <a href={`tel:${p.phone}`} className="profile-box-phone" onClick={e => e.stopPropagation()}>
                                      <Phone size={11} /> {p.phone}
                                    </a>
                                  </div>
                                  <div className="profile-box-actions">
                                    <button className="profile-btn map" onClick={() => handleOpenMapping(entry.role, p)} title="Map to other stores">
                                      <Link size={13} />
                                    </button>
                                    <button className="profile-btn edit" onClick={() => setEditingPersons(prev => new Set(prev).add(key))} title="Edit">
                                      <Pencil size={13} />
                                    </button>
                                    <button className="profile-btn remove" onClick={() => handleRemovePerson('stakeholderLevel', rIdx, pIdx)} title="Delete">
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                                {p.updatedByName && (
                                  <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', paddingLeft: '8px' }}>
                                    updated by {p.updatedByName}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div key={pIdx} className="person-row">
                              <div className="input-with-icon">
                                <User size={14} className="input-icon" />
                                <input
                                  type="text"
                                  placeholder="Full name"
                                  value={p.name}
                                  onChange={(e) => handlePersonChange('stakeholderLevel', rIdx, pIdx, 'name', e.target.value)}
                                />
                              </div>
                              <div className="input-with-icon">
                                <Phone size={14} className="input-icon" />
                                <input
                                  type="tel"
                                  placeholder="Phone number"
                                  maxLength={10}
                                  value={p.phone}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    handlePersonChange('stakeholderLevel', rIdx, pIdx, 'phone', val);
                                  }}
                                />
                              </div>
                              <button className="remove-btn" onClick={() => handleRemovePerson('stakeholderLevel', rIdx, pIdx)}>
                                <Minus size={14} />
                              </button>
                            </div>
                          );
                        })}
                        <div className="role-actions">
                          <button className="add-person-btn" onClick={() => handleAddPerson('stakeholderLevel', rIdx)}>
                            <Plus size={14} /> Add Personnel
                          </button>

                          <button
                            className="role-submit-btn"
                            onClick={handleSave}
                            disabled={saveStatus === 'saving'}
                          >
                            {saveStatus === 'saving' ? 'Saving...' : <><Save size={14} /> Submit</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* MASS MAPPING MODAL */}
          {mappingRoleName && mappingPerson && (
            <div className="mapping-modal-overlay" onClick={() => setMappingRoleName(null)}>
              <div className="mapping-modal" onClick={e => e.stopPropagation()}>
                <div className="mapping-modal-header">
                  <div>
                    <h3>Map {mappingPerson.name} to other stores</h3>
                    <p>Assign this person as <strong>{mappingRoleName}</strong> across multiple locations.</p>
                  </div>
                  <button className="mapping-close-btn" onClick={() => setMappingRoleName(null)}>
                    <X size={20} />
                  </button>
                </div>

                <div className="mapping-store-list">
                  {stores.filter(s => s.id !== selectedStore?.id).map((store) => (
                    <label key={store.id} className="mapping-store-item">
                      <input
                        type="checkbox"
                        className="mapping-checkbox"
                        checked={selectedTargetStores.has(store.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedTargetStores);
                          if (e.target.checked) newSet.add(store.id);
                          else newSet.delete(store.id);
                          setSelectedTargetStores(newSet);
                        }}
                      />
                      <div className="mapping-store-info">
                        <span className="name">{store.storeName}</span>
                        <span className="location"><MapPin size={12} /> {store.city}</span>
                      </div>
                    </label>
                  ))}

                  {stores.length <= 1 && (
                    <div className="mapping-empty">
                      No other stores available to map to.
                    </div>
                  )}
                </div>

                <div className="mapping-modal-footer">
                  <span className="mapping-count">
                    {selectedTargetStores.size} store{selectedTargetStores.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    className={`mapping-confirm-btn ${bulkMapStatus}`}
                    disabled={selectedTargetStores.size === 0 || bulkMapStatus === 'mapping' || bulkMapStatus === 'success'}
                    onClick={handleConfirmMapping}
                  >
                    {bulkMapStatus === 'mapping' ? 'Mapping...' :
                      bulkMapStatus === 'success' ? <><CheckCircle2 size={16} /> Mapped Successfully</> :
                        'Confirm Mapping'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlignmentPage;
