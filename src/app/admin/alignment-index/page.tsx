'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Home, Navigation, Hexagon, Building2 } from 'lucide-react';
import './alignment-index.css';
import { IndiaMap } from './IndiaMap';

// Re-calibrated store coordinates for the high-fidelity map
// ViewBox: 0 0 650 850
const sampleStores = [
    { id: 1, name: 'Delhi HQ', city: 'Delhi', x: 190, y: 310, executives: 12, alignment: 'high' },
    { id: 2, name: 'Mumbai Hub', city: 'Mumbai', x: 130, y: 480, executives: 8, alignment: 'high' },
    { id: 3, name: 'Bangalore Tech Park', city: 'Bangalore', x: 200, y: 600, executives: 6, alignment: 'medium' },
    { id: 4, name: 'Chennai OMR', city: 'Chennai', x: 260, y: 630, executives: 4, alignment: 'medium' },
    { id: 5, name: 'Kolkata Sector 5', city: 'Kolkata', x: 440, y: 460, executives: 5, alignment: 'high' },
    { id: 6, name: 'Hyderabad Cyber City', city: 'Hyderabad', x: 230, y: 520, executives: 3, alignment: 'medium' },
    { id: 7, name: 'Pune IT Park', city: 'Pune', x: 150, y: 490, executives: 3, alignment: 'medium' },
    { id: 8, name: 'Ahmedabad West', city: 'Ahmedabad', x: 100, y: 430, executives: 2, alignment: 'low' },
    { id: 9, name: 'Jaipur Central', city: 'Jaipur', x: 150, y: 320, executives: 2, alignment: 'low' },
    { id: 10, name: 'Lucknow Gomti', city: 'Lucknow', x: 280, y: 330, executives: 3, alignment: 'medium' },
    { id: 11, name: 'Srinagar North', city: 'Srinagar', x: 180, y: 160, executives: 1, alignment: 'low' },
    { id: 12, name: 'Guwahati East', city: 'Guwahati', x: 480, y: 370, executives: 2, alignment: 'low' }
];

const AlignmentIndexPage = () => {
    const [selectedStore, setSelectedStore] = useState<typeof sampleStores[0] | null>(null);
    const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const mapRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (selectedStore) {
            const targetScale = 2.5;
            // Center the view on the selected store
            // Viewport center is approx 325, 375 (half of 650, 750)
            const translateX = 325 - (selectedStore.x * targetScale);
            const translateY = 375 - (selectedStore.y * targetScale);

            setViewState({
                scale: targetScale,
                x: translateX,
                y: translateY
            });
        } else {
            setViewState({ scale: 1, x: 0, y: 0 });
        }
    }, [selectedStore]);

    const handleZoomIn = () => {
        setViewState(prev => ({
            ...prev,
            scale: Math.min(prev.scale + 0.5, 5)
        }));
    };

    const handleZoomOut = () => {
        setViewState(prev => {
            const newScale = Math.max(prev.scale - 0.5, 1);
            return {
                ...prev,
                scale: newScale,
                x: newScale === 1 ? 0 : prev.x,
                y: newScale === 1 ? 0 : prev.y
            };
        });
    };

    const handleReset = () => {
        setSelectedStore(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - viewState.x, y: e.clientY - viewState.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;

        setViewState(prev => ({
            ...prev,
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    return (
        <div className="alignment-index-container">
            {/* Background Grid & Decorative Elements */}
            <div className="bg-grid"></div>
            <div className="bg-glow-center"></div>

            {/* Futuristic Header */}
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
                            <span className="stat-val">87%</span>
                            <span className="stat-lbl">COVERAGE</span>
                        </div>
                        <div className="stat-separator"></div>
                        <div className="stat-bloc">
                            <span className="stat-val text-alert">12</span>
                            <span className="stat-lbl">CRITICAL</span>
                        </div>
                        <div className="stat-separator"></div>
                        <div className="stat-bloc">
                            <span className="stat-val text-success">45</span>
                            <span className="stat-lbl">OPTIMAL</span>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="hud-legend">
                    <div className="legend-entry">
                        <span className="marker-preview high"></span>
                        <span>OPTIMAL</span>
                    </div>
                    <div className="legend-entry">
                        <span className="marker-preview medium"></span>
                        <span>MODERATE</span>
                    </div>
                    <div className="legend-entry">
                        <span className="marker-preview low"></span>
                        <span>CRITICAL</span>
                    </div>
                </div>
            </div>

            {/* Main Map Viewport */}
            <div className="hud-map-frame">
                {/* Map Controls */}
                <div className="hud-controls">
                    <button className="hud-btn" onClick={handleReset} title="Reset View">
                        <Home size={18} />
                    </button>
                    <div className="zoom-stack">
                        <button className="hud-btn" onClick={handleZoomIn} title="Zoom In">
                            <ZoomIn size={18} />
                        </button>
                        <button className="hud-btn" onClick={handleZoomOut} title="Zoom Out">
                            <ZoomOut size={18} />
                        </button>
                    </div>
                </div>

                {/* SVG Map */}
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
                        viewBox="0 0 650 850"
                        className="interactive-map-svg"
                        style={{
                            transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
                            transition: isDragging ? 'none' : 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)'
                        }}
                    >
                        {/* Grid Pattern Overlay */}
                        <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="1" />
                        </pattern>
                        <rect
                            width="650"
                            height="850"
                            fill="url(#gridPattern)"
                            opacity="0.1"
                            pointerEvents="none"
                        />

                        {/* Futuristic Store Markers */}
                        {sampleStores.map((store) => (
                            <g
                                key={store.id}
                                className={`map-marker-group ${selectedStore?.id === store.id ? 'active' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStore(store);
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Simple Glowing Dot */}
                                <circle
                                    cx={store.x}
                                    cy={store.y}
                                    r="6"
                                    className={`marker-dot ${store.alignment}`}
                                />

                                {/* City Label */}
                                <text
                                    x={store.x}
                                    y={store.y + 15}
                                    textAnchor="middle"
                                    className="marker-label-hud"
                                    style={{
                                        opacity: viewState.scale > 1.8 || selectedStore?.id === store.id ? 1 : 0,
                                        fontSize: `${12 / viewState.scale}px`
                                    }}
                                >
                                    {store.city}
                                </text>
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
                                    <span className={`h-badge ${selectedStore.alignment}`}>
                                        {selectedStore.alignment.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <div className="hologram-footer">
                                <div className="scan-line"></div>
                                <button className="cyber-btn">ACCESS DATA</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlignmentIndexPage;
