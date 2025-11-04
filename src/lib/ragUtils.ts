import { PartnerBrandType } from '@prisma/client';

export type RAGStatus = 'Green' | 'Amber' | 'Red';

export interface AttachRateData {
  planSales: number;
  deviceSales: number;
  attachRate: number;
  averageDeviceSales3Months?: number; // For new formula
}

export interface RAGStorePerformance {
  storeId: string;
  storeName: string;
  storeType: PartnerBrandType;
  attachRate: number;
  attachRAG: RAGStatus;
  previousMonthAttach: number;
  monthlyTrendRAG: RAGStatus;
  planSales: number;
  deviceSales: number;
  city: string;
  totalRevenue: number;
}

export interface RAGSummary {
  totalStores: number;
  greenStores: number;
  amberStores: number;
  redStores: number;
  averageAttachRate: number;
  improvementStores: number; // Stores with improving trend
  decliningStores: number; // Stores with declining trend
}

// RAG thresholds based on store type
const RAG_THRESHOLDS = {
  A_PLUS: { green: 25, amber: 12 },
  A: { green: 20, amber: 12 },
  B: { green: 16, amber: 12 },
  C: { green: 14, amber: 10 },
  D: { green: 10, amber: 3 },
} as const;

/**
 * Calculate attach rate from plan sales and device sales (legacy method)
 */
