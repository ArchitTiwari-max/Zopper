import React, { useMemo } from 'react';
import { generateWeekOptions, getCurrentWeekValue, WeekOption } from '@/lib/weekUtils';

interface WeekFilterProps {
  value: string;
  onChange: (value: string) => void;
  weeksCount?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

/**
 * WeekFilter component for selecting weeks in analytics
 * Shows weeks in format "Week X (DD - DD)" starting from Monday
 */
export function WeekFilter({
  value,
  onChange,
  weeksCount = 8,
  disabled = false,
  className = '',
  style = {},
  label = 'Week'
}: WeekFilterProps) {
  const weekOptions = useMemo(() => {
    return generateWeekOptions(new Date(), weeksCount);
  }, [weeksCount]);

  const currentWeek = getCurrentWeekValue();

  // If no value is provided, default to current week
  const selectedValue = value || currentWeek;

  // Find selected option for additional info
  const selectedOption = weekOptions.find(opt => opt.value === selectedValue);

  return (
    <div className={`week-filter ${className}`.trim()} style={style}>
      {label && (
        <label 
          htmlFor="week-select"
          style={{ 
            fontWeight: 600, 
            fontSize: 13, 
            color: '#374151',
            display: 'block',
            marginBottom: 6
          }}
        >
          {label}
        </label>
      )}
      
      <select
        id="week-select"
        value={selectedValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: 8,
          border: '1px solid #ddd',
          borderRadius: 6,
          fontSize: 14,
          backgroundColor: disabled ? '#f5f5f5' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%',
          minWidth: 200,
          ...style
        }}
      >
        {weekOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {selectedOption && (
        <div style={{
          fontSize: 11,
          color: '#6b7280',
          marginTop: 4,
          fontStyle: 'italic'
        }}>
          {selectedOption.monthName} {selectedOption.year}
        </div>
      )}
    </div>
  );
}

export default WeekFilter;