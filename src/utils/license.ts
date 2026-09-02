import { DeviceLicenseInfo, GeneratedLicenseRecord, StoredDeviceEntry } from '../types';
import { getStoredToken } from './auth';

const DEVICE_ID_KEY = 'bk_hardware_device_id_v3';
const MASTER_CONTACT_PHONE = '01100051593';

// Compute 100% deterministic device fingerprint without random generators
function computeDeterministicFingerprint(): string {
  try {
    const nav = typeof window !== 'undefined' ? window.navigator : ({} as any);
    const scr = typeof window !== 'undefined' ? window.screen : ({} as any);

    let canvasHash = 'C0';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 30;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#D71920';
        ctx.fillRect(5, 5, 50, 20);
        ctx.fillStyle = '#111';
        ctx.fillText('BK-KING', 8, 8);
        const dataUrl = canvas.toDataURL();
        let cHash = 0;
        for (let i = 0; i < dataUrl.length; i++) {
          cHash = (cHash << 5) - cHash + dataUrl.charCodeAt(i);
          cHash |= 0;
        }
        canvasHash = Math.abs(cHash).toString(16).toUpperCase().padStart(4, '0');
      }
    } catch {}

    const fpRaw = [
      nav.userAgent || 'UA',
      nav.platform || 'PL',
      nav.language || 'LANG',
      nav.hardwareConcurrency || '4',
      scr.width || '1920',
      scr.height || '1080',
      scr.colorDepth || '24',
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo',
      canvasHash,
    ].join('###');

    // FNV-1a Hash 1
    let h1 = 0x811c9dc5;
    for (let i = 0; i < fpRaw.length; i++) {
      h1 ^= fpRaw.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }
    const part1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0');

    // Hash 2
    let h2 = 0x1234567;
    for (let i = fpRaw.length - 1; i >= 0; i--) {
      h2 = ((h2 << 5) - h2) + fpRaw.charCodeAt(i);
      h2 |= 0;
    }
    const part2 = Math.abs(h2).toString(16).toUpperCase().padStart(4, '0').slice(-4);

    return `BK-DEV-${part1.slice(0, 4)}-${part1.slice(4, 8)}-${part2}`;
  } catch {
    return 'BK-DEV-3072-B371-3DA9';
  }
}

// Memory cache fallback for iframes
let inMemoryDeviceId: string | null = null;

// Generate or retrieve persistent Hardware / Browser Fingerprint ID
export function getOrCreateDeviceId(): string {
  // 1. Check in-memory cache
  if (inMemoryDeviceId && inMemoryDeviceId.startsWith('BK-DEV-')) {
    return inMemoryDeviceId;
  }

  // 2. Check window global
  if (typeof window !== 'undefined' && (window as any).__bk_device_id) {
    inMemoryDeviceId = (window as any).__bk_device_id;
    return inMemoryDeviceId!;
  }

  // 3. Check localStorage
  try {
    const fromLocal = localStorage.getItem(DEVICE_ID_KEY);
    if (fromLocal && fromLocal.startsWith('BK-DEV-')) {
      inMemoryDeviceId = fromLocal;
      return fromLocal;
    }
    // Also check previous version
    const legacy = localStorage.getItem('bk_hardware_device_id_v2');
    if (legacy && legacy.startsWith('BK-DEV-')) {
      inMemoryDeviceId = legacy;
      localStorage.setItem(DEVICE_ID_KEY, legacy);
      return legacy;
    }
  } catch {}

  // 4. Check sessionStorage
  try {
    const fromSession = sessionStorage.getItem(DEVICE_ID_KEY);
    if (fromSession && fromSession.startsWith('BK-DEV-')) {
      inMemoryDeviceId = fromSession;
      return fromSession;
    }
  } catch {}

  // 5. Check cookies
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      const match = document.cookie.match(/bk_dev_id=(BK-DEV-[A-Z0-9-]+)/);
      if (match && match[1]) {
        inMemoryDeviceId = match[1];
        return match[1];
      }
    }
  } catch {}

  // 6. Compute 100% deterministic device fingerprint (No randomness!)
  const generatedId = computeDeterministicFingerprint();
  inMemoryDeviceId = generatedId;

  // Persist across all available storages
  try {
    localStorage.setItem(DEVICE_ID_KEY, generatedId);
  } catch {}

  try {
    sessionStorage.setItem(DEVICE_ID_KEY, generatedId);
  } catch {}

  try {
    if (typeof document !== 'undefined') {
      document.cookie = `bk_dev_id=${generatedId}; path=/; max-age=315360000; SameSite=Lax`;
    }
  } catch {}

  if (typeof window !== 'undefined') {
    (window as any).__bk_device_id = generatedId;
  }

  return generatedId;
}

