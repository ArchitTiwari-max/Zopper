'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useDateFilter } from '../contexts/DateFilterContext';
import { useSearchParams } from 'next/navigation';
import './page.css';

// Types
interface Executive {
  id: string;
  name: string;
}

interface VisitItem {
  id: string;
  executiveId: string;
  executiveName: string;
  visitDate: string; // dd/mm/yyyy from API
  storeName: string;
}

const AttendancePage: React.FC = () => {
  const { selectedDateFilter } = useDateFilter();
  const searchParams = useSearchParams();
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecId, setSelectedExecId] = useState<string>('ALL');

  // Helpers
  const parseDDMMYYYY = (d: string): Date | null => {
    // Expecting 'dd/mm/yyyy'
    const parts = d.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;
    return new Date(year, month, day);
  };

  const formatYMD = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Display helper: convert YYYY-MM-DD to "dd mm yyyy"
  const formatYMDToDDMMYYYY = (ymd: string): string => {
    const parts = ymd.split('-');
    if (parts.length !== 3) return ymd;
    const [y, m, d] = parts;
    return `${String(d).padStart(2, '0')} ${String(m).padStart(2, '0')} ${y}`;
  };

  const getRangeForFilter = (filter: string): { start: Date; end: Date } => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (filter) {
      case 'Today': {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case 'Yesterday': {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        start = y;
        end = y;
        break;
      }
      case 'Last 7 Days': {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case 'Last 90 Days': {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case 'Last Year': {
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case 'Last 30 Days':
      default: {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    }
    return { start, end };
  };

  const dateKeys = useMemo(() => {
    const { start, end } = getRangeForFilter(selectedDateFilter);
    const keys: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      keys.push(formatYMD(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    // Show most recent first (descending)
    return keys.reverse();
  }, [selectedDateFilter]);

  // Fetch executives (from visit-report filters) and visits
  useEffect(() => {
    let isCancelled = false;

    const fetchAll = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch executives
        const filtersRes = await fetch('/api/admin/visit-report/filters', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        if (!filtersRes.ok) {
          const err = await filtersRes.json().catch(() => ({ error: 'Failed to fetch filters' }));
          throw new Error(err.error || 'Failed to fetch filters');
        }
        const filtersJson = await filtersRes.json();
        const execs = Array.isArray(filtersJson.executives) ? filtersJson.executives : [];
        const normalizedExecs: Executive[] = execs.map((e: any) => ({ id: String(e.id), name: e.name }));

        // Fetch visits for period
        const params = new URLSearchParams();
        params.append('dateFilter', selectedDateFilter);
        params.append('_ts', String(Date.now())); // avoid cache
        const dataRes = await fetch(`/api/admin/visit-report/data?${params.toString()}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
          credentials: 'include',
          cache: 'no-store'
        });
        if (!dataRes.ok) {
          const err = await dataRes.json().catch(() => ({ error: 'Failed to fetch visits' }));
          throw new Error(err.error || 'Failed to fetch visits');
        }
        const dataJson = await dataRes.json();
        const list = Array.isArray(dataJson.visits) ? dataJson.visits : [];
        const normalizedVisits: VisitItem[] = list.map((v: any) => ({
          id: String(v.id),
          executiveId: String(v.executiveId ?? ''),
          executiveName: String(v.executiveName ?? ''),
          visitDate: String(v.visitDate ?? ''),
          storeName: String(v.storeName ?? '')
        }));

        if (!isCancelled) {
          setExecutives(normalizedExecs.sort((a, b) => a.name.localeCompare(b.name)));
          setVisits(normalizedVisits);
        }
      } catch (e) {
        if (!isCancelled) setError(e instanceof Error ? e.message : 'Failed to load attendance');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    fetchAll();
    return () => {
      isCancelled = true;
    };
  }, [selectedDateFilter]);

  // Build a Set of submissions by (dateKey, execId)
  const submissionSet = useMemo(() => {
    const set = new Set<string>();
    visits.forEach(v => {
      const d = parseDDMMYYYY(v.visitDate);
      if (!d) return;
      const key = `${formatYMD(d)}::${v.executiveId}`;
      set.add(key);
    });
    return set;
  }, [visits]);

  // Map of (dateKey::execId) -> unique list of store names visited that day
  const perDayExecStores = useMemo(() => {
    const map = new Map<string, string[]>();
    visits.forEach(v => {
      const d = parseDDMMYYYY(v.visitDate);
      if (!d) return;
      const key = `${formatYMD(d)}::${v.executiveId}`;
      const name = (v.storeName || '').trim();
      if (!name) return;
      if (!map.has(key)) map.set(key, []);
      const arr = map.get(key)!;
      if (!arr.includes(name)) arr.push(name);
    });
    return map;
  }, [visits]);

  // Derive visible executives based on selected filter
  const visibleExecutives = useMemo(() => {
    if (!executives.length) return executives;
    if (selectedExecId === 'ALL') return executives;
    return executives.filter(e => e.id === selectedExecId);
  }, [executives, selectedExecId]);

  // Initialize selection from URL param when executives are available
  useEffect(() => {
    const urlExecId = searchParams.get('executiveId');
    if (urlExecId && executives.some(e => e.id === urlExecId)) {
      setSelectedExecId(urlExecId);
    }
  }, [searchParams, executives]);

  // Update URL with selected executive
  const updateUrlWithExec = (execId: string) => {
    try {
      const url = new URL(window.location.href);
      if (execId === 'ALL') {
        url.searchParams.delete('executiveId');
      } else {
        url.searchParams.set('executiveId', execId);
      }
      window.history.pushState({}, '', url.toString());
    } catch {}
  };

  if (error) {
    return (
      <div className="attendance-wrapper">
        <div className="attendance-error">
          <div>Error loading attendance</div>
          <div>{error}</div>
          <button onClick={() => { /* trigger re-fetch */ window.location.reload(); }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-wrapper">
      {isLoading ? (
        <div className="attendance-loading">Loading attendance…</div>
      ) : (
        <div className="attendance-table-container">
          <div className="attendance-filters">
            <label htmlFor="exec-filter">Executive:</label>
            <select
              id="exec-filter"
              className="exec-filter-select"
              value={selectedExecId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedExecId(val);
                updateUrlWithExec(val);
              }}
            >
              <option value="ALL">All Executives</option>
              {executives.map(exec => (
                <option key={exec.id} value={exec.id}>{exec.name}</option>
              ))}
            </select>
          </div>
          <table className="attendance-table" role="table" aria-label="Attendance Tracker">
            <thead>
              <tr>
                <th className="sticky-col date-col">Date</th>
                {visibleExecutives.map(exec => (
                  <th
                    key={exec.id}
                    title={exec.name}
                    className="exec-col"
                    onClick={() => setSelectedExecId(prev => prev === exec.id ? 'ALL' : exec.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {exec.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dateKeys.map(dateKey => (
                <tr key={dateKey}>
                  <td className="sticky-col date-cell">{formatYMDToDDMMYYYY(dateKey)}</td>
                  {visibleExecutives.map(exec => {
                    const key = `${dateKey}::${exec.id}`;
                    const has = submissionSet.has(key);
                    const stores = perDayExecStores.get(key) || [];
                    const title = has && stores.length ? `Visited stores:\n${stores.join('\n')}` : undefined;
                    return (
                      <td 
                        key={exec.id}
                        className={`status-cell ${has ? 'yes' : 'no'}`}
                        aria-label={has ? 'Submitted' : 'Not submitted'}
                        title={title}
                      >
                        {has ? <span className="tick">✓</span> : <span className="cross">✗</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
