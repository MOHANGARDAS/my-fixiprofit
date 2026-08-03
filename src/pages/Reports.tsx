import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useRepairStats } from '@/hooks/useRepairs';
import { formatCurrency, getDateRange, getTodayStr } from '@/utils/dateUtils';
import type { FilterPeriod } from '@/types';
import { ProfitChart } from '@/components/ProfitChart';
import { DeviceChart } from '@/components/DeviceChart';

const periods: { key: FilterPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
];

export function Reports() {
  const [period, setPeriod] = useState<FilterPeriod>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(getTodayStr());

  const { start, end } = period === 'custom'
    ? { start: customStart, end: customEnd ? customEnd + 'T23:59:59' : '' }
    : getDateRange(period);

  const stats = useRepairStats(
    (period === 'custom' && customStart) ? customStart : start,
    (period === 'custom' && customEnd) ? customEnd + 'T23:59:59' : end
  );

  const profitMargin = stats.totalRevenue > 0
    ? ((stats.totalProfit / stats.totalRevenue) * 100).toFixed(1)
    : '0';

  const avgRepairValue = stats.totalRepairs > 0
    ? Math.round(stats.totalRevenue / stats.totalRepairs)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-5 py-4"
    >
      {/* Period Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              period === p.key
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                : 'bg-dark-800 text-dark-400 border border-dark-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {period === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card space-y-3"
        >
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-primary-400" />
            <span className="text-xs font-medium text-dark-300">Select Custom Date Range</span>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-dark-400 mb-1 block">From</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input-field text-xs py-2"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-dark-400 mb-1 block">To</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-field text-xs py-2"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary Cards - 4 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-green-400" />
            </div>
          </div>
          <p className="text-xl font-bold text-green-400">{formatCurrency(stats.totalProfit)}</p>
          <p className="text-[11px] text-dark-400">Total Profit</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-400" />
            </div>
          </div>
          <p className="text-xl font-bold text-blue-400">{profitMargin}%</p>
          <p className="text-[11px] text-dark-400">Profit Margin</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <TrendingDown size={16} className="text-orange-400" />
            </div>
          </div>
          <p className="text-xl font-bold text-orange-400">{formatCurrency(stats.totalCost)}</p>
          <p className="text-[11px] text-dark-400">Total Cost</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-purple-400" />
            </div>
          </div>
          <p className="text-xl font-bold text-purple-400">{formatCurrency(avgRepairValue)}</p>
          <p className="text-[11px] text-dark-400">Avg Repair Value</p>
        </motion.div>
      </div>

      {/* Revenue Breakdown */}
      <div className="card">
        <h3 className="text-sm font-semibold text-dark-300 mb-3">Revenue Breakdown</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-dark-400">Revenue</span>
              <span className="text-blue-400 font-medium">{formatCurrency(stats.totalRevenue)}</span>
            </div>
            <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-dark-400">Cost</span>
              <span className="text-orange-400 font-medium">{formatCurrency(stats.totalCost)}</span>
            </div>
            <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: stats.totalRevenue > 0 ? `${(stats.totalCost / stats.totalRevenue) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-dark-400">Profit</span>
              <span className="text-green-400 font-medium">{formatCurrency(stats.totalProfit)}</span>
            </div>
            <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: stats.totalRevenue > 0 ? `${(stats.totalProfit / stats.totalRevenue) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Charts - side by side on desktop */}
      {stats.repairs && stats.repairs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-dark-300 mb-3">Profit Trend</h3>
            <ProfitChart repairs={stats.repairs} />
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-dark-300 mb-3">Top Devices</h3>
            <DeviceChart repairs={stats.repairs} />
          </div>
        </div>
      )}

      {/* Top Repairs */}
      {stats.repairs && stats.repairs.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Top Earning Repairs</h3>
          <div className="space-y-2">
            {[...stats.repairs]
              .sort((a, b) => (b.chargedPrice - b.repairCost) - (a.chargedPrice - a.repairCost))
              .slice(0, 5)
              .map((r, idx) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-dark-500 w-4">#{idx + 1}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{r.deviceModel}</p>
                      {r.notes && <p className="text-[10px] text-dark-400">{r.notes}</p>}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-green-400">
                    +{formatCurrency(r.chargedPrice - r.repairCost)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
