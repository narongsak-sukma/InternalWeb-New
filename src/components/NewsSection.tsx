import React, { useState } from 'react';
import { NewsItem } from '../types';
import {
  BellRing,
  ExternalLink,
  Eye,
  Calendar,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  ChevronRight
} from 'lucide-react';

interface NewsSectionProps {
  news: NewsItem[];
  onSelectArticle: (article: NewsItem) => void;
  onViewAllNews?: () => void;
}

export const NewsSection: React.FC<NewsSectionProps> = ({
  news,
  onSelectArticle,
  onViewAllNews,
}) => {
  // Filter for KB J News, finance literacy and lifestyle articles
  const kbjNews = news.filter(
    (n) =>
      n.category === 'kbj-news' ||
      n.category === 'all-about-money' ||
      n.category === 'lifestyle'
  );
  const alertNews = kbjNews.find((n) => n.isImportantAlert) || kbjNews[0];
  const otherKbjNews = kbjNews.filter((n) => n.id !== alertNews?.id);

  return (
    <div className="space-y-6">
      {/* Section Header with "ดูทั้งหมด →" pill from design.png */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#F97316] rounded-full" />
          <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>ข่าวสาร และบทความ</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 text-[#EA580C] font-semibold">
              News & Articles
            </span>
          </h3>
        </div>

        {onViewAllNews && (
          <button
            onClick={onViewAllNews}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-orange-300 hover:border-orange-400 bg-white hover:bg-orange-50/70 text-[#F97316] text-xs font-semibold transition"
          >
            <span>ดูทั้งหมด</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Featured Urgent Alert Card (From As-Is: "New Alert แผนผังห้องประชุมใหม่ทั้งหมด") */}
      {alertNews && (
        <div
          id="featured-alert-card"
          role="button"
          tabIndex={0}
          onClick={() => onSelectArticle(alertNews)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectArticle(alertNews);
            }
          }}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 hover:border-orange-300 focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-amber-400/50 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300"
        >
          {/* Urgent banner tag */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F97316] text-white text-[11px] font-extrabold uppercase tracking-wider shadow-xs">
                <BellRing className="w-3 h-3" />
                {alertNews.badge || 'CRITICAL ALERT'}
              </span>
              <span className="text-xs font-bold text-slate-700">
                {alertNews.department}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {alertNews.publishedAt}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {alertNews.views} reads
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-8 space-y-2">
              <h4 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-[#F97316] transition-colors leading-snug">
                {alertNews.title}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed">
                {alertNews.summary}
              </p>

              <div className="pt-2 flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F97316] group-hover:translate-x-1 transition-transform">
                  อ่านประกาศและขั้นตอนฉบับเต็ม
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>

                {alertNews.syncToExternal && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Synced to Public Web
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail */}
            {alertNews.imageUrl && (
              <div className="md:col-span-4 overflow-hidden rounded-xl h-40 w-full relative border border-slate-100">
                <img
                  src={alertNews.imageUrl}
                  alt={alertNews.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono rounded">
                  Facility Update
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-cards Grid (From As-Is: "New Meeting Rooms", "KB J-E-DMS", "UPDATE NEW LOGO") */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {otherKbjNews.length === 0 && !alertNews && (
          <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white/60">
            <p className="text-sm font-bold text-slate-600">ยังไม่มีข่าวสารในขณะนี้</p>
            <p className="text-xs text-slate-400 mt-1">
              No news or articles have been published yet — please check back later.
            </p>
          </div>
        )}
        {otherKbjNews.map((item) => (
          <div
            key={item.id}
            id={`news-card-${item.id}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectArticle(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectArticle(item);
              }
            }}
            className="group cursor-pointer flex flex-col justify-between bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-orange-300 focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-amber-400/50 transition-all duration-200"
          >
            {/* Image Thumbnail with Overlay Badge */}
            {item.imageUrl && (
              <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2.5 left-2.5">
                  <span
                    className={`px-3 py-0.5 rounded-full text-[11px] font-bold shadow-xs backdrop-blur-xs ${
                      item.badge?.includes('Money')
                        ? 'bg-amber-100/90 text-amber-900 border border-amber-300/60'
                        : item.badge?.includes('Lifestyle')
                        ? 'bg-orange-100/90 text-[#EA580C] border border-orange-300/60'
                        : item.badge === 'News' || item.badge?.includes('ALERT')
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/90 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {item.badge || 'News'}
                  </span>
                </div>

                {item.syncToExternal && (
                  <span
                    className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/95 backdrop-blur-xs text-emerald-700 shadow-2xs flex items-center gap-1 border border-emerald-200"
                    title="This article is published on both Intranet and Public Website"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                    Public
                  </span>
                )}
              </div>
            )}

            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-2">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{item.publishedAt}</span>
                  {item.readTime && (
                    <>
                      <span>•</span>
                      <span>{item.readTime}</span>
                    </>
                  )}
                </div>

                <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#F97316] transition-colors line-clamp-2 leading-snug mb-2">
                  {item.title}
                </h4>

                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Eye className="w-3 h-3" />
                  {item.views} reads
                </span>

                <div className="flex items-center gap-1.5 text-[#F97316] font-bold text-xs group-hover:text-[#EA580C] transition-colors">
                  <span>อ่านต่อ</span>
                  <div className="w-5 h-5 rounded-full border border-orange-300 flex items-center justify-center group-hover:bg-[#F97316] group-hover:text-white group-hover:border-[#F97316] transition-all">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
