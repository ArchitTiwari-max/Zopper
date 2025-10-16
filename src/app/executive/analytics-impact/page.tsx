"use client";

import React, { useEffect, useMemo, useState } from "react";
<<<<<<< HEAD

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>{label}: {value.toLocaleString()}</div>
      <div style={{ background: "#eee", height: 8, borderRadius: 4 }}>
        <div style={{ width: `${width}%`, height: 8, background: "#059669", borderRadius: 4 }} />
      </div>
=======
import "./page.css";
import { WeekFilter } from "@/components/WeekFilter";
import { getCurrentWeekValue } from "@/lib/weekUtils";

// Same sparkline as admin (axes, labels, tooltip, centered chart)
function Sparkline({ points, width = 360, height = 140, color = '#4f46e5', highlightDate, compact = false }: { points: Array<{ date: string; revenue: number; displayDate?: string }>; width?: number; height?: number; color?: string; highlightDate?: string; compact?: boolean }) {
  const revenues = points.map(p => Number(p.revenue || 0));
  const max = Math.max(1, ...revenues);
  const min = Math.min(0, ...revenues);
  const verySmall = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 420px)').matches;
  const pad = compact ? (verySmall ? 16 : 22) : 34;
  const minStepX = compact ? 22 : 30;
  const svgWidth = Math.max(width, pad * 2 + Math.max(0, points.length - 1) * minStepX);
  const w = svgWidth - pad * 2;
  const h = height - pad * 2;

  const fmtNum = (n: number) => Number(n).toLocaleString();
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
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const yy = m[1].slice(-2);
        const mm = m[2];
        const dd = m[3];
        return `${dd}-${mm}-${yy}`;
      }
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
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
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
  const getMeasureCtx = (() => {
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    return () => {
      if (!canvas) canvas = document.createElement('canvas');
      if (!ctx) ctx = canvas.getContext('2d');
      return ctx;
    };
  })();
  const labelFont = (compact ? '8px' : '9px') + " Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const measureTextWidth = (text: string) => {
    const ctx = getMeasureCtx();
    if (ctx) {
      ctx.font = labelFont;
      const m = ctx.measureText(text);
      return Math.ceil(m.width);
    }
    return Math.ceil(text.length * 5.2);
  };
  const valueLabels = points.map(p => fmtNum(Number(p.revenue || 0)));
  const valueLabelWidths = valueLabels.map(measureTextWidth);
  const [hover, setHover] = useState<number | null>(null);
  const baseMinStep = minStepX;
  const labelMargin = 8;
  const steps: number[] = [];
  for (let i = 0; i < Math.max(0, points.length - 1); i++) {
    const needed = Math.ceil((valueLabelWidths[i] + valueLabelWidths[i + 1]) / 2) + labelMargin;
    steps.push(Math.max(baseMinStep, needed));
  }
  const dynamicWidth = pad * 2 + steps.reduce((a, b) => a + b, 0);
  // In compact (mobile) mode, allow the SVG to grow to avoid label overlap; container scrolls horizontally
  const finalSvgWidth = compact ? Math.max(width, dynamicWidth) : Math.max(svgWidth, dynamicWidth);
  const finalW = finalSvgWidth - pad * 2;
  const xPos: number[] = [];
  // Use even distribution only if we can fit within the fixed width without overflow; otherwise use measured spacing
  const useEvenDistribution = compact && dynamicWidth <= width;
  if (useEvenDistribution) {
    // Evenly distribute points within available width (no horizontal scroll)
    const step = points.length > 1 ? (finalW) / (points.length - 1) : finalW;
    for (let i = 0; i < points.length; i++) xPos.push(pad + i * step);
  } else if (points.length <= 1) {
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
  const highlightIso = normalizeDate(highlightDate);
  const highlightIdx = highlightIso ? points.findIndex(p => normalizeDate(p.date || p.displayDate) === highlightIso) : -1;
  const containerHeight = height + 16; // extra space for outside date label
  return (
    <div className="exec-sparkline-inner" style={{ position: 'relative', width: finalSvgWidth, minWidth: finalSvgWidth, height: containerHeight }}>
      <svg width={finalSvgWidth} height={height} role="img" aria-label="revenue trend" style={{ position: 'absolute', left: 0, top: 0 }}>
        <line x1={pad} y1={pad} x2={pad} y2={pad + h} stroke="#94a3b8" strokeWidth="1" />
        <line x1={pad} y1={pad + h} x2={pad + finalW} y2={pad + h} stroke="#94a3b8" strokeWidth="1" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {points.map((p, i) => {
          const x = xPos[i] ?? pad;
          const val = Number(p.revenue || 0);
          const y = pad + yScale(val);
          const yLabel = Math.max(pad + 10, y - (i % 2 === 0 ? 12 : 4));
          const label = valueLabels[i];
          const interactive = true; // allow click/tap everywhere; hover on desktop only
          const showHoverHandlers = !compact; // only on larger screens
          return (
            <g key={`pt-${i}`} style={{ cursor: interactive ? 'pointer' : 'default' }}>
              <title>{fmtDateLabelFull(p.date, p.displayDate)}</title>
              <circle
                cx={x}
                cy={y}
                r={compact ? 12 : 10}
                fill="transparent"
                pointerEvents={interactive ? 'all' : 'none'}
                onMouseEnter={showHoverHandlers ? () => setHover(i) : undefined}
                onMouseLeave={showHoverHandlers ? () => setHover(prev => (prev === i ? null : prev)) : undefined}
                onClick={() => setHover(prev => (prev === i ? null : i))}
                onTouchStart={() => setHover(prev => (prev === i ? null : i))}
              />
              <circle cx={x} cy={y} r={2.5} fill={color} />
              <text x={x} y={yLabel} fontSize="9" textAnchor="middle" stroke="#ffffff" strokeWidth="3" fill="#ffffff" style={{ pointerEvents: 'none' }}>{label}</text>
              <text x={x} y={yLabel} fontSize="9" textAnchor="middle" fill="#334155" style={{ pointerEvents: 'none' }}>{label}</text>
            </g>
          );
        })}
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
      {highlightIdx >= 0 && (() => {
        const hx = xPos[highlightIdx] ?? pad;
        const text = fmtDateLabelFull(points[highlightIdx]?.date, points[highlightIdx]?.displayDate);
        const left = Math.max(0, Math.min(finalSvgWidth, hx));
        return (
          <div style={{ position: 'absolute', top: height + 2, left, transform: 'translateX(-50%)', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{text}</div>
        );
      })()}
>>>>>>> e626c1b83d9cdb61d7ec524c2adb7e0c5165d364
    </div>
  );
}

<<<<<<< HEAD
const brandOptions = [
  { value: "A", label: "Brand A (Before: -7d, After: +7d)" },
  { value: "A+", label: "Brand A+ (Before: -3d, After: +3d)" },
  { value: "B", label: "Brand B (Before: -10d, After: +10d)" },
  { value: "C", label: "Brand C (Before: -15d, After: +15d)" },
  { value: "D", label: "Brand D (Before: -30d, After: +30d)" },
];

export default function ExecutiveAnalyticsImpactPage() {
  const [brand, setBrand] = useState<string>("A");
=======
export default function ExecutiveAnalyticsImpactPage() {
  const [week, setWeek] = useState<string>(getCurrentWeekValue());
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(true);
>>>>>>> e626c1b83d9cdb61d7ec524c2adb7e0c5165d364
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
<<<<<<< HEAD
=======
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [pbt, setPbt] = useState<string>('All');
  const [brandId, setBrandId] = useState<string>('All');
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
      setData([]);
      setSummary(null);
      const params = new URLSearchParams({ week, pbt });
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
=======
  }, [week, pbt, brandId]);

  // Track viewport for compact mode
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Load brands (executive-accessible endpoint)
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const res = await fetch('/api/executive/brands', { cache: 'no-store' });
        const j = await res.json();
        const list = (j.data || []).map((b: any) => ({ id: b.id, name: b.brandName }));
        setBrands(list);
      } catch (e) {
        // ignore
      }
    };
    loadBrands();
  }, []);

  return (
    <div className="exec-analytics-container">

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
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: "#b91c1c", marginBottom: 12 }}>Error: {error}</div>
      )}

      {loading ? (
        <div className="table-loading" role="status" aria-live="polite">
          <div className="loading-spinner-large" />
          <span className="loading-text">Loading data…</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="exec-kpi-grid">
            <div className="exec-kpi-card">
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

            <div className="exec-kpi-card">
              <div className="exec-kpi-label">Stores Improved vs Not Improved</div>
              <div className="exec-kpi-value">{summary ? `${summary.storesImproved} / ${summary.storesNotImproved}` : "-"}</div>
            </div>

            <div className="exec-kpi-card">
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
          <div className="exec-store-list">
            {data.map((r) => (
              <div key={r.storeId} className="exec-store-card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: 8 }}>
                  <div />
                  <div className="exec-card-center">
                    <div className="exec-store-name">{r.store}</div>
                    <div className="exec-store-sub">
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
                  <div style={{ fontWeight: 600, marginBottom: 6, textAlign: isCompact ? 'left' : 'center' }}>Revenue (±7 Days Last Visit)</div>
                  <div className="exec-revenue-row">
                    <div className="exec-sales-box">
                      Sales Before<br/>
                      <strong className="exec-sales-value pos">{Number(r.salesBefore || 0).toLocaleString()}</strong>
                    </div>
                    <div className="exec-sparkline-wrap">
                      <Sparkline compact={isCompact} width={isCompact ? 300 : 360} height={isCompact ? 110 : 140} points={(r.trend?.points || []).map((p: any) => ({ date: p.date, revenue: p.revenue, displayDate: p.displayDate }))} highlightDate={r.lastVisit} />
                    </div>
                    <div className="exec-sales-box">
                      Sales After<br/>
                      <strong className={`exec-sales-value ${r.salesAfter - r.salesBefore >= 0 ? 'pos' : 'neg'}`}>{Number(r.salesAfter || 0).toLocaleString()}</strong>
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
