import React, { useMemo, useState } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  CalendarDays,
  DollarSign,
  Search,
  Filter,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileDown,
  Printer,
  Sparkles,
  Layers,
  Edit2,
} from 'lucide-react';
import { ComparisonRow, ParsedOrder, ReconciliationSummary } from '../types';
import { BurgerKingLogo, TalabatLogo } from './BrandLogos';
import * as XLSX from 'xlsx';
import { ExportModal } from './ExportModal';
import { generateReconciliationPDFBlob } from '../utils/pdfExport';

interface DailyDiscrepancyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: ComparisonRow[];
  alohaOrders: ParsedOrder[];
  summary: ReconciliationSummary | null;
  onEditRow?: (row: ComparisonRow) => void;
  onSaveRowNote?: (rowKey: string, reason: string, note: string) => void;
}

interface DayAuditGroup {
  dayId: string;
  dayLabel: string;
  sourceFileName?: string;
  totalAlohaOrders: number;
  totalTalabatOrders: number;
  alohaTotalAmount: number;
  talabatTotalAmount: number;
  alohaCashAmount: number;
  talabatCashAmount: number;
  alohaOnlineAmount: number;
  talabatOnlineAmount: number;
  netVariance: number;
  grossDeficit: number;
  grossSurplus: number;
  discrepantRowsCount: number;
  matchedRowsCount: number;
  discrepantRows: ComparisonRow[];
  allRows: ComparisonRow[];
}

