/**
 * Week utility functions for analytics filters
 * Generates weeks that start on Monday with format: "Week X (DD - DD)"
 */

export interface WeekOption {
  value: string; // ISO date string of Monday (start of week)
  label: string; // Display format like "Week 2 (8 - 14)"
  startDate: Date;
  endDate: Date;
  weekNumber: number;
  monthName: string;
  year: number;
}

/**
 * Get the Monday of the week for a given date
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Convert Sunday (0) to 7 for easier calculation
  const daysFromMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysFromMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Sunday (end) of the week for a given Monday
 */
export function getSundayOfWeek(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Format date as DD
 */
export function formatDay(date: Date): string {
  return date.getDate().toString();
}

/**
 * Get week number within the month (1-based)
 */
export function getWeekNumberInMonth(monday: Date): number {
  const firstOfMonth = new Date(monday.getFullYear(), monday.getMonth(), 1);
  const firstMonday = getMondayOfWeek(firstOfMonth);
  
  // If first Monday is in previous month, start counting from next Monday
  if (firstMonday.getMonth() !== monday.getMonth()) {
    firstMonday.setDate(firstMonday.getDate() + 7);
  }
  
  const daysDiff = (monday.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000);
  return Math.floor(daysDiff / 7) + 1;
}

/**
 * Get month name
 */
export function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long' });
}

/**
 * Generate week options for the current month and previous month
 * @param referenceDate - Reference date (default: today)
 * @param weeksCount - Number of weeks to generate (default: 8)
 */
export function generateWeekOptions(
  referenceDate: Date = new Date(),
  weeksCount: number = 8
): WeekOption[] {
  const options: WeekOption[] = [];
  
  // Start from current week and go backwards
  const currentWeekMonday = getMondayOfWeek(referenceDate);
  
  for (let i = 0; i < weeksCount; i++) {
    const weekMonday = new Date(currentWeekMonday);
    weekMonday.setDate(weekMonday.getDate() - (i * 7));
    
    const weekSunday = getSundayOfWeek(weekMonday);
    const weekNumber = getWeekNumberInMonth(weekMonday);
    const monthName = getMonthName(weekMonday);
    const year = weekMonday.getFullYear();
    
    // Format the date range
    const startDay = formatDay(weekMonday);
    const endDay = formatDay(weekSunday);
    
    // Handle cross-month weeks
    let label: string;
    if (weekMonday.getMonth() === weekSunday.getMonth()) {
      // Same month: "Week 2 (8 - 14)"
      label = `Week ${weekNumber} (${startDay} - ${endDay})`;
    } else {
      // Cross month: "Week 1 (29 Oct - 4 Nov)" 
      const startMonth = weekMonday.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = weekSunday.toLocaleDateString('en-US', { month: 'short' });
      label = `Week ${weekNumber} (${startDay} ${startMonth} - ${endDay} ${endMonth})`;
    }
    
    options.push({
      value: weekMonday.toISOString().split('T')[0], // YYYY-MM-DD format
      label,
      startDate: weekMonday,
      endDate: weekSunday,
      weekNumber,
      monthName,
      year
    });
  }
  
  return options;
}

/**
 * Parse a week value (YYYY-MM-DD) back to start and end dates
 */
export function parseWeekValue(weekValue: string): { startDate: Date; endDate: Date } | null {
  try {
    const startDate = new Date(weekValue + 'T00:00:00.000Z');
    if (isNaN(startDate.getTime())) return null;
    
    const endDate = getSundayOfWeek(startDate);
    return { startDate, endDate };
  } catch {
    return null;
  }
}

/**
 * Get current week value (Monday's date in YYYY-MM-DD format)
 */
export function getCurrentWeekValue(): string {
  const currentWeekMonday = getMondayOfWeek(new Date());
  return currentWeekMonday.toISOString().split('T')[0];
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  const startDay = formatDay(startDate);
  const endDay = formatDay(endDate);
  
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startDay} - ${endDay}`;
  } else {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  }
}