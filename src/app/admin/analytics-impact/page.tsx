"use client";

import React, { useEffect, useMemo, useState } from "react";
<<<<<<< HEAD

// Lightweight UI without external chart libs
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>{label}: {value.toLocaleString()}</div>
      <div style={{ background: "#eee", height: 8, borderRadius: 4 }}>
        <div style={{ width: `${width}%`, height: 8, background: "#4f46e5", borderRadius: 4 }} />
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

export default function AdminAnalyticsImpactPage() {
  const [brand, setBrand] = useState<string>("A");
=======
import { WeekFilter } from "@/components/WeekFilter";
import { getCurrentWeekValue } from "@/lib/weekUtils";

// Lightweight Sparkline without libs
function Sparkline({ points, width = 360, height = 140, color = '#4f46e5', highlightDate }: { points: Array<{ date: string; revenue: number; displayDate?: string }>; width?: number; height?: number; color?: string; highlightDate?: string }) {
  const revenues = points.map(p => Number(p.revenue || 0));
  const max = Math.max(1, ...revenues);
  const min = Math.min(0, ...revenues);
  const pad = 34; // room for axes labels and rotated x-labels
  // Ensure a minimum horizontal spacing between points to avoid label overlap
  const minStepX = 30; // pixels between consecutive points
  const svgWidth = Math.max(width, pad * 2 + Math.max(0, points.length - 1) * minStepX);
  const w = svgWidth - pad * 2;
  const h = height - pad * 2;

  // helpers (declared early so they can be used below)
  const fmtNum = (n: number) => Number(n).toLocaleString();
  const fmtDateLabel = (date?: string, display?: string) => {
    const candidates = [date, display].filter(Boolean) as string[];
    for (const s of candidates) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}-${mm}`; // DD-MM
      }
      // Try ISO (YYYY-MM-DD)
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const mm = m[2];
        const dd = m[3];
        return `${dd}-${mm}`; // DD-MM
      }
      // Try DD-MM-YYYY
      m = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
      if (m) {
        const dd = m[1];
        const mm = m[2];
        return `${dd}-${mm}`; // DD-MM
      }
    }
    return display || date || '';
  };

  // Full date format DD-MM-YY
  const fmtDateLabelFull = (date?: string, display?: string) => {
    const candidates = [date, display].filter(Boolean) as string[];
    for (const s of candidates) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${dd}-${mm}-${yy}`;
      }
      // Try ISO (YYYY-MM-DD)
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const yy = m[1].slice(-2);
        const mm = m[2];
        const dd = m[3];
        return `${dd}-${mm}-${yy}`;
      }
      // Try DD-MM-YYYY
      m = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
      if (m) {
        const dd = m[1];
        const mm = m[2];
        const yy = m[3].slice(-2);
        return `${dd}-${mm}-${yy}`;
      }
    }
    return display || date || '';
  };

  const normalizeDate = (s?: string) => {
    if (!s) return '';
    // ISO
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // DD-MM-YYYY
    m = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const yy = String(d.getFullYear());
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    return s;
  };

  // Measure label widths to avoid overlaps
  const getMeasureCtx = (() => {
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    return () => {
      if (!canvas) canvas = document.createElement('canvas');
      if (!ctx) ctx = canvas.getContext('2d');
      return ctx;
    };
  })();
  const labelFont = '9px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const measureTextWidth = (text: string) => {
    const ctx = getMeasureCtx();
    if (ctx) {
      ctx.font = labelFont;
      const m = ctx.measureText(text);
      return Math.ceil(m.width);
    }
    // Fallback: rough estimate ~5.2px per char
    return Math.ceil(text.length * 5.2);
  };

  const valueLabels = points.map(p => fmtNum(Number(p.revenue || 0)));
  const valueLabelWidths = valueLabels.map(measureTextWidth);

  // Hover state for custom tooltip
  const [hover, setHover] = useState<number | null>(null);

  // Build per-gap step to avoid label overlap: half width of neighbors + margin
  const baseMinStep = minStepX;
  const labelMargin = 8; // extra space
  const steps: number[] = [];
  for (let i = 0; i < Math.max(0, points.length - 1); i++) {
    const needed = Math.ceil((valueLabelWidths[i] + valueLabelWidths[i + 1]) / 2) + labelMargin;
    steps.push(Math.max(baseMinStep, needed));
  }

  // Recompute svg width if dynamic steps require more space
  const dynamicWidth = pad * 2 + steps.reduce((a, b) => a + b, 0);
  const finalSvgWidth = Math.max(svgWidth, dynamicWidth);
  const finalW = finalSvgWidth - pad * 2;

  // Compute x positions using cumulative steps; if width is larger, distribute extra evenly
  const xPos: number[] = [];
  if (points.length <= 1) {
    xPos.push(pad);
  } else {
    const sumSteps = steps.reduce((a, b) => a + b, 0);
    const extra = finalW - sumSteps;
    const bonusPerGap = extra > 0 ? extra / steps.length : 0;
    let acc = pad;
    xPos.push(acc);
    for (let i = 0; i < steps.length; i++) {
      acc += steps[i] + bonusPerGap;
      xPos.push(acc);
    }
  }

  const yScale = (v: number) => h - ((v - min) / (max - min || 1)) * h;

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xPos[i] ?? pad} ${pad + yScale(Number(p.revenue || 0))}`)
    .join(' ');

  // Determine which point corresponds to the provided highlightDate (last visit)
  const highlightIso = normalizeDate(highlightDate);
  const highlightIdx = highlightIso ? points.findIndex(p => normalizeDate(p.date || p.displayDate) === highlightIso) : -1;

  return (
    <svg width={finalSvgWidth} height={height} role="img" aria-label="revenue trend">
      {/* Axes */}
      <line x1={pad} y1={pad} x2={pad} y2={pad + h} stroke="#94a3b8" strokeWidth="1" />
      <line x1={pad} y1={pad + h} x2={pad + finalW} y2={pad + h} stroke="#94a3b8" strokeWidth="1" />

      {/* Only show a single, non-rotated label for the last visit date */}
      {highlightIdx >= 0 && (
        <g key="x-highlight">
          <line x1={xPos[highlightIdx] ?? pad} y1={pad + h} x2={xPos[highlightIdx] ?? pad} y2={pad + h + 4} stroke="#94a3b8" />
          <text x={xPos[highlightIdx] ?? pad} y={pad + h + 12} fontSize="10" textAnchor="middle" fill="#64748b">
            {fmtDateLabelFull(points[highlightIdx]?.date, points[highlightIdx]?.displayDate)}
          </text>
        </g>
      )}

      {/* Line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2" />

      {/* Data point markers and value labels */}
      {points.map((p, i) => {
        const x = xPos[i] ?? pad;
        const val = Number(p.revenue || 0);
        const y = pad + yScale(val);
        // Stagger labels a bit to reduce collisions
        const yLabel = Math.max(pad + 10, y - (i % 2 === 0 ? 12 : 4));
        const label = valueLabels[i];
        return (
          <g key={`pt-${i}`} style={{ cursor: 'pointer' }}>
            <title>{fmtDateLabelFull(p.date, p.displayDate)}</title>
            {/* Invisible hover area to capture pointer and show tooltip */}
            <circle cx={x} cy={y} r={10} fill="transparent" pointerEvents="all" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(prev => (prev === i ? null : prev))} />
            <circle cx={x} cy={y} r={2.5} fill={color} />
            {/* outline for readability (do not intercept pointer) */}
            <text x={x} y={yLabel} fontSize="9" textAnchor="middle" stroke="#ffffff" strokeWidth="3" fill="#ffffff" style={{ pointerEvents: 'none' }}>{label}</text>
            <text x={x} y={yLabel} fontSize="9" textAnchor="middle" fill="#334155" style={{ pointerEvents: 'none' }}>{label}</text>
          </g>
        );
      })}

      {/* Custom tooltip showing date near the hovered point */}
      {hover !== null && hover >= 0 && hover < points.length && (() => {
        const i = hover as number;
        const x = xPos[i] ?? pad;
        const val = Number(points[i]?.revenue || 0);
        const y = pad + yScale(val);
        const text = fmtDateLabelFull(points[i]?.date, points[i]?.displayDate);
        const tw = measureTextWidth(text);
        const bx = x - (tw / 2) - 6;
        const by = Math.max(pad + 8, y - 24);
        return (
          <g pointerEvents="none">
            <rect x={bx} y={by - 10} width={tw + 12} height={18} rx={4} ry={4} fill="#111827" opacity="0.9" />
            <text x={x} y={by + 2} fontSize="10" textAnchor="middle" fill="#ffffff">{text}</text>
          </g>
        );
      })()}
    </svg>
  );
}

export default function AdminAnalyticsImpactPage() {
  const [week, setWeek] = useState<string>(getCurrentWeekValue());
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(true);
>>>>>>> e626c1b83d9cdb61d7ec524c2adb7e0c5165d364
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
<<<<<<< HEAD
=======
  const [pbt, setPbt] = useState<string>('All');
  const [brandId, setBrandId] = useState<string>('All');
  const [execId, setExecId] = useState<string>('All');
  const [executives, setExecutives] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
>>>>>>> e626c1b83d9cdb61d7ec524c2adb7e0c5165d364

  const maxSales = useMemo(() => {
    return data.reduce((m, r) => Math.max(m, r.salesBefore, r.salesAfter), 0);
  }, [data]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
<<<<<<< HEAD
      const res = await fetch(`/api/analytics/impact?brand=${encodeURIComponent(brand)}`, { cache: "no-store" });
=======
      // Clear current data so stale content isn't shown while loading
      setData([]);
      setSummary(null);
      const params = new URLSearchParams({ week, pbt });
      if (execId && execId !== 'All') params.set('executiveId', execId);
      if (brandId && brandId !== 'All') params.set('brandId', brandId);
      const res = await fetch(`/api/analytics/impact?${params.toString()}`, { cache: "no-store" });
>>>>>>> e626c1b83d9cdb61d7ec524c2adb7e0c5165d364
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
<<<<<<< HEAD
  }, [brand]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Analytics & Impact</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <label style={{ fontWeight: 600 }}>Brand Window</label>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
          {brandOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Avg % Sales Lift After Visits</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{summary ? `${summary.avgSalesLiftPct}%` : "-"}</div>
        </div>
        <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Stores Improved vs Not Improved</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{summary ? `${summary.storesImproved} / ${summary.storesNotImproved}` : "-"}</div>
        </div>
        <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Avg Incentive Change</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{summary ? `${summary.incentiveChangeAvgPct}%` : "-"}</div>
        </div>
=======
  }, [week, pbt, brandId, execId]);
 // Load filter lists (executives and brands)
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await fetch('/api/admin/stores/filters', { cache: 'no-store' });
        const j = await res.json();
        setExecutives((j.executives || []).map((e: any) => ({ id: e.id, name: e.name })));
        setBrands((j.brands || []).map((b: any) => ({ id: b.id, name: b.name })));
      } catch (e) {
        // swallow errors
      }
    };
    loadFilters();
  }, []);

  return (
    <div style={{ padding: 24 }}>

      {/* Filters Section */}
      <div>
        <div style={{ marginBottom: 8 }}>
          <h3
            onClick={() => setIsFiltersVisible(v => !v)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
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
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <WeekFilter
                value={week}
                onChange={setWeek}
                weeksCount={8}
                label="Week"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Category (Cat)</label>
              <select value={pbt} onChange={(e) => setPbt(e.target.value)} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                {['All','A+','A','B','C','D'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Brand</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                <option value="All">All Brands</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Executive</label>
              <select value={execId} onChange={(e) => setExecId(e.target.value)} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                <option value="All">All Executives</option>
                {executives.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
>>>>>>> e626c1b83d9cdb61d7ec524c2adb7e0c5165d364
      </div>

      {error && (
        <div style={{ color: "#b91c1c", marginBottom: 12 }}>Error: {error}</div>
      )}
<<<<<<< HEAD
      {loading && <div>Loading...</div>}

      {/* Stores list */}
      <div style={{ display: "grid", gap: 16 }}>
        {data.map((r) => (
          <div key={r.storeId} style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{r.store}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{r.city} • Last Visit: {r.lastVisit} • Brand: {r.brand}</div>
              </div>
              <div style={{ fontWeight: 700, color: r.salesAfter - r.salesBefore >= 0 ? "#065f46" : "#b91c1c" }}>{r.salesImpact}</div>
            </div>

            {/* Sales comparison bars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Sales</div>
                <Bar label="Before" value={r.salesBefore} max={maxSales} />
                <Bar label="After" value={r.salesAfter} max={maxSales} />
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Issues (After)</div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div>Resolved: <strong>{r.issues.resolvedAfter}</strong></div>
                  <div>Pending: <strong>{r.issues.pendingAfter}</strong></div>
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>Raised (Before): {r.issues.raisedBefore}</div>
              </div>
            </div>

            {/* Incentives & visits */}
            <div style={{ display: "flex", gap: 24, marginTop: 8, fontSize: 14 }}>
              <div>Incentives: <strong>{r.incentives.before}</strong> → <strong>{r.incentives.after}</strong></div>
              <div>Visits (After): Completed <strong>{r.visits.completedAfter}</strong> • Missed <strong>{r.visits.missedAfter}</strong></div>
            </div>
          </div>
        ))}
      </div>
=======

      {loading ? (
        <div className="table-loading" role="status" aria-live="polite">
          <div className="loading-spinner-large" />
          <span className="loading-text">Loading data…</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            {/* Dynamic Avg % Sales Lift */}
            <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
              {(() => {
                const v = Number(summary?.avgSalesLiftPct ?? 0);
                const up = v >= 0;
                const label = 'Total % Sales Change';
                const color = up ? '#065f46' : '#b91c1c';
                return (
                  <>
                    <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {label}
                      <span style={{ color }}>{up ? '↑' : '↓'}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{Math.abs(v)}%</div>
                  </>
                );
              })()}
            </div>

            <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "#666" }}>Stores Improved vs Not Improved</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{summary ? `${summary.storesImproved} / ${summary.storesNotImproved}` : "-"}</div>
            </div>

            {/* Dynamic Avg Revenue delta */}
            <div style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
              {(() => {
                const v = Number(summary?.avgRevenue ?? 0);
                const up = v >= 0;
                const label = 'Total Revenue Change';
                const color = up ? '#065f46' : '#b91c1c';
                return (
                  <>
                    <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {label}
                      <span style={{ color }}>{up ? '↑' : '↓'}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{Math.abs(v).toLocaleString()}</div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Stores list */}
          <div style={{ display: "grid", gap: 16 }}>
            {data.map((r) => (
              <div key={r.storeId} style={{ border: "1px solid #eee", padding: 16, borderRadius: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: 8 }}>
                  <div />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{r.store}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {(() => {
                        const cat = Array.isArray(r?.categoryNames) && r.categoryNames.length ? r.categoryNames.join(', ') : 'None';
                        const brands = Array.isArray(r?.brandNames) && r.brandNames.length ? r.brandNames.join(', ') : '';
                        return `Last Visit: ${r.lastVisit} • Category: ${cat}${r.lastVisitedBy ? ` • Executive: ${r.lastVisitedBy}` : ''}${brands ? ` • Brands: ${brands}` : ''}`;
                      })()}
                    </div>
                  </div>
                  <div style={{ justifySelf: 'end', fontWeight: 700, color: r.salesAfter - r.salesBefore >= 0 ? '#065f46' : '#b91c1c' }}>{r.salesImpact}</div>
                </div>

                {/* Revenue trend sparkline (±7 days) */}
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>Revenue (±7 days)</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    <div style={{ minWidth: 90, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                      Sales Before<br/>
                      <strong>{Number(r.salesBefore || 0).toLocaleString()}</strong>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
<Sparkline points={(r.trend?.points || []).map((p: any) => ({ date: p.date, revenue: p.revenue, displayDate: p.displayDate }))} highlightDate={r.lastVisit} />
                    </div>
                    <div style={{ minWidth: 90, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                      Sales After<br/>
                      <strong style={{ color: r.salesAfter - r.salesBefore >= 0 ? '#065f46' : '#b91c1c' }}>{Number(r.salesAfter || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </>
      )}
>>>>>>> e626c1b83d9cdb61d7ec524c2adb7e0c5165d364
    </div>
  );
}
