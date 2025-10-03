"use client";

import React, { useEffect, useMemo, useState } from "react";

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>{label}: {value.toLocaleString()}</div>
      <div style={{ background: "#eee", height: 8, borderRadius: 4 }}>
        <div style={{ width: `${width}%`, height: 8, background: "#059669", borderRadius: 4 }} />
      </div>
    </div>
  );
}

const brandOptions = [
  { value: "A", label: "Brand A (Before: -7d, After: +7d)" },
  { value: "A+", label: "Brand A+ (Before: -3d, After: +3d)" },
  { value: "B", label: "Brand B (Before: -10d, After: +10d)" },
  { value: "C", label: "Brand C (Before: -15d, After: +15d)" },
  { value: "D", label: "Brand D (Before: -30d, After: +30d)" },
];

export default function ExecutiveAnalyticsImpactPage() {
  const [brand, setBrand] = useState<string>("A");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);

  const maxSales = useMemo(() => {
    return data.reduce((m, r) => Math.max(m, r.salesBefore, r.salesAfter), 0);
  }, [data]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/analytics/impact?brand=${encodeURIComponent(brand)}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Failed with status ${res.status}`);
      }
      const j = await res.json();
      setData(j.data || []);
      setSummary(j.summary || null);
    } catch (e: any) {
      setError(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Analytics & Impact</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <label style={{ fontWeight: 600 }}>Brand Window</label>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
          {brandOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Avg % Sales Lift</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{summary ? `${summary.avgSalesLiftPct}%` : "-"}</div>
        </div>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Improved vs Not</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{summary ? `${summary.storesImproved} / ${summary.storesNotImproved}` : "-"}</div>
        </div>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Avg Incentive Change</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{summary ? `${summary.incentiveChangeAvgPct}%` : "-"}</div>
        </div>
      </div>

      {error && (
        <div style={{ color: "#b91c1c", marginBottom: 8 }}>Error: {error}</div>
      )}
      {loading && <div>Loading...</div>}

      {/* Stores list */}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((r) => (
          <div key={r.storeId} style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.store}</div>
                <div style={{ fontSize: 12, color: "#666" }}>Last Visit: {r.lastVisit} • Brand: {r.brand}</div>
              </div>
              <div style={{ fontWeight: 700, color: r.salesAfter - r.salesBefore >= 0 ? "#065f46" : "#b91c1c" }}>{r.salesImpact}</div>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Sales</div>
              <Bar label="Before" value={r.salesBefore} max={maxSales} />
              <Bar label="After" value={r.salesAfter} max={maxSales} />
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 13 }}>
              <div>Issues: Raised <strong>{r.issues.raisedBefore}</strong>, Resolved <strong>{r.issues.resolvedAfter}</strong>, Pending <strong>{r.issues.pendingAfter}</strong></div>
              <div>Incentives: <strong>{r.incentives.before}</strong> → <strong>{r.incentives.after}</strong></div>
              <div>Visits: Completed <strong>{r.visits.completedAfter}</strong> • Missed <strong>{r.visits.missedAfter}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
