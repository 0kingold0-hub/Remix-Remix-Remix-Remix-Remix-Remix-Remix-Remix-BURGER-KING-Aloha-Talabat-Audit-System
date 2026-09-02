import { ParsedOrder, AlohaSummary } from '../types';

export function cleanText(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\u200b-\u200f\u202a-\u202e\uFEFF]/g, '') // remove invisible unicode & RTL marks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Standardize numeric amounts from Egyptian/Arabic text
 * Handles "519.52", "519,52" (European/Arabic decimal), "1,250.00" (thousands separator)
 */
export function parseFinancialAmount(valStr: string): number {
  if (!valStr) return 0;
  let clean = valStr.trim();
  // If comma is used as thousands separator: 1,234.56 -> 1234.56
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
    clean = clean.replace(/,/g, '');
  } else if (/^\d+,\d{2}$/.test(clean)) {
    // If comma is decimal separator: 519,52 -> 519.52
    clean = clean.replace(',', '.');
  } else {
    clean = clean.replace(/,/g, '');
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Number(num.toFixed(2));
}

export function extractDateTime(block: string): {
  date?: string;
  time?: string;
  dateTime?: string;
  host?: string;
  hostId?: string;
  terminal?: string;
} {
  let date: string | undefined;
  let time: string | undefined;
  let host: string | undefined;
  let hostId: string | undefined;
  let terminal: string | undefined;

  const lines = block.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Check for Aloha Host line: e.g. "Host: ahmed,11267             02/07/2026" or "Host: Mohamed,5638   02/06/2026"
    // Discard any line that contains item/discount words like Meal, Discount, Total, 0.00, L.E, EGP
    if (
      !host &&
      /^(?:Host|Cashier|كاشير|المضيف|الكاشير)\s*[:=\-]/i.test(trimmed) &&
      !/\b(?:Meal|Discount|Tax|Total|Subtotal|L\.E|EGP|ج\.م|0\.00|\d+\.\d{2})\b/i.test(trimmed)
    ) {
      // Extract trailing date if on the same line: "Host: ahmed,11267             02/07/2026"
      const dateMatch = trimmed.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*$/);
      let hostPart = trimmed;
      if (dateMatch) {
        if (!date) date = dateMatch[1].trim();
        hostPart = trimmed.substring(0, trimmed.lastIndexOf(dateMatch[0])).trim();
      }

      const cleanHost = hostPart
        .replace(/^(?:Host|Cashier|كاشير|المضيف|الكاشير)\s*[:=\-]?\s*/i, '')
        .trim();

      if (cleanHost && !/^\d+\.\d+$/.test(cleanHost)) {
        host = `Host: ${cleanHost}`;
        const idMatch = cleanHost.match(/[,#\s]+(\d{2,8})$/);
        if (idMatch) {
          hostId = idMatch[1];
        }
      }
    }

    // 2. Check for Terminal & Time line: e.g. "HD94                             3:06 AM" or "HD96                             11:16 AM"
    if (!terminal || !time) {
      const termTimeMatch = trimmed.match(/^([A-Z0-9_-]{2,8})\s+([\d]{1,2}:[\d]{2}(?::[\d]{2})?(?:\s*[APap][Mm]|\s*م|\s*ص)?)\s*$/i);
      if (termTimeMatch) {
        if (!terminal) terminal = termTimeMatch[1].trim();
        if (!time) time = termTimeMatch[2].trim();
      }
    }

    // 3. Check for standalone Date line if not found
    if (!date) {
      const standaloneDateMatch = trimmed.match(/^(?:Date\s*[:=\-]?\s*)?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*$/i);
      if (standaloneDateMatch) {
        date = standaloneDateMatch[1].trim();
      }
    }

    // 4. Check for standalone Time line if not found
    if (!time) {
      const standaloneTimeMatch = trimmed.match(/^(?:Time\s*[:=\-]?\s*)?([\d]{1,2}:[\d]{2}(?::[\d]{2})?(?:\s*[APap][Mm]|\s*م|\s*ص)?)\s*$/i);
      if (standaloneTimeMatch) {
        time = standaloneTimeMatch[1].trim();
      }
    }
  }

  // Fallback regex over whole block if still missing
  if (!date || !time) {
    const combinedMatch =
      block.match(/(?:Date(?:\s*[\/\&]\s*Time)?|التاريخ(?:\s*والوقت)?)\s*[:=\-]?\s*(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+([\d]{1,2}:[\d]{2}(?::[\d]{2})?(?:\s*[APap][Mm]|\s*م|\s*ص)?)/i) ||
      block.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+([\d]{1,2}:[\d]{2}(?::[\d]{2})?(?:\s*[APap][Mm]|\s*م|\s*ص)?)/i);

    if (combinedMatch) {
      if (!date) date = combinedMatch[1].trim();
      if (!time) time = combinedMatch[2].trim();
    }
  }

  if (!date) {
    const dateMatch =
      block.match(/(?:Date|التاريخ|تاريخ)\s*[:=\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i) ||
      block.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
    if (dateMatch) {
      date = dateMatch[1].trim();
    }
  }

  if (!time) {
    const timeMatch =
      block.match(/(?:Time|الوقت|وقت)\s*[:=\-]?\s*([\d]{1,2}:[\d]{2}(?::[\d]{2})?(?:\s*[APap][Mm]|\s*م|\s*ص)?)/i) ||
      block.match(/\b([\d]{1,2}:[\d]{2}(?::[\d]{2})?\s*[APap][Mm])\b/i) ||
      block.match(/\b([\d]{1,2}:[\d]{2}(?::[\d]{2})?\s*(?:م|ص))\b/i);
    if (timeMatch) {
      time = timeMatch[1].trim();
    }
  }

  let dateTime: string | undefined;
  if (date && time) {
    dateTime = `${date} ${time}`;
  } else if (date) {
    dateTime = date;
  } else if (time) {
    dateTime = time;
  }

  return { date, time, dateTime, host, hostId, terminal };
}

/**
 * Converts date and time strings into a comparable UNIX timestamp (ms).
 * Handles 12-hour AM/PM formats, 24-hour formats, Arabic markers (ص/م), and varied date formats (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY).
 */
export function parseDateTimeToTimestamp(
  dateStr?: string,
  timeStr?: string,
  dateTimeStr?: string
): number {
  if (dateTimeStr && (dateTimeStr.includes('T') || dateTimeStr.includes('Z'))) {
    const parsed = Date.parse(dateTimeStr);
    if (!isNaN(parsed)) return parsed;
  }

  // 1. Time extraction
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let hasValidTime = false;

  const rawTime = timeStr || (dateTimeStr ? dateTimeStr.split(/\s+/)[1] : '');
  if (rawTime) {
    const cleanTime = rawTime.trim();
    const isPM = /pm|م/i.test(cleanTime);
    const isAM = /am|ص/i.test(cleanTime);
    const digitsOnly = cleanTime.replace(/[^\d:]/g, '');
    const parts = digitsOnly.split(':');

    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const s = parts[2] ? parseInt(parts[2], 10) : 0;

      if (!isNaN(h) && !isNaN(m)) {
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        hours = h;
        minutes = m;
        seconds = isNaN(s) ? 0 : s;
        hasValidTime = true;
      }
    }
  }

  // 2. Date extraction
  let year = 2026;
  let month = 0; // 0-indexed
  let day = 1;
  let hasValidDate = false;

  const rawDate = dateStr || (dateTimeStr ? dateTimeStr.split(/\s+/)[0] : '');
  if (rawDate) {
    const cleanDate = rawDate.trim().replace(/[^\d\/\-\.]/g, '');
    const parts = cleanDate.split(/[\/\-\.]/);

    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
        day = parseInt(parts[2], 10);
        hasValidDate = true;
      } else if (parts[2].length === 4 || parts[2].length === 2) {
        let y = parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        year = y;

        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        if (p1 > 12) {
          day = p1;
          month = Math.max(0, Math.min(11, p2 - 1));
        } else {
          month = Math.max(0, Math.min(11, p1 - 1));
          day = p2;
        }
        hasValidDate = true;
      }
    }
  }

  if (hasValidDate || hasValidTime) {
    return new Date(year, month, day, hours, minutes, seconds).getTime();
  }

  return 0;
}

