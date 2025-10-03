"use client";

import React, { useEffect, useMemo, useState } from "react";
import "./partner-brand-type-visits.css";

interface BrandOption { id: string; name: string }
interface TypeStat {
  type: "A_PLUS" | "A" | "B" | "C" | "D";
  totalStores: number;
  visitedUniqueStores: number;
  unvisitedStores: { id: string; name: string }[];
}

type LocalRange = "today" | "7d" | "30d";

const typeLabels: Record<TypeStat["type"], string> = {
  A_PLUS: "A+",
  A: "A",
  B: "B",
  C: "C",
  D: "D",
};

const PartnerBrandTypeVisitsExec: React.FC = () => {
  const [range, setRange] = useState<LocalRange>("30d");
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandId, setBrandId] = useState<string>("");

  const [stats, setStats] = useState<TypeStat[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Load brands (executive scope)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/executive/brands", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load brands");
        const data = await res.json();
        const list: BrandOption[] = (data.data || []).map((b: any) => ({ id: b.id, name: b.brandName }));
        if (!ignore) {
          setBrands(list);
          if (!brandId && list.length > 0) {
            const samsung = list.find((b) => b.name?.toLowerCase() === "samsung");
            setBrandId(samsung?.id || list[0].id);
          }
        }
      } catch (e: any) {
        if (!ignore) setError(e?.message || "Failed to load brands");
      }
    })();
    return () => { ignore = true; };
  }, []);

  // Load stats - executive scoped API
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (brandId) params.set("brandId", brandId);
        params.set("range", range);
        const res = await fetch(`/api/executive/analytics/partner-brand-type-visits?${params.toString()}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load type stats");
        const data = await res.json();
        if (!ignore) setStats(data.data as TypeStat[]);
      } catch (e: any) {
        if (!ignore) setError(e?.message || "Failed to load stats");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [brandId, range]);

  const toggleExpand = (typeKey: TypeStat["type"]) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(typeKey)) next.delete(typeKey); else next.add(typeKey);
      return next;
    });
  };

  const orderedStats = useMemo(() => {
    if (!stats) return [] as TypeStat[];
    const order: TypeStat["type"][] = ["A_PLUS", "A", "B", "C", "D"];
    const map = new Map(stats.map(s => [s.type, s]));
    return order.map(t => map.get(t) || { type: t, totalStores: 0, visitedUniqueStores: 0, unvisitedStores: [] });
  }, [stats]);

  return (
    <div className="pbtype-card">
      <div className="pbtype-header">
        <div className="pbtype-controls">
          <select
            value={brandId}
            onChange={e => setBrandId(e.target.value)}
            className="pbtype-select"
            aria-label="Filter by brand"
          >
            {brands.length === 0 ? (
              <option value="">Loading brands...</option>
            ) : (
              brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))
            )}
          </select>
          <select
            value={range}
            onChange={e => setRange(e.target.value as LocalRange)}
            className="pbtype-select"
            aria-label="Date range"
          >
            <option value="30d">Last 30 Days</option>
            <option value="7d">Last 7 Days</option>
            <option value="today">Today</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", padding: 10, borderRadius: 6, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 20, color: "#6b7280" }}>Loading...</div>
      ) : (
        <div className="pbtype-grid">
          {orderedStats.map((s) => {
            const label = typeLabels[s.type];
            const key = s.type;
            const total = s.totalStores || 0;
            const visited = s.visitedUniqueStores || 0;
            const pct = total > 0 ? Math.round((visited / total) * 100) : 0;
            const isOpen = expanded.has(key);
            return (
              <div key={key} className="pbtype-tile">
                <div className="pbtype-row">
                  <div className="pbtype-label">{label}</div>
                  <button
                    onClick={() => toggleExpand(key)}
                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 600 }}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? "Hide" : "View Unvisited Stores"}
                  </button>
                </div>
                <div style={{ marginTop: 8, color: "#111827", fontSize: 14 }}>
                  <span style={{ fontWeight: 700 }}>{visited}</span>
                  <span style={{ color: "#6b7280" }}>
                    {" / "}{total} Unique Store visits
                  </span>
                </div>
                <div className="pbtype-meter">
                  <div style={{ width: `${pct}%` }} />
                </div>
                {isOpen && (
                  <div className="pbtype-unvisited">
                    {s.unvisitedStores.length === 0 ? (
                      <div style={{ color: "#6b7280", fontSize: 13 }}>All assigned stores visited in this range.</div>
                    ) : (
                      <ul>
                        {s.unvisitedStores.map(u => (
                          <li key={u.id}>
                            <a
                              href={`/executive/visit-history?storeId=${encodeURIComponent(u.id)}`}
                              style={{ color: "#2563eb", textDecoration: "none" }}
                              title="Open visit history"
                            >
                              {u.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
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

export default PartnerBrandTypeVisitsExec;
