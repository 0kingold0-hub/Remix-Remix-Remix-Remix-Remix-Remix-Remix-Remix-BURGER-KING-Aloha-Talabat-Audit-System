import * as XLSX from 'xlsx';
import {
  ComparisonRow,
  CrossReferenceEntry,
  DiscrepancyType,
  ExcelPaymentSummary,
  ParsedOrder,
  ReconciliationSummary,
  CashierAuditSummary,
} from '../types';
import { isTalabatReconciliationOrder, parseDateTimeToTimestamp } from './parser';
import { saveFileWithPicker } from './fileSaver';

export function readExcelFile(dataBuffer: ArrayBuffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      const workbook = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
      let bestRows: any[] = [];
      let maxScore = -1;

      // Scan all sheets (e.g. Sheet1, Sheet2, Sheet3) to pick the one with actual reconciliation headers/data
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false }) as any[];
        if (!rows || rows.length === 0) continue;

        let score = 0;
        const sample = rows.slice(0, 15);
        for (const row of sample) {
          const keys = Object.keys(row).join(' ').toLowerCase();
          if (keys.includes('aloha') || keys.includes('الالوها') || keys.includes('ألوها')) score += 15;
          if (keys.includes('talabat') || keys.includes('طلبات')) score += 15;
          if (keys.includes('order') || keys.includes('check') || keys.includes('شيك')) score += 8;
          if (keys.includes('am') || keys.includes('amount') || keys.includes('price') || keys.includes('مبلغ')) score += 8;
          if (keys.includes('variance') || keys.includes('varince')) score += 10;
          if (keys.includes('comment') || keys.includes('rechargeable')) score += 5;
        }

        if (rows.length > 0 && score > maxScore) {
          maxScore = score;
          bestRows = rows;
        }
      }

      if (bestRows.length === 0 && workbook.SheetNames.length > 0) {
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        bestRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
      }

      resolve(bestRows);
    } catch (err) {
      reject(err);
    }
  });
}

function isIgnoredKeyForMatching(keyName: string): boolean {
  const norm = keyName.toLowerCase().replace(/[\s_\-\.\/]/g, '');
  const ignoredPatterns = [
    'restaurantid',
    'restaurant',
    'branchid',
    'branch',
    'storeid',
    'store',
    'vendorid',
    'vendor',
    'riderid',
    'rider',
    'driverid',
    'driver',
    'customerid',
    'customer',
    'vatamount',
    'vat',
    'tax',
    'deliverycharge',
    'servicefee',
    'deliveryfee',
    'fee',
    'charge',
    'totalsale',
    'commission',
    'originalamount',
    'refund',
    'coupon',
    'discountcoupon',
  ];
  return ignoredPatterns.some(p => norm === p || (p.length >= 6 && norm.includes(p)));
}

function findMatchingKey(row: Record<string, any>, candidates: string[]): string | undefined {
  const keys = Object.keys(row).filter(k => !isIgnoredKeyForMatching(k));
  // 1. Exact match (case & whitespace insensitive)
  for (const candidate of candidates) {
    const cLower = candidate.toLowerCase().trim();
    const found = keys.find(k => k.toLowerCase().trim() === cLower);
    if (found) return found;
  }
  // 2. Normalized match (removing spaces and underscores)
  for (const candidate of candidates) {
    const cNorm = candidate.toLowerCase().replace(/[\s_\-\.\/]/g, '');
    const found = keys.find(k => k.toLowerCase().replace(/[\s_\-\.\/]/g, '') === cNorm);
    if (found) return found;
  }
  // 3. Substring match (candidate must be specific, length >= 4)
  for (const candidate of candidates) {
    const cLower = candidate.toLowerCase().trim();
    if (cLower.length < 4) continue;
    const found = keys.find(k => k.toLowerCase().includes(cLower));
    if (found) return found;
  }
  return undefined;
}

/**
 * Finds a matching key that actually contains non-empty value in the current row if possible
 */
function findMatchingKeyWithValue(row: Record<string, any>, candidates: string[]): string | undefined {
  const keys = Object.keys(row).filter(k => !isIgnoredKeyForMatching(k));
  for (const candidate of candidates) {
    const cLower = candidate.toLowerCase().trim();
    const found = keys.find(
      k => k.toLowerCase().trim() === cLower && row[k] !== undefined && String(row[k]).trim() !== ''
    );
    if (found) return found;
  }
  for (const candidate of candidates) {
    const cNorm = candidate.toLowerCase().replace(/[\s_\-\.\/]/g, '');
    const found = keys.find(
      k =>
        k.toLowerCase().replace(/[\s_\-\.\/]/g, '') === cNorm &&
        row[k] !== undefined &&
        String(row[k]).trim() !== ''
    );
    if (found) return found;
  }
  for (const candidate of candidates) {
    const cLower = candidate.toLowerCase().trim();
    if (cLower.length < 4) continue;
    const found = keys.find(
      k => k.toLowerCase().includes(cLower) && row[k] !== undefined && String(row[k]).trim() !== ''
    );
    if (found) return found;
  }
  return findMatchingKey(row, candidates);
}

function formatExcelDateTime(val: any): { date?: string; time?: string; dateTime?: string } {
  if (val === undefined || val === null || val === '') return {};
  
  if (typeof val === 'number') {
    // Excel serial date number
    try {
      const dateObj = new Date((val - 25569) * 86400 * 1000);
      if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        let hours = dateObj.getHours();
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
        const dateStr = `${day}/${month}/${year}`;
        return { date: dateStr, time: timeStr, dateTime: `${dateStr} ${timeStr}` };
      }
    } catch {
      // ignore
    }
  }

  const str = String(val).trim();
  if (!str) return {};

  const match = str.match(/(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})(?:\s+([\d]{1,2}:[\d]{2}(?::[\d]{2})?(?:\s*[APap][Mm])?))?/);
  if (match) {
    const date = match[1].trim();
    const time = match[2] ? match[2].trim() : undefined;
    const dateTime = time ? `${date} ${time}` : date;
    return { date, time, dateTime };
  }

  return { dateTime: str };
}

