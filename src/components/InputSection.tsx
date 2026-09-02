import React, { useRef, useState } from 'react';
import {
  Upload,
  Sparkles,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  FileCheck,
  Calendar,
  CalendarDays,
  Plus,
  Trash2,
  FileText,
  Layers,
  X,
  AlertCircle,
  HelpCircle,
  Camera,
  Table as TableIcon,
  Link2,
  ExternalLink,
  Banknote,
} from 'lucide-react';
import { BurgerKingLogo, TalabatLogo } from './BrandLogos';
import { AuditMode, ComparisonRow, CrossReferenceEntry, DailyFileEntry } from '../types';
import { AiImageReconciler } from './AiImageReconciler';
import { CrossReferenceSection } from './CrossReferenceSection';

interface InputSectionProps {
  auditMode: AuditMode;
  setAuditMode: (mode: AuditMode) => void;
  inputText?: string;
  setInputText?: (val: string) => void;
  onCalculate: () => void;
  onTextFileUpload: (file: File) => void;
  onMultipleTextFilesUpload: (files: File[]) => void;
  onAddDailyText: (dayName: string, text: string) => void;
  dailyFiles: DailyFileEntry[];
  onRemoveDailyFile: (id: string) => void;
  onClearAllDailyFiles: () => void;
  onExcelFileUpload: (file: File) => void;
  onLoadSample: () => void;
  onDownloadExcel: () => void;
  hasResults: boolean;
  excelFileName?: string;
  textFileName?: string;
  onAiReconciliationComplete?: (rows: ComparisonRow[]) => void;
  // 3-Way Cross Reference Master Form Props
  crossReferenceEntries?: CrossReferenceEntry[];
  onUpdateCrossReferenceEntries?: (entries: CrossReferenceEntry[]) => void;
  onCrossReferenceFileUpload?: (file: File) => void;
  crossRefFileName?: string;
  onApplyCrossReference?: () => void;
}

