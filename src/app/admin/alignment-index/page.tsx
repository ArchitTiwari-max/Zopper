'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Home, Navigation, Hexagon, Building2, X, ChevronRight, AlertCircle, ArrowLeft, Phone, CheckCircle2, XCircle, Users, UserCheck } from 'lucide-react';
import './alignment-index.css';
import { IndiaMap } from './IndiaMap';

// ─── Static store data with alignment personnel ───────────────────────────────
const sampleStores = [
    {
        id: 1, name: 'Delhi HQ', city: 'New Delhi', state: 'Delhi',
        x: 190, y: 310, executives: 12, alignment: 'high', score: 92,
        code: 'ZOP-DL-001', lastUpdated: '2024-03-10', storeType: 'Croma',
        storeLevel: [
            { role: 'Croma Staff', name: 'Arjun Mehta', phone: '+91 98100 11223', aligned: true },
            { role: 'SEC', name: 'Priya Sharma', phone: '+91 98100 22334', aligned: true },
            { role: 'ADM', name: 'Rahul Verma', phone: '+91 98100 33445', aligned: true },
            { role: 'Store Manager', name: 'Neha Kapoor', phone: '+91 98100 44556', aligned: true },
            { role: 'Cluster Manager', name: 'Suresh Nair', phone: '+91 98100 55667', aligned: false },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Deepa Iyer', phone: '+91 98765 10001', aligned: true },
            { role: 'ZSE', name: 'Rohan Gupta', phone: '+91 98765 10002', aligned: true },
            { role: 'ZSM', name: 'Amit Sharma', phone: '+91 98765 10003', aligned: true },
        ],
    },
    {
        id: 2, name: 'Mumbai Hub', city: 'Mumbai', state: 'Maharashtra',
        x: 130, y: 480, executives: 8, alignment: 'high', score: 88,
        code: 'ZOP-MH-001', lastUpdated: '2024-03-09', storeType: 'VS',
        storeLevel: [
            { role: 'VS Staff', name: 'Kavita Rao', phone: '+91 91234 11111', aligned: true },
            { role: 'SEC', name: 'Anil Pawar', phone: '+91 91234 22222', aligned: true },
            { role: 'TL', name: 'Suresh Nair', phone: '+91 91234 33333', aligned: false },
            { role: 'Store Manager', name: 'Meena Patil', phone: '+91 91234 44444', aligned: true },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Deepa Iyer', phone: '+91 90000 10001', aligned: true },
            { role: 'ZSE', name: 'Vikram Mehta', phone: '+91 90000 10002', aligned: false },
            { role: 'ZSM', name: 'Rajesh Kumar', phone: '+91 90000 10003', aligned: true },
        ],
    },
    {
        id: 3, name: 'Bangalore Tech Park', city: 'Bangalore', state: 'Karnataka',
        x: 200, y: 600, executives: 6, alignment: 'medium', score: 74,
        code: 'ZOP-KA-001', lastUpdated: '2024-03-08', storeType: 'Croma',
        storeLevel: [
            { role: 'Croma Staff', name: 'Ravi Kumar', phone: '+91 80000 11111', aligned: true },
            { role: 'SEC', name: 'Anitha Reddy', phone: '+91 80000 22222', aligned: false },
            { role: 'ADM', name: 'Pavan Shetty', phone: '+91 80000 33333', aligned: true },
            { role: 'Store Manager', name: 'Lakshmi Rao', phone: '+91 80000 44444', aligned: false },
            { role: 'Cluster Manager', name: 'Nandan Bhat', phone: '+91 80000 55555', aligned: true },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Sunita Murthy', phone: '+91 70000 10001', aligned: true },
            { role: 'ZSE', name: 'Mohan Rao', phone: '+91 70000 10002', aligned: true },
            { role: 'ZSM', name: 'Rajesh Kumar', phone: '+91 70000 10003', aligned: false },
        ],
    },
    {
        id: 4, name: 'Chennai OMR', city: 'Chennai', state: 'Tamil Nadu',
        x: 260, y: 630, executives: 4, alignment: 'medium', score: 65,
        code: 'ZOP-TN-001', lastUpdated: '2024-03-07', storeType: 'VS',
        storeLevel: [
            { role: 'VS Staff', name: 'Karthik Raj', phone: '+91 94400 11111', aligned: false },
            { role: 'SEC', name: 'Preethi Nair', phone: '+91 94400 22222', aligned: true },
            { role: 'TL', name: 'Meena Krishnan', phone: '+91 94400 33333', aligned: true },
            { role: 'Store Manager', name: 'Arun Pillai', phone: '+91 94400 44444', aligned: false },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Rani Suresh', phone: '+91 94400 10001', aligned: false },
            { role: 'ZSE', name: 'Simran Singh', phone: '+91 94400 10002', aligned: false },
            { role: 'ZSM', name: 'Vikram Mehta', phone: '+91 94400 10003', aligned: true },
        ],
    },
    {
        id: 5, name: 'Kolkata Sector 5', city: 'Kolkata', state: 'West Bengal',
        x: 440, y: 460, executives: 5, alignment: 'high', score: 85,
        code: 'ZOP-WB-001', lastUpdated: '2024-03-06', storeType: 'Croma',
        storeLevel: [
            { role: 'Croma Staff', name: 'Sanjay Bose', phone: '+91 98300 11111', aligned: true },
            { role: 'SEC', name: 'Rina Das', phone: '+91 98300 22222', aligned: true },
            { role: 'ADM', name: 'Tarun Sen', phone: '+91 98300 33333', aligned: true },
            { role: 'Store Manager', name: 'Sudha Ghosh', phone: '+91 98300 44444', aligned: true },
            { role: 'Cluster Manager', name: 'Partha Mitra', phone: '+91 98300 55555', aligned: false },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Rekha Dey', phone: '+91 98300 10001', aligned: true },
            { role: 'ZSE', name: 'Tarun Sen', phone: '+91 98300 10002', aligned: true },
            { role: 'ZSM', name: 'Amit Sharma', phone: '+91 98300 10003', aligned: true },
        ],
    },
    {
        id: 6, name: 'Hyderabad Cyber City', city: 'Hyderabad', state: 'Telangana',
        x: 230, y: 520, executives: 3, alignment: 'medium', score: 71,
        code: 'ZOP-TG-001', lastUpdated: '2024-03-05', storeType: 'VS',
        storeLevel: [
            { role: 'VS Staff', name: 'Neha Verma', phone: '+91 97777 11111', aligned: true },
            { role: 'SEC', name: 'Suresh Reddy', phone: '+91 97777 22222', aligned: false },
            { role: 'TL', name: 'Prakash Rao', phone: '+91 97777 33333', aligned: true },
            { role: 'Store Manager', name: 'Sunita Nair', phone: '+91 97777 44444', aligned: false },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Kavya Pillai', phone: '+91 97777 10001', aligned: true },
            { role: 'ZSE', name: 'Sunita Rao', phone: '+91 97777 10002', aligned: false },
            { role: 'ZSM', name: 'Vikram Mehta', phone: '+91 97777 10003', aligned: true },
        ],
    },
    {
        id: 7, name: 'Pune IT Park', city: 'Pune', state: 'Maharashtra',
        x: 150, y: 490, executives: 3, alignment: 'medium', score: 78,
        code: 'ZOP-MH-002', lastUpdated: '2024-03-04', storeType: 'Croma',
        storeLevel: [
            { role: 'Croma Staff', name: 'Aditya Joshi', phone: '+91 96666 11111', aligned: true },
            { role: 'SEC', name: 'Rekha Patil', phone: '+91 96666 22222', aligned: true },
            { role: 'ADM', name: 'Vijay Kulkarni', phone: '+91 96666 33333', aligned: false },
            { role: 'Store Manager', name: 'Smita Desai', phone: '+91 96666 44444', aligned: true },
            { role: 'Cluster Manager', name: 'Rahul Thorat', phone: '+91 96666 55555', aligned: true },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Pallavi Deshpande', phone: '+91 96666 10001', aligned: true },
            { role: 'ZSE', name: 'Vijay Kulkarni', phone: '+91 96666 10002', aligned: false },
            { role: 'ZSM', name: 'Rajesh Kumar', phone: '+91 96666 10003', aligned: true },
        ],
    },
    {
        id: 8, name: 'Ahmedabad West', city: 'Ahmedabad', state: 'Gujarat',
        x: 100, y: 430, executives: 2, alignment: 'low', score: 42,
        code: 'ZOP-GJ-001', lastUpdated: '2024-03-03', storeType: 'VS',
        storeLevel: [
            { role: 'VS Staff', name: 'Harish Patel', phone: '+91 99999 11111', aligned: false },
            { role: 'SEC', name: 'Kiran Shah', phone: '+91 99999 22222', aligned: false },
            { role: 'TL', name: 'Bhavna Mehta', phone: '+91 99999 33333', aligned: false },
            { role: 'Store Manager', name: 'Nikhil Gandhi', phone: '+91 99999 44444', aligned: false },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Foram Desai', phone: '+91 99999 10001', aligned: false },
            { role: 'ZSE', name: 'Simran Singh', phone: '+91 99999 10002', aligned: false },
            { role: 'ZSM', name: 'Amit Sharma', phone: '+91 99999 10003', aligned: false },
        ],
    },
    {
        id: 9, name: 'Jaipur Central', city: 'Jaipur', state: 'Rajasthan',
        x: 150, y: 320, executives: 2, alignment: 'low', score: 35,
        code: 'ZOP-RJ-001', lastUpdated: '2024-03-02', storeType: 'Croma',
        storeLevel: [
            { role: 'Croma Staff', name: 'Manoj Sharma', phone: '+91 94141 11111', aligned: false },
            { role: 'SEC', name: 'Sunita Agarwal', phone: '+91 94141 22222', aligned: false },
            { role: 'ADM', name: 'Ravi Gupta', phone: '+91 94141 33333', aligned: false },
            { role: 'Store Manager', name: 'Pallavi Mathur', phone: '+91 94141 44444', aligned: false },
            { role: 'Cluster Manager', name: 'Deepak Saxena', phone: '+91 94141 55555', aligned: false },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Kavita Dubey', phone: '+91 94141 10001', aligned: false },
            { role: 'ZSE', name: 'Pallavi Mathur', phone: '+91 94141 10002', aligned: false },
            { role: 'ZSM', name: 'Amit Sharma', phone: '+91 94141 10003', aligned: false },
        ],
    },
    {
        id: 10, name: 'Lucknow Gomti', city: 'Lucknow', state: 'Uttar Pradesh',
        x: 280, y: 330, executives: 3, alignment: 'medium', score: 68,
        code: 'ZOP-UP-001', lastUpdated: '2024-03-01', storeType: 'VS',
        storeLevel: [
            { role: 'VS Staff', name: 'Rajeev Srivastava', phone: '+91 95522 11111', aligned: true },
            { role: 'SEC', name: 'Pooja Mishra', phone: '+91 95522 22222', aligned: false },
            { role: 'TL', name: 'Ankita Dubey', phone: '+91 95522 33333', aligned: true },
            { role: 'Store Manager', name: 'Suresh Tiwari', phone: '+91 95522 44444', aligned: false },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Rishabh Singh', phone: '+91 95522 10001', aligned: true },
            { role: 'ZSE', name: 'Ankita Dubey', phone: '+91 95522 10002', aligned: false },
            { role: 'ZSM', name: 'Vikram Mehta', phone: '+91 95522 10003', aligned: true },
        ],
    },
    {
        id: 11, name: 'Srinagar North', city: 'Srinagar', state: 'Jammu and Kashmir',
        x: 180, y: 160, executives: 1, alignment: 'low', score: 28,
        code: 'ZOP-JK-001', lastUpdated: '2024-02-28', storeType: 'VS',
        storeLevel: [
            { role: 'VS Staff', name: 'Faisal Wani', phone: '+91 94190 11111', aligned: false },
            { role: 'SEC', name: 'Irfan Khan', phone: '+91 94190 22222', aligned: false },
            { role: 'TL', name: 'Sheetal Dogra', phone: '+91 94190 33333', aligned: false },
            { role: 'Store Manager', name: 'Gulzar Ahmad', phone: '+91 94190 44444', aligned: false },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Pooja Thakur', phone: '+91 94190 10001', aligned: false },
            { role: 'ZSE', name: 'Irfan Khan', phone: '+91 94190 10002', aligned: false },
            { role: 'ZSM', name: 'Simran Singh', phone: '+91 94190 10003', aligned: false },
        ],
    },
    {
        id: 12, name: 'Guwahati East', city: 'Guwahati', state: 'Assam',
        x: 480, y: 370, executives: 2, alignment: 'low', score: 45,
        code: 'ZOP-AS-001', lastUpdated: '2024-02-27', storeType: 'Croma',
        storeLevel: [
            { role: 'Croma Staff', name: 'Biren Borah', phone: '+91 98640 11111', aligned: false },
            { role: 'SEC', name: 'Dipali Saikia', phone: '+91 98640 22222', aligned: true },
            { role: 'ADM', name: 'Mridul Das', phone: '+91 98640 33333', aligned: false },
            { role: 'Store Manager', name: 'Ranjit Borah', phone: '+91 98640 44444', aligned: false },
            { role: 'Cluster Manager', name: 'Parag Gogoi', phone: '+91 98640 55555', aligned: false },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Priya Hazarika', phone: '+91 98640 10001', aligned: false },
            { role: 'ZSE', name: 'Mridul Das', phone: '+91 98640 10002', aligned: false },
            { role: 'ZSM', name: 'Rajesh Kumar', phone: '+91 98640 10003', aligned: false },
        ],
    },
    {
        id: 13, name: 'Indore Hub', city: 'Indore', state: 'Madhya Pradesh',
        x: 180, y: 420, executives: 5, alignment: 'high', score: 81,
        code: 'ZOP-MP-001', lastUpdated: '2024-03-11', storeType: 'VS',
        storeLevel: [
            { role: 'VS Staff', name: 'Vishal Tiwari', phone: '+91 98270 11111', aligned: true },
            { role: 'SEC', name: 'Anjali Saxena', phone: '+91 98270 22222', aligned: true },
            { role: 'TL', name: 'Lalit Chouhan', phone: '+91 98270 33333', aligned: true },
            { role: 'Store Manager', name: 'Priya Malhotra', phone: '+91 98270 44444', aligned: true },
        ],
        stakeholderLevel: [
            { role: 'ASE', name: 'Sanjay Dubey', phone: '+91 98270 10001', aligned: true },
            { role: 'ZSE', name: 'Lalit Chouhan', phone: '+91 98270 10002', aligned: true },
            { role: 'ZSM', name: 'Amit Sharma', phone: '+91 98270 10003', aligned: true },
        ],
    },
];