export const DailyDiscrepancyReportModal: React.FC<DailyDiscrepancyReportModalProps> = ({
  isOpen,
  onClose,
  rows,
  alohaOrders,
  summary,
  onEditRow,
  onSaveRowNote,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'deficits' | 'balanced'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  // Group comparison rows by day
  const dayGroups = useMemo<DayAuditGroup[]>(() => {
    const groupsMap: Record<string, DayAuditGroup> = {};

    // Group rows
    rows.forEach(row => {
      const dayKey = row.dayLabel || row.alohaDate || row.talabatDate || row.sourceFileName || 'Day 1';
      if (!groupsMap[dayKey]) {
        groupsMap[dayKey] = {
          dayId: dayKey,
          dayLabel: dayKey,
          sourceFileName: row.sourceFileName,
          totalAlohaOrders: 0,
          totalTalabatOrders: 0,
          alohaTotalAmount: 0,
          talabatTotalAmount: 0,
          alohaCashAmount: 0,
          talabatCashAmount: 0,
          alohaOnlineAmount: 0,
          talabatOnlineAmount: 0,
          netVariance: 0,
          grossDeficit: 0,
          grossSurplus: 0,
          discrepantRowsCount: 0,
          matchedRowsCount: 0,
          discrepantRows: [],
          allRows: [],
        };
      }

      const g = groupsMap[dayKey];
      g.allRows.push(row);

      const alohaAmt = Number(row.alohaPrice) || 0;
      const talabatAmt = Number(row.talabatPrice) || 0;
      const diff = Number(row.difference) || 0;

      if (alohaAmt > 0) g.totalAlohaOrders++;
      if (talabatAmt > 0) g.totalTalabatOrders++;

      g.alohaTotalAmount += alohaAmt;
      g.talabatTotalAmount += talabatAmt;

      if (row.localPayment === 'Cash') g.alohaCashAmount += alohaAmt;
      else g.alohaOnlineAmount += alohaAmt;

      if ((row.talabatMethod || '').toUpperCase() === 'CASH') g.talabatCashAmount += talabatAmt;
      else if (talabatAmt > 0) g.talabatOnlineAmount += talabatAmt;

      g.netVariance += diff;

      // Discrepancy check: difference > 0.05 OR missing match OR status !== 'match'
      const isDiscrepant =
        Math.abs(diff) > 0.05 ||
        row.status === 'missing_in_talabat' ||
        row.status === 'missing_in_aloha' ||
        row.status === 'mismatch_partial';

      if (isDiscrepant) {
        g.discrepantRowsCount++;
        g.discrepantRows.push(row);
        if (diff < -0.05) {
          g.grossDeficit += Math.abs(diff);
        } else if (diff > 0.05) {
          g.grossSurplus += diff;
        }
      } else {
        g.matchedRowsCount++;
      }
    });

    const result = Object.values(groupsMap).sort((a, b) => {
      // Sort days with deficits first, then by name
      if (a.grossDeficit > 0 && b.grossDeficit === 0) return -1;
      if (b.grossDeficit > 0 && a.grossDeficit === 0) return 1;
      return a.dayLabel.localeCompare(b.dayLabel, undefined, { numeric: true });
    });

    return result;
  }, [rows]);

  // Overall totals across days
  const overallMetrics = useMemo(() => {
    const totalDays = dayGroups.length;
    const daysWithDeficit = dayGroups.filter(g => g.grossDeficit > 0.05).length;
    const daysBalanced = dayGroups.filter(g => g.grossDeficit <= 0.05 && g.discrepantRowsCount === 0).length;
    const totalDeficitEgp = dayGroups.reduce((acc, g) => acc + g.grossDeficit, 0);
    const totalSurplusEgp = dayGroups.reduce((acc, g) => acc + g.grossSurplus, 0);
    const totalDiscrepantOrders = dayGroups.reduce((acc, g) => acc + g.discrepantRowsCount, 0);

    return {
      totalDays,
      daysWithDeficit,
      daysBalanced,
      totalDeficitEgp,
      totalSurplusEgp,
      totalDiscrepantOrders,
    };
  }, [dayGroups]);

  // Filtered day groups
  const filteredDays = useMemo(() => {
    return dayGroups.filter(group => {
      if (filterType === 'deficits' && group.grossDeficit <= 0.05 && group.discrepantRowsCount === 0) {
        return false;
      }
      if (filterType === 'balanced' && (group.grossDeficit > 0.05 || group.discrepantRowsCount > 0)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDay = group.dayLabel.toLowerCase().includes(q) || (group.sourceFileName && group.sourceFileName.toLowerCase().includes(q));
        const matchesOrder = group.discrepantRows.some(
          r =>
            r.number.toLowerCase().includes(q) ||
            r.orderId.toLowerCase().includes(q) ||
            (r.alohaHost && r.alohaHost.toLowerCase().includes(q)) ||
            (r.customVarianceNote && r.customVarianceNote.toLowerCase().includes(q)) ||
            (r.varianceReason && r.varianceReason.toLowerCase().includes(q))
        );
        return matchesDay || matchesOrder;
      }

      return true;
    });
  }, [dayGroups, filterType, searchQuery]);

  const toggleDayExpanded = (dayId: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayId]: prev[dayId] === undefined ? false : !prev[dayId],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    dayGroups.forEach(g => {
      all[g.dayId] = true;
    });
    setExpandedDays(all);
  };

  const collapseAll = () => {
    setExpandedDays({});
  };

  // Export Daily Discrepancies directly to Excel
  const handleExportExcel = () => {
    const dataRows: any[] = [];

    dayGroups.forEach(group => {
      if (group.discrepantRows.length === 0) {
        dataRows.push({
          'Day / Date': group.dayLabel,
          'Day Status': 'Balanced (0 Discrepancies)',
          'Check #': '—',
          'Talabat Order ID': '—',
          'Time': '—',
          'Host / Cashier': '—',
          'Terminal': '—',
          'Aloha Tender': '—',
          'Talabat Tender': '—',
          'Aloha Amount (EGP)': group.alohaTotalAmount.toFixed(2),
          'Talabat Amount (EGP)': group.talabatTotalAmount.toFixed(2),
          'Variance (EGP)': '0.00',
          'Variance Impact': 'BALANCED',
          'Variance Reason': 'Fully Balanced',
          'Audit Note': 'No variances found on this day',
        });
      } else {
        group.discrepantRows.forEach(row => {
          const rowAlohaPrice = Number(row.alohaPrice) || 0;
          const rowTalabatPrice = Number(row.talabatPrice) || 0;
          const rowDiff = Number(row.difference) || 0;
          dataRows.push({
            'Day / Date': group.dayLabel,
            'Day Status': `Deficit: -${(group.grossDeficit || 0).toFixed(2)} EGP (${group.discrepantRowsCount} variances)`,
            'Check #': row.number || '—',
            'Talabat Order ID': row.orderId || '—',
            'Time': row.alohaTime || row.talabatTime || '—',
            'Host / Cashier': row.alohaHost || '—',
            'Terminal': row.alohaTerminal || '—',
            'Aloha Tender': row.localPayment || '—',
            'Talabat Tender': row.talabatMethod || '—',
            'Aloha Amount (EGP)': rowAlohaPrice.toFixed(2),
            'Talabat Amount (EGP)': rowTalabatPrice.toFixed(2),
            'Variance (EGP)': rowDiff.toFixed(2),
            'Variance Impact': rowDiff < -0.05 ? 'DEFICIT (Aloha > Talabat)' : rowDiff > 0.05 ? 'SURPLUS (Talabat > Aloha)' : 'MISMATCH',
            'Variance Reason': row.varianceReason || 'Unclassified',
            'Audit Note': row.customVarianceNote || row.auditNote || '—',
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Discrepancy Breakdown');
    XLSX.writeFile(wb, `Daily_Variance_Breakdown_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white border border-stone-200 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:max-h-none print:border-none">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-stone-200 bg-stone-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-red-100 text-[#D71920] rounded-2xl ring-4 ring-red-50">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                  Daily Discrepancy & Variance Breakdown
                </h2>
                <span className="bg-red-100 text-red-800 text-xs font-black px-2.5 py-0.5 rounded-full">
                  Day-by-Day Deficit Analysis
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 font-medium">
                Pinpoint exactly which days and individual checks generated deficits between Aloha POS and Talabat
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {summary && (
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition-all cursor-pointer shadow-xs"
                title="Export PDF Report with perfect Arabic font rendering"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-xs"
              title="Export Daily Discrepancy Breakdown to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-all cursor-pointer"
              title="Print Daily Discrepancy Report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Summary KPI Bar */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-red-500/5 via-amber-500/5 to-emerald-500/5 border-b border-stone-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-stone-800">
            <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
              <span className="text-[11px] font-bold text-stone-500 block mb-0.5">
                Total Days Audited
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black font-mono text-stone-900">
                  {overallMetrics.totalDays}
                </span>
                <span className="text-xs text-stone-500">Days</span>
              </div>
            </div>

            <div className="bg-red-50/80 p-3 rounded-2xl border border-red-200 shadow-2xs">
              <span className="text-[11px] font-bold text-red-800 block mb-0.5 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                Days with Deficits
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black font-mono text-red-700">
                  {overallMetrics.daysWithDeficit}
                </span>
                <span className="text-xs font-bold text-red-600">
                  ({overallMetrics.totalDiscrepantOrders} Checks)
                </span>
              </div>
            </div>

            <div className="bg-rose-50/80 p-3 rounded-2xl border border-rose-200 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-800 block mb-0.5">
                Total Deficit Amount
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black font-mono text-rose-700">
                  -{overallMetrics.totalDeficitEgp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-rose-600">EGP</span>
              </div>
            </div>

            <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-800 block mb-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                100% Balanced Days
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black font-mono text-emerald-700">
                  {overallMetrics.daysBalanced}
                </span>
                <span className="text-xs text-emerald-600">Days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All Days ({dayGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('deficits')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'deficits'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Days with Deficits ({overallMetrics.daysWithDeficit})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('balanced')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'balanced'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Balanced Days ({overallMetrics.daysBalanced})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search day, check #, cashier..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 text-stone-900"
              />
            </div>
            <button
              type="button"
              onClick={expandAll}
              className="text-[11px] font-bold text-stone-500 hover:text-stone-800 underline px-1 cursor-pointer"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="text-[11px] font-bold text-stone-500 hover:text-stone-800 underline px-1 cursor-pointer"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Day-by-Day List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-stone-100/60">
          {filteredDays.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 p-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h4 className="text-base font-bold text-stone-800 mb-1">
                No matching days found
              </h4>
              <p className="text-xs text-stone-500">
                Try switching the filter to "All Days" or clearing your search term.
              </p>
            </div>
          ) : (
            filteredDays.map(group => {
              const isExpanded = expandedDays[group.dayId] ?? (group.grossDeficit > 0.05 || group.discrepantRowsCount > 0);
              const hasDeficit = group.grossDeficit > 0.05;
              const hasSurplus = group.grossSurplus > 0.05;
              const isBalanced = !hasDeficit && !hasSurplus && group.discrepantRowsCount === 0;

              return (
                <div
                  key={group.dayId}
                  className={`bg-white border rounded-3xl transition-all shadow-sm overflow-hidden ${
                    hasDeficit
                      ? 'border-red-300 ring-1 ring-red-400/20'
                      : isBalanced
                      ? 'border-emerald-200'
                      : 'border-amber-200'
                  }`}
                >
                  {/* Day Header Card */}
                  <div
                    onClick={() => toggleDayExpanded(group.dayId)}
                    className={`p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                      hasDeficit
                        ? 'bg-red-50/40 hover:bg-red-50/70'
                        : isBalanced
                        ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                        : 'bg-amber-50/30 hover:bg-amber-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`p-2.5 rounded-2xl flex items-center justify-center shrink-0 ${
                          hasDeficit
                            ? 'bg-red-100 text-red-700'
                            : isBalanced
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        <Calendar className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                            📅 {group.dayLabel}
                          </h3>
                          {group.sourceFileName && (
                            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                              {group.sourceFileName}
                            </span>
                          )}
                          {hasDeficit ? (
                            <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              Deficit: -{group.grossDeficit.toFixed(2)} EGP ({group.discrepantRowsCount} variances)
                            </span>
                          ) : isBalanced ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              100% Balanced Match
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              Surplus: +{group.grossSurplus.toFixed(2)} EGP
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 mt-1">
                          <span>
                            Aloha: <strong className="font-mono text-stone-800">{group.alohaTotalAmount.toFixed(2)} EGP</strong> ({group.totalAlohaOrders} checks)
                          </span>
                          <span>•</span>
                          <span>
                            Talabat: <strong className="font-mono text-stone-800">{group.talabatTotalAmount.toFixed(2)} EGP</strong> ({group.totalTalabatOrders} orders)
                          </span>
                          <span>•</span>
                          <span>
                            Cash Drawer: <strong className="font-mono text-stone-800">{group.alohaCashAmount.toFixed(2)} EGP</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side variance badge & expand chevron */}
                    <div className="flex items-center gap-4 self-end md:self-center">
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 block">
                          Day Net Variance
                        </span>
                        <span
                          className={`text-base font-black font-mono ${
                            hasDeficit
                              ? 'text-red-600'
                              : isBalanced
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {Math.abs(group.netVariance) <= 0.05
                            ? '0.00 EGP'
                            : `${group.netVariance > 0 ? '+' : ''}${group.netVariance.toFixed(2)} EGP`}
                        </span>
                      </div>

                      <div className="p-1.5 rounded-xl bg-stone-100 text-stone-500">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body with Exact Discrepant Orders */}
                  {isExpanded && (
                    <div className="p-4 sm:p-6 border-t border-stone-200 bg-white space-y-4">
                      {group.discrepantRows.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <strong className="block font-bold">No Discrepancies on this Day</strong>
                            <span>All Aloha POS checks on {group.dayLabel} matched Talabat orders with 100% financial precision.</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-red-900 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              Exact Discrepant Checks & Orders on {group.dayLabel} ({group.discrepantRows.length}):
                            </h4>
                            <span className="text-[11px] text-stone-500">
                              Sorted by largest deficit first
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-2xl border border-stone-200 shadow-2xs">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-stone-50 text-stone-700 font-bold border-b border-stone-200">
                                  <th className="py-2.5 px-3">Check #</th>
                                  <th className="py-2.5 px-3">Talabat ID</th>
                                  <th className="py-2.5 px-3">Time & Cashier</th>
                                  <th className="py-2.5 px-3">Aloha Tender</th>
                                  <th className="py-2.5 px-3">Talabat Tender</th>
                                  <th className="py-2.5 px-3 text-right">Aloha (EGP)</th>
                                  <th className="py-2.5 px-3 text-right">Talabat (EGP)</th>
                                  <th className="py-2.5 px-3 text-right">Variance (EGP)</th>
                                  <th className="py-2.5 px-3">Variance Cause / Note</th>
                                  <th className="py-2.5 px-2 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {group.discrepantRows
                                  .sort((a, b) => a.difference - b.difference)
                                  .map(row => {
                                    const diff = row.difference;
                                    const isDeficit = diff < -0.05;
                                    const isSurplus = diff > 0.05;

                                    return (
                                      <tr
                                        key={row.key || row.number}
                                        className={`hover:bg-stone-50/80 transition-colors ${
                                          isDeficit
                                            ? 'bg-red-50/30'
                                            : isSurplus
                                            ? 'bg-amber-50/30'
                                            : ''
                                        }`}
                                      >
                                        <td className="py-2.5 px-3 font-mono font-bold text-stone-900">
                                          #{row.number || '—'}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-stone-700">
                                          {row.orderId || '—'}
                                        </td>
                                        <td className="py-2.5 px-3 text-stone-600">
                                          <div className="flex items-center gap-1 font-mono text-[11px]">
                                            <Clock className="w-3 h-3 text-stone-400" />
                                            {row.alohaTime || row.talabatTime || '—'}
                                          </div>
                                          {row.alohaHost && (
                                            <div className="text-[10px] text-stone-500 flex items-center gap-0.5">
                                              <User className="w-2.5 h-2.5" />
                                              {row.alohaHost} {row.alohaTerminal ? `(${row.alohaTerminal})` : ''}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <span
                                            className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                              row.localPayment === 'Cash'
                                                ? 'bg-emerald-100 text-emerald-900'
                                                : 'bg-blue-100 text-blue-900'
                                            }`}
                                          >
                                            {row.localPayment}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <span
                                            className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                              row.talabatMethod.toUpperCase() === 'CASH'
                                                ? 'bg-emerald-100 text-emerald-900'
                                                : 'bg-orange-100 text-orange-900'
                                            }`}
                                          >
                                            {row.talabatMethod}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                                          {(Number(row.alohaPrice) || 0).toFixed(2)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                                          {(Number(row.talabatPrice) || 0).toFixed(2)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                          <span
                                            className={`font-mono font-black px-2 py-0.5 rounded-md text-xs ${
                                              isDeficit
                                                ? 'bg-red-100 text-red-700'
                                                : isSurplus
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'text-stone-600'
                                            }`}
                                          >
                                            {diff > 0 ? '+' : ''}
                                            {(Number(diff) || 0).toFixed(2)}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 max-w-[200px]">
                                          {row.varianceReason ? (
                                            <div className="bg-amber-100/80 text-amber-950 text-[11px] px-2 py-1 rounded-lg border border-amber-300">
                                              <strong className="block font-bold">{row.varianceReason}</strong>
                                              {row.customVarianceNote && (
                                                <span className="text-[10px] text-amber-800 block">
                                                  {row.customVarianceNote}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-stone-400 italic text-[11px]">
                                              {row.auditNote || 'No explanation recorded'}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-2 text-center">
                                          <button
                                            type="button"
                                            onClick={() => onEditRow?.(row)}
                                            className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                            title="Edit & Explain Variance"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50/90 flex items-center justify-between">
          <div className="text-xs text-stone-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Audit report accurately classifies checks and maps each deficit to its origin day and cashier.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-xs font-bold text-stone-700 bg-stone-200 hover:bg-stone-300 rounded-xl transition-all cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>

      {/* Export PDF Modal */}
      {summary && (
        <ExportModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          title="Export Daily Discrepancies & Reconciliation (PDF)"
          defaultFileName={`BK_Daily_Discrepancy_Audit_${new Date().toISOString().slice(0, 10)}`}
          fileExtension="pdf"
          fileBlobGenerator={() =>
            generateReconciliationPDFBlob({
              rows,
              summary,
            })
          }
        />
      )}
    </div>
  );
};
