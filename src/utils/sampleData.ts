export const sampleAlohaText = `Welcome To BURGER KING
Store #1124 - Cairo
Host: ahmed,11267             02/07/2026
HD94                             3:06 AM
                                   30094
Order Type: Otlob.com
Area: Delivery
Otlob Mode L.E 519.52
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/06/2026
HD96                            11:16 AM
                                   30005
Order Type: Delivery
Area: Delivery
Cash L.E 175.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/06/2026
HD96                            11:22 AM
                                   30006
Order Type: Otlob.com
Area: Delivery
Otlob Mode L.E 340.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/06/2026
HD96                            11:35 AM
                                   30007
Order Type:  Free-Dele
Area: Delivery
Cash L.E 290.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/06/2026
HD96                            11:42 AM
                                   30008
Order Type: Delivery
Area: Delivery
Otlob Mode L.E 420.50
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/06/2026
HD96                            11:50 AM
                                   30009
Order Type: Otlob.com
Area: Delivery
Otlob Mode L.E 610.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/06/2026
HD96                            12:02 PM
                                   30010
Order Type:  Free-Dele
Area: Delivery
Cash L.E 215.00
`;

export const sampleExcelComparison = [
  {
    'Aloha No': '30005',
    'Order ID': 'TAL-982104',
    'Date / Time': '02/07/2026 06:12 AM',
    'Aloha Price': 519.52,
    'Talabat': 519.52,
    'Payment Method': 'Cash',
  },
  {
    'Aloha No': '30006',
    'Order ID': 'TAL-982105',
    'Date / Time': '02/07/2026 06:18 AM',
    'Aloha Price': 175.00,
    'Talabat': 175.00,
    'Payment Method': 'Talabat Credit',
  },
  {
    'Aloha No': '30007',
    'Order ID': 'TAL-982106',
    'Date / Time': '02/07/2026 06:35 AM',
    'Aloha Price': 340.00,
    'Talabat': 320.00, // Deficit of 20
    'Payment Method': 'Cash',
  },
  {
    'Aloha No': '30008',
    'Order ID': 'TAL-982107',
    'Date / Time': '02/07/2026 06:42 AM',
    'Aloha Price': 290.00,
    'Talabat': 310.00, // Surplus of 20
    'Payment Method': 'Credit Card',
  },
  {
    'Aloha No': '30009',
    'Order ID': 'TAL-982108',
    'Date / Time': '02/07/2026 07:05 AM',
    'Aloha Price': 420.50,
    'Talabat': 420.50,
    'Payment Method': 'Talabat Credit',
  },
  {
    'Aloha No': '30010',
    'Order ID': 'TAL-982109',
    'Date / Time': '02/07/2026 07:22 AM',
    'Aloha Price': 610.00,
    'Talabat': 585.00, // Deficit of 25
    'Payment Method': 'Cash',
  },
  {
    'Aloha No': '30012', // Not present in local restaurant POS
    'Order ID': 'TAL-982110',
    'Date / Time': '01/07/2026 09:27 AM',
    'Aloha Price': 190.00,
    'Talabat': 190.00,
    'Payment Method': 'Credit Card',
  },
];

