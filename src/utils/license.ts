import { DeviceLicenseInfo, GeneratedLicenseRecord, StoredDeviceEntry } from '../types';
import { getStoredToken } from './auth';

const DEVICE_ID_KEY = 'bk_hardware_device_id_v2';
const MASTER_CONTACT_PHONE = '01100051593';

// Generate or retrieve persistent Hardware / Browser Fingerprint ID
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.startsWith('BK-DEV-')) {
      return existing;
    }

    // Generate hardware fingerprint component
    const nav = typeof window !== 'undefined' ? window.navigator : ({} as any);
    const scr = typeof window !== 'undefined' ? window.screen : ({} as any);

    const fpRaw = [
      nav.userAgent || '',
      nav.platform || '',
      nav.hardwareConcurrency || '4',
      scr.width || '1920',
      scr.height || '1080',
      scr.colorDepth || '24',
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo',
    ].join('###');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < fpRaw.length; i++) {
      hash = (hash << 5) - hash + fpRaw.charCodeAt(i);
      hash |= 0;
    }
    const hashHex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    const randomHex = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');

    const generatedId = `BK-DEV-${hashHex.slice(0, 4)}-${hashHex.slice(4, 8)}-${randomHex}`;
    localStorage.setItem(DEVICE_ID_KEY, generatedId);
    return generatedId;
  } catch {
    const fallback = 'BK-DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    return fallback;
  }
}

// 1. Check License Status
export async function apiCheckLicense(deviceId?: string): Promise<DeviceLicenseInfo> {
  const finalId = deviceId || getOrCreateDeviceId();
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`/api/license/status?deviceId=${encodeURIComponent(finalId)}`, {
      headers,
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return data;
    }
  } catch (err) {
    console.error('License check network error', err);
  }

  // Fallback offline trial response
  return {
    deviceId: finalId,
    status: 'trial',
    isExpired: false,
    trialStartedAt: Date.now(),
    trialExpiresAt: Date.now() + 24 * 3600 * 1000,
    remainingMs: 24 * 3600 * 1000,
    priceEgp: 5000,
    planType: 'trial',
    contactPhone: MASTER_CONTACT_PHONE,
    isMaster: false,
  };
}

// 2. Activate License Key
export async function apiActivateLicense(
  licenseKey: string,
  clientName?: string,
  deviceId?: string
): Promise<{ success: boolean; message: string; planType?: string; expiresAt?: number }> {
  const finalId = deviceId || getOrCreateDeviceId();

  try {
    const res = await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: finalId,
        licenseKey,
        clientName,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'تم تفعيل النسخة الكاملة بنجاح!',
        planType: data.planType,
        expiresAt: data.licenseExpiresAt,
      };
    }
    return {
      success: false,
      message: data.error || 'كود الترخيص غير صحيح أو منتهي.',
    };
  } catch {
    return {
      success: false,
      message: 'تعذر الاتصال بالسيرفر السحابي للتحقق من الترخيص.',
    };
  }
}

// 3. Master PIN Instant Bypass
export async function apiMasterPinBypass(
  pinCode: string,
  deviceId?: string
): Promise<{ success: boolean; message?: string; token?: string; user?: any; error?: string }> {
  const finalId = deviceId || getOrCreateDeviceId();

  try {
    const res = await fetch('/api/license/master-bypass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinCode,
        deviceId: finalId,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return data;
    }
    return {
      success: false,
      error: data.error || 'الرقم السري للمدير غير صحيح.',
    };
  } catch {
    return {
      success: false,
      error: 'تعذر الاتصال بالسيرفر.',
    };
  }
}

// 4. Admin: Generate License
export async function apiAdminGenerateLicense(payload: {
  deviceId: string;
  clientName: string;
  planType: string;
  durationDays: number;
  priceEgp: number;
  notes?: string;
}): Promise<{
  success: boolean;
  licenseKey?: string;
  whatsappMessage?: string;
  record?: GeneratedLicenseRecord;
  error?: string;
}> {
  const token = getStoredToken();
  try {
    const res = await fetch('/api/license/admin/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch {
    return { success: false, error: 'تعذر توليد المفتاح عبر السيرفر.' };
  }
}

// 5. Admin: Get Devices & Licenses
export async function apiAdminGetDevices(): Promise<{
  success: boolean;
  totalDevices?: number;
  activeCount?: number;
  trialCount?: number;
  expiredCount?: number;
  devices?: StoredDeviceEntry[];
  licenses?: GeneratedLicenseRecord[];
  error?: string;
}> {
  const token = getStoredToken();
  try {
    const res = await fetch('/api/license/admin/devices', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    return data;
  } catch {
    return { success: false, error: 'تعذر جلب الأجهزة والتراخيص.' };
  }
}

// 6. Admin: Remote Action
export async function apiAdminDeviceAction(
  action: 'extend_trial' | 'instant_activate' | 'revoke',
  deviceId: string,
  extraHours = 24,
  clientName?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const token = getStoredToken();
  try {
    const res = await fetch('/api/license/admin/device-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        deviceId,
        extraHours,
        clientName,
      }),
    });
    const data = await res.json();
    return data;
  } catch {
    return { success: false, error: 'تعذر تنفيذ الإجراء على الجهاز.' };
  }
}

// Formatting Helper: Arabic countdown
export function formatRemainingTime(ms: number): { text: string; hours: number; minutes: number; seconds: number } {
  if (ms <= 0) {
    return { text: 'انتهت الفترة التجريبية', hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return { text: `متبقي ${days} يوم و ${hours % 24} ساعة`, hours, minutes, seconds };
  }

  return { text: `متبقي ${hours} ساعة و ${minutes} دقيقة`, hours, minutes, seconds };
}

// WhatsApp Direct Purchase URL
export function getWhatsAppPurchaseUrl(deviceId: string, priceEgp = 5000): string {
  const phone = '201100051593';
  const text = encodeURIComponent(
    `السلام عليكم م/ محمد،\nأرغب في شراء ترخيص منظومة BURGER KING & Talabat Audit Suite (قيمة الترخيص: ${priceEgp.toLocaleString()} ج.م).\n\n📱 كود جهازي هو:\n${deviceId}\n\nيرجى تزويدي ببيانات الدفع ومفتاح التفعيل.`
  );
  return `https://wa.me/${phone}?text=${text}`;
}
