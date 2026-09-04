import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;
const ROOT_DIR = process.cwd();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy Google GenAI Client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Data Directory for persistent credentials
const DATA_DIR = path.join(ROOT_DIR, 'server-data');
const AUTH_FILE = path.join(DATA_DIR, 'auth-config.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface MasterAuthConfig {
  username: string;
  passwordHash: string; // Plain or hashed
  name: string;
  authVersion: number; // Increments on password change to invalidate all existing sessions
  lastUpdated: string;
  updatedBy: string;
  masterEmail?: string;
  masterPin?: string;
  masterPhone?: string;
}

const MASTER_RECOVERY_PIN = '1993';
const AUTHORIZED_ADMIN_EMAIL = '0kingold0@gmail.com';

const DEFAULT_AUTH: MasterAuthConfig = {
  username: 'King',
  passwordHash: 'BKKing',
  name: 'M-King',
  authVersion: 1,
  masterPin: MASTER_RECOVERY_PIN,
  lastUpdated: new Date().toISOString(),
  updatedBy: 'System Init',
  masterEmail: AUTHORIZED_ADMIN_EMAIL,
  masterPhone: '01100051593',
};

function getMasterAuth(): MasterAuthConfig {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      fs.writeFileSync(AUTH_FILE, JSON.stringify(DEFAULT_AUTH, null, 2), 'utf-8');
      return DEFAULT_AUTH;
    }
    const content = fs.readFileSync(AUTH_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading auth file, using defaults', err);
    return DEFAULT_AUTH;
  }
}

function saveMasterAuth(config: MasterAuthConfig): void {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving auth file', err);
  }
}

// In-memory active tokens mapped to authVersion
interface ActiveSession {
  id: string;
  token: string;
  username: string;
  name: string;
  authVersion: number;
  loginTime: number;
  lastActive: number;
  ip: string;
  userAgent: string;
  deviceName: string;
}

const activeSessions = new Map<string, ActiveSession>();

function parseDeviceName(userAgent: string): string {
  if (!userAgent) return 'متصفح غير معروف (Unknown Device)';
  let os = 'جهاز كمبيوتر';
  if (/windows/i.test(userAgent)) os = 'ويندوز (Windows PC)';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'ماك (Mac)';
  else if (/android/i.test(userAgent)) os = 'هاتف أندرويد (Android)';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'آيفون / آيباد (iOS)';
  else if (/linux/i.test(userAgent)) os = 'لينكس (Linux)';

  let browser = 'متصفح ويب';
  if (/edg/i.test(userAgent)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(userAgent)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(userAgent)) browser = 'Apple Safari';

  return `${os} — ${browser}`;
}

// In-memory pending OTPs
interface PendingOtp {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

let pendingOtpRecord: PendingOtp | null = null;

function generateToken(): string {
  return 'bk_sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
}

// Nodemailer setup for sending actual OTP emails
async function createMailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Gmail direct or test transporter
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  // Create ethereal/standard test transport
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch {
    // Fallback JSON transporter for safety
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }
}

async function sendOtpEmail(toEmail: string, otpCode: string): Promise<boolean> {
  try {
    const transporter = await createMailTransporter();
    const info = await transporter.sendMail({
      from: '"منظومة برجر كينج وطلبات" <security@burgerking-audit.local>',
      to: toEmail,
      subject: `👑 كود استعادة الحساب السري: ${otpCode}`,
      text: `مرحباً م/ محمد عادل، كود التحقق الأمني الخاص بك هو: ${otpCode} (صالح لمدة 10 دقائق).`,
      html: `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 25px; background: #fffcf9; border: 2px solid #D71920; border-radius: 16px; max-width: 500px; margin: auto;">
          <h2 style="color: #D71920; margin-top: 0; font-size: 22px;">👑 منظومة مطابقة برجر كينج وطلبات</h2>
          <p style="font-size: 15px; color: #333; margin-bottom: 12px;">مرحباً <strong>م/ محمد عادل</strong>،</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6;">تم استلام طلب لإعادة تعيين كلمة المرور وطرد جميع الأجهزة الأخرى. كود التحقق الأمني الخاص بك هو:</p>
          <div style="background: #502314; color: #FDB813; font-size: 32px; font-weight: 900; letter-spacing: 8px; text-align: center; padding: 18px; border-radius: 12px; margin: 20px 0; font-family: monospace; border: 1px solid #FF5A00;">
            ${otpCode}
          </div>
          <p style="font-size: 13px; color: #888; margin-bottom: 0;">⏱️ هذا الكود صالح لمدة <strong>10 دقائق</strong> فقط. لا تشارك هذا الرمز مع أي شخص حفاظاً على أمان المنظومة.</p>
        </div>
      `,
    });

    console.log('OTP Email Dispatched to', toEmail, 'MessageId:', info.messageId);
    return true;
  } catch (err) {
    console.error('Failed to send OTP email via SMTP:', err);
    return false;
  }
}

// ==================== AUTH API ROUTES ====================

// 1. Check Server Status
app.get('/api/auth/status', (req, res) => {
  const current = getMasterAuth();
  res.json({
    status: 'ok',
    system: 'BURGER KING & Talabat Enterprise Audit Core',
    authVersion: current.authVersion,
    timestamp: Date.now(),
  });
});

// 2. Login Endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    res.status(400).json({ success: false, error: 'يرجى إدخال اسم/كود المستخدم وكلمة المرور.' });
    return;
  }

  const currentAuth = getMasterAuth();

  const cleanUser = (username || '').toString().trim().toLowerCase();
  const cleanPass = (password || '').toString().trim();

  // Permissive and resilient Master Admin credentials recognition
  const validUsernames = [
    (currentAuth.username || '').toLowerCase(),
    'king',
    'm-king',
    'mking',
    'admin',
    'master',
    '0kingold0@gmail.com',
    '0kingold0',
    '01100051593',
    '1993',
    'مدير',
    'المدير العام',
  ];

  const validPasswords = [
    currentAuth.passwordHash,
    '0kingold0',
    'BKKing',
    'bkking',
    '1993',
    '01100051593',
    'King',
    'king',
  ];

  const isUserMatch = validUsernames.includes(cleanUser);
  const isPassMatch = validPasswords.includes(cleanPass);
  const isMasterPinBypass = cleanPass === '1993' || cleanPass === '01100051593' || cleanUser === '1993' || cleanPass === '0kingold0';

  if (!isMasterPinBypass && (!isUserMatch || !isPassMatch)) {
    res.status(401).json({
      success: false,
      error: 'بيانات الدخول غير صحيحة! يمكنك استخدام: اسم المستخدم: King أو 0kingold0@gmail.com | كلمة المرور: 0kingold0 أو BKKing أو الرقم السري: 1993',
    });
    return;
  }

  const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || '';
  const deviceName = parseDeviceName(userAgent);
  const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  const token = generateToken();
  const session: ActiveSession = {
    id: sessionId,
    token,
    username: currentAuth.username || 'King',
    name: currentAuth.name || 'M-King',
    authVersion: currentAuth.authVersion,
    loginTime: Date.now(),
    lastActive: Date.now(),
    ip: clientIp,
    userAgent,
    deviceName,
  };

  activeSessions.set(token, session);

  // Auto-activate this device as Lifetime Master upon logging in as Master Admin
  try {
    const rawDevId = (req.headers['x-device-id'] as string) || (req.body?.deviceId as string);
    if (rawDevId) {
      const cleanDev = rawDevId.trim().toUpperCase();
      const store = getLicenseStore();
      const now = Date.now();
      if (!store.devices[cleanDev]) {
        store.devices[cleanDev] = {
          deviceId: cleanDev,
          firstSeenAt: now,
          trialDurationMs: TRIAL_DURATION_MS,
          trialExpiresAt: now + 365 * 24 * 3600000,
          status: 'active',
          isActivated: true,
          activationStartedAt: now,
          activationExpiresAt: now + 365 * 24 * 3600000,
          activationCount: 1,
          activatedAt: now,
          licenseKey: 'BK-LIC-KING-1993-MASTER-LIFETIME',
          licenseExpiresAt: 0,
          planType: 'lifetime',
          clientName: 'جهاز المدير العام (M-King Master)',
          lastSeenAt: now,
          ip: clientIp,
          deviceName,
          history: [{ id: 'hist-' + now, timestamp: now, action: 'activated', details: 'تفعيل دائم لمدير النظام', performedBy: 'Master Admin' }],
        };
      } else {
        store.devices[cleanDev].isActivated = true;
        store.devices[cleanDev].licenseKey = 'BK-LIC-KING-1993-MASTER-LIFETIME';
        store.devices[cleanDev].licenseExpiresAt = 0;
        store.devices[cleanDev].planType = 'lifetime';
        store.devices[cleanDev].clientName = 'جهاز المدير العام (M-King Master)';
        store.devices[cleanDev].lastSeenAt = now;
      }
      saveLicenseStore(store);
    }
  } catch (err) {
    console.warn('Notice: Device auto-activation upon login error:', err);
  }

  res.json({
    success: true,
    token,
    sessionId,
    authVersion: currentAuth.authVersion,
    isMaster: true,
    user: {
      username: currentAuth.username || 'King',
      name: currentAuth.name || 'M-King',
      role: 'admin',
      roleTitleAr: 'المدير العام',
      roleTitleEn: 'Master Administrator',
      branch: 'Central Headquarters & Master Core',
    },
  });
});

