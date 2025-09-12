'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface DateFilterContextType {
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  availablePeriods: { value: string; label: string }[];
}

const defaultPeriods = [
  { value: 'Last 7 Days', label: 'Last 7 Days' },
  { value: 'Last 30 Days', label: 'Last 30 Days' },
  { value: 'Last 90 Days', label: 'Last 90 Days' },
];

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
  defaultPeriod?: string;
  periods?: { value: string; label: string }[];
}

export const DateFilterProvider: React.FC<DateFilterProviderProps> = ({
  children,
  defaultPeriod = 'Last 30 Days',
  periods = defaultPeriods,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);

  const value: DateFilterContextType = {
    selectedPeriod,
    setSelectedPeriod,
    availablePeriods: periods,
  };

  return (
    <DateFilterContext.Provider value={value}>
      {children}
    </DateFilterContext.Provider>
  );
};
