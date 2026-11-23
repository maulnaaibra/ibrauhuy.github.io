import {
  getStoredNovelBook,
  listAllStoredNovelBooksFull,
  loadNovelProgressMirror,
  loadReaderPrefs,
  loadYatsuBookLinks,
  mergeNovelProgressSnapshots,
  saveAllYatsuBookLinks,
  saveReaderPrefs,
  saveStoredNovelBook,
  type NovelProgressSnapshot,
  type ReaderPreferences,
  type StoredNovelBook,
} from './epubReaderStore';
import {
  LIBRARY_DATA_CHANGED_EVENT,
  loadUserWatchlist,
  loadWatchedEpisodesMap,
  saveUserWatchlist,
  saveWatchedEpisodesMap,
} from './mediaCinematicDetails';
import { isSupabaseConfigured, supabase } from './supabase';

export interface LibraryBackupPayload {
  v: 1;
  exportedAt: string;
  books: StoredNovelBook[];
  progressMirror: Record<string, NovelProgressSnapshot>;
  watchlist: string[];
  watchedEpisodes: Record<string, number[]>;
  yatsuLinks: Record<string, string>;
  readerPrefs?: ReaderPreferences;
}

let cloudLibraryTableAvailable = true;
let cloudSyncTimer: number | null = null;

function isMissingCloudTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as {
    code?: string;
    status?: number;
    message?: string;
    details?: string;
  };
  if (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    err.status === 404
  ) {
    return true;
  }
  const msg = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
  return (
    msg.includes('user_library_state') &&
    (msg.includes('does not exist') ||
      msg.includes('not found') ||
      msg.includes('schema cache'))
  );
}

function sanitizeReaderPrefsForCloud(
  prefs: ReaderPreferences
): Partial<ReaderPreferences> {
  const { bgImageUrl, ...rest } = prefs;
  if (
    bgImageUrl &&
    !bgImageUrl.startsWith('data:') &&
    !bgImageUrl.startsWith('idb:')
  ) {
    return { ...rest, bgImageUrl };
  }
  return rest;
}

function mergeWatchlistIds(localIds: string[], cloudIds: unknown): string[] {
  const incoming = Array.isArray(cloudIds) ? cloudIds.map(String) : [];
  return Array.from(new Set([...localIds, ...incoming])).filter(Boolean);
}

function mergeWatchedEpisodesMaps(
  localMap: Record<string, number[]>,
  cloudMap: unknown
): Record<string, number[]> {
  const merged: Record<string, number[]> = { ...localMap };
  if (cloudMap && typeof cloudMap === 'object' && !Array.isArray(cloudMap)) {
    for (const [mediaId, eps] of Object.entries(
      cloudMap as Record<string, unknown>
    )) {
      if (!Array.isArray(eps)) continue;
      const existing = Array.isArray(merged[mediaId]) ? merged[mediaId] : [];
      const incoming = eps.filter(
        (n): n is number => typeof n === 'number' && Number.isFinite(n)
      );
      merged[mediaId] = Array.from(new Set([...existing, ...incoming])).sort(
        (a, b) => a - b
      );
    }
  }
  return merged;
}

function mergeYatsuLinkMaps(
  localLinks: Record<string, string>,
  cloudLinks: unknown
): Record<string, string> {
  const merged: Record<string, string> = {};
  if (
    cloudLinks &&
    typeof cloudLinks === 'object' &&
    !Array.isArray(cloudLinks)
  ) {
    for (const [k, v] of Object.entries(cloudLinks as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) {
        merged[k] = v.trim();
      }
    }
  }
  for (const [k, v] of Object.entries(localLinks)) {
    if (typeof v === 'string' && v.trim()) {
      merged[k] = v.trim();
    }
  }
  return merged;
}

async function applyMergedSnapshotsToStoredBooks(
  merged: Record<string, NovelProgressSnapshot>
): Promise<void> {
  for (const snap of Object.values(merged)) {
    const existing = await getStoredNovelBook(snap.storageKey);
    if (!existing) continue;
    if (snap.updatedAt > existing.updatedAt) {
      const maxChapter = Math.max(0, existing.chapters.length - 1);
      await saveStoredNovelBook({
        ...existing,
        currentChapter: Math.min(maxChapter, Math.max(0, snap.currentChapter)),
        scrollRatio: Math.min(1, Math.max(0, snap.scrollRatio)),
        vnIndex: Math.max(0, snap.vnIndex),
        bookmarks:
          snap.bookmarks.length >= (existing.bookmarks?.length ?? 0)
            ? snap.bookmarks
            : existing.bookmarks,
        updatedAt: snap.updatedAt,
      });
    }
  }
}

function dispatchLibraryChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LIBRARY_DATA_CHANGED_EVENT));
  }
}

export async function exportFullLibraryBackup(): Promise<{
  fileName: string;
  json: string;
  bookCount: number;
  watchlistCount: number;
}> {
  const books = await listAllStoredNovelBooksFull();
  const progressMirror = loadNovelProgressMirror();
  const watchlist = loadUserWatchlist();
  const watchedEpisodes = loadWatchedEpisodesMap();
  const yatsuLinks = loadYatsuBookLinks();
  const readerPrefs = loadReaderPrefs();

  const payload: LibraryBackupPayload = {
    v: 1,
    exportedAt: new Date().toISOString(),
    books,
    progressMirror,
    watchlist,
    watchedEpisodes,
    yatsuLinks,
    readerPrefs,
  };

  const today = new Date().toISOString().slice(0, 10);
  return {
    fileName: `immersiontrack-library-${today}.json`,
    json: JSON.stringify(payload),
    bookCount: books.length,
    watchlistCount: watchlist.length,
  };
}

export async function importFullLibraryBackup(
  rawJson: string,
  userId?: string
): Promise<{ booksImported: number; watchlistCount: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('File backup tidak valid (bukan format JSON yang benar).');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Struktur file backup library tidak dikenali.');
  }

  const payload = parsed as Partial<LibraryBackupPayload>;
  if (payload.v !== 1) {
    throw new Error('Versi file backup tidak didukung.');
  }

  const snapshotsToMerge: Record<string, NovelProgressSnapshot> = {};
  if (
    payload.progressMirror &&
    typeof payload.progressMirror === 'object' &&
    !Array.isArray(payload.progressMirror)
  ) {
    Object.assign(snapshotsToMerge, payload.progressMirror);
  }

  let booksImported = 0;
  if (Array.isArray(payload.books)) {
    for (const rawBook of payload.books) {
      if (
        !rawBook ||
        typeof rawBook !== 'object' ||
        typeof rawBook.storageKey !== 'string' ||
        typeof rawBook.title !== 'string' ||
        !Array.isArray(rawBook.chapters)
      ) {
        continue;
      }

      const incomingBook = rawBook as StoredNovelBook;
      const existing = await getStoredNovelBook(incomingBook.storageKey);

      const useIncomingProgress =
        !existing || (incomingBook.updatedAt ?? 0) >= existing.updatedAt;
      const mergedBook: StoredNovelBook = {
        ...incomingBook,
        currentChapter: useIncomingProgress
          ? incomingBook.currentChapter
          : existing.currentChapter,
        scrollRatio: useIncomingProgress
          ? incomingBook.scrollRatio
          : existing.scrollRatio,
        vnIndex: useIncomingProgress
          ? (incomingBook.vnIndex ?? 0)
          : (existing.vnIndex ?? 0),
        bookmarks:
          (incomingBook.bookmarks?.length ?? 0) >=
          (existing?.bookmarks?.length ?? 0)
            ? incomingBook.bookmarks
            : existing?.bookmarks,
        coverDataUrl: incomingBook.coverDataUrl || existing?.coverDataUrl,
        updatedAt: Math.max(
          incomingBook.updatedAt ?? Date.now(),
          existing?.updatedAt ?? 0
        ),
      };

      await saveStoredNovelBook(mergedBook);
      booksImported += 1;
    }
  }

  const mergedMirror = mergeNovelProgressSnapshots(snapshotsToMerge);
  await applyMergedSnapshotsToStoredBooks(mergedMirror);

  const mergedWatchlist = saveUserWatchlist(
    mergeWatchlistIds(loadUserWatchlist(), payload.watchlist)
  );
  saveWatchedEpisodesMap(
    mergeWatchedEpisodesMaps(loadWatchedEpisodesMap(), payload.watchedEpisodes)
  );
  saveAllYatsuBookLinks(
    mergeYatsuLinkMaps(loadYatsuBookLinks(), payload.yatsuLinks)
  );

  if (payload.readerPrefs && typeof payload.readerPrefs === 'object') {
    const currentPrefs = loadReaderPrefs();
    const keepCurrentBg =
      Boolean(currentPrefs.bgImageUrl) &&
      (currentPrefs.bgImageUrl.startsWith('data:') ||
        currentPrefs.bgImageUrl.startsWith('idb:'));
    const incomingBg =
      payload.readerPrefs.bgImageUrl &&
      !payload.readerPrefs.bgImageUrl.startsWith('idb:')
        ? payload.readerPrefs.bgImageUrl
        : undefined;
    const nextBgImageUrl = keepCurrentBg
      ? currentPrefs.bgImageUrl
      : incomingBg ?? currentPrefs.bgImageUrl;
    saveReaderPrefs({
      ...currentPrefs,
      ...payload.readerPrefs,
      bgImageUrl: nextBgImageUrl,
    });
  }

  dispatchLibraryChanged();
  scheduleCloudLibraryPush(userId);

  return {
    booksImported,
    watchlistCount: mergedWatchlist.length,
  };
}