export function parseExcelRows(rawRows: any[]): {
  comparisonData: Array<{
    number: string;
    orderId: string;
    alohaPrice: number;
    talabat: number;
    method: string;
    dateTime?: string;
    date?: string;
    time?: string;
    rawRow?: any;
  }>;
  excelPayments: ExcelPaymentSummary;
} {
  const paymentTotals: ExcelPaymentSummary = {
    cash: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
    talabat: { count: 0, total: 0 },
    other: { count: 0, total: 0 },
    grandTotal: 0,
    totalCount: 0,
  };

  const comparisonData = rawRows
    .map((row, idx) => {
      // Find candidate keys
      const explicitAlohaNoKey = findMatchingKeyWithValue(row, [
        'Aloha Order No.',
        'Aloha Order No',
        'Aloha Order #',
        'Aloha Order',
        'Aloha No.',
        'Aloha No',
        'Aloha Number',
        'Aloha #',
        'Aloha_No',
        'Aloha Check',
        'Check No',
        'Check Number',
        'Check #',
        'Check',
        'رقم الالوها',
        'رقم الألوها',
        'الالوها',
        'الألوها',
        'رقم الشيك',
        'الشيك',
        'رقم البون',
        'البون',
      ]);

      const explicitOrderIdKey = findMatchingKeyWithValue(row, [
        'Talabat order NO.',
        'Talabat order NO',
        'Talabat order No.',
        'Talabat order No',
        'Talabat Order #',
        'Talabat Order ID',
        'Talabat Order Id',
        'Talabat Order Number',
        'Talabat Order',
        'Talabat NO.',
        'Talabat NO',
        'Talabat No.',
        'Talabat No',
        'Talabat ID',
        'Talabat Id',
        'Talabat #',
        'Talabat Ref',
        'Order Id',
        'Order ID',
        'OrderId',
        'Order_Id',
        'Order Ref',
        'Reference',
        'Ref',
        'Order Code',
        'Code',
        'رقم طلبات',
        'كود طلبات',
        'رقم اوردر طلبات',
        'رقم أوردر طلبات',
        'طلب طلبات',
        'المرجع',
      ]);

      const orderKey = explicitAlohaNoKey;
      const orderIdKey = explicitOrderIdKey;

      const priceKey = findMatchingKeyWithValue(row, [
        'Aloha AM',
        'Aloha AM.',
        'Aloha_AM',
        'Aloha Price',
        'Aloha Amount',
        'Aloha Total',
        'Aloha Net',
        'Aloha Gross',
        'POS Price',
        'POS Amount',
        'POS Total',
        'سعر الالوها',
        'سعر الألوها',
        'مبلغ الالوها',
        'مبلغ الألوها',
        'اجمالي الالوها',
        'إجمالي الألوها',
        'صافي الالوها',
        'صافي الألوها',
        'سعر المطعم',
        'مبلغ المطعم',
      ]);

      const talabatKey = findMatchingKeyWithValue(row, [
        'Talabat AM',
        'Talabat AM.',
        'Talabat_AM',
        'Talabat',
        'Talabat Price',
        'Talabat Amount',
        'Talabat Total',
        'Talabat Net',
        'Talabat Gross',
        'SubTotal',
        'Sub Total',
        'Net Amount',
        'Total Amount',
        'Order Total',
        'Grand Total',
        'Final Amount',
        'Paid Amount',
        'Total',
        'Price',
        'Amount',
        'سعر طلبات',
        'مبلغ طلبات',
        'اجمالي طلبات',
        'إجمالي طلبات',
        'صافي طلبات',
        'قيمة طلبات',
        'صافي المبلغ',
        'المبلغ المدفوع',
        'اجمالي الطلب',
        'إجمالي الطلب',
        'المبلغ',
        'القيمة',
        'السعر',
      ]);

      const methodKey = findMatchingKeyWithValue(row, [
        'Cash Or Credit',
        'Cash or Credit',
        'Cash / Credit',
        'Cash/Credit',
        'Payment Method',
        'Payment Type',
        'Payment',
        'Pay Method',
        'Method',
        'Tender',
        'Tender Type',
        'Payment mode',
        'طريقة الدفع',
        'طريقة التحصيل',
        'نوع الدفع',
        'نوع التحصيل',
        'طريقة السداد',
        'الدفع',
      ]);

      const commentKey = findMatchingKeyWithValue(row, [
        'Comment',
        'Comments',
        'any rechargeable order to',
        'rechargeable order',
        'rechargeable',
        'ملاحظات',
        'الملاحظات',
        'ملاحظة',
        'Notes',
        'Note',
        'Reason',
        'السبب',
      ]);

      const varianceKey = findMatchingKeyWithValue(row, [
        'Varince',
        'Variance',
        'الفارق',
        'فرق',
        'Diff',
        'Difference',
      ]);

      const discBKKey = findMatchingKeyWithValue(row, [
        'Disc. On BK',
        'Disc On BK',
        'Discount BK',
        'Disc BK',
        'خصم المطعم',
        'خصم برجر كنج',
        'خصم برجر',
      ]);

      const discTalabatKey = findMatchingKeyWithValue(row, [
        'Disc. On Talabat',
        'Disc On Talabat',
        'Discount Talabat',
        'Disc Talabat',
        'خصم طلبات',
        'خصم موقع طلبات',
      ]);

      const dateTimeKey = findMatchingKeyWithValue(row, [
        'Date / Time',
        'Date/Time',
        'Date & Time',
        'Date Time',
        'Order Date',
        'Order Time',
        'Created At',
        'Creation Date',
        'Order Date / Time',
        'Date',
        'Time',
        'Timestamp',
        'التاريخ والوقت',
        'تاريخ الطلب',
        'وقت الطلب',
        'التاريخ',
        'الوقت',
      ]);

      const hostKey = findMatchingKeyWithValue(row, [
        'Host',
        'Cashier',
        'User',
        'Server',
        'Cashier Name',
        'Host Name',
        'الكاشير',
        'كاشير',
        'اسم الكاشير',
        'المستخدم',
        'الموظف',
      ]);

      const hostIdKey = findMatchingKeyWithValue(row, [
        'Host ID',
        'HostId',
        'Cashier ID',
        'CashierId',
        'User ID',
        'UserId',
        'رقم الكاشير',
        'كود الكاشير',
        'رقم المستخدم',
      ]);

      const terminalKey = findMatchingKeyWithValue(row, [
        'Terminal',
        'Term',
        'Station',
        'POS',
        'POS Station',
        'Station Name',
        'المحطة',
        'محطة',
        'رقم المحطة',
        'الجهاز',
        'نقطة البيع',
      ]);

      let rawNum = String(orderKey && row[orderKey] !== undefined ? row[orderKey] : '').trim();
      let rawOrderId = String(orderIdKey && row[orderIdKey] !== undefined ? row[orderIdKey] : '').trim();

      // If rawNum is '0' or contains only zeros, treat as empty (no Aloha check number in this row)
      if (rawNum === '0' || /^0+$/.test(rawNum)) {
        rawNum = '';
      }

      // If rawOrderId wasn't explicitly found, scan for a clean 8-14 digit Talabat ID in non-ignored columns
      if (!rawOrderId || rawOrderId === '—') {
        const rowKeys = Object.keys(row).filter(k => !isIgnoredKeyForMatching(k));
        for (const k of rowKeys) {
          if (k === orderKey || k === priceKey || k === talabatKey || k === dateTimeKey) continue;
          const valStr = String(row[k] || '').trim();
          const digits = valStr.replace(/\D/g, '');
          if (digits.length >= 8 && digits.length <= 14) {
            rawOrderId = digits;
            break;
          }
        }
      }

      // Disambiguate if rawNum was assigned a long 8+ digit Talabat ID
      const cleanRawNumDigits = rawNum.replace(/\D/g, '');
      const cleanRawOrderIdDigits = rawOrderId.replace(/\D/g, '');
      if (cleanRawNumDigits.length >= 8 && cleanRawNumDigits.length <= 14) {
        if (!rawOrderId || cleanRawOrderIdDigits.length < 8) {
          rawOrderId = rawNum;
          rawNum = '';
        }
      }

      const numDigitsOnly = rawNum.replace(/\D/g, '');

      let alohaPriceStr = String(priceKey && row[priceKey] !== undefined ? row[priceKey] : '')
        .replace(/,/g, '')
        .trim();
      let alohaPrice = parseFloat(alohaPriceStr) || 0;

      let talabatStr = String(talabatKey && row[talabatKey] !== undefined ? row[talabatKey] : '')
        .replace(/,/g, '')
        .trim();
      let talabat = parseFloat(talabatStr) || 0;

      const method = String(methodKey && row[methodKey] !== undefined ? row[methodKey] : '').trim();

      const { date, time, dateTime } = dateTimeKey
        ? formatExcelDateTime(row[dateTimeKey])
        : {};

      const excelHost = hostKey ? String(row[hostKey] || '').trim() : undefined;
      const excelHostId = hostIdKey ? String(row[hostIdKey] || '').trim() : undefined;
      const excelTerminal = terminalKey ? String(row[terminalKey] || '').trim() : undefined;

      // Check for Transfer Out / Zero transaction rows (e.g. Row 15: Transfer out | 0)
      const isTransferRow =
        /transfer|تحويل/i.test(rawNum) ||
        /transfer|تحويل/i.test(rawOrderId) ||
        /transfer|تحويل/i.test(method);

      if (isTransferRow) {
        if (!rawNum || !/transfer/i.test(rawNum)) rawNum = 'Transfer out';
        if (!rawOrderId) rawOrderId = 'Transfer out';
      }

      // Determine clean Aloha number and Order ID without dropping any row
      let number = '';
      if (rawNum && rawNum !== '0' && !rawNum.toLowerCase().includes('talabat') && cleanRawNumDigits.length <= 7) {
        number = numDigitsOnly || rawNum;
      }

      let orderId = rawOrderId;
      if (!orderId) {
        orderId = rawNum && cleanRawNumDigits.length >= 8 ? cleanRawNumDigits : '—';
      }

      if (!number) {
        // Tag as TAL-orderId or TAL-index so it clearly has no explicit Aloha check number
        number = orderId && orderId !== '—' ? `TAL-${orderId}` : `TAL-${idx + 1}`;
      }

      // Check if this row is an empty row or a purely summary text row (like 'Total' at the bottom with 0 values)
      const isPureSummary =
        (rawNum.toLowerCase().includes('total') ||
          rawNum.includes('إجمالي') ||
          rawNum.includes('مجموع') ||
          rawOrderId.toLowerCase().includes('total') ||
          rawOrderId.includes('إجمالي')) &&
        talabat === 0 &&
        alohaPrice === 0 &&
        !isTransferRow;

      const hasAnyContent =
        rawNum !== '' ||
        rawOrderId !== '' ||
        talabat > 0 ||
        alohaPrice > 0 ||
        method !== '' ||
        isTransferRow ||
        Boolean(dateTime);

      if (!hasAnyContent || isPureSummary) {
        return null;
      }

      // Categorize payment method in Excel
      const lowerMethod = method.toLowerCase();
      if (lowerMethod === 'cash' || lowerMethod.includes('كاش') || lowerMethod.includes('نقدي') || lowerMethod.includes('نقدى')) {
        paymentTotals.cash.count++;
        paymentTotals.cash.total += talabat;
      } else if (
        lowerMethod.includes('card') ||
        lowerMethod.includes('visa') ||
        lowerMethod.includes('master') ||
        lowerMethod.includes('بطاقة') ||
        lowerMethod.includes('فيزا')
      ) {
        paymentTotals.card.count++;
        paymentTotals.card.total += talabat;
      } else if (
        lowerMethod.includes('talabat') ||
        lowerMethod.includes('otlob') ||
        lowerMethod.includes('credit') ||
        lowerMethod.includes('أونلاين') ||
        lowerMethod.includes('online') ||
        lowerMethod.includes('رصيد')
      ) {
        paymentTotals.talabat.count++;
        paymentTotals.talabat.total += talabat;
      } else if (talabat > 0 || method) {
        paymentTotals.other.count++;
        paymentTotals.other.total += talabat;
      }

      const excelComment = commentKey ? String(row[commentKey] || '').trim() : undefined;
      const excelVarianceVal = varianceKey ? parseFloat(String(row[varianceKey] || '').replace(/,/g, '')) : undefined;
      const excelVariance = !isNaN(Number(excelVarianceVal)) ? excelVarianceVal : undefined;
      const excelDiscBKVal = discBKKey ? parseFloat(String(row[discBKKey] || '').replace(/,/g, '')) : undefined;
      const excelDiscBK = !isNaN(Number(excelDiscBKVal)) ? excelDiscBKVal : undefined;
      const excelDiscTalabat = discTalabatKey ? String(row[discTalabatKey] || '').trim() : undefined;

      return {
        number,
        orderId,
        alohaPrice: Number(alohaPrice.toFixed(2)),
        talabat: Number(talabat.toFixed(2)),
        method: method || 'Unspecified',
        date,
        time,
        dateTime,
        host: excelHost,
        hostId: excelHostId,
        terminal: excelTerminal,
        comment: excelComment,
        variance: excelVariance,
        discOnBK: excelDiscBK,
        discOnTalabat: excelDiscTalabat,
        rawRow: row,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  paymentTotals.cash.total = Number(paymentTotals.cash.total.toFixed(2));
  paymentTotals.card.total = Number(paymentTotals.card.total.toFixed(2));
  paymentTotals.talabat.total = Number(paymentTotals.talabat.total.toFixed(2));
  paymentTotals.other.total = Number(paymentTotals.other.total.toFixed(2));
  paymentTotals.grandTotal = Number(
    (
      paymentTotals.cash.total +
      paymentTotals.card.total +
      paymentTotals.talabat.total +
      paymentTotals.other.total
    ).toFixed(2)
  );
  paymentTotals.totalCount = comparisonData.length;

  return { comparisonData, excelPayments: paymentTotals };
}

export function parseCrossReferenceRows(rawRows: any[]): CrossReferenceEntry[] {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return [];
  const entries: CrossReferenceEntry[] = [];

  rawRows.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;

    const dayKey = findMatchingKeyWithValue(row, [
      'day',
      'Day',
      'اليوم',
      'الوردية',
      'Shift',
      'Date',
      'التاريخ',
    ]);

    const alohaNoKey = findMatchingKeyWithValue(row, [
      'Aloha Order No.',
      'Aloha Order No',
      'Aloha Order #',
      'Aloha Order',
      'Aloha No.',
      'Aloha No',
      'Aloha Number',
      'Aloha #',
      'Check No',
      'Check Number',
      'Check #',
      'رقم الالوها',
      'رقم الألوها',
      'رقم الشيك',
      'الشيك',
      'رقم البون',
    ]);

    const alohaAmKey = findMatchingKeyWithValue(row, [
      'Aloha AM',
      'Aloha AM.',
      'Aloha_AM',
      'Aloha Price',
      'Aloha Amount',
      'Aloha Total',
      'مبلغ الالوها',
      'مبلغ الألوها',
      'سعر الالوها',
      'سعر الألوها',
      'اجمالي الالوها',
    ]);

    const discBKKey = findMatchingKeyWithValue(row, [
      'Disc. On BK',
      'Disc On BK',
      'Discount BK',
      'Disc BK',
      'خصم المطعم',
      'خصم برجر كنج',
      'خصم برجر',
    ]);

    const talabatAmKey = findMatchingKeyWithValue(row, [
      'Talabat AM',
      'Talabat AM.',
      'Talabat_AM',
      'Talabat Price',
      'Talabat Amount',
      'Talabat Total',
      'Talabat Net',
      'مبلغ طلبات',
      'سعر طلبات',
      'اجمالي طلبات',
      'إجمالي طلبات',
      'قيمة طلبات',
    ]);

    const talabatOrderNoKey = findMatchingKeyWithValue(row, [
      'Talabat order NO.',
      'Talabat order NO',
      'Talabat order No.',
      'Talabat order No',
      'Talabat Order #',
      'Talabat Order ID',
      'Talabat Order Id',
      'Talabat Order Number',
      'Talabat NO.',
      'Talabat NO',
      'Talabat No.',
      'Talabat ID',
      'Order Id',
      'OrderID',
      'رقم طلبات',
      'كود طلبات',
      'رقم اوردر طلبات',
      'رقم أوردر طلبات',
      'طلب طلبات',
    ]);

    const discTalabatKey = findMatchingKeyWithValue(row, [
      'Disc. On Talabat',
      'Disc On Talabat',
      'Discount Talabat',
      'Disc Talabat',
      'خصم طلبات',
      'خصم موقع طلبات',
    ]);

    const varianceKey = findMatchingKeyWithValue(row, [
      'Varince',
      'Variance',
      'الفارق',
      'فرق',
      'Diff',
      'Difference',
    ]);

    const methodKey = findMatchingKeyWithValue(row, [
      'Cash Or Credit',
      'Cash or Credit',
      'Cash / Credit',
      'Cash/Credit',
      'Payment Method',
      'Payment Type',
      'Payment',
      'طريقة الدفع',
      'طريقة التحصيل',
      'نوع الدفع',
      'كاش او كريديت',
      'كاش أو كريديت',
    ]);

    const commentKey = findMatchingKeyWithValue(row, [
      'Comment',
      'Comments',
      'ملاحظات',
      'الملاحظات',
      'ملاحظة',
      'Notes',
      'Note',
      'Reason',
      'السبب',
    ]);

    let day = dayKey ? String(row[dayKey] || '').trim() : '';
    let rawAlohaNo = alohaNoKey ? String(row[alohaNoKey] || '').trim() : '';
    let rawTalabatOrderNo = talabatOrderNoKey ? String(row[talabatOrderNoKey] || '').trim() : '';

    let alohaAmount = alohaAmKey ? parseFloat(String(row[alohaAmKey] || '').replace(/,/g, '')) || 0 : 0;
    let talabatAmount = talabatAmKey ? parseFloat(String(row[talabatAmKey] || '').replace(/,/g, '')) || 0 : 0;
    let discOnBK = discBKKey ? parseFloat(String(row[discBKKey] || '').replace(/,/g, '')) || 0 : undefined;
    let discOnTalabat = discTalabatKey ? String(row[discTalabatKey] || '').trim() : undefined;
    let varianceVal = varianceKey ? parseFloat(String(row[varianceKey] || '').replace(/,/g, '')) : undefined;
    let variance = !isNaN(Number(varianceVal)) ? Number(varianceVal) : Number((alohaAmount - talabatAmount).toFixed(2));
    let paymentMethod = methodKey ? String(row[methodKey] || '').trim() : (isCashPayment(row[methodKey]) ? 'cash' : 'credit');
    let comment = commentKey ? String(row[commentKey] || '').trim() : undefined;

    // Disambiguate if Aloha / Talabat IDs were placed inversely
    if (rawAlohaNo.length >= 8 && rawTalabatOrderNo.length < 8 && rawTalabatOrderNo !== '') {
      const tmp = rawAlohaNo;
      rawAlohaNo = rawTalabatOrderNo;
      rawTalabatOrderNo = tmp;
    }

    if (!rawAlohaNo && !rawTalabatOrderNo && alohaAmount === 0 && talabatAmount === 0) {
      return;
    }

    entries.push({
      id: `ref_entry_${idx}_${rawAlohaNo}_${rawTalabatOrderNo}`,
      day: day || `day 1`,
      alohaOrderNo: rawAlohaNo || (alohaAmount > 0 ? `CHK-${idx + 1}` : '0'),
      alohaAmount: Number(alohaAmount.toFixed(2)),
      discOnBK,
      talabatAmount: Number(talabatAmount.toFixed(2)),
      talabatOrderNo: rawTalabatOrderNo || '—',
      discOnTalabat,
      variance: Number(variance.toFixed(2)),
      paymentMethod: paymentMethod || 'cash',
      comment: comment ? comment.trim() : undefined,
      rawText: JSON.stringify(row),
    });
  });

  return entries;
}

export function parseCrossReferenceText(text: string): CrossReferenceEntry[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Check if first line is headers
  const firstLine = lines[0].toLowerCase();
  const hasHeaders =
    firstLine.includes('aloha') ||
    firstLine.includes('talabat') ||
    firstLine.includes('order') ||
    firstLine.includes('check') ||
    firstLine.includes('day') ||
    firstLine.includes('شيك') ||
    firstLine.includes('طلبات') ||
    firstLine.includes('مبلغ') ||
    firstLine.includes('سعر');

  const dataLines = hasHeaders ? lines.slice(1) : lines;
  const entries: CrossReferenceEntry[] = [];

  dataLines.forEach((line, idx) => {
    let parts: string[] = [];
    if (line.includes('\t')) parts = line.split('\t');
    else if (line.includes(',')) parts = line.split(',');
    else if (line.includes(';')) parts = line.split(';');
    else if (line.includes('|')) parts = line.split('|');
    else parts = line.split(/\s{2,}/);

    parts = parts.map(p => p.trim());
    if (parts.length < 2) return;

    let day = 'day 1';
    let alohaOrderNo = '';
    let alohaAmount = 0;
    let discOnBK: number | undefined = undefined;
    let talabatAmount = 0;
    let talabatOrderNo = '';
    let discOnTalabat: string | undefined = undefined;
    let variance = 0;
    let paymentMethod = 'cash';
    let comment = '';

    if (parts.length >= 7) {
      day = parts[0] || 'day 1';
      alohaOrderNo = parts[1] || '';
      alohaAmount = parseFloat(parts[2].replace(/,/g, '')) || 0;
      discOnBK = parseFloat(parts[3].replace(/,/g, '')) || 0;
      talabatAmount = parseFloat(parts[4].replace(/,/g, '')) || 0;
      talabatOrderNo = parts[5] || '';
      discOnTalabat = parts[6] || '0';
      variance = parts[7] ? parseFloat(parts[7].replace(/,/g, '')) : Number((alohaAmount - talabatAmount).toFixed(2));
      paymentMethod = parts[8] || (isCashPayment(parts[8]) ? 'cash' : 'credit');
      if (parts[9]) comment = parts[9];
    } else {
      for (const part of parts) {
        const clean = part.replace(/\D/g, '');
        if (clean.length >= 8 && !talabatOrderNo) {
          talabatOrderNo = clean;
        } else if (clean.length >= 2 && clean.length <= 6 && !alohaOrderNo) {
          alohaOrderNo = clean;
        } else if (!isNaN(parseFloat(part)) && alohaAmount === 0) {
          alohaAmount = parseFloat(part);
        } else if (!isNaN(parseFloat(part)) && talabatAmount === 0) {
          talabatAmount = parseFloat(part);
        } else if (isCashPayment(part) || isOnlinePayment(part)) {
          paymentMethod = isCashPayment(part) ? 'cash' : 'credit';
        }
      }
      variance = Number((alohaAmount - talabatAmount).toFixed(2));
    }

    if (alohaOrderNo || talabatOrderNo || alohaAmount > 0 || talabatAmount > 0) {
      entries.push({
        id: `ref_txt_${idx}_${alohaOrderNo}_${talabatOrderNo}`,
        day,
        alohaOrderNo: alohaOrderNo || (alohaAmount > 0 ? `CHK-${idx + 1}` : '0'),
        alohaAmount: Number(alohaAmount.toFixed(2)),
        discOnBK,
        talabatAmount: Number(talabatAmount.toFixed(2)),
        talabatOrderNo: talabatOrderNo || '—',
        discOnTalabat,
        variance: Number(variance.toFixed(2)),
        paymentMethod: paymentMethod || 'cash',
        comment,
        rawText: line,
      });
    }
  });

  return entries;
}

export function isOnlinePayment(methodStr?: string): boolean {
  if (!methodStr) return false;
  const m = String(methodStr).toLowerCase().trim();
  if (m === 'not in aloha' || m === '—' || m === '') return false;
  return (
    m.includes('otlob') ||
    m.includes('talabat') ||
    m.includes('credit') ||
    m.includes('card') ||
    m.includes('visa') ||
    m.includes('master') ||
    m.includes('online') ||
    m.includes('prepaid') ||
    m.includes('بطاقة') ||
    m.includes('فيزا') ||
    m.includes('ماستر') ||
    m.includes('أونلاين') ||
    m.includes('اونلاين') ||
    m.includes('إلكتروني') ||
    m.includes('الكتروني')
  );
}

export function isCashPayment(methodStr?: string): boolean {
  if (!methodStr) return false;
  const m = String(methodStr).toLowerCase().trim();
  if (m === 'not in aloha' || m === '—' || m === '') return false;
  return (
    m === 'cash' ||
    m.includes('cash') ||
    m.includes('كاش') ||
    m.includes('نقدي') ||
    m.includes('نقدى') ||
    m.includes('نقد')
  );
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
export function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Evaluates digit similarity between Order ID / Check Numbers (strictly handles single-digit typo or suffix/subset)
 * e.g. 3737643102 vs 3736643102 -> 1 extra digit typo
 */
export function calculateIdFuzzyScore(
  rawIdA: string,
  rawIdB: string
): { isFuzzyMatch: boolean; similarity: number; reason: string } {
  if (!rawIdA || !rawIdB) return { isFuzzyMatch: false, similarity: 0, reason: '' };

  const a = rawIdA.replace(/\D/g, '');
  const b = rawIdB.replace(/\D/g, '');

  if (!a || !b) return { isFuzzyMatch: false, similarity: 0, reason: '' };
  if (a === b) return { isFuzzyMatch: true, similarity: 100, reason: 'Exact ID match' };

  // Strip leading zeros
  const aClean = a.replace(/^0+/, '');
  const bClean = b.replace(/^0+/, '');
  if (aClean === bClean && aClean.length >= 3) {
    return { isFuzzyMatch: true, similarity: 100, reason: 'Exact ID match (normalized zeros)' };
  }

  const maxLen = Math.max(a.length, b.length);
  const minLen = Math.min(a.length, b.length);

  // Substring match only when minimum length is substantial (e.g. at least 7 matching digits or full suffix)
  if (minLen >= 7 && (a.endsWith(b) || b.endsWith(a) || a.includes(b) || b.includes(a))) {
    const sim = Math.round((minLen / maxLen) * 100);
    if (sim >= 85) {
      return { isFuzzyMatch: true, similarity: sim, reason: `Exact partial ID subset (${minLen}/${maxLen} digits)` };
    }
  }

  // Levenshtein edit distance for single-digit typo / single missing digit only (e.g. 3737643102 vs 3736643102)
  if (maxLen >= 8) {
    const dist = getLevenshteinDistance(a, b);
    if (dist === 1) {
      const sim = Math.round(((maxLen - dist) / maxLen) * 100);
      return { isFuzzyMatch: true, similarity: sim, reason: `Single digit typo/extra digit (${a} vs ${b})` };
    }
  }

  return { isFuzzyMatch: false, similarity: 0, reason: '' };
}

/**
 * Strict compatibility check to ensure an Aloha order and an Excel item
 * are NEVER paired together if they have conflicting Order IDs or Check numbers.
 */
export function areOrdersIncompatible(
  local: ParsedOrder,
  excelItem: { number: string; orderId: string }
): boolean {
  if (!local || !excelItem) return false;

  const localNumDigits = (local.number || '').replace(/\D/g, '');
  const excelNumDigits = (excelItem.number || '').replace(/\D/g, '');

  const cleanLocalCheck = localNumDigits.length <= 7 ? localNumDigits.replace(/^0+/, '') : '';
  const isExcelAlohaCheck =
    excelNumDigits.length >= 2 &&
    excelNumDigits.length <= 6 &&
    !excelItem.number.startsWith('TAL-') &&
    excelItem.number !== excelItem.orderId &&
    !isIgnoredKeyForMatching(excelItem.number);

  const cleanExcelCheck = isExcelAlohaCheck ? excelNumDigits.replace(/^0+/, '') : '';

  // 1. If BOTH sides have an explicit Aloha Check number, check for match or conflict
  if (cleanLocalCheck.length >= 2 && cleanExcelCheck.length >= 2) {
    if (cleanLocalCheck === cleanExcelCheck) return false;
    // Both have explicit DIFFERENT Aloha check numbers!
    return true;
  }

  // Extract clean digits of Talabat Order IDs
  const localAuthDigits = (local.authNumber || '').replace(/\D/g, '');
  const localTalabatId = localAuthDigits.length >= 6 ? localAuthDigits : localNumDigits.length >= 8 ? localNumDigits : '';

  const excelOrderDigits = (excelItem.orderId || '').replace(/\D/g, '');
  const excelTalabatId =
    excelOrderDigits.length >= 6 && !excelItem.orderId.startsWith('TAL-')
      ? excelOrderDigits
      : excelNumDigits.length >= 8
      ? excelNumDigits
      : '';

  // 2. If BOTH sides have an explicit Talabat order ID (>= 6 digits)
  if (localTalabatId.length >= 6 && excelTalabatId.length >= 6) {
    if (localTalabatId === excelTalabatId) return false;
    const fuzzy = calculateIdFuzzyScore(localTalabatId, excelTalabatId);
    if (fuzzy.isFuzzyMatch && fuzzy.similarity >= 85) return false;
    // CONFLICT: Both sides have completely distinct, non-matching Talabat Order IDs!
    return true;
  }

  // 3. Check raw text of receipt for any explicit 8-14 digit Talabat IDs
  if (local.rawText && excelTalabatId.length >= 8) {
    const rawTokens: string[] = (local.rawText.match(/\b(37\d{8}|\d{8,14})\b/g) as string[] | null) || [];
    if (rawTokens.length > 0) {
      if (rawTokens.includes(excelTalabatId)) return false;
      const anyFuzzy = rawTokens.some(t => calculateIdFuzzyScore(t, excelTalabatId).isFuzzyMatch);
      if (!anyFuzzy) return true; // Conflicting explicit Talabat IDs
    }
  }

  return false;
}

export function buildReconciliation(
  parsedOrders: ParsedOrder[],
  excelItems: Array<{
    number: string;
    orderId: string;
    alohaPrice: number;
    talabat: number;
    method: string;
    date?: string;
    time?: string;
    dateTime?: string;
    host?: string;
    hostId?: string;
    terminal?: string;
    comment?: string;
    variance?: number;
    discOnBK?: number;
    discOnTalabat?: string;
    day?: string;
  }>,
  crossReferenceEntries?: CrossReferenceEntry[]
): {
  rows: ComparisonRow[];
  summary: ReconciliationSummary;
} {
  const localMatched = new Set<string>();
  const excelMatchedIndices = new Set<number>();

  let grossDeficitTotal = 0;
  let grossSurplusTotal = 0;
  let matchCount = 0;
  let deficitCount = 0;
  let surplusCount = 0;
  let methodMismatchCount = 0;
  let missingInTalabatCount = 0;
  let missingInAlohaCount = 0;
  let missingInTalabatTotal = 0;
  let missingInAlohaTotal = 0;
  let paymentMethodConflictTotal = 0;

  const rows: ComparisonRow[] = [];

  // Data structure to hold matched pairs: { excelIdx: number, localOrder?: ParsedOrder, matchType: string, confidence: number, fuzzyReason?: string }
  const pairMatches: Array<{
    excelIdx: number;
    localOrder?: ParsedOrder;
    matchType: 'exact_id' | 'fuzzy_id_price' | 'exact_amount' | 'promo_amount' | 'similar_amount' | 'suggested_match' | 'none';
    matchConfidence: number;
    fuzzyReason?: string;
    refEntry?: CrossReferenceEntry;
  }> = [];

  // =========================================================================
  // PASS 0: Transfer Out and Zero Transaction Rows (e.g. Transfer out | 0)
  // =========================================================================
  excelItems.forEach((item, idx) => {
    const isTransfer =
      /transfer|تحويل/i.test(item.number) ||
      /transfer|تحويل/i.test(item.orderId) ||
      /transfer|تحويل/i.test(item.method) ||
      (item.talabat === 0 &&
        item.alohaPrice === 0 &&
        (item.number.toLowerCase().includes('trans') || item.orderId.toLowerCase().includes('trans')));

    if (isTransfer) {
      excelMatchedIndices.add(idx);
      pairMatches.push({
        excelIdx: idx,
        localOrder: undefined,
        matchType: 'exact_id',
        matchConfidence: 100,
        fuzzyReason: 'Transfer Out',
      });
    }
  });

  // =========================================================================
  // PASS 0.5: Master 3-Way Cross-Reference Reconciliation (Explicit Mapping)
  // For links provided by the 3-Way Reference Form (Aloha Order No <-> Talabat Order No)
  // =========================================================================
  if (crossReferenceEntries && crossReferenceEntries.length > 0) {
    const crossRefByTalabat = new Map<string, CrossReferenceEntry>();
    const crossRefByAloha = new Map<string, CrossReferenceEntry>();

    crossReferenceEntries.forEach(entry => {
      const cleanT = entry.talabatOrderNo.replace(/\D/g, '');
      const cleanA = entry.alohaOrderNo.replace(/\D/g, '');
      if (cleanT.length >= 6) crossRefByTalabat.set(cleanT, entry);
      if (cleanA.length >= 2) crossRefByAloha.set(cleanA, entry);
      // also exact string lookup
      if (entry.talabatOrderNo && entry.talabatOrderNo !== '—') crossRefByTalabat.set(entry.talabatOrderNo.trim(), entry);
      if (entry.alohaOrderNo && entry.alohaOrderNo !== '—') crossRefByAloha.set(entry.alohaOrderNo.trim(), entry);
    });

    excelItems.forEach((item, idx) => {
      if (excelMatchedIndices.has(idx)) return;
      const cleanT = (item.orderId || '').replace(/\D/g, '');
      const cleanA = (item.number || '').replace(/\D/g, '');
      const rawT = (item.orderId || '').trim();
      const rawA = (item.number || '').trim();

      const refEntry =
        (cleanT && crossRefByTalabat.get(cleanT)) ||
        (rawT && crossRefByTalabat.get(rawT)) ||
        (cleanA && crossRefByAloha.get(cleanA)) ||
        (rawA && crossRefByAloha.get(rawA));

      if (refEntry) {
        const cleanRefAloha = refEntry.alohaOrderNo.replace(/\D/g, '');
        let local = parsedOrders.find(
          o =>
            !localMatched.has(o.id) &&
            (o.number === refEntry.alohaOrderNo ||
              (cleanRefAloha && o.number.replace(/\D/g, '') === cleanRefAloha))
        );

        if (!local) {
          local = {
            id: `cross_ref_synth_${refEntry.id || idx}`,
            number: refEntry.alohaOrderNo,
            orderType: 'Otlob.com',
            payment: isCashPayment(refEntry.paymentMethod) ? 'Cash' : 'Otlob Mode',
            amount: refEntry.alohaAmount > 0 ? refEntry.alohaAmount : item.alohaPrice > 0 ? item.alohaPrice : item.talabat,
            authNumber: refEntry.talabatOrderNo,
            time: item.time,
            date: item.date,
            dayLabel: refEntry.day,
          };
        } else {
          localMatched.add(local.id);
        }

        excelMatchedIndices.add(idx);
        pairMatches.push({
          excelIdx: idx,
          localOrder: local,
          matchType: 'exact_id',
          matchConfidence: 100,
          fuzzyReason: refEntry.comment || undefined,
          refEntry,
        });
      }
    });
  }

  // =========================================================================
  // PASS 1: Exact Check # or Talabat Order ID / Auth Number
  // =========================================================================
  excelItems.forEach((item, idx) => {
    if (excelMatchedIndices.has(idx)) return;
    let local: ParsedOrder | undefined;

    const cleanOrderId = item.orderId ? item.orderId.replace(/\D/g, '') : '';
    const cleanNumber = item.number ? item.number.replace(/\D/g, '') : '';

    // 1.1 Match by Order ID / Auth Number (Direct match against authNumber, check number, or raw receipt text)
    if (cleanOrderId && cleanOrderId.length >= 6) {
      local = parsedOrders.find(
        o =>
          !localMatched.has(o.id) &&
          (o.authNumber === cleanOrderId ||
            o.authNumber === item.orderId ||
            o.number === cleanOrderId ||
            (o.rawText && (o.rawText.includes(cleanOrderId) || o.rawText.includes(item.orderId))))
      );
    }

    // 1.2 Match by Aloha Check Number
    if (!local && cleanNumber) {
      local = parsedOrders.find(
        o =>
          !localMatched.has(o.id) &&
          !areOrdersIncompatible(o, item) &&
          (o.number === item.number ||
            o.number === cleanNumber ||
            o.number === cleanNumber.replace(/^0+/, ''))
      );
    }

    // 1.3 Match across raw tokens in receipt
    if (!local && cleanOrderId && cleanOrderId.length >= 7) {
      local = parsedOrders.find(
        o =>
          !localMatched.has(o.id) &&
          !areOrdersIncompatible(o, item) &&
          o.rawText &&
          new RegExp(`\\b${cleanOrderId}\\b`).test(o.rawText)
      );
    }

    if (local) {
      localMatched.add(local.id);
      excelMatchedIndices.add(idx);
      pairMatches.push({
        excelIdx: idx,
        localOrder: local,
        matchType: 'exact_id',
        matchConfidence: 100,
      });
    }
  });

  // =========================================================================
  // PASS 1.5: Fuzzy ID Recognition (Only for typo / dropped digit in exact same ID)
  // Handles cases where 1 digit is mistyped in the 10-digit Talabat ID (e.g. 3737643102 vs 373643102)
  // Strict: Requires at least 85% character similarity in the long order number
  // =========================================================================
  excelItems.forEach((item, idx) => {
    if (excelMatchedIndices.has(idx)) return;
    if (!item.orderId || item.orderId === '—') return;

    for (const order of parsedOrders) {
      if (localMatched.has(order.id)) continue;
      if (areOrdersIncompatible(order, item)) continue;

      const potentialNumbers: string[] = [];
      if (order.authNumber) potentialNumbers.push(order.authNumber);
      if (order.rawText) {
        const rawTokens = order.rawText.match(/\b\d{6,14}\b/g) || [];
        for (const token of rawTokens) {
          if (!potentialNumbers.includes(token)) potentialNumbers.push(token);
        }
      }

      let bestFuzzy = { isFuzzyMatch: false, similarity: 0, reason: '' };
      for (const candidateNum of potentialNumbers) {
        const res = calculateIdFuzzyScore(item.orderId, candidateNum);
        if (res.isFuzzyMatch && res.similarity >= 85 && res.similarity > bestFuzzy.similarity) {
          bestFuzzy = res;
        }
      }

      if (bestFuzzy.isFuzzyMatch) {
        localMatched.add(order.id);
        excelMatchedIndices.add(idx);
        pairMatches.push({
          excelIdx: idx,
          localOrder: order,
          matchType: 'fuzzy_id_price',
          matchConfidence: bestFuzzy.similarity,
          fuzzyReason: bestFuzzy.reason,
        });
        break;
      }
    }
  });

  // =========================================================================
  // PASS 2: Exact Amount (100% Identical Price) with Multi-Factor Alignment
  // Intelligently matches when Aloha check numbers/prices were omitted in the Excel
  // Evaluates payment method (+50), date (+20), timestamp proximity (+40), and chronological position (+30)
  // =========================================================================
  excelItems.forEach((item, idx) => {
    if (excelMatchedIndices.has(idx)) return;
    if (item.talabat <= 0 && item.alohaPrice <= 0) return;

    const targetAmount = item.talabat > 0 ? item.talabat : item.alohaPrice;
    const isTalabatCash = isCashPayment(item.method);
    const isTalabatOnline = isOnlinePayment(item.method);

    // Find candidate unmatched Aloha orders with the EXACT same amount (difference < 0.02)
    const exactAmountCandidates = parsedOrders.filter(
      o => !localMatched.has(o.id) && Math.abs(o.amount - targetAmount) < 0.02 && !areOrdersIncompatible(o, item)
    );

    if (exactAmountCandidates.length > 0) {
      const excelTimeMs = parseDateTimeToTimestamp(item.date, item.time, item.dateTime);
      const relativeExcelPos = idx / Math.max(1, excelItems.length);

      // Rank candidate by tender match, date, time delta, and sequence order
      exactAmountCandidates.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;

        const aIsCash = isCashPayment(a.payment);
        const bIsCash = isCashPayment(b.payment);
        const aIsOnline = isOnlinePayment(a.payment);
        const bIsOnline = isOnlinePayment(b.payment);

        if ((isTalabatCash && aIsCash) || (isTalabatOnline && aIsOnline)) scoreA += 50;
        if ((isTalabatCash && bIsCash) || (isTalabatOnline && bIsOnline)) scoreB += 50;

        if (item.date && a.date && item.date === a.date) scoreA += 20;
        if (item.date && b.date && item.date === b.date) scoreB += 20;

        // Proximity in Time
        if (excelTimeMs > 0) {
          const aTimeMs = parseDateTimeToTimestamp(a.date, a.time, a.dateTime);
          const bTimeMs = parseDateTimeToTimestamp(b.date, b.time, b.dateTime);
          if (aTimeMs > 0) {
            const diffMinA = Math.abs(excelTimeMs - aTimeMs) / 60000;
            if (diffMinA <= 15) scoreA += 40;
            else if (diffMinA <= 45) scoreA += 25;
            else if (diffMinA <= 120) scoreA += 10;
          }
          if (bTimeMs > 0) {
            const diffMinB = Math.abs(excelTimeMs - bTimeMs) / 60000;
            if (diffMinB <= 15) scoreB += 40;
            else if (diffMinB <= 45) scoreB += 25;
            else if (diffMinB <= 120) scoreB += 10;
          }
        }

        // Relative sequential index alignment in batch
        const aIdx = parsedOrders.indexOf(a);
        const bIdx = parsedOrders.indexOf(b);
        const distA = Math.abs(relativeExcelPos - aIdx / Math.max(1, parsedOrders.length));
        const distB = Math.abs(relativeExcelPos - bIdx / Math.max(1, parsedOrders.length));
        scoreA += Math.max(0, 30 * (1 - distA));
        scoreB += Math.max(0, 30 * (1 - distB));

        return scoreB - scoreA;
      });

      const bestMatch = exactAmountCandidates[0];
      localMatched.add(bestMatch.id);
      excelMatchedIndices.add(idx);
      pairMatches.push({
        excelIdx: idx,
        localOrder: bestMatch,
        matchType: 'exact_amount',
        matchConfidence: 95,
      });
    }
  });

  // =========================================================================
  // PASS 3: Net Promo Discount Amount Matching
  // (e.g. Aloha Gross - Discount == Talabat Net Price)
  // =========================================================================
  excelItems.forEach((item, idx) => {
    if (excelMatchedIndices.has(idx)) return;
    if (item.talabat <= 0) return;

    const promoCandidates = parsedOrders.filter(
      o =>
        !localMatched.has(o.id) &&
        !areOrdersIncompatible(o, item) &&
        o.discount &&
        o.discount > 0 &&
        Math.abs(item.talabat - (o.amount - o.discount)) < 0.05
    );

    if (promoCandidates.length > 0) {
      const bestMatch = promoCandidates[0];
      localMatched.add(bestMatch.id);
      excelMatchedIndices.add(idx);
      pairMatches.push({
        excelIdx: idx,
        localOrder: bestMatch,
        matchType: 'promo_amount',
        matchConfidence: 90,
      });
    }
  });

  // =========================================================================
  // PASS 3.2: Delivery Fee & Surcharge Offset Matching (e.g. ~35, 30, 25, 20 EGP variance)
  // Connects orders where Talabat Net and Aloha Total differ by standard delivery fee
  // =========================================================================
  excelItems.forEach((item, idx) => {
    if (excelMatchedIndices.has(idx)) return;
    if (item.talabat <= 0) return;

    const commonFees = [35, 35.01, 34.99, 30, 25, 20, 15, 40, 10, 50];
    const deliveryFeeCandidates = parsedOrders.filter(o => {
      if (localMatched.has(o.id)) return false;
      if (!isTalabatReconciliationOrder(o)) return false;
      if (areOrdersIncompatible(o, item)) return false;
      const diff = Math.abs(o.amount - item.talabat);
      return commonFees.some(f => Math.abs(diff - f) <= 1.05);
    });

    if (deliveryFeeCandidates.length > 0) {
      const isTalabatCash = isCashPayment(item.method);
      const isTalabatOnline = isOnlinePayment(item.method);
      const relativeExcelPos = idx / Math.max(1, excelItems.length);

      deliveryFeeCandidates.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        if ((isTalabatCash && isCashPayment(a.payment)) || (isTalabatOnline && isOnlinePayment(a.payment))) scoreA += 50;
        if ((isTalabatCash && isCashPayment(b.payment)) || (isTalabatOnline && isOnlinePayment(b.payment))) scoreB += 50;
        const distA = Math.abs(relativeExcelPos - parsedOrders.indexOf(a) / Math.max(1, parsedOrders.length));
        const distB = Math.abs(relativeExcelPos - parsedOrders.indexOf(b) / Math.max(1, parsedOrders.length));
        scoreA += Math.max(0, 30 * (1 - distA));
        scoreB += Math.max(0, 30 * (1 - distB));
        return scoreB - scoreA;
      });

      const bestMatch = deliveryFeeCandidates[0];
      localMatched.add(bestMatch.id);
      excelMatchedIndices.add(idx);
      pairMatches.push({
        excelIdx: idx,
        localOrder: bestMatch,
        matchType: 'similar_amount',
        matchConfidence: 85,
        fuzzyReason: `Delivery fee variance (~${Math.abs(bestMatch.amount - item.talabat).toFixed(2)} EGP)`,
      });
    }
  });

  // =========================================================================
  // PASS 3.5: Chronological Sequence & Small Price Variance Matching (Deficit / Surplus Correlation)
  // Connects un-numbered orders with slight differences (e.g. delivery fee or minor discount <= 40 EGP)
  // =========================================================================
  excelItems.forEach((item, idx) => {
    if (excelMatchedIndices.has(idx)) return;
    if (item.talabat <= 0) return;

    const isTalabatCash = isCashPayment(item.method);
    const isTalabatOnline = isOnlinePayment(item.method);
    const excelTimeMs = parseDateTimeToTimestamp(item.date, item.time, item.dateTime);
    const relativeExcelPos = idx / Math.max(1, excelItems.length);

    const closeCandidates = parsedOrders.filter(
      o =>
        !localMatched.has(o.id) &&
        isTalabatReconciliationOrder(o) &&
        !areOrdersIncompatible(o, item) &&
        Math.abs(o.amount - item.talabat) <= 40
    );

    if (closeCandidates.length > 0) {
      closeCandidates.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;

        const aIsCash = isCashPayment(a.payment);
        const bIsCash = isCashPayment(b.payment);
        const aIsOnline = isOnlinePayment(a.payment);
        const bIsOnline = isOnlinePayment(b.payment);

        if ((isTalabatCash && aIsCash) || (isTalabatOnline && aIsOnline)) scoreA += 50;
        if ((isTalabatCash && bIsCash) || (isTalabatOnline && bIsOnline)) scoreB += 50;

        if (excelTimeMs > 0) {
          const aTimeMs = parseDateTimeToTimestamp(a.date, a.time, a.dateTime);
          const bTimeMs = parseDateTimeToTimestamp(b.date, b.time, b.dateTime);
          if (aTimeMs > 0) {
            const diffMinA = Math.abs(excelTimeMs - aTimeMs) / 60000;
            if (diffMinA <= 20) scoreA += 40;
            else if (diffMinA <= 60) scoreA += 20;
          }
          if (bTimeMs > 0) {
            const diffMinB = Math.abs(excelTimeMs - bTimeMs) / 60000;
            if (diffMinB <= 20) scoreB += 40;
            else if (diffMinB <= 60) scoreB += 20;
          }
        }

        const aIdx = parsedOrders.indexOf(a);
        const bIdx = parsedOrders.indexOf(b);
        const distA = Math.abs(relativeExcelPos - aIdx / Math.max(1, parsedOrders.length));
        const distB = Math.abs(relativeExcelPos - bIdx / Math.max(1, parsedOrders.length));
        scoreA += Math.max(0, 30 * (1 - distA));
        scoreB += Math.max(0, 30 * (1 - distB));

        // Penalty for price variance
        scoreA -= Math.abs(a.amount - item.talabat);
        scoreB -= Math.abs(b.amount - item.talabat);

        return scoreB - scoreA;
      });

      const bestCandidate = closeCandidates[0];
      if (bestCandidate) {
        localMatched.add(bestCandidate.id);
        excelMatchedIndices.add(idx);
        pairMatches.push({
          excelIdx: idx,
          localOrder: bestCandidate,
          matchType: 'similar_amount',
          matchConfidence: 80,
          fuzzyReason: `Price proximity (~${Math.abs(bestCandidate.amount - item.talabat).toFixed(2)} EGP diff)`,
        });
      }
    }
  });

  // =========================================================================
  // PASS 4: Leftover Unmatched Excel Items
  // =========================================================================
  excelItems.forEach((item, idx) => {
    if (!excelMatchedIndices.has(idx)) {
      pairMatches.push({
        excelIdx: idx,
        localOrder: undefined,
        matchType: 'none',
        matchConfidence: 0,
      });
    }
  });

  // Sort matches by original Excel index to preserve sheet order
  pairMatches.sort((a, b) => a.excelIdx - b.excelIdx);

  // =========================================================================
  // Build Comparison Rows from Matched Pairs
  // =========================================================================
  for (const pair of pairMatches) {
    const item = excelItems[pair.excelIdx];
    const local = pair.localOrder;

    // Check for Transfer Out / Zero transactions
    const isTransferRow =
      /transfer|تحويل/i.test(item.number) ||
      /transfer|تحويل/i.test(item.orderId) ||
      pair.fuzzyReason === 'Transfer Out';

    const isCrossReference = Boolean(pair.refEntry);
    const ref = pair.refEntry;

    // Determine baseline prices (accounting for Talabat promo discounts if net matched)
    let alohaPrice = ref ? ref.alohaAmount : local ? local.amount : item.alohaPrice > 0 ? item.alohaPrice : 0;
    if (!ref && local && local.discount && Math.abs(item.talabat - (local.amount - local.discount)) < 0.05) {
      alohaPrice = Number((local.amount - local.discount).toFixed(2));
    }

    const talabatPrice = ref ? ref.talabatAmount : item.talabat;
    const diff = ref ? ref.variance : Number((talabatPrice - alohaPrice).toFixed(2));
    const percentageDiff = alohaPrice > 0 ? Number(((diff / alohaPrice) * 100).toFixed(1)) : 0;

    const localPayment = ref ? ref.paymentMethod : local ? local.payment : isTransferRow ? 'Transfer Out' : 'Not in Aloha';
    const talabatMethod = ref ? ref.paymentMethod : item.method;

    // Check payment method mismatch
    const isLocalCash = isCashPayment(localPayment);
    const isTalabatCash = isCashPayment(talabatMethod);
    const isLocalOnline = isOnlinePayment(localPayment);
    const isTalabatOnline = isOnlinePayment(talabatMethod);

    let isPaymentMismatch = false;
    if (!ref && local && !isTransferRow && ((isLocalCash && isTalabatOnline) || (isLocalOnline && isTalabatCash))) {
      isPaymentMismatch = true;
      methodMismatchCount++;
      paymentMethodConflictTotal += alohaPrice;
    }

    let status: DiscrepancyType = 'match';
    let statusLabel = 'Matched';
    let statusSeverity: ComparisonRow['statusSeverity'] = 'success';
    let auditNote = 'Exact match on check ID and amount.';

    // Check date difference if both exist
    let dateMismatchNote = '';
    if (local && local.date && item.date && local.date !== item.date) {
      dateMismatchNote = ` (Date: Aloha ${local.date} vs Talabat ${item.date})`;
    }

    if (ref) {
      if (Math.abs(diff) <= 0.01) {
        status = 'match';
        statusLabel = 'متطابق (فورمة المراجعة)';
        statusSeverity = 'success';
        matchCount++;
      } else if (diff < -0.01) {
        status = 'deficit';
        statusLabel = `عجز (${diff.toFixed(2)})`;
        statusSeverity = 'danger';
        deficitCount++;
        grossDeficitTotal += Math.abs(diff);
      } else {
        status = 'surplus';
        statusLabel = `زيادة (+${diff.toFixed(2)})`;
        statusSeverity = 'success';
        surplusCount++;
        grossSurplusTotal += diff;
      }
      auditNote = ref.comment || `معتمد ومطابق من فورمة المراجعة الثلاثية (Aloha #${ref.alohaOrderNo} <-> Talabat #${ref.talabatOrderNo})`;
    } else if (isTransferRow) {
      status = 'match';
      statusLabel = 'Transfer Out (0 EGP)';
      statusSeverity = 'info';
      matchCount++;
      auditNote = 'Transfer Out / تحويل خارجي (EGP 0.00) - Recorded as external branch transfer.';
    } else if (!local) {
      status = 'missing_in_aloha';
      statusLabel = 'Missing in Aloha';
      statusSeverity = 'danger';
      missingInAlohaCount++;
      missingInAlohaTotal += talabatPrice;
      auditNote = `Order listed in Talabat Excel for EGP ${talabatPrice.toFixed(2)}${item.dateTime ? ` [${item.dateTime}]` : ''}, but no matching check found in Aloha POS (Aloha Shortage).`;
    } else if (diff < -0.01) {
      grossDeficitTotal += Math.abs(diff);
      deficitCount++;
      if (isPaymentMismatch) {
        status = 'price_and_method_mismatch';
        statusLabel = 'Deficit & Method Mismatch';
        statusSeverity = 'danger';
        auditNote = `Deficit of EGP ${Math.abs(diff).toFixed(2)} (Aloha: ${alohaPrice.toFixed(2)} vs Talabat: ${talabatPrice.toFixed(2)}) with tender mismatch (${localPayment} vs ${talabatMethod})${dateMismatchNote}.`;
      } else {
        status = 'deficit';
        statusLabel = `Deficit (-${Math.abs(diff).toFixed(2)})`;
        statusSeverity = 'danger';
        const matchInfo =
          pair.matchType === 'similar_amount'
            ? ` [⚡ Paired with nearest Aloha check #${local.number} based on price proximity]`
            : pair.matchType === 'suggested_match'
            ? ` [🔍 اقتراح مطابقة تقريبية بناءً على تسلسل الوردية وطريقة الدفع (Aloha Check #${local.number}) - يُرجى المراجعة والتحقق]`
            : '';
        auditNote = `Talabat report is lower than Aloha check by EGP ${Math.abs(diff).toFixed(2)} (${percentageDiff}%)${matchInfo}${dateMismatchNote}.`;
      }
    } else if (diff > 0.01) {
      grossSurplusTotal += diff;
      surplusCount++;
      if (isPaymentMismatch) {
        status = 'price_and_method_mismatch';
        statusLabel = 'Surplus & Method Mismatch';
        statusSeverity = 'warning';
        auditNote = `Surplus of EGP ${diff.toFixed(2)} with tender mismatch (${localPayment} vs ${talabatMethod})${dateMismatchNote}.`;
      } else {
        status = 'surplus';
        statusLabel = `Surplus (+${diff.toFixed(2)})`;
        statusSeverity = 'success';
        const matchInfo =
          pair.matchType === 'similar_amount'
            ? ` [⚡ Paired with nearest Aloha check #${local.number} based on price proximity]`
            : pair.matchType === 'suggested_match'
            ? ` [🔍 اقتراح مطابقة تقريبية بناءً على تسلسل الوردية وطريقة الدفع (Aloha Check #${local.number}) - يُرجى المراجعة والتحقق]`
            : '';
        auditNote = `Talabat report is higher than Aloha check by EGP ${diff.toFixed(2)} (+${percentageDiff}%)${matchInfo}${dateMismatchNote}.`;
      }
    } else if (isPaymentMismatch) {
      status = 'method_mismatch';
      statusLabel = 'Payment Method Mismatch';
      statusSeverity = 'warning';
      auditNote = `Amount matches (EGP ${alohaPrice.toFixed(2)}) but recorded in Aloha as [${localPayment}] and Talabat as [${talabatMethod}]${dateMismatchNote}.`;
    } else {
      status = 'match';
      statusLabel =
        pair.matchType === 'fuzzy_id_price'
          ? '⚡ Fuzzy ID & Price Match'
          : pair.matchType === 'exact_amount'
          ? '⚡ Smart Match (Exact Amount)'
          : pair.matchType === 'promo_amount'
          ? '🏷️ Promo Net Match'
          : 'Exact Match';
      statusSeverity = 'success';
      matchCount++;
      auditNote =
        pair.matchType === 'fuzzy_id_price'
          ? `Matched by partial/typo ID similarity (${pair.fuzzyReason || '1-2 digits difference'}) and verified amount EGP ${alohaPrice.toFixed(2)}${dateMismatchNote}.`
          : pair.matchType === 'exact_amount'
          ? `Matched by exact amount (EGP ${alohaPrice.toFixed(2)}) with Aloha Check #${local.number} [${local.payment}]${dateMismatchNote}.`
          : `Fully matched on amount and payment method${dateMismatchNote}.`;
    }

    const rowDifference =
      isTransferRow
        ? 0
        : status === 'missing_in_aloha'
        ? Number((-talabatPrice).toFixed(2))
        : diff;

    // Smartly resolve final orderId and Aloha check number
    let finalOrderId = ref
      ? ref.talabatOrderNo
      : item.orderId && item.orderId !== '—' && !item.orderId.startsWith('TAL-')
      ? item.orderId
      : local?.authNumber || (local?.number && local.number.length >= 8 ? local.number : '—');

    let finalNumber = ref
      ? ref.alohaOrderNo
      : local
      ? local.number
      : item.number && item.number !== finalOrderId
      ? item.number
      : item.number || '—';

    if (finalOrderId === '—' && finalNumber && finalNumber.length >= 8) {
      finalOrderId = finalNumber;
      if (local) finalNumber = local.number;
    }

    // Enhance audit note with delivery fee note if applicable
    const absDiff = Math.abs(diff);
    const isDeliveryFeeDiff =
      Math.abs(absDiff - 35.01) <= 1.5 ||
      Math.abs(absDiff - 35) <= 1.5 ||
      Math.abs(absDiff - 30) <= 1.5 ||
      Math.abs(absDiff - 25) <= 1.5 ||
      Math.abs(absDiff - 20) <= 1.5 ||
      Math.abs(absDiff - 15) <= 1.5;

    if (local && isDeliveryFeeDiff && (status === 'deficit' || status === 'surplus')) {
      auditNote += ` [💡 فارق مصاريف توصيل/خصم محتمل بقيمة ~${absDiff.toFixed(2)} ج.م]`;
    }

    const extraNotes: string[] = [];
    if (item.comment) extraNotes.push(item.comment);
    if (ref?.comment && !extraNotes.includes(ref.comment)) extraNotes.push(ref.comment);
    if (ref?.discOnTalabat || item.discOnTalabat) extraNotes.push(`Disc. Talabat: ${ref?.discOnTalabat || item.discOnTalabat}`);
    if (ref?.discOnBK || item.discOnBK) extraNotes.push(`Disc. BK: -${ref?.discOnBK || item.discOnBK}`);
    if (pair.fuzzyReason && !pair.fuzzyReason.startsWith('Resolved via')) extraNotes.push(pair.fuzzyReason);
    const varianceReason = extraNotes.length > 0 ? extraNotes.join(' | ') : undefined;

    rows.push({
      key: `rec-excel-${finalNumber}-${rows.length}`,
      number: finalNumber,
      orderId: finalOrderId,
      alohaPrice,
      talabatPrice,
      difference: rowDifference,
      percentageDiff,
      localPayment,
      talabatMethod,
      isPaymentMismatch,
      alohaDate: local?.date,
      alohaTime: local?.time,
      alohaDateTime: local?.dateTime,
      alohaHost: local?.host || item.host,
      alohaHostId: local?.hostId || item.hostId,
      alohaTerminal: local?.terminal || item.terminal,
      sourceFileName: local?.sourceFileName,
      dayLabel: ref?.day || item.day || local?.dayLabel,
      day: ref?.day || item.day || local?.dayLabel,
      discOnBK: ref?.discOnBK ?? item.discOnBK,
      discOnTalabat: ref?.discOnTalabat ?? item.discOnTalabat,
      isMatchedViaCrossReference: isCrossReference,
      crossReferenceId: ref?.id,
      talabatDate: item.date,
      talabatTime: item.time,
      talabatDateTime: item.dateTime,
      status,
      statusLabel,
      statusSeverity,
      auditNote,
      source: local || ref ? 'both' : 'talabat_only',
      matchType: pair.matchType,
      matchConfidence: pair.matchConfidence,
      varianceReason,
      rawAlohaOrder: local,
    });
  }

  // =========================================================================
  // 6. Evaluate truly un-matched Aloha Orders (Missing in Talabat Excel)
  // ONLY for orders in Talabat/Delivery scope: Otlob.com, Free-Dele, HD Talabat (Delivery)!
  // Non-delivery in-store checks (e.g. Dine In, Takeout) are NOT pushed as Missing in Talabat.
  // =========================================================================
  for (const order of parsedOrders) {
    if (!localMatched.has(order.id) && !localMatched.has(order.number)) {
      // Only include orders in Talabat Delivery scope as missing
      if (!isTalabatReconciliationOrder(order)) {
        continue;
      }

      missingInTalabatCount++;
      missingInTalabatTotal += order.amount;
      grossDeficitTotal += order.amount; // Prepared in POS as Talabat/Delivery but missing in Talabat Excel

      const hostInfo = order.host ? ` (Cashier: ${order.host}${order.hostId ? `, #${order.hostId}` : ''})` : '';
      const orderIdLabel = order.authNumber ? order.authNumber : '— (Missing in Talabat)';

      rows.push({
        key: `rec-aloha-only-${order.number}-${rows.length}`,
        number: order.number,
        orderId: orderIdLabel,
        alohaPrice: order.amount,
        talabatPrice: 0,
        difference: Number((-order.amount).toFixed(2)),
        percentageDiff: -100,
        localPayment: order.payment,
        talabatMethod: '—',
        isPaymentMismatch: false,
        alohaDate: order.date,
        alohaTime: order.time,
        alohaDateTime: order.dateTime,
        alohaHost: order.host,
        alohaHostId: order.hostId,
        alohaTerminal: order.terminal,
        sourceFileName: order.sourceFileName,
        dayLabel: order.dayLabel,
        status: 'missing_in_talabat',
        statusLabel: 'Missing in Talabat',
        statusSeverity: 'danger',
        auditNote: `Aloha POS [${order.orderType || 'HD Talabat'}] check #${order.number} for EGP ${order.amount.toFixed(2)} [${order.payment}]${order.dateTime ? ` at ${order.dateTime}` : ''}${hostInfo} has no corresponding transaction in Talabat Excel!`,
        source: 'aloha_only',
        matchType: 'none',
        matchConfidence: 0,
        rawAlohaOrder: order,
      });
    }
  }

  // Calculate Cash Box & Drawer Balances for Talabat comparison scope
  // Includes ALL Aloha orders that matched to Talabat OR were processed as Talabat/Delivery scope in Aloha
  const alohaTalabatScopeOrders = parsedOrders.filter(
    o => localMatched.has(o.id) || localMatched.has(o.number) || isTalabatReconciliationOrder(o)
  );

  const alohaCashOrders = alohaTalabatScopeOrders.filter(o => isCashPayment(o.payment));
  const alohaCashTotal = alohaCashOrders.reduce((sum, o) => sum + o.amount, 0);
  const alohaCashCount = alohaCashOrders.length;

  const alohaCreditOrders = alohaTalabatScopeOrders.filter(
    o => isOnlinePayment(o.payment) || o.payment === 'Otlob Mode' || o.payment === 'Credit Card'
  );
  const alohaCreditTotal = alohaCreditOrders.reduce((sum, o) => sum + o.amount, 0);
  const alohaCreditCount = alohaCreditOrders.length;

  const alohaTotalOrdersCount = alohaTalabatScopeOrders.length;
  const totalSalesAloha = alohaTalabatScopeOrders.reduce((acc, curr) => acc + curr.amount, 0);

  // Talabat totals & counts
  const talabatCashItems = excelItems.filter(item => isCashPayment(item.method));
  const talabatCashTotal = talabatCashItems.reduce((sum, item) => sum + item.talabat, 0);
  const talabatCashCount = talabatCashItems.length;

  const talabatCreditItems = excelItems.filter(item => isOnlinePayment(item.method));
  const talabatCreditTotal = talabatCreditItems.reduce((sum, item) => sum + item.talabat, 0);
  const talabatCreditCount = talabatCreditItems.length;

  const talabatTotalOrdersCount = excelItems.length;
  const totalSalesTalabat = excelItems.reduce((acc, curr) => acc + curr.talabat, 0);

  const cashDifference = Number((alohaCashTotal - talabatCashTotal).toFixed(2));
  const creditDifference = Number((alohaCreditTotal - talabatCreditTotal).toFixed(2));
  const grossSalesDifference = Number((totalSalesAloha - totalSalesTalabat).toFixed(2));
  const orderCountDifference = alohaTotalOrdersCount - talabatTotalOrdersCount;

  let cashStatus: CashierAuditSummary['cashStatus'] = 'balanced';
  if (cashDifference < -0.05) cashStatus = 'cashier_shortage';
  else if (cashDifference > 0.05) cashStatus = 'cashier_surplus';

  const cashierAudit: CashierAuditSummary = {
    alohaCashTotal: Number(alohaCashTotal.toFixed(2)),
    alohaCashCount,
    alohaCreditTotal: Number(alohaCreditTotal.toFixed(2)),
    alohaCreditCount,
    alohaGrandTotal: Number(totalSalesAloha.toFixed(2)),
    alohaTotalOrdersCount,

    talabatCashTotal: Number(talabatCashTotal.toFixed(2)),
    talabatCashCount,
    talabatCreditTotal: Number(talabatCreditTotal.toFixed(2)),
    talabatCreditCount,
    talabatGrandTotal: Number(totalSalesTalabat.toFixed(2)),
    talabatTotalOrdersCount,

    cashDifference,
    creditDifference,
    grossSalesDifference,
    orderCountDifference,
    cashStatus,

    // Legacy compatibility fields
    alohaExpectedCash: Number(alohaCashTotal.toFixed(2)),
    talabatReportedCash: Number(talabatCashTotal.toFixed(2)),
    alohaOnlineTotal: Number(alohaCreditTotal.toFixed(2)),
    talabatOnlineTotal: Number(talabatCreditTotal.toFixed(2)),
    onlineDifference: creditDifference,
    totalSalesAloha: Number(totalSalesAloha.toFixed(2)),
    totalSalesTalabat: Number(totalSalesTalabat.toFixed(2)),
    paymentMethodConflictCount: methodMismatchCount,
    paymentMethodConflictTotal: Number(paymentMethodConflictTotal.toFixed(2)),
  };

  const totalEvaluatedCount = rows.length;
  const matchPercentage =
    totalEvaluatedCount > 0 ? Number(((matchCount / totalEvaluatedCount) * 100).toFixed(1)) : 0;

  const totalDiscrepancyAmount = grossDeficitTotal + grossSurplusTotal;
  const maxBase = Math.max(totalSalesAloha, totalSalesTalabat);
  const financialAccuracyRate =
    maxBase > 0 ? Math.max(0, Number(((1 - totalDiscrepancyAmount / maxBase) * 100).toFixed(1))) : 100;

  const deliveryOrders = parsedOrders.filter(o => isTalabatReconciliationOrder(o));
  const deliveryOrdersCount = deliveryOrders.length;
  const deliveryOrdersTotal = Number(deliveryOrders.reduce((sum, o) => sum + o.amount, 0).toFixed(2));

  const summary: ReconciliationSummary = {
    alohaSourceTotal: Number(totalSalesAloha.toFixed(2)),
    talabatSourceTotal: Number(totalSalesTalabat.toFixed(2)),
    sourceNetTotal: Number((totalSalesTalabat - totalSalesAloha).toFixed(2)),
    grossDeficitTotal: Number(grossDeficitTotal.toFixed(2)),
    grossSurplusTotal: Number(grossSurplusTotal.toFixed(2)),
    netDifference: Number((grossSurplusTotal - grossDeficitTotal).toFixed(2)),
    totalEvaluatedCount,
    matchCount,
    deficitCount,
    surplusCount,
    methodMismatchCount,
    missingInTalabatCount,
    missingInAlohaCount,
    duplicateCount: 0,
    missingInTalabatTotal: Number(missingInTalabatTotal.toFixed(2)),
    missingInAlohaTotal: Number(missingInAlohaTotal.toFixed(2)),
    matchPercentage,
    financialAccuracyRate,
    deliveryOrdersCount,
    deliveryOrdersTotal,
    cashierAudit,
  };

  return { rows, summary };
}

