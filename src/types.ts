export type UserRole = 'admin' | 'auditor' | 'accountant' | 'supervisor';

export interface UserAccount {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  roleTitleAr?: string;
  roleTitleEn?: string;
  branch: string;
  avatarUrl?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface AuditSessionState {
  auditMode: AuditMode;
  inputText: string;
  textFileName: string;
  dailyFiles: DailyFileEntry[];
  excelFileName: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

export type DiscrepancyType =
  | 'match'
  | 'deficit'
  | 'surplus'
  | 'method_mismatch'
  | 'price_and_method_mismatch'
  | 'missing_in_talabat'
  | 'missing_in_aloha'
  | 'duplicate';

export type AuditMode = 'daily' | 'monthly' | 'cross_reference' | 'ai_image';

export interface CrossReferenceEntry {
  id: string;
  day?: string; // e.g. "day 1"
  alohaOrderNo: string; // e.g. "30053"
  alohaAmount: number; // e.g. 1260
  discOnBK?: number; // e.g. 0
  talabatAmount: number; // e.g. 1200
  talabatOrderNo: string; // e.g. "3731401652"
  discOnTalabat?: string | number; // e.g. 0
  variance: number; // e.g. 60
  paymentMethod: string; // e.g. "cash" or "credit"
  comment?: string;
  rawText?: string;
}

export interface DailyFileEntry {
  id: string;
  fileName: string;
  date?: string;
  text: string;
  orderCount: number;
  totalAmount: number;
  cashAmount: number;
  creditAmount: number;
  parsedOrders: ParsedOrder[];
}

export interface ParsedOrder {
  id: string;
  number: string;
  orderType: string;
  payment: 'Cash' | 'Otlob Mode' | 'Credit Card' | 'Unspecified';
  amount: number;
  cashAmount?: number;
  creditAmount?: number;
  discount?: number;
  authNumber?: string;
  date?: string;
  time?: string;
  dateTime?: string;
  host?: string;
  hostId?: string;
  terminal?: string;
  storeName?: string;
  isDuplicate?: boolean;
  duplicateCount?: number;
  rawText?: string;
  lineIndex?: number;
  isDelivery?: boolean;
  isVoided?: boolean;
  isEmployeeMeal?: boolean;
  sourceFileName?: string;
  dayLabel?: string;
}

export interface ComparisonRow {
  key: string;
  number: string; // Aloha Order No / Check #
  orderId: string; // Talabat Order NO (373...)
  alohaPrice: number; // Aloha AM
  talabatPrice: number; // Talabat AM
  difference: number; // Variance: Aloha AM - Talabat AM
  percentageDiff: number;
  localPayment: string;
  talabatMethod: string;
  isPaymentMismatch: boolean;
  alohaDate?: string;
  alohaTime?: string;
  alohaDateTime?: string;
  alohaHost?: string;
  alohaHostId?: string;
  alohaTerminal?: string;
  talabatDate?: string;
  talabatTime?: string;
  talabatDateTime?: string;
  status: DiscrepancyType;
  statusLabel: string;
  statusSeverity: 'success' | 'warning' | 'danger' | 'info';
  auditNote: string;
  source: 'both' | 'aloha_only' | 'talabat_only';
  matchType?: 'exact_id' | 'fuzzy_id_price' | 'exact_amount' | 'promo_amount' | 'similar_amount' | 'suggested_match' | 'none';
  matchConfidence?: number;
  varianceReason?: string;
  customVarianceNote?: string;
  isVoided?: boolean;
  isEmployeeMeal?: boolean;
  rawAlohaOrder?: ParsedOrder;
  sourceFileName?: string;
  dayLabel?: string;
  // Specific requested reconciliation fields
  alohaOrderNo?: string;
  talabatOrderNo?: string;
  time?: string;
  paymentMethod?: string;
  alohaAmount?: number;
  talabatAmount?: number;
  variance?: number;
  comment?: string;
  isCancelledOrMoe?: boolean;
  isDeliveryFeeVariance?: boolean;
  day?: string;
  discOnBK?: number;
  discOnTalabat?: string | number;
  isMatchedViaCrossReference?: boolean;
  crossReferenceId?: string;
}

export interface AlohaSummary {
  cashTotal: number;
  creditTotal: number;
  cardTotal: number;
  otherTotal: number;
  grandTotal: number;
  cashCount: number;
  creditCount: number;
  cardCount: number;
  otherCount: number;
  deliveryCount: number;
  dineInCount: number;
  takeawayCount: number;
  totalOrdersCount: number;
  uniqueOrdersCount: number;
  duplicateCount: number;
  averageOrderValue: number;
}

export interface ExcelPaymentSummary {
  cash: { count: number; total: number };
  card: { count: number; total: number };
  talabat: { count: number; total: number };
  other: { count: number; total: number };
  grandTotal: number;
  totalCount: number;
}

export interface CashierAuditSummary {
  // Aloha Breakdown
  alohaCashTotal: number;
  alohaCashCount: number;
  alohaCreditTotal: number; // Otlob Mode + Credit Card
  alohaCreditCount: number;
  alohaGrandTotal: number;
  alohaTotalOrdersCount: number;

  // Talabat Breakdown
  talabatCashTotal: number;
  talabatCashCount: number;
  talabatCreditTotal: number; // Credit Card + Talabat Credit + Online
  talabatCreditCount: number;
  talabatGrandTotal: number;
  talabatTotalOrdersCount: number;

  // Comparison & Variances
  cashDifference: number; // Talabat Cash - Aloha Cash
  creditDifference: number; // Talabat Credit - Aloha Credit
  grossSalesDifference: number; // Talabat Grand Total - Aloha Grand Total
  orderCountDifference: number; // Talabat Orders Count - Aloha Orders Count
  cashStatus: 'balanced' | 'cashier_shortage' | 'cashier_surplus';

  // Legacy compatibility fields
  alohaExpectedCash: number;
  talabatReportedCash: number;
  alohaOnlineTotal: number;
  talabatOnlineTotal: number;
  onlineDifference: number;
  totalSalesAloha: number;
  totalSalesTalabat: number;
  paymentMethodConflictCount: number;
  paymentMethodConflictTotal: number;
}

export interface ReconciliationSummary {
  // Financial Totals
  alohaSourceTotal: number;
  talabatSourceTotal: number;
  sourceNetTotal: number; // Talabat - Aloha
  grossDeficitTotal: number; // Sum of negative differences
  grossSurplusTotal: number; // Sum of positive differences
  netDifference: number; // grossSurplusTotal - grossDeficitTotal

  // Counts
  totalEvaluatedCount: number;
  matchCount: number;
  deficitCount: number;
  surplusCount: number;
  methodMismatchCount: number;
  missingInTalabatCount: number;
  missingInAlohaCount: number;
  duplicateCount: number;

  // Financial Values by Category
  missingInTalabatTotal: number;
  missingInAlohaTotal: number;

  // Accuracy & Quality
  matchPercentage: number;
  financialAccuracyRate: number;

  // Delivery breakdown in Aloha
  deliveryOrdersCount?: number;
  deliveryOrdersTotal?: number;

  // Cashier Drawer & Method Breakdown
  cashierAudit: CashierAuditSummary;
  excelPaymentSummary?: ExcelPaymentSummary;
}