export const sampleMonthlyDayFiles = [
  {
    fileName: 'Aloha_Checks_Day01_July.txt',
    date: '01/07/2026',
    text: `Welcome To BURGER KING
Store #1124 - Cairo
Host: Ahmed,11267             01/07/2026
HD94                             3:06 AM
                                   30001
Order Type: Otlob.com
Area: Delivery
Otlob Mode L.E 245.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Ahmed,11267             01/07/2026
HD94                             4:15 AM
                                   30002
Order Type: Delivery
Area: Delivery
Cash L.E 310.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Ahmed,11267             01/07/2026
HD94                             5:20 AM
                                   30003
Order Type: Free-Dele
Area: Delivery
Cash L.E 180.50
`,
  },
  {
    fileName: 'Aloha_Checks_Day02_July.txt',
    date: '02/07/2026',
    text: `Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/07/2026
HD96                            11:16 AM
                                   30005
Order Type: Delivery
Area: Delivery
Cash L.E 519.52
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/07/2026
HD96                            11:22 AM
                                   30006
Order Type: Otlob.com
Area: Delivery
Otlob Mode L.E 175.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/07/2026
HD96                            11:35 AM
                                   30007
Order Type:  Free-Dele
Area: Delivery
Cash L.E 340.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mohamed,5638             02/07/2026
HD96                            11:42 AM
                                   30008
Order Type: Delivery
Area: Delivery
Otlob Mode L.E 290.00
`,
  },
  {
    fileName: 'Aloha_Checks_Day03_July.txt',
    date: '03/07/2026',
    text: `Welcome To BURGER KING
Store #1124 - Cairo
Host: Mahmoud,8819             03/07/2026
HD92                             1:40 PM
                                   30015
Order Type: Otlob.com
Area: Delivery
Otlob Mode L.E 420.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mahmoud,8819             03/07/2026
HD92                             2:15 PM
                                   30016
Order Type: Free-Dele
Area: Delivery
Cash L.E 265.00
--------------------------------
Welcome To BURGER KING
Store #1124 - Cairo
Host: Mahmoud,8819             03/07/2026
HD92                             3:00 PM
                                   30017
Order Type: Delivery
Area: Delivery
Credit Card L.E 550.00
`,
  },
];

export const sampleMonthlyExcelComparison = [
  // Day 1
  {
    'Aloha No': '30001',
    'Order ID': 'TAL-982001',
    'Date / Time': '01/07/2026 03:06 AM',
    'Aloha Price': 245.00,
    'Talabat': 245.00,
    'Payment Method': 'Talabat Credit',
  },
  {
    'Aloha No': '30002',
    'Order ID': 'TAL-982002',
    'Date / Time': '01/07/2026 04:15 AM',
    'Aloha Price': 310.00,
    'Talabat': 310.00,
    'Payment Method': 'Cash',
  },
  {
    'Aloha No': '30003',
    'Order ID': 'TAL-982003',
    'Date / Time': '01/07/2026 05:20 AM',
    'Aloha Price': 180.50,
    'Talabat': 180.50,
    'Payment Method': 'Cash',
  },
  // Day 2
  {
    'Aloha No': '30005',
    'Order ID': 'TAL-982104',
    'Date / Time': '02/07/2026 11:16 AM',
    'Aloha Price': 519.52,
    'Talabat': 519.52,
    'Payment Method': 'Cash',
  },
  {
    'Aloha No': '30006',
    'Order ID': 'TAL-982105',
    'Date / Time': '02/07/2026 11:22 AM',
    'Aloha Price': 175.00,
    'Talabat': 175.00,
    'Payment Method': 'Talabat Credit',
  },
  {
    'Aloha No': '30007',
    'Order ID': 'TAL-982106',
    'Date / Time': '02/07/2026 11:35 AM',
    'Aloha Price': 340.00,
    'Talabat': 320.00, // deficit
    'Payment Method': 'Cash',
  },
  {
    'Aloha No': '30008',
    'Order ID': 'TAL-982107',
    'Date / Time': '02/07/2026 11:42 AM',
    'Aloha Price': 290.00,
    'Talabat': 310.00, // surplus
    'Payment Method': 'Credit Card',
  },
  // Day 3
  {
    'Aloha No': '30015',
    'Order ID': 'TAL-982201',
    'Date / Time': '03/07/2026 01:40 PM',
    'Aloha Price': 420.00,
    'Talabat': 420.00,
    'Payment Method': 'Talabat Credit',
  },
  {
    'Aloha No': '30016',
    'Order ID': 'TAL-982202',
    'Date / Time': '03/07/2026 02:15 PM',
    'Aloha Price': 265.00,
    'Talabat': 265.00,
    'Payment Method': 'Cash',
  },
  {
    'Aloha No': '30017',
    'Order ID': 'TAL-982203',
    'Date / Time': '03/07/2026 03:00 PM',
    'Aloha Price': 550.00,
    'Talabat': 550.00,
    'Payment Method': 'Credit Card',
  },
];

