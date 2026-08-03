import ExcelJS from 'exceljs';
import type { Repair } from '@/types';

function formatDateForExcel(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export async function generateExcel(repairs: Repair[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FixiProfit';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('All Repairs', { properties: { tabColor: { argb: '22C55E' } } });

  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'FixiProfit - Repair Shop Records';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 35;

  ws.mergeCells('A2:G2');
  const subCell = ws.getCell('A2');
  subCell.value = `Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${repairs.length}`;
  subCell.font = { size: 10, color: { argb: 'FF94A3B8' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  const headerRow = ws.addRow(['#', 'Date & Time', 'Device Model', 'Repair Cost (₹)', 'Charged Price (₹)', 'Profit (₹)', 'Notes']);
  headerRow.eachCell((cell) => {
    cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin', color: { argb: 'FF22C55E' } }, bottom: { style: 'thin', color: { argb: 'FF22C55E' } } };
  });
  headerRow.height = 28;

  let totalCost = 0, totalRevenue = 0, totalProfit = 0;

  repairs.forEach((repair, idx) => {
    const profit = repair.chargedPrice - repair.repairCost;
    totalCost += repair.repairCost;
    totalRevenue += repair.chargedPrice;
    totalProfit += profit;

    const row = ws.addRow([idx + 1, formatDateForExcel(repair.date), repair.deviceModel, repair.repairCost, repair.chargedPrice, profit, repair.notes || '']);
    row.eachCell((cell, colNumber) => {
      cell.font = { size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FF1E293B' : 'FF0F172A' } };
      if (colNumber >= 4 && colNumber <= 6) {
        cell.numFmt = '₹#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      if (colNumber === 6) {
        cell.font = { size: 10, bold: true, color: { argb: profit >= 0 ? 'FF22C55E' : 'FFEF4444' } };
      }
    });
  });

  ws.addRow([]);
  const summaryRow = ws.addRow(['', '', 'TOTAL:', totalCost, totalRevenue, totalProfit, '']);
  summaryRow.eachCell((cell, colNumber) => {
    cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = { top: { style: 'medium', color: { argb: 'FF22C55E' } }, bottom: { style: 'medium', color: { argb: 'FF22C55E' } } };
    if (colNumber >= 4 && colNumber <= 6) {
      cell.numFmt = '₹#,##0';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    if (colNumber === 6) {
      cell.font = { size: 12, bold: true, color: { argb: totalProfit >= 0 ? 'FF22C55E' : 'FFEF4444' } };
    }
  });

  ws.columns = [{ width: 5 }, { width: 18 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 25 }];

  // Sheet 2: Profit Summary
  const ws2 = workbook.addWorksheet('Profit Summary', { properties: { tabColor: { argb: '3B82F6' } } });
  ws2.mergeCells('A1:D1');
  const psTitle = ws2.getCell('A1');
  psTitle.value = 'FixiProfit - Summary Report';
  psTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  psTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  psTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 30;

  const summaryData = [
    ['Metric', 'Value'],
    ['Total Repairs', repairs.length],
    ['Total Revenue', totalRevenue],
    ['Total Cost', totalCost],
    ['Net Profit', totalProfit],
    ['Profit Margin', repairs.length > 0 && totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : '0%'],
    ['Avg Repair Value', repairs.length > 0 ? Math.round(totalRevenue / repairs.length) : 0],
  ];

  summaryData.forEach((row, idx) => {
    const r = ws2.addRow(row);
    r.eachCell((cell, colNum) => {
      if (idx === 0) {
        cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
      } else {
        cell.font = { size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FF1E293B' : 'FF0F172A' } };
      }
      if (colNum === 2 && typeof row[0] === 'string' && ['Total Revenue', 'Total Cost', 'Net Profit', 'Avg Repair Value'].includes(row[0])) {
        cell.numFmt = '₹#,##0';
        cell.font = { ...(cell.font as any), bold: true };
        if (row[0] === 'Net Profit') cell.font = { size: 10, bold: true, color: { argb: totalProfit >= 0 ? 'FF22C55E' : 'FFEF4444' } };
      }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } };
    });
  });
  ws2.getColumn(1).width = 22;
  ws2.getColumn(2).width = 18;

  // Sheet 3: Monthly Breakdown
  const ws3 = workbook.addWorksheet('Monthly Report', { properties: { tabColor: { argb: 'F59E0B' } } });
  ws3.mergeCells('A1:E1');
  const mrTitle = ws3.getCell('A1');
  mrTitle.value = 'FixiProfit - Monthly Breakdown';
  mrTitle.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  mrTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  mrTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(1).height = 30;

  const monthlyData: Record<string, { repairs: number; revenue: number; cost: number; profit: number }> = {};
  repairs.forEach(r => {
    const month = r.date.substring(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { repairs: 0, revenue: 0, cost: 0, profit: 0 };
    monthlyData[month].repairs++;
    monthlyData[month].revenue += r.chargedPrice;
    monthlyData[month].cost += r.repairCost;
    monthlyData[month].profit += r.chargedPrice - r.repairCost;
  });

  const monthHeader = ws3.addRow(['Month', 'Repairs', 'Revenue (₹)', 'Cost (₹)', 'Profit (₹)']);
  monthHeader.eachCell(cell => {
    cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF22C55E' } } };
  });
  monthHeader.height = 25;

  Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0])).forEach(([month, data]) => {
    const monthName = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const row = ws3.addRow([monthName, data.repairs, data.revenue, data.cost, data.profit]);
    row.eachCell((cell, colNum) => {
      cell.font = { size: 10 };
      cell.alignment = { horizontal: colNum > 1 ? 'right' : 'left', vertical: 'middle' };
      if (colNum > 1) cell.numFmt = colNum === 2 ? '#,##0' : '₹#,##0';
      if (colNum === 5) cell.font = { size: 10, bold: true, color: { argb: data.profit >= 0 ? 'FF22C55E' : 'FFEF4444' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } };
    });
  });
  ws3.getColumn(1).width = 15;
  ws3.getColumn(2).width = 10;
  ws3.getColumn(3).width = 14;
  ws3.getColumn(4).width = 14;
  ws3.getColumn(5).width = 14;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function generateCSV(repairs: Repair[]): string {
  const headers = ['#', 'Date & Time', 'Device Model', 'Repair Cost', 'Charged Price', 'Profit', 'Notes'];
  const rows = repairs.map((r, idx) => [
    idx + 1, formatDateForExcel(r.date), `"${r.deviceModel}"`, r.repairCost, r.chargedPrice, r.chargedPrice - r.repairCost, `"${r.notes || ''}"`,
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function generateJSON(repairs: Repair[]): string {
  return JSON.stringify({ version: 1, app: 'FixiProfit', timestamp: new Date().toISOString(), totalRecords: repairs.length, repairs }, null, 2);
}