// 3. Verify Session (Heartbeat & Security Check)
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || (req.query.token as string);

  if (!token) {
    res.status(401).json({ valid: false, error: 'missing_token' });
    return;
  }

  const session = activeSessions.get(token);
  const currentAuth = getMasterAuth();

  if (!session) {
    res.status(401).json({
      valid: false,
      error: 'session_terminated',
      message: 'تم إنهاء أو طرد جلسة هذا الجهاز من قِبل المدير العام.',
    });
    return;
  }

  // If password was changed on another device, authVersion will NOT match!
  if (session.authVersion !== currentAuth.authVersion) {
    activeSessions.delete(token);
    res.status(401).json({
      valid: false,
      error: 'password_changed',
      message: 'تم تغيير كلمة المرور الرئيسية للمنظومة. تم إنهاء الجلسة تلقائياً لجميع الأجهزة الأخرى لضمان الأمان.',
    });
    return;
  }

  // Update lastActive timestamp
  session.lastActive = Date.now();

  res.json({
    valid: true,
    authVersion: currentAuth.authVersion,
    sessionId: session.id,
    user: {
      username: currentAuth.username,
      name: currentAuth.name,
      role: 'admin',
      roleTitleAr: 'المدير العام',
      roleTitleEn: 'Master Administrator',
      branch: 'Central Headquarters & Master Core',
    },
  });
});

// 3.1. Get Active Sessions / Connected Devices
app.get('/api/auth/active-sessions', (req, res) => {
  const authHeader = req.headers.authorization;
  const currentToken = authHeader?.replace('Bearer ', '') || (req.query.token as string);

  if (!currentToken || !activeSessions.has(currentToken)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const sessionsList = Array.from(activeSessions.values()).map(s => ({
    id: s.id,
    username: s.username,
    name: s.name,
    deviceName: s.deviceName,
    ip: s.ip,
    loginTime: s.loginTime,
    lastActive: s.lastActive,
    isCurrent: s.token === currentToken,
  }));

  res.json({
    success: true,
    totalActive: sessionsList.length,
    sessions: sessionsList,
  });
});

// 3.2. Terminate a Specific Session / Kick out Device
app.post('/api/auth/terminate-session', (req, res) => {
  const authHeader = req.headers.authorization;
  const currentToken = authHeader?.replace('Bearer ', '') || (req.body.token as string);

  if (!currentToken || !activeSessions.has(currentToken)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const { sessionId } = req.body || {};
  if (!sessionId) {
    res.status(400).json({ success: false, error: 'معرّف الجلسة مطلوب.' });
    return;
  }

  // Find token with this sessionId
  let targetToken: string | null = null;
  for (const [t, s] of activeSessions.entries()) {
    if (s.id === sessionId) {
      targetToken = t;
      break;
    }
  }

  if (targetToken) {
    activeSessions.delete(targetToken);
    res.json({ success: true, message: 'تم طرد الجهاز وإنهاء جلسته بنجاح.' });
  } else {
    res.status(404).json({ success: false, error: 'الجهاز غير موجود أو تم إغلاق جلسته بالفعل.' });
  }
});

// 3.3. Terminate All Other Devices Immediately (Master Kill-Switch)
app.post('/api/auth/terminate-all-devices', (req, res) => {
  const authHeader = req.headers.authorization;
  const currentToken = authHeader?.replace('Bearer ', '') || (req.body.token as string);

  if (!currentToken || !activeSessions.has(currentToken)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  let terminatedCount = 0;
  for (const [t] of activeSessions.entries()) {
    if (t !== currentToken) {
      activeSessions.delete(t);
      terminatedCount++;
    }
  }

  res.json({
    success: true,
    terminatedCount,
    message: `تم طرد وإخراج جميع الأجهزة الأخرى المتصلة بنجاح (${terminatedCount} جهاز).`,
  });
});

// 4. Change Central Master Credentials
app.post('/api/auth/change-credentials', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || (req.body.token as string);

  const { currentPassword, newUsername, newPassword, newName } = req.body || {};

  const currentAuth = getMasterAuth();

  // Validate current password
  if (currentPassword?.trim() !== currentAuth.passwordHash) {
    res.status(403).json({
      success: false,
      error: 'Current password is incorrect! Verification required to update credentials.',
    });
    return;
  }

  if (!newUsername || newUsername.trim().length < 3) {
    res.status(400).json({ success: false, error: 'New username must be at least 3 characters long.' });
    return;
  }

  if (!newPassword || newPassword.trim().length < 3) {
    res.status(400).json({ success: false, error: 'New password must be at least 3 characters long.' });
    return;
  }

  // Update credentials and bump authVersion to immediately revoke ALL other sessions
  const newAuthVersion = currentAuth.authVersion + 1;
  const updatedConfig: MasterAuthConfig = {
    username: newUsername.trim(),
    passwordHash: newPassword.trim(),
    name: newName?.trim() || currentAuth.name,
    authVersion: newAuthVersion,
    lastUpdated: new Date().toISOString(),
    updatedBy: newUsername.trim(),
  };

  saveMasterAuth(updatedConfig);

  // Clear all old sessions from memory
  activeSessions.clear();

  // Create a fresh token for the current user who performed the change
  const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || '';
  const deviceName = parseDeviceName(userAgent);
  const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  const freshToken = generateToken();
  activeSessions.set(freshToken, {
    id: sessionId,
    token: freshToken,
    username: updatedConfig.username,
    name: updatedConfig.name,
    authVersion: newAuthVersion,
    loginTime: Date.now(),
    lastActive: Date.now(),
    ip: clientIp,
    userAgent,
    deviceName,
  });

  res.json({
    success: true,
    newToken: freshToken,
    authVersion: newAuthVersion,
    message: 'Master credentials updated successfully! All other active desktop sessions have been logged out instantly.',
    user: {
      username: updatedConfig.username,
      name: updatedConfig.name,
      role: 'admin',
      roleTitleAr: 'المدير العام',
      roleTitleEn: 'Master Administrator',
      branch: 'Central Headquarters & Master Core',
    },
  });
});

// 4.5. Request Email OTP for Password Reset
app.post('/api/auth/send-email-otp', async (req, res) => {
  const { email } = req.body || {};

  const cleanEmail = (email || '').toString().trim().toLowerCase();

  if (!cleanEmail || cleanEmail !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({
      success: false,
      error: 'The entered email address is not registered as an authorized administrator!',
    });
    return;
  }

  // Generate 6-digit cryptographic-like OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  pendingOtpRecord = {
    code: otpCode,
    email: AUTHORIZED_ADMIN_EMAIL,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
    attempts: 0,
  };

  console.log(`[SECURITY OTP] Generated OTP for ${AUTHORIZED_ADMIN_EMAIL}: [${otpCode}]`);

  // Dispatch actual email
  await sendOtpEmail(AUTHORIZED_ADMIN_EMAIL, otpCode);

  res.json({
    success: true,
    message: 'A 6-digit verification code has been dispatched to your authorized email.',
  });
});

// 4.6. Direct PIN & Authorized Email Recovery (Zero-dependency on external mail delivery)
app.post('/api/auth/reset-by-master-pin', (req, res) => {
  const { email, pinCode, newPassword } = req.body || {};

  const cleanEmail = (email || '').toString().trim().toLowerCase();
  const cleanPin = (pinCode || '').toString().trim();

  const isMasterPinMatch = 
    cleanPin === MASTER_RECOVERY_PIN || 
    cleanPin === '1993' ||
    cleanPin === '01100051593' ||
    cleanPin === '201100051593' ||
    cleanPin === '0kingold0';

  const validAdminIdentifiers = [
    AUTHORIZED_ADMIN_EMAIL.toLowerCase(),
    '0kingold0@gmail.com',
    '0kingold0',
    'king',
    'm-king',
    'mking',
    'admin',
    'master',
    '01100051593',
    '1993',
    '',
  ];

  const isAuthorizedIdentifier = validAdminIdentifiers.includes(cleanEmail) || isMasterPinMatch;

  if (!isAuthorizedIdentifier) {
    res.status(403).json({
      success: false,
      error: 'البريد أو اسم المستخدم غير مسجل كمدير عام! يرجى إدخال 0kingold0@gmail.com أو King أو تركه للملء التلقائي.',
    });
    return;
  }

  if (!isMasterPinMatch) {
    res.status(403).json({
      success: false,
      error: 'الرقم السري للمدير (Master PIN) غير صحيح! الرقم السري الافتراضي هو 1993.',
    });
    return;
  }

  if (!newPassword || newPassword.trim().length < 4) {
    res.status(400).json({
      success: false,
      error: 'New password must be at least 4 characters long.',
    });
    return;
  }

  const currentAuth = getMasterAuth();
  const newAuthVersion = currentAuth.authVersion + 1;
  const updatedConfig: MasterAuthConfig = {
    username: currentAuth.username || 'King',
    passwordHash: newPassword.trim(),
    name: currentAuth.name || 'M-King',
    authVersion: newAuthVersion,
    lastUpdated: new Date().toISOString(),
    masterPin: MASTER_RECOVERY_PIN,
    updatedBy: `Master PIN Recovery (${AUTHORIZED_ADMIN_EMAIL})`,
    masterEmail: AUTHORIZED_ADMIN_EMAIL,
    masterPhone: currentAuth.masterPhone || '01100051593',
  };

  saveMasterAuth(updatedConfig);

  // Global Kill-Switch: terminate all existing sessions instantly across all devices
  activeSessions.clear();
  pendingOtpRecord = null;

  const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || '';
  const deviceName = parseDeviceName(userAgent);
  const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  const freshToken = generateToken();
  activeSessions.set(freshToken, {
    id: sessionId,
    token: freshToken,
    username: updatedConfig.username,
    name: updatedConfig.name,
    authVersion: newAuthVersion,
    loginTime: Date.now(),
    lastActive: Date.now(),
    ip: clientIp,
    userAgent,
    deviceName,
  });

  res.json({
    success: true,
    newToken: freshToken,
    authVersion: newAuthVersion,
    message: 'Master password has been reset successfully! All other connected devices have been revoked and locked.',
    user: {
      username: updatedConfig.username,
      name: updatedConfig.name,
      role: 'admin',
      roleTitleAr: 'المدير العام',
      roleTitleEn: 'Master Administrator',
      branch: 'Central Headquarters & Master Core',
    },
  });
});

// 4.7. Verify Email OTP & Reset Password with Global Kill Switch (Fallback compatible)
app.post('/api/auth/verify-email-otp-and-reset', (req, res) => {
  const { email, otpCode, pinCode, newPassword } = req.body || {};

  const cleanEmail = (email || '').toString().trim().toLowerCase();
  const cleanOtp = (otpCode || pinCode || '').toString().trim();

  const isPin = cleanOtp === '1993' || cleanOtp === '01100051593' || cleanOtp === '201100051593';

  const validEmailsOrUsernames = [
    AUTHORIZED_ADMIN_EMAIL.toLowerCase(),
    'king',
    'm-king',
    'mking',
    '0kingold0',
    '0kingold0@gmail.com',
    '01100051593',
    'admin',
  ];

  if (!cleanEmail || !validEmailsOrUsernames.includes(cleanEmail)) {
    res.status(403).json({
      success: false,
      error: 'البريد أو اسم المستخدم غير مصرح له. يرجى إدخال 0kingold0@gmail.com أو King.',
    });
    return;
  }

  if (!isPin && (!pendingOtpRecord || Date.now() > pendingOtpRecord.expiresAt || pendingOtpRecord.code !== cleanOtp)) {
    res.status(400).json({
      success: false,
      error: 'Security OTP code or PIN is invalid or expired!',
    });
    return;
  }

  if (!newPassword || newPassword.trim().length < 4) {
    res.status(400).json({
      success: false,
      error: 'New password must be at least 4 characters long.',
    });
    return;
  }

  const currentAuth = getMasterAuth();
  const newAuthVersion = currentAuth.authVersion + 1;
  const updatedConfig: MasterAuthConfig = {
    username: currentAuth.username || 'King',
    passwordHash: newPassword.trim(),
    name: currentAuth.name || 'M-King',
    authVersion: newAuthVersion,
    lastUpdated: new Date().toISOString(),
    updatedBy: `Recovery (${AUTHORIZED_ADMIN_EMAIL})`,
    masterEmail: AUTHORIZED_ADMIN_EMAIL,
    masterPhone: currentAuth.masterPhone || '01100051593',
  };

  saveMasterAuth(updatedConfig);

  // Global Kill-Switch: terminate all existing sessions instantly across all devices
  activeSessions.clear();
  pendingOtpRecord = null;

  const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || '';
  const deviceName = parseDeviceName(userAgent);
  const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  const freshToken = generateToken();
  activeSessions.set(freshToken, {
    id: sessionId,
    token: freshToken,
    username: updatedConfig.username,
    name: updatedConfig.name,
    authVersion: newAuthVersion,
    loginTime: Date.now(),
    lastActive: Date.now(),
    ip: clientIp,
    userAgent,
    deviceName,
  });

  res.json({
    success: true,
    newToken: freshToken,
    authVersion: newAuthVersion,
    message: 'Master password has been reset successfully! All sessions updated.',
    user: {
      username: updatedConfig.username,
      name: updatedConfig.name,
      role: 'admin',
      roleTitleAr: 'المدير العام',
      roleTitleEn: 'Master Administrator',
      branch: 'Central Headquarters & Master Core',
    },
  });
});

// 5. Logout Endpoint
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || (req.body.token as string);

  if (token) {
    activeSessions.delete(token);
  }

  res.json({ success: true });
});

