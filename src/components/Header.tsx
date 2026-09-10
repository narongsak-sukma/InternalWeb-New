import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { ViewMode } from '../types';
import {
  LayoutDashboard,
  Settings2,
  Globe,
  Search,
  ExternalLink,
  Laptop,
  Users,
  FileCheck,
  ChevronDown,
  Bell,
  ShieldCheck,
  Building2,
  Phone,
  LogOut
} from 'lucide-react';

/** Role display metadata for the authenticated profile badge. */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  checker: 'Compliance Checker',
  maker: 'Content Maker',
  staff: 'Employee',
};

const ROLE_CHIPS: Record<string, string> = {
  admin: 'ADMIN',
  checker: 'CHECKER',
  maker: 'MAKER',
  staff: 'STAFF',
};

interface HeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenSearch: () => void;
  syncedCount: number;
  unreadAlertsCount: number;
  onOpenAlert: () => void;
  /** Authenticated user for the profile badge (optional — omit/null keeps the legacy static badge) */
  user?: { displayName: string; role: 'admin' | 'checker' | 'maker' | 'staff' } | null;
  /** Sign-out handler — renders a sign-out button when provided alongside `user` */
  onLogout?: () => void;
  /** View modes the current role may open; nav entries outside the list are hidden (undefined = all) */
  allowedViews?: ViewMode[];
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onOpenSearch,
  syncedCount,
  unreadAlertsCount,
  onOpenAlert,
  user,
  onLogout,
  allowedViews,
}) => {
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);

  const canShow = (view: ViewMode) => !allowedViews || allowedViews.includes(view);

  const initials =
    user?.displayName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'KB';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Top Banner Utility Bar - Warm Corporate Tone matching approved website */}
      <div className="bg-[#FFF9F3] text-stone-600 text-xs px-4 py-1.5 border-b border-orange-200/70">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-2 text-stone-800 font-semibold tracking-tight">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              KB J Capital Internal Portal 2.0 (Modernized Architecture)
            </span>
            <span className="hidden md:inline-block text-orange-200">|</span>
            <span className="hidden md:flex items-center gap-1.5 text-stone-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Zero-IT CMS Self-Service Active
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            {/* Public Sync Status Badge (maker+ — matches external-web view access) */}
            {canShow('external-web') && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => onViewChange('external-web')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onViewChange('external-web');
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white hover:bg-orange-50 text-stone-700 cursor-pointer border border-orange-200/80 shadow-2xs transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                title="Click to view external public web sync preview"
              >
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="uppercase text-[10px] tracking-tighter text-stone-500 font-bold">Live Sync:</span>
                <strong className="text-[#F97316] font-bold">{syncedCount} items</strong>
              </div>
            )}

            <span className={`text-orange-200 ${canShow('external-web') ? '' : 'hidden'}`}>|</span>

            {/* Quick Link to corporate site */}
            <a
              href="https://www.kbjcapital.co.th"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-stone-600 hover:text-[#F97316] transition"
            >
              <Globe className="w-3 h-3 text-[#F97316]" />
              <span>www.kbjcapital.co.th</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onViewChange('intranet')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onViewChange('intranet');
              }
            }}
            className="cursor-pointer py-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
            title="กลับสู่หน้าหลัก / Back to intranet home"
          >
            <BrandLogo size="md" />
          </div>

          {/* Center: Major View Modes Switcher */}
          <nav className="hidden lg:flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              id="nav-intranet"
              onClick={() => onViewChange('intranet')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'intranet'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/70 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#F97316]" />
              <span>Employee Portal</span>
            </button>

            {canShow('admin-cms') && (
              <button
                id="nav-cms"
                onClick={() => onViewChange('admin-cms')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'admin-cms'
                    ? 'bg-[#F97316] text-white shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Settings2 className={`w-4 h-4 ${currentView === 'admin-cms' ? 'text-white' : 'text-[#F97316]'}`} />
                <span>Self-Service CMS</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-white/25 text-white font-bold">
                  {user ? ROLE_CHIPS[user.role] : 'Admin'}
                </span>
              </button>
            )}

            {canShow('external-web') && (
              <button
                id="nav-external"
                onClick={() => onViewChange('external-web')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'external-web'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200/70 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-4 h-4 text-blue-600" />
                <span>External Web Sync</span>
              </button>
            )}
          </nav>

          {/* Right Actions: Hotline 1258, Search, Quick Launch, User */}
          <div className="flex items-center gap-2.5">
            {/* Signature KB J 1258 Customer Care Hotline Pill (From official design) */}
            <a
              href="tel:1258"
              title="KB J Capital Hotline 1258"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-[#F97316] text-slate-950 font-black text-xs shadow-xs hover:brightness-105 transition-all border border-amber-300 select-none"
            >
              <Phone className="w-3.5 h-3.5 fill-slate-950" />
              <span className="tracking-wide text-xs">1258</span>
            </a>

            {/* Global Search Button */}
            <button
              id="btn-global-search"
              onClick={onOpenSearch}
              aria-label="Quick search / ค้นหาทั้งหมด"
              className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200/70 rounded-full border border-slate-200/80 transition"
              title="Search Phonebook, News, Forms, Policies"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Quick search...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-mono bg-white rounded-full border border-slate-300 text-slate-400">
                ⌘K
              </kbd>
            </button>

            {/* Quick Applications Dropdown (As-Is: Application/Tools, HR System, IT-Request) */}
            <div className="relative">
              <button
                id="btn-tools-dropdown"
                onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                aria-haspopup="menu"
                aria-expanded={showToolsDropdown}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-xs transition"
              >
                <LayoutDashboard className="w-4 h-4 text-[#F97316]" />
                <span className="hidden md:inline">Internal Tools</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showToolsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showToolsDropdown && (
                <div
                  className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onMouseLeave={() => setShowToolsDropdown(false)}
                >
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">Core Corporate Systems</p>
                    <p className="text-[11px] text-slate-500">Quick access to essential portals</p>
                  </div>
                  <div className="p-1.5 space-y-1">
                    <a
                      href="https://hr.kbjcapital.co.th"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-amber-50/70 transition group"
                    >
                      <div className="p-2 rounded-md bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white transition">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">HR System</p>
                        <p className="text-[11px] text-slate-500">Leave, attendance, payslip</p>
                      </div>
                    </a>

                    <a
                      href="https://it-service.kbjcapital.co.th"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-100 transition group"
                    >
                      <div className="p-2 rounded-md bg-slate-100 text-slate-700 group-hover:bg-[#F97316] group-hover:text-white transition">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">IT-Request (Helpdesk)</p>
                        <p className="text-[11px] text-slate-500">Tickets, equipment, access</p>
                      </div>
                    </a>

                    <a
                      href="https://edms.kbjcapital.co.th"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-blue-50/70 transition group"
                    >
                      <div className="p-2 rounded-md bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">KB J-E-DMS</p>
                        <p className="text-[11px] text-slate-500">e-Signature & Paperless</p>
                      </div>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              id="btn-notifications"
              onClick={onOpenAlert}
              aria-label={
                unreadAlertsCount > 0
                  ? `Urgent alerts — ${unreadAlertsCount} unread`
                  : 'Urgent alerts'
              }
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Urgent Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* User Profile Badge (authenticated identity) + Sign out */}
            {user ? (
              <div className="hidden sm:flex items-center gap-2.5 pl-2.5 border-l border-slate-200 rounded-lg">
                <div
                  role={canShow('admin-cms') ? 'button' : undefined}
                  tabIndex={canShow('admin-cms') ? 0 : undefined}
                  onClick={canShow('admin-cms') ? () => onViewChange('admin-cms') : undefined}
                  onKeyDown={
                    canShow('admin-cms')
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onViewChange('admin-cms');
                          }
                        }
                      : undefined
                  }
                  className={`flex items-center gap-2.5 rounded-lg ${
                    canShow('admin-cms')
                      ? 'cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50'
                      : ''
                  }`}
                  title={`Logged in as ${user.displayName} (${ROLE_LABELS[user.role] ?? user.role})`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F97316] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {initials}
                  </div>
                  <div className="text-left hidden xl:block">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-[#F97316] transition">
                        {user.displayName}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-orange-100 text-[#EA580C] font-bold">
                        {ROLE_CHIPS[user.role] ?? user.role.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </p>
                  </div>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    aria-label="ออกจากระบบ / Sign out"
                    title="ออกจากระบบ / Sign out"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Sign out</span>
                  </button>
                )}
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => onViewChange('admin-cms')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onViewChange('admin-cms');
                  }
                }}
                className="hidden sm:flex items-center gap-2.5 pl-2.5 border-l border-slate-200 cursor-pointer group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                title="Logged in as Corporate Content Administrator"
              >
                <div className="w-8 h-8 rounded-lg bg-[#F97316] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  KB
                </div>
                <div className="text-left hidden xl:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-[#F97316] transition">
                      Corp. Admin
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-orange-100 text-[#EA580C] font-bold">
                      CMS
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Content Administrator</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile View Switcher (Scrollable on small screens) */}
        <div className="lg:hidden flex items-center gap-2 overflow-x-auto py-2 border-t border-slate-100 no-scrollbar">
          <button
            onClick={() => onViewChange('intranet')}
            className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold ${
              currentView === 'intranet' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-700'
            }`}
          >
            🏢 Intranet
          </button>
          {canShow('admin-cms') && (
            <button
              onClick={() => onViewChange('admin-cms')}
              className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold ${
                currentView === 'admin-cms' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-700'
              }`}
            >
              ⚙️ Self-Service CMS
            </button>
          )}
          {canShow('external-web') && (
            <button
              onClick={() => onViewChange('external-web')}
              className={`shrink-0 px-3 py-1 rounded-lg text-xs font-semibold ${
                currentView === 'external-web' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              🌐 Public Web Sync
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