const sampleStateData: Record<string, any> = {
    'IN-DL': { name: 'Delhi', score: 92, stores: 15, critical: 1, missingRoles: 2 },
    'IN-MH': { name: 'Maharashtra', score: 82, stores: 45, critical: 5, missingRoles: 8 },
    'IN-KA': { name: 'Karnataka', score: 74, stores: 32, critical: 4, missingRoles: 12 },
    'IN-TN': { name: 'Tamil Nadu', score: 65, stores: 28, critical: 6, missingRoles: 15 },
    'IN-WB': { name: 'West Bengal', score: 85, stores: 22, critical: 2, missingRoles: 5 },
    'IN-TG': { name: 'Telangana', score: 71, stores: 25, critical: 3, missingRoles: 9 },
    'IN-GJ': { name: 'Gujarat', score: 42, stores: 38, critical: 15, missingRoles: 25 },
    'IN-RJ': { name: 'Rajasthan', score: 35, stores: 24, critical: 12, missingRoles: 20 },
    'IN-UP': { name: 'Uttar Pradesh', score: 68, stores: 52, critical: 10, missingRoles: 30 },
    'IN-JK': { name: 'Jammu and Kashmir', score: 28, stores: 8, critical: 5, missingRoles: 10 },
    'IN-AS': { name: 'Assam', score: 45, stores: 12, critical: 4, missingRoles: 14 },
    'IN-MP': { name: 'Madhya Pradesh', score: 81, stores: 30, critical: 3, missingRoles: 7 },
};

