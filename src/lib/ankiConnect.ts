export const DEFAULT_ANKI_URL = 'http://127.0.0.1:8765';
const ANKI_SETTINGS_KEY = 'immersiontrack_anki_settings_v1';

export interface AnkiSettings {
  url: string;
  selectedDeck: string;
  secondsPerReview: number;
  autoSync: boolean;
}

export function loadAnkiSettings(): AnkiSettings {
  try {
    const raw = localStorage.getItem(ANKI_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AnkiSettings>;
      return {
        url: parsed.url || DEFAULT_ANKI_URL,
        selectedDeck: parsed.selectedDeck || 'all',
        secondsPerReview: Number(parsed.secondsPerReview || 12),
        autoSync: parsed.autoSync ?? false,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    url: DEFAULT_ANKI_URL,
    selectedDeck: 'all',
    secondsPerReview: 12,
    autoSync: false,
  };
}

export function saveAnkiSettings(settings: AnkiSettings): void {
  try {
    localStorage.setItem(ANKI_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

async function postJson<T>(
  url: string,
  body: string,
  extraHeaders?: Record<string, string>,
  timeoutMs = 2500
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(extraHeaders ?? {}),
      },
      body,
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

export async function invokeAnki<T>(
  action: string,
  params: Record<string, unknown>,
  ankiUrl: string,
  companionUrl?: string
): Promise<{ result: T; viaProxy: boolean }> {
  const cleanAnkiUrl = ankiUrl.trim().replace(/\/+$/, '') || DEFAULT_ANKI_URL;
  const payload = JSON.stringify({ action, version: 6, params });

  try {
    const direct = await postJson<AnkiConnectResponse<T>>(cleanAnkiUrl, payload);
    if (direct.error) throw new Error(direct.error);
    return { result: direct.result, viaProxy: false };
  } catch (directErr) {
    if (!companionUrl) {
      throw directErr;
    }
    const proxyBase = companionUrl.trim().replace(/\/+$/, '');
    const proxied = await postJson<AnkiConnectResponse<T>>(
      `${proxyBase}/anki`,
      payload,
      { 'X-Anki-Url': cleanAnkiUrl }
    );
    if (proxied.error) throw new Error(proxied.error);
    return { result: proxied.result, viaProxy: true };
  }
}

export interface AnkiConnectionCheck {
  connected: boolean;
  version?: number;
  viaProxy?: boolean;
  decks?: string[];
  error?: string;
}

export async function checkAnkiConnection(
  ankiUrl: string,
  companionUrl?: string
): Promise<AnkiConnectionCheck> {
  try {
    const ver = await invokeAnki<number>('version', {}, ankiUrl, companionUrl);
    const decksRes = await invokeAnki<string[]>(
      'deckNames',
      {},
      ankiUrl,
      companionUrl
    );
    return {
      connected: true,
      version: ver.result,
      viaProxy: ver.viaProxy,
      decks: decksRes.result ?? [],
    };
  } catch (err: unknown) {
    return {
      connected: false,
      error:
        err instanceof Error
          ? err.message
          : 'Tidak dapat terhubung ke AnkiConnect',
    };
  }
}

export interface AnkiTodayStats {
  reviewsToday: number;
  newCardsToday: number;
  estimatedMinutes: number;
  viaProxy: boolean;
}

export async function fetchAnkiTodayStats(
  ankiUrl: string,
  selectedDeck: string,
  secondsPerReview: number,
  companionUrl?: string
): Promise<AnkiTodayStats> {
  const reviewsRes = await invokeAnki<number>(
    'getNumCardsReviewedToday',
    {},
    ankiUrl,
    companionUrl
  );

  const query =
    selectedDeck === 'all'
      ? 'added:1'
      : `added:1 "deck:${selectedDeck.replace(/"/g, '\\"')}"`;

  const addedCardsRes = await invokeAnki<number[]>(
    'findCards',
    { query },
    ankiUrl,
    companionUrl
  );

  const reviewsToday = Number(reviewsRes.result || 0);
  const newCardsToday = Array.isArray(addedCardsRes.result)
    ? addedCardsRes.result.length
    : 0;

  const estimatedMinutes =
    reviewsToday > 0
      ? Math.max(1, Math.round((reviewsToday * Math.max(3, secondsPerReview)) / 60))
      : newCardsToday > 0
        ? Math.max(1, newCardsToday * 2)
        : 0;

  return {
    reviewsToday,
    newCardsToday,
    estimatedMinutes,
    viaProxy: reviewsRes.viaProxy,
  };
}