export function calculateAttachRate(planSales: number, deviceSales: number): number {
  if (deviceSales === 0) return 0;
  return Math.round((planSales / deviceSales) * 100 * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate attach rate using new formula:
 * Attach Rate = (Last 7 Days Plan Sale) / ((Average Device Sold in last 3 months / 30) * 7)
 * 
 * @param last7DaysPlanSale - Plan sales from the last 7 days
 * @param averageDeviceSales3Months - Average device sales over the last 3 months
 * @returns Attach rate as percentage (0-100+)
 */
export function calculateAttachRateNew(last7DaysPlanSale: number, averageDeviceSales3Months: number): number {
  if (averageDeviceSales3Months === 0) return 0;
  
  // Calculate daily average device sales from 3-month average
  const dailyAverageDeviceSales = averageDeviceSales3Months / 30;
  
  // Calculate expected device sales for 7 days
  const expected7DaysDeviceSales = dailyAverageDeviceSales * 7;
  
  if (expected7DaysDeviceSales === 0) return 0;
  
  // Calculate attach rate percentage
  const attachRate = (last7DaysPlanSale / expected7DaysDeviceSales) * 100;
  
  return Math.round(attachRate * 100) / 100; // Round to 2 decimal places
}

/**
 * Helper function to calculate expected device sales for any period based on 3-month average
 * @param averageDeviceSales3Months - Average device sales over 3 months
 * @param days - Number of days to calculate for (default: 7)
 * @returns Expected device sales for the specified period
 */
export function getExpectedDeviceSales(averageDeviceSales3Months: number, days: number = 7): number {
  if (averageDeviceSales3Months === 0) return 0;
  return (averageDeviceSales3Months / 30) * days;
}

/**
 * Get RAG status based on store type and attach rate
 */
export function getRAGStatus(storeType: PartnerBrandType, attachRate: number): RAGStatus {
  const thresholds = RAG_THRESHOLDS[storeType];
  
  if (attachRate >= thresholds.green) return 'Green';
  if (attachRate >= thresholds.amber) return 'Amber';
  return 'Red';
}

/**
 * Get RAG status with performance degradation penalty
 * If current performance is lower than previous month, downgrade by one category
 */
export function getRAGStatusWithTrend(storeType: PartnerBrandType, currentAttachRate: number, previousAttachRate: number): RAGStatus {
  // First get the base RAG status
  const baseRAG = getRAGStatus(storeType, currentAttachRate);
  
  // If no previous data, return base status
  if (!previousAttachRate || previousAttachRate === 0) {
    return baseRAG;
  }
  
  // Check if performance declined compared to previous month
  const isDeclined = currentAttachRate < previousAttachRate;
  
  if (isDeclined) {
    // Downgrade by one category if performance declined
    switch (baseRAG) {
      case 'Green':
        return 'Amber'; // Green → Amber
      case 'Amber':
        return 'Red';   // Amber → Red
      case 'Red':
        return 'Red';   // Red stays Red (can't go lower)
      default:
        return baseRAG;
    }
  }
  
  // If performance improved or stayed same, return base status
  return baseRAG;
}

/**
 * Get monthly trend RAG status by comparing current vs previous month
 */
export function getMonthlyTrend(currentAttach: number, previousAttach: number): RAGStatus {
  const diff = currentAttach - previousAttach;
  
  if (diff >= 3) return 'Green';   // Improved by 3% or more
  if (diff > -3 && diff < 3) return 'Amber'; // Almost same (-3% to +3%)
  return 'Red'; // Dropped more than 3%
}

/**
 * Get color code for RAG status
 */
export function getRAGColor(status: RAGStatus): string {
  switch (status) {
    case 'Green': return '#10b981'; // Emerald-500
    case 'Amber': return '#f59e0b'; // Amber-500
    case 'Red': return '#ef4444';   // Red-500
    default: return '#6b7280';      // Gray-500
  }
}

/**
 * Get background color for RAG status (lighter version)
 */
export function getRAGBackgroundColor(status: RAGStatus): string {
  switch (status) {
    case 'Green': return '#d1fae5'; // Emerald-100
    case 'Amber': return '#fef3c7'; // Amber-100
    case 'Red': return '#fee2e2';   // Red-100
    default: return '#f3f4f6';      // Gray-100
  }
}

/**
 * Get RAG status emoji
 */
export function getRAGEmoji(status: RAGStatus): string {
  switch (status) {
    case 'Green': return '🟢';
    case 'Amber': return '🟡';
    case 'Red': return '🔴';
    default: return '⚪';
  }
}

/**
 * Calculate RAG summary from store performances
 */
export function calculateRAGSummary(performances: RAGStorePerformance[]): RAGSummary {
  const totalStores = performances.length;
  
  if (totalStores === 0) {
    return {
      totalStores: 0,
      greenStores: 0,
      amberStores: 0,
      redStores: 0,
      averageAttachRate: 0,
      improvementStores: 0,
      decliningStores: 0,
    };
  }

  const greenStores = performances.filter(p => p.attachRAG === 'Green').length;
  const amberStores = performances.filter(p => p.attachRAG === 'Amber').length;
  const redStores = performances.filter(p => p.attachRAG === 'Red').length;
  
  const improvementStores = performances.filter(p => p.monthlyTrendRAG === 'Green').length;
  const decliningStores = performances.filter(p => p.monthlyTrendRAG === 'Red').length;
  
  const averageAttachRate = performances.reduce((sum, p) => sum + p.attachRate, 0) / totalStores;

  return {
    totalStores,
    greenStores,
    amberStores,
    redStores,
    averageAttachRate: Math.round(averageAttachRate * 100) / 100,
    improvementStores,
    decliningStores,
  };
}

/**
 * Get store type thresholds for display
 */
export function getStoreTypeThresholds(storeType: PartnerBrandType) {
  return RAG_THRESHOLDS[storeType];
}

/**
 * Format store type for display
 */
export function formatStoreType(storeType: PartnerBrandType): string {
  switch (storeType) {
    case 'A_PLUS': return 'A+';
    case 'A': return 'A';
    case 'B': return 'B';
    case 'C': return 'C';
    case 'D': return 'D';
    default: return 'Unknown';
  }
}

/**
 * Get performance message based on RAG status
 */
export function getPerformanceMessage(status: RAGStatus): string {
  switch (status) {
    case 'Green': return 'Excellent Performance';
    case 'Amber': return 'Needs Attention';
    case 'Red': return 'Immediate Action Required';
    default: return 'Unknown Status';
  }
}

/**
 * Get performance message with degradation context
 */
export function getPerformanceMessageWithContext(storeType: PartnerBrandType, currentAttachRate: number, previousAttachRate: number): string {
  const baseRAG = getRAGStatus(storeType, currentAttachRate);
  const finalRAG = getRAGStatusWithTrend(storeType, currentAttachRate, previousAttachRate);
  
  const baseMessage = getPerformanceMessage(finalRAG);
  
  // If degraded due to decline
  if (baseRAG !== finalRAG && currentAttachRate < previousAttachRate) {
    const decline = (previousAttachRate - currentAttachRate).toFixed(1);
    return `${baseMessage} (Downgraded: -${decline}% from last month)`;
  }
  
  return baseMessage;
}

/**
 * Get trend message based on monthly trend RAG
 */
export function getTrendMessage(status: RAGStatus): string {
  switch (status) {
    case 'Green': return 'Improving';
    case 'Amber': return 'Stable';
    case 'Red': return 'Declining';
    default: return 'Unknown Trend';
  }
}

/**
 * Get priority level based on combined RAG status and trend
 */
export function getPriorityLevel(attachRAG: RAGStatus, trendRAG: RAGStatus): 'Critical' | 'High' | 'Medium' | 'Low' {
  if (attachRAG === 'Red' && trendRAG === 'Red') return 'Critical';
  if (attachRAG === 'Red' || trendRAG === 'Red') return 'High';
  if (attachRAG === 'Amber' && trendRAG === 'Amber') return 'Medium';
  return 'Low';
}

/**
 * Sort stores by priority (Critical issues first, then by attach rate descending)
 */
export function sortStoresByPriority(performances: RAGStorePerformance[]): RAGStorePerformance[] {
  return performances.sort((a, b) => {
    const aPriority = getPriorityLevel(a.attachRAG, a.monthlyTrendRAG);
    const bPriority = getPriorityLevel(b.attachRAG, b.monthlyTrendRAG);
    
    const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    
    if (priorityOrder[aPriority] !== priorityOrder[bPriority]) {
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    }
    
    // Same priority, sort by attach rate descending
    return b.attachRate - a.attachRate;
  });
}

/**
 * Filter stores by RAG status
 */
export function filterStoresByRAG(performances: RAGStorePerformance[], ragStatus: RAGStatus): RAGStorePerformance[] {
  return performances.filter(p => p.attachRAG === ragStatus);
}

/**
 * Get actionable insights based on RAG analysis
 */
export interface RAGInsight {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  storeCount?: number;
}

export function getRAGInsights(summary: RAGSummary): RAGInsight[] {
  const insights: RAGInsight[] = [];
  
  // Performance insights
  if (summary.greenStores > 0) {
    insights.push({
      type: 'success',
      title: 'Top Performers',
      message: `${summary.greenStores} store${summary.greenStores > 1 ? 's are' : ' is'} exceeding attach rate targets`,
      storeCount: summary.greenStores
    });
  }
  
  if (summary.redStores > 0) {
    insights.push({
      type: 'danger',
      title: 'Action Required',
      message: `${summary.redStores} store${summary.redStores > 1 ? 's need' : ' needs'} immediate attention for low attach rates`,
      storeCount: summary.redStores
    });
  }
  
  // Trend insights
  if (summary.improvementStores > 0) {
    insights.push({
      type: 'info',
      title: 'Improving Trend',
      message: `${summary.improvementStores} store${summary.improvementStores > 1 ? 's are' : ' is'} showing positive growth`,
      storeCount: summary.improvementStores
    });
  }
  
  if (summary.decliningStores > 0) {
    insights.push({
      type: 'warning',
      title: 'Declining Performance',
      message: `${summary.decliningStores} store${summary.decliningStores > 1 ? 's are' : ' is'} showing declining trends`,
      storeCount: summary.decliningStores
    });
  }
  
  // Overall performance insight
  if (summary.totalStores > 0) {
    const healthScore = Math.round(((summary.greenStores + summary.amberStores * 0.5) / summary.totalStores) * 100);
    insights.push({
      type: healthScore >= 70 ? 'success' : healthScore >= 50 ? 'warning' : 'danger',
      title: 'Overall Health Score',
      message: `${healthScore}% of stores are meeting or approaching targets (avg. ${summary.averageAttachRate}% attach rate)`
    });
  }
  
  return insights;
}