'use client';

import React, { useState, useEffect, useCallback } from 'react';
import './SuggestPJP.css';
import UpdateCoordinatesModal from './UpdateCoordinatesModal';

interface PersonMet {
    name: string;
    designation?: string;
    phoneNumber?: string;
}

interface LastVisit {
    personMet: PersonMet[];
    remarks: string | null;
    imageUrls: string[];
    visitDate: string;
    POSMchecked: boolean | null;
}

interface SuggestedStore {
    id: string;
    storeName: string;
    city: string;
    fullAddress: string | null;
    latitude: number;
    longitude: number;
    partnerBrands: string[];
    partnerBrandTypes: string[];
    distanceFromStart: number;
    lastVisitDate: string | null;
    visited: string;
    wasInLastPJP: boolean;
    lastPJPDate: string | null;
    lastVisit: LastVisit | null;
}

interface StoreOption {
    id: string;
    storeName: string;
    city: string;
    visited: string;
    lastVisitDate: string | null;
    wasInLastPJP?: boolean;
    lastPJPDate?: string | null;
}

interface SuggestPJPProps {
    allStores: StoreOption[];
    onClose: () => void;
    onSubmit: (storeIds: string[], plannedVisitDate: string) => Promise<void>;
    submitting: boolean;
}

const SuggestPJP: React.FC<SuggestPJPProps> = ({ allStores, onClose, onSubmit, submitting }) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [startStore, setStartStore] = useState<StoreOption | null>(null);
    const [startStoreCoords, setStartStoreCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [routeDistances, setRouteDistances] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestedRoute, setSuggestedRoute] = useState<SuggestedStore[]>([]);
    const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());
    const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());
    const [plannedVisitDate, setPlannedVisitDate] = useState<string>('');
    const [addMoreOpen, setAddMoreOpen] = useState(false);
    const [addMoreSearch, setAddMoreSearch] = useState('');

    const [coordModalStore, setCoordModalStore] = useState<{ id: string; storeName: string; city: string; lat?: number | null; lng?: number | null; index: number | 'start' } | null>(null);

    const handleCoordsSuccess = (storeId: string, lat: number, lng: number, index: number | 'start') => {
        if (index === 'start') {
            setStartStoreCoords({ lat, lng });
        } else {
            setSuggestedRoute(prev => {
                const arr = [...prev];
                arr[index] = { ...arr[index], latitude: lat, longitude: lng };
                return arr;
            });
        }
    };

    const handleFixCoords = (storeInfo: { id: string; storeName: string; city: string; lat: number | null; lng: number | null; index: number | 'start' }) => {
        setCoordModalStore(storeInfo);
    };

    // Initialize date
    useEffect(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        setPlannedVisitDate(`${y}-${m}-${d}`);
    }, []);

    const filteredStores = allStores.filter(s =>
        s.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.city.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectStartStore = async (store: StoreOption) => {
        setStartStore(store);
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/executive/suggest-pjp?startStoreId=${store.id}`, {
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to fetch suggestions');
            }
            if (data.data.startStore && data.data.startStore.latitude !== null && data.data.startStore.latitude !== undefined) {
                setStartStoreCoords({ lat: data.data.startStore.latitude, lng: data.data.startStore.longitude });
            }
            setSuggestedRoute(data.data.route);
            setStep(2);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch suggestions');
        } finally {
            setLoading(false);
        }
    };

    const toggleHistory = (storeId: string) => {
        setExpandedHistory(prev => {
            const next = new Set(prev);
            if (next.has(storeId)) next.delete(storeId);
            else next.add(storeId);
            return next;
        });
    };

    const toggleImages = (storeId: string) => {
        setExpandedImages(prev => {
            const next = new Set(prev);
            if (next.has(storeId)) next.delete(storeId);
            else next.add(storeId);
            return next;
        });
    };

    const moveUp = (index: number) => {
        if (index === 0) return;
        setSuggestedRoute(prev => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    };

    const moveDown = (index: number) => {
        if (index === suggestedRoute.length - 1) return;
        setSuggestedRoute(prev => {
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
        });
    };

    const removeStore = (storeId: string) => {
        setSuggestedRoute(prev => prev.filter(s => s.id !== storeId));
    };

    // Stores not in route (for "add more")
    const routeIds = new Set(suggestedRoute.map(s => s.id));
    const storesNotInRoute = allStores.filter(
        s => !routeIds.has(s.id) && s.id !== startStore?.id
    ).filter(s =>
        s.storeName.toLowerCase().includes(addMoreSearch.toLowerCase()) ||
        s.city.toLowerCase().includes(addMoreSearch.toLowerCase())
    );

    const addStoreToRoute = (store: StoreOption) => {
        const newEntry: SuggestedStore = {
            id: store.id,
            storeName: store.storeName,
            city: store.city,
            fullAddress: null,
            latitude: 0,
            longitude: 0,
            partnerBrands: [],
            partnerBrandTypes: [],
            distanceFromStart: 0,
            lastVisitDate: store.lastVisitDate,
            visited: store.visited,
            wasInLastPJP: false,
            lastPJPDate: null,
            lastVisit: null
        };
        setSuggestedRoute(prev => [...prev, newEntry]);
        setAddMoreOpen(false);
        setAddMoreSearch('');
    };

    const handleSubmit = async () => {
        if (!startStore) return;
        const storeIds = [startStore.id, ...suggestedRoute.map(s => s.id)];
        await onSubmit(storeIds, plannedVisitDate);
    };

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const todayLocal = (() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    })();

    const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
    };

    useEffect(() => {
        let active = true;
        (async () => {
            if (!startStoreCoords || suggestedRoute.length === 0) {
                if (active) setRouteDistances([]);
                return;
            }

            const points = [
                { lat: startStoreCoords.lat, lng: startStoreCoords.lng },
                ...suggestedRoute.map(s => ({ lat: s.latitude, lng: s.longitude }))
            ];

            const origins = points.slice(0, -1);
            const destinations = points.slice(1);
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

            const distances = await Promise.all(origins.map(async (orig, i) => {
                const dest = destinations[i];
                const fallback = haversineDistance(orig.lat, orig.lng, dest.lat, dest.lng);
                if (!apiKey) return fallback;

                try {
                    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${orig.lat},${orig.lng}&destinations=${dest.lat},${dest.lng}&key=${apiKey}`);
                    const data = await res.json();
                    if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
                        return Math.round((data.rows[0].elements[0].distance.value / 1000) * 10) / 10;
                    }
                    return fallback;
                } catch (e) {
                    return fallback;
                }
            }));

            if (active) {
                setRouteDistances(distances);
            }
        })();
        return () => { active = false; };
    }, [suggestedRoute, startStoreCoords]);

    const getDistance = (index: number) => {
        return routeDistances[index] || 0;
    };

    // ─── Step 1: Start Store Picker ───────────    // ─── Render Helper ────────────────────────────────────────────────────────
    const renderStep = () => {
        // ─── Step 1: Start Store Picker ──────────────────────────────────────────
        if (step === 1) {
            return (
                <div className="spjp-overlay" onClick={onClose}>
                    <div className="spjp-step1-modal" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="spjp-step1-header">
                            <div>
                                <h2 className="spjp-step1-title">✨ Suggest PJP</h2>
                                <p className="spjp-step1-subtitle">Select a store to start your route from</p>
                            </div>
                            <button className="spjp-close-btn" onClick={onClose}>✕</button>
                        </div>

                        {/* Search */}
                        <div className="spjp-search-container">
                            <span className="spjp-search-icon">🔍</span>
                            <input
                                className="spjp-search-input"
                                type="text"
                                placeholder="Search store name or city..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="spjp-error-banner">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Loading overlay */}
                        {loading && (
                            <div className="spjp-loading-overlay">
                                <div className="spjp-loading-spinner" />
                                <span>Finding nearest stores...</span>
                            </div>
                        )}

                        {/* Store list */}
                        <div className="spjp-step1-list">
                            {filteredStores.length === 0 ? (
                                <div className="spjp-empty">No stores found</div>
                            ) : (
                                filteredStores.map(store => (
                                    <button
                                        key={store.id}
                                        className="spjp-store-option"
                                        onClick={() => handleSelectStartStore(store)}
                                        disabled={loading}
                                    >
                                        <div className="spjp-store-option-main">
                                            <span className="spjp-store-option-name">{store.storeName}</span>
                                            <span className="spjp-store-option-city">📍 {store.city}</span>
                                        </div>
                                        <div className="spjp-store-option-meta">
                                            <span className="spjp-visited-badge">
                                                🕐 Last visited: {store.lastVisitDate ? formatDate(store.lastVisitDate) : 'Never'}
                                            </span>
                                            {store.wasInLastPJP && (
                                                <span className="spjp-pjp-badge">
                                                    📋 Last PJP: {formatDate(store.lastPJPDate ?? null)}
                                                </span>
                                            )}
                                        </div>
                                        <span className="spjp-arrow-icon">›</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // ─── Step 2: Route Editor ─────────────────────────────────────────────────
        if (step === 2) {
            return (
                <div className="spjp-overlay">
                    <div className="spjp-step2-panel">
                        {/* Header */}
                        <div className="spjp-step2-header">
                            <div className="spjp-step2-header-left">
                                <h2 className="spjp-step2-title">🗺️ Suggested Route</h2>
                                <p className="spjp-step2-subtitle">
                                    Starting from <strong>{startStore?.storeName}</strong> · {suggestedRoute.length} stops suggested
                                </p>
                            </div>
                            <button className="spjp-close-btn" onClick={onClose}>✕</button>
                        </div>

                        {/* Start badge */}
                        <div className="spjp-start-badge">
                            <span className="spjp-start-dot" />
                            <div>
                                <span className="spjp-start-label">Starting Point</span>
                                <span className="spjp-start-name">{startStore?.storeName}</span>
                                <div className="spjp-city-row-fix">
                                    <span className="spjp-start-city">📍 {startStore?.city}</span>
                                    {startStore && (
                                        <button
                                            className="spjp-inline-fix-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFixCoords({
                                                    id: startStore!.id,
                                                    storeName: startStore!.storeName,
                                                    city: startStore!.city,
                                                    lat: startStoreCoords.lat,
                                                    lng: startStoreCoords.lng,
                                                    index: 'start'
                                                });
                                            }}
                                            title="Fix Coordinates"
                                        >
                                            📍 Fix
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Route list */}
                        <div className="spjp-route-list">
                            {suggestedRoute.length === 0 ? (
                                <div className="spjp-empty">No stores in route. Use "Add Store" to add some.</div>
                            ) : (
                                suggestedRoute.map((store, index) => {
                                    const histOpen = expandedHistory.has(store.id);
                                    const imgOpen = expandedImages.has(store.id);
                                    const personMet: PersonMet[] = Array.isArray(store.lastVisit?.personMet)
                                        ? store.lastVisit!.personMet
                                        : [];

                                    return (
                                        <div key={store.id} className="spjp-route-card">
                                            {/* Card header row */}
                                            <div className="spjp-route-card-top">
                                                <div className="spjp-route-number">{index + 1}</div>
                                                <div className="spjp-route-card-info">
                                                    <span className="spjp-route-store-name">{store.storeName}</span>
                                                    <div className="spjp-city-row-fix">
                                                        <span className="spjp-route-store-city">📍 {store.city}</span>
                                                        <button
                                                            className="spjp-inline-fix-btn route"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleFixCoords({
                                                                    id: store.id,
                                                                    storeName: store.storeName,
                                                                    city: store.city,
                                                                    lat: store.latitude,
                                                                    lng: store.longitude,
                                                                    index
                                                                });
                                                            }}
                                                            title="Fix Coordinates"
                                                        >
                                                            📍 Fix
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="spjp-route-card-actions">
                                                    <button
                                                        className="spjp-move-btn"
                                                        onClick={() => moveUp(index)}
                                                        disabled={index === 0}
                                                        title="Move up"
                                                    >↑</button>
                                                    <button
                                                        className="spjp-move-btn"
                                                        onClick={() => moveDown(index)}
                                                        disabled={index === suggestedRoute.length - 1}
                                                        title="Move down"
                                                    >↓</button>
                                                    <button
                                                        className="spjp-remove-btn"
                                                        onClick={() => removeStore(store.id)}
                                                        title="Remove from route"
                                                    >✕</button>
                                                </div>
                                            </div>

                                            {/* Meta row */}
                                            <div className="spjp-route-meta">
                                                {getDistance(index) > 0 && (
                                                    <span className="spjp-distance-chip">📏 {getDistance(index)} km from previous stop</span>
                                                )}
                                                <span className="spjp-last-visit-chip">🕐 {store.visited}</span>
                                                {store.wasInLastPJP && (
                                                    <span className="spjp-was-pjp-chip">📋 Was in last PJP</span>
                                                )}
                                            </div>

                                            {/* Previous Conversation toggle */}
                                            {store.lastVisit && (
                                                <div className="spjp-prev-conv">
                                                    <button
                                                        className={`spjp-prev-conv-toggle ${histOpen ? 'open' : ''}`}
                                                        onClick={() => toggleHistory(store.id)}
                                                    >
                                                        <span>💬 Previous Conversation</span>
                                                        <span className="spjp-toggle-arrow">{histOpen ? '▲' : '▼'}</span>
                                                    </button>

                                                    {histOpen && (
                                                        <div className="spjp-prev-conv-body">
                                                            {/* Visit date */}
                                                            <div className="spjp-conv-section">
                                                                <span className="spjp-conv-label">📅 Visit Date</span>
                                                                <span className="spjp-conv-value">{formatDate(store.lastVisit.visitDate)}</span>
                                                            </div>

                                                            {/* POSM */}
                                                            {store.lastVisit.POSMchecked !== null && (
                                                                <div className="spjp-conv-section">
                                                                    <span className="spjp-conv-label">🏷️ POSM Available</span>
                                                                    <span className="spjp-conv-value">{store.lastVisit.POSMchecked ? 'Yes' : 'No'}</span>
                                                                </div>
                                                            )}

                                                            {/* People Met */}
                                                            {personMet.length > 0 && (
                                                                <div className="spjp-conv-section">
                                                                    <span className="spjp-conv-label">👥 People Met</span>
                                                                    <div className="spjp-people-list">
                                                                        {personMet.map((p, i) => (
                                                                            <div key={i} className="spjp-person-row">
                                                                                <strong>{p.name}</strong>
                                                                                {p.designation && <span className="spjp-designation"> ({p.designation})</span>}
                                                                                {p.phoneNumber && (
                                                                                    <a href={`tel:${p.phoneNumber}`} className="spjp-phone">
                                                                                        📞 {p.phoneNumber}
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Remarks */}
                                                            {store.lastVisit.remarks && (
                                                                <div className="spjp-conv-section">
                                                                    <span className="spjp-conv-label">📝 Remarks</span>
                                                                    <p className="spjp-remarks-text">{store.lastVisit.remarks}</p>
                                                                </div>
                                                            )}

                                                            {/* Images */}
                                                            {store.lastVisit.imageUrls.length > 0 && (
                                                                <div className="spjp-conv-section">
                                                                    <button
                                                                        className="spjp-img-toggle"
                                                                        onClick={() => toggleImages(store.id)}
                                                                    >
                                                                        🖼️ {imgOpen ? 'Hide' : 'Show'} Images ({store.lastVisit.imageUrls.length})
                                                                    </button>
                                                                    {imgOpen && (
                                                                        <div className="spjp-image-grid">
                                                                            {store.lastVisit.imageUrls.map((url, i) => (
                                                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                                                                    <img
                                                                                        src={url}
                                                                                        alt={`Visit photo ${i + 1}`}
                                                                                        className="spjp-thumb"
                                                                                    />
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Add more stores */}
                        <div className="spjp-add-more-section">
                            <button
                                className="spjp-add-more-btn"
                                onClick={() => setAddMoreOpen(!addMoreOpen)}
                            >
                                {addMoreOpen ? '✕ Cancel' : '＋ Add Store'}
                            </button>
                            {addMoreOpen && (
                                <div className="spjp-add-more-dropdown">
                                    <input
                                        className="spjp-add-more-search"
                                        placeholder="Search stores..."
                                        value={addMoreSearch}
                                        onChange={e => setAddMoreSearch(e.target.value)}
                                        autoFocus
                                    />
                                    <div className="spjp-add-more-list">
                                        {storesNotInRoute.length === 0 ? (
                                            <div className="spjp-empty-small">No stores to add</div>
                                        ) : (
                                            storesNotInRoute.slice(0, 20).map(s => (
                                                <button
                                                    key={s.id}
                                                    className="spjp-add-more-item"
                                                    onClick={() => addStoreToRoute(s)}
                                                >
                                                    <span className="spjp-add-name">{s.storeName}</span>
                                                    <span className="spjp-add-city">{s.city}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="spjp-step2-footer">
                            <button className="spjp-back-btn" onClick={() => { setStep(1); setError(null); }}>
                                ← Back
                            </button>
                            <button
                                className="spjp-continue-btn"
                                onClick={() => setStep(3)}
                                disabled={suggestedRoute.length === 0}
                            >
                                Continue → ({suggestedRoute.length + 1} stores)
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // ─── Step 3: Confirm & Submit ─────────────────────────────────────────────
        return (
            <div className="spjp-overlay">
                <div className="spjp-step3-panel">
                    <div className="spjp-step3-header">
                        <h2 className="spjp-step3-title">📋 Confirm PJP</h2>
                        <button className="spjp-close-btn" onClick={onClose}>✕</button>
                    </div>

                    <div className="spjp-step3-body">
                        <p className="spjp-step3-summary">
                            You're about to create a PJP with <strong>{suggestedRoute.length + 1}</strong> stores.
                        </p>

                        {/* Store order preview */}
                        <div className="spjp-step3-stores">
                            {/* Start store */}
                            <div className="spjp-step3-store-row">
                                <div className="spjp-step3-num start">🚩</div>
                                <div className="spjp-step3-store-info">
                                    <span className="spjp-step3-store-name">{startStore?.storeName}</span>
                                    <span className="spjp-step3-store-city">{startStore?.city}</span>
                                </div>
                            </div>
                            {suggestedRoute.map((store, i) => (
                                <div key={store.id} className="spjp-step3-store-row">
                                    <div className="spjp-step3-num">{i + 1}</div>
                                    <div className="spjp-step3-store-info">
                                        <span className="spjp-step3-store-name">{store.storeName}</span>
                                        <span className="spjp-step3-store-city">
                                            {store.city}
                                            {getDistance(i) > 0 && ` · ${getDistance(i)} km from previous`}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Date picker */}
                        <div className="spjp-date-section">
                            <label className="spjp-date-label">
                                📅 <strong>Planned Visit Date</strong> <span className="spjp-required">*</span>
                            </label>
                            <input
                                type="date"
                                className="spjp-date-input"
                                value={plannedVisitDate}
                                onChange={e => setPlannedVisitDate(e.target.value)}
                                min={todayLocal}
                                disabled={submitting}
                                required
                            />
                            {plannedVisitDate && (
                                <p className="spjp-date-preview">
                                    🗓️ Visits scheduled for: <strong>
                                        {(() => {
                                            const d = new Date(plannedVisitDate);
                                            if (isNaN(d.getTime())) return 'Invalid Date';
                                            return d.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
                                        })()}
                                    </strong>
                                </p>
                            )}
                        </div>

                        <div className="spjp-step3-note">
                            💡 <strong>Note:</strong> Submitting this visit plan will notify all admins about your intended store visits.
                        </div>
                    </div>

                    <div className="spjp-step3-footer">
                        <button className="spjp-back-btn" onClick={() => setStep(2)}>
                            ← Back
                        </button>
                        <button
                            className="spjp-send-btn"
                            onClick={handleSubmit}
                            disabled={submitting || !plannedVisitDate}
                        >
                            {submitting ? (
                                <><span className="spjp-spinner" /> Sending...</>
                            ) : (
                                '📤 Send Visit Plan'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {renderStep()}

            {coordModalStore && (
                <UpdateCoordinatesModal
                    storeId={coordModalStore.id}
                    storeName={coordModalStore.storeName}
                    city={coordModalStore.city}
                    currentLat={coordModalStore.lat ?? undefined}
                    currentLng={coordModalStore.lng ?? undefined}
                    onClose={() => setCoordModalStore(null)}
                    onSuccess={(storeId, lat, lng) => handleCoordsSuccess(storeId, lat, lng, coordModalStore.index)}
                />
            )}
        </>
    );
};

export default SuggestPJP;
