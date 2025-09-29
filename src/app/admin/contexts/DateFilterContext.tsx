'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

export type DateFilterOption = 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Last Year';

interface DateFilterContextType {
  selectedDateFilter: DateFilterOption;
  setSelectedDateFilter: (filter: DateFilterOption) => void;
  getDateRange: () => { startDate: Date; endDate: Date };
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

const STORAGE_KEY = 'admin_date_filter';
const allowed: DateFilterOption[] = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Last Year'];

export const useDateFilter = () => {
  const context = useContext(DateFilterContext);
  if (context === undefined) {
    throw new Error('useDateFilter must be used within a DateFilterProvider');
  }
  return context;
};

interface DateFilterProviderProps {
  children: ReactNode;
}

export const DateFilterProvider: React.FC<DateFilterProviderProps> = ({ children }) => {
  const [selectedDateFilter, _setSelectedDateFilter] = useState<DateFilterOption>('Today');

  // Initialize from URL param (?dateFilter=) or localStorage, fallback to Today
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const urlVal = url.searchParams.get('dateFilter');
      if (urlVal && (allowed as string[]).includes(urlVal)) {
        _setSelectedDateFilter(urlVal as DateFilterOption);
        localStorage.setItem(STORAGE_KEY, urlVal);
        return;
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (allowed as string[]).includes(saved)) {
        _setSelectedDateFilter(saved as DateFilterOption);
      }
    } catch {}
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, selectedDateFilter);
    } catch {}
  }, [selectedDateFilter]);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && (allowed as string[]).includes(e.newValue)) {
        _setSelectedDateFilter(e.newValue as DateFilterOption);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setSelectedDateFilter = useCallback((f: DateFilterOption) => {
    _setSelectedDateFilter(f);
    try {
      localStorage.setItem(STORAGE_KEY, f);
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
        return { startDate: today, endDate: now };
    }
  };

  return (
    <DateFilterContext.Provider 
      value={{ 
        selectedDateFilter, 
        setSelectedDateFilter,
        getDateRange
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
};
