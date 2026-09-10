import React, { useState } from 'react';
import { PolicyDocument } from '../types';
import {
  FileText,
  Download,
  ShieldCheck,
  Building2,
  Users2,
  BookOpen,
  Search,
  CheckCircle2,
  FileCode,
  ArrowDownToLine,
  ExternalLink,
  Eye,
  Filter
} from 'lucide-react';

interface GovernanceAndPoliciesProps {
  documents: PolicyDocument[];
  onOpenDocument: (doc: PolicyDocument) => void;
}

export const GovernanceAndPolicies: React.FC<GovernanceAndPoliciesProps> = ({
  documents,
  onOpenDocument,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'governance' | 'policy' | 'work-rules' | 'form' | 'handbook'
  >('all');
  const [docSearch, setDocSearch] = useState('');

  const filteredDocs = documents.filter((doc) => {
    const matchesCat = activeCategory === 'all' || doc.category === activeCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(docSearch.toLowerCase()) ||
      doc.titleEn.toLowerCase().includes(docSearch.toLowerCase()) ||
      doc.department.toLowerCase().includes(docSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getFormatBadge = (doc: PolicyDocument) => {
    if (doc.category === 'form') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
          FORM
        </span>
      );
    }
    if (doc.category === 'handbook') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
          DOCX
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
        PDF
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-6 bg-[#F97316] rounded-full" />
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Corporate Governance, Policies & Official Repository</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ข้อมูลบริษัท วิสัยทัศน์ จรรยาบรรณ นโยบาย ข้อบังคับการทำงาน และแบบฟอร์มเอกสารรับรอง พ.ศ. 2568 - 2569
            </p>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-orange-50/70 border border-orange-200/70 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            All Files ({documents.length})
          </button>
          <button
            onClick={() => setActiveCategory('governance')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeCategory === 'governance'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            Governance
          </button>
          <button
            onClick={() => setActiveCategory('policy')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeCategory === 'policy'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            Policies
          </button>
          <button
            onClick={() => setActiveCategory('work-rules')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeCategory === 'work-rules'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            Work Rules
          </button>
          <button
            onClick={() => setActiveCategory('form')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeCategory === 'form'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            Official Forms
          </button>
          <button
            onClick={() => setActiveCategory('handbook')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeCategory === 'handbook'
                ? 'bg-[#F97316] text-white shadow-xs font-bold'
                : 'text-stone-600 hover:text-[#EA580C] hover:bg-white/80'
            }`}
          >
            Handbook
          </button>
        </div>
      </div>

      {/* Executive Governance Charter Bar - Warm Corporate Tone */}
      <div className="bg-gradient-to-br from-[#FFF9F3] via-white to-[#FFF4EA] text-stone-800 rounded-2xl p-6 shadow-xs border border-orange-200/90">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-orange-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-orange-100 text-orange-900 font-bold border border-orange-200">
                Corporate Governance Framework
              </span>
              <span className="text-[11px] text-stone-500">KB J Capital Co., Ltd.</span>
            </div>
            <h4 className="text-lg font-bold text-stone-900 tracking-tight">
              กรอบการกำกับดูแลกิจการที่ดี และจรรยาบรรณธุรกิจสากล
            </h4>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-600">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50/90 border border-orange-200/80 font-medium text-stone-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>BOT & NCB Inspected</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50/90 border border-orange-200/80 font-medium text-stone-700">
              <ShieldCheck className="w-3.5 h-3.5 text-[#F97316]" />
              <span>ISO/IEC 27001 Certified</span>
            </span>
          </div>
        </div>

        {/* 3 Executive Pillars in a unified corporate layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          <div className="space-y-2 md:pr-4 md:border-r md:border-orange-100">
            <div className="flex items-center gap-2 text-[#EA580C]">
              <Building2 className="w-4 h-4 text-[#F97316]" />
              <h5 className="text-xs font-bold uppercase tracking-wider">
                1. วิสัยทัศน์พันธมิตรระดับสากล
              </h5>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              การผสานพลังระหว่าง <strong>KB Financial Group</strong> สถาบันการเงินชั้นนำจากเกาหลีใต้ และ <strong>Jaymart Group</strong> เพื่อยกระดับสินเชื่อดิจิทัลที่เข้าถึงง่าย โปร่งใส และสร้างสรรค์
            </p>
          </div>

          <div className="space-y-2 md:pr-4 md:border-r md:border-orange-100">
            <div className="flex items-center gap-2 text-[#EA580C]">
              <Users2 className="w-4 h-4 text-[#F97316]" />
              <h5 className="text-xs font-bold uppercase tracking-wider">
                2. คณะกรรมการและการถ่วงดุล
              </h5>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              โครงสร้างคณะกรรมการบริหาร (Board of Directors) คณะกรรมการตรวจสอบ และการบริหารความเสี่ยงแบบสองชั้นตามมาตรฐานสากลเพื่อการดำเนินงานที่มีเสถียรภาพสูงสุด
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#EA580C]">
              <ShieldCheck className="w-4 h-4 text-[#F97316]" />
              <h5 className="text-xs font-bold uppercase tracking-wider">
                3. จรรยาบรรณและต่อต้านการทุจริต
              </h5>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              นโยบาย Zero-Tolerance ต่อการทุจริตคอร์รัปชัน การคุ้มครองข้อมูลส่วนบุคคล (PDPA) อย่างเคร่งครัด และการเปิดช่องทาง Whistleblowing อย่างเป็นความลับตลอด 24 ชั่วโมง
            </p>
          </div>
        </div>
      </div>

      {/* Document & Forms Management Table / Repository (Google Drive / Workspace Style) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Repository Toolbar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              placeholder="Search document title, form code, or issuing department..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Showing <strong>{filteredDocs.length}</strong> official documents</span>
          </div>
        </div>

        {/* Document Items List */}
        <div className="divide-y divide-slate-100">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              {/* Document Identity */}
              <div className="flex items-start gap-3.5">
                <div className="shrink-0 mt-0.5">
                  {getFormatBadge(doc)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h5
                      onClick={() => onOpenDocument(doc)}
                      className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#F97316] transition-colors cursor-pointer"
                    >
                      {doc.title}
                    </h5>

                    {doc.isNew && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-[#EA580C] border border-orange-200">
                        NEW
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium">
                    {doc.titleEn}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-0.5">
                    <span className="font-semibold text-slate-600">Dept: {doc.department}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-600">{doc.version}</span>
                    <span>•</span>
                    <span>Updated: {doc.updatedAt}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-500">{doc.fileSize}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <button
                  onClick={() => onOpenDocument(doc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => onOpenDocument(doc)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5 text-white" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ))}

          {filteredDocs.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-xs">
              No documents matched your search filter. Try clearing your query.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
