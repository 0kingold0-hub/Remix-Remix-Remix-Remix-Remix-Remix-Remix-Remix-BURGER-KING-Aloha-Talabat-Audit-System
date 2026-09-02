import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Info,
  HelpCircle,
  Receipt,
  FileText,
  Sliders,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { ComparisonRow, DiscrepancyType } from '../types';
import { sampleBurgerKingTalabatReconciliationRows, TalabatAlohaReconciliationItem } from '../utils/sampleData';

interface AiImageReconcilerProps {
  onReconciliationComplete: (rows: ComparisonRow[]) => void;
}

export const AiImageReconciler: React.FC<AiImageReconcilerProps> = ({
  onReconciliationComplete,
}) => {
  const [alohaImage, setAlohaImage] = useState<string | null>(null);
  const [talabatImage, setTalabatImage] = useState<string | null>(null);
  const [alohaFileName, setAlohaFileName] = useState<string>('');
  const [talabatFileName, setTalabatFileName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const alohaInputRef = useRef<HTMLInputElement>(null);
  const talabatInputRef = useRef<HTMLInputElement>(null);

  // Helper to convert File to base64 data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAlohaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setAlohaImage(dataUrl);
      setAlohaFileName(file.name);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg('تعذر قراءة صورة تقرير ألوها. يرجى اختيار ملف صورة صالح.');
    }
  };

  const handleTalabatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setTalabatImage(dataUrl);
      setTalabatFileName(file.name);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg('تعذر قراءة صورة تقرير طلبات. يرجى اختيار ملف صورة صالح.');
    }
  };

  // Convert raw reconciliation items to ComparisonRow format
  const mapItemsToComparisonRows = (items: TalabatAlohaReconciliationItem[]): ComparisonRow[] => {
    return items.map((item, idx) => {
      const isZeroAloha =
        item.alohaOrderNo === '0' ||
        item.alohaOrderNo === '—' ||
        item.alohaAmount === 0 ||
        item.isCancelledOrMoe;

      let status: DiscrepancyType = 'match';
      let statusLabel = 'متطابق';
      let statusSeverity: 'success' | 'warning' | 'danger' | 'info' = 'success';

      if (isZeroAloha) {
        status = 'missing_in_aloha';
        statusLabel = 'أوردر ملغي (M.O.E)';
        statusSeverity = 'danger';
      } else if (item.isDeliveryFeeVariance || (item.variance !== 0 && Math.abs(item.variance) <= 25)) {
        status = item.variance > 0 ? 'surplus' : 'deficit';
        statusLabel = item.isDeliveryFeeVariance ? 'فرق توصيل Serv' : item.variance > 0 ? 'زيادة' : 'عجز';
        statusSeverity = 'warning';
      } else if (item.variance !== 0) {
        status = item.variance > 0 ? 'surplus' : 'deficit';
        statusLabel = item.variance > 0 ? 'زيادة' : 'عجز';
        statusSeverity = 'danger';
      }

      return {
        key: `ai_row_${idx}_${item.talabatOrderNo || item.alohaOrderNo}`,
        number: item.alohaOrderNo || (isZeroAloha ? '0' : `CHK-${idx + 1}`),
        orderId: item.talabatOrderNo || '—',
        alohaPrice: item.alohaAmount,
        talabatPrice: item.talabatAmount,
        difference: item.variance !== undefined ? item.variance : Number((item.alohaAmount - item.talabatAmount).toFixed(2)),
        percentageDiff: item.alohaAmount > 0 ? ((item.alohaAmount - item.talabatAmount) / item.alohaAmount) * 100 : -100,
        localPayment: item.paymentMethod,
        talabatMethod: item.paymentMethod,
        isPaymentMismatch: false,
        alohaTime: item.time,
        talabatTime: item.time,
        status,
        statusLabel,
        statusSeverity,
        auditNote: item.comment,
        source: isZeroAloha ? 'talabat_only' : item.talabatOrderNo === '—' ? 'aloha_only' : 'both',
        customVarianceNote: item.comment,
        varianceReason: isZeroAloha ? 'Cancelled order, but it was processed on Otlob' : item.isDeliveryFeeVariance ? 'Delivery Serv Fee' : '',
        alohaOrderNo: item.alohaOrderNo,
        talabatOrderNo: item.talabatOrderNo,
        time: item.time,
        paymentMethod: item.paymentMethod,
        alohaAmount: item.alohaAmount,
        talabatAmount: item.talabatAmount,
        variance: item.variance !== undefined ? item.variance : Number((item.alohaAmount - item.talabatAmount).toFixed(2)),
        comment: item.comment,
        isCancelledOrMoe: isZeroAloha,
        isDeliveryFeeVariance: item.isDeliveryFeeVariance,
      };
    });
  };

  const handleRunAiExtraction = async () => {
    if (!alohaImage && !talabatImage) {
      setErrorMsg('يرجى رفع صورة تقرير ألوها وصورة تقرير طلبات أولاً.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/ai/reconcile-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alohaImage,
          talabatImage,
          notes,
        }),
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || 'فشلت عملية المطابقة والتحليل الآلي.');
      }

      const rowsData = resJson.data?.rows || [];
      if (rowsData.length === 0) {
        throw new Error('لم يتم العثور على أوردرات في الصورتين المرفوعتين. يرجى التأكد من وضوح الصورة.');
      }

      const formattedRows = mapItemsToComparisonRows(rowsData);
      onReconciliationComplete(formattedRows);
      setSuccessMsg(`تمت المطابقة بنجاح! تم استخراج ومقارنة ${formattedRows.length} أوردر وحساب الفوارق بدقة.`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بمحرك الفحص الآلي.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = () => {
    setErrorMsg(null);
    const sampleRows = mapItemsToComparisonRows(sampleBurgerKingTalabatReconciliationRows);
    onReconciliationComplete(sampleRows);
    setSuccessMsg('تم تحميل نموذج المطابقة المالي المباشر (أوردرات 373... مع حالات Aloha=0 وفروقات التوصيل Serv).');
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-stone-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span>مطابقة صورتي تقريري ألوها وطلبات بالذكاء الاصطناعي (AI OCR)</span>
            </h2>
            <p className="text-xs text-amber-100/90 mt-0.5">
              استخراج أرقام الشيكات، أرقام طلبات (373...)، المبالغ، حساب الفارق (Aloha - Talabat)، وتحديد حالات الإلغاء و(M.O.E)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLoadSample}
          className="px-3.5 py-1.5 bg-amber-400 text-stone-900 hover:bg-amber-300 active:scale-98 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>تحميل نموذج تقريري ألوها وطلبات الجاهز</span>
        </button>
      </div>

      {/* Upload Dropzones */}
      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Aloha POS Report Image Box */}
          <div className="border-2 border-dashed border-stone-300 hover:border-amber-500 transition-all rounded-2xl p-4 sm:p-5 bg-stone-50/50 flex flex-col items-center justify-center text-center relative group">
            <input
              ref={alohaInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAlohaFileChange}
            />

            {alohaImage ? (
              <div className="w-full space-y-3">
                <div className="relative h-44 sm:h-52 rounded-xl overflow-hidden border border-stone-200 bg-stone-900 shadow-xs group/img">
                  <img
                    src={alohaImage}
                    alt="Aloha POS Report Preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-stone-900/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => alohaInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white text-stone-900 rounded-lg text-xs font-bold hover:bg-stone-100 transition-all cursor-pointer"
                    >
                      تغيير الصورة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAlohaImage(null);
                        setAlohaFileName('');
                      }}
                      className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all cursor-pointer"
                      title="حذف الصورة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-600 bg-white px-3 py-2 rounded-xl border border-stone-200">
                  <span className="font-bold flex items-center gap-1.5 text-stone-800 truncate">
                    <Receipt className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    {alohaFileName || 'صورة تقرير ألوها'}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    جاهزة للتحليل ✓
                  </span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => alohaInputRef.current?.click()}
                className="w-full h-44 sm:h-52 flex flex-col items-center justify-center cursor-pointer p-4 rounded-xl transition-colors hover:bg-amber-50/40"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-stone-800 mb-1">
                  1. رفع صورة تقرير نظام ألوها (Aloha POS)
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mb-3">
                  صورة فواتير أو شيكات الكاشير اليومية (Check Numbers & Amounts)
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100/80 px-3 py-1.5 rounded-xl">
                  <Upload className="w-3.5 h-3.5" />
                  اختر ملف أو التقط صورة
                </span>
              </div>
            )}
          </div>

          {/* Talabat Report Image Box */}
          <div className="border-2 border-dashed border-stone-300 hover:border-orange-500 transition-all rounded-2xl p-4 sm:p-5 bg-stone-50/50 flex flex-col items-center justify-center text-center relative group">
            <input
              ref={talabatInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleTalabatFileChange}
            />

            {talabatImage ? (
              <div className="w-full space-y-3">
                <div className="relative h-44 sm:h-52 rounded-xl overflow-hidden border border-stone-200 bg-stone-900 shadow-xs group/img">
                  <img
                    src={talabatImage}
                    alt="Talabat Report Preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-stone-900/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => talabatInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white text-stone-900 rounded-lg text-xs font-bold hover:bg-stone-100 transition-all cursor-pointer"
                    >
                      تغيير الصورة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTalabatImage(null);
                        setTalabatFileName('');
                      }}
                      className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all cursor-pointer"
                      title="حذف الصورة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-600 bg-white px-3 py-2 rounded-xl border border-stone-200">
                  <span className="font-bold flex items-center gap-1.5 text-stone-800 truncate">
                    <FileImage className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    {talabatFileName || 'صورة كشف طلبات'}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    جاهزة للتحليل ✓
                  </span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => talabatInputRef.current?.click()}
                className="w-full h-44 sm:h-52 flex flex-col items-center justify-center cursor-pointer p-4 rounded-xl transition-colors hover:bg-orange-50/40"
              >
                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-800 flex items-center justify-center mb-3 shadow-xs group-hover:scale-105 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-stone-800 mb-1">
                  2. رفع صورة كشف منصة طلبات (Talabat)
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mb-3">
                  صورة كشف البورتال أو الشيت (Talabat Order NO 373... & Amounts)
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-100/80 px-3 py-1.5 rounded-xl">
                  <Upload className="w-3.5 h-3.5" />
                  اختر ملف أو التقط صورة
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Optional Notes Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
          <label className="text-xs font-bold text-stone-700 whitespace-nowrap flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-stone-500" />
            <span>ملاحظات إضافية للمطابقة:</span>
          </label>
          <input
            type="text"
            placeholder="مثال: فرع سيتي ستارز - التدقيق لوردية الصباح فقط - استبعاد رسوم التوصيل..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-stone-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              يقوم النظام بمطابقة أرقام 373...، حساب (Aloha AM - Talabat AM)، وإبراز أوردرات Aloha=0 كفارق سالب.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              disabled={isLoading || (!alohaImage && !talabatImage)}
              onClick={handleRunAiExtraction}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                isLoading || (!alohaImage && !talabatImage)
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed shadow-none'
                  : 'bg-stone-900 hover:bg-stone-800 active:scale-98 shadow-stone-900/20 ring-2 ring-amber-400'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>جاري تحليل ومطابقة التقريرين وفحص الفوارق...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>بدء المطابقة واستخراج جدول المقارنة</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
