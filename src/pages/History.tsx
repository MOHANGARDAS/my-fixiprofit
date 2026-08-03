import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Calendar, Smartphone, IndianRupee } from 'lucide-react';
import { useRepairs } from '@/hooks/useRepairs';
import { getTodayStr, formatCurrency } from '@/utils/dateUtils';

export function History() {
  const repairs = useRepairs();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState(getTodayStr());
  const [useCustomDate, setUseCustomDate] = useState(false);

  const filteredRepairs = useMemo(() => {
    let result = [...repairs];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.deviceModel.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    if (useCustomDate && dateStart) {
      const endDateWithTime = dateEnd ? dateEnd + 'T23:59:59' : '';
      result = result.filter((r) => r.date >= dateStart && r.date <= endDateWithTime);
    }

    return result;
  }, [repairs, search, useCustomDate, dateStart, dateEnd]);

  const formatDisplayDate = (dateStr: string) => {
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 py-4"
    >
      {/* Search + Date Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search device model, notes..."
            className="input-field pl-10 text-sm"
          />
        </div>
        <button
          onClick={() => setShowDateFilter(!showDateFilter)}
          className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
            showDateFilter || useCustomDate
              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
              : 'bg-dark-800 text-dark-400 border border-dark-700'
          }`}
        >
          <Calendar size={14} />
          {useCustomDate && dateStart ? `${dateStart} → ${dateEnd}` : 'Filter by Date'}
        </button>
      </div>

      {/* Date Filter */}
      {showDateFilter && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-dark-300">Date Range</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomDate}
                  onChange={(e) => setUseCustomDate(e.target.checked)}
                  className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-xs text-dark-400">Apply</span>
              </label>
              {useCustomDate && (
                <button
                  onClick={() => { setUseCustomDate(false); setDateStart(''); }}
                  className="text-xs text-primary-400"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-3 max-w-md">
            <div className="flex-1">
              <label className="text-[10px] text-dark-400 mb-1 block">From</label>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="input-field text-xs py-2" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-dark-400 mb-1 block">To</label>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="input-field text-xs py-2" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Results Count */}
      <p className="text-xs text-dark-400">
        {filteredRepairs.length} repair{filteredRepairs.length !== 1 ? 's' : ''} found
      </p>

      {/* Empty State */}
      {filteredRepairs.length === 0 ? (
        <div className="card text-center py-10">
          <Search size={32} className="text-dark-600 mx-auto mb-3" />
          <p className="text-sm text-dark-400">No repairs found</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card View */}
          <div className="space-y-3 lg:hidden">
            {filteredRepairs.map((repair, idx) => {
              const profit = repair.chargedPrice - repair.repairCost;
              return (
                <motion.div
                  key={repair.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => navigate(`/edit/${repair.id}`)}
                  className="card cursor-pointer hover:border-dark-600 active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-dark-700 rounded-xl flex items-center justify-center">
                        <Smartphone size={18} className="text-dark-300" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{repair.deviceModel || 'Device'}</h4>
                        {repair.notes && <p className="text-xs text-dark-400 line-clamp-1">{repair.notes}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white">₹{repair.chargedPrice}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-dark-700">
                    <span className="text-[11px] text-dark-500">{formatDisplayDate(repair.date)}</span>
                    <span className={`text-xs font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Profit: {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden lg:block card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700 bg-dark-800/50">
                    <th className="text-left text-xs font-semibold text-dark-400 px-4 py-3">Device</th>
                    <th className="text-left text-xs font-semibold text-dark-400 px-4 py-3">Date & Time</th>
                    <th className="text-right text-xs font-semibold text-dark-400 px-4 py-3">Cost</th>
                    <th className="text-right text-xs font-semibold text-dark-400 px-4 py-3">Price</th>
                    <th className="text-right text-xs font-semibold text-dark-400 px-4 py-3">Profit</th>
                    <th className="text-left text-xs font-semibold text-dark-400 px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepairs.map((repair, idx) => {
                    const profit = repair.chargedPrice - repair.repairCost;
                    return (
                      <tr
                        key={repair.id}
                        onClick={() => navigate(`/edit/${repair.id}`)}
                        className="border-b border-dark-700/50 hover:bg-dark-800/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Smartphone size={14} className="text-dark-500" />
                            <span className="text-sm text-white font-medium">{repair.deviceModel || 'Device'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-400">{formatDisplayDate(repair.date)}</td>
                        <td className="px-4 py-3 text-sm text-dark-400 text-right">₹{repair.repairCost}</td>
                        <td className="px-4 py-3 text-sm text-white font-medium text-right">₹{repair.chargedPrice}</td>
                        <td className={`px-4 py-3 text-sm font-bold text-right ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {profit >= 0 ? '+' : ''}₹{profit}
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-400 max-w-[200px] truncate">{repair.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
