import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, Boxes, ScanSearch, Upload, ArrowRight,
  AlertTriangle, CheckCircle2, ClipboardCheck, Search,
} from 'lucide-react';
import { useStats, useSessions } from '@/hooks/useStock';
import { sessionService } from '@/database/db';
import { formatCurrency, formatQty, formatDateTime } from '@/utils/dateUtils';

export function Home() {
  const navigate = useNavigate();
  const stats = useStats();
  const sessions = useSessions();

  const completed = sessions.filter(s => s.status === 'completed').slice(0, 3);

  const startCount = async () => {
    if (!stats.hasData) return;
    const id = await sessionService.create();
    navigate(`/count/${id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 py-4 pb-6 max-w-3xl"
    >
      {/* ===== HERO: Physical Stock Verification ===== */}
      <button
        onClick={() => navigate('/verify')}
        className="w-full card !p-5 border-primary-500/40 bg-gradient-to-br from-primary-500/15 via-primary-500/5 to-transparent hover:from-primary-500/25 transition-all text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 flex-shrink-0">
            <ScanSearch size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white">Physical Stock Verification</p>
            <p className="text-xs text-dark-400 mt-0.5">
              Batch / code / location se Tally stock search karein
            </p>
          </div>
          <ArrowRight size={20} className="text-primary-400 flex-shrink-0" />
        </div>
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-dark-700/60">
          <div className="flex items-center gap-1.5 text-[10px] text-dark-400">
            <Search size={11} className="text-primary-400" />
            Code daalo → batch wise locations
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-dark-400">
            <Boxes size={11} className="text-blue-400" />
            Location daalo → saare codes
          </div>
        </div>
      </button>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-dark-400">
            <Package size={16} className="text-primary-400" />
            <span className="text-xs">Stock Items</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalItems}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-dark-400">
            <Boxes size={16} className="text-blue-400" />
            <span className="text-xs">Total Qty</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatQty(stats.totalQty)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-dark-400">
            <span className="text-xs font-medium">Stock Value</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalValue > 0 ? formatCurrency(stats.totalValue) : '—'}</p>
          <p className="text-[10px] text-dark-500">rate set items only</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-dark-400">
            <ScanSearch size={16} className="text-orange-400" />
            <span className="text-xs">Never Counted</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.neverCounted}</p>
        </div>
      </div>

      {/* Active session */}
      {stats.activeSession && (
        <button
          onClick={() => navigate(`/count/${stats.activeSession!.id}`)}
          className="card w-full text-left border-primary-500/30 bg-primary-500/5 hover:bg-primary-500/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <ClipboardCheck size={22} className="text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{stats.activeSession.name}</p>
              <p className="text-xs text-dark-400">Counting in progress — {stats.activeSession.countedItems}/{stats.activeSession.totalItems} counted</p>
              <div className="mt-2 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${stats.activeSession.totalItems ? (stats.activeSession.countedItems / stats.activeSession.totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>
            <ArrowRight size={18} className="text-primary-400 flex-shrink-0" />
          </div>
        </button>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={startCount}
          disabled={!stats.hasData}
          className="card flex flex-col items-center gap-2 py-5 hover:bg-dark-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="w-11 h-11 bg-primary-500/15 rounded-xl flex items-center justify-center">
            <ClipboardCheck size={22} className="text-primary-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">Start Count</p>
            <p className="text-[10px] text-dark-400">Naya count session</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/import')}
          className="card flex flex-col items-center gap-2 py-5 hover:bg-dark-700/50 transition-colors"
        >
          <div className="w-11 h-11 bg-blue-500/15 rounded-xl flex items-center justify-center">
            <Upload size={22} className="text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">Daily Tally Import</p>
            <p className="text-[10px] text-dark-400">Report / Drive file</p>
          </div>
        </button>
      </div>

      {/* Last Tally import */}
      {stats.lastImport && (
        <div className="card flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Upload size={16} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-dark-400">Last Tally import</p>
            <p className="text-sm text-white truncate">{stats.lastImport.fileName}</p>
            <p className="text-[10px] text-dark-500">
              {formatDateTime(stats.lastImport.importedAt)} · {stats.lastImport.itemCount} items · {stats.lastImport.mode}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!stats.hasData && (
        <div className="card text-center py-8 space-y-3">
          <div className="w-14 h-14 mx-auto bg-primary-500/10 rounded-2xl flex items-center justify-center">
            <Upload size={26} className="text-primary-400" />
          </div>
          <p className="text-sm font-semibold text-white">Shuru karein: Tally se stock import</p>
          <p className="text-xs text-dark-400 max-w-xs mx-auto">
            Laptop se Tally Stock Summary export karein (Excel ya CSV), phir yahan import karein.
            Uske baad physical verification search kaam karegi.
          </p>
          <button onClick={() => navigate('/import')} className="btn-primary text-sm mt-2">
            Import from Tally
          </button>
        </div>
      )}

      {/* Recent completed sessions */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wide px-1">Recent Sessions</h3>
          {completed.map(s => (
            <button
              key={s.id}
              onClick={() => navigate(`/count/${s.id}/review`)}
              className="card w-full text-left flex items-center gap-3 hover:bg-dark-700/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-dark-700">
                {s.shortageItems > 0 ? (
                  <AlertTriangle size={16} className="text-orange-400" />
                ) : (
                  <CheckCircle2 size={16} className="text-primary-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{s.name}</p>
                <p className="text-[10px] text-dark-500">
                  {formatDateTime(s.completedAt || s.startedAt)} · {s.countedItems}/{s.totalItems} counted
                  {s.shortageItems > 0 ? ` · ${s.shortageItems} shortage` : ''}
                  {s.excessItems > 0 ? ` · ${s.excessItems} excess` : ''}
                  {s.shortageItems === 0 && s.excessItems === 0 ? ' · all matched' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
