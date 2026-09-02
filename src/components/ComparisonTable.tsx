import React, { useState, useMemo, useEffect } from 'react';
import { ComparisonRow, ReconciliationSummary } from '../types';
import {
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  HelpCircle,
  Download,
  Copy,
  Check,
  Filter,
  Eye,
  X,
  FileWarning,
  AlertTriangle,
  Receipt,
  Layers,
  ShoppingBag,
  ArrowRightLeft,
  User,
  Clock,
  Laptop,
  FileDown,
  Loader2,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Edit2,
  Trash2,
  Save,
  RefreshCw,
  FileText,
  CheckCheck,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { exportComparisonToExcel, generateComparisonExcelBlob, evaluateComparisonRow } from '../utils/excel';
import { BurgerKingLogo, TalabatLogo } from './BrandLogos';
import { exportReconciliationPDF, generateReconciliationPDFBlob } from '../utils/pdfExport';
import { OrderFormModal } from './OrderFormModal';
import { ExportModal } from './ExportModal';
import { parseDateTimeToTimestamp, parseSingleAlohaReceiptBlock, ParsedReceiptBreakdown } from '../utils/parser';
import { ComparisonTableRowItem } from './ComparisonTableRowItem';

export const VARIANCE_REASONS = [
  { value: '', label: '— Select Variance Reason / Action —' },
  { value: 'Void Order', label: '🚫 Void Check / Cancelled (0.00 EGP)' },
  { value: 'Employee Meal', label: '🍔 Employee Meal / Manager Discount' },
  { value: 'Transfer Out', label: '🚨 Transfer Out / Cancelled MOE' },
  { value: 'Transfer In', label: '📥 Transfer In / Incoming Transfer' },
  { value: 'Order was processed as Cash, but the employee removed it', label: '💸 Processed as Cash, then Deleted by Cashier' },
  { value: 'Cancelled order, but it was processed on Otlob', label: '❌ Cancelled Order Processed on Otlob by Mistake' },
  { value: 'Tender Mismatch (Cash vs Credit)', label: '💳 Tender Mismatch (Cash vs Credit)' },
  { value: 'Delivery Fee / Service Difference', label: '🛵 Delivery Fee / Service Charge Difference' },
  { value: 'custom', label: '✏️ Other Custom Explanation...' },
];

type SortField = 'sequence' | 'number' | 'orderId' | 'alohaPrice' | 'talabatPrice' | 'difference' | 'alohaTime' | 'talabatTime' | 'status';
type SortOrder = 'asc' | 'desc';

interface ComparisonTableProps {
  rows: ComparisonRow[];
  summary: ReconciliationSummary;
  excelFileName?: string;
  onUpdateRowReason?: (rowKey: string, reason: string, customNote?: string) => void;
  onSaveRow?: (row: Partial<ComparisonRow>, isNew: boolean) => void;
  onDeleteRow?: (rowKey: string) => void;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  rows,
  summary,
  excelFileName,
  onUpdateRowReason,
  onSaveRow,
  onDeleteRow,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('alohaTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ComparisonRow | null>(null);

  // Pagination state for ultra-fast rendering (50, 100, 250, All)
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterDay, searchQuery, sortField, sortOrder, pageSize]);

  // Interactive Receipt Inspector States
  const [inspectTab, setInspectTab] = useState<'view' | 'edit_text' | 'edit_fields'>('view');
  const [inspectReceiptText, setInspectReceiptText] = useState<string>('');
  const [inspectBreakdown, setInspectBreakdown] = useState<ParsedReceiptBreakdown | null>(null);
  const [inspectFormData, setInspectFormData] = useState<Partial<ComparisonRow>>({});
  const [inspectSuccessMsg, setInspectSuccessMsg] = useState<string>('');
  const [isSavingInspect, setIsSavingInspect] = useState<boolean>(false);

  const handleOpenInspector = (row: ComparisonRow) => {
    setSelectedRow(row);
    setInspectTab('view');
    const text = row.rawAlohaOrder?.rawText || '';
    setInspectReceiptText(text);
    setInspectFormData({ ...row });
    setInspectSuccessMsg('');
    if (text.trim()) {
      const parsed = parseSingleAlohaReceiptBlock(text);
      setInspectBreakdown(parsed);
    } else {
      setInspectBreakdown(null);
    }
  };

  const handleParseInspectText = (text: string) => {
    setInspectReceiptText(text);
    if (!text.trim()) {
      setInspectBreakdown(null);
      return;
    }
    const parsed = parseSingleAlohaReceiptBlock(text);
    if (parsed) {
      setInspectBreakdown(parsed);
      setInspectFormData(prev => ({
        ...prev,
        number: parsed.checkNumber || prev.number,
        orderId: parsed.authNumber || prev.orderId,
        alohaPrice: parsed.isVoidOrder ? 0 : parsed.calculatedTotal > 0 ? parsed.calculatedTotal : prev.alohaPrice,
        talabatPrice: parsed.isVoidOrder ? 0 : prev.talabatPrice,
        localPayment: parsed.tenderMethod !== 'Unspecified' ? parsed.tenderMethod : prev.localPayment,
        varianceReason: parsed.isVoidOrder ? 'Void Order' : parsed.isEmployeeMeal ? 'Employee Meal' : prev.varianceReason,
        customVarianceNote: parsed.isVoidOrder
          ? 'Void Check / Cancelled - 0.00 EGP'
          : parsed.isEmployeeMeal
          ? 'Employee Meal Discount'
          : prev.customVarianceNote,
      }));
      setInspectSuccessMsg(
        parsed.isVoidOrder
          ? '🚫 Void check identified (0.00 EGP)'
          : parsed.isEmployeeMeal
          ? '🍔 Employee meal identified'
          : `✅ Receipt parsed successfully: Check #${parsed.checkNumber || '—'} (Aloha Total: ${parsed.calculatedTotal.toFixed(2)} EGP)`
      );
    }
  };

  const handleSaveInspectChanges = () => {
    if (!selectedRow || !onSaveRow) return;
    setIsSavingInspect(true);

    const updatedRowInput: Partial<ComparisonRow> = {
      ...selectedRow,
      ...inspectFormData,
      number: String(inspectFormData.number || selectedRow.number).trim(),
      orderId: String(inspectFormData.orderId || selectedRow.orderId).trim(),
      alohaPrice: Number(inspectFormData.alohaPrice) || 0,
      talabatPrice: Number(inspectFormData.talabatPrice) || 0,
      localPayment: String(inspectFormData.localPayment || selectedRow.localPayment).trim(),
      talabatMethod: String(inspectFormData.talabatMethod || selectedRow.talabatMethod).trim(),
      varianceReason: inspectFormData.varianceReason !== undefined ? inspectFormData.varianceReason : selectedRow.varianceReason,
      customVarianceNote: inspectFormData.customVarianceNote !== undefined ? inspectFormData.customVarianceNote : selectedRow.customVarianceNote,
      rawAlohaOrder: {
        ...(selectedRow.rawAlohaOrder || {
          id: selectedRow.key || `ord-${Date.now()}`,
          number: String(inspectFormData.number || selectedRow.number),
          amount: Number(inspectFormData.alohaPrice) || 0,
          payment: (inspectFormData.localPayment as any) || 'Cash',
          orderType: 'HD Talabat',
          storeName: 'Burger King',
          isDuplicate: false,
          isDelivery: true,
        }),
        rawText: inspectReceiptText || selectedRow.rawAlohaOrder?.rawText || '',
        amount: Number(inspectFormData.alohaPrice) || 0,
        number: String(inspectFormData.number || selectedRow.number),
        authNumber: inspectFormData.orderId !== '—' ? inspectFormData.orderId : undefined,
      },
    };

    const evaluated = evaluateComparisonRow(updatedRowInput);
    onSaveRow(evaluated, false);
    setSelectedRow(evaluated);
    setInspectFormData(evaluated);
    setInspectSuccessMsg('🎉 Successfully saved changes and updated reconciliation ledger!');
    setIsSavingInspect(false);
  };

  // Export Save As Modals
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'comparison_add' | 'comparison_edit'>('comparison_add');
  const [editingRow, setEditingRow] = useState<ComparisonRow | null>(null);
  const [rowToDelete, setRowToDelete] = useState<ComparisonRow | null>(null);

  const handleOpenAdd = () => {
    setEditingRow(null);
    setModalMode('comparison_add');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: ComparisonRow) => {
    setEditingRow(row);
    setModalMode('comparison_edit');
    setIsModalOpen(true);
  };

  const handleDelete = (row: ComparisonRow) => {
    setRowToDelete(row);
  };

  const confirmDeleteRow = () => {
    if (!rowToDelete) return;
    const key = rowToDelete.key || rowToDelete.number;
    onDeleteRow?.(key);
    if (selectedRow?.key === key || selectedRow?.number === key) {
      setSelectedRow(null);
    }
    setRowToDelete(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'difference' || field === 'alohaPrice' || field === 'talabatPrice' ? 'desc' : 'asc');
    }
  };

  // Available unique days in comparison
  const availableDays = useMemo(() => {
    return Array.from(
      new Set(
        rows.map(r => r.dayLabel || r.alohaDate || r.talabatDate || r.sourceFileName).filter(Boolean)
      )
    ) as string[];
  }, [rows]);

  const filteredAndSortedRows = useMemo(() => {
    const filtered = rows.filter(row => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        row.number.toLowerCase().includes(q) ||
        row.orderId.toLowerCase().includes(q) ||
        row.localPayment.toLowerCase().includes(q) ||
        row.talabatMethod.toLowerCase().includes(q) ||
        row.statusLabel.toLowerCase().includes(q) ||
        row.auditNote.toLowerCase().includes(q) ||
        (row.dayLabel && row.dayLabel.toLowerCase().includes(q)) ||
        (row.alohaDate && row.alohaDate.toLowerCase().includes(q)) ||
        (row.talabatDate && row.talabatDate.toLowerCase().includes(q)) ||
        (row.sourceFileName && row.sourceFileName.toLowerCase().includes(q)) ||
        (row.varianceReason && row.varianceReason.toLowerCase().includes(q)) ||
        (row.customVarianceNote && row.customVarianceNote.toLowerCase().includes(q));

      const rowDay = row.dayLabel || row.alohaDate || row.talabatDate || row.sourceFileName || '';
      const matchDay = filterDay === 'all' || rowDay === filterDay;

      let matchStatus = true;
      if (filterStatus === 'match') {
        matchStatus = row.status === 'match';
      } else if (filterStatus === 'deficit') {
        matchStatus = row.status === 'deficit' || row.status === 'missing_in_talabat' || (row.difference < -0.01 && row.status !== 'missing_in_aloha');
      } else if (filterStatus === 'surplus') {
        matchStatus = row.status === 'surplus' || (row.difference > 0.01 && row.status !== 'missing_in_aloha');
      } else if (filterStatus === 'method_mismatch') {
        matchStatus = row.isPaymentMismatch;
      } else if (filterStatus === 'missing_in_talabat') {
        matchStatus = row.status === 'missing_in_talabat';
      } else if (filterStatus === 'missing_in_aloha') {
        matchStatus = row.status === 'missing_in_aloha';
      } else if (filterStatus === 'smart_match') {
        matchStatus =
          row.matchType === 'fuzzy_id_price' ||
          row.matchType === 'exact_amount' ||
          row.matchType === 'promo_amount' ||
          row.matchType === 'similar_amount' ||
          row.matchType === 'suggested_match';
      } else if (filterStatus === 'suggested') {
        matchStatus = row.matchType === 'suggested_match';
      } else if (filterStatus === 'has_reason' || filterStatus === 'has_notes') {
        matchStatus = Boolean((row.varianceReason && row.varianceReason.trim() !== '') || (row.customVarianceNote && row.customVarianceNote.trim() !== ''));
      } else if (filterStatus === 'transfer_out') {
        const alohaAmt = row.alohaAmount !== undefined ? row.alohaAmount : row.alohaPrice;
        const talabatAmt = row.talabatAmount !== undefined ? row.talabatAmount : row.talabatPrice;
        matchStatus =
          row.number === '0' ||
          row.alohaOrderNo === '0' ||
          row.number === '—' ||
          row.isCancelledOrMoe ||
          /transfer/i.test(String(row.varianceReason || '')) ||
          /transfer/i.test(String(row.comment || '')) ||
          /transfer/i.test(String(row.auditNote || '')) ||
          /transfer/i.test(String(row.number || '')) ||
          /transfer/i.test(String(row.orderId || '')) ||
          (alohaAmt === 0 && talabatAmt > 0);
      }

      return matchSearch && matchDay && matchStatus;
    });

    if (sortField === 'sequence') {
      return sortOrder === 'asc' ? filtered : [...filtered].reverse();
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'alohaTime') {
        const timeA =
          parseDateTimeToTimestamp(a.alohaDate, a.alohaTime, a.alohaDateTime) ||
          parseDateTimeToTimestamp(a.talabatDate, a.talabatTime, a.talabatDateTime);
        const timeB =
          parseDateTimeToTimestamp(b.alohaDate, b.alohaTime, b.alohaDateTime) ||
          parseDateTimeToTimestamp(b.talabatDate, b.talabatTime, b.talabatDateTime);
        if (timeA !== 0 && timeB !== 0 && timeA !== timeB) {
          comparison = timeA - timeB;
        } else {
          const numA = parseInt(a.number.replace(/\D/g, '') || '0', 10);
          const numB = parseInt(b.number.replace(/\D/g, '') || '0', 10);
          comparison = numA - numB;
        }
      } else if (sortField === 'talabatTime') {
        const timeA = parseDateTimeToTimestamp(a.talabatDate, a.talabatTime, a.talabatDateTime);
        const timeB = parseDateTimeToTimestamp(b.talabatDate, b.talabatTime, b.talabatDateTime);
        if (timeA !== 0 && timeB !== 0 && timeA !== timeB) {
          comparison = timeA - timeB;
        } else {
          comparison = (a.orderId || '').localeCompare(b.orderId || '');
        }
      } else if (sortField === 'number') {
        const numA = parseInt(a.number.replace(/\D/g, '') || '0', 10);
        const numB = parseInt(b.number.replace(/\D/g, '') || '0', 10);
        comparison = numA !== numB ? numA - numB : a.number.localeCompare(b.number);
      } else if (sortField === 'orderId') {
        comparison = a.orderId.localeCompare(b.orderId);
      } else if (sortField === 'alohaPrice') {
        comparison = a.alohaPrice - b.alohaPrice;
      } else if (sortField === 'talabatPrice') {
        comparison = a.talabatPrice - b.talabatPrice;
      } else if (sortField === 'difference') {
        comparison = a.difference - b.difference;
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [rows, searchQuery, filterStatus, filterDay, sortField, sortOrder]);

  // Paginated Rows Slice
  const totalFilteredCount = filteredAndSortedRows.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalFilteredCount / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedRows = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedRows;
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(startIdx, startIdx + pageSize);
  }, [filteredAndSortedRows, safeCurrentPage, pageSize]);

  const smartMatchCount = rows.filter(
    r =>
      r.matchType === 'fuzzy_id_price' ||
      r.matchType === 'exact_amount' ||
      r.matchType === 'promo_amount' ||
      r.matchType === 'similar_amount' ||
      r.matchType === 'suggested_match'
  ).length;

  const suggestedMatchCount = rows.filter(r => r.matchType === 'suggested_match').length;

  const transferOutCount = useMemo(() => {
    return rows.filter(r => {
      const alohaAmt = r.alohaAmount !== undefined ? r.alohaAmount : r.alohaPrice;
      const talabatAmt = r.talabatAmount !== undefined ? r.talabatAmount : r.talabatPrice;
      return (
        r.number === '0' ||
        r.alohaOrderNo === '0' ||
        r.number === '—' ||
        r.isCancelledOrMoe ||
        /transfer/i.test(String(r.varianceReason || '')) ||
        /transfer/i.test(String(r.comment || '')) ||
        /transfer/i.test(String(r.auditNote || '')) ||
        /transfer/i.test(String(r.number || '')) ||
        /transfer/i.test(String(r.orderId || '')) ||
        (alohaAmt === 0 && talabatAmt > 0)
      );
    }).length;
  }, [rows]);

  const handleReasonChange = (row: ComparisonRow, newReasonValue: string) => {
    if (!onUpdateRowReason) return;
    const rowKey = row.key || row.number;
    onUpdateRowReason(rowKey, newReasonValue, row.customVarianceNote || '');
    if (selectedRow && (selectedRow.key === rowKey || selectedRow.number === rowKey)) {
      setSelectedRow({
        ...selectedRow,
        varianceReason: newReasonValue,
      });
      setInspectFormData(prev => ({
        ...prev,
        varianceReason: newReasonValue,
      }));
    }
  };

  const handleNoteChange = (row: ComparisonRow, newNoteValue: string) => {
    if (!onUpdateRowReason) return;
    const rowKey = row.key || row.number;
    onUpdateRowReason(rowKey, row.varianceReason || '', newNoteValue);
    if (selectedRow && (selectedRow.key === rowKey || selectedRow.number === rowKey)) {
      setSelectedRow({
        ...selectedRow,
        customVarianceNote: newNoteValue,
      });
      setInspectFormData(prev => ({
        ...prev,
        customVarianceNote: newNoteValue,
      }));
    }
  };

  const copySummaryText = () => {
    const text = `Burger King vs Talabat Reconciliation Audit Summary:
Total Checks Audited: ${summary.totalOrders}
Matched Checks: ${summary.matchedCount}
Shortage Checks: ${summary.deficitCount} (-${summary.totalDeficitAmount.toFixed(2)} EGP)
Surplus Checks: ${summary.surplusCount} (+${summary.totalSurplusAmount.toFixed(2)} EGP)
Missing in Talabat: ${summary.missingInTalabatCount}
Missing in Aloha: ${summary.missingInAlohaCount}
Net Financial Variance: ${summary.netDifference >= 0 ? '+' : ''}${summary.netDifference.toFixed(2)} EGP
Accuracy Rate: ${summary.accuracyPercentage.toFixed(1)}%`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
      {/* Top Header Control Bar */}
      <div className="p-4 sm:p-6 border-b border-stone-200 bg-stone-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center -space-x-2">
              <BurgerKingLogo size="sm" />
              <TalabatLogo size="sm" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
              Direct Reconciliation Ledger (Aloha POS vs Talabat)
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-700 font-mono">
              {rows.length} Records
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Exact check-by-check financial audit comparing Aloha POS shift reports with Talabat settlement ledger.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#D71920] hover:bg-[#b5141a] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manual Check</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer shadow-2xs"
            title="Export PDF Audit Report"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>PDF Export</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExcelModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all cursor-pointer shadow-2xs"
            title="Export Excel Reconciliation"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </button>

          <button
            type="button"
            onClick={copySummaryText}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="p-4 border-b border-stone-200 bg-white space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            All Checks ({rows.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('match')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterStatus === 'match'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Matched ({summary.matchedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('transfer_out')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterStatus === 'transfer_out'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Transfer Out / MOE ({transferOutCount})</span>
          </button>

          {smartMatchCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('smart_match')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                filterStatus === 'smart_match'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>Smart Matched ({smartMatchCount})</span>
            </button>
          )}

          {suggestedMatchCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('suggested')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                filterStatus === 'suggested'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Suggested Review ({suggestedMatchCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilterStatus('deficit')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterStatus === 'deficit'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <AlertOctagon className="w-3 h-3" />
            <span>Talabat Shortage ({summary.deficitCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('missing_in_aloha')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterStatus === 'missing_in_aloha'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <FileWarning className="w-3 h-3" />
            <span>Missing in Aloha ({summary.missingInAlohaCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('surplus')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterStatus === 'surplus'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            <span>Talabat Surplus ({summary.surplusCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('method_mismatch')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterStatus === 'method_mismatch'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200'
            }`}
          >
            <ArrowRightLeft className="w-3 h-3" />
            <span>Tender Mismatch ({summary.paymentMismatchCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('missing_in_talabat')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterStatus === 'missing_in_talabat'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Aloha Only ({summary.missingInTalabatCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('has_notes')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterStatus === 'has_notes'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>With Notes ({rows.filter(r => (r.varianceReason && r.varianceReason.trim() !== '') || (r.customVarianceNote && r.customVarianceNote.trim() !== '')).length})</span>
          </button>
        </div>

        {/* Filter Controls Row (Day Filter, Sort, Search, Page Size) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Day Filter */}
            {availableDays.length > 1 && (
              <select
                value={filterDay}
                onChange={e => setFilterDay(e.target.value)}
                className="text-xs bg-white border border-stone-300 rounded-xl px-3 py-1.5 font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">📅 All Days ({availableDays.length})</option>
                {availableDays.map(d => (
                  <option key={d} value={d}>
                    📅 {d}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={e => {
                const [f, o] = e.target.value.split('-');
                setSortField(f as SortField);
                setSortOrder(o as SortOrder);
              }}
              className="text-xs bg-white border border-stone-300 rounded-xl px-3 py-1.5 font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="alohaTime-asc">🕒 Order Time (Oldest to Newest)</option>
              <option value="alohaTime-desc">🕒 Order Time (Newest to Oldest)</option>
              <option value="sequence-asc">🔢 Default Sequence</option>
              <option value="number-asc">🏷️ Check # (Ascending)</option>
              <option value="number-desc">🏷️ Check # (Descending)</option>
              <option value="difference-asc">📉 Largest Deficit First</option>
              <option value="difference-desc">📈 Largest Surplus First</option>
              <option value="alohaPrice-desc">💰 Highest Aloha Amount</option>
              <option value="status-asc">🎯 By Match Status</option>
            </select>

            {/* Items Per Page Selector */}
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className="font-semibold">Show:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="text-xs bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={250}>250 rows</option>
                <option value={-1}>All ({totalFilteredCount})</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search check #, Talabat ID, note..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-3 pl-8 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Pagination Navigation Bar (Top) */}
      {pageSize !== -1 && totalPages > 1 && (
        <div className="px-4 py-2 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between text-xs text-stone-600">
          <div>
            Showing <strong className="text-stone-900 font-mono">{(safeCurrentPage - 1) * pageSize + 1}</strong> -{' '}
            <strong className="text-stone-900 font-mono">
              {Math.min(safeCurrentPage * pageSize, totalFilteredCount)}
            </strong>{' '}
            of <strong className="text-stone-900 font-mono">{totalFilteredCount}</strong> filtered records
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded-lg hover:bg-stone-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="p-1 rounded-lg hover:bg-stone-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-stone-800">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-1 rounded-lg hover:bg-stone-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded-lg hover:bg-stone-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1360px] text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-stone-100 via-stone-50 to-stone-100 text-stone-800 font-bold border-b-2 border-stone-300 select-none">
              <th
                onClick={() => handleSort('sequence')}
                className="py-3.5 px-3 w-12 text-center cursor-pointer hover:bg-stone-200/70 transition-colors whitespace-nowrap"
                title="Sequence"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>#</span>
                  {sortField === 'sequence' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  )}
                </div>
              </th>

              {/* 1. Aloha Check Number */}
              <th
                onClick={() => handleSort('number')}
                className="py-3.5 px-3.5 min-w-[155px] cursor-pointer hover:bg-stone-200/70 transition-colors whitespace-nowrap"
                title="Aloha POS Check #"
              >
                <div className="flex flex-col">
                  <span className="text-stone-900 font-extrabold flex items-center gap-1">
                    Aloha Check #
                    {sortField === 'number' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600 inline" /> : <ArrowDown className="w-3 h-3 text-blue-600 inline" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-50 inline" />
                    )}
                  </span>
                  <span className="text-[10px] text-stone-500 font-normal">POS Check Number</span>
                </div>
              </th>

              {/* 2. Talabat Order ID */}
              <th
                onClick={() => handleSort('orderId')}
                className="py-3.5 px-3.5 min-w-[170px] cursor-pointer hover:bg-stone-200/70 transition-colors whitespace-nowrap"
                title="Talabat Order ID"
              >
                <div className="flex flex-col">
                  <span className="text-orange-950 font-extrabold flex items-center gap-1">
                    Talabat Order ID
                    {sortField === 'orderId' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-600 inline" /> : <ArrowDown className="w-3 h-3 text-orange-600 inline" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-50 inline" />
                    )}
                  </span>
                  <span className="text-[10px] text-orange-700/80 font-normal">Talabat Order ID</span>
                </div>
              </th>

              {/* 3. Time */}
              <th
                onClick={() => handleSort('alohaTime')}
                className="py-3.5 px-3.5 min-w-[120px] cursor-pointer hover:bg-stone-200/70 transition-colors whitespace-nowrap"
                title="Order Time"
              >
                <div className="flex flex-col">
                  <span className="text-stone-800 font-extrabold flex items-center gap-1">
                    Time & Cashier
                    {sortField === 'alohaTime' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600 inline" /> : <ArrowDown className="w-3 h-3 text-blue-600 inline" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-50 inline" />
                    )}
                  </span>
                  <span className="text-[10px] text-stone-500 font-normal">Timestamp & Terminal</span>
                </div>
              </th>

              {/* 4. Payment Tenders */}
              <th className="py-3.5 px-3.5 min-w-[210px] whitespace-nowrap bg-stone-100/80">
                <div className="flex flex-col">
                  <span className="text-stone-900 font-extrabold flex items-center gap-1">
                    <span>Tender (Aloha ⟷ Talabat)</span>
                    <ArrowRightLeft className="w-3 h-3 text-stone-500" />
                  </span>
                  <span className="text-[10px] text-stone-600 font-normal">Aloha POS vs Talabat Ledger</span>
                </div>
              </th>

              {/* 5. Aloha Price */}
              <th
                onClick={() => handleSort('alohaPrice')}
                className="py-3.5 px-3.5 min-w-[125px] text-right cursor-pointer hover:bg-stone-200/70 transition-colors whitespace-nowrap"
                title="Aloha Check Gross Price"
              >
                <div className="flex flex-col items-end">
                  <span className="text-stone-900 font-extrabold flex items-center justify-end gap-1">
                    Aloha AM
                    {sortField === 'alohaPrice' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600 inline" /> : <ArrowDown className="w-3 h-3 text-blue-600 inline" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-50 inline" />
                    )}
                  </span>
                  <span className="text-[10px] text-stone-500 font-normal">POS Amount</span>
                </div>
              </th>

              {/* 6. Talabat Price */}
              <th
                onClick={() => handleSort('talabatPrice')}
                className="py-3.5 px-3.5 min-w-[125px] text-right cursor-pointer hover:bg-stone-200/70 transition-colors whitespace-nowrap"
                title="Talabat Ledger Price"
              >
                <div className="flex flex-col items-end">
                  <span className="text-orange-950 font-extrabold flex items-center justify-end gap-1">
                    Talabat AM
                    {sortField === 'talabatPrice' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-600 inline" /> : <ArrowDown className="w-3 h-3 text-orange-600 inline" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-50 inline" />
                    )}
                  </span>
                  <span className="text-[10px] text-orange-700/80 font-normal">Ledger Amount</span>
                </div>
              </th>

              {/* 7. Variance */}
              <th
                onClick={() => handleSort('difference')}
                className="py-3.5 px-3.5 min-w-[140px] text-right cursor-pointer hover:bg-stone-200/70 transition-colors whitespace-nowrap bg-stone-200/40"
                title="Variance = Aloha AM - Talabat AM"
              >
                <div className="flex flex-col items-end">
                  <span className="text-stone-900 font-black flex items-center justify-end gap-1">
                    Variance (EGP)
                    {sortField === 'difference' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600 inline" /> : <ArrowDown className="w-3 h-3 text-blue-600 inline" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-stone-400 opacity-50 inline" />
                    )}
                  </span>
                  <span className="text-[10px] text-stone-600 font-medium">Aloha AM - Talabat AM</span>
                </div>
              </th>

              {/* 8. Audit Notes & Reason */}
              <th className="py-3.5 px-3.5 min-w-[290px] bg-amber-50/80 text-amber-950 whitespace-nowrap">
                <div className="flex flex-col">
                  <span className="font-extrabold text-amber-950">Audit Note & Variance Reason</span>
                  <span className="text-[10px] text-amber-800/80 font-normal">Classify void, delivery fee, transfer out, or custom note</span>
                </div>
              </th>

              {/* 9. Actions */}
              <th className="py-3.5 px-2 text-center w-24 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-stone-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertTriangle className="w-8 h-8 text-stone-300" />
                    <span className="font-bold text-stone-500">No records matching the selected filter criteria</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => {
                const globalIndex = pageSize === -1 ? idx : (safeCurrentPage - 1) * pageSize + idx;
                return (
                  <ComparisonTableRowItem
                    key={row.key || row.number || `row-${globalIndex}`}
                    row={row}
                    index={globalIndex}
                    onOpenInspector={handleOpenInspector}
                    onOpenEdit={handleOpenEdit}
                    onDelete={handleDelete}
                    onReasonChange={handleReasonChange}
                    onNoteChange={handleNoteChange}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Navigation Bar (Bottom) */}
      {pageSize !== -1 && totalPages > 1 && (
        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-600">
          <div>
            Showing <strong className="text-stone-900 font-mono">{(safeCurrentPage - 1) * pageSize + 1}</strong> -{' '}
            <strong className="text-stone-900 font-mono">
              {Math.min(safeCurrentPage * pageSize, totalFilteredCount)}
            </strong>{' '}
            of <strong className="text-stone-900 font-mono">{totalFilteredCount}</strong> filtered records
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center gap-1 font-bold"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
              <span>First</span>
            </button>
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center gap-1 font-bold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-3 font-bold text-stone-800">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center gap-1 font-bold"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex items-center gap-1 font-bold"
            >
              <span>Last</span>
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Receipt Inspector Drawer Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">
                    Audit Inspection: Check #{selectedRow.number}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Talabat Order ID: {selectedRow.orderId || '—'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3 mb-4">
              <button
                type="button"
                onClick={() => setInspectTab('view')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  inspectTab === 'view'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                1. Audit Details
              </button>
              <button
                type="button"
                onClick={() => setInspectTab('edit_text')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  inspectTab === 'edit_text'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                2. Receipt Text & Parser
              </button>
              <button
                type="button"
                onClick={() => setInspectTab('edit_fields')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  inspectTab === 'edit_fields'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                3. Direct Field Editor
              </button>
            </div>

            {/* Feedback Message */}
            {inspectSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{inspectSuccessMsg}</span>
              </div>
            )}

            {/* Tab 1: Audit View */}
            {inspectTab === 'view' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                    <span className="text-[10px] font-bold text-stone-400 block uppercase">Aloha Check #</span>
                    <strong className="text-sm font-mono text-stone-900">#{selectedRow.number}</strong>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                    <span className="text-[10px] font-bold text-stone-400 block uppercase">Talabat ID</span>
                    <strong className="text-sm font-mono text-orange-950">{selectedRow.orderId}</strong>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                    <span className="text-[10px] font-bold text-stone-400 block uppercase">Timestamp</span>
                    <strong className="text-sm font-mono text-stone-900">{selectedRow.alohaTime || selectedRow.talabatTime || '—'}</strong>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                    <span className="text-[10px] font-bold text-stone-400 block uppercase">Aloha Gross</span>
                    <strong className="text-sm font-mono text-stone-900">{(selectedRow.alohaPrice || 0).toFixed(2)} EGP</strong>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                    <span className="text-[10px] font-bold text-stone-400 block uppercase">Talabat Gross</span>
                    <strong className="text-sm font-mono text-orange-950">{(selectedRow.talabatPrice || 0).toFixed(2)} EGP</strong>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200">
                    <span className="text-[10px] font-bold text-stone-400 block uppercase">Financial Variance</span>
                    <strong className={`text-sm font-mono ${selectedRow.difference < 0 ? 'text-rose-600' : selectedRow.difference > 0 ? 'text-emerald-600' : 'text-stone-700'}`}>
                      {selectedRow.difference > 0 ? '+' : ''}{(selectedRow.difference || 0).toFixed(2)} EGP
                    </strong>
                  </div>
                </div>

                {selectedRow.rawAlohaOrder?.rawText && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">Raw Receipt Printout:</label>
                    <pre className="p-3 bg-stone-900 text-emerald-400 rounded-2xl font-mono text-[11px] max-h-52 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                      {selectedRow.rawAlohaOrder.rawText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Edit Raw Text & Live Parser */}
            {inspectTab === 'edit_text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Paste or Edit Aloha Check Receipt Text:
                  </label>
                  <textarea
                    rows={8}
                    value={inspectReceiptText}
                    onChange={e => handleParseInspectText(e.target.value)}
                    placeholder="Paste full Aloha check text here..."
                    className="w-full text-xs font-mono p-3 bg-stone-50 border border-stone-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Fast Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectFormData(prev => ({
                        ...prev,
                        alohaPrice: 0,
                        talabatPrice: 0,
                        varianceReason: 'Void Order',
                        customVarianceNote: 'Void Check / Cancelled - 0.00 EGP',
                      }));
                      setInspectSuccessMsg('🚫 Marked as Void Check (0.00 EGP)');
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer"
                  >
                    🚫 Void Check (0.00 EGP)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectFormData(prev => ({
                        ...prev,
                        varianceReason: 'Employee Meal',
                        customVarianceNote: 'Employee Meal Discount',
                      }));
                      setInspectSuccessMsg('🍔 Marked as Employee Meal');
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 rounded-xl cursor-pointer"
                  >
                    🍔 Employee Meal
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const alohaP = Number(inspectFormData.alohaPrice) || Number(selectedRow.alohaPrice) || 0;
                      setInspectFormData(prev => ({
                        ...prev,
                        talabatPrice: alohaP,
                      }));
                      setInspectSuccessMsg(`🎯 Synced Aloha price (${alohaP.toFixed(2)} EGP) to Talabat`);
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-xl cursor-pointer"
                  >
                    🎯 Match Talabat to Aloha Price
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Direct Field Editor */}
            {inspectTab === 'edit_fields' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Check Number #</label>
                    <input
                      type="text"
                      value={inspectFormData.number ?? selectedRow.number}
                      onChange={e => setInspectFormData({ ...inspectFormData, number: e.target.value })}
                      className="w-full text-xs font-mono px-3 py-2 bg-white border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Talabat ID</label>
                    <input
                      type="text"
                      value={inspectFormData.orderId ?? selectedRow.orderId}
                      onChange={e => setInspectFormData({ ...inspectFormData, orderId: e.target.value })}
                      className="w-full text-xs font-mono px-3 py-2 bg-white border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Aloha Price (EGP)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inspectFormData.alohaPrice ?? selectedRow.alohaPrice}
                      onChange={e => setInspectFormData({ ...inspectFormData, alohaPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Talabat Price (EGP)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={inspectFormData.talabatPrice ?? selectedRow.talabatPrice}
                      onChange={e => setInspectFormData({ ...inspectFormData, talabatPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-stone-300 rounded-xl text-orange-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Aloha Tender</label>
                    <select
                      value={inspectFormData.localPayment ?? selectedRow.localPayment}
                      onChange={e => setInspectFormData({ ...inspectFormData, localPayment: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-white border border-stone-300 rounded-xl"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Otlob Mode">Otlob Mode (Online)</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Not in Aloha">Not in Aloha</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Talabat Tender</label>
                    <select
                      value={inspectFormData.talabatMethod ?? selectedRow.talabatMethod}
                      onChange={e => setInspectFormData({ ...inspectFormData, talabatMethod: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-white border border-stone-300 rounded-xl"
                    >
                      <option value="CASH">CASH</option>
                      <option value="ONLINE">ONLINE</option>
                      <option value="—">— (Not in Talabat)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-stone-700 mb-1">Variance Cause</label>
                    <select
                      value={inspectFormData.varianceReason ?? selectedRow.varianceReason ?? ''}
                      onChange={e => setInspectFormData({ ...inspectFormData, varianceReason: e.target.value })}
                      className="w-full text-xs font-bold px-3 py-2 bg-white border border-amber-300 rounded-xl"
                    >
                      {VARIANCE_REASONS.map(vr => (
                        <option key={vr.value} value={vr.value}>
                          {vr.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-stone-700 mb-1">Custom Audit Note</label>
                    <input
                      type="text"
                      value={inspectFormData.customVarianceNote ?? selectedRow.customVarianceNote ?? ''}
                      onChange={e => setInspectFormData({ ...inspectFormData, customVarianceNote: e.target.value })}
                      placeholder="Add custom explanation..."
                      className="w-full text-xs px-3 py-2 bg-white border border-stone-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-stone-200 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={isSavingInspect}
                onClick={handleSaveInspectChanges}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingInspect ? 'Saving...' : 'Save & Update Ledger'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="px-5 py-2.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order & Comparison Form Modal */}
      <OrderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        initialRow={editingRow}
        onSaveComparison={onSaveRow}
      />

      {/* Export PDF Modal (Save As) */}
      <ExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        title="Export Reconciliation Audit (PDF)"
        defaultFileName={`BK_Talabat_Reconciliation_Audit_${new Date().toISOString().slice(0, 10)}`}
        fileExtension="pdf"
        fileBlobGenerator={() =>
          generateReconciliationPDFBlob({
            rows,
            summary,
            excelFileName,
          })
        }
      />

      {/* Export Excel Modal (Save As) */}
      <ExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        title="Export Reconciliation Ledger (Excel)"
        defaultFileName={`BK_Aloha_vs_Talabat_Reconciliation_Report_${new Date().toISOString().slice(0, 10)}`}
        fileExtension="xlsx"
        fileBlobGenerator={() => generateComparisonExcelBlob(rows, summary)}
      />

      {/* Delete Confirmation Modal */}
      {rowToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-xs">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-stone-900 mb-2">
              Confirm Record Deletion
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mb-6 leading-relaxed">
              Are you sure you want to permanently delete this check from the reconciliation ledger?
              <br />
              <span className="inline-block mt-2 font-mono font-bold text-stone-900 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
                Aloha #{rowToDelete.number} ⟷ Talabat #{rowToDelete.orderId}
              </span>
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={confirmDeleteRow}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Yes, Delete Record
              </button>
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