export interface TalabatAlohaReconciliationItem {
  alohaOrderNo: string; // رقم الأوردر في ألوها (أو 0 إذا ملغي/خصم)
  talabatOrderNo: string; // رقم أوردر طلبات 373...
  time: string; // الوقت
  paymentMethod: string; // Cash Or Credit
  alohaAmount: number; // مبلغ ألوها Aloha AM
  talabatAmount: number; // مبلغ طلبات Talabat AM
  variance: number; // الفارق: Aloha AM - Talabat AM
  comment: string; // الملاحظات (متطابق / فرق توصيل Serv / أوردر ملغي Cancel Charged على المطعم)
  isCancelledOrMoe?: boolean;
  isDeliveryFeeVariance?: boolean;
}

export const sampleBurgerKingTalabatReconciliationRows: TalabatAlohaReconciliationItem[] = [
  {
    alohaOrderNo: '4001',
    talabatOrderNo: '373891042',
    time: '12:35 PM',
    paymentMethod: 'Cash',
    alohaAmount: 245.0,
    talabatAmount: 245.0,
    variance: 0.0,
    comment: 'متطابق تماماً',
  },
  {
    alohaOrderNo: '4002',
    talabatOrderNo: '373891055',
    time: '12:50 PM',
    paymentMethod: 'Credit',
    alohaAmount: 265.0,
    talabatAmount: 250.0,
    variance: 15.0,
    comment: 'فرق توصيل Serv (+15.00)',
    isDeliveryFeeVariance: true,
  },
  {
    alohaOrderNo: '4003',
    talabatOrderNo: '373891068',
    time: '01:15 PM',
    paymentMethod: 'Credit',
    alohaAmount: 380.0,
    talabatAmount: 380.0,
    variance: 0.0,
    comment: 'متطابق تماماً',
  },
  {
    alohaOrderNo: '0',
    talabatOrderNo: '373891080',
    time: '01:40 PM',
    paymentMethod: 'Credit',
    alohaAmount: 0.0,
    talabatAmount: 180.0,
    variance: -180.0,
    comment: 'أوردر ملغي Cancel Charged على المطعم (M.O.E)',
    isCancelledOrMoe: true,
  },
  {
    alohaOrderNo: '4005',
    talabatOrderNo: '373891092',
    time: '02:05 PM',
    paymentMethod: 'Cash',
    alohaAmount: 420.0,
    talabatAmount: 420.0,
    variance: 0.0,
    comment: 'متطابق تماماً',
  },
  {
    alohaOrderNo: '4006',
    talabatOrderNo: '373891104',
    time: '02:20 PM',
    paymentMethod: 'Cash',
    alohaAmount: 310.0,
    talabatAmount: 290.0,
    variance: 20.0,
    comment: 'فرق توصيل Serv (+20.00)',
    isDeliveryFeeVariance: true,
  },
  {
    alohaOrderNo: '0',
    talabatOrderNo: '373891118',
    time: '02:45 PM',
    paymentMethod: 'Cash',
    alohaAmount: 0.0,
    talabatAmount: 320.0,
    variance: -320.0,
    comment: 'أوردر ملغي Cancel Charged على المطعم (M.O.E)',
    isCancelledOrMoe: true,
  },
  {
    alohaOrderNo: '4008',
    talabatOrderNo: '373891129',
    time: '03:10 PM',
    paymentMethod: 'Credit',
    alohaAmount: 515.5,
    talabatAmount: 515.5,
    variance: 0.0,
    comment: 'متطابق تماماً',
  },
  {
    alohaOrderNo: '4009',
    talabatOrderNo: '373891145',
    time: '03:35 PM',
    paymentMethod: 'Cash',
    alohaAmount: 195.0,
    talabatAmount: 180.0,
    variance: 15.0,
    comment: 'فرق توصيل Serv (+15.00)',
    isDeliveryFeeVariance: true,
  },
  {
    alohaOrderNo: '4010',
    talabatOrderNo: '373891156',
    time: '04:00 PM',
    paymentMethod: 'Credit',
    alohaAmount: 640.0,
    talabatAmount: 640.0,
    variance: 0.0,
    comment: 'متطابق تماماً',
  },
  {
    alohaOrderNo: '0',
    talabatOrderNo: '373891170',
    time: '04:25 PM',
    paymentMethod: 'Credit',
    alohaAmount: 0.0,
    talabatAmount: 210.0,
    variance: -210.0,
    comment: 'أوردر ملغي Cancel Charged على المطعم (M.O.E)',
    isCancelledOrMoe: true,
  },
  {
    alohaOrderNo: '4012',
    talabatOrderNo: '373891185',
    time: '04:50 PM',
    paymentMethod: 'Cash',
    alohaAmount: 290.0,
    talabatAmount: 290.0,
    variance: 0.0,
    comment: 'متطابق تماماً',
  },
  {
    alohaOrderNo: '4013',
    talabatOrderNo: '373891198',
    time: '05:15 PM',
    paymentMethod: 'Credit',
    alohaAmount: 375.0,
    talabatAmount: 375.0,
    variance: 0.0,
    comment: 'متطابق تماماً',
  },
  {
    alohaOrderNo: '4014',
    talabatOrderNo: '373891210',
    time: '05:40 PM',
    paymentMethod: 'Cash',
    alohaAmount: 160.0,
    talabatAmount: 145.0,
    variance: 15.0,
    comment: 'فرق توصيل Serv (+15.00)',
    isDeliveryFeeVariance: true,
  },
  {
    alohaOrderNo: '4015',
    talabatOrderNo: '—',
    time: '06:05 PM',
    paymentMethod: 'Cash',
    alohaAmount: 220.0,
    talabatAmount: 0.0,
    variance: 220.0,
    comment: 'غير مسجل في كشف طلبات (Aloha Only)',
  },
];

