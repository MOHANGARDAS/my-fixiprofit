export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

export function getWeekEnd(): string {
  const startStr = getWeekStart();
  const start = new Date(startStr + 'T12:00:00');
  const sunday = new Date(start);
  sunday.setDate(start.getDate() + 6);
  const year = sunday.getFullYear();
  const month = String(sunday.getMonth() + 1).padStart(2, '0');
  const d = String(sunday.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

export function getMonthStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function getMonthEnd(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const d = String(lastDay).padStart(2, '0');
  const m = String(month + 1).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function getYearStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export function getYearEnd(): string {
  const now = new Date();
  return `${now.getFullYear()}-12-31`;
}

export function getDateRange(period: string): { start: string; end: string } {
  const today = getTodayStr();
  switch (period) {
    case 'today': return { start: today, end: today + 'T23:59:59' };
    case 'week': return { start: getWeekStart(), end: getWeekEnd() + 'T23:59:59' };
    case 'month': return { start: getMonthStart(), end: getMonthEnd() + 'T23:59:59' };
    case 'year': return { start: getYearStart(), end: getYearEnd() + 'T23:59:59' };
    default: return { start: '', end: '' };
  }
}
