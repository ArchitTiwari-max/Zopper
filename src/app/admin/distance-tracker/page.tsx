'use client';

import React, { useState, useEffect } from 'react';
import { useDateFilter } from '../contexts/DateFilterContext';
import './distance-tracker.css';

interface StoreStop {
    visitId: string;
    storeName: string;
    storeId: string;
    city: string;
    lat: number | null;
    lng: number | null;
    distanceFromPrev: number;
    hasCoordsError: boolean;
    visitTime: string;
}

interface Journey {
    date: string;
    totalDistanceKm: number;
    storeCount: number;
    stores: StoreStop[];
}

interface ExecutiveTracker {
    executiveId: string;
    executiveName: string;
    totalJourneyDays: number;
    journeys: Journey[];
}

interface FilterData {
    executives: Array<{ id: string; name: string }>;
}

const AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

const DistanceTrackerPage: React.FC = () => {
    const { selectedDateFilter, setSelectedDateFilter } = useDateFilter();
    const DATE_OPTIONS = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Last Year'] as const;
    const [trackers, setTrackers] = useState<ExecutiveTracker[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterData, setFilterData] = useState<FilterData>({ executives: [] });
    const [selectedExecutive, setSelectedExecutive] = useState<string>('All Executive');
    const [expandedExecutives, setExpandedExecutives] = useState<Set<string>>(new Set());
    const [expandedJourneys, setExpandedJourneys] = useState<Set<string>>(new Set());

    const fetchFilterData = async () => {
        try {
            const res = await fetch('/api/admin/visit-report/filters', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setFilterData({ executives: data.executives || [] });
            }
        } catch (e) {
            console.error('Failed to load filters', e);
        }
    };

    const fetchTrackers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set('dateFilter', selectedDateFilter);
            if (selectedExecutive !== 'All Executive') {
                params.set('executiveId', selectedExecutive);
            }
            params.set('_ts', String(Date.now()));

            const res = await fetch(`/api/admin/distance-tracker?${params}`, {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setTrackers(data.trackers || []);

            // Auto-expand first executive and first journey
            if (data.trackers?.length > 0) {
                const firstExId = data.trackers[0].executiveId;
                setExpandedExecutives(new Set([firstExId]));
                if (data.trackers[0].journeys?.length > 0) {
                    setExpandedJourneys(new Set([`${firstExId}-0`]));
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load distance tracker data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchFilterData(); }, []);
    useEffect(() => { fetchTrackers(); }, [selectedDateFilter, selectedExecutive]);

    const toggleExecutive = (exId: string) => {
        setExpandedExecutives(prev => {
            const next = new Set(prev);
            next.has(exId) ? next.delete(exId) : next.add(exId);
            return next;
        });
    };

    const toggleJourney = (key: string) => {
        setExpandedJourneys(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const totalKmAll = trackers.reduce((sum, t) =>
        sum + t.journeys.reduce((s, j) => s + j.totalDistanceKm, 0), 0
    );

    return (
        <div className="dt-page">
            {/* Header */}
            <div className="dt-header">
                <div className="dt-header-left">
                    <h1 className="dt-title">
                        <span className="dt-title-icon">📍</span>
                        Distance Tracker
                    </h1>
                    <p className="dt-subtitle">Executive journey distances between store visits</p>
                </div>
                <div className="dt-header-stats">
                    <div className="dt-stat-chip">
                        <span className="dt-stat-value">{trackers.length}</span>
                        <span className="dt-stat-label">Executives</span>
                    </div>
                    <div className="dt-stat-chip dt-stat-chip--blue">
                        <span className="dt-stat-value">{totalKmAll.toFixed(1)}</span>
                        <span className="dt-stat-label">Total km</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="dt-filters">
                <select
                    className="dt-select"
                    value={selectedDateFilter}
                    onChange={e => setSelectedDateFilter(e.target.value as typeof selectedDateFilter)}
                >
                    {DATE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                <select
                    className="dt-select"
                    value={selectedExecutive}
                    onChange={e => setSelectedExecutive(e.target.value)}
                >
                    <option value="All Executive">All Executives</option>
                    {filterData.executives.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                </select>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="dt-loading">
                    <div className="dt-spinner" />
                    <p>Loading journey data...</p>
                </div>
            ) : error ? (
                <div className="dt-error">
                    <span className="dt-error-icon">⚠️</span>
                    <p>{error}</p>
                    <button className="dt-retry-btn" onClick={fetchTrackers}>Retry</button>
                </div>
            ) : trackers.length === 0 ? (
                <div className="dt-empty">
                    <span className="dt-empty-icon">🗺️</span>
                    <h3>No visit data found</h3>
                    <p>No store visits recorded in the selected period.</p>
                </div>
            ) : (
                <div className="dt-executive-list">
                    {trackers.map(tracker => {
                        const isExOpen = expandedExecutives.has(tracker.executiveId);
                        const totalKm = tracker.journeys.reduce((s, j) => s + j.totalDistanceKm, 0);
                        const color = getAvatarColor(tracker.executiveName);

                        return (
                            <div key={tracker.executiveId} className={`dt-executive-card ${isExOpen ? 'dt-executive-card--open' : ''}`}>
                                {/* Executive Header */}
                                <button
                                    className="dt-executive-header"
                                    onClick={() => toggleExecutive(tracker.executiveId)}
                                >
                                    <div className="dt-executive-left">
                                        <div className="dt-avatar" style={{ background: color }}>
                                            {getInitials(tracker.executiveName)}
                                        </div>
                                        <div className="dt-executive-info">
                                            <span className="dt-executive-name">{tracker.executiveName}</span>
                                            <span className="dt-executive-meta">
                                                {tracker.totalJourneyDays} day{tracker.totalJourneyDays !== 1 ? 's' : ''} &nbsp;·&nbsp;
                                                {tracker.journeys.reduce((s, j) => s + j.storeCount, 0)} stores visited
                                            </span>
                                        </div>
                                    </div>
                                    <div className="dt-executive-right">
                                        <div className="dt-total-km-badge">
                                            <span className="dt-km-value">{totalKm.toFixed(1)}</span>
                                            <span className="dt-km-unit">km total</span>
                                        </div>
                                        <span className={`dt-chevron ${isExOpen ? 'dt-chevron--up' : ''}`}>▾</span>
                                    </div>
                                </button>

                                {/* Journeys */}
                                {isExOpen && (
                                    <div className="dt-journeys">
                                        {tracker.journeys.map((journey, jIdx) => {
                                            const journeyKey = `${tracker.executiveId}-${jIdx}`;
                                            const isJOpen = expandedJourneys.has(journeyKey);

                                            return (
                                                <div key={journeyKey} className="dt-journey">
                                                    <button
                                                        className="dt-journey-header"
                                                        onClick={() => toggleJourney(journeyKey)}
                                                    >
                                                        <div className="dt-journey-left">
                                                            <span className="dt-journey-date">📅 {journey.date}</span>
                                                            <span className="dt-journey-meta">
                                                                {journey.storeCount} store{journey.storeCount !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                        <div className="dt-journey-right">
                                                            <span className="dt-journey-km">{journey.totalDistanceKm.toFixed(1)} km</span>
                                                            <span className={`dt-chevron dt-chevron--sm ${isJOpen ? 'dt-chevron--up' : ''}`}>▾</span>
                                                        </div>
                                                    </button>

                                                    {isJOpen && (
                                                        <div className="dt-store-chain">
                                                            {journey.stores.map((stop, sIdx) => (
                                                                <div key={stop.visitId} className="dt-store-stop">
                                                                    {/* Connector line */}
                                                                    {sIdx < journey.stores.length - 1 && (
                                                                        <div className="dt-connector">
                                                                            <div className="dt-connector-line" />
                                                                        </div>
                                                                    )}

                                                                    <div className="dt-stop-dot-col">
                                                                        <div className={`dt-stop-dot ${sIdx === 0 ? 'dt-stop-dot--start' : ''}`}>
                                                                            {sIdx + 1}
                                                                        </div>
                                                                    </div>

                                                                    <div className="dt-stop-info">
                                                                        <div className="dt-stop-name">{stop.storeName}</div>
                                                                        <div className="dt-stop-meta">
                                                                            <span className="dt-stop-city">📍 {stop.city}</span>
                                                                            {stop.visitTime && (
                                                                                <span className="dt-stop-time">🕐 {formatTime(stop.visitTime)}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="dt-stop-distance">
                                                                        {sIdx === 0 ? (
                                                                            <span className="dt-distance-badge dt-distance-badge--start">Start</span>
                                                                        ) : stop.hasCoordsError ? (
                                                                            <span className="dt-distance-badge dt-distance-badge--warn" title="Store coordinates not available">— km</span>
                                                                        ) : (
                                                                            <span className="dt-distance-badge">+{stop.distanceFromPrev} km</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {/* Journey total footer */}
                                                            <div className="dt-journey-total">
                                                                <span>Total distance covered</span>
                                                                <strong>{journey.totalDistanceKm.toFixed(1)} km</strong>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DistanceTrackerPage;
