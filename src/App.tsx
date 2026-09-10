/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ViewMode,
  NewsItem,
  BannerSlide,
  DirectoryContact,
  MeetingRoom,
  PolicyDocument,
  SystemTool,
  SyncLog,
  AuditLog
} from './types';
import {
  INITIAL_NEWS,
  INITIAL_BANNERS,
  INITIAL_CONTACTS,
  INITIAL_MEETING_ROOMS,
  INITIAL_DOCUMENTS,
  INITIAL_TOOLS,
  INITIAL_SYNC_LOGS,
  INITIAL_AUDIT_LOGS
} from './data/initialData';
import { Header } from './components/Header';
import { HeroCarousel } from './components/HeroCarousel';
import { QuickToolsBar } from './components/QuickToolsBar';
import { NewsSection } from './components/NewsSection';
import { RegulatoryHub } from './components/RegulatoryHub';
import { DirectoryAndRooms } from './components/DirectoryAndRooms';
import { GovernanceAndPolicies } from './components/GovernanceAndPolicies';
import { AdminCMS } from './components/AdminCMS';
import { ExternalPublicSyncView } from './components/ExternalPublicSyncView';
import { ArticleDetailModal } from './components/ArticleDetailModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { BrandLogo } from './components/BrandLogo';
import { LoginPage } from './components/LoginPage';
import { api, isOffline, subscribeOffline } from './api';
import { useAuth, roleAtLeast } from './auth/AuthContext';

import {
  Building2,
  FileText,
  PhoneCall,
  CalendarDays,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Globe,
  Settings2,
  FileCode2,
  X,
  Sparkles,
  Info,
  WifiOff,
  Loader2
} from 'lucide-react';

