export interface ReaderSessionRecord {
  id: string;
  bookKey: string;
  bookTitle: string;
  charsRead: number;
  activeSec: number;
  cph: number;
  dateStr: string;
  endedAt: number;
}

export interface ReaderBookLifetimeStats {
  bookKey: string;
  bookTitle: string;
  totalCharsRead: number;
  totalActiveSec: number;
  bestCph: number;
  sessionsCount: number;
  lastReadAt: number;
}

export interface ReaderSpeedSample {
  elapsedSec: number;
  totalChars: number;
  instantCph: number;
  avgCph: number;
}

export interface ReaderStatsStoragePayload {
  sessions: ReaderSessionRecord[];
  books: Record<string, ReaderBookLifetimeStats>;
  daily: Record<string, { charsRead: number; activeSec: number }>;
}

const READER_STATS_STORAGE_KEY = 'immersiontrack_reader_stats_v1';
export const READER_STATS_CHANGED_EVENT = 'immersiontrack:reader-stats-changed';
const MAX_STORED_SESSIONS = 180;
const MAX_STORED_DAYS = 90;

export function getLocalDateKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeCharsPerHour(chars: number, activeSec: number): number {
  if (!Number.isFinite(chars) || !Number.isFinite(activeSec)) return 0;
  if (chars <= 0 || activeSec < 5) return 0;
  return Math.min(200000, Math.round((chars / activeSec) * 3600));
}

export function formatReaderDurationShort(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '0 dtk';
  const s = Math.floor(totalSec);
  if (s < 60) return `${s} dtk`;
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins} mnt`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}j ${remMins}m` : `${hrs} jam`;
}

export function formatStopwatchClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatEstimatedRemaining(
  remainingChars: number,
  cph: number
): string {
  if (remainingChars <= 0) return 'Selesai';
  if (!Number.isFinite(cph) || cph < 100) return 'Mengukur pace...';
  const estHours = remainingChars / cph;
  const totalMins = Math.max(1, Math.round(estHours * 60));
  if (totalMins < 60) return `~${totalMins} mnt lagi`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `~${hrs}j ${mins}m lagi` : `~${hrs} jam lagi`;
}

export function classifyReadingPace(cph: number): {
  label: string;
  colorClass: string;
} {
  if (cph <= 0) return { label: 'Menghitung', colorClass: 'text-slate-400' };
  if (cph < 4000) return { label: 'Santai / Intensif', colorClass: 'text-sky-300' };
  if (cph < 8500) return { label: 'Stabil', colorClass: 'text-emerald-300' };
  if (cph < 14000) return { label: 'Lancar', colorClass: 'text-teal-300' };
  return { label: 'Sangat Cepat', colorClass: 'text-amber-300' };
}

let statsCache: ReaderStatsStoragePayload | null = null;

export function loadReaderStats(): ReaderStatsStoragePayload {
  if (statsCache) return statsCache;
  const empty: ReaderStatsStoragePayload = {
    sessions: [],
    books: {},
    daily: {},
  };
  try {
    const raw = localStorage.getItem(READER_STATS_STORAGE_KEY);
    if (!raw) {
      statsCache = empty;
      return statsCache;
    }
    const parsed = JSON.parse(raw) as Partial<ReaderStatsStoragePayload>;
    const sessions: ReaderSessionRecord[] = Array.isArray(parsed.sessions)
      ? parsed.sessions
          .filter(
            (s): s is ReaderSessionRecord =>
              Boolean(s) &&
              typeof s.id === 'string' &&
              typeof s.bookKey === 'string' &&
              typeof s.charsRead === 'number' &&
              typeof s.activeSec === 'number'
          )
          .slice(0, MAX_STORED_SESSIONS)
      : [];
    const books: Record<string, ReaderBookLifetimeStats> =
      parsed.books && typeof parsed.books === 'object' ? parsed.books : {};
    const daily: Record<string, { charsRead: number; activeSec: number }> =
      parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {};

    statsCache = { sessions, books, daily };
    return statsCache;
  } catch {
    statsCache = empty;
    return statsCache;
  }
}

function saveReaderStats(next: ReaderStatsStoragePayload): void {
  statsCache = next;
  try {
    localStorage.setItem(READER_STATS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(READER_STATS_CHANGED_EVENT));
  }
}

/**
 * Commit incremental active reading delta to persistent stats.
 * Safe to call repeatedly during a session: tracks previous committed totals so nothing double-counts!
 */