// ==================== LICENSE & TRIAL MANAGEMENT SYSTEM ====================

const LICENSE_STORE_FILE = path.join(DATA_DIR, 'license-store.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const INITIAL_REGISTRATION_DURATION_MS = 5 * 60 * 1000; // 5 minutes initial period on very first discovery
const TRIAL_DURATION_MS = INITIAL_REGISTRATION_DURATION_MS;
const DEFAULT_LICENSE_PRICE_EGP = 5000; // 5,000 EGP License
const MASTER_CONTACT_PHONE = '01100051593';

interface DeviceLocationRecord {
  latitude?: number;
  longitude?: number;
  address?: string;
  updatedAt?: number;
  permissionStatus: 'granted' | 'denied' | 'unavailable' | 'prompt';
}

interface ActivationRequestRecord {
  id: string;
  deviceId: string;
  deviceName?: string;
  clientName?: string;
  phone?: string;
  notes?: string;
  requestedAt: number;
  requestedDurationMinutes?: number;
  location?: DeviceLocationRecord;
  ip?: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface DeviceHistoryRecord {
  id: string;
  timestamp: number;
  action: 'registered' | 'request_activation' | 'activated' | 'time_added' | 'locked' | 'reset';
  details?: string;
  performedBy?: string;
}

interface DeviceRecord {
  deviceId: string;
  firstSeenAt: number;
  lastSeenAt: number;
  status: 'locked' | 'active' | 'pending';
  isActivated: boolean;
  activationStartedAt?: number;
  activationExpiresAt?: number;
  activationCount: number;
  trialDurationMs?: number;
  trialExpiresAt?: number;
  activatedAt?: number;
  licenseKey?: string;
  licenseExpiresAt?: number;
  planType: 'trial' | 'annual' | 'lifetime' | 'monthly' | 'semi_annual' | 'custom' | string;
  clientName?: string;
  branchName?: string;
  phone?: string;
  notes?: string;
  ip: string;
  deviceName: string;
  location?: DeviceLocationRecord;
  pendingRequest?: ActivationRequestRecord | null;
  lastRequestAt?: number;
  history?: DeviceHistoryRecord[];
}

interface StoredLicenseRecord {
  key: string;
  deviceId: string;
  clientName: string;
  planType: 'annual' | 'lifetime' | 'monthly' | 'semi_annual' | 'custom';
  priceEgp: number;
  createdAt: number;
  expiresAt: number;
  generatedBy: string;
  notes?: string;
  usedAt?: number;
  isActive: boolean;
}

interface LicenseStoreData {
  masterSecret: string;
  defaultPriceEgp: number;
  devices: Record<string, DeviceRecord>;
  licenses: Record<string, StoredLicenseRecord>;
}

export interface AdminNotificationRecord {
  id: string;
  type: 'activation_request' | 'device_locked' | 'device_activated' | 'device_reset';
  deviceId: string;
  deviceName?: string;
  clientName?: string;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  location?: DeviceLocationRecord;
  metadata?: Record<string, any>;
}

// Persistent Notifications Store
function getNotifications(): AdminNotificationRecord[] {
  try {
    if (!fs.existsSync(NOTIFICATIONS_FILE)) {
      fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading notifications', err);
    return [];
  }
}

function saveNotifications(notifs: AdminNotificationRecord[]): void {
  try {
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving notifications', err);
  }
}

function addAdminNotification(notif: Omit<AdminNotificationRecord, 'id' | 'createdAt' | 'read'>): AdminNotificationRecord {
  const notifs = getNotifications();
  const newNotif: AdminNotificationRecord = {
    ...notif,
    id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    createdAt: Date.now(),
    read: false,
  };
  notifs.unshift(newNotif);
  // Cap at 300 entries to prevent infinite growth
  if (notifs.length > 300) notifs.length = 300;
  saveNotifications(notifs);

  // Broadcast to all active SSE listeners
  broadcastDeviceEvent('new_notification', newNotif);
  return newNotif;
}

// Real-Time Server-Sent Events (SSE) Client Hub
const sseClients: { id: string; deviceId?: string; isAdmin?: boolean; res: express.Response }[] = [];

function broadcastDeviceEvent(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.res.write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// Periodic keep-alive heartbeat for SSE
setInterval(() => {
  const pingPayload = `: heartbeat ${Date.now()}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].res.write(pingPayload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}, 20000);

// Real Reverse Geocoding Helper using OpenStreetMap Nominatim
async function reverseGeocodeCoordinates(lat: number, lon: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
      headers: {
        'User-Agent': 'BK-Aloha-Talabat-Audit/2.0 (contact: 0kingold0@gmail.com)',
        'Accept-Language': 'ar,en',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
  } catch {}
  return `إحداثيات: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function getLicenseStore(): LicenseStoreData {
  try {
    if (!fs.existsSync(LICENSE_STORE_FILE)) {
      const initialStore: LicenseStoreData = {
        masterSecret: 'bk_king_master_secret_' + Math.random().toString(36).substring(2, 15),
        defaultPriceEgp: DEFAULT_LICENSE_PRICE_EGP,
        devices: {},
        licenses: {},
      };
      fs.writeFileSync(LICENSE_STORE_FILE, JSON.stringify(initialStore, null, 2), 'utf-8');
      return initialStore;
    }
    const raw = fs.readFileSync(LICENSE_STORE_FILE, 'utf-8');
    const parsed: LicenseStoreData = JSON.parse(raw);

    // Normalize existing devices for backwards compatibility
    if (parsed.devices) {
      Object.values(parsed.devices).forEach(d => {
        if (!d.status) {
          d.status = d.isActivated ? 'active' : 'locked';
        }
        if (d.activationCount === undefined) {
          d.activationCount = d.isActivated ? 1 : 0;
        }
        if (!d.history) {
          d.history = [];
        }
      });
    }

    return parsed;
  } catch (err) {
    console.error('Error reading license store', err);
    return {
      masterSecret: 'bk_king_master_secret_fallback',
      defaultPriceEgp: DEFAULT_LICENSE_PRICE_EGP,
      devices: {},
      licenses: {},
    };
  }
}

function saveLicenseStore(store: LicenseStoreData): void {
  try {
    fs.writeFileSync(LICENSE_STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving license store', err);
  }
}

// Generate deterministic & cryptographically signed license keys
function generateLicenseKey(
  deviceId: string,
  planType: 'annual' | 'lifetime' | 'monthly' | 'semi_annual' | 'custom',
  durationDays: number
): { key: string; expiresAt: number } {
  const store = getLicenseStore();
  const rawId = (deviceId || '').trim().toUpperCase();
  const isUniversal = !rawId || rawId === 'UNIVERSAL' || rawId === 'ANY' || rawId === 'ALL';
  const cleanId = isUniversal ? 'UNIVERSAL' : rawId;
  const now = Date.now();
  const expiresAt = durationDays > 0 ? now + durationDays * 24 * 60 * 60 * 1000 : 0; // 0 = Lifetime
  
  const expChunk = expiresAt > 0 
    ? Math.floor(expiresAt / 86400000).toString(16).toUpperCase().padStart(4, '0') 
    : 'LIFE';
  const devChunk = isUniversal 
    ? 'UNIV' 
    : cleanId.replace(/[^A-Z0-9]/g, '').slice(-4).padStart(4, 'X');
  const salt = crypto.randomBytes(2).toString('hex').toUpperCase();

  const hmac = crypto.createHmac('sha256', store.masterSecret);
  hmac.update(`${cleanId}:${planType}:${expChunk}:${salt}`);
  const signature = hmac.digest('hex').slice(0, 4).toUpperCase();

  const key = `BK-LIC-${salt}-${expChunk}-${devChunk}-${signature}`;
  return { key, expiresAt };
}

// Validate license key for a given device
function verifyLicenseKey(
  key: string,
  deviceId: string
): { valid: boolean; planType?: 'annual' | 'lifetime' | 'monthly' | 'semi_annual' | 'custom'; expiresAt?: number; reason?: string; isMaster?: boolean } {
  const store = getLicenseStore();
  const cleanKey = (key || '').trim().toUpperCase();
  const cleanDevice = (deviceId || '').trim().toUpperCase();

  // 1. Universal Master Bypass Keys & PINs
  const masterBypassKeys = [
    'BK-LIC-KING-1993-MASTER-LIFETIME',
    'BK-LIC-M-KING-01100051593',
    'KING-1993',
    'KING1993',
    '1993',
    '01100051593',
    '0KINGOLD0',
    'BKKING',
    'KING',
    'M-KING',
    'MKING',
    'MASTER',
    'LIFETIME',
    'ADMIN',
  ];

  if (masterBypassKeys.includes(cleanKey)) {
    return { valid: true, planType: 'lifetime', expiresAt: 0, isMaster: true };
  }

  // 2. Check explicitly recorded generated keys
  if (store.licenses[cleanKey]) {
    const rec = store.licenses[cleanKey];
    if (!rec.isActive) {
      return { valid: false, reason: 'تم إلغاء أو تعطيل هذا المفتاح بواسطة الإدارة.' };
    }
    if (rec.expiresAt > 0 && Date.now() > rec.expiresAt) {
      return { valid: false, reason: 'انتهت فترة صلاحية هذا الترخيص.' };
    }

    const isUniversalKey = !rec.deviceId || rec.deviceId.toUpperCase() === 'UNIVERSAL' || rec.deviceId === 'ANY' || rec.deviceId === 'ALL';
    
    // If not universal and not matching current device:
    if (!isUniversalKey && rec.deviceId && rec.deviceId.toUpperCase() !== cleanDevice) {
      // If it has not been activated yet, auto-bind to this device!
      if (!rec.usedAt) {
        rec.deviceId = cleanDevice;
      } else {
        return { 
          valid: false, 
          reason: `هذا المفتاح تم تفعيله مسبقاً على جهاز آخر (${rec.deviceId.slice(-9)}). يرجى التواصل مع الإدارة.` 
        };
      }
    }
    return { valid: true, planType: rec.planType, expiresAt: rec.expiresAt };
  }

  // 3. Cryptographic Signature Validation
  const parts = cleanKey.split('-');
  if (parts.length === 6 && parts[0] === 'BK' && parts[1] === 'LIC') {
    const [_, __, salt, expChunk, devChunk, sig] = parts;
    const devMatch = cleanDevice.replace(/[^A-Z0-9]/g, '').slice(-4).padStart(4, 'X');
    const isUnivChunk = devChunk === 'UNIV' || devChunk === 'XXXX' || devChunk === 'ALL';

    if (!isUnivChunk && devChunk !== devMatch) {
      return { 
        valid: false, 
        reason: `كود الترخيص ينتهي برمز (${devChunk}) بينما جهازك الحالي ينتهي بـ (${devMatch}). الكود غير مطابق لهذا الجهاز.` 
      };
    }

    const plans: Array<'annual' | 'lifetime' | 'monthly' | 'semi_annual' | 'custom'> = [
      'annual', 'lifetime', 'monthly', 'semi_annual', 'custom'
    ];
    for (const plan of plans) {
      const hmac = crypto.createHmac('sha256', store.masterSecret);
      const hmacTarget = isUnivChunk ? 'UNIVERSAL' : cleanDevice;
      hmac.update(`${hmacTarget}:${plan}:${expChunk}:${salt}`);
      const expectedSig = hmac.digest('hex').slice(0, 4).toUpperCase();
      if (expectedSig === sig) {
        let expiresAt = 0;
        if (expChunk !== 'LIFE') {
          const days = parseInt(expChunk, 16);
          if (!isNaN(days)) {
            expiresAt = days * 86400000;
            if (Date.now() > expiresAt) {
              return { valid: false, reason: 'انتهت فترة صلاحية هذا الترخيص.' };
            }
          }
        }
        return { valid: true, planType: plan, expiresAt };
      }
    }
  }

  return { valid: false, reason: 'مفتاح الترخيص غير صالح. يرجى التأكد من نسخه بدقة أو إدخال الرقم السري 1993.' };
}

// Check whether caller has Master Admin rights
function isCallerMasterAdmin(req: express.Request): boolean {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || (req.query.token as string);
  const pinHeader = (req.headers['x-master-pin'] as string) || (req.body?.masterPin as string);

  if (pinHeader === MASTER_RECOVERY_PIN || pinHeader === '1993' || pinHeader === '01100051593') {
    return true;
  }

  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token);
    if (session && session.username.toLowerCase() === 'king') {
      return true;
    }
  }
  return false;
}

// 0. Real-Time Server-Sent Events (SSE) Stream for Instant Admin & Client Synchronization
app.get('/api/license/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const clientId = 'sse-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const deviceId = ((req.query.deviceId as string) || '').trim().toUpperCase();
  const isAdmin = req.query.isAdmin === 'true';

  sseClients.push({ id: clientId, deviceId, isAdmin, res });

  // Initial connection handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now(), clientId })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex(c => c.id === clientId);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 1. Device License Status Check (Strict Server-Side Validation)
app.get('/api/license/status', async (req, res) => {
  try {
    const deviceId = ((req.query.deviceId as string) || '').trim().toUpperCase();
    const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || '';
    const deviceName = parseDeviceName(userAgent);

    const isMaster = isCallerMasterAdmin(req);

    // If Master Admin, always active and never locked
    if (isMaster) {
      res.json({
        success: true,
        deviceId: deviceId || 'BK-DEV-MASTER-ADMIN',
        deviceName: 'جهاز المدير العام (Master PC)',
        status: 'active',
        isActivated: true,
        isExpired: false,
        isMaster: true,
        trialStartedAt: Date.now() - 3600000,
        trialExpiresAt: Date.now() + 365 * 24 * 3600000,
        activationStartedAt: Date.now() - 3600000,
        activationExpiresAt: Date.now() + 365 * 24 * 3600000,
        remainingMs: 365 * 24 * 3600000,
        priceEgp: DEFAULT_LICENSE_PRICE_EGP,
        planType: 'lifetime',
        contactPhone: MASTER_CONTACT_PHONE,
        clientName: 'المدير العام (Master Admin)',
        activationCount: 1,
        serverTime: Date.now(),
      });
      return;
    }

    if (!deviceId) {
      res.status(400).json({ success: false, error: 'معرّف الجهاز مطلوب (Device ID required)' });
      return;
    }

    const store = getLicenseStore();
    let device = store.devices[deviceId];
    const now = Date.now();

    // If client passes location updates in query params
    const rawLat = parseFloat(req.query.latitude as string);
    const rawLng = parseFloat(req.query.longitude as string);
    const permStatus = (req.query.permissionStatus as any) || (rawLat && rawLng ? 'granted' : undefined);

    // First time this device connects:
    if (!device) {
      const initialExpires = now + INITIAL_REGISTRATION_DURATION_MS;
      device = {
        deviceId,
        firstSeenAt: now,
        lastSeenAt: now,
        status: 'active', // Initial 5 minutes valid duration
        isActivated: true,
        activationStartedAt: now,
        activationExpiresAt: initialExpires,
        activationCount: 1,
        trialDurationMs: INITIAL_REGISTRATION_DURATION_MS,
        trialExpiresAt: initialExpires,
        planType: 'trial',
        clientName: 'عميل جديد',
        ip: clientIp,
        deviceName,
        history: [
          {
            id: 'hist-' + now,
            timestamp: now,
            action: 'registered',
            details: 'تسجيل جهاز جديد مع فترة أولية 5 دقائق',
            performedBy: 'System',
          },
        ],
      };

      if (!isNaN(rawLat) && !isNaN(rawLng)) {
        device.location = {
          latitude: rawLat,
          longitude: rawLng,
          updatedAt: now,
          permissionStatus: 'granted',
        };
      } else if (permStatus) {
        device.location = {
          permissionStatus: permStatus,
          updatedAt: now,
        };
      }

      store.devices[deviceId] = device;
      saveLicenseStore(store);

      // Notify Master Admin of new device registration
      addAdminNotification({
        type: 'device_activated',
        deviceId,
        deviceName,
        clientName: device.clientName,
        title: 'تسجيل جهاز جديد في المنظومة 💻',
        message: `تم رصد وتسجيل جهاز جديد (${deviceName}) برقم: ${deviceId}`,
        location: device.location,
      });
    } else {
      // Update last seen & IP
      device.lastSeenAt = now;
      device.ip = clientIp;
      if (deviceName && (!device.deviceName || device.deviceName === 'جهاز غير معروف')) {
        device.deviceName = deviceName;
      }

      // Update location if provided
      if (!isNaN(rawLat) && !isNaN(rawLng)) {
        const prevLoc = device.location;
        device.location = {
          latitude: rawLat,
          longitude: rawLng,
          address: prevLoc?.address,
          updatedAt: now,
          permissionStatus: 'granted',
        };
      } else if (permStatus && (!device.location || device.location.permissionStatus !== permStatus)) {
        device.location = {
          ...(device.location || {}),
          permissionStatus: permStatus,
          updatedAt: now,
        };
      }
    }

    // Master license check
    const isDeviceMaster = Boolean(
      device.licenseKey?.includes('MASTER') ||
      device.licenseKey === 'KING-1993' ||
      device.licenseKey === '1993' ||
      device.clientName?.includes('Master') ||
      device.clientName?.includes('المدير العام') ||
      device.clientName?.includes('M-King')
    );

    let status: 'locked' | 'active' | 'pending' = device.status || 'locked';
    let remainingMs = 0;

    if (isDeviceMaster) {
      status = 'active';
      device.status = 'active';
      device.isActivated = true;
      remainingMs = 999999999999;
    } else if (status === 'locked') {
      // Strictly remains locked! Never reactivate automatically!
      device.isActivated = false;
      remainingMs = 0;
    } else if (status === 'pending') {
      device.isActivated = false;
      remainingMs = 0;
    } else if (status === 'active') {
      // Validate expiration against SERVER-SIDE time
      const expiry = device.activationExpiresAt || device.licenseExpiresAt || device.trialExpiresAt || 0;
      if (expiry > 0 && now >= expiry) {
        // Time expired! Lock immediately!
        status = 'locked';
        device.status = 'locked';
        device.isActivated = false;
        device.activationExpiresAt = 0;
        device.history = device.history || [];
        device.history.push({
          id: 'hist-' + now,
          timestamp: now,
          action: 'locked',
          details: 'انتهت فترة التفعيل المحددة وتم قفل الجهاز تلقائياً من السيرفر',
          performedBy: 'Server Time Guard',
        });

        saveLicenseStore(store);

        // Broadcast lock event via SSE to immediately show lock screen on client
        broadcastDeviceEvent('device_updated', {
          deviceId: device.deviceId,
          status: 'locked',
          isActivated: false,
          remainingMs: 0,
          serverTime: now,
        });

        // Add persistent notification
        addAdminNotification({
          type: 'device_locked',
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          clientName: device.clientName,
          title: 'قفل جهاز لانتهاء المدة ⏱️',
          message: `انتهت صلاحية تفعيل جهاز ${device.clientName || device.deviceId} وتم قفله تلقائياً.`,
          location: device.location,
        });
      } else {
        remainingMs = expiry > 0 ? Math.max(0, expiry - now) : 999999999999;
        device.isActivated = true;
      }
    }

    saveLicenseStore(store);

    res.json({
      success: true,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      status: device.status,
      isActivated: device.status === 'active',
      isExpired: device.status === 'locked',
      activationStartedAt: device.activationStartedAt,
      activationExpiresAt: device.activationExpiresAt,
      remainingMs,
      activationCount: device.activationCount || 0,
      location: device.location,
      pendingRequest: device.pendingRequest,
      priceEgp: store.defaultPriceEgp || DEFAULT_LICENSE_PRICE_EGP,
      planType: device.planType || 'custom',
      licenseKey: device.licenseKey,
      licenseExpiresAt: device.licenseExpiresAt,
      clientName: device.clientName,
      contactPhone: MASTER_CONTACT_PHONE,
      isMaster: isMaster || isDeviceMaster,
      serverTime: now,
    });
  } catch (err) {
    console.warn('License status endpoint warning:', err);
    res.status(500).json({ success: false, error: 'License server internal error' });
  }
});

// 2. Client: Request Activation from Master Admin (Persistent Notification & SSE Trigger)
app.post('/api/license/request-activation', async (req, res) => {
  try {
    const { deviceId, clientName, phone, notes, requestedDurationMinutes = 60, location } = req.body || {};
    if (!deviceId) {
      res.status(400).json({ success: false, error: 'معرّف الجهاز مطلوب.' });
      return;
    }

    const cleanDevice = deviceId.trim().toUpperCase();
    const store = getLicenseStore();
    let device = store.devices[cleanDevice];
    const now = Date.now();
    const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.socket.remoteAddress || '127.0.0.1';

    if (!device) {
      device = {
        deviceId: cleanDevice,
        firstSeenAt: now,
        lastSeenAt: now,
        status: 'pending',
        isActivated: false,
        activationCount: 0,
        planType: 'custom',
        clientName: clientName?.trim() || 'عميل تجاري',
        phone: phone?.trim() || '',
        ip: clientIp,
        deviceName: parseDeviceName(req.headers['user-agent'] as string || ''),
        history: [],
      };
      store.devices[cleanDevice] = device;
    }

    // Process Location with reverse geocoding if coordinates supplied
    let locData: DeviceLocationRecord | undefined = location;
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      locData = {
        latitude: location.latitude,
        longitude: location.longitude,
        updatedAt: now,
        permissionStatus: 'granted',
      };
      if (!location.address) {
        locData.address = await reverseGeocodeCoordinates(location.latitude, location.longitude);
      } else {
        locData.address = location.address;
      }
    } else if (location && location.permissionStatus) {
      locData = {
        permissionStatus: location.permissionStatus,
        updatedAt: now,
      };
    }

    if (locData) {
      device.location = locData;
    }

    const requestRecord: ActivationRequestRecord = {
      id: 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      deviceId: cleanDevice,
      deviceName: device.deviceName,
      clientName: clientName?.trim() || device.clientName || 'عميل تجاري',
      phone: phone?.trim() || device.phone || '',
      notes: notes?.trim() || '',
      requestedAt: now,
      requestedDurationMinutes: Number(requestedDurationMinutes) || 60,
      location: device.location,
      ip: clientIp,
      status: 'pending',
    };

    device.status = 'pending';
    device.isActivated = false;
    device.pendingRequest = requestRecord;
    device.lastRequestAt = now;
    if (clientName) device.clientName = clientName.trim();
    if (phone) device.phone = phone.trim();
    if (notes) device.notes = notes.trim();

    device.history = device.history || [];
    device.history.push({
      id: 'hist-' + now,
      timestamp: now,
      action: 'request_activation',
      details: `طلب تفعيل لمدة ${requestRecord.requestedDurationMinutes} دقيقة — ${notes ? notes.trim() : 'بدون ملاحظات'}`,
      performedBy: requestRecord.clientName,
    });

    saveLicenseStore(store);

    // Create Persistent Notification for Master Admin
    const notif = addAdminNotification({
      type: 'activation_request',
      deviceId: cleanDevice,
      deviceName: device.deviceName,
      clientName: requestRecord.clientName,
      title: 'طلب تفعيل جهاز جديد 🔔',
      message: `طلب العميل (${requestRecord.clientName}) تفعيل جهازه${notes ? ` — ملاحظات: ${notes}` : ''}`,
      location: device.location,
      metadata: {
        requestId: requestRecord.id,
        phone: requestRecord.phone,
        requestedMinutes: requestRecord.requestedDurationMinutes,
      },
    });

    // Broadcast SSE to all connected clients & Master Admin
    broadcastDeviceEvent('device_updated', {
      deviceId: cleanDevice,
      status: 'pending',
      pendingRequest: requestRecord,
      serverTime: now,
    });
    broadcastDeviceEvent('new_activation_request', {
      request: requestRecord,
      notification: notif,
    });

    res.json({
      success: true,
      message: 'تم إرسال طلب التفعيل إلى المدير العام بنجاح! طلبك قيد المراجعة حالياً.',
      request: requestRecord,
    });
  } catch (err: any) {
    console.error('Request activation error:', err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء إرسال طلب التفعيل.' });
  }
});

// 3. Activate License Key
app.post('/api/license/activate', (req, res) => {
  const { deviceId, licenseKey, clientName } = req.body || {};

  if (!deviceId || !licenseKey) {
    res.status(400).json({ success: false, error: 'يرجى إدخال كود الجهاز ومفتاح الترخيص.' });
    return;
  }

  const cleanDevice = deviceId.trim().toUpperCase();
  const cleanKey = licenseKey.trim().toUpperCase();

  const verification = verifyLicenseKey(cleanKey, cleanDevice);
  if (!verification.valid) {
    res.status(400).json({ success: false, error: verification.reason || 'مفتاح الترخيص غير صحيح أو منتهي الصلاحية.' });
    return;
  }

  const store = getLicenseStore();
  let device = store.devices[cleanDevice];
  const now = Date.now();
  const isMasterActivation = Boolean(verification.isMaster);

  if (!device) {
    const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.socket.remoteAddress || '127.0.0.1';
    device = {
      deviceId: cleanDevice,
      firstSeenAt: now,
      lastSeenAt: now,
      status: 'active',
      isActivated: true,
      activationStartedAt: now,
      activationExpiresAt: isMasterActivation ? now + 365 * 24 * 3600000 : (verification.expiresAt || now + 365 * 24 * 3600000),
      activationCount: 1,
      trialDurationMs: INITIAL_REGISTRATION_DURATION_MS,
      trialExpiresAt: now + INITIAL_REGISTRATION_DURATION_MS,
      activatedAt: now,
      licenseKey: isMasterActivation ? 'BK-LIC-KING-1993-MASTER-LIFETIME' : cleanKey,
      licenseExpiresAt: isMasterActivation ? 0 : verification.expiresAt,
      planType: isMasterActivation ? 'lifetime' : (verification.planType || 'annual'),
      clientName: clientName?.trim() || (isMasterActivation ? 'جهاز المدير العام (M-King Master)' : 'عميل مرخص'),
      ip: clientIp,
      deviceName: parseDeviceName(req.headers['user-agent'] as string || ''),
      history: [
        {
          id: 'hist-' + now,
          timestamp: now,
          action: 'activated',
          details: 'تفعيل بواسطة كود الترخيص',
          performedBy: 'Client Key Entry',
        },
      ],
    };
  } else {
    device.status = 'active';
    device.isActivated = true;
    device.activatedAt = now;
    device.activationStartedAt = now;
    device.activationExpiresAt = isMasterActivation ? now + 365 * 24 * 3600000 : (verification.expiresAt || now + 365 * 24 * 3600000);
    device.activationCount = (device.activationCount || 0) + 1;
    device.licenseKey = isMasterActivation ? 'BK-LIC-KING-1993-MASTER-LIFETIME' : cleanKey;
    device.licenseExpiresAt = isMasterActivation ? 0 : verification.expiresAt;
    device.planType = isMasterActivation ? 'lifetime' : (verification.planType || 'annual');
    if (clientName) {
      device.clientName = clientName.trim();
    } else if (isMasterActivation) {
      device.clientName = 'جهاز المدير العام (M-King Master)';
    }
    device.pendingRequest = null;
    device.lastSeenAt = now;
    device.history = device.history || [];
    device.history.push({
      id: 'hist-' + now,
      timestamp: now,
      action: 'activated',
      details: 'تفعيل بواسطة كود الترخيص',
      performedBy: 'Client Key Entry',
    });
  }

  store.devices[cleanDevice] = device;

  // Mark in licenses store if existing record
  if (store.licenses[cleanKey]) {
    store.licenses[cleanKey].usedAt = now;
    store.licenses[cleanKey].deviceId = cleanDevice;
  }

  saveLicenseStore(store);

  // Broadcast activation via SSE
  broadcastDeviceEvent('device_updated', {
    deviceId: cleanDevice,
    status: 'active',
    isActivated: true,
    activationExpiresAt: device.activationExpiresAt,
    remainingMs: (device.activationExpiresAt || 0) - now,
    serverTime: now,
  });

  saveLicenseStore(store);

  // If Master key, create admin active session and return token as well!
  let masterToken: string | undefined;
  let masterUser: any = undefined;

  if (isMasterActivation) {
    const currentAuth = getMasterAuth();
    masterToken = generateToken();
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    activeSessions.set(masterToken, {
      id: sessionId,
      token: masterToken,
      username: currentAuth.username || 'King',
      name: currentAuth.name || 'M-King',
      authVersion: currentAuth.authVersion,
      loginTime: Date.now(),
      lastActive: Date.now(),
      ip: req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] as string || '',
      deviceName: parseDeviceName(req.headers['user-agent'] as string || ''),
    });
    masterUser = {
      username: currentAuth.username || 'King',
      name: currentAuth.name || 'M-King',
      role: 'admin',
      roleTitleAr: 'المدير العام',
      roleTitleEn: 'Master Administrator',
      branch: 'Central Headquarters & Master Core',
    };
  }

  res.json({
    success: true,
    message: isMasterActivation 
      ? 'تم تفعيل ترخيص المدير العام مدى الحياة بنجاح! تم تسجيل دخولك كمدير عام.' 
      : 'تم تفعيل النسخة الكاملة بنجاح! شكراً لاشتراكك في منظومة KING Audit.',
    planType: device.planType,
    licenseExpiresAt: device.licenseExpiresAt,
    clientName: device.clientName,
    isMaster: isMasterActivation,
    token: masterToken,
    user: masterUser,
  });
});

// 3. Instant Master Admin PIN Bypass (Unlock device directly via Master PIN 1993)
app.post('/api/license/master-bypass', (req, res) => {
  const { pinCode, deviceId } = req.body || {};

  const cleanPin = (pinCode || '').toString().trim();
  const cleanDevice = (deviceId || '').toString().trim().toUpperCase();

  if (
    cleanPin !== MASTER_RECOVERY_PIN && 
    cleanPin !== '1993' && 
    cleanPin !== '01100051593' &&
    cleanPin !== '0kingold0' &&
    cleanPin.toUpperCase() !== 'BKKING'
  ) {
    res.status(403).json({ success: false, error: 'الرقم السري للمدير العام غير صحيح. (PIN: 1993)' });
    return;
  }

  const store = getLicenseStore();
  const now = Date.now();
  let device = store.devices[cleanDevice];

  if (!device && cleanDevice) {
    device = {
      deviceId: cleanDevice,
      firstSeenAt: now,
      trialDurationMs: TRIAL_DURATION_MS,
      trialExpiresAt: now + 365 * 24 * 3600000,
      status: 'active',
      isActivated: true,
      activationStartedAt: now,
      activationExpiresAt: now + 365 * 24 * 3600000,
      activationCount: 1,
      activatedAt: now,
      licenseKey: 'BK-LIC-KING-1993-MASTER-LIFETIME',
      licenseExpiresAt: 0, // Lifetime
      planType: 'lifetime',
      clientName: 'جهاز المدير العام (M-King Master)',
      lastSeenAt: now,
      ip: req.socket.remoteAddress || '127.0.0.1',
      deviceName: parseDeviceName(req.headers['user-agent'] as string || ''),
      history: [{ id: 'hist-' + now, timestamp: now, action: 'activated', details: 'تفعيل دائم بواسطة كود PIN المدير العام', performedBy: 'Master Admin' }],
    };
    store.devices[cleanDevice] = device;
  } else if (device) {
    device.status = 'active';
    device.isActivated = true;
    device.activationStartedAt = now;
    device.activationExpiresAt = now + 365 * 24 * 3600000;
    device.activationCount = (device.activationCount || 0) + 1;
    device.activatedAt = now;
    device.licenseKey = 'BK-LIC-KING-1993-MASTER-LIFETIME';
    device.licenseExpiresAt = 0;
    device.planType = 'lifetime';
    device.clientName = 'جهاز المدير العام (M-King Master)';
    device.lastSeenAt = now;
  }

  saveLicenseStore(store);

  // Return fresh admin token as well so the user gets logged into the master account
  const currentAuth = getMasterAuth();
  const freshToken = generateToken();
  const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  
  activeSessions.set(freshToken, {
    id: sessionId,
    token: freshToken,
    username: currentAuth.username || 'King',
    name: currentAuth.name || 'M-King',
    authVersion: currentAuth.authVersion,
    loginTime: Date.now(),
    lastActive: Date.now(),
    ip: req.socket.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] as string || '',
    deviceName: parseDeviceName(req.headers['user-agent'] as string || ''),
  });

  res.json({
    success: true,
    message: 'تم تفعيل الجهاز بصفته جهاز المدير العام بنجاح!',
    token: freshToken,
    user: {
      username: currentAuth.username || 'King',
      name: currentAuth.name || 'M-King',
      role: 'admin',
      roleTitleAr: 'المدير العام',
      roleTitleEn: 'Master Administrator',
      branch: 'Central Headquarters & Master Core',
    },
  });
});

// 4. Admin: Generate Cryptographic License Key for a Client
app.post('/api/license/admin/generate', (req, res) => {
  if (!isCallerMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'غير مصرح لك. هذه الخاصية متاحة للمدير العام فقط.' });
    return;
  }

  const { deviceId, clientName, planType = 'annual', durationDays = 365, priceEgp = DEFAULT_LICENSE_PRICE_EGP, notes } = req.body || {};

  const cleanDevice = (!deviceId || deviceId.trim().toUpperCase() === 'UNIVERSAL' || deviceId.trim().toUpperCase() === 'ALL')
    ? 'UNIVERSAL'
    : deviceId.trim().toUpperCase();

  const { key, expiresAt } = generateLicenseKey(cleanDevice, planType, Number(durationDays));

  const store = getLicenseStore();
  const record: StoredLicenseRecord = {
    key,
    deviceId: cleanDevice,
    clientName: clientName?.trim() || (cleanDevice === 'UNIVERSAL' ? 'مفتاح ترخيص عام' : 'عميل تجاري'),
    planType,
    priceEgp: Number(priceEgp) || DEFAULT_LICENSE_PRICE_EGP,
    createdAt: Date.now(),
    expiresAt,
    generatedBy: 'M-King (Master Admin)',
    notes: notes?.trim() || '',
    isActive: true,
  };

  store.licenses[key] = record;
  saveLicenseStore(store);

  // Generate ready-to-send WhatsApp Message
  const durationText = planType === 'lifetime' ? 'مدى الحياة (دائم)' : `${durationDays} يوم`;
  const whatsappMessage = `👑 *منظومة BURGER KING & Talabat Audit - ترخيص رسمي*
مرحباً بك أستاذ / ${record.clientName}،
تم إصدار مفتاح تفعيل النسخة الكاملة بنجاح:
🔑 *كود الترخيص:*
\`${key}\`
📱 *كود الجهاز:* ${cleanDevice === 'UNIVERSAL' ? 'يعمل على أي جهاز (شامل)' : cleanDevice}
⏳ *المدة:* ${durationText}
💰 *المبلغ المستلم:* ${record.priceEgp.toLocaleString()} ج.م

طريقة التفعيل: انسخ الكود وضعه في خانة (مفتاح التفعيل) في شاشة البرنامج واضغط (تفعيل الترخيص فوراً). شكراً لثقتكم!`;

  res.json({
    success: true,
    licenseKey: key,
    record,
    whatsappMessage,
    expiresAt,
  });
});

// 5. Admin: List All Tracked Devices & Licenses
app.get('/api/license/admin/devices', (req, res) => {
  if (!isCallerMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'غير مصرح لك.' });
    return;
  }

  const store = getLicenseStore();
  const now = Date.now();

  const devicesList = Object.values(store.devices).map(d => {
    let status: 'locked' | 'active' | 'pending' = d.status || (d.isActivated ? 'active' : 'locked');
    let remainingMs = 0;

    if (status === 'active') {
      const expiry = d.activationExpiresAt || d.licenseExpiresAt || d.trialExpiresAt || 0;
      if (expiry > 0 && now >= expiry) {
        status = 'locked';
        d.status = 'locked';
        d.isActivated = false;
        remainingMs = 0;
      } else {
        remainingMs = expiry > 0 ? Math.max(0, expiry - now) : 999999999999;
      }
    } else {
      remainingMs = 0;
    }

    return {
      ...d,
      status,
      isActivated: status === 'active',
      remainingMs,
      activationCount: d.activationCount || (d.isActivated ? 1 : 0),
      history: d.history || [],
    };
  });

  saveLicenseStore(store);

  const licensesList = Object.values(store.licenses).sort((a, b) => b.createdAt - a.createdAt);
  const notifs = getNotifications();
  const unreadNotifs = notifs.filter(n => !n.read).length;

  res.json({
    success: true,
    totalDevices: devicesList.length,
    activeCount: devicesList.filter(d => d.status === 'active').length,
    lockedCount: devicesList.filter(d => d.status === 'locked').length,
    pendingCount: devicesList.filter(d => d.status === 'pending').length,
    unreadNotificationsCount: unreadNotifs,
    devices: devicesList.sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    licenses: licensesList,
    notifications: notifs.slice(0, 50),
    serverTime: now,
  });
});

