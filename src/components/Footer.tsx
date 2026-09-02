import React from 'react';
import { ShieldCheck, Cpu, Heart, CheckCircle2 } from 'lucide-react';
import { BurgerKingLogo, TalabatLogo } from './BrandLogos';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-12 bg-white border-t border-stone-200/80 py-6 px-4 sm:px-6" dir="rtl">
      <div className="w-full max-w-[98%] 2xl:max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-2">
            <BurgerKingLogo size="sm" className="ring-2 ring-white shadow-xs z-10" />
            <TalabatLogo size="sm" className="ring-2 ring-white shadow-xs z-0" />
          </div>
          <div>
            <div className="text-xs font-black text-stone-800">
              منظومة التدقيق والمطابقة المالية المزدوجة (Aloha POS × Talabat)
            </div>
            <div className="text-[11px] text-stone-500 font-medium">
              نظام معتمد لفحص فواتير الكاشير، كشف العجز، ومطابقة تقارير مبيعات طلبات
            </div>
          </div>
        </div>

        {/* Developer Credit - Big & Proud */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 px-3.5 py-1.5 rounded-2xl shadow-xs text-xs">
            <Cpu className="w-3.5 h-3.5 text-[#D71920]" />
            <span className="text-stone-600 font-semibold">Developed & Engineered by:</span>
            <span className="font-black text-[#D71920]">M-King</span>
            <span className="text-stone-300">•</span>
            <span className="text-stone-500 font-mono text-[10px]">v2.5.0 Enterprise</span>
          </div>

          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-2xl text-[11px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>نظام مستقل ومؤمّن</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
