export interface MetricData {
  count: number;
  change?: string;
  status?: string;
  trend: 'up' | 'warning' | 'active' | 'critical';
}

export interface BrandData {
  id: string;
  name: string;
  logo: string;
  uniqueStores: number;
  visits: number;
  color: string;
}

export interface DashboardData {
  totalVisits: MetricData;
  pendingReviews: MetricData;
  issuesReported: MetricData;
  brandData: BrandData[];
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  active: boolean;
  href: string;
}

export interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

export type TimeframeOption = 'Last 7 Days' | 'Last 30 Days' | 'Last 90 Days' | 'Last Year';
export type BrandFilterOption = 'All Brands' | string;

// Store-related types
export interface StoreData {
  id: string;
  storeName: string;
  partnerBrands: string[];
  address: string;
  contactPerson: string;
  assignedTo: string;
  pendingReviews: number;
  pendingIssues: number;
  city: string;
  status: 'Active' | 'Inactive' | 'Pending';
}

export interface StoreFilters {
  partnerBrand: string;
  city: string;
  storeName: string;
  executiveName: string;
  showOnlyUnresolvedIssues: boolean;
  showOnlyUnreviewedVisits: boolean;
}

export type PartnerBrandOption = 'All Brands' | 'Samsung' | 'Vivo' | 'Oppo' | 'OnePlus' | 'Realme' | 'Xiaomi';
export type CityFilterOption = 'All City' | string;
export type StoreNameFilterOption = 'All Store' | string;
export type ExecutiveFilterOption = 'All Executive' | string;
export type StatusFilterOption = 'All Status' | 'Active' | 'Inactive' | 'Pending';

// Executive-related types
export interface ExecutiveData {
  id: string;
  name: string;
  initials: string;
  region: string;
  totalVisits: number;
  lastVisit: string;
  assignedStoreIds: string[];
  avatarColor: string;
}

export interface ExecutiveFilters {
  executiveName: string;
  storeName: string;
}

export type RegionFilterOption = 'All Regions' | 'East Delhi' | 'West Delhi' | 'South Delhi' | 'North Delhi' | 'Central Delhi';

// Settings-related types
export interface SettingsData {
  autoApprovalTime: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  defaultRegion: string;
  timeZone: string;
}

export type ApprovalTimeOption = '1 hour' | '2 hours' | '4 hours' | '6 hours' | '12 hours' | '24 hours';
export type RegionOption = 'North Region' | 'South Region' | 'East Region' | 'West Region' | 'Central Region';
export type TimeZoneOption = 'IST (Indian Standard Time)' | 'UTC' | 'GMT';

// Visit Report related types
export interface StoreVisitReport {
  storeId: string;
  storeName: string;
  address: string;
  brands: string[];
  visits: ExecutiveVisit[];
}

export interface ExecutiveVisit {
  id: string;
  executiveName: string;
  executiveInitials: string;
  avatarColor: string;
  personMet: string;
  role: string;
  visitDate: string;
  visitTime: string;
  displayChecked: boolean;
  photosCount: number;
  feedback: string;
  issues: string;
  status: 'Pending Review' | 'Reviewed' | 'Pending Issue';
  reviewStatus: 'Resolved' | 'Pending Review' | 'Pending Issue';
  issueId?: string; // Reference to created issue
  hasUnresolvedIssue?: boolean; // Quick check for issues that need attention
}

export interface VisitFilters {
  executiveName: string;
  status: string;
}

export type VisitStatusOption = 'All Status' | 'PENDING_REVIEW' | 'REVIEWD';
export type IssueStatusFilterOption = 'All Status' | 'Pending' | 'Assigned' | 'Resolved';

// Executive Detail interfaces
export interface ExecutiveDetailData {
  id: string;
  name: string;
  employeeId: string;
  region: string;
  email: string;
  phone: string;
  joinDate: string;
  status: 'Active' | 'Inactive';
  profilePicture?: string;
  initials: string;
  avatarColor: string;
  partnerBrands: string[];
  assignedStores: ExecutiveStore[];
  performanceMetrics: ExecutiveMetrics;
  recentVisits: ExecutiveVisitDetail[];
}

export interface ExecutiveStore {
  id: string;
  name: string;
  address: string;
  lastVisit: string;
  totalVisits: number;
  pendingReviews: number;
  status: 'Active' | 'Inactive';
}

export interface ExecutiveMetrics {
  totalVisits: number;
  thisMonth: number;
  pendingReviews: number;
  completedReviews: number;
  averageRating: number;
  storesAssigned: number;
  issuesReported: number;
  issuesResolved: number;
}

export interface ExecutiveVisitDetail {
  id: string;
  storeId: string;
  storeName: string;
  visitDate: string;
  visitTime: string;
  personMet: string;
  personRole: string;
  purpose: string;
  feedback: string;
  issues: string;
  photos: number;
  displaySetup: string;
  reviewStatus: 'Pending Review' | 'Reviewed' | 'Issues Reported';
  createdAt: string;
}

export interface ExecutiveDetailFilters {
  storeName: string;
  status: string;
  dateRange: string;
}

// Issue Management interfaces
export interface IssueData {
  id: string;
  issueId: string;
  storeName: string;
  storeId: string;
  location: string;
  brandAssociated: string;
  city: string;
  dateReported: string;
  reportedBy: string;
  reportedByRole: string;
  status: 'Pending' | 'Assigned' | 'Resolved';
  description: string;
  assignmentHistory: IssueAssignment[];
  comments: IssueComment[];
  resolution?: string;
  resolvedBy?: string;
  resolvedDate?: string;
  createdAt: string;
  updatedAt: string;
  // Visit context information
  relatedVisitId?: string;
  visitContext?: {
    visitDate: string;
    executiveName: string;
    executiveInitials: string;
    personMet: string;
    personRole: string;
    feedback: string;
    photosCount: number;
    displayChecked: boolean;
  };
}

export interface IssueAssignment {
  id: string;
  executiveId: string;
  executiveName: string;
  executiveInitials: string;
  dateAssigned: string;
  adminComment: string;
  status: 'Assigned' | 'In Progress' | 'Completed' | 'Rejected';
  assignedBy: string;
}

export interface IssueComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'Admin' | 'Executive' | 'Store Manager';
  comment: string;
  createdAt: string;
  attachments?: string[];
}

export interface IssueFilters {
  storeName: string;
  status: string;
  assignedTo: string;
  dateRange: string;
}

export type IssueStatusOption = 'All Status' | 'Pending' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed';
export type IssuePriorityOption = 'All Priority' | 'Low' | 'Medium' | 'High' | 'Critical';
export type IssueCategoryOption = 'All Category' | 'Display' | 'Technical' | 'Inventory' | 'Customer Service' | 'Other';
export type IssueAssigneeOption = 'All Assignees' | string;