export const sampleCrossReferenceEntries = [
  {
    id: 'ref_1',
    day: 'day 1',
    alohaOrderNo: '30053',
    alohaAmount: 1260.0,
    discOnBK: 0,
    talabatAmount: 1200.0,
    talabatOrderNo: '3731401652',
    discOnTalabat: '0',
    variance: 60.0,
    paymentMethod: 'cash',
    comment: 'معتمد من فورمة المراجعة الثلاثية (Order 30053 <-> 3731401652)',
  },
  {
    id: 'ref_2',
    day: 'day 1',
    alohaOrderNo: '30054',
    alohaAmount: 450.0,
    discOnBK: 0,
    talabatAmount: 450.0,
    talabatOrderNo: '3731401660',
    discOnTalabat: '0',
    variance: 0.0,
    paymentMethod: 'credit',
    comment: 'متطابق من فورمة المراجعة',
  },
  {
    id: 'ref_3',
    day: 'day 1',
    alohaOrderNo: '30055',
    alohaAmount: 580.0,
    discOnBK: 0,
    talabatAmount: 545.0,
    talabatOrderNo: '3731401675',
    discOnTalabat: '0',
    variance: 35.0,
    paymentMethod: 'cash',
    comment: 'فرق توصيل Serv',
  },
  {
    id: 'ref_4',
    day: 'day 1',
    alohaOrderNo: '30056',
    alohaAmount: 890.0,
    discOnBK: 40.0,
    talabatAmount: 850.0,
    talabatOrderNo: '3731401688',
    discOnTalabat: '0',
    variance: 0.0,
    paymentMethod: 'credit',
    comment: 'خصم برجر كنج BK Promo',
  },
  {
    id: 'ref_5',
    day: 'day 2',
    alohaOrderNo: '30080',
    alohaAmount: 320.0,
    discOnBK: 0,
    talabatAmount: 320.0,
    talabatOrderNo: '3731401710',
    discOnTalabat: '0',
    variance: 0.0,
    paymentMethod: 'cash',
    comment: 'متطابق',
  },
];

export const sampleCrossReferenceText = `day\tAloha Order No.\tAloha AM\tDisc. On BK\tTalabat AM\tTalabat order NO.\tDisc. On Talabat\tVarince\tCash Or Credit
day 1\t30053\t1260\t0\t1200\t3731401652\t0\t60\tcash
day 1\t30054\t450\t0\t450\t3731401660\t0\t0\tcredit
day 1\t30055\t580\t0\t545\t3731401675\t0\t35\tcash
day 1\t30056\t890\t40\t850\t3731401688\t0\t0\tcredit
day 2\t30080\t320\t0\t320\t3731401710\t0\t0\tcash`;

