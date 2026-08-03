import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { repairService, getStoredExcelInfo } from '@/database/db';

interface BackupContextType {
  isGoogleConnected: boolean;
  lastSyncTime: string | null;
  isSyncing: boolean;
  excelFile: { name: string; generatedAt: string } | null;
  connectGoogle: () => Promise<{ success: boolean; error?: string }>;
  disconnectGoogle: () => Promise<void>;
  backupNow: () => Promise<boolean>;
  restoreFromBackup: () => Promise<{ success: boolean; added?: number; skipped?: number }>;
  downloadExcelFile: () => Promise<void>;
  downloadCSVFile: () => Promise<void>;
  downloadJSONFile: () => Promise<void>;
  importFromJSON: (file: File) => Promise<boolean>;
}

const BackupContext = createContext<BackupContextType | null>(null);

export function BackupProvider({ children }: { children: ReactNode }) {
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(localStorage.getItem('fixiprofit_last_sync'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [excelFile, setExcelFile] = useState<{ name: string; generatedAt: string } | null>(null);
  const connectedRef = useRef(false);

  const loadExcelInfo = useCallback(async () => {
    const info = await getStoredExcelInfo();
    if (info) setExcelFile(info);
  }, []);

  // Check connection on mount
  useEffect(() => {
    loadExcelInfo();
    import('@/utils/googleDrive').then(({ googleDriveService }) => {
      const connected = googleDriveService.isConnected();
      setIsGoogleConnected(connected);
      connectedRef.current = connected;
    });
  }, [loadExcelInfo]);

  const backupNow = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const { googleDriveService } = await import('@/utils/googleDrive');
      const { generateExcel, generateCSV, generateJSON } = await import('@/utils/excelExport');
      const repairs = await repairService.exportAll();
      const excelBlob = await generateExcel(repairs);
      const jsonData = generateJSON(repairs);
      const csvData = generateCSV(repairs);

      // Ensure connected (tries silent refresh)
      await googleDriveService.ensureConnected();

      if (googleDriveService.isConnected()) {
        const success = await googleDriveService.uploadBackupFiles(excelBlob, jsonData, csvData);
        if (success) {
          const now = new Date().toISOString();
          setLastSyncTime(now);
          localStorage.setItem('fixiprofit_last_sync', now);
          setIsGoogleConnected(true);
          connectedRef.current = true;
        }
        return success;
      }
      return false;
    } catch { return false; }
    finally { setIsSyncing(false); }
  }, []);

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

  const restoreFromBackup = useCallback(async (): Promise<{ success: boolean; added?: number; skipped?: number }> => {
    setIsSyncing(true);
    try {
      const { googleDriveService } = await import('@/utils/googleDrive');
      await googleDriveService.ensureConnected();
      if (googleDriveService.isConnected()) {
        const str = await googleDriveService.downloadJSONBackup();
        if (str) {
          const data = JSON.parse(str);
          if (data.repairs) {
            const result = await repairService.importAll(data.repairs);
            return { success: true, added: result.added, skipped: result.skipped };
          }
        }
      }
      return { success: false };
    } catch { return { success: false }; }
    finally { setIsSyncing(false); }
  }, []);

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
