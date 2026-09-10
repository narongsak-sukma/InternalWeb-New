import { NewsItem, BannerSlide, DirectoryContact, MeetingRoom, PolicyDocument, SyncLog, AuditLog } from './types';
import {
  INITIAL_NEWS,
  INITIAL_BANNERS,
  INITIAL_ROOMS,
} from './data/initialData';

const BASE_URL = '';

// ---- Auth wire types (contract: .omc/handoffs/team-plan.md) ----

export type Role = 'admin' | 'checker' | 'maker' | 'staff';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  email: string;
}

export interface UploadedFile {
  url: string;
  fileName: string;
  size: number;
}

/** Error thrown on every non-OK API call. `status` is 0 for network-level failures. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ---- Offline indicator (D7) ----
// Public GETs may fall back to bundled INITIAL_* data, but the UI must visibly
// flag it. Authenticated/admin calls never fall back — they throw instead.

type OfflineListener = (offline: boolean) => void;
const offlineListeners = new Set<OfflineListener>();
let offlineMode = false;

function setOfflineMode(next: boolean) {
  if (next === offlineMode) return;
  offlineMode = next;
  offlineListeners.forEach((listener) => listener(offlineMode));
}

/** Subscribe to live/offline flag changes. Returns an unsubscribe function. */
export function subscribeOffline(listener: OfflineListener): () => void {
  offlineListeners.add(listener);
  return () => {
    offlineListeners.delete(listener);
  };
}

export function isOffline(): boolean {
  return offlineMode;
}

// ---- Fetch core ----

async function parseBody(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function errorMessage(json: any, res: Response): string {
  return json?.error || json?.message || `Request failed (${res.status} ${res.statusText})`.trim();
}

/** Same-origin fetch carrying the kbj_session cookie. Returns response + parsed body. */
async function rawRequest(path: string, init: RequestInit = {}): Promise<{ res: Response; json: any }> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (typeof init.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, credentials: 'include', headers });
  } catch {
    setOfflineMode(true);
    throw new ApiError(0, 'Cannot reach server (network error)');
  }
  const json = await parseBody(res);
  return { res, json };
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Authenticated request: parses the `{success, data, error}` envelope and throws
 * ApiError on any non-OK response. Never falls back silently.
 */
async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { res, json } = await rawRequest(path, init);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(json, res));
  }
  return (json && json.data !== undefined ? json.data : json) as T;
}

/** Like apiRequest, but returns the full envelope (for calls whose message/data both matter). */
async function apiEnvelope<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const { res, json } = await rawRequest(path, init);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(json, res));
  }
  return (json ?? { success: true }) as ApiEnvelope<T>;
}

/** Public anonymous GET: falls back to bundled sample data and raises the offline flag. */
async function publicGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const data = await apiRequest<T>(path);
    setOfflineMode(false);
    return data;
  } catch {
    setOfflineMode(true);
    return fallback;
  }
}

