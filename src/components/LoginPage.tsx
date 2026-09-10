import React, { useState, useRef } from 'react';
import { BrandLogo } from './BrandLogo';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  Phone,
  Globe,
  ExternalLink,
  LogIn
} from 'lucide-react';

/**
 * Pure UI login screen for the KB J Capital intranet.
 * All authentication logic lives in the parent — this component only
 * collects credentials, validates them locally, and reports the
 * parent's verdict ({success, error}) back to the user.
 */

export interface LoginResult {
  success: boolean;
  error?: string;
}

interface LoginPageProps {
  onSubmit: (username: string, password: string) => Promise<LoginResult>;
  loading?: boolean;
}

interface FieldErrors {
  username?: string;
  password?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSubmit, loading = false }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const isBusy = loading || busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;

    setServerError(null);

    // Client-side validation — Thai-first, bilingual messages
    const errors: FieldErrors = {};
    if (!username.trim()) {
      errors.username = 'กรุณากรอกชื่อผู้ใช้งาน / Please enter your username';
    }
    if (!password) {
      errors.password = 'กรุณากรอกรหัสผ่าน / Please enter your password';
    }
    setFieldErrors(errors);

    if (errors.username || errors.password) {
      (errors.username ? usernameRef : passwordRef).current?.focus();
      return;
    }

    setBusy(true);
    try {
      const result = await onSubmit(username.trim(), password);
      if (!result.success) {
        setServerError(
          result.error ?? 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้งานและรหัสผ่านอีกครั้ง / Sign-in failed. Please check your credentials and try again.'
        );
        // Never linger on a rejected password — clear it, keep the username
        // so staff can retry quickly.
        setPassword('');
        passwordRef.current?.focus();
      }
    } catch {
      setServerError(
        'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง / Unable to reach the server. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const inputBase = `w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 transition focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
    fieldErrors.username || serverError
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
      : 'border-slate-200 focus:border-orange-300 focus:ring-amber-400/50'
  }`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-800 antialiased">
      {/* Top utility bar — echoes the intranet Header for visual continuity */}
      <div className="bg-[#FFF9F3] text-stone-600 text-xs px-4 py-1.5 border-b border-orange-200/70">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-stone-800 font-semibold tracking-tight text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            KB J Capital Internal Portal 2.0
          </span>
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

      {/* Main stage */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-4xl">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
            {/* Brand / trust panel (full on desktop, condensed on mobile) */}
            <div className="relative hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-[#FFF8F0] via-[#FFFDF9] to-[#FFF3E8] border-r border-orange-200/80 overflow-hidden">
              {/* Oversized KB star watermark */}
              <svg
                className="absolute -right-10 -bottom-12 w-72 h-72 opacity-[0.07] pointer-events-none"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M24 4L28.5 17.5H43L31.5 26L35.5 40L24 31.5L12.5 40L16.5 26L5 17.5H19.5L24 4Z"
                  fill="#F97316"
                />
              </svg>

              <div className="relative">
                <BrandLogo size="lg" />
                <h1 className="mt-8 text-2xl font-black text-stone-900 tracking-tight leading-snug">
                  ยินดีต้อนรับสู่พอร์ทัลพนักงาน
                  <span className="block text-base font-bold text-stone-500 mt-1.5">
                    Welcome to the KB J Capital Employee Portal
                  </span>
                </h1>
                <p className="mt-4 text-sm text-stone-600 leading-relaxed max-w-sm">
                  ศูนย์รวมข่าวสารภายใน สารบัญรายชื่อผู้ติดต่อ แบบฟอร์ม และระบบจัดการเนื้อหา
                  สำหรับพนักงาน KB J Capital ประเทศไทย
                </p>
              </div>

              <div className="relative space-y-3 mt-10">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/80 border border-orange-200/70 shadow-xs">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-stone-800">
                      มาตรฐานความปลอดภัยระดับสถาบันการเงิน
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Financial-grade security for every session
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/80 border border-orange-200/70 shadow-xs">
                  <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-stone-800">
                      การเชื่อมต่อถูกเข้ารหัสและบันทึก Log การเข้าใช้งาน
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Encrypted connection — all activity is monitored and logged
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative flex items-center justify-between mt-10 pt-5 border-t border-orange-200/70">
                <span className="text-[11px] text-stone-500 font-medium">
                  Sindhorn Tower, Bangkok
                </span>
                <a
                  href="tel:1258"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-[#F97316] text-slate-950 font-black text-xs shadow-xs border border-amber-300 hover:brightness-105 transition select-none"
                  title="KB J Capital Hotline 1258"
                >
                  <Phone className="w-3.5 h-3.5 fill-slate-950" />
                  <span className="tracking-wide">1258</span>
                </a>
              </div>
            </div>

            {/* Sign-in form */}
            <div className="p-6 sm:p-10">
              {/* Condensed brand header for mobile */}
              <div className="lg:hidden mb-8 flex flex-col items-start gap-3">
                <BrandLogo size="md" />
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  เข้าสู่ระบบพนักงาน
                  <span className="block text-sm font-bold text-slate-500 mt-1">
                    Employee Portal Sign-in
                  </span>
                </h1>
              </div>

              <div className="hidden lg:block mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[#F97316] text-white flex items-center justify-center shadow-sm mb-4">
                  <LogIn className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  เข้าสู่ระบบ
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Sign in to continue to the intranet
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Username */}
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    ชื่อผู้ใช้งาน <span className="font-medium text-slate-400">/ Username</span>
                  </label>
                  <input
                    ref={usernameRef}
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (fieldErrors.username) {
                        setFieldErrors((prev) => ({ ...prev, username: undefined }));
                      }
                    }}
                    placeholder="เช่น somchai.k หรือรหัสพนักงาน / staff ID"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                    disabled={isBusy}
                    aria-invalid={Boolean(fieldErrors.username)}
                    aria-describedby={fieldErrors.username ? 'login-username-error' : undefined}
                    className={inputBase}
                  />
                  {fieldErrors.username && (
                    <p
                      id="login-username-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.username}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    รหัสผ่าน <span className="font-medium text-slate-400">/ Password</span>
                  </label>
                  <div className="relative">
                    <input
                      ref={passwordRef}
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      onKeyUp={(e) => setCapsLockOn(e.getModifierState?.('CapsLock') ?? false)}
                      onBlur={() => setCapsLockOn(false)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={isBusy}
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={
                        fieldErrors.password
                          ? 'login-password-error'
                          : capsLockOn
                            ? 'login-capslock-hint'
                            : undefined
                      }
                      className={`${inputBase} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={isBusy}
                      aria-label={showPassword ? 'ซ่อนรหัสผ่าน / Hide password' : 'แสดงรหัสผ่าน / Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p
                      id="login-password-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.password}
                    </p>
                  )}
                  {capsLockOn && !fieldErrors.password && (
                    <p
                      id="login-capslock-hint"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Caps Lock เปิดอยู่ / Caps Lock is on
                    </p>
                  )}
                </div>

                {/* Server-side verdict / connection errors */}
                {serverError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 leading-relaxed"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{serverError}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#F97316] hover:bg-[#EA580C] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md hover:shadow-orange-500/25 transition-all transform active:scale-[0.99] cursor-pointer"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังตรวจสอบ... / Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>เข้าสู่ระบบ / Sign in</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Help / account recovery — IT Helpdesk is the internal channel */}
                <div className="pt-2 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    ลืมรหัสผ่านหรือไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อ IT Helpdesk กด 1258
                    <span className="block text-slate-400">
                      Trouble signing in? Contact the IT Helpdesk at ext. 1258. For authorized
                      employees only — all sign-in attempts are logged.
                    </span>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-5 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 font-medium">
          <span>
            © 2026 KB J Capital Co., Ltd. — A Member of KB Financial Group &amp; Jaymart
          </span>
          <span>Internal use only / เฉพาะการใช้งานภายในองค์กร</span>
        </div>
      </footer>
    </div>
  );
};
