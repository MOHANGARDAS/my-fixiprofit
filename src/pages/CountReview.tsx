import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, ArrowRightLeft, RefreshCw,
  Check, X, Minus, Plus,
} from 'lucide-react';
import { useSession, useSessionData } from '@/hooks/useStock';
import { sessionService } from '@/database/db';
import { formatQty, formatDateTime, formatCurrency } from '@/utils/dateUtils';

export function CountReview() {
  const navigate = useNavigate();
  const { id } = useParams();
  const sessionId = id ? Number(id) : undefined;
  const session = useSession(sessionId);
  const { entries } = useSessionData(sessionId);

  const [showAll, setShowAll] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0);
  const [doneInfo, setDoneInfo] = useState<{ adjusted: number } | null>(null);
  const [error, setError] = useState('');

  const diffs = useMemo(() => entries.filter(e => e.diffQty !== 0), [entries]);
  const visible = showAll ? entries : diffs;
  const diffValue = useMemo(() => diffs.reduce((s, e) => s + Math.abs(e.diffQty) * (e.rate || 0), 0), [diffs]);

  const applyAdjustments = async () => {
    if (sessionId == null) return;
    setApplying(true);
    setError('');
    try {
      const r = await sessionService.complete(sessionId);
      setDoneInfo(r);
      setConfirmStep(0);
    } catch (e: any) {
      setError(e?.message || 'Apply fail hua');
    } finally {
      setApplying(false);
    }
  };

  if (session == null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = session.status === 'in_progress';
  const isCancelled = session.status === 'cancelled';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 py-4 pb-6 max-w-3xl"
    >
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(isActive ? `/count/${sessionId}` : '/count')} className="p-2 -ml-2 text-dark-400 hover:text-white">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white truncate">{session.name}</h2>
          <p className="text-[10px] text-dark-500">
            {isActive ? 'Review differences, phir adjust karein' : isCancelled ? 'Cancelled session' : formatDateTime(session.completedAt || '')}
          </p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-4 gap-2">
        <div className="stat-card !p-3 text-center">
          <p className="text-lg font-bold text-white">{session.countedItems}/{session.totalItems}</p>
          <p className="text-[9px] text-dark-400">Counted</p>
        </div>
        <div className="stat-card !p-3 text-center">
          <p className="text-lg font-bold text-primary-400">{session.matchedItems}</p>
          <p className="text-[9px] text-dark-400">Matched</p>
        </div>
        <div className="stat-card !p-3 text-center">
          <p className="text-lg font-bold text-red-400">{session.shortageItems}</p>
          <p className="text-[9px] text-dark-400">Shortage</p>
        </div>
        <div className="stat-card !p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{session.excessItems}</p>
          <p className="text-[9px] text-dark-400">Excess</p>
        </div>
      </div>

      {/* Done banner */}
      {doneInfo && (
        <div className="card border-primary-500/30 bg-primary-500/5 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-primary-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Adjustments applied!</p>
            <p className="text-xs text-dark-400">{doneInfo.adjusted} items ki system qty update hui. Log me save ho gaya.</p>
          </div>
          <button onClick={() => navigate('/history')} className="btn-primary text-xs py-2 px-3">History</button>
        </div>
      )}

      {/* Differences list */}
      {!doneInfo && !isCancelled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wide">
              {showAll ? `All Entries (${entries.length})` : `Differences (${diffs.length})`}
            </h3>
            {diffs.length > 0 && diffs.length < entries.length && (
              <button onClick={() => setShowAll(!showAll)} className="text-[11px] text-primary-400">
                {showAll ? 'Differences only' : 'Show all'}
              </button>
            )}
          </div>

          {diffValue > 0 && (
            <p className="text-[10px] text-dark-500 px-1">
              Difference value (rate-wise): {formatCurrency(diffValue)}
            </p>
          )}

          {visible.map(e => {
            const diff = e.diffQty;
            return (
              <div key={e.id} className="card !py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${diff === 0 ? 'bg-primary-500/10' : diff < 0 ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                  {diff === 0 ? <Check size={14} className="text-primary-400" /> : diff < 0 ? <Minus size={14} className="text-red-400" /> : <Plus size={14} className="text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{e.itemName}</p>
                  <p className="text-[10px] text-dark-500">
                    system {formatQty(e.systemQty)} → counted {formatQty(e.countedQty)} {e.unit || ''}
                  </p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${diff === 0 ? 'text-primary-400' : diff < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {diff > 0 ? '+' : ''}{formatQty(diff)}
                </span>
              </div>
            );
          })}

          {visible.length === 0 && (
            <div className="card text-center py-8">
              <CheckCircle2 size={24} className="mx-auto text-primary-400" />
              <p className="text-sm text-dark-300 mt-2">Sab items matched — koi difference nahi!</p>
            </div>
          )}
        </div>
      )}

      {/* Apply / Close actions */}
      {!doneInfo && !isCancelled && (
        <div className="space-y-2">
          {confirmStep === 0 && (
            <button
              onClick={() => setConfirmStep(1)}
              disabled={!isActive || diffs.length === 0}
              className="btn-primary w-full text-sm disabled:opacity-40"
            >
              <ArrowRightLeft size={16} className="inline mr-1.5 -mt-0.5" />
              {isActive ? `Apply Adjustments (${diffs.length} items)` : 'Session already completed'}
            </button>
          )}
          {confirmStep === 1 && (
            <div className="card border-orange-500/30 bg-orange-500/5 space-y-2">
              <p className="text-xs text-orange-400">
                <strong>{diffs.length} items</strong> ki system qty physical count ke hisaab se set hogi.
                Yeh undo nahi hota (par History me pura log rahega). Continue?
              </p>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setConfirmStep(0)} className="btn-secondary flex-1 text-xs py-2">
                  <X size={14} className="inline mr-1" /> Cancel
                </button>
                <button onClick={applyAdjustments} disabled={applying} className="btn-danger flex-1 text-xs py-2">
                  {applying ? <RefreshCw size={14} className="inline animate-spin" /> : <Check size={14} className="inline mr-1" />}
                  {applying ? 'Applying...' : 'Yes, Apply'}
                </button>
              </div>
            </div>
          )}

          {isActive && (
            <button
              onClick={async () => {
                if (sessionId == null) return;
                if (confirmStep === 0) { setConfirmStep(2); return; }
                await sessionService.cancel(sessionId);
                navigate('/count');
              }}
              className="w-full text-xs text-dark-500 hover:text-red-400 py-2"
            >
              {confirmStep === 2 ? 'Tap again to cancel session permanently' : 'Cancel this session (no changes)'}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
