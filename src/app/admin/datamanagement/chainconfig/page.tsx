'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  Store,
  Settings,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import './chainconfig.css';

interface RoleWeight {
  role: string;
  weight: number;
}

interface StoreInfo {
  id: string;
  storeName: string;
  city: string;
}

interface ConfiguredChain {
  id: string;
  chainName: string;
  prefix: string;
  excludedStoreIds: string[];
  storeRoles: RoleWeight[];
  stakeholderRoles: RoleWeight[];
  matchedStores: StoreInfo[];
  excludedStores: StoreInfo[];
  updatedAt: string;
}

interface UnconfiguredChain {
  prefix: string;
  stores: StoreInfo[];
}

const ChainConfigPage = () => {
  const [configuredChains, setConfiguredChains] = useState<ConfiguredChain[]>([]);
  const [unconfiguredChains, setUnconfiguredChains] = useState<UnconfiguredChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const [savingChain, setSavingChain] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'success' | 'error'>>({});
  const [creatingChain, setCreatingChain] = useState<string | null>(null); // prefix being initialized

  // Local draft state per chain
  const [drafts, setDrafts] = useState<Record<string, ConfiguredChain>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/chain-config');
      const json = await res.json();
      if (json.success) {
        setConfiguredChains(json.data.configuredChains);
        setUnconfiguredChains(json.data.unconfiguredChains);
        // Initialize drafts
        const initial: Record<string, ConfiguredChain> = {};
        json.data.configuredChains.forEach((c: ConfiguredChain) => {
          initial[c.id] = { ...c };
        });
        setDrafts(initial);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getDraft = (id: string): ConfiguredChain | undefined => drafts[id];

  const updateDraft = (id: string, updater: (d: ConfiguredChain) => ConfiguredChain) => {
    setDrafts(prev => ({
      ...prev,
      [id]: updater(prev[id])
    }));
  };

  const totalWeight = (draft: ConfiguredChain) => {
    const s = (draft.storeRoles || []).reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
    const st = (draft.stakeholderRoles || []).reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
    return s + st;
  };

  const handleSaveChain = async (chainId: string) => {
    const draft = drafts[chainId];
    if (!draft) return;

    const tw = totalWeight(draft);
    if (tw !== 100) {
      setSaveStatus(prev => ({ ...prev, [chainId]: 'error' }));
      return;
    }

    setSavingChain(chainId);
    try {
      const res = await fetch(`/api/admin/chain-config/${chainId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeRoles: draft.storeRoles,
          stakeholderRoles: draft.stakeholderRoles,
          excludedStoreIds: draft.excludedStoreIds,
        })
      });
      const json = await res.json();
      if (json.success) {
        setSaveStatus(prev => ({ ...prev, [chainId]: 'success' }));
        setTimeout(() => setSaveStatus(prev => ({ ...prev, [chainId]: 'idle' })), 3000);
        fetchData();
      } else {
        setSaveStatus(prev => ({ ...prev, [chainId]: 'error' }));
      }
    } catch {
      setSaveStatus(prev => ({ ...prev, [chainId]: 'error' }));
    } finally {
      setSavingChain(null);
    }
  };

  const handleDeleteChain = async (chainId: string) => {
    if (!confirm('Delete this chain config? Stores in this chain will show an empty state until reconfigured.')) return;
    try {
      await fetch(`/api/admin/chain-config/${chainId}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleInitChain = async (prefix: string) => {
    setCreatingChain(prefix);
    try {
      // Default roles based on prefix
      let storeRoles: RoleWeight[] = [];
      let stakeholderRoles: RoleWeight[] = [
        { role: 'ABM', weight: 5 },
        { role: 'ASE', weight: 5 },
        { role: 'ZSE', weight: 5 },
        { role: 'ZSM', weight: 5 },
        { role: 'KAM', weight: 5 },
      ];

      const upPrefix = prefix.toUpperCase();
      if (upPrefix.includes('CROMA')) {
        storeRoles = [
          { role: 'SEC', weight: 40 },
          { role: 'ADM', weight: 20 },
          { role: 'Store Manager', weight: 10 },
          { role: 'Cluster Manager', weight: 5 },
        ];
      } else if (upPrefix.includes('VS') || upPrefix.includes('VIJAY') || upPrefix.includes('RELIANCE') || upPrefix.includes('HITACHI') || upPrefix.includes('HAIER') || upPrefix.includes('LOCAL') || upPrefix.includes('ASP')) {
        storeRoles = [
          { role: 'SEC', weight: 40 },
          { role: 'TL', weight: 20 },
          { role: 'Store Manager', weight: 10 },
          { role: 'Category Manager', weight: 5 },
        ];
      }

      const res = await fetch('/api/admin/chain-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainName: prefix,
          prefix,
          storeRoles,
          stakeholderRoles,
        })
      });
      const json = await res.json();
      if (json.success) {
        await fetchData();
        setExpandedChain(json.data.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingChain(null);
    }
  };

  const handleToggleStoreExclusion = (chainId: string, storeId: string, currentlyExcluded: boolean) => {
    updateDraft(chainId, d => ({
      ...d,
      excludedStoreIds: currentlyExcluded
        ? d.excludedStoreIds.filter(id => id !== storeId)
        : [...d.excludedStoreIds, storeId]
    }));
  };

  const handleAddRole = (chainId: string, section: 'storeRoles' | 'stakeholderRoles') => {
    updateDraft(chainId, d => ({
      ...d,
      [section]: [...(d[section] || []), { role: '', weight: 0 }]
    }));
  };

  const handleRemoveRole = (chainId: string, section: 'storeRoles' | 'stakeholderRoles', idx: number) => {
    updateDraft(chainId, d => ({
      ...d,
      [section]: d[section].filter((_, i) => i !== idx)
    }));
  };

  const handleRoleChange = (
    chainId: string,
    section: 'storeRoles' | 'stakeholderRoles',
    idx: number,
    field: 'role' | 'weight',
    value: string
  ) => {
    updateDraft(chainId, d => {
      const updated = [...d[section]];
      updated[idx] = {
        ...updated[idx],
        [field]: field === 'weight' ? Number(value) : value
      };
      return { ...d, [section]: updated };
    });
  };

  const handleAutofill = (chainId: string, prefix: string) => {
    let storeRoles: RoleWeight[] = [];
    let stakeholderRoles: RoleWeight[] = [
      { role: 'ABM', weight: 5 },
      { role: 'ASE', weight: 5 },
      { role: 'ZSE', weight: 5 },
      { role: 'ZSM', weight: 5 },
      { role: 'KAM', weight: 5 },
    ];

    const upPrefix = prefix.toUpperCase();
    if (upPrefix.includes('CROMA')) {
      storeRoles = [
        { role: 'SEC', weight: 40 },
        { role: 'ADM', weight: 20 },
        { role: 'Store Manager', weight: 10 },
        { role: 'Cluster Manager', weight: 5 },
      ];
    } else if (upPrefix.includes('VS') || upPrefix.includes('VIJAY') || upPrefix.includes('RELIANCE') || upPrefix.includes('HITACHI') || upPrefix.includes('HAIER') || upPrefix.includes('LOCAL') || upPrefix.includes('ASP')) {
      storeRoles = [
        { role: 'SEC', weight: 40 },
        { role: 'TL', weight: 20 },
        { role: 'Store Manager', weight: 10 },
        { role: 'Category Manager', weight: 5 },
      ];
    }

    if (storeRoles.length > 0) {
      updateDraft(chainId, d => ({
        ...d,
        storeRoles,
        stakeholderRoles
      }));
    }
  };

  if (loading) {
    return (
      <div className="cc-loading">
        <div className="cc-spinner" />
        <span>Loading chain configurations...</span>
      </div>
    );
  }

  return (
    <div className="cc-container">
      {/* Header */}
      <div className="cc-header">
        <Link href="/admin/datamanagement" className="cc-back-btn">
          <ArrowLeft size={16} />
          Data Management
        </Link>
        <div className="cc-header-title">
          <Settings size={24} />
          <div>
            <h1>Store Chain Role Configuration</h1>
            <p>{configuredChains.length} chain{configuredChains.length !== 1 ? 's' : ''} configured · {unconfiguredChains.length} auto-detected</p>
          </div>
        </div>
        <button className="cc-refresh-btn" onClick={fetchData}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Unconfigured chains (auto-detected) */}
      {unconfiguredChains.length > 0 && (
        <div className="cc-unconfigured-section">
          <div className="cc-unconfigured-label">
            <AlertCircle size={16} />
            Auto-detected chains not yet configured
          </div>
          <div className="cc-unconfigured-grid">
            {unconfiguredChains.map(uc => (
              <div key={uc.prefix} className="cc-unconfigured-card">
                <div className="cc-uc-info">
                  <span className="cc-uc-prefix">{uc.prefix}</span>
                  <span className="cc-uc-count">{uc.stores.length} store{uc.stores.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="cc-uc-stores">
                  {uc.stores.slice(0, 3).map(s => (
                    <span key={s.id} className="cc-uc-store-pill">{s.storeName}</span>
                  ))}
                  {uc.stores.length > 3 && (
                    <span className="cc-uc-store-pill muted">+{uc.stores.length - 3} more</span>
                  )}
                </div>
                <button
                  className="cc-init-btn"
                  onClick={() => handleInitChain(uc.prefix)}
                  disabled={creatingChain === uc.prefix}
                >
                  <Plus size={14} />
                  {creatingChain === uc.prefix ? 'Creating...' : 'Configure Roles'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configured chains */}
      <div className="cc-chains-list">
        {configuredChains.length === 0 && unconfiguredChains.length === 0 && (
          <div className="cc-empty">
            <Store size={48} />
            <h3>No Stores Found</h3>
            <p>Add stores to the database first, then configure their role templates here.</p>
          </div>
        )}

        {configuredChains.map(chain => {
          const draft = getDraft(chain.id);
          if (!draft) return null;
          const isExpanded = expandedChain === chain.id;
          const tw = totalWeight(draft);
          const weightOk = tw === 100;
          const status = saveStatus[chain.id] || 'idle';
          const allStores = [...chain.matchedStores, ...chain.excludedStores];

          return (
            <div key={chain.id} className={`cc-chain-card ${isExpanded ? 'expanded' : ''}`}>
              {/* Chain Header */}
              <div className="cc-chain-header" onClick={() => setExpandedChain(isExpanded ? null : chain.id)}>
                <div className="cc-chain-header-left">
                  <div className="cc-chain-badge">{chain.chainName}</div>
                  <div className="cc-chain-meta-col">
                    <div className="cc-chain-meta">
                      <span className="cc-chain-stores">{chain.matchedStores.length} active store{chain.matchedStores.length !== 1 ? 's' : ''}</span>
                      {chain.excludedStores.length > 0 && (
                        <span className="cc-chain-excluded">{chain.excludedStores.length} excluded</span>
                      )}
                    </div>
                    {/* Role pills shown in collapsed state */}
                    {!isExpanded && (draft.storeRoles?.length > 0 || draft.stakeholderRoles?.length > 0) && (
                      <div className="cc-header-role-pills">
                        {draft.storeRoles?.length > 0 && (
                          <div className="cc-header-role-group">
                            <span className="cc-role-group-label">Store</span>
                            {draft.storeRoles.map(r => (
                              <span key={r.role} className="cc-role-pill store">
                                {r.role || 'Unnamed'}
                                <span className="cc-role-pill-weight">{r.weight}%</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {draft.stakeholderRoles?.length > 0 && (
                          <div className="cc-header-role-group">
                            <span className="cc-role-group-label">Stakeholder</span>
                            {draft.stakeholderRoles.map(r => (
                              <span key={r.role} className="cc-role-pill stakeholder">
                                {r.role || 'Unnamed'}
                                <span className="cc-role-pill-weight">{r.weight}%</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {!isExpanded && draft.storeRoles?.length === 0 && draft.stakeholderRoles?.length === 0 && (
                      <span className="cc-no-roles-hint">No roles configured yet — click to add</span>
                    )}
                  </div>
                </div>
                <div className="cc-chain-header-right">
                  <div className={`cc-weight-pill ${tw === 100 ? 'ok' : tw > 100 ? 'over' : 'under'}`}>
                    {tw}% / 100%
                  </div>
                  <button
                    className="cc-delete-btn"
                    onClick={e => { e.stopPropagation(); handleDeleteChain(chain.id); }}
                    title="Delete chain config"
                  >
                    <Trash2 size={14} />
                  </button>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {/* Expanded Body */}
              {isExpanded && (
                <div className="cc-chain-body">
                  <div className="cc-body-grid">
                    {/* Left: Stores Panel */}
                    <div className="cc-stores-panel">
                      <h4>Stores in Chain</h4>
                      <div className="cc-stores-list">
                        {allStores.map(store => {
                          const isExcluded = draft.excludedStoreIds.includes(store.id);
                          return (
                            <div key={store.id} className={`cc-store-row ${isExcluded ? 'excluded' : ''}`}>
                              <div className="cc-store-info">
                                <span className="cc-store-name">{store.storeName}</span>
                                <span className="cc-store-city">{store.city}</span>
                              </div>
                              <button
                                className={`cc-toggle-store-btn ${isExcluded ? 'add' : 'remove'}`}
                                onClick={() => handleToggleStoreExclusion(chain.id, store.id, isExcluded)}
                                title={isExcluded ? 'Add back to chain' : 'Remove from chain'}
                              >
                                {isExcluded ? <Plus size={12} /> : <X size={12} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Role Configuration Panel */}
                    <div className="cc-roles-panel">
                      {/* Weight indicator */}
                      <div className={`cc-weight-bar-wrap ${!weightOk ? 'warn' : ''}`}>
                        <div className="cc-weight-bar-label">
                          <span>Total Weight</span>
                          <span className={`cc-weight-total ${tw > 100 ? 'over' : tw === 100 ? 'ok' : ''}`}>
                            {tw}%
                          </span>
                        </div>
                        <div className="cc-weight-track">
                          <div
                            className={`cc-weight-fill ${tw > 100 ? 'over' : tw === 100 ? 'ok' : ''}`}
                            style={{ width: `${Math.min(tw, 100)}%` }}
                          />
                        </div>
                        {!weightOk && (
                          <div className="cc-weight-warning">
                            <AlertCircle size={12} />
                            Weights must total exactly 100% to save.
                            {tw > 100 ? ` Remove ${tw - 100}%.` : ` Add ${100 - tw}% more.`}
                          </div>
                        )}
                      </div>

                      {/* Autofill Suggester */}
                      {draft.storeRoles?.length === 0 && (
                        <div className="cc-autofill-prompt">
                          <p>Suggested roles for <strong>{chain.chainName}</strong> are available.</p>
                          <button 
                            className="cc-autofill-btn"
                            onClick={() => handleAutofill(chain.id, chain.prefix)}
                          >
                            <Settings size={14} />
                            Apply Suggested Roles
                          </button>
                        </div>
                      )}

                      {/* Store Level Roles */}
                      <div className="cc-role-section">
                        <div className="cc-role-section-header">
                          <h5>Store Level Roles</h5>
                        </div>
                        <div className="cc-role-table">
                          <div className="cc-role-table-head">
                            <span>Role Name</span>
                            <span>Weight %</span>
                            <span></span>
                          </div>
                          {(draft.storeRoles || []).map((r, idx) => (
                            <div key={idx} className="cc-role-row">
                              <input
                                type="text"
                                className="cc-role-input"
                                placeholder="e.g. SEC"
                                value={r.role}
                                onChange={e => handleRoleChange(chain.id, 'storeRoles', idx, 'role', e.target.value)}
                              />
                              <input
                                type="number"
                                className="cc-weight-input"
                                placeholder="0"
                                min={0}
                                max={100}
                                value={r.weight}
                                onChange={e => handleRoleChange(chain.id, 'storeRoles', idx, 'weight', e.target.value)}
                              />
                              <button
                                className="cc-remove-role-btn"
                                onClick={() => handleRemoveRole(chain.id, 'storeRoles', idx)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                          <button
                            className="cc-add-role-btn"
                            onClick={() => handleAddRole(chain.id, 'storeRoles')}
                          >
                            <Plus size={13} /> Add Store Role
                          </button>
                        </div>
                      </div>

                      {/* Stakeholder Level Roles */}
                      <div className="cc-role-section">
                        <div className="cc-role-section-header">
                          <h5>Stakeholder Roles</h5>
                        </div>
                        <div className="cc-role-table">
                          <div className="cc-role-table-head">
                            <span>Role Name</span>
                            <span>Weight %</span>
                            <span></span>
                          </div>
                          {(draft.stakeholderRoles || []).map((r, idx) => (
                            <div key={idx} className="cc-role-row">
                              <input
                                type="text"
                                className="cc-role-input"
                                placeholder="e.g. ABM"
                                value={r.role}
                                onChange={e => handleRoleChange(chain.id, 'stakeholderRoles', idx, 'role', e.target.value)}
                              />
                              <input
                                type="number"
                                className="cc-weight-input"
                                placeholder="0"
                                min={0}
                                max={100}
                                value={r.weight}
                                onChange={e => handleRoleChange(chain.id, 'stakeholderRoles', idx, 'weight', e.target.value)}
                              />
                              <button
                                className="cc-remove-role-btn"
                                onClick={() => handleRemoveRole(chain.id, 'stakeholderRoles', idx)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                          <button
                            className="cc-add-role-btn"
                            onClick={() => handleAddRole(chain.id, 'stakeholderRoles')}
                          >
                            <Plus size={13} /> Add Stakeholder Role
                          </button>
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="cc-save-row">
                        {status === 'error' && !weightOk && (
                          <span className="cc-save-error">
                            <AlertCircle size={14} /> Total weight must equal 100%
                          </span>
                        )}
                        {status === 'error' && weightOk && (
                          <span className="cc-save-error">
                            <AlertCircle size={14} /> Failed to save. Try again.
                          </span>
                        )}
                        {status === 'success' && (
                          <span className="cc-save-success">
                            <CheckCircle2 size={14} /> Saved successfully!
                          </span>
                        )}
                        <button
                          className={`cc-save-btn ${!weightOk ? 'disabled' : ''}`}
                          onClick={() => handleSaveChain(chain.id)}
                          disabled={savingChain === chain.id || !weightOk}
                        >
                          <Save size={15} />
                          {savingChain === chain.id ? 'Saving...' : 'Save Chain Config'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChainConfigPage;
