import { googleDriveService, DriveAuthError } from './googleDrive';

// ============================================================
// Google Drive master-inventory import helpers
//
// The app's OAuth scope is drive.file - it can only see files the
// app created (backups) plus files the user explicitly picked via
// the Google Picker. So the "master inventory" file on the user's
// Drive must be selected once through the Picker; afterwards the
// file ID is remembered and can be re-imported with one tap.
// ============================================================

const MASTER_FILE_KEY = 'stockverify_master_file';

export interface DriveSourceFile {
  id: string;
  name: string;
  savedAt: string;
}

export function getSavedMasterFile(): DriveSourceFile | null {
  try {
    const raw = localStorage.getItem(MASTER_FILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id && parsed?.name) return parsed as DriveSourceFile;
    return null;
  } catch {
    return null;
  }
}

export function saveMasterFile(id: string, name: string): void {
  localStorage.setItem(MASTER_FILE_KEY, JSON.stringify({ id, name, savedAt: new Date().toISOString() }));
}

export function clearMasterFile(): void {
  localStorage.removeItem(MASTER_FILE_KEY);
}

// ---------- Google Picker ----------

function loadPickerScript(): Promise<boolean> {
  const w = window as any;
  if (w.google?.picker) return Promise.resolve(true);
  return new Promise((resolve) => {
    const id = 'picker-jsapi-script';
    if (document.getElementById(id)) {
      const start = Date.now();
      const timer = setInterval(() => {
        if ((window as any).google?.picker) { clearInterval(timer); resolve(true); }
        else if (Date.now() - start > 8000) { clearInterval(timer); resolve(false); }
      }, 100);
      return;
    }
    const s = document.createElement('script');
    s.id = id;
    s.src = 'https://docs.google.com/picker/jsapi.js';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export interface PickedFile {
  id: string;
  name: string;
}

const PICKER_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls (Tally exports often carry this mime)
  'text/csv',
  'application/vnd.google-apps.spreadsheet', // native Google Sheet
].join(',');

/**
 * Opens the Google Drive Picker (spreadsheet/csv files only).
 * Resolves with the picked file, or null if the user cancelled.
 * Throws DriveAuthError if the Google session needs manual reconnect.
 */
export async function pickDriveFile(): Promise<PickedFile | null> {
  const token = await googleDriveService.getToken();
  const loaded = await loadPickerScript();
  if (!loaded) throw new Error('Google Picker load nahi hua. Internet check karke dobara try karein.');
  const google = (window as any).google;

  return new Promise((resolve, reject) => {
    try {
      const view = new google.picker.View(google.picker.ViewId.DOCS);
      view.setMimeTypes(PICKER_MIME_TYPES);
      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setOrigin(window.location.origin)
        .setCallback((data: any) => {
          const action = data?.action;
          if (action === google.picker.Action.PICKED) {
            const doc = data.docs?.[0];
            if (doc?.id) resolve({ id: doc.id, name: doc.name || 'Drive file' });
            else resolve(null);
          } else if (action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (e: any) {
      reject(new Error(e?.message || 'Drive Picker open nahi hua'));
    }
  });
}

/** Download a Drive file (by id) as a File object ready for the tally parser */
export async function fetchDriveFileAsFile(fileId: string, name: string): Promise<File> {
  const { blob } = await googleDriveService.downloadFileById(fileId);
  return new File([blob], name, { type: blob.type || 'application/octet-stream' });
}

export { DriveAuthError };
