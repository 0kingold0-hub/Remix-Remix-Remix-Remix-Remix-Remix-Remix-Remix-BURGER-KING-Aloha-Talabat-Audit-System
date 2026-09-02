import React, { useState } from 'react';
import { ExcelPaymentSummary, ReconciliationSummary } from '../types';
import {
  TrendingDown,
  TrendingUp,
  Scale,
  CreditCard,
  Banknote,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  Percent,
  Receipt,
  FileWarning,
  Wallet,
  Building,
  Bike,
  Coins,
  CalendarDays,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface ReconciliationSummaryProps {
  summary: ReconciliationSummary;
  excelPayments: ExcelPaymentSummary;
  totalExcelCount: number;
  onOpenDailyReport?: () => void;
}

export const ReconciliationSummaryView: React.FC<ReconciliationSummaryProps> = ({
  summary,
  excelPayments,
  totalExcelCount,
  onOpenDailyReport,
}) => {
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(true);

  const formatCurrency = (val: number) => {
    return Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const { cashierAudit } = summary;
  const isNetDeficit = summary.netDifference < 0;
  const isNetSurplus = summary.netDifference > 0;

  // Cash Analysis Variables
  const cashDiff = cashierAudit.cashDifference;
  const isCashShortage = cashDiff < -0.01;
  const isCashSurplus = cashDiff > 0.01;
  const isCashBalanced = !isCashShortage && !isCashSurplus;

  // Credit Analysis Variables
  const creditDiff = cashierAudit.creditDifference;
  const isCreditShortage = creditDiff < -0.01;
  const isCreditSurplus = creditDiff > 0.01;
  const isCreditBalanced = !isCreditShortage && !isCreditSurplus;

  // Gross Analysis Variables
  const grossDiff = cashierAudit.grossSalesDifference;
  const isGrossShortage = grossDiff < -0.01;
  const isGrossSurplus = grossDiff > 0.01;

  // Helper for origin badge
  const getDiscrepancyOrigin = (diff: number, label: string) => {
    if (Math.abs(diff) <= 0.01) {
      return { text: 'Balanced (0.00 EGP)', badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold' };
    }
    if (diff < 0) {
      return {
        text: `Aloha POS Deficit (-${formatCurrency(diff)} EGP)`,
        badgeClass: 'bg-rose-100 text-rose-800 font-bold border border-rose-200',
      };
    }
    return {
      text: `Aloha POS Surplus (+${formatCurrency(diff)} EGP)`,
      badgeClass: 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-200',
    };
  };

  const cashStatusInfo = getDiscrepancyOrigin(cashierAudit.cashDifference, 'Cash');
  const creditStatusInfo = getDiscrepancyOrigin(cashierAudit.creditDifference, 'Credit / Online');
  const grossStatusInfo = getDiscrepancyOrigin(cashierAudit.grossSalesDifference, 'Gross Total');

  return (
    <div className="space-y-5 pt-1">
      {/* Accuracy & Executive Audit Gauge Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-4 sm:p-6 text-white shadow-lg border border-slate-700/80 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Financial Audit Quality Index
              </span>
              <span className="text-xs text-slate-300 font-mono bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                {summary.matchCount} of {summary.totalEvaluatedCount} checks 100% matched
              </span>
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="text-lg sm:text-xl font-black text-white">
                Reconciliation Accuracy Rate:
              </h3>
              <span
                className={`font-mono text-3xl sm:text-4xl font-black tracking-tight drop-shadow-sm ${
                  summary.financialAccuracyRate >= 95
                    ? 'text-emerald-400'
                    : summary.financialAccuracyRate >= 85
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {summary.financialAccuracyRate}%
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Comparing Talabat Benchmark (<strong className="text-amber-300 font-mono">{formatCurrency(summary.talabatSourceTotal)} EGP</strong>) against Aloha POS actual cash register (<strong className="text-indigo-200 font-mono">{formatCurrency(summary.alohaSourceTotal)} EGP</strong>).
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
            {onOpenDailyReport && (
              <button
                type="button"
                onClick={onOpenDailyReport}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Daily Discrepancy Breakdown</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-center min-w-[115px] shadow-sm">
              <span className="text-[11px] text-slate-300 block font-semibold">Matched Checks</span>
              <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">{summary.matchCount}</span>
            </div>
            {summary.assistantResolvedCount !== undefined && summary.assistantResolvedCount > 0 && (
              <div className="bg-amber-500/20 backdrop-blur-md rounded-xl p-3 border border-amber-400/30 text-center min-w-[115px] shadow-sm">
                <span className="text-[11px] text-amber-300 block font-bold flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Assistant
                </span>
                <span className="text-2xl font-black text-amber-300 font-mono tracking-tight">
                  {summary.assistantResolvedCount}
                </span>
              </div>
            )}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-center min-w-[115px] shadow-sm">
              <span className="text-[11px] text-slate-300 block font-semibold">Total Variances</span>
              <span className="text-2xl font-black text-rose-400 font-mono tracking-tight">
                {summary.deficitCount + summary.surplusCount + summary.methodMismatchCount + summary.missingInTalabatCount + summary.missingInAlohaCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 🧠 SMART FINANCIAL DISCREPANCY & CASH/CREDIT ANALYSIS CARD */}
      <div className="bg-white rounded-2xl border-2 border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/70 via-stone-50 to-indigo-50/50 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-black text-stone-900">
                  Smart Financial Discrepancy Analysis (تحليل فروقات الكاش والكريديت)
                </h4>
                <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  Audit Insights
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Detailed breakdown of cashier cash drawer shortages, online tender shifts, and unrecorded checks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDeepAnalysis(!showDeepAnalysis)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
          >
            <span>{showDeepAnalysis ? 'Collapse Insights' : 'Expand Insights'}</span>
            {showDeepAnalysis ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showDeepAnalysis && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* DIRECT SIDE-BY-SIDE CASH VS CREDIT COMPARISON MATRIX */}
            <div className="bg-stone-50/80 rounded-2xl p-4 border border-stone-200 shadow-2xs overflow-x-auto">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h5 className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>جدول المقارنة المباشرة: الكاش والكريديت (Aloha POS vs Talabat Excel)</span>
                </h5>
                <span className="text-[11px] font-bold text-stone-500 bg-white px-2.5 py-0.5 rounded-lg border border-stone-200">
                  مقارنة طرفي التسوية المباشرة
                </span>
              </div>

              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 rounded-l-xl">طريقة الدفع / البند</th>
                    <th className="py-2.5 px-3 text-center">ألوها POS (الفعلي)</th>
                    <th className="py-2.5 px-3 text-center">تقرير طلبات (المعيار)</th>
                    <th className="py-2.5 px-3 text-center">الفارق المالي (Variance)</th>
                    <th className="py-2.5 px-3 text-center">فرق عدد الشيكات</th>
                    <th className="py-2.5 px-3 text-right rounded-r-xl">حالة المطابقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/80 font-mono">
                  {/* Cash Row */}
                  <tr className="hover:bg-white/80 transition-colors">
                    <td className="py-3 px-3 font-sans font-bold text-stone-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <Banknote className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="block text-xs font-black">الكاش النقدي (Cash)</span>
                        <span className="text-[10px] text-stone-400 font-normal">درج الكاشير والتحصيل</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-stone-900 text-sm block">{formatCurrency(cashierAudit.alohaCashTotal)} EGP</span>
                      <span className="text-[10px] text-stone-500 font-sans font-medium">{cashierAudit.alohaCashCount} شيك</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-stone-900 text-sm block">{formatCurrency(cashierAudit.talabatCashTotal)} EGP</span>
                      <span className="text-[10px] text-stone-500 font-sans font-medium">{cashierAudit.talabatCashCount} شيك</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                          isCashShortage
                            ? 'text-rose-700 bg-rose-50 border border-rose-200'
                            : isCashSurplus
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                            : 'text-stone-700 bg-stone-100'
                        }`}
                      >
                        {cashDiff < 0 ? '-' : cashDiff > 0 ? '+' : ''}{formatCurrency(cashDiff)} EGP
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-sans font-semibold text-stone-600">
                      {cashierAudit.alohaCashCount - cashierAudit.talabatCashCount !== 0 ? (
                        <span className={cashierAudit.alohaCashCount - cashierAudit.talabatCashCount < 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                          {cashierAudit.alohaCashCount - cashierAudit.talabatCashCount > 0 ? '+' : ''}{cashierAudit.alohaCashCount - cashierAudit.talabatCashCount} شيك
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold text-[11px]">متطابق (0)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          isCashShortage
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : isCashSurplus
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {isCashShortage ? '⚠️ عجز كاش' : isCashSurplus ? '📈 فائض كاش' : '✅ متطابق 100%'}
                      </span>
                    </td>
                  </tr>

                  {/* Credit / Online Row */}
                  <tr className="hover:bg-white/80 transition-colors">
                    <td className="py-3 px-3 font-sans font-bold text-stone-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="block text-xs font-black">الأونلاين والفيزا (Credit / Online)</span>
                        <span className="text-[10px] text-stone-400 font-normal">Otlob Mode / الدفع المسبق</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-stone-900 text-sm block">{formatCurrency(cashierAudit.alohaCreditTotal)} EGP</span>
                      <span className="text-[10px] text-stone-500 font-sans font-medium">{cashierAudit.alohaCreditCount} شيك</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-stone-900 text-sm block">{formatCurrency(cashierAudit.talabatCreditTotal)} EGP</span>
                      <span className="text-[10px] text-stone-500 font-sans font-medium">{cashierAudit.talabatCreditCount} شيك</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                          isCreditShortage
                            ? 'text-amber-800 bg-amber-50 border border-amber-200'
                            : isCreditSurplus
                            ? 'text-blue-800 bg-blue-50 border border-blue-200'
                            : 'text-stone-700 bg-stone-100'
                        }`}
                      >
                        {creditDiff < 0 ? '-' : creditDiff > 0 ? '+' : ''}{formatCurrency(creditDiff)} EGP
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-sans font-semibold text-stone-600">
                      {cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount !== 0 ? (
                        <span className={cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount < 0 ? 'text-amber-700 font-bold' : 'text-blue-700 font-bold'}>
                          {cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount > 0 ? '+' : ''}{cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount} شيك
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold text-[11px]">متطابق (0)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          isCreditShortage
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isCreditSurplus
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {isCreditShortage ? '💡 عجز أونلاين' : isCreditSurplus ? '📈 فائض أونلاين' : '✅ متطابق 100%'}
                      </span>
                    </td>
                  </tr>

                  {/* Total Row */}
                  <tr className="bg-stone-900 text-white font-black">
                    <td className="py-3 px-3 font-sans text-amber-400 flex items-center gap-2 rounded-l-xl">
                      <div className="w-6 h-6 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center shrink-0 font-bold">
                        <Scale className="w-3.5 h-3.5" />
                      </div>
                      <span>إجمالي المبيعات (Grand Total)</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-amber-300 text-sm block">{formatCurrency(cashierAudit.alohaGrandTotal)} EGP</span>
                      <span className="text-[10px] text-slate-400 font-sans font-medium">{cashierAudit.alohaCashCount + cashierAudit.alohaCreditCount} شيك</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-white text-sm block">{formatCurrency(cashierAudit.talabatGrandTotal)} EGP</span>
                      <span className="text-[10px] text-slate-400 font-sans font-medium">{cashierAudit.talabatCashCount + cashierAudit.talabatCreditCount} شيك</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-sm px-2.5 py-1 rounded-lg ${
                          isGrossShortage
                            ? 'text-rose-300 bg-rose-950/80 border border-rose-500/40'
                            : isGrossSurplus
                            ? 'text-emerald-300 bg-emerald-950/80 border border-emerald-500/40'
                            : 'text-white bg-slate-800'
                        }`}
                      >
                        {grossDiff < 0 ? '-' : grossDiff > 0 ? '+' : ''}{formatCurrency(Math.abs(grossDiff))} EGP
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-sans text-slate-300">
                      {(cashierAudit.alohaCashCount + cashierAudit.alohaCreditCount) - (cashierAudit.talabatCashCount + cashierAudit.talabatCreditCount) !== 0 ? (
                        <span>{((cashierAudit.alohaCashCount + cashierAudit.alohaCreditCount) - (cashierAudit.talabatCashCount + cashierAudit.talabatCreditCount) > 0 ? '+' : '') + ((cashierAudit.alohaCashCount + cashierAudit.alohaCreditCount) - (cashierAudit.talabatCashCount + cashierAudit.talabatCreditCount))} شيك</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">متطابق</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-sans rounded-r-xl">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          isGrossShortage
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : isGrossSurplus
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {isGrossShortage ? 'عجز إجمالي' : isGrossSurplus ? 'فائض إجمالي' : 'متطابق بالكامل'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Cash Drawer Shortage / Surplus Card */}
              <div
                className={`rounded-2xl p-4 sm:p-5 border-2 transition-all shadow-xs ${
                  isCashShortage
                    ? 'bg-gradient-to-br from-rose-50/90 to-red-50/40 border-rose-300 text-rose-950'
                    : isCashSurplus
                    ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/40 border-emerald-300 text-emerald-950'
                    : 'bg-gradient-to-br from-stone-50 to-slate-50 border-stone-300 text-stone-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                        isCashShortage
                          ? 'bg-rose-600 text-white'
                          : isCashSurplus
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-700 text-white'
                      }`}
                    >
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider block opacity-80">
                        Cash Drawer Position (درج الكاش)
                      </span>
                      <h5 className="text-base font-black flex items-center gap-1.5">
                        {isCashShortage ? (
                          <>
                            <ArrowDownRight className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Aloha Cash Shortage (عجز كاش)</span>
                          </>
                        ) : isCashSurplus ? (
                          <>
                            <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Aloha Cash Surplus (فائض كاش)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Cash Drawer Perfectly Balanced (متوازن)</span>
                          </>
                        )}
                      </h5>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-xl sm:text-2xl font-black font-mono tracking-tight block ${
                        isCashShortage ? 'text-rose-700' : isCashSurplus ? 'text-emerald-700' : 'text-stone-800'
                      }`}
                    >
                      {cashDiff < 0 ? '-' : cashDiff > 0 ? '+' : ''}
                      {formatCurrency(cashDiff)} <span className="text-xs font-bold">EGP</span>
                    </span>
                    <span className="text-[11px] font-semibold opacity-70">
                      {cashierAudit.alohaCashCount - cashierAudit.talabatCashCount !== 0
                        ? `${cashierAudit.alohaCashCount - cashierAudit.talabatCashCount > 0 ? '+' : ''}${cashierAudit.alohaCashCount - cashierAudit.talabatCashCount} checks diff`
                        : 'Same check count'}
                    </span>
                  </div>
                </div>

                {/* Explanation text */}
                <div className="mt-3.5 pt-3 border-t border-black/10 text-xs leading-relaxed space-y-1.5">
                  {isCashShortage && (
                    <div dir="rtl" className="text-right text-xs leading-relaxed space-y-1">
                      <p className="text-rose-950 font-medium">
                        ⚠️ <strong className="font-bold">تشخيص عجز الكاش:</strong> إجمالي الكاش المسجل بدرج الألوها (<span dir="ltr" className="font-mono font-bold text-rose-800">{formatCurrency(cashierAudit.alohaCashTotal)} ج.م</span>) أقل من المطلوب بتقرير طلبات (<span dir="ltr" className="font-mono font-bold text-stone-800">{formatCurrency(cashierAudit.talabatCashTotal)} ج.م</span>) بعجز قدره <span dir="ltr" className="font-mono font-black text-rose-700">-{formatCurrency(Math.abs(cashDiff))} ج.م</span>.
                      </p>
                      <p className="text-rose-800 text-[11px]">
                        📌 يرجع ذلك إما لطلبات كاش لم تُسجل على سيستم الألوها، أو تم إغلاقها بالخطأ كـ Otlob/Credit.
                      </p>
                    </div>
                  )}
                  {isCashSurplus && (
                    <div dir="rtl" className="text-right text-xs leading-relaxed space-y-1">
                      <p className="text-emerald-950 font-medium">
                        ✅ <strong className="font-bold">تشخيص فائض الكاش:</strong> إجمالي الكاش المسجل بدرج الألوها (<span dir="ltr" className="font-mono font-bold text-emerald-800">{formatCurrency(cashierAudit.alohaCashTotal)} ج.م</span>) أعلى من تقرير طلبات (<span dir="ltr" className="font-mono font-bold text-stone-800">{formatCurrency(cashierAudit.talabatCashTotal)} ج.م</span>) بفائض قدره <span dir="ltr" className="font-mono font-black text-emerald-700">+{formatCurrency(cashDiff)} ج.م</span>.
                      </p>
                      <p className="text-emerald-800 text-[11px]">
                        📌 يرجع ذلك لتحصيل كاش لطلبات أونلاين أو وجود شيكات كاش إضافية مسجلة بالألوها.
                      </p>
                    </div>
                  )}
                  {isCashBalanced && (
                    <div dir="rtl" className="text-right text-xs leading-relaxed">
                      <p className="text-stone-800 font-medium">
                        ✅ <strong className="font-bold">درج الكاش متطابق تماماً:</strong> مسجل بالألوها <span dir="ltr" className="font-mono font-bold text-stone-900">{formatCurrency(cashierAudit.alohaCashTotal)} ج.م</span> ومطابق لتقرير طلبات بنسبة 100%.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 bg-white/70 rounded-xl p-2.5 text-xs border border-black/5 font-mono">
                  <div>
                    <span className="text-[10px] text-stone-500 block uppercase font-bold">Aloha Cash (Actual)</span>
                    <span className="font-black text-stone-900 text-sm">{formatCurrency(cashierAudit.alohaCashTotal)} EGP</span>
                    <span className="text-[10px] text-stone-500 block">({cashierAudit.alohaCashCount} checks)</span>
                  </div>
                  <div className="border-l border-stone-200 pl-2">
                    <span className="text-[10px] text-stone-500 block uppercase font-bold">Talabat Cash (Benchmark)</span>
                    <span className="font-black text-stone-900 text-sm">{formatCurrency(cashierAudit.talabatCashTotal)} EGP</span>
                    <span className="text-[10px] text-stone-500 block">({cashierAudit.talabatCashCount} checks)</span>
                  </div>
                </div>
              </div>

              {/* 2. Online / Credit Card Discrepancy Card */}
              <div
                className={`rounded-2xl p-4 sm:p-5 border-2 transition-all shadow-xs ${
                  isCreditShortage
                    ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/40 border-amber-300 text-amber-950'
                    : isCreditSurplus
                    ? 'bg-gradient-to-br from-blue-50/90 to-indigo-50/40 border-blue-300 text-blue-950'
                    : 'bg-gradient-to-br from-stone-50 to-slate-50 border-stone-300 text-stone-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                        isCreditShortage
                          ? 'bg-amber-600 text-white'
                          : isCreditSurplus
                          ? 'bg-blue-600 text-white'
                          : 'bg-stone-700 text-white'
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider block opacity-80">
                        Online / Digital Credit Position
                      </span>
                      <h5 className="text-base font-black flex items-center gap-1.5">
                        {isCreditShortage ? (
                          <>
                            <ArrowDownRight className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Aloha Online Shortage (عجز أونلاين بالألوها)</span>
                          </>
                        ) : isCreditSurplus ? (
                          <>
                            <ArrowUpRight className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>Aloha Online Surplus (فائض أونلاين بالألوها)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Online Payments Balanced (متطابق)</span>
                          </>
                        )}
                      </h5>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-xl sm:text-2xl font-black font-mono tracking-tight block ${
                        isCreditShortage ? 'text-amber-800' : isCreditSurplus ? 'text-blue-700' : 'text-stone-800'
                      }`}
                    >
                      {creditDiff < 0 ? '-' : creditDiff > 0 ? '+' : ''}
                      {formatCurrency(creditDiff)} <span className="text-xs font-bold">EGP</span>
                    </span>
                    <span className="text-[11px] font-semibold opacity-70">
                      {cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount !== 0
                        ? `${cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount > 0 ? '+' : ''}${cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount} checks diff`
                        : 'Same check count'}
                    </span>
                  </div>
                </div>

                {/* Explanation text */}
                <div className="mt-3.5 pt-3 border-t border-black/10 text-xs leading-relaxed space-y-1.5">
                  {isCreditShortage && (
                    <div dir="rtl" className="text-right text-xs leading-relaxed space-y-1">
                      <p className="text-amber-950 font-medium">
                        💡 <strong className="font-bold">تشخيص عجز الأونلاين/الفيزا:</strong> مدفوعات الأونلاين المسجلة بالألوها (<span dir="ltr" className="font-mono font-bold text-amber-800">{formatCurrency(cashierAudit.alohaCreditTotal)} ج.م</span>) أقل من تقرير طلبات (<span dir="ltr" className="font-mono font-bold text-stone-800">{formatCurrency(cashierAudit.talabatCreditTotal)} ج.م</span>) بعجز قدره <span dir="ltr" className="font-mono font-black text-amber-700">-{formatCurrency(Math.abs(creditDiff))} ج.م</span>.
                      </p>
                      <p className="text-amber-800 text-[11px]">
                        📌 يرجع ذلك لطلبات دُفعت أونلاين بطلبات ولكن أُغلقت كاش بالألوها أو لم تُسجل على السيستم.
                      </p>
                    </div>
                  )}
                  {isCreditSurplus && (
                    <div dir="rtl" className="text-right text-xs leading-relaxed space-y-1">
                      <p className="text-blue-950 font-medium">
                        💡 <strong className="font-bold">تشخيص فائض الأونلاين:</strong> مدفوعات الأونلاين المسجلة بالألوها أعلى من تقرير طلبات بمقدار <span dir="ltr" className="font-mono font-black text-blue-700">+{formatCurrency(creditDiff)} ج.م</span>.
                      </p>
                      <p className="text-blue-800 text-[11px]">
                        📌 يرجع ذلك لشيكات تم تسجيلها كـ Otlob Mode بالألوها بينما كانت كاش بتقرير طلبات.
                      </p>
                    </div>
                  )}
                  {isCreditBalanced && (
                    <div dir="rtl" className="text-right text-xs leading-relaxed">
                      <p className="text-stone-800 font-medium">
                        ✅ <strong className="font-bold">مدفوعات الأونلاين متطابقة تماماً:</strong> مسجل بالألوها <span dir="ltr" className="font-mono font-bold text-stone-900">{formatCurrency(cashierAudit.alohaCreditTotal)} ج.م</span> ومطابق لتقرير طلبات بنسبة 100%.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 bg-white/70 rounded-xl p-2.5 text-xs border border-black/5 font-mono">
                  <div>
                    <span className="text-[10px] text-stone-500 block uppercase font-bold">Aloha Credit / Otlob</span>
                    <span className="font-black text-stone-900 text-sm">{formatCurrency(cashierAudit.alohaCreditTotal)} EGP</span>
                    <span className="text-[10px] text-stone-500 block">({cashierAudit.alohaCreditCount} checks)</span>
                  </div>
                  <div className="border-l border-stone-200 pl-2">
                    <span className="text-[10px] text-stone-500 block uppercase font-bold">Talabat Online / Card</span>
                    <span className="font-black text-stone-900 text-sm">{formatCurrency(cashierAudit.talabatCreditTotal)} EGP</span>
                    <span className="text-[10px] text-stone-500 block">({cashierAudit.talabatCreditCount} checks)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Settlement Summary Banner */}
            <div className="bg-stone-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm border border-stone-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs text-amber-300 font-bold uppercase tracking-wider block">
                    Net Store Financial Position (صافي الموقف المالي للمطعم)
                  </span>
                  <div dir="rtl" className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-1.5 leading-relaxed">
                    <span>مبيعات الألوها:</span>
                    <span dir="ltr" className="font-mono font-bold text-amber-300 bg-black/40 px-1.5 py-0.5 rounded">{formatCurrency(cashierAudit.alohaGrandTotal)} EGP</span>
                    <span>مطروحاً منها طلبات:</span>
                    <span dir="ltr" className="font-mono font-bold text-slate-200 bg-black/40 px-1.5 py-0.5 rounded">{formatCurrency(cashierAudit.talabatGrandTotal)} EGP</span>
                    <span>= الفارق:</span>
                    <span dir="ltr" className={`font-mono font-black px-1.5 py-0.5 rounded ${grossDiff < 0 ? 'text-rose-400 bg-rose-950/60' : grossDiff > 0 ? 'text-emerald-400 bg-emerald-950/60' : 'text-white'}`}>
                      {grossDiff < 0 ? '-' : grossDiff > 0 ? '+' : ''}{formatCurrency(Math.abs(grossDiff))} EGP
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block font-semibold">Net Difference</span>
                  <span
                    className={`font-mono text-2xl sm:text-3xl font-black tracking-tight ${
                      isGrossShortage ? 'text-rose-400' : isGrossSurplus ? 'text-emerald-400' : 'text-white'
                    }`}
                  >
                    {grossDiff < 0 ? '-' : grossDiff > 0 ? '+' : ''}
                    {formatCurrency(Math.abs(grossDiff))} <span className="text-xs font-normal text-slate-300">EGP</span>
                  </span>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-xl font-black text-xs ${
                    isGrossShortage
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : isGrossSurplus
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/10 text-white border border-white/20'
                  }`}
                >
                  {isGrossShortage ? 'Net Deficit (عجز إجمالي)' : isGrossSurplus ? 'Net Surplus (فائض إجمالي)' : 'Perfect Match (متطابق)'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cash Register & Delivery Status Highlight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Delivery Orders Breakdown Card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border-2 border-amber-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Bike className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-950">
                  Aloha Delivery Orders (Free-Dele / HD Talabat)
                </h4>
                <p className="text-[11px] text-amber-800/80">
                  Orders categorized as Free-Dele or Delivery in Aloha POS
                </p>
              </div>
            </div>
            <span className="bg-amber-200/90 text-amber-950 text-xs font-black px-3 py-1 rounded-xl font-mono shadow-2xs">
              {summary.deliveryOrdersCount || 0} Orders
            </span>
          </div>

          <div className="flex items-baseline justify-between mt-3.5 pt-3 border-t border-amber-200/70">
            <span className="text-xs font-bold text-amber-900">Total Aloha Delivery Sales:</span>
            <span className="text-xl font-black text-amber-950 font-mono tracking-tight">
              {formatCurrency(summary.deliveryOrdersTotal || 0)} <span className="text-xs font-semibold">EGP</span>
            </span>
          </div>
        </div>

        {/* Cash Balance / Drawer Comparison Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 border-2 border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-emerald-950">
                  Cash Drawer Quick Reconciliation
                </h4>
                <p className="text-[11px] text-emerald-800/80">
                  Comparison between Talabat cash orders and cashier drawer
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-black px-3 py-1 rounded-xl font-mono shadow-2xs ${
                Math.abs(cashierAudit.cashDifference) <= 0.05
                  ? 'bg-emerald-200 text-emerald-900'
                  : cashierAudit.cashDifference < 0
                  ? 'bg-rose-200 text-rose-900'
                  : 'bg-teal-200 text-teal-900'
              }`}
            >
              {Math.abs(cashierAudit.cashDifference) <= 0.05
                ? 'Balanced 0.00'
                : (cashierAudit.cashDifference > 0 ? '+' : '') + formatCurrency(cashierAudit.cashDifference) + ' EGP'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-emerald-200/70 text-xs">
            <div>
              <span className="text-[11px] text-emerald-800 block font-medium">Aloha Cash (Drawer):</span>
              <span className="font-mono font-black text-emerald-950 text-base">
                {formatCurrency(cashierAudit.alohaCashTotal)} <span className="text-[10px] font-normal text-stone-500">EGP</span>
              </span>
            </div>
            <div>
              <span className="text-[11px] text-emerald-800 block font-medium">Talabat Cash (Reported):</span>
              <span className="font-mono font-black text-emerald-950 text-base">
                {formatCurrency(cashierAudit.talabatCashTotal)} <span className="text-[10px] font-normal text-stone-500">EGP</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Cash & Credit Reconciliation Settlement Table */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-stone-100/70 border-b border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-700" />
            <h4 className="text-sm font-black text-stone-900">
              Cash & Credit Audit Settlement Matrix (جدول مطابقة طرق الدفع)
            </h4>
          </div>
          <span className="text-xs font-bold text-stone-600 bg-stone-200/80 px-2.5 py-1 rounded-lg">
            Benchmark: Talabat Report | Actual: Aloha POS Registers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-stone-50 text-stone-700 font-bold border-b border-stone-200">
                <th className="py-3 px-4">Tender / Payment Method</th>
                <th className="py-3 px-4 text-center bg-orange-50/40 text-orange-950 border-r border-orange-100">
                  Talabat Orders (Benchmark)
                </th>
                <th className="py-3 px-4 text-right bg-orange-50/40 text-orange-950 border-r border-orange-100">
                  Talabat Total (Amount)
                </th>
                <th className="py-3 px-4 text-center bg-red-50/20 text-[#502314] border-r border-stone-200">
                  Aloha POS Checks (Actual)
                </th>
                <th className="py-3 px-4 text-right bg-red-50/20 text-[#502314] border-r border-stone-200">
                  Aloha Total (Amount)
                </th>
                <th className="py-3 px-4 text-right font-black">
                  Amount Variance (Aloha - Talabat)
                </th>
                <th className="py-3 px-4 text-center font-black">
                  Count Variance
                </th>
                <th className="py-3 px-4 text-center">
                  Audit Status & Variance Origin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/70 font-medium">
              {/* Cash Row */}
              <tr className="hover:bg-amber-50/30 transition-colors">
                <td className="py-3.5 px-4 font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span>Cash Drawer (Cash)</span>
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-bold text-orange-900 bg-orange-50/20 border-r border-orange-100">
                  {cashierAudit.talabatCashCount} checks
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-stone-900 bg-orange-50/20 border-r border-orange-100">
                  {formatCurrency(cashierAudit.talabatCashTotal)} <span className="text-[10px] text-stone-400 font-normal">EGP</span>
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-bold text-stone-800 bg-red-50/10 border-r border-stone-200">
                  {cashierAudit.alohaCashCount} checks
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-stone-900 bg-red-50/10 border-r border-stone-200">
                  {formatCurrency(cashierAudit.alohaCashTotal)} <span className="text-[10px] text-stone-400 font-normal">EGP</span>
                </td>
                <td
                  className={`py-3.5 px-4 text-right font-mono font-black text-sm ${
                    cashierAudit.cashDifference < -0.01
                      ? 'text-red-600'
                      : cashierAudit.cashDifference > 0.01
                      ? 'text-emerald-600'
                      : 'text-stone-600'
                  }`}
                >
                  {cashierAudit.cashDifference < 0 ? `- ` : cashierAudit.cashDifference > 0 ? `+ ` : ''}
                  {formatCurrency(cashierAudit.cashDifference)} EGP
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-black">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs ${
                      cashierAudit.alohaCashCount - cashierAudit.talabatCashCount < 0
                        ? 'bg-red-100 text-red-700 font-black'
                        : cashierAudit.alohaCashCount - cashierAudit.talabatCashCount > 0
                        ? 'bg-emerald-100 text-emerald-700 font-black'
                        : 'text-stone-600'
                    }`}
                  >
                    {cashierAudit.alohaCashCount - cashierAudit.talabatCashCount === 0
                      ? '0'
                      : (cashierAudit.alohaCashCount - cashierAudit.talabatCashCount > 0 ? '+' : '') +
                        (cashierAudit.alohaCashCount - cashierAudit.talabatCashCount)}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] ${cashStatusInfo.badgeClass}`}>
                    {cashStatusInfo.text}
                  </span>
                </td>
              </tr>

              {/* Credit Row */}
              <tr className="hover:bg-blue-50/30 transition-colors">
                <td className="py-3.5 px-4 font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                  <span>Online / Credit Card</span>
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-bold text-orange-900 bg-orange-50/20 border-r border-orange-100">
                  {cashierAudit.talabatCreditCount} checks
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-stone-900 bg-orange-50/20 border-r border-orange-100">
                  {formatCurrency(cashierAudit.talabatCreditTotal)} <span className="text-[10px] text-stone-400 font-normal">EGP</span>
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-bold text-stone-800 bg-red-50/10 border-r border-stone-200">
                  {cashierAudit.alohaCreditCount} checks
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-stone-900 bg-red-50/10 border-r border-stone-200">
                  {formatCurrency(cashierAudit.alohaCreditTotal)} <span className="text-[10px] text-stone-400 font-normal">EGP</span>
                </td>
                <td
                  className={`py-3.5 px-4 text-right font-mono font-black text-sm ${
                    cashierAudit.creditDifference < -0.01
                      ? 'text-red-600'
                      : cashierAudit.creditDifference > 0.01
                      ? 'text-emerald-600'
                      : 'text-stone-600'
                  }`}
                >
                  {cashierAudit.creditDifference < 0 ? `- ` : cashierAudit.creditDifference > 0 ? `+ ` : ''}
                  {formatCurrency(cashierAudit.creditDifference)} EGP
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-black">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs ${
                      cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount < 0
                        ? 'bg-red-100 text-red-700 font-black'
                        : cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount > 0
                        ? 'bg-emerald-100 text-emerald-700 font-black'
                        : 'text-stone-600'
                    }`}
                  >
                    {cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount === 0
                      ? '0'
                      : (cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount > 0 ? '+' : '') +
                        (cashierAudit.alohaCreditCount - cashierAudit.talabatCreditCount)}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] ${creditStatusInfo.badgeClass}`}>
                    {creditStatusInfo.text}
                  </span>
                </td>
              </tr>

              {/* Grand Total Row */}
              <tr className="bg-stone-100/90 font-black text-stone-900 border-t-2 border-stone-300">
                <td className="py-3.5 px-4 font-black">
                  Grand Total (Cash + Online)
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-black text-[#FF5A00] bg-orange-50/40 border-r border-orange-200">
                  {cashierAudit.talabatTotalOrdersCount} checks
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-stone-950 text-base bg-orange-50/40 border-r border-orange-200">
                  {formatCurrency(cashierAudit.talabatGrandTotal)} EGP
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-black text-[#502314] bg-red-50/20 border-r border-stone-300">
                  {cashierAudit.alohaTotalOrdersCount} checks
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-indigo-950 text-base bg-red-50/20 border-r border-stone-300">
                  {formatCurrency(cashierAudit.alohaGrandTotal)} EGP
                </td>
                <td
                  className={`py-3.5 px-4 text-right font-mono font-black text-base ${
                    cashierAudit.grossSalesDifference < -0.01
                      ? 'text-red-600'
                      : cashierAudit.grossSalesDifference > 0.01
                      ? 'text-emerald-600'
                      : 'text-stone-900'
                  }`}
                >
                  {cashierAudit.grossSalesDifference < 0 ? `- ` : cashierAudit.grossSalesDifference > 0 ? `+ ` : ''}
                  {formatCurrency(cashierAudit.grossSalesDifference)} EGP
                </td>
                <td className="py-3.5 px-4 text-center font-mono font-black text-stone-800">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-xs font-black ${
                      cashierAudit.orderCountDifference < 0
                        ? 'bg-red-200 text-red-900'
                        : cashierAudit.orderCountDifference > 0
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'text-stone-700'
                    }`}
                  >
                    {cashierAudit.orderCountDifference === 0
                      ? '0'
                      : (cashierAudit.orderCountDifference > 0 ? '+' : '') + cashierAudit.orderCountDifference}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] ${grossStatusInfo.badgeClass}`}>
                    {grossStatusInfo.text}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Online / Credit Card Breakdown (Excel Breakdown) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs sm:text-sm font-bold text-stone-700 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-blue-600" />
            Talabat Excel Tender Breakdown:
          </span>
          <span className="text-xs text-stone-500 font-semibold font-mono">
            {totalExcelCount} rows parsed in Excel
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Cash */}
          <div className="bg-[#FFFDF5] border border-amber-200/90 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-stone-600 block">Talabat Cash Tender</span>
                <span className="text-base font-black text-stone-900 font-mono tracking-tight">
                  {formatCurrency(excelPayments.cash.total)} <span className="text-[10px] font-medium text-stone-400">EGP</span>
                </span>
              </div>
            </div>
            <div className="text-left bg-amber-100/80 px-2.5 py-1 rounded-lg text-xs font-black text-amber-900 font-mono">
              {excelPayments.cash.count} checks
            </div>
          </div>

          {/* Credit Card */}
          <div className="bg-[#F8FAFC] border border-stone-200/90 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-stone-600 block">Credit Card / Debit</span>
                <span className="text-base font-black text-stone-900 font-mono tracking-tight">
                  {formatCurrency(excelPayments.card.total)} <span className="text-[10px] font-medium text-stone-400">EGP</span>
                </span>
              </div>
            </div>
            <div className="text-left bg-blue-100/80 px-2.5 py-1 rounded-lg text-xs font-black text-blue-900 font-mono">
              {excelPayments.card.count} checks
            </div>
          </div>

          {/* Talabat Credit */}
          <div className="bg-[#FAF5FF] border border-purple-200/90 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-stone-600 block">Talabat Credit / Online</span>
                <span className="text-base font-black text-stone-900 font-mono tracking-tight">
                  {formatCurrency(excelPayments.talabat.total)} <span className="text-[10px] font-medium text-stone-400">EGP</span>
                </span>
              </div>
            </div>
            <div className="text-left bg-purple-100/80 px-2.5 py-1 rounded-lg text-xs font-black text-purple-900 font-mono">
              {excelPayments.talabat.count} checks
            </div>
          </div>
        </div>
      </div>

      {/* Financial Comparison Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Talabat Shortage Box */}
        <div className="bg-[#FFF1F0] border border-red-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-2xs">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-red-900 block">Talabat Shortage</span>
              <span className="text-lg sm:text-xl font-black text-red-700 font-mono tracking-tight">
                {formatCurrency(summary.grossDeficitTotal)} <span className="text-xs font-semibold">EGP</span>
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-red-700 bg-red-100/90 px-2.5 py-1 rounded-lg font-mono">
            {summary.deficitCount + (summary.missingInTalabatCount > 0 ? summary.missingInTalabatCount : 0)} checks
          </span>
        </div>

        {/* Aloha Shortage Box (Missing in Aloha) */}
        <div className="bg-[#FFF5F5] border-2 border-rose-300 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-rose-900 block">Aloha Shortage</span>
              <span className="text-lg sm:text-xl font-black text-rose-700 font-mono tracking-tight">
                {formatCurrency(summary.missingInAlohaTotal)} <span className="text-xs font-semibold">EGP</span>
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-700 bg-rose-100/90 px-2.5 py-1 rounded-lg font-mono">
            {summary.missingInAlohaCount} checks
          </span>
        </div>

        {/* Surplus Box */}
        <div className="bg-[#ECFDF3] border border-emerald-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-900 block">Talabat Surplus</span>
              <span className="text-lg sm:text-xl font-black text-emerald-700 font-mono tracking-tight">
                {formatCurrency(summary.grossSurplusTotal)} <span className="text-xs font-semibold">EGP</span>
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-lg font-mono">
            {summary.surplusCount} checks
          </span>
        </div>

        {/* Net Difference Box */}
        <div
          className={`rounded-2xl p-4 border-2 flex items-center justify-between shadow-2xs ${
            isNetDeficit
              ? 'bg-rose-50/80 border-rose-300 text-rose-900'
              : isNetSurplus
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
              : 'bg-stone-50 border-stone-300 text-stone-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-stone-700" />
            </div>
            <div>
              <span className="text-xs font-bold block">Net Variance</span>
              <span className="text-lg sm:text-xl font-black font-mono tracking-tight">
                {summary.netDifference < 0 ? `- ` : summary.netDifference > 0 ? `+ ` : ''}
                {formatCurrency(summary.netDifference)} <span className="text-xs font-semibold">EGP</span>
              </span>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
              isNetDeficit ? 'bg-rose-200/80 text-rose-900' : isNetSurplus ? 'bg-emerald-200/80 text-emerald-900' : 'bg-stone-200 text-stone-700'
            }`}
          >
            {isNetDeficit ? 'Deficit' : isNetSurplus ? 'Surplus' : 'Balanced'}
          </span>
        </div>
      </div>

      {/* Discrepancy Alerts Strip */}
      {(summary.methodMismatchCount > 0 || summary.missingInTalabatCount > 0 || summary.missingInAlohaCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {summary.methodMismatchCount > 0 && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-semibold">Payment Method Mismatches:</span>
              </div>
              <strong className="font-mono font-black text-amber-950 text-sm">{summary.methodMismatchCount} checks</strong>
            </div>
          )}

          {summary.missingInTalabatCount > 0 && (
            <div className="bg-red-50/90 border border-red-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-red-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-semibold">Missing in Talabat Excel:</span>
              </div>
              <strong className="font-mono font-black text-red-950 text-sm">{summary.missingInTalabatCount} ({formatCurrency(summary.missingInTalabatTotal)} EGP)</strong>
            </div>
          )}

          {summary.missingInAlohaCount > 0 && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold">Missing in Aloha POS:</span>
              </div>
              <strong className="font-mono font-black text-amber-950 text-sm">{summary.missingInAlohaCount} ({formatCurrency(summary.missingInAlohaTotal)} EGP)</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
};



