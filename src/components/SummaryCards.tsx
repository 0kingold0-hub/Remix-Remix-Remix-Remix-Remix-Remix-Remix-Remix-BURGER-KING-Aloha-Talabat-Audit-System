import React from 'react';
import { AlohaSummary } from '../types';
import {
  Banknote,
  CreditCard,
  Layers,
  Bike,
  Receipt,
  ShoppingBag,
  AlertTriangle,
  Calculator,
  Utensils,
} from 'lucide-react';

interface SummaryCardsProps {
  summary: AlohaSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
  const formatCurrency = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Duplicate Orders Alert Banner */}
      {summary.duplicateCount > 0 && (
        <div className="bg-amber-50 border border-amber-300/90 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-900 shadow-2xs animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-black block">Duplicate Check Alert in Aloha Report!</span>
              <p className="text-xs text-amber-800 mt-0.5 font-medium">
                Detected <strong className="font-black underline">{summary.duplicateCount}</strong> check numbers that appear more than once in the Aloha input text. Each check was calculated with its recorded tender amount and flagged with a duplicate badge.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Financial Totals Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Cash Total */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-stone-500">Cash Drawer Total (Cash)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight font-mono">
              {formatCurrency(summary.cashTotal)}
            </span>
            <span className="text-xs font-bold text-stone-400">EGP</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Cash Checks:</span>
            <span className="font-bold text-emerald-700 font-mono">{summary.cashCount} checks ({summary.totalOrdersCount ? Math.round((summary.cashCount / summary.totalOrdersCount) * 100) : 0}%)</span>
          </div>
        </div>

        {/* Otlob Mode / Online Total */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-stone-500">Otlob Mode / Online Total</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight font-mono">
              {formatCurrency(summary.creditTotal + summary.cardTotal)}
            </span>
            <span className="text-xs font-bold text-stone-400">EGP</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 font-medium">
            <span>Online Checks:</span>
            <span className="font-bold text-blue-700 font-mono">{summary.creditCount + summary.cardCount} checks ({summary.totalOrdersCount ? Math.round(((summary.creditCount + summary.cardCount) / summary.totalOrdersCount) * 100) : 0}%)</span>
          </div>
        </div>

        {/* Grand Total */}
        <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-slate-900/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-slate-300">Grand Aloha Sales Total</span>
            <div className="w-9 h-9 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center backdrop-blur-xs border border-white/10">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight font-mono">
              {formatCurrency(summary.grandTotal)}
            </span>
            <span className="text-xs font-bold text-slate-300">EGP</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300 font-medium">
            <span>Total Recorded Checks:</span>
            <span className="font-bold text-white font-mono">{summary.totalOrdersCount} checks ({summary.uniqueOrdersCount} unique)</span>
          </div>
        </div>
      </div>

      {/* Detailed Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#FFFDF5] border border-amber-200/80 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-800 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-stone-500 font-medium block">Average Check (AOV)</span>
              <span className="text-sm font-black text-stone-900 font-mono">{formatCurrency(summary.averageOrderValue)} EGP</span>
            </div>
          </div>
        </div>

        <div className="bg-[#FDF8F6] border border-orange-200/70 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100/80 text-[#D71920] flex items-center justify-center shrink-0">
              <Bike className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-stone-500 font-medium block">Delivery Orders</span>
              <span className="text-sm font-black text-stone-900 font-mono">{summary.deliveryCount} checks</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#D71920] bg-orange-100/60 px-1.5 py-0.5 rounded">Delivery</span>
        </div>

        <div className="bg-[#F8FAFC] border border-stone-200/80 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-800 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-stone-500 font-medium block">Dine-In & Takeout</span>
              <span className="text-sm font-black text-stone-900 font-mono">{summary.dineInCount + summary.takeawayCount} checks</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded">In-Store</span>
        </div>

        <div className="bg-[#FAF5FF] border border-purple-200/70 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100/70 text-purple-800 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-stone-500 font-medium block">Unique Checks</span>
              <span className="text-sm font-black text-stone-900 font-mono">{summary.uniqueOrdersCount} checks</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-purple-700 bg-purple-100/60 px-1.5 py-0.5 rounded">Unique</span>
        </div>
      </div>
    </div>
  );
};