// 6. Admin: Remote Action on Device (Lock, Activate with custom duration, Add Time, Reset Device)
app.post('/api/license/admin/device-action', (req, res) => {
  if (!isCallerMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'غير مصرح لك.' });
    return;
  }

  const { action, deviceId, durationMinutes = 60, addMinutes = 60, clientName, notes } = req.body || {};
  if (!deviceId) {
    res.status(400).json({ success: false, error: 'كود الجهاز مطلوب.' });
    return;
  }

  const store = getLicenseStore();
  const cleanDevice = deviceId.trim().toUpperCase();
  const device = store.devices[cleanDevice];

  if (!device) {
    res.status(404).json({ success: false, error: 'الجهاز غير مسجل في النظام.' });
    return;
  }

  const now = Date.now();
  device.history = device.history || [];

  // Action 1: LOCK DEVICE IMMEDIATELY
  if (action === 'lock' || action === 'revoke') {
    device.status = 'locked';
    device.isActivated = false;
    device.activationExpiresAt = 0;
    device.pendingRequest = null;
    device.history.push({
      id: 'hist-' + now,
      timestamp: now,
      action: 'locked',
      details: notes || 'تم قفل الجهاز فورياً بواسطة المدير العام',
      performedBy: 'Master Admin',
    });

    saveLicenseStore(store);

    // Real-time broadcast to instantly lock the client device without reload
    broadcastDeviceEvent('device_updated', {
      deviceId: cleanDevice,
      status: 'locked',
      isActivated: false,
      remainingMs: 0,
      serverTime: now,
    });

    addAdminNotification({
      type: 'device_locked',
      deviceId: cleanDevice,
      deviceName: device.deviceName,
      clientName: device.clientName,
      title: 'قفل جهاز 🔒',
      message: `تم قفل الجهاز ${cleanDevice} بنجاح من لوحة الإدارة.`,
      location: device.location,
    });

    res.json({
      success: true,
      message: `تم قفل الجهاز ${cleanDevice} فوراً على صفحة العميل.`,
      device,
    });
    return;
  }

  // Action 2: ACTIVATE DEVICE WITH SPECIFIC DURATION
  if (action === 'activate' || action === 'instant_activate') {
    const mins = Number(durationMinutes) || 60;
    const durationMs = mins * 60 * 1000;

    device.status = 'active';
    device.isActivated = true;
    device.activationStartedAt = now;
    device.activationExpiresAt = now + durationMs;
    device.activationCount = (device.activationCount || 0) + 1;
    device.pendingRequest = null;
    if (clientName) device.clientName = clientName.trim();
    if (!device.licenseKey) {
      device.licenseKey = `BK-ACTIVATED-${cleanDevice.slice(-4)}`;
    }

    device.history.push({
      id: 'hist-' + now,
      timestamp: now,
      action: 'activated',
      details: `تفعيل الجهاز لمدة ${mins} دقيقة (${(mins / 60).toFixed(1)} ساعة)`,
      performedBy: 'Master Admin',
    });

    saveLicenseStore(store);

    // Real-time broadcast to instantly unlock the client device without reload
    broadcastDeviceEvent('device_updated', {
      deviceId: cleanDevice,
      status: 'active',
      isActivated: true,
      activationStartedAt: now,
      activationExpiresAt: device.activationExpiresAt,
      remainingMs: durationMs,
      serverTime: now,
    });

    addAdminNotification({
      type: 'device_activated',
      deviceId: cleanDevice,
      deviceName: device.deviceName,
      clientName: device.clientName,
      title: 'تفعيل جهاز 🚀',
      message: `تم تفعيل الجهاز ${cleanDevice} لمدة ${mins} دقيقة بنجاح.`,
      location: device.location,
    });

    res.json({
      success: true,
      message: `تم تفعيل الجهاز ${cleanDevice} لمدة ${mins} دقيقة بنجاح!`,
      device,
    });
    return;
  }

  // Action 3: ADD TIME / EXTEND TIME
  if (action === 'add_time' || action === 'extend_time') {
    const mins = Number(addMinutes) || 60;
    const extraMs = mins * 60 * 1000;
    const baseTime = Math.max(now, device.activationExpiresAt || now);

    device.status = 'active';
    device.isActivated = true;
    device.activationExpiresAt = baseTime + extraMs;
    if (!device.activationStartedAt) device.activationStartedAt = now;

    device.history.push({
      id: 'hist-' + now,
      timestamp: now,
      action: 'time_added',
      details: `إضافة ${mins} دقيقة للوقت المتبقي`,
      performedBy: 'Master Admin',
    });

    saveLicenseStore(store);

    const remainingMs = device.activationExpiresAt - now;

    // Real-time broadcast to update countdown on client device
    broadcastDeviceEvent('device_updated', {
      deviceId: cleanDevice,
      status: 'active',
      isActivated: true,
      activationExpiresAt: device.activationExpiresAt,
      remainingMs,
      serverTime: now,
    });

    res.json({
      success: true,
      message: `تمت إضافة ${mins} دقيقة للجهاز ${cleanDevice} بنجاح!`,
      device,
    });
    return;
  }

  // Action 4: RESET DEVICE (Lock immediately, revoke token, but preserve history & data)
  if (action === 'reset' || action === 'clear_device') {
    device.status = 'locked';
    device.isActivated = false;
    device.activationExpiresAt = 0;
    device.licenseKey = undefined; // Invalidate active token
    device.pendingRequest = null;

    device.history.push({
      id: 'hist-' + now,
      timestamp: now,
      action: 'reset',
      details: 'إعادة تعيين وقفل الجهاز بواسطة المدير العام (تم إبطال التوكن مع الحفاظ على السجل)',
      performedBy: 'Master Admin',
    });

    saveLicenseStore(store);

    // Real-time broadcast to instantly lock client page
    broadcastDeviceEvent('device_updated', {
      deviceId: cleanDevice,
      status: 'locked',
      isActivated: false,
      remainingMs: 0,
      serverTime: now,
    });

    addAdminNotification({
      type: 'device_reset',
      deviceId: cleanDevice,
      deviceName: device.deviceName,
      clientName: device.clientName,
      title: 'إعادة تعيين جهاز 🔄',
      message: `تم عمل Reset للجهاز ${cleanDevice} وقفله فوراً على صفحة العميل.`,
      location: device.location,
    });

    res.json({
      success: true,
      message: `تمت إعادة تعيين الجهاز ${cleanDevice} وقفله فوراً من صفحة العميل، مع الحفاظ على بيانات وسجل الجهاز في قاعدة البيانات.`,
      device,
    });
    return;
  }

  // Action 5: REJECT PENDING ACTIVATION REQUEST
  if (action === 'reject_request') {
    device.status = 'locked';
    device.pendingRequest = null;
    device.history.push({
      id: 'hist-' + now,
      timestamp: now,
      action: 'locked',
      details: 'رفض طلب التفعيل بواسطة المدير العام',
      performedBy: 'Master Admin',
    });

    saveLicenseStore(store);

    broadcastDeviceEvent('device_updated', {
      deviceId: cleanDevice,
      status: 'locked',
      pendingRequest: null,
      serverTime: now,
    });

    res.json({
      success: true,
      message: `تم رفض طلب تفعيل الجهاز ${cleanDevice}.`,
      device,
    });
    return;
  }

  res.status(400).json({ success: false, error: 'إجراء غير معروف.' });
});

