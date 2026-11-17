import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, ClipboardCheck, AlertTriangle, CheckCircle2, XCircle, Play } from 'lucide-react';
import { useSessions, useStats } from '@/hooks/useStock';
import { sessionService } from '@/database/db';
import { formatDateTime } from '@/utils/dateUtils';
import type { CountSession } from '@/types';

function statusChip(s: CountSession) {
  if (s.status === 'in_progress') return { icon: Play, cls: 'bg-primary-500/10 text-primary-400', label: 'In Progress' };
  if (s.status === 'completed') {
    return s.shortageItems > 0 || s.excessItems > 0
      ? { icon: AlertTriangle, cls: 'bg-orange-500/10 text-orange-400', label: `${s.shortageItems} short / ${s.excessItems} excess` }
      : { icon: CheckCircle2, cls: 'bg-primary-500/10 text-primary-400', label: 'All Matched' };
  }
  return { icon: XCircle, cls: 'bg-dark-700 text-dark-500', label: 'Cancelled' };
}

export function CountSessions() {
  const navigate = useNavigate();
  const sessions = useSessions();
  const stats = useStats();

  const startNew = async () => {
    const id = await sessionService.create();
    navigate(`/count/${id}`);
  };

  const inProgress = sessions.filter(s => s.status === 'in_progress');
  const closed = sessions.filter(s => s.status !== 'in_progress');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 py-4 pb-6 max-w-3xl"
    >
      {/* New session */}
      <button
        onClick={startNew}
        disabled={!stats.hasData}
        className="card w-full flex items-center gap-3 border-primary-500/30 bg-primary-500/5 hover:bg-primary-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <div className="w-10 h-10 bg-primary-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
          <Plus size={20} className="text-primary-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-white">New Count Session</p>
          <p className="text-[10px] text-dark-400">
            {stats.hasData ? `${stats.totalItems} items ka snapshot banega` : 'Pehle Tally se items import karein'}
          </p>
        </div>
        <ClipboardCheck size={18} className="text-primary-400 flex-shrink-0" />
      </button>

      {/* In progress */}
      {inProgress.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wide px-1">In Progress</h3>
          {inProgress.map(s => (
            <button
              key={s.id}
              onClick={() => navigate(`/count/${s.id}`)}
              className="card w-full text-left border-primary-500/30 hover:bg-dark-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck size={16} className="text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.name}</p>
                  <p className="text-[10px] text-dark-500">Started {formatDateTime(s.startedAt)}</p>
                </div>
                <span className="text-xs font-bold text-primary-400 flex-shrink-0">{s.countedItems}/{s.totalItems}</span>
              </div>
              <div className="mt-2.5 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${s.totalItems ? (s.countedItems / s.totalItems) * 100 : 0}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Closed sessions */}
      {closed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wide px-1">Previous Sessions</h3>
          {closed.map(s => {
            const chip = statusChip(s);
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/count/${s.id}/review`)}
                className="card w-full text-left flex items-center gap-3 hover:bg-dark-700/50 transition-colors !py-3"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.status === 'cancelled' ? 'bg-dark-700' : 'bg-dark-700/70'}`}>
                  <chip.icon size={15} className={s.status === 'cancelled' ? 'text-dark-500' : chip.cls.split(' ')[1]} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{s.name}</p>
                  <p className="text-[10px] text-dark-500">{formatDateTime(s.completedAt || s.startedAt)}</p>
                </div>
                <span className={`text-[9px] font-medium px-2 py-1 rounded-full flex-shrink-0 ${s.status === 'cancelled' ? 'bg-dark-700 text-dark-500' : chip.cls}`}>
                  {chip.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="card text-center py-10 space-y-2">
          <ClipboardCheck size={26} className="mx-auto text-dark-500" />
          <p className="text-sm text-dark-300">Abhi tak koi count session nahi hua</p>
          <p className="text-xs text-dark-500">Physical stock verification shuru karne ke liye New Count Session dabayein</p>
        </div>
      )}
    </motion.div>
  );
}
