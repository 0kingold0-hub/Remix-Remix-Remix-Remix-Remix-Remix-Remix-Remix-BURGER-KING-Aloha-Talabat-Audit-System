import React, { useState } from 'react';
import { DeviceLicenseInfo } from '../types';
import { apiActivateLicense, getWhatsAppPurchaseUrl } from '../utils/license';
import {
  Crown,
  Copy,
  Check,
  MessageSquare,
  KeyRound,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { BurgerKingLogo, TalabatLogo } from './BrandLogos';

interface UpgradeLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseInfo: DeviceLicenseInfo;
  onActivated: (updated: DeviceLicenseInfo) => void;
}

export const UpgradeLicenseModal: React.FC<UpgradeLicenseModalProps> = ({
  isOpen,
  onClose,
  licenseInfo,
  onActivated,
}) => {
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedDevice, setCopiedDevice] = useState(false);

  if (!isOpen) return null;

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(licenseInfo.deviceId);
    setCopiedDevice(true);
    setTimeout(() => setCopiedDevice(false), 2500);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setErrorMsg('يرجى إدخال مفتاح الترخيص.');
      return;
    }

    setIsActivating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await apiActivateLicense(
        licenseKeyInput.trim(),
        clientNameInput.trim() || undefined,
        licenseInfo.deviceId
      );

      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          onActivated({
            ...licenseInfo,
            status: 'active',
            isExpired: false,
            licenseKey: licenseKeyInput.trim(),
            planType: (res.planType as any) || 'annual',
          });
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.message);
      }
    } catch {
      setErrorMsg('تعذر الاتصال بالسيرفر السحابي.');
    } finally {
      setIsActivating(false);
    }
  };

  const whatsappUrl = getWhatsAppPurchaseUrl(licenseInfo.deviceId, licenseInfo.priceEgp || 5000);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="w-full max-w-xl bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 left-5 p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-[#D71920] flex items-center justify-center text-white shadow-lg">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">ترقية النسخة وتفعيل الترخيص الدائم</h2>
            <p className="text-xs text-stone-400">
              احصل على النسخة الكاملة لمنظومة BURGER KING & Talabat Audit
            </p>
          </div>
        </div>

        {/* Device ID Card */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 mb-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div>
              <span className="text-[11px] text-stone-400 font-semibold block">
                كود جهازك الفريد:
              </span>
              <span className="font-mono text-base font-black text-amber-400">
                {licenseInfo.deviceId}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyDeviceId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {copiedDevice ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تم النسخ!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>نسخ الكود</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Price and WhatsApp info */}
        <div className="bg-gradient-to-br from-amber-500/10 via-stone-950 to-stone-950 border border-amber-500/30 rounded-2xl p-4 mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-bold text-amber-300">سعر الترخيص السنوي الشامل:</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">5,000</span>
              <span className="text-xs font-bold text-amber-400">جنيهاً مصرياً</span>
            </div>
          </div>
          <p className="text-xs text-stone-400 mb-3">
            تحويل عبر إنستاباي أو فودافون كاش على رقم: <span className="font-mono text-amber-300 font-bold">01100051593</span>
          </p>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>طلب كود التفعيل عبر واتساب فوراً</span>
          </a>
        </div>

        {/* Enter Code form */}
        <form onSubmit={handleActivate} className="space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>إدخال مفتاح الترخيص المستلم:</span>
          </h3>

          {errorMsg && (
            <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <input
            type="text"
            value={licenseKeyInput}
            onChange={e => setLicenseKeyInput(e.target.value)}
            placeholder="BK-LIC-XXXX-XXXX-XXXX-XXXX"
            className="w-full px-4 py-2.5 bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl text-xs sm:text-sm font-mono text-white placeholder:text-stone-600 focus:outline-none"
            dir="ltr"
            required
          />

          <button
            type="submit"
            disabled={isActivating}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-[#D71920] hover:from-amber-400 hover:to-[#ff2830] text-white font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isActivating ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>تفعيل الترخيص الآن</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