const getStateColor = (score: number | undefined, solid: boolean = false) => {
    const alpha = solid ? '1' : '0.7';
    if (score === undefined) return `rgba(255, 255, 255, ${solid ? '0.2' : '0.05'})`;
    if (score >= 80) return `rgba(34, 197, 94, ${alpha})`;
    if (score >= 50) return `rgba(234, 179, 8, ${alpha})`;
    return `rgba(239, 68, 68, ${alpha})`;
};

const stateColorMap: Record<string, string> = {};
Object.entries(sampleStateData).forEach(([id, data]) => {
    stateColorMap[id] = getStateColor(data.score);
});

const topMetricsAll = {
    coverage: Math.round(sampleStores.reduce((acc, s) => acc + s.score, 0) / sampleStores.length),
    critical: sampleStores.filter(s => s.score < 50).length,
    optimal: sampleStores.filter(s => s.score >= 80).length,
};

// ─── Store Detail Inner View ──────────────────────────────────────────────────
const StoreDetailView = ({ store, onBack }: { store: any; onBack: () => void }) => {
    const [activeTab, setActiveTab] = useState<'store' | 'stakeholder'>('store');

    const allStoreAligned = store.storeLevel.every((p: any) => p.aligned);
    const allStakeholderAligned = store.stakeholderLevel.every((p: any) => p.aligned);

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
                            <span className={`sd-type-badge ${store.storeType === 'Croma' ? 'croma' : 'vs'}`}>
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
                                <span>Status</span>
                                <span>Contact</span>
                            </div>
                            {store.storeLevel.map((person: any, idx: number) => (
                                <div key={idx} className={`sd-table-row ${person.aligned ? 'aligned' : 'misaligned'}`}>
                                    <span className="sd-role-tag">{person.role}</span>
                                    <span className="sd-person-name">{person.name}</span>
                                    <span className={`sd-status-chip ${person.aligned ? 'aligned' : 'misaligned'}`}>
                                        {person.aligned
                                            ? <><CheckCircle2 size={12} /> Aligned</>
                                            : <><XCircle size={12} /> Not Aligned</>
                                        }
                                    </span>
                                    <a href={`tel:${person.phone}`} className="sd-phone">
                                        <Phone size={12} />
                                        {person.phone}
                                    </a>
                                </div>
                            ))}
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
                                <span>Status</span>
                                <span>Contact</span>
                            </div>
                            {store.stakeholderLevel.map((person: any, idx: number) => (
                                <div key={idx} className={`sd-table-row ${person.aligned ? 'aligned' : 'misaligned'}`}>
                                    <span className="sd-role-tag">{person.role}</span>
                                    <span className="sd-person-name">{person.name}</span>
                                    <span className={`sd-status-chip ${person.aligned ? 'aligned' : 'misaligned'}`}>
                                        {person.aligned
                                            ? <><CheckCircle2 size={12} /> Aligned</>
                                            : <><XCircle size={12} /> Not Aligned</>
                                        }
                                    </span>
                                    <a href={`tel:${person.phone}`} className="sd-phone">
                                        <Phone size={12} />
                                        {person.phone}
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const AlignmentIndexPage = () => {
    const [selectedStore, setSelectedStore] = useState<any | null>(null);
    const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });
    const [hoveredState, setHoveredState] = useState<{ id: string; name: string; x: number; y: number } | null>(null);
    const [drilldownState, setDrilldownState] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [detailStore, setDetailStore] = useState<any | null>(null);
    const mapRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (selectedStore) {
            const targetScale = 2.5;
            const translateX = 325 - (selectedStore.x * targetScale);
            const translateY = 375 - (selectedStore.y * targetScale);
            setViewState({ scale: targetScale, x: translateX, y: translateY });
        } else {
            setViewState({ scale: 1, x: 0, y: 0 });
        }
    }, [selectedStore]);

    const handleZoomIn = () => setViewState(prev => ({ ...prev, scale: Math.min(prev.scale + 0.5, 5) }));
    const handleZoomOut = () => setViewState(prev => {
        const newScale = Math.max(prev.scale - 0.5, 1);
        return { ...prev, scale: newScale, x: newScale === 1 ? 0 : prev.x, y: newScale === 1 ? 0 : prev.y };
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
    const handleStateClick = (id: string) => { setDrilldownState(id); setDetailStore(null); };
    const handleCloseDrilldown = () => { setDrilldownState(null); setDetailStore(null); };

    return (
        <div className="alignment-index-container">
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
                            <span className="stat-val">{topMetricsAll.coverage}%</span>
                            <span className="stat-lbl">COVERAGE</span>
                        </div>
                        <div className="stat-separator"></div>
                        <div className="stat-bloc">
                            <span className="stat-val text-alert">{topMetricsAll.critical}</span>
                            <span className="stat-lbl">CRITICAL</span>
                        </div>
                        <div className="stat-separator"></div>
                        <div className="stat-bloc">
                            <span className="stat-val text-success">{topMetricsAll.optimal}</span>
                            <span className="stat-lbl">OPTIMAL</span>
                        </div>
                    </div>
                </div>
                <div className="hud-sub-header">
                    <div className="hud-legend">
                        <div className="legend-entry"><span className="marker-preview high"></span><span>OPTIMAL</span></div>
                        <div className="legend-entry"><span className="marker-preview medium"></span><span>MODERATE</span></div>
                        <div className="legend-entry"><span className="marker-preview low"></span><span>CRITICAL</span></div>
                    </div>
                </div>
            </div>

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
                        viewBox="0 0 650 850"
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

                        {sampleStores.map((store) => (
                            <g
                                key={store.id}
                                className={`map-marker-group ${selectedStore?.id === store.id ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setSelectedStore(store); }}
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
                            </div>
                            <div className="hologram-roles">
                                <h4 className="roles-subtitle">ROLE DISTRIBUTION</h4>
                                <div className="role-progress-stack">
                                    {[
                                        { label: 'Store Manager', status: 'FILLED', color: 'var(--neon-gold)' },
                                        { label: 'Sales Executive', status: '2 MISSING', color: 'var(--neon-red)' },
                                        { label: 'Technical Support', status: 'FILLED', color: 'var(--neon-cyan)' }
                                    ].map((role, idx) => (
                                        <div key={idx} className="role-row">
                                            <span className="role-lbl">{role.label}</span>
                                            <span className="role-sts" style={{ color: role.color }}>{role.status}</span>
                                        </div>
                                    ))}
                                </div>
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
            {hoveredState && sampleStateData[hoveredState.id] && (
                <div className="state-tooltip" style={{ left: `${hoveredState.x + 15}px`, top: `${hoveredState.y + 15}px` }}>
                    <div className="tooltip-header">
                        <span className="tooltip-title">{hoveredState.name}</span>
                        <div className="tooltip-score-badge" style={{ backgroundColor: getStateColor(sampleStateData[hoveredState.id].score, true) }}>
                            {sampleStateData[hoveredState.id].score !== undefined ? `${sampleStateData[hoveredState.id].score}%` : 'N/A'}
                        </div>
                    </div>
                    <div className="tooltip-body">
                        <div className="tooltip-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Stores:</span>
                            <strong style={{ color: '#fff' }}>{sampleStateData[hoveredState.id].stores}</strong>
                        </div>
                        <div className="tooltip-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Critical:</span>
                            <span className="text-alert" style={{ fontWeight: 'bold' }}>{sampleStateData[hoveredState.id].critical}</span>
                        </div>
                        <div className="tooltip-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Missing Roles:</span>
                            <span className="text-warning" style={{ fontWeight: 'bold' }}>{sampleStateData[hoveredState.id].missingRoles}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Sliding Drilldown Panel */}
            <div className={`drilldown-panel ${drilldownState ? 'open' : ''}`}>
                {drilldownState && (
                    <div className="panel-content">
                        {/* ── Store Detail View (when Details is clicked) ── */}
                        {detailStore ? (
                            <StoreDetailView store={detailStore} onBack={() => setDetailStore(null)} />
                        ) : (
                            /* ── State Drilldown View ── */
                            <>
                                <div className="panel-header">
                                    <div>
                                        <h2 className="panel-title">{sampleStateData[drilldownState]?.name || 'State Detail'}</h2>
                                        <p className="panel-subtitle">Regional Alignment Intelligence</p>
                                    </div>
                                    <button className="panel-close-btn" onClick={handleCloseDrilldown}>
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="panel-scroll-area">
                                    <div className="summary-section">
                                        <div className="overview-card">
                                            <div className="card-top">
                                                <div className="radial-chart">
                                                    <svg viewBox="0 0 36 36" className="circular-chart">
                                                        <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                        <path className="circle"
                                                            strokeDasharray={`${sampleStateData[drilldownState]?.score}, 100`}
                                                            style={{ stroke: getStateColor(sampleStateData[drilldownState]?.score, true) }}
                                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                        />
                                                        <text x="18" y="20.35" className="percentage">{sampleStateData[drilldownState]?.score}%</text>
                                                    </svg>
                                                </div>
                                                <div className="quick-stats">
                                                    <div className="q-stat">
                                                        <span className="q-lbl">TOTAL STORES</span>
                                                        <span className="q-val">{sampleStateData[drilldownState]?.stores}</span>
                                                    </div>
                                                    <div className="q-stat">
                                                        <span className="q-lbl">CRITICAL</span>
                                                        <span className="q-val text-alert">{sampleStateData[drilldownState]?.critical}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="card-footer">
                                                <div className="missing-roles-box">
                                                    <AlertCircle size={14} className="text-warning" />
                                                    <span>{sampleStateData[drilldownState]?.missingRoles} Roles Missing across region</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="drilldown-data">
                                        <h3 className="section-heading">City-wise Breakdown</h3>
                                        {Array.from(new Set(sampleStores.filter(s => s.state === sampleStateData[drilldownState]?.name).map(s => s.city))).map(city => (
                                            <div key={city} className="city-accordion open">
                                                <div className="accordion-trigger">
                                                    <div className="trigger-left">
                                                        <Navigation size={14} className="text-blue" />
                                                        <span>{city}</span>
                                                    </div>
                                                    <ChevronRight size={16} className="chevron" />
                                                </div>
                                                <div className="accordion-content">
                                                    {sampleStores
                                                        .filter(s => s.city === city && s.state === sampleStateData[drilldownState]?.name)
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
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlignmentIndexPage;
