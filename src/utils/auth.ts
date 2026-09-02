import { UserAccount } from '../types';

const TOKEN_KEY = 'bk_talabat_master_token_v3';
const USER_KEY = 'bk_talabat_master_user_v3';

export interface AuthResponse {
  success: boolean;
  token?: string;
  authVersion?: number;
  user?: UserAccount;
  error?: string;
  message?: string;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, token);
    }
  } catch (err) {
    console.error('Failed to set token', err);
  }
}

export function getStoredUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserAccount | null): void {
  try {
    if (!user) {
      localStorage.removeItem(USER_KEY);
    } else {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  } catch (err) {
    console.error('Failed to set user', err);
  }
}

// 1. Real Login via Backend API
export async function apiLogin(username: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.token) {
      setStoredToken(data.token);
      setStoredUser(data.user);
      return { success: true, token: data.token, user: data.user, authVersion: data.authVersion };
    }

    return {
      success: false,
      error: data.error || 'Authentication failed. Please verify your username and password.',
    };
  } catch (err) {
    return {
      success: false,
      error: 'Unable to reach the central cloud server. Please verify your internet connection.',
    };
  }
}

// 2. Real Verify Session via Backend API (Checks if token is valid and password hasn't changed)
export async function apiVerifySession(): Promise<{ valid: boolean; user?: UserAccount; reason?: string; message?: string }> {
  const token = getStoredToken();
  if (!token) {
    return { valid: false, reason: 'no_token' };
  }

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (res.ok && data.valid) {
      if (data.user) setStoredUser(data.user);
      return { valid: true, user: data.user };
    }

    // Token invalid or password was changed centrally on another device!
    setStoredToken(null);
    setStoredUser(null);
    return {
      valid: false,
      reason: data.error || 'invalid_token',
      message: data.message || 'Master password was changed or session expired. Session logged out immediately.',
    };
  } catch {
    // In case of network glitch, keep session or retry next interval
    return { valid: true };
  }
}

// 3. Real Change Central Master Credentials
export async function apiChangeMasterCredentials(
  currentPassword: string,
  newUsername: string,
  newPassword: string,
  newName?: string
): Promise<AuthResponse> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch('/api/auth/change-credentials', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        currentPassword,
        newUsername,
        newPassword,
        newName,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (data.newToken) {
        setStoredToken(data.newToken);
      }
      if (data.user) {
        setStoredUser(data.user);
      }
      return {
        success: true,
        token: data.newToken,
        user: data.user,
        message: data.message,
      };
    }

    return {
      success: false,
      error: data.error || 'Failed to update credentials.',
    };
  } catch (err) {
    return {
      success: false,
      error: 'Unable to connect to the central server to synchronize changes.',
    };
  }
}

export interface SendOtpResponse {
  success: boolean;
  error?: string;
  message?: string;
}

// 3.5. Request 6-digit OTP code sent to authorized email (0kingold0@gmail.com)
export async function apiSendEmailOtp(email: string): Promise<SendOtpResponse> {
  try {
    const res = await fetch('/api/auth/send-email-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message,
      };
    }

    return {
      success: false,
      error: data.error || 'The entered email is not registered as an authorized administrator!',
    };
  } catch {
    return {
      success: false,
      error: 'Unable to reach the central cloud server to dispatch security code.',
    };
  }
}

// 3.6. Reset Password via Master PIN & Authorized Email
export async function apiResetByMasterPin(
  email: string,
  pinCode: string,
  newPassword: string
): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/reset-by-master-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        pinCode,
        newPassword,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (data.newToken) {
        setStoredToken(data.newToken);
      }
      if (data.user) {
        setStoredUser(data.user);
      }
      return {
        success: true,
        token: data.newToken,
        user: data.user,
        message: data.message,
      };
    }

    return {
      success: false,
      error: data.error || 'Master security PIN or email is incorrect.',
    };
  } catch {
    return {
      success: false,
      error: 'Unable to reach the central server to reset master credentials.',
    };
  }
}

// 3.7. Verify 6-digit OTP and reset password with full kill-switch
export async function apiVerifyEmailOtpAndReset(
  email: string,
  otpCode: string,
  newPassword: string
): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/verify-email-otp-and-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        otpCode,
        newPassword,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (data.newToken) {
        setStoredToken(data.newToken);
      }
      if (data.user) {
        setStoredUser(data.user);
      }
      return {
        success: true,
        token: data.newToken,
        user: data.user,
        message: data.message,
      };
    }

    return {
      success: false,
      error: data.error || 'Verification code is invalid or expired.',
    };
  } catch {
    return {
      success: false,
      error: 'Unable to reach the central server to verify security code.',
    };
  }
}

export interface ActiveSessionInfo {
  id: string;
  username: string;
  name: string;
  deviceName: string;
  ip: string;
  loginTime: number;
  lastActive: number;
  isCurrent: boolean;
}

// 5. Get List of Active Connected Devices
export async function apiGetActiveSessions(): Promise<{ success: boolean; sessions?: ActiveSessionInfo[]; error?: string }> {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'غير مسجل دخول' };

  try {
    const res = await fetch('/api/auth/active-sessions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, sessions: data.sessions || [] };
    }
    return { success: false, error: data.error || 'فشل جلب قائمة الأجهزة' };
  } catch {
    return { success: false, error: 'تعذر الاتصال بالسيرفر المركزي' };
  }
}

// 6. Terminate a Specific Connected Device
export async function apiTerminateSession(sessionId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'غير مسجل دخول' };

  try {
    const res = await fetch('/api/auth/terminate-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, message: data.message };
    }
    return { success: false, error: data.error || 'فشل طرد الجهاز' };
  } catch {
    return { success: false, error: 'تعذر الاتصال بالسيرفر' };
  }
}

// 7. Terminate All Other Connected Devices
export async function apiTerminateAllDevices(): Promise<{ success: boolean; terminatedCount?: number; message?: string; error?: string }> {
  const token = getStoredToken();
  if (!token) return { success: false, error: 'غير مسجل دخول' };

  try {
    const res = await fetch('/api/auth/terminate-all-devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, terminatedCount: data.terminatedCount, message: data.message };
    }
    return { success: false, error: data.error || 'فشل طرد الأجهزة' };
  } catch {
    return { success: false, error: 'تعذر الاتصال بالسيرفر' };
  }
}

// 4. Real Logout
export async function apiLogout(): Promise<void> {
  const token = getStoredToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
  }
  setStoredToken(null);
  setStoredUser(null);
}
