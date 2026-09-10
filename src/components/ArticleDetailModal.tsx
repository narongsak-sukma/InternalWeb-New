import React, { useEffect } from 'react';
import { NewsItem, PolicyDocument } from '../types';
import {
  X,
  Calendar,
  Eye,
  Building,
  User,
  CheckCircle2,
  Globe,
  Share2,
  Printer,
  Download,
  ShieldCheck,
  FileText
} from 'lucide-react';

interface ArticleDetailModalProps {
  article: NewsItem | null;
  document: PolicyDocument | null;
  onClose: () => void;
}

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  article,
  document,
  onClose,
}) => {
  const isOpen = Boolean(article || document);

  // Escape closes the modal — keyboard parity with the X / Close buttons
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!article && !document) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative min-h-full flex items-center justify-center p-4">
        {/* Dedicated backdrop layer — any click on the dimmed area closes the
            modal unconditionally; the card above it stops that from ever
            firing for content clicks. Replaces the e.target === e.currentTarget
            check, which E2E clicks on the overlay never satisfied (B7). */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {article ? (
                <>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wide bg-amber-500 text-slate-950">
                    {article.badge || article.categoryLabel}
                  </span>
                  {article.syncToExternal && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Synced to www.kbjcapital.co.th
                    </span>
                  )}
                </>
              ) : (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wide bg-[#F97316] text-white">
                  {document?.category.toUpperCase()}
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
              {article ? article.title : document?.title}
            </h3>

            {(article?.titleEn || document?.titleEn) && (
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {article?.titleEn || document?.titleEn}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            autoFocus
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>{article?.publishedAt || document?.updatedAt}</span>
            </span>

            <span className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>{article?.department || document?.department}</span>
            </span>

            {article && (
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>{article.views} views</span>
              </span>
            )}

            {document && (
              <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                {document.version} • {document.fileSize}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              title="Print document"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-sm text-slate-700 leading-relaxed">
          {/* Article Image Banner */}
          {article?.imageUrl && (
            <div className="rounded-2xl overflow-hidden max-h-72 w-full border border-slate-100 shadow-xs">
              <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Article Summary Quote */}
          {article && (
            <div className="p-4 rounded-xl bg-amber-50/70 border-l-4 border-amber-500 text-xs sm:text-sm text-slate-800 font-medium">
              {article.summary}
            </div>
          )}

          {/* Article Detailed Content */}
          {article && (
            <div className="prose prose-slate max-w-none text-xs sm:text-sm space-y-4 whitespace-pre-line leading-relaxed">
              {article.content}
            </div>
          )}

          {/* Document Preview Details */}
          {document && (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">{document.title}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Department: {document.department} • Revision: {document.version}
                </p>
              </div>

              <a
                href={document.downloadUrl}
                onClick={(e) => {
                  e.preventDefault();
                  alert(`Starting download for: ${document.title} (${document.fileSize})`);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition"
              >
                <Download className="w-4 h-4" />
                <span>Download Official Form / Policy PDF</span>
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            KB J Capital Corporate Communication Portal
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
