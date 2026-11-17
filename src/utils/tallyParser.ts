import ExcelJS from 'exceljs';

// ============================================================
// Tally export parser (CSV / XLSX / XLS)
// Tally "Stock Summary" exports come in many shapes:
//   - with headers:  Stock Item | Quantity | Rate | Value | Group ...
//   - without headers: item rows directly, qty like "150.00 Pc"
//   - group headers + total rows sprinkled in between
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

async function readWorkbookRows(file: File): Promise<{ rows: string[][]; sheetName?: string }> {
  const buf = await file.arrayBuffer();
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

function findHeader(rows: string[][]): { headerRow: number; mapping: Partial<ColumnMapping> } {
  let best = { headerRow: -1, score: 0, mapping: {} as Partial<ColumnMapping> };
  const limit = Math.min(rows.length, 12);
  for (let i = 0; i < limit; i++) {
    const { score, mapping } = scoreHeaderRow(rows[i]);
    if (score > best.score) best = { headerRow: i, score, mapping };
  }
  // Need at least a name + qty-ish column to trust the header
  if (best.headerRow >= 0 && best.score >= 2 && best.mapping.name != null) {
    return { headerRow: best.headerRow, mapping: best.mapping };
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

function isLikelyTotalRow(nameCell: string, qty: number | null): boolean {
  const n = String(nameCell || '').trim();
  if (SKIP_ROW_RE.test(n)) return true;
  // Tally group-total rows often look like "GroupName Total" / "Total GroupName"
  if (/total/i.test(n)) return true;
  return false;
}

// ---------- main ----------

export async function parseTallyFile(file: File): Promise<ParseResult> {
  const lower = file.name.toLowerCase();
  let rows: string[][];
  let sheetName: string | undefined;

  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    rows = parseCsvText(await file.text());
  } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const res = await readWorkbookRows(file);
    rows = res.rows;
    sheetName = res.sheetName;
  } else {
    throw new Error('Unsupported file. Tally CSV ya Excel (.xlsx) file use karein.');
  }

  if (rows.length === 0) throw new Error('File khali hai ya padhi nahi ja saki.');

  const warnings: string[] = [];
  let { headerRow, mapping: headerMapping } = findHeader(rows);
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

  // track groups (Tally stock-summary style: a text-only row acts as group header)
  let currentGroup: string | undefined = undefined;
  const items: ParsedTallyItem[] = [];
  let skipped = 0;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    const nameCell = String(row[mapping.name] ?? '').trim();
    if (!nameCell) { skipped++; continue; }

    if (isLikelyTotalRow(nameCell, null)) { skipped++; continue; }

    const qtyRaw = mapping.qty >= 0 ? row[mapping.qty] : undefined;
    const { qty, unit: inlineUnit } = mapping.qty >= 0 ? parseQtyWithUnit(qtyRaw) : { qty: null, unit: undefined };

    // Group header row: pure text, no qty, no numbers anywhere except maybe value col
    const hasAnyNumber = row.some((cell, c) => c !== mapping.name && parseNumber(cell) != null);
    if (qty == null && !hasAnyNumber && GROUP_HEADER_RE.test(nameCell)) {
      currentGroup = nameCell;
      continue;
    }

    if (qty == null) {
      skipped++;
      if (skipped <= 3) warnings.push(`Row skip hui: "${nameCell}" (quantity nahi samajh aayi)`);
      continue;
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
  };
}
