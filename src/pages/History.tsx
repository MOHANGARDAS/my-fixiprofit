import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardCheck, ArrowRightLeft, AlertTriangle, CheckCircle2, Upload } from 'lucide-react';
import { useAdjustments, useSessions, useImportHistory } from '@/hooks/useStock';
import { formatQty, formatDateTime } from '@/utils/dateUtils';
import type { StockAdjustment } from '@/types';

type Tab = 'sessions' | 'adjustments' | 'imports';

function AdjustmentRow({ a, onClick }: { a: StockAdjustment; onClick?: () => void }) {
  const diff = a.diffQty;
  return (
    <button onClick={onClick} className="card w-full text-left flex items-center gap-3 !py-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${diff < 0 ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
        <ArrowRightLeft size={14} className={diff < 0 ? 'text-red-400' : 'text-blue-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{a.itemName}</p>
        <p className="text-[10px] text-dark-500 truncate">
          {formatQty(a.oldQty)} → {formatQty(a.newQty)} · {a.reason || 'Adjustment'}
        </p>
        <p className="text-[9px] text-dark-600">{formatDateTime(a.appliedAt)}</p>
      </div>
      <span className={`text-sm font-bold flex-shrink-0 ${diff < 0 ? 'text-red-400' : 'text-blue-400'}`}>
        {diff > 0 ? '+' : ''}{formatQty(diff)}
      </span>
    </button>
  );
}

export function History() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('sessions');
  const sessions = useSessions();
  const adjustments = useAdjustments();
  const imports = useImportHistory();

  const completed = sessions.filter(s => s.status === 'completed');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-3 py-4 pb-6 max-w-3xl"
    >
      {/* Tabs */}
      <div className="grid grid-cols-3 bg-dark-800 rounded-xl p-1 border border-dark-700">
        {([['sessions', `Sessions (${completed.length})`], ['adjustments', `Adjustments (${adjustments.length})`], ['imports', `Imports (${imports.length})`]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-colors ${tab === t ? 'bg-dark-700 text-primary-400' : 'text-dark-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sessions */}
      {tab === 'sessions' && (
        <div className="space-y-2">
          {completed.map(s => (
            <button
              key={s.id}
              onClick={() => navigate(`/count/${s.id}/review`)}
              className="card w-full text-left hover:bg-dark-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-dark-700">
                  {s.shortageItems > 0 ? <AlertTriangle size={15} className="text-orange-400" /> : <CheckCircle2 size={15} className="text-primary-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{s.name}</p>
                  <p className="text-[10px] text-dark-500">{formatDateTime(s.completedAt || s.startedAt)}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                <div className="text-center bg-dark-900/50 rounded-lg py-1.5">
                  <p className="text-xs font-bold text-white">{s.countedItems}</p>
                  <p className="text-[8px] text-dark-500">counted</p>
                </div>
                <div className="text-center bg-dark-900/50 rounded-lg py-1.5">
                  <p className="text-xs font-bold text-primary-400">{s.matchedItems}</p>
                  <p className="text-[8px] text-dark-500">matched</p>
                </div>
                <div className="text-center bg-dark-900/50 rounded-lg py-1.5">
                  <p className="text-xs font-bold text-red-400">{s.shortageItems}</p>
                  <p className="text-[8px] text-dark-500">short</p>
                </div>
                <div className="text-center bg-dark-900/50 rounded-lg py-1.5">
                  <p className="text-xs font-bold text-blue-400">{s.excessItems}</p>
                  <p className="text-[8px] text-dark-500">excess</p>
                </div>
              </div>
            </button>
          ))}
          {completed.length === 0 && (
            <div className="card text-center py-8">
              <ClipboardCheck size={24} className="mx-auto text-dark-500" />
              <p className="text-sm text-dark-300 mt-2">Koi completed session nahi</p>
            </div>
          )}
        </div>
      )}

      {/* Adjustments */}
      {tab === 'adjustments' && (
        <div className="space-y-2">
          {adjustments.map(a => (
            <AdjustmentRow key={a.id} a={a} onClick={a.sessionId ? () => navigate(`/count/${a.sessionId}/review`) : undefined} />
          ))}
          {adjustments.length === 0 && (
            <div className="card text-center py-8">
              <ArrowRightLeft size={24} className="mx-auto text-dark-500" />
              <p className="text-sm text-dark-300 mt-2">Abhi tak koi adjustment nahi hua</p>
              <p className="text-xs text-dark-500">Physical count complete hone par adjustments yahan dikhte hain</p>
            </div>
          )}
        </div>
      )}

      {/* Imports */}
      {tab === 'imports' && (
        <div className="space-y-2">
          {imports.map(im => (
            <div key={im.id} className="card flex items-center gap-3 !py-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Upload size={14} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{im.fileName}</p>
                <p className="text-[10px] text-dark-500">
                  {im.itemCount} items · {im.mode} · {im.newItems} new / {im.updatedItems} updated
                </p>
                <p className="text-[9px] text-dark-600">{formatDateTime(im.importedAt)}</p>
              </div>
            </div>
          ))}
          {imports.length === 0 && (
            <div className="card text-center py-8">
              <Upload size={24} className="mx-auto text-dark-500" />
              <p className="text-sm text-dark-300 mt-2">Koi Tally import nahi hua</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
