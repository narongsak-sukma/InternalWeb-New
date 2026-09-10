import React, { useState, useEffect, useRef } from 'react';
import {
  NewsItem,
  BannerSlide,
  DirectoryContact,
  PolicyDocument,
  MeetingRoom,
  SyncLog,
  AuditLog,
  NewsCategory
} from '../types';
import { api } from '../api';
import type { AuthUser, Role } from '../api';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  CheckCircle2,
  RefreshCw,
  Globe,
  Share2,
  Eye,
  AlertTriangle,
  Upload,
  FileText,
  PhoneCall,
  Layers,
  Sparkles,
  Search,
  Check,
  Building,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Clock,
  Activity,
  Database,
  FileCode2,
  ExternalLink,
  Lock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  AlertCircle,
  X,
  Inbox,
  Users,
  UserPlus,
  KeyRound
} from 'lucide-react';

/* ============================================================
   RBAC helpers — admin > checker > maker > staff.
   No userRole prop (legacy default) = unrestricted, preserving
   the previous behavior. Unknown role strings get least privilege.
   ============================================================ */

const ROLE_RANK: Record<string, number> = { admin: 4, checker: 3, maker: 2, staff: 1 };
type MinimumRole = 'maker' | 'checker' | 'admin';

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  'kbj-news': 'KB J News',
  'bot-news': 'BOT News',
  'ncb-news': 'NCB News',
  regulation: 'New Regulations',
  'hr-announcement': 'HR Announcement',
  'all-about-money': 'All About Money',
  lifestyle: 'Lifestyle',
};

/* Maker-checker publication states (Thai-first chips) */
const SYNC_STATUS_META: Record<
  string,
  { th: string; en: string; className: string; pulse?: boolean }
