import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Plus, PackageX, ScanSearch, Package } from 'lucide-react';
import { useItems, useGroups } from '@/hooks/useStock';
import { formatQty } from '@/utils/dateUtils';

export function Items() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const items = useItems(search, group || undefined);
  const groups = useGroups();

  const totalQty = useMemo(() => items.reduce((s, i) => s + (i.systemQty || 0), 0), [items]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3 py-4 pb-6 max-w-3xl"
    >
      {/* Search + filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Item search karein..."
            className="input-field pl-9 text-sm"
          />
        </div>
        <select
          value={group}
          onChange={e => setGroup(e.target.value)}
          className="input-field text-sm w-auto min-w-[110px] pr-8"
        >
          <option value="">All Groups</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-dark-400">{items.length} items · Total qty {formatQty(totalQty)}</p>
        <button
          onClick={() => navigate('/items/new')}
          className="flex items-center gap-1 text-xs font-medium text-primary-400 hover:text-primary-300"
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.map(item => {
          const counted = item.lastCountedAt != null;
          const mismatch = counted && item.lastCountedQty !== item.systemQty;
          return (
            <button
              key={item.id}
              onClick={() => navigate(`/items/${item.id}/edit`)}
              className="card w-full text-left flex items-center gap-3 hover:bg-dark-700/50 transition-colors !py-3"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-dark-700">
                <Package size={16} className="text-dark-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{item.name}</p>
                <p className="text-[10px] text-dark-500 truncate">
                  {[item.group, item.unit, item.rate ? `₹${item.rate}` : null].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-bold text-white leading-tight">{formatQty(item.systemQty)}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  {counted ? (
                    <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${mismatch ? 'bg-orange-500/10 text-orange-400' : 'bg-primary-500/10 text-primary-400'}`}>
                      <ScanSearch size={9} />
                      {mismatch ? `last ${formatQty(item.lastCountedQty!)}` : 'verified'}
                    </span>
                  ) : (
                    <span className="text-[9px] text-dark-600">never counted</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {items.length === 0 && (
          <div className="card text-center py-10 space-y-3">
            <div className="w-14 h-14 mx-auto bg-dark-700 rounded-2xl flex items-center justify-center">
              {search || group ? <PackageX size={26} className="text-dark-500" /> : <Package size={26} className="text-dark-500" />}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {search || group ? 'Koi item match nahi hua' : 'Stock list khali hai'}
              </p>
              <p className="text-xs text-dark-400 mt-1">
                {search || group ? 'Search ya filter change karke dekhein.' : 'Tally se import karein ya manually item add karein.'}
              </p>
            </div>
            {!search && !group && (
              <div className="flex gap-2 justify-center pt-1">
                <button onClick={() => navigate('/import')} className="btn-primary text-xs py-2 px-4">Tally Import</button>
                <button onClick={() => navigate('/items/new')} className="btn-secondary text-xs py-2 px-4">Add Item</button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
