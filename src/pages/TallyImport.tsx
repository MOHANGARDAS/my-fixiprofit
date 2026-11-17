import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight,
  RefreshCw, ArrowLeft, Replace, GitMerge, CloudDownload, Cloud,
} from 'lucide-react';
import { parseTallyFile, type ParseResult } from '@/utils/tallyParser';
import { importService } from '@/database/db';
import {
  getSavedMasterFile, saveMasterFile, pickDriveFile, fetchDriveFileAsFile,
  type DriveSourceFile,
} from '@/utils/driveImport';
import { useBackup } from '@/context/BackupContext';
import { formatQty, formatDateTime } from '@/utils/dateUtils';

type Stage = 'upload' | 'preview' | 'done';

export function TallyImport() {
  const navigate = useNavigate();
  const { isGoogleConnected, connectGoogle } = useBackup();
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('upload');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [importError, setImportError] = useState('');
  const [doneInfo, setDoneInfo] = useState<{ itemCount: number; newItems?: number; updatedItems?: number } | null>(null);
  const [showAllPreview, setShowAllPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Google Drive master inventory
  const [savedDriveFile, setSavedDriveFile] = useState<DriveSourceFile | null>(getSavedMasterFile());
  const [driveBusy, setDriveBusy] = useState<null | 'picker' | 'download'>(null);
  const [driveError, setDriveError] = useState('');

  const handleFile = async (f: File) => {
    setFile(f);
    setParsing(true);
    setImportError('');
    setShowAllPreview(false);
    try {
      const res = await parseTallyFile(f);
      setResult(res);
      setStage('preview');
    } catch (e: any) {
      setImportError(e?.message || 'File parse nahi ho saki.');
      setStage('upload');
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  // ---------- Google Drive import ----------
  const importFromDrive = async (pickNew: boolean) => {
    setDriveError('');
    let src: DriveSourceFile | null = pickNew ? null : getSavedMasterFile();

    if (!src) {
      setDriveBusy('picker');
      try {
        if (!isGoogleConnected) {
          const c = await connectGoogle();
          if (!c.success) {
            setDriveError(c.error || 'Google connect nahi hua');
            setDriveBusy(null);
            return;
          }
        }
        const picked = await pickDriveFile();
        if (!picked) { setDriveBusy(null); return; } // user cancelled
        src = { id: picked.id, name: picked.name, savedAt: new Date().toISOString() };
      } catch (e: any) {
        setDriveError(
          e?.name === 'DriveAuthError'
            ? 'Google session expire ho gaya - Settings me dobara Connect karein.'
            : e?.message || 'Drive Picker open nahi hua'
        );
        setDriveBusy(null);
        return;
      }
    }

    setDriveBusy('download');
    try {
      const driveFile = await fetchDriveFileAsFile(src.id, src.name);
      saveMasterFile(src.id, src.name);
      setSavedDriveFile({ ...src });
      setDriveBusy(null);
      await handleFile(driveFile);
    } catch (e: any) {
      setDriveError(e?.message || 'Drive se file download nahi hui. "Change File" se dobara select karein.');
      setDriveBusy(null);
    }
  };

  const runImport = async () => {
    if (!result || !file) return;
    setImporting(true);
    setImportError('');
    try {
      if (mode === 'replace') {
        const r = await importService.replaceAll(result.items, file.name);
        setDoneInfo(r);
      } else {
        const r = await importService.merge(result.items, file.name);
        setDoneInfo(r);
      }
      setStage('done');
    } catch (e: any) {
      setImportError(e?.message || 'Import fail hua.');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStage('upload');
    setFile(null);
    setResult(null);
    setDoneInfo(null);
    setImportError('');
    setShowAllPreview(false);
  };

  const previewItems = result ? (showAllPreview ? result.items : result.items.slice(0, 20)) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 py-4 pb-6 max-w-3xl"
    >
      <button onClick={() => navigate('/')} className="flex items-center gap-1 text-xs text-dark-400 hover:text-white">
        <ArrowLeft size={14} /> Home
      </button>

      {/* ===== Upload stage ===== */}
      {stage === 'upload' && (
        <>
          {/* Google Drive master inventory */}
          <div className="card space-y-3 border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <CloudDownload size={20} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">Google Drive se Master Inventory</h3>
                <p className="text-xs text-dark-400">Drive me rakhi stock file seedha import karein</p>
              </div>
              {isGoogleConnected && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-green-400 font-medium">ON</span>
                </div>
              )}
            </div>

            {savedDriveFile && (
              <div className="flex items-center gap-2 p-3 bg-dark-800 rounded-xl border border-dark-700">
                <FileSpreadsheet size={16} className="text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-dark-200 truncate">{savedDriveFile.name}</p>
                  <p className="text-[9px] text-dark-500">Saved · {formatDateTime(savedDriveFile.savedAt)}</p>
                </div>
              </div>
            )}

            {!savedDriveFile && (
              <p className="text-[11px] text-dark-400">
                Google Drive picker khulega - apni master inventory file (Excel/CSV) select karein.
                Ek baar select karne par app file ko yaad rakhta hai, fir ek tap me re-import hota hai.
              </p>
            )}

            {driveError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                <AlertTriangle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-red-400">{driveError}</p>
              </div>
            )}

            <button
              onClick={() => importFromDrive(!!savedDriveFile ? false : true)}
              disabled={driveBusy !== null || parsing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {driveBusy === 'picker' ? (
                <><RefreshCw size={15} className="animate-spin" /> Drive picker khul raha hai...</>
              ) : driveBusy === 'download' ? (
                <><RefreshCw size={15} className="animate-spin" /> Drive se download ho rahi hai...</>
              ) : savedDriveFile ? (
                <><CloudDownload size={15} /> Import from Drive</>
              ) : (
                <><Cloud size={15} /> Choose File from Drive</>
              )}
            </button>

            {savedDriveFile && (
              <button
                onClick={() => importFromDrive(true)}
                disabled={driveBusy !== null || parsing}
                className="w-full text-[11px] text-dark-400 hover:text-white py-1"
              >
                Change File...
              </button>
            )}
          </div>

          {/* Manual upload */}
          <div className="card space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-dark-700 rounded-xl flex items-center justify-center">
                <FileSpreadsheet size={20} className="text-dark-300" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Ya File Upload Karein</h3>
                <p className="text-xs text-dark-400">Tally Stock Summary export (Excel / CSV)</p>
              </div>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInput.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary-500 bg-primary-500/5' : 'border-dark-600 hover:border-dark-500'}`}
            >
              {parsing ? (
                <RefreshCw size={28} className="mx-auto text-primary-400 animate-spin" />
              ) : (
                <Upload size={28} className="mx-auto text-dark-500" />
              )}
              <p className="text-sm text-dark-300 mt-3">
                {parsing ? 'Parsing file...' : 'Tap to choose file ya drag & drop'}
              </p>
              <p className="text-[10px] text-dark-500 mt-1">.xlsx, .xls, .csv</p>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />

            {importError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-400">{importError}</p>
              </div>
            )}
          </div>

          <div className="card space-y-2">
            <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Tally me export kaise karein</h3>
            <ol className="text-xs text-dark-400 space-y-1.5 list-decimal list-inside">
              <li>Tally me <span className="text-dark-200">Stock Summary</span> open karein</li>
              <li>Period set karein (jahan tak closing balance chahiye)</li>
              <li><span className="text-dark-200">Alt+E</span> (Export) dabayein → format <span className="text-dark-200">Excel</span> ya <span className="text-dark-200">CSV</span> select karein</li>
              <li>File yahan import karein — columns auto-detect ho jayenge</li>
            </ol>
            <p className="text-[10px] text-dark-500 pt-1">
              Tip: Item name + Quantity columns sabse zaroori hain. Rate/Value optional hain (stock value ke liye).
            </p>
          </div>
        </>
      )}

      {/* ===== Preview stage ===== */}
      {stage === 'preview' && result && (
        <>
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{file?.name}</p>
                <p className="text-xs text-primary-400 font-medium">
                  {result.items.length} items parse hue
                  {result.headerRow < 0 ? ' (auto-detect)' : ' (header mila)'}
                </p>
              </div>
              <button onClick={reset} className="btn-secondary text-xs py-2 px-3">Change File</button>
            </div>

            {result.warnings.length > 0 && (
              <div className="space-y-1.5">
                {result.warnings.map((w, i) => (
                  <div key={i} className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={12} className="text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-orange-400">{w}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-dark-900/60 border border-dark-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-dark-800 text-dark-400">
                      <th className="text-left px-3 py-2 font-medium">Item</th>
                      <th className="text-right px-3 py-2 font-medium">Qty</th>
                      <th className="text-left px-3 py-2 font-medium">Unit</th>
                      <th className="text-right px-3 py-2 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((p, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-dark-900/40' : ''}>
                        <td className="px-3 py-1.5 text-dark-200 max-w-[220px] truncate">{p.name}</td>
                        <td className="px-3 py-1.5 text-right text-white font-medium">{formatQty(p.qty)}</td>
                        <td className="px-3 py-1.5 text-dark-400">{p.unit || '—'}</td>
                        <td className="px-3 py-1.5 text-right text-dark-400">{p.rate != null ? `₹${p.rate}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.items.length > 20 && (
                <button
                  onClick={() => setShowAllPreview(!showAllPreview)}
                  className="w-full text-[11px] text-primary-400 py-2 hover:bg-dark-800"
                >
                  {showAllPreview ? 'Show less' : `+${result.items.length - 20} more — show all`}
                </button>
              )}
            </div>
          </div>

          {/* Import mode */}
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-white">Import Mode</h3>
            <button
              onClick={() => setMode('replace')}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${mode === 'replace' ? 'border-primary-500/40 bg-primary-500/5' : 'border-dark-600 hover:bg-dark-700/40'}`}
            >
              <Replace size={18} className={mode === 'replace' ? 'text-primary-400 mt-0.5' : 'text-dark-500 mt-0.5'} />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Replace All <span className="text-[10px] text-primary-400">(recommended for first import)</span></p>
                <p className="text-[10px] text-dark-400 mt-0.5">Purani item list delete hogi, Tally ki fresh list aayegi. Physical count history reset ho jayegi.</p>
              </div>
              {mode === 'replace' && <CheckCircle2 size={16} className="text-primary-400" />}
            </button>
            <button
              onClick={() => setMode('merge')}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${mode === 'merge' ? 'border-primary-500/40 bg-primary-500/5' : 'border-dark-600 hover:bg-dark-700/40'}`}
            >
              <GitMerge size={18} className={mode === 'merge' ? 'text-primary-400 mt-0.5' : 'text-dark-500 mt-0.5'} />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Merge with Existing</p>
                <p className="text-[10px] text-dark-400 mt-0.5">Matching items ki qty Tally se refresh hogi, naye items add honge. Baaki data (adjustments log, sessions) safe rahega.</p>
              </div>
              {mode === 'merge' && <CheckCircle2 size={16} className="text-primary-400" />}
            </button>

            {mode === 'merge' && (
              <p className="text-[10px] text-orange-400 bg-orange-500/5 border border-orange-500/20 rounded-lg p-2">
                Note: Merge mode me matched items ki system qty seedha Tally qty ho jayegi. Agar Tally me recent
                adjustments post kar diye hain to yeh sahi hai — warna app ke adjustments overwrite ho sakte hain.
              </p>
            )}

            {importError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-400">{importError}</p>
              </div>
            )}

            <button onClick={runImport} disabled={importing} className="btn-primary w-full text-sm">
              {importing ? 'Importing...' : `Import ${result.items.length} Items`}
            </button>
          </div>
        </>
      )}

      {/* ===== Done stage ===== */}
      {stage === 'done' && doneInfo && (
        <div className="card text-center py-10 space-y-4">
          <div className="w-14 h-14 mx-auto bg-primary-500/10 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={30} className="text-primary-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">Import Complete!</p>
            <p className="text-xs text-dark-400 mt-1">
              {doneInfo.itemCount} items imported
              {doneInfo.newItems != null && ` · ${doneInfo.newItems} new`}
              {doneInfo.updatedItems != null && ` · ${doneInfo.updatedItems} updated`}
            </p>
            <p className="text-[10px] text-dark-500">{formatDateTime(new Date().toISOString())}</p>
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <button onClick={() => navigate('/items')} className="btn-primary text-sm">
              View Stock <ArrowRight size={14} className="inline ml-1 -mt-0.5" />
            </button>
            <button onClick={reset} className="btn-secondary text-sm">Import Another</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
