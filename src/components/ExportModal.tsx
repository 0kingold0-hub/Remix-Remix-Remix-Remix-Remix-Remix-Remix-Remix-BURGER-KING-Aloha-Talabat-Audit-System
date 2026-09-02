import React, { useState } from 'react';
import {
  FileDown,
  FolderOpen,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  Download,
  Info,
  ExternalLink,
} from 'lucide-react';
import { saveFileWithPicker } from '../utils/fileSaver';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  defaultFileName: string;
  fileExtension: 'pdf' | 'xlsx';
  fileBlobGenerator: () => Promise<Blob> | Blob;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  title,
  defaultFileName,
  fileExtension,
  fileBlobGenerator,
}) => {
  const [fileName, setFileName] = useState(defaultFileName);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Keep fileName synced when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFileName(defaultFileName);
      setSaveSuccess(false);
      setIsProcessing(false);
    }
  }, [isOpen, defaultFileName]);

  if (!isOpen) return null;

  const handleSaveAs = async () => {
    try {
      setIsProcessing(true);
      const blob = await fileBlobGenerator();
      const finalName = fileName.endsWith(`.${fileExtension}`)
        ? fileName
        : `${fileName}.${fileExtension}`;

      const types =
        fileExtension === 'pdf'
          ? [
              {
                description: 'PDF Document (*.pdf)',
                accept: { 'application/pdf': ['.pdf'] },
              },
            ]
          : [
              {
                description: 'Excel Spreadsheet (*.xlsx)',
                accept: {
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
                    '.xlsx',
                  ],
                },
              },
            ];

      await saveFileWithPicker(blob, finalName, types);
      setSaveSuccess(true);
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error during file save:', err);
      setIsProcessing(false);
    }
  };

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-stone-50 via-white to-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                fileExtension === 'pdf'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {fileExtension === 'pdf' ? (
                <FileText className="w-5 h-5" />
              ) : (
                <FileSpreadsheet className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">{title}</h3>
              <p className="text-xs text-stone-500">
                Save As & Choose Destination Directory
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* File Name input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700">
              File Name:
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                placeholder="BK_Reconciliation_Report"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-sm font-medium text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono transition-all pr-16"
              />
              <span className="absolute right-3 text-xs font-bold text-stone-400 uppercase bg-stone-200/80 px-2 py-0.5 rounded">
                .{fileExtension}
              </span>
            </div>
          </div>

          {/* File Type Details */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 flex items-center justify-between">
            <span className="font-medium text-stone-500">Export Format:</span>
            <span className="font-bold text-stone-800 uppercase font-mono">
              {fileExtension === 'pdf'
                ? 'Adobe Acrobat Document (.pdf)'
                : 'Microsoft Excel Spreadsheet (.xlsx)'}
            </span>
          </div>

          {/* Location / Browser note */}
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed space-y-1">
              <p className="font-bold">Save Location (Destination Folder):</p>
              <p className="text-blue-800">
                Clicking <strong>&ldquo;Save As (Choose Folder)&rdquo;</strong> opens your operating system&apos;s file dialog to select the exact destination folder on your computer.
              </p>
              {isInIframe && (
                <p className="text-[11px] text-blue-700 pt-1 border-t border-blue-200/60 mt-1">
                  💡 <em>Note: If your browser downloads immediately without prompting for location, enable <strong>&ldquo;Ask where to save each file before downloading&rdquo;</strong> in your browser settings (Settings &rarr; Downloads) or open the app in a new tab.</em>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-stone-600 hover:text-stone-800 hover:bg-stone-200/70 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAs}
            disabled={isProcessing}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold text-white rounded-xl shadow-md transition-all cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : fileExtension === 'pdf'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved Successfully!</span>
              </>
            ) : isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving file...</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-4 h-4" />
                <span>Save As (Choose Folder)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

