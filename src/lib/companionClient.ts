import type { PrimaryMediaCategory } from '../types';

export const DEFAULT_COMPANION_URL = 'http://127.0.0.1:41937';
const COMPANION_SETTINGS_KEY = 'immersiontrack_companion_settings_v1';

export type TrackingSourceMode =
  | 'foreground'
  | 'background'
  | 'pinned'
  | 'catalog'
  | 'none';

export interface TrackerRule {
  id: string;
  name: string;
  enabled: boolean;
  matchType: 'process' | 'title';
  pattern: string;
  category: PrimaryMediaCategory;
}

export interface CompanionConfig {
  idleThresholdSeconds: number;
  minSessionMinutes: number;
  inactivityCommitSeconds: number;
  trackBackgroundWindows?: boolean;
  rules: TrackerRule[];
}

export interface OpenWindowItem {
  hwnd: number;
  pid: number;
  process: string;
  title: string;
  isForeground: boolean;
  matchedRule: string | null;
  matchedCategory: PrimaryMediaCategory | null;
  isTracked: boolean;
}

export interface PinnedWindowTarget {
  hwnd?: number;
  process: string;
  title: string;
  customTitle?: string;
  category: PrimaryMediaCategory;
  ruleName: string;
  fromCatalog?: boolean;
}

export interface ActiveTrackedSession {
  title: string;
  category: PrimaryMediaCategory;
  process: string;
  ruleId?: string;
  ruleName: string;
  trackingSource?: TrackingSourceMode;
  startedAt: string;
  lastSeenAt: string;
  activeSeconds: number;
}

export interface PendingTrackedSession {
  id: string;
  title: string;
  category: PrimaryMediaCategory;
  duration_minutes: number;
  cards_mined: number;
  notes: string;
  logged_date: string;
  created_at: string;
  source_device: string;
}

export interface CompanionStatus {
  ok: boolean;
  version?: string;
  deviceName: string;
  trackingEnabled: boolean;
  uptimeSeconds: number;
  config: CompanionConfig;
  lastWindow: {
    process: string;
    title: string;
    foregroundProcess?: string;
    foregroundTitle?: string;
    idleSeconds: number;
    matchedRule: string | null;
    trackingSource?: TrackingSourceMode;
    timestamp: string;
  };
  openWindows?: OpenWindowItem[];
  pinnedTarget?: PinnedWindowTarget | null;
  activeSession: ActiveTrackedSession | null;
  pendingCount: number;
  pending: PendingTrackedSession[];
}

export interface CompanionSettings {
  url: string;
  autoSync: boolean;
}

export function loadCompanionSettings(): CompanionSettings {
  try {
    const raw = localStorage.getItem(COMPANION_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CompanionSettings>;
      return {
        url: parsed.url || DEFAULT_COMPANION_URL,
        autoSync: parsed.autoSync ?? true,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { url: DEFAULT_COMPANION_URL, autoSync: true };
}

export function saveCompanionSettings(settings: CompanionSettings): void {
  try {
    localStorage.setItem(COMPANION_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '') || DEFAULT_COMPANION_URL;
}

function getFallbackBaseUrl(baseUrl: string): string | null {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.includes('127.0.0.1')) {
    return normalized.replace('127.0.0.1', 'localhost');
  }
  if (normalized.includes('localhost')) {
    return normalized.replace('localhost', '127.0.0.1');
  }
  return null;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 2500
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCompanionStatus(
  baseUrl: string
): Promise<CompanionStatus | null> {
  const primary = normalizeBaseUrl(baseUrl);
  try {
    return await fetchJsonWithTimeout<CompanionStatus>(`${primary}/status`);
  } catch {
    const fallback = getFallbackBaseUrl(primary);
    if (fallback) {
      try {
        return await fetchJsonWithTimeout<CompanionStatus>(`${fallback}/status`);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function toggleCompanionTracking(
  baseUrl: string,
  enabled?: boolean
): Promise<{ ok: boolean; trackingEnabled: boolean }> {
  return fetchJsonWithTimeout(`${normalizeBaseUrl(baseUrl)}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(typeof enabled === 'boolean' ? { enabled } : {}),
  });
}

export async function pinCompanionWindow(
  baseUrl: string,
  payload: {
    hwnd?: number;
    process: string;
    title: string;
    customTitle?: string;
    category: PrimaryMediaCategory;
  }
): Promise<{
  ok: boolean;
  pinnedTarget: PinnedWindowTarget | null;
  activeSession: ActiveTrackedSession | null;
}> {
  return fetchJsonWithTimeout(`${normalizeBaseUrl(baseUrl)}/pin-window`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function unpinCompanionWindow(
  baseUrl: string
): Promise<{ ok: boolean; pinnedTarget: null }> {
  return fetchJsonWithTimeout(`${normalizeBaseUrl(baseUrl)}/pin-window`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clear: true }),
  });
}

export async function notifyCompanionMediaLaunch(
  baseUrl: string,
  payload: {
    title: string;
    category: PrimaryMediaCategory;
    url?: string;
  }
): Promise<void> {
  try {
    await fetchJsonWithTimeout(
      `${normalizeBaseUrl(baseUrl)}/hint`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      1500
    );
  } catch {
    // Silent if companion agent is offline
  }
}

export async function flushCompanionSession(
  baseUrl: string
): Promise<{
  ok: boolean;
  committed: PendingTrackedSession | null;
  pending: PendingTrackedSession[];
}> {
  return fetchJsonWithTimeout(`${normalizeBaseUrl(baseUrl)}/flush`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

export async function ackCompanionSessions(
  baseUrl: string,
  ids: string[]
): Promise<{ ok: boolean; remaining: number }> {
  return fetchJsonWithTimeout(`${normalizeBaseUrl(baseUrl)}/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export async function saveCompanionConfig(
  baseUrl: string,
  config: CompanionConfig
): Promise<{ ok: boolean; config: CompanionConfig }> {
  return fetchJsonWithTimeout(`${normalizeBaseUrl(baseUrl)}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
