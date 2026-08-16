import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { repairService, getStoredExcelInfo } from '@/database/db';

interface BackupResult {
  success: boolean;
  error?: string;
}

interface BackupContextType {
  isGoogleConnected: boolean;
  lastSyncTime: string | null;
  isSyncing: boolean;
  excelFile: { name: string; generatedAt: string } | null;
  connectGoogle: () => Promise<{ success: boolean; error?: string }>;
  disconnectGoogle: () => Promise<void>;
  backupNow: () => Promise<BackupResult>;
  restoreFromBackup: () => Promise<{ success: boolean; added?: number; skipped?: number; error?: string }>;
  downloadExcelFile: () => Promise<void>;
  downloadCSVFile: () => Promise<void>;
  downloadJSONFile: () => Promise<void>;
  importFromJSON: (file: File) => Promise<boolean>;
}

const BackupContext = createContext<BackupContextType | null>(null);

const AUTH_ERROR_MSG = 'Google session expire ho gaya. Neeche se dobara Connect karein.';
const NETWORK_ERROR_MSG = 'Upload fail hua. Internet check karke dobara try karein.';

export function BackupProvider({ children }: { children: ReactNode }) {
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(localStorage.getItem('fixiprofit_last_sync'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [excelFile, setExcelFile] = useState<{ name: string; generatedAt: string } | null>(null);
  const connectedRef = useRef(false);

  const markDisconnected = useCallback(() => {
    setIsGoogleConnected(false);
    connectedRef.current = false;
  }, []);

  const loadExcelInfo = useCallback(async () => {
    const info = await getStoredExcelInfo();
    if (info) setExcelFile(info);
  }, []);

  // On mount: don't just trust the stored token - validate it with Google and
  // silently refresh if expired, so the ON/OFF status is always honest.
  useEffect(() => {
    loadExcelInfo();
    import('@/utils/googleDrive').then(async ({ googleDriveService }) => {
      let connected = googleDriveService.isConnected();
      if (connected) {
        connected = await googleDriveService.ensureConnected();
      }
      setIsGoogleConnected(connected);
      connectedRef.current = connected;
    });
  }, [loadExcelInfo]);

  const backupNow = useCallback(async (): Promise<BackupResult> => {
    setIsSyncing(true);
    try {
      const { googleDriveService } = await import('@/utils/googleDrive');
      const { generateExcel, generateCSV, generateJSON } = await import('@/utils/excelExport');
      const repairs = await repairService.exportAll();

      // JSON is the real backup - always generate it first.
      // Excel/CSV are extras: if they fail for any reason (e.g. a weird old
      // record), the JSON backup must still go through.
      const jsonData = generateJSON(repairs);
      let excelBlob: Blob | null = null;
      try {
        excelBlob = await generateExcel(repairs);
      } catch (e) {
        console.error('Excel generation failed - JSON backup will still continue:', e);
      }
      let csvData = '';
      try {
        csvData = generateCSV(repairs);
      } catch (e) {
        console.error('CSV generation failed:', e);
      }

      const result = await googleDriveService.uploadBackupFiles(excelBlob, jsonData, csvData);

      if (result === 'auth') {
        markDisconnected();
        return { success: false, error: AUTH_ERROR_MSG };
      }
      if (result === 'error') {
        const detail = googleDriveService.getLastError();
        return { success: false, error: detail ? `${NETWORK_ERROR_MSG} (${detail})` : NETWORK_ERROR_MSG };
      }

      const now = new Date().toISOString();
      setLastSyncTime(now);
      localStorage.setItem('fixiprofit_last_sync', now);
      setIsGoogleConnected(true);
      connectedRef.current = true;
      return { success: true };
    } catch {
      return { success: false, error: 'Backup fail hua. Dobara try karein.' };
    }
    finally { setIsSyncing(false); }
  }, [markDisconnected]);

  // Daily backup at 2 AM
  useEffect(() => {
    if (!isGoogleConnected) return;
    const now = new Date();
    const target = new Date(now);
    target.setHours(2, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1); // Next 2 AM
    const ms = target.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      backupNow();
      const interval = setInterval(() => { if (connectedRef.current) backupNow(); }, 24 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, ms);

    return () => clearTimeout(timeout);
  }, [isGoogleConnected, backupNow]);

  const connectGoogle = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { googleDriveService } = await import('@/utils/googleDrive');
      const result = await googleDriveService.signIn();
      if (result.success) {
        setIsGoogleConnected(true);
        connectedRef.current = true;
      }
      return result;
    } finally { setIsSyncing(false); }
  }, []);

  const disconnectGoogle = useCallback(async () => {
    const { googleDriveService } = await import('@/utils/googleDrive');
    await googleDriveService.signOut();
    setIsGoogleConnected(false);
    connectedRef.current = false;
    setLastSyncTime(null);
    localStorage.removeItem('fixiprofit_last_sync');
  }, []);

  const restoreFromBackup = useCallback(async (): Promise<{ success: boolean; added?: number; skipped?: number; error?: string }> => {
    setIsSyncing(true);
    try {
      const { googleDriveService, DriveAuthError } = await import('@/utils/googleDrive');
      await googleDriveService.ensureConnected();
      if (!googleDriveService.isConnected()) {
        markDisconnected();
        return { success: false, error: AUTH_ERROR_MSG };
      }
      const str = await googleDriveService.downloadJSONBackup().catch((e: unknown) => {
        if (e instanceof DriveAuthError) { markDisconnected(); throw e; }
        throw e;
      });
      if (str) {
        const data = JSON.parse(str);
        if (Array.isArray(data.repairs)) {
          const result = await repairService.importAll(data.repairs);
          return { success: true, added: result.added, skipped: result.skipped };
        }
      }
      return { success: false, error: 'Drive me koi backup file nahi mili.' };
    } catch (e: any) {
      if (e?.name === 'DriveAuthError') {
        markDisconnected();
        return { success: false, error: AUTH_ERROR_MSG };
      }
      return { success: false, error: 'Restore fail hua. Dobara try karein.' };
    }
    finally { setIsSyncing(false); }
  }, [markDisconnected]);

  const downloadExcelFile = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { saveAs } = await import('file-saver');
      const { generateExcelOnDemand } = await import('@/database/db');
      const result = await generateExcelOnDemand();
      if (result) { saveAs(result.blob, 'FixiProfit.xlsx'); setExcelFile({ name: 'FixiProfit.xlsx', generatedAt: result.generatedAt }); }
    } finally { setIsSyncing(false); }
  }, []);

  const downloadCSVFile = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { saveAs } = await import('file-saver');
      const { generateCSV } = await import('@/utils/excelExport');
      const repairs = await repairService.exportAll();
      saveAs(new Blob([generateCSV(repairs)], { type: 'text/csv' }), 'FixiProfit.csv');
    } finally { setIsSyncing(false); }
  }, []);

  const downloadJSONFile = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { saveAs } = await import('file-saver');
      const { generateJSON } = await import('@/utils/excelExport');
      const repairs = await repairService.exportAll();
      saveAs(new Blob([generateJSON(repairs)], { type: 'application/json' }), 'FixiProfit.json');
    } finally { setIsSyncing(false); }
  }, []);

  const importFromJSON = useCallback(async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.repairs && Array.isArray(data.repairs)) { await repairService.importAll(data.repairs); return true; }
      return false;
    } catch { return false; }
  }, []);

  return (
    <BackupContext.Provider value={{
      isGoogleConnected, lastSyncTime, isSyncing, excelFile,
      connectGoogle, disconnectGoogle, backupNow, restoreFromBackup,
      downloadExcelFile, downloadCSVFile, downloadJSONFile, importFromJSON,
    }}>
      {children}
    </BackupContext.Provider>
  );
}

export function useBackup() {
  const ctx = useContext(BackupContext);
  if (!ctx) throw new Error('useBackup must be used within BackupProvider');
  return ctx;
}
