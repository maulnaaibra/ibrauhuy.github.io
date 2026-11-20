import type { PrimaryMediaCategory } from '../types';

export const DEFAULT_COMPANION_URL = 'http://127.0.0.1:41937';
const COMPANION_SETTINGS_KEY = 'immersiontrack_companion_settings_v1';

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
  rules: TrackerRule[];
}

export interface ActiveTrackedSession {
  title: string;
  category: PrimaryMediaCategory;
  process: string;
  ruleName: string;
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
  deviceName: string;
  trackingEnabled: boolean;
  uptimeSeconds: number;
  config: CompanionConfig;
  lastWindow: {
    process: string;
    title: string;
    idleSeconds: number;
    matchedRule: string | null;
    timestamp: string;
  };
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
  try {
    return await fetchJsonWithTimeout<CompanionStatus>(
      `${normalizeBaseUrl(baseUrl)}/status`
    );
  } catch {
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
