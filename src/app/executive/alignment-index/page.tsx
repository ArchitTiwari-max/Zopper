"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Home,
  Navigation,
  Hexagon,
  Building2,
  X,
  Users,
  UserCheck,
  CheckCircle2,
  XCircle,
  Phone,
  ArrowLeft,
  BarChart2,
  ChevronDown,
  User,
} from "lucide-react";
import "./alignment-index.css";
// Reuse the same IndiaMap SVG from the admin alignment-index page
import { IndiaMap } from "../../admin/alignment-index/IndiaMap";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StoreEntry {
  id: string;
  name: string;
  city: string;
  state: string;
  code: string;
  x: number;
  y: number;
  storeType: "Croma" | "Vijay Sales" | "Reliance";
  score: number;
  alignment: "high" | "medium" | "low";
  storeLevel: any[];
  stakeholderLevel: any[];
  ownerName?: string; // injected on the client
  isSelf?: boolean;
}

interface SubordinateData {
  id: string;
  name: string;
  stores: StoreEntry[];
}

interface ApiResponse {
  success: boolean;
  self: { id: string; name: string; stores: StoreEntry[] };
  subordinates: SubordinateData[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStateColor = (score: number | undefined, solid = false) => {
  const alpha = solid ? "1" : "0.85";
  if (score === undefined) return `rgba(255,255,255,1)`;
  if (score >= 80) return `rgba(34,197,94,${alpha})`;
  if (score >= 50) return `rgba(234,179,8,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
};

const NAME_TO_ID: Record<string, string> = {
  delhi: "IN-DL", maharashtra: "IN-MH", karnataka: "IN-KA",
  "tamil nadu": "IN-TN", "west bengal": "IN-WB", telangana: "IN-TG",
  gujarat: "IN-GJ", rajasthan: "IN-RJ", "uttar pradesh": "IN-UP",
  "jammu and kashmir": "IN-JK", assam: "IN-AS", "madhya pradesh": "IN-MP",
  "andhra pradesh": "IN-AP", kerala: "IN-KL", bihar: "IN-BR",
  odisha: "IN-OR", haryana: "IN-HR", punjab: "IN-PB",
  jharkhand: "IN-JH", chhattisgarh: "IN-CT", "himachal pradesh": "IN-HP",
  uttarakhand: "IN-UT", "arunachal pradesh": "IN-AR", goa: "IN-GA",
  sikkim: "IN-SK", puducherry: "IN-PY", chandigarh: "IN-CH",
  lakshadweep: "IN-LD", "andaman and nicobar": "IN-AN",
  "dadra and nagar haveli": "IN-DN", "daman and diu": "IN-DD",
  meghalaya: "IN-ML", manipur: "IN-MN", mizoram: "IN-MZ",
  nagaland: "IN-NL", tripura: "IN-TR",
};

const ID_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(NAME_TO_ID).map(([name, id]) => [
    id,
    name.split(" ").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
  ])
);

// ─── Store Detail Panel ───────────────────────────────────────────────────────
const StoreDetailPanel = ({
  store,
  onClose,
}: {
  store: StoreEntry;
  onClose: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<"store" | "stakeholder">("store");
  const storeLevel = Array.isArray(store.storeLevel) ? store.storeLevel : [];
  const stakeholderLevel = Array.isArray(store.stakeholderLevel)
    ? store.stakeholderLevel
    : [];

  const allStoreAligned =
    storeLevel.length > 0 &&
    storeLevel.every((e: any) => e.personnel && e.personnel.length > 0);
  const allStakeholderAligned =
    stakeholderLevel.length > 0 &&
    stakeholderLevel.every((e: any) => e.personnel && e.personnel.length > 0);

  const pct = store.score;
  const circumference = 100;
  const dash = (pct / 100) * circumference;

  const renderLevel = (levels: any[]) =>
    levels.length === 0 ? (
      <div className="exec-ai-no-data">No roles configured.</div>
    ) : (
      <div className="exec-ai-role-table">
        <div className="exec-ai-role-thead">
          <span>Role</span>
          <span>Personnel</span>
          <span>Status</span>
        </div>
        {levels.map((entry: any, idx: number) => {
          const isAligned = entry.personnel && entry.personnel.length > 0;
          return (
            <div key={idx} className="exec-ai-role-row-group">
              <div className="exec-ai-role-row">
                <span className="exec-ai-role-tag">{entry.role}</span>
                <span className="exec-ai-person-count">
                  {isAligned ? `${entry.personnel.length} Assigned` : "Vacant"}
                </span>
                <span
                  className={`exec-ai-status-chip ${isAligned ? "aligned" : "misaligned"}`}
                >
                  {isAligned ? (
                    <>
                      <CheckCircle2 size={11} /> Aligned
                    </>
                  ) : (
                    <>
                      <XCircle size={11} /> Gap
                    </>
                  )}
                </span>
              </div>
              {entry.personnel &&
                entry.personnel.map((p: any, pIdx: number) => (
                  <div key={pIdx} className="exec-ai-person-row">
                    <span className="exec-ai-person-name">
                      {p.name || "Anonymous"}
                    </span>
                    <a href={`tel:${p.phone}`} className="exec-ai-phone">
                      <Phone size={11} />
                      {p.phone || "N/A"}
                    </a>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    );

  return (
    <>
      <div className="exec-ai-panel-header">
        <div>
          <h2 className="exec-ai-panel-title">{store.name}</h2>
          <p className="exec-ai-panel-sub">Alignment Intelligence</p>
        </div>
        <button className="exec-ai-panel-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="exec-ai-panel-body">
        {/* Score Banner */}
        <div className="exec-ai-panel-banner">
          <div className="exec-ai-panel-score-ring">
            <svg viewBox="0 0 36 36" className="exec-ai-circular-chart">
              <path
                className="exec-ai-circle-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="exec-ai-circle"
                strokeDasharray={`${dash}, 100`}
                style={{ stroke: getStateColor(pct, true) }}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.35" className="exec-ai-pct">
                {pct}%
              </text>
            </svg>
          </div>
          <div className="exec-ai-panel-info">
            <div className="exec-ai-card-meta">
              <span
                className={`exec-ai-type-badge ${
                  store.storeType === "Croma"
                    ? "croma"
                    : store.storeType === "Vijay Sales"
                    ? "vijay-sales"
                    : "reliance"
                }`}
              >
                {store.storeType}
              </span>
            </div>
            <div className="exec-ai-panel-city">
              {store.city} · {store.state}
            </div>
            <div className="exec-ai-panel-owner-tag">
              {store.isSelf ? "My Store" : store.ownerName ?? "Subordinate"}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="exec-ai-tab-bar">
          <button
            className={`exec-ai-tab ${activeTab === "store" ? "active" : ""}`}
            onClick={() => setActiveTab("store")}
          >
            <Users size={13} />
            Store Level
          </button>
          <button
            className={`exec-ai-tab ${
              activeTab === "stakeholder" ? "active" : ""
            }`}
            onClick={() => setActiveTab("stakeholder")}
          >
            <UserCheck size={13} />
            Stakeholder
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "store" && (
          <div>
            <div
              className="exec-ai-section-title"
              style={{ marginBottom: "0.75rem" }}
            >
              Store Level Alignment &nbsp;
              <span
                className={`exec-ai-status-chip ${
                  allStoreAligned ? "aligned" : "misaligned"
                }`}
                style={{ fontSize: "0.6rem" }}
              >
                {allStoreAligned ? "Fully Aligned" : "Gaps Found"}
              </span>
            </div>
            {renderLevel(storeLevel)}
          </div>
        )}
        {activeTab === "stakeholder" && (
          <div>
            <div
              className="exec-ai-section-title"
              style={{ marginBottom: "0.75rem" }}
            >
              Stakeholder Alignment &nbsp;
              <span
                className={`exec-ai-status-chip ${
                  allStakeholderAligned ? "aligned" : "misaligned"
                }`}
                style={{ fontSize: "0.6rem" }}
              >
                {allStakeholderAligned ? "Fully Aligned" : "Gaps Found"}
              </span>
            </div>
            {renderLevel(stakeholderLevel)}
          </div>
        )}
      </div>
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ExecutiveAlignmentIndexPage = () => {
  const [loading, setLoading] = useState(true);
  const [selfData, setSelfData] = useState<{
    id: string;
    name: string;
    stores: StoreEntry[];
  } | null>(null);
  const [subordinates, setSubordinates] = useState<SubordinateData[]>([]);
  const [hasSubordinates, setHasSubordinates] = useState(false);

  // Filter: "all" | "self" | subordinate.id
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<"map" | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Close filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getFilterLabel = useCallback(() => {
    if (activeFilter === "all") return "All Combined";
    if (activeFilter === "self") return "My Stores";
    const sub = subordinates.find((s) => s.id === activeFilter);
    return sub?.name ?? "Select";
  }, [activeFilter, subordinates]);

  // Map state
  const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredStore, setHoveredStore] = useState<{
    store: StoreEntry;
    x: number;
    y: number;
  } | null>(null);

  // Detail panel
  const [detailStore, setDetailStore] = useState<StoreEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const mapRef = useRef<SVGSVGElement>(null);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/executive/alignment-index");
        const json: ApiResponse = await res.json();
        if (json.success) {
          setSelfData(json.self);
          setSubordinates(json.subordinates ?? []);
          setHasSubordinates((json.subordinates ?? []).length > 0);
        }
      } catch (err) {
        console.error("Failed to load alignment index:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── Active stores based on filter ──────────────────────────────────────────
  const activeStores = useMemo((): StoreEntry[] => {
    if (!selfData) return [];

    const selfStores: StoreEntry[] = (selfData.stores ?? []).map((s) => ({
      ...s,
      ownerName: selfData.name,
      isSelf: true,
    }));

    if (activeFilter === "self") return selfStores;

    if (activeFilter !== "all") {
      const sub = subordinates.find((s) => s.id === activeFilter);
      return (sub?.stores ?? []).map((s) => ({
        ...s,
        ownerName: sub?.name,
        isSelf: false,
      }));
    }

    // "all" — merge self + all subordinates, dedup by id
    const combined = new Map<string, StoreEntry>();
    selfStores.forEach((s) => combined.set(s.id, s));
    subordinates.forEach((sub) => {
      (sub.stores ?? []).forEach((s) => {
        if (!combined.has(s.id)) {
          combined.set(s.id, { ...s, ownerName: sub.name, isSelf: false });
        }
      });
    });
    return Array.from(combined.values());
  }, [selfData, subordinates, activeFilter]);

  // ── Search filtered stores (for All view) ──────────────────────────────────
  const searchedStores = useMemo(() => {
    if (!searchQuery.trim()) return activeStores;
    const q = searchQuery.toLowerCase();
    return activeStores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q)
    );
  }, [activeStores, searchQuery]);

  // ── State color map for the India map ──────────────────────────────────────
  const stateColorMap = useMemo(() => {
    const agg: Record<string, { total: number; count: number }> = {};
    activeStores.forEach((store) => {
      const stateKey = store.state
        ?.toLowerCase()
        .replace("&", "and")
        .replace("pondicherry", "puducherry")
        .replace(/\bdiu\b/, "daman and diu")
        .trim();
      const id = stateKey ? NAME_TO_ID[stateKey] : undefined;
      if (id) {
        if (!agg[id]) agg[id] = { total: 0, count: 0 };
        agg[id].total += store.score;
        agg[id].count += 1;
      }
    });

    const map: Record<string, string> = {};
    Object.entries(agg).forEach(([id, { total, count }]) => {
      map[id] = getStateColor(Math.round(total / count));
    });
    return map;
  }, [activeStores]);

  // ── Top metrics ─────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const stores = activeStores;
    if (!stores.length) return { coverage: 0, critical: 0, optimal: 0 };
    return {
      coverage: Math.round(
        stores.reduce((a, s) => a + s.score, 0) / stores.length
      ),
      critical: stores.filter((s) => s.score < 50).length,
      optimal: stores.filter((s) => s.score >= 80).length,
    };
  }, [activeStores]);

  // ── Map handlers ────────────────────────────────────────────────────────────
  const handleZoomIn = () =>
    setViewState((prev) => {
      const ns = Math.min(prev.scale + 0.12, 5);
      const r = ns / prev.scale;
      return { scale: ns, x: 350 - (350 - prev.x) * r, y: 450 - (450 - prev.y) * r };
    });

  const handleZoomOut = () =>
    setViewState((prev) => {
      const ns = Math.max(prev.scale - 0.12, 0.5);
      const r = ns / prev.scale;
      return { scale: ns, x: 350 - (350 - prev.x) * r, y: 450 - (450 - prev.y) * r };
    });

  const handleReset = () => setViewState({ scale: 1, x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewState.x, y: e.clientY - viewState.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setViewState((prev) => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  // ── Open store detail ───────────────────────────────────────────────────────
  const openDetail = async (store: StoreEntry) => {
    // Optimistically show from local data
    setDetailStore(store);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/executive/alignment-index?storeId=${encodeURIComponent(store.id)}`
      );
      const json = await res.json();
      if (json.success) {
        setDetailStore({ ...store, ...json.data });
      }
    } catch (err) {
      console.error("Error fetching store detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="exec-ai-container"
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
        }}
      >
        <div className="exec-ai-bg-grid" />
        <div className="exec-ai-loader" />
        <p
          style={{
            color: "var(--neon-blue)",
            fontSize: "0.8rem",
            letterSpacing: "3px",
            textTransform: "uppercase",
            animation: "exec-ai-pulse-op 2s infinite",
          }}
        >
          Initialising alignment matrix...
        </p>
      </div>
    );
  }

  // ── No subordinates ──────────────────────────────────────────────────────────
  if (!hasSubordinates) {
    return (
      <div className="exec-ai-container">
        <div className="exec-ai-bg-grid" />
        <div className="exec-ai-bg-glow" />
        <div className="exec-ai-empty-state">
          <div className="exec-ai-empty-icon">
            <Users size={32} />
          </div>
          <h3>No Junior Executives Mapped</h3>
          <p>
            Your account does not have any subordinate executives linked yet.
            This view becomes available once junior executives are mapped to
            you.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="exec-ai-container"
      style={{
        paddingRight: detailStore ? "min(440px, 32%)" : undefined,
        transition: "padding-right 0.4s cubic-bezier(0.2,0.8,0.2,1)",
      }}
    >
      <div className="exec-ai-bg-grid" />
      <div className="exec-ai-bg-glow" />

      {/* ── Header ── */}
      <div className="exec-ai-header">
        <div className="exec-ai-header-left">
          <div className="exec-ai-title-block">
            <div className="exec-ai-icon-box">
              <Hexagon className="exec-ai-icon-hex" />
              <BarChart2 className="exec-ai-icon-nav" />
            </div>
            <div>
              <h1 className="exec-ai-title">
                ALIGNMENT <span className="highlight">INDEX</span>
              </h1>
              <p className="exec-ai-subtitle">MANAGER INTELLIGENCE VIEW</p>
            </div>
          </div>

          {/* Stats */}
          <div className="exec-ai-stats-panel">
            <div className="exec-ai-stat-bloc">
              <span className="exec-ai-stat-val">{metrics.coverage}%</span>
              <span className="exec-ai-stat-lbl">COVERAGE</span>
            </div>
            <div className="exec-ai-stat-sep" />
            <div className="exec-ai-stat-bloc">
              <span className="exec-ai-stat-val text-alert">
                {metrics.critical}
              </span>
              <span className="exec-ai-stat-lbl">CRITICAL</span>
            </div>
            <div className="exec-ai-stat-sep" />
            <div className="exec-ai-stat-bloc">
              <span className="exec-ai-stat-val text-success">
                {metrics.optimal}
              </span>
              <span className="exec-ai-stat-lbl">OPTIMAL</span>
            </div>
          </div>
        </div>

        {/* Total store count */}
        <div
          style={{
            fontSize: "0.7rem",
            color: "var(--hud-text-dim)",
            textAlign: "right",
            letterSpacing: "0.5px",
          }}
        >
          <span style={{ color: "#fff", fontWeight: 700, fontSize: "1.1rem" }}>
            {activeStores.length}
          </span>
          <br />
          STORES IN VIEW
        </div>
      </div>

      {/* ── Sub Header: toggles + filters + legend ── */}
      <div className="exec-ai-sub-header">
        {/* View toggle */}
        <div className="exec-ai-view-toggle">
          <button
            className={`exec-ai-toggle-btn ${viewMode === "map" ? "active" : ""}`}
            onClick={() => setViewMode("map")}
          >
            MAP VIEW
          </button>
          <button
            className={`exec-ai-toggle-btn ${viewMode === "all" ? "active" : ""}`}
            onClick={() => setViewMode("all")}
          >
            ALL VIEW
          </button>
        </div>

        {/* Subordinate filter dropdown */}
        <div className="exec-ai-filter-dropdown-wrap" ref={filterDropdownRef}>
          <span className="exec-ai-filter-label" style={{ marginRight: "8px" }}>Filter:</span>
          <button
            className={`exec-ai-filter-trigger ${filterDropdownOpen ? "open" : ""}`}
            onClick={() => setFilterDropdownOpen((p) => !p)}
          >
            <User size={13} style={{ opacity: 0.7 }} />
            <span>{getFilterLabel()}</span>
            <ChevronDown
              size={13}
              className="exec-ai-filter-chevron"
              style={{ transform: filterDropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {filterDropdownOpen && (
            <div className="exec-ai-filter-menu">
              {/* All Combined */}
              <button
                className={`exec-ai-filter-option ${activeFilter === "all" ? "active" : ""}`}
                onClick={() => { setActiveFilter("all"); setFilterDropdownOpen(false); }}
              >
                <span className="exec-ai-filter-option-dot all" />
                All Combined
                <span className="exec-ai-filter-option-count">
                  {activeStores.length} stores
                </span>
              </button>

              {/* My Stores */}
              <button
                className={`exec-ai-filter-option ${activeFilter === "self" ? "active" : ""}`}
                onClick={() => { setActiveFilter("self"); setFilterDropdownOpen(false); }}
              >
                <span className="exec-ai-filter-option-dot self" />
                My Stores
                <span className="exec-ai-filter-option-count">
                  {selfData?.stores?.length ?? 0} stores
                </span>
              </button>

              {subordinates.length > 0 && (
                <div className="exec-ai-filter-divider">
                  <span>Juniors</span>
                </div>
              )}

              {/* Each subordinate */}
              {subordinates.map((sub) => (
                <button
                  key={sub.id}
                  className={`exec-ai-filter-option ${activeFilter === sub.id ? "active" : ""}`}
                  onClick={() => { setActiveFilter(sub.id); setFilterDropdownOpen(false); }}
                >
                  <span className="exec-ai-filter-option-dot junior" />
                  {sub.name}
                  <span className="exec-ai-filter-option-count">
                    {sub.stores?.length ?? 0} stores
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="exec-ai-legend">
          <div className="exec-ai-legend-entry">
            <span className="exec-ai-marker-dot high" />
            OPTIMAL
          </div>
          <div className="exec-ai-legend-entry">
            <span className="exec-ai-marker-dot medium" />
            MODERATE
          </div>
          <div className="exec-ai-legend-entry">
            <span className="exec-ai-marker-dot low" />
            CRITICAL
          </div>
        </div>
      </div>

      {/* ── Map View ── */}
      {viewMode === "map" && (
        <div className="exec-ai-map-frame">
          <div className="exec-ai-map-controls">
            <button className="exec-ai-hud-btn" onClick={handleReset} title="Reset">
              <Home size={17} />
            </button>
            <div className="exec-ai-zoom-stack">
              <button className="exec-ai-hud-btn" onClick={handleZoomIn} title="Zoom In">
                <ZoomIn size={17} />
              </button>
              <button className="exec-ai-hud-btn" onClick={handleZoomOut} title="Zoom Out">
                <ZoomOut size={17} />
              </button>
            </div>
          </div>

          <div
            className="exec-ai-map-viewport"
            style={{ cursor: isDragging ? "grabbing" : "grab", overflow: "hidden" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <IndiaMap
              ref={mapRef}
              viewBox="-50 -50 750 950"
              className="exec-ai-interactive-svg"
              stateColors={stateColorMap}
              onStateHover={() => {}}
              onStateClick={() => {}}
              style={{
                transform: `translate(${viewState.x}px,${viewState.y}px) scale(${viewState.scale})`,
                transition: isDragging
                  ? "none"
                  : "transform 0.8s cubic-bezier(0.2,0.8,0.2,1)",
              }}
            >
              {activeStores.map((store) => (
                <g
                  key={store.id}
                  className="exec-ai-marker-group"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetail(store);
                  }}
                  onMouseEnter={(e) =>
                    setHoveredStore({ store, x: e.clientX, y: e.clientY })
                  }
                  onMouseLeave={() => setHoveredStore(null)}
                >
                  <circle
                    cx={store.x}
                    cy={store.y}
                    r="6"
                    className={`exec-ai-dot ${store.alignment}`}
                  />
                  <text
                    x={store.x}
                    y={store.y + 15}
                    textAnchor="middle"
                    className="exec-ai-marker-label"
                    style={{
                      opacity: viewState.scale > 1.8 ? 1 : 0,
                      fontSize: `${11 / viewState.scale}px`,
                    }}
                  >
                    {store.city}
                  </text>
                </g>
              ))}
            </IndiaMap>
          </div>

          {/* Hover tooltip */}
          {hoveredStore && (
            <div
              className="exec-ai-tooltip"
              style={{
                left: hoveredStore.x + 14,
                top: hoveredStore.y + 14,
              }}
            >
              <div className="exec-ai-tooltip-title">
                {hoveredStore.store.name}
              </div>
              <div className="exec-ai-tooltip-meta">
                {hoveredStore.store.city} · {hoveredStore.store.state}
              </div>
              <div
                style={{
                  marginTop: "6px",
                  fontWeight: 700,
                  color: getStateColor(hoveredStore.store.score, true),
                  fontSize: "0.85rem",
                }}
              >
                {hoveredStore.store.score}% Aligned
              </div>
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "0.65rem",
                  color: "var(--hud-text-dim)",
                }}
              >
                {hoveredStore.store.isSelf
                  ? "My Store"
                  : `Junior: ${hoveredStore.store.ownerName}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── All View ── */}
      {viewMode === "all" && (
        <div className="exec-ai-all-view">
          <div className="exec-ai-search-bar">
            <input
              type="text"
              placeholder="Search by store name, city or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="exec-ai-search-input"
            />
          </div>
          <div className="exec-ai-store-grid">
            {searchedStores.length === 0 ? (
              <div className="exec-ai-no-results">
                No stores found matching your search.
              </div>
            ) : (
              searchedStores.map((store) => (
                <div
                  key={store.id}
                  className="exec-ai-store-card"
                  onClick={() => openDetail(store)}
                >
                  <div className="exec-ai-card-top">
                    <div>
                      <div className="exec-ai-card-name">{store.name}</div>
                      <div className="exec-ai-card-meta">
                        {store.city} · {store.state}
                      </div>
                    </div>
                    <span
                      className={`exec-ai-score-pill ${store.alignment}`}
                    >
                      {store.score}%
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      className={`exec-ai-type-badge ${
                        store.storeType === "Croma"
                          ? "croma"
                          : store.storeType === "Vijay Sales"
                          ? "vijay-sales"
                          : "reliance"
                      }`}
                    >
                      {store.storeType}
                    </span>
                    <div className="exec-ai-card-owner">
                      <span
                        className={`exec-ai-owner-dot ${
                          store.isSelf ? "self" : ""
                        }`}
                      />
                      {store.isSelf ? "My Store" : store.ownerName}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Detail Panel ── */}
      <div className={`exec-ai-detail-panel ${detailStore ? "open" : ""}`}>
        {detailStore && (
          <StoreDetailPanel
            store={detailStore}
            onClose={() => setDetailStore(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ExecutiveAlignmentIndexPage;
