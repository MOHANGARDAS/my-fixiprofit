import ExcelJS from 'exceljs';

// ============================================================
// Tally export parser (CSV / XLSX / XLS)
// Tally "Stock Summary" exports come in several shapes:
//   1. Simple: one header row -> Stock Item | Quantity | Rate | Value
//   2. No header: item rows directly, qty like "150.00 Pc"
//   3. Tally Excel stock summary (the common one):
//        company header rows...
//        Particulars | Particulars | <period>
//                                  | Closing Balance
//                                  | Quantity | Rate | Value
//        ITEM NAME  | ITEM NAME  | qty | rate | value   <- item row (name duplicated A:B)
//        batch      | godown/bin | qty | rate | value   <- sub row (A != B) -> skip
//        ·          | godown     | qty | rate | value   <- godown row -> skip
//        Grand Total| Grand Total| qty |      | value
// This parser is deliberately tolerant of all of that.
// ============================================================

export interface ParsedTallyItem {
  name: string;
  qty: number;
  unit?: string;
  rate?: number;
  hsn?: string;
  group?: string;
}

export interface ColumnMapping {
  name: number;
  qty: number;
  unit: number | null;
  rate: number | null;
  value: number | null;
  group: number | null;
  hsn: number | null;
}

export interface ParseResult {
  items: ParsedTallyItem[];
  warnings: string[];
  columnMapping: ColumnMapping | null;
  headerRow: number; // -1 = no header found, heuristic mode
  totalRows: number;
  /** rows skipped as batch/godown sub-rows (Tally stock summary mode) */
  skippedSubRows: number;
}

// ---------- low level helpers ----------

/** Parse a number from messy text: "1,234.56", "(5)" => -5, "150.00 Pc" => 150.56 */
export function parseNumber(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/,/g, '').replace(/\s/g, '');
  // Match leading numeric part e.g. "-150.00" from "-150.00 Pc"
  const m = s.match(/^-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** Split "150.00 Pc" into { qty: 150, unit: 'Pc' } */
function parseQtyWithUnit(raw: unknown): { qty: number | null; unit?: string } {
  if (raw == null) return { qty: null };
  const s = String(raw).trim();
  if (!s) return { qty: null };
  // qty followed by unit letters (e.g. "150.00 Pc", "12.5 kg", "30Box")
  const m = s.match(/^(-?[\d,.]+(?:\s*\(\s*-?[\d,.]+\s*\))?)\s*([A-Za-z.\u0900-\u097F]{1,12})$/);
  if (m) {
    const qty = parseNumber(m[1]);
    if (qty != null) return { qty, unit: m[2].replace(/\./g, '').trim() || undefined };
  }
  return { qty: parseNumber(s) };
}

// ---------- file reading ----------

/** Parse CSV text into rows (handles quoted fields with commas/newlines) */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const push = () => { row.push(field); field = ''; };
  const endRow = () => { push(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      push();
    } else if (c === '\n') {
      endRow();
    } else if (c === '\r') {
      // ignore
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) endRow();
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

async function readWorkbookRows(buf: ArrayBuffer): Promise<{ rows: string[][]; sheetName?: string }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [] };
  const rows: string[][] = [];
  ws.eachRow((row, rowNumber) => {
    const values: string[] = [];
    const n = Math.max(row.cellCount, 1);
    for (let c = 1; c <= n; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      if (v == null) { values.push(''); continue; }
      if (typeof v === 'object') {
        if ('richText' in v && Array.isArray((v as any).richText)) {
          values.push((v as any).richText.map((t: any) => t?.text ?? '').join(''));
        } else if ('result' in v) {
          values.push(String((v as any).result ?? ''));
        } else if ('text' in v) {
          values.push(String((v as any).text ?? ''));
        } else if (v instanceof Date) {
          values.push(v.toISOString());
        } else {
          values.push(String(v));
        }
      } else {
        values.push(String(v));
      }
    }
    if (values.some(v => v.trim() !== '')) rows[rowNumber - 1] = values;
  });
  return { rows: rows.filter(Boolean).map(r => r ?? []), sheetName: ws.name };
}

// ---------- header detection ----------

