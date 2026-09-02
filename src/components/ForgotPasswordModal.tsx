import React, { useState } from 'react';
import { Crown, AlertCircle, Eye, EyeOff, X } from 'lucide-react';
import { apiResetByMasterPin } from '../utils/auth';
import type { UserAccount } from '../types';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSuccess?: (user: UserAccount) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onResetSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showNewPass, setShowNewPass] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setEmail('');
    setPinCode('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
    setSuccessMessage('');
    onClose();
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pinCode.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter the administrator email address.');
      return;
    }

    if (!cleanPin) {
      setErrorMessage('Please enter the master security PIN.');
      return;
    }

    if (!newPassword || newPassword.trim().length < 3) {
      setErrorMessage('New password must be at least 3 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password does not match the confirmation field.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiResetByMasterPin(cleanEmail, cleanPin, newPassword.trim());
      setIsLoading(false);

      if (res.success && res.user) {
        setSuccessMessage('Password reset successfully! All other active desktop sessions logged out.');
        if (onResetSuccess) {
          onResetSuccess(res.user);
        }
        setTimeout(() => {
          handleClose();
        }, 1200);
      } else {
        setErrorMessage(res.error || 'The entered credentials or PIN are incorrect.');
      }
    } catch {
      setIsLoading(false);
      setErrorMessage('Unable to connect to the central authentication cloud server.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none font-sans" dir="ltr">
      <div className="w-full max-w-[440px] flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
        
        {/* Clean King Header matching Login */}
        <div className="flex flex-col items-center mb-5 text-center relative w-full">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-0 right-1 p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative mb-1">
            <div className="absolute inset-0 bg-amber-400/20 blur-lg rounded-full" />
            <Crown 
              className="w-10 h-10 text-[#D71920] drop-shadow-sm -rotate-3" 
              strokeWidth={2.2} 
              fill="#FDB813" 
            />
          </div>

          <div className="relative">
            <h2 className="text-3xl font-black tracking-wider text-[#502314] uppercase drop-shadow-xs" style={{ fontFamily: 'Impact, Arial Black, sans-serif' }}>
              <span className="text-[#D71920]">K</span>
              <span className="text-[#502314]">I</span>
              <span className="text-[#FF5A00]">N</span>
              <span className="text-[#D71920]">G</span>
            </h2>
            <div className="w-24 h-0.5 bg-gradient-to-r from-[#D71920] via-[#FF5A00] to-[#FDB813] rounded-full mx-auto mt-0.5" />
          </div>
          <span className="text-[12px] font-semibold text-[#2d5c88] mt-1">
            Master Password Recovery & Reset
          </span>
        </div>

        {/* Form Card matching Login Screen */}
        <div className="w-full bg-white border border-[#b8c2cc] rounded-2xl p-6 sm:p-7 shadow-xl">
          
          {/* Quick autofill button */}
          <button
            type="button"
            onClick={() => {
              setEmail('0kingold0@gmail.com');
              setPinCode('1993');
            }}
            className="w-full mb-3.5 py-1.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg text-xs font-bold text-amber-900 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>⚡ تعبئة بيانات الماستر (King / PIN: 1993)</span>
          </button>

          {errorMessage && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleResetSubmit} className="space-y-3.5">
            {/* Row 1: Email / Username */}
            <div className="flex items-center justify-between gap-3">
              <label 
                htmlFor="resetEmailInput"
                className="text-xs font-medium text-[#2d5c88] w-28 shrink-0 text-left cursor-pointer"
              >
                Admin / Email
              </label>
              <div className="flex-1">
                <input
                  id="resetEmailInput"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="King أو 0kingold0@gmail.com"
                  required
                  autoFocus
                  className="w-full px-3 py-1.5 text-sm bg-white border border-[#9aa7b4] rounded-md shadow-inner text-gray-800 focus:outline-none focus:border-[#2d5c88] focus:ring-1 focus:ring-[#2d5c88] transition-all font-medium font-mono"
                />
              </div>
            </div>

            {/* Row 2: Security PIN */}
            <div className="flex items-center justify-between gap-3">
              <label 
                htmlFor="resetPinInput"
                className="text-xs font-medium text-[#2d5c88] w-28 shrink-0 text-left cursor-pointer"
              >
                Master PIN
              </label>
              <div className="flex-1 relative">
                <input
                  id="resetPinInput"
                  type={showPin ? 'text' : 'password'}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="PIN: 1993"
                  required
                  className="w-full pr-8 px-3 py-1.5 text-sm bg-white border border-[#9aa7b4] rounded-md shadow-inner text-gray-800 focus:outline-none focus:border-[#2d5c88] focus:ring-1 focus:ring-[#2d5c88] transition-all font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Row 3: New Password */}
            <div className="flex items-center justify-between gap-3">
              <label 
                htmlFor="newPassInput"
                className="text-xs font-medium text-[#2d5c88] w-28 shrink-0 text-left cursor-pointer"
              >
                New Password
              </label>
              <div className="flex-1 relative">
                <input
                  id="newPassInput"
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pr-8 px-3 py-1.5 text-sm bg-white border border-[#9aa7b4] rounded-md shadow-inner text-gray-800 focus:outline-none focus:border-[#2d5c88] focus:ring-1 focus:ring-[#2d5c88] transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Row 4: Confirm Password */}
            <div className="flex items-center justify-between gap-3">
              <label 
                htmlFor="confirmPassInput"
                className="text-xs font-medium text-[#2d5c88] w-28 shrink-0 text-left cursor-pointer"
              >
                Confirm Pass
              </label>
              <div className="flex-1">
                <input
                  id="confirmPassInput"
                  type={showNewPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-1.5 text-sm bg-white border border-[#9aa7b4] rounded-md shadow-inner text-gray-800 focus:outline-none focus:border-[#2d5c88] focus:ring-1 focus:ring-[#2d5c88] transition-all font-medium"
                />
              </div>
            </div>

            {/* Buttons matching Login Screen */}
            <div className="pt-4 flex items-center justify-center gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="min-w-[140px] px-6 py-2 bg-gradient-to-b from-[#fcfcfc] via-[#f4f4f4] to-[#e4e4e4] hover:from-[#f7f7f7] hover:to-[#dcdcdc] active:from-[#dcdcdc] active:to-[#efefef] border border-[#a6b1bc] hover:border-[#8694a1] rounded-md text-xs font-bold text-[#333] shadow-xs hover:shadow-xs active:shadow-inner transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Reset & Sync Devices'
                )}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-md border border-[#c4cdd5] hover:bg-gray-100 text-xs font-medium text-gray-600 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Security Subtitle */}
        <div className="mt-3 text-center">
          <p className="text-[11px] text-gray-400 font-medium">
            Centralized Security Authentication Protected
          </p>
        </div>

      </div>
    </div>
  );
};