/**
 * Robustly split Aloha POS text into individual check receipts.
 * Accurately detects receipt boundaries across all Aloha formats (Branch headers, Host lines, Terminal timestamps, dividers, signatures).
 */
export function splitAlohaReceipts(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const receipts: string[] = [];
  let currentLines: string[] = [];
  let hasHeaderOrCheckInCurrent = false;
  let hasTenderOrEndInCurrent = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Explicit divider lines: e.g. "--------------------------------", "================================"
    const isDivider = /^[-=_*]{4,}$/.test(trimmed);

    // 2. Strong receipt start markers
    const isWelcomeOrStore = /^(?:(?:Welcome\s+To\s+)?BURGER\s+KING|BK\.[A-Za-z0-9_-]+|Store\s*#\s*\d+)/i.test(trimmed);
    const isHostLine = /^Host\s*[:=\-]\s*[a-zA-Z\u0600-\u06FF0-9]/i.test(trimmed);
    const isTermTimeLine = /^[A-Z0-9_-]{2,8}\s+[\d]{1,2}:[\d]{2}(?::[\d]{2})?(?:\s*[APap][Mm]|\s*م|\s*ص)?/i.test(trimmed);
    const isAlohaCheckHeader = /^(?:ال\s*(?:ا)?لوه?[اة]|Aloha|REPRINT#|Check\s*[:#])\s*\d+/i.test(trimmed);
    const isStandaloneCheckNum = /^\d{4,8}$/.test(trimmed) && (
      i > 0 && /^[A-Z0-9_-]{2,8}\s+[\d]{1,2}:[\d]{2}/i.test(lines[i - 1].trim())
    );

    // 3. Receipt footer / end markers
    const isSignatureLine = /^(?:SIGNATURE|التوقيع)\s*[:=\-]?/i.test(trimmed);
    const isClosedLine = /^(?:Closed|مغلق)\s*[:=\-]?/i.test(trimmed);

    // Determine if this line starts a new receipt
    const isNewReceiptStart =
      (isWelcomeOrStore && currentLines.length > 0) ||
      (isHostLine && hasHeaderOrCheckInCurrent) ||
      (isTermTimeLine && (hasTenderOrEndInCurrent || hasHeaderOrCheckInCurrent)) ||
      (isAlohaCheckHeader && hasHeaderOrCheckInCurrent) ||
      (isStandaloneCheckNum && hasTenderOrEndInCurrent);

    if (isDivider) {
      if (currentLines.length > 0) {
        receipts.push(currentLines.join('\n'));
        currentLines = [];
        hasHeaderOrCheckInCurrent = false;
        hasTenderOrEndInCurrent = false;
      }
      continue;
    }

    if (isNewReceiptStart && currentLines.length > 0) {
      receipts.push(currentLines.join('\n'));
      currentLines = [];
      hasHeaderOrCheckInCurrent = false;
      hasTenderOrEndInCurrent = false;
    }

    if (trimmed) {
      currentLines.push(line);

      if (isWelcomeOrStore || isHostLine || isTermTimeLine || isAlohaCheckHeader || /^\d{4,8}$/.test(trimmed)) {
        hasHeaderOrCheckInCurrent = true;
      }

      if (
        isSignatureLine ||
        isClosedLine ||
        /(?:Cash|Otlob\s*Mode|Talabat(?:\s*Mode)?|Credit\s*Card|Visa|Mastercard|Talab-Disc)\s*(?:L\.E|LE|EGP)?\s*[:]?\s*[\d,.]+/i.test(trimmed) ||
        /Auth\s*[:=\-]?\s*\d{6,14}/i.test(trimmed)
      ) {
        hasTenderOrEndInCurrent = true;
      }
    } else if (currentLines.length > 0) {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    receipts.push(currentLines.join('\n'));
  }

  return receipts.map(r => r.trim()).filter(r => r.length > 0);
}

export function parseAlohaText(rawInput: string, sourceFileName?: string): {
  orders: ParsedOrder[];
  summary: AlohaSummary;
  error?: string;
  duplicateNumbers: string[];
} {
  const text = cleanText(rawInput);
  if (!text) {
    return {
      orders: [],
      summary: {
        cashTotal: 0,
        creditTotal: 0,
        cardTotal: 0,
        otherTotal: 0,
        grandTotal: 0,
        cashCount: 0,
        creditCount: 0,
        cardCount: 0,
        otherCount: 0,
        deliveryCount: 0,
        dineInCount: 0,
        takeawayCount: 0,
        totalOrdersCount: 0,
        uniqueOrdersCount: 0,
        duplicateCount: 0,
        averageOrderValue: 0,
      },
      duplicateNumbers: [],
    };
  }

  const blocks = splitAlohaReceipts(text);

  const rawExtracted: ParsedOrder[] = [];
  const orderNumberCounts = new Map<string, number>();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    // 1. Extract Order Number
    const orderMatch =
      block.match(/(?:ال\s*(?:ا)?لوه?[اة]|Aloha)\s*(?:#|\:)?\s*(\d{3,8})/i) ||
      block.match(/REPRINT#\s*\d+\s+(\d{3,8})/i) ||
      block.match(/Check\s*(?:#|\:)?\s*(\d{3,8})/i) ||
      block.match(/Order\s*(?:#|\:)?\s*(\d{3,8})/i) ||
      block.match(/(?:[A-Z0-9_-]+\s+[\d]{1,2}:[\d]{2}(?:\s*[APap][Mm])?\s*[\r\n]+)\s*(\d{4,8})\s*(?:\r?\n|Order|Area|$)/i) ||
      block.match(/(?:^|\n)\s*(\d{4,8})\s*(?:\n|$|\s+(?:Cash|Otlob|L\.E|Delivery|Order|Area))/i);

    if (!orderMatch) continue;
    const orderNumber = orderMatch[1].trim();

    // 2. Extract Order Type
    // Handles explicitly: "Order Type: Free-Dele", "Order Type:  Free-Dele", "Order Type: HD Talabat", "Order Type: Delivery", "Order Type: Otlob.com", etc.
    const orderTypeMatch = block.match(/Order\s*Type\s*[:=\-]?\s*([^\r\n]+)/i);
    const rawOrderType = orderTypeMatch ? orderTypeMatch[1].trim() : '';
    let orderType = 'HD Talabat';
    const lowerBlock = block.toLowerCase();
    const lowerType = rawOrderType.toLowerCase();

    if (
      lowerType.includes('free-dele') ||
      lowerType.includes('free dele') ||
      lowerType.includes('freedele') ||
      lowerType.includes('free-deli') ||
      lowerType.includes('free deli') ||
      lowerType.includes('free-delivery') ||
      lowerType.includes('free delivery') ||
      lowerBlock.includes('free-dele') ||
      lowerBlock.includes('free dele')
    ) {
      orderType = 'Free-Dele';
    } else if (
      lowerType.includes('otlob') ||
      lowerBlock.includes('otlob.com') ||
      lowerBlock.includes('otlob mode')
    ) {
      orderType = 'Otlob.com';
    } else if (
      lowerType.includes('hd talabat') ||
      lowerType.includes('hd-talabat') ||
      lowerType.includes('talabat') ||
      lowerType.includes('طلبات') ||
      lowerBlock.includes('hd talabat')
    ) {
      orderType = 'HD Talabat';
    } else if (
      lowerType.includes('dine') ||
      lowerType.includes('صالة') ||
      lowerBlock.includes('dine-in') ||
      lowerBlock.includes('dine in')
    ) {
      orderType = 'Dine In';
    } else if (
      lowerType.includes('take') ||
      lowerType.includes('سفري') ||
      lowerType.includes('تيك') ||
      lowerBlock.includes('takeout') ||
      lowerBlock.includes('take away')
    ) {
      orderType = 'Takeout';
    } else if (
      lowerType.includes('drive') ||
      lowerBlock.includes('drive-thru') ||
      lowerBlock.includes('drive thru')
    ) {
      orderType = 'Drive-Thru';
    } else if (
      lowerType.includes('delivery') ||
      lowerType.includes('دليفري') ||
      lowerType.includes('توصيل') ||
      lowerBlock.includes('delivery') ||
      lowerBlock.includes('hd96') ||
      lowerBlock.includes('hd')
    ) {
      orderType = 'HD Talabat';
    } else if (rawOrderType) {
      orderType = rawOrderType;
    } else {
      orderType = 'HD Talabat';
    }

    // 3. Extract Payment Tender Lines & Discounts
    // Cash tender line (e.g., "Cash L.E 175.00", "Cash: 175.00", "كاش 175.00")
    const cashMatches = Array.from(
      block.matchAll(/(?:Cash|كاش|نقدي|نقدى)\s*(?:L\.E|LE|L\.E\.|EGP|ج\.م|جنيه)?\s*[:]?\s*([\d,.]+)/gi)
    );
    // Otlob Mode / Talabat tender line (e.g., "Otlob Mode L.E 372.00", "Otlob Mode 372.00", "Otlob-Mode: 372")
    const otlobMatches = Array.from(
      block.matchAll(/(?:Otlob[\s\-_]*Mode|Talabat(?:\s*Mode|\s*Pay)?|أطلب(?:\s*مود)?|طلبات)\s*(?:L\.E|LE|L\.E\.|EGP|ج\.م|جنيه)?\s*[:]?\s*([\d,.]+)/gi)
    );
    // Credit Card / Visa / Master tender line (e.g., "Credit Card L.E 372.00", "Visa L.E 372.00")
    const cardMatches = Array.from(
      block.matchAll(/(?:Credit[\s\-_]*Card|Visa|Mastercard|Span|بطاقة|فيزا|ماستر)\s*(?:L\.E|LE|L\.E\.|EGP|ج\.م|جنيه)?\s*[:]?\s*([\d,.]+)/gi)
    );
    // Talabat Discount (Talab-Disc)
    const discMatch = block.match(/(?:Talab-Disc|Discount|خصم)\s*(?:L\.E|LE|L\.E\.|EGP|ج\.م|جنيه)?\s*[:]?\s*([\d,.]+)/i);
    const discountAmount = discMatch ? parseFinancialAmount(discMatch[1]) : 0;

    // Auth / Reference ID: "Auth:3732052899", "Auth: 32061862", "3731746662", "Talabat 3731746662"
    const authMatch =
      block.match(/(?:Auth|Ref|Reference|Talabat|Otlob|Order\s*ID|ID|Code|رقم|كود|مرجع)\s*[:=\-#]?\s*(\d{6,14})/i) ||
      block.match(/\b(37\d{8})\b/) || // Egyptian Talabat 10-digit format starting with 37
      block.match(/\b(\d{8,14})\b/);  // Any standalone 8-14 digit number (Talabat order ID)
    const authNumber = authMatch ? authMatch[1].trim() : undefined;

    // Change / Returned Cash Line: e.g. "Change L.E 65.00" or "الباقي 65.00"
    const changeMatch = block.match(/(?:Change|الباقي|باقي)\s*(?:L\.E|LE|L\.E\.|EGP|ج\.م|جنيه)?\s*[:]?\s*([\d,.]+)/i);
    const changeAmount = changeMatch ? parseFinancialAmount(changeMatch[1]) : 0;

    // Total Line in Receipt: e.g. "Otlob.com Total 420.00", "Total 552.52", "المجموع 235.00"
    const totalMatch =
      block.match(/(?:(?:Otlob(?:\.com)?|Talabat)\s+)?(?:Total|المجموع|الإجمالي|اجمالي|صافي)\s*(?:L\.E|LE|L\.E\.|EGP|ج\.م|جنيه)?\s*[:]?\s*([\d,.]+)/i);
    const printedTotal = totalMatch ? parseFinancialAmount(totalMatch[1]) : 0;

    let cashAmount = 0;
    for (const m of cashMatches) {
      cashAmount += parseFinancialAmount(m[1]);
    }

    let otlobAmount = 0;
    for (const m of otlobMatches) {
      otlobAmount += parseFinancialAmount(m[1]);
    }

    let cardAmount = 0;
    for (const m of cardMatches) {
      cardAmount += parseFinancialAmount(m[1]);
    }

    // If change was given, net cash is cash minus change
    if (changeAmount > 0 && cashAmount >= changeAmount) {
      cashAmount = Number((cashAmount - changeAmount).toFixed(2));
    }

    let payment: ParsedOrder['payment'] = 'Unspecified';
    let totalAmount = 0;

    // Direct tender prioritization: Otlob Mode (e.g. "Otlob Mode L.E 372.00") and Credit Card take exact tender amount
    if (otlobAmount > 0 && cashAmount === 0 && cardAmount === 0) {
      payment = 'Otlob Mode';
      totalAmount = otlobAmount; // Explicitly take the Otlob Mode tender amount
    } else if (cardAmount > 0 && cashAmount === 0 && otlobAmount === 0) {
      payment = 'Credit Card';
      totalAmount = cardAmount; // Explicitly take the Credit Card tender amount
    } else if (cashAmount > 0 && otlobAmount === 0 && cardAmount === 0) {
      payment = 'Cash';
      totalAmount = cashAmount > 0 ? cashAmount : printedTotal;
      cashAmount = totalAmount;
    } else if (otlobAmount > 0 || cardAmount > 0 || cashAmount > 0) {
      if (otlobAmount >= cardAmount && otlobAmount >= cashAmount) {
        payment = 'Otlob Mode';
        totalAmount = otlobAmount;
      } else if (cardAmount >= cashAmount) {
        payment = 'Credit Card';
        totalAmount = cardAmount;
      } else {
        payment = 'Cash';
        totalAmount = cashAmount;
      }
    } else if (printedTotal > 0) {
      if (authNumber || discountAmount > 0 || orderType.toLowerCase().includes('otlob') || orderType.toLowerCase().includes('talabat')) {
        payment = 'Otlob Mode';
        totalAmount = printedTotal;
      } else {
        payment = 'Unspecified';
        totalAmount = printedTotal;
      }
    } else {
      // 4. Subtotal & Delivery/Talabat Charge Lines (e.g. Item Count 3 486.84 + HD Talabat Charge 43.86)
      const itemCountMatch = block.match(/(?:Item\s*Count\s*(\d+)\s+([\d,.]+)|Subtotal\s*[:]?\s*([\d,.]+))/i);
      const subtotalAmount = itemCountMatch ? parseFinancialAmount(itemCountMatch[2] || itemCountMatch[3]) : 0;
      const chargeMatch = block.match(/(?:HD\s*Talabat\s*Charge|Talabat\s*Charge|Delivery\s*Charge|Charge|خدمة|توصيل)\s*[:]?\s*([\d,.]+)/i);
      const chargeAmount = chargeMatch ? parseFinancialAmount(chargeMatch[1]) : 0;

      if (subtotalAmount > 0) {
        totalAmount = subtotalAmount + chargeAmount - discountAmount;
        if (payment === 'Unspecified') {
          payment = orderType.toLowerCase().includes('talabat') || orderType.toLowerCase().includes('otlob') ? 'Otlob Mode' : 'Cash';
        }
      } else {
        // Fallback: sum all individual line items
        const itemLines = block.split(/\r?\n/);
        let itemsSum = 0;
        for (const line of itemLines) {
          const t = line.trim();
          if (/^(?:HD\d+|Date|Time|Host|Check|Order|Item Count|Area|BK\.|Welcome|Total|Closed|SIGNATURE)/i.test(t)) continue;
          const match = t.match(/^([A-Za-z0-9\s._\-&]{3,35})\s+([\d]+\.\d{2})$/);
          if (match && !/^\d{4,8}$/.test(match[1].trim())) {
            itemsSum += parseFinancialAmount(match[2]);
          }
        }
        if (itemsSum > 0) {
          totalAmount = itemsSum + chargeAmount - discountAmount;
          if (payment === 'Unspecified') {
            payment = orderType.toLowerCase().includes('talabat') || orderType.toLowerCase().includes('otlob') ? 'Otlob Mode' : 'Cash';
          }
        }
      }
    }

    totalAmount = Number(totalAmount.toFixed(2));
    cashAmount = Number(cashAmount.toFixed(2));
    otlobAmount = Number(otlobAmount.toFixed(2));

    const isVoid = isAlohaVoidOrder(block);
    const isEmpMeal = isAlohaEmployeeMeal(block, orderType);

    // If completely voided or employee meal, skip adding to customer delivery reconciliation
    if (isVoid || isEmpMeal) {
      continue;
    }

    const isDeliveryOrder =
      orderType === 'HD Talabat' ||
      orderType === 'Free-Dele' ||
      orderType === 'Otlob.com' ||
      orderType === 'Delivery' ||
      orderType.toLowerCase().includes('dele') ||
      orderType.toLowerCase().includes('deli') ||
      orderType.toLowerCase().includes('توصيل') ||
      orderType.toLowerCase().includes('دليفري') ||
      orderType.toLowerCase().includes('talabat') ||
      orderType.toLowerCase().includes('otlob') ||
      lowerBlock.includes('delivery') ||
      lowerBlock.includes('free-dele') ||
      lowerBlock.includes('free dele') ||
      lowerBlock.includes('hd talabat') ||
      lowerBlock.includes('hd96') ||
      lowerBlock.includes('hd');

    if (Number.isFinite(totalAmount) && totalAmount > 0) {
      // Extract Date, Time, Host and Terminal
      const { date, time, dateTime, host, hostId, terminal } = extractDateTime(block);

      // Extract Store Name if present
      const storeMatch = block.match(/(?:Welcome\s+To\s+)?(BURGER\s+KING[^\r\n]*|BK\.[A-Za-z0-9_-]+|Store\s*#[^\r\n]+)/i);
      const storeName = storeMatch ? storeMatch[0].trim() : undefined;

      // Track duplicates
      const currentCount = (orderNumberCounts.get(orderNumber) || 0) + 1;
      orderNumberCounts.set(orderNumber, currentCount);

      const filePrefix = sourceFileName ? `${sourceFileName.replace(/[^a-zA-Z0-9_-]/g, '_')}-` : '';

      rawExtracted.push({
        id: `aloha-${filePrefix}${orderNumber}-${rawExtracted.length + 1}`,
        number: orderNumber,
        orderType,
        payment,
        amount: totalAmount,
        cashAmount: cashAmount > 0 ? cashAmount : payment === 'Cash' ? totalAmount : 0,
        creditAmount: otlobAmount > 0 ? otlobAmount : payment === 'Otlob Mode' || payment === 'Credit Card' ? totalAmount : 0,
        discount: discountAmount > 0 ? discountAmount : undefined,
        authNumber,
        date,
        time,
        dateTime,
        host,
        hostId,
        terminal,
        storeName,
        rawText: block.trim(),
        lineIndex: i + 1,
        isDelivery: isDeliveryOrder,
        sourceFileName,
        dayLabel: sourceFileName,
      });
    }
  }

  // Mark duplicate orders & calculate summaries
  const duplicateNumbers: string[] = [];
  for (const [num, count] of orderNumberCounts.entries()) {
    if (count > 1) {
      duplicateNumbers.push(num);
    }
  }

  const finalOrders: ParsedOrder[] = rawExtracted.map(order => {
    const dupCount = orderNumberCounts.get(order.number) || 1;
    return {
      ...order,
      isDuplicate: dupCount > 1,
      duplicateCount: dupCount,
    };
  });

  const summary = calculateAlohaSummaryFromOrders(finalOrders);

  return {
    orders: finalOrders,
    summary,
    duplicateNumbers: finalOrders.filter(o => o.isDuplicate).map(o => o.number),
    error:
      finalOrders.length === 0 && text.length > 0
        ? 'No valid check numbers or monetary amounts found in the input text. Please ensure the Aloha report includes check numbers and tender totals (e.g. Aloha 30005 and Cash L.E 519.52).'
        : undefined,
  };
}

export function calculateAlohaSummaryFromOrders(orders: ParsedOrder[]): AlohaSummary {
  let cashTotal = 0;
  let creditTotal = 0;
  let cardTotal = 0;
  let otherTotal = 0;
  let cashCount = 0;
  let creditCount = 0;
  let cardCount = 0;
  let otherCount = 0;
  let deliveryCount = 0;
  let dineInCount = 0;
  let takeawayCount = 0;

  const numberCounts = new Map<string, number>();
  const duplicateNumbers: string[] = [];

  for (const order of orders) {
    numberCounts.set(order.number, (numberCounts.get(order.number) || 0) + 1);

    if (order.payment === 'Cash') {
      cashTotal += order.amount;
      cashCount++;
    } else if (order.payment === 'Otlob Mode') {
      creditTotal += order.amount;
      creditCount++;
    } else if (order.payment === 'Credit Card') {
      cardTotal += order.amount;
      cardCount++;
    } else {
      otherTotal += order.amount;
      otherCount++;
    }

    const oType = (order.orderType || '').toLowerCase();
    if (order.isDelivery || oType.includes('delivery') || oType.includes('dele') || oType.includes('دليفري') || oType.includes('توصيل') || oType.includes('otlob') || oType.includes('talabat')) {
      deliveryCount++;
    } else if (oType.includes('dine') || oType.includes('صالة')) {
      dineInCount++;
    } else if (oType.includes('take') || oType.includes('سفري') || oType.includes('تيك')) {
      takeawayCount++;
    }
  }

  for (const [num, count] of numberCounts.entries()) {
    if (count > 1) {
      duplicateNumbers.push(num);
    }
  }

  const grandTotal = Number((cashTotal + creditTotal + cardTotal + otherTotal).toFixed(2));
  const avgValue = orders.length > 0 ? Number((grandTotal / orders.length).toFixed(2)) : 0;

  return {
    cashTotal: Number(cashTotal.toFixed(2)),
    creditTotal: Number(creditTotal.toFixed(2)),
    cardTotal: Number(cardTotal.toFixed(2)),
    otherTotal: Number(otherTotal.toFixed(2)),
    grandTotal,
    cashCount,
    creditCount,
    cardCount,
    otherCount,
    deliveryCount,
    dineInCount,
    takeawayCount,
    totalOrdersCount: orders.length,
    uniqueOrdersCount: numberCounts.size,
    duplicateCount: duplicateNumbers.length,
    averageOrderValue: avgValue,
  };
}

export interface ParsedReceiptBreakdown {
  checkNumber: string;
  orderType: string;
  terminal?: string;
  time?: string;
  date?: string;
  host?: string;
  hostId?: string;
  authNumber?: string;
  items: Array<{ name: string; price: number; quantity?: number; isVoid?: boolean }>;
  itemCount: number;
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  printedTotal: number;
  tenderMethod: 'Cash' | 'Otlob Mode' | 'Credit Card' | 'Unspecified';
  calculatedTotal: number;
  rawText: string;
  isDelivery: boolean;
  isVoidOrder: boolean;
  isEmployeeMeal: boolean;
  voidReason?: string;
}

export function parseSingleAlohaReceiptBlock(rawText: string): ParsedReceiptBreakdown | null {
  const clean = cleanText(rawText);
  if (!clean) return null;

  const res = parseAlohaText(clean);
  const parsedOrder = res.orders[0];

  const isVoid = isAlohaVoidOrder(clean);
  const isEmpMeal = isAlohaEmployeeMeal(clean, parsedOrder?.orderType);

  // Extract items
  const lines = clean.split(/\r?\n/);
  const items: Array<{ name: string; price: number; quantity?: number; isVoid?: boolean }> = [];
  let foundSubtotal = 0;
  let foundDeliveryCharge = 0;
  let foundDiscount = 0;
  let foundItemCount = 0;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    // Check item count / subtotal line
    const itemCountMatch = t.match(/Item\s*Count\s*(\d+)\s+([\d,.]+)/i);
    if (itemCountMatch) {
      foundItemCount = parseInt(itemCountMatch[1], 10);
      foundSubtotal = parseFinancialAmount(itemCountMatch[2]);
      continue;
    }

    const subtotalMatch = t.match(/^Subtotal\s*[:]?\s*([\d,.]+)/i);
    if (subtotalMatch) {
      foundSubtotal = parseFinancialAmount(subtotalMatch[1]);
      continue;
    }

    // Check delivery / talabat charge
    const chargeMatch = t.match(/(?:HD\s*Talabat\s*Charge|Talabat\s*Charge|Delivery\s*Charge|Charge|خدمة|توصيل)\s*[:]?\s*([\d,.]+)/i);
    if (chargeMatch) {
      foundDeliveryCharge = parseFinancialAmount(chargeMatch[1]);
      continue;
    }

    // Check discount
    const discMatch = t.match(/(?:Talab-Disc|Discount|خصم)\s*(?:L\.E|LE|EGP)?\s*[:]?\s*([\d,.]+)/i);
    if (discMatch) {
      foundDiscount = parseFinancialAmount(discMatch[1]);
      continue;
    }

    // Skip known header/footer words
    if (/^(?:HD\d+|Date|Time|Host|Check|Order|Area|BK\.|Welcome|Total|Closed|SIGNATURE|Cash|Otlob|Credit|Visa|Mastercard|Change)/i.test(t)) {
      continue;
    }

    // Item with void tag: e.g. "(Void)Whopper Sand -219.30" or "(Void) KIDS Fries -60.00"
    const voidItemMatch = t.match(/^\(Void\)\s*([A-Za-z0-9\s._\-&]{3,35})\s+([\-]?[\d]+\.\d{2})$/i);
    if (voidItemMatch) {
      items.push({
        name: `(Void) ${voidItemMatch[1].trim()}`,
        price: parseFinancialAmount(voidItemMatch[2]),
        isVoid: true,
      });
      continue;
    }

    // Single item line with price at end: e.g. "TwisterFriesKing 122.81" or "Tower Big King 127.19"
    const itemMatch = t.match(/^([A-Za-z0-9\s._\-&]{3,35})\s+([\-]?[\d]+\.\d{2})$/);
    if (itemMatch && !/^\d{4,8}$/.test(itemMatch[1].trim())) {
      items.push({
        name: itemMatch[1].trim(),
        price: parseFinancialAmount(itemMatch[2]),
        isVoid: false,
      });
    }
  }

  const { date, time, host, hostId, terminal } = extractDateTime(clean);

  // Determine check number
  const checkNumber =
    parsedOrder?.number ||
    (clean.match(/(?:ال\s*(?:ا)?لوه?[اة]|Aloha)\s*(?:#|\:)?\s*(\d{3,8})/i) ||
      clean.match(/REPRINT#\s*\d+\s+(\d{3,8})/i) ||
      clean.match(/Check\s*(?:#|\:)?\s*(\d{3,8})/i) ||
      clean.match(/(?:[A-Z0-9_-]+\s+[\d]{1,2}:[\d]{2}(?:\s*[APap][Mm])?\s*[\r\n]+)\s*(\d{4,8})/i) ||
      clean.match(/\b(\d{5})\b/))?.[1] ||
    '';

  const orderType = parsedOrder?.orderType || (clean.match(/Order\s*Type\s*[:=\-]?\s*([^\r\n]+)/i)?.[1]?.trim()) || 'HD Talabat';
  const tenderMethod = (parsedOrder?.payment as any) || (orderType.toLowerCase().includes('talabat') || orderType.toLowerCase().includes('otlob') ? 'Otlob Mode' : 'Cash');

  let calculatedTotal = isVoid ? 0 : parsedOrder?.amount || 0;
  if (!isVoid && calculatedTotal === 0) {
    if (foundSubtotal > 0) {
      calculatedTotal = Number((foundSubtotal + foundDeliveryCharge - foundDiscount).toFixed(2));
    } else if (items.length > 0) {
      const activeItems = items.filter(it => !it.isVoid);
      const sum = activeItems.reduce((acc, it) => acc + it.price, 0);
      calculatedTotal = Number((sum + foundDeliveryCharge - foundDiscount).toFixed(2));
      foundSubtotal = sum;
    }
  }

  if (isVoid) {
    calculatedTotal = 0;
    foundSubtotal = 0;
    foundDeliveryCharge = 0;
  } else if (foundSubtotal === 0 && items.length > 0) {
    foundSubtotal = items.filter(it => !it.isVoid).reduce((acc, it) => acc + it.price, 0);
  }

  return {
    checkNumber,
    orderType,
    terminal: terminal || parsedOrder?.terminal,
    time: time || parsedOrder?.time,
    date: date || parsedOrder?.date,
    host: host || parsedOrder?.host,
    hostId: hostId || parsedOrder?.hostId,
    authNumber: parsedOrder?.authNumber,
    items,
    itemCount: isVoid ? 0 : (foundItemCount || items.length),
    subtotal: foundSubtotal,
    deliveryCharge: foundDeliveryCharge,
    discount: foundDiscount,
    printedTotal: calculatedTotal,
    tenderMethod,
    calculatedTotal,
    rawText: clean,
    isDelivery: isTalabatReconciliationOrder({ orderType, rawText: clean }),
    isVoidOrder: isVoid,
    isEmployeeMeal: isEmpMeal,
    voidReason: isVoid ? 'فويد / شيك ملغي بالكامل (Void Check / Item Count 0)' : isEmpMeal ? 'وجبة موظف (Employee Meal)' : undefined,
  };
}

/**
 * Detects if an Aloha receipt is completely voided:
 * e.g. "Item Count 0", multiple "(Void)... -219.30", Total 0.00, or Void markers.
 */
export function isAlohaVoidOrder(block: string): boolean {
  if (!block) return false;
  const lower = block.toLowerCase();

  // 1. Explicit Item Count 0
  if (/Item\s*Count\s*0\s+0(?:\.00)?/i.test(block) || /Item\s*Count\s*0\b/i.test(block)) {
    return true;
  }

  // 2. Void markers
  const voidCount = (block.match(/\(Void\)/gi) || []).length;
  if (voidCount >= 1 && (/(?:Total|المجموع|الإجمالي)\s*[:]?\s*0(?:\.00)?/i.test(block) || /Total\s+0\.00/i.test(block))) {
    return true;
  }

  if (lower.includes('(void)') && (lower.includes('item count 0') || lower.includes('total 0.00') || lower.includes('total: 0.00') || lower.includes('total 0'))) {
    return true;
  }

  if (lower.includes('فويد') || lower.includes('void check') || lower.includes('voided')) {
    return true;
  }

  return false;
}

/**
 * Detects if an Aloha order / receipt is an Employee Meal / Staff Meal:
 * e.g. "Employee Meal", "Embloye Meal", "وجبة موظف", "وجبات موظفين", "Manager Meal", "Staff Meal", "Emp Meal"
 */
export function isAlohaEmployeeMeal(block: string, orderType?: string): boolean {
  if (!block && !orderType) return false;
  const target = `${orderType || ''} ${block || ''}`.toLowerCase();
  return (
    target.includes('employee meal') ||
    target.includes('embloye meal') ||
    target.includes('employe meal') ||
    target.includes('emp meal') ||
    target.includes('emp. meal') ||
    target.includes('staff meal') ||
    target.includes('manager meal') ||
    target.includes('وجبة موظف') ||
    target.includes('وجبة موظفين') ||
    target.includes('وجبات موظفين') ||
    target.includes('وجبات موظف') ||
    target.includes('طعام موظفين') ||
    target.includes('وجبة كرو') ||
    target.includes('crew meal')
  );
}

/**
 * Checks if an order belongs to the Talabat/Delivery scope:
 * Order Type: Otlob.com, Free-Dele, HD Talabat (Delivery).
 * Automatically excludes Void Orders and Employee Meals.
 */
export function isTalabatReconciliationOrder(order: { orderType?: string; isDelivery?: boolean; rawText?: string }): boolean {
  const type = (order.orderType || '').toLowerCase().trim();
  const text = (order.rawText || '').toLowerCase();

  // Exclude Employee Meal & Void orders from delivery customer matching
  if (
    type.includes('employee') ||
    type.includes('embloye') ||
    type.includes('employe') ||
    type.includes('staff') ||
    type.includes('meal') ||
    type.includes('موظف') ||
    text.includes('employee meal') ||
    text.includes('embloye meal') ||
    text.includes('وجبة موظف') ||
    text.includes('item count 0')
  ) {
    return false;
  }

  if (order.isDelivery) return true;
  return (
    type === 'otlob.com' ||
    type.includes('otlob') ||
    type === 'free-dele' ||
    type.includes('free-dele') ||
    type.includes('free dele') ||
    type.includes('freedele') ||
    type.includes('free-delivery') ||
    type.includes('free delivery') ||
    type === 'hd talabat' ||
    type.includes('hd talabat') ||
    type.includes('talabat') ||
    type.includes('delivery') ||
    type.includes('دليفري') ||
    type.includes('توصيل') ||
    type.startsWith('hd')
  );
}


