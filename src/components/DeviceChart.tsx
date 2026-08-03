import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Repair {
  deviceModel: string;
}

interface DeviceChartProps {
  repairs: Repair[];
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export function DeviceChart({ repairs }: DeviceChartProps) {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    repairs.forEach((r) => {
      const key = r.deviceModel || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 devices
  }, [repairs]);

  if (data.length === 0) {
    return <p className="text-xs text-dark-500 text-center py-4">No data available</p>;
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-[120px] h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#f8fafc',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2">
        {data.map((item, idx) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-xs text-dark-300 truncate max-w-[120px]">{item.name}</span>
            </div>
            <span className="text-xs font-medium text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