export default function App() {
  const { user, isAuthenticated, loading: authLoading, login, logout } = useAuth();
  const [offline, setOffline] = useState(isOffline());
  const [currentView, setCurrentView] = useState<ViewMode>('intranet');
  const [news, setNews] = useState<NewsItem[]>(INITIAL_NEWS);
  const [banners, setBanners] = useState<BannerSlide[]>(INITIAL_BANNERS);
  const [contacts, setContacts] = useState<DirectoryContact[]>(INITIAL_CONTACTS);
  const [rooms, setRooms] = useState<MeetingRoom[]>(INITIAL_MEETING_ROOMS);
  const [documents, setDocuments] = useState<PolicyDocument[]>(INITIAL_DOCUMENTS);
  const [tools] = useState<SystemTool[]>(INITIAL_TOOLS);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>(INITIAL_SYNC_LOGS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<PolicyDocument | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; kind: 'info' | 'error' } | null>(null);

  // A fresh toast cancels the previous one's dismissal timer, so a rapid
  // error-then-success (or vice versa) never gets cut short by a stale timer.
  const toastTimer = useRef<number | null>(null);
  const showToast = (msg: string, kind: 'info' | 'error' = 'info') => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ message: msg, kind });
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3800);
  };

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    []
  );

  // Offline flag follows the api layer (D7: public fallbacks must be visible)
  useEffect(() => subscribeOffline(setOffline), []);

  const errMessage = (err: unknown): string =>
    err instanceof Error ? err.message : 'Unexpected error';

  // Keyboard shortcut ⌘K for search (authenticated portal only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (user) setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  // Role-based view access (RBAC): portal views for all authenticated staff;
  // CMS authoring + external sync preview for maker+ (incl. checker approval queue).
  const allowedViews = useMemo<ViewMode[]>(() => {
    if (!user) return ['intranet'];
    const views: ViewMode[] = ['intranet'];
    if (roleAtLeast(user.role, 'maker')) views.push('admin-cms', 'external-web');
    return views;
  }, [user]);

  const canShowView = (view: ViewMode) => allowedViews.includes(view);

  // Gate the view STATE itself, not just the buttons — a role change or logout
  // must never leave the app sitting on a now-forbidden view.
  useEffect(() => {
    if (!canShowView(currentView)) {
      setCurrentView('intranet');
    }
  }, [allowedViews, currentView]);

  // Initialize & Hydrate data from the API.
  // Public endpoints fall back to bundled sample data (flagged "offline");
  // authenticated endpoints surface failures instead of falling back (D7).
  useEffect(() => {
    let isMounted = true;

    const loadPublicData = async () => {
      const [newsData, bannersData, roomsData] = await Promise.all([
        api.getNews(),
        api.getBanners(),
        api.getRooms(),
      ]);
      if (!isMounted) return;
      if (newsData && newsData.length > 0) setNews(newsData);
      if (bannersData && bannersData.length > 0) setBanners(bannersData);
      if (roomsData && roomsData.length > 0) setRooms(roomsData);
    };

    const loadAuthenticatedData = async () => {
      if (!isAuthenticated) {
        // Reset staff/admin-only slices so signed-out users never see them.
        setContacts(INITIAL_CONTACTS);
        setDocuments(INITIAL_DOCUMENTS);
        setSyncLogs(INITIAL_SYNC_LOGS);
        setAuditLogs(INITIAL_AUDIT_LOGS);
        return;
      }
      // Staff+: directory & policy documents
      try {
        const [contactsData, docsData] = await Promise.all([
          api.getContacts(),
          api.getDocuments(),
        ]);
        if (!isMounted) return;
        if (contactsData && contactsData.length > 0) setContacts(contactsData);
        if (docsData && docsData.length > 0) setDocuments(docsData);
      } catch (err) {
        showToast(`Directory/documents sync failed: ${errMessage(err)}`, 'error');
      }
      // Checker+: immutable audit trail
      if (roleAtLeast(user?.role, 'checker')) {
        try {
          const auditData = await api.getAuditLogs();
          if (isMounted && auditData && auditData.length > 0) setAuditLogs(auditData);
        } catch (err) {
          showToast(`Audit trail sync failed: ${errMessage(err)}`, 'error');
        }
      }
      // Admin: external web sync logs
      if (user?.role === 'admin') {
        try {
          const logsData = await api.getSyncLogs();
          if (isMounted && logsData && logsData.length > 0) setSyncLogs(logsData);
        } catch (err) {
          showToast(`Sync log refresh failed: ${errMessage(err)}`, 'error');
        }
      }
    };

    loadPublicData().catch((err) => {
      console.warn('Public data hydration warning, using bundled sample data:', err);
    });
    loadAuthenticatedData();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.role]);

  // Handlers for CMS (synchronized with the backend API).
  // Contract: handlers THROW on failure — AdminCMS catches and surfaces inline
  // errors while keeping its forms open (no input loss). App state mutates only
  // after the server confirms, so a failed save leaves state untouched.
  const handleAddNews = async (item: NewsItem) => {
    let created: NewsItem;
    try {
      created = await api.createNews(item);
    } catch (err) {
      showToast(`Publish failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setNews((prev) => [created, ...prev]);

    if (item.syncToExternal) {
      const newLog: SyncLog = {
        id: `sync-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        itemId: created.id,
        itemTitle: created.title,
        action: 'CREATE',
        status: 'SUCCESS',
        targetEndpoint: 'api.kbjcapital.co.th/v1/public/news',
        syncedBy: user?.email ?? user?.username ?? 'unknown',
      };
      setSyncLogs((prev) => [newLog, ...prev]);
      showToast('Announcement Published & Synced to www.kbjcapital.co.th in real time!');
    } else {
      showToast('New Announcement Published to Employee Intranet successfully!');
    }
  };

  const handleUpdateNews = async (item: NewsItem) => {
    if (!item.id) {
      const noId = new Error('Update refused: item has no id (would send PUT with an empty id)');
      showToast(noId.message, 'error');
      throw noId;
    }
    let updated: NewsItem;
    try {
      updated = await api.updateNews(item.id, item);
    } catch (err) {
      showToast(`Save failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setNews((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));

    if (item.syncToExternal) {
      const newLog: SyncLog = {
        id: `sync-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        itemId: updated.id,
        itemTitle: updated.title,
        action: 'UPDATE',
        status: 'SUCCESS',
        targetEndpoint: 'api.kbjcapital.co.th/v1/public/news',
        syncedBy: user?.email ?? user?.username ?? 'unknown',
      };
      setSyncLogs((prev) => [newLog, ...prev]);
      showToast('Changes saved & synchronized to www.kbjcapital.co.th!');
    } else {
      showToast('Changes saved to Employee Intranet!');
    }
  };

  const handleDeleteNews = async (id: string) => {
    const target = news.find((n) => n.id === id);
    try {
      await api.deleteNews(id);
    } catch (err) {
      showToast(`Delete failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setNews((prev) => prev.filter((n) => n.id !== id));
    showToast(`Removed announcement: ${target?.title.substring(0, 24)}...`);
  };

  const handleToggleExternalSync = async (id: string) => {
    const item = news.find((n) => n.id === id);
    if (!item) return;

    const nextSync = !item.syncToExternal;
    const updated = {
      ...item,
      syncToExternal: nextSync,
      externalSyncStatus: (nextSync ? 'synced' : 'draft') as 'synced' | 'draft',
    };

    try {
      await api.updateNews(id, updated);
    } catch (err) {
      showToast(`Sync toggle failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setNews((prev) => prev.map((n) => (n.id === id ? updated : n)));

    const newLog: SyncLog = {
      id: `sync-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      itemId: item.id,
      itemTitle: item.title,
      action: nextSync ? 'CREATE' : 'DELETE',
      status: 'SUCCESS',
      targetEndpoint: 'api.kbjcapital.co.th/v1/public/news',
      syncedBy: user?.email ?? user?.username ?? 'unknown',
    };
    setSyncLogs((prevLogs) => [newLog, ...prevLogs]);
    showToast(
      nextSync
        ? `"${item.title.substring(0, 28)}..." is now LIVE on www.kbjcapital.co.th!`
        : `Unpublished from external site. Now visible on Intranet only.`
    );
  };

  // Role-gated refresh helpers (audit: checker+, sync logs: admin)
  const refreshAuditLogs = async () => {
    if (!roleAtLeast(user?.role, 'checker')) return;
    try {
      const audit = await api.getAuditLogs();
      if (audit) setAuditLogs(audit);
    } catch (err) {
      console.warn('Audit log refresh failed:', err);
    }
  };

  const refreshSyncLogs = async () => {
    if (user?.role !== 'admin') return;
    try {
      const logs = await api.getSyncLogs();
      if (logs) setSyncLogs(logs);
    } catch (err) {
      console.warn('Sync log refresh failed:', err);
    }
  };

  const handleSubmitNewsApproval = async (id: string) => {
    try {
      await api.submitNewsForApproval(id);
    } catch (err) {
      showToast(`Failed to submit for approval: ${errMessage(err)}`, 'error');
      throw err;
    }
    setNews((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, externalSyncStatus: 'pending_approval', syncToExternal: false } : n
      )
    );
    await refreshAuditLogs();
    showToast('Submitted for Maker-Checker dual control review!');
  };

  const handleApproveNews = async (id: string) => {
    let result;
    try {
      result = await api.approveNews(id);
    } catch (err) {
      showToast(`Approval failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    const actorLabel = user?.displayName ?? user?.username ?? 'checker';
    setNews((prev) =>
      prev.map((n) =>
        n.id === id
          ? result.data ?? {
              ...n,
              externalSyncStatus: 'synced' as const,
              syncToExternal: true,
              approvedBy: actorLabel,
              approvedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
            }
          : n
      )
    );
    await Promise.all([refreshAuditLogs(), refreshSyncLogs()]);
    showToast(result.message || 'Approved! Published live to www.kbjcapital.co.th');
  };

  const handleRejectNews = async (id: string, reason: string = 'Regulatory wording revision required') => {
    let result;
    try {
      result = await api.rejectNews(id, reason);
    } catch (err) {
      showToast(`Rejection failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    const rejected = result.data;
    setNews((prev) =>
      prev.map((n) =>
        n.id === id
          ? rejected ?? {
              ...n,
              externalSyncStatus: 'rejected' as const,
              syncToExternal: false,
              approvedBy: `Rejected: ${reason}`,
            }
          : n
      )
    );
    await refreshAuditLogs();
    showToast('Item rejected by Compliance Checker. Logged in audit trail.');
  };

  const handleAddBanner = async (banner: BannerSlide) => {
    let created: BannerSlide;
    try {
      created = await api.createBanner(banner);
    } catch (err) {
      showToast(`Banner save failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setBanners((prev) => [created, ...prev]);
    showToast('New Hero Banner added to carousel!');
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      await api.deleteBanner(id);
    } catch (err) {
      showToast(`Banner delete failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setBanners((prev) => prev.filter((b) => b.id !== id));
    showToast('Banner slide deleted.');
  };

  const handleAddContact = async (contact: DirectoryContact) => {
    let created: DirectoryContact;
    try {
      created = await api.createContact(contact);
    } catch (err) {
      showToast(`Contact save failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setContacts((prev) => [created, ...prev]);
    showToast(`Added ${created.name} (Ext. ${created.extension}) to directory.`);
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await api.deleteContact(id);
    } catch (err) {
      showToast(`Contact delete failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
    showToast('Contact removed from telephone directory.');
  };

  const handleAddDocument = async (doc: PolicyDocument) => {
    let created: PolicyDocument;
    try {
      created = await api.createDocument(doc);
    } catch (err) {
      showToast(`Document upload failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setDocuments((prev) => [created, ...prev]);
    showToast(`Uploaded document: ${created.title}`);
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await api.deleteDocument(id);
    } catch (err) {
      showToast(`Document delete failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    showToast('Document removed.');
  };

  const handleUpdateRoomStatus = (
    roomId: string,
    status: 'available' | 'in-use' | 'maintenance'
  ) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, status } : r))
    );
    showToast(`Meeting room status updated to: ${status.toUpperCase()}`);
  };

  const handleBookRoom = async (
    roomId: string,
    topic: string,
    booker: string,
    time: string
  ) => {
    try {
      const updated = await api.bookRoom(roomId, { topic, booker, time });
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? updated ?? {
                ...r,
                status: 'in-use' as const,
                currentBooking: { topic, booker, time },
              }
            : r
        )
      );
      showToast(`Room successfully reserved for ${booker}! (${time})`);
    } catch (err) {
      showToast(`Booking failed: ${errMessage(err)}`, 'error');
    }
  };

  const handleReleaseRoom = async (roomId: string) => {
    const target = rooms.find((r) => r.id === roomId);
    try {
      const updated = await api.releaseRoom(roomId);
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? updated ?? {
                ...r,
                status: 'available' as const,
                currentBooking: undefined,
              }
            : r
        )
      );
      showToast(`Meeting room released: ${target?.name ?? roomId} is now available.`);
    } catch (err) {
      showToast(`Release failed: ${errMessage(err)}`, 'error');
    }
  };

  const handleTriggerFullSync = async () => {
    let result;
    try {
      result = await api.triggerPublicSync();
    } catch (err) {
      showToast(`Sync failed: ${errMessage(err)}`, 'error');
      throw err;
    }
    await refreshSyncLogs();
    const activeSynced = news.filter((n) => n.syncToExternal).length;
    showToast(result.message || `Handshake complete: ${activeSynced} items synced to public portal!`);
  };

  const handleActionClick = (url: string) => {
    if (url.startsWith('#')) {
      const el = document.getElementById(url.replace('#', ''));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (url === '#directory') {
        const sec = document.getElementById('directory-rooms-section');
        sec?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (url === '#meeting-rooms') {
        const sec = document.getElementById('directory-rooms-section');
        sec?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    }
  };

  const handleSelectTool = (tool: SystemTool) => {
    if (tool.url.startsWith('#')) {
      handleActionClick(tool.url);
      return;
    }
    window.open(tool.url, '_blank');
  };

  const handleNavigateToSection = (sectionId: string) => {
    setCurrentView('intranet');
    setTimeout(() => {
      const el = document.getElementById(sectionId) || document.getElementById('directory-rooms-section');
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const syncedCount = news.filter((n) => n.syncToExternal).length;
  const urgentAlert = news.find((n) => n.isImportantAlert);

  const offlineBadge = offline ? (
    <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white text-stone-800 shadow-xl border border-amber-300">
      <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
      <div className="text-xs font-semibold leading-tight">
        โหมดออฟไลน์ — แสดงข้อมูลตัวอย่าง
        <span className="block text-[10px] font-medium text-stone-500">
          Offline mode — showing bundled sample data
        </span>
      </div>
    </div>
  ) : null;

  // ---- Auth gate (task #11) ----
  // Session check in flight → minimal splash; anonymous → full-screen sign-in.
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] gap-4">
        <BrandLogo size="md" />
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
          <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
          กำลังตรวจสอบเซสชัน / Checking session...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage onSubmit={login} />
        {offlineBadge}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* Toast Notification Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-white text-stone-800 shadow-xl border animate-in slide-in-from-bottom-5 duration-200 ${
            toast.kind === 'error' ? 'border-red-300' : 'border-orange-200'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full animate-pulse ${
              toast.kind === 'error' ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          />
          <span className="text-xs font-semibold">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Offline Data Indicator (D7): public fallbacks must be visibly flagged */}
      {offlineBadge}

      {/* Global Header */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenSearch={() => setIsSearchOpen(true)}
        syncedCount={syncedCount}
        unreadAlertsCount={urgentAlert ? 1 : 0}
        onOpenAlert={() => {
          if (urgentAlert) setSelectedArticle(urgentAlert);
        }}
        user={user}
        onLogout={logout}
        allowedViews={allowedViews}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ========================================================
            VIEW 1: EMPLOYEE PORTAL (INTRANET REVAMP)
           ======================================================== */}
        {currentView === 'intranet' && (
          <div className="space-y-8">
            {/* Top Hero Carousel */}
            <HeroCarousel
              slides={banners}
              onActionClick={handleActionClick}
            />

            {/* Quick Action Tools Bar (As-Is top buttons upgraded) */}
            <QuickToolsBar
              tools={tools}
              onSelectTool={handleSelectTool}
            />

            {/* Main Portal Body: Two-Column Layout mirroring corporate portal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Quick Corporate Navigation (Revamping As-Is Left Sidebar) */}
              <aside className="lg:col-span-3 space-y-5">
                {/* Corporate Navigation Card (Refined Enterprise Corporate Index) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4.5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#F97316]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Corporate Index
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      v2568.2
                    </span>
                  </div>

                  {/* Section 1: Facilities & Rooms */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-2">
                      Facilities & Space
                    </div>
                    <nav className="space-y-0.5 text-xs">
                      <button
                        onClick={() => handleActionClick('#directory')}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition group text-left cursor-pointer"
                      >
                        <span className="font-semibold">Internal Phonebook</span>
                        <PhoneCall className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#F97316]" />
                      </button>

                      <button
                        onClick={() => handleActionClick('#meeting-rooms')}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition group text-left cursor-pointer"
                      >
                        <span className="font-semibold">Meeting Rooms Plan</span>
                        <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-orange-100 text-[#EA580C] border border-orange-200">
                          14-15F
                        </span>
                      </button>
                    </nav>
                  </div>

                  {/* Section 2: Corporate Governance */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-2">
                      Governance & Ethics
                    </div>
                    <nav className="space-y-0.5 text-xs">
                      <button
                        onClick={() => {
                          const sec = document.getElementById('governance-section');
                          sec?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition group text-left cursor-pointer"
                      >
                        <span>ข้อมูลบริษัท (Company Profile)</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>

                      <button
                        onClick={() => {
                          const sec = document.getElementById('governance-section');
                          sec?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition group text-left cursor-pointer"
                      >
                        <span>วิสัยทัศน์และพันธกิจ (Vision & Mission)</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>

                      <button
                        onClick={() => {
                          const sec = document.getElementById('governance-section');
                          sec?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition group text-left cursor-pointer"
                      >
                        <span>คณะกรรมการและผู้บริหาร (Board)</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>

                      <button
                        onClick={() => {
                          const sec = document.getElementById('governance-section');
                          sec?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition group text-left cursor-pointer"
                      >
                        <span>จรรยาบรรณธุรกิจ (Business Ethics)</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </nav>
                  </div>

                  {/* Section 3: Official Forms & Rules */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-2">
                      Policies & Handbooks
                    </div>
                    <nav className="space-y-0.5 text-xs">
                      <button
                        onClick={() => {
                          const sec = document.getElementById('governance-section');
                          sec?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition group text-left cursor-pointer"
                      >
                        <span>แบบฟอร์มเอกสาร (Official Forms)</span>
                        <span className="font-mono text-[10px] text-slate-400 font-semibold">HR / IT</span>
                      </button>

                      <button
                        onClick={() => {
                          const sec = document.getElementById('governance-section');
                          sec?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition group text-left cursor-pointer"
                      >
                        <span>ข้อบังคับการทำงาน (Work Rules)</span>
                        <span className="font-mono text-[10px] text-slate-400 font-semibold">2568</span>
                      </button>

                      <button
                        onClick={() => {
                          const sec = document.getElementById('governance-section');
                          sec?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition group text-left cursor-pointer"
                      >
                        <span>คู่มือพนักงาน (Employee Handbook)</span>
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Left Lower Widget: High-Precision Compliance Watch - Warm Executive Tone */}
                <div className="bg-gradient-to-br from-[#FFF9F3] via-white to-[#FFF4EA] text-stone-800 rounded-2xl p-5 border border-orange-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-orange-100 border border-orange-200 text-orange-900 text-[10px] font-bold tracking-wider uppercase font-mono">
                      Compliance Directives
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>

                  <h5 className="text-xs font-bold leading-snug text-stone-900">
                    PDPA Update: หลักเกณฑ์การขอรับสำเนาข้อมูลส่วนบุคคล
                  </h5>

                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล พ.ร.บ. 2562 สำหรับเจ้าหน้าที่ผู้ปฏิบัติงานกับข้อมูลลูกค้า
                  </p>

                  <button
                    onClick={() => {
                      const reg = news.find((n) => n.category === 'regulation');
                      if (reg) setSelectedArticle(reg);
                    }}
                    className="w-full py-2 rounded-xl bg-orange-50 hover:bg-orange-100/80 text-[#EA580C] font-bold text-xs transition cursor-pointer border border-orange-200"
                  >
                    ตรวจสอบคู่มือแนวปฏิบัติ
                  </button>
                </div>

                {/* Self-Service CMS Quick Launcher (maker+) */}
                {canShowView('admin-cms') && (
                  <div className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                        <Settings2 className="w-4 h-4 text-[#F97316]" />
                        <span>Content Management</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Live CMS
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      เพิ่มข่าวสาร จัดการแบนเนอร์ อัปเดตผังห้องประชุม และแก้ไขเบอร์ต่อภายในแบบเรียลไทม์
                    </p>
                    <button
                      onClick={() => setCurrentView('admin-cms')}
                      className="w-full py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                      <span>Open Self-Service CMS</span>
                    </button>
                  </div>
                )}
              </aside>

              {/* Center/Right Main Feed (9 Columns on lg) */}
              <div className="lg:col-span-9 space-y-10">
                {/* 1. KB J News & Alert Grid */}
                <NewsSection
                  news={news}
                  onSelectArticle={setSelectedArticle}
                />

                {/* 2. Regulatory & Compliance Hub (NCB Orange, BOT Blue, PDPA Green) */}
                <RegulatoryHub
                  news={news}
                  onSelectArticle={setSelectedArticle}
                />

                {/* 3. Internal Directory & Meeting Rooms Plan */}
                <DirectoryAndRooms
                  contacts={contacts}
                  rooms={rooms}
                  onBookRoom={handleBookRoom}
                  onReleaseRoom={handleReleaseRoom}
                />

                {/* 4. Corporate Governance, Policies & Official Forms */}
                <div id="governance-section">
                  <GovernanceAndPolicies
                    documents={documents}
                    onOpenDocument={setSelectedDocument}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 2: SELF-SERVICE ADMIN CMS DASHBOARD
           ======================================================== */}
        {currentView === 'admin-cms' && (
          <AdminCMS
            news={news}
            banners={banners}
            contacts={contacts}
            documents={documents}
            rooms={rooms}
            syncLogs={syncLogs}
            auditLogs={auditLogs}
            onAddNews={handleAddNews}
            onUpdateNews={handleUpdateNews}
            onDeleteNews={handleDeleteNews}
            onToggleExternalSync={handleToggleExternalSync}
            onSubmitForApproval={handleSubmitNewsApproval}
            onApproveNews={handleApproveNews}
            onRejectNews={handleRejectNews}
            onAddBanner={handleAddBanner}
            onDeleteBanner={handleDeleteBanner}
            onAddContact={handleAddContact}
            onDeleteContact={handleDeleteContact}
            onAddDocument={handleAddDocument}
            onDeleteDocument={handleDeleteDocument}
            onUpdateRoomStatus={handleUpdateRoomStatus}
            onTriggerFullSync={handleTriggerFullSync}
            userRole={user?.role}
            onRequireAuth={logout}
          />
        )}

        {/* ========================================================
            VIEW 3: EXTERNAL PUBLIC WEBSITE SYNC VIEW (www.kbjcapital.co.th)
           ======================================================== */}
        {currentView === 'external-web' && (
          <ExternalPublicSyncView
            syncedNews={news}
            onOpenArticle={setSelectedArticle}
            onSwitchToCMS={() => setCurrentView('admin-cms')}
          />
        )}

      </main>

      {/* Global Footer - Mirrored after approved corporate website */}
      <footer className="bg-[#FFF9F3] border-t border-orange-200/80 mt-12 text-xs text-stone-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <BrandLogo size="sm" />
              <span className="text-orange-200">|</span>
              <span className="font-bold text-stone-800">KB J Capital Portal 2.0</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Sindhorn Building, Tower 3, 14th-15th Fl., Wireless Rd., Lumpini, Pathumwan, Bangkok 10330
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-stone-700">
            <button
              onClick={() => setCurrentView('intranet')}
              className="hover:text-[#F97316] transition cursor-pointer"
            >
              Intranet Feed
            </button>
            {canShowView('admin-cms') && (
              <button
                onClick={() => setCurrentView('admin-cms')}
                className="hover:text-[#F97316] transition cursor-pointer"
              >
                Self-Service CMS
              </button>
            )}
            {canShowView('external-web') && (
              <button
                onClick={() => setCurrentView('external-web')}
                className="hover:text-[#F97316] transition cursor-pointer"
              >
                External Web Sync
              </button>
            )}
            <a
              href="https://www.kbjcapital.co.th"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#EA580C] hover:text-[#F97316] transition"
            >
              <span>www.kbjcapital.co.th</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="tel:1258"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F97316] hover:bg-[#EA580C] text-white font-black text-xs shadow-xs transition"
            >
              <span>Hotline 1258</span>
            </a>
          </div>
        </div>

        {/* Kashjoy Signature Golden Yellow Baseline Strip (Directly matching approved design.png) */}
        <div className="bg-[#FFBF00] text-stone-950 py-2 px-4 border-t border-amber-300">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] font-semibold">
            <span>© 2025 KB J Capital Co., Ltd. All rights reserved. • A Member of KB Financial Group & Jaymart</span>
            <span className="opacity-80">Enterprise Intranet Portal • Material 3 Design System</span>
          </div>
        </div>
      </footer>

      {/* Global Reading Modal */}
      <ArticleDetailModal
        article={selectedArticle}
        document={selectedDocument}
        onClose={() => {
          setSelectedArticle(null);
          setSelectedDocument(null);
        }}
      />

      {/* Omnibox Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        news={news}
        contacts={contacts}
        documents={documents}
        rooms={rooms}
        onSelectArticle={setSelectedArticle}
        onSelectDocument={setSelectedDocument}
        onNavigateToSection={handleNavigateToSection}
      />
    </div>
  );
}
