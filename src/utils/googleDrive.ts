// Google Drive Backup Service - Simple, WhatsApp-style
// NOTE: Google access tokens expire after ~1 hour. Every Drive call goes
// through apiCall() which auto-recovers from 401 (expired token) by silently
// refreshing the token once and retrying the request.
const DEFAULT_CLIENT_ID = '60102706527-qmh7shod0emgocefv6nb6uga8vpp90n9.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const APP_FOLDER_NAME = 'FixiProfit_Backup';
const TOKEN_KEY = 'fixiprofit_google_token';
const TOKEN_EXPIRY_KEY = 'fixiprofit_google_token_expiry';

let tokenClient: any = null;
let accessToken: string | null = null;
let appFolderId: string | null = null;
let gisLoaded = false;
// Last Drive API failure detail (HTTP status etc.) - surfaced in UI for debugging
let lastDriveError: string | null = null;

// Thrown when the Google session is expired and silent refresh could not
// recover it - user must tap "Connect Google Drive" again.
export class DriveAuthError extends Error {
  constructor() {
    super('Google Drive session expired');
    this.name = 'DriveAuthError';
  }
}

export type UploadResult = 'ok' | 'auth' | 'error';

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
}

function clearToken(): void {
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

async function loadGIS(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).google?.accounts?.oauth2) { gisLoaded = true; return true; }
  return new Promise((resolve) => {
    const id = 'gis-script';
    if (document.getElementById(id)) {
      // Script tag already injected but may still be loading - wait for it
      const start = Date.now();
      const timer = setInterval(() => {
        if ((window as any).google?.accounts?.oauth2) {
          clearInterval(timer);
          gisLoaded = true;
          resolve(true);
        } else if (Date.now() - start > 5000) {
          clearInterval(timer);
          resolve(false);
        }
      }, 100);
      return;
    }
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
  if (!google?.accounts?.oauth2) return false;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 15000); // Safety timeout
    const done = (ok: boolean) => { clearTimeout(timer); resolve(ok); };
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: DEFAULT_CLIENT_ID,
        scope: SCOPES,
        callback: (resp: any) => {
          if (resp?.access_token) { saveToken(resp.access_token); done(true); }
          else { done(false); }
        },
        error_callback: () => done(false),
      });
      client.requestAccessToken({ prompt: '' }); // Silent - no popup
    } catch { done(false); }
  });
}

if (typeof window !== 'undefined') restoreToken();

function rawCall(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...options.headers } });
}

// Drive API call with automatic expired-token recovery:
// 401 -> drop stale token -> silent refresh -> retry once.
async function apiCall(url: string, options: RequestInit = {}, allowRetry = true): Promise<Response> {
  let res = await rawCall(url, options);
  if (res.status !== 401 || !allowRetry) return res;

  clearToken();
  const refreshed = await trySilentRefresh();
  if (!refreshed) throw new DriveAuthError();

  const retryBody = options.body; // Blob bodies are safe to reuse
  res = await rawCall(url, { ...options, body: retryBody });
  if (res.status === 401) { clearToken(); throw new DriveAuthError(); }
  return res;
}

// Cheap call to check whether the current token is still accepted by Google.
// Network failure (offline) is treated as "valid" so the UI doesn't flip to
// disconnected just because the phone has no internet.
async function isTokenValid(): Promise<boolean> {
  if (!accessToken) return false;
  try {
    const res = await rawCall('https://www.googleapis.com/drive/v3/about?fields=user');
    return res.status !== 401;
  } catch {
    return true; // Offline - assume token is fine
  }
}

