import React, { useState } from 'react';
import { DeviceLicenseInfo } from '../types';
import { apiActivateLicense, apiMasterPinBypass, getWhatsAppPurchaseUrl } from '../utils/license';
import {
  Crown,
  Lock,
  Copy,
  Check,
  Phone,
  MessageSquare,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Sparkles,
  CreditCard,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { BurgerKingLogo, TalabatLogo } from './BrandLogos';

interface PaywallLockScreenProps {
  licenseInfo: DeviceLicenseInfo;
  onActivated: (updated: DeviceLicenseInfo) => void;
  onMasterLoginSuccess?: (user: any) => void;
}

export const PaywallLockScreen: React.FC<PaywallLockScreenProps> = ({
  licenseInfo,
  onActivated,
  onMasterLoginSuccess,
}) => {
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedDevice, setCopiedDevice] = useState(false);

  // Master Bypass State
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [masterPin, setMasterPin] = useState('');
  const [isMasterLoading, setIsMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState('');

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(licenseInfo.deviceId);
    setCopiedDevice(true);
    setTimeout(() => setCopiedDevice(false), 2500);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setErrorMsg('يرجى إدخال مفتاح الترخيص المستلم.');
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
        if (res.user && onMasterLoginSuccess) {
          onMasterLoginSuccess(res.user);
        }
        setTimeout(() => {
          onActivated({
            ...licenseInfo,
            status: 'active',
            isExpired: false,
            licenseKey: licenseKeyInput.trim(),
            planType: (res.planType as any) || 'lifetime',
            isMaster: res.isMaster ?? false,
          });
        }, 1200);
      } else {
        setErrorMsg(res.message);
      }
    } catch {
      setErrorMsg('تعذر الاتصال بالسيرفر السحابي للتحقق من الترخيص.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleMasterBypassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPin.trim()) return;

    setIsMasterLoading(true);
    setMasterError('');

    try {
      const res = await apiMasterPinBypass(masterPin.trim(), licenseInfo.deviceId);
      if (res.success) {
        if (res.token && res.user && onMasterLoginSuccess) {
          onMasterLoginSuccess(res.user);
        }
        onActivated({
          ...licenseInfo,
          status: 'active',
          isExpired: false,
          isMaster: true,
          planType: 'lifetime',
        });
        setIsMasterModalOpen(false);
      } else {
        setMasterError(res.error || 'الرقم السري للمدير العام غير صحيح.');
      }
    } catch {
      setMasterError('تعذر التحقق من الرقم السري.');
    } finally {
      setIsMasterLoading(false);
    }
  };

  const whatsappUrl = getWhatsAppPurchaseUrl(licenseInfo.deviceId, licenseInfo.priceEgp || 5000);

  return (
    <div
      className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between items-center px-4 py-8 select-none font-sans relative overflow-x-hidden"
      dir="rtl"
    >
      {/* Background glowing effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-[#D71920]/20 via-[#FF5A00]/10 to-transparent blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500/10 blur-3xl pointer-events-none -z-0" />

      {/* Top Bar Header */}
      <div className="w-full max-w-4xl flex items-center justify-between relative z-10 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center -space-x-2">
            <BurgerKingLogo size="sm" className="ring-2 ring-stone-900 shadow-md" />
            <TalabatLogo size="sm" className="ring-2 ring-stone-900 shadow-md" />
          </div>
          <span className="text-xs sm:text-sm font-black text-amber-300">
            منظومة برجر كنج وطلبات المالية
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsMasterModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-amber-400 border border-stone-800 hover:border-amber-500/50 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
        >
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span>دخول المدير العام (Master)</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-2xl bg-stone-900/90 border border-stone-800 backdrop-blur-xl rounded-3xl p-6 sm:p-9 shadow-2xl relative z-10 my-auto">
        {/* Status Badge */}
        <div className="flex justify-center mb-4">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-red-950/80 text-red-400 border border-red-800/60 shadow-sm animate-pulse">
            <Lock className="w-3.5 h-3.5 text-red-400" />
            انتهت الفترة التجريبية المجانية (24 ساعة)
          </span>
        </div>

        {/* Title & Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-[#D71920] shadow-lg shadow-red-950/40 mb-3 text-white">
            <Crown className="w-8 h-8 drop-shadow-md" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            تفعيل النسخة الكاملة للمنظومة
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 max-w-lg mx-auto mt-2 leading-relaxed">
            لقد استنفذ هذا الجهاز فترة التجربة المجانية المتاحة (يوم واحد). للاستمرار في مراجعة ومطابقة مبيعات ألوها وطلبات واستخراج تقارير العجز وطباعة الـ PDF، يرجى تفعيل اشتراكك.
          </p>
        </div>

        {/* Device ID Card */}
        <div className="bg-stone-950/90 border border-stone-800 rounded-2xl p-4 mb-6 shadow-inner">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-right">
              <span className="text-[11px] font-semibold text-stone-400 block mb-0.5">
                كود تعريف جهازك الفريد (Hardware Device Code):
              </span>
              <span className="font-mono text-base sm:text-lg font-black text-amber-400 tracking-wider select-all">
                {licenseInfo.deviceId}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyDeviceId}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                copiedDevice
                  ? 'bg-emerald-600 text-white shadow-emerald-900/50'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 hover:border-stone-600'
              }`}
            >
              {copiedDevice ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>تم النسخ بنجاح!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span>نسخ كود الجهاز</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pricing & Value Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-500/10 via-stone-900 to-stone-950 border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block mb-1">
                الباقة الشاملة للمطاعم والفروع
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">5,000</span>
                <span className="text-xs font-bold text-amber-400">جنيهاً مصرياً</span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1.5">
                ترخيص تجاري كامل، مطابقة غير محدودة للشيكات وأوردرات طلبات، وتحديثات سحابية مستمرة.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-800/80 flex items-center gap-1.5 text-[11px] text-stone-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>يشمل الدعم الفني المباشر والصيانة</span>
            </div>
          </div>

          {/* Quick Payment & Contact Box */}
          <div className="bg-stone-950/80 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-black text-stone-400 block mb-2">
                طرق الدفع والتحويل المعتمدة:
              </span>
              <div className="space-y-1.5 text-xs text-stone-300">
                <div className="flex items-center justify-between bg-stone-900/60 px-2.5 py-1.5 rounded-lg border border-stone-800/60">
                  <span className="font-semibold text-stone-400">فودافون كاش:</span>
                  <span className="font-mono font-bold text-amber-300">01100051593</span>
                </div>
                <div className="flex items-center justify-between bg-stone-900/60 px-2.5 py-1.5 rounded-lg border border-stone-800/60">
                  <span className="font-semibold text-stone-400">إنستاباي (InstaPay):</span>
                  <span className="font-mono font-bold text-emerald-400">01100051593</span>
                </div>
              </div>
            </div>

            {/* Direct WhatsApp button */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>شراء الترخيص عبر واتساب (WhatsApp)</span>
            </a>
          </div>
        </div>

        {/* License Activation Form */}
        <div className="border-t border-stone-800 pt-5">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>لديك مفتاح ترخيص؟ أدخله هنا للتفعيل الفوري:</span>
          </h3>

          {errorMsg && (
            <div className="mb-3 p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-3 p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleActivate} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={licenseKeyInput}
                onChange={e => setLicenseKeyInput(e.target.value)}
                placeholder="أدخل كود الترخيص: BK-LIC-XXXX-XXXX-XXXX-XXXX"
                className="flex-1 px-4 py-2.5 bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl text-xs sm:text-sm font-mono text-white placeholder:text-stone-600 focus:outline-none transition-all"
                dir="ltr"
                required
              />
              <button
                type="submit"
                disabled={isActivating}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-[#D71920] hover:from-amber-400 hover:to-[#ff2830] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5"
              >
                {isActivating ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>تفعيل الترخيص فوراً</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-800 text-[11px] text-stone-400">
              <span>💡 للإدارة العامة: يمكنك إدخال الرقم السري <strong className="text-amber-400 font-mono">1993</strong> أو المفتاح الماستر للفتح الفوري.</span>
              <button
                type="button"
                onClick={() => setIsMasterModalOpen(true)}
                className="text-amber-400 hover:text-amber-300 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>دخول المدير العام (Master PIN)</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Master Admin Unlock Modal (Emergency / Owner bypass) */}
      {isMasterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-stone-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl relative">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 border border-amber-500/40">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white">دخول المدير العام (Master Bypass)</h3>
              <p className="text-xs text-stone-400 mt-1">
                أدخل الرقم السري الأمني الخاص بصاحب المنظومة لفتح هذا الجهاز فوراً بصلاحيات دائمة مدى الحياة.
              </p>
            </div>

            {masterError && (
              <div className="mb-3 p-2 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300 font-semibold text-center">
                {masterError}
              </div>
            )}

            <form onSubmit={handleMasterBypassSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1 text-right">
                  الرقم السري للمدير (Master PIN):
                </label>
                <input
                  type="password"
                  value={masterPin}
                  onChange={e => setMasterPin(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  className="w-full px-4 py-2 text-center text-lg tracking-widest bg-stone-950 border border-stone-700 focus:border-amber-500 rounded-xl text-white focus:outline-none"
                  dir="ltr"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMasterModalOpen(false)}
                  className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isMasterLoading}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isMasterLoading ? 'جاري الفتح...' : 'تأكيد ودخول'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-2 relative z-10 text-[11px] text-stone-500 font-medium space-y-0.5">
        <div>BURGER KING & TALABAT FINANCIAL AUDIT SUITE</div>
        <div>
          تطوير وإشراف هندسي: <span className="text-[#D71920] font-black">م/ محمد عادل (M-King)</span> • هاتف:{' '}
          <span className="font-mono text-stone-400">01100051593</span>
        </div>
      </footer>
    </div>
  );
};