export const api = {
  // Health probe
  async getHealth() {
    try {
      const { res, json } = await rawRequest('/healthz');
      if (!res.ok) throw new ApiError(res.status, errorMessage(json, res));
      setOfflineMode(false);
      return json;
    } catch {
      setOfflineMode(true);
      return { status: 'offline', probe: 'fallback-local', uptime: 0 };
    }
  },

  // Authentication (session cookie kbj_session)
  async login(username: string, password: string): Promise<AuthUser> {
    return apiRequest<AuthUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async logout(): Promise<void> {
    await apiRequest<void>('/api/auth/logout', { method: 'POST' });
  },

  /** Returns the session user, or null when anonymous (401). Any other failure throws. */
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      return await apiRequest<AuthUser>('/api/auth/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  // User administration (admin)
  async getUsers(): Promise<AuthUser[]> {
    return apiRequest<AuthUser[]>('/api/users');
  },

  async createUser(input: {
    username: string;
    password: string;
    displayName: string;
    email: string;
    role: Role;
  }): Promise<AuthUser> {
    return apiRequest<AuthUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** Activate/deactivate an account (admin-only; server blocks self-deactivation). */
  async patchUser(
    id: string,
    patch: { isActive: boolean }
  ): Promise<AuthUser & { isActive: boolean }> {
    if (!id) throw new ApiError(400, 'Cannot update a user without an id');
    return apiRequest<AuthUser & { isActive: boolean }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  // File uploads (maker+)
  async uploadFile(file: File): Promise<UploadedFile> {
    const form = new FormData();
    form.append('file', file);
    const { res, json } = await rawRequest('/api/upload', { method: 'POST', body: form });
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(json, res));
    }
    return json?.data as UploadedFile;
  },

  // News & Alerts (GET public, mutations maker+/admin)
  async getNews(): Promise<NewsItem[]> {
    return publicGet<NewsItem[]>('/api/news', INITIAL_NEWS);
  },

  async createNews(item: Partial<NewsItem>): Promise<NewsItem> {
    return apiRequest<NewsItem>('/api/news', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async updateNews(id: string, item: Partial<NewsItem>): Promise<NewsItem> {
    // Never send PUT /api/news/ with an empty id (E2E C1: create flow must not
    // reach the update path). Fail loudly instead of hitting a bogus URL.
    if (!id) throw new ApiError(400, 'Cannot update an item without an id');
    return apiRequest<NewsItem>(`/api/news/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  },

  async deleteNews(id: string): Promise<void> {
    await apiRequest<void>(`/api/news/${id}`, { method: 'DELETE' });
  },

  // Banners (GET public, mutations admin)
  async getBanners(): Promise<BannerSlide[]> {
    return publicGet<BannerSlide[]>('/api/banners', INITIAL_BANNERS);
  },

  async createBanner(item: Partial<BannerSlide>): Promise<BannerSlide> {
    return apiRequest<BannerSlide>('/api/banners', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async updateBanner(id: string, item: Partial<BannerSlide>): Promise<BannerSlide> {
    if (!id) throw new ApiError(400, 'Cannot update an item without an id');
    return apiRequest<BannerSlide>(`/api/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  },

  async deleteBanner(id: string): Promise<void> {
    await apiRequest<void>(`/api/banners/${id}`, { method: 'DELETE' });
  },

  // Contacts (staff+; no silent fallback — throws on failure)
  async getContacts(): Promise<DirectoryContact[]> {
    return apiRequest<DirectoryContact[]>('/api/contacts');
  },

  async createContact(item: Partial<DirectoryContact>): Promise<DirectoryContact> {
    return apiRequest<DirectoryContact>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async deleteContact(id: string): Promise<void> {
    await apiRequest<void>(`/api/contacts/${id}`, { method: 'DELETE' });
  },

  // Meeting Rooms (GET public; book/release staff+)
  async getRooms(): Promise<MeetingRoom[]> {
    return publicGet<MeetingRoom[]>('/api/rooms', INITIAL_ROOMS);
  },

  async bookRoom(id: string, booking: { topic: string; booker: string; time: string }): Promise<MeetingRoom | null> {
    return apiRequest<MeetingRoom | null>(`/api/rooms/${id}/book`, {
      method: 'POST',
      body: JSON.stringify(booking),
    });
  },

  async releaseRoom(id: string): Promise<MeetingRoom | null> {
    return apiRequest<MeetingRoom | null>(`/api/rooms/${id}/release`, { method: 'POST' });
  },

  // Documents (staff+; no silent fallback — throws on failure)
  async getDocuments(): Promise<PolicyDocument[]> {
    return apiRequest<PolicyDocument[]>('/api/documents');
  },

  async createDocument(doc: Partial<PolicyDocument>): Promise<PolicyDocument> {
    return apiRequest<PolicyDocument>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  },

  async deleteDocument(id: string): Promise<void> {
    await apiRequest<void>(`/api/documents/${id}`, { method: 'DELETE' });
  },

  // Public Web Sync (admin)
  async getSyncLogs(): Promise<SyncLog[]> {
    return apiRequest<SyncLog[]>('/api/sync/logs');
  },

  async triggerPublicSync(): Promise<ApiEnvelope<unknown>> {
    return apiEnvelope('/api/sync/trigger', { method: 'POST', body: JSON.stringify({}) });
  },

  // Maker-Checker Dual Control Workflow (BOT Compliance)
  async submitNewsForApproval(id: string): Promise<ApiEnvelope<unknown>> {
    return apiEnvelope(`/api/news/${id}/submit-approval`, { method: 'POST' });
  },

  async approveNews(id: string): Promise<ApiEnvelope<NewsItem>> {
    return apiEnvelope<NewsItem>(`/api/news/${id}/approve`, { method: 'POST' });
  },

  async rejectNews(id: string, reason: string): Promise<ApiEnvelope<NewsItem>> {
    return apiEnvelope<NewsItem>(`/api/news/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Immutable Enterprise Audit Logs (checker+)
  async getAuditLogs(): Promise<AuditLog[]> {
    return apiRequest<AuditLog[]>('/api/audit-logs');
  },

  // System Backup & Database Migration Export (admin) — full payload incl. `tables`
  async exportSystemData(): Promise<Record<string, unknown>> {
    const { res, json } = await rawRequest('/api/system/export');
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(json, res));
    }
    return json;
  },
};
