import { PartnerBrandType } from '@prisma/client';

export type RAGStatus = 'green' | 'amber' | 'red';

export type PerformanceChange = 'improved' | 'declined' | 'stable';

export interface RAGCriteria {
  A_PLUS: { green: number; amber: number };
  A: { green: number; amber: number };
  B: { green: number; amber: number };
  C: { green: number; amber: number };
  D: { green: number; amber: number };
}

export interface BrandRAGDetails {
  brandType: PartnerBrandType;
  brandName: string;
  currentAttachRate: number;
  previousAttachRate: number;
  baseStatus: RAGStatus;
  finalStatus: RAGStatus;
  performanceChange: PerformanceChange;
}

export interface StoreRAGData {
  id: string;
  storeName: string;
  city: string;
  address: string;
  partnerBrands: string[];
  ragStatus: RAGStatus;
  brandRAGDetails: BrandRAGDetails[];
  // Summary metrics
  totalBrands: number;
  greenBrands: number;
  amberBrands: number;
  redBrands: number;
  // Performance indicators
  improvingBrands: number;
  decliningBrands: number;
  stableBrands: number;
}

export interface RAGSummary {
  total: number;
  green: number;
  amber: number;
  red: number;
  // Performance trends
  improving: number;
  declining: number;
  stable: number;
}

export interface RAGStatusResponse {
  stores: StoreRAGData[];
  summary: RAGSummary;
  metadata: {
    currentMonth: number;
    previousMonth: number;
    year: number;
    criteria: RAGCriteria;
    filtersApplied: {
      city: string;
      partnerBrand: string;
      ragStatus: string;
    };
  };
}

// For the simplified summary endpoint
export interface StoreRAGSummary {
  ragStatus: RAGStatus;
  attachRateInfo: {
    current: number;
    previous: number;
    change: PerformanceChange;
  };
  brandDetails: Array<{
    brandType: PartnerBrandType;
    brandName: string;
    status: RAGStatus;
    attachRate: number;
  }>;
}

export interface RAGSummaryResponse {
  ragSummary: Record<string, StoreRAGSummary>;
  metadata: {
    currentMonth: number;
    previousMonth: number;
    year: number;
    criteria: RAGCriteria;
    totalStores: number;
  };
}

// Utility types for UI components
export interface RAGStatusColors {
  green: string;
  amber: string;
  red: string;
}

export interface RAGStatusLabels {
  green: string;
  amber: string;
  red: string;
}

// Default values for UI
export const RAG_COLORS: RAGStatusColors = {
  green: '#10B981', // emerald-500
  amber: '#F59E0B', // amber-500  
  red: '#EF4444'    // red-500
};

export const RAG_LABELS: RAGStatusLabels = {
  green: 'Good',
  amber: 'Warning',
  red: 'Critical'
};

// CSS classes for styling
export const RAG_CSS_CLASSES = {
  green: 'bg-green-100 text-green-800 border-green-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-red-100 text-red-800 border-red-200'
};

export const RAG_DOT_CLASSES = {
  green: 'bg-green-500',
  amber: 'bg-amber-500', 
  red: 'bg-red-500'
};