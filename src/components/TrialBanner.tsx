import React, { useState, useEffect } from 'react';
import { DeviceLicenseInfo } from '../types';
import { formatRemainingTime, getWhatsAppPurchaseUrl } from '../utils/license';
import { Clock, ShieldAlert, Sparkles, Copy, Check, MessageSquare, ChevronRight, Crown } from 'lucide-react';

interface TrialBannerProps {
  licenseInfo: DeviceLicenseInfo;
  onOpenUpgradeModal: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({
  licenseInfo,
  onOpenUpgradeModal,
}) => {
  const calcRemaining = () => {
    if (licenseInfo.trialExpiresAt && licenseInfo.trialExpiresAt > 0) {
      return Math.max(0, licenseInfo.trialExpiresAt - Date.now());
    }
    return Math.max(0, licenseInfo.remainingMs);
  };

  const [remainingMs, setRemainingMs] = useState(calcRemaining);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRemainingMs(calcRemaining());
    const interval = setInterval(() => {
      setRemainingMs(calcRemaining());
    }, 1000);
    return () => clearInterval(interval);
  }, [licenseInfo.trialExpiresAt, licenseInfo.remainingMs]);

  // If already full active and not in trial mode, do not display banner
  if (licenseInfo.status === 'active' && !licenseInfo.remainingMs) {
    return null;
  }

  // If master admin, do not display trial banner
  if (licenseInfo.isMaster) {
    return null;
  }

  const countdown = formatRemainingTime(remainingMs);
  const isUrgent = remainingMs < 3 * 3600 * 1000; // less than 3 hours

  const handleCopyCode = () => {
    navigator.clipboard.writeText(licenseInfo.deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappUrl = getWhatsAppPurchaseUrl(licenseInfo.deviceId, licenseInfo.priceEgp || 5000);

  return (
    <div
      className={`w-full border-b transition-all px-3 py-2 select-none z-40 ${
        isUrgent
          ? 'bg-gradient-to-r from-red-950 via-stone-900 to-red-950 text-red-100 border-red-800/80 shadow-md'
          : 'bg-gradient-to-r from-stone-900 via-amber-950/70 to-stone-900 text-stone-100 border-amber-500/30 shadow-xs'
      }`}
      dir="rtl"
    >
      <div className="w-full max-w-[98%] 2xl:max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Left: Status & Countdown */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              isUrgent
                ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>فترة تجريبية مجانية (24 ساعة)</span>
          </span>

          <span className="text-xs font-semibold text-stone-200">
            {countdown.text}
          </span>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-stone-400 bg-stone-950/60 px-2 py-0.5 rounded-lg border border-stone-800">
            <span>كود جهازك:</span>
            <span className="font-mono text-amber-300 font-bold">{licenseInfo.deviceId}</span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1 text-stone-400 hover:text-white transition-colors cursor-pointer"
              title="نسخ كود الجهاز"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Right: Upgrade Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>تواصل واتساب للشراء</span>
          </a>

          <button
            type="button"
            onClick={onOpenUpgradeModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-gradient-to-r from-amber-500 to-[#D71920] hover:from-amber-400 hover:to-[#ff2830] text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>شراء وتفعيل الترخيص (5,000 ج.م)</span>
            <ChevronRight className="w-3 h-3 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};
