import React, { useState } from 'react';
import { NewsItem } from '../types';
import {
  Landmark,
  FileSpreadsheet,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  CheckCircle2,
  FileText,
  ArrowRight,
  Scale
} from 'lucide-react';

interface RegulatoryHubProps {
  news: NewsItem[];
  onSelectArticle: (article: NewsItem) => void;
}

export const RegulatoryHub: React.FC<RegulatoryHubProps> = ({ news, onSelectArticle }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'bot' | 'ncb' | 'pdpa'>('all');
  const [botPage, setBotPage] = useState(0);
  const [ncbPage, setNcbPage] = useState(0);

  const ncbItems = news.filter((n) => n.category === 'ncb-news');
  const botItems = news.filter((n) => n.category === 'bot-news');
  const pdpaItems = news.filter((n) => n.category === 'regulation');

  const ITEMS_PER_PAGE = 3;
  const pagedNcb = ncbItems.slice(ncbPage * ITEMS_PER_PAGE, (ncbPage + 1) * ITEMS_PER_PAGE);
  const pagedBot = botItems.slice(botPage * ITEMS_PER_PAGE, (botPage + 1) * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#F97316] rounded-full" />
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Regulatory & Compliance Directives</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200">
                BOT • NCB • AMLO
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ศูนย์รวมกฎเกณฑ์ ประกาศธนาคารแห่งประเทศไทย และข้อมูลเครดิตบูโรเพื่อการปฏิบัติงานตามกฎหมาย
            </p>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center p-1 bg-orange-50/70 border border-orange-200/70 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            All Authorities
          </button>
          <button
            onClick={() => setActiveTab('ncb')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'ncb'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            NCB Updates
          </button>
          <button
            onClick={() => setActiveTab('bot')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'bot'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            BOT Directives
          </button>
          <button
            onClick={() => setActiveTab('pdpa')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'pdpa'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            PDPA & Legal
          </button>
        </div>
      </div>

      {/* Main Grid: 3 Clean FinTech Regulatory Columns (No tacky gradients) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Column 1: NCB News (National Credit Bureau) */}
        {(activeTab === 'all' || activeTab === 'ncb') && (
          <div className="flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Clean Tonal Header */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 text-[#EA580C] flex items-center justify-center font-bold text-xs">
                  NCB
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">
                    National Credit Bureau
                  </h4>
                  <span className="text-[10px] text-slate-400">เครดิตบูโร</span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                {ncbItems.length} circulars
              </span>
            </div>

            {/* List */}
            <div className="p-3 divide-y divide-slate-100 flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                {pagedNcb.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectArticle(item)}
                    className="p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 mb-1">
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {item.publishedAt}
                      </span>
                      {item.syncToExternal && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          Synced
                        </span>
                      )}
                    </div>
                    <h5 className="text-xs font-semibold text-slate-900 group-hover:text-[#F97316] transition-colors line-clamp-2 leading-snug">
                      {item.title}
                    </h5>
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px]">
                  Page {ncbPage + 1} of {Math.ceil(ncbItems.length / ITEMS_PER_PAGE) || 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={ncbPage === 0}
                    onClick={() => setNcbPage((p) => Math.max(0, p - 1))}
                    className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={(ncbPage + 1) * ITEMS_PER_PAGE >= ncbItems.length}
                    onClick={() => setNcbPage((p) => p + 1)}
                    className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Column 2: BOT Directives (Bank of Thailand) */}
        {(activeTab === 'all' || activeTab === 'bot') && (
          <div className="flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Clean Tonal Header */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  BOT
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">
                    Bank of Thailand
                  </h4>
                  <span className="text-[10px] text-slate-400">ธนาคารแห่งประเทศไทย</span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                {botItems.length} directives
              </span>
            </div>

            {/* List */}
            <div className="p-3 divide-y divide-slate-100 flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                {pagedBot.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectArticle(item)}
                    className="p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 mb-1">
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {item.publishedAt}
                      </span>
                      {item.syncToExternal && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          Synced
                        </span>
                      )}
                    </div>
                    <h5 className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2 leading-snug">
                      {item.title}
                    </h5>
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="text-[11px]">
                  Page {botPage + 1} of {Math.ceil(botItems.length / ITEMS_PER_PAGE) || 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={botPage === 0}
                    onClick={() => setBotPage((p) => Math.max(0, p - 1))}
                    className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={(botPage + 1) * ITEMS_PER_PAGE >= botItems.length}
                    onClick={() => setBotPage((p) => p + 1)}
                    className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Column 3: PDPA & Legal Regulations */}
        {(activeTab === 'all' || activeTab === 'pdpa') && (
          <div className="flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Clean Tonal Header */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  <Scale className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">
                    PDPA & Legal Compliance
                  </h4>
                  <span className="text-[10px] text-slate-400">คุ้มครองข้อมูลส่วนบุคคล</span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
                Active Audit
              </span>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                {pdpaItems.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectArticle(item)}
                    className="p-3 rounded-xl border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {item.badge || 'PDPA UPDATE'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.publishedAt}</span>
                    </div>

                    <h5 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">
                      {item.title}
                    </h5>

                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                      {item.summary}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors">
                      <span>อ่านประกาศฉบับเต็ม</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <p className="text-[11px] text-slate-700 font-semibold">
                  แก้ไขอัตราดอกเบี้ยตามประมวลกฎหมายแพ่งและพาณิชย์
                </p>
                <span className="text-[10px] text-slate-400">
                  มีผลบังคับใช้ตามเกณฑ์ ธนาคารแห่งประเทศไทย
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
