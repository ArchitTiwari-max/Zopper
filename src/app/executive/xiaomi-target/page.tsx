'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface XiaomiStore {
  storeId: string;
  storeName: string;
  state: string | null;
  distributorName: string | null;
  targetRevenue: number;
  achievementRevenue: number;
}

interface Summary {
  total: number;
  totalTarget: number;
  totalAchievement: number;
  month: number;
  year: number;
}

export default function XiaomiTargetPage() {
  const router = useRouter();
  const [targets, setTargets] = useState<XiaomiStore[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  
  // Default to July 2026 based on original hardcoded values, or use current date if preferred
  const [selectedMonth, setSelectedMonth] = useState('7');
  const [selectedYear, setSelectedYear] = useState('2026');

  const [visibleCount, setVisibleCount] = useState(100);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          month: selectedMonth,
          year: selectedYear,
        });
        const res = await fetch(`/api/executive/xiaomi-target?${params}`);
        const json = await res.json();
        if (json.success) {
          setTargets(json.data.targets);
          setSummary(json.data.summary);
        } else {
          setTargets([]);
          setSummary(null);
        }
      } catch (e) {
        console.error('Error fetching Xiaomi targets:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedMonth, selectedYear]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(100);
  }, [search, stateFilter]);

  const states = Array.from(new Set(targets.map(t => t.state).filter(Boolean))) as string[];

  const filtered = targets.filter(t => {
    const matchSearch =
      !search ||
      t.storeName.toLowerCase().includes(search.toLowerCase()) ||
      (t.distributorName || '').toLowerCase().includes(search.toLowerCase());
    const matchState = !stateFilter || t.state === stateFilter;
    return matchSearch && matchState;
  });

  const visibleStores = filtered.slice(0, visibleCount);
  const filteredTotal = filtered.reduce((s, t) => s + t.targetRevenue, 0);
  const filteredAchievement = filtered.reduce((s, t) => s + t.achievementRevenue, 0);

  return (
    <div style={{
      padding: '16px',
      maxWidth: '600px',
      margin: '0 auto',
      fontFamily: 'Inter, sans-serif',
      boxSizing: 'border-box',
      width: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e1b4b', lineHeight: 1.2 }}>
            📱 Xiaomi Target
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
            {MONTH_NAMES[parseInt(selectedMonth)]} {selectedYear} · No assignments
          </p>
        </div>
      </div>

      {/* Month/Year Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '8px',
            border: '1px solid #e5e7eb', fontSize: '14px', background: 'white',
            cursor: 'pointer', outline: 'none',
          }}
        >
          {MONTH_NAMES.slice(1).map((name, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '8px',
            border: '1px solid #e5e7eb', fontSize: '14px', background: 'white',
            cursor: 'pointer', outline: 'none',
          }}
        >
          {[2024, 2025, 2026, 2027].map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: '12px', padding: '12px', color: 'white',
          }}>
            <div style={{ fontSize: '10px', opacity: 0.85, marginBottom: '2px' }}>Stores</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{summary.total.toLocaleString()}</div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
            borderRadius: '12px', padding: '12px', color: 'white',
          }}>
            <div style={{ fontSize: '10px', opacity: 0.85, marginBottom: '2px' }}>Total Target</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>
              ₹{(summary.totalTarget / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}L
            </div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            borderRadius: '12px', padding: '12px', color: 'white',
          }}>
            <div style={{ fontSize: '10px', opacity: 0.85, marginBottom: '2px' }}>Achievement</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>
              ₹{(summary.totalAchievement / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}L
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search store or distributor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: '10px',
            border: '1px solid #e5e7eb', fontSize: '14px', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: '10px',
            border: '1px solid #e5e7eb', fontSize: '14px', background: 'white',
            cursor: 'pointer', boxSizing: 'border-box',
          }}
        >
          <option value="">All States</option>
          {states.sort().map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Filtered count */}
      {(search || stateFilter) && (
        <div style={{ marginBottom: '12px', fontSize: '13px', color: '#6b7280', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span>{filtered.length} stores</span>
          <span>·</span>
          <span>Target: ₹{(filteredTotal / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}L</span>
          <span>·</span>
          <span style={{ color: '#059669', fontWeight: 500 }}>
            Achieved: ₹{(filteredAchievement / 100000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}L
          </span>
        </div>
      )}

      {/* Cards List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <div>Loading target data...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
          <div>No stores found</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleStores.map((t) => (
            <div
              key={t.storeId}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '14px 16px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              {/* Store Name + Target/Achievement */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{
                  fontSize: '14px', fontWeight: 600, color: '#111827',
                  flex: 1, lineHeight: 1.3,
                }}>
                  {t.storeName}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '14px', fontWeight: 700, color: '#6366f1',
                    whiteSpace: 'nowrap',
                  }}>
                    T: ₹{t.targetRevenue.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                  </span>
                  <span style={{
                    fontSize: '13px', fontWeight: 600, color: '#10b981',
                    whiteSpace: 'nowrap', marginTop: '2px'
                  }}>
                    A: ₹{t.achievementRevenue.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                  </span>
                </div>
              </div>

              {/* State + Distributor */}
              <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {t.state && (
                  <span style={{
                    fontSize: '11px', background: '#f3f4f6', color: '#374151',
                    padding: '2px 8px', borderRadius: '20px', fontWeight: 500,
                  }}>
                    {t.state}
                  </span>
                )}
                {t.distributorName && (
                  <span style={{
                    fontSize: '11px', color: '#9ca3af',
                    padding: '2px 0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}>
                    {t.distributorName}
                  </span>
                )}
              </div>
            </div>
          ))}
          
          {visibleCount < filtered.length && (
            <button
              onClick={() => setVisibleCount(prev => prev + 100)}
              style={{
                marginTop: '10px',
                padding: '12px',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                color: '#4b5563',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#e5e7eb'}
              onMouseOut={e => e.currentTarget.style.background = '#f3f4f6'}
            >
              Load More ({filtered.length - visibleCount} left)
            </button>
          )}
        </div>
      )}

      {/* Bottom padding for nav bar */}
      <div style={{ height: '80px' }} />
    </div>
  );
}
