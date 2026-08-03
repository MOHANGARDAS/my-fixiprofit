import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ProfitChartProps {
  repairs: { date: string; chargedPrice: number; repairCost: number }[];
}

export function ProfitChart({ repairs }: ProfitChartProps) {
  const data = useMemo(() => {
    const grouped: Record<string, { date: string; profit: number }> = {};
    repairs.forEach((r) => {
      if (!grouped[r.date]) grouped[r.date] = { date: r.date, profit: 0 };
      grouped[r.date].profit += r.chargedPrice - r.repairCost;
    });
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [repairs]);

  if (data.length === 0) return <p className="text-xs text-dark-500 text-center py-4">No data</p>;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `₹${v}`} />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }} formatter={(value: number) => [`₹${value}`, 'Profit']} />
          <Area type="monotone" dataKey="profit" stroke="#22c55e" fill="url(#profitGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
