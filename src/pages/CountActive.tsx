import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ArrowLeft, Check, X, AlertTriangle, CheckCircle2, Package,
  ClipboardCheck, Ban,
} from 'lucide-react';
import { useSessionData, useSession } from '@/hooks/useStock';
import { sessionService, nameKeyOf } from '@/database/db';
import { formatQty } from '@/utils/dateUtils';

type Tab = 'pending' | 'counted';

export function CountActive() {
  const navigate = useNavigate();
  const { id } = useParams();
  const sessionId = id ? Number(id) : undefined;
  const session = useSession(sessionId);
  const { entries, pending } = useSessionData(sessionId);

  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  // selected item for the count sheet
  const [selected, setSelected] = useState<{ itemId: number; name: string; unit?: string; systemQty: number; currentCount?: number } | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Redirect completed sessions to review
  useEffect(() => {
    if (session && session.status !== 'in_progress') {
      navigate(`/count/${sessionId}/review`, { replace: true });
    }
  }, [session, sessionId, navigate]);

  const filteredPending = useMemo(() => {
    if (!search.trim()) return pending;
    const q = nameKeyOf(search);
    return pending.filter(i => i.nameKey.includes(q));
  }, [pending, search]);

  const filteredCounted = useMemo(() => {
    if (!search.trim()) return entries;
    const q = nameKeyOf(search);
    return entries.filter(e => nameKeyOf(e.itemName).includes(q));
  }, [entries, search]);

  const openCountSheet = (item: { id?: number; name: string; unit?: string; systemQty: number }) => {
    if (item.id == null) return;
    const existing = entries.find(e => e.itemId === item.id);
    setSelected({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      systemQty: item.systemQty,
      currentCount: existing?.countedQty,
    });
    setQtyInput(existing ? String(existing.countedQty) : String(item.systemQty));
  };

  const saveCount = async () => {
    if (!selected || sessionId == null) return;
    const qty = parseFloat(qtyInput);
    if (!Number.isFinite(qty) || qty < 0) return;
    setSaving(true);
    try {
      await sessionService.saveCount(sessionId, selected.itemId, qty);
      setSelected(null);
      setQtyInput('');
    } finally {
      setSaving(false);
    }
  };

  const removeCount = async () => {
    if (!selected || sessionId == null) return;
    await sessionService.removeCount(sessionId, selected.itemId);
    setSelected(null);
    setQtyInput('');
  };

  if (session == null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalItems = session.totalItems;
  const counted = entries.length;
  const progress = totalItems ? (counted / totalItems) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3 py-4 pb-6 max-w-3xl"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/count')} className="p-2 -ml-2 text-dark-400 hover:text-white">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white truncate">{session.name}</h2>
          <p className="text-[10px] text-dark-500">{counted} of {totalItems} counted</p>
        </div>
        <button
          onClick={() => navigate(`/count/${sessionId}/review`)}
          disabled={counted === 0}
          className="btn-primary text-xs py-2 px-3 disabled:opacity-40"
        >
          Review ({counted})
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
        <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Item dhundein..."
          className="input-field pl-9 pr-9 text-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 bg-dark-800 rounded-xl p-1 border border-dark-700">
        {(['pending', 'counted'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors ${tab === t ? 'bg-dark-700 text-primary-400' : 'text-dark-400'}`}
          >
            {t === 'pending' ? `Pending (${pending.length})` : `Counted (${entries.length})`}
          </button>
        ))}
      </div>

      {/* Pending list */}
      {tab === 'pending' && (
        <div className="space-y-2">
          {filteredPending.map(item => (
            <button
              key={item.id}
              onClick={() => openCountSheet(item)}
              className="card w-full text-left flex items-center gap-3 hover:bg-dark-700/50 transition-colors !py-3"
            >
              <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0">
                <Package size={14} className="text-dark-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.name}</p>
                <p className="text-[10px] text-dark-500">{item.unit || ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-dark-400">system</p>
                <p className="text-sm font-bold text-white">{formatQty(item.systemQty)}</p>
              </div>
            </button>
          ))}
          {filteredPending.length === 0 && (
            <div className="card text-center py-8">
              <CheckCircle2 size={24} className="mx-auto text-primary-400" />
              <p className="text-sm text-dark-300 mt-2">
                {search ? 'Koi pending item match nahi hua' : 'Sab items count ho gaye! Review karein.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Counted list */}
      {tab === 'counted' && (
        <div className="space-y-2">
          {filteredCounted.map(e => {
            const diff = e.diffQty;
            return (
              <button
                key={e.id}
                onClick={() => openCountSheet({ id: e.itemId, name: e.itemName, unit: e.unit, systemQty: e.systemQty })}
                className="card w-full text-left flex items-center gap-3 hover:bg-dark-700/50 transition-colors !py-3"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${diff === 0 ? 'bg-primary-500/10' : diff < 0 ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                  {diff === 0 ? <Check size={14} className="text-primary-400" /> : <AlertTriangle size={14} className={diff < 0 ? 'text-red-400' : 'text-blue-400'} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{e.itemName}</p>
                  <p className="text-[10px] text-dark-500">system {formatQty(e.systemQty)} → counted {formatQty(e.countedQty)}</p>
                </div>
                <span className={`text-xs font-bold flex-shrink-0 ${diff === 0 ? 'text-primary-400' : diff < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {diff > 0 ? '+' : ''}{formatQty(diff)}
                </span>
              </button>
            );
          })}
          {filteredCounted.length === 0 && (
            <div className="card text-center py-8">
              <ClipboardCheck size={24} className="mx-auto text-dark-500" />
              <p className="text-sm text-dark-300 mt-2">{search ? 'Koi counted item match nahi hua' : 'Abhi tak kuch count nahi hua'}</p>
            </div>
          )}
        </div>
      )}

      {/* Count sheet */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-dark-800 border-t border-dark-600 rounded-t-3xl p-5 pb-8 space-y-4"
            >
              <div className="w-10 h-1 bg-dark-600 rounded-full mx-auto" />
              <div>
                <p className="text-sm font-semibold text-white break-words">{selected.name}</p>
                <p className="text-[10px] text-dark-500">
                  System qty: {formatQty(selected.systemQty)} {selected.unit || ''}
                </p>
              </div>
              <div>
                <label className="text-xs text-dark-400 mb-1.5 block">Physical Count (jo dikh raha hai wahi likhein)</label>
                <input
                  value={qtyInput}
                  onChange={e => setQtyInput(e.target.value)}
                  inputMode="decimal"
                  autoFocus
                  className="input-field text-2xl text-center font-bold"
                  placeholder="0"
                />
              </div>
              {parseFloat(qtyInput) !== selected.systemQty && Number.isFinite(parseFloat(qtyInput)) && (
                <div className={`p-2.5 rounded-xl border text-center text-xs font-medium ${parseFloat(qtyInput) < selected.systemQty ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                  Difference: {parseFloat(qtyInput) - selected.systemQty > 0 ? '+' : ''}{formatQty(parseFloat(qtyInput) - selected.systemQty)} {selected.unit || ''}
                </div>
              )}
              <button onClick={saveCount} disabled={saving} className="btn-primary w-full">
                <Check size={18} className="inline mr-1 -mt-0.5" />
                Save Count
              </button>
              {selected.currentCount != null && (
                <button onClick={removeCount} className="w-full text-xs text-red-400 py-1.5 hover:text-red-300">
                  Remove this count
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