export function commitSessionProgressDelta(params: {
  sessionId: string;
  bookKey: string;
  bookTitle: string;
  sessionCharsTotal: number;
  sessionSecTotal: number;
  deltaChars: number;
  deltaSec: number;
}): void {
  const {
    sessionId,
    bookKey,
    bookTitle,
    sessionCharsTotal,
    sessionSecTotal,
    deltaChars,
    deltaSec,
  } = params;
  if (deltaChars <= 0 && deltaSec <= 0) return;

  const store = loadReaderStats();
  const nextSessions = [...store.sessions];
  const nextBooks = { ...store.books };
  const nextDaily = { ...store.daily };

  const now = Date.now();
  const today = getLocalDateKey(now);
  const cph = computeCharsPerHour(sessionCharsTotal, sessionSecTotal);

  // Upsert session record when meaningful activity happened
  if (sessionSecTotal >= 5 || sessionCharsTotal >= 15) {
    const existingIdx = nextSessions.findIndex((s) => s.id === sessionId);
    const rec: ReaderSessionRecord = {
      id: sessionId,
      bookKey,
      bookTitle,
      charsRead: Math.max(0, Math.round(sessionCharsTotal)),
      activeSec: Math.max(0, Math.round(sessionSecTotal)),
      cph,
      dateStr: today,
      endedAt: now,
    };
    if (existingIdx >= 0) {
      nextSessions[existingIdx] = rec;
    } else {
      nextSessions.unshift(rec);
    }
  }

  // Prune old sessions
  const trimmedSessions = nextSessions
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, MAX_STORED_SESSIONS);

  // Update per-book lifetime totals
  const existingBook = nextBooks[bookKey] ?? {
    bookKey,
    bookTitle,
    totalCharsRead: 0,
    totalActiveSec: 0,
    bestCph: 0,
    sessionsCount: 0,
    lastReadAt: now,
  };
  const isNewSessionForBook = !store.sessions.some((s) => s.id === sessionId);
  const updatedBestCph =
    sessionSecTotal >= 30 && sessionCharsTotal >= 60 && cph > existingBook.bestCph
      ? cph
      : existingBook.bestCph;

  nextBooks[bookKey] = {
    ...existingBook,
    bookTitle: bookTitle || existingBook.bookTitle,
    totalCharsRead:
      existingBook.totalCharsRead + Math.max(0, Math.round(deltaChars)),
    totalActiveSec:
      existingBook.totalActiveSec + Math.max(0, Math.round(deltaSec)),
    bestCph: updatedBestCph,
    sessionsCount:
      existingBook.sessionsCount +
      (isNewSessionForBook && (sessionSecTotal >= 5 || sessionCharsTotal >= 15)
        ? 1
        : 0),
    lastReadAt: now,
  };

  // Update daily totals & cap retained days
  const curDay = nextDaily[today] ?? { charsRead: 0, activeSec: 0 };
  nextDaily[today] = {
    charsRead: curDay.charsRead + Math.max(0, Math.round(deltaChars)),
    activeSec: curDay.activeSec + Math.max(0, Math.round(deltaSec)),
  };
  const sortedDays = Object.keys(nextDaily).sort();
  if (sortedDays.length > MAX_STORED_DAYS) {
    const excess = sortedDays.length - MAX_STORED_DAYS;
    for (let i = 0; i < excess; i++) {
      delete nextDaily[sortedDays[i]];
    }
  }

  saveReaderStats({
    sessions: trimmedSessions,
    books: nextBooks,
    daily: nextDaily,
  });
}

export function getReaderSummary(bookKey?: string): {
  todayChars: number;
  todaySec: number;
  todayCph: number;
  allTimeChars: number;
  allTimeSec: number;
  allTimeAvgCph: number;
  bestCph: number;
  bookLifetime: ReaderBookLifetimeStats | null;
  last14Days: Array<{
    dateStr: string;
    label: string;
    charsRead: number;
    activeSec: number;
    cph: number;
  }>;
  recentSessions: ReaderSessionRecord[];
} {
  const store = loadReaderStats();
  const today = getLocalDateKey();
  const todayBucket = store.daily[today] ?? { charsRead: 0, activeSec: 0 };

  let allTimeChars = 0;
  let allTimeSec = 0;
  let bestCph = 0;
  for (const b of Object.values(store.books)) {
    allTimeChars += b.totalCharsRead;
    allTimeSec += b.totalActiveSec;
    if (b.bestCph > bestCph) bestCph = b.bestCph;
  }
  for (const s of store.sessions) {
    if (s.activeSec >= 30 && s.cph > bestCph) bestCph = s.cph;
  }

  const last14Days: Array<{
    dateStr: string;
    label: string;
    charsRead: number;
    activeSec: number;
    cph: number;
  }> = [];
  const now = new Date();
  for (let offset = 13; offset >= 0; offset--) {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const key = getLocalDateKey(d.getTime());
    const row = store.daily[key] ?? { charsRead: 0, activeSec: 0 };
    last14Days.push({
      dateStr: key,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      charsRead: row.charsRead,
      activeSec: row.activeSec,
      cph: computeCharsPerHour(row.charsRead, row.activeSec),
    });
  }

  return {
    todayChars: todayBucket.charsRead,
    todaySec: todayBucket.activeSec,
    todayCph: computeCharsPerHour(todayBucket.charsRead, todayBucket.activeSec),
    allTimeChars,
    allTimeSec,
    allTimeAvgCph: computeCharsPerHour(allTimeChars, allTimeSec),
    bestCph,
    bookLifetime: bookKey ? store.books[bookKey] ?? null : null,
    last14Days,
    recentSessions: store.sessions,
  };
}

export function clearAllReaderStats(): void {
  saveReaderStats({ sessions: [], books: {}, daily: {} });
}
