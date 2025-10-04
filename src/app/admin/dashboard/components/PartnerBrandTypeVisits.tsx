"use client";

import React, { useEffect, useMemo, useState } from "react";

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

const PartnerBrandTypeVisits: React.FC = () => {
  // Local date filter and brand filter (independent of global)
  const [range, setRange] = useState<LocalRange>("30d");
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandId, setBrandId] = useState<string>(""); // empty = all brands

  const [stats, setStats] = useState<TypeStat[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // type keys expanded

  // Fetch brands for the dropdown
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/stores/filters", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load brands");
        const data = await res.json();
        const list: BrandOption[] = (data.brands || []).map((b: any) => ({ id: b.id, name: b.name }));
        if (!ignore) {
          setBrands(list);
          // Default brand: Samsung (case-insensitive). Fallback to first brand if Samsung not found.
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

  // Fetch stats whenever brand or range changes (after we have brandId or allow empty)
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (brandId) params.set("brandId", brandId);
        params.set("range", range);
        const res = await fetch(`/api/admin/analytics/partner-brand-type-visits?${params.toString()}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load partner brand type stats");
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
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, background: "#fff", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
          Partner Brand Type Visits
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={brandId}
            onChange={e => setBrandId(e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}
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
            style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}
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
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {orderedStats.map((s) => {
              const label = typeLabels[s.type];
              const key = s.type;
              const total = s.totalStores || 0;
              const visited = s.visitedUniqueStores || 0;
              const pct = total > 0 ? Math.round((visited / total) * 100) : 0;
              const isOpen = expanded.has(key);
              return (
                <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, color: "#374151" }}>{label}</div>
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
                      {"/"}{total} Unique Store visits
                    </span>
                  </div>
                  <div style={{ marginTop: 8, height: 8, background: "#f3f4f6", borderRadius: 999 }}>
                    <div style={{ width: `${pct}%`, height: 8, background: "#10b981", borderRadius: 999 }} />
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 10, maxHeight: 220, overflowY: "auto", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                      {s.unvisitedStores.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: 13 }}>All stores visited in this range.</div>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {s.unvisitedStores.map(u => (
                            <li key={u.id} style={{ margin: "6px 0" }}>
                              <a
                                href={`/admin/executives?storeId=${encodeURIComponent(u.id)}&dateFilter=${encodeURIComponent(range === "today" ? "Today" : range === "7d" ? "Last 7 Days" : "Last 30 Days")}`}
                                style={{ color: "#2563eb", textDecoration: "none" }}
                                title="Open visit report"
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
        </div>
      )}
    </div>
  );
};

export default PartnerBrandTypeVisits;