import React, { useState, useMemo } from 'react';
import { ParsedOrder } from '../types';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Receipt,
  Bike,
  Banknote,
  CreditCard,
  AlertTriangle,
  ShoppingBag,
  User,
  Clock,
  Calendar,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  Layers,
  Utensils,
} from 'lucide-react';
import { OrderFormModal } from './OrderFormModal';
import { ExportModal } from './ExportModal';
import { generateOrdersExcelBlob } from '../utils/excel';
import { parseDateTimeToTimestamp } from '../utils/parser';

export type AlohaSortField = 'time' | 'number' | 'host' | 'amount' | 'payment' | 'orderType';
export type AlohaSortOrder = 'asc' | 'desc';

interface OrdersTableProps {
  orders: ParsedOrder[];
  onSaveOrder?: (order: Partial<ParsedOrder>, isNew: boolean) => void;
  onDeleteOrder?: (orderId: string) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  onSaveOrder,
  onDeleteOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPill, setFilterPill] = useState<string>('all');
  const [filterHost, setFilterHost] = useState<string>('all');
  const [filterTerminal, setFilterTerminal] = useState<string>('all');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [sortField, setSortField] = useState<AlohaSortField>('time');
  const [sortOrder, setSortOrder] = useState<AlohaSortOrder>('asc');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'aloha_add' | 'aloha_edit'>('aloha_add');
  const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<ParsedOrder | null>(null);

  const handleOpenAdd = () => {
    setEditingOrder(null);
    setModalMode('aloha_add');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (order: ParsedOrder) => {
    setEditingOrder(order);
    setModalMode('aloha_edit');
    setIsModalOpen(true);
  };

  const handleDelete = (order: ParsedOrder) => {
    setOrderToDelete(order);
  };

  const confirmDeleteOrder = () => {
    if (!orderToDelete) return;
    onDeleteOrder?.(orderToDelete.id || orderToDelete.number);
    setOrderToDelete(null);
  };

  const handleSort = (field: AlohaSortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'amount' ? 'desc' : 'asc');
    }
  };

  // Extract unique filter lists from data
  const availableDays = useMemo(() => {
    return Array.from(
      new Set(orders.map(o => o.dayLabel || o.date || o.sourceFileName).filter(Boolean))
    ) as string[];
  }, [orders]);

  const availableHosts = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.host).filter(Boolean))) as string[];
  }, [orders]);

  const availableTerminals = useMemo(() => {
    return Array.from(new Set(orders.map(o => o.terminal).filter(Boolean))) as string[];
  }, [orders]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let cashCount = 0;
    let otlobCount = 0;
    let ccCount = 0;
    let freeDeleCount = 0;
    let duplicateCount = 0;

    orders.forEach(o => {
      const p = (o.payment || '').toLowerCase();
      const t = (o.orderType || '').toLowerCase();

      if (p.includes('cash') || p.includes('كاش')) cashCount++;
      if (p.includes('otlob') || p.includes('أطلب') || t.includes('talabat') || t.includes('delivery') || t.includes('توصيل') || t.includes('طلبات')) otlobCount++;
      if (p.includes('credit') || p.includes('card') || p.includes('فيزا') || p.includes('بطاقة')) ccCount++;
      if (t.includes('free-dele') || t.includes('free dele') || t.includes('freedele') || t.includes('free delivery')) freeDeleCount++;
      if (o.isDuplicate) duplicateCount++;
    });

    return { cashCount, otlobCount, ccCount, freeDeleCount, duplicateCount };
  }, [orders]);

  const filteredAndSortedOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = orders.filter(order => {
      const matchSearch =
        !q ||
        order.number.toLowerCase().includes(q) ||
        order.orderType.toLowerCase().includes(q) ||
        order.payment.toLowerCase().includes(q) ||
        (order.host && order.host.toLowerCase().includes(q)) ||
        (order.hostId && order.hostId.includes(q)) ||
        (order.terminal && order.terminal.toLowerCase().includes(q)) ||
        (order.date && order.date.toLowerCase().includes(q)) ||
        (order.dayLabel && order.dayLabel.toLowerCase().includes(q)) ||
        (order.sourceFileName && order.sourceFileName.toLowerCase().includes(q)) ||
        (order.time && order.time.toLowerCase().includes(q)) ||
        (order.dateTime && order.dateTime.toLowerCase().includes(q)) ||
        (order.storeName && order.storeName.toLowerCase().includes(q));

      const orderDay = order.dayLabel || order.date || order.sourceFileName || '';
      const matchDay = filterDay === 'all' || orderDay === filterDay;
      const matchHost = filterHost === 'all' || order.host === filterHost;
      const matchTerminal = filterTerminal === 'all' || order.terminal === filterTerminal;

      let matchPill = true;
      const p = (order.payment || '').toLowerCase();
      const t = (order.orderType || '').toLowerCase();

      if (filterPill === 'cash') {
        matchPill = p.includes('cash') || p.includes('كاش');
      } else if (filterPill === 'otlob') {
        matchPill = p.includes('otlob') || p.includes('أطلب') || t.includes('talabat') || t.includes('delivery') || t.includes('توصيل') || t.includes('طلبات');
      } else if (filterPill === 'credit') {
        matchPill = p.includes('credit') || p.includes('card') || p.includes('فيزا') || p.includes('بطاقة');
      } else if (filterPill === 'free_dele') {
        matchPill = t.includes('free-dele') || t.includes('free dele') || t.includes('freedele') || t.includes('free delivery');
      } else if (filterPill === 'duplicate') {
        matchPill = Boolean(order.isDuplicate);
      }

      return matchSearch && matchDay && matchHost && matchTerminal && matchPill;
    });

    return filtered.sort((a, b) => {
      let comp = 0;
      if (sortField === 'time') {
        const timeA = parseDateTimeToTimestamp(a.date, a.time, a.dateTime);
        const timeB = parseDateTimeToTimestamp(b.date, b.time, b.dateTime);
        if (timeA !== 0 && timeB !== 0 && timeA !== timeB) {
          comp = timeA - timeB;
        } else {
          // Fallback to check number comparison
          const numA = parseInt(a.number.replace(/\D/g, '') || '0', 10);
          const numB = parseInt(b.number.replace(/\D/g, '') || '0', 10);
          comp = numA - numB;
        }
      } else if (sortField === 'number') {
        const numA = parseInt(a.number.replace(/\D/g, '') || '0', 10);
        const numB = parseInt(b.number.replace(/\D/g, '') || '0', 10);
        comp = numA !== numB ? numA - numB : a.number.localeCompare(b.number);
      } else if (sortField === 'amount') {
        comp = a.amount - b.amount;
      } else if (sortField === 'host') {
        comp = (a.host || '').localeCompare(b.host || '');
      } else if (sortField === 'payment') {
        comp = (a.payment || '').localeCompare(b.payment || '');
      } else if (sortField === 'orderType') {
        comp = (a.orderType || '').localeCompare(b.orderType || '');
      }

      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [orders, searchQuery, filterPill, filterDay, filterHost, filterTerminal, sortField, sortOrder]);

  // Totals for filtered orders
  const filteredMetrics = useMemo(() => {
    let totalAmt = 0;
    let cashAmt = 0;
    let creditAmt = 0;
    let otlobAmt = 0;

    filteredAndSortedOrders.forEach(o => {
      totalAmt += o.amount || 0;
      cashAmt += o.cashAmount || (o.payment === 'Cash' ? o.amount : 0);
      creditAmt += o.creditAmount || (o.payment === 'Credit Card' ? o.amount : 0);
      if (o.payment === 'Otlob Mode') {
        otlobAmt += o.amount || 0;
      }
    });

    return { totalAmt, cashAmt, creditAmt, otlobAmt };
  }, [filteredAndSortedOrders]);

  const copyAlohaSummary = () => {
    const totalAmt = orders.reduce((s, o) => s + (o.amount || 0), 0);
    const cashAmt = orders.filter(o => (o.payment || '').toLowerCase().includes('cash')).reduce((s, o) => s + (o.amount || 0), 0);
    const otlobAmt = orders.filter(o => (o.payment || '').toLowerCase().includes('otlob')).reduce((s, o) => s + (o.amount || 0), 0);
    const ccAmt = orders.filter(o => (o.payment || '').toLowerCase().includes('credit')).reduce((s, o) => s + (o.amount || 0), 0);

    const text = `📋 *Aloha POS Checks Summary*
--------------------------------
🍔 Total Aloha Checks: ${orders.length}
💵 Grand Total Sales: ${totalAmt.toFixed(2)} EGP
--------------------------------
💰 Cash Tender: ${cashAmt.toFixed(2)} EGP (${counts.cashCount} checks)
🛵 Otlob / Talabat: ${otlobAmt.toFixed(2)} EGP (${counts.otlobCount} checks)
💳 Credit Card: ${ccAmt.toFixed(2)} EGP (${counts.ccCount} checks)
${counts.freeDeleCount > 0 ? `🏷️ Free-Dele: ${counts.freeDeleCount} checks` : ''}
${counts.duplicateCount > 0 ? `⚠️ Duplicate Checks: ${counts.duplicateCount} checks` : ''}
--------------------------------
Audited with chronological precision.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    });
  };

  const getPaymentBadge = (payment: string) => {
    switch (payment) {
      case 'Cash':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
            <Banknote className="w-3 h-3" />
            Cash
          </span>
        );
      case 'Otlob Mode':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70">
            <ShoppingBag className="w-3 h-3" />
            Otlob Mode
          </span>
        );
      case 'Credit Card':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
            <CreditCard className="w-3 h-3" />
            Credit Card
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
            {payment}
          </span>
        );
    }
  };

  const getOrderTypeBadge = (type: string) => {
    const lower = (type || '').toLowerCase();
    if (
      lower.includes('free-dele') ||
      lower.includes('free dele') ||
      lower.includes('freedele') ||
      lower.includes('free-deli') ||
      lower.includes('free-delivery') ||
      lower.includes('free delivery')
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200/70 shadow-2xs">
          <Sparkles className="w-3 h-3 text-purple-600" />
          Free-Dele
        </span>
      );
    }
    if (lower.includes('otlob') || lower.includes('أطلب')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
          <ShoppingBag className="w-3 h-3 text-amber-600" />
          Otlob.com
        </span>
      );
    }
    if (
      lower.includes('hd talabat') ||
      lower.includes('talabat') ||
      lower.includes('طلبات') ||
      lower.includes('delivery') ||
      lower.includes('دليفري') ||
      lower.includes('توصيل')
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-[#D71920] border border-orange-200/60">
          <Bike className="w-3 h-3 text-[#D71920]" />
          HD Talabat
        </span>
      );
    }
    if (lower.includes('dine') || lower.includes('صالة')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
          <Utensils className="w-3 h-3" />
          Dine In
        </span>
      );
    }
    if (lower.includes('take') || lower.includes('سفري') || lower.includes('تيك')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <ShoppingBag className="w-3 h-3" />
          Takeout
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200/60">
        {type}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden mb-6">
      {/* Table Header Section */}
      <div className="p-4 sm:p-5 border-b border-stone-200 bg-gradient-to-r from-red-50/40 via-stone-50/60 to-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#D71920]" />
            <h3 className="text-base sm:text-lg font-bold text-stone-900">
              Parsed Aloha Checks Detail Log
            </h3>
            <span className="bg-stone-200/70 text-stone-700 text-xs font-bold px-2.5 py-0.5 rounded-full font-mono">
              {filteredAndSortedOrders.length} of {orders.length}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Includes full Aloha metadata: Host, Date & Time, and Tender Type with inline edit and correction.
          </p>
        </div>

        {/* Action Buttons: Copy Summary, Add Check & Export Excel */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyAlohaSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSummary ? 'Summary Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-all cursor-pointer shadow-sm"
            title="Add manual Aloha check"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Check</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExcelModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl transition-all cursor-pointer shadow-sm shadow-emerald-500/20"
            title="Export Aloha Checks to Excel with Save As"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Aloha (Excel)</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs Bar (Pills + Quick Sort + Search) */}
      <div className="p-3.5 bg-stone-50/80 border-b border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Pill Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterPill('all')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filterPill === 'all'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            All ({orders.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterPill('cash')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filterPill === 'cash'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            <Banknote className="w-3 h-3" />
            <span>Cash ({counts.cashCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterPill('otlob')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filterPill === 'otlob'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
            }`}
          >
            <ShoppingBag className="w-3 h-3" />
            <span>Otlob Mode ({counts.otlobCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterPill('credit')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filterPill === 'credit'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
            }`}
          >
            <CreditCard className="w-3 h-3" />
            <span>Credit Card ({counts.ccCount})</span>
          </button>

          {counts.freeDeleCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterPill('free_dele')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                filterPill === 'free_dele'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Free-Dele ({counts.freeDeleCount})</span>
            </button>
          )}

          {counts.duplicateCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterPill('duplicate')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                filterPill === 'duplicate'
                  ? 'bg-amber-600 text-white shadow-2xs ring-2 ring-amber-400'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Duplicates ({counts.duplicateCount})</span>
            </button>
          )}

          {/* Day Filter Dropdown */}
          {availableDays.length > 1 && (
            <select
              value={filterDay}
              onChange={e => setFilterDay(e.target.value)}
              className="text-xs bg-white border border-stone-300 rounded-xl px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#D71920]/20 text-stone-700 font-bold cursor-pointer"
            >
              <option value="all">All Days ({availableDays.length})</option>
              {availableDays.map(d => (
                <option key={d} value={d}>
                  📅 {d}
                </option>
              ))}
            </select>
          )}

          {/* Host Filter Dropdown */}
          {availableHosts.length > 1 && (
            <select
              value={filterHost}
              onChange={e => setFilterHost(e.target.value)}
              className="text-xs bg-white border border-stone-300 rounded-xl px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#D71920]/20 text-stone-700 font-medium cursor-pointer"
            >
              <option value="all">All Hosts ({availableHosts.length})</option>
              {availableHosts.map(h => (
                <option key={h} value={h}>
                  {h.startsWith('Host:') ? h : `Host: ${h}`}
                </option>
              ))}
            </select>
          )}

          {/* Terminal Filter Dropdown */}
          {availableTerminals.length > 1 && (
            <select
              value={filterTerminal}
              onChange={e => setFilterTerminal(e.target.value)}
              className="text-xs bg-white border border-stone-300 rounded-xl px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#D71920]/20 text-stone-700 font-medium cursor-pointer"
            >
              <option value="all">All Terminals ({availableTerminals.length})</option>
              {availableTerminals.map(t => (
                <option key={t} value={t}>
                  POS: {t}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Quick Sort & Search Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Quick Sort Selector - Prioritizes Time Sorting */}
          <div className="flex items-center gap-1 bg-white border border-stone-300 rounded-xl px-2.5 py-1 text-xs text-stone-700">
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-500" />
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={e => {
                const [f, o] = e.target.value.split('-');
                setSortField(f as AlohaSortField);
                setSortOrder(o as AlohaSortOrder);
              }}
              className="bg-transparent border-none focus:outline-none text-xs font-semibold text-stone-800 cursor-pointer"
            >
              <option value="time-asc">⏰ Order Time (Oldest First)</option>
              <option value="time-desc">⏰ Order Time (Newest First)</option>
              <option value="number-asc">🔢 Check # (Ascending 1 → 9)</option>
              <option value="number-desc">🔢 Check # (Descending 9 → 1)</option>
              <option value="amount-desc">💰 Highest Tender Amount</option>
              <option value="amount-asc">💵 Lowest Tender Amount</option>
              <option value="host-asc">👤 By Host / Cashier</option>
            </select>
          </div>

          <div className="relative w-full sm:w-52">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search check #, host, date..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-3 pl-8 py-1 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D71920]/20 focus:border-[#D71920]"
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-stone-100/80 text-stone-700 font-bold border-b border-stone-200 select-none">
              <th className="py-3 px-3 w-10 text-center">#</th>
              <th
                onClick={() => handleSort('number')}
                className="py-3 px-3 cursor-pointer hover:bg-stone-200/60 transition-colors"
                title="Click to sort by check number"
              >
                <div className="flex items-center gap-1">
                  <span>Aloha Check #</span>
                  {sortField === 'number' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D71920]" /> : <ArrowDown className="w-3 h-3 text-[#D71920]" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('time')}
                className="py-3 px-3 cursor-pointer hover:bg-stone-200/60 transition-colors"
                title="Click to sort by Date & Time"
              >
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#D71920]" />
                  <span className="font-black text-stone-900">Date & Time</span>
                  {sortField === 'time' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#D71920]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#D71920]" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('orderType')}
                className="py-3 px-3 cursor-pointer hover:bg-stone-200/60 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Order Type</span>
                  {sortField === 'orderType' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D71920]" /> : <ArrowDown className="w-3 h-3 text-[#D71920]" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('payment')}
                className="py-3 px-3 cursor-pointer hover:bg-stone-200/60 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Payment Method</span>
                  {sortField === 'payment' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D71920]" /> : <ArrowDown className="w-3 h-3 text-[#D71920]" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('amount')}
                className="py-3 px-3 text-right cursor-pointer hover:bg-stone-200/60 transition-colors"
                title="Click to sort by tender amount"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Tender Amount</span>
                  {sortField === 'amount' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D71920]" /> : <ArrowDown className="w-3 h-3 text-[#D71920]" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-stone-400" />
                  )}
                </div>
              </th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3 text-center w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredAndSortedOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-stone-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Receipt className="w-8 h-8 text-stone-300" />
                    <p className="text-sm font-medium">No checks match the search or filter criteria</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterPill('all');
                        setFilterDay('all');
                        setFilterHost('all');
                        setFilterTerminal('all');
                      }}
                      className="text-xs text-[#D71920] font-bold underline cursor-pointer"
                    >
                      Clear all filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedOrders.map((order, idx) => (
                <tr
                  key={`${order.number}-${order.time || idx}`}
                  className={`transition-colors ${
                    order.isDuplicate
                      ? 'bg-amber-50/40 hover:bg-amber-50/70'
                      : 'hover:bg-amber-50/30'
                  }`}
                >
                  <td className="py-3 px-3 text-center font-semibold text-stone-400 text-xs">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3 font-mono font-black text-stone-900 text-sm">
                    {order.number}
                  </td>
                  <td className="py-3 px-3">
                    {order.date || order.time ? (
                      <div className="flex flex-col font-mono text-xs leading-tight">
                        {order.date && (
                          <span className="font-bold text-stone-900 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-stone-400" />
                            {order.date}
                          </span>
                        )}
                        {order.time && (
                          <span className="text-stone-700 font-bold text-[11px] mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            {order.time}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-stone-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {getOrderTypeBadge(order.orderType)}
                  </td>
                  <td className="py-3 px-3">
                    {getPaymentBadge(order.payment)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-stone-900">
                    {order.amount.toFixed(2)}{' '}
                    <span className="text-[11px] font-normal text-stone-400">EGP</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {order.isDuplicate ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                        Duplicate
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600">
                        Regular
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(order)}
                        className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Check"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(order)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Check"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary Bar */}
      <div className="p-3.5 bg-stone-50/90 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-stone-600">
          <Clock className="w-4 h-4 text-stone-500" />
          <span>
            Sorted by:{' '}
            <strong className="text-stone-900 font-bold">
              {sortField === 'time'
                ? `Order Time (${sortOrder === 'asc' ? 'Oldest to Newest' : 'Newest to Oldest'})`
                : `${sortField} (${sortOrder})`}
            </strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-stone-600">
            Filtered Checks: <strong className="font-mono text-stone-900">{filteredAndSortedOrders.length}</strong>
          </span>
          <span className="text-stone-300">|</span>
          <span className="text-emerald-700">
            Cash: <strong className="font-mono">{filteredMetrics.cashAmt.toFixed(2)} EGP</strong>
          </span>
          <span className="text-stone-300">|</span>
          <span className="text-purple-700">
            Otlob / Delivery: <strong className="font-mono">{filteredMetrics.otlobAmt.toFixed(2)} EGP</strong>
          </span>
          <span className="text-stone-300">|</span>
          <span className="text-stone-900 font-bold">
            Total:{' '}
            <strong className="font-mono text-stone-900 bg-stone-200/80 px-2 py-0.5 rounded-md">
              {filteredMetrics.totalAmt.toFixed(2)} EGP
            </strong>
          </span>
        </div>
      </div>

      {/* Order Form Modal */}
      <OrderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        initialAlohaOrder={editingOrder}
        onSaveAlohaOrder={onSaveOrder}
      />

      {/* Save As Export Modal for Aloha Checks */}
      <ExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        title="Export Aloha Checks to Excel"
        defaultFileName={`BK_Aloha_Checks_Report_${new Date().toISOString().slice(0, 10)}`}
        fileExtension="xlsx"
        fileBlobGenerator={() => generateOrdersExcelBlob(filteredAndSortedOrders)}
      />

      {/* Delete Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-xs">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-stone-900 mb-2">
              Confirm Check Deletion
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 mb-6 leading-relaxed">
              Are you sure you want to permanently delete this check from the Aloha report?
              <br />
              <span className="inline-block mt-2 font-mono font-bold text-stone-900 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
                Aloha Check #{orderToDelete.number} ({orderToDelete.amount.toFixed(2)} EGP - {orderToDelete.payment})
              </span>
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={confirmDeleteOrder}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Yes, Delete Check
              </button>
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
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
