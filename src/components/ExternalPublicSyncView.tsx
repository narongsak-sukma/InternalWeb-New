import React, { useState } from 'react';
import { NewsItem } from '../types';
import { BrandLogo } from './BrandLogo';
import {
  Globe,
  CheckCircle2,
  Calendar,
  Eye,
  ShieldCheck,
  CreditCard,
  Phone,
  Mail,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Search,
  Download,
  Smartphone,
  Check,
  Star,
  Play,
  QrCode,
  Tag,
  Gift,
  HelpCircle,
  Clock,
  Layers
} from 'lucide-react';

interface ExternalPublicSyncViewProps {
  syncedNews: NewsItem[];
  onOpenArticle: (article: NewsItem) => void;
  onSwitchToCMS: () => void;
}

export const ExternalPublicSyncView: React.FC<ExternalPublicSyncViewProps> = ({
  syncedNews,
  onOpenArticle,
  onSwitchToCMS,
}) => {
  const [activePublicTab, setActivePublicTab] = useState<string>('all');
  const [publicSearch, setPublicSearch] = useState('');
  const [activeFaqIndex, setActiveFaqIndex] = useState<number>(0);

  const publicNews = syncedNews.filter((n) => n.syncToExternal);

  const filteredPublicNews = publicNews.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(publicSearch.toLowerCase()) ||
      item.summary.toLowerCase().includes(publicSearch.toLowerCase());
    if (activePublicTab === 'all') return matchesSearch;
    if (activePublicTab === 'news') return matchesSearch && (item.category === 'kbj-news' || item.categoryLabel === 'News');
    if (activePublicTab === 'money') return matchesSearch && (item.category === 'all-about-money' || item.badge?.includes('Money'));
    if (activePublicTab === 'compliance') return matchesSearch && (item.category === 'bot-news' || item.category === 'ncb-news' || item.category === 'regulation');
    if (activePublicTab === 'lifestyle') return matchesSearch && (item.category === 'lifestyle' || item.badge?.includes('Lifestyle'));
    return matchesSearch;
  });

  const tipsList = [
    { type: 'วิธีใช้', title: 'บัตรกดเงินสดแคชจอย อีซี่ มีข้อดียังไง มาดูกัน!', desc: 'วงเงินหมุนเวียนพร้อมใช้ ไม่ใช้ไม่เสียดอกเบี้ย สมัครง่ายผ่านแอป' },
    { type: 'คำถาม', title: "เจอ 'เพจปลอมแคชจอย' ต้องทำตามนี้!", desc: 'วิธีสังเกตบัญชีทางการและข้อควรระวังก่อนโอนเงินหรือสมัครสินเชื่อ' },
    { type: 'วิธีใช้', title: 'สมัครสินเชื่อได้ทุกที่ ทุกเวลา ด้วย Kashjoy easy App', desc: 'ขั้นตอนยืนยันตัวตนรูปแบบดิจิทัล (NDID) สะดวกรวดเร็วใน 5 นาที' },
    { type: 'วิธีใช้', title: 'บริการกดเงินสดได้ โดยไม่ต้องมีบัตร ผ่านแอป', desc: 'สแกนรับเงินสดผ่านตู้ ATM พันธมิตรทั่วประเทศ ไม่มีค่าธรรมเนียมเพิ่มเติม' },
    { type: 'คำถาม', title: 'เหตุผลที่จะทำให้สมัครสินเชื่อจ่ายเงิน!', desc: 'เตรียมเอกสารรายได้และประวัติเครดิตให้พร้อมเพื่อการอนุมัติที่ราบรื่น' },
    { type: 'คำถาม', title: 'ชำระเงินตรงเวลาดีอย่างไร?', desc: 'สร้างประวัติทางการเงินที่ดีกับเครดิตบูโร และรับสิทธิ์เพิ่มวงเงินในอนาคต' },
  ];

  return (
    <div className="space-y-6">
      {/* Live Sync Handshake Diagnostic Banner - Warm Corporate Tone */}
      <div className="bg-gradient-to-r from-[#FFF8F0] via-[#FFFDF9] to-[#FFF3E8] text-stone-800 p-5 rounded-2xl shadow-sm border border-orange-200/90">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#F97316] border border-orange-200 flex items-center justify-center shrink-0 shadow-2xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                  Live External Website Simulator: www.kbjcapital.co.th
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Synced Real-Time
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                จำลองหน้าต่างเว็บไซต์ทางการของ เคบี เจ แคปปิตอล และผลิตภัณฑ์ Kashjoy ข้อมูลที่เผยแพร่ผ่านระบบ CMS จะแสดงผลที่นี่ทันที
              </p>
            </div>
          </div>

          <button
            onClick={onSwitchToCMS}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs shadow-md transition shrink-0 cursor-pointer"
          >
            <span>จัดการเนื้อหาใน CMS Admin</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Simulated Corporate Public Website Container */}
      <div className="bg-[#FFFDF9] rounded-2xl shadow-xl border border-amber-100 overflow-hidden text-slate-800">
        {/* Browser Mockup Chrome Bar */}
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
          </div>

          {/* URL bar */}
          <div className="flex-1 max-w-xl mx-auto flex items-center justify-center gap-2 bg-white px-4 py-1 rounded-md border border-slate-200 text-xs font-mono text-slate-600 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-700 font-bold">https://</span>
            <span className="font-semibold text-slate-800">www.kbjcapital.co.th</span>
          </div>

          <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
            Official Portal
          </div>
        </div>

        {/* 1. Public Header (Matching design.png) */}
        <header className="bg-white px-6 py-3.5 border-b border-slate-100 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-8">
            <BrandLogo size="md" showSubtitle={false} />

            {/* Main Navigation Links */}
            <nav className="hidden xl:flex items-center gap-6 text-[13px] font-semibold text-slate-700">
              <a href="#cashcard" className="hover:text-[#F97316] transition">บัตรกดเงินสด</a>
              <a href="#promotions" className="hover:text-[#F97316] transition">โปรโมชั่น</a>
              <a href="#service" className="hover:text-[#F97316] transition">บริการลูกค้า</a>
              <a href="#branches" className="hover:text-[#F97316] transition">จุดบริการใกล้ฉัน</a>
              <a href="#news" className="text-[#F97316] font-bold border-b-2 border-[#F97316] pb-1">บทความและข่าว</a>
              <a href="#about" className="hover:text-[#F97316] transition">เกี่ยวกับ KB J</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Search icon */}
            <button
              aria-label="Search"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-[#F97316] hover:bg-slate-50 transition"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Hotline 1258 Signature Pill (from design.png top right) */}
            <a
              href="tel:1258"
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-[#F97316] text-slate-950 font-black text-xs shadow-xs hover:brightness-105 transition-all border border-amber-300"
            >
              <Phone className="w-3.5 h-3.5 fill-slate-950" />
              <span>1258</span>
            </a>

            {/* Apply Button */}
            <button className="hidden sm:inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-orange-300 hover:border-orange-500 text-[#F97316] hover:bg-orange-50 font-bold text-xs transition">
              สมัครเลย
            </button>
          </div>
        </header>

        {/* 2. Hero Section (Matching design.png) */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#FFFBEB] via-[#FFF7ED] to-[#FEF3C7] px-6 sm:px-12 py-10 lg:py-16 border-b border-amber-100">
          {/* Subtle Ambient Radial Glows */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-100/90 border border-orange-200 text-[#EA580C] text-xs font-bold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>สมัครสินเชื่อเงินด่วน</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                เรื่องเงินจบไว <br />
                <span className="text-[#F97316]">ไว้ใจ KASHJOY !</span>
              </h1>

              <p className="text-sm sm:text-base text-slate-700 leading-relaxed max-w-xl font-normal">
                ผู้ให้บริการสินเชื่อส่วนบุคคลจากประเทศเกาหลีใต้ ภายใต้การกำกับของธนาคารแห่งประเทศไทย
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button className="flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] text-white font-bold text-sm shadow-md hover:shadow-orange-500/30 transition-all transform active:scale-95 cursor-pointer">
                  <span>สมัครสินเชื่อ</span>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <ArrowRight className="w-3 h-3 text-white" />
                  </div>
                </button>
              </div>
            </div>

            {/* Right Showcase: Mobile App Mockup & Mascot Elements */}
            <div className="lg:col-span-5 flex justify-center relative">
              <div className="relative w-full max-w-sm">
                {/* Floating "วงเงินพร้อมใช้ สูงสุด 5 เท่า" badge */}
                <div className="absolute -top-4 -left-4 sm:-left-8 z-20 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-amber-200">
                  <p className="text-[11px] font-bold text-slate-500">วงเงินพร้อมใช้</p>
                  <p className="text-xl sm:text-2xl font-black text-[#F97316]">สูงสุด 5 เท่า*</p>
                </div>

                {/* Floating "สมัครง่าย! อนุมัติไว!" badge */}
                <div className="absolute -bottom-2 -right-2 sm:-right-6 z-20 bg-gradient-to-r from-amber-400 to-[#F97316] text-white px-4 py-2 rounded-2xl shadow-lg">
                  <p className="text-xs font-black tracking-wide">สมัครง่าย! อนุมัติไว!</p>
                </div>

                {/* Smartphone Mockup */}
                <div className="relative mx-auto rounded-[36px] bg-slate-900 p-3 shadow-2xl border-4 border-amber-200 max-w-[260px]">
                  <div className="rounded-[28px] overflow-hidden bg-gradient-to-b from-amber-50 to-orange-50 p-4 border border-amber-200">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-3">
                      <span>9:41</span>
                      <div className="flex gap-1">
                        <span>●●●</span>
                      </div>
                    </div>

                    <div className="text-center py-3 bg-gradient-to-r from-amber-300 to-orange-400 rounded-2xl text-slate-900 shadow-sm mb-3">
                      <p className="text-[10px] font-bold">บัตรกดเงินสด</p>
                      <p className="text-lg font-black">Kashjoy Easy</p>
                      <p className="text-[10px] opacity-80">1234 5678 9101 1234</p>
                    </div>

                    <div className="bg-white rounded-xl p-2.5 shadow-2xs border border-orange-100 text-center mb-2">
                      <p className="text-[11px] font-bold text-[#EA580C]">โอน ถอน สแกนจ่าย</p>
                      <p className="text-[10px] text-slate-500">ครบจบในแอปเดียว</p>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[9px] text-center text-slate-600">
                      <div className="p-1.5 bg-orange-100/70 rounded-lg">โอนเงิน</div>
                      <div className="p-1.5 bg-amber-100/70 rounded-lg">ถอนสด</div>
                      <div className="p-1.5 bg-orange-100/70 rounded-lg">สแกน</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Footnote */}
          <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-amber-200/60 text-center text-[11px] text-slate-500">
            *อัตราดอกเบี้ย 25% ต่อปี (แบบลดต้นลดดอก) | กู้เท่าที่จำเป็นและชำระคืนไหว
          </div>
        </section>

        {/* 3. Partner / Ecosystem Logos Bar */}
        <section className="bg-white py-5 px-6 border-b border-slate-100">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-around gap-6 text-slate-400 text-sm font-extrabold tracking-wider">
            <span className="hover:text-slate-800 transition text-base">Jaymart</span>
            <span className="hover:text-slate-800 transition text-base">Pakorn</span>
            <span className="hover:text-slate-800 transition text-base">Power Buy</span>
            <span className="hover:text-slate-800 transition text-base">SAMSUNG</span>
            <span className="hover:text-slate-800 transition text-base">SINGER</span>
          </div>
        </section>

        {/* 4. Product Showcase: Kashjoy Easy Card (From design.png) */}
        <section className="py-12 px-6 sm:px-12 bg-[#FFFDF9] border-b border-amber-100/60">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-orange-100 text-[#EA580C] text-xs font-bold">
                <span>ผลิตภัณฑ์ของเรา</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                บัตรกดเงินสดแคชจอย อีซี่
              </h2>
              <p className="text-sm text-slate-600">
                สมัครง่าย ตอบโจทย์ทุกค่าใช้จ่ายฉุกเฉิน
              </p>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 pt-1">
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>สะดวก ปลอดภัย สมัครผ่าน Kashjoy easy Application</span>
              </div>

              <div className="pt-3 flex flex-wrap items-center gap-3">
                <button className="px-5 py-2.5 rounded-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-xs shadow-sm transition">
                  สมัครผ่านแอป
                </button>
                <button className="px-5 py-2.5 rounded-full border border-slate-300 hover:border-[#F97316] text-slate-700 hover:text-[#F97316] bg-white font-bold text-xs transition">
                  สมัครผ่านเว็บไซต์
                </button>
              </div>
            </div>

            {/* Promotion Card Tag */}
            <div className="lg:col-span-5">
              <div className="p-6 rounded-2xl bg-white border border-orange-200/80 shadow-md flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-[#F97316] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Gift className="w-7 h-7" />
                </div>
                <div>
                  <div className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-orange-100 text-[#EA580C] mb-1">
                    Promotion
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    สมัครตอนนี้มีสิทธิ์รับ กระเป๋าเดินทางแคชจอย ขนาด 20 นิ้ว*
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">เงื่อนไขเป็นไปตามที่บริษัทฯ กำหนด</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Special Promotions Section (Matching design.png "โปรโมชั่นสุดพิเศษ") */}
        <section className="py-12 px-6 sm:px-12 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                โปรโมชั่นสุดพิเศษ
              </h3>
              <button className="flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-orange-300 hover:border-orange-400 text-[#F97316] text-xs font-bold transition">
                <span>ดูทั้งหมด</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Featured Big Promotion Card */}
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50/50 via-white to-amber-50/30 p-6 shadow-sm hover:shadow-md transition grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-4 rounded-xl overflow-hidden bg-slate-900 text-white p-6 text-center">
                <p className="text-xs font-bold text-amber-300">ผ่อนของที่ใช่ ได้ที่ Jaymart</p>
                <p className="text-3xl sm:text-4xl font-black text-white mt-1">0%</p>
                <p className="text-xs text-slate-300">นานสูงสุด 14 เดือน*</p>
              </div>

              <div className="md:col-span-8 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-[#EA580C]">
                    สำหรับบัตร
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    มือถือ
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900">
                  ผ่อนของที่ใช่ ได้ที่ Jaymart ดอกเบี้ย 0% นานสูงสุด 14 เดือน*
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  บัตรกดเงินสดแคชจอย อีซี่ สามารถผ่อนชำระสินค้าได้ที่ร้าน Jaymart ทุกสาขาทั่วประเทศ
                </p>
                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    ตั้งแต่ 9 ก.พ. - 31 ธ.ค. 2569
                  </span>
                  <span className="text-[#F97316] font-bold flex items-center gap-1">
                    อ่านต่อ
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Mini Promotion Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-orange-300 transition flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-[#EA580C]">สำหรับบัตร</span>
                  <h5 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">
                    พิเศษ! สำหรับลูกค้าใหม่สมัครบัตรที่จุดบริการ Kashjoy
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">รับกระเป๋าเดินทางขนาด 20 นิ้ว</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>1 ก.พ. - 31 ส.ค. 2569</span>
                  <span className="text-[#F97316] font-bold">อ่านต่อ →</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-orange-300 transition flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-[#EA580C]">สำหรับบัตร</span>
                  <h5 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">
                    อร่อยไม่อั้นกับสุกี้ตี๋น้อย สมัครสินเชื่อและได้รับการอนุมัติ...
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">รับบัตรรับประทานสุกี้ตี๋น้อยฟรี</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>1 ก.พ. - 30 ก.ย. 2569</span>
                  <span className="text-[#F97316] font-bold">อ่านต่อ →</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-orange-300 transition flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">สำหรับสมาชิก</span>
                  <h5 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">
                    Kashjoy Point Fun - ถอนเงินรับพอยท์ได้ทุกเดือน
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">รับคะแนน J POINT สะสมสูงสุด 100 คะแนน</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>1 ก.พ. - 30 ก.ย. 2569</span>
                  <span className="text-[#F97316] font-bold">อ่านต่อ →</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-orange-300 transition flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">สำหรับสมาชิก</span>
                  <h5 className="text-xs font-bold text-slate-900 mt-2 line-clamp-2">
                    ถอนต่อเนื่องทุกเดือน...รับเงินคืนสูงสุด 100 บาท/เดือน
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">สิทธิประโยชน์พิเศษสำหรับผู้ถือบัตร</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>1 ก.พ. - 30 ก.ย. 2569</span>
                  <span className="text-[#F97316] font-bold">อ่านต่อ →</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Video & Tips Section (From design.png "เคล็ดลับเด็ด เรื่องเงินจอยจอย") */}
        <section className="py-12 px-6 sm:px-12 bg-gradient-to-b from-[#FFFDF9] to-white border-b border-amber-100/60">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="text-center space-y-1">
              <span className="inline-block text-xs font-bold px-3 py-0.5 rounded-full bg-orange-100 text-[#EA580C]">
                เคล็ดลับเด็ด
              </span>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                เรื่องเงินจอยจอย
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: Vertical Phone Video Player Mockup */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-64 rounded-[32px] overflow-hidden bg-slate-900 border-4 border-amber-200 shadow-xl aspect-9/16 flex flex-col justify-between p-4 text-white">
                  <div className="flex items-center justify-between text-[11px] text-white/80">
                    <span className="font-bold">@kashjoyofficial</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px]">TikTok</span>
                  </div>

                  <div className="text-center my-auto">
                    <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center mx-auto mb-3 cursor-pointer hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                    </div>
                    <p className="text-xs font-bold px-2">บัตรกดเงินสดแคชจอย อีซี่ มีข้อดียังไง?</p>
                    <p className="text-[10px] text-amber-300 mt-1">ดอกเบี้ยลดต้นลดดอก 25% ต่อปี</p>
                  </div>

                  <div className="text-[10px] text-white/70 text-center">
                    #เรื่องเงินจบไวไว้ใจKASHJOY
                  </div>
                </div>
              </div>

              {/* Right: Interactive Q&A list */}
              <div className="lg:col-span-7 space-y-2.5">
                {tipsList.map((tip, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveFaqIndex(idx)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      activeFaqIndex === idx
                        ? 'bg-orange-50/70 border-[#F97316] shadow-xs'
                        : 'bg-white border-slate-200 hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          tip.type === 'วิธีใช้'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {tip.type}
                      </span>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900">{tip.title}</p>
                        {activeFaqIndex === idx && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{tip.desc}</p>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        activeFaqIndex === idx ? 'rotate-90 text-[#F97316]' : ''
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 7. Live Synced News & Articles Section (From design.png "ข่าวสาร และบทความ") */}
        <section id="public-news-section" className="py-12 px-6 sm:px-12 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    ข่าวสาร และบทความ
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-[#EA580C] text-xs font-bold">
                    {filteredPublicNews.length} Synced
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  อัปเดตข้อมูลข่าวสาร สาระการเงิน และประกาศตามเกณฑ์ ธปท. ซิงก์ตรงจากระบบ Intranet CMS
                </p>
              </div>

              <button className="flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-orange-300 hover:border-orange-400 text-[#F97316] text-xs font-bold transition">
                <span>ดูทั้งหมด</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActivePublicTab('all')}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition ${
                  activePublicTab === 'all'
                    ? 'bg-[#F97316] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ทั้งหมด (All)
              </button>
              <button
                onClick={() => setActivePublicTab('news')}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition ${
                  activePublicTab === 'news'
                    ? 'bg-[#F97316] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                News
              </button>
              <button
                onClick={() => setActivePublicTab('money')}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition ${
                  activePublicTab === 'money'
                    ? 'bg-[#F97316] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All About Money
              </button>
              <button
                onClick={() => setActivePublicTab('compliance')}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition ${
                  activePublicTab === 'compliance'
                    ? 'bg-[#F97316] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                BOT & NCB Compliance
              </button>
              <button
                onClick={() => setActivePublicTab('lifestyle')}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition ${
                  activePublicTab === 'lifestyle'
                    ? 'bg-[#F97316] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Lifestyle & Beliefs
              </button>
            </div>

            {/* Grid of Public Synced Articles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredPublicNews.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onOpenArticle(item)}
                  className="group cursor-pointer bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-orange-300 transition-all flex flex-col justify-between"
                >
                  {/* Image */}
                  {item.imageUrl && (
                    <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2.5 left-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs ${
                            item.badge?.includes('Money')
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : item.badge?.includes('Lifestyle')
                              ? 'bg-orange-100 text-[#EA580C] border border-orange-200'
                              : 'bg-orange-500 text-white'
                          }`}
                        >
                          {item.badge || 'News'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{item.publishedAt}</span>
                        {item.readTime && (
                          <>
                            <span>•</span>
                            <span>{item.readTime}</span>
                          </>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#F97316] transition-colors line-clamp-2 leading-snug mb-1.5">
                        {item.title}
                      </h4>

                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {item.summary}
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#F97316]">
                      <span>อ่านต่อ</span>
                      <div className="w-5 h-5 rounded-full border border-orange-300 flex items-center justify-center group-hover:bg-[#F97316] group-hover:text-white transition">
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredPublicNews.length === 0 && (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500">
                  ยังไม่มีบทความที่เปิดการซิงก์ในหมวดหมู่นี้ คุณสามารถไปที่เมนู CMS เพื่อเปิดใช้งานได้ทันที
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 8. App Download Banner Section (From design.png) */}
        <section className="py-12 px-6 sm:px-12 bg-gradient-to-br from-[#FFFBEB] via-[#FFF7ED] to-[#FEF3C7] border-b border-amber-200/60">
          <div className="max-w-7xl mx-auto rounded-3xl bg-white/80 backdrop-blur-md p-8 border border-amber-200/80 shadow-md">
            <div className="text-center max-w-2xl mx-auto space-y-2 mb-6">
              <span className="inline-block text-xs font-bold px-3 py-0.5 rounded-full bg-orange-100 text-[#EA580C]">
                บัตรกดเงินสด แคชจอย อีซี่
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                สมัครได้ทุกที่ อนุมัติไว ใช้ง่ายทุกวัน
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                ดาวน์โหลดได้แล้ววันนี้ <span className="text-[#F97316] font-bold underline cursor-pointer">อ่านเพิ่มเติม</span>
              </p>
            </div>

            {/* 4 Feature Pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mb-6">
              <div className="p-3 bg-white rounded-xl border border-amber-200 text-center shadow-2xs">
                <p className="text-xs font-bold text-slate-800">ยืนยันตัวตน</p>
                <p className="text-[11px] text-[#EA580C] font-semibold">ผ่าน NDID</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-amber-200 text-center shadow-2xs">
                <p className="text-xs font-bold text-slate-800">ชำระค่างวดได้</p>
                <p className="text-[11px] text-[#EA580C] font-semibold">หลายช่องทาง</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-amber-200 text-center shadow-2xs">
                <p className="text-xs font-bold text-slate-800">ถอนเงินได้</p>
                <p className="text-[11px] text-[#EA580C] font-semibold">ไม่ต้องใช้บัตร</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-amber-200 text-center shadow-2xs">
                <p className="text-xs font-bold text-slate-800">ดูใบแจ้งยอดได้</p>
                <p className="text-[11px] text-[#EA580C] font-semibold">ผ่านแอป</p>
              </div>
            </div>

            {/* Store Badges */}
            <div className="flex items-center justify-center gap-3">
              <button className="flex items-center gap-2 px-4.5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-xs transition cursor-pointer">
                <Smartphone className="w-4 h-4 text-white" />
                <span>App Store</span>
              </button>
              <button className="flex items-center gap-2 px-4.5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-xs transition cursor-pointer">
                <Download className="w-4 h-4 text-white" />
                <span>Google Play</span>
              </button>
            </div>
          </div>
        </section>

        {/* 9. Corporate Public Footer (Authentic to design.png & www.kbjcapital.co.th) */}
        <footer className="bg-white text-slate-600 text-xs px-6 sm:px-12 py-10">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-200">
            {/* Left Column: Company Info, Address, Tax ID, Hotline */}
            <div className="md:col-span-4 space-y-3">
              <h5 className="font-bold text-slate-900 text-sm">บริษัท เคบี เจ แคปปิตอล จำกัด</h5>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                89 อาคาร เอไอเอ แคปปิตอล เซ็นเตอร์ ชั้น 3 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพมหานคร 10400
              </p>
              <p className="text-[11px] text-slate-500">
                เลขประจำตัวผู้เสียภาษี <strong>0105554042308</strong>
              </p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>cs@kbjcapital.co.th</span>
              </p>

              {/* Social Icons Strip */}
              <div className="flex items-center gap-2 pt-1 text-slate-500 text-xs">
                <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold hover:bg-orange-100 hover:text-[#F97316] transition cursor-pointer">f</span>
                <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold hover:bg-orange-100 hover:text-[#F97316] transition cursor-pointer">ig</span>
                <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold hover:bg-orange-100 hover:text-[#F97316] transition cursor-pointer">yt</span>
                <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold hover:bg-orange-100 hover:text-[#F97316] transition cursor-pointer">line</span>
                <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold hover:bg-orange-100 hover:text-[#F97316] transition cursor-pointer">tt</span>
              </div>

              {/* Hotline Button */}
              <div className="pt-2">
                <a
                  href="tel:1258"
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-[#F97316] text-slate-950 font-black text-xs shadow-xs border border-amber-300"
                >
                  <Phone className="w-3.5 h-3.5 fill-slate-950" />
                  <span>1258</span>
                </a>
              </div>
            </div>

            {/* Middle Columns: Navigation */}
            <div className="md:col-span-2 space-y-2">
              <h5 className="font-bold text-slate-900 text-xs">บัตรกดเงินสด</h5>
              <ul className="space-y-1.5 text-[11px] text-slate-500">
                <li><a href="#promotions" className="hover:text-[#F97316] transition">โปรโมชั่น</a></li>
                <li><a href="#branches" className="hover:text-[#F97316] transition">จุดบริการใกล้ฉัน</a></li>
                <li><a href="#news" className="hover:text-[#F97316] transition">บทความและข่าว</a></li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2">
              <h5 className="font-bold text-slate-900 text-xs">บริการลูกค้า</h5>
              <ul className="space-y-1.5 text-[11px] text-slate-500">
                <li><a href="#pay" className="hover:text-[#F97316] transition">ช่องทางชำระเงิน</a></li>
                <li><a href="#faq" className="hover:text-[#F97316] transition">คำถามที่พบบ่อย</a></li>
                <li><a href="#rates" className="hover:text-[#F97316] transition">อัตราดอกเบี้ยและค่าธรรมเนียม</a></li>
                <li><a href="#app" className="hover:text-[#F97316] transition">Kashjoy Easy Application</a></li>
                <li><a href="#calculator" className="hover:text-[#F97316] transition">คำนวณสินเชื่อเบื้องต้น</a></li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2">
              <h5 className="font-bold text-slate-900 text-xs">เกี่ยวกับ KB J</h5>
              <ul className="space-y-1.5 text-[11px] text-slate-500 mb-4">
                <li><a href="#about" className="hover:text-[#F97316] transition">ข้อมูลบริษัท</a></li>
                <li><a href="#careers" className="hover:text-[#F97316] transition">ร่วมงานกับเรา</a></li>
              </ul>

              {/* QR Code download box */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 inline-block text-center">
                <p className="text-[10px] font-bold text-slate-700 mb-1.5">ดาวน์โหลดแอป</p>
                <div className="w-20 h-20 bg-white border border-slate-300 rounded-lg p-1.5 mx-auto flex items-center justify-center">
                  <QrCode className="w-full h-full text-slate-900" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Golden / Corporate Orange Strip */}
          <div className="mt-4 pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>Copyright © 2026 kbjcapital.co.th All right reserved</span>
            <div className="flex items-center gap-3">
              <a href="#privacy" className="hover:text-[#F97316] transition">Privacy Policy</a>
              <span>|</span>
              <a href="#cookie" className="hover:text-[#F97316] transition">Cookie Policy</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
