import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ComparisonRow, ReconciliationSummary, ExcelPaymentSummary } from '../types';
import { saveFileWithPicker } from './fileSaver';

export interface PDFExportData {
  rows: ComparisonRow[];
  summary: ReconciliationSummary;
  excelFileName?: string;
  reportDate?: string;
  excelPaymentSummary?: ExcelPaymentSummary;
  branchName?: string;
  auditorName?: string;
}

const formatCurrency = (val: number | undefined | null) => {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Sanitizes and formats text cleanly without stripping or corrupting Arabic characters.
 * Preserves Arabic notes, cashier remarks, and English identifiers perfectly.
 */
export function sanitizeTextForPdf(input: string | undefined | null): string {
  if (!input) return '';
  let str = String(input);

  // Normalize spaces and trim
  str = str
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return str;
}

/**
 * Helper to determine smart highlight and beacon status for a comparison row
 */
function getRowSignal(r: ComparisonRow) {
  const alohaAmt = r.alohaAmount !== undefined ? r.alohaAmount : r.alohaPrice;
  const talabatAmt = r.talabatAmount !== undefined ? r.talabatAmount : r.talabatPrice;
  const isTransfer =
    r.number === '0' ||
    r.alohaOrderNo === '0' ||
    r.isCancelledOrMoe ||
    /transfer/i.test(String(r.varianceReason || '')) ||
    /transfer/i.test(String(r.customVarianceNote || '')) ||
    /transfer/i.test(String(r.comment || '')) ||
    (alohaAmt === 0 && talabatAmt > 0);

  if (isTransfer) return 'transfer_out';

  const isMissingInTalabat =
    r.status === 'missing_in_talabat' ||
    (r.alohaPrice > 0 && r.talabatPrice <= 0) ||
    r.orderId === '—' ||
    String(r.orderId).includes('Missing');
  if (isMissingInTalabat) return 'missing_in_talabat';

  const isMissingInAloha =
    r.status === 'missing_in_aloha' ||
    (r.talabatPrice > 0 && r.alohaPrice <= 0) ||
    r.number === '—' ||
    String(r.number).toLowerCase().includes('not in aloha');
  if (isMissingInAloha) return 'missing_in_aloha';

  const alohaPay = (r.localPayment || '').toLowerCase();
  const talabatPay = (r.talabatMethod || '').toLowerCase();

  const isAlohaCash = alohaPay.includes('cash') || alohaPay.includes('كاش');
  const isAlohaCredit =
    alohaPay.includes('otlob') ||
    alohaPay.includes('credit') ||
    alohaPay.includes('card') ||
    alohaPay.includes('visa') ||
    alohaPay.includes('اونلاين') ||
    alohaPay.includes('فيزا');

  const isTalabatCash = talabatPay.includes('cash') || talabatPay.includes('كاش');
  const isTalabatCredit =
    talabatPay.includes('card') ||
    talabatPay.includes('credit') ||
    talabatPay.includes('talabat') ||
    talabatPay.includes('online') ||
    talabatPay.includes('pay') ||
    talabatPay.includes('فيزا') ||
    talabatPay.includes('اونلاين');

  if (isAlohaCash && isTalabatCredit) return 'aloha_cash_talabat_credit';
  if (isAlohaCredit && isTalabatCash) return 'aloha_credit_talabat_cash';

  return null;
}

/**
 * Builds HTML for Page 1: Executive Audit Dashboard & Statistical Matrix
 */
function buildDashboardPageHTML(
  data: PDFExportData,
  pageIndex: number,
  totalPages: number
): string {
  const { summary, excelFileName, branchName, auditorName } = data;
  const cashier = summary.cashierAudit;
  const excelPayments = data.excelPaymentSummary || summary.excelPaymentSummary || {
    cash: { count: cashier.talabatCashCount, total: cashier.talabatCashTotal },
    card: { count: 0, total: 0 },
    talabat: { count: cashier.talabatCreditCount, total: cashier.talabatCreditTotal },
    other: { count: 0, total: 0 },
  };

  const cashDiff = cashier.cashDifference;
  const creditDiff = cashier.creditDifference;
  const grossDiff = cashier.grossSalesDifference;

  const isCashShortage = cashDiff < -0.05;
  const isCashSurplus = cashDiff > 0.05;

  const isCreditShortage = creditDiff < -0.05;
  const isCreditSurplus = creditDiff > 0.05;

  const isGrossShortage = grossDiff < -0.05;
  const isGrossSurplus = grossDiff > 0.05;

  const currentDate = new Date().toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const englishDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `
  <div class="pdf-page" style="width: 1122px; height: 793px; padding: 24px 30px; box-sizing: border-box; background: #FFFFFF; font-family: 'Cairo', 'IBM Plex Sans Arabic', 'Tajawal', 'Plus Jakarta Sans', system-ui, sans-serif; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
    
    <!-- Top Header Banner -->
    <div style="background: linear-gradient(135deg, #502314 0%, #2b1008 100%); border-radius: 14px; padding: 14px 20px; color: #FFFFFF; display: flex; align-items: center; justify-content: space-between; border-bottom: 3.5px solid #D71920; box-shadow: 0 4px 12px rgba(80, 35, 20, 0.15);">
      <div style="display: flex; align-items: center; gap: 14px;">
        <!-- Brand Logos Marker -->
        <div style="display: flex; align-items: center; gap: -8px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: #D71920; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; color: #FFF; border: 2px solid #FFF; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            BK
          </div>
          <div style="width: 44px; height: 44px; border-radius: 12px; background: #FF5A00; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; color: #FFF; border: 2px solid #FFF; margin-left: -10px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            T
          </div>
        </div>
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; color: #FFF;">BURGER KING</span>
            <span style="color: #FBBF24; font-weight: 300;">×</span>
            <span style="font-size: 16px; font-weight: 900; color: #FF7A00;">talabat</span>
            <span style="background: rgba(215, 25, 32, 0.3); border: 1px solid #D71920; color: #FEE2E2; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; margin-left: 6px;">
              Aloha POS Financial Audit
            </span>
          </div>
          <div style="font-size: 12px; color: #FEF3C7; margin-top: 2px; font-weight: 600;">
            تقرير التدقيق المالي والمطابقة الشاملة لفواتير الكاشير وتقرير طلبات اليومي والشهري
          </div>
        </div>
      </div>

      <!-- Report Metadata Header Pill -->
      <div style="text-align: right; background: rgba(255, 255, 255, 0.08); padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.15);">
        <div style="font-size: 11px; color: #FDE68A; font-weight: 700;">
          تاريخ التقرير: <span style="color: #FFF; font-family: 'JetBrains Mono', monospace;">${englishDate} (${currentDate})</span>
        </div>
        <div style="font-size: 10.5px; color: #E2E8F0; margin-top: 2px;">
          الملف المصدري: <span style="color: #93C5FD; font-family: monospace; font-weight: bold;">${excelFileName || 'Talabat_Report.xlsx'}</span>
          ${branchName ? ` | الفرع: <strong style="color:#FFF;">${branchName}</strong>` : ''}
          ${auditorName ? ` | المراجع: <strong style="color:#FFF;">${auditorName}</strong>` : ''}
        </div>
      </div>
    </div>

    <!-- 4 Key Performance Indicators (KPIs) -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 14px;">
      
      <!-- Card 1: Talabat Benchmark -->
      <div style="background: #FFF7ED; border: 1.5px solid #FDBA74; border-radius: 12px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; font-weight: 800; color: #C2410C;">إجمالي تقرير طلبات (Talabat)</span>
          <span style="font-size: 10px; background: #FFEDD5; color: #9A3412; font-weight: 700; padding: 1px 6px; border-radius: 6px;">Benchmark</span>
        </div>
        <div style="font-size: 19px; font-weight: 900; color: #EA580C; font-family: 'JetBrains Mono', monospace; margin: 4px 0 2px 0;">
          ${formatCurrency(summary.talabatSourceTotal)} <span style="font-size: 12px; font-family: 'Cairo', sans-serif;">ج.م</span>
        </div>
        <div style="font-size: 10.5px; color: #7C2D12; font-weight: 600;">
          عدد الأوردرات: <strong>${cashier.talabatTotalOrdersCount}</strong> أوردر بملف الإكسيل
        </div>
      </div>

      <!-- Card 2: Aloha Actuals -->
      <div style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 12px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; font-weight: 800; color: #334155;">إجمالي مبيعات ألوها (Aloha POS)</span>
          <span style="font-size: 10px; background: #E2E8F0; color: #1E293B; font-weight: 700; padding: 1px 6px; border-radius: 6px;">Actual POS</span>
        </div>
        <div style="font-size: 19px; font-weight: 900; color: #502314; font-family: 'JetBrains Mono', monospace; margin: 4px 0 2px 0;">
          ${formatCurrency(summary.alohaSourceTotal)} <span style="font-size: 12px; font-family: 'Cairo', sans-serif;">ج.م</span>
        </div>
        <div style="font-size: 10.5px; color: #475569; font-weight: 600;">
          عدد الشيكات: <strong>${cashier.alohaTotalOrdersCount}</strong> شيك بنظام الكاشير
        </div>
      </div>

      <!-- Card 3: Net Sales Variance -->
      <div style="background: ${isGrossShortage ? '#FEF2F2' : isGrossSurplus ? '#F0FDF4' : '#F8FAFC'}; border: 1.5px solid ${isGrossShortage ? '#FCA5A5' : isGrossSurplus ? '#86EFAC' : '#CBD5E1'}; border-radius: 12px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; font-weight: 800; color: ${isGrossShortage ? '#991B1B' : isGrossSurplus ? '#166534' : '#334155'};">
            صافي الفارق المالي (Net Variance)
          </span>
          <span style="font-size: 10px; background: ${isGrossShortage ? '#FEE2E2' : isGrossSurplus ? '#DCFCE7' : '#E2E8F0'}; color: ${isGrossShortage ? '#991B1B' : isGrossSurplus ? '#166534' : '#334155'}; font-weight: 700; padding: 1px 6px; border-radius: 6px;">
            ${isGrossShortage ? 'عجز في ألوها' : isGrossSurplus ? 'زيادة في ألوها' : 'متطابق تماماً'}
          </span>
        </div>
        <div style="font-size: 19px; font-weight: 900; color: ${isGrossShortage ? '#DC2626' : isGrossSurplus ? '#16A34A' : '#16A34A'}; font-family: 'JetBrains Mono', monospace; margin: 4px 0 2px 0;">
          ${isGrossShortage ? `- ${formatCurrency(Math.abs(grossDiff))}` : isGrossSurplus ? `+ ${formatCurrency(grossDiff)}` : '0.00'} <span style="font-size: 12px; font-family: 'Cairo', sans-serif;">ج.م</span>
        </div>
        <div style="font-size: 10.5px; color: ${isGrossShortage ? '#B91C1C' : isGrossSurplus ? '#15803D' : '#475569'}; font-weight: 600;">
          فارق العدد: <strong>${cashier.orderCountDifference > 0 ? '+' : ''}${cashier.orderCountDifference}</strong> شيك | ${isGrossShortage ? 'عجز ألوها عن طلبات' : isGrossSurplus ? 'زيادة ألوها عن طلبات' : 'متزن'}
        </div>
      </div>

      <!-- Card 4: Audit Quality Index -->
      <div style="background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 12px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; font-weight: 800; color: #1E40AF;">معدل دقة المطابقة (Quality Index)</span>
          <span style="font-size: 10px; background: #DBEAFE; color: #1E40AF; font-weight: 700; padding: 1px 6px; border-radius: 6px;">Precision</span>
        </div>
        <div style="font-size: 19px; font-weight: 900; color: #2563EB; font-family: 'JetBrains Mono', monospace; margin: 4px 0 2px 0;">
          ${summary.financialAccuracyRate}% <span style="font-size: 12px; font-family: 'Cairo', sans-serif;">تطابق</span>
        </div>
        <div style="font-size: 10.5px; color: #1D4ED8; font-weight: 600;">
          شيكات متطابقة 100%: <strong>${summary.matchCount}</strong> من إجمالي <strong>${summary.totalEvaluatedCount}</strong>
        </div>
      </div>

    </div>

    <!-- Diagnostic Panels (Cash Drawer vs Credit Settlement) -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
      
      <!-- Panel 1: Cash Drawer Position -->
      <div style="background: ${isCashShortage ? '#FFF1F2' : isCashSurplus ? '#ECFDF5' : '#F8FAFC'}; border: 1.5px solid ${isCashShortage ? '#FECDD3' : isCashSurplus ? '#A7F3D0' : '#E2E8F0'}; border-radius: 12px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 5px; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 800; color: #502314;">💵 1. تحليل وضع درج الكاش (Cash Drawer Position)</span>
          <span style="font-size: 10.5px; font-weight: 800; color: ${isCashShortage ? '#BE123C' : isCashSurplus ? '#047857' : '#0F766E'};">
            ${isCashShortage ? `عجز كاش: -${formatCurrency(Math.abs(cashDiff))} ج.م` : isCashSurplus ? `زيادة كاش: +${formatCurrency(cashDiff)} ج.م` : 'متزن تماماً (0.00 ج.م)'}
          </span>
        </div>
        <div style="font-size: 11px; color: #334155; display: flex; justify-content: space-between; font-weight: 600;">
          <span>ألوها كاش: <strong style="font-family: monospace;">${formatCurrency(cashier.alohaCashTotal)} ج.م</strong> (${cashier.alohaCashCount} شيك)</span>
          <span>طلبات كاش: <strong style="font-family: monospace;">${formatCurrency(cashier.talabatCashTotal)} ج.م</strong> (${cashier.talabatCashCount} أوردر)</span>
        </div>
        <div style="font-size: 10px; color: #64748B; margin-top: 5px; line-height: 1.4; background: rgba(255,255,255,0.6); padding: 5px 8px; border-radius: 6px;">
          <strong>التشخيص المالي:</strong> ${
            isCashShortage
              ? 'مبيعات الكاش المسجلة بألوها أقل من تقرير طلبات. قد توجد شيكات كاش لم تُسجل على السيستم أو سُجلت بالخطأ كـ Online/Credit.'
              : isCashSurplus
              ? 'مبيعات الكاش بألوها أعلى من تقرير طلبات. تم تحصيل نقدية إضافية أو ضرب أوردرات أونلاين بطريقة كاش على السيستم.'
              : 'درج النقدية متطابق بالكامل بنسبة 100% بين نظام ألوها وفواتير طلبات دون أي فروقات كاشير.'
          }
        </div>
      </div>

      <!-- Panel 2: Online / Credit Tender Position -->
      <div style="background: ${isCreditShortage ? '#FFFBEB' : isCreditSurplus ? '#EFF6FF' : '#F8FAFC'}; border: 1.5px solid ${isCreditShortage ? '#FDE68A' : isCreditSurplus ? '#BFDBFE' : '#E2E8F0'}; border-radius: 12px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 5px; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 800; color: #502314;">💳 2. تسوية الأونلاين والفيزا (Online & Credit Settlement)</span>
          <span style="font-size: 10.5px; font-weight: 800; color: ${isCreditShortage ? '#B45309' : isCreditSurplus ? '#1D4ED8' : '#0F766E'};">
            ${isCreditShortage ? `عجز أونلاين: -${formatCurrency(Math.abs(creditDiff))} ج.م` : isCreditSurplus ? `زيادة أونلاين: +${formatCurrency(creditDiff)} ج.م` : 'متطابق تماماً (0.00 ج.م)'}
          </span>
        </div>
        <div style="font-size: 11px; color: #334155; display: flex; justify-content: space-between; font-weight: 600;">
          <span>ألوها أونلاين: <strong style="font-family: monospace;">${formatCurrency(cashier.alohaCreditTotal)} ج.م</strong> (${cashier.alohaCreditCount} شيك)</span>
          <span>طلبات أونلاين: <strong style="font-family: monospace;">${formatCurrency(cashier.talabatCreditTotal)} ج.م</strong> (${cashier.talabatCreditCount} أوردر)</span>
        </div>
        <div style="font-size: 10px; color: #64748B; margin-top: 5px; line-height: 1.4; background: rgba(255,255,255,0.6); padding: 5px 8px; border-radius: 6px;">
          <strong>التشخيص المالي:</strong> ${
            isCreditSurplus
              ? 'الأونلاين بألوها أعلى من طلبات (Tender Shift: تم تسجيل شيكات كاش كـ Credit على السيستم أو فواتير مكررة).'
              : isCreditShortage
              ? 'أوردرات الأونلاين بطلبات أعلى من المسجل بألوها. يُرجى مراجعة الشيكات غير المغلقة أو المعلقة.'
              : 'جميع مدفوعات الأونلاين والفيزا متطابقة بالكامل بين السيستم وتقرير طلبات.'
          }
        </div>
      </div>

    </div>

    <!-- Tender Settlement Matrix Table -->
    <div style="margin-top: 12px;">
      <div style="font-size: 12px; font-weight: 800; color: #1E293B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
        <span>📊 3. مصفوفة تسوية طرق الدفع والتحصيل (Payment Tender Settlement Matrix):</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #E2E8F0;">
        <thead>
          <tr style="background: #502314; color: #FFFFFF; font-weight: 800; text-align: center;">
            <th style="padding: 7px 10px; text-align: right;">طريقة الدفع (Tender)</th>
            <th style="padding: 7px 8px;">أوردرات طلبات</th>
            <th style="padding: 7px 10px; text-align: right;">إجمالي طلبات</th>
            <th style="padding: 7px 8px;">شيكات ألوها</th>
            <th style="padding: 7px 10px; text-align: right;">إجمالي ألوها</th>
            <th style="padding: 7px 10px; text-align: right;">فارق القيمة (Variance)</th>
            <th style="padding: 7px 8px;">فارق العدد</th>
            <th style="padding: 7px 10px; text-align: center;">حالة التسوية والتدقيق</th>
          </tr>
        </thead>
        <tbody>
          <!-- Cash Row -->
          <tr style="background: #FFFFFF; border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 7px 10px; font-weight: 700; color: #1E293B; text-align: right;">
              💵 النقدية / درج الكاش (Cash Drawer)
            </td>
            <td style="padding: 7px 8px; text-align: center; font-family: monospace;">${cashier.talabatCashCount}</td>
            <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 700;">${formatCurrency(cashier.talabatCashTotal)} ج.م</td>
            <td style="padding: 7px 8px; text-align: center; font-family: monospace;">${cashier.alohaCashCount}</td>
            <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 700;">${formatCurrency(cashier.alohaCashTotal)} ج.م</td>
            <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 800; color: ${cashier.cashDifference < -0.05 ? '#DC2626' : cashier.cashDifference > 0.05 ? '#16A34A' : '#475569'};">
              ${cashier.cashDifference < 0 ? '-' : cashier.cashDifference > 0 ? '+' : ''}${formatCurrency(Math.abs(cashier.cashDifference))} ج.م
            </td>
            <td style="padding: 7px 8px; text-align: center; font-family: monospace; font-weight: 700;">
              ${cashier.alohaCashCount - cashier.talabatCashCount > 0 ? '+' : ''}${cashier.alohaCashCount - cashier.talabatCashCount}
            </td>
            <td style="padding: 7px 10px; text-align: center; font-weight: 700; color: ${cashier.cashDifference < -0.05 ? '#991B1B' : cashier.cashDifference > 0.05 ? '#166534' : '#15803D'};">
              ${cashier.cashDifference < -0.05 ? '⚠️ عجز كاش بألوها' : cashier.cashDifference > 0.05 ? '⚠️ زيادة كاش بألوها' : '✅ متطابق ومتزن (0.00)'}
            </td>
          </tr>

          <!-- Online / Credit Row -->
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 7px 10px; font-weight: 700; color: #1E293B; text-align: right;">
              💳 الأونلاين والفيزا (Online / Credit)
            </td>
            <td style="padding: 7px 8px; text-align: center; font-family: monospace;">${cashier.talabatCreditCount}</td>
            <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 700;">${formatCurrency(cashier.talabatCreditTotal)} ج.م</td>
            <td style="padding: 7px 8px; text-align: center; font-family: monospace;">${cashier.alohaCreditCount}</td>
            <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 700;">${formatCurrency(cashier.alohaCreditTotal)} ج.م</td>
            <td style="padding: 7px 10px; text-align: right; font-family: monospace; font-weight: 800; color: ${cashier.creditDifference < -0.05 ? '#DC2626' : cashier.creditDifference > 0.05 ? '#2563EB' : '#475569'};">
              ${cashier.creditDifference < 0 ? '-' : cashier.creditDifference > 0 ? '+' : ''}${formatCurrency(Math.abs(creditDiff))} ج.م
            </td>
            <td style="padding: 7px 8px; text-align: center; font-family: monospace; font-weight: 700;">
              ${cashier.alohaCreditCount - cashier.talabatCreditCount > 0 ? '+' : ''}${cashier.alohaCreditCount - cashier.talabatCreditCount}
            </td>
            <td style="padding: 7px 10px; text-align: center; font-weight: 700; color: ${cashier.creditDifference < -0.05 ? '#B45309' : cashier.creditDifference > 0.05 ? '#1D4ED8' : '#15803D'};">
              ${cashier.creditDifference < -0.05 ? '⚠️ عجز أونلاين بألوها' : cashier.creditDifference > 0.05 ? 'ℹ️ زيادة أونلاين (Tender Shift)' : '✅ متطابق ومتزن (0.00)'}
            </td>
          </tr>

          <!-- Grand Total Row -->
          <tr style="background: #FEF3C7; font-weight: 900; color: #502314; border-top: 2px solid #F59E0B;">
            <td style="padding: 8px 10px; text-align: right; font-size: 11px;">
              ⭐ الإجمالي الكلي (Grand Total)
            </td>
            <td style="padding: 8px 8px; text-align: center; font-family: monospace;">${cashier.talabatTotalOrdersCount}</td>
            <td style="padding: 8px 10px; text-align: right; font-family: monospace;">${formatCurrency(cashier.talabatGrandTotal)} ج.م</td>
            <td style="padding: 8px 8px; text-align: center; font-family: monospace;">${cashier.alohaTotalOrdersCount}</td>
            <td style="padding: 8px 10px; text-align: right; font-family: monospace;">${formatCurrency(cashier.alohaGrandTotal)} ج.م</td>
            <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 11.5px; color: ${cashier.grossSalesDifference < -0.05 ? '#DC2626' : cashier.grossSalesDifference > 0.05 ? '#16A34A' : '#16A34A'};">
              ${cashier.grossSalesDifference < 0 ? '-' : cashier.grossSalesDifference > 0 ? '+' : ''}${formatCurrency(Math.abs(grossDiff))} ج.م
            </td>
            <td style="padding: 8px 8px; text-align: center; font-family: monospace;">
              ${cashier.orderCountDifference > 0 ? '+' : ''}${cashier.orderCountDifference}
            </td>
            <td style="padding: 8px 10px; text-align: center; font-size: 11px; color: ${cashier.grossSalesDifference < -0.05 ? '#991B1B' : cashier.grossSalesDifference > 0.05 ? '#166534' : '#15803D'};">
              ${cashier.grossSalesDifference < -0.05 ? 'عجز إجمالي بالمبيعات' : cashier.grossSalesDifference > 0.05 ? 'زيادة إجمالية بالمبيعات' : 'مطابقة مالية تامة 100%'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Operational Strip (Delivery Sales, Excel Method Breakdown, Discrepancies) -->
    <div style="display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 10px; margin-top: 12px;">
      
      <div style="background: #FEF3C7; border: 1.2px solid #FCD34D; border-radius: 10px; padding: 8px 12px;">
        <span style="font-size: 10px; font-weight: 800; color: #92400E; display: block;">🛵 مبيعات دليفري ألوها (Free-Dele / HD):</span>
        <div style="font-size: 14px; font-weight: 900; color: #78350F; font-family: monospace; margin-top: 2px;">
          ${formatCurrency(summary.deliveryOrdersTotal || 0)} <span style="font-size: 10px; font-family: 'Cairo', sans-serif;">ج.م</span>
        </div>
        <div style="font-size: 9.5px; color: #A16207; font-weight: 600;">
          عدد أوردرات الدليفري: <strong>${summary.deliveryOrdersCount || 0}</strong> أوردر
        </div>
      </div>

      <div style="background: #F3F4F6; border: 1.2px solid #E5E7EB; border-radius: 10px; padding: 8px 12px;">
        <span style="font-size: 10px; font-weight: 800; color: #374151; display: block;">📑 تصنيف دفع إكسيل طلبات (Excel Tender):</span>
        <div style="font-size: 10.5px; color: #1F2937; margin-top: 2px; display: flex; justify-content: space-between;">
          <span>كاش: <strong>${formatCurrency(excelPayments.cash.total)} ج.م</strong> (${excelPayments.cash.count})</span>
          <span>فيزا: <strong>${formatCurrency(excelPayments.card.total)} ج.م</strong> (${excelPayments.card.count})</span>
        </div>
        <div style="font-size: 10px; color: #4B5563; margin-top: 1px;">
          أونلاين/تطبيق: <strong>${formatCurrency(excelPayments.talabat.total)} ج.م</strong> (${excelPayments.talabat.count})
        </div>
      </div>

      <div style="background: #FEF2F2; border: 1.2px solid #FECDD3; border-radius: 10px; padding: 8px 12px;">
        <span style="font-size: 10px; font-weight: 800; color: #991B1B; display: block;">🚨 ملخص الفروقات والتنبيهات:</span>
        <div style="font-size: 10px; color: #B91C1C; font-weight: 700; margin-top: 2px;">
          تعارض طرق الدفع: <strong>${summary.methodMismatchCount}</strong> شيك | غير بطلبات: <strong>${summary.missingInTalabatCount}</strong>
        </div>
        <div style="font-size: 9.5px; color: #991B1B;">
          غير مسجل بألوها: <strong>${summary.missingInAlohaCount}</strong> (${formatCurrency(summary.missingInAlohaTotal)} ج.م)
        </div>
      </div>

    </div>

    <!-- Page Footer -->
    <div style="border-top: 1.5px solid #E2E8F0; padding-top: 8px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748B;">
      <div>
        <strong style="color: #502314;">BURGER KING® & TALABAT®</strong> — نظام المراجعة والتدقيق المالي الذكي (Aloha POS Reconciler Engine)
      </div>
      <div style="font-weight: 700; font-family: monospace; color: #1E293B;">
        صفحة ${pageIndex} من ${totalPages} (Page ${pageIndex} of ${totalPages})
      </div>
    </div>

  </div>
  `;
}

/**
 * Builds HTML for Table Ledger Pages with full Arabic and English support
 */
function buildLedgerPageHTML(
  rowsSlice: ComparisonRow[],
  startIndex: number,
  pageIndex: number,
  totalPages: number,
  excelFileName?: string
): string {
  return `
  <div class="pdf-page" style="width: 1122px; height: 793px; padding: 22px 28px; box-sizing: border-box; background: #FFFFFF; font-family: 'Cairo', 'IBM Plex Sans Arabic', 'Tajawal', 'Plus Jakarta Sans', system-ui, sans-serif; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
    
    <!-- Top Mini Header -->
    <div>
      <div style="background: #502314; border-radius: 10px; padding: 9px 16px; color: #FFFFFF; display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #D71920;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: 900; font-size: 14px; color: #FFF;">BURGER KING × TALABAT</span>
          <span style="color: #FCD34D;">|</span>
          <span style="font-size: 12px; font-weight: 700; color: #FEF3C7;">كشف المطابقة والتدقيق التفصيلي للفواتير والشيكات (Detailed Ledger)</span>
        </div>
        <div style="font-size: 10.5px; color: #E2E8F0;">
          المصدر: <strong style="color: #93C5FD; font-family: monospace;">${excelFileName || 'Talabat_Report.xlsx'}</strong>
        </div>
      </div>

      <!-- Signals Legend Bar -->
      <div style="display: flex; align-items: center; justify-content: space-between; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 5px 12px; margin-top: 8px; font-size: 10px; color: #475569;">
        <span style="font-weight: 800; color: #1E293B;">دليل الإشارات الضوئية:</span>
        <div style="display: flex; align-items: center; gap: 14px;">
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 9px; height: 9px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
            <strong style="color: #065F46;">بألوها فقط (غير بطلبات)</strong>
          </span>
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 9px; height: 9px; border-radius: 50%; background: #E11D48; display: inline-block;"></span>
            <strong style="color: #9F1239;">غير مسجل بألوها</strong>
          </span>
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 9px; height: 9px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span>
            <strong style="color: #92400E;">ألوها كاش / طلبات أونلاين</strong>
          </span>
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 9px; height: 9px; border-radius: 50%; background: #DC2626; display: inline-block;"></span>
            <strong style="color: #991B1B;">ألوها أونلاين / طلبات كاش</strong>
          </span>
          <span style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 9px; height: 9px; border-radius: 50%; background: #BE123C; display: inline-block;"></span>
            <strong style="color: #BE123C;">Transfer Out / ملغي محمل على الفرع</strong>
          </span>
        </div>
      </div>

      <!-- Detail Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; border: 1px solid #CBD5E1; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background: #2D1910; color: #FFFFFF; font-weight: 800; text-align: center;">
            <th style="padding: 6px 4px; width: 32px;">#</th>
            <th style="padding: 6px 6px; width: 70px;">رقم الشيك Check #</th>
            <th style="padding: 6px 6px; width: 105px;">رقم طلبات Order ID</th>
            <th style="padding: 6px 6px; width: 85px;">الوقت والكاشير</th>
            <th style="padding: 6px 6px; width: 80px; text-align: right;">ألوها (ج.م)</th>
            <th style="padding: 6px 6px; width: 80px; text-align: right;">طلبات (ج.م)</th>
            <th style="padding: 6px 6px; width: 85px; text-align: right;">الفارق (ج.م)</th>
            <th style="padding: 6px 6px; width: 75px;">دفع ألوها</th>
            <th style="padding: 6px 6px; width: 75px;">دفع طلبات</th>
            <th style="padding: 6px 8px; text-align: right; width: 170px;">الملاحظات والبيان</th>
          </tr>
        </thead>
        <tbody>
          ${rowsSlice
            .map((r, idx) => {
              const globalIndex = startIndex + idx + 1;
              const signal = getRowSignal(r);
              const isDeficit = r.difference < -0.01;
              const isSurplus = r.difference > 0.01;

              const isTransfer = signal === 'transfer_out';
              const isMissingInTalabat = signal === 'missing_in_talabat';
              const isMissingInAloha = signal === 'missing_in_aloha';

              // User's custom written/edited note only
              const customNote = (r.customVarianceNote || '').trim();
              const userComment = (r.comment && !r.comment.includes('معتمد من فورمة') && !r.comment.includes('Exact match') && !r.comment.includes('Matched by') && !r.comment.includes('Order listed in Talabat') ? r.comment.trim() : '');
              const userReason = (r.varianceReason && !r.varianceReason.includes('معتمد من فورمة') && !r.varianceReason.includes('Disc.') ? r.varianceReason.trim() : '');
              const userText = customNote || userComment || userReason;

              // Determine row background color
              let rowBg = idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF';
              let rowBorderLeft = 'none';

              if (isTransfer) {
                rowBg = '#FFF1F2';
                rowBorderLeft = '3.5px solid #E11D48';
              } else if (isMissingInTalabat) {
                rowBg = '#F0FDF4';
                rowBorderLeft = '3.5px solid #10B981';
              } else if (isMissingInAloha) {
                rowBg = '#FFF1F2';
                rowBorderLeft = '3.5px solid #E11D48';
              } else if (signal === 'aloha_cash_talabat_credit') {
                rowBg = '#FEF3C7';
                rowBorderLeft = '3.5px solid #F59E0B';
              } else if (signal === 'aloha_credit_talabat_cash') {
                rowBg = '#FFF1F2';
                rowBorderLeft = '3.5px solid #E11D48';
              } else if (userText) {
                rowBg = '#FEFCE8';
                rowBorderLeft = '3.5px solid #EAB308';
              }

              // Check number display
              let checkDisplay = r.number && r.number !== '—' ? `#${r.number}` : (isTransfer ? '#0 (M.O.E)' : '—');
              
              // Talabat order display
              let talabatOrderDisplay = r.orderId && r.orderId !== '—' ? r.orderId : (isMissingInTalabat ? '— (غير بطلبات)' : '—');

              // Notes column: ONLY show what the user manually typed or modified
              let noteDisplay = '';
              if (userText) {
                noteDisplay = `<span style="color: #1E293B; font-weight: 700; font-size: 9.5px; word-break: break-word;">${sanitizeTextForPdf(userText)}</span>`;
              }

              return `
              <tr style="background: ${rowBg}; border-bottom: 1px solid #E2E8F0; border-left: ${rowBorderLeft};">
                <td style="padding: 5px 3px; text-align: center; font-weight: 700; font-family: monospace; color: #64748B;">
                  ${globalIndex}
                </td>
                <td style="padding: 5px 6px; text-align: center; font-weight: 800; font-family: monospace; color: ${isTransfer ? '#BE123C' : isMissingInAloha ? '#E11D48' : '#1E293B'};">
                  ${checkDisplay}
                </td>
                <td style="padding: 5px 6px; text-align: center; font-weight: 700; font-family: monospace; color: ${isMissingInTalabat ? '#059669' : '#334155'};">
                  ${talabatOrderDisplay}
                </td>
                <td style="padding: 5px 6px; text-align: center; font-size: 9.5px; color: #475569;">
                  <div style="font-family: monospace; font-weight: bold;">${r.alohaTime || r.talabatTime || '—'}</div>
                  ${r.alohaHost ? `<div style="font-size: 8.5px; color: #64748B;">${r.alohaHost}</div>` : ''}
                </td>
                <td style="padding: 5px 6px; text-align: right; font-weight: 800; font-family: monospace; color: #1E293B;">
                  ${r.alohaPrice > 0 ? formatCurrency(r.alohaPrice) : '0.00'}
                </td>
                <td style="padding: 5px 6px; text-align: right; font-weight: 800; font-family: monospace; color: #1E293B;">
                  ${r.talabatPrice > 0 ? formatCurrency(r.talabatPrice) : '0.00'}
                </td>
                <td style="padding: 5px 6px; text-align: right; font-weight: 900; font-family: monospace; color: ${isDeficit ? '#DC2626' : isSurplus ? '#16A34A' : '#64748B'};">
                  ${r.difference !== 0 ? `${r.difference < 0 ? '-' : '+'}${formatCurrency(Math.abs(r.difference))}` : '0.00'}
                </td>
                <td style="padding: 5px 6px; text-align: center;">
                  <span style="font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${(r.localPayment || '').toLowerCase().includes('cash') || (r.localPayment || '').includes('كاش') ? '#DCFCE7' : '#DBEAFE'}; color: ${(r.localPayment || '').toLowerCase().includes('cash') || (r.localPayment || '').includes('كاش') ? '#166534' : '#1E40AF'};">
                    ${r.localPayment || '—'}
                  </span>
                </td>
                <td style="padding: 5px 6px; text-align: center;">
                  <span style="font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${(r.talabatMethod || '').toUpperCase() === 'CASH' || (r.talabatMethod || '').includes('كاش') ? '#DCFCE7' : '#FFEDD5'}; color: ${(r.talabatMethod || '').toUpperCase() === 'CASH' || (r.talabatMethod || '').includes('كاش') ? '#166534' : '#9A3412'};">
                    ${r.talabatMethod || '—'}
                  </span>
                </td>
                <td style="padding: 5px 8px; text-align: right; font-size: 9.5px; line-height: 1.35;">
                  ${noteDisplay}
                </td>
              </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- Page Footer -->
    <div style="border-top: 1.5px solid #E2E8F0; padding-top: 6px; margin-top: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #64748B;">
      <div>
        <strong style="color: #502314;">BURGER KING® & TALABAT®</strong> — تقرير المطابقة التفصيلي | صفحة ${pageIndex} من ${totalPages}
      </div>
      <div style="font-weight: 700; font-family: monospace; color: #1E293B;">
        Page ${pageIndex} of ${totalPages}
      </div>
    </div>

  </div>
  `;
}

/**
 * Generates an executive, pristine Vector/Canvas PDF Report with full Arabic font rendering,
 * crystal-clear typography, Burger King brand identity, and complete Order Reconciliation Ledger.
 */
export async function generateReconciliationPDFBlob(data: PDFExportData): Promise<Blob> {
  const { rows } = data;

  // Wait for Google Fonts to be ready so Cairo / Tajawal / IBM Plex Sans Arabic render sharply
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  // Calculate page chunking for detail table (17-18 rows per A4 landscape page for optimal spacing)
  const ROWS_PER_PAGE = 16;
  const tablePagesCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const totalPages = 1 + tablePagesCount; // Page 1 = Executive Dashboard, Pages 2+ = Detail Ledger

  // Create isolated rendering container attached to DOM
  const sandbox = document.createElement('div');
  sandbox.id = `pdf-sandbox-${Date.now()}`;
  sandbox.style.position = 'fixed';
  sandbox.style.left = '-10000px';
  sandbox.style.top = '0';
  sandbox.style.width = '1122px';
  sandbox.style.zIndex = '-9999';
  sandbox.style.backgroundColor = '#FFFFFF';
  sandbox.style.direction = 'ltr';
  sandbox.style.fontFamily = "'Cairo', 'IBM Plex Sans Arabic', 'Tajawal', 'Plus Jakarta Sans', system-ui, sans-serif";

  // Build Page 1: Dashboard
  const page1Div = document.createElement('div');
  page1Div.innerHTML = buildDashboardPageHTML(data, 1, totalPages);
  sandbox.appendChild(page1Div);

  // Build Pages 2+: Ledger
  for (let p = 0; p < tablePagesCount; p++) {
    const startIdx = p * ROWS_PER_PAGE;
    const endIdx = Math.min(rows.length, startIdx + ROWS_PER_PAGE);
    const rowsSlice = rows.slice(startIdx, endIdx);

    const pageLedgerDiv = document.createElement('div');
    pageLedgerDiv.innerHTML = buildLedgerPageHTML(
      rowsSlice,
      startIdx,
      p + 2,
      totalPages,
      data.excelFileName
    );
    sandbox.appendChild(pageLedgerDiv);
  }

  document.body.appendChild(sandbox);

  try {
    // Initialize jsPDF (A4 Landscape: 297mm x 210mm)
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageElements = sandbox.querySelectorAll<HTMLElement>('.pdf-page');

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i];

      // High-res canvas rendering (scale: 2 creates crisp 2x retina text without blurring)
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        width: 1122,
        height: 793,
        windowWidth: 1122,
        windowHeight: 793,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) {
        doc.addPage('a4', 'landscape');
      }

      doc.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
    }

    return doc.output('blob');
  } finally {
    // Cleanup temporary sandbox from DOM
    if (document.body.contains(sandbox)) {
      document.body.removeChild(sandbox);
    }
  }
}

/**
 * Export structured Vector PDF with full summary, Tender Matrix, and Audit Discrepancies
 */
export async function exportReconciliationPDF(data: PDFExportData): Promise<void> {
  const fileName = `BK_Talabat_Reconciliation_Audit_${new Date().toISOString().slice(0, 10)}.pdf`;
  const pdfBlob = await generateReconciliationPDFBlob(data);
  await saveFileWithPicker(pdfBlob, fileName, [
    {
      description: 'PDF Document (*.pdf)',
      accept: {
        'application/pdf': ['.pdf'],
      },
    },
  ]);
}
