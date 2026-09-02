import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Search,
  Download,
  HelpCircle,
  Table as TableIcon,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { CrossReferenceEntry } from '../types';
import { parseCrossReferenceRows, parseCrossReferenceText, readExcelFile } from '../utils/excel';
import { sampleCrossReferenceEntries, sampleCrossReferenceText } from '../utils/sampleData';

interface CrossReferenceSectionProps {
  entries: CrossReferenceEntry[];
  onUpdateEntries: (entries: CrossReferenceEntry[]) => void;
  onApplyAndReconcile: () => void;
}

export const CrossReferenceSection: React.FC<CrossReferenceSectionProps> = ({
  entries,
  onUpdateEntries,
  onApplyAndReconcile,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'manual'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual row state for quick add
  const [newRow, setNewRow] = useState<Partial<CrossReferenceEntry>>({
    day: 'day 1',
    alohaOrderNo: '',
    alohaAmount: 0,
    discOnBK: 0,
    talabatAmount: 0,
    talabatOrderNo: '',
    discOnTalabat: '0',
    variance: 0,
    paymentMethod: 'cash',
    comment: '',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const rawRows = await readExcelFile(buffer);
      const parsed = parseCrossReferenceRows(rawRows);
      if (parsed.length > 0) {
        onUpdateEntries([...entries, ...parsed]);
      }
    } catch (err) {
      console.error('Error reading cross-reference excel file:', err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleParsePasteText = () => {
    if (!pasteText.trim()) return;
    const parsed = parseCrossReferenceText(pasteText);
    if (parsed.length > 0) {
      onUpdateEntries([...entries, ...parsed]);
      setPasteText('');
      setActiveTab('manual');
    }
  };

  const handleLoadSample = () => {
    onUpdateEntries(sampleCrossReferenceEntries);
  };

  const handleAddManualRow = () => {
    if (!newRow.alohaOrderNo && !newRow.talabatOrderNo && !newRow.alohaAmount && !newRow.talabatAmount) {
      return;
    }
    const alohaAm = Number(newRow.alohaAmount) || 0;
    const talabatAm = Number(newRow.talabatAmount) || 0;
    const calculatedVariance = Number((alohaAm - talabatAm).toFixed(2));

    const entry: CrossReferenceEntry = {
      id: `manual_ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      day: newRow.day || 'day 1',
      alohaOrderNo: newRow.alohaOrderNo || (alohaAm > 0 ? `CHK-${entries.length + 1}` : '0'),
      alohaAmount: alohaAm,
      discOnBK: Number(newRow.discOnBK) || 0,
      talabatAmount: talabatAm,
      talabatOrderNo: newRow.talabatOrderNo || '—',
      discOnTalabat: newRow.discOnTalabat || '0',
      variance: newRow.variance !== undefined && newRow.variance !== 0 ? newRow.variance : calculatedVariance,
      paymentMethod: newRow.paymentMethod || 'cash',
      comment: newRow.comment || 'معتمد يدوياً من فورمة المراجعة',
    };

    onUpdateEntries([...entries, entry]);
    setNewRow({
      day: newRow.day || 'day 1',
      alohaOrderNo: '',
      alohaAmount: 0,
      discOnBK: 0,
      talabatAmount: 0,
      talabatOrderNo: '',
      discOnTalabat: '0',
      variance: 0,
      paymentMethod: 'cash',
      comment: '',
    });
  };

  const handleDeleteEntry = (id: string) => {
    onUpdateEntries(entries.filter(e => e.id !== id));
  };

  const handleClearAll = () => {
    onUpdateEntries([]);
  };

  const filteredEntries = entries.filter(entry => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      entry.alohaOrderNo.toLowerCase().includes(q) ||
      entry.talabatOrderNo.toLowerCase().includes(q) ||
      entry.day?.toLowerCase().includes(q) ||
      entry.paymentMethod?.toLowerCase().includes(q) ||
      entry.comment?.toLowerCase().includes(q)
    );
  });

  return (
    <div id="cross-reference-section" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 p-5 sm:p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-emerald-200 shrink-0 border border-white/10">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold tracking-tight text-white">
                  فورمة المراجعة الثلاثية والربط المرجعي المباشر
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  3-Way Master Reference Form
                </span>
              </div>
              <p className="text-sm text-emerald-100/90 mt-1 leading-relaxed max-w-3xl">
                فورمة المراجعة المعتمدة للربط الدقيق بين شيكات ألوها وأوردرات طلبات (مثل أوردر <span className="font-bold underline text-white">30053 &lt;-&gt; 3731401652</span>). أي أوردر لا يظهر برقم طلبات في ألوها يتم اعتماده ومطابقته فوراً من هذه الفورمة وتنزيله في جدول المقارنة الشامل!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="load-sample-crossref-btn"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold border border-white/20 transition shadow-sm backdrop-blur-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>تحميل فورمة المراجعة النموذجية</span>
            </button>
            {entries.length > 0 && (
              <button
                id="clear-crossref-btn"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 text-xs font-semibold border border-rose-400/30 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تفريغ الفورمة</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs for Input Method */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-6 pt-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button
            id="tab-crossref-upload"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t border-x cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-emerald-700 border-slate-200 -mb-[1px] shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            <span>رفع شيت إكسيل الفورمة (.xlsx / .csv)</span>
          </button>

          <button
            id="tab-crossref-paste"
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t border-x cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-white text-emerald-700 border-slate-200 -mb-[1px] shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <FileText className="w-4 h-4 text-teal-600" />
            <span>نسخ ولصق نصوص الفورمة (Paste Columns)</span>
          </button>

          <button
            id="tab-crossref-manual"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t border-x cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white text-emerald-700 border-slate-200 -mb-[1px] shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <TableIcon className="w-4 h-4 text-cyan-600" />
            <span>إدخال يدوي وتعديل السجلات ({entries.length})</span>
          </button>
        </div>

        {entries.length > 0 && (
          <div className="pb-2">
            <button
              id="apply-crossref-btn"
              onClick={onApplyAndReconcile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition hover:shadow cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تطبيق المراجعة وتحديث جدول المقارنة فوراً ({entries.length} سجل معتمد)</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab Contents */}
      <div className="p-6">
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 transition-all rounded-2xl p-8 text-center cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="crossref-file-input"
              />
              <div className="w-16 h-16 mx-auto bg-emerald-100 group-hover:scale-105 transition-transform text-emerald-600 rounded-2xl flex items-center justify-center mb-3.5 shadow-sm">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                اسحب وأفلت شيت الفورمة هنا أو اضغط للاختيار
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                يدعم ملفات إكسيل التي تحتوي على أعمدة: <code className="bg-emerald-100/70 text-emerald-800 px-1.5 py-0.5 rounded text-[11px] font-mono">day</code>, <code className="bg-emerald-100/70 text-emerald-800 px-1.5 py-0.5 rounded text-[11px] font-mono">Aloha Order No.</code>, <code className="bg-emerald-100/70 text-emerald-800 px-1.5 py-0.5 rounded text-[11px] font-mono">Aloha AM</code>, <code className="bg-emerald-100/70 text-emerald-800 px-1.5 py-0.5 rounded text-[11px] font-mono">Talabat AM</code>, <code className="bg-emerald-100/70 text-emerald-800 px-1.5 py-0.5 rounded text-[11px] font-mono">Talabat order NO.</code>
              </p>
            </div>
          </div>
        )}

        {activeTab === 'paste' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="crossref-paste-textarea" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>الصق بيانات الجدول من الإكسيل مباشرة (Tab/Comma Separated):</span>
              </label>
              <button
                type="button"
                onClick={() => setPasteText(sampleCrossReferenceText)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 underline cursor-pointer"
              >
                إدراج نص توضيحي جاهز
              </button>
            </div>
            <textarea
              id="crossref-paste-textarea"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="day	Aloha Order No.	Aloha AM	Disc. On BK	Talabat AM	Talabat order NO.	Disc. On Talabat	Varince	Cash Or Credit&#10;day 1	30053	1260	0	1200	3731401652	0	60	cash&#10;day 1	30054	450	0	450	3731401660	0	0	credit"
              rows={6}
              className="w-full text-xs font-mono p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-slate-50/50"
            />
            <div className="flex justify-end">
              <button
                id="parse-paste-crossref-btn"
                onClick={handleParsePasteText}
                disabled={!pasteText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تحليل وإضافة السجلات إلى الفورمة</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="space-y-4">
            {/* Quick Add Form Row */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
              <div className="text-xs font-bold text-emerald-900 mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>إضافة سجل جديد يدوياً إلى فورمة المراجعة:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">اليوم / الوردية (day)</label>
                  <input
                    type="text"
                    placeholder="day 1"
                    value={newRow.day || ''}
                    onChange={e => setNewRow({ ...newRow, day: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">رقم ألوها (Aloha No.)</label>
                  <input
                    type="text"
                    placeholder="30053"
                    value={newRow.alohaOrderNo || ''}
                    onChange={e => setNewRow({ ...newRow, alohaOrderNo: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">مبلغ ألوها (Aloha AM)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1260.00"
                    value={newRow.alohaAmount || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      const talabatVal = Number(newRow.talabatAmount) || 0;
                      setNewRow({
                        ...newRow,
                        alohaAmount: val,
                        variance: Number((val - talabatVal).toFixed(2)),
                      });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-blue-700 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">خصم BK (Disc BK)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={newRow.discOnBK || ''}
                    onChange={e => setNewRow({ ...newRow, discOnBK: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">مبلغ طلبات (Talabat AM)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1200.00"
                    value={newRow.talabatAmount || ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      const alohaVal = Number(newRow.alohaAmount) || 0;
                      setNewRow({
                        ...newRow,
                        talabatAmount: val,
                        variance: Number((alohaVal - val).toFixed(2)),
                      });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-orange-700 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">رقم طلبات (Talabat NO.)</label>
                  <input
                    type="text"
                    placeholder="3731401652"
                    value={newRow.talabatOrderNo || ''}
                    onChange={e => setNewRow({ ...newRow, talabatOrderNo: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">خصم طلبات (Disc Talabat)</label>
                  <input
                    type="text"
                    placeholder="0"
                    value={newRow.discOnTalabat || ''}
                    onChange={e => setNewRow({ ...newRow, discOnTalabat: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">الفارق (Variance)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="60.00"
                    value={newRow.variance !== undefined ? newRow.variance : ''}
                    onChange={e => setNewRow({ ...newRow, variance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 text-xs font-bold text-purple-700 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">طريقة الدفع (Payment)</label>
                  <select
                    value={newRow.paymentMethod || 'cash'}
                    onChange={e => setNewRow({ ...newRow, paymentMethod: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  >
                    <option value="cash">cash (كاش)</option>
                    <option value="credit">credit (فيزا/أونلاين)</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    placeholder="ملاحظات توضيحية (مثل: معتمد من مراجعة الفرع)"
                    value={newRow.comment || ''}
                    onChange={e => setNewRow({ ...newRow, comment: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                  />
                </div>
                <button
                  id="add-manual-crossref-row-btn"
                  onClick={handleAddManualRow}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة السجل إلى الفورمة</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Entries Display Table */}
        {entries.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                  سجلات فورمة المراجعة المعتمدة ({entries.length} سجل)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  Active Master Mappings
                </span>
              </div>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث برقم ألوها، طلبات، اليوم..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner max-h-72 overflow-y-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100/90 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5">day</th>
                    <th className="p-2.5">Aloha Order No.</th>
                    <th className="p-2.5">Aloha AM</th>
                    <th className="p-2.5">Disc. On BK</th>
                    <th className="p-2.5">Talabat AM</th>
                    <th className="p-2.5">Talabat order NO.</th>
                    <th className="p-2.5">Disc. On Talabat</th>
                    <th className="p-2.5">Varince</th>
                    <th className="p-2.5">Cash Or Credit</th>
                    <th className="p-2.5">Comment</th>
                    <th className="p-2.5 text-center w-12">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-mono">
                  {filteredEntries.map((entry, idx) => (
                    <tr key={entry.id} className="hover:bg-emerald-50/40 transition">
                      <td className="p-2 text-center text-slate-400 font-sans text-[11px]">{idx + 1}</td>
                      <td className="p-2 font-sans text-slate-700 font-medium">{entry.day}</td>
                      <td className="p-2 font-bold text-blue-700 bg-blue-50/40">{entry.alohaOrderNo}</td>
                      <td className="p-2 font-bold text-slate-900">{entry.alohaAmount.toFixed(2)}</td>
                      <td className="p-2 text-slate-500">{entry.discOnBK || 0}</td>
                      <td className="p-2 font-bold text-orange-700 bg-orange-50/40">{entry.talabatAmount.toFixed(2)}</td>
                      <td className="p-2 font-bold text-slate-900">{entry.talabatOrderNo}</td>
                      <td className="p-2 text-slate-500">{entry.discOnTalabat || '0'}</td>
                      <td className="p-2 font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            entry.variance === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.variance > 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {entry.variance > 0 ? `+${entry.variance.toFixed(2)}` : entry.variance.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-2 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            entry.paymentMethod?.toLowerCase().includes('cash')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {entry.paymentMethod}
                        </span>
                      </td>
                      <td className="p-2 font-sans text-slate-600 max-w-xs truncate">{entry.comment || '—'}</td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="حذف هذا السجل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
