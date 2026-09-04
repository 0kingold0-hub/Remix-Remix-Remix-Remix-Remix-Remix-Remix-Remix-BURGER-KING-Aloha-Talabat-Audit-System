import React, { useState, useEffect } from 'react';
import { DeviceLicenseInfo } from '../types';
import {
  apiActivateLicense,
  apiMasterPinBypass,
  apiSendActivationRequest,
  getClientGeolocation,
  subscribeToLicenseEvents,
  getWhatsAppPurchaseUrl,
} from '../utils/license';
import {
  Crown,
  Lock,
  Copy,
  Check,
  MessageSquare,
  KeyRound,
  ShieldAlert,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Send,
  MapPin,
  Clock,
  RefreshCw,
  Phone,
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
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedDevice, setCopiedDevice] = useState(false);

  // Activation Request State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestClientName, setRequestClientName] = useState('');
  const [requestPhone, setRequestPhone] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [requestedDuration, setRequestedDuration] = useState<number>(60);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState<boolean>(
    licenseInfo.status === 'pending' || Boolean((licenseInfo as any).pendingRequest)
  );
  const [requestFeedback, setRequestFeedback] = useState('');
  const [requestError, setRequestError] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle');

  // Master Bypass State
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [masterPin, setMasterPin] = useState('');
  const [isMasterLoading, setIsMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState('');

  // Real-time synchronization via Server-Sent Events (SSE)
  // When Master Admin activates, extends, or unlocks this device, it unlocks immediately!
  useEffect(() => {
    const unsubscribe = subscribeToLicenseEvents((type, data) => {
      if (type === 'device_updated' && data && data.deviceId === licenseInfo.deviceId) {
        if (data.status === 'active' && data.isActivated) {
          setSuccessMsg('🎉 تم تفعيل هذا الجهاز من قِبل المدير العام بنجاح! جاري فتح المنظومة...');
          setTimeout(() => {
            onActivated({
              ...licenseInfo,
              status: 'active',
              isActivated: true,
              isExpired: false,
              activationStartedAt: data.activationStartedAt,
              activationExpiresAt: data.activationExpiresAt,
              remainingMs: data.remainingMs || 3600000,
            });
          }, 1000);
        } else if (data.status === 'pending') {
          setHasPendingRequest(true);
        } else if (data.status === 'locked') {
          setHasPendingRequest(false);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [licenseInfo.deviceId, onActivated]);

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(licenseInfo.deviceId);
    setCopiedDevice(true);
    setTimeout(() => setCopiedDevice(false), 2500);
  };

  // Submit Activation Request to Master Admin
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestClientName.trim()) {
      setRequestError('يرجى كتابة اسمك أو اسم المحل/الفرع.');
      return;
    }

    setIsSendingRequest(true);
    setRequestError('');
    setRequestFeedback('');
    setLocationStatus('locating');

    // Request actual geolocation from browser
    let locPayload: any = undefined;
    try {
      const loc = await getClientGeolocation();
      locPayload = loc;
      setLocationStatus(loc.permissionStatus === 'granted' ? 'granted' : 'denied');
    } catch {
      setLocationStatus('denied');
    }

    try {
      const res = await apiSendActivationRequest({
        deviceId: licenseInfo.deviceId,
        clientName: requestClientName.trim(),
        phone: requestPhone.trim(),
        notes: requestNotes.trim(),
        requestedDurationMinutes: requestedDuration,
        location: locPayload,
      });

      if (res.success) {
        setHasPendingRequest(true);
        setIsRequestModalOpen(false);
        setRequestFeedback('تم إرسال طلب التفعيل بنجاح إلى المدير العام! يرجى الانتظار حتى تتم الموافقة والتفعيل.');
      } else {
        setRequestError(res.message || 'فشل إرسال طلب التفعيل.');
      }
    } catch {
      setRequestError('تعذر إرسال الطلب. تأكد من اتصال الإنترنت.');
    } finally {
      setIsSendingRequest(false);
    }
  };

  // Activate via License Key
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
        undefined,
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
            isActivated: true,
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

  // Master PIN Instant Bypass
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
          isActivated: true,
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

  const isDeviceLocked = licenseInfo.status === 'locked' || licenseInfo.isExpired;
  const whatsappUrl = getWhatsAppPurchaseUrl(licenseInfo.deviceId, licenseInfo.priceEgp || 5000);

  return (
    <div
      className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between items-center px-4 py-8 select-none font-sans relative overflow-x-hidden"
      dir="rtl"
    >
      {/* Ambient glowing effect */}
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
      <div className="w-full max-w-2xl bg-stone-900/90 border border-stone-800 backdrop-blur-xl rounded-3xl p-6 sm:p-9 shadow-2xl relative z-10 my-auto space-y-6">
        {/* Status Badge */}
        <div className="flex justify-center">
          {hasPendingRequest ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black bg-amber-950/80 text-amber-400 border border-amber-800/80 shadow-sm animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              طلب التفعيل قيد المراجعة لدى المدير العام
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black bg-red-950/80 text-red-400 border border-red-800/80 shadow-sm">
              <Lock className="w-3.5 h-3.5 text-red-400" />
              الجهاز مقفول — يحتاج إلى تفعيل من المدير العام
            </span>
          )}
        </div>

        {/* Title & Brand */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-[#D71920] shadow-lg shadow-red-950/40 mb-3 text-white">
            <Crown className="w-8 h-8 drop-shadow-md" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {hasPendingRequest ? 'طلب التفعيل مُرسل وبانتظار الموافقة' : 'تفعيل جهاز العميل للمنظومة'}
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 max-w-lg mx-auto mt-2 leading-relaxed">
            {hasPendingRequest
              ? 'تم استلام طلب تفعيل هذا الجهاز لدى المدير العام وسيتم تحديد مدة التفعيل. ستفتح الشاشة تلقائياً فور الموافقة دون الحاجة لتحديث الصفحة.'
              : 'هذا الجهاز غير مفعل حالياً أو تم قفله من قِبل المدير العام. لا يمكن استخدام النظام إلا بعد موافقة وتفعيل المدير العام أو إدخال كود ترخيص رسمي.'}
          </p>
        </div>

        {/* Device ID Card */}
        <div className="bg-stone-950/90 border border-stone-800 rounded-2xl p-4 shadow-inner">
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

        {/* REQUEST ACTIVATION SECTION */}
        {hasPendingRequest ? (
          <div className="p-4 bg-amber-950/30 border border-amber-700/50 rounded-2xl text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-amber-300 font-bold text-sm">
              <Clock className="w-4 h-4 animate-spin text-amber-400" />
              <span>جاري انتظار اعتماد وتفعيل الجهاز بواسطة Master Admin...</span>
            </div>
            <p className="text-xs text-stone-400">
              يقوم المدير العام بمراجعة طلبك وإعطاء الصلاحية بالمدة المناسبة. ستتحول الشاشة فوراً عند التفعيل.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(true)}
                className="text-xs text-amber-400 hover:underline font-semibold"
              >
                تعديل بيانات طلب التفعيل أو إرسال ملاحظة جديدة
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="text-center sm:text-right">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Send className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white">إرسال طلب تفعيل فوري للمدير العام</h3>
              </div>
              <p className="text-xs text-stone-400 mt-1">
                اضغط هنا لإرسال طلب إلى لوحة تحكم Master Admin مع تحديد المدة المطلوبة وموقع الفرع.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsRequestModalOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-[#D71920] hover:from-amber-400 hover:to-[#ff2830] text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>طلب تفعيل الجهاز الآن</span>
            </button>
          </div>
        )}

        {requestFeedback && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{requestFeedback}</span>
          </div>
        )}

        {/* Pricing & Contact Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="border-t border-stone-800 pt-4">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>لديك كود ترخيص مستلم من المدير العام؟ أدخله هنا:</span>
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
              <span>💡 للإدارة العامة: يمكنك إدخال الرقم السري <strong className="text-amber-400 font-mono">1993</strong> للفتح الفوري.</span>
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

      {/* MODAL: REQUEST ACTIVATION MODAL */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-stone-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl relative space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-[#D71920] text-white flex items-center justify-center mx-auto mb-2 shadow-md">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white">طلب تفعيل الجهاز من المدير العام</h3>
              <p className="text-xs text-stone-400 mt-1">
                املأ بياناتك وسيصل إشعار فوري إلى لوحة تحكم Master Admin لتفعيل هذا الجهاز.
              </p>
            </div>

            {requestError && (
              <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300 font-semibold">
                {requestError}
              </div>
            )}

            <form onSubmit={handleSendRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1 text-right">
                  اسم العميل أو الفرع: <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={requestClientName}
                  onChange={e => setRequestClientName(e.target.value)}
                  placeholder="مثال: برجر كنج فرع المعادي - أ/ أحمد"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1 text-right">
                  رقم الهاتف للتواصل / واتساب:
                </label>
                <input
                  type="tel"
                  value={requestPhone}
                  onChange={e => setRequestPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs font-mono text-white focus:border-amber-500 focus:outline-none text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1 text-right">
                  مدة التفعيل المطلوبة:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '5 د', val: 5 },
                    { label: '15 د', val: 15 },
                    { label: '30 د', val: 30 },
                    { label: '1 ساعة', val: 60 },
                    { label: '2 ساعة', val: 120 },
                    { label: '6 ساعات', val: 360 },
                    { label: '12 ساعة', val: 720 },
                    { label: '24 ساعة', val: 1440 },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.val}
                      onClick={() => setRequestedDuration(item.val)}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        requestedDuration === item.val
                          ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-xs'
                          : 'bg-stone-950 text-stone-300 border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1 text-right">
                  ملاحظة للمدير العام (اختياري):
                </label>
                <textarea
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  placeholder="مثال: مطابقة مبيعات شيفت الصباح..."
                  rows={2}
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>

              <div className="p-2.5 bg-stone-950/70 border border-stone-800 rounded-xl text-[11px] text-stone-400 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>سيتم إرسال إحداثيات موقع الفرع الحقيقية تلقائياً للمدير العام في حال سماح المتصفح.</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSendingRequest}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-[#D71920] hover:from-amber-400 hover:to-[#ff2830] text-white font-black rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSendingRequest ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>إرسال الطلب</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