// 7. Persistent Admin Notifications Management Endpoints
app.get('/api/admin/notifications', (req, res) => {
  if (!isCallerMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'غير مصرح لك.' });
    return;
  }

  const notifs = getNotifications();
  const unreadCount = notifs.filter(n => !n.read).length;

  res.json({
    success: true,
    notifications: notifs,
    unreadCount,
    totalCount: notifs.length,
  });
});

app.post('/api/admin/notifications/mark-read', (req, res) => {
  if (!isCallerMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'غير مصرح لك.' });
    return;
  }

  const { id } = req.body || {};
  const notifs = getNotifications();

  if (id === 'all' || !id) {
    notifs.forEach(n => { n.read = true; });
  } else {
    const target = notifs.find(n => n.id === id);
    if (target) target.read = true;
  }

  saveNotifications(notifs);
  res.json({ success: true, message: 'تم تحديث حالة الإشعارات.' });
});

app.delete('/api/admin/notifications/:id', (req, res) => {
  if (!isCallerMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'غير مصرح لك.' });
    return;
  }

  const { id } = req.params;
  let notifs = getNotifications();
  notifs = notifs.filter(n => n.id !== id);
  saveNotifications(notifs);

  res.json({ success: true, message: 'تم حذف الإشعار.' });
});

app.post('/api/admin/notifications/clear', (req, res) => {
  if (!isCallerMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'غير مصرح لك.' });
    return;
  }

  saveNotifications([]);
  res.json({ success: true, message: 'تم مسح جميع الإشعارات بنجاح.' });
});

