"use client";

import React, { useEffect, useMemo, useState } from "react";

function Sparkline({ points, width = 320, height = 60, color = '#059669' }: { points: Array<{ date: string; revenue: number }>; width?: number; height?: number; color?: string }) {
  const max = Math.max(1, ...points.map(p => Number(p.revenue || 0)));
  const min = Math.min(0, ...points.map(p => Number(p.revenue || 0)));
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const stepX = points.length > 1 ? w / (points.length - 1) : w;
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * h;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * stepX} ${pad + y(Number(p.revenue || 0))}`).join(' ');
  return (
    <svg width={width} height={height} role="img" aria-label="revenue trend">
      <polyline fill="none" stroke={color} strokeWidth="2" points="" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

const weekOptions = [
  { value: "current", label: "Current Week" },
  { value: "previous", label: "Previous Week" },
];

export default function ExecutiveAnalyticsImpactPage() {
  const [week, setWeek] = useState<string>("current");
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [pbt, setPbt] = useState<string>('A+');

  const maxSales = useMemo(() => {
    return data.reduce((m, r) => Math.max(m, r.salesBefore, r.salesAfter), 0);
  }, [data]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ week, pbt });
      const res = await fetch(`/api/analytics/impact?${params.toString()}`, { cache: "no-store" });
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
  }, [week, pbt]);

  return (
    <div style={{ padding: 16 }}>

      {/* Filters Section */}
      <div>
        <div style={{ marginBottom: 6 }}>
          <h3
            onClick={() => setIsFiltersVisible(v => !v)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}
          >
            Filters
            <span style={{ transform: isFiltersVisible ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
          </h3>
        </div>
        {isFiltersVisible && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            padding: 12,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#f8fafc',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Week</label>
              <select value={week} onChange={(e) => setWeek(e.target.value)} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                {weekOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Partner Brand Type</label>
              <select value={pbt} onChange={(e) => setPbt(e.target.value)} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                {['A+','A','B','C','D'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        {/* Dynamic Avg % Sales Lift */}
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          {(() => {
            const v = Number(summary?.avgSalesLiftPct ?? 0);
            const up = v >= 0;
            const label = 'Avg. % Sales Change';
            const color = up ? '#065f46' : '#b91c1c';
            return (
              <>
                <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {label}
                  <span style={{ color }}>{up ? '↑' : '↓'}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color }}>{Math.abs(v)}%</div>
              </>
            );
          })()}
        </div>

        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Improved vs Not</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{summary ? `${summary.storesImproved} / ${summary.storesNotImproved}` : "-"}</div>
        </div>

        {/* Dynamic Avg. Revenue delta */}
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          {(() => {
            const v = Number(summary?.avgRevenue ?? 0); // average (after - before)
            const up = v >= 0;
            const label = 'Avg. Revenue Change';
            const color = up ? '#065f46' : '#b91c1c';
            return (
              <>
                <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {label}
                  <span style={{ color }}>{up ? '↑' : '↓'}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color }}>{Math.abs(v).toLocaleString()}</div>
              </>
            );
          })()}
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
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Revenue (±7 days)</div>
              <Sparkline points={(r.trend?.points || []).map((p: any) => ({ date: p.date, revenue: p.revenue }))} />
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 13 }}>
              <div>Visits: Completed <strong>{r.visits.completedAfter}</strong> • Missed <strong>{r.visits.missedAfter}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
