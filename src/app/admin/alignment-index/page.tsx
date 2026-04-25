'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Home, Navigation, Hexagon, Building2, X, ChevronRight, AlertCircle, ArrowLeft, Phone, CheckCircle2, XCircle, Users, UserCheck } from 'lucide-react';
import './alignment-index.css';
import { IndiaMap } from './IndiaMap';

// The rest of the file uses dynamic data fetched from /api/admin/alignment

// The dynamic stateData is now calculated from the live API response.

const getStateColor = (score: number | undefined, solid: boolean = false) => {
    const alpha = solid ? '1' : '0.85';
    if (score === undefined) return `rgba(255, 255, 255, ${solid ? '0.2' : '0.05'})`;
    if (score >= 80) return `rgba(34, 197, 94, ${alpha})`;
    if (score >= 50) return `rgba(234, 179, 8, ${alpha})`;
    return `rgba(239, 68, 68, ${alpha})`;
};

// ─── Store Detail Inner View ──────────────────────────────────────────────────
const StoreDetailView = ({ store, onBack }: { store: any; onBack: () => void }) => {
    const [activeTab, setActiveTab] = useState<'store' | 'stakeholder'>('store');

    // Alignment logic for the new DB-backed JSON structure
    const allStoreAligned = store.storeLevel.length > 0 && store.storeLevel.every((entry: any) => entry.personnel && entry.personnel.length > 0);
    const allStakeholderAligned = store.stakeholderLevel.length > 0 && store.stakeholderLevel.every((entry: any) => entry.personnel && entry.personnel.length > 0);

    return (
        <div className="store-detail-view">
            {/* Back button + store identity */}
            <div className="sd-header">
                <button className="sd-back-btn" onClick={onBack}>
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </button>
                <div className="sd-title-block">
                    <div className="sd-store-icon">
                        <Building2 size={18} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 className="sd-store-name">{store.name}</h2>
                            <span className={`sd-type-badge ${store.storeType === 'Croma' ? 'croma' : store.storeType === 'Vijay Sales' ? 'vijay-sales' : 'reliance'}`}>
                                {store.storeType}
                            </span>
                        </div>
                        <span className="sd-store-code">{store.code} &nbsp;·&nbsp; {store.city}</span>
                    </div>
                    <div className={`sd-score-pill ${store.alignment}`}>{store.score}%</div>
                </div>
            </div>

            {/* Tab switcher */}
            <div className="sd-tab-bar">
                <button
                    className={`sd-tab ${activeTab === 'store' ? 'active' : ''}`}
                    onClick={() => setActiveTab('store')}
                >
                    <Users size={14} />
                    Store Level
                </button>
                <button
                    className={`sd-tab ${activeTab === 'stakeholder' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stakeholder')}
                >
                    <UserCheck size={14} />
                    Stakeholder
                </button>
            </div>

            {/* Tab content */}
            <div className="sd-tab-content">
                {activeTab === 'store' && (
                    <div className="sd-section">
                        <div className="sd-section-label">
                            <span>STORE LEVEL ALIGNMENT</span>
                            <span className={`sd-overall-badge ${allStoreAligned ? 'aligned' : 'misaligned'}`}>
                                {allStoreAligned ? 'Fully Aligned' : 'Gaps Found'}
                            </span>
                        </div>
                        <div className="sd-role-table">
                            <div className="sd-table-header">
                                <span>Role</span>
                                <span>Name</span>
                            </div>
                            {store.storeLevel.map((entry: any, idx: number) => {
                                const isAligned = entry.personnel && entry.personnel.length > 0;
                                return (
                                    <div key={idx} className={`sd-table-row-group ${isAligned ? 'aligned' : 'misaligned'}`}>
                                        <div className="sd-table-row header-row">
                                            <span className="sd-role-tag">{entry.role}</span>
                                            <span className="sd-person-count">
                                                {isAligned ? `${entry.personnel.length} Assigned` : 'Vacant'}
                                            </span>
                                            <span className={`sd-status-chip ${isAligned ? 'aligned' : 'misaligned'}`}>
                                                {isAligned
                                                    ? <><CheckCircle2 size={12} /> Aligned</>
                                                    : <><XCircle size={12} /> Gap Found</>
                                                }
                                            </span>
                                            <span className="sd-role-filler"></span>
                                        </div>
                                        {entry.personnel && entry.personnel.map((p: any, pIdx: number) => (
                                            <div key={pIdx} className="sd-table-row detail-row">
                                                <span className="sd-role-indent"></span>
                                                <span className="sd-person-name">{p.name || 'Anonymous'}</span>
                                                <span className="sd-person-status-dot"></span>
                                                <a href={`tel:${p.phone}`} className="sd-phone">
                                                    <Phone size={12} />
                                                    {p.phone || 'N/A'}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'stakeholder' && (
                    <div className="sd-section">
                        <div className="sd-section-label">
                            <span>STAKEHOLDER ALIGNMENT</span>
                            <span className={`sd-overall-badge ${allStakeholderAligned ? 'aligned' : 'misaligned'}`}>
                                {allStakeholderAligned ? 'Fully Aligned' : 'Gaps Found'}
                            </span>
                        </div>
                        <div className="sd-role-table">
                            <div className="sd-table-header">
                                <span>Role</span>
                                <span>Name</span>
                            </div>
                            {store.stakeholderLevel.map((entry: any, idx: number) => {
                                const isAligned = entry.personnel && entry.personnel.length > 0;
                                return (
                                    <div key={idx} className={`sd-table-row-group ${isAligned ? 'aligned' : 'misaligned'}`}>
                                        <div className="sd-table-row header-row">
                                            <span className="sd-role-tag">{entry.role}</span>
                                            <span className="sd-person-count">
                                                {isAligned ? `${entry.personnel.length} Assigned` : 'Vacant'}
                                            </span>
                                            <span className={`sd-status-chip ${isAligned ? 'aligned' : 'misaligned'}`}>
                                                {isAligned
                                                    ? <><CheckCircle2 size={12} /> Aligned</>
                                                    : <><XCircle size={12} /> Gap Found</>
                                                }
                                            </span>
                                            <span className="sd-role-filler"></span>
                                        </div>
                                        {entry.personnel && entry.personnel.map((p: any, pIdx: number) => (
                                            <div key={pIdx} className="sd-table-row detail-row">
                                                <span className="sd-role-indent"></span>
                                                <span className="sd-person-name">{p.name || 'Anonymous'}</span>
                                                <span className="sd-person-status-dot"></span>
                                                <a href={`tel:${p.phone}`} className="sd-phone">
                                                    <Phone size={12} />
                                                    {p.phone || 'N/A'}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AlignmentIndexPage = () => {
    const [stores, setStores] = useState<any[]>([]);
    const [drilldownStores, setDrilldownStores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [selectedStore, setSelectedStore] = useState<any | null>(null);
    const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });
    const [hoveredState, setHoveredState] = useState<{ id: string; name: string; x: number; y: number } | null>(null);
    const [drilldownState, setDrilldownState] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [detailStore, setDetailStore] = useState<any | null>(null);
    const mapRef = useRef<SVGSVGElement>(null);

    // Load Live Data from DB
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const response = await fetch('/api/admin/alignment');
                const json = await response.json();
                if (json.success) {
                    setStores(json.data);
                }
            } catch (error) {
                console.error('Error fetching alignment data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    // Derived Metrics from Live Data
    const topMetrics = {
        coverage: stores.length > 0 ? Math.round(stores.reduce((acc, s) => acc + s.score, 0) / stores.length) : 0,
        critical: stores.filter(s => s.score < 50).length,
        optimal: stores.filter(s => s.score >= 80).length,
    };

    // Real state-level aggregation based on fetched DB store data
    const stateData = React.useMemo(() => {
        const aggregated: Record<string, {name: string, score?: number, stores: number, critical: number, missingRoles: number, _totalScore: number}> = {};
        
        // Define all state names mapping to their SVG IDs
        const nameToId: Record<string, string> = {
            'delhi': 'IN-DL', 'maharashtra': 'IN-MH', 'karnataka': 'IN-KA', 'tamil nadu': 'IN-TN', 
            'west bengal': 'IN-WB', 'telangana': 'IN-TG', 'gujarat': 'IN-GJ', 'rajasthan': 'IN-RJ', 
            'uttar pradesh': 'IN-UP', 'jammu and kashmir': 'IN-JK', 'assam': 'IN-AS', 
            'madhya pradesh': 'IN-MP', 'andhra pradesh': 'IN-AP', 'kerala': 'IN-KL', 'bihar': 'IN-BR', 
            'odisha': 'IN-OR', 'haryana': 'IN-HR', 'punjab': 'IN-PB', 'jharkhand': 'IN-JH', 
            'chhattisgarh': 'IN-CT', 'himachal pradesh': 'IN-HP', 'uttarakhand': 'IN-UT', 
            'arunachal pradesh': 'IN-AR', 'goa': 'IN-GA', 'sikkim': 'IN-SK', 'puducherry': 'IN-PY', 
            'chandigarh': 'IN-CH', 'lakshadweep': 'IN-LD', 'andaman and nicobar': 'IN-AN', 
            'dadra and nagar haveli': 'IN-DN', 'daman and diu': 'IN-DD', 'meghalaya': 'IN-ML', 
            'manipur': 'IN-MN', 'mizoram': 'IN-MZ', 'nagaland': 'IN-NL', 'tripura': 'IN-TR'
        };

        const idToName: Record<string, string> = {};
        Object.entries(nameToId).forEach(([name, id]) => { 
            idToName[id] = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); 
        });

        // Initialize all state ids
        Object.keys(idToName).forEach(id => {
            aggregated[id] = { name: idToName[id], stores: 0, critical: 0, missingRoles: 0, _totalScore: 0 };
        });

        stores.forEach(store => {
            const stateKey = store.state?.toLowerCase();
            const stateId = nameToId[stateKey];
            if (stateId && aggregated[stateId]) {
                const target = aggregated[stateId];
                target.stores += 1;
                target._totalScore += store.score || 0;
                if (store.score < 50) target.critical += 1;
                if (store.score < 100) target.missingRoles += 1; 
            }
        });

        Object.values(aggregated).forEach(target => {
            if (target.stores > 0) {
                target.score = Math.round(target._totalScore / target.stores);
            }
            delete (target as any)._totalScore;
        });

        return aggregated;
    }, [stores]);

    const stateColorMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        Object.entries(stateData).forEach(([id, data]) => {
            map[id] = getStateColor(data.score);
        });
        return map;
    }, [stateData]);

    useEffect(() => {
        if (selectedStore) {
            const targetScale = 2.5;
            const translateX = 350 - (selectedStore.x * targetScale);
            const translateY = 450 - (selectedStore.y * targetScale);
            setViewState({ scale: targetScale, x: translateX, y: translateY });
        } else {
            setViewState({ scale: 1, x: 0, y: 0 });
        }
    }, [selectedStore]);

    const handleZoomIn = () => setViewState(prev => {
        const newScale = Math.min(prev.scale + 0.1, 5);
        const ratio = newScale / prev.scale;
        return {
            scale: newScale,
            x: 350 - (350 - prev.x) * ratio,
            y: 450 - (450 - prev.y) * ratio
        };
    });
    const handleZoomOut = () => setViewState(prev => {
        const newScale = Math.max(prev.scale - 0.1, 0.5);
        const ratio = newScale / prev.scale;
        return {
            scale: newScale,
            x: 350 - (350 - prev.x) * ratio,
            y: 450 - (450 - prev.y) * ratio
        };
    });
    const handleReset = () => setSelectedStore(null);
    const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setDragStart({ x: e.clientX - viewState.x, y: e.clientY - viewState.y }); };
    const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging) return; setViewState(prev => ({ ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })); };
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);
    const handleStateHover = (id: string, name: string, e: React.MouseEvent) => {
        if (!id) { setHoveredState(null); return; }
        setHoveredState({ id, name, x: e.clientX, y: e.clientY });
    };
    const handleStateClick = async (id: string) => {
        setDrilldownState(id);
        setDetailStore(null);
        setDrilldownLoading(true);

        const stateName = stateData[id]?.name;
        if (stateName) {
            try {
                const response = await fetch(`/api/admin/alignment?state=${encodeURIComponent(stateName)}`);
                const json = await response.json();
                if (json.success) {
                    setDrilldownStores(json.data);
                }
            } catch (error) {
                console.error('Error fetching state data:', error);
            }
        }
        setDrilldownLoading(false);
    };

    const handleMarkerClick = async (store: any) => {
        setSelectedStore(store);

        // If we don't have alignment data for this store, fetch it by fetching its state
        if (!store.storeLevel && store.state) {
            try {
                const response = await fetch(`/api/admin/alignment?state=${encodeURIComponent(store.state)}`);
                const json = await response.json();
                if (json.success) {
                    setDrilldownStores(json.data);
                    const fullStore = json.data.find((s: any) => s.id === store.id);
                    if (fullStore) {
                        setSelectedStore(fullStore);
                    }
                }
            } catch (error) {
                console.error('Error fetching store detail data:', error);
            }
        }
    };

    const handleCloseDrilldown = () => {
        setDrilldownState(null);
        setDetailStore(null);
        setDrilldownStores([]);
    };

    return (
        <div 
            className="alignment-index-container"
            style={{
                paddingRight: (drilldownState || detailStore) ? 'min(420px, 30%)' : undefined,
                transition: 'padding-right 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
        >
            <div className="bg-grid"></div>
            <div className="bg-glow-center"></div>

            {/* Header */}
            <div className="hud-header">
                <div className="header-frame">
                    <div className="header-content">
                        <div className="icon-box">
                            <Hexagon className="header-icon-hex" />
                            <Navigation className="header-icon-nav" />
                        </div>
                        <div>
                            <h1 className="hud-title">EXECUTIVE ALIGNMENT <span className="highlight">MATRIX</span></h1>
                            <p className="hud-subtitle">GEO-SPATIAL INTELLIGENCE DASHBOARD</p>
                        </div>
                    </div>
                    <div className="hud-stats-panel">
                        <div className="stat-bloc">
                            <span className="stat-val">{topMetrics.coverage}%</span>
                            <span className="stat-lbl">COVERAGE</span>
                        </div>
                        <div className="stat-separator"></div>
                        <div className="stat-bloc">
                            <span className="stat-val text-alert">{topMetrics.critical}</span>
                            <span className="stat-lbl">CRITICAL</span>
                        </div>
                        <div className="stat-separator"></div>
                        <div className="stat-bloc">
                            <span className="stat-val text-success">{topMetrics.optimal}</span>
                            <span className="stat-lbl">OPTIMAL</span>
                        </div>
                    </div>
                </div>
                <div className="hud-sub-header">
                    <div className="view-toggle">
                        <button className={`cy-toggle-btn ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>MAP VIEW</button>
                        <button className={`cy-toggle-btn ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>ALL VIEW</button>
                    </div>
                    <div className="hud-legend">
                        <div className="legend-entry"><span className="marker-preview high"></span><span>OPTIMAL</span></div>
                        <div className="legend-entry"><span className="marker-preview medium"></span><span>MODERATE</span></div>
                        <div className="legend-entry"><span className="marker-preview low"></span><span>CRITICAL</span></div>
                    </div>
                </div>
            </div>

            {/* Content View */}
            {viewMode === 'map' ? (
                <>
                    {/* Map */}
                    <div className="hud-map-frame">
                <div className="hud-controls">
                    <button className="hud-btn" onClick={handleReset} title="Reset View"><Home size={18} /></button>
                    <div className="zoom-stack">
                        <button className="hud-btn" onClick={handleZoomIn} title="Zoom In"><ZoomIn size={18} /></button>
                        <button className="hud-btn" onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={18} /></button>
                    </div>
                </div>

                <div
                    className="map-viewport"
                    style={{ cursor: isDragging ? 'grabbing' : 'grab', overflow: 'hidden' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                >
                    <IndiaMap
                        ref={mapRef}
                        viewBox="-50 -50 750 950"
                        className="interactive-map-svg"
                        stateColors={stateColorMap}
                        onStateHover={handleStateHover}
                        onStateClick={handleStateClick}
                        style={{
                            transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
                            transition: isDragging ? 'none' : 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)'
                        }}
                    >
                        <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="1" />
                        </pattern>
                        <rect width="650" height="850" fill="url(#gridPattern)" opacity="0.1" pointerEvents="none" />

                        {stores.map((store) => (
                            <g
                                key={store.id}
                                className={`map-marker-group ${selectedStore?.id === store.id ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); handleMarkerClick(store); }}
                                style={{ cursor: 'pointer' }}
                            >
                                <circle cx={store.x} cy={store.y} r="6" className={`marker-dot ${store.alignment}`} />
                                <text
                                    x={store.x} y={store.y + 15}
                                    textAnchor="middle"
                                    className="marker-label-hud"
                                    style={{
                                        opacity: viewState.scale > 1.8 || selectedStore?.id === store.id ? 1 : 0,
                                        fontSize: `${12 / viewState.scale}px`
                                    }}
                                >{store.city}</text>
                            </g>
                        ))}
                    </IndiaMap>

                    {/* Hologram Popup */}
                    {selectedStore && (
                        <div className="hologram-popup">
                            <div className="hologram-header">
                                <Building2 className="hologram-icon" />
                                <div className="hologram-title">
                                    <h3>{selectedStore.name}</h3>
                                    <span className="hologram-id">ID: {selectedStore.id.toString().padStart(4, '0')}</span>
                                </div>
                                <button className="hologram-close" onClick={handleReset}>&times;</button>
                            </div>
                            <div className="hologram-grid">
                                <div className="hologram-stat">
                                    <span className="h-label">EXECUTIVES</span>
                                    <span className="h-value">{selectedStore.executives}</span>
                                </div>
                                <div className="hologram-stat">
                                    <span className="h-label">STATUS</span>
                                    <span className={`h-badge ${selectedStore.alignment}`}>{selectedStore.alignment.toUpperCase()}</span>
                                </div>
                                {selectedStore.storeLevel.slice(0, 3).map((entry: any, idx: number) => (
                                    <div key={idx} className="role-row">
                                        <span className="role-lbl">{entry.role}</span>
                                        <span className="role-sts" style={{ color: (entry.personnel && entry.personnel.length > 0) ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                                            {(entry.personnel && entry.personnel.length > 0) ? 'ALIGNED' : 'GAP'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="hologram-footer">
                                <div className="scan-line"></div>
                                <button className="cyber-btn" onClick={() => setSelectedStore(null)}>CLOSE TERMINAL</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Hover Tooltip */}
            {hoveredState && stateData[hoveredState.id] && viewMode === 'map' && (
                <div className="state-tooltip" style={{ left: `${hoveredState.x + 15}px`, top: `${hoveredState.y + 15}px` }}>
                    <div className="tooltip-header">
                        <span className="tooltip-title">{hoveredState.name}</span>
                        <div className="tooltip-score-badge" style={{ backgroundColor: getStateColor(stateData[hoveredState.id].score, true) }}>
                            {stateData[hoveredState.id].score !== undefined ? `${stateData[hoveredState.id].score}%` : 'N/A'}
                        </div>
                    </div>
                    <div className="tooltip-body">
                        <div className="tooltip-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Stores:</span>
                            <strong style={{ color: '#fff' }}>{stateData[hoveredState.id].stores}</strong>
                        </div>
                        <div className="tooltip-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Critical:</span>
                            <span className="text-alert" style={{ fontWeight: 'bold' }}>{stateData[hoveredState.id].critical}</span>
                        </div>
                        <div className="tooltip-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className="text-warning" style={{ fontWeight: 'bold' }}>{stateData[hoveredState.id].missingRoles} Gap Stores</span>
                        </div>
                    </div>
                </div>
            )}
            </>
            ) : null}

            {viewMode === 'all' && (
                <div className="all-view-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: '1px solid rgba(34, 211, 238, 0.2)', minHeight: 0 }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid rgba(34, 211, 238, 0.2)' }}>
                        <input
                            type="text"
                            placeholder="SEARCH BY STORE NAME, CODE, OR CITY..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid var(--neon-cyan)',
                                color: '#fff',
                                outline: 'none',
                                borderRadius: '4px',
                                fontSize: '14px',
                                letterSpacing: '1px',
                                textTransform: 'uppercase'
                            }}
                        />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {(() => {
                        // If actively searching, show store cards
                        if (searchQuery) {
                            const filteredStores = stores.filter(s => 
                                s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                s.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                s.city?.toLowerCase().includes(searchQuery.toLowerCase())
                            );

                            if (filteredStores.length === 0) {
                                return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--hud-text-dim)', letterSpacing: '1px' }}>NO STORES FOUND MATCHING SCAN CRITERIA.</div>;
                            }

                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                                    {filteredStores.map(store => (
                                        <div key={store.id} className="store-list-item" style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
                                            <div className="store-info" style={{ marginBottom: '12px' }}>
                                                <span className="store-name" style={{ display: 'block', fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{store.name}</span>
                                                <span className="store-code" style={{ color: 'var(--neon-blue)', fontSize: '12px' }}>{store.code} &nbsp;·&nbsp; {store.city} &nbsp;·&nbsp; {store.state}</span>
                                            </div>
                                            <div className="store-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div className={`mini-score ${store.alignment}`} style={{ fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: 'rgba(0,0,0,0.2)' }}>{store.score}%</div>
                                                <button
                                                    className="view-details-btn cyber-btn"
                                                    style={{ padding: '4px 12px', fontSize: '11px', width: 'auto' }}
                                                    onClick={async () => {
                                                        setDetailStore(null); // Reset first for safety
                                                        if (!store.storeLevel && store.state) {
                                                            try {
                                                                const res = await fetch(`/api/admin/alignment?state=${encodeURIComponent(store.state)}`);
                                                                const json = await res.json();
                                                                if(json.success) {
                                                                    const fullStore = json.data.find((s: any) => s.id === store.id);
                                                                    setDetailStore(fullStore || store);
                                                                } else {
                                                                    setDetailStore(store);
                                                                }
                                                            } catch(e) { setDetailStore(store); }
                                                        } else {
                                                            setDetailStore(store);
                                                        }
                                                    }}
                                                >
                                                    DETAILS
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        }

                        // Default State Tiles view
                        const activeStates = Object.entries(stateData)
                            .filter(([id, data]) => data.stores > 0)
                            .sort((a, b) => a[1].name.localeCompare(b[1].name));

                        return (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                {activeStates.map(([id, data]) => (
                                    <div 
                                        key={id} 
                                        className="state-tile cyber-btn" 
                                        style={{ 
                                            background: 'rgba(30, 41, 59, 0.5)', 
                                            border: '1px solid rgba(34, 211, 238, 0.4)', 
                                            padding: '24px', 
                                            borderRadius: '8px', 
                                            cursor: 'pointer', 
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            textAlign: 'left',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                        onClick={() => handleStateClick(id)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', letterSpacing: '1px', textTransform: 'uppercase' }}>{data.name}</h3>
                                            <div style={{ 
                                                padding: '4px 10px', 
                                                borderRadius: '4px', 
                                                fontSize: '14px', 
                                                fontWeight: 'bold', 
                                                color: '#000',
                                                background: getStateColor(data.score, true),
                                                boxShadow: `0 0 10px ${getStateColor(data.score, true)}`
                                            }}>
                                                {data.score !== undefined ? `${data.score}%` : 'N/A'}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hud-text-dim)', fontSize: '12px' }}>
                                            <span><strong style={{ color: '#fff' }}>{data.stores}</strong> Total Stores</span>
                                            {data.missingRoles !== undefined && data.missingRoles > 0 && <span className="text-warning">{data.missingRoles} Gap{data.missingRoles > 1 ? 's' : ''}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                    </div>
                </div>
            )}

            {/* Sliding Drilldown Panel */}
            <div className={`drilldown-panel ${(drilldownState || detailStore) ? 'open' : ''}`}>
                {(drilldownState || detailStore) && (
                    <div className="panel-content">
                        {/* ── Store Detail View (when Details is clicked) ── */}
                        {detailStore ? (
                            <StoreDetailView store={detailStore} onBack={() => {
                                setDetailStore(null);
                                if (!drilldownState) handleCloseDrilldown();
                            }} />
                        ) : drilldownState ? (
                            /* ── State Drilldown View ── */
                            <>
                                <div className="panel-header">
                                    <div>
                                        <h2 className="panel-title">{stateData[drilldownState]?.name || 'State Detail'}</h2>
                                        <p className="panel-subtitle">Regional Alignment Intelligence</p>
                                    </div>
                                    <button className="panel-close-btn" onClick={handleCloseDrilldown}>
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="panel-scroll-area">
                                    {drilldownLoading ? (
                                        <div className="panel-loading">
                                            <div className="loader"></div>
                                            <p>Scanning regional data...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="summary-section">
                                                <div className="overview-card">
                                                    <div className="card-top">
                                                        <div className="radial-chart">
                                                            <svg viewBox="0 0 36 36" className="circular-chart">
                                                                <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                                <path className="circle"
                                                                    strokeDasharray={`${stateData[drilldownState]?.score || 0}, 100`}
                                                                    style={{ stroke: getStateColor(stateData[drilldownState]?.score, true) }}
                                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                                />
                                                                <text x="18" y="20.35" className="percentage">{stateData[drilldownState]?.score !== undefined ? `${stateData[drilldownState].score}%` : 'N/A'}</text>
                                                            </svg>
                                                        </div>
                                                        <div className="quick-stats">
                                                            <div className="q-stat">
                                                                <span className="q-lbl">TOTAL STORES</span>
                                                                <span className="q-val">{stateData[drilldownState]?.stores}</span>
                                                            </div>
                                                            <div className="q-stat">
                                                                <span className="q-lbl">CRITICAL</span>
                                                                <span className="q-val text-alert">{stateData[drilldownState]?.critical}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="card-footer">
                                                        <div className="missing-roles-box">
                                                            <AlertCircle size={14} className="text-warning" />
                                                            <span>{stateData[drilldownState]?.missingRoles} Gap stores in region</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="drilldown-data">
                                                <h3 className="section-heading">City-wise Breakdown</h3>
                                                {Array.from(new Set(drilldownStores.map(s => s.city))).map(city => (
                                                    <div key={city} className="city-accordion open">
                                                        <div className="accordion-trigger">
                                                            <div className="trigger-left">
                                                                <Navigation size={14} className="text-blue" />
                                                                <span>{city}</span>
                                                            </div>
                                                            <ChevronRight size={16} className="chevron" />
                                                        </div>
                                                        <div className="accordion-content">
                                                            {drilldownStores
                                                                .filter(s => s.city === city)
                                                                .map(store => (
                                                                    <div key={store.id} className="store-list-item">
                                                                        <div className="store-info">
                                                                            <span className="store-name">{store.name}</span>
                                                                            <span className="store-code">{store.code}</span>
                                                                        </div>
                                                                        <div className="store-actions">
                                                                            <div className={`mini-score ${store.alignment}`}>{store.score}%</div>
                                                                            <button
                                                                                className="view-details-btn"
                                                                                onClick={() => setDetailStore(store)}
                                                                            >
                                                                                Details
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            }
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlignmentIndexPage;
