import React, { useState, useEffect, useRef } from 'react';
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
  apiGetAdminNotifications,
  apiMarkNotificationRead,
  apiDeleteNotification,
  apiClearNotifications,
  subscribeToLicenseEvents,
  formatRemainingTime,
} from '../utils/license';
import {
  StoredDeviceEntry,
  GeneratedLicenseRecord,
  AdminNotification,
  DeviceHistoryEvent,
} from '../types';
import {
  ShieldCheck,
  KeyRound,
  Check,
  X,
  BadgeCheck,
  LogOut,
  AlertCircle,
  Cloud,
  Laptop,
  Radio,
  RefreshCw,
  Clock,
  CheckCircle2,
  Crown,
  Sparkles,
  Copy,
  MessageSquare,
  ShieldX,
  Lock,
  Unlock,
  Bell,
  BellRing,
  Trash2,
  History,
  MapPin,
  ExternalLink,
  Plus,
  RotateCcw,
  Send,
  Phone,
  Layers,
  ChevronDown,
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

  const [activeTab, setActiveTab] = useState<'licenses' | 'notifications' | 'sessions' | 'security'>('licenses');

  // Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState(currentUser.name);

  // Active Master Sessions
  const [sessions, setSessions] = useState<ActiveSessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);
  const [isTerminatingAll, setIsTerminatingAll] = useState(false);

  // Tracked Client Devices & Licenses
  const [trackedDevices, setTrackedDevices] = useState<StoredDeviceEntry[]>([]);
  const [storedLicenses, setStoredLicenses] = useState<GeneratedLicenseRecord[]>([]);
  const [isLoadingLicenses, setIsLoadingLicenses] = useState(false);
  const [actionLoadingDeviceId, setActionLoadingDeviceId] = useState<string | null>(null);

  // Selected duration per device for quick activation/extension
  const [deviceSelectedDuration, setDeviceSelectedDuration] = useState<Record<string, number>>({});
  const [customDurationInput, setCustomDurationInput] = useState<Record<string, string>>({});

  // History Modal State
  const [viewHistoryDevice, setViewHistoryDevice] = useState<StoredDeviceEntry | null>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Official License Generator State
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

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Audio Chime helper for instant real-time alerts
  const playAlertSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {}
  };

  // Fetch all tracked devices
  const fetchLicenses = async () => {
    setIsLoadingLicenses(true);
    try {
      const res = await apiAdminGetDevices();
      if (res.success) {
        setTrackedDevices(res.devices || []);
        setStoredLicenses(res.licenses || []);
      }
    } catch {
      console.warn('Failed to load devices list');
    } finally {
      setIsLoadingLicenses(false);
    }
  };

  // Fetch admin notifications
  const fetchNotifications = async () => {
    setIsLoadingNotifications(true);
    try {
      const res = await apiGetAdminNotifications();
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadNotificationsCount(res.unreadCount || 0);
      }
    } catch {
      console.warn('Failed to load notifications');
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  // Fetch master sessions
  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await apiGetActiveSessions();
      if (res.success && res.sessions) {
        setSessions(res.sessions);
      }
    } catch {
      console.warn('Failed to load sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Subscribe to real-time events via SSE
  useEffect(() => {
    if (!isOpen) return;

    fetchLicenses();
    fetchNotifications();
    fetchSessions();

    const unsubscribe = subscribeToLicenseEvents((type, data) => {
      if (type === 'device_request') {
        playAlertSound();
        fetchLicenses();
        fetchNotifications();
      } else if (type === 'device_updated' || type === 'device_reset') {
        fetchLicenses();
        fetchNotifications();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  // Handle Remote Device Action (Lock, Activate, Add Time, Reset, Reject)
  const handleRemoteAction = async (
    action: 'lock' | 'activate' | 'add_time' | 'reset' | 'reject_request' | 'extend_trial' | 'instant_activate' | 'revoke',
    deviceId: string,
    params?: { durationMinutes?: number; addMinutes?: number; clientName?: string; notes?: string; extraHours?: number }
  ) => {
    setActionLoadingDeviceId(deviceId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await apiAdminDeviceAction(action, deviceId, params);
      if (res.success) {
        setSuccessMessage(res.message || 'تم تنفيذ الإجراء بنجاح.');
        fetchLicenses();
        fetchNotifications();
        setTimeout(() => setSuccessMessage(''), 3500);
      } else {
        setErrorMessage(res.error || 'فشل تنفيذ الإجراء.');
      }
    } catch {
      setErrorMessage('خطأ أثناء الاتصال بالسيرفر السحابي.');
    } finally {
      setActionLoadingDeviceId(null);
    }
  };

  // Helper to get chosen duration for a device (defaults to 60 minutes)
  const getDeviceDuration = (deviceId: string): number => {
    if (customDurationInput[deviceId]) {
      const customNum = Number(customDurationInput[deviceId]);
      if (customNum > 0) return customNum;
    }
    return deviceSelectedDuration[deviceId] || 60;
  };

  // Generate License Key
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

  // Mark all notifications as read
  const handleMarkAllNotificationsRead = async () => {
    await apiMarkNotificationRead();
    fetchNotifications();
  };

  // Clear all notifications
  const handleClearAllNotifications = async () => {
    if (!window.confirm('هل تريد مسح جميع الإشعارات السابقة؟')) return;
    await apiClearNotifications();
    fetchNotifications();
  };

  // Delete single notification
  const handleDeleteNotification = async (id: string) => {
    await apiDeleteNotification(id);
    fetchNotifications();
  };

  // Terminate specific admin session
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

  // Terminate all other admin sessions
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

  // Save Master Credentials
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
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setErrorMessage(res.error || 'فشل تحديث البيانات.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('حدث خطأ أثناء الاتصال بالسيرفر السحابي المركزي.');
    }
  };

  // Filter pending activation requests
  const pendingRequests = trackedDevices.filter(
    d => d.status === 'pending' || Boolean(d.pendingRequest)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/80 backdrop-blur-xs animate-fade-in" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#502314] via-[#7B2E18] to-[#D71920] p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-base sm:text-lg">{currentUser.name}</h3>
                <BadgeCheck className="w-4 h-4 text-blue-300" />
                <span className="text-[10px] font-black bg-amber-400 text-stone-950 px-2 py-0.5 rounded-md">
                  Master Admin
                </span>
              </div>
              <p className="text-xs text-orange-200 font-medium tracking-wide">
                لوحة تحكم المدير العام — إدارة وتفعيل أجهزة العملاء والأمان
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/30 hover:bg-red-600 text-red-100 hover:text-white border border-red-400/50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                title="تسجيل الخروج"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تسجيل خروج</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cloud Status Banner */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 sm:px-5 py-2 flex items-center justify-between text-xs text-amber-950 font-semibold shrink-0">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-[#D71920]" />
            <span>السحابة المركزية: <strong>نشطة ومزامنة لحظية (SSE)</strong></span>
          </div>
          <div className="flex items-center gap-3">
            {pendingRequests.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-black text-amber-900 bg-amber-200 px-2 py-0.5 rounded-full animate-pulse border border-amber-300">
                <Clock className="w-3 h-3 text-amber-700" />
                <span>{pendingRequests.length} طلب تفعيل معلق</span>
              </span>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-stone-700 bg-white px-2.5 py-0.5 rounded-full border border-amber-300 shadow-2xs">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              <span>أجهزة العملاء: <strong>{trackedDevices.length}</strong></span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 bg-stone-50/80 px-3 sm:px-4 pt-2 shrink-0 overflow-x-auto">
          {/* TAB 1: CLIENT DEVICES & ACTIVATION */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('licenses');
              fetchLicenses();
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'licenses'
                ? 'border-[#D71920] text-[#D71920] bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Laptop className="w-4 h-4 text-[#D71920]" />
            <span>أجهزة العملاء والتفعيل</span>
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-600 text-white animate-bounce">
                {pendingRequests.length}
              </span>
            )}
            <span className="px-2 py-0.2 rounded-full text-[11px] font-bold bg-stone-200 text-stone-700">
              {trackedDevices.length}
            </span>
          </button>

          {/* TAB 2: REAL NOTIFICATIONS */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('notifications');
              fetchNotifications();
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'notifications'
                ? 'border-[#D71920] text-[#D71920] bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-500" />
            <span>الإشعارات الحية</span>
            {unreadNotificationsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-stone-950">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* TAB 3: ADMIN ACTIVE SESSIONS */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('sessions');
              fetchSessions();
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'sessions'
                ? 'border-[#D71920] text-[#D71920] bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Radio className="w-4 h-4 text-stone-600" />
            <span>جلسات الآدمن</span>
            <span className="px-2 py-0.2 rounded-full text-[11px] font-bold bg-stone-200 text-stone-600">
              {sessions.length}
            </span>
          </button>

          {/* TAB 4: SECURITY & CREDENTIALS */}
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'security'
                ? 'border-[#D71920] text-[#D71920] bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>أمان الحساب</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
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

          {/* ========================================================================= */}
          {/* TAB 1: CLIENT DEVICES & ACTIVATION MANAGEMENT */}
          {/* ========================================================================= */}
          {activeTab === 'licenses' && (
            <div className="space-y-6">
              {/* 1. PENDING ACTIVATION REQUESTS (HIGHLIGHTED BOX) */}
              {pendingRequests.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black">
                        <BellRing className="w-4 h-4 animate-bounce" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-amber-950">
                          طلبات التفعيل المعلقة من أجهزة العملاء ({pendingRequests.length})
                        </h4>
                        <p className="text-xs text-amber-800 font-medium">
                          أجهزة قامت بطلب التفعيل — حدد مدة التفعيل واضغط للموافقة الفورية
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {pendingRequests.map(device => {
                      const req = device.pendingRequest;
                      const duration = getDeviceDuration(device.deviceId);

                      return (
                        <div
                          key={`pending-${device.deviceId}`}
                          className="bg-white border border-amber-300 rounded-xl p-4 shadow-xs space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-2.5">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-black text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-300">
                                  {device.deviceId}
                                </span>
                                {(req?.clientName || device.clientName) && (
                                  <span className="text-xs font-bold text-stone-800 bg-amber-100 px-2 py-0.5 rounded-md">
                                    {req?.clientName || device.clientName}
                                  </span>
                                )}
                                <span className="text-[10px] font-black bg-amber-500 text-stone-950 px-2 py-0.5 rounded-full animate-pulse">
                                  طلب تفعيل جديد
                                </span>
                              </div>

                              <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-3 flex-wrap">
                                <span>الجهاز: <strong>{device.deviceName}</strong></span>
                                <span>الـ IP: <strong className="font-mono">{device.ip}</strong></span>
                                {req?.phone && (
                                  <a
                                    href={`tel:${req.phone}`}
                                    className="text-emerald-700 hover:underline flex items-center gap-1 font-bold"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{req.phone}</span>
                                  </a>
                                )}
                                {req?.notes && (
                                  <span className="text-stone-600 bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                                    ملاحظة العميل: &quot;{req.notes}&quot;
                                  </span>
                                )}
                              </div>

                              {/* Location Data */}
                              {device.location && (
                                <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                  {device.location.permissionStatus === 'granted' && device.location.latitude ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-stone-700 font-medium">
                                        الموقع: {device.location.address || `${device.location.latitude.toFixed(4)}, ${device.location.longitude?.toFixed(4)}`}
                                      </span>
                                      <a
                                        href={`https://www.google.com/maps?q=${device.location.latitude},${device.location.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline font-bold flex items-center gap-1"
                                      >
                                        <span>عرض على خرائط Google</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  ) : (
                                    <span className="text-stone-400">الموقع الجغرافي: غير متاح (لم يمنح العميل الإذن)</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* History button */}
                            <button
                              type="button"
                              onClick={() => setViewHistoryDevice(device)}
                              className="self-end sm:self-center px-2.5 py-1 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>سجل الجهاز</span>
                            </button>
                          </div>

                          {/* Quick Duration Buttons Selector for Approval */}
                          <div>
                            <span className="text-[11px] font-bold text-stone-700 block mb-1.5">
                              اختر مدة التفعيل المعتمدة للجهاز:
                            </span>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                              {[
                                { label: '5 د', val: 5 },
                                { label: '15 د', val: 15 },
                                { label: '30 د', val: 30 },
                                { label: '1 س', val: 60 },
                                { label: '2 س', val: 120 },
                                { label: '6 س', val: 360 },
                                { label: '12 س', val: 720 },
                                { label: '24 س', val: 1440 },
                              ].map(item => (
                                <button
                                  type="button"
                                  key={item.val}
                                  onClick={() => {
                                    setDeviceSelectedDuration(prev => ({ ...prev, [device.deviceId]: item.val }));
                                    setCustomDurationInput(prev => ({ ...prev, [device.deviceId]: '' }));
                                  }}
                                  className={`py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer text-center ${
                                    duration === item.val && !customDurationInput[device.deviceId]
                                      ? 'bg-amber-500 text-stone-950 border-amber-400 font-black shadow-xs'
                                      : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>

                            {/* Custom duration field */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[10px] text-stone-500">أو مدة مخصصة (بالدقائق):</span>
                              <input
                                type="number"
                                placeholder="مثال: 90"
                                value={customDurationInput[device.deviceId] || ''}
                                onChange={e => {
                                  setCustomDurationInput(prev => ({ ...prev, [device.deviceId]: e.target.value }));
                                }}
                                className="w-24 px-2 py-0.5 text-xs font-mono border border-stone-300 rounded-md focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Approval Actions */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleRemoteAction('reject_request', device.deviceId)}
                              disabled={actionLoadingDeviceId === device.deviceId}
                              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-stone-300"
                            >
                              رفض الطلب
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleRemoteAction('activate', device.deviceId, {
                                  durationMinutes: duration,
                                  clientName: req?.clientName || device.clientName,
                                })
                              }
                              disabled={actionLoadingDeviceId === device.deviceId}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {actionLoadingDeviceId === device.deviceId ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                              <span>موافقة وتفعيل لمدة {duration >= 60 ? `${(duration / 60).toFixed(1)} س` : `${duration} د`}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. ALL TRACKED DEVICES LIST */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-[#D71920]" />
                    <span>أجهزة العملاء المتصلة والتحكم المباشر ({trackedDevices.length})</span>
                  </h4>

                  <button
                    type="button"
                    onClick={fetchLicenses}
                    disabled={isLoadingLicenses}
                    className="p-1.5 text-stone-500 hover:text-stone-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                    title="تحديث القائمة"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLicenses ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">تحديث</span>
                  </button>
                </div>

                {trackedDevices.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-500 bg-stone-50 rounded-2xl border border-stone-200">
                    لا توجد أجهزة مسجلة حتى الآن. ستظهر الأجهزة هنا تلقائياً عند فتح المنظومة من قِبل العملاء.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trackedDevices.map(device => {
                      const isLocked = device.status === 'locked' || device.status === 'expired' || device.remainingMs <= 0;
                      const isActive = device.status === 'active' && device.isActivated && device.remainingMs > 0;
                      const isPending = device.status === 'pending' || Boolean(device.pendingRequest);
                      const duration = getDeviceDuration(device.deviceId);

                      const remTime = formatRemainingTime(device.remainingMs || 0);

                      return (
                        <div
                          key={device.deviceId}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            isLocked
                              ? 'bg-red-50/60 border-red-200'
                              : isPending
                              ? 'bg-amber-50/70 border-amber-300'
                              : isActive
                              ? 'bg-emerald-50/60 border-emerald-200'
                              : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          {/* Device Header Info */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-black text-stone-900 bg-white px-2 py-0.5 rounded-md border border-stone-300">
                                  {device.deviceId}
                                </span>

                                {device.clientName && (
                                  <span className="text-xs font-bold text-stone-800 bg-white px-2 py-0.5 rounded-md border border-stone-200">
                                    {device.clientName}
                                  </span>
                                )}

                                {isLocked && (
                                  <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    <span>مقفول (يحتاج تفعيل)</span>
                                  </span>
                                )}

                                {isPending && (
                                  <span className="text-[10px] font-black bg-amber-500 text-stone-950 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                    <Clock className="w-3 h-3" />
                                    <span>طلب تفعيل معلق</span>
                                  </span>
                                )}

                                {isActive && (
                                  <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <BadgeCheck className="w-3 h-3" />
                                    <span>مفعل ونشط</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-stone-500 flex-wrap mt-1">
                                <span>الجهاز: <strong>{device.deviceName}</strong></span>
                                <span>الـ IP: <strong className="font-mono">{device.ip}</strong></span>
                                <span>عدد التفعيلات: <strong>{device.activationCount || 0}</strong></span>
                                {isActive && (
                                  <span className="text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.2 rounded border border-emerald-300 font-mono">
                                    ⏱️ {remTime.text}
                                  </span>
                                )}
                              </div>

                              {/* Geolocation data */}
                              {device.location && (
                                <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                                  <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                  {device.location.permissionStatus === 'granted' && device.location.latitude ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-stone-700">
                                        الموقع: {device.location.address || `${device.location.latitude.toFixed(4)}, ${device.location.longitude?.toFixed(4)}`}
                                      </span>
                                      <a
                                        href={`https://www.google.com/maps?q=${device.location.latitude},${device.location.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline font-bold flex items-center gap-1"
                                      >
                                        <span>خرائط Google</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  ) : (
                                    <span className="text-stone-400">الموقع: غير متاح (لم يمنح العميل الإذن)</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* View History Button */}
                            <button
                              type="button"
                              onClick={() => setViewHistoryDevice(device)}
                              className="px-2.5 py-1 text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-2xs"
                            >
                              <History className="w-3.5 h-3.5 text-stone-600" />
                              <span>سجل الجهاز ({device.history?.length || 0})</span>
                            </button>
                          </div>

                          {/* DURATION PICKER & ACTIONS BAR */}
                          <div className="pt-2 border-t border-stone-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            {/* Duration Presets */}
                            <div className="space-y-1">
                              <span className="text-[10px] text-stone-500 block font-semibold">
                                تحديد مدة التفعيل أو التمديد:
                              </span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {[
                                  { label: '5 د', val: 5 },
                                  { label: '15 د', val: 15 },
                                  { label: '30 د', val: 30 },
                                  { label: '1 س', val: 60 },
                                  { label: '2 س', val: 120 },
                                  { label: '6 س', val: 360 },
                                  { label: '12 س', val: 720 },
                                  { label: '24 س', val: 1440 },
                                ].map(item => (
                                  <button
                                    type="button"
                                    key={item.val}
                                    onClick={() => {
                                      setDeviceSelectedDuration(prev => ({ ...prev, [device.deviceId]: item.val }));
                                      setCustomDurationInput(prev => ({ ...prev, [device.deviceId]: '' }));
                                    }}
                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                                      duration === item.val && !customDurationInput[device.deviceId]
                                        ? 'bg-amber-500 text-stone-950 border-amber-400 font-black'
                                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}

                                <input
                                  type="number"
                                  placeholder="مخصص"
                                  value={customDurationInput[device.deviceId] || ''}
                                  onChange={e => {
                                    setCustomDurationInput(prev => ({ ...prev, [device.deviceId]: e.target.value }));
                                  }}
                                  className="w-16 px-1.5 py-0.5 text-[10px] font-mono border border-stone-300 rounded bg-white text-center focus:outline-none focus:border-amber-500"
                                  title="مدة مخصصة بالدقائق"
                                />
                              </div>
                            </div>

                            {/* Control Action Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                              {/* 1. Add Time / Activate Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (isActive) {
                                    handleRemoteAction('add_time', device.deviceId, { addMinutes: duration });
                                  } else {
                                    handleRemoteAction('activate', device.deviceId, { durationMinutes: duration });
                                  }
                                }}
                                disabled={actionLoadingDeviceId === device.deviceId}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                                title={isActive ? 'إضافة وقت إضافي للجهاز دون قفله' : 'تفعيل الجهاز بالمدة المحددة'}
                              >
                                {isActive ? (
                                  <>
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ إضافة وقت ({duration >= 60 ? `${(duration / 60).toFixed(1)} س` : `${duration} د`})</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>تفعيل ({duration >= 60 ? `${(duration / 60).toFixed(1)} س` : `${duration} د`})</span>
                                  </>
                                )}
                              </button>

                              {/* 2. Lock Device Button */}
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoteAction('lock', device.deviceId, { notes: 'قفل يدوي من الإدارة' })}
                                  disabled={actionLoadingDeviceId === device.deviceId}
                                  className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="قفل الجهاز فوراً ومنعه من العمل"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>قفل الجهاز</span>
                                </button>
                              )}

                              {/* 3. Reset Device Button (Clears / Resets and locks immediately) */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `⚠️ تأكيد مسح الجهاز (Reset):\n\nهل تريد تأكيد مسح الجهاز (${device.deviceId})؟\n- سيتم قفل الجهاز فوراً على شاشة العميل.\n- سيتم إلغاء صلاحية الترخيص الحالية.\n- سيتم الاحتفاظ بسجل الجهاز وتاريخه للرجوع إليه لاحقاً.\n- يمكنك إعادة تفعيله في أي وقت.`
                                    )
                                  ) {
                                    handleRemoteAction('reset', device.deviceId);
                                  }
                                }}
                                disabled={actionLoadingDeviceId === device.deviceId}
                                className="p-1.5 text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-stone-300 transition-colors cursor-pointer"
                                title="مسح الجهاز (Reset Device) وقفله فوراً مع حفظ السجل"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. OFFICIAL ENCRYPTED LICENSE GENERATOR */}
              <div className="bg-stone-900 text-white rounded-2xl p-5 border border-stone-800 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-black text-white">توليد مفتاح ترخيص رسمي ومشفر للعميل</h4>
                      <p className="text-xs text-stone-400">
                        قم بتوليد مفتاح تفعيل سنوي أو دائم مع رسالة واتساب جاهزة للإرسال للعميل
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleGenerateLicenseKey} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-300 mb-1">
                        كود جهاز العميل (Device ID):
                      </label>
                      <input
                        type="text"
                        value={genDeviceId}
                        onChange={e => setGenDeviceId(e.target.value.toUpperCase())}
                        placeholder="BK-DEV-XXXX-XXXX-XXXX أو UNIVERSAL"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs font-mono text-amber-400 placeholder:text-stone-600 focus:border-amber-500 focus:outline-none"
                        dir="ltr"
                        required
                      />

                      {/* Quick pick from detected devices */}
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-stone-500">اختر جهاز:</span>
                        {trackedDevices.map(d => (
                          <button
                            type="button"
                            key={d.deviceId}
                            onClick={() => {
                              setGenDeviceId(d.deviceId);
                              if (d.clientName) setGenClientName(d.clientName);
                            }}
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer border ${
                              genDeviceId === d.deviceId
                                ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold'
                                : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                            }`}
                          >
                            {d.deviceId.slice(-8)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-300 mb-1">
                        اسم العميل أو الفرع:
                      </label>
                      <input
                        type="text"
                        value={genClientName}
                        onChange={e => setGenClientName(e.target.value)}
                        placeholder="مثال: برجر كنج فرع المعادي"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white placeholder:text-stone-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

                    <div>
                      <label className="block text-[11px] font-bold text-stone-300 mb-1">المبلغ المحصل (ج.م):</label>
                      <input
                        type="number"
                        value={genPrice}
                        onChange={e => setGenPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs font-bold text-emerald-400 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

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
                  <div className="mt-4 pt-4 border-t border-stone-800 space-y-3">
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
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: REAL NOTIFICATIONS HUB */}
          {/* ========================================================================= */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-500" />
                  <div>
                    <h4 className="text-sm font-black text-stone-900">سجل الإشعارات والتنبيهات الحية</h4>
                    <p className="text-xs text-stone-500">
                      إشعارات فورية لطلبات التفعيل، القفل، وإعادة التعيين لجميع أجهزة المنظومة
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllNotifications}
                      className="px-3 py-1.5 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>مسح الكل</span>
                    </button>
                  )}
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500 bg-stone-50 rounded-2xl border border-stone-200">
                  لا توجد إشعارات جديدة حالياً.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map(notif => {
                    const isRequest = notif.type === 'activation_request';
                    const isLocked = notif.type === 'device_locked';
                    const isReset = notif.type === 'device_reset';
                    const isActivated = notif.type === 'device_activated';

                    return (
                      <div
                        key={notif.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                          !notif.read ? 'bg-amber-50/80 border-amber-300' : 'bg-stone-50/70 border-stone-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isRequest
                                ? 'bg-amber-500 text-stone-950 font-black'
                                : isLocked
                                ? 'bg-red-500 text-white'
                                : isReset
                                ? 'bg-stone-700 text-white'
                                : 'bg-emerald-500 text-white'
                            }`}
                          >
                            {isRequest ? (
                              <Send className="w-4 h-4" />
                            ) : isLocked ? (
                              <Lock className="w-4 h-4" />
                            ) : isReset ? (
                              <RotateCcw className="w-4 h-4" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-stone-900">{notif.title}</span>
                              {!notif.read && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-ping" />
                              )}
                              <span className="font-mono text-[10px] text-stone-500 bg-white px-1.5 py-0.2 rounded border border-stone-200">
                                {notif.deviceId}
                              </span>
                            </div>

                            <p className="text-xs text-stone-700 leading-relaxed">{notif.message}</p>

                            <div className="flex items-center gap-3 text-[10px] text-stone-400">
                              <span>{new Date(notif.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>{new Date(notif.createdAt).toLocaleDateString('ar-EG')}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteNotification(notif.id)}
                          className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="حذف الإشعار"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ADMIN ACTIVE SESSIONS */}
          {/* ========================================================================= */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-stone-600 font-semibold">
                  المتصفحات المسجلة حالياً بحساب المدير العام:
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchSessions}
                    disabled={isLoadingSessions}
                    className="p-1 text-stone-500 hover:text-stone-800 rounded-lg transition-colors cursor-pointer"
                    title="تحديث قائمة الأجهزة"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
                  </button>

                  {sessions.filter(s => !s.isCurrent).length > 0 && (
                    <button
                      type="button"
                      onClick={handleTerminateAllDevices}
                      disabled={isTerminatingAll}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isTerminatingAll ? 'جاري الطرد...' : `طرد جميع الأجهزة الأخرى (${sessions.filter(s => !s.isCurrent).length})`}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      session.isCurrent ? 'bg-amber-50/80 border-amber-300' : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{session.deviceName}</span>
                        {session.isCurrent && (
                          <span className="text-[10px] font-black bg-amber-500 text-stone-950 px-2 py-0.5 rounded-full">
                            هذا الجهاز الحالي
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 flex items-center gap-3 flex-wrap">
                        <span>الـ IP: <strong className="font-mono">{session.ip}</strong></span>
                        <span>آخر نشاط: {new Date(session.lastActiveAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {!session.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleTerminateSession(session.id, session.deviceName)}
                        disabled={terminatingSessionId === session.id}
                        className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors cursor-pointer"
                      >
                        {terminatingSessionId === session.id ? 'جاري الطرد...' : 'طرد هذا الجهاز'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: SECURITY & CREDENTIALS */}
          {/* ========================================================================= */}
          {activeTab === 'security' && (
            <form onSubmit={handleSaveSecurity} className="space-y-4 max-w-lg mx-auto">
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1 font-medium">
                <div className="font-black flex items-center gap-1.5 text-amber-900">
                  <KeyRound className="w-4 h-4 text-[#D71920]" />
                  <span>تحديث بيانات دخول المدير العام</span>
                </div>
                <p>
                  عند تغيير كلمة المرور، سيتم فوراً طرد وتسجيل خروج جميع الأجهزة والجلسات الأخرى لحماية المنظومة.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">اسم العرض:</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">اسم المستخدم (Username):</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">كلمة المرور الحالية للتأكيد:</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">كلمة المرور الجديدة (اختياري):</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="اتركها فارغة إذا لم ترد التغيير"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">تأكيد كلمة المرور الجديدة:</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابتها للتأكيد"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-[#D71920] hover:from-amber-400 hover:to-[#ff2830] text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'جاري الحفظ...' : 'حفظ التعديلات الأمنية'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEVICE HISTORY MODAL */}
      {/* ========================================================================= */}
      {viewHistoryDevice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 relative space-y-4 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center font-black">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900">سجل نشاط وتاريخ الجهاز</h3>
                  <span className="font-mono text-xs font-bold text-amber-600 select-all">
                    {viewHistoryDevice.deviceId}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewHistoryDevice(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block">أول ظهور</span>
                <span className="text-xs font-bold text-stone-800">
                  {new Date(viewHistoryDevice.firstSeenAt).toLocaleDateString('ar-EG')}
                </span>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block">آخر نشاط</span>
                <span className="text-xs font-bold text-stone-800">
                  {new Date(viewHistoryDevice.lastSeenAt).toLocaleDateString('ar-EG')}
                </span>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 block">مرات التفعيل</span>
                <span className="text-xs font-black text-emerald-600">
                  {viewHistoryDevice.activationCount || 0}
                </span>
              </div>
            </div>

            {/* Timeline of events */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {viewHistoryDevice.history && viewHistoryDevice.history.length > 0 ? (
                viewHistoryDevice.history.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900">
                        {item.action === 'activated'
                          ? '✅ تم تفعيل الجهاز'
                          : item.action === 'locked'
                          ? '🔒 تم قفل الجهاز'
                          : item.action === 'reset'
                          ? '🔄 إعادة تعيين / مسح الجهاز'
                          : item.action === 'time_added'
                          ? '⏱️ تم إضافة وقت للجهاز'
                          : item.action === 'request_activation'
                          ? '📩 طلب تفعيل من العميل'
                          : 'ث تسجيل الجهاز في المنظومة'}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {new Date(item.timestamp).toLocaleString('ar-EG')}
                      </span>
                    </div>

                    {item.details && <p className="text-[11px] text-stone-600">{item.details}</p>}

                    {item.performedBy && (
                      <span className="text-[10px] text-stone-400 block">بواسطة: {item.performedBy}</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-stone-400">لا يوجد سجل تاريخي مسجل لهذا الجهاز حتى الآن.</div>
              )}
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewHistoryDevice(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق السجل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
