'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAttendanceDateFilter } from '../contexts/AttendanceDateFilterContext';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
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
  const { selectedDateFilter, setSelectedDateFilter } = useAttendanceDateFilter();
  const searchParams = useSearchParams();
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecId, setSelectedExecId] = useState<string>('ALL');
  const [holidays, setHolidays] = useState<Set<string>>(new Set()); // Set of date strings (YYYY-MM-DD)
  const [showHolidayPicker, setShowHolidayPicker] = useState<boolean>(false);

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

  // Helper to check if a date is Sunday
  const isSunday = (dateKey: string): boolean => {
    const date = new Date(dateKey + 'T00:00:00');
    return date.getDay() === 0; // Sunday is 0
  };

  // Helper to check if a date is a holiday
  const isHoliday = (dateKey: string): boolean => {
    return holidays.has(dateKey);
  };

  // Toggle holiday status for a date
  const toggleHoliday = (dateKey: string): void => {
    setHolidays(prev => {
      const newHolidays = new Set(prev);
      if (newHolidays.has(dateKey)) {
        newHolidays.delete(dateKey);
      } else {
        newHolidays.add(dateKey);
      }
      return newHolidays;
    });
  };

  // Calculate attendance statistics for an executive
  const calculateAttendanceStats = (execId: string): { presentDays: number; totalWorkingDays: number } => {
    let presentDays = 0;
    let totalWorkingDays = 0;
    
    dateKeys.forEach(dateKey => {
      const key = `${dateKey}::${execId}`;
      const has = submissionSet.has(key);
      const isWeekend = isSunday(dateKey);
      const isHol = isHoliday(dateKey);
      
      // Count only working days (not weekends or holidays)
      if (!isWeekend && !isHol) {
        totalWorkingDays++;
        if (has) {
          presentDays++;
        }
      }
    });
    
    return { presentDays, totalWorkingDays };
  };

  // Export attendance data to Excel
  const exportToExcel = (): void => {
    try {
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      
      // Prepare data for Excel
      const excelData: any[] = [];
      
      // Header row with Total column first
      const headerRow = ['Executive Name', 'Total (Present/Working Days)', ...dateKeys.map(dateKey => formatYMDToDDMMYYYY(dateKey))];
      excelData.push(headerRow);
      
      // Data rows
      visibleExecutives.forEach(exec => {
        const row = [exec.name];
        
        // Add Total column first
        const stats = calculateAttendanceStats(exec.id);
        const totalText = `${stats.presentDays}/${stats.totalWorkingDays}`;
        row.push(totalText);
        
        // Then add date columns
        dateKeys.forEach(dateKey => {
          const key = `${dateKey}::${exec.id}`;
          const has = submissionSet.has(key);
          const isWeekend = isSunday(dateKey);
          const isHol = isHoliday(dateKey);
          const stores = perDayExecStores.get(key) || [];
          
          let cellValue: string;
          if (isHol) {
            cellValue = 'HOLIDAY';
          } else if (isWeekend) {
            cellValue = 'SUNDAY';
          } else if (has) {
            cellValue = stores.length > 0 ? `VISITED (${stores.join(', ')})` : 'VISITED';
          } else {
            cellValue = 'NOT VISITED';
          }
          
          row.push(cellValue);
        });
        
        excelData.push(row);
      });
      
      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');
      
      // Generate filename with current date and filter
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const filename = `Attendance_Report_${selectedDateFilter.replace(/ /g, '_')}_${dateStr}.xlsx`;
      
      // Save file
      XLSX.writeFile(workbook, filename);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel. Please try again.');
    }
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
            <div className="filter-left">
              <label htmlFor="date-filter">Date Range:</label>
              <select
                id="date-filter"
                className="date-filter-select"
                value={selectedDateFilter}
                onChange={(e) => setSelectedDateFilter(e.target.value as any)}
              >
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
                <option value="Last 90 Days">Last 90 Days</option>
                <option value="Last Year">Last Year</option>
              </select>
              
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
            <div className="filter-right">
              <button
                className="holiday-btn"
                onClick={() => setShowHolidayPicker(!showHolidayPicker)}
                title="Mark days as holidays"
              >
                🏖️ Manage Holidays
              </button>
              <button
                className="export-btn"
                onClick={exportToExcel}
                title="Export attendance data to Excel"
              >
                📊 Export XLS
              </button>
            </div>
          </div>
          {showHolidayPicker && (
            <div className="holiday-picker">
              <div className="holiday-picker-header">
                <h4>Mark Holiday Dates</h4>
                <span className="holiday-picker-info">Click on any date in the table to mark/unmark as holiday</span>
              </div>
              <div className="holiday-list">
                {holidays.size > 0 ? (
                  <div>
                    <strong>Current Holidays:</strong>
                    <div className="holiday-tags">
                      {Array.from(holidays).map(dateKey => (
                        <span key={dateKey} className="holiday-tag">
                          {formatYMDToDDMMYYYY(dateKey)}
                          <button
                            className="remove-holiday"
                            onClick={() => toggleHoliday(dateKey)}
                            title="Remove holiday"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="no-holidays">No holidays marked. Click on date headers in the table to add holidays.</span>
                )}
              </div>
            </div>
          )}
          <table className="attendance-table" role="table" aria-label="Attendance Tracker">
            <thead>
              <tr>
                <th className="sticky-col exec-col">Executive</th>
                <th className="total-col" title="Present Days / Total Working Days">
                  Total
                </th>
                {dateKeys.map(dateKey => {
                  const isHol = isHoliday(dateKey);
                  const isWeekend = isSunday(dateKey);
                  return (
                    <th
                      key={dateKey}
                      title={`${formatYMDToDDMMYYYY(dateKey)}${isHol ? ' (Holiday)' : ''}${isWeekend ? ' (Sunday)' : ''} - Click to toggle holiday`}
                      className={`date-col ${isHol ? 'holiday-header' : ''} ${isWeekend ? 'weekend-header' : ''}`}
                      onClick={() => toggleHoliday(dateKey)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="date-header-content">
                        <span className="date-text">{formatYMDToDDMMYYYY(dateKey)}</span>
                        {isHol && <span className="holiday-indicator" title="Holiday">🏖️</span>}
                        {isWeekend && !isHol && <span className="weekend-indicator" title="Sunday">🌟</span>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleExecutives.map(exec => (
                <tr key={exec.id}>
                  <td 
                    className="sticky-col exec-cell"
                    onClick={() => setSelectedExecId(prev => prev === exec.id ? 'ALL' : exec.id)}
                    style={{ cursor: 'pointer' }}
                    title={exec.name}
                  >
                    {exec.name}
                  </td>
                  {/* Total Column - moved to first position */}
                  {(() => {
                    const stats = calculateAttendanceStats(exec.id);
                    const percentage = stats.totalWorkingDays > 0 
                      ? Math.round((stats.presentDays / stats.totalWorkingDays) * 100) 
                      : 0;
                    
                    return (
                      <td 
                        className="total-cell"
                        title={`${stats.presentDays} present days out of ${stats.totalWorkingDays} working days (${percentage}%)`}
                      >
                        <div className="total-content">
                          <span className="total-fraction">{stats.presentDays}/{stats.totalWorkingDays}</span>
                          <span className="total-percentage">({percentage}%)</span>
                        </div>
                      </td>
                    );
                  })()}
                  {dateKeys.map(dateKey => {
                    const key = `${dateKey}::${exec.id}`;
                    const has = submissionSet.has(key);
                    const stores = perDayExecStores.get(key) || [];
                    const isWeekend = isSunday(dateKey);
                    const isHol = isHoliday(dateKey);
                    const title = has && stores.length ? `Visited stores:\n${stores.join('\n')}` : undefined;
                    
                    let cellClass = 'status-cell';
                    let ariaLabel = '';
                    let content: React.ReactNode;
                    
                    if (isHol) {
                      cellClass += ' holiday';
                      ariaLabel = 'Holiday';
                      content = <span className="holiday-symbol">🏖️</span>;
                    } else if (isWeekend) {
                      cellClass += ' weekend';
                      ariaLabel = 'Weekend';
                      content = <span className="dash">-</span>;
                    } else if (has) {
                      cellClass += ' yes';
                      ariaLabel = 'Submitted';
                      content = <span className="tick">✓</span>;
                    } else {
                      cellClass += ' no';
                      ariaLabel = 'Not submitted';
                      content = <span className="cross">✗</span>;
                    }
                    
                    return (
                      <td 
                        key={dateKey}
                        className={cellClass}
                        aria-label={ariaLabel}
                        title={title}
                      >
                        {content}
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