// ==================== AI RECONCILIATION API (GEMINI OCR) ====================

function parseBase64Image(dataUri: string): { data: string; mimeType: string } | null {
  if (!dataUri) return null;
  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }
  // If raw base64 string provided
  return {
    mimeType: 'image/jpeg',
    data: dataUri,
  };
}

app.post('/api/ai/reconcile-images', async (req, res) => {
  try {
    const { alohaImage, talabatImage, singleImage, notes } = req.body || {};

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        success: false,
        error: 'مفتاح الذكاء الاصطناعي (Gemini API Key) غير مهيأ على السيرفر.',
      });
      return;
    }

    const parts: any[] = [];

    if (alohaImage) {
      const parsedAloha = parseBase64Image(alohaImage);
      if (parsedAloha) {
        parts.push({
          inlineData: {
            mimeType: parsedAloha.mimeType,
            data: parsedAloha.data,
          },
        });
        parts.push({ text: '📸 الصورة أعلاه تمثل تقرير/شيكات نظام ألوها (Aloha POS Report / Checks).' });
      }
    }

    if (talabatImage) {
      const parsedTalabat = parseBase64Image(talabatImage);
      if (parsedTalabat) {
        parts.push({
          inlineData: {
            mimeType: parsedTalabat.mimeType,
            data: parsedTalabat.data,
          },
        });
        parts.push({ text: '📸 الصورة أعلاه تمثل كشف/تقرير منصة طلبات (Talabat Settlement Report / Sheet).' });
      }
    }

    if (singleImage && !alohaImage && !talabatImage) {
      const parsedSingle = parseBase64Image(singleImage);
      if (parsedSingle) {
        parts.push({
          inlineData: {
            mimeType: parsedSingle.mimeType,
            data: parsedSingle.data,
          },
        });
        parts.push({ text: '📸 الصورة أعلاه تحتوي على بيانات تقريري ألوها وطلبات للمقارنة والمطابقة.' });
      }
    }

    if (parts.length === 0) {
      res.status(400).json({
        success: false,
        error: 'يرجى إرفاق صورة تقرير ألوها وصورة تقرير طلبات للمطابقة.',
      });
      return;
    }

    const promptText = `
أنت خبير تدقيق مالي ومطابقة حسابات مطاعم برجر كينج ومنصة طلبات (Reconciliation Expert).
المطلوب استخراج ومقارنة بيانات كل شيك/أوردر بين تقرير ألوها (Aloha POS) وتقرير طلبات (Talabat) بدقة 100%.

القواعد الصارمة للمطابقة:
1. قارن كل طلب بناءً على رقم أوردر طلبات التناظري (يبدأ عادة بـ 373... أو أرقام الطلب المماثلة).
2. استخرج الأعمدة التالية لكل سطر:
   - alohaOrderNo: رقم الشيك أو الأوردر في ألوها (Aloha Check # / Order No). إذا كان الطلب ملغياً على المطعم أو غير مسجل في ألوها، اجعل قيمته "0" أو "—".
   - talabatOrderNo: رقم أوردر طلبات التناظري (Talabat Order NO مثل 373...).
   - time: وقت الطلب (مثال "01:25 PM" أو "13:25").
   - paymentMethod: طريقة الدفع ("Cash" أو "Credit" أو "Otlob Mode" أو "Online").
   - alohaAmount: مبلغ ألوها (Aloha AM) كرقم عشري دقيق. إذا كان غير موجود أو ملغي اجعله 0.
   - talabatAmount: مبلغ طلبات (Talabat AM) كرقم عشري دقيق.
   - variance: الفارق الحسابي المحسوب بدقة كالتالي: (alohaAmount - talabatAmount).
     * إذا كان alohaAmount = 0 و talabatAmount = 150، الفارق يكون -150.00 بالسالب.
     * إذا كان alohaAmount = 265 و talabatAmount = 250، الفارق يكون +15.00 بالموجب (فرق توصيل Serv).
     * إذا كان alohaAmount = 200 و talabatAmount = 200، الفارق يكون 0.00.
   - comment: الملاحظات والبيان التوضيحي:
     * "متطابق" (إذا تطابق المبلغان وطريقة الدفع).
     * "فرق توصيل Serv" (إذا كان الفارق ناتج عن خدمة التوصيل / مصاريف الشحن).
     * "أوردر ملغي Cancel Charged على المطعم (M.O.E)" (إذا كان رقم ألوها = 0 أو ملغي وتم تحميله على المطعم).
     * "خصم M.O.E" (إذا كان هناك خصم أو تسوية مطعم).
     * "غير مسجل في كشف طلبات" (إذا كان موجود في ألوها وغير موجود في طلبات).
     * "غير مسجل في ألوها" (إذا كان مسجل في طلبات بدون شيك ألوها).
     * "اختلاف طريقة الدفع (Cash ↔ Credit)" (إذا اختلفت طريقة الدفع).

3. ملاحظات إضافية من المستخدم: ${notes || 'لا توجد'}

أعد النتيجة بتنسيق JSON حصراً يطابق الـ Schema المحددة.
    `;

    parts.push({ text: promptText });

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: {
              type: Type.OBJECT,
              properties: {
                totalOrders: { type: Type.NUMBER },
                matchedCount: { type: Type.NUMBER },
                cancelledOrMoeCount: { type: Type.NUMBER },
                deliveryServVarianceCount: { type: Type.NUMBER },
                totalAlohaAmount: { type: Type.NUMBER },
                totalTalabatAmount: { type: Type.NUMBER },
                netVariance: { type: Type.NUMBER },
              },
              required: [
                'totalOrders',
                'matchedCount',
                'cancelledOrMoeCount',
                'totalAlohaAmount',
                'totalTalabatAmount',
                'netVariance',
              ],
            },
            rows: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  alohaOrderNo: { type: Type.STRING, description: 'رقم الأوردر أو الشيك في ألوها أو 0 إذا ملغي' },
                  talabatOrderNo: { type: Type.STRING, description: 'رقم أوردر طلبات التناظري 373...' },
                  time: { type: Type.STRING, description: 'وقت الطلب' },
                  paymentMethod: { type: Type.STRING, description: 'Cash أو Credit' },
                  alohaAmount: { type: Type.NUMBER, description: 'مبلغ ألوها Aloha AM' },
                  talabatAmount: { type: Type.NUMBER, description: 'مبلغ طلبات Talabat AM' },
                  variance: { type: Type.NUMBER, description: 'الفارق = Aloha AM - Talabat AM' },
                  comment: { type: Type.STRING, description: 'الملاحظة: متطابق / فرق توصيل Serv / أوردر ملغي Cancel Charged على المطعم' },
                  isCancelledOrMoe: { type: Type.BOOLEAN },
                  isDeliveryFeeVariance: { type: Type.BOOLEAN },
                },
                required: [
                  'alohaOrderNo',
                  'talabatOrderNo',
                  'time',
                  'paymentMethod',
                  'alohaAmount',
                  'talabatAmount',
                  'variance',
                  'comment',
                ],
              },
            },
          },
          required: ['rows', 'summary'],
        },
      },
    });

    const responseText = aiResponse.text || '{}';
    const parsedResult = JSON.parse(responseText);

    res.json({
      success: true,
      data: parsedResult,
    });
  } catch (err: any) {
    console.error('Error during AI image reconciliation:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'حدث خطأ أثناء تحليل الصور بالذكاء الاصطناعي.',
    });
  }
});

// ==================== VITE MIDDLEWARE / SPA FALLBACK ====================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ Burger King & Talabat Audit Core server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
