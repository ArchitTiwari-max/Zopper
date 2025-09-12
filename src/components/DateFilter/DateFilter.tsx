'use client';

import React from 'react';
import { useDateFilter } from '@/app/executive/contexts/DateFilterContext';
import './DateFilter.css';

interface DateFilterProps {
  className?: string;
  disabled?: boolean;
}

const DateFilter: React.FC<DateFilterProps> = ({
  className = '',
  disabled = false
}) => {
  const { selectedPeriod, setSelectedPeriod, availablePeriods } = useDateFilter();

  return (
    <div className={`date-filter-container ${className}`}>
      <select 
        className="date-filter-select"
        value={selectedPeriod}
        onChange={(e) => setSelectedPeriod(e.target.value)}
        disabled={disabled}
      >
        {availablePeriods.map((period) => (
          <option key={period.value} value={period.value}>
            {period.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DateFilter;
