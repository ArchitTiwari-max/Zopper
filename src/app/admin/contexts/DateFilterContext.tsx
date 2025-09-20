'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DateFilterOption = 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Last Year';

interface DateFilterContextType {
  selectedDateFilter: DateFilterOption;
  setSelectedDateFilter: (filter: DateFilterOption) => void;
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
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterOption>('Last 30 Days');

  return (
    <DateFilterContext.Provider 
      value={{ 
        selectedDateFilter, 
        setSelectedDateFilter 
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
};
