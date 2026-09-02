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
    res.status(400).json({ success: false, error: 'Please enter both username and password.' });
    return;
  }

  const currentAuth = getMasterAuth();

  const isUserMatch = username.trim().toLowerCase() === currentAuth.username.toLowerCase();
  const isPassMatch = password.trim() === currentAuth.passwordHash;

  if (!isUserMatch || !isPassMatch) {
    res.status(401).json({
      success: false,
      error: 'اسم المستخدم أو كلمة المرور غير صحيحة! يرجى التأكد من البيانات والمحاولة مجدداً.',
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
    username: currentAuth.username,
    name: currentAuth.name,
    authVersion: currentAuth.authVersion,
    loginTime: Date.now(),
    lastActive: Date.now(),
    ip: clientIp,
    userAgent,
    deviceName,
  };

  activeSessions.set(token, session);

  res.json({
    success: true,
    token,
    sessionId,
    authVersion: currentAuth.authVersion,
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
    cleanPin === '201100051593';

  if (!cleanEmail || cleanEmail !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({
      success: false,
      error: 'The entered email is not registered as an authorized administrator!',
    });
    return;
  }

  if (!isMasterPinMatch) {
    res.status(403).json({
      success: false,
      error: 'Master Security PIN is incorrect! Password cannot be reset.',
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

  if (!cleanEmail || cleanEmail !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({
      success: false,
      error: 'Unauthorized email address!',
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
const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours Free Trial
const DEFAULT_LICENSE_PRICE_EGP = 5000; // 5,000 EGP License
const MASTER_CONTACT_PHONE = '01100051593';

interface DeviceRecord {
  deviceId: string;
  firstSeenAt: number;
  trialDurationMs: number;
  trialExpiresAt: number;
  isActivated: boolean;
  activatedAt?: number;
  licenseKey?: string;
  licenseExpiresAt?: number;
  planType: 'trial' | 'annual' | 'lifetime' | 'monthly' | 'semi_annual' | 'custom';
  clientName?: string;
  branchName?: string;
  phone?: string;
  notes?: string;
  lastSeenAt: number;
  ip: string;
  deviceName: string;
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
    return JSON.parse(raw);
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
): { valid: boolean; planType?: 'annual' | 'lifetime' | 'monthly' | 'semi_annual' | 'custom'; expiresAt?: number; reason?: string } {
  const store = getLicenseStore();
  const cleanKey = (key || '').trim().toUpperCase();
  const cleanDevice = (deviceId || '').trim().toUpperCase();

  // 1. Universal Master Bypass Keys
  if (
    cleanKey === 'BK-LIC-KING-1993-MASTER-LIFETIME' || 
    cleanKey === 'BK-LIC-M-KING-01100051593' ||
    cleanKey === 'KING-1993'
  ) {
    return { valid: true, planType: 'lifetime', expiresAt: 0 };
  }

  // 2. Check explicitly recorded generated keys
  if (store.licenses[cleanKey]) {
    const rec = store.licenses[cleanKey];
    if (!rec.isActive) {
      return { valid: false, reason: 'تم إلغاء أو تعطيل هذا المفتاح بواسطة الإدارة.' };
    }
    const isUniversalKey = !rec.deviceId || rec.deviceId.toUpperCase() === 'UNIVERSAL' || rec.deviceId === 'ANY';
    if (!isUniversalKey && rec.deviceId && rec.deviceId.toUpperCase() !== cleanDevice) {
      return { 
        valid: false, 
        reason: `هذا المفتاح مخصص لجهاز (${rec.deviceId.slice(-9)}) بينما كود جهازك الحالي هو (${cleanDevice.slice(-9)}). يرجى التأكد من كود الجهاز.` 
      };
    }
    if (rec.expiresAt > 0 && Date.now() > rec.expiresAt) {
      return { valid: false, reason: 'انتهت فترة صلاحية هذا الترخيص.' };
    }
    return { valid: true, planType: rec.planType, expiresAt: rec.expiresAt };
  }

  // 3. Cryptographic Signature Validation
  const parts = cleanKey.split('-');
  if (parts.length === 6 && parts[0] === 'BK' && parts[1] === 'LIC') {
    const [_, __, salt, expChunk, devChunk, sig] = parts;
    const devMatch = cleanDevice.replace(/[^A-Z0-9]/g, '').slice(-4).padStart(4, 'X');
    const isUnivChunk = devChunk === 'UNIV' || devChunk === 'XXXX';

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

  return { valid: false, reason: 'مفتاح الترخيص غير صالح. يرجى التأكد من نسخه بشكل دقيق دون مسافات زائدة.' };
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

// 1. Device License & 24-Hour Trial Status Check
app.get('/api/license/status', (req, res) => {
  const deviceId = ((req.query.deviceId as string) || '').trim().toUpperCase();
  const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || '';
  const deviceName = parseDeviceName(userAgent);

  const isMaster = isCallerMasterAdmin(req);

  // If Master Admin, always full access and never expired!
  if (isMaster) {
    res.json({
      success: true,
      deviceId: deviceId || 'BK-DEV-MASTER-ADMIN',
      status: 'active',
      isExpired: false,
      isMaster: true,
      trialStartedAt: Date.now() - 3600000,
      trialExpiresAt: Date.now() + 365 * 24 * 3600000,
      remainingMs: 365 * 24 * 3600000,
      priceEgp: DEFAULT_LICENSE_PRICE_EGP,
      planType: 'lifetime',
      contactPhone: MASTER_CONTACT_PHONE,
      clientName: 'المدير العام (Master Admin)',
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

  // First time this device connects: start 24-hour trial!
  if (!device) {
    device = {
      deviceId,
      firstSeenAt: now,
      trialDurationMs: TRIAL_DURATION_MS,
      trialExpiresAt: now + TRIAL_DURATION_MS,
      isActivated: false,
      planType: 'trial',
      lastSeenAt: now,
      ip: clientIp,
      deviceName,
    };
    store.devices[deviceId] = device;
    saveLicenseStore(store);
  } else {
    // Update last seen
    device.lastSeenAt = now;
    device.ip = clientIp;
    if (deviceName) device.deviceName = deviceName;
    saveLicenseStore(store);
  }

  // Check status
  let status: 'trial' | 'active' | 'expired' = 'trial';
  let isExpired = false;
  let remainingMs = 0;

  if (device.isActivated) {
    if (device.licenseExpiresAt && device.licenseExpiresAt > 0) {
      if (now > device.licenseExpiresAt) {
        status = 'expired';
        isExpired = true;
        remainingMs = 0;
      } else {
        status = 'active';
        remainingMs = device.licenseExpiresAt - now;
      }
    } else {
      // Lifetime license
      status = 'active';
      remainingMs = 999999999999;
    }
  } else {
    // In Trial mode
    if (now > device.trialExpiresAt) {
      status = 'expired';
      isExpired = true;
      remainingMs = 0;
    } else {
      status = 'trial';
      remainingMs = Math.max(0, device.trialExpiresAt - now);
    }
  }

  res.json({
    success: true,
    deviceId: device.deviceId,
    status,
    isExpired,
    trialStartedAt: device.firstSeenAt,
    trialExpiresAt: device.trialExpiresAt,
    remainingMs,
    priceEgp: store.defaultPriceEgp || DEFAULT_LICENSE_PRICE_EGP,
    planType: device.planType || 'trial',
    licenseKey: device.licenseKey,
    licenseExpiresAt: device.licenseExpiresAt,
    clientName: device.clientName,
    contactPhone: MASTER_CONTACT_PHONE,
    isMaster: false,
  });
});

// 2. Activate License Key
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

  if (!device) {
    const clientIp = ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.socket.remoteAddress || '127.0.0.1';
    device = {
      deviceId: cleanDevice,
      firstSeenAt: now,
      trialDurationMs: TRIAL_DURATION_MS,
      trialExpiresAt: now,
      isActivated: true,
      activatedAt: now,
      licenseKey: cleanKey,
      licenseExpiresAt: verification.expiresAt,
      planType: verification.planType || 'annual',
      clientName: clientName?.trim() || 'عميل مرخص',
      lastSeenAt: now,
      ip: clientIp,
      deviceName: parseDeviceName(req.headers['user-agent'] as string || ''),
    };
  } else {
    device.isActivated = true;
    device.activatedAt = now;
    device.licenseKey = cleanKey;
    device.licenseExpiresAt = verification.expiresAt;
    device.planType = verification.planType || 'annual';
    if (clientName) device.clientName = clientName.trim();
    device.lastSeenAt = now;
  }

  store.devices[cleanDevice] = device;

  // Mark in licenses store if existing record
  if (store.licenses[cleanKey]) {
    store.licenses[cleanKey].usedAt = now;
    store.licenses[cleanKey].deviceId = cleanDevice;
  }

  saveLicenseStore(store);

  res.json({
    success: true,
    message: 'تم تفعيل النسخة الكاملة بنجاح! شكراً لاشتراكك في منظومة KING Audit.',
    planType: device.planType,
    licenseExpiresAt: device.licenseExpiresAt,
    clientName: device.clientName,
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
    cleanPin !== '01100051593'
  ) {
    res.status(403).json({ success: false, error: 'الرقم السري للمدير العام غير صحيح.' });
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
      isActivated: true,
      activatedAt: now,
      licenseKey: 'BK-LIC-KING-1993-MASTER-LIFETIME',
      licenseExpiresAt: 0, // Lifetime
      planType: 'lifetime',
      clientName: 'جهاز المدير العام (M-King Master)',
      lastSeenAt: now,
      ip: req.socket.remoteAddress || '127.0.0.1',
      deviceName: parseDeviceName(req.headers['user-agent'] as string || ''),
    };
    store.devices[cleanDevice] = device;
  } else if (device) {
    device.isActivated = true;
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
    username: currentAuth.username,
    name: currentAuth.name,
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
      username: currentAuth.username,
      name: currentAuth.name,
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

  if (!deviceId || deviceId.trim().length < 4) {
    res.status(400).json({ success: false, error: 'يرجى تحديد كود الجهاز الخاص بالعميل.' });
    return;
  }

  const cleanDevice = deviceId.trim().toUpperCase();
  const { key, expiresAt } = generateLicenseKey(cleanDevice, planType, Number(durationDays));

  const store = getLicenseStore();
  const record: StoredLicenseRecord = {
    key,
    deviceId: cleanDevice,
    clientName: clientName?.trim() || 'عميل تجاري',
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
📱 *كود جهازك:* ${cleanDevice}
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
    let status: 'trial' | 'active' | 'expired' = 'trial';
    let remainingMs = 0;

    if (d.isActivated) {
      if (d.licenseExpiresAt && d.licenseExpiresAt > 0) {
        if (now > d.licenseExpiresAt) {
          status = 'expired';
          remainingMs = 0;
        } else {
          status = 'active';
          remainingMs = d.licenseExpiresAt - now;
        }
      } else {
        status = 'active';
        remainingMs = 999999999999;
      }
    } else {
      if (now > d.trialExpiresAt) {
        status = 'expired';
        remainingMs = 0;
      } else {
        status = 'trial';
        remainingMs = Math.max(0, d.trialExpiresAt - now);
      }
    }

    return {
      ...d,
      status,
      remainingMs,
    };
  });

  const licensesList = Object.values(store.licenses).sort((a, b) => b.createdAt - a.createdAt);

  res.json({
    success: true,
    totalDevices: devicesList.length,
    activeCount: devicesList.filter(d => d.status === 'active').length,
    trialCount: devicesList.filter(d => d.status === 'trial').length,
    expiredCount: devicesList.filter(d => d.status === 'expired').length,
    devices: devicesList.sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    licenses: licensesList,
  });
});

// 6. Admin: Remote Action on Device (Instant activate, extend trial, or reset)
app.post('/api/license/admin/device-action', (req, res) => {
  if (!isCallerMasterAdmin(req)) {
    res.status(403).json({ success: false, error: 'غير مصرح لك.' });
    return;
  }

  const { action, deviceId, extraHours = 24, clientName } = req.body || {};
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

  if (action === 'extend_trial') {
    const additionalMs = Number(extraHours) * 3600000;
    const baseTime = Math.max(now, device.trialExpiresAt);
    device.trialExpiresAt = baseTime + additionalMs;
    device.isActivated = false;
    device.planType = 'trial';
    saveLicenseStore(store);
    res.json({
      success: true,
      message: `تم تمديد الفترة التجريبية للجهاز ${cleanDevice} بمقدار ${extraHours} ساعة بنجاح!`,
      newTrialExpiresAt: device.trialExpiresAt,
    });
    return;
  }

  if (action === 'instant_activate') {
    device.isActivated = true;
    device.activatedAt = now;
    device.licenseExpiresAt = now + 365 * 24 * 3600000; // 1 year
    device.planType = 'annual';
    device.licenseKey = `BK-ADMIN-INSTANT-${cleanDevice.slice(-4)}`;
    if (clientName) device.clientName = clientName;
    saveLicenseStore(store);
    res.json({
      success: true,
      message: `تم التفعيل المباشر للجهاز ${cleanDevice} لمدة سنة كاملة بنجاح!`,
      device,
    });
    return;
  }

  if (action === 'revoke') {
    device.isActivated = false;
    device.trialExpiresAt = now - 1000; // Expired immediately
    device.planType = 'trial';
    saveLicenseStore(store);
    res.json({
      success: true,
      message: `تم إيقاف تفعيل الجهاز ${cleanDevice} وحظره بنجاح.`,
    });
    return;
  }

  res.status(400).json({ success: false, error: 'إجراء غير معروف.' });
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
