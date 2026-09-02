import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { InputSection } from './components/InputSection';
import { SummaryCards } from './components/SummaryCards';
import { ReconciliationSummaryView } from './components/ReconciliationSummary';
import { OrdersTable } from './components/OrdersTable';
import { ComparisonTable } from './components/ComparisonTable';
import { DailyDiscrepancyReportModal } from './components/DailyDiscrepancyReportModal';
import { OrderFormModal } from './components/OrderFormModal';
import { LoginScreen } from './components/LoginScreen';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import { Footer } from './components/Footer';
import {
  AlohaSummary,
  AuditMode,
  ComparisonRow,
  CrossReferenceEntry,
  DailyFileEntry,
  DiscrepancyType,
  ExcelPaymentSummary,
  ParsedOrder,
  ReconciliationSummary,
  UserAccount,
  DeviceLicenseInfo,
} from './types';
import { parseAlohaText, calculateAlohaSummaryFromOrders } from './utils/parser';
import {
  buildReconciliation,
  evaluateComparisonRow,
  exportOrdersToExcel,
  parseCrossReferenceRows,
  parseExcelRows,
  readExcelFile,
  recomputeReconciliationSummary,
} from './utils/excel';
import { getStoredUser, apiLogout, apiVerifySession } from './utils/auth';
import { apiCheckLicense } from './utils/license';
import { UserProfileModal } from './components/UserProfileModal';
import { PaywallLockScreen } from './components/PaywallLockScreen';
import { TrialBanner } from './components/TrialBanner';
import { UpgradeLicenseModal } from './components/UpgradeLicenseModal';
import {
  sampleAlohaText,
  sampleBurgerKingTalabatReconciliationRows,
  sampleCrossReferenceEntries,
  sampleExcelComparison,
  sampleMonthlyDayFiles,
  sampleMonthlyExcelComparison,
} from './utils/sampleData';
import { AlertCircle, Layers, Receipt, FileSpreadsheet, CheckCircle2, CalendarDays, X } from 'lucide-react';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUserState] = useState<UserAccount | null>(() => getStoredUser());
  const [securityNotice, setSecurityNotice] = useState<string>('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Device Licensing & Trial State
  const [licenseInfo, setLicenseInfo] = useState<DeviceLicenseInfo | null>(null);
  const [isLoadingLicense, setIsLoadingLicense] = useState<boolean>(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

  const fetchLicenseStatus = async () => {
    try {
      const res = await apiCheckLicense();
      setLicenseInfo(res);
      // Auto-reconnect stored user if verified as master
      if (res.isMaster && !currentUser) {
        const stored = getStoredUser();
        if (stored) setCurrentUserState(stored);
      }
    } catch (err) {
      console.warn('License check notice:', err);
    } finally {
      setIsLoadingLicense(false);
    }
  };

  useEffect(() => {
    fetchLicenseStatus();
    // Poll license status every 30 seconds to enforce real-time 24h expiration
    const interval = setInterval(fetchLicenseStatus, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Periodic session heartbeat & remote kick verification across devices
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    const checkSession = async () => {
      const check = await apiVerifySession();
      if (!isMounted) return;
      if (!check.valid) {
        setCurrentUserState(null);
        setIsProfileModalOpen(false);
        setSecurityNotice(check.message || 'تم إنهاء جلستك من قِبل المدير العام أو تم تغيير كلمة المرور.');
      }
    };

    // Check immediately on mount
    checkSession();

    // Check every 8 seconds
    const interval = setInterval(checkSession, 8000);

    const handleFocus = () => checkSession();
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser]);

  const [auditMode, setAuditMode] = useState<AuditMode>('daily');
  const [inputText, setInputText] = useState<string>('');
  const [textFileName, setTextFileName] = useState<string>('');
  const [dailyFiles, setDailyFiles] = useState<DailyFileEntry[]>([]);
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 3-Way Cross Reference State
  const [crossReferenceEntries, setCrossReferenceEntries] = useState<CrossReferenceEntry[]>([]);
  const [crossRefFileName, setCrossRefFileName] = useState<string>('');

  const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
  const [alohaSummary, setAlohaSummary] = useState<AlohaSummary>({
    cashTotal: 0,
    creditTotal: 0,
    grandTotal: 0,
    cashCount: 0,
    creditCount: 0,
    deliveryCount: 0,
    totalOrdersCount: 0,
  });

  const [rawExcelComparison, setRawExcelComparison] = useState<any[]>([]);
  const [excelPayments, setExcelPayments] = useState<ExcelPaymentSummary>({
    cash: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    talabat: { count: 0, total: 0 },
    other: { count: 0, total: 0 },
  });

  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  const [reconciliationSummary, setReconciliationSummary] = useState<ReconciliationSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'both' | 'orders' | 'comparison'>('both');
  const [isDailyReportOpen, setIsDailyReportOpen] = useState<boolean>(false);
  const [editingRowForModal, setEditingRowForModal] = useState<ComparisonRow | null>(null);

  // Login handler
  const handleLoginSuccess = (user: UserAccount) => {
    setSecurityNotice('');
    setCurrentUserState(user);
  };

  // Logout handler
  const handleLogout = async () => {
    await apiLogout();
    setCurrentUserState(null);
    setIsForgotPasswordOpen(false);
    setIsProfileModalOpen(false);
    setSecurityNotice('تم تسجيل الخروج بنجاح. يرجى إدخال كلمة المرور للمتابعة.');
  };

  // Update profile handler
  const handleUpdateProfile = (updatedUser: UserAccount) => {
    setCurrentUserState(updatedUser);
  };

  // Trigger calculation from text (Daily Mode)
  const handleCalculate = (textToParse = inputText, fileName = textFileName) => {
    setErrorMsg('');
    const res = parseAlohaText(textToParse, fileName || 'Daily_Aloha_Report');

    if (res.error) {
      setErrorMsg(res.error);
      setParsedOrders([]);
      return;
    }

    if (res.orders.length === 0) {
      setErrorMsg('Please upload a valid Aloha POS report file (.txt) first.');
      return;
    }

    setParsedOrders(res.orders);
    setAlohaSummary(res.summary);

    // If we already have Excel comparison data, rebuild reconciliation with cross reference
    if (rawExcelComparison.length > 0) {
      const rec = buildReconciliation(res.orders, rawExcelComparison, crossReferenceEntries);
      setComparisonRows(rec.rows);
      setReconciliationSummary(rec.summary);
    }
  };

  // Text file upload handler (Single Daily File)
  const handleTextFileUpload = async (file: File) => {
    try {
      setTextFileName(file.name);
      const text = await file.text();
      setInputText(text);
      handleCalculate(text, file.name);
    } catch {
      setErrorMsg('Failed to read text file. Please check file encoding.');
    }
  };

  // Multiple Text Files upload handler (Monthly Multi-Day Mode)
  const handleMultipleTextFilesUpload = async (files: File[]) => {
    try {
      setErrorMsg('');
      const newEntries: DailyFileEntry[] = [];

      for (const file of files) {
        const text = await file.text();
        const res = parseAlohaText(text, file.name);
        const dayDate = res.orders.find(o => o.date)?.date || new Date().toLocaleDateString('en-GB');

        newEntries.push({
          id: `day-file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          fileName: file.name,
          date: dayDate,
          text,
          orderCount: res.orders.length,
          totalAmount: res.summary.grandTotal,
          cashAmount: res.summary.cashTotal,
          creditAmount: res.summary.creditTotal + res.summary.cardTotal,
          parsedOrders: res.orders,
        });
      }

      setDailyFiles(prev => {
        const existingNames = new Set(newEntries.map(e => e.fileName));
        const filteredPrev = prev.filter(p => !existingNames.has(p.fileName));
        const updated = [...filteredPrev, ...newEntries];

        const allOrders = updated.flatMap(d => d.parsedOrders);
        const summary = calculateAlohaSummaryFromOrders(allOrders);
        setParsedOrders(allOrders);
        setAlohaSummary(summary);

        if (rawExcelComparison.length > 0) {
          const rec = buildReconciliation(allOrders, rawExcelComparison, crossReferenceEntries);
          setComparisonRows(rec.rows);
          setReconciliationSummary(rec.summary);
        }

        return updated;
      });
    } catch {
      setErrorMsg('Failed to parse one or more daily text files.');
    }
  };

  // Add pasted daily text (Monthly Mode)
  const handleAddDailyText = (dayName: string, text: string) => {
    setErrorMsg('');
    const res = parseAlohaText(text, dayName);
    if (res.orders.length === 0) {
      setErrorMsg(`No valid checks found in pasted text for "${dayName}".`);
      return;
    }

    const dayDate = res.orders.find(o => o.date)?.date || new Date().toLocaleDateString('en-GB');
    const newEntry: DailyFileEntry = {
      id: `day-file-${Date.now()}`,
      fileName: dayName.endsWith('.txt') ? dayName : `${dayName}.txt`,
      date: dayDate,
      text,
      orderCount: res.orders.length,
      totalAmount: res.summary.grandTotal,
      cashAmount: res.summary.cashTotal,
      creditAmount: res.summary.creditTotal + res.summary.cardTotal,
      parsedOrders: res.orders,
    };

    setDailyFiles(prev => {
      const updated = [...prev, newEntry];
      const allOrders = updated.flatMap(d => d.parsedOrders);
      const summary = calculateAlohaSummaryFromOrders(allOrders);
      setParsedOrders(allOrders);
      setAlohaSummary(summary);

      if (rawExcelComparison.length > 0) {
        const rec = buildReconciliation(allOrders, rawExcelComparison, crossReferenceEntries);
        setComparisonRows(rec.rows);
        setReconciliationSummary(rec.summary);
      }

      return updated;
    });
  };

  // Remove a specific daily file (Monthly Mode)
  const handleRemoveDailyFile = (id: string) => {
    setDailyFiles(prev => {
      const updated = prev.filter(d => d.id !== id);
      const allOrders = updated.flatMap(d => d.parsedOrders);
      const summary = calculateAlohaSummaryFromOrders(allOrders);
      setParsedOrders(allOrders);
      setAlohaSummary(summary);

      if (rawExcelComparison.length > 0) {
        const rec = buildReconciliation(allOrders, rawExcelComparison, crossReferenceEntries);
        setComparisonRows(rec.rows);
        setReconciliationSummary(rec.summary);
      }

      return updated;
    });
  };

  // Clear all daily files (Monthly Mode)
  const handleClearAllDailyFiles = () => {
    setDailyFiles([]);
    setParsedOrders([]);
    setAlohaSummary({
      cashTotal: 0,
      creditTotal: 0,
      grandTotal: 0,
      cashCount: 0,
      creditCount: 0,
      deliveryCount: 0,
      totalOrdersCount: 0,
    });
    if (rawExcelComparison.length > 0) {
      const rec = buildReconciliation([], rawExcelComparison, crossReferenceEntries);
      setComparisonRows(rec.rows);
      setReconciliationSummary(rec.summary);
    }
  };

  // Excel file upload handler (Talabat Settlement Ledger)
  const handleExcelFileUpload = async (file: File) => {
    try {
      setExcelFileName(file.name);
      const buffer = await file.arrayBuffer();
      const rawRows = await readExcelFile(buffer);

      const { comparisonData, excelPayments: payments } = parseExcelRows(rawRows);
      setRawExcelComparison(comparisonData);
      setExcelPayments(payments);

      // Reconcile with current parsed orders + cross references
      const rec = buildReconciliation(parsedOrders, comparisonData, crossReferenceEntries);
      setComparisonRows(rec.rows);
      setReconciliationSummary(rec.summary);
      setErrorMsg('');
    } catch {
      setErrorMsg('Failed to read Excel file. Please ensure it contains header columns and valid data.');
    }
  };

  // 3-Way Cross Reference Excel Upload Handler
  const handleCrossReferenceFileUpload = async (file: File) => {
    try {
      setCrossRefFileName(file.name);
      const buffer = await file.arrayBuffer();
      const rawRows = await readExcelFile(buffer);
      const parsed = parseCrossReferenceRows(rawRows);

      if (parsed.length > 0) {
        setCrossReferenceEntries(parsed);
        const rec = buildReconciliation(parsedOrders, rawExcelComparison, parsed);
        setComparisonRows(rec.rows);
        setReconciliationSummary(rec.summary);
        setErrorMsg('');
      } else {
        setErrorMsg('تمت قراءة الملف ولكن لم يتم العثور على أعمدة المطابقة المطلوبة (Aloha Order No. / Talabat order NO.).');
      }
    } catch {
      setErrorMsg('فشل قراءة شيت فورمة الإكسيل المرجعية الثالثة. يرجى التأكد من صلاحية الملف.');
    }
  };

  // Update Cross-Reference Entries from interactive table or paste modal
  const handleUpdateCrossReferenceEntries = (entries: CrossReferenceEntry[]) => {
    setCrossReferenceEntries(entries);
    if (parsedOrders.length > 0 || rawExcelComparison.length > 0) {
      const rec = buildReconciliation(parsedOrders, rawExcelComparison, entries);
      setComparisonRows(rec.rows);
      setReconciliationSummary(rec.summary);
    }
  };

  const handleApplyCrossReference = () => {
    const rec = buildReconciliation(parsedOrders, rawExcelComparison, crossReferenceEntries);
    setComparisonRows(rec.rows);
    setReconciliationSummary(rec.summary);
    setActiveTab('comparison');
  };

  // AI Reconciliation Handler (from image OCR or direct upload)
  const handleAiReconciliationComplete = (rows: ComparisonRow[]) => {
    setComparisonRows(rows);
    const summary = recomputeReconciliationSummary(rows);
    setReconciliationSummary(summary);
    setExcelFileName('تقرير_المطابقة_المالية_AI.png');
    setActiveTab('comparison');
    setErrorMsg('');
  };

  // Load sample data (adapts to current mode)
  const handleLoadSample = () => {
    if (auditMode === 'cross_reference') {
      setCrossReferenceEntries(sampleCrossReferenceEntries);
      setCrossRefFileName('sample_3way_cross_reference.xlsx');

      setInputText(sampleAlohaText);
      setTextFileName('sample_aloha_report.txt');
      setExcelFileName('sample_talabat_ledger.xlsx');

      const res = parseAlohaText(sampleAlohaText, 'sample_aloha_report.txt');
      setParsedOrders(res.orders);
      setAlohaSummary(res.summary);

      const { comparisonData, excelPayments: payments } = parseExcelRows(sampleExcelComparison);
      setRawExcelComparison(comparisonData);
      setExcelPayments(payments);

      const rec = buildReconciliation(res.orders, comparisonData, sampleCrossReferenceEntries);
      setComparisonRows(rec.rows);
      setReconciliationSummary(rec.summary);
      setErrorMsg('');
      return;
    }

    if (auditMode === 'ai_image') {
      const mappedRows: ComparisonRow[] = sampleBurgerKingTalabatReconciliationRows.map((item, idx) => {
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
          key: `sample_ai_${idx}_${item.talabatOrderNo || item.alohaOrderNo}`,
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
          source: (isZeroAloha ? 'talabat_only' : item.talabatOrderNo === '—' ? 'aloha_only' : 'both') as any,
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

      handleAiReconciliationComplete(mappedRows);
      return;
    }

    if (auditMode === 'monthly') {
      setCrossReferenceEntries([]);
      setCrossRefFileName('');
      const entries: DailyFileEntry[] = sampleMonthlyDayFiles.map((sf, idx) => {
        const res = parseAlohaText(sf.text, sf.fileName);
        return {
          id: `sample-day-${idx + 1}`,
          fileName: sf.fileName,
          date: sf.date,
          text: sf.text,
          orderCount: res.orders.length,
          totalAmount: res.summary.grandTotal,
          cashAmount: res.summary.cashTotal,
          creditAmount: res.summary.creditTotal + res.summary.cardTotal,
          parsedOrders: res.orders,
        };
      });

      setDailyFiles(entries);
      const allOrders = entries.flatMap(e => e.parsedOrders);
      setParsedOrders(allOrders);
      setAlohaSummary(calculateAlohaSummaryFromOrders(allOrders));

      setExcelFileName('sample_talabat_monthly_ledger.xlsx');
      const { comparisonData, excelPayments: payments } = parseExcelRows(sampleMonthlyExcelComparison);
      setRawExcelComparison(comparisonData);
      setExcelPayments(payments);

      const rec = buildReconciliation(allOrders, comparisonData, []);
      setComparisonRows(rec.rows);
      setReconciliationSummary(rec.summary);
      setErrorMsg('');
    } else {
      setCrossReferenceEntries([]);
      setCrossRefFileName('');
      setInputText(sampleAlohaText);
      setTextFileName('sample_aloha_report.txt');
      setExcelFileName('sample_talabat_ledger.xlsx');

      const res = parseAlohaText(sampleAlohaText, 'sample_aloha_report.txt');
      setParsedOrders(res.orders);
      setAlohaSummary(res.summary);

      const { comparisonData, excelPayments: payments } = parseExcelRows(sampleExcelComparison);
      setRawExcelComparison(comparisonData);
      setExcelPayments(payments);

      const rec = buildReconciliation(res.orders, comparisonData, []);
      setComparisonRows(rec.rows);
      setReconciliationSummary(rec.summary);
      setErrorMsg('');
    }
  };

  // Reset all state
  const handleReset = () => {
    setInputText('');
    setTextFileName('');
    setDailyFiles([]);
    setExcelFileName('');
    setCrossRefFileName('');
    setCrossReferenceEntries([]);
    setParsedOrders([]);
    setAlohaSummary({
      cashTotal: 0,
      creditTotal: 0,
      grandTotal: 0,
      cashCount: 0,
      creditCount: 0,
      deliveryCount: 0,
      totalOrdersCount: 0,
    });
    setRawExcelComparison([]);
    setComparisonRows([]);
    setReconciliationSummary(null);
    setErrorMsg('');
  };

  const handleUpdateRowReason = (rowKey: string, reason?: string, customNote?: string) => {
    setComparisonRows(prev => {
      const updated = prev.map(r => {
        const key = r.key || r.number;
        if (key === rowKey || r.key === rowKey || r.number === rowKey) {
          const nextReason = reason !== undefined ? reason : (r.varianceReason || '');
          const nextNote = customNote !== undefined ? customNote : (r.customVarianceNote || '');
          const nextComment = (nextNote && nextNote.trim()) ? nextNote.trim() : (nextReason || r.comment || '');
          return {
            ...r,
            varianceReason: nextReason,
            customVarianceNote: nextNote,
            comment: nextComment,
          };
        }
        return r;
      });
      setReconciliationSummary(recomputeReconciliationSummary(updated));
      return updated;
    });
  };

  // Save (Add or Edit) a Comparison Row
  const handleSaveComparisonRow = (rowInput: Partial<ComparisonRow>, isNew: boolean) => {
    const evaluated = evaluateComparisonRow(rowInput);

    setComparisonRows(prev => {
      let nextRows: ComparisonRow[];
      if (isNew) {
        nextRows = [evaluated, ...prev];
      } else {
        const keyToMatch = evaluated.key || evaluated.number;
        nextRows = prev.map(r => ((r.key || r.number) === keyToMatch ? evaluated : r));
      }

      setReconciliationSummary(recomputeReconciliationSummary(nextRows));
      return nextRows;
    });

    if (evaluated.alohaPrice > 0) {
      setParsedOrders(prev => {
        const exists = prev.some(o => o.number === evaluated.number || o.id === evaluated.key);
        let nextOrders: ParsedOrder[];

        if (exists) {
          nextOrders = prev.map(o => {
            if (o.number === evaluated.number || o.id === evaluated.key) {
              return {
                ...o,
                amount: evaluated.alohaPrice,
                payment: (evaluated.localPayment as any) || o.payment,
                time: evaluated.alohaTime || o.time,
                date: evaluated.alohaDate || o.date,
              };
            }
            return o;
          });
        } else if (isNew) {
          const newOrder: ParsedOrder = {
            id: evaluated.key || `order-${Date.now()}`,
            number: evaluated.number !== '—' ? evaluated.number : `CHK-${Date.now().toString().slice(-4)}`,
            amount: evaluated.alohaPrice,
            payment: (evaluated.localPayment as any) || 'Cash',
            orderType: evaluated.rawAlohaOrder?.orderType || 'HD Talabat',
            time: evaluated.alohaTime || '12:00 PM',
            date: evaluated.alohaDate || new Date().toLocaleDateString('en-GB'),
            dateTime: evaluated.alohaDateTime || undefined,
            host: evaluated.alohaHost || 'Manual Check',
            hostId: evaluated.alohaHostId || '9999',
            terminal: evaluated.alohaTerminal || 'HD1',
            storeName: 'Burger King',
            isDuplicate: false,
            isDelivery: true,
            authNumber: evaluated.orderId !== '—' ? evaluated.orderId : undefined,
            rawText: `Manual Entry #${evaluated.number}\nAmount: ${(Number(evaluated.alohaPrice) || 0).toFixed(2)} EGP\nPayment: ${evaluated.localPayment}`,
          };
          nextOrders = [newOrder, ...prev];
        } else {
          nextOrders = prev;
        }

        setAlohaSummary(calculateAlohaSummaryFromOrders(nextOrders));
        return nextOrders;
      });
    }
  };

  // Delete a Comparison Row
  const handleDeleteComparisonRow = (rowKey: string) => {
    setComparisonRows(prev => {
      const rowToDelete = prev.find(r => r.key === rowKey || r.number === rowKey || r.orderId === rowKey);
      const targetNumber = rowToDelete?.number;
      const targetOrderId = rowToDelete?.orderId;

      const nextRows = prev.filter(r => {
        const key = r.key || r.number;
        if (key === rowKey || r.key === rowKey || r.number === rowKey) return false;
        if (targetNumber && targetNumber !== '—' && targetNumber !== 'Not in Aloha' && r.number === targetNumber) return false;
        if (targetOrderId && targetOrderId !== '—' && !targetOrderId.includes('Missing') && r.orderId === targetOrderId) return false;
        return true;
      });

      setReconciliationSummary(recomputeReconciliationSummary(nextRows));
      return nextRows;
    });

    setRawExcelComparison(prevExcel => {
      return prevExcel.filter(item => {
        const num = item.orderNumber || item.number;
        const oid = item.orderId || item.id;
        if (rowKey && (num === rowKey || oid === rowKey)) return false;
        return true;
      });
    });

    setParsedOrders(prevOrders => {
      const nextOrders = prevOrders.filter(o => o.id !== rowKey && o.number !== rowKey);
      setAlohaSummary(calculateAlohaSummaryFromOrders(nextOrders));
      return nextOrders;
    });
  };

  // Save (Add or Edit) an Aloha Order
  const handleSaveAlohaOrder = (orderInput: Partial<ParsedOrder>, isNew: boolean) => {
    const orderNumber = orderInput.number || `MAN-${Date.now().toString().slice(-4)}`;
    const fullOrder: ParsedOrder = {
      id: orderInput.id || `order-${Date.now()}`,
      number: orderNumber,
      amount: orderInput.amount ?? 0,
      payment: orderInput.payment || 'Cash',
      orderType: orderInput.orderType || 'Delivery',
      time: orderInput.time || '12:00 PM',
      date: orderInput.date || '04/07/2026',
      host: orderInput.host || 'Manual Host',
      hostId: orderInput.hostId || '9999',
      terminal: orderInput.terminal || 'HD1',
      storeName: orderInput.storeName || 'Burger King',
      isDuplicate: orderInput.isDuplicate || false,
      rawText: orderInput.rawText || `Manual Entry #${orderNumber}\nAmount: ${(Number(orderInput.amount) || 0).toFixed(2)} EGP\nPayment: ${orderInput.payment}`,
    };

    setParsedOrders(prev => {
      let nextOrders: ParsedOrder[];
      if (isNew) {
        nextOrders = [fullOrder, ...prev];
      } else {
        const idToMatch = fullOrder.id || fullOrder.number;
        nextOrders = prev.map(o => (o.id === idToMatch || o.number === fullOrder.number ? fullOrder : o));
      }

      setAlohaSummary(calculateAlohaSummaryFromOrders(nextOrders));

      if (rawExcelComparison.length > 0) {
        const rec = buildReconciliation(nextOrders, rawExcelComparison, crossReferenceEntries);
        setComparisonRows(rec.rows);
        setReconciliationSummary(rec.summary);
      }

      return nextOrders;
    });
  };

  // Delete an Aloha Order
  const handleDeleteAlohaOrder = (orderIdOrNumber: string) => {
    setParsedOrders(prev => {
      const nextOrders = prev.filter(o => o.id !== orderIdOrNumber && o.number !== orderIdOrNumber);
      setAlohaSummary(calculateAlohaSummaryFromOrders(nextOrders));

      if (rawExcelComparison.length > 0) {
        const rec = buildReconciliation(nextOrders, rawExcelComparison, crossReferenceEntries);
        setComparisonRows(rec.rows);
        setReconciliationSummary(rec.summary);
      }

      return nextOrders;
    });
  };

  const hasData = parsedOrders.length > 0;
  const hasComparison = comparisonRows.length > 0 && reconciliationSummary !== null;
  const isMasterUser = currentUser?.role === 'admin' || currentUser?.username?.toLowerCase() === 'king';

  // 1. Loading screen while verifying hardware fingerprint and license
  if (isLoadingLicense && !currentUser) {
    return (
      <div className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <h2 className="text-base font-black text-amber-300">جاري التحقق من أمان وبصمة الجهاز والترخيص...</h2>
          <p className="text-xs text-stone-400 leading-relaxed">
            نظام التدقيق المالي ومطابقة الحسابات — كينج
          </p>
        </div>
      </div>
    );
  }

  // 2. HARD PAYWALL LOCK: If device 24h trial has expired and user is NOT Master Admin
  if (licenseInfo?.isExpired && !isMasterUser) {
    return (
      <PaywallLockScreen
        licenseInfo={licenseInfo}
        onActivated={(updatedInfo) => {
          setLicenseInfo(updatedInfo);
        }}
        onMasterLoginSuccess={(user) => {
          handleLoginSuccess(user);
          fetchLicenseStatus();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-stone-900 flex flex-col justify-between">
      <div>
        {/* Real-time 24h Trial Countdown Banner for Clients */}
        {licenseInfo?.status === 'trial' && !isMasterUser && (
          <TrialBanner
            licenseInfo={licenseInfo}
            onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
          />
        )}

        {/* Top Header */}
        <Header
          onReset={handleReset}
          hasData={hasData || hasComparison}
          rows={comparisonRows}
          summary={reconciliationSummary}
          excelFileName={excelFileName}
          excelPayments={excelPayments}
          onOpenDailyReport={hasComparison || hasData ? () => setIsDailyReportOpen(true) : undefined}
          currentUser={currentUser}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onLogout={handleLogout}
          licenseInfo={licenseInfo}
          onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
        />

        <main id="printable-reconciliation-page" className="w-full max-w-[98%] 2xl:max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6">
          {/* Error Alert Box */}
          {errorMsg && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold">{errorMsg}</div>
            </div>
          )}

          {/* Input and Upload Section */}
          <InputSection
            auditMode={auditMode}
            setAuditMode={setAuditMode}
            inputText={inputText}
            setInputText={setInputText}
            onCalculate={() => handleCalculate()}
            onTextFileUpload={handleTextFileUpload}
            onMultipleTextFilesUpload={handleMultipleTextFilesUpload}
            onAddDailyText={handleAddDailyText}
            dailyFiles={dailyFiles}
            onRemoveDailyFile={handleRemoveDailyFile}
            onClearAllDailyFiles={handleClearAllDailyFiles}
            onExcelFileUpload={handleExcelFileUpload}
            onLoadSample={handleLoadSample}
            onDownloadExcel={() => exportOrdersToExcel(parsedOrders)}
            hasResults={hasData || hasComparison}
            excelFileName={excelFileName}
            textFileName={textFileName}
            onAiReconciliationComplete={handleAiReconciliationComplete}
            crossReferenceEntries={crossReferenceEntries}
            onUpdateCrossReferenceEntries={handleUpdateCrossReferenceEntries}
            onCrossReferenceFileUpload={handleCrossReferenceFileUpload}
            crossRefFileName={crossRefFileName}
            onApplyCrossReference={handleApplyCrossReference}
          />

          {/* If we have calculated orders or comparison records */}
          {(hasData || hasComparison) && (
            <div className="space-y-6 animate-fadeIn">
              {/* View Navigation Switcher */}
              <div className="bg-white p-1.5 rounded-2xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('both')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      activeTab === 'both'
                        ? 'bg-[#D71920] text-white shadow-xs'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Combined Overview
                  </button>

                  {hasData && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        activeTab === 'orders'
                          ? 'bg-[#D71920] text-white shadow-xs'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <Receipt className="w-4 h-4" />
                      Aloha POS Log ({parsedOrders.length})
                    </button>
                  )}

                  {hasComparison && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('comparison')}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        activeTab === 'comparison'
                          ? 'bg-[#D71920] text-white shadow-xs'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Reconciliation Table ({comparisonRows.length})
                    </button>
                  )}

                  {hasComparison && (
                    <button
                      type="button"
                      onClick={() => setIsDailyReportOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all cursor-pointer shadow-xs ml-auto sm:ml-0"
                    >
                      <CalendarDays className="w-4 h-4 text-amber-600" />
                      <span>Daily Deficit Breakdown</span>
                    </button>
                  )}
                </div>

                {/* Status info */}
                <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {hasComparison
                      ? `Reconciliation Active: ${comparisonRows.length} orders analyzed${crossReferenceEntries.length > 0 ? ` (${crossReferenceEntries.length} 3-way verified)` : ''}`
                      : auditMode === 'monthly' && dailyFiles.length > 0
                      ? `Extracted ${parsedOrders.length} checks across ${dailyFiles.length} days`
                      : `Extracted ${parsedOrders.length} checks successfully`}
                  </span>
                </div>
              </div>

              {/* Financial Totals & Count Cards */}
              {hasData && (activeTab === 'both' || activeTab === 'orders') && (
                <SummaryCards summary={alohaSummary} />
              )}

              {/* Aloha Orders Table */}
              {hasData && (activeTab === 'both' || activeTab === 'orders') && (
                <OrdersTable
                  orders={parsedOrders}
                  onSaveOrder={handleSaveAlohaOrder}
                  onDeleteOrder={handleDeleteAlohaOrder}
                />
              )}

              {/* Reconciliation Section */}
              {hasComparison && (activeTab === 'both' || activeTab === 'comparison') && (
                <div className="space-y-6 pt-2">
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-xs">
                    <div className="border-b border-stone-100 pb-3 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                          Financial Audit & Reconciliation Findings
                        </h2>
                        <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                          3-Way reconciliation between Aloha POS receipts, Talabat settlement sheets, and Master Cross-Reference Form.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsDailyReportOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        <CalendarDays className="w-4 h-4" />
                        <span>Open Daily Discrepancy Report</span>
                      </button>
                    </div>

                    <ReconciliationSummaryView
                      summary={reconciliationSummary!}
                      excelPayments={excelPayments}
                      totalExcelCount={comparisonRows.length}
                      onOpenDailyReport={() => setIsDailyReportOpen(true)}
                    />
                  </div>

                  <ComparisonTable
                    rows={comparisonRows}
                    summary={reconciliationSummary!}
                    excelFileName={excelFileName}
                    onUpdateRowReason={handleUpdateRowReason}
                    onSaveRow={handleSaveComparisonRow}
                    onDeleteRow={handleDeleteComparisonRow}
                  />
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer with Developer Attribution */}
      <Footer />

      {/* Daily Discrepancy & Variance Breakdown Modal */}
      {isDailyReportOpen && (
        <DailyDiscrepancyReportModal
          isOpen={isDailyReportOpen}
          onClose={() => setIsDailyReportOpen(false)}
          rows={comparisonRows}
          alohaOrders={parsedOrders}
          summary={reconciliationSummary}
          onEditRow={row => {
            setEditingRowForModal(row);
          }}
          onSaveRowNote={(rowKey, reason, note) => {
            handleUpdateRowReason(rowKey, reason, note);
          }}
        />
      )}

      {/* Quick Edit Row Modal from inside Daily Report */}
      {editingRowForModal && (
        <OrderFormModal
          isOpen={!!editingRowForModal}
          onClose={() => setEditingRowForModal(null)}
          isComparison={true}
          isNew={false}
          initialData={editingRowForModal}
          onSaveComparison={(updatedData, isNew) => {
            handleSaveComparisonRow(updatedData, isNew);
            setEditingRowForModal(null);
          }}
        />
      )}

      {/* Master Admin Profile & Device Management Modal */}
      {isProfileModalOpen && currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          onUpdateUser={handleUpdateProfile}
          onLogout={handleLogout}
        />
      )}

      {/* Upgrade / Buy License Modal (5,000 EGP) */}
      <UpgradeLicenseModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        licenseInfo={licenseInfo}
        onActivated={(updated) => {
          setLicenseInfo(updated);
          setIsUpgradeModalOpen(false);
        }}
      />

      {/* Master Admin Login Modal (for owner to sign in anytime from header) */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/80 backdrop-blur-xs animate-fadeIn" dir="ltr">
          <div className="relative w-full max-w-[460px]">
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-950 text-white flex items-center justify-center shadow-xl border border-stone-600 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-stone-600">
              <LoginScreen
                onLoginSuccess={(user) => {
                  handleLoginSuccess(user);
                  setIsLoginModalOpen(false);
                  fetchLicenseStatus();
                }}
                securityNotice={securityNotice}
                onForgotPasswordClick={() => {
                  setIsLoginModalOpen(false);
                  setIsForgotPasswordOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
          onResetSuccess={(user) => {
            setCurrentUserState(user);
            setSecurityNotice('');
            setIsForgotPasswordOpen(false);
            fetchLicenseStatus();
          }}
        />
      )}
    </div>
  );
}