export async function pullCloudLibraryState(userId: string): Promise<boolean> {
  if (!userId || !isSupabaseConfigured || !cloudLibraryTableAvailable) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('user_library_state')
      .select(
        'watchlist, watched_episodes, yatsu_links, novel_progress, reader_prefs, updated_at'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (isMissingCloudTableError(error)) {
        cloudLibraryTableAvailable = false;
      }
      return false;
    }

    if (!data) {
      scheduleCloudLibraryPush(userId);
      return true;
    }

    const row = data as {
      watchlist?: unknown;
      watched_episodes?: unknown;
      yatsu_links?: unknown;
      novel_progress?: unknown;
      reader_prefs?: unknown;
    };

    saveUserWatchlist(mergeWatchlistIds(loadUserWatchlist(), row.watchlist));
    saveWatchedEpisodesMap(
      mergeWatchedEpisodesMaps(loadWatchedEpisodesMap(), row.watched_episodes)
    );
    saveAllYatsuBookLinks(
      mergeYatsuLinkMaps(loadYatsuBookLinks(), row.yatsu_links)
    );

    if (
      row.novel_progress &&
      typeof row.novel_progress === 'object' &&
      !Array.isArray(row.novel_progress)
    ) {
      const mergedMirror = mergeNovelProgressSnapshots(
        row.novel_progress as Record<string, NovelProgressSnapshot>
      );
      await applyMergedSnapshotsToStoredBooks(mergedMirror);
    }

    if (
      row.reader_prefs &&
      typeof row.reader_prefs === 'object' &&
      !Array.isArray(row.reader_prefs)
    ) {
      const localPrefs = loadReaderPrefs();
      const cloudPrefs = row.reader_prefs as Partial<ReaderPreferences>;
      saveReaderPrefs({
        ...cloudPrefs,
        ...localPrefs,
      });
    }

    dispatchLibraryChanged();
    return true;
  } catch {
    return false;
  }
}

export function scheduleCloudLibraryPush(userId?: string): void {
  if (
    !userId ||
    !isSupabaseConfigured ||
    !cloudLibraryTableAvailable ||
    typeof window === 'undefined'
  ) {
    return;
  }

  if (cloudSyncTimer !== null) {
    window.clearTimeout(cloudSyncTimer);
  }

  cloudSyncTimer = window.setTimeout(() => {
    cloudSyncTimer = null;
    void (async () => {
      if (!isSupabaseConfigured || !cloudLibraryTableAvailable) return;
      try {
        const { error } = await supabase.from('user_library_state').upsert(
          {
            user_id: userId,
            watchlist: loadUserWatchlist(),
            watched_episodes: loadWatchedEpisodesMap(),
            yatsu_links: loadYatsuBookLinks(),
            novel_progress: loadNovelProgressMirror(),
            reader_prefs: sanitizeReaderPrefsForCloud(loadReaderPrefs()),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (error && isMissingCloudTableError(error)) {
          cloudLibraryTableAvailable = false;
        }
      } catch {
        // ignore offline cloud sync errors gracefully
      }
    })();
  }, 1500);
}
