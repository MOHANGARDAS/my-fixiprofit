// Google Drive Backup Service - Simple, WhatsApp-style
const DEFAULT_CLIENT_ID = '60102706527-qmh7shod0emgocefv6nb6uga8vpp90n9.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const APP_FOLDER_NAME = 'FixiProfit_Backup';
const TOKEN_KEY = 'fixiprofit_google_token';
const TOKEN_EXPIRY_KEY = 'fixiprofit_google_token_expiry';

let tokenClient: any = null;
let accessToken: string | null = null;
let appFolderId: string | null = null;
let gisLoaded = false;

// Restore token from storage
function restoreToken(): void {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) {
    accessToken = stored;
  }
}

function saveToken(token: string): void {
  if (typeof window === 'undefined') return;
  accessToken = token;
  localStorage.setItem(TOKEN_KEY, token);
  // Don't store expiry - just keep token until it fails
}

function clearToken(): void {
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

async function loadGIS(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (gisLoaded && (window as any).google) return true;
  return new Promise((resolve) => {
    const id = 'gis-script';
    if (document.getElementById(id)) { gisLoaded = true; resolve(!!(window as any).google); return; }
    const s = document.createElement('script');
    s.id = id; s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => { gisLoaded = true; resolve(true); };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

// Try silent token refresh (no popup)
async function trySilentRefresh(): Promise<boolean> {
  if (!await loadGIS()) return false;
  const google = (window as any).google;
  if (!google) return false;
  return new Promise((resolve) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: DEFAULT_CLIENT_ID,
        scope: SCOPES,
        callback: (resp: any) => {
          if (resp.access_token) { saveToken(resp.access_token); resolve(true); }
          else { resolve(false); }
        },
        error_callback: () => resolve(false),
      });
      client.requestAccessToken({ prompt: '' }); // Silent - no popup
    } catch { resolve(false); }
  });
}

if (typeof window !== 'undefined') restoreToken();

async function apiCall(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...options.headers } });
}

async function getOrCreateFolder(): Promise<string> {
  if (appFolderId) return appFolderId;
  const res = await apiCall(`https://www.googleapis.com/drive/v3/files?q=name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`);
  const data = await res.json();
  if (data.files?.length > 0) { appFolderId = data.files[0].id as string; return appFolderId; }
  const create = await apiCall('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: APP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }) });
  const fd = await create.json();
  appFolderId = fd.id as string;
  return appFolderId;
}

async function uploadFile(name: string, mime: string, content: Blob | string): Promise<boolean> {
  if (!accessToken) return false;
  try {
    const folderId = await getOrCreateFolder();
    const search = await apiCall(`https://www.googleapis.com/drive/v3/files?q=name='${name}' and '${folderId}' in parents and trashed=false&fields=files(id,name)`);
    const sd = await search.json();
    const existing = sd.files?.[0];
    const body = content instanceof Blob ? content : new Blob([content], { type: mime });
    if (existing) {
      const r = await apiCall(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': mime }, body });
      return r.ok;
    }
    const metadata = { name, parents: [folderId] };
    const boundary = '----FP' + Date.now();
    const prefix = new Blob([`--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`]);
    const suffix = new Blob([`\r\n--${boundary}--`]);
    const r = await apiCall('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: new Blob([prefix, body, suffix]) });
    return r.ok;
  } catch { return false; }
}

async function downloadFile(name: string): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const folderId = await getOrCreateFolder();
    const search = await apiCall(`https://www.googleapis.com/drive/v3/files?q=name='${name}' and '${folderId}' in parents and trashed=false&fields=files(id,name)`);
    const sd = await search.json();
    const file = sd.files?.[0];
    if (!file) return null;
    const r = await apiCall(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

export const googleDriveService = {
  isConnected(): boolean {
    return !!accessToken;
  },

  async signIn(): Promise<{ success: boolean; error?: string }> {
    if (!await loadGIS()) return { success: false, error: 'Google load nahi hui' };
    return new Promise((resolve) => {
      const google = (window as any).google;
      if (!google) { resolve({ success: false, error: 'Unavailable' }); return; }
      try {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: DEFAULT_CLIENT_ID,
          scope: SCOPES,
          callback: (resp: any) => {
            if (resp.access_token) { saveToken(resp.access_token); resolve({ success: true }); }
            else if (resp.error) { resolve({ success: false, error: resp.error }); }
            else { resolve({ success: false, error: 'Failed' }); }
          },
          error_callback: (e: any) => resolve({ success: false, error: e?.message || 'Cancelled' }),
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (e: any) { resolve({ success: false, error: e?.message || 'Error' }); }
    });
  },

  async signOut(): Promise<void> {
    if (accessToken) {
      const google = (window as any).google;
      if (google?.accounts?.oauth2) google.accounts.oauth2.revoke(accessToken, () => {});
    }
    clearToken();
    appFolderId = null;
  },

  // Before backup/restore, try silent refresh if token exists
  async ensureConnected(): Promise<boolean> {
    if (accessToken) return true;
    return trySilentRefresh();
  },

  async uploadBackupFiles(excelBlob: Blob, jsonData: string, csvData: string): Promise<boolean> {
    // Try silent refresh first
    if (!accessToken) {
      const ok = await trySilentRefresh();
      if (!ok) return false;
    }
    const results = await Promise.all([
      uploadFile('FixiProfit_Latest.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', excelBlob),
      uploadFile('FixiProfit_Latest.json', 'application/json', jsonData),
      uploadFile('FixiProfit_Latest.csv', 'text/csv', csvData),
    ]);
    return results.some(r => r);
  },

  async downloadJSONBackup(): Promise<string | null> {
    if (!accessToken) await trySilentRefresh();
    return downloadFile('FixiProfit_Latest.json');
  },
};