const HEADER_HINTS: Record<keyof Omit<ColumnMapping, 'name'> | 'name', string[]> = {
  name: ['stock item', 'item', 'particular', 'particulars', 'name', 'description', 'product', 'goods', 'material'],
  qty: ['qty', 'quantity', 'balance', 'closing', 'stock', 'physical', 'count', 'units'],
  unit: ['unit', 'uom', 'u.m.', 'measure'],
  rate: ['rate', 'price', 'cost', 'mrp'],
  value: ['value', 'amount', 'worth', 'total'],
  group: ['group', 'category', 'stock group', 'type'],
  hsn: ['hsn', 'hsn/sac', 'sac', 'code', 'part no', 'part-no', 'sku'],
};

/** True if the cell looks like a plain number (not header text) */
function isNumericCell(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  return parseNumber(s) != null && /^[\s\d,.\-()]+$/.test(s);
}

function scoreHeaderRow(row: string[]): { score: number; mapping: Partial<ColumnMapping> } {
  const mapping: Partial<ColumnMapping> = {};
  let score = 0;
  row.forEach((cellRaw, idx) => {
    const cell = String(cellRaw || '').toLowerCase().trim();
    if (!cell || cell.length > 40) return;
    for (const [field, hints] of Object.entries(HEADER_HINTS) as [keyof typeof HEADER_HINTS, string[]][]) {
      if (mapping[field as keyof ColumnMapping] != null) continue;
      if (hints.some(h => cell === h || cell.startsWith(h))) {
        (mapping as any)[field] = idx;
        score++;
        break;
      }
    }
  });
  return { score, mapping };
}

/**
 * Detect a header, including Tally's multi-row header:
 *   R12: Particulars | Particulars | <period>
 *   R13:            |             | Closing Balance
 *   R14:            |             | Quantity | Rate | Value
 * The name column comes from the first hint row; qty/rate/value may sit on
 * later rows within a small window. Only text cells are treated as headers.
 */
function detectHeader(rows: string[][]): { headerRow: number; mapping: Partial<ColumnMapping> } {
  const limit = Math.min(rows.length, 16);
  let nameRow = -1, nameIdx = -1;
  for (let r = 0; r < limit; r++) {
    const cells = rows[r];
    for (let c = 0; c < cells.length; c++) {
      const cell = String(cells[c] || '').toLowerCase().trim();
      if (!cell || cell.length > 40) continue;
      if (HEADER_HINTS.name.some(h => cell === h || cell.startsWith(h))) { nameRow = r; nameIdx = c; break; }
    }
    if (nameRow >= 0) break;
  }
  if (nameRow < 0) return { headerRow: -1, mapping: {} };

  const mapping: Partial<ColumnMapping> = { name: nameIdx };
  let lastHeaderRow = nameRow;
  const winEnd = Math.min(nameRow + 3, rows.length - 1);
  for (let r = nameRow; r <= winEnd; r++) {
    const row = rows[r];
    const rowMap: Partial<ColumnMapping> = {};
    row.forEach((cellRaw, idx) => {
      const cell = String(cellRaw || '').toLowerCase().trim();
      if (!cell || cell.length > 40) return;
      if (isNumericCell(cellRaw)) return; // numeric cell can never be a header
      for (const [field, hints] of Object.entries(HEADER_HINTS) as [keyof typeof HEADER_HINTS, string[]][]) {
        if (rowMap[field as keyof ColumnMapping] != null) continue;
        if (hints.some(h => cell === h || cell.startsWith(h))) {
          (rowMap as any)[field] = idx;
          break;
        }
      }
    });
    // Merge into the combined mapping (later rows refine qty/rate/value/unit)
    let contributed = false;
    for (const field of ['qty', 'rate', 'value', 'unit', 'group', 'hsn'] as const) {
      const idx = rowMap[field];
      if (idx != null) {
        (mapping as any)[field] = idx;
        contributed = true;
      }
    }
    if (contributed) lastHeaderRow = r;
  }

  // Need name + qty at minimum to trust this header
  if (mapping.qty != null) {
    return { headerRow: lastHeaderRow, mapping };
  }
  return { headerRow: -1, mapping: {} };
}

