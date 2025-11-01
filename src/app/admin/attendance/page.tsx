'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

type DateFilterOption = 'Today' | 'Yesterday' | 'Custom';

const AttendancePage: React.FC = () => {
  const searchParams = useSearchParams();
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterOption>('Today');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [visits, setVisits] = useState<VisitItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecId, setSelectedExecId] = useState<string>('ALL');
  const [holidays, setHolidays] = useState<Set<string>>(new Set()); // Set of date strings (YYYY-MM-DD)
  const [holidaysLoaded, setHolidaysLoaded] = useState<boolean>(false);
  const [showHolidayPicker, setShowHolidayPicker] = useState<boolean>(false);
  const [isFiltersVisible, setIsFiltersVisible] = useState<boolean>(true);

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

  // Load holidays from database
  const loadHolidays = async (): Promise<void> => {
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        const holidayDates = new Set(data.holidays.map((h: any) => h.date));
        setHolidays(holidayDates);
      } else {
        console.warn('Failed to load holidays:', await res.text());
      }
    } catch (error) {
      console.error('Error loading holidays:', error);
    } finally {
      setHolidaysLoaded(true);
    }
  };

  // Toggle holiday status for a date (with database persistence)
  const toggleHoliday = async (dateKey: string): Promise<void> => {
    const isCurrentlyHoliday = holidays.has(dateKey);
    
    // Optimistically update UI
    setHolidays(prev => {
      const newHolidays = new Set(prev);
      if (newHolidays.has(dateKey)) {
        newHolidays.delete(dateKey);
      } else {
        newHolidays.add(dateKey);
      }
      return newHolidays;
    });

    try {
      if (isCurrentlyHoliday) {
        // Remove holiday from database
        const existingHolidays = await fetch('/api/admin/holidays');
        if (existingHolidays.ok) {
          const data = await existingHolidays.json();
          const holidayToDelete = data.holidays.find((h: any) => h.date === dateKey);
          
          if (holidayToDelete) {
            const deleteRes = await fetch(`/api/admin/holidays/${holidayToDelete.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include'
            });
            
            if (!deleteRes.ok) {
              console.error('Failed to delete holiday:', await deleteRes.text());
              // Revert optimistic update on error
              setHolidays(prev => {
                const newHolidays = new Set(prev);
                newHolidays.add(dateKey);
                return newHolidays;
              });
            }
          }
        }
      } else {
        // Add holiday to database
        const res = await fetch('/api/admin/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            date: dateKey,
            name: `Holiday - ${formatYMDToDDMMYYYY(dateKey)}`
          })
        });
        
        if (!res.ok) {
          console.error('Failed to create holiday:', await res.text());
          // Revert optimistic update on error
          setHolidays(prev => {
            const newHolidays = new Set(prev);
            newHolidays.delete(dateKey);
            return newHolidays;
          });
        }
      }
    } catch (error) {
      console.error('Error toggling holiday:', error);
      // Revert optimistic update on error
      setHolidays(prev => {
        const newHolidays = new Set(prev);
        if (isCurrentlyHoliday) {
          newHolidays.add(dateKey);
        } else {
          newHolidays.delete(dateKey);
        }
        return newHolidays;
      });
    }
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
            cellValue = stores.length > 0 ? `✅ (${stores.join(', ')})` : 'VISITED';
          } else {
            cellValue = '❌';
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
      const filterName = selectedDateFilter.replace(/ /g, '_').replace(/\s/g, '_');
      const filename = `Attendance_Report_${filterName}_${dateStr}.xlsx`;
      
      // Save file
      XLSX.writeFile(workbook, filename);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel. Please try again.');
    }
  };

  const getRangeForFilter = (filter: DateFilterOption): { start: Date; end: Date } => {
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
      case 'Custom': {
        // Get all days of the selected month/year
        start = new Date(selectedYear, selectedMonth, 1);
        end = new Date(selectedYear, selectedMonth + 1, 0); // Last day of the month
        break;
      }
      default: {
        // Default to today
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    // Show most recent first (descending) for Today/Yesterday, chronological for Custom
    return selectedDateFilter === 'Custom' ? keys : keys.reverse();
  }, [selectedDateFilter, selectedMonth, selectedYear]);

  // Attendance data is now calculated from visits data only (no API sync)

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
        // Convert our filter to the format expected by the API
        // For Today/Yesterday, fetch a wider range to ensure we get all visits
        // since createdAt (when submitted) might differ from visitDate (actual visit date)
        let apiDateFilter: string;
        switch (selectedDateFilter) {
          case 'Today':
          case 'Yesterday':
            // Fetch last 7 days to ensure we capture visits submitted today but dated yesterday, etc.
            apiDateFilter = 'Last 7 Days';
            break;
          case 'Custom':
            // For custom, we'll use a month range that the API can understand
            apiDateFilter = 'Last 30 Days'; // API fallback, we handle the actual range in getRangeForFilter
            break;
          default:
            apiDateFilter = 'Last 7 Days';
        }
        params.append('dateFilter', apiDateFilter);
        const dataRes = await fetch(`/api/admin/visit-report/data?${params.toString()}`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json', 
            'Cache-Control': 'no-cache, no-store, must-revalidate', 
            'Pragma': 'no-cache',
            'Expires': '0'
          },
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
          
          // Note: Attendance is now calculated from visits data only, no database sync
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
  }, [selectedDateFilter, selectedMonth, selectedYear]);

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

  // Load holidays from database on component mount
  useEffect(() => {
    if (!holidaysLoaded) {
      loadHolidays();
    }
  }, [holidaysLoaded]);

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
      <div style={{ padding: 24 }}>
        <div style={{ color: "#b91c1c", marginBottom: 12 }}>Error: {error}</div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {isLoading ? (
        <div className="table-loading" role="status" aria-live="polite">
          <div className="loading-spinner-large" />
          <span className="loading-text">Loading attendance data…</span>
        </div>
      ) : (
        <div>
          {/* Filters Section - Analytics Style */}
          <div>
            <div style={{ marginBottom: 8 }}>
              <h3
                onClick={() => setIsFiltersVisible(v => !v)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 18, fontWeight: 600 }}
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
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Date Range</label>
                  <select
                    value={selectedDateFilter}
                    onChange={(e) => setSelectedDateFilter(e.target.value as DateFilterOption)}
                    style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
                  >
                    <option value="Today">Today</option>
                    <option value="Yesterday">Yesterday</option>
                    <option value="Custom">Custom Month/Year</option>
                  </select>
                </div>
                
                {selectedDateFilter === 'Custom' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Month</label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
                      >
                        {Array.from({ length: 12 }, (_, i) => {
                          const monthName = new Date(2000, i, 1).toLocaleDateString('en', { month: 'long' });
                          return (
                            <option key={i} value={i}>{monthName}</option>
                          );
                        })}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Year</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <option key={year} value={year}>{year}</option>
                          );
                        })}
                      </select>
                    </div>
                  </>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Executive</label>
                  <select
                    value={selectedExecId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedExecId(val);
                      updateUrlWithExec(val);
                    }}
                    style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
                  >
                    <option value="ALL">All Executives</option>
                    {executives.map(exec => (
                      <option key={exec.id} value={exec.id}>{exec.name}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Actions</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowHolidayPicker(!showHolidayPicker)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: 6,
                        background: showHolidayPicker ? '#e0f2fe' : 'white',
                        cursor: 'pointer',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="Manage holidays"
                    >
                      🏖️ Holidays
                    </button>
                    <button
                      onClick={exportToExcel}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: 6,
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="Export to Excel"
                    >
                      📊 Export
                    </button>
                  </div>
                </div>
              </div>
            )}
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
