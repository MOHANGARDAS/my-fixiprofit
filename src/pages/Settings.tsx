import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud, Shield, Download, Upload, Trash2,
  AlertTriangle, FileSpreadsheet, FileText, FileJson,
  CheckCircle, XCircle, RefreshCw, CloudOff
} from 'lucide-react';
import { useBackup } from '@/context/BackupContext';

export function Settings() {
  const {
    isGoogleConnected,
    lastSyncTime,
    isSyncing,
    excelFile,
    connectGoogle,
    disconnectGoogle,
    backupNow,
    restoreFromBackup,
    downloadExcelFile,
    downloadCSVFile,
    downloadJSONFile,
    importFromJSON,
  } = useBackup();

  const [clearStep, setClearStep] = useState<0 | 1 | 2 | 3>(0);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Connection status is managed by BackupContext - no need for separate check

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    const result = await connectGoogle();
    setIsConnecting(false);
    showStatus(result.success ? 'success' : 'error', result.success ? 'Connected!' : result.error || 'Failed');
  };

  const handleBackup = async () => {
    showStatus('info', 'Backing up...');
    const result = await backupNow();
    showStatus(result.success ? 'success' : 'error', result.success ? 'Backup done!' : result.error || 'Backup failed');
  };

  const handleRestore = async () => {
    showStatus('info', 'Restoring...');
    const result = await restoreFromBackup();
    if (result.success) {
      showStatus('success', `Added: ${result.added || 0} | Skipped duplicates: ${result.skipped || 0}`);
    } else {
      showStatus('error', result.error || 'No backup found');
    }
  };

  const doDownload = async (type: 'excel' | 'csv' | 'json') => {
    setIsExporting(type);
    try {
      if (type === 'excel') await downloadExcelFile();
      else if (type === 'csv') await downloadCSVFile();
      else await downloadJSONFile();
      showStatus('success', 'Downloaded!');
    } catch { showStatus('error', 'Failed'); }
    setIsExporting(null);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showStatus('info', 'Importing...');
    const ok = await importFromJSON(file);
    showStatus(ok ? 'success' : 'error', ok ? 'Imported!' : 'Invalid file');
    e.target.value = '';
  };

  const handleClearAll = async () => {
    const { db } = await import('@/database/db');
    await db.repairs.clear();
    setClearStep(0);
    showStatus('success', 'All data cleared');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 py-4 pb-6 max-w-2xl"
    >
      <AnimatePresence>
        {statusMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${
              statusMsg.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
              statusMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}
          >
            {statusMsg.type === 'success' ? <CheckCircle size={16} /> :
             statusMsg.type === 'error' ? <XCircle size={16} /> :
             <RefreshCw size={16} className="animate-spin" />}
            {statusMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Drive */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <Cloud size={20} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">Google Drive Backup</h3>
            <p className="text-xs text-dark-400">Daily backup at 2 AM</p>
          </div>
          {isGoogleConnected ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-green-400 font-medium">ON</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <CloudOff size={14} className="text-dark-500" />
              <span className="text-[10px] text-dark-500">OFF</span>
            </div>
          )}
        </div>

        {!isGoogleConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all"
          >
            {isConnecting ? <><RefreshCw size={16} className="animate-spin" /> Connecting...</> : <><Cloud size={16} /> Connect Google Drive</>}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-dark-800 rounded-xl border border-dark-700">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-green-400" />
                <span className="text-xs text-dark-300">Connected</span>
              </div>
              <button onClick={disconnectGoogle} className="text-xs text-red-400 px-2 py-1">Disconnect</button>
            </div>

            {lastSyncTime && (
              <p className="text-[10px] text-dark-500 text-center">
                Last backup: {new Date(lastSyncTime).toLocaleString('en-IN')}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleBackup} disabled={isSyncing} className="btn-secondary text-xs py-2.5 flex items-center justify-center gap-1.5">
                <Upload size={14} />{isSyncing ? 'Syncing...' : 'Backup Now'}
              </button>
              <button onClick={handleRestore} disabled={isSyncing} className="btn-secondary text-xs py-2.5 flex items-center justify-center gap-1.5">
                <Download size={14} />{isSyncing ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Downloads */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
            <FileSpreadsheet size={20} className="text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Downloads</h3>
            <p className="text-xs text-dark-400">Excel, CSV, JSON</p>
          </div>
        </div>

        {excelFile && (
          <div className="flex items-center gap-2 p-2.5 bg-dark-800 rounded-xl border border-dark-700">
            <FileSpreadsheet size={12} className="text-green-400" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-dark-300 truncate">{excelFile.name}</p>
              <p className="text-[9px] text-dark-500">{new Date(excelFile.generatedAt).toLocaleString('en-IN')}</p>
            </div>
            <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
          </div>
        )}

        <div className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-2 lg:space-y-0">
          <button onClick={() => doDownload('excel')} disabled={isExporting !== null}
            className="w-full flex items-center gap-2 p-3 bg-green-500/5 border border-green-500/20 rounded-xl hover:bg-green-500/10 transition-colors">
            <FileSpreadsheet size={16} className="text-green-400" />
            <div className="flex-1 text-left">
              <p className="text-xs font-medium text-white">Excel</p>
            </div>
            {isExporting === 'excel' ? <RefreshCw size={14} className="text-green-400 animate-spin" /> : <Download size={14} className="text-green-400" />}
          </button>

          <button onClick={() => doDownload('csv')} disabled={isExporting !== null}
            className="w-full flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl hover:bg-blue-500/10 transition-colors">
            <FileText size={16} className="text-blue-400" />
            <div className="flex-1 text-left">
              <p className="text-xs font-medium text-white">CSV</p>
            </div>
            {isExporting === 'csv' ? <RefreshCw size={14} className="text-blue-400 animate-spin" /> : <Download size={14} className="text-blue-400" />}
          </button>

          <button onClick={() => doDownload('json')} disabled={isExporting !== null}
            className="w-full flex items-center gap-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl hover:bg-purple-500/10 transition-colors">
            <FileJson size={16} className="text-purple-400" />
            <div className="flex-1 text-left">
              <p className="text-xs font-medium text-white">JSON</p>
            </div>
            {isExporting === 'json' ? <RefreshCw size={14} className="text-purple-400 animate-spin" /> : <Download size={14} className="text-purple-400" />}
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
            <Upload size={20} className="text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Import</h3>
            <p className="text-xs text-dark-400">Restore from JSON backup</p>
          </div>
        </div>

        <input ref={jsonInputRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
        <button onClick={() => jsonInputRef.current?.click()}
          className="w-full flex items-center gap-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl hover:bg-orange-500/10 transition-colors">
          <FileJson size={16} className="text-orange-400" />
          <div className="flex-1 text-left">
            <p className="text-xs font-medium text-white">Import from JSON</p>
          </div>
          <Upload size={14} className="text-orange-400" />
        </button>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-500/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
            <p className="text-xs text-dark-400">Clear all data</p>
          </div>
        </div>

        {clearStep === 0 && (
          <button onClick={() => setClearStep(1)}
            className="btn-secondary w-full flex items-center justify-center gap-2 text-red-400 border-red-500/20 text-sm">
            <Trash2 size={16} /> Reset Data
          </button>
        )}

        {clearStep === 1 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2">
            <p className="text-xs text-red-400">This will reset all repair records!</p>
            <div className="flex gap-2">
              <button onClick={() => setClearStep(0)} className="btn-secondary flex-1 text-xs py-2">Cancel</button>
              <button onClick={() => setClearStep(2)} className="btn-danger flex-1 text-xs py-2">Clear Data →</button>
            </div>
          </motion.div>
        )}

        {clearStep === 2 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2">
            <p className="text-xs text-red-400 font-semibold">⚠️ Final Warning!</p>
            <p className="text-[10px] text-dark-400">All repairs will be permanently deleted. This cannot be undone!</p>
            <div className="flex gap-2">
              <button onClick={() => setClearStep(0)} className="btn-secondary flex-1 text-xs py-2">Cancel</button>
              <button onClick={handleClearAll} className="btn-danger flex-1 text-xs py-2">Delete All</button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