// ---------- heuristic mode (no usable header) ----------

function heuristicColumns(rows: string[][]): ColumnMapping {
  const sample = rows.slice(0, 40);
  const width = Math.max(...sample.map(r => r.length));
  // Column 0 is almost always the item name in Tally exports
  let nameCol = 0;
  // Find first column after name with quantity-like content (numbers, or "123 Pc")
  let qtyCol = -1, qtyUnitCol: number | null = null;
  for (let c = nameCol + 1; c < width; c++) {
    let numericLike = 0, filled = 0;
    for (const r of sample) {
      const v = r[c];
      if (v == null || String(v).trim() === '') continue;
      filled++;
      if (parseQtyWithUnit(v).qty != null) numericLike++;
    }
    if (filled > 0 && numericLike / filled >= 0.5 && numericLike >= 2) {
      qtyCol = c;
      break;
    }
  }
  if (qtyCol === -1) qtyCol = nameCol + 1;
  // Unit column: next col that is mostly short alphabetic text
  for (let c = qtyCol + 1; c < width; c++) {
    let unitLike = 0, filled = 0;
    for (const r of sample) {
      const v = String(r[c] ?? '').trim();
      if (!v) continue;
      filled++;
      if (/^[A-Za-z.\u0900-\u097F]{1,8}$/.test(v)) unitLike++;
    }
    if (filled > 0 && unitLike / filled >= 0.6) { qtyUnitCol = c; break; }
  }
  return { name: nameCol, qty: qtyCol, unit: qtyUnitCol, rate: null, value: null, group: null, hsn: null };
}

// ---------- row filtering ----------

const SKIP_ROW_RE = /^(grand\s+total|total|sub\s*total|subtotal|closing\s*balance|opening\s*balance|closing stock|opening stock|net(?!t)|gross|stock summary|stock item\b.*)/i;
const GROUP_HEADER_RE = /^[A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F .&\-()/]{2,}$/; // pure text row -> possible group name

function isLikelyTotalRow(nameCell: string): boolean {
  const n = String(nameCell || '').trim();
  if (SKIP_ROW_RE.test(n)) return true;
  // Tally group-total rows often look like "GroupName Total" / "Total GroupName"
  if (/total/i.test(n)) return true;
  return false;
}

// ---------- main ----------