> = {
  draft: {
    th: 'ร่าง',
    en: 'Draft',
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
  pending_approval: {
    th: 'รอการอนุมัติ',
    en: 'Pending Approval',
    className: 'bg-amber-100 text-amber-900 border border-amber-300',
    pulse: true,
  },
  synced: {
    th: 'เผยแพร่แล้ว',
    en: 'Live on Public Web',
    className: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  },
  rejected: {
    th: 'ถูกปฏิเสธ',
    en: 'Rejected',
    className: 'bg-rose-100 text-rose-800 border border-rose-200',
  },
  pending: {
    th: 'กำลังซิงก์',
    en: 'Pending Sync',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
};

const PAGE_SIZE = 10;

const iconBtnFocus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60';

/* ---------- Small local UI primitives (module scope) ---------- */

interface EmptyStateProps {
  icon?: React.ReactNode;
  th: string;
  en: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, th, en }) => (
  <div className="py-12 text-center">
    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
      {icon || <Inbox className="w-6 h-6" />}
    </div>
    <p className="text-sm font-bold text-slate-500">{th}</p>
    <p className="text-xs text-slate-400 mt-1">{en}</p>
  </div>
);

interface PagerProps {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}

const Pager: React.FC<PagerProps> = ({ page, pageCount, total, onPageChange }) => (
  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60 text-xs">
    <span className="text-slate-400 font-medium">
      ทั้งหมด {total.toLocaleString()} รายการ — หน้า {page} / {pageCount}
    </span>
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="หน้าก่อนหน้า / Previous page"
        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="หน้าถัดไป / Next page"
        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

interface SyncStatusChipProps {
  status: string;
}

const SyncStatusChip: React.FC<SyncStatusChipProps> = ({ status }) => {
  const meta = SYNC_STATUS_META[status] ?? SYNC_STATUS_META.draft;
  return (
    <span
      title={`${meta.th} / ${meta.en}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${meta.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'synced' ? 'bg-emerald-500' : status === 'rejected' ? 'bg-rose-500' : status === 'pending_approval' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
      {meta.th}
    </span>
  );
};

interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
}

interface ConfirmDialogProps {
  config: ConfirmConfig;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ config, busy, onCancel, onConfirm }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={config.title}
        className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
            config.tone === 'danger'
              ? 'bg-rose-50 text-rose-600 border border-rose-200'
              : 'bg-amber-50 text-amber-600 border border-amber-200'
          }`}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">{config.title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed mt-2 whitespace-pre-line">{config.message}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs disabled:opacity-50 transition cursor-pointer"
          >
            ยกเลิก / Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-60 ${
              config.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{config.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface AdminCMSProps {
  news: NewsItem[];
  banners: BannerSlide[];
  contacts: DirectoryContact[];
  documents: PolicyDocument[];
  rooms: MeetingRoom[];
  syncLogs: SyncLog[];
  auditLogs?: AuditLog[];
  onAddNews: (item: NewsItem) => void;
  onUpdateNews: (item: NewsItem) => void;
  onDeleteNews: (id: string) => void;
  onToggleExternalSync: (id: string) => void;
  onSubmitForApproval?: (id: string) => void;
  onApproveNews?: (id: string) => void;
  onRejectNews?: (id: string, reason?: string) => void;
  onAddBanner: (banner: BannerSlide) => void;
  onDeleteBanner: (id: string) => void;
  onAddContact: (contact: DirectoryContact) => void;
  onDeleteContact: (id: string) => void;
  onAddDocument: (doc: PolicyDocument) => void;
  onDeleteDocument: (id: string) => void;
  onUpdateRoomStatus: (roomId: string, status: 'available' | 'in-use' | 'maintenance') => void;
  onTriggerFullSync: () => void;
  /** Authenticated actor's role ('admin' | 'checker' | 'maker' | 'staff'). Omitted = legacy unrestricted mode. */
  userRole?: string;
  /** Called when an unauthenticated visitor tries to use the CMS (e.g. show the login page). */
  onRequireAuth?: () => void;
}

export const AdminCMS: React.FC<AdminCMSProps> = ({
  news,
  banners,
  contacts,
  documents,
  rooms,
  syncLogs,
  auditLogs = [],
  onAddNews,
  onUpdateNews,
  onDeleteNews,
  onToggleExternalSync,
  onSubmitForApproval,
  onApproveNews,
  onRejectNews,
  onAddBanner,
  onDeleteBanner,
  onAddContact,
  onDeleteContact,
  onAddDocument,
  onDeleteDocument,
  onUpdateRoomStatus,
  onTriggerFullSync,
  userRole,
  onRequireAuth,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'news' | 'banners' | 'directory' | 'documents' | 'rooms' | 'users' | 'sync-logs' | 'audit-trail'
  >('news');

  // News Form State
  const [isEditingNews, setIsEditingNews] = useState(false);
  // null = creating a new article; a non-null id = updating that article.
  // NEVER branch create-vs-update on isEditingNews: the create form also sets
  // it true, which sent PUT /api/news/ (empty id → 404) instead of POST.
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsTitleEn, setNewsTitleEn] = useState('');
  const [newsCategory, setNewsCategory] = useState<NewsCategory>('kbj-news');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsDepartment, setNewsDepartment] = useState('Marketing & PR');
  const [newsBadge, setNewsBadge] = useState('ANNOUNCEMENT');
  const [newsBadgeColor, setNewsBadgeColor] = useState<'red' | 'orange' | 'blue' | 'emerald' | 'amber'>('amber');
  const [newsImageUrl, setNewsImageUrl] = useState('https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=1000&q=80');
  const [newsIsImportantAlert, setNewsIsImportantAlert] = useState(false);
  const [newsSyncToExternal, setNewsSyncToExternal] = useState(false);
  // Canonical union from NewsItem['externalCategory'] — a narrower hand-rolled
  // literal set broke strict typing at the setNewsExternalCategory call sites
  // (values 'money-tips'/'lifestyle' are legal per src/types.ts).
  const [newsExternalCategory, setNewsExternalCategory] = useState<NonNullable<NewsItem['externalCategory']>>('press-release');

  // Contact Form State
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactNameEn, setContactNameEn] = useState('');
  const [contactPos, setContactPos] = useState('');
  const [contactDept, setContactDept] = useState('General Affairs');
  const [contactExt, setContactExt] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactFloor, setContactFloor] = useState('14th Floor');

  // Banner Form State
  const [isAddingBanner, setIsAddingBanner] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerBadge, setBannerBadge] = useState('INTERNAL NEWS');
  const [bannerUrl, setBannerUrl] = useState('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80');
  const [bannerActionText, setBannerActionText] = useState('อ่านเพิ่มเติม');
  const [bannerActionUrl, setBannerActionUrl] = useState('#');

  // Document Form State
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docTitleEn, setDocTitleEn] = useState('');
  const [docCategory, setDocCategory] = useState<'policy' | 'work-rules' | 'form' | 'handbook' | 'governance'>('form');
  const [docDept, setDocDept] = useState('Human Resources');
  const [docVersion, setDocVersion] = useState('v1.0');

  // Search in CMS
  const [filterText, setFilterText] = useState('');

  /* ---------- RBAC gates (default props = legacy unrestricted mode) ---------- */
  const needsSignIn = Boolean(onRequireAuth) && !userRole;
  const accessDenied = userRole ? (ROLE_RANK[userRole] ?? 1) < ROLE_RANK.maker : false;
  const roleRank = userRole ? (ROLE_RANK[userRole] ?? 1) : null;
  const can = (min: MinimumRole) => roleRank === null || roleRank >= ROLE_RANK[min];
  const canWrite = can('maker');
  const canCheck = can('checker');
  const canAdmin = can('admin');

  /* ---------- Async feedback states ---------- */
  const [savingNews, setSavingNews] = useState(false);
  const [newsFormError, setNewsFormError] = useState<string | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerFormError, setBannerFormError] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [contactFormError, setContactFormError] = useState<string | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [docFormError, setDocFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /* ---------- Unsaved-changes snapshots (dirty = differs from open-time snapshot) ---------- */
  const [newsSnapshot, setNewsSnapshot] = useState('');
  const [bannerSnapshot, setBannerSnapshot] = useState('');
  const [contactSnapshot, setContactSnapshot] = useState('');
  const [docSnapshot, setDocSnapshot] = useState('');

  const newsDirty =
    isEditingNews &&
    JSON.stringify({
      t: newsTitle, e: newsTitleEn, c: newsCategory, s: newsSummary, x: newsContent,
      d: newsDepartment, b: newsBadge, bc: newsBadgeColor, i: newsImageUrl,
      a: newsIsImportantAlert, sy: newsSyncToExternal, ec: newsExternalCategory,
    }) !== newsSnapshot;
  const bannerDirty =
    isAddingBanner &&
    JSON.stringify({
      t: bannerTitle, s: bannerSubtitle, b: bannerBadge, u: bannerUrl,
      at: bannerActionText, au: bannerActionUrl,
    }) !== bannerSnapshot;
  const contactDirty =
    isAddingContact &&
    JSON.stringify({
      n: contactName, e: contactNameEn, p: contactPos, d: contactDept,
      x: contactExt, m: contactEmail, f: contactFloor,
    }) !== contactSnapshot;
  const docDirty =
    isAddingDoc &&
    JSON.stringify({
      t: docTitle, e: docTitleEn, c: docCategory, d: docDept, v: docVersion,
    }) !== docSnapshot;

  /* ---------- Confirm dialog (deletes + unsaved-changes guard) ---------- */
  const [confirmCfg, setConfirmCfg] = useState<ConfirmConfig | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const runConfirm = async () => {
    if (!confirmCfg || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await confirmCfg.onConfirm();
    } finally {
      // Always close — even if onConfirm throws, a stuck open dialog is what
      // stacked a second Cancel button over the form on the failed-save path.
      setConfirmCfg(null);
      setConfirmBusy(false);
    }
  };

  /* ---------- Pagination ---------- */
  const [pageByTab, setPageByTab] = useState<Record<string, number>>({});
  const pageOf = (key: string, pageCount: number) => Math.min(pageByTab[key] ?? 1, pageCount);
  const turnPage = (key: string, page: number, pageCount: number) =>
    setPageByTab((prev) => ({ ...prev, [key]: Math.min(Math.max(1, page), pageCount) }));
  useEffect(() => {
    // New filter text → every list back to page 1
    setPageByTab({});
  }, [filterText]);

  /* ---------- Maker-checker reject flow (checker must give a reason) ---------- */
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  /* ---------- Image uploads via POST /api/upload (fail-safe to manual URL) ---------- */
  const newsImageInputRef = useRef<HTMLInputElement | null>(null);
  const bannerImageInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUploadImage = async (file: File | undefined, target: 'news-image' | 'banner-image') => {
    if (!file) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      const uploaded = await api.uploadFile(file);
      if (!uploaded?.url) throw new Error('Malformed upload response');
      if (target === 'news-image') setNewsImageUrl(uploaded.url);
      else setBannerUrl(uploaded.url);
    } catch {
      // Fail-safe: keep the manual URL input as the working path
      setUploadError(
        'อัปโหลดไฟล์ไม่สำเร็จ — คุณยังสามารถวางลิงก์รูปภาพด้วยตนเองได้ / Upload failed — you can still paste an image URL manually.'
      );
    } finally {
      setUploadBusy(false);
    }
  };

  /* ---------- Filtered + paginated lists ---------- */
  const filterLower = filterText.toLowerCase();
  const filteredNews = news.filter(
    (item) =>
      item.title.toLowerCase().includes(filterLower) ||
      item.department.toLowerCase().includes(filterLower) ||
      item.category.toLowerCase().includes(filterLower)
  );
  const newsPageCount = Math.max(1, Math.ceil(filteredNews.length / PAGE_SIZE));
  const newsPage = pageOf('news', newsPageCount);
  const pagedNews = filteredNews.slice((newsPage - 1) * PAGE_SIZE, newsPage * PAGE_SIZE);

  const contactPageCount = Math.max(1, Math.ceil(contacts.length / PAGE_SIZE));
  const contactPage = pageOf('contacts', contactPageCount);
  const pagedContacts = contacts.slice((contactPage - 1) * PAGE_SIZE, contactPage * PAGE_SIZE);

  const docPageCount = Math.max(1, Math.ceil(documents.length / PAGE_SIZE));
  const docPage = pageOf('documents', docPageCount);
  const pagedDocuments = documents.slice((docPage - 1) * PAGE_SIZE, docPage * PAGE_SIZE);

  const bannerPageCount = Math.max(1, Math.ceil(banners.length / PAGE_SIZE));
  const bannerPage = pageOf('banners', bannerPageCount);
  const pagedBanners = banners.slice((bannerPage - 1) * PAGE_SIZE, bannerPage * PAGE_SIZE);

  const syncLogPageCount = Math.max(1, Math.ceil(syncLogs.length / PAGE_SIZE));
  const syncLogPage = pageOf('synclogs', syncLogPageCount);
  const pagedSyncLogs = syncLogs.slice((syncLogPage - 1) * PAGE_SIZE, syncLogPage * PAGE_SIZE);

  const auditPageCount = Math.max(1, Math.ceil(auditLogs.length / PAGE_SIZE));
  const auditPage = pageOf('audit', auditPageCount);
  const pagedAuditLogs = auditLogs.slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE);

  const totalArticleReads = news.reduce((sum, n) => sum + (n.views || 0), 0);


  // Handle Edit News Trigger (snapshot enables the unsaved-changes guard)
  const handleStartEditNews = (item: NewsItem) => {
    setIsEditingNews(true);
    setEditingNewsId(item.id);
    setNewsTitle(item.title);
    setNewsTitleEn(item.titleEn || '');
    setNewsCategory(item.category);
    setNewsSummary(item.summary);
    setNewsContent(item.content);
    setNewsDepartment(item.department);
    setNewsBadge(item.badge || 'NEWS');
    setNewsBadgeColor(item.badgeColor || 'amber');
    setNewsImageUrl(item.imageUrl || '');
    setNewsIsImportantAlert(!!item.isImportantAlert);
    setNewsSyncToExternal(!!item.syncToExternal);
    setNewsExternalCategory(item.externalCategory || 'press-release');
    setNewsSnapshot(
      JSON.stringify({
        t: item.title, e: item.titleEn || '', c: item.category, s: item.summary, x: item.content,
        d: item.department, b: item.badge || 'NEWS', bc: item.badgeColor || 'amber', i: item.imageUrl || '',
        a: !!item.isImportantAlert, sy: !!item.syncToExternal, ec: item.externalCategory || 'press-release',
      })
    );
    setNewsFormError(null);
  };

  const openNewsCreateForm = () => {
    setIsEditingNews(true);
    setEditingNewsId(null);
    setNewsTitle('');
    setNewsTitleEn('');
    setNewsCategory('kbj-news');
    setNewsSummary('');
    setNewsContent('');
    setNewsDepartment('Marketing & PR');
    setNewsBadge('ANNOUNCEMENT');
    setNewsBadgeColor('amber');
    setNewsImageUrl('');
    setNewsIsImportantAlert(false);
    setNewsSyncToExternal(false);
    setNewsExternalCategory('press-release');
    setNewsSnapshot(
      JSON.stringify({
        t: '', e: '', c: 'kbj-news', s: '', x: '', d: 'Marketing & PR', b: 'ANNOUNCEMENT',
        bc: 'amber', i: '', a: false, sy: false, ec: 'press-release',
      })
    );
    setNewsFormError(null);
  };

  const handleResetNewsForm = () => {
    setIsEditingNews(false);
    setEditingNewsId(null);
    setNewsTitle('');
    setNewsTitleEn('');
    setNewsCategory('kbj-news');
    setNewsSummary('');
    setNewsContent('');
    setNewsDepartment('Marketing & PR');
    setNewsBadge('ANNOUNCEMENT');
    setNewsBadgeColor('amber');
    setNewsImageUrl('');
    setNewsIsImportantAlert(false);
    setNewsSyncToExternal(false);
    setNewsExternalCategory('press-release');
    setNewsSnapshot('');
    setNewsFormError(null);
  };

  const openBannerForm = () => {
    setIsAddingBanner(true);
    setBannerTitle('');
    setBannerSubtitle('');
    setBannerBadge('INTERNAL NEWS');
    setBannerUrl('');
    setBannerActionText('อ่านเพิ่มเติม');
    setBannerActionUrl('#');
    setBannerSnapshot(JSON.stringify({ t: '', s: '', b: 'INTERNAL NEWS', u: '', at: 'อ่านเพิ่มเติม', au: '#' }));
    setBannerFormError(null);
  };

  const closeBannerForm = () => {
    setIsAddingBanner(false);
    setBannerSnapshot('');
    setBannerFormError(null);
  };

  const openContactForm = () => {
    setIsAddingContact(true);
    setContactName('');
    setContactNameEn('');
    setContactPos('');
    setContactDept('General Affairs');
    setContactExt('');
    setContactEmail('');
    setContactFloor('14th Floor');
    setContactSnapshot(JSON.stringify({ n: '', e: '', p: '', d: 'General Affairs', x: '', m: '', f: '14th Floor' }));
    setContactFormError(null);
  };

  const closeContactForm = () => {
    setIsAddingContact(false);
    setContactSnapshot('');
    setContactFormError(null);
  };

  const openDocForm = () => {
    setIsAddingDoc(true);
    setDocTitle('');
    setDocTitleEn('');
    setDocCategory('form');
    setDocDept('Human Resources');
    setDocVersion('v1.0');
    setDocSnapshot(JSON.stringify({ t: '', e: '', c: 'form', d: 'Human Resources', v: 'v1.0' }));
    setDocFormError(null);
  };

  const closeDocForm = () => {
    setIsAddingDoc(false);
    setDocSnapshot('');
    setDocFormError(null);
  };

  /* ---------- User administration (admin-only tab; talks to /api/users directly) ---------- */
  // GET/POST /api/users also returns createdAt/isActive on the wire; AuthUser
  // (api.ts) doesn't declare them yet, so extend locally instead of touching a
  // front-owned type.
  interface ManagedUser extends AuthUser {
    createdAt?: string;
    isActive?: boolean;
  }
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userSuccessMsg, setUserSuccessMsg] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userActionId, setUserActionId] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('staff');
  const [userPassword, setUserPassword] = useState('');
  const [userSnapshot, setUserSnapshot] = useState('');

  const userDirty =
    isAddingUser &&
    JSON.stringify({
      u: userUsername, d: userDisplayName, e: userEmail, r: newUserRole, p: userPassword,
    }) !== userSnapshot;

  const userPageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const userPage = pageOf('users', userPageCount);
  const pagedUsers = users.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);

  const refreshUsers = async (): Promise<ManagedUser[]> => {
    if (usersLoading) return users;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const list: ManagedUser[] = await api.getUsers();
      setUsers(list);
      return list;
    } catch {
      setUsersError('โหลดรายชื่อผู้ใช้ไม่สำเร็จ / Failed to load user accounts — please retry.');
      return users;
    } finally {
      setUsersLoading(false);
    }
  };

  const openUserForm = () => {
    setIsAddingUser(true);
    setUserUsername('');
    setUserDisplayName('');
    setUserEmail('');
    setNewUserRole('staff');
    setUserPassword('');
    setUserSnapshot(JSON.stringify({ u: '', d: '', e: '', r: 'staff', p: '' }));
    setUserFormError(null);
    setUserSuccessMsg(null);
  };

  const closeUserForm = () => {
    setIsAddingUser(false);
    setUserSnapshot('');
    setUserFormError(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingUser) return;
    setUserFormError(null);

    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(userUsername.trim())) {
      setUserFormError(
        'ชื่อผู้ใช้ต้องเป็นตัวอักษร ตัวเลข . _ - ความยาว 3-30 ตัวอักษร / Username must be 3-30 characters (letters, digits, . _ -)'
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())) {
      setUserFormError('รูปแบบอีเมลไม่ถูกต้อง / Invalid email format');
      return;
    }
    if (userPassword.length < 8) {
      setUserFormError('รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร / Password must be at least 8 characters');
      return;
    }

    setSavingUser(true);
    try {
      const created = await api.createUser({
        username: userUsername.trim(),
        password: userPassword,
        displayName: userDisplayName.trim(),
        email: userEmail.trim(),
        role: newUserRole,
      });
      setUserSuccessMsg(
        `สร้างบัญชีสำเร็จ: ${created.displayName} (${created.username}) / Account created successfully`
      );
      closeUserForm();
      const list = await refreshUsers();
      // Jump to the page showing the freshly created account (the store appends
      // new users, so that is the last page).
      setPageByTab((prev) => ({ ...prev, users: Math.max(1, Math.ceil(list.length / PAGE_SIZE)) }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setUserFormError(
        msg
          ? `สร้างบัญชีไม่สำเร็จ: ${msg} / Failed to create user — please try again.`
          : 'สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง / Failed to create user — please try again.'
      );
    } finally {
      setSavingUser(false);
    }
  };

  // Apply an activate/deactivate patch; success banner + list refresh, inline error on failure
  const handleToggleUserActive = async (u: ManagedUser, next: boolean) => {
    if (userActionId) return;
    setUserActionId(u.id);
    setUserActionError(null);
    try {
      await api.patchUser(u.id, { isActive: next });
      setUserSuccessMsg(
        next
          ? `เปิดใช้งานบัญชี "${u.displayName}" (${u.username}) แล้ว / Account reactivated`
          : `ปิดใช้งานบัญชี "${u.displayName}" (${u.username}) แล้ว — ผู้ใช้นี้เข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งานอีกครั้ง / Account deactivated — the user cannot sign in until reactivated`
      );
      await refreshUsers();
    } catch {
      setUserActionError(
        'เปลี่ยนสถานะบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง / Failed to update account status — please try again.'
      );
    } finally {
      setUserActionId(null);
    }
  };

  // Deactivate is destructive (blocks sign-in) — confirm first via the shared dialog
  const requestDeactivateUser = (u: ManagedUser) => {
    setConfirmCfg({
      tone: 'danger',
      title: 'ปิดใช้งานบัญชีผู้ใช้ / Deactivate account',
      message: `คุณแน่ใจหรือไม่ว่าต้องการปิดใช้งานบัญชี "${u.displayName}" (${u.username}) ?\nผู้ใช้รายนี้จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะมีการเปิดใช้งานอีกครั้ง (ไม่มีการลบข้อมูล / nothing is deleted)`,
      confirmLabel: 'ปิดใช้งาน / Deactivate',
      onConfirm: () => handleToggleUserActive(u, false),
    });
  };

  // Load user accounts + the signed-in admin's own id when the User Management tab opens
  useEffect(() => {
    if (activeSubTab === 'users' && canAdmin) {
      void refreshUsers();
      void (async () => {
        try {
          setCurrentUserId((await api.getCurrentUser())?.id ?? null);
        } catch {
          setCurrentUserId(null);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, canAdmin]);

  const resetAllForms = () => {
    handleResetNewsForm();
    closeBannerForm();
    closeContactForm();
    closeDocForm();
    closeUserForm();
  };

  // Tab switch with unsaved-changes guard (quick actions pass an afterSwitch hook)
  const handleTabChange = (tab: typeof activeSubTab, afterSwitch?: () => void) => {
    if (tab === activeSubTab) {
      afterSwitch?.();
      return;
    }
    // Errored forms escape without a confirm — never stack the discard dialog
    // over a form that just failed to save.
    const dirty =
      (newsDirty && !newsFormError) ||
      (bannerDirty && !bannerFormError) ||
      (contactDirty && !contactFormError) ||
      (docDirty && !docFormError) ||
      (userDirty && !userFormError);
    const switchTab = () => {
      setActionError(null);
      setRejectingId(null);
      setRejectReason('');
      setActiveSubTab(tab);
      afterSwitch?.();
    };
    if (dirty) {
      setConfirmCfg({
        tone: 'warning',
        title: 'ยังไม่ได้บันทึกการเปลี่ยนแปลง',
        message:
          'Unsaved changes — switching tabs will discard them.\nคุณต้องการยกเลิกการเปลี่ยนแปลงทั้งหมดและเปลี่ยนแท็บหรือไม่?',
        confirmLabel: 'ยกเลิกการเปลี่ยนแปลง / Discard',
        onConfirm: () => {
          resetAllForms();
          switchTab();
        },
      });
      return;
    }
    switchTab();
  };

  // Cancel the open news form — confirm first when there are unsaved edits.
  // Exception: after a FAILED save (inline error showing) closing is one click —
  // stacking the discard-confirm over the errored form produced two simultaneous
  // Cancel buttons.
  const requestCancelNewsForm = () => {
    if (newsDirty && !newsFormError) {
      setConfirmCfg({
        tone: 'warning',
        title: 'ยกเลิกการแก้ไข?',
        message: 'การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไปทั้งหมด / Unsaved changes will be discarded.',
        confirmLabel: 'ยกเลิกการแก้ไข / Discard',
        onConfirm: handleResetNewsForm,
      });
    } else {
      handleResetNewsForm();
    }
  };

  /* ---------- Async save handlers (api throws → inline errors; App adds toasts) ---------- */
  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingNews) return;
    setNewsFormError(null);

    if (newsImageUrl.trim() && !/^(https?:\/\/|\/)/i.test(newsImageUrl.trim())) {
      setNewsFormError(
        'รูปแบบลิงก์รูปภาพไม่ถูกต้อง ต้องขึ้นต้นด้วย https:// หรือ / / Invalid image URL — must start with https:// or /'
      );
      return;
    }

    // editingNewsId (null = create) decides create vs update — never
    // isEditingNews: the create form also sets it true.
    const existing = editingNewsId ? news.find((n) => n.id === editingNewsId) : undefined;
    const payload: NewsItem = {
      id: editingNewsId ?? `news-${Date.now()}`,
      title: newsTitle.trim(),
      titleEn: newsTitleEn.trim(),
      summary: newsSummary.trim(),
      content: newsContent.trim(),
      category: newsCategory,
      categoryLabel: CATEGORY_LABELS[newsCategory] ?? newsCategory,
      badge: newsBadge.trim(),
      badgeColor: newsBadgeColor,
      imageUrl: newsImageUrl.trim(),
      publishedAt: existing?.publishedAt ?? new Date().toISOString().split('T')[0],
      author: existing?.author ?? 'Corporate CMS Admin (Self-Service)',
      department: newsDepartment,
      isImportantAlert: newsIsImportantAlert,
      views: existing?.views ?? 1,
      syncToExternal: newsSyncToExternal,
      externalSyncStatus: newsSyncToExternal ? 'synced' : 'draft',
      externalCategory: newsExternalCategory,
    };

    setSavingNews(true);
    try {
      if (editingNewsId) {
        await onUpdateNews(payload);
      } else {
        await onAddNews(payload);
        // Jump back to page 1 so the freshly created article is visible at the top
        setPageByTab((prev) => ({ ...prev, news: 1 }));
      }
      handleResetNewsForm();
    } catch {
      setNewsFormError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง / Failed to save — please try again.');
    } finally {
      setSavingNews(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingContact) return;
    setContactFormError(null);

    if (!/^\d{3,6}$/.test(contactExt.trim())) {
      setContactFormError('เบอร์ต่อภายในต้องเป็นตัวเลข 3-6 หลัก / Extension must be 3-6 digits');
      return;
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setContactFormError('รูปแบบอีเมลไม่ถูกต้อง / Invalid email format');
      return;
    }

    setSavingContact(true);
    try {
      await onAddContact({
        id: `dir-${Date.now()}`,
        name: contactName.trim(),
        nameEn: contactNameEn.trim(),
        position: contactPos.trim(),
        department: contactDept,
        extension: contactExt.trim(),
        email: contactEmail.trim() || `${contactExt.trim()}@kbjcapital.co.th`,
        floor: contactFloor,
      });
      closeContactForm();
    } catch {
      setContactFormError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง / Failed to save — please try again.');
    } finally {
      setSavingContact(false);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingBanner) return;
    setBannerFormError(null);

    if (!/^(https?:\/\/|\/)/i.test(bannerUrl.trim())) {
      setBannerFormError(
        'รูปแบบลิงก์รูปภาพไม่ถูกต้อง ต้องขึ้นต้นด้วย https:// หรือ / / Invalid image URL — must start with https:// or /'
      );
      return;
    }

    setSavingBanner(true);
    try {
      await onAddBanner({
        id: `banner-${Date.now()}`,
        title: bannerTitle.trim(),
        subtitle: bannerSubtitle.trim(),
        badge: bannerBadge.trim(),
        imageUrl: bannerUrl.trim(),
        actionUrl: bannerActionUrl.trim() || '#',
        actionText: bannerActionText.trim(),
        order: banners.length + 1,
        isActive: true,
      });
      closeBannerForm();
    } catch {
      setBannerFormError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง / Failed to save — please try again.');
    } finally {
      setSavingBanner(false);
    }
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingDoc) return;
    setDocFormError(null);

    setSavingDoc(true);
    try {
      await onAddDocument({
        id: `doc-${Date.now()}`,
        title: docTitle.trim(),
        titleEn: docTitleEn.trim(),
        category: docCategory,
        department: docDept.trim(),
        version: docVersion.trim(),
        updatedAt: new Date().toISOString().split('T')[0],
        fileSize: '1.2 MB',
        downloadUrl: '#download-new-doc',
        isNew: true,
      });
      closeDocForm();
    } catch {
      setDocFormError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง / Failed to save — please try again.');
    } finally {
      setSavingDoc(false);
    }
  };

  /* ---------- Row-level async actions (wrapped; failures surface inline) ---------- */
  const handleTriggerSync = async () => {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncError(null);
    try {
      await onTriggerFullSync();
    } catch {
      setSyncError('การซิงก์ล้มเหลว กรุณาลองใหม่อีกครั้ง / Full sync failed — please try again.');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSystemExport = async (filePrefix: string) => {
    if (exportBusy) return;
    setExportBusy(true);
    setExportError(null);
    try {
      const data = await api.exportSystemData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('ส่งออกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง / Export failed — please try again.');
    } finally {
      setExportBusy(false);
    }
  };

  const handleApproveRow = async (id: string) => {
    try {
      await onApproveNews?.(id);
    } catch {
      setActionError('อนุมัติไม่สำเร็จ / Approval failed — please try again.');
    }
  };

  const handleRejectRow = async () => {
    if (!rejectingId || rejectBusy) return;
    setRejectBusy(true);
    try {
      await onRejectNews?.(rejectingId, rejectReason.trim());
      setRejectingId(null);
      setRejectReason('');
    } catch {
      setActionError('ปฏิเสธไม่สำเร็จ / Rejection failed — please try again.');
    } finally {
      setRejectBusy(false);
    }
  };

  const handleSubmitApprovalRow = async (id: string) => {
    try {
      await onSubmitForApproval?.(id);
    } catch {
      setActionError('ส่งคำขออนุมัติไม่สำเร็จ / Failed to submit for approval.');
    }
  };

  const handleToggleSyncRow = async (id: string) => {
    try {
      await onToggleExternalSync(id);
    } catch {
      setActionError('เปลี่ยนสถานะการซิงก์ไม่สำเร็จ / Failed to toggle sync status.');
    }
  };

  /* ---------- Locked gates: anonymous visitors and staff see a lock, not broken forms ---------- */
  if (needsSignIn || accessDenied) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center py-10">
        <div className="max-w-md w-full mx-4 bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 text-[#F97316] flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {needsSignIn ? 'กรุณาเข้าสู่ระบบเพื่อใช้งาน CMS' : 'ไม่มีสิทธิ์เข้าถึงระบบจัดการเนื้อหา'}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed mt-2">
            {needsSignIn
              ? 'Sign in to manage intranet news, banners, directory and policies. เนื้อหาในระบบนี้จัดการได้เฉพาะผู้ที่ได้รับอนุญาตเท่านั้น'
              : 'Access denied — your account does not include content-management rights. หากต้องการสิทธิ์การใช้งาน กรุณาติดต่อผู้ดูแลระบบ (กด 1258)'}
          </p>
          {needsSignIn && onRequireAuth && (
            <button
              onClick={onRequireAuth}
              className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-sm shadow-md hover:shadow-orange-500/25 transition cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>เข้าสู่ระบบ / Sign in</span>
            </button>
          )}
          <p className="text-[11px] text-slate-400 mt-6">
            KB J Capital Self-Service CMS — Authorized personnel only
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Dashboard Header Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">System Dashboard</h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">KB J Capital Corporate Administration</p>
          </div>
          <div className="hidden sm:block h-6 w-[1px] bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Live Sync Enabled</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Quick search..."
              aria-label="ค้นหาใน CMS / Search CMS content"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="bg-slate-100 border-none rounded-full pl-8 pr-4 py-1.5 text-xs w-36 sm:w-52 focus:ring-2 focus:ring-[#F97316] outline-none"
            />
          </div>
          <button
            onClick={() => handleTabChange('news', openNewsCreateForm)}
            className="bg-[#F97316] text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm hover:bg-[#EA580C] transition active:scale-95 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Post</span>
          </button>
        </div>
      </div>

      {/* CMS Header & Value Proposition Banner - Warm Corporate Tone */}
      <div className="bg-gradient-to-r from-[#FFF8F0] via-[#FFFDF9] to-[#FFF3E8] rounded-2xl p-6 sm:p-8 text-stone-800 shadow-sm relative overflow-hidden border border-orange-200/90">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-400/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#F97316] text-white font-extrabold text-[11px] tracking-wide uppercase shadow-2xs">
                Zero-IT-Intervention
              </span>
              <span className="text-xs text-[#EA580C] font-semibold">
                Self-Service Content Studio & Orchestrator
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
              Content Management System (CMS) & Sync Engine
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              ผู้ดูแลระบบและฝ่ายสื่อสารองค์กร (HR, Comms, Compliance) สามารถแก้ไข อัปเดต และเผยแพร่เนื้อหาได้ด้วยตนเองทันที
              โดยไม่ต้องเปิด Change Request (CR) หรือรอทีม IT พร้อมระบบซิงก์ข้อมูลอัตโนมัติไปยังเว็บไซต์สาธารณะ www.kbjcapital.co.th
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {canAdmin ? (
              <div className="flex flex-col items-start gap-1.5">
                <button
                  onClick={handleTriggerSync}
                  disabled={syncBusy}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md hover:shadow-orange-500/20 transition active:scale-95 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${syncBusy ? 'animate-spin' : ''}`} />
                  <span>{syncBusy ? 'กำลังซิงก์... / Syncing...' : 'Sync All to Public Web'}</span>
                </button>
                {syncError && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                    <AlertCircle className="w-3 h-3" />
                    {syncError}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">
                การซิงก์ทั้งหมดจัดการได้เฉพาะผู้ดูแลระบบ / Full sync is admin-only
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CMS Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs text-xs font-bold no-scrollbar">
        <button
          onClick={() => handleTabChange('news')}
          aria-label="News & Alerts tab"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition cursor-pointer ${
            activeSubTab === 'news'
              ? 'bg-[#F97316] text-white shadow-xs'
              : 'text-stone-600 hover:text-[#EA580C] hover:bg-orange-50/50'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${activeSubTab === 'news' ? 'bg-white' : 'bg-transparent'}`} />
          <FileText className={`w-4 h-4 ${activeSubTab === 'news' ? 'text-white' : 'text-orange-400'}`} />
          <span>News & Alerts ({news.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('banners')}
          aria-label="Hero Carousel tab"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition cursor-pointer ${
            activeSubTab === 'banners'
              ? 'bg-[#F97316] text-white shadow-xs'
              : 'text-stone-600 hover:text-[#EA580C] hover:bg-orange-50/50'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${activeSubTab === 'banners' ? 'bg-white' : 'bg-transparent'}`} />
          <Layers className={`w-4 h-4 ${activeSubTab === 'banners' ? 'text-white' : 'text-orange-400'}`} />
          <span>Hero Carousel ({banners.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('directory')}
          aria-label="Phone Directory tab"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition cursor-pointer ${
            activeSubTab === 'directory'
              ? 'bg-[#F97316] text-white shadow-xs'
              : 'text-stone-600 hover:text-[#EA580C] hover:bg-orange-50/50'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${activeSubTab === 'directory' ? 'bg-white' : 'bg-transparent'}`} />
          <PhoneCall className={`w-4 h-4 ${activeSubTab === 'directory' ? 'text-white' : 'text-orange-400'}`} />
          <span>Phone Directory ({contacts.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('documents')}
          aria-label="Policies & Forms tab"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition cursor-pointer ${
            activeSubTab === 'documents'
              ? 'bg-[#F97316] text-white shadow-xs'
              : 'text-stone-600 hover:text-[#EA580C] hover:bg-orange-50/50'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${activeSubTab === 'documents' ? 'bg-white' : 'bg-transparent'}`} />
          <FileText className={`w-4 h-4 ${activeSubTab === 'documents' ? 'text-white' : 'text-orange-400'}`} />
          <span>Policies & Forms ({documents.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('rooms')}
          aria-label="Meeting Rooms tab"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition cursor-pointer ${
            activeSubTab === 'rooms'
              ? 'bg-[#F97316] text-white shadow-xs'
              : 'text-stone-600 hover:text-[#EA580C] hover:bg-orange-50/50'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${activeSubTab === 'rooms' ? 'bg-white' : 'bg-transparent'}`} />
          <Building className={`w-4 h-4 ${activeSubTab === 'rooms' ? 'text-white' : 'text-orange-400'}`} />
          <span>Meeting Rooms ({rooms.length})</span>
        </button>

        {canAdmin && (
          <button
            onClick={() => handleTabChange('users')}
            aria-label="User Management tab (admin only)"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'users'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-stone-600 hover:text-rose-700 hover:bg-rose-50/50'
            }`}
          >
            <Users className={`w-4 h-4 ${activeSubTab === 'users' ? 'text-white' : 'text-rose-400'}`} />
            <span>User Management ({users.length})</span>
          </button>
        )}

        {canAdmin && (
          <button
            onClick={() => handleTabChange('sync-logs')}
            aria-label="Public Sync Logs tab (admin only)"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'sync-logs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-stone-600 hover:text-blue-700 hover:bg-blue-50/50'
            }`}
          >
            <Globe className="w-4 h-4 text-blue-400" />
            <span>Public Sync Logs ({syncLogs.length})</span>
          </button>
        )}

        {canCheck && (
          <button
            onClick={() => handleTabChange('audit-trail')}
            aria-label="BOT / PDPA Audit Trail tab (checker and admin)"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'audit-trail'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'text-stone-600 hover:text-purple-700 hover:bg-purple-50/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>BOT / PDPA Audit Trail ({auditLogs.length})</span>
          </button>
        )}
      </div>

      {/* Main Grid: 8 Columns Main Content + 4 Columns Quick Actions & Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
          {/* ========================================================
              TAB 1: NEWS & ANNOUNCEMENTS STUDIO
             ======================================================== */}
          {activeSubTab === 'news' && (
        <div className="space-y-6">
          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter news by title, department, or category..."
                aria-label="กรองข่าว / Filter news"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <button
              onClick={openNewsCreateForm}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Publish New Announcement</span>
            </button>
          </div>

          {/* EDIT / CREATE MODAL / DRAWER FORM */}
          {isEditingNews && (
            <div className="bg-white rounded-2xl border-2 border-amber-400 p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-6 bg-amber-500 rounded-sm" />
                  <h3 className="text-base font-bold text-slate-900">
                    {editingNewsId ? 'Edit Article & Sync Settings' : 'Create & Publish New Announcement'}
                  </h3>
                  {newsDirty && (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                      ยังไม่บันทึก / Unsaved
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={requestCancelNewsForm}
                  aria-label="ปิดฟอร์ม / Close form"
                  className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ${iconBtnFocus}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {newsFormError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{newsFormError}</span>
                </div>
              )}

              <form onSubmit={handleSaveNews} className="mt-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title Thai */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Title (หัวข้อประกาศ - ภาษาไทย) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newsTitle}
                      onChange={(e) => setNewsTitle(e.target.value)}
                      placeholder="e.g. ประกาศมาตรการช่วยเหลือลูกหนี้ หรือ แผนผังห้องประชุมใหม่"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                    />
                  </div>

                  {/* Title English */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Title (English Heading)
                    </label>
                    <input
                      type="text"
                      value={newsTitleEn}
                      onChange={(e) => setNewsTitleEn(e.target.value)}
                      placeholder="e.g. BOT Regulatory Guideline Update"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Category (หมวดหมู่)
                    </label>
                    <select
                      value={newsCategory}
                      onChange={(e) => setNewsCategory(e.target.value as NewsCategory)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs bg-white"
                    >
                      <option value="kbj-news">KB J News (ข่าวสารองค์กร)</option>
                      <option value="bot-news">BOT News (ประกาศ ธปท.)</option>
                      <option value="ncb-news">NCB News (ข้อมูลเครดิตบูโร)</option>
                      <option value="regulation">New Regulations (PDPA/กฎหมาย)</option>
                      <option value="hr-announcement">HR Announcement (งานบุคคล)</option>
                    </select>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Author Department (ฝ่ายที่ประกาศ)
                    </label>
                    <select
                      value={newsDepartment}
                      onChange={(e) => setNewsDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs bg-white"
                    >
                      <option value="Marketing & PR">Marketing & PR</option>
                      <option value="Human Resources">Human Resources</option>
                      <option value="Compliance">Compliance & Legal</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="General Affairs">General Affairs / Facilities</option>
                      <option value="Risk Management">Risk Management</option>
                    </select>
                  </div>

                  {/* Badge Text */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Badge Tag (ป้ายกำกับ)
                    </label>
                    <input
                      type="text"
                      value={newsBadge}
                      onChange={(e) => setNewsBadge(e.target.value)}
                      placeholder="e.g. NEW ALERT, UPDATE, HIGHLIGHT"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Summary (บทสรุปย่อสำหรับหน้าแรก) *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={newsSummary}
                    onChange={(e) => setNewsSummary(e.target.value)}
                    placeholder="Brief description appearing on cards and search results..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                  />
                </div>

                {/* Full Content */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Full Content & Announcement Details (เนื้อหาฉบับเต็ม) *
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={newsContent}
                    onChange={(e) => setNewsContent(e.target.value)}
                    placeholder="Full announcement text, bullet points, meeting instructions..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs font-mono"
                  />
                </div>

                {/* Thumbnail Image URL (upload via /api/upload or paste manually) */}
                <div>
                  <label htmlFor="news-image-url" className="block font-bold text-slate-700 mb-1">
                    Banner / Thumbnail Image URL
                  </label>
                  <div className="flex items-stretch gap-2">
                    <input
                      id="news-image-url"
                      type="text"
                      value={newsImageUrl}
                      onChange={(e) => setNewsImageUrl(e.target.value)}
                      placeholder="https://... หรือกดอัปโหลดไฟล์รูปภาพ / or upload an image file"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => newsImageInputRef.current?.click()}
                      disabled={uploadBusy}
                      aria-label="อัปโหลดรูปภาพประกอบข่าว / Upload image file"
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 text-[#EA580C] font-bold text-xs transition cursor-pointer disabled:opacity-60"
                    >
                      {uploadBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ImagePlus className="w-3.5 h-3.5" />
                      )}
                      <span>อัปโหลด / Upload</span>
                    </button>
                    <input
                      ref={newsImageInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.gif"
                      className="hidden"
                      aria-hidden="true"
                      tabIndex={-1}
                      onChange={(e) => {
                        void handleUploadImage(e.target.files?.[0], 'news-image');
                        e.target.value = '';
                      }}
                    />
                  </div>
                  {uploadError && (
                    <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {uploadError}
                    </p>
                  )}
                  {newsImageUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={newsImageUrl}
                        alt="ตัวอย่างรูปภาพประกอบ / Image preview"
                        className="w-24 h-14 object-cover rounded-lg border border-slate-200 bg-slate-50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                        onLoad={(e) => {
                          (e.target as HTMLImageElement).style.display = '';
                        }}
                      />
                      <span className="text-[10px] text-slate-400 font-mono break-all line-clamp-1">
                        {newsImageUrl}
                      </span>
                    </div>
                  )}
                </div>

                {/* HIGHLIGHTED FEATURE: External Web Sync Controls */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 via-slate-50 to-amber-50 border-2 border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-600" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          External Public Web Sync (www.kbjcapital.co.th)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          เปิดให้เนื้อหานี้ซิงก์ขึ้นสู่เว็บไซต์ภายนอกสำหรับลูกค้ารายย่อยและสาธารณชนโดยอัตโนมัติ
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newsSyncToExternal}
                        onChange={(e) => setNewsSyncToExternal(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {newsSyncToExternal && (
                    <div className="pt-2 border-t border-blue-100 flex items-center gap-4">
                      <span className="text-xs font-semibold text-slate-700">
                        External Category:
                      </span>
                      <select
                        value={newsExternalCategory}
                        onChange={(e) => setNewsExternalCategory(e.target.value as any)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <option value="press-release">Press Release & News</option>
                        <option value="compliance">Consumer & Compliance Directive</option>
                        <option value="csr">CSR & Sustainability</option>
                        <option value="product-notice">Kashjoy Loan & Product Alert</option>
                      </select>

                      <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Auto-sync enabled
                      </span>
                    </div>
                  )}
                </div>

                {/* Important Alert Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-important"
                    checked={newsIsImportantAlert}
                    onChange={(e) => setNewsIsImportantAlert(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-400"
                  />
                  <label htmlFor="chk-important" className="text-xs font-bold text-slate-800">
                    Mark as Urgent Top Alert (แสดงเป็นแถบแจ้งเตือนเด่นบนหน้าแรก)
                  </label>
                </div>

                {/* Form Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={requestCancelNewsForm}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingNews}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-extrabold shadow-md transition cursor-pointer"
                  >
                    {savingNews ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>
                      {savingNews
                        ? 'กำลังบันทึก... / Saving...'
                        : editingNewsId
                          ? 'Save Changes'
                          : 'Publish Immediately'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Inline error for row-level action failures (App also toasts) */}
          {actionError && (
            <div
              role="alert"
              className="flex items-start justify-between gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {actionError}
              </span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                aria-label="ปิดข้อความแจ้งเตือน / Dismiss error"
                className="p-0.5 rounded text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Table of Articles */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Article Title & Department</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Published Date</th>
                    <th className="px-3 py-3 text-center">Governance & Public Sync (BOT Dual Control)</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedNews.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon={<FileText className="w-6 h-6" />}
                          th={filterText ? 'ไม่พบข่าวที่ตรงกับคำค้นหา' : 'ยังไม่มีประกาศในระบบ'}
                          en={
                            filterText
                              ? 'No announcements match your filter — try another keyword.'
                              : 'No announcements yet — publish the first one with the button above.'
                          }
                        />
                      </td>
                    </tr>
                  )}
                  {pagedNews.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 max-w-md">
                          <div className="flex items-start gap-2.5">
                            {item.isImportantAlert && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-600 text-white">
                                ALERT
                              </span>
                            )}
                            <div>
                              <p className="font-bold text-slate-900 line-clamp-1">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Dept: {item.department} • {item.views} views
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.category === 'kbj-news'
                                ? 'bg-rose-50 text-rose-700'
                                : item.category === 'bot-news'
                                ? 'bg-blue-50 text-blue-700'
                                : item.category === 'ncb-news'
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {item.categoryLabel}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                          {item.publishedAt}
                        </td>

                        {/* Maker-Checker & Public Sync Column */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            <SyncStatusChip
                              status={item.externalSyncStatus ?? (item.syncToExternal ? 'synced' : 'draft')}
                            />

                            {rejectingId === item.id ? (
                              <div className="w-56 flex flex-col gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-left">
                                <input
                                  autoFocus
                                  type="text"
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="เหตุผลที่ปฏิเสธ (จำเป็น) / Reason (required)"
                                  aria-label="เหตุผลการปฏิเสธ / Rejection reason"
                                  className="w-full px-2 py-1 rounded border border-rose-200 text-[11px] focus:outline-none focus:ring-2 focus:ring-rose-200"
                                />
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={handleRejectRow}
                                    disabled={!rejectReason.trim() || rejectBusy}
                                    className="flex-1 px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-[10px] cursor-pointer transition"
                                  >
                                    {rejectBusy ? 'กำลังบันทึก...' : 'ปฏิเสธ / Reject'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectingId(null);
                                      setRejectReason('');
                                    }}
                                    className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-600 font-bold text-[10px] cursor-pointer hover:bg-slate-100 transition"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              </div>
                            ) : item.externalSyncStatus === 'pending_approval' ? (
                              canCheck && onApproveNews ? (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <button
                                    onClick={() => handleApproveRow(item.id)}
                                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs cursor-pointer"
                                    title="Approve & Publish to External Website"
                                    aria-label={`อนุมัติ: ${item.title} / Approve`}
                                  >
                                    <Check className="w-3 h-3" /> Approve
                                  </button>
                                  {onRejectNews && (
                                    <button
                                      onClick={() => setRejectingId(item.id)}
                                      className="px-1.5 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[10px] cursor-pointer"
                                      title="Reject publication with reason"
                                      aria-label={`ปฏิเสธ: ${item.title} / Reject`}
                                    >
                                      Reject
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  รอ Checker ตรวจสอบ / Awaiting checker review
                                </span>
                              )
                            ) : item.syncToExternal && item.externalSyncStatus === 'synced' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <button
                                onClick={() => handleToggleSyncRow(item.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition cursor-pointer"
                                title="Click to toggle sync with www.kbjcapital.co.th"
                              >
                                <Globe className="w-3 h-3" />
                                <span>Approved & Live</span>
                              </button>
                              {item.approvedBy && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  ✓ {item.approvedBy.split('@')[0]}
                                </span>
                              )}
                            </div>
                          ) : item.externalSyncStatus === 'rejected' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              {canWrite && onSubmitForApproval && (
                                <button
                                  onClick={() => handleSubmitApprovalRow(item.id)}
                                  className="text-[10px] text-blue-600 hover:underline font-bold mt-0.5 cursor-pointer"
                                >
                                  Re-submit Review
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => handleToggleSyncRow(item.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition cursor-pointer"
                                title="Click to publish internally or sync"
                              >
                                <span>Internal Only</span>
                              </button>
                              {canWrite && onSubmitForApproval && (
                                <button
                                  onClick={() => handleSubmitApprovalRow(item.id)}
                                  className="text-[10px] text-[#F97316] hover:text-[#EA580C] font-bold hover:underline cursor-pointer"
                                  title="Submit for Maker-Checker dual approval"
                                >
                                  + Request Approval
                                </button>
                              )}
                            </div>
                          )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {canWrite && (
                              <button
                                onClick={() => handleStartEditNews(item)}
                                className={`p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition ${iconBtnFocus}`}
                                title="Edit Announcement"
                                aria-label={`แก้ไขประกาศ: ${item.title} / Edit announcement`}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}

                            {canAdmin && (
                              <button
                                onClick={() =>
                                  setConfirmCfg({
                                    tone: 'danger',
                                    title: 'ลบประกาศ / Delete announcement',
                                    message: `คุณแน่ใจหรือไม่ว่าต้องการลบ "${item.title}" ?\nการลบไม่สามารถย้อนกลับได้ / This action cannot be undone.`,
                                    confirmLabel: 'ลบ / Delete',
                                    onConfirm: async () => {
                                      try {
                                        await onDeleteNews(item.id);
                                      } catch {
                                        setActionError('ลบรายการไม่สำเร็จ / Failed to delete — please try again.');
                                      }
                                    },
                                  })
                                }
                                className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition ${iconBtnFocus}`}
                                title="Delete Announcement"
                                aria-label={`ลบประกาศ: ${item.title} / Delete announcement`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {filteredNews.length > PAGE_SIZE && (
              <Pager
                page={newsPage}
                pageCount={newsPageCount}
                total={filteredNews.length}
                onPageChange={(p) => turnPage('news', p, newsPageCount)}
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: HERO CAROUSEL BANNERS STUDIO
         ======================================================== */}
      {activeSubTab === 'banners' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Hero Banners & Carousel Slides
              </h4>
              <p className="text-xs text-slate-500">
                จัดการแบนเนอร์ภาพหลักบนหน้าแรกของพอร์ทัล (ไม่ต้องส่งไฟล์ให้ทีมกราฟิกหรือ IT อัปเดต)
              </p>
            </div>

            <button
              onClick={openBannerForm}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Add Banner Slide</span>
            </button>
          </div>

          {isAddingBanner && (
            <div className="bg-white rounded-xl border-2 border-amber-400 p-5 shadow-lg space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Add New Hero Banner</h4>
                {bannerDirty && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                    ยังไม่บันทึก / Unsaved
                  </span>
                )}
              </div>
              {bannerFormError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{bannerFormError}</span>
                </div>
              )}
              <form onSubmit={handleSaveBanner} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Headline</label>
                    <input
                      type="text"
                      required
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      placeholder="e.g. Annual Health Checkup 2025"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Badge Tag</label>
                    <input
                      type="text"
                      required
                      value={bannerBadge}
                      onChange={(e) => setBannerBadge(e.target.value)}
                      placeholder="e.g. WELFARE, HR, DIRECTORY"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subtitle</label>
                  <input
                    type="text"
                    required
                    value={bannerSubtitle}
                    onChange={(e) => setBannerSubtitle(e.target.value)}
                    placeholder="Short description displayed on banner..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="banner-image-url" className="block font-bold text-slate-700 mb-1">
                      Image URL <span className="font-medium text-rose-500">*</span>
                    </label>
                    <div className="flex items-stretch gap-2">
                      <input
                        id="banner-image-url"
                        type="text"
                        required
                        value={bannerUrl}
                        onChange={(e) => setBannerUrl(e.target.value)}
                        placeholder="https://... หรือกดอัปโหลด / or upload"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => bannerImageInputRef.current?.click()}
                        disabled={uploadBusy}
                        aria-label="อัปโหลดรูปภาพแบนเนอร์ / Upload banner image"
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 text-[#EA580C] font-bold transition cursor-pointer disabled:opacity-60"
                      >
                        {uploadBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="w-3.5 h-3.5" />
                        )}
                        <span>อัปโหลด / Upload</span>
                      </button>
                      <input
                        ref={bannerImageInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.gif"
                        className="hidden"
                        aria-hidden="true"
                        tabIndex={-1}
                        onChange={(e) => {
                          void handleUploadImage(e.target.files?.[0], 'banner-image');
                          e.target.value = '';
                        }}
                      />
                    </div>
                    {uploadError && (
                      <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {uploadError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">CTA Action Button</label>
                    <input
                      type="text"
                      required
                      value={bannerActionText}
                      onChange={(e) => setBannerActionText(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeBannerForm}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBanner}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold cursor-pointer transition"
                  >
                    {savingBanner && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{savingBanner ? 'กำลังบันทึก...' : 'Save Banner'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {banners.length === 0 ? (
              <EmptyState
                icon={<Layers className="w-6 h-6" />}
                th="ยังไม่มีแบนเนอร์หน้าแรก"
                en="No hero banner slides yet — add the first one with the button above."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                  {pagedBanners.map((b) => (
                    <div
                      key={b.id}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col justify-between"
                    >
                      <div className="relative h-36 w-full bg-slate-100">
                        <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px]">
                          {b.badge}
                        </div>
                        {canAdmin && (
                          <button
                            onClick={() =>
                              setConfirmCfg({
                                tone: 'danger',
                                title: 'ลบแบนเนอร์ / Delete banner slide',
                                message: `คุณแน่ใจหรือไม่ว่าต้องการลบแบนเนอร์ "${b.title}" ?\nการลบไม่สามารถย้อนกลับได้ / This action cannot be undone.`,
                                confirmLabel: 'ลบ / Delete',
                                onConfirm: async () => {
                                  try {
                                    await onDeleteBanner(b.id);
                                  } catch {
                                    setActionError('ลบแบนเนอร์ไม่สำเร็จ / Failed to delete banner.');
                                  }
                                },
                              })
                            }
                            aria-label={`ลบแบนเนอร์: ${b.title} / Delete banner slide`}
                            className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-rose-600 transition ${iconBtnFocus}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="p-4">
                        <h5 className="text-sm font-bold text-slate-900">{b.title}</h5>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{b.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {banners.length > PAGE_SIZE && (
                  <Pager
                    page={bannerPage}
                    pageCount={bannerPageCount}
                    total={banners.length}
                    onPageChange={(p) => turnPage('banners', p, bannerPageCount)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: PHONEBOOK & DIRECTORY STUDIO
         ======================================================== */}
      {activeSubTab === 'directory' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Employee Telephone Directory Management
              </h4>
              <p className="text-xs text-slate-500">
                แก้ไขเบอร์ต่อภายใน แผนก และตำแหน่งพนักงานแบบเรียลไทม์ทันทีเมื่อมีการย้ายโต๊ะหรือรับพนักงานใหม่
              </p>
            </div>

            <button
              onClick={openContactForm}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Add Staff Contact</span>
            </button>
          </div>

          {isAddingContact && (
            <div className="bg-white rounded-xl border-2 border-amber-400 p-5 shadow-lg space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Add New Staff Contact</h4>
                {contactDirty && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                    ยังไม่บันทึก / Unsaved
                  </span>
                )}
              </div>
              {contactFormError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{contactFormError}</span>
                </div>
              )}
              <form onSubmit={handleSaveContact} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Name (Thai)</label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. คุณสมชาย ใจดี"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Name (English)</label>
                    <input
                      type="text"
                      required
                      value={contactNameEn}
                      onChange={(e) => setContactNameEn(e.target.value)}
                      placeholder="e.g. Somchai Jaidee"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Position</label>
                    <input
                      type="text"
                      required
                      value={contactPos}
                      onChange={(e) => setContactPos(e.target.value)}
                      placeholder="e.g. Senior Credit Officer"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Department</label>
                    <select
                      value={contactDept}
                      onChange={(e) => setContactDept(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="Management">Management</option>
                      <option value="Human Resources">Human Resources</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Credit & Risk">Credit & Risk</option>
                      <option value="Compliance">Compliance & Legal</option>
                      <option value="General Affairs">General Affairs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Extension Number (Ext.)</label>
                    <input
                      type="text"
                      required
                      value={contactExt}
                      onChange={(e) => setContactExt(e.target.value)}
                      placeholder="e.g. 1315"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeContactForm}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingContact}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold cursor-pointer transition"
                  >
                    {savingContact && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{savingContact ? 'กำลังบันทึก...' : 'Save Contact'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Employee Name</th>
                    <th className="px-3 py-3">Position</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Extension</th>
                    <th className="px-3 py-3">Floor</th>
                    <th className="px-4 py-3 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedContacts.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          icon={<PhoneCall className="w-6 h-6" />}
                          th="ยังไม่มีรายชื่อผู้ติดต่อ"
                          en="No staff contacts yet — add the first one with the button above."
                        />
                      </td>
                    </tr>
                  )}
                  {pagedContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      {c.name} <span className="font-normal text-slate-400">({c.nameEn})</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{c.position}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                        {c.department}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-amber-600">
                      Ext. {c.extension}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{c.floor}</td>
                    <td className="px-4 py-2.5 text-right">
                      {canAdmin ? (
                        <button
                          onClick={() =>
                            setConfirmCfg({
                              tone: 'danger',
                              title: 'ลบรายชื่อผู้ติดต่อ / Delete contact',
                              message: `คุณแน่ใจหรือไม่ว่าต้องการลบ "${c.name}" (Ext. ${c.extension}) ?\nการลบไม่สามารถย้อนกลับได้ / This action cannot be undone.`,
                              confirmLabel: 'ลบ / Delete',
                              onConfirm: async () => {
                                try {
                                  await onDeleteContact(c.id);
                                } catch {
                                  setActionError('ลบรายชื่อไม่สำเร็จ / Failed to delete contact.');
                                }
                              },
                            })
                          }
                          className={`text-slate-400 hover:text-rose-600 p-1 rounded ${iconBtnFocus}`}
                          aria-label={`ลบรายชื่อ: ${c.name} / Delete contact`}
                          title="Delete Contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {contacts.length > PAGE_SIZE && (
              <Pager
                page={contactPage}
                pageCount={contactPageCount}
                total={contacts.length}
                onPageChange={(p) => turnPage('contacts', p, contactPageCount)}
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: POLICIES & FORMS STUDIO
         ======================================================== */}
      {activeSubTab === 'documents' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Corporate Policies & Official Forms Repository
              </h4>
              <p className="text-xs text-slate-500">
                อัปโหลดไฟล์ PDF หรือแก้ไขเวอร์ชันของระเบียบข้อบังคับและแบบฟอร์มเบิกจ่าย
              </p>
            </div>

            <button
              onClick={openDocForm}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Add Form / Policy File</span>
            </button>
          </div>

          {isAddingDoc && (
            <div className="bg-white rounded-xl border-2 border-amber-400 p-5 shadow-lg space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Add New Document / Form</h4>
                {docDirty && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                    ยังไม่บันทึก / Unsaved
                  </span>
                )}
              </div>
              {docFormError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{docFormError}</span>
                </div>
              )}
              <form onSubmit={handleSaveDocument} className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Document Title</label>
                  <input
                    type="text"
                    required
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="e.g. แบบฟอร์มขอหนังสือรับรองเงินเดือน (Salary Certificate Request)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="form">Official Form</option>
                      <option value="policy">Company Policy</option>
                      <option value="work-rules">Work Rules</option>
                      <option value="handbook">Handbook</option>
                      <option value="governance">Corporate Governance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Department</label>
                    <input
                      type="text"
                      required
                      value={docDept}
                      onChange={(e) => setDocDept(e.target.value)}
                      placeholder="e.g. Human Resources"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Version Number</label>
                    <input
                      type="text"
                      required
                      value={docVersion}
                      onChange={(e) => setDocVersion(e.target.value)}
                      placeholder="e.g. v2.0 (2025)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeDocForm}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingDoc}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold cursor-pointer transition"
                  >
                    {savingDoc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{savingDoc ? 'กำลังบันทึก...' : 'Upload Document'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Document Title</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Version</th>
                    <th className="px-4 py-3 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedDocuments.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon={<FileText className="w-6 h-6" />}
                          th="ยังไม่มีเอกสารในระบบ"
                          en="No policies or forms yet — add the first one with the button above."
                        />
                      </td>
                    </tr>
                  )}
                  {pagedDocuments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-800">{d.title}</td>
                    <td className="px-3 py-2.5 capitalize">{d.category}</td>
                    <td className="px-3 py-2.5 text-slate-600">{d.department}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">{d.version}</td>
                    <td className="px-4 py-2.5 text-right">
                      {canAdmin ? (
                        <button
                          onClick={() =>
                            setConfirmCfg({
                              tone: 'danger',
                              title: 'ลบเอกสาร / Delete document',
                              message: `คุณแน่ใจหรือไม่ว่าต้องการลบ "${d.title}" (${d.version}) ?\nการลบไม่สามารถย้อนกลับได้ / This action cannot be undone.`,
                              confirmLabel: 'ลบ / Delete',
                              onConfirm: async () => {
                                try {
                                  await onDeleteDocument(d.id);
                                } catch {
                                  setActionError('ลบเอกสารไม่สำเร็จ / Failed to delete document.');
                                }
                              },
                            })
                          }
                          className={`text-slate-400 hover:text-rose-600 p-1 rounded ${iconBtnFocus}`}
                          aria-label={`ลบเอกสาร: ${d.title} / Delete document`}
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {documents.length > PAGE_SIZE && (
              <Pager
                page={docPage}
                pageCount={docPageCount}
                total={documents.length}
                onPageChange={(p) => turnPage('documents', p, docPageCount)}
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 5: MEETING ROOMS STUDIO
         ======================================================== */}
      {activeSubTab === 'rooms' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <h4 className="text-sm font-bold text-slate-900">
              Meeting Rooms Status & Capacity Controls
            </h4>
            <p className="text-xs text-slate-500">
              ปรับปรุงสถานะห้องประชุม (เปิดใช้งาน / ปิดซ่อมบำรุง / ถูกจอง) ชั้น 14 และ 15
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.length === 0 && (
              <div className="col-span-full bg-white rounded-xl border border-dashed border-slate-200">
                <EmptyState
                  icon={<Building className="w-6 h-6" />}
                  th="ยังไม่มีห้องประชุมในระบบ"
                  en="No meeting rooms configured yet."
                />
              </div>
            )}
            {rooms.map((r) => (
              <div key={r.id} className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100">
                      {r.code}
                    </span>
                    <h5 className="font-bold text-slate-900 text-sm mt-1">{r.name}</h5>
                    <p className="text-xs text-slate-400">{r.floor}</p>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      r.status === 'available'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'in-use'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600">Change Status:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onUpdateRoomStatus(r.id, 'available')}
                      aria-label={`ตั้งสถานะ ${r.name} เป็นว่าง / Set available`}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                        r.status === 'available' ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      Available
                    </button>
                    <button
                      onClick={() => onUpdateRoomStatus(r.id, 'in-use')}
                      aria-label={`ตั้งสถานะ ${r.name} เป็นกำลังใช้งาน / Set in-use`}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                        r.status === 'in-use' ? 'bg-rose-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      In-Use
                    </button>
                    <button
                      onClick={() => onUpdateRoomStatus(r.id, 'maintenance')}
                      aria-label={`ตั้งสถานะ ${r.name} เป็นปิดซ่อม / Set maintenance`}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition ${
                        r.status === 'maintenance' ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      Maint.
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 6: PUBLIC SYNC LOGS & AUTOMATION AUDIT TRAIL
         ======================================================== */}
      {activeSubTab === 'sync-logs' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h4 className="text-base font-bold text-slate-900">
                  External Public Website Synchronization Pipeline
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                เปรียบเสมือน Webhook / REST API sync ระหว่าง Intranet กับ www.kbjcapital.co.th
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={handleTriggerSync}
                disabled={syncBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${syncBusy ? 'animate-spin' : ''}`} />
                <span>{syncBusy ? 'กำลังซิงก์... / Syncing...' : 'Force Synchronize All Endpoints'}</span>
              </button>
              {syncError && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                  <AlertCircle className="w-3 h-3" />
                  {syncError}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
              Real-Time Sync Audit Trail (บันทึกการส่งข้อมูลออกสาธารณะ)
            </div>

            {syncLogs.length === 0 ? (
              <EmptyState
                icon={<Globe className="w-6 h-6" />}
                th="ยังไม่มีประวัติการซิงก์"
                en="No sync activity recorded yet — run a full sync to populate the trail."
              />
            ) : (
              <>
            <div className="divide-y divide-slate-100 text-xs font-mono">
              {pagedSyncLogs.map((log) => (
                <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {log.status}
                      </span>
                      <span className="font-sans font-bold text-slate-900 text-xs">
                        {log.itemTitle}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Target: <span className="font-mono text-blue-600">{log.targetEndpoint}</span> • By: {log.syncedBy}
                    </p>
                  </div>

                  <span className="text-[11px] text-slate-400 shrink-0">
                    {log.timestamp}
                  </span>
                </div>
              ))}
            </div>
            {syncLogs.length > PAGE_SIZE && (
              <Pager
                page={syncLogPage}
                pageCount={syncLogPageCount}
                total={syncLogs.length}
                onPageChange={(p) => turnPage('synclogs', p, syncLogPageCount)}
              />
            )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 7: IMMUTABLE AUDIT TRAIL (BOT & PDPA COMPLIANCE)
         ======================================================== */}
      {activeSubTab === 'audit-trail' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-purple-200 shadow-2xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  Bank of Thailand (BOT) Standard
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  PDPA Section 37 Compliance
                </span>
              </div>
              <h4 className="text-base font-extrabold text-slate-900">
                Immutable Governance & Regulatory Audit Trail
              </h4>
              <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
                บันทึกการกระทำทุกขั้นตอน (Maker-Checker, การแก้ไขข้อมูล, การเผยแพร่ออกสาธารณะ) พร้อม IP Address และรหัสอ้างอิง
                สำหรับฝ่ายตรวจสอบภายใน (Internal Audit) และผู้ตรวจการ ธปท.
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={() => handleSystemExport('kbj_governance_audit_export')}
                disabled={exportBusy}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {exportBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 rotate-180" />
                )}
                <span>{exportBusy ? 'กำลังส่งออก...' : 'Export Audit Trail (JSON)'}</span>
              </button>
              {exportError && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                  <AlertCircle className="w-3 h-3" />
                  {exportError}
                </span>
              )}
            </div>
          </div>

          {/* Audit Records Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-3 bg-purple-50/70 border-b border-purple-100 flex items-center justify-between">
              <span className="font-bold text-xs text-purple-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Verified System Audit Records ({auditLogs.length})</span>
              </span>
              <span className="text-[11px] text-purple-700 font-mono">Status: Tamper-Evident Store</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-3 py-3">Actor & Role</th>
                    <th className="px-3 py-3 text-center">Action</th>
                    <th className="px-4 py-3">Resource & Activity Details</th>
                    <th className="px-3 py-3 font-mono">Source IP</th>
                    <th className="px-3 py-3 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {pagedAuditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          icon={<ShieldCheck className="w-6 h-6" />}
                          th="ยังไม่มีบันทึกการตรวจสอบ"
                          en="No audit records yet — governance actions will appear here."
                        />
                      </td>
                    </tr>
                  )}
                  {pagedAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {log.timestamp}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{log.actor}</div>
                        <div className="text-[10px] text-slate-400">{log.actorRole}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            log.action === 'APPROVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action === 'REJECT'
                              ? 'bg-rose-100 text-rose-800'
                              : log.action === 'SUBMIT_APPROVAL'
                              ? 'bg-amber-100 text-amber-900'
                              : log.action === 'SYNC_PUBLIC'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800 mr-1.5">{log.targetResource}:</span>
                        <span className="text-slate-600">{log.details}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-mono text-[10px] text-slate-500">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700'
                              : log.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {auditLogs.length > PAGE_SIZE && (
              <Pager
                page={auditPage}
                pageCount={auditPageCount}
                total={auditLogs.length}
                onPageChange={(p) => turnPage('audit', p, auditPageCount)}
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB: USER MANAGEMENT (ADMIN ONLY — RBAC ACCOUNTS)
         ======================================================== */}
      {activeSubTab === 'users' && canAdmin && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-600" />
                <h4 className="text-base font-bold text-slate-900">
                  User Accounts & Access Rights
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึงระบบ (Staff / Maker / Checker / Admin) แบบ Self-Service โดยไม่ต้องแจ้ง IT
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void refreshUsers()}
                disabled={usersLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={openUserForm}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-white" />
                <span>Create User Account</span>
              </button>
            </div>
          </div>

          {/* Success feedback after a create or status change */}
          {userSuccessMsg && (
            <div
              role="status"
              className="flex items-start justify-between gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800"
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {userSuccessMsg}
              </span>
              <button
                type="button"
                onClick={() => setUserSuccessMsg(null)}
                aria-label="ปิดข้อความแจ้งเตือน / Dismiss message"
                className="p-0.5 rounded text-emerald-600 hover:text-emerald-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {usersError && (
            <div
              role="alert"
              className="flex items-start justify-between gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {usersError}
              </span>
              <button
                type="button"
                onClick={() => void refreshUsers()}
                className="px-2 py-0.5 rounded border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {userActionError && (
            <div
              role="alert"
              className="flex items-start justify-between gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {userActionError}
              </span>
              <button
                type="button"
                onClick={() => setUserActionError(null)}
                aria-label="ปิดข้อความแจ้งเตือน / Dismiss error"
                className="p-0.5 rounded text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Create user form */}
          {isAddingUser && (
            <div className="bg-white rounded-xl border-2 border-amber-400 p-5 shadow-lg space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Create New User Account</h4>
                {userDirty && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                    ยังไม่บันทึก / Unsaved
                  </span>
                )}
              </div>
              {userFormError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{userFormError}</span>
                </div>
              )}
              <form onSubmit={handleSaveUser} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Username <span className="font-medium text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={userUsername}
                      onChange={(e) => setUserUsername(e.target.value)}
                      placeholder="e.g. somchai.k"
                      autoComplete="off"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Display Name <span className="font-medium text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={userDisplayName}
                      onChange={(e) => setUserDisplayName(e.target.value)}
                      placeholder="e.g. คุณสมชาย ใจดี / Somchai Jaidee"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Email <span className="font-medium text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="e.g. somchai.k@kbjcapital.co.th"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Role / สิทธิ์การใช้งาน <span className="font-medium text-rose-500">*</span>
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as Role)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="staff">Staff / พนักงาน — Read only</option>
                      <option value="maker">Maker / ผู้สร้างเนื้อหา — Can author content</option>
                      <option value="checker">Checker / ผู้ตรวจสอบ — Can approve content</option>
                      <option value="admin">Administrator / ผู้ดูแลระบบ — Full access</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Initial Password <span className="font-medium text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="อย่างน้อย 8 ตัวอักษร / at least 8 characters"
                      autoComplete="new-password"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    ผู้ใช้ควรเปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก / The user should change this password after first sign-in.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeUserForm}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingUser}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold cursor-pointer transition"
                  >
                    {savingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{savingUser ? 'กำลังสร้างบัญชี...' : 'Create Account'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Employee / พนักงาน</th>
                    <th className="px-3 py-3">Username</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Created / สร้างเมื่อ</th>
                    <th className="px-3 py-3 text-center">Role / สิทธิ์</th>
                    <th className="px-3 py-3 text-center">Status / สถานะ</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersLoading && users.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="py-10 flex items-center justify-center gap-2 text-slate-400 text-xs font-semibold">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          กำลังโหลดรายชื่อผู้ใช้ / Loading user accounts...
                        </div>
                      </td>
                    </tr>
                  )}
                  {!usersLoading && users.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          icon={<Users className="w-6 h-6" />}
                          th="ยังไม่มีบัญชีผู้ใช้ในระบบ"
                          en="No user accounts yet — create the first one with the button above."
                        />
                      </td>
                    </tr>
                  )}
                  {pagedUsers.map((u) => {
                    const isSelf = u.id === currentUserId;
                    const active = u.isActive !== false;
                    return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/70 transition ${active ? '' : 'opacity-60'}`}
                    >
                      <td className="px-4 py-2.5 font-bold text-slate-800">
                        {u.displayName}
                        {isSelf && (
                          <span className="ml-1.5 text-[9px] font-bold text-[#EA580C] bg-orange-50 border border-orange-200 px-1 py-0.5 rounded">
                            คุณ / YOU
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">{u.username}</td>
                      <td className="px-3 py-2.5 text-slate-600">{u.email}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          title={u.role}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.role === 'admin'
                              ? 'bg-rose-100 text-rose-800'
                              : u.role === 'checker'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'maker'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          title={active ? 'Active / ใช้งาน' : 'Deactivated — cannot sign in / ปิดใช้งาน'}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {active ? 'ใช้งาน / Active' : 'ปิดใช้งาน / Deactivated'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {isSelf ? (
                          <span
                            className="text-[10px] text-slate-400 font-medium"
                            title="ระบบไม่อนุญาตให้ปิดใช้งานบัญชีของตนเอง / The server blocks self-deactivation"
                          >
                            บัญชีของคุณเอง / Your account
                          </span>
                        ) : active ? (
                          <button
                            type="button"
                            onClick={() => requestDeactivateUser(u)}
                            disabled={userActionId === u.id}
                            className="px-2 py-1 rounded text-[10px] font-bold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
                            aria-label={`ปิดใช้งานบัญชี ${u.displayName} / Deactivate account`}
                          >
                            {userActionId === u.id ? '...' : 'ปิดใช้งาน / Deactivate'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleToggleUserActive(u, true)}
                            disabled={userActionId === u.id}
                            className="px-2 py-1 rounded text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
                            aria-label={`เปิดใช้งานบัญชี ${u.displayName} / Reactivate account`}
                          >
                            {userActionId === u.id ? '...' : 'เปิดใช้งาน / Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {users.length > PAGE_SIZE && (
              <Pager
                page={userPage}
                pageCount={userPageCount}
                total={users.length}
                onPageChange={(p) => turnPage('users', p, userPageCount)}
              />
            )}
          </div>
        </div>
      )}

        {/* Lower 2-column stats cards from Professional Polish Theme */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Engagement Analytics (real totals computed from live news data) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              Engagement Analytics
            </h4>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-slate-900">{totalArticleReads.toLocaleString()}</span>
              <span className="text-emerald-500 text-xs font-bold mb-1">{news.length} articles</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Total article reads / ยอดอ่านบทความทั้งหมด</p>
            <div className="mt-6 flex gap-1.5 h-12 items-end">
              <div className="w-full bg-slate-100 h-1/2 rounded-t-sm" />
              <div className="w-full bg-slate-100 h-2/3 rounded-t-sm" />
              <div className="w-full bg-[#F97316] h-full rounded-t-sm shadow-xs" />
              <div className="w-full bg-slate-100 h-1/3 rounded-t-sm" />
              <div className="w-full bg-slate-100 h-3/4 rounded-t-sm" />
              <div className="w-full bg-slate-100 h-1/2 rounded-t-sm" />
              <div className="w-full bg-slate-100 h-4/5 rounded-t-sm" />
            </div>
          </div>

          {/* Sync Health Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                Sync Health
              </h4>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-bold text-slate-800">kbjcapital.co.th Connected</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Last automated sync verified. Cloud endpoint is online, payload queue is healthy with 0 dead letters.
              </p>
            </div>
            {canAdmin ? (
              <button
                onClick={handleTriggerSync}
                disabled={syncBusy}
                className="mt-4 w-full bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncBusy ? 'animate-spin' : ''}`} />
                <span>{syncBusy ? 'กำลังซิงก์...' : 'Force Full Refresh'}</span>
              </button>
            ) : (
              <p className="mt-4 text-[11px] text-slate-400 text-center">
                การซิงก์ทั้งหมดจัดการได้เฉพาะผู้ดูแลระบบ / Full sync is admin-only
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Admin Quick Actions & Activity Sidebar (4 Columns) */}
      <div className="xl:col-span-4 space-y-6">
        {/* Admin Quick Actions Card (Orange Brand Card from Design) */}
        <div className="bg-[#F97316] rounded-2xl p-6 text-white shadow-lg shadow-orange-200/50 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-bold text-lg text-white">Admin Quick Actions</h3>
            <p className="text-orange-100 text-xs mt-1 mb-5">
              Manage core internal portal settings and assets without IT tickets.
            </p>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={() => handleTabChange('news', openNewsCreateForm)}
                  className="w-full text-left flex items-center justify-between text-xs font-bold bg-white/20 hover:bg-white/30 p-2.5 rounded-lg cursor-pointer transition text-white"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>+ Publish Announcement</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleTabChange('banners', openBannerForm)}
                  className="w-full text-left flex items-center justify-between text-xs font-bold bg-white/20 hover:bg-white/30 p-2.5 rounded-lg cursor-pointer transition text-white"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    <span>+ Add Hero Carousel Slide</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleTabChange('directory', openContactForm)}
                  className="w-full text-left flex items-center justify-between text-xs font-bold bg-white/20 hover:bg-white/30 p-2.5 rounded-lg cursor-pointer transition text-white"
                >
                  <span className="flex items-center gap-2">
                    <PhoneCall className="w-4 h-4" />
                    <span>+ Add Employee Contact</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleTabChange('documents', openDocForm)}
                  className="w-full text-left flex items-center justify-between text-xs font-bold bg-white/20 hover:bg-white/30 p-2.5 rounded-lg cursor-pointer transition text-white"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>+ Upload Policy / Form</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </li>
              {canAdmin && (
                <li>
                  <button
                    onClick={handleTriggerSync}
                    disabled={syncBusy}
                    className="w-full text-left flex items-center justify-between text-xs font-bold bg-white/25 hover:bg-white/35 p-2.5 rounded-lg cursor-pointer transition text-white border border-white/30 disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2">
                      <RefreshCw className={`w-4 h-4 ${syncBusy ? 'animate-spin' : ''}`} />
                      <span>{syncBusy ? 'กำลังซิงก์...' : 'Force Public Webhook Sync'}</span>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                  </button>
                </li>
              )}
              {canAdmin && (
                <li>
                  <button
                    onClick={() => handleSystemExport('kbj_intranet_database_export')}
                    disabled={exportBusy}
                    className="w-full text-left flex items-center justify-between text-xs font-bold bg-white/20 hover:bg-white/30 p-2.5 rounded-lg cursor-pointer transition text-white disabled:opacity-60"
                  >
                    <span className="flex items-center gap-2">
                      {exportBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      <span>{exportBusy ? 'กำลังส่งออก...' : 'Export DB Migration Dump'}</span>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                  </button>
                </li>
              )}
              <li>
                <a
                  href="/api/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-left flex items-center justify-between text-xs font-bold bg-white/20 hover:bg-white/30 p-2.5 rounded-lg cursor-pointer transition text-white"
                >
                  <span className="flex items-center gap-2">
                    <FileCode2 className="w-4 h-4" />
                    <span>OpenAPI 3.0 Specification</span>
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </li>
            </ul>
          </div>
          <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full pointer-events-none" />
        </div>

        {/* Recent Admin Activity Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#F97316]" />
              <span>Recent Admin Activity</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-semibold">Live Audit</span>
          </div>

          <div className="space-y-4">
            {auditLogs.length === 0 && (
              <EmptyState
                icon={<Activity className="w-6 h-6" />}
                th="ยังไม่มีกิจกรรมล่าสุด"
                en="No recorded admin activity yet — actions will appear here."
              />
            )}
            {auditLogs.slice(0, 4).map((log, idx, arr) => (
              <div key={log.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      log.action === 'APPROVE'
                        ? 'bg-emerald-500'
                        : log.action === 'REJECT'
                          ? 'bg-rose-500'
                          : log.action === 'SUBMIT_APPROVAL'
                            ? 'bg-amber-500'
                            : log.action === 'SYNC_PUBLIC'
                              ? 'bg-blue-500'
                              : 'bg-[#F97316]'
                    }`}
                  />
                  {idx < arr.length - 1 && <div className="w-0.5 h-full bg-slate-100 my-1" />}
                </div>
                <div className={idx < arr.length - 1 ? 'pb-3' : ''}>
                  <p className="text-xs font-bold text-slate-800 line-clamp-1">{log.targetResource}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{log.details}</p>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {log.timestamp} • {log.actor}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Content Status Monitor */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-900 mb-3">Live Portal Assets Summary</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">News Articles</span>
              <span className="text-slate-800 font-bold text-sm">{news.length} Published</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Hero Slides</span>
              <span className="text-slate-800 font-bold text-sm">{banners.length} Active</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Staff Directory</span>
              <span className="text-slate-800 font-bold text-sm">{contacts.length} Members</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Corporate Docs</span>
              <span className="text-slate-800 font-bold text-sm">{documents.length} Files</span>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Global confirm dialog (deletes + unsaved-changes guard) */}
      {confirmCfg && (
        <ConfirmDialog
          config={confirmCfg}
          busy={confirmBusy}
          onCancel={() => setConfirmCfg(null)}
          onConfirm={runConfirm}
        />
      )}
  </div>
  );
};
