'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DateFilterOption = 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Last Year';

interface DateFilterContextType {
  selectedDateFilter: DateFilterOption;
  setSelectedDateFilter: (filter: DateFilterOption) => void;
  getDateRange: () => { startDate: Date; endDate: Date };
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

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
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterOption>('Today');

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (selectedDateFilter) {
      case 'Today':
        return {
          startDate: today,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) // End of today
        };
      case 'Yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: yesterday,
          endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1) // End of yesterday
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