export const InputSection: React.FC<InputSectionProps> = ({
  auditMode,
  setAuditMode,
  onTextFileUpload,
  onMultipleTextFilesUpload,
  onAddDailyText,
  dailyFiles,
  onRemoveDailyFile,
  onClearAllDailyFiles,
  onExcelFileUpload,
  onLoadSample,
  onDownloadExcel,
  hasResults,
  excelFileName,
  textFileName,
  onAiReconciliationComplete,
  crossReferenceEntries = [],
  onUpdateCrossReferenceEntries = () => {},
  onCrossReferenceFileUpload,
  crossRefFileName = '',
  onApplyCrossReference = () => {},
}) => {
  const singleTextFileInputRef = useRef<HTMLInputElement>(null);
  const multiTextFileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const crossRefFileInputRef = useRef<HTMLInputElement>(null);

  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isDraggingCrossRef, setIsDraggingCrossRef] = useState(false);

  // Paste Text Drawer/Modal state for Monthly Mode
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteDayName, setPasteDayName] = useState('');
  const [pasteDayContent, setPasteDayContent] = useState('');
  const [pasteError, setPasteError] = useState('');

  // Daily mode single file handlers
  const handleSingleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onTextFileUpload(file);
    }
    e.target.value = '';
  };

  // Monthly mode multi-files handlers
  const handleMultiTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onMultipleTextFilesUpload(Array.from(files));
    }
    e.target.value = '';
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onExcelFileUpload(file);
    }
    e.target.value = '';
  };

  const handleCrossRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onCrossReferenceFileUpload) {
      onCrossReferenceFileUpload(file);
    }
    e.target.value = '';
  };

  const handleTextDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingText(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    if (auditMode === 'monthly') {
      onMultipleTextFilesUpload(files);
    } else {
      onTextFileUpload(files[0]);
    }
  };

  const handleExcelDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingExcel(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onExcelFileUpload(file);
    }
  };

  const handleCrossRefDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCrossRef(false);
    const file = e.dataTransfer.files?.[0];
    if (file && onCrossReferenceFileUpload) {
      onCrossReferenceFileUpload(file);
    }
  };

  const handleSavePastedText = () => {
    if (!pasteDayContent.trim()) {
      setPasteError('Please enter Aloha POS text content.');
      return;
    }
    const dayLabel = pasteDayName.trim() || `Day_${dailyFiles.length + 1}_Text`;
    onAddDailyText(dayLabel, pasteDayContent);
    setPasteDayName('');
    setPasteDayContent('');
    setPasteError('');
    setIsPasteModalOpen(false);
  };

  // If AI Image mode is active, render the dedicated AI OCR Reconciler
  if (auditMode === 'ai_image') {
    return (
      <div className="space-y-4 mb-6">
        {/* Top Auditing Mode Selector Tabs */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-100/90 rounded-2xl border border-stone-200">
            <button
              type="button"
              id="audit-mode-ai-btn"
              onClick={() => setAuditMode('ai_image')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 text-white shadow-xs cursor-pointer"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>AI OCR Report Comparison</span>
            </button>

            <button
              type="button"
              id="audit-mode-daily-btn"
              onClick={() => setAuditMode('daily')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-stone-500" />
              <span>Daily Audit (File/Text)</span>
            </button>

            <button
              type="button"
              id="audit-mode-monthly-btn"
              onClick={() => setAuditMode('monthly')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 transition-all cursor-pointer"
            >
              <CalendarDays className="w-4 h-4 text-stone-500" />
              <span>Monthly Batch Audit</span>
            </button>

            <button
              type="button"
              id="audit-mode-crossref-btn"
              onClick={() => setAuditMode('cross_reference')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-emerald-800 hover:bg-emerald-100/80 transition-all cursor-pointer"
            >
              <TableIcon className="w-4 h-4 text-emerald-600" />
              <span>3-Way Cross Reference Form ({crossReferenceEntries.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/70 rounded-xl transition-all cursor-pointer shadow-2xs self-end sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Load Sample Data</span>
          </button>
        </div>

        {/* AI OCR Image Reconciler Component */}
        <AiImageReconciler
          onReconciliationComplete={rows => {
            if (onAiReconciliationComplete) {
              onAiReconciliationComplete(rows);
            }
          }}
        />
      </div>
    );
  }

  // If Cross-Reference mode is active, render the dedicated 3-Way Cross-Reference Section
  if (auditMode === 'cross_reference') {
    return (
      <div className="space-y-4 mb-6">
        {/* Top Auditing Mode Selector Tabs */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-100/90 rounded-2xl border border-stone-200">
            <button
              type="button"
              id="audit-mode-crossref-tab-btn"
              onClick={() => setAuditMode('cross_reference')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-700 text-white shadow-xs cursor-pointer"
            >
              <TableIcon className="w-4 h-4 text-white" />
              <span>3-Way Cross Reference Form ({crossReferenceEntries.length})</span>
            </button>

            <button
              type="button"
              id="audit-mode-daily-btn"
              onClick={() => setAuditMode('daily')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-stone-500" />
              <span>Daily Audit</span>
            </button>

            <button
              type="button"
              id="audit-mode-monthly-btn"
              onClick={() => setAuditMode('monthly')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 transition-all cursor-pointer"
            >
              <CalendarDays className="w-4 h-4 text-stone-500" />
              <span>Monthly Batch Audit</span>
            </button>

            <button
              type="button"
              id="audit-mode-ai-tab-btn"
              onClick={() => setAuditMode('ai_image')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-amber-900 bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-amber-700" />
              <span>AI OCR Report Comparison</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/70 rounded-xl transition-all cursor-pointer shadow-2xs self-end sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Load Sample Cross Reference</span>
          </button>
        </div>

        {/* Dedicated 3-Way Cross-Reference Section */}
        <CrossReferenceSection
          entries={crossReferenceEntries}
          onUpdateEntries={onUpdateCrossReferenceEntries}
          onApplyAndReconcile={onApplyCrossReference}
        />
      </div>
    );
  }

  // Aggregate stats for Monthly mode daily files
  const totalMonthlyOrders = dailyFiles.reduce((sum, d) => sum + d.orderCount, 0);
  const totalMonthlyAmount = dailyFiles.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalMonthlyCash = dailyFiles.reduce((sum, d) => sum + d.cashAmount, 0);
  const totalMonthlyCredit = dailyFiles.reduce((sum, d) => sum + d.creditAmount, 0);

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-stone-200 mb-6">
      {/* Top Auditing Mode Selector Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-5 mb-5 border-b border-stone-100">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-100/90 rounded-2xl border border-stone-200">
          <button
            type="button"
            id="audit-mode-daily-btn"
            onClick={() => setAuditMode('daily')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              auditMode === 'daily'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <Calendar className={`w-4 h-4 ${auditMode === 'daily' ? 'text-[#D71920]' : 'text-stone-500'}`} />
            <span>Daily Audit</span>
          </button>

          <button
            type="button"
            id="audit-mode-monthly-btn"
            onClick={() => setAuditMode('monthly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              auditMode === 'monthly'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
            }`}
          >
            <CalendarDays className={`w-4 h-4 ${auditMode === 'monthly' ? 'text-blue-600' : 'text-stone-500'}`} />
            <span>Monthly Batch Audit</span>
            {dailyFiles.length > 0 && auditMode === 'monthly' && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                {dailyFiles.length} Days
              </span>
            )}
          </button>

          <button
            type="button"
            id="audit-mode-crossref-btn"
            onClick={() => setAuditMode('cross_reference')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200 transition-all cursor-pointer"
          >
            <TableIcon className="w-4 h-4 text-emerald-600" />
            <span>3-Way Cross Reference Form</span>
            {crossReferenceEntries.length > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-200 text-emerald-900">
                {crossReferenceEntries.length} entries
              </span>
            )}
          </button>

          <button
            type="button"
            id="audit-mode-ai-tab-btn"
            onClick={() => setAuditMode('ai_image')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4 text-amber-700" />
            <span>Smart OCR Scanner</span>
          </button>
        </div>

        {/* Load Sample Files Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/70 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Load Sample ({auditMode === 'monthly' ? 'Monthly' : 'Daily'})</span>
          </button>
        </div>
      </div>

      {/* Mode Sub-Header Information */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${auditMode === 'monthly' ? 'bg-blue-600' : 'bg-[#D71920]'}`} />
            {auditMode === 'monthly'
              ? 'Monthly Batch Audit (Multiple Aloha Files + Monthly Talabat Ledger)'
              : 'Daily Audit (Aloha POS Shift Report + Talabat Ledger)'}
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Direct financial reconciliation between Aloha POS checks (.txt) and Talabat settlement ledger (.xlsx) with detailed cash, credit, and variance tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-stone-700 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 shrink-0">
          <Banknote className="w-4 h-4 text-emerald-600" />
          <span>Real-time Cash & Credit Reconciliation</span>
        </div>
      </div>

      {/* 2-WAY PRIMARY FILE UPLOAD GRID (ALOHA TXT + TALABAT EXCEL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. LEFT COLUMN: ALOHA POS (DAILY OR MONTHLY MULTI-FILE) */}
        {auditMode === 'daily' ? (
          /* DAILY SINGLE FILE UPLOAD */
          <div
            onClick={() => singleTextFileInputRef.current?.click()}
            onDragOver={e => {
              e.preventDefault();
              setIsDraggingText(true);
            }}
            onDragLeave={() => setIsDraggingText(false)}
            onDrop={handleTextDrop}
            className={`group relative border-2 border-dashed rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all min-h-[160px] ${
              isDraggingText
                ? 'border-[#D71920] bg-red-50/50 ring-2 ring-red-200'
                : textFileName
                ? 'border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50/60'
                : 'border-stone-200 hover:border-red-300 hover:bg-red-50/20 bg-stone-50/50'
            }`}
          >
            <input
              ref={singleTextFileInputRef}
              type="file"
              accept=".txt,text/plain,.log,.csv"
              className="hidden"
              onChange={handleSingleTextFileChange}
            />

            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <BurgerKingLogo size="md" className="ring-1 ring-stone-200 shadow-2xs" />
                </div>
                <div>
                  <div className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <span>1. Aloha POS Checks File (.txt)</span>
                    {textFileName && <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Cashier Shift Report & Check Details
                  </p>
                </div>
              </div>

              {textFileName ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                  <FileCheck className="w-3.5 h-3.5" />
                  Loaded
                </span>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-400 group-hover:text-red-500 group-hover:border-red-200 transition-colors shadow-2xs">
                  <Upload className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-200/60 text-xs text-stone-600">
              <span className="font-semibold truncate max-w-[220px]">
                {textFileName ? `📄 ${textFileName}` : 'Click or drop Aloha (.txt) file here'}
              </span>
              <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                {textFileName ? 'Replace File' : '.TXT / .LOG'}
              </span>
            </div>
          </div>
        ) : (
          /* MONTHLY MULTI-FILE UPLOAD CONTAINER */
          <div className="flex flex-col justify-between border-2 border-stone-200 rounded-2xl p-5 bg-stone-50/50 min-h-[160px]">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <BurgerKingLogo size="md" className="ring-1 ring-stone-200 shadow-2xs" />
                </div>
                <div>
                  <div className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <span>1. Monthly Aloha Shift Files (.txt)</span>
                    {dailyFiles.length > 0 && <CheckCircle2 className="w-4 h-4 text-blue-600 inline" />}
                  </div>
                  <p className="text-xs text-stone-500">
                    Aloha POS files for all days of the month
                  </p>
                </div>
              </div>

              {dailyFiles.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllDailyFiles}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All ({dailyFiles.length})
                </button>
              )}
            </div>

            <input
              ref={multiTextFileInputRef}
              type="file"
              multiple
              accept=".txt,text/plain,.log,.csv"
              className="hidden"
              onChange={handleMultiTextFileChange}
            />

            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDraggingText(true);
              }}
              onDragLeave={() => setIsDraggingText(false)}
              onDrop={handleTextDrop}
              className="p-3 rounded-xl border border-dashed text-center bg-white hover:bg-blue-50/20 border-stone-300 transition"
            >
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => multiTextFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Monthly Shift Files
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPasteDayName(`Day_${dailyFiles.length + 1}`);
                    setPasteDayContent('');
                    setPasteError('');
                    setIsPasteModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-lg border border-stone-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Paste Text
                </button>
              </div>
            </div>

            {dailyFiles.length > 0 && (
              <div className="mt-2.5 pt-2.5 border-t border-stone-200 text-xs font-bold text-blue-700 flex justify-between">
                <span>{dailyFiles.length} days loaded</span>
                <span>{totalMonthlyOrders} checks</span>
              </div>
            )}
          </div>
        )}

        {/* 2. RIGHT COLUMN: TALABAT EXCEL REPORT */}
        <div
          onClick={() => excelFileInputRef.current?.click()}
          onDragOver={e => {
            e.preventDefault();
            setIsDraggingExcel(true);
          }}
          onDragLeave={() => setIsDraggingExcel(false)}
          onDrop={handleExcelDrop}
          className={`group relative border-2 border-dashed rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all min-h-[160px] ${
            isDraggingExcel
              ? 'border-[#FF5A00] bg-orange-50/50 ring-2 ring-orange-200'
              : excelFileName
              ? 'border-blue-400 bg-blue-50/40 hover:bg-blue-50/60'
              : 'border-stone-200 hover:border-orange-300 hover:bg-orange-50/20 bg-stone-50/50'
          }`}
        >
          <input
            ref={excelFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleExcelFileChange}
          />

          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <TalabatLogo size="md" className="ring-1 ring-orange-200 shadow-2xs" />
              </div>
              <div>
                <div className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <span>2. Talabat Orders Spreadsheet (.xlsx)</span>
                  {excelFileName && <CheckCircle2 className="w-4 h-4 text-blue-600 inline" />}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Talabat Settlement / Orders Statement
                </p>
              </div>
            </div>

            {excelFileName ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200/60">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Loaded
              </span>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-400 group-hover:text-[#FF5A00] group-hover:border-orange-200 transition-colors shadow-2xs">
                <Upload className="w-4 h-4" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-stone-200/60 text-xs text-stone-600">
            <span className="font-semibold truncate max-w-[220px]">
              {excelFileName ? `📊 ${excelFileName}` : 'Click or drop Talabat Excel (.xlsx) here'}
            </span>
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
              {excelFileName ? 'Replace File' : '.XLSX / .CSV'}
            </span>
          </div>
        </div>
      </div>

      {/* Export Aloha Orders Action (if results exist) */}
      {hasResults && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-stone-100">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {auditMode === 'monthly'
                ? `Processed ${dailyFiles.length} days (${totalMonthlyOrders} checks) consolidated and reconciled automatically.`
                : 'All shift files and settlement spreadsheets have been reconciled successfully.'}
            </span>
          </div>

          <button
            type="button"
            onClick={onDownloadExcel}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs active:scale-[0.99] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Aloha Orders (Excel)
          </button>
        </div>
      )}

      {/* Paste Day Text Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-stone-900 text-base">Paste Aloha Report Text for a Day</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pasteError && (
              <div className="mb-3 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pasteError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Day / File Label</label>
                <input
                  type="text"
                  value={pasteDayName}
                  onChange={e => setPasteDayName(e.target.value)}
                  placeholder="e.g. Day 05 - 05/07/2026 or Aloha_July_05"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Aloha POS Text Content</label>
                <textarea
                  value={pasteDayContent}
                  onChange={e => setPasteDayContent(e.target.value)}
                  rows={8}
                  placeholder="Paste receipt checks or Aloha POS daily shift text here..."
                  className="w-full p-3 font-mono text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePastedText}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Add This Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

