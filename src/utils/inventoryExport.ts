import ExcelJS from 'exceljs';
import type { Item, StockAdjustment } from '@/types';
import { exportAllData } from '@/database/db';

// Defensive helpers - a bad record must never crash the export/backup.
function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeText(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function fmtDateTime(dateStr: unknown): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(dateStr);
  }
}

// ============================================================
// JSON - the REAL backup (Drive restore uses this)
// ============================================================
export async function generateJSON(): Promise<string> {
  const data = await exportAllData();
  return JSON.stringify({
    app: 'StockVerify',
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data,
  }, null, 2);
}

// ============================================================
// CSV - human readable stock list
// ============================================================
export function generateItemsCSV(items: Item[]): string {
  const esc = (v: unknown) => {
    const s = safeText(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Item Name', 'Group', 'Unit', 'System Qty', 'Rate', 'Stock Value', 'Last Counted Qty', 'Last Counted At'];
  const lines = [header.join(',')];
  for (const i of items) {
    lines.push([
      esc(i.name), esc(i.group), esc(i.unit), safeNumber(i.systemQty),
      safeNumber(i.rate), safeNumber(i.systemQty) * safeNumber(i.rate),
      i.lastCountedQty != null ? safeNumber(i.lastCountedQty) : '',
      fmtDateTime(i.lastCountedAt),
    ].join(','));
  }
  return '\uFEFF' + lines.join('\n');
}

export async function generateCSV(): Promise<string> {
  const { items } = await exportAllData();
  return generateItemsCSV(items);
}

// ============================================================
// Excel - Stock Items + Adjustments log
// ============================================================
export async function generateExcel(data?: { items: Item[]; adjustments: StockAdjustment[] }): Promise<Blob> {
  let items: Item[], adjustments: StockAdjustment[];
  if (data) {
    ({ items, adjustments } = data);
  } else {
    const all = await exportAllData();
    items = all.items;
    adjustments = all.adjustments;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'StockVerify';
  workbook.created = new Date();

  // ----- Sheet 1: Stock Items -----
  const ws = workbook.addWorksheet('Stock Items', { properties: { tabColor: { argb: '22C55E' } } });

  ws.mergeCells('A1:H1');
  const title = ws.getCell('A1');
  title.value = 'StockVerify - Stock Master';
  title.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 35;

  ws.mergeCells('A2:H2');
  const sub = ws.getCell('A2');
  const totalQty = items.reduce((s, i) => s + safeNumber(i.systemQty), 0);
  const totalValue = items.reduce((s, i) => s + safeNumber(i.systemQty) * safeNumber(i.rate), 0);
  sub.value = `Generated: ${new Date().toLocaleString('en-IN')} | Items: ${items.length} | Total Qty: ${totalQty} | Stock Value: ₹${totalValue.toLocaleString('en-IN')}`;
  sub.font = { size: 10, color: { argb: 'FF94A3B8' } };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  const headerRow = ws.addRow(['#', 'Item Name', 'Group', 'Unit', 'System Qty', 'Rate (₹)', 'Stock Value (₹)', 'Last Counted']);
  headerRow.eachCell((cell) => {
    cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin', color: { argb: 'FF22C55E' } }, bottom: { style: 'thin', color: { argb: 'FF22C55E' } } };
  });
  headerRow.height = 28;

  items.forEach((item, idx) => {
    const qty = safeNumber(item.systemQty);
    const rate = safeNumber(item.rate);
    const row = ws.addRow([
      idx + 1, safeText(item.name), safeText(item.group), safeText(item.unit),
      qty, rate || '', rate ? qty * rate : '', fmtDateTime(item.lastCountedAt),
    ]);
    row.eachCell((cell, colNumber) => {
      cell.font = { size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FF1E293B' : 'FF0F172A' } };
      if (colNumber === 5) cell.numFmt = '#,##0.##';
      if (colNumber >= 6 && colNumber <= 7) {
        cell.numFmt = '₹#,##0.##';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
  });

  ws.columns = [{ width: 5 }, { width: 38 }, { width: 18 }, { width: 8 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 20 }];

  // ----- Sheet 2: Adjustments log -----
  const ws2 = workbook.addWorksheet('Adjustments', { properties: { tabColor: { argb: '3B82F6' } } });

  ws2.mergeCells('A1:G1');
  const t2 = ws2.getCell('A1');
  t2.value = 'StockVerify - Stock Adjustment Log';
  t2.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 30;

  const h2 = ws2.addRow(['Date', 'Item Name', 'Old Qty', 'New Qty', 'Difference', 'Reason']);
  h2.eachCell((cell) => {
    cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  h2.height = 26;

  adjustments.forEach((a, idx) => {
    const row = ws2.addRow([
      fmtDateTime(a.appliedAt), safeText(a.itemName),
      safeNumber(a.oldQty), safeNumber(a.newQty), safeNumber(a.diffQty), safeText(a.reason),
    ]);
    row.eachCell((cell, colNumber) => {
      cell.font = { size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FF1E293B' : 'FF0F172A' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } };
      if (colNumber >= 3 && colNumber <= 5) cell.numFmt = '#,##0.##';
      if (colNumber === 5) {
        cell.font = { size: 10, bold: true, color: { argb: a.diffQty < 0 ? 'FFEF4444' : 'FF22C55E' } };
      }
    });
  });

  ws2.columns = [{ width: 18 }, { width: 38 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 40 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
