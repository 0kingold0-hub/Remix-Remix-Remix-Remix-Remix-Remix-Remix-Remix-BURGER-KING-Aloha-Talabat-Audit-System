import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import {
  apiChangeMasterCredentials,
  apiGetActiveSessions,
  apiTerminateSession,
  apiTerminateAllDevices,
  ActiveSessionInfo,
} from '../utils/auth';
import {
  apiAdminGenerateLicense,
  apiAdminGetDevices,
  apiAdminDeviceAction,
} from '../utils/license';
import { StoredDeviceEntry, GeneratedLicenseRecord } from '../types';
import {
  ShieldCheck,
  KeyRound,
  Check,
  X,
  BadgeCheck,
  LogOut,
  Save,
  AlertCircle,
  User,
  ShieldAlert,
  Cloud,
  Laptop,
  Smartphone,
  Globe,
  Radio,
  RefreshCw,
  UserX,
  PowerOff,
  Clock,
  CheckCircle2,
  Crown,
  Sparkles,
  Copy,
  MessageSquare,
  CalendarPlus,
  Coins,
  ShieldX,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onUpdateUser: (updatedUser: UserAccount) => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onLogout,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'devices' | 'security' | 'licenses'>('devices');

  // Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState(currentUser.name);

  // Active Sessions State
  const [sessions, setSessions] = useState<ActiveSessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);
  const [isTerminatingAll, setIsTerminatingAll] = useState(false);

  // Licenses & Client Devices State
  const [trackedDevices, setTrackedDevices] = useState<StoredDeviceEntry[]>([]);
  const [storedLicenses, setStoredLicenses] = useState<GeneratedLicenseRecord[]>([]);
  const [isLoadingLicenses, setIsLoadingLicenses] = useState(false);
  const [genDeviceId, setGenDeviceId] = useState('');
  const [genClientName, setGenClientName] = useState('');
  const [genPlanType, setGenPlanType] = useState<'annual' | 'lifetime' | 'monthly' | 'semi_annual'>('annual');
  const [genPrice, setGenPrice] = useState(5000);
  const [genDurationDays, setGenDurationDays] = useState(365);
  const [genNotes, setGenNotes] = useState('');
  const [generatedKeyResult, setGeneratedKeyResult] = useState<string | null>(null);
  const [generatedWhatsappMsg, setGeneratedWhatsappMsg] = useState<string | null>(null);
  const [copiedLicenseKey, setCopiedLicenseKey] = useState(false);
  const [isGeneratingLicense, setIsGeneratingLicense] = useState(false);
  const [actionLoadingDeviceId, setActionLoadingDeviceId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchLicenses = async () => {
    setIsLoadingLicenses(true);
    try {
      const res = await apiAdminGetDevices();
      if (res.success) {
        setTrackedDevices(res.devices || []);
        setStoredLicenses(res.licenses || []);
      }
    } catch {
      console.error('Failed to load licenses');
    } finally {
      setIsLoadingLicenses(false);
    }
  };

  const handleGenerateLicenseKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genDeviceId.trim()) {
      setErrorMessage('يرجى إدخال أو اختيار كود جهاز العميل.');
      return;
    }

    setIsGeneratingLicense(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiAdminGenerateLicense({
        deviceId: genDeviceId.trim(),
        clientName: genClientName.trim() || 'عميل تجاري',
        planType: genPlanType,
        durationDays: genPlanType === 'lifetime' ? 0 : genDurationDays,
        priceEgp: Number(genPrice) || 5000,
        notes: genNotes.trim(),
      });

      if (res.success && res.licenseKey) {
        setGeneratedKeyResult(res.licenseKey);
        setGeneratedWhatsappMsg(res.whatsappMessage || null);
        setSuccessMessage('تم توليد مفتاح الترخيص المشفر ورسالة الواتساب بنجاح!');
        fetchLicenses();
      } else {
        setErrorMessage(res.error || 'فشل توليد مفتاح الترخيص.');
      }
    } catch {
      setErrorMessage('حدث خطأ أثناء الاتصال بالسيرفر.');
    } finally {
      setIsGeneratingLicense(false);
    }
  };

  const handleRemoteAction = async (
    action: 'extend_trial' | 'instant_activate' | 'revoke',
    deviceId: string,
    extraHours = 24
  ) => {
    setActionLoadingDeviceId(deviceId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiAdminDeviceAction(action, deviceId, extraHours);
      if (res.success) {
        setSuccessMessage(res.message || 'تم تنفيذ الإجراء بنجاح.');
        fetchLicenses();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(res.error || 'فشل تنفيذ الإجراء.');
      }
    } catch {
      setErrorMessage('خطأ في الاتصال بالسيرفر.');
    } finally {
      setActionLoadingDeviceId(null);
    }
  };

  // Load active sessions when modal opens or tab changes
  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    setErrorMessage('');
    try {
      const res = await apiGetActiveSessions();
      if (res.success && res.sessions) {
        setSessions(res.sessions);
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch {
      setErrorMessage('تعذر جلب قائمة الأجهزة المتصلة');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  // Kick / Terminate specific device
  const handleTerminateSession = async (sessionId: string, deviceLabel: string) => {
    if (!window.confirm(`هل أنت متأكد من طرد هذا الجهاز (${deviceLabel}) وإنهاء جلسته فوراً؟`)) {
      return;
    }

    setTerminatingSessionId(sessionId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiTerminateSession(sessionId);
      if (res.success) {
        setSuccessMessage(res.message || 'تم طرد الجهاز بنجاح.');
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(res.error || 'فشل طرد الجهاز.');
      }
    } catch {
      setErrorMessage('حدث خطأ أثناء محاولة طرد الجهاز.');
    } finally {
      setTerminatingSessionId(null);
    }
  };

  // Terminate all other connected devices
  const handleTerminateAllDevices = async () => {
    const otherCount = sessions.filter(s => !s.isCurrent).length;
    if (otherCount === 0) {
      setErrorMessage('لا توجد أجهزة أخرى متصلة حالياً.');
      return;
    }

    if (!window.confirm(`⚠️ تحذير أمني: هل تريد طرد وإخراج جميع الأجهزة الأخرى المتصلة حالياً (${otherCount} جهاز) وإجبارها على تسجيل الخروج فوراً؟`)) {
      return;
    }

    setIsTerminatingAll(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiTerminateAllDevices();
      if (res.success) {
        setSuccessMessage(res.message || 'تم طرد جميع الأجهزة الأخرى بنجاح.');
        // Keep only current session
        setSessions(prev => prev.filter(s => s.isCurrent));
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setErrorMessage(res.error || 'فشل طرد الأجهزة.');
      }
    } catch {
      setErrorMessage('حدث خطأ أثناء محاولة طرد الأجهزة.');
    } finally {
      setIsTerminatingAll(false);
    }
  };

  // Change master credentials
  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!currentPassword) {
      setErrorMessage('يرجى إدخال كلمة المرور الحالية لتأكيد هويتك كمدير عام.');
      return;
    }

    if (newPassword && newPassword.length < 3) {
      setErrorMessage('كلمة المرور الجديدة يجب أن تكون 3 أحرف/أرقام على الأقل.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMessage('كلمة المرور الجديدة غير متطابقة مع حقل التأكيد!');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiChangeMasterCredentials(
        currentPassword,
        newUsername,
        newPassword || currentPassword,
        name
      );

      setIsLoading(false);

      if (res.success && res.user) {
        onUpdateUser(res.user);
        setSuccessMessage('تم تحديث بيانات وكلمة مرور المنظومة بنجاح! تم تسجيل خروج وطرد جميع الأجهزة الأخرى تلقائياً.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        fetchSessions();
        setTimeout(() => {
          setSuccessMessage('');
        }, 4000);
      } else {
        setErrorMessage(res.error || 'فشل تحديث البيانات.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('حدث خطأ أثناء الاتصال بالسيرفر السحابي المركزي.');
    }
  };

  const otherSessionsCount = sessions.filter(s => !s.isCurrent).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-xs animate-fade-in" dir="rtl">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#502314] via-[#7B2E18] to-[#D71920] p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-lg">{currentUser.name}</h3>
                <BadgeCheck className="w-4 h-4 text-blue-300" />
              </div>
              <p className="text-xs text-orange-200 font-medium tracking-wide">
                لوحة تحكم المدير العام — إدارة الأمان والأجهزة المتصلة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cloud Status Banner */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-5 py-2.5 flex items-center justify-between text-xs text-amber-950 font-semibold shrink-0">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-[#D71920]" />
            <span>السحابة المركزية: <strong>نشطة ومتصلة عبر الإنترنت</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-stone-700 bg-white px-2.5 py-0.5 rounded-full border border-amber-300 shadow-2xs">
            <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
            <span>الأجهزة المتصلة: <strong>{sessions.length}</strong></span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 bg-stone-50/80 px-4 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('devices');
              fetchSessions();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'devices'
                ? 'border-[#D71920] text-[#D71920] bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>الأجهزة والجلسات النشطة</span>
            <span className={`px-2 py-0.2 rounded-full text-[11px] font-bold ${activeTab === 'devices' ? 'bg-red-100 text-[#D71920]' : 'bg-stone-200 text-stone-600'}`}>
              {sessions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#D71920] text-[#D71920] bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>تغيير باسورد الموقع وبيانات الآدمن</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('licenses');
              fetchLicenses();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'licenses'
                ? 'border-[#D71920] text-[#D71920] bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-500" />
            <span>إدارة التراخيص والمبيعات</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
              5,000 ج.م
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-bold text-red-800 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs font-bold text-emerald-800 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* TAB 1: CONNECTED DEVICES MANAGEMENT */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              {/* Header with Refresh & Kill-All button */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-stone-600 font-semibold">
                  جميع الأجهزة أو المتصفحات المسجلة حالياً في المنظومة:
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchSessions}
                    disabled={isLoadingSessions}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="تحديث قائمة الأجهزة"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
                    <span>تحديث</span>
                  </button>

                  {otherSessionsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleTerminateAllDevices}
                      disabled={isTerminatingAll}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      title="طرد جميع الأجهزة الأخرى فوراً"
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>{isTerminatingAll ? 'جاري الطرد...' : `طرد جميع الأجهزة الأخرى (${otherSessionsCount})`}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sessions List */}
              <div className="space-y-2.5">
                {isLoadingSessions && sessions.length === 0 ? (
                  <div className="py-8 text-center text-stone-400 text-xs font-medium flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-stone-500" />
                    <span>جاري فحص الأجهزة المتصلة بالسيرفر...</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="py-6 text-center text-stone-400 text-xs font-medium bg-stone-50 rounded-xl border border-stone-200">
                    لا توجد جلسات نشطة حالياً.
                  </div>
                ) : (
                  sessions.map((sess) => {
                    const isPhone = /android|iphone|ipad|mobile/i.test(sess.deviceName);
                    const formattedDate = new Date(sess.loginTime).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });

                    return (
                      <div
                        key={sess.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          sess.isCurrent
                            ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                            : 'bg-stone-50 hover:bg-stone-100/80 border-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            sess.isCurrent ? 'bg-emerald-600 text-white shadow-xs' : 'bg-stone-200 text-stone-700'
                          }`}>
                            {isPhone ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                          </div>

                          <div className="space-y-0.5 text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold text-stone-900">
                                {sess.deviceName}
                              </span>
                              {sess.isCurrent && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  هذا الجهاز (جلستك الحالية)
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-stone-500 flex items-center gap-3 font-mono">
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3 text-stone-400" />
                                IP: {sess.ip}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-stone-400" />
                                وقت الدخول: {formattedDate}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action: Kick device button */}
                        {!sess.isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleTerminateSession(sess.id, sess.deviceName)}
                            disabled={terminatingSessionId === sess.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 rounded-xl transition-all cursor-pointer disabled:opacity-50 shrink-0"
                            title="طرد هذا الجهاز وإنهاء جلسته فوراً"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>{terminatingSessionId === sess.id ? 'جاري الطرد...' : 'طرد الجهاز'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Security Hint */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black">ميزة الطرد الفوري:</span> عند الضغط على "طرد الجهاز"، يتم فصل الجلسة على السيرفر المركزي فوراً، وتعود شاشة هذا الجهاز إلى صفحة تسجيل الدخول في غضون ثوانٍ.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHANGE PASSWORD & CREDENTIALS */}
          {activeTab === 'security' && (
            <form onSubmit={handleSaveSecurity} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-stone-700 mb-1">
                  اسم المدير العام (الاسم المعروض):
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-stone-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: M-King"
                    className="w-full pr-9 pl-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-[#D71920] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-stone-700 mb-1">
                  كود الدخول / اسم المستخدم (User Code):
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-bold text-stone-800 focus:bg-white focus:ring-2 focus:ring-[#D71920] focus:outline-none font-mono text-left"
                  required
                />
              </div>

              <div className="border-t border-stone-100 pt-3">
                <div className="text-xs font-black text-stone-900 mb-2 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#D71920]" />
                  <span>تغيير كلمة المرور الرئيسية (Master Password):</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      كلمة المرور الحالية <span className="text-red-500">* (مطلوبة للتحقق من هويتك)</span>
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور الحالية"
                      className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-[#D71920] focus:outline-none font-mono text-left"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1">
                        كلمة المرور الجديدة:
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="اتركها فارغة إذا أردت الإبقاء عليها"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-[#D71920] focus:outline-none font-mono text-left"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1">
                        تأكيد كلمة المرور الجديدة:
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="أعد إدخال كلمة المرور الجديدة"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-[#D71920] focus:outline-none font-mono text-left"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-900 leading-relaxed flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black">حماية تلقائية:</span> بمجرد حفظ كلمة المرور الجديدة، يتم تحديثها فوراً على السيرفر، ويتم طرد وتسجيل خروج جميع الأجهزة الأخرى المتصلة في أي مكان تلقائياً لضمان عدم دخول أي شخص بدون كلمة المرور الجديدة.
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-stone-100">
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج من هذا الجهاز</span>
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#D71920] hover:bg-red-700 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>حفظ كلمة المرور وطرد الأجهزة الأخرى</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: LICENSES & CLIENT SALES MANAGEMENT */}
          {activeTab === 'licenses' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-stone-500 block mb-1">إجمالي الأجهزة</span>
                  <span className="text-xl font-black text-stone-900">{trackedDevices.length}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-amber-700 block mb-1">فترة تجريبية (24س)</span>
                  <span className="text-xl font-black text-amber-900">
                    {trackedDevices.filter(d => d.status === 'trial').length}
                  </span>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-red-700 block mb-1">انتهت التجربة (مغلق)</span>
                  <span className="text-xl font-black text-red-900">
                    {trackedDevices.filter(d => d.status === 'expired').length}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 block mb-1">مفعل بـ 5,000 ج</span>
                  <span className="text-xl font-black text-emerald-900">
                    {trackedDevices.filter(d => d.status === 'active').length}
                  </span>
                </div>
              </div>

              {/* License Generator Card */}
              <div className="bg-gradient-to-br from-stone-900 to-stone-950 text-white rounded-2xl p-4 sm:p-5 border border-stone-800 shadow-lg">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">إصدار مفتاح ترخيص رسمي لعميل</h4>
                      <p className="text-[11px] text-stone-400">توليد شفرة تفعيل مشفرة خاصة بجهاز العميل ورسالة واتساب فورية</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-800/80">
                    5,000 ج.م
                  </span>
                </div>

                <form onSubmit={handleGenerateLicenseKey} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Device Selection / Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-stone-300">
                          كود جهاز العميل (Device ID):
                        </label>
                        <button
                          type="button"
                          onClick={() => setGenDeviceId('UNIVERSAL')}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-all ${
                            genDeviceId === 'UNIVERSAL'
                              ? 'bg-amber-400 text-stone-950 shadow-xs'
                              : 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800'
                          }`}
                        >
                          🌐 ترخيص عام (يعمل على أي جهاز)
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={genDeviceId}
                          onChange={e => setGenDeviceId(e.target.value.toUpperCase())}
                          placeholder="BK-DEV-XXXX-XXXX-XXXX أو UNIVERSAL"
                          className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs font-mono text-amber-400 placeholder:text-stone-600 focus:border-amber-500 focus:outline-none"
                          dir="ltr"
                          required
                        />
                      </div>

                      {/* Quick picker from detected devices */}
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-stone-400">أجهزة العملاء المتصلة:</span>
                        {trackedDevices.length > 0 ? (
                          trackedDevices.map(d => (
                            <button
                              type="button"
                              key={d.deviceId}
                              onClick={() => {
                                setGenDeviceId(d.deviceId);
                                if (d.clientName) setGenClientName(d.clientName);
                              }}
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer border transition-all ${
                                genDeviceId === d.deviceId
                                  ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold'
                                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
                              }`}
                              title={d.deviceName || d.deviceId}
                            >
                              {d.deviceId.slice(-9)} {d.status === 'expired' ? '⚠️' : ''}
                            </button>
                          ))
                        ) : (
                          <span className="text-[10px] text-stone-500">لا توجد أجهزة مسجلة حالياً</span>
                        )}
                      </div>
                    </div>

                    {/* Client Name */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-300 mb-1">
                        اسم العميل أو الفرع:
                      </label>
                      <input
                        type="text"
                        value={genClientName}
                        onChange={e => setGenClientName(e.target.value)}
                        placeholder="مثال: برجر كنج فرع التجمع - أ/ أحمد"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white placeholder:text-stone-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Plan Duration */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-300 mb-1">نوع الترخيص:</label>
                      <select
                        value={genPlanType}
                        onChange={e => {
                          const val = e.target.value as any;
                          setGenPlanType(val);
                          if (val === 'annual') {
                            setGenDurationDays(365);
                            setGenPrice(5000);
                          } else if (val === 'semi_annual') {
                            setGenDurationDays(180);
                            setGenPrice(3000);
                          } else if (val === 'monthly') {
                            setGenDurationDays(30);
                            setGenPrice(1000);
                          } else if (val === 'lifetime') {
                            setGenDurationDays(0);
                            setGenPrice(10000);
                          }
                        }}
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="annual">سنة كاملة (365 يوم) — 5,000 ج.م</option>
                        <option value="semi_annual">6 أشهر — 3,000 ج.م</option>
                        <option value="monthly">شهر تجاري — 1,000 ج.م</option>
                        <option value="lifetime">ترخيص دائم مدى الحياة</option>
                      </select>
                    </div>

                    {/* Price in EGP */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-300 mb-1">المبلغ المحصل (ج.م):</label>
                      <input
                        type="number"
                        value={genPrice}
                        onChange={e => setGenPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs font-bold text-emerald-400 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-[11px] font-bold text-stone-300 mb-1">ملاحظات داخلية:</label>
                      <input
                        type="text"
                        value={genNotes}
                        onChange={e => setGenNotes(e.target.value)}
                        placeholder="تم التحويل إنستاباي..."
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white placeholder:text-stone-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isGeneratingLicense}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-[#D71920] hover:from-amber-400 hover:to-[#ff2830] text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingLicense ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4" />
                      )}
                      <span>توليد مفتاح الترخيص المشفر</span>
                    </button>
                  </div>
                </form>

                {/* Generated License Result Box */}
                {generatedKeyResult && (
                  <div className="mt-4 pt-4 border-t border-stone-800 animate-fadeIn space-y-3">
                    <div className="bg-stone-950 border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-stone-400 block font-semibold">مفتاح الترخيص المُولد:</span>
                        <span className="font-mono text-base font-black text-amber-400 select-all tracking-wider">
                          {generatedKeyResult}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedKeyResult);
                            setCopiedLicenseKey(true);
                            setTimeout(() => setCopiedLicenseKey(false), 2000);
                          }}
                          className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          {copiedLicenseKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                          <span>{copiedLicenseKey ? 'تم النسخ!' : 'نسخ الكود'}</span>
                        </button>

                        {generatedWhatsappMsg && (
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(generatedWhatsappMsg)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>إرسال واتساب للعميل</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tracked Devices List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-[#D71920]" />
                    <span>أجهزة العملاء المتصلة والتحكم المباشر ({trackedDevices.length})</span>
                  </h4>

                  <button
                    type="button"
                    onClick={fetchLicenses}
                    disabled={isLoadingLicenses}
                    className="p-1 text-stone-500 hover:text-stone-800 rounded-lg transition-colors cursor-pointer"
                    title="تحديث القائمة"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLicenses ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {trackedDevices.length === 0 ? (
                  <div className="p-6 text-center text-xs text-stone-500 bg-stone-50 rounded-2xl border border-stone-200">
                    لا توجد أجهزة مسجلة حتى الآن.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trackedDevices.map(device => {
                      const isExpired = device.status === 'expired';
                      const isActive = device.status === 'active';
                      const isTrial = device.status === 'trial';

                      return (
                        <div
                          key={device.deviceId}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                            isExpired
                              ? 'bg-red-50/70 border-red-200'
                              : isActive
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-black text-stone-900">
                                {device.deviceId}
                              </span>

                              {device.clientName && (
                                <span className="text-xs font-bold text-stone-700 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                                  {device.clientName}
                                </span>
                              )}

                              {isExpired && (
                                <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full">
                                  انتهت التجربة (مغلق)
                                </span>
                              )}

                              {isTrial && (
                                <span className="text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full">
                                  تجريبي نشط (24 ساعة)
                                </span>
                              )}

                              {isActive && (
                                <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <BadgeCheck className="w-3 h-3" />
                                  <span>مرخص ومفعل</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-stone-500 flex-wrap">
                              <span>الجهاز: <strong>{device.deviceName}</strong></span>
                              <span>الـ IP: <strong className="font-mono">{device.ip}</strong></span>
                              <span>
                                {isActive
                                  ? 'حالة الترخيص: مفعل'
                                  : isExpired
                                  ? 'انتهت فترة الـ 24 ساعة'
                                  : `متبقي: ${Math.round(device.remainingMs / 3600000)} ساعة`}
                              </span>
                            </div>
                          </div>

                          {/* Quick Actions Buttons for Admin */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleRemoteAction('extend_trial', device.deviceId, 24)}
                              disabled={actionLoadingDeviceId === device.deviceId}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                              title="تمديد التجربة 24 ساعة إضافية"
                            >
                              ⏱️ +24س
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoteAction('instant_activate', device.deviceId)}
                              disabled={actionLoadingDeviceId === device.deviceId}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                              title="تفعيل مباشر لسنة كاملة بضغطة زر"
                            >
                              ⚡ تفعيل سنوي فوري
                            </button>

                            {isActive && (
                              <button
                                type="button"
                                onClick={() => handleRemoteAction('revoke', device.deviceId)}
                                disabled={actionLoadingDeviceId === device.deviceId}
                                className="p-1 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                                title="إلغاء التفعيل وحظر الجهاز"
                              >
                                <ShieldX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
