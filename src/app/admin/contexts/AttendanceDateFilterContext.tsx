'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

export type AttendanceDateFilterOption = 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Last Year';

interface AttendanceDateFilterContextType {
  selectedDateFilter: AttendanceDateFilterOption;
  setSelectedDateFilter: (filter: AttendanceDateFilterOption) => void;
  getDateRange: () => { startDate: Date; endDate: Date };
}

const AttendanceDateFilterContext = createContext<AttendanceDateFilterContextType | undefined>(undefined);

const ATTENDANCE_STORAGE_KEY = 'attendance_date_filter';
const allowed: AttendanceDateFilterOption[] = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Last Year'];

export const useAttendanceDateFilter = () => {
  const context = useContext(AttendanceDateFilterContext);
  if (context === undefined) {
    throw new Error('useAttendanceDateFilter must be used within an AttendanceDateFilterProvider');
  }
  return context;
};

interface AttendanceDateFilterProviderProps {
  children: ReactNode;
}

export const AttendanceDateFilterProvider: React.FC<AttendanceDateFilterProviderProps> = ({ children }) => {
  const [selectedDateFilter, _setSelectedDateFilter] = useState<AttendanceDateFilterOption>('Last 30 Days'); // Default to Last 30 Days for attendance

  // Initialize from URL param (?attendanceDateFilter=) or localStorage, fallback to Last 30 Days
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const urlVal = url.searchParams.get('attendanceDateFilter');
      if (urlVal && (allowed as string[]).includes(urlVal)) {
        _setSelectedDateFilter(urlVal as AttendanceDateFilterOption);
        localStorage.setItem(ATTENDANCE_STORAGE_KEY, urlVal);
        return;
      }
      const saved = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
      if (saved && (allowed as string[]).includes(saved)) {
        _setSelectedDateFilter(saved as AttendanceDateFilterOption);
      }
    } catch {}
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, selectedDateFilter);
    } catch {}
  }, [selectedDateFilter]);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ATTENDANCE_STORAGE_KEY && e.newValue && (allowed as string[]).includes(e.newValue)) {
        _setSelectedDateFilter(e.newValue as AttendanceDateFilterOption);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setSelectedDateFilter = useCallback((f: AttendanceDateFilterOption) => {
    _setSelectedDateFilter(f);
    try {
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, f);
      // Also update URL parameter for attendance-specific date filter
      const url = new URL(window.location.href);
      url.searchParams.set('attendanceDateFilter', f);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, []);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (selectedDateFilter) {
      case 'Today':
        return {
          startDate: today,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case 'Yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: yesterday,
          endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case 'Last 7 Days':
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        return { startDate: last7Days, endDate: now };
      case 'Last 30 Days':
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        return { startDate: last30Days, endDate: now };
      case 'Last 90 Days':
        const last90Days = new Date(today);
        last90Days.setDate(last90Days.getDate() - 90);
        return { startDate: last90Days, endDate: now };
      case 'Last Year':
        const lastYear = new Date(today);
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        return { startDate: lastYear, endDate: now };
      default:
        const defaultLast30Days = new Date(today);
        defaultLast30Days.setDate(defaultLast30Days.getDate() - 30);
        return { startDate: defaultLast30Days, endDate: now };
    }
  };

  return (
    <AttendanceDateFilterContext.Provider 
      value={{ 
        selectedDateFilter, 
        setSelectedDateFilter,
        getDateRange
      }}
    >
      {children}
    </AttendanceDateFilterContext.Provider>
  );
};