export async function parseTallyFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 4));
  const isZip = head[0] === 0x50 && head[1] === 0x4B; // PK -> xlsx container
  const lower = file.name.toLowerCase();
  let rows: string[][];
  let sheetName: string | undefined;

  if (isZip || lower.endsWith('.xlsx')) {
    const res = await readWorkbookRows(buf);
    rows = res.rows;
    sheetName = res.sheetName;
  } else if (lower.endsWith('.csv') || lower.endsWith('.txt') || !isZip) {
    const text = new TextDecoder('utf-8').decode(buf);
    if (/\u0000/.test(text.slice(0, 4000))) {
      throw new Error('Ye purani binary Excel (.xls) file hai. Isse Excel me .xlsx format me save karke dobara try karein.');
    }
    rows = parseCsvText(text);
  } else {
    throw new Error('Unsupported file. Tally CSV ya Excel (.xlsx) file use karein.');
  }

  if (rows.length === 0) throw new Error('File khali hai ya padhi nahi ja saki.');

  const warnings: string[] = [];
  const { headerRow, mapping: headerMapping } = detectHeader(rows);
  let mapping: ColumnMapping;
  let startRow = 0;

  if (headerRow >= 0) {
    mapping = {
      name: headerMapping.name ?? 0,
      qty: headerMapping.qty ?? -1,
      unit: headerMapping.unit ?? null,
      rate: headerMapping.rate ?? null,
      value: headerMapping.value ?? null,
      group: headerMapping.group ?? null,
      hsn: headerMapping.hsn ?? null,
    };
    if (mapping.qty === -1) {
      warnings.push('Header me quantity column nahi mila - pehla numeric column quantity maan liya gaya hai.');
      mapping.qty = mapping.name + 1;
    }
    startRow = headerRow + 1;
  } else {
    mapping = heuristicColumns(rows);
    warnings.push('Header row nahi mili - columns auto-detect kiye gaye hain. Preview zaroor check karein.');
  }

  // ------------------------------------------------------------
  // Tally stock-summary detection: item rows duplicate the name in
  // the next column (A:B merged), batch/godown sub-rows have a
  // DIFFERENT text there. Pre-scan to decide if this export uses
  // that structure.
  // ------------------------------------------------------------
  const nameCol = mapping.name;
  const dupCol = nameCol + 1;
  let mergedCount = 0, distinctCount = 0;
  if (mapping.qty >= 0 && dupCol < Math.max(...rows.map(r => r.length))) {
    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      const a = String(row[nameCol] ?? '').trim();
      const b = String(row[dupCol] ?? '').trim();
      const q = parseQtyWithUnit(mapping.qty >= 0 ? row[mapping.qty] : undefined).qty;
      if (!a || !b || q == null) continue;
      if (a.toLowerCase() === b.toLowerCase()) mergedCount++; else distinctCount++;
    }
  }
  const useNameDup = mergedCount >= 3 && distinctCount >= 1;
  let skippedSubRows = 0;

  // track groups (Tally stock-summary style: a text-only row acts as group header)
  let currentGroup: string | undefined = undefined;
  const items: ParsedTallyItem[] = [];
  let skipped = 0;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    const nameCell = String(row[nameCol] ?? '').trim();
    if (!nameCell) { skipped++; continue; }

    if (isLikelyTotalRow(nameCell)) { skipped++; continue; }

    // Tally stock-summary mode: skip batch/godown sub-rows
    if (useNameDup) {
      const dupCell = String(row[dupCol] ?? '').trim();
      if (dupCell.toLowerCase() !== nameCell.toLowerCase()) { skippedSubRows++; continue; }
    }

    const qtyRaw = mapping.qty >= 0 ? row[mapping.qty] : undefined;
    const { qty: parsedQty, unit: inlineUnit } = mapping.qty >= 0 ? parseQtyWithUnit(qtyRaw) : { qty: null, unit: undefined };

    // Group header row: pure text, no qty, no numbers anywhere
    const hasAnyNumber = row.some((cell, c) => c !== nameCol && parseNumber(cell) != null);
    if (parsedQty == null && !hasAnyNumber && GROUP_HEADER_RE.test(nameCell)) {
      currentGroup = nameCell;
      continue;
    }

    let qty = parsedQty;
    if (qty == null) {
      // Item row with no quantity but a value (net-zero stock) -> import with qty 0
      const valueNum = mapping.value != null ? parseNumber(row[mapping.value]) : null;
      if (useNameDup && valueNum != null) {
        qty = 0;
      } else {
        skipped++;
        if (skipped <= 3) warnings.push(`Row skip hui: "${nameCell}" (quantity nahi samajh aayi)`);
        continue;
      }
    }

    const unitCell = mapping.unit != null ? String(row[mapping.unit] ?? '').trim() : '';
    const rateVal = mapping.rate != null ? parseNumber(row[mapping.rate]) : null;
    const hsnCell = mapping.hsn != null ? String(row[mapping.hsn] ?? '').trim() : '';

    items.push({
      name: nameCell,
      qty,
      unit: inlineUnit || (unitCell || undefined) || undefined,
      rate: rateVal != null ? rateVal : undefined,
      hsn: hsnCell || undefined,
      group: mapping.group != null ? (String(row[mapping.group] ?? '').trim() || currentGroup) : currentGroup,
    });
  }

  if (useNameDup && skippedSubRows > 0) {
    warnings.push(`Tally stock-summary format: ${skippedSubRows} batch/godown sub-rows skip kiye (item-level qty hi import hoti hai).`);
  }
  if (skipped > 3) warnings.push(`Total ${skipped} rows skip hui (empty / total / unparseable).`);
  if (items.length === 0) {
    throw new Error('Koi stock item parse nahi hua. Tally Stock Summary export check karein (CSV ya Excel).');
  }

  return {
    items,
    warnings,
    columnMapping: mapping,
    headerRow,
    totalRows: rows.length,
    skippedSubRows,
  };
}