async function getOrCreateFolder(): Promise<string> {
  if (appFolderId) return appFolderId;
  const res = await apiCall(`https://www.googleapis.com/drive/v3/files?q=name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`);
  if (res.ok) {
    const data = await res.json();
    if (data.files?.length > 0) { appFolderId = data.files[0].id as string; return appFolderId; }
  } else {
    lastDriveError = `Folder search HTTP ${res.status}`;
  }
  const create = await apiCall('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: APP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }) });
  if (!create.ok) {
    lastDriveError = `Folder create HTTP ${create.status}`;
    throw new Error('Backup folder create nahi ho saki');
  }
  const fd = await create.json();
  appFolderId = fd.id as string;
  return appFolderId;
}

async function uploadFile(name: string, mime: string, content: Blob | string): Promise<boolean> {
  if (!accessToken) throw new DriveAuthError();
  const folderId = await getOrCreateFolder();
  const search = await apiCall(`https://www.googleapis.com/drive/v3/files?q=name='${name}' and '${folderId}' in parents and trashed=false&fields=files(id,name)`);
  if (!search.ok) { lastDriveError = `File search HTTP ${search.status}`; return false; }
  const sd = await search.json();
  const existing = sd.files?.[0];
  const body = content instanceof Blob ? content : new Blob([content], { type: mime });
  if (existing) {
    const r = await apiCall(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': mime }, body });
    if (!r.ok) lastDriveError = `Upload (update) HTTP ${r.status}`;
    return r.ok;
  }
  const metadata = { name, parents: [folderId] };
  const boundary = '----FP' + Date.now();
  const prefix = new Blob([`--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`]);
  const suffix = new Blob([`\r\n--${boundary}--`]);
  const r = await apiCall('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: new Blob([prefix, body, suffix]) });
  if (!r.ok) { lastDriveError = `Upload (create) HTTP ${r.status}`; }
  return r.ok;
}

async function downloadFile(name: string): Promise<string | null> {
  if (!accessToken) throw new DriveAuthError();
  const folderId = await getOrCreateFolder();
  const search = await apiCall(`https://www.googleapis.com/drive/v3/files?q=name='${name}' and '${folderId}' in parents and trashed=false&fields=files(id,name)`);
  if (!search.ok) return null;
  const sd = await search.json();
  const file = sd.files?.[0];
  if (!file) return null;
  const r = await apiCall(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
  return r.ok ? await r.text() : null;
}

export const googleDriveService = {
  isConnected(): boolean {
    return !!accessToken;
  },

  async signIn(): Promise<{ success: boolean; error?: string }> {
    if (!await loadGIS()) return { success: false, error: 'Google load nahi hui' };
    return new Promise((resolve) => {
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) { resolve({ success: false, error: 'Unavailable' }); return; }
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

  // Validates the stored token with Google; if it expired (tokens last ~1h),
  // silently refreshes it. Returns false only when a manual reconnect is needed.
  async ensureConnected(): Promise<boolean> {
    if (accessToken) {
      if (await isTokenValid()) return true;
      clearToken();
    }
    return trySilentRefresh();
  },

  async uploadBackupFiles(excelBlob: Blob | null, jsonData: string, csvData: string): Promise<UploadResult> {
    lastDriveError = null;
    // Refresh first if there is no usable token
    if (!accessToken) {
      const ok = await trySilentRefresh();
      if (!ok) return 'auth';
    }
    try {
      // JSON is the REAL backup (restore uses it) - it must upload.
      // Excel/CSV are human-readable extras: uploaded best-effort, they must
      // never block or fail the actual data backup.
      const uploads: Promise<boolean>[] = [
        uploadFile('FixiProfit_Latest.json', 'application/json', jsonData),
      ];
      if (excelBlob) {
        uploads.push(uploadFile('FixiProfit_Latest.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', excelBlob).catch(() => false));
      }
      uploads.push(uploadFile('FixiProfit_Latest.csv', 'text/csv', csvData).catch(() => false));
      const results = await Promise.all(uploads);
      if (results[0]) return 'ok';
      if (!lastDriveError) lastDriveError = 'JSON upload fail';
      return 'error';
    } catch (e) {
      if (e instanceof DriveAuthError) return 'auth';
      lastDriveError = lastDriveError || (e instanceof Error ? e.message : 'Network error');
      return 'error';
    }
  },

  // Short detail of the last failed Drive call (for the UI error message)
  getLastError(): string | null {
    return lastDriveError;
  },

  async downloadJSONBackup(): Promise<string | null> {
    if (!accessToken) {
      const ok = await trySilentRefresh();
      if (!ok) throw new DriveAuthError();
    }
    return downloadFile('FixiProfit_Latest.json');
  },
};
