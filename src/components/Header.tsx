import React, { useState, useEffect } from 'react';
import { FileDown, RotateCcw, CalendarDays, User, LogOut, ShieldCheck, BadgeCheck, Crown, Sparkles, Download, Laptop, Cloud, Check } from 'lucide-react';
import { BurgerKingLogo, TalabatLogo } from './BrandLogos';
import { generateReconciliationPDFBlob } from '../utils/pdfExport';
import { ComparisonRow, ReconciliationSummary, ExcelPaymentSummary, UserAccount, DeviceLicenseInfo } from '../types';
import { ExportModal } from './ExportModal';

interface HeaderProps {
  onReset: () => void;
  hasData: boolean;
  rows?: ComparisonRow[];
  summary?: ReconciliationSummary | null;
  excelFileName?: string;
  excelPayments?: ExcelPaymentSummary;
  onOpenDailyReport?: () => void;
  currentUser?: UserAccount | null;
  onOpenProfile?: () => void;
  onLogout?: () => void;
  licenseInfo?: DeviceLicenseInfo | null;
  onOpenUpgradeModal?: () => void;
  onOpenLoginModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  hasData,
  rows = [],
  summary = null,
  excelFileName,
  excelPayments,
  onOpenDailyReport,
  currentUser,
  onOpenProfile,
  onLogout,
  licenseInfo,
  onOpenUpgradeModal,
  onOpenLoginModal,
}) => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      setIsInstallModalOpen(true);
    }
  };

  const defaultPdfName = `BK_Talabat_Reconciliation_Audit_${new Date().toISOString().slice(0, 10)}`;
  const hasDeficits = summary && summary.grossDeficitTotal > 0;

  return (
    <>
      <header className="bg-white border-b border-orange-100/80 shadow-xs mb-6 sticky top-0 z-30">
        <div className="w-full max-w-[98%] 2xl:max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6 py-3 flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Brand identity */}
          <div className="flex items-center gap-3.5 w-full lg:w-auto justify-between lg:justify-start">
            <div className="flex items-center gap-3">
              <div className="flex items-center -space-x-2.5">
                <BurgerKingLogo size="lg" className="ring-2 ring-white shadow-md z-10" />
                <TalabatLogo size="lg" className="ring-2 ring-white shadow-md z-0" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-[#502314] tracking-tight">
                    BURGER KING
                  </h1>
                  <span className="text-stone-300 font-light text-lg">×</span>
                  <span className="text-base sm:text-lg font-black text-[#FF5A00] tracking-tight">
                    talabat
                  </span>
                  <span className="hidden sm:inline-block bg-orange-50 text-[#D71920] text-xs font-bold px-2 py-0.5 rounded-full border border-orange-200/60 ml-1">
                    Aloha POS Audit
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-stone-500 font-medium flex items-center gap-2">
                  <span>Financial Audit & POS Reconciliation System</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cloud Synced
                  </span>
                </p>
              </div>
            </div>

            {/* Mobile User & Install Button */}
            <div className="lg:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="p-2 text-stone-700 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors"
                title="Install Desktop Application"
              >
                <Laptop className="w-4 h-4 text-[#D71920]" />
              </button>

              {currentUser ? (
                <div className="flex items-center gap-1.5">
                  {onOpenProfile && (
                    <button 
                      type="button"
                      onClick={onOpenProfile}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-900 border border-amber-500/40 rounded-xl shadow-xs text-xs font-bold text-amber-100 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span>{currentUser.name}</span>
                    </button>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs text-xs font-bold cursor-pointer"
                      title="تسجيل الخروج من الحساب"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>خروج</span>
                    </button>
                  )}
                </div>
              ) : onOpenLoginModal ? (
                <button 
                  type="button"
                  onClick={onOpenLoginModal}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-xl shadow-xs text-xs font-bold text-amber-900 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  <span>دخول الآدمن</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Action Controls & User status */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
            {/* Install Desktop App Button */}
            <button
              type="button"
              onClick={handleInstallClick}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-stone-800 bg-stone-50 hover:bg-orange-50 border border-stone-300 hover:border-orange-300 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Install as Desktop Application on Windows / Mac"
            >
              <Laptop className="w-4 h-4 text-[#D71920]" />
              <span>{isInstalled ? 'Desktop App Installed' : 'Install Desktop App'}</span>
              {isInstalled && <Check className="w-3.5 h-3.5 text-emerald-600" />}
            </button>

            {/* Logged in User Pill or Admin Login Button */}
            {currentUser ? (
              <div className="hidden sm:flex items-center gap-2 pr-2 border-l border-stone-200 mr-1">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-2.5 px-3 py-1.5 bg-gradient-to-r from-stone-900 via-stone-950 to-[#2b1008] border border-amber-500/30 rounded-2xl select-none text-left shadow-xs hover:border-amber-400 transition-all cursor-pointer"
                  title="Click to manage Master Password & Multi-Device Security"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-[#D71920] text-white flex items-center justify-center shadow-inner relative">
                    <Crown className="w-4 h-4 text-amber-100" />
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xs font-black text-white flex items-center gap-1">
                      <span>{currentUser.name}</span>
                      <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                      MASTER ADMINISTRATOR
                    </div>
                  </div>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-xl transition-all cursor-pointer shadow-xs"
                    title="تسجيل الخروج من الحساب"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل خروج</span>
                  </button>
                )}
              </div>
            ) : onOpenLoginModal ? (
              <div className="hidden sm:flex items-center gap-2 pr-2 border-l border-stone-200 mr-1">
                <button
                  type="button"
                  onClick={onOpenLoginModal}
                  className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-stone-900 to-stone-950 hover:from-black hover:to-stone-900 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>دخول المدير العام</span>
                </button>
              </div>
            ) : null}

            {/* Daily Discrepancy Breakdown Shortcut */}
            {hasData && onOpenDailyReport && (
              <button
                type="button"
                onClick={onOpenDailyReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all cursor-pointer shadow-xs"
                title="Open Day-by-Day Discrepancy Breakdown Report"
              >
                <CalendarDays className="w-4 h-4 text-amber-600" />
                <span>Daily Deficit Report</span>
                {hasDeficits && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    !
                  </span>
                )}
              </button>
            )}

            {hasData && (
              <>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-98 border border-rose-700 rounded-xl transition-all cursor-pointer shadow-sm shadow-rose-500/20"
                  title="Export entire page as PDF report with Save As"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Export PDF</span>
                </button>

                <button
                  onClick={onReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-stone-600 hover:text-red-700 bg-stone-100 hover:bg-red-50 border border-stone-200 rounded-xl transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Desktop App Installation Modal Guide */}
      {isInstallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#502314] via-[#7B2E18] to-[#D71920] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Laptop className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-black text-base">Desktop PC Installation</h3>
                  <p className="text-xs text-orange-200">Run as a Standalone Program</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInstallModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-stone-700 leading-relaxed">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
                <Cloud className="w-5 h-5 text-[#D71920] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-stone-900">Always Connected to Cloud:</p>
                  <p className="text-stone-600 mt-0.5">
                    Installing the desktop application gives you a standalone desktop icon and instant access. Any password changes made on any computer will sync automatically.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="font-black text-stone-900 text-sm">How to install on Windows / Mac:</p>
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#D71920] text-white flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                    <span>Look at the right side of your browser address bar for the <strong>Install (📥)</strong> or <strong>App Available</strong> icon.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#D71920] text-white flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                    <span>Or click the browser menu (⋮ in Chrome/Edge) and select <strong>"Install BK Audit Pro"</strong> or <strong>"Apps &gt; Install this site as an app"</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#D71920] text-white flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
                    <span>The app will launch in its own desktop window with a desktop shortcut and taskbar icon!</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsInstallModalOpen(false)}
                className="w-full py-2.5 bg-[#D71920] hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer text-center"
              >
                Got It, Thank You!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal with Save As selection */}
      {summary && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title="Export Audit Report (PDF)"
          defaultFileName={defaultPdfName}
          fileExtension="pdf"
          fileBlobGenerator={() =>
            generateReconciliationPDFBlob({
              rows,
              summary,
              excelFileName,
              excelPaymentSummary: excelPayments,
            })
          }
        />
      )}
    </>
  );
};






