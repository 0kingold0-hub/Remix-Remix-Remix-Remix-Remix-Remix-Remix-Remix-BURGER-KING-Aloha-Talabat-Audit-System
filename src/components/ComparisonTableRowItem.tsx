import React from 'react';
import { ComparisonRow } from '../types';
import {
  Clock,
  User,
  Laptop,
  ArrowRightLeft,
  Eye,
  Edit2,
  Trash2,
  AlertOctagon,
  Sparkles,
  HelpCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { VARIANCE_REASONS } from './ComparisonTable';

interface ComparisonTableRowItemProps {
  row: ComparisonRow;
  index: number;
  onOpenInspector: (row: ComparisonRow) => void;
  onOpenEdit: (row: ComparisonRow) => void;
  onDelete: (row: ComparisonRow) => void;
  onReasonChange: (row: ComparisonRow, reason: string) => void;
  onNoteChange: (row: ComparisonRow, note: string) => void;
}

export const ComparisonTableRowItem: React.FC<ComparisonTableRowItemProps> = React.memo(
  ({
    row,
    index,
    onOpenInspector,
    onOpenEdit,
    onDelete,
    onReasonChange,
    onNoteChange,
  }) => {
    const alohaAmt = row.alohaAmount !== undefined ? row.alohaAmount : row.alohaPrice;
    const talabatAmt = row.talabatAmount !== undefined ? row.talabatAmount : row.talabatPrice;
    const rawVariance = row.variance !== undefined ? row.variance : row.difference;

    const isZeroAloha =
      row.number === '0' ||
      row.alohaOrderNo === '0' ||
      row.number === '—' ||
      row.isCancelledOrMoe ||
      alohaAmt === 0;

    const isTransferOut =
      isZeroAloha ||
      /transfer/i.test(String(row.varianceReason || '')) ||
      /transfer/i.test(String(row.comment || '')) ||
      /transfer/i.test(String(row.auditNote || '')) ||
      /transfer/i.test(String(row.number || '')) ||
      /transfer/i.test(String(row.orderId || '')) ||
      (alohaAmt === 0 && talabatAmt > 0);

    const isMissingInTalabat =
      row.status === 'missing_in_talabat' || (alohaAmt > 0 && talabatAmt <= 0);
    const isMissingInAloha =
      row.status === 'missing_in_aloha' || (talabatAmt > 0 && alohaAmt <= 0);

    const isDeficit = rawVariance < -0.01;
    const isSurplus = rawVariance > 0.01;
    const isPerfectMatch =
      Math.abs(rawVariance) <= 0.01 &&
      !isMissingInAloha &&
      !isMissingInTalabat &&
      !isTransferOut &&
      !row.isPaymentMismatch;

    // Row styling based on financial status
    let rowBgClass = 'bg-white hover:bg-stone-50/80';
    if (isTransferOut) {
      rowBgClass = 'bg-amber-50/50 hover:bg-amber-100/60';
    } else if (isMissingInTalabat) {
      rowBgClass = 'bg-rose-50/40 hover:bg-rose-100/50';
    } else if (isMissingInAloha) {
      rowBgClass = 'bg-blue-50/40 hover:bg-blue-100/50';
    } else if (isDeficit) {
      rowBgClass = 'bg-red-50/30 hover:bg-red-100/40';
    } else if (isSurplus) {
      rowBgClass = 'bg-emerald-50/30 hover:bg-emerald-100/40';
    } else if (row.isPaymentMismatch) {
      rowBgClass = 'bg-orange-50/30 hover:bg-orange-100/40';
    }

    const rowKey = row.key || row.number || `row-${index}`;

    return (
      <tr key={rowKey} className={`transition-colors border-b border-stone-100 ${rowBgClass}`}>
        {/* Index */}
        <td className="py-2.5 px-3 text-center text-stone-400 font-mono text-xs w-12">
          {index + 1}
        </td>

        {/* 1. Aloha Check Number */}
        <td className="py-2.5 px-3.5 whitespace-nowrap">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-black text-stone-900 text-sm">
                #{row.number || '—'}
              </span>
              {row.matchType === 'fuzzy_id_price' && (
                <span
                  title="Fuzzy matched check number"
                  className="px-1.5 py-0.2 text-[9px] font-bold bg-purple-100 text-purple-800 rounded-md border border-purple-200"
                >
                  Fuzzy
                </span>
              )}
              {row.matchType === 'suggested_match' && (
                <span
                  title="Suggested match based on amount and timestamps"
                  className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-300 flex items-center gap-0.5"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                  Suggested
                </span>
              )}
            </div>
            {row.dayLabel && (
              <span className="text-[10px] text-stone-500 font-mono">
                {row.dayLabel}
              </span>
            )}
          </div>
        </td>

        {/* 2. Talabat Order ID */}
        <td className="py-2.5 px-3.5 whitespace-nowrap">
          <div className="flex flex-col">
            <span
              className={`font-mono text-xs ${
                row.orderId && row.orderId !== '—' && !row.orderId.includes('Missing')
                  ? 'font-bold text-orange-950'
                  : 'text-stone-400 italic'
              }`}
            >
              {row.orderId || '—'}
            </span>
            {row.crossReferenceId && (
              <span className="text-[9px] text-emerald-700 font-semibold flex items-center gap-0.5">
                Ref: #{row.crossReferenceId}
              </span>
            )}
          </div>
        </td>

        {/* 3. Timestamp & Cashier */}
        <td className="py-2.5 px-3.5 whitespace-nowrap">
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-xs text-stone-700 font-mono">
              <Clock className="w-3 h-3 text-stone-400" />
              <span>{row.alohaTime || row.talabatTime || '—'}</span>
            </div>
            {row.alohaHost && (
              <div className="text-[10px] text-stone-500 flex items-center gap-0.5 mt-0.5">
                <User className="w-2.5 h-2.5 text-stone-400" />
                <span>{row.alohaHost}</span>
                {row.alohaTerminal && (
                  <span className="text-stone-400 font-mono">({row.alohaTerminal})</span>
                )}
              </div>
            )}
          </div>
        </td>

        {/* 4. Payment Tenders (Aloha vs Talabat) */}
        <td className="py-2.5 px-3.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                row.localPayment?.toLowerCase().includes('cash') || row.localPayment === 'Cash'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  : row.localPayment && row.localPayment !== '—' && row.localPayment !== 'Not in Aloha'
                  ? 'bg-blue-100 text-blue-900 border border-blue-200'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              {row.localPayment || '—'}
            </span>

            <ArrowRightLeft
              className={`w-3 h-3 ${
                row.isPaymentMismatch ? 'text-rose-500 animate-pulse' : 'text-stone-400'
              }`}
            />

            <span
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                row.talabatMethod?.toUpperCase() === 'CASH'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  : row.talabatMethod && row.talabatMethod !== '—'
                  ? 'bg-orange-100 text-orange-900 border border-orange-200'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              {row.talabatMethod || '—'}
            </span>

            {row.isPaymentMismatch && (
              <span
                title="Tender Mismatch between POS and Talabat Ledger"
                className="px-1.5 py-0.5 text-[9px] font-black bg-rose-100 text-rose-800 rounded-md border border-rose-300"
              >
                Mismatch
              </span>
            )}
          </div>
        </td>

        {/* 5. Aloha AM */}
        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
          <span
            className={`font-mono font-bold text-xs ${
              alohaAmt > 0 ? 'text-stone-900' : 'text-stone-400'
            }`}
          >
            {alohaAmt > 0 ? alohaAmt.toFixed(2) : '0.00'}
          </span>
          <span className="text-[10px] text-stone-400 ml-1">EGP</span>
        </td>

        {/* 6. Talabat AM */}
        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
          <span
            className={`font-mono font-bold text-xs ${
              talabatAmt > 0 ? 'text-orange-950' : 'text-stone-400'
            }`}
          >
            {talabatAmt > 0 ? talabatAmt.toFixed(2) : '0.00'}
          </span>
          <span className="text-[10px] text-stone-400 ml-1">EGP</span>
        </td>

        {/* 7. Variance (Aloha - Talabat) */}
        <td className="py-2.5 px-3.5 text-right whitespace-nowrap bg-stone-50/50">
          <span
            className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded-lg ${
              isPerfectMatch
                ? 'bg-emerald-100 text-emerald-800'
                : isDeficit
                ? 'bg-rose-100 text-rose-800'
                : isSurplus
                ? 'bg-emerald-100 text-emerald-800'
                : 'text-stone-600 bg-stone-100'
            }`}
          >
            {rawVariance > 0.001 ? '+' : ''}
            {rawVariance.toFixed(2)} EGP
          </span>
        </td>

        {/* 8. Notes & Reason */}
        <td className="py-2.5 px-3.5 min-w-[280px]">
          <div className="flex flex-col gap-1">
            <select
              value={row.varianceReason || ''}
              onChange={e => onReasonChange(row, e.target.value)}
              className="w-full text-[11px] bg-white border border-stone-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500 text-stone-800"
            >
              {VARIANCE_REASONS.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Add audit note or explanation..."
              defaultValue={row.customVarianceNote || ''}
              onBlur={e => {
                if (e.target.value !== (row.customVarianceNote || '')) {
                  onNoteChange(row, e.target.value);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full text-[11px] bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-stone-700 placeholder-stone-400 focus:bg-white focus:border-blue-400 focus:outline-none"
            />
          </div>
        </td>

        {/* 9. Actions */}
        <td className="py-2.5 px-2 text-center whitespace-nowrap w-24">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => onOpenInspector(row)}
              className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              title="Inspect Receipt & Breakdown"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onOpenEdit(row)}
              className="p-1.5 text-stone-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
              title="Edit Record"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(row)}
              className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Delete Record"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }
);
