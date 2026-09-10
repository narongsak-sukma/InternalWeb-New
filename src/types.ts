export type NewsCategory =
  | 'kbj-news'
  | 'ncb-news'
  | 'bot-news'
  | 'regulation'
  | 'hr-announcement'
  | 'all-about-money'
  | 'lifestyle';

export interface NewsItem {
  id: string;
  title: string;
  titleEn?: string;
  summary: string;
  content: string;
  category: NewsCategory;
  categoryLabel: string;
  badge?: string;
  badgeColor?: 'red' | 'orange' | 'blue' | 'emerald' | 'amber';
  imageUrl?: string;
  publishedAt: string;
  readTime?: string;
  author: string;
  department: string;
  isImportantAlert?: boolean;
  views: number;
  syncToExternal: boolean;
  externalSyncStatus?: 'synced' | 'pending' | 'pending_approval' | 'draft' | 'rejected';
  externalCategory?: 'press-release' | 'csr' | 'product-notice' | 'compliance' | 'money-tips' | 'lifestyle';
  attachmentUrl?: string;
  attachmentName?: string;
  approvedBy?: string;
  approvedAt?: string;
  /** User id of the maker/admin who submitted the item for approval (FR-NEWS-009 self-approval guard). */
  submittedBy?: string;
  submittedAt?: string;
}

export interface BannerSlide {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
  actionUrl: string;
  actionText: string;
  order: number;
  isActive: boolean;
}

export interface DirectoryContact {
  id: string;
  name: string;
  nameEn: string;
  position: string;
  department: string;
  extension: string;
  directPhone?: string;
  email: string;
  floor: string;
  avatarUrl?: string;
}

export interface MeetingRoom {
  id: string;
  name: string;
  code: string;
  floor: string;
  capacity: number;
  facilities: string[];
  status: 'available' | 'in-use' | 'maintenance';
  currentBooking?: {
    topic: string;
    booker: string;
    time: string;
  };
}

export interface PolicyDocument {
  id: string;
  title: string;
  titleEn: string;
  category: 'policy' | 'work-rules' | 'form' | 'handbook' | 'governance';
  department: string;
  version: string;
  updatedAt: string;
  fileSize: string;
  downloadUrl: string;
  isNew?: boolean;
}

export interface SystemTool {
  id: string;
  name: string;
  description: string;
  iconName: string;
  url: string;
  category: 'hr' | 'it' | 'business' | 'general';
  isExternal?: boolean;
  color: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  itemId: string;
  itemTitle: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'FORCE_SYNC';
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  targetEndpoint: string;
  syncedBy: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: 'UPDATE' | 'SUBMIT_APPROVAL' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'USER_CREATE' | 'USER_ACTIVATE' | 'USER_DEACTIVATE' | 'FILE_UPLOAD' | 'SYNC_TRIGGER' | 'SYSTEM_EXPORT' | 'ACCESS_DENIED';
  targetResource: string;
  resourceId: string;
  details: string;
  ipAddress?: string;
  status: 'SUCCESS' | 'REJECTED' | 'WARNING';
}

// Authentication & RBAC (role hierarchy: admin > checker > maker > staff)
export type UserRole = 'admin' | 'checker' | 'maker' | 'staff';

export const USER_ROLES: UserRole[] = ['admin', 'checker', 'maker', 'staff'];

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isActive: boolean;
}

/** User shape safe to expose over the API (no password hash). */
export type SafeUser = Omit<User, 'passwordHash'>;

export type ViewMode = 'intranet' | 'admin-cms' | 'external-web';