export function evaluateComparisonRow(row: Partial<ComparisonRow>): ComparisonRow {
  const alohaPrice = Number((Number(row.alohaPrice) || 0).toFixed(2));
  const talabatPrice = Number((Number(row.talabatPrice) || 0).toFixed(2));
  const diff = Number((talabatPrice - alohaPrice).toFixed(2));
  const maxPrice = Math.max(alohaPrice, talabatPrice);
  const percentageDiff = maxPrice > 0 ? Number(((diff / maxPrice) * 100).toFixed(1)) : 0;

  let rawNumber = String(row.number || '').trim();
  let rawOrderId = String(row.orderId || '').trim();

  // If Aloha Price is provided (> 0), make sure we have a valid Check #
  if (alohaPrice > 0) {
    if (!rawNumber || rawNumber === '—' || rawNumber === '0' || rawNumber.toLowerCase() === 'not in aloha') {
      if (rawOrderId && rawOrderId !== '—' && !rawOrderId.includes('Missing')) {
        rawNumber = rawOrderId;
      } else {
        rawNumber = `CHK-${Math.floor(10000 + Math.random() * 90000)}`;
      }
    }
  }

  // If Talabat Price is provided (> 0), make sure we have a valid Order ID
  if (talabatPrice > 0) {
    if (!rawOrderId || rawOrderId === '—' || rawOrderId.includes('Missing')) {
      if (rawNumber && rawNumber !== '—' && !rawNumber.includes('Missing')) {
        rawOrderId = rawNumber;
      }
    }
  }

  // Determine payment methods cleanly
  let localPayment = String(row.localPayment || '').trim();
  let talabatMethod = String(row.talabatMethod || '').trim();

  // If localPayment is 'Not in Aloha' or '—' but user now provided an Aloha price, resolve to actual tender
  if (alohaPrice > 0) {
    if (!localPayment || localPayment === '—' || localPayment.toLowerCase() === 'not in aloha' || localPayment === 'Unspecified') {
      if (talabatMethod && isOnlinePayment(talabatMethod)) {
        localPayment = 'Otlob Mode';
      } else {
        localPayment = 'Cash';
      }
    }
  } else if (!localPayment || localPayment === '—') {
    localPayment = talabatPrice > 0 ? 'Not in Aloha' : '—';
  }

  if (talabatPrice > 0) {
    if (!talabatMethod || talabatMethod === '—' || talabatMethod === 'Unspecified') {
      if (localPayment && isOnlinePayment(localPayment)) {
        talabatMethod = 'ONLINE';
      } else {
        talabatMethod = 'CASH';
      }
    }
  } else if (!talabatMethod) {
    talabatMethod = '—';
  }

  const isLocalCash = isCashPayment(localPayment);
  const isTalabatCash = isCashPayment(talabatMethod);
  const isLocalOnline = isOnlinePayment(localPayment);
  const isTalabatOnline = isOnlinePayment(talabatMethod);

  const isPaymentMismatch =
    alohaPrice > 0 &&
    talabatPrice > 0 &&
    ((isLocalCash && isTalabatOnline) || (isLocalOnline && isTalabatCash));

  let status: DiscrepancyType = 'match';
  let statusLabel = 'Exact Match';
  let statusSeverity: 'success' | 'warning' | 'danger' | 'info' = 'success';
  let auditNote = 'Fully verified and matched on amount and payment method.';

  if (alohaPrice <= 0 && talabatPrice > 0) {
    status = 'missing_in_aloha';
    statusLabel = 'Missing in Aloha';
    statusSeverity = 'danger';
    auditNote = `Order recorded in Talabat (${rawOrderId || 'Talabat Order'}) for EGP ${talabatPrice.toFixed(2)} [${talabatMethod}] has no record in Aloha POS (Aloha Shortage).`;
  } else if (talabatPrice <= 0 && alohaPrice > 0) {
    status = 'missing_in_talabat';
    statusLabel = 'Missing in Talabat';
    statusSeverity = 'danger';
    auditNote = `Aloha POS check #${rawNumber || '—'} for EGP ${alohaPrice.toFixed(2)} [${localPayment}] has no record in Talabat.`;
  } else if (Math.abs(diff) <= 0.01 && isPaymentMismatch) {
    status = 'method_mismatch';
    statusLabel = 'Payment Method Mismatch';
    statusSeverity = 'warning';
    auditNote = `Amount matches (EGP ${alohaPrice.toFixed(2)}) but recorded in Aloha as [${localPayment}] and Talabat as [${talabatMethod}].`;
  } else if (diff < -0.01) {
    // Aloha POS is higher than Talabat (Talabat is lower)
    if (isPaymentMismatch) {
      status = 'price_and_method_mismatch';
      statusLabel = `Deficit (-${Math.abs(diff).toFixed(2)}) & Tender Mismatch`;
      statusSeverity = 'danger';
      auditNote = `Deficit of EGP ${Math.abs(diff).toFixed(2)} (Aloha: ${alohaPrice.toFixed(2)} vs Talabat: ${talabatPrice.toFixed(2)}) with tender mismatch (${localPayment} vs ${talabatMethod}).`;
    } else {
      status = 'deficit';
      statusLabel = `Deficit (-${Math.abs(diff).toFixed(2)})`;
      statusSeverity = 'danger';
      auditNote = `Talabat report is lower than Aloha check by EGP ${Math.abs(diff).toFixed(2)} (${percentageDiff}%).`;
    }
  } else if (diff > 0.01) {
    // Talabat is higher than Aloha POS
    if (isPaymentMismatch) {
      status = 'price_and_method_mismatch';
      statusLabel = `Surplus (+${diff.toFixed(2)}) & Tender Mismatch`;
      statusSeverity = 'warning';
      auditNote = `Surplus of EGP ${diff.toFixed(2)} with tender mismatch (${localPayment} vs ${talabatMethod}).`;
    } else {
      status = 'surplus';
      statusLabel = `Surplus (+${diff.toFixed(2)})`;
      statusSeverity = 'success';
      auditNote = `Talabat report is higher than Aloha check by EGP ${diff.toFixed(2)} (+${percentageDiff}%).`;
    }
  } else {
    status = 'match';
    statusLabel = 'Exact Match';
    statusSeverity = 'success';
    auditNote = `Fully matched on amount (EGP ${alohaPrice.toFixed(2)}) and payment method [${localPayment}].`;
  }

  const finalNumber = rawNumber || (alohaPrice > 0 ? '—' : '—');
  const finalOrderId = rawOrderId || (talabatPrice > 0 ? '—' : '—');

  const customNote = (row.customVarianceNote !== undefined ? row.customVarianceNote : '')?.trim();
  const varianceReason = row.varianceReason || '';
  const comment = customNote || row.comment || varianceReason || (status === 'match' ? 'متطابق تماماً' : '');

  return {
    key: row.key || `manual-row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    number: finalNumber,
    orderId: finalOrderId,
    alohaPrice,
    talabatPrice,
    difference: status === 'missing_in_talabat' ? -alohaPrice : status === 'missing_in_aloha' ? -talabatPrice : diff,
    percentageDiff,
    localPayment,
    talabatMethod,
    isPaymentMismatch,
    alohaDate: row.alohaDate,
    alohaTime: row.alohaTime,
    alohaDateTime: row.alohaDateTime,
    alohaHost: row.alohaHost,
    alohaHostId: row.alohaHostId,
    alohaTerminal: row.alohaTerminal,
    talabatDate: row.talabatDate,
    talabatTime: row.talabatTime,
    talabatDateTime: row.talabatDateTime,
    status,
    statusLabel,
    statusSeverity,
    auditNote: row.auditNote || auditNote,
    source: alohaPrice > 0 && talabatPrice > 0 && status !== 'missing_in_aloha' && status !== 'missing_in_talabat' ? 'both' : alohaPrice > 0 ? 'aloha_only' : 'talabat_only',
    matchType: row.matchType || (status === 'match' ? 'exact_id' : 'none'),
    varianceReason,
    customVarianceNote: customNote,
    comment,
    rawAlohaOrder: row.rawAlohaOrder,
    isCancelledOrMoe: row.isCancelledOrMoe,
    isDeliveryFeeVariance: row.isDeliveryFeeVariance,
    alohaOrderNo: row.alohaOrderNo || finalNumber,
    talabatOrderNo: row.talabatOrderNo || finalOrderId,
    alohaAmount: row.alohaAmount !== undefined ? row.alohaAmount : alohaPrice,
    talabatAmount: row.talabatAmount !== undefined ? row.talabatAmount : talabatPrice,
    variance: row.variance !== undefined ? row.variance : diff,
    time: row.time || row.alohaTime || row.talabatTime,
    paymentMethod: row.paymentMethod || localPayment,
    day: row.day,
    dayLabel: row.dayLabel,
    sourceFileName: row.sourceFileName,
  };
}

export function recomputeReconciliationSummary(rows: ComparisonRow[]): ReconciliationSummary {
  let matchCount = 0;
  let deficitCount = 0;
  let surplusCount = 0;
  let methodMismatchCount = 0;
  let missingInTalabatCount = 0;
  let missingInAlohaCount = 0;

  let grossDeficitTotal = 0;
  let grossSurplusTotal = 0;
  let missingInTalabatTotal = 0;
  let missingInAlohaTotal = 0;
  let paymentMethodConflictTotal = 0;

  let alohaCashTotal = 0;
  let alohaCashCount = 0;
  let alohaCreditTotal = 0;
  let alohaCreditCount = 0;
  let totalSalesAloha = 0;
  let alohaTotalOrdersCount = 0;

  let talabatCashTotal = 0;
  let talabatCashCount = 0;
  let talabatCreditTotal = 0;
  let talabatCreditCount = 0;
  let totalSalesTalabat = 0;
  let talabatTotalOrdersCount = 0;

  let deliveryOrdersCount = 0;
  let deliveryOrdersTotal = 0;

  for (const r of rows) {
    // Count all Aloha sales if the row has a positive Aloha price
    if (r.alohaPrice > 0) {
      totalSalesAloha += r.alohaPrice;
      alohaTotalOrdersCount++;

      if (isCashPayment(r.localPayment)) {
        alohaCashTotal += r.alohaPrice;
        alohaCashCount++;
      } else if (isOnlinePayment(r.localPayment)) {
        alohaCreditTotal += r.alohaPrice;
        alohaCreditCount++;
      } else {
        // Fallback: if localPayment was 'Not in Aloha' or unspecified, check talabatMethod
        if (isCashPayment(r.talabatMethod)) {
          alohaCashTotal += r.alohaPrice;
          alohaCashCount++;
        } else {
          alohaCreditTotal += r.alohaPrice;
          alohaCreditCount++;
        }
      }

      if (r.rawAlohaOrder && isTalabatReconciliationOrder(r.rawAlohaOrder)) {
        deliveryOrdersCount++;
        deliveryOrdersTotal += r.alohaPrice;
      } else {
        deliveryOrdersCount++;
        deliveryOrdersTotal += r.alohaPrice;
      }
    }

    if (r.talabatPrice > 0) {
      totalSalesTalabat += r.talabatPrice;
      talabatTotalOrdersCount++;

      if (isCashPayment(r.talabatMethod)) {
        talabatCashTotal += r.talabatPrice;
        talabatCashCount++;
      } else if (isOnlinePayment(r.talabatMethod)) {
        talabatCreditTotal += r.talabatPrice;
        talabatCreditCount++;
      } else {
        if (isCashPayment(r.localPayment)) {
          talabatCashTotal += r.talabatPrice;
          talabatCashCount++;
        } else {
          talabatCreditTotal += r.talabatPrice;
          talabatCreditCount++;
        }
      }
    }

    if (r.status === 'match') {
      matchCount++;
    } else if (r.status === 'deficit') {
      deficitCount++;
      grossDeficitTotal += Math.abs(r.difference);
    } else if (r.status === 'surplus') {
      surplusCount++;
      grossSurplusTotal += r.difference;
    } else if (r.status === 'price_and_method_mismatch') {
      methodMismatchCount++;
      paymentMethodConflictTotal += r.alohaPrice;
      if (r.difference < 0) {
        deficitCount++;
        grossDeficitTotal += Math.abs(r.difference);
      } else {
        surplusCount++;
        grossSurplusTotal += r.difference;
      }
    } else if (r.status === 'method_mismatch') {
      methodMismatchCount++;
      paymentMethodConflictTotal += r.alohaPrice;
    } else if (r.status === 'missing_in_talabat') {
      missingInTalabatCount++;
      missingInTalabatTotal += r.alohaPrice;
      grossDeficitTotal += r.alohaPrice;
    } else if (r.status === 'missing_in_aloha') {
      missingInAlohaCount++;
      missingInAlohaTotal += r.talabatPrice;
    }
  }

  const cashDifference = Number((alohaCashTotal - talabatCashTotal).toFixed(2));
  const creditDifference = Number((alohaCreditTotal - talabatCreditTotal).toFixed(2));
  const grossSalesDifference = Number((totalSalesAloha - totalSalesTalabat).toFixed(2));
  const orderCountDifference = alohaTotalOrdersCount - talabatTotalOrdersCount;

  let cashStatus: CashierAuditSummary['cashStatus'] = 'balanced';
  if (cashDifference < -0.05) cashStatus = 'cashier_shortage';
  else if (cashDifference > 0.05) cashStatus = 'cashier_surplus';

  const cashierAudit: CashierAuditSummary = {
    alohaCashTotal: Number(alohaCashTotal.toFixed(2)),
    alohaCashCount,
    alohaCreditTotal: Number(alohaCreditTotal.toFixed(2)),
    alohaCreditCount,
    alohaGrandTotal: Number(totalSalesAloha.toFixed(2)),
    alohaTotalOrdersCount,

    talabatCashTotal: Number(talabatCashTotal.toFixed(2)),
    talabatCashCount,
    talabatCreditTotal: Number(talabatCreditTotal.toFixed(2)),
    talabatCreditCount,
    talabatGrandTotal: Number(totalSalesTalabat.toFixed(2)),
    talabatTotalOrdersCount,

    cashDifference,
    creditDifference,
    grossSalesDifference,
    orderCountDifference,
    cashStatus,

    alohaExpectedCash: Number(alohaCashTotal.toFixed(2)),
    talabatReportedCash: Number(talabatCashTotal.toFixed(2)),
    alohaOnlineTotal: Number(alohaCreditTotal.toFixed(2)),
    talabatOnlineTotal: Number(talabatCreditTotal.toFixed(2)),
    onlineDifference: creditDifference,
    totalSalesAloha: Number(totalSalesAloha.toFixed(2)),
    totalSalesTalabat: Number(totalSalesTalabat.toFixed(2)),
    paymentMethodConflictCount: methodMismatchCount,
    paymentMethodConflictTotal: Number(paymentMethodConflictTotal.toFixed(2)),
  };

  const totalEvaluatedCount = rows.length;
  const matchPercentage =
    totalEvaluatedCount > 0 ? Number(((matchCount / totalEvaluatedCount) * 100).toFixed(1)) : 0;

  const totalDiscrepancyAmount = grossDeficitTotal + grossSurplusTotal;
  const maxBase = Math.max(totalSalesAloha, totalSalesTalabat);
  const financialAccuracyRate =
    maxBase > 0 ? Math.max(0, Number(((1 - totalDiscrepancyAmount / maxBase) * 100).toFixed(1))) : 100;

  return {
    alohaSourceTotal: Number(totalSalesAloha.toFixed(2)),
    talabatSourceTotal: Number(totalSalesTalabat.toFixed(2)),
    sourceNetTotal: Number((totalSalesTalabat - totalSalesAloha).toFixed(2)),
    grossDeficitTotal: Number(grossDeficitTotal.toFixed(2)),
    grossSurplusTotal: Number(grossSurplusTotal.toFixed(2)),
    netDifference: Number((grossSurplusTotal - grossDeficitTotal).toFixed(2)),
    totalEvaluatedCount,
    matchCount,
    deficitCount,
    surplusCount,
    methodMismatchCount,
    missingInTalabatCount,
    missingInAlohaCount,
    duplicateCount: 0,
    missingInTalabatTotal: Number(missingInTalabatTotal.toFixed(2)),
    missingInAlohaTotal: Number(missingInAlohaTotal.toFixed(2)),
    matchPercentage,
    financialAccuracyRate,
    deliveryOrdersCount,
    deliveryOrdersTotal: Number(deliveryOrdersTotal.toFixed(2)),
    cashierAudit,
  };
}

export function generateOrdersExcelBlob(orders: ParsedOrder[]): Blob {
  const data = orders.map((order, idx) => ({
    '#': idx + 1,
    'Aloha Check #': order.number,
    'Host': order.host ? (order.host.startsWith('Host:') ? order.host : `Host: ${order.host}`) : '—',
    'Date': order.date || '—',
    'Time': order.time || '—',
    'Date & Time': order.dateTime || `${order.date || ''} ${order.time || ''}`.trim() || '—',
    'Order Type': order.orderType,
    'Payment Method': order.payment,
    'Amount (EGP)': order.amount,
    'Cash Portion': order.cashAmount || 0,
    'Online Portion': order.creditAmount || 0,
    'Duplicate Status': order.isDuplicate ? `Duplicate (${order.duplicateCount}x)` : 'Unique',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Aloha Orders');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function exportOrdersToExcel(orders: ParsedOrder[], filename = 'BK_Aloha_Orders_Report.xlsx') {
  const blob = generateOrdersExcelBlob(orders);
  await saveFileWithPicker(blob, filename, [
    {
      description: 'Excel Spreadsheet (*.xlsx)',
      accept: {
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      },
    },
  ]);
}

export function generateComparisonExcelBlob(
  rows: ComparisonRow[],
  summary: ReconciliationSummary
): Blob {
  const data = rows.map((r, idx) => ({
    '#': idx + 1,
    'day': r.day || r.dayLabel || 'day 1',
    'Aloha Order No.': r.number,
    'Aloha AM': r.alohaPrice,
    'Disc. On BK': r.discOnBK !== undefined ? r.discOnBK : 0,
    'Talabat AM': r.talabatPrice,
    'Talabat order NO.': r.orderId,
    'Disc. On Talabat': r.discOnTalabat !== undefined ? r.discOnTalabat : '0',
    'Varince': r.difference,
    'Cash Or Credit': r.localPayment || r.talabatMethod || 'cash',
    'Comment': r.comment || r.auditNote || r.statusLabel,
    'Status': r.statusLabel,
  }));

  // Append summary row
  data.push({
    '#': '' as any,
    'day': 'TOTALS',
    'Aloha Order No.': `Checks: ${summary.totalEvaluatedCount}`,
    'Aloha AM': summary.alohaSourceTotal,
    'Disc. On BK': 0,
    'Talabat AM': summary.talabatSourceTotal,
    'Talabat order NO.': `Accuracy: ${summary.financialAccuracyRate}%`,
    'Disc. On Talabat': '0',
    'Varince': summary.sourceNetTotal,
    'Cash Or Credit': `Net: EGP ${summary.netDifference}`,
    'Comment': `Deficit: -${summary.grossDeficitTotal} | Surplus: +${summary.grossSurplusTotal} | Cash Diff: ${summary.cashierAudit.cashDifference}`,
    'Status': summary.cashierAudit.cashStatus,
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reconciliation Table');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function exportComparisonToExcel(
  rows: ComparisonRow[],
  summary: ReconciliationSummary,
  filename = 'BK_Aloha_vs_Talabat_Reconciliation_Report.xlsx'
) {
  const blob = generateComparisonExcelBlob(rows, summary);
  await saveFileWithPicker(blob, filename, [
    {
      description: 'Excel Spreadsheet (*.xlsx)',
      accept: {
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      },
    },
  ]);
}

