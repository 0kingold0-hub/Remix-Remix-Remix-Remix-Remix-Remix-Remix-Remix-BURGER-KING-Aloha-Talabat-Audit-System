import React from 'react';
import bkImg from '../assets/images/modern_burger_king_2021_1787197848553.jpg';
import talabatImg from '../assets/images/talabat_logo_1787197672788.jpg';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'image' | 'vector';
}

export const BurgerKingLogo: React.FC<LogoProps> = ({ className = '', size = 'md', variant = 'image' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
  };

  if (variant === 'image') {
    return (
      <div
        className={`relative rounded-2xl overflow-hidden shadow-xs border border-amber-200/70 bg-[#F5EBDC] flex items-center justify-center p-0.5 shrink-0 ${sizeClasses[size]} ${className}`}
      >
        <img
          src={bkImg}
          alt="Burger King 2021 Logo"
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain rounded-xl"
        />
      </div>
    );
  }

  // Modern 2021 Burger King SVG (Two orange buns + Stacked red flame typography)
  return (
    <div
      className={`relative rounded-2xl overflow-hidden shadow-xs border border-amber-200/70 bg-[#F5EBDC] flex items-center justify-center p-1 shrink-0 ${sizeClasses[size]} ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-2xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top Bun */}
        <path
          d="M16 38C16 22 30 14 50 14C70 14 84 22 84 38H16Z"
          fill="#EE7C11"
        />
        {/* BURGER text */}
        <text
          x="50"
          y="49"
          textAnchor="middle"
          fill="#D71920"
          fontWeight="900"
          fontSize="13"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.5"
        >
          BURGER
        </text>
        {/* KING text */}
        <text
          x="50"
          y="63"
          textAnchor="middle"
          fill="#D71920"
          fontWeight="900"
          fontSize="14"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.5"
        >
          KING
        </text>
        {/* Bottom Bun */}
        <path
          d="M18 69H82C82 82 70 88 50 88C30 88 18 82 18 69Z"
          fill="#EE7C11"
        />
      </svg>
    </div>
  );
};

export const TalabatLogo: React.FC<LogoProps> = ({ className = '', size = 'md', variant = 'image' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
  };

  if (variant === 'image') {
    return (
      <div
        className={`relative rounded-2xl overflow-hidden shadow-xs border border-orange-300/70 bg-[#FF5A00] flex items-center justify-center p-0.5 shrink-0 ${sizeClasses[size]} ${className}`}
      >
        <img
          src={talabatImg}
          alt="Talabat Logo"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-xl"
        />
      </div>
    );
  }

  // Pure SVG/Vector Badge
  return (
    <div
      className={`bg-[#FF5A00] rounded-2xl flex items-center justify-center p-1 font-bold text-white shadow-xs shrink-0 ${sizeClasses[size]} ${className}`}
    >
      <div className="bg-[#441118] px-2 py-0.5 rounded -rotate-2 transform">
        <span className="text-[10px] sm:text-xs font-black tracking-tighter text-white font-sans">
          talabat
        </span>
      </div>
    </div>
  );
};

export const CombinedBrandBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`inline-flex items-center gap-2 bg-stone-100/90 border border-stone-200/80 rounded-2xl p-1.5 pr-3 shadow-2xs ${className}`}>
      <div className="flex items-center -space-x-2">
        <BurgerKingLogo size="md" className="ring-2 ring-white z-10" />
        <TalabatLogo size="md" className="ring-2 ring-white z-0" />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] font-black text-stone-900 leading-tight">
          BK &times; Talabat
        </span>
        <span className="text-[9px] font-semibold text-stone-500 uppercase tracking-wider">
          Reconciliation
        </span>
      </div>
    </div>
  );
};
