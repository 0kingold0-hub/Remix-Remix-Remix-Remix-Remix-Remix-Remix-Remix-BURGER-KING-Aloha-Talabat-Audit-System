import React, { useState, useEffect } from 'react';
import { ComparisonRow, ParsedOrder } from '../types';
import { VARIANCE_REASONS } from './ComparisonTable';
import { isOnlinePayment } from '../utils/excel';
import { parseSingleAlohaReceiptBlock, ParsedReceiptBreakdown } from '../utils/parser';
import {
  X,
  Save,
  Plus,
  Edit3,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calendar,
  Clock,
  User,
  ShoppingBag,
  Sparkles,
  ArrowRightLeft,
  FileText,
  UploadCloud,
  Check,
  Zap,
} from 'lucide-react';
import { BurgerKingLogo, TalabatLogo } from './BrandLogos';

export interface OrderFormData {
  number: string;
  orderId: string;
  alohaPrice: number | string;
  talabatPrice: number | string;
  localPayment: string;
  talabatMethod: string;
  alohaHost?: string;
  alohaHostId?: string;
  alohaTerminal?: string;
  alohaDate?: string;
  alohaTime?: string;
  talabatDate?: string;
  talabatTime?: string;
  orderType?: string;
  varianceReason?: string;
  customVarianceNote?: string;
  auditNote?: string;
}

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveComparison?: (row: Partial<ComparisonRow>, isNew: boolean) => void;
  onSaveAlohaOrder?: (order: Partial<ParsedOrder>, isNew: boolean) => void;
  initialRow?: ComparisonRow | null;
  initialAlohaOrder?: ParsedOrder | null;
  mode: 'comparison_edit' | 'comparison_add' | 'aloha_edit' | 'aloha_add';
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  onSaveComparison,
  onSaveAlohaOrder,
  initialRow,
  initialAlohaOrder,
  mode,
}) => {
  const isComparison = mode === 'comparison_edit' || mode === 'comparison_add';
  const isNew = mode === 'comparison_add' || mode === 'aloha_add';

  const [activeTab, setActiveTab] = useState<'paste_receipt' | 'form'>(isNew ? 'paste_receipt' : 'form');
  const [rawReceiptText, setRawReceiptText] = useState<string>('');
  const [receiptBreakdown, setReceiptBreakdown] = useState<ParsedReceiptBreakdown | null>(null);
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string>('');

  const [formData, setFormData] = useState<OrderFormData>({
    number: '',
    orderId: '',
    alohaPrice: '',
    talabatPrice: '',
    localPayment: 'Cash',
    talabatMethod: 'CASH',
    alohaHost: '',
    alohaHostId: '',
    alohaTerminal: '',
    alohaDate: '',
    alohaTime: '',
    talabatDate: '',
    talabatTime: '',
    orderType: 'Delivery',
    varianceReason: '',
    customVarianceNote: '',
    auditNote: '',
  });

  useEffect(() => {
    if (initialRow) {
      const defaultAlohaPrice =
        initialRow.alohaPrice !== undefined && initialRow.alohaPrice !== null
          ? initialRow.alohaPrice
          : '';
      const defaultTalabatPrice =
        initialRow.talabatPrice !== undefined && initialRow.talabatPrice !== null
          ? initialRow.talabatPrice
          : '';

      const defaultLocalPayment =
        initialRow.localPayment &&
        initialRow.localPayment !== '—' &&
        initialRow.localPayment.toLowerCase() !== 'not in aloha' &&
        initialRow.localPayment !== 'Unspecified'
          ? initialRow.localPayment
          : initialRow.talabatMethod && isOnlinePayment(initialRow.talabatMethod)
          ? 'Otlob Mode'
          : 'Cash';

      const defaultNumber =
        initialRow.number !== '—' && initialRow.number.toLowerCase() !== 'not in aloha'
          ? initialRow.number
          : initialRow.orderId !== '—' && !initialRow.orderId.includes('Missing')
          ? initialRow.orderId
          : '';

      setFormData({
        number: defaultNumber,
        orderId: initialRow.orderId !== '—' && !initialRow.orderId.includes('Missing') ? initialRow.orderId : '',
        alohaPrice: defaultAlohaPrice,
        talabatPrice: defaultTalabatPrice,
        localPayment: defaultLocalPayment,
        talabatMethod: initialRow.talabatMethod !== '—' ? initialRow.talabatMethod : 'CASH',
        alohaHost: initialRow.alohaHost || '',
        alohaHostId: initialRow.alohaHostId || '',
        alohaTerminal: initialRow.alohaTerminal || '',
        alohaDate: initialRow.alohaDate || '',
        alohaTime: initialRow.alohaTime || '',
        talabatDate: initialRow.talabatDate || '',
        talabatTime: initialRow.talabatTime || '',
        orderType: initialRow.rawAlohaOrder?.orderType || 'Delivery',
        varianceReason: initialRow.varianceReason && !initialRow.varianceReason.includes('معتمد من فورمة') ? initialRow.varianceReason : '',
        customVarianceNote: initialRow.customVarianceNote || (initialRow.comment && !initialRow.comment.includes('معتمد من فورمة') && !initialRow.comment.includes('Exact match') && !initialRow.comment.includes('Matched by') && !initialRow.comment.includes('Order listed in Talabat') ? initialRow.comment : ''),
        auditNote: initialRow.auditNote || '',
      });

      if (initialRow.rawAlohaOrder?.rawText) {
        setRawReceiptText(initialRow.rawAlohaOrder.rawText);
        const parsed = parseSingleAlohaReceiptBlock(initialRow.rawAlohaOrder.rawText);
        setReceiptBreakdown(parsed);
      } else {
        setRawReceiptText('');
        setReceiptBreakdown(null);
      }
      setActiveTab('form');
    } else if (initialAlohaOrder) {
      setFormData({
        number: initialAlohaOrder.number,
        orderId: initialAlohaOrder.authNumber || '',
        alohaPrice: initialAlohaOrder.amount,
        talabatPrice: initialAlohaOrder.amount,
        localPayment: initialAlohaOrder.payment,
        talabatMethod: 'CASH',
        alohaHost: initialAlohaOrder.host || '',
        alohaHostId: initialAlohaOrder.hostId || '',
        alohaTerminal: initialAlohaOrder.terminal || '',
        alohaDate: initialAlohaOrder.date || '',
        alohaTime: initialAlohaOrder.time || '',
        talabatDate: '',
        talabatTime: '',
        orderType: initialAlohaOrder.orderType || 'Delivery',
        varianceReason: '',
        customVarianceNote: '',
        auditNote: '',
      });
      if (initialAlohaOrder.rawText) {
        setRawReceiptText(initialAlohaOrder.rawText);
        const parsed = parseSingleAlohaReceiptBlock(initialAlohaOrder.rawText);
        setReceiptBreakdown(parsed);
      } else {
        setRawReceiptText('');
        setReceiptBreakdown(null);
      }
      setActiveTab('form');
    } else {
      setFormData({
        number: '',
        orderId: '',
        alohaPrice: '',
        talabatPrice: '',
        localPayment: 'Otlob Mode',
        talabatMethod: 'CASH',
        alohaHost: '',
        alohaHostId: '',
        alohaTerminal: '',
        alohaDate: '',
        alohaTime: '',
        talabatDate: '',
        talabatTime: '',
        orderType: 'HD Talabat',
        varianceReason: '',
        customVarianceNote: '',
        auditNote: '',
      });
      setRawReceiptText('');
      setReceiptBreakdown(null);
      setActiveTab('paste_receipt');
    }
  }, [initialRow, initialAlohaOrder, mode, isOpen]);

  if (!isOpen) return null;

  // Process and parse raw receipt text automatically
  const handleReceiptTextChange = (text: string) => {
    setRawReceiptText(text);
    if (!text.trim()) {
      setReceiptBreakdown(null);
      setParseSuccessMsg('');
      return;
    }

    const parsed = parseSingleAlohaReceiptBlock(text);
    if (parsed) {
      setReceiptBreakdown(parsed);

      if (parsed.isVoidOrder) {
        setParseSuccessMsg(
          `🚫 تم الكشف عن شيك فويد ملغي بالكامل (Void Check): شيك #${parsed.checkNumber || '—'} | الإجمالي: 0.00 ج.م`
        );
      } else if (parsed.isEmployeeMeal) {
        setParseSuccessMsg(
          `🍔 تم الكشف عن وجبة موظف (Employee Meal): شيك #${parsed.checkNumber || '—'} | الإجمالي: ${parsed.calculatedTotal.toFixed(2)} ج.م`
        );
      } else {
        setParseSuccessMsg(
          `✅ تم استخراج الفاتورة بنجاح: شيك #${parsed.checkNumber || '—'} | الإجمالي: ${parsed.calculatedTotal.toFixed(2)} ج.م`
        );
      }

      // Auto-populate form fields - Aloha data only. Do NOT auto-populate talabatPrice so missing in talabat orders stay 0 unless user adds it
      setFormData(prev => ({
        ...prev,
        number: parsed.checkNumber || prev.number,
        orderId: parsed.authNumber || prev.orderId,
        alohaPrice: parsed.isVoidOrder ? 0 : parsed.calculatedTotal > 0 ? parsed.calculatedTotal : prev.alohaPrice,
        // Keep talabatPrice as entered by user or empty/0 - do not auto-clone aloha price
        talabatPrice: parsed.isVoidOrder ? 0 : prev.talabatPrice,
        localPayment: parsed.tenderMethod !== 'Unspecified' ? parsed.tenderMethod : prev.localPayment,
        orderType: parsed.orderType || prev.orderType,
        alohaTerminal: parsed.terminal || prev.alohaTerminal,
        alohaTime: parsed.time || prev.alohaTime,
        alohaDate: parsed.date || prev.alohaDate,
        alohaHost: parsed.host || prev.alohaHost,
        alohaHostId: parsed.hostId || prev.alohaHostId,
        varianceReason: parsed.isVoidOrder ? 'Void Order' : parsed.isEmployeeMeal ? 'Employee Meal' : prev.varianceReason,
        customVarianceNote: parsed.isVoidOrder
          ? 'فويد (Void) / شيك ملغي بالكامل - Item Count 0'
          : parsed.isEmployeeMeal
          ? 'وجبة موظف (Employee Meal)'
          : prev.customVarianceNote,
      }));
    }
  };

  // Quick Action Handlers
  const handleMatchTalabatPrice = () => {
    if (formData.alohaPrice !== '') {
      setFormData(prev => ({
        ...prev,
        talabatPrice: prev.alohaPrice,
        varianceReason: '',
        customVarianceNote: '',
      }));
    }
  };

  const handleSetVoidOrder = () => {
    setFormData(prev => ({
      ...prev,
      alohaPrice: 0,
      talabatPrice: prev.talabatPrice || 0,
      varianceReason: 'Void Order',
      customVarianceNote: 'فويد (Void) / شيك ملغي بالكامل - Item Count 0',
    }));
  };

  const handleSetEmployeeMeal = () => {
    setFormData(prev => ({
      ...prev,
      varianceReason: 'Employee Meal',
      customVarianceNote: 'وجبة موظف (Employee Meal) - غير محمل على طلبات',
    }));
  };

  const handleAddDeliveryFee = (fee = 43.86) => {
    const currentAloha = parseFloat(String(formData.alohaPrice)) || 0;
    const newAloha = Number((currentAloha + fee).toFixed(2));
    setFormData(prev => ({
      ...prev,
      alohaPrice: newAloha,
      varianceReason: 'فرق مصاريف توصيل / خدمة (Delivery Serv)',
      customVarianceNote: `تمت إضافة مصاريف التوصيل (+${fee} EGP)`,
    }));
  };

  const handleSetTransferOut = () => {
    setFormData(prev => ({
      ...prev,
      alohaPrice: 0,
      varianceReason: 'Transfer Out / أوردر ملغي محمل على الفرع (M.O.E)',
      customVarianceNote: 'أوردر ملغي محمل على المطعم M.O.E / شيك ألوها = 0',
    }));
  };

  const numAloha = parseFloat(String(formData.alohaPrice)) || 0;
  const numTalabat = parseFloat(String(formData.talabatPrice)) || 0;
  const calculatedDiff = numTalabat - numAloha;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isComparison && onSaveComparison) {
      const trimmedNum = formData.number.trim();
      const trimmedOrderId = formData.orderId.trim();
      const finalNumber =
        trimmedNum && trimmedNum !== '—' && trimmedNum.toLowerCase() !== 'not in aloha'
          ? trimmedNum
          : numAloha > 0
          ? (trimmedOrderId && trimmedOrderId !== '—' && !trimmedOrderId.includes('Missing') ? trimmedOrderId : `CHK-${Math.floor(10000 + Math.random() * 90000)}`)
          : '—';

      const updatedRow: Partial<ComparisonRow> = {
        ...(initialRow || {}),
        number: finalNumber,
        orderId: trimmedOrderId || '—',
        alohaPrice: numAloha,
        talabatPrice: numTalabat,
        localPayment: formData.localPayment,
        talabatMethod: formData.talabatMethod,
        alohaHost: formData.alohaHost?.trim(),
        alohaHostId: formData.alohaHostId?.trim(),
        alohaTerminal: formData.alohaTerminal?.trim(),
        alohaDate: formData.alohaDate?.trim(),
        alohaTime: formData.alohaTime?.trim(),
        talabatDate: formData.talabatDate?.trim(),
        talabatTime: formData.talabatTime?.trim(),
        varianceReason: formData.varianceReason,
        customVarianceNote: formData.customVarianceNote?.trim(),
        comment: (formData.customVarianceNote && formData.customVarianceNote.trim()) ? formData.customVarianceNote.trim() : (formData.varianceReason || initialRow?.comment || ''),
        rawAlohaOrder: rawReceiptText.trim()
          ? {
              ...(initialRow?.rawAlohaOrder || {
                id: `raw-${finalNumber}`,
                number: finalNumber,
                amount: numAloha,
                payment: formData.localPayment as any,
                orderType: formData.orderType || 'HD Talabat',
                isDelivery: true,
              }),
              rawText: rawReceiptText.trim(),
            }
          : initialRow?.rawAlohaOrder,
      };
      onSaveComparison(updatedRow, isNew);
    } else if (onSaveAlohaOrder) {
      const updatedOrder: Partial<ParsedOrder> = {
        ...(initialAlohaOrder || {}),
        id: initialAlohaOrder?.id || `aloha-manual-${Date.now()}`,
        number: formData.number.trim() || '30000',
        orderType: formData.orderType || 'HD Talabat',
        payment: formData.localPayment as any,
        amount: numAloha,
        cashAmount: formData.localPayment === 'Cash' ? numAloha : 0,
        creditAmount: formData.localPayment !== 'Cash' ? numAloha : 0,
        authNumber: formData.orderId.trim() || undefined,
        host: formData.alohaHost?.trim(),
        hostId: formData.alohaHostId?.trim(),
        terminal: formData.alohaTerminal?.trim(),
        date: formData.alohaDate?.trim(),
        time: formData.alohaTime?.trim(),
        dateTime: `${formData.alohaDate || ''} ${formData.alohaTime || ''}`.trim(),
        isDelivery: formData.orderType?.toLowerCase().includes('dele') || formData.orderType?.toLowerCase().includes('deli') || formData.orderType?.toLowerCase().includes('talabat'),
        rawText: rawReceiptText.trim() || initialAlohaOrder?.rawText,
      };
      onSaveAlohaOrder(updatedOrder, isNew);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 relative max-h-[94vh] overflow-y-auto animate-fadeIn">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-stone-100">
          <div className="w-10 h-10 rounded-2xl bg-[#D71920]/10 text-[#D71920] flex items-center justify-center font-bold shadow-2xs">
            {isNew ? <Plus className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
              {isNew
                ? isComparison
                  ? 'إضافة فاتورة / شيك ألوها ومطابقته (Add Receipt & Reconcile)'
                  : 'إضافة شيك ألوها جديد (Add Aloha Check)'
                : isComparison
                ? `تعديل ومطابقة الشيك: #${formData.number || '—'}`
                : `تعديل شيك ألوها: #${formData.number}`}
            </h3>
            <p className="text-xs text-stone-500">
              يمكنك لصق أو رفع نص الفاتورة ليتم ضبط وحساب الأسعار تلقائياً، أو إدخال البيانات يدوياً.
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 mb-4 bg-stone-100/80 p-1 rounded-2xl border border-stone-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('paste_receipt')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'paste_receipt'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-[#D71920]" />
            <span>⚡ مسح ولصق نص الفاتورة (Paste Aloha Receipt)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'form'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            <span>✏️ حقول البيانات والمطابقة (Form Fields)</span>
          </button>
        </div>

        {/* TAB 1: Raw Receipt Scanner & Text Area */}
        {activeTab === 'paste_receipt' && (
          <div className="space-y-3 mb-4 bg-stone-50 p-4 rounded-2xl border border-stone-200/90">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                الصق نص فاتورة ألوها POS هنا (Raw Receipt Text):
              </label>
              {rawReceiptText && (
                <button
                  type="button"
                  onClick={() => handleReceiptTextChange('')}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  مسح النص
                </button>
              )}
            </div>

            <textarea
              rows={5}
              value={rawReceiptText}
              onChange={e => handleReceiptTextChange(e.target.value)}
              placeholder={`الصق نص الفاتورة المباشر من ألوها، مثل:\nHD56\t\t\t\t\t\t\t\t\t\t10:37 PM\n\t\t\t\t\t30056\nOrder Type: HD Talabat\nArea: Delivery\nTwisterFriesKing\t\t122.81\nTower Big King\t\t127.19\nWhopper Sand Chz\t236.84\nItem Count 3\t\t486.84\nHD Talabat Charge\t43.86`}
              className="w-full text-xs font-mono p-3 bg-stone-900 text-emerald-400 placeholder:text-stone-500 rounded-xl border border-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 leading-relaxed"
            />

            {/* Parse Result Summary Banner */}
            {receiptBreakdown && (
              <div
                className={`rounded-xl p-3 text-xs space-y-2 animate-fadeIn border ${
                  receiptBreakdown.isVoidOrder
                    ? 'bg-rose-50/90 border-rose-300 text-rose-950 ring-2 ring-rose-200'
                    : receiptBreakdown.isEmployeeMeal
                    ? 'bg-amber-50/90 border-amber-300 text-amber-950 ring-2 ring-amber-200'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div
                  className={`flex items-center justify-between border-b pb-1.5 ${
                    receiptBreakdown.isVoidOrder
                      ? 'border-rose-200'
                      : receiptBreakdown.isEmployeeMeal
                      ? 'border-amber-200'
                      : 'border-emerald-200/60'
                  }`}
                >
                  <span
                    className={`font-black flex items-center gap-1.5 ${
                      receiptBreakdown.isVoidOrder
                        ? 'text-rose-800'
                        : receiptBreakdown.isEmployeeMeal
                        ? 'text-amber-800'
                        : 'text-emerald-900'
                    }`}
                  >
                    {receiptBreakdown.isVoidOrder ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
                        <span>🚫 تم التعرف على شيك فويد ملغي بالكامل (Void Check):</span>
                      </>
                    ) : receiptBreakdown.isEmployeeMeal ? (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span>🍔 تم التعرف على وجبة موظف (Employee Meal):</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>تم تحليل وتجهيز الفاتورة بنجاح:</span>
                      </>
                    )}
                  </span>
                  <span
                    className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                      receiptBreakdown.isVoidOrder
                        ? 'bg-rose-200 text-rose-900'
                        : receiptBreakdown.isEmployeeMeal
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-emerald-200/80 text-emerald-900'
                    }`}
                  >
                    شيك #{receiptBreakdown.checkNumber || '—'}
                  </span>
                </div>

                {receiptBreakdown.isVoidOrder && (
                  <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200 text-rose-900 text-xs font-bold leading-relaxed">
                    ℹ️ هذا الشيك يحتوي على أصناف ملغية بالكامل (Item Count 0) وإجمالي 0.00 ج.م.
                    يمكنك إما حفظه كشيك فويد مسجل بمبلغ 0.00 EGP أو مسحه وتخطيه تماماً دون إضافته للمطابقة.
                  </div>
                )}

                {/* Items & Charges Breakdown */}
                {receiptBreakdown.items.length > 0 && (
                  <div
                    className={`bg-white/90 p-2.5 rounded-lg border space-y-1 ${
                      receiptBreakdown.isVoidOrder ? 'border-rose-200' : 'border-emerald-200/60'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-stone-600 block mb-1">
                      📋 تفاصيل الأصناف المستخرجة ({receiptBreakdown.items.length} أسطر):
                    </span>
                    <div className="max-h-28 overflow-y-auto space-y-0.5 pr-1">
                      {receiptBreakdown.items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex justify-between items-center text-[11px] font-mono ${
                            item.isVoid || item.name.toLowerCase().includes('(void)')
                              ? 'text-rose-600 line-through opacity-85'
                              : 'text-stone-700'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {(item.isVoid || item.name.toLowerCase().includes('(void)')) && (
                              <span className="text-[9px] font-sans font-bold bg-rose-100 text-rose-700 px-1 rounded no-underline">
                                VOID
                              </span>
                            )}
                            {item.name}
                          </span>
                          <span className="font-bold">{item.price.toFixed(2)} EGP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Financial Totals Row */}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                  <div className="bg-white/80 p-1.5 rounded border border-stone-200">
                    <span className="text-stone-500 block text-[10px]">مجموع الأصناف:</span>
                    <span className="font-mono font-bold text-stone-800">
                      {receiptBreakdown.subtotal.toFixed(2)} EGP
                    </span>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded border border-stone-200">
                    <span className="text-stone-500 block text-[10px]">خدمة التوصيل:</span>
                    <span className="font-mono font-bold text-orange-600">
                      +{receiptBreakdown.deliveryCharge.toFixed(2)} EGP
                    </span>
                  </div>
                  <div
                    className={`p-1.5 rounded shadow-xs text-white ${
                      receiptBreakdown.isVoidOrder ? 'bg-rose-700' : 'bg-emerald-600'
                    }`}
                  >
                    <span className="block text-[10px] opacity-90">
                      {receiptBreakdown.isVoidOrder ? 'إجمالي الفويد (Void):' : 'إجمالي ألوها المحسوب:'}
                    </span>
                    <span className="font-mono font-black text-xs">
                      {receiptBreakdown.calculatedTotal.toFixed(2)} EGP
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 gap-2">
                  {receiptBreakdown.isVoidOrder ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRawReceiptText('');
                          setReceiptBreakdown(null);
                          setParseSuccessMsg('🗑️ تم تخطي الشيك الملغي');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        <span>🗑️ تخطي وعدم إضافة الفاتورة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleSetVoidOrder();
                          setActiveTab('form');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                      >
                        <span>🚫 حفظ وتأكيد كشيك فويد (0.00 EGP) ➔</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('form')}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs mr-auto"
                    >
                      <span>الانتقال لمراجعة وتأكيد المطابقة ➔</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Top Identifier Row (Check # & Talabat Order ID) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-stone-50/80 p-3 rounded-2xl border border-stone-200">
              <label className="block text-xs font-bold text-[#502314] mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BurgerKingLogo size="sm" />
                  رقم شيك ألوها Aloha Check #
                </span>
                {formData.number && (
                  <span className="text-[10px] font-mono font-bold text-stone-500">#{formData.number}</span>
                )}
              </label>
              <input
                type="text"
                required={!isComparison}
                placeholder="e.g. 30056"
                value={formData.number}
                onChange={e => setFormData({ ...formData, number: e.target.value })}
                className="w-full text-sm font-mono font-bold px-3 py-2 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-stone-900"
              />
            </div>

            <div className="bg-orange-50/50 p-3 rounded-2xl border border-orange-200/80">
              <label className="block text-xs font-bold text-[#FF5A00] mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <TalabatLogo size="sm" />
                  رقم طلبات Talabat Order ID
                </span>
                {formData.orderId && (
                  <span className="text-[10px] font-mono font-bold text-orange-600">{formData.orderId}</span>
                )}
              </label>
              <input
                type="text"
                placeholder="e.g. 3730109858"
                value={formData.orderId}
                onChange={e => setFormData({ ...formData, orderId: e.target.value })}
                className="w-full text-sm font-mono font-bold px-3 py-2 bg-white border border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900"
              />
            </div>
          </div>

          {/* Pricing & Amounts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-200/70">
              <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                  إجمالي شيك ألوها Aloha Total (EGP)
                </span>
                {receiptBreakdown && (
                  <span className="text-[10px] text-blue-600 font-bold">محسوب من الفاتورة</span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.alohaPrice}
                onChange={e => setFormData({ ...formData, alohaPrice: e.target.value })}
                className="w-full text-sm font-mono font-black px-3 py-2 bg-white border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-blue-950"
              />
            </div>

            {isComparison && (
              <div className="bg-orange-50/40 p-3 rounded-2xl border border-orange-200/70">
                <label className="block text-xs font-bold text-orange-950 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-orange-500" />
                    إجمالي طلبات Talabat Total (EGP)
                  </span>
                  {formData.alohaPrice !== '' && Number(formData.talabatPrice) !== Number(formData.alohaPrice) && (
                    <button
                      type="button"
                      onClick={handleMatchTalabatPrice}
                      className="text-[10px] font-bold text-orange-700 hover:underline cursor-pointer"
                      title="مساواة سعر طلبات بسعر ألوها للحصول على مطابقة 0.00"
                    >
                      ⚡ مطابقة السعر ({Number(formData.alohaPrice).toFixed(2)})
                    </button>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.talabatPrice}
                  onChange={e => setFormData({ ...formData, talabatPrice: e.target.value })}
                  className="w-full text-sm font-mono font-black px-3 py-2 bg-white border border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-orange-950"
                />
              </div>
            )}
          </div>

          {/* Quick Adjustment Shortcuts */}
          {isComparison && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-stone-500 ml-1">تعديل سريع:</span>
              <button
                type="button"
                onClick={handleMatchTalabatPrice}
                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer transition-all"
              >
                🎯 مطابقة السعر مع طلبات (0.00 Diff)
              </button>
              <button
                type="button"
                onClick={handleSetVoidOrder}
                className="px-2.5 py-1 text-[11px] font-black bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300 rounded-lg cursor-pointer transition-all"
              >
                🚫 فويد / شيك ملغي (0.00 EGP)
              </button>
              <button
                type="button"
                onClick={handleSetEmployeeMeal}
                className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-lg cursor-pointer transition-all"
              >
                🍔 وجبة موظف (Employee Meal)
              </button>
              <button
                type="button"
                onClick={() => handleAddDeliveryFee(43.86)}
                className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition-all"
              >
                🛵 + مصاريف التوصيل (+43.86 EGP)
              </button>
              <button
                type="button"
                onClick={handleSetTransferOut}
                className="px-2.5 py-1 text-[11px] font-black bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300 rounded-lg cursor-pointer transition-all"
              >
                🚨 Transfer Out / M.O.E
              </button>
            </div>
          )}

          {/* Payment Method Selector Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                طريقة الدفع في ألوها (Aloha Tender)
              </label>
              <select
                value={formData.localPayment}
                onChange={e => setFormData({ ...formData, localPayment: e.target.value })}
                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-stone-800 cursor-pointer"
              >
                <option value="Otlob Mode">🛵 Otlob Mode (Online / Talabat)</option>
                <option value="Cash">💵 Cash (كاش)</option>
                <option value="Credit Card">💳 Credit Card (Visa / Mastercard)</option>
                <option value="Unspecified">Unspecified</option>
              </select>
            </div>

            {isComparison ? (
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  طريقة الدفع في طلبات (Talabat Tender)
                </label>
                <select
                  value={formData.talabatMethod}
                  onChange={e => setFormData({ ...formData, talabatMethod: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-800 cursor-pointer"
                >
                  <option value="CASH">💵 CASH</option>
                  <option value="ONLINE">🌐 ONLINE</option>
                  <option value="CARD">💳 CARD / VISA</option>
                  <option value="PREPAID">🏷️ PREPAID</option>
                  <option value="—">Not Specified (—)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  نوع الأوردر Order Type
                </label>
                <select
                  value={formData.orderType}
                  onChange={e => setFormData({ ...formData, orderType: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-stone-800 cursor-pointer"
                >
                  <option value="HD Talabat">🛵 HD Talabat (Delivery)</option>
                  <option value="Otlob.com">📱 Otlob.com</option>
                  <option value="Free-Dele">🎁 Free-Dele</option>
                  <option value="Dine In">🍽️ Dine In</option>
                  <option value="Takeaway">🛍️ Takeaway</option>
                </select>
              </div>
            )}
          </div>

          {/* Cashier Host & Terminal Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-stone-400" />
                الكاشير Cashier (Host)
              </label>
              <input
                type="text"
                placeholder="e.g. Ahmed"
                value={formData.alohaHost}
                onChange={e => setFormData({ ...formData, alohaHost: e.target.value })}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                رقم الكاشير Host ID
              </label>
              <input
                type="text"
                placeholder="e.g. 104"
                value={formData.alohaHostId}
                onChange={e => setFormData({ ...formData, alohaHostId: e.target.value })}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                نقطة البيع Terminal
              </label>
              <input
                type="text"
                placeholder="e.g. HD56"
                value={formData.alohaTerminal}
                onChange={e => setFormData({ ...formData, alohaTerminal: e.target.value })}
                className="w-full text-xs font-mono font-bold px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-800"
              />
            </div>
          </div>

          {/* Date & Time fields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-stone-400" />
                تاريخ ألوها
              </label>
              <input
                type="text"
                placeholder="DD/MM/YYYY"
                value={formData.alohaDate}
                onChange={e => setFormData({ ...formData, alohaDate: e.target.value })}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-stone-400" />
                توقيت ألوها
              </label>
              <input
                type="text"
                placeholder="10:37 PM"
                value={formData.alohaTime}
                onChange={e => setFormData({ ...formData, alohaTime: e.target.value })}
                className="w-full text-xs px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-800 font-mono"
              />
            </div>

            {isComparison && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-orange-400" />
                    تاريخ طلبات
                  </label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={formData.talabatDate}
                    onChange={e => setFormData({ ...formData, talabatDate: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-orange-400" />
                    توقيت طلبات
                  </label>
                  <input
                    type="text"
                    placeholder="10:37 PM"
                    value={formData.talabatTime}
                    onChange={e => setFormData({ ...formData, talabatTime: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-stone-800 font-mono"
                  />
                </div>
              </>
            )}
          </div>

          {/* Variance Reason & Custom Note (Only for comparison mode) */}
          {isComparison && (
            <div className={`p-3.5 rounded-2xl border transition-all ${formData.varianceReason || formData.customVarianceNote ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-400/40 shadow-xs' : 'bg-amber-50/70 border-amber-200'}`}>
              <label className="block text-xs font-black text-amber-950 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  سبب الفارق / الملاحظة المحاسبية (Variance Cause):
                </span>
                {(formData.varianceReason || formData.customVarianceNote) && (
                  <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500 text-white rounded-md">
                    📝 Active Note
                  </span>
                )}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={formData.varianceReason || ''}
                  onChange={e => setFormData({ ...formData, varianceReason: e.target.value })}
                  className={`text-xs p-2 rounded-xl border font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer transition-all ${
                    formData.varianceReason
                      ? 'bg-amber-200 border-amber-500 shadow-xs ring-1 ring-amber-400/50'
                      : 'border-amber-300 bg-white'
                  }`}
                >
                  {VARIANCE_REASONS.map(vr => (
                    <option key={vr.value} value={vr.value}>
                      {vr.label}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="ملاحظة مخصصة لتقرير التدقيق والشركة..."
                    value={formData.customVarianceNote || ''}
                    onChange={e => setFormData({ ...formData, customVarianceNote: e.target.value })}
                    className={`text-xs p-2 rounded-xl border w-full focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
                      formData.customVarianceNote
                        ? 'bg-amber-200/95 text-amber-950 font-black border-amber-500 ring-1 ring-amber-400/50 placeholder:text-amber-700'
                        : 'border-amber-300 bg-white text-stone-800'
                    }`}
                  />
                  {formData.customVarianceNote && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-700 text-xs pointer-events-none font-bold">
                      📌
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live Calculated Variance Banner */}
          {isComparison && (numAloha > 0 || numTalabat > 0) && (
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-stone-700 block">فارق المطابقة المحسوب (Variance):</span>
                <span className="text-[11px] text-stone-500 font-mono">
                  طلبات ({numTalabat.toFixed(2)}) - ألوها ({numAloha.toFixed(2)}) = {calculatedDiff.toFixed(2)} EGP
                </span>
              </div>

              <span
                className={`font-mono font-black text-sm px-3 py-1 rounded-xl shadow-2xs ${
                  Math.abs(calculatedDiff) <= 0.01
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : calculatedDiff < 0
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                }`}
              >
                {Math.abs(calculatedDiff) <= 0.01
                  ? '🎯 متطابق تماماً Exact Match (0.00 EGP)'
                  : `${calculatedDiff > 0 ? '+' : ''}${calculatedDiff.toFixed(2)} EGP`}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
            >
              إلغاء Cancel
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl transition-all cursor-pointer shadow-sm shadow-emerald-600/30"
            >
              <Save className="w-4 h-4" />
              <span>حفظ وإعادة الحساب (Save & Recalculate)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
