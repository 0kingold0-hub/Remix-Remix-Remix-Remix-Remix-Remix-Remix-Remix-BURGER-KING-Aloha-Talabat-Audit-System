import React, { useState } from 'react';
import { UserAccount } from '../types';
import { apiLogin } from '../utils/auth';
import { Crown, AlertCircle, Eye, EyeOff, Laptop, Cloud } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
  securityNotice?: string;
  onForgotPasswordClick?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, securityNotice, onForgotPasswordClick }) => {
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState(securityNotice || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await apiLogin(userCode, password);
      setIsLoading(false);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'Invalid username or password.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Unable to connect to the central authentication cloud server.');
    }
  };

  const handleMasterQuickLogin = async () => {
    setUserCode('King');
    setPassword('0kingold0');
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await apiLogin('King', '0kingold0');
      setIsLoading(false);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        // Fallback with PIN 1993
        const fallbackRes = await apiLogin('King', '1993');
        if (fallbackRes.success && fallbackRes.user) {
          onLoginSuccess(fallbackRes.user);
        } else {
          setErrorMessage(res.error || 'فشل الدخول التلقائي. يرجى تجربة إدخال كلمة المرور يدوياً.');
        }
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('تعذر الاتصال بسيرفر تسجيل الدخول.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between items-center px-4 py-8 select-none font-sans" dir="ltr">
      {/* Top spacing & sync status */}
      <div className="w-full max-w-md flex justify-between items-center">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Cloud Security Online
        </span>
        <span className="text-[11px] font-semibold text-stone-400">Enterprise v2.5</span>
      </div>

      {/* Center Container */}
      <div className="w-full max-w-[440px] flex flex-col items-center my-auto">
        
        {/* Clean King Branding */}
        <div className="flex flex-col items-center mb-7 text-center">
          <div className="relative mb-1.5">
            <div className="absolute inset-0 bg-amber-400/20 blur-lg rounded-full" />
            <Crown 
              className="w-13 h-13 text-[#D71920] drop-shadow-sm -rotate-3" 
              strokeWidth={2.2} 
              fill="#FDB813" 
            />
          </div>

          <div className="relative">
            <h1 className="text-5xl font-black tracking-wider text-[#502314] uppercase drop-shadow-xs" style={{ fontFamily: 'Impact, Arial Black, sans-serif' }}>
              <span className="text-[#D71920]">K</span>
              <span className="text-[#502314]">I</span>
              <span className="text-[#FF5A00]">N</span>
              <span className="text-[#D71920]">G</span>
            </h1>
            <div className="w-full h-1 bg-gradient-to-r from-[#D71920] via-[#FF5A00] to-[#FDB813] rounded-full mt-0.5" />
          </div>
          <p className="text-xs text-stone-500 font-semibold mt-1">
            Reconciliation & Audit Suite
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full bg-white border border-[#b8c2cc] rounded-2xl p-6 sm:p-7 shadow-sm">
          
          {/* Master Instant Quick Login Button */}
          <button
            type="button"
            onClick={handleMasterQuickLogin}
            disabled={isLoading}
            className="w-full mb-4 py-2 px-3 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-300 rounded-xl text-xs font-bold text-amber-950 flex items-center justify-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-50"
          >
            <Crown className="w-4 h-4 text-amber-600 shrink-0" />
            <span>⚡ دخول فوري للمدير العام (Master Quick Login)</span>
          </button>

          {errorMessage && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            {/* Row 1: User Code */}
            <div className="flex items-center justify-between gap-3">
              <label 
                htmlFor="userCodeInput"
                className="text-sm font-medium text-[#2d5c88] w-24 shrink-0 text-left cursor-pointer"
              >
                User Code
              </label>
              <div className="flex-1">
                <input
                  id="userCodeInput"
                  type="text"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  placeholder="King / 0kingold0@gmail.com"
                  required
                  autoComplete="username"
                  className="w-full px-3 py-1.5 text-sm bg-white border border-[#9aa7b4] rounded-md shadow-inner text-gray-800 focus:outline-none focus:border-[#2d5c88] focus:ring-1 focus:ring-[#2d5c88] transition-all font-medium"
                />
              </div>
            </div>

            {/* Row 2: Password */}
            <div className="flex items-center justify-between gap-3">
              <label 
                htmlFor="passwordInput"
                className="text-sm font-medium text-[#2d5c88] w-24 shrink-0 text-left cursor-pointer"
              >
                Password
              </label>
              <div className="flex-1 relative">
                <input
                  id="passwordInput"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="0kingold0 أو 1993"
                  required
                  autoComplete="current-password"
                  className="w-full pr-8 px-3 py-1.5 text-sm bg-white border border-[#9aa7b4] rounded-md shadow-inner text-gray-800 focus:outline-none focus:border-[#2d5c88] focus:ring-1 focus:ring-[#2d5c88] transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Hint for credentials */}
            <div className="p-2 bg-stone-50 rounded-lg border border-stone-200 text-[11px] text-stone-600 text-center leading-relaxed">
              <span>بيانات المدير العام: المستخدم <strong className="text-stone-800">King</strong> | كلمة المرور <strong className="text-stone-800">0kingold0</strong> أو PIN <strong className="text-stone-800 font-mono">1993</strong></span>
            </div>

            {/* Centered "Log In" Button */}
            <div className="pt-2 flex flex-col items-center gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="min-w-[120px] px-8 py-2 bg-gradient-to-b from-[#fcfcfc] via-[#f4f4f4] to-[#e4e4e4] hover:from-[#f7f7f7] hover:to-[#dcdcdc] active:from-[#dcdcdc] active:to-[#efefef] border border-[#a6b1bc] hover:border-[#8694a1] rounded-md text-xs sm:text-sm font-semibold text-[#333] shadow-xs hover:shadow-xs active:shadow-inner transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  'تسجيل الدخول / Log In'
                )}
              </button>

              {/* Simple & Clean "Forgot Password?" Button */}
              {onForgotPasswordClick && (
                <button
                  type="button"
                  onClick={onForgotPasswordClick}
                  className="text-[13px] text-[#2d5c88] hover:text-[#1a3a58] hover:underline font-semibold transition-colors cursor-pointer"
                >
                  نسيت كلمة المرور؟ / Forgot Password?
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Security Note under Box */}
        <div className="mt-4 text-center space-y-1">
          <p className="text-[11px] text-gray-400 font-medium">
            Centralized Security Authentication Protected
          </p>
          <p className="text-[10px] text-stone-400">
            Password changes made by the administrator sync instantly across all devices.
          </p>
        </div>

      </div>

      {/* Developer and System Signature Footer */}
      <footer className="w-full max-w-md text-center py-2 border-t border-gray-100 flex flex-col items-center justify-center gap-0.5 text-[11px] text-gray-500 font-medium">
        <div>BURGER KING & TALABAT FINANCIAL AUDIT SUITE</div>
        <div className="text-gray-600 font-semibold tracking-wide">
          Developed & Engineered by: <span className="text-[#D71920] font-black">M-King</span> • <span className="text-stone-500 font-mono text-[10px]">v2.5.0 Enterprise</span>
        </div>
      </footer>
    </div>
  );
};

