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
 * Get week number within the year (1-based)
 * Week 1 is the first Monday of the year
 */
export function getWeekNumberInYear(monday: Date): number {
  const firstOfYear = new Date(monday.getFullYear(), 0, 1);
  const firstMonday = getMondayOfWeek(firstOfYear);
  
  // If first Monday is in next year (Jan 1 is late in week), skip to next Monday
  if (firstMonday.getFullYear() < monday.getFullYear()) {
    firstMonday.setFullYear(monday.getFullYear());
    firstMonday.setMonth(0);
    firstMonday.setDate(1);
    const tempMonday = getMondayOfWeek(firstMonday);
    if (tempMonday.getFullYear() < monday.getFullYear()) {
      firstMonday.setDate(firstMonday.getDate() + 7);
    }
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
 * Generate week options from week 1 of the year to current week
 * All weeks start on Monday and are numbered from the first Monday of the year
 * @param referenceDate - Reference date (default: today)
 * @param weeksCount - Ignored, generates all weeks from year start
 */
export function generateWeekOptions(
  referenceDate: Date = new Date(),
  weeksCount: number = 8
): WeekOption[] {
  const options: WeekOption[] = [];
  
  // Find first Monday of the year
  const firstOfYear = new Date(referenceDate.getFullYear(), 0, 1);
  let firstMonday = getMondayOfWeek(firstOfYear);
  
  // If first Monday is in previous year, move to first Monday of current year
  if (firstMonday.getFullYear() < referenceDate.getFullYear()) {
    firstMonday = new Date(referenceDate.getFullYear(), 0, 1);
    // Find the first Monday
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }
  }
  
  // Current week
  const currentWeekMonday = getMondayOfWeek(referenceDate);
  
  // Generate all weeks from first Monday to current week
  let weekMonday = new Date(firstMonday);
  let weekNum = 1;
  
  while (weekMonday <= currentWeekMonday) {
    const weekSunday = getSundayOfWeek(weekMonday);
    const monthName = getMonthName(weekMonday);
    const year = weekMonday.getFullYear();
    
    // Format the date range
    const startDay = formatDay(weekMonday);
    const endDay = formatDay(weekSunday);
    
    // Always use format: "Week X (DD Mon - DD Mon)"
    const startMonth = weekMonday.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = weekSunday.toLocaleDateString('en-US', { month: 'short' });
    const label = `Week ${weekNum} (${startDay} ${startMonth} - ${endDay} ${endMonth})`;
    
    options.push({
      value: weekMonday.toISOString().split('T')[0], // YYYY-MM-DD format
      label,
      startDate: new Date(weekMonday),
      endDate: weekSunday,
      weekNumber: weekNum,
      monthName,
      year
    });
    
    // Move to next Monday
    weekMonday = new Date(weekMonday);
    weekMonday.setDate(weekMonday.getDate() + 7);
    weekNum++;
  }
  
  // Reverse so current week is first
  return options.reverse();
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