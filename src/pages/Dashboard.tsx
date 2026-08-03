import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Wrench, DollarSign, Clock, Search } from 'lucide-react';
import { useRepairStats } from '@/hooks/useRepairs';
import { formatCurrency, getDateRange, getTodayStr } from '@/utils/dateUtils';
import type { FilterPeriod } from '@/types';
import { RepairCard } from '@/components/RepairCard';

const periods: { key: FilterPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
];

export function Dashboard() {
  const [period, setPeriod] = useState<FilterPeriod>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(getTodayStr());
  const navigate = useNavigate();

  const { start, end } = period === 'custom'
    ? { start: customStart, end: customEnd }
    : getDateRange(period);

  const stats = useRepairStats(
    (period === 'custom' && customStart) ? customStart : start,
    (period === 'custom' && customEnd) ? customEnd + 'T23:59:59' : end
  );

  const recentRepairs = stats.repairs?.slice(0, 8) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-5 py-4"
    >
      {/* Period Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              period === p.key
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                : 'bg-dark-800 text-dark-400 border border-dark-700 hover:border-dark-600'
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
          className="flex gap-3 max-w-md"
        >
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="input-field flex-1 text-sm"
          />
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="input-field flex-1 text-sm"
          />
        </motion.div>
      )}

      {/* Stats Grid - 4 cols on desktop, 2 on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Wrench size={16} className="text-blue-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-white">{stats.totalRepairs}</p>
          <p className="text-xs text-dark-400">Total Repairs</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="stat-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
              <DollarSign size={16} className="text-green-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-dark-400">Revenue</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="stat-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-orange-400" />
            </div>
          </div>
          <p className={`text-2xl lg:text-3xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(stats.totalProfit)}
          </p>
          <p className="text-xs text-dark-400">Profit</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="stat-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-purple-400" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-white">{formatCurrency(stats.totalCost)}</p>
          <p className="text-xs text-dark-400">Total Cost</p>
        </motion.div>
      </div>

      {/* Summary + Recent - side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cost Summary */}
        <div className="card lg:col-span-1">
          <h3 className="text-sm font-semibold text-dark-300 mb-3">Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-dark-400">Total Cost</span>
              <span className="text-sm font-semibold text-red-400">{formatCurrency(stats.totalCost)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-dark-400">Total Revenue</span>
              <span className="text-sm font-semibold text-blue-400">{formatCurrency(stats.totalRevenue)}</span>
            </div>
            <div className="h-px bg-dark-700" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-white">Net Profit</span>
              <span className={`text-base font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(stats.totalProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Repairs */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-dark-300">Recent Repairs</h3>
            <button
              onClick={() => navigate('/history')}
              className="text-xs text-primary-400 font-medium hover:text-primary-300"
            >
              View All →
            </button>
          </div>

          {recentRepairs.length === 0 ? (
            <div className="card text-center py-10">
              <Search size={32} className="text-dark-600 mx-auto mb-3" />
              <p className="text-sm text-dark-400">No repairs yet</p>
              <button
                onClick={() => navigate('/add')}
                className="mt-3 text-sm text-primary-400 font-medium hover:text-primary-300"
              >
                Add your first repair →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRepairs.map((repair, idx) => (
                <RepairCard key={repair.id} repair={repair} index={idx} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