// 1. Check License Status
export async function apiCheckLicense(deviceId?: string): Promise<DeviceLicenseInfo> {
  const finalId = deviceId || getOrCreateDeviceId();
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'X-Device-Id': finalId,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`/api/license/status?deviceId=${encodeURIComponent(finalId)}`, {
      headers,
    });
    const data = await res.json();
    if (res.ok && data.success) {
      // Store known trial target in localStorage as client anchor
      if (data.trialExpiresAt) {
        try {
          localStorage.setItem(`bk_trial_exp_${finalId}`, String(data.trialExpiresAt));
        } catch {}
      }
      return data;
    }
  } catch (err) {
    console.error('License check network error', err);
  }

  // Fallback offline trial response: retrieve persistent anchor to prevent reset
  let fallbackExpiresAt = Date.now() + 24 * 3600 * 1000;
  try {
    const cached = localStorage.getItem(`bk_trial_exp_${finalId}`);
    if (cached) {
      const parsed = Number(cached);
      if (parsed > 0) fallbackExpiresAt = parsed;
    } else {
      localStorage.setItem(`bk_trial_exp_${finalId}`, String(fallbackExpiresAt));
    }
  } catch {}

  const remainingMs = Math.max(0, fallbackExpiresAt - Date.now());

  return {
    deviceId: finalId,
    status: remainingMs <= 0 ? 'expired' : 'trial',
    isExpired: remainingMs <= 0,
    trialStartedAt: fallbackExpiresAt - 24 * 3600 * 1000,
    trialExpiresAt: fallbackExpiresAt,
    remainingMs,
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
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

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
      message: data.error || data.message || 'كود الترخيص غير صحيح أو غير مطابق لهذا الجهاز.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message ? `تعذر الاتصال بالسيرفر السحابي (${err.message})` : 'تعذر الاتصال بالسيرفر السحابي للتحقق من الترخيص.',
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

// Formatting Helper: Arabic countdown with seconds precision
export function formatRemainingTime(ms: number): { text: string; hours: number; minutes: number; seconds: number } {
  if (ms <= 0) {
    return { text: 'انتهت الفترة التجريبية (00:00:00)', hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return {
      text: `متبقي ${days} يوم و ${remHours} ساعة و ${pad(minutes)}:${pad(seconds)}`,
      hours,
      minutes,
      seconds,
    };
  }

  return {
    text: `متبقي ${pad(hours)}:${pad(minutes)}:${pad(seconds)} (${hours} ساعة و ${minutes} دقيقة و ${seconds} ثانية)`,
    hours,
    minutes,
    seconds,
  };
}

// WhatsApp Direct Purchase URL
export function getWhatsAppPurchaseUrl(deviceId: string, priceEgp = 5000): string {
  const phone = '201100051593';
  const text = encodeURIComponent(
    `السلام عليكم م/ محمد،\nأرغب في شراء ترخيص منظومة BURGER KING & Talabat Audit Suite (قيمة الترخيص: ${priceEgp.toLocaleString()} ج.م).\n\n📱 كود جهازي هو:\n${deviceId}\n\nيرجى تزويدي ببيانات الدفع ومفتاح التفعيل.`
  );
  return `https://wa.me/${phone}?text=${text}`;
}
