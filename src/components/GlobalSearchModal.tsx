import React, { useState, useEffect } from 'react';
import { NewsItem, DirectoryContact, PolicyDocument, MeetingRoom } from '../types';
import {
  Search,
  X,
  PhoneCall,
  FileText,
  Building,
  Newspaper,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  news: NewsItem[];
  contacts: DirectoryContact[];
  documents: PolicyDocument[];
  rooms: MeetingRoom[];
  onSelectArticle: (article: NewsItem) => void;
  onSelectDocument: (doc: PolicyDocument) => void;
  onNavigateToSection: (sectionId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  news,
  contacts,
  documents,
  rooms,
  onSelectArticle,
  onSelectDocument,
  onNavigateToSection,
}) => {
  const [query, setQuery] = useState('');

  // Start every search session fresh — reopening shouldn't show stale results
  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNews = query
    ? news.filter(
        (n) =>
          n.title.toLowerCase().includes(query.toLowerCase()) ||
          n.summary.toLowerCase().includes(query.toLowerCase()) ||
          n.department.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const filteredContacts = query
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.nameEn.toLowerCase().includes(query.toLowerCase()) ||
          c.extension.includes(query) ||
          c.department.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const filteredDocs = query
    ? documents.filter(
        (d) =>
          d.title.toLowerCase().includes(query.toLowerCase()) ||
          d.department.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const filteredRooms = query
    ? rooms.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.code.toLowerCase().includes(query.toLowerCase()) ||
          r.floor.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const totalResults =
    filteredNews.length +
    filteredContacts.length +
    filteredDocs.length +
    filteredRooms.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-amber-500 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search phone extension, staff name, BOT news, meeting room, policy..."
            className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-500 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {!query && (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <p>Type to instantly search all KB J Capital resources...</p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuery('1301')}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer text-[11px] text-slate-600 transition"
                >
                  Ext. 1301 (IT)
                </button>
                <button
                  type="button"
                  onClick={() => setQuery('ห้องประชุม')}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer text-[11px] text-slate-600 transition"
                >
                  แผนผังห้องประชุม
                </button>
                <button
                  type="button"
                  onClick={() => setQuery('เครดิตบูโร')}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer text-[11px] text-slate-600 transition"
                >
                  NCB เครดิตบูโร
                </button>
                <button
                  type="button"
                  onClick={() => setQuery('PDPA')}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer text-[11px] text-slate-600 transition"
                >
                  PDPA Regulations
                </button>
              </div>
            </div>
          )}

          {query && totalResults === 0 && (
            <div className="py-8 text-center text-slate-400">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Directory Contacts */}
          {filteredContacts.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="font-bold text-[10px] uppercase text-slate-400 px-2">
                Phone Directory Contacts ({filteredContacts.length})
              </h5>
              {filteredContacts.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onNavigateToSection('directory');
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigateToSection('directory');
                      onClose();
                    }
                  }}
                  className="p-2.5 rounded-lg hover:bg-amber-50/70 focus-visible:bg-amber-50/70 focus:outline-none flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-amber-100 text-amber-800">
                      <PhoneCall className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">
                        {c.name} <span className="font-normal text-slate-400">({c.nameEn})</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {c.position} • {c.department}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-amber-600">
                    Ext. {c.extension}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* News & Announcements */}
          {filteredNews.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="font-bold text-[10px] uppercase text-slate-400 px-2">
                News & Announcements ({filteredNews.length})
              </h5>
              {filteredNews.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectArticle(n);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectArticle(n);
                      onClose();
                    }
                  }}
                  className="p-2.5 rounded-lg hover:bg-slate-50 focus-visible:bg-slate-50 focus:outline-none flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                      <Newspaper className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 line-clamp-1">{n.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {n.department} • {n.publishedAt}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                </div>
              ))}
            </div>
          )}

          {/* Documents & Forms */}
          {filteredDocs.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="font-bold text-[10px] uppercase text-slate-400 px-2">
                Policies & Forms ({filteredDocs.length})
              </h5>
              {filteredDocs.map((d) => (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectDocument(d);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectDocument(d);
                      onClose();
                    }
                  }}
                  className="p-2.5 rounded-lg hover:bg-slate-50 focus-visible:bg-slate-50 focus:outline-none flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{d.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {d.department} • {d.version}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-slate-400">{d.fileSize}</span>
                </div>
              ))}
            </div>
          )}

          {/* Meeting Rooms */}
          {filteredRooms.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="font-bold text-[10px] uppercase text-slate-400 px-2">
                Meeting Rooms ({filteredRooms.length})
              </h5>
              {filteredRooms.map((r) => (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onNavigateToSection('rooms');
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNavigateToSection('rooms');
                      onClose();
                    }
                  }}
                  className="p-2.5 rounded-lg hover:bg-slate-50 focus-visible:bg-slate-50 focus:outline-none flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-blue-100 text-blue-800">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{r.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {r.floor} • Capacity: {r.capacity} seats
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.status === 'available'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-right text-[11px] text-slate-400">
          Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">ESC</kbd> to close
        </div>
      </div>
    </div>
  );
};
