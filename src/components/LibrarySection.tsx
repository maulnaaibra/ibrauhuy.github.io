import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Compass,
  Download,
  ExternalLink,
  FileUp,
  FolderInput,
  HardDrive,
  History,
  Library,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import rawCatalog from '../data/immersionCatalog.json';
import {
  deleteStoredNovelBook,
  deleteStoredNovelBookmark,
  getLastOpenedNovelKey,
  getLibraryStorageInfo,
  importNovelFileToLibrary,
  listStoredNovelBooks,
  requestPersistentLibraryStorage,
  setLastOpenedNovelKey,
  type NovelBookmark,
  type StoredNovelSummary,
} from '../lib/epubReaderStore';
import {
  exportFullLibraryBackup,
  importFullLibraryBackup,
  pullCloudLibraryState,
  pushCloudLibraryNow,
  scheduleCloudLibraryPush,
} from '../lib/libraryCloudSync';
import {
  LIBRARY_DATA_CHANGED_EVENT,
  loadUserWatchlist,
  loadWatchedEpisodesMap,
  toggleUserWatchlistItem,
} from '../lib/mediaCinematicDetails';
import {
  JapaneseNovelReaderModal,
  type NovelReaderTarget,
} from './JapaneseNovelReaderModal';
import { type SheetCatalogItem } from './MediaCatalogBrowser';
import { MediaCover } from './MediaCover';

interface LibrarySectionProps {
  userId?: string;
  onLogReadingSession: (title: string, durationMinutes: number) => void;
  onOpenCatalogItem: (title: string) => void;
  onGoToCatalog: () => void;
}

type LibrarySubTab = 'novels' | 'watchlist';
type NovelSortMode = 'recent' | 'progress' | 'title';

const ALL_CATALOG_ITEMS = rawCatalog as SheetCatalogItem[];

function formatRelativeTimeId(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'Baru ditambahkan';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function computeBookProgressPct(sb: StoredNovelSummary): number {
  if (sb.chapterCount <= 0) return 0;
  const raw =
    ((sb.currentChapter + Math.min(1, Math.max(0, sb.scrollRatio))) /
      sb.chapterCount) *
    100;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

function formatCheckpointParts(sb: StoredNovelSummary): string {
  const parts = [`Bab ${sb.currentChapter + 1}/${Math.max(1, sb.chapterCount)}`];
  if (sb.currentChapterTitle?.trim()) {
    parts.push(sb.currentChapterTitle.trim());
  }
  if ((sb.vnIndex ?? 0) > 0) {
    parts.push(`Paragraf #${sb.vnIndex! + 1}`);
  }
  return parts.join(' • ');
}

export const LibrarySection: React.FC<LibrarySectionProps> = ({
  userId,
  onLogReadingSession,
  onOpenCatalogItem,
  onGoToCatalog,
}) => {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const [savedNovels, setSavedNovels] = useState<StoredNovelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastOpenedKey, setLastOpenedKeyState] = useState<string>(
    getLastOpenedNovelKey
  );
  const [storageInfo, setStorageInfo] = useState<{
    persisted: boolean;
    usageMb: number | null;
    quotaMb: number | null;
  }>({ persisted: false, usageMb: null, quotaMb: null });

  const [watchlistIds, setWatchlistIds] = useState<string[]>(loadUserWatchlist);
  const [watchedEpisodesMap, setWatchedEpisodesMap] = useState<
    Record<string, number[]>
  >(loadWatchedEpisodesMap);

  const [subTab, setSubTab] = useState<LibrarySubTab>('novels');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<NovelSortMode>('recent');
  const [expandedBookmarks, setExpandedBookmarks] = useState<
    Record<string, boolean>
  >({});

  const [importing, setImporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);

  const [readerTarget, setReaderTarget] = useState<NovelReaderTarget | null>(
    null
  );

  const refreshLibrary = useCallback(async () => {
    const [books, info] = await Promise.all([
      listStoredNovelBooks(),
      getLibraryStorageInfo(),
    ]);
    setSavedNovels(books);
    setStorageInfo(info);
    setLastOpenedKeyState(getLastOpenedNovelKey());
    setWatchlistIds(loadUserWatchlist());
    setWatchedEpisodesMap(loadWatchedEpisodesMap());
    setLoading(false);
  }, []);

  useEffect(() => {
    void requestPersistentLibraryStorage().then(() => refreshLibrary());
  }, [refreshLibrary]);

  useEffect(() => {
    if (!userId) return;
    void pullCloudLibraryState(userId).then((pulled) => {
      if (pulled) {
        void refreshLibrary();
      }
    });
  }, [userId, refreshLibrary]);

  useEffect(() => {
    const onChanged = () => {
      void refreshLibrary();
    };
    window.addEventListener(LIBRARY_DATA_CHANGED_EVENT, onChanged);
    return () =>
      window.removeEventListener(LIBRARY_DATA_CHANGED_EVENT, onChanged);
  }, [refreshLibrary]);

  const handleImportNovelFiles = async (files: FileList | File[] | null) => {
    const fileArray = files ? Array.from(files) : [];
    if (fileArray.length === 0) return;

    setImporting(true);
    let addedCount = 0;
    let updatedCount = 0;
    let lastTitle = '';

    try {
      for (const file of fileArray) {
        const res = await importNovelFileToLibrary(file);
        lastTitle = res.book.title;
        if (res.deduplicated) {
          updatedCount += 1;
        } else {
          addedCount += 1;
        }
        setLastOpenedNovelKey(res.book.storageKey);
      }

      await refreshLibrary();
      scheduleCloudLibraryPush(userId);
      setSubTab('novels');

      if (fileArray.length === 1) {
        toast.success(
          updatedCount > 0
            ? `「${lastTitle}」 sudah ada di Library — progres baca tetap terjaga!`
            : `「${lastTitle}」 tersimpan di Library permanen!`
        );
      } else {
        toast.success(
          `${addedCount} buku ditambahkan${
            updatedCount > 0 ? `, ${updatedCount} dilanjutkan` : ''
          } ke Library!`
        );
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal menambahkan file EPUB/TXT ke Library.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleSyncAndSaveNow = async () => {
    setSyncingNow(true);
    try {
      const res = await pushCloudLibraryNow(userId);
      await refreshLibrary();
      toast.success(
        res === 'synced'
          ? 'Riwayat baca & Library tersimpan aman ke perangkat dan Cloud!'
          : 'Riwayat baca & Library tersimpan aman di penyimpanan lokal permanen!'
      );
    } finally {
      setSyncingNow(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const backup = await exportFullLibraryBackup();
      const blob = new Blob([backup.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(
        `Backup (${backup.bookCount} novel, ${backup.watchlistCount} Daftar Saya) diunduh!`
      );
    } catch {
      toast.error('Gagal mengunduh file backup Library.');
    }
  };

  const handleRestoreBackup = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const raw = await file.text();
      const res = await importFullLibraryBackup(raw, userId);
      await refreshLibrary();
      toast.success(
        `Dipulihkan: ${res.booksImported} novel & ${res.watchlistCount} Daftar Saya!`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal memulihkan file backup.'
      );
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const handleOpenBook = (
    sb: StoredNovelSummary,
    bookmark?: NovelBookmark
  ) => {
    setLastOpenedNovelKey(sb.storageKey);
    setLastOpenedKeyState(sb.storageKey);
    setReaderTarget({
      storageKey: sb.storageKey,
      catalogItemId: sb.catalogItemId,
      title: sb.title,
      ...(bookmark
        ? {
            initialChapter: bookmark.chapterIndex,
            initialScrollRatio: bookmark.scrollRatio,
            initialVnIndex: bookmark.vnIndex,
          }
        : {}),
    });
  };

  const handleDeleteBook = async (sb: StoredNovelSummary) => {
    await deleteStoredNovelBook(sb.storageKey);
    await refreshLibrary();
    scheduleCloudLibraryPush(userId);
    toast.success(`「${sb.title}」 dihapus dari Library.`);
  };

  const handleDeleteBookmark = async (
    storageKey: string,
    bookmarkId: string
  ) => {
    await deleteStoredNovelBookmark(storageKey, bookmarkId);
    await refreshLibrary();
    scheduleCloudLibraryPush(userId);
    toast.success('Titik simpan (Bookmark) dihapus.');
  };

  const handleRemoveWatchlist = (item: SheetCatalogItem) => {
    const res = toggleUserWatchlistItem(item.id);
    setWatchlistIds(res.list);
    scheduleCloudLibraryPush(userId);
    toast.success(`「${item.title}」 dihapus dari Daftar Saya.`);
  };

  const lastOpenedBook = useMemo<StoredNovelSummary | null>(() => {
    if (savedNovels.length === 0) return null;
    if (lastOpenedKey) {
      const match = savedNovels.find((b) => b.storageKey === lastOpenedKey);
      if (match) return match;
    }
    return savedNovels[0];
  }, [savedNovels, lastOpenedKey]);

  const filteredNovels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = savedNovels.filter((sb) => {
      if (!q) return true;
      return (
        sb.title.toLowerCase().includes(q) ||
        (sb.author && sb.author.toLowerCase().includes(q)) ||
        sb.fileName.toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered];
    if (sortMode === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
    } else if (sortMode === 'progress') {
      sorted.sort(
        (a, b) => computeBookProgressPct(b) - computeBookProgressPct(a)
      );
    } else {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return sorted;
  }, [savedNovels, searchQuery, sortMode]);

  const watchlistItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const idSet = new Set(watchlistIds);
    return ALL_CATALOG_ITEMS.filter((item) => {
      if (!idSet.has(item.id)) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.romajiTitle && item.romajiTitle.toLowerCase().includes(q)) ||
        item.section.toLowerCase().includes(q)
      );
    });
  }, [watchlistIds, searchQuery]);

  return (
    <div
      className="space-y-5 animate-tab-in"
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          setDraggingOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setDraggingOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDraggingOver(false);
        void handleImportNovelFiles(e.dataTransfer?.files ?? null);
      }}
    >
      {/* Hidden inputs */}
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept=".epub,.txt,.html,.htm,.xhtml"
        onChange={(e) => {
          void handleImportNovelFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={backupInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleRestoreBackup}
        className="hidden"
      />

      {draggingOver && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-none">
          <div className="p-8 rounded-3xl border-2 border-dashed border-sky-400 bg-slate-900/90 text-center space-y-2 shadow-2xl max-w-md">
            <FileUp className="w-10 h-10 text-sky-400 mx-auto" />
            <div className="text-base font-extrabold text-white">
              Lepaskan File Novel (.EPUB / .TXT)
            </div>
            <p className="text-xs text-slate-300">
              Buku otomatis disimpan ke Library tanpa menimpa riwayat baca
              sebelumnya.
            </p>
          </div>
        </div>
      )}

      {/* TOP HEADER & ACTIONS */}
      <div className="card-pro p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Library className="w-5 h-5 text-rose-600 shrink-0" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 app-canvas-title">
                Library &amp; Riwayat Baca
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 inline-flex items-center gap-1">
                <HardDrive className="w-3 h-3 shrink-0" />
                {storageInfo.persisted
                  ? 'Anti-Reset Permanen'
                  : 'IndexedDB Aman'}
                {storageInfo.usageMb !== null
                  ? ` • ${storageInfo.usageMb} MB`
                  : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Semua novel, titik terakhir Anda membaca (bab &amp; paragraf),
              bookmark, dan Daftar Saya tersimpan otomatis — langsung lanjutkan
              kapan saja tanpa perlu mengulang.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              disabled={importing}
              onClick={() => uploadInputRef.current?.click()}
              className="btn-crimson px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Tambah Novel (.EPUB / .TXT)</span>
            </button>

            <button
              type="button"
              disabled={syncingNow}
              onClick={() => void handleSyncAndSaveNow()}
              className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-600 hover:text-white text-xs font-extrabold text-emerald-700 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              {syncingNow ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Simpan &amp; Sinkron</span>
            </button>

            <button
              type="button"
              onClick={() => void handleExportBackup()}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup (.json)</span>
            </button>

            <button
              type="button"
              disabled={restoring}
              onClick={() => backupInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <FolderInput className="w-3.5 h-3.5" />
              <span>{restoring ? 'Memulihkan...' : 'Pulihkan'}</span>
            </button>
          </div>
        </div>

        {/* SUB-TABS & SEARCH/SORT */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSubTab('novels')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 transition cursor-pointer ${
                subTab === 'novels'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-rose-300'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat Novel ({savedNovels.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('watchlist')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 transition cursor-pointer ${
                subTab === 'watchlist'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-rose-300'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Daftar Saya / Watchlist ({watchlistIds.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  subTab === 'novels'
                    ? 'Cari novel di Library...'
                    : 'Cari Daftar Saya...'
                }
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500"
              />
            </div>

            {subTab === 'novels' && (
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as NovelSortMode)}
                aria-label="Urutkan novel"
                className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="recent">Terakhir Dibaca</option>
                <option value="progress">Progres Tertinggi</option>
                <option value="title">Judul A–Z</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* HERO CARD: TERAKHIR DIBACA (LANJUTKAN TANPA NGULANG) */}
      {!loading && lastOpenedBook && subTab === 'novels' && (
        <div className="card-pro p-4 sm:p-5 space-y-3 border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[11px] font-extrabold text-sky-700 inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>Terakhir Dibaca • Lanjutkan Tanpa Ngulang</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500 inline-flex items-center gap-1">
              <Cloud className="w-3 h-3 text-emerald-500" />
              {formatRelativeTimeId(lastOpenedBook.updatedAt)}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {lastOpenedBook.coverDataUrl ? (
              <img
                src={lastOpenedBook.coverDataUrl}
                alt={lastOpenedBook.title}
                className="w-20 h-28 rounded-xl object-cover shrink-0 border border-slate-200 shadow-sm"
              />
            ) : (
              <MediaCover
                title={lastOpenedBook.title}
                category="light_novel"
                className="w-20 h-28 rounded-xl shrink-0"
              />
            )}

            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 line-clamp-2">
                  {lastOpenedBook.title}
                </h3>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {lastOpenedBook.author
                    ? `${lastOpenedBook.author} • `
                    : ''}
                  {lastOpenedBook.totalChars.toLocaleString('id-ID')} huruf
                  {lastOpenedBook.bookmarkCount > 0
                    ? ` • ${lastOpenedBook.bookmarkCount} bookmark`
                    : ''}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-800 truncate">
                    Posisi Tersimpan: {formatCheckpointParts(lastOpenedBook)}
                  </span>
                  <span className="font-mono font-extrabold text-rose-600 shrink-0">
                    {computeBookProgressPct(lastOpenedBook)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all"
                    style={{
                      width: `${Math.max(4, computeBookProgressPct(lastOpenedBook))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex sm:flex-col items-stretch gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenBook(lastOpenedBook)}
                className="btn-crimson px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Lanjutkan Membaca</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onLogReadingSession(lastOpenedBook.title, 30)
                }
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-700 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-rose-600" />
                <span>Catat Sesi (+Log)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN BODY */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-pro h-44 animate-pulse" />
          ))}
        </div>
      ) : subTab === 'novels' ? (
        savedNovels.length === 0 ? (
          <div className="card-pro p-8 sm:p-10 text-center space-y-4 border-2 border-dashed border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto">
              <Library className="w-7 h-7 text-rose-600" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Library Novel Masih Kosong
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Tarik &amp; lepaskan file <strong>.EPUB</strong> atau{' '}
                <strong>.TXT</strong> ke halaman ini, atau klik tombol di bawah
                untuk menyimpan novel permanen lengkap dengan bookmark &amp;
                riwayat bab terakhir.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
              <button
                type="button"
                disabled={importing}
                onClick={() => uploadInputRef.current?.click()}
                className="btn-crimson px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Pilih File .EPUB / .TXT</span>
              </button>
              <button
                type="button"
                onClick={onGoToCatalog}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs sm:text-sm font-bold text-slate-700 inline-flex items-center gap-2 cursor-pointer"
              >
                <Compass className="w-4 h-4 text-rose-600" />
                <span>Jelajahi Katalog Novel</span>
              </button>
              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FolderInput className="w-4 h-4" />
                <span>Pulihkan Backup (.json)</span>
              </button>
            </div>
          </div>
        ) : filteredNovels.length === 0 ? (
          <div className="card-pro p-8 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">
              Tidak ada novel yang cocok dengan pencarian &ldquo;{searchQuery}
              &rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
            >
              Reset Pencarian
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredNovels.map((sb) => {
              const pct = computeBookProgressPct(sb);
              const bookmarks = sb.bookmarks ?? [];
              const showBm = Boolean(expandedBookmarks[sb.storageKey]);
              const isLast = lastOpenedBook?.storageKey === sb.storageKey;

              return (
                <div
                  key={sb.storageKey}
                  className="card-pro p-4 flex flex-col justify-between gap-3.5"
                >
                  <div className="flex items-start gap-3.5">
                    <button
                      type="button"
                      onClick={() => handleOpenBook(sb)}
                      className="shrink-0 cursor-pointer group"
                    >
                      {sb.coverDataUrl ? (
                        <img
                          src={sb.coverDataUrl}
                          alt={sb.title}
                          className="w-16 h-24 rounded-xl object-cover border border-slate-200 group-hover:scale-[1.03] transition"
                        />
                      ) : (
                        <MediaCover
                          title={sb.title}
                          category="light_novel"
                          className="w-16 h-24 rounded-xl"
                        />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenBook(sb)}
                          className="text-left min-w-0 cursor-pointer group"
                        >
                          <div className="text-sm font-extrabold text-slate-900 group-hover:text-rose-600 line-clamp-2 leading-snug">
                            {sb.title}
                          </div>
                        </button>
                        {isLast && (
                          <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-[10px] font-extrabold text-sky-700 shrink-0">
                            Aktif
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{formatRelativeTimeId(sb.updatedAt)}</span>
                        <span>•</span>
                        <span>
                          {sb.totalChars.toLocaleString('id-ID')} huruf
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-slate-800 truncate">
                            {formatCheckpointParts(sb)}
                          </span>
                          <span className="font-mono font-extrabold text-rose-600 shrink-0">
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-rose-600 rounded-full"
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bookmarks / Titik Simpan accordion */}
                  {bookmarks.length > 0 && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBookmarks((prev) => ({
                            ...prev,
                            [sb.storageKey]: !prev[sb.storageKey],
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-between gap-2 hover:border-rose-300 transition cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Bookmark className="w-3 h-3 text-rose-600" />
                          <span>
                            Titik Simpan / Bookmark ({bookmarks.length})
                          </span>
                        </span>
                        {showBm ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {showBm && (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                          {bookmarks.map((bm) => (
                            <div
                              key={bm.id}
                              className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2"
                            >
                              <button
                                type="button"
                                onClick={() => handleOpenBook(sb, bm)}
                                className="flex-1 min-w-0 text-left space-y-0.5 cursor-pointer group"
                              >
                                <div className="text-[11px] font-extrabold text-rose-600 group-hover:underline truncate">
                                  Bab {bm.chapterIndex + 1}:{' '}
                                  {bm.chapterTitle || `Bagian ${bm.chapterIndex + 1}`}
                                  {typeof bm.vnIndex === 'number' && bm.vnIndex > 0
                                    ? ` • Paragraf #${bm.vnIndex + 1}`
                                    : ''}
                                </div>
                                {bm.excerpt && (
                                  <div className="text-[11px] text-slate-600 line-clamp-1">
                                    {bm.excerpt}
                                  </div>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteBookmark(sb.storageKey, bm.id)
                                }
                                title="Hapus bookmark"
                                className="p-1 rounded-lg text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenBook(sb)}
                        className="btn-crimson px-3.5 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Lanjutkan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onLogReadingSession(sb.title, 30)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-rose-600" />
                        <span>+ Log</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDeleteBook(sb)}
                      title="Hapus buku dari Library"
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-red-400 text-xs font-bold text-slate-500 hover:text-red-500 inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : watchlistItems.length === 0 ? (
        <div className="card-pro p-8 sm:p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto">
            <Bookmark className="w-6 h-6 text-rose-600" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              {searchQuery
                ? `Tidak ada media yang cocok dengan "${searchQuery}"`
                : 'Daftar Saya (Watchlist) Masih Kosong'}
            </h3>
            <p className="text-xs text-slate-500">
              Tandai anime, manga, visual novel, atau novel favorit dari Katalog
              untuk menyimpan antrean tontonan/bacaan Anda di sini.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="btn-crimson px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Buka Katalog Media</span>
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {watchlistItems.map((item) => {
            const watchedEps = watchedEpisodesMap[item.id] ?? [];
            return (
              <div
                key={item.id}
                className="card-pro p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <MediaCover
                    title={item.title}
                    category={item.category}
                    coverImage={item.coverImage}
                    className="w-14 h-20 rounded-xl shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[10px] font-extrabold text-rose-700">
                        {item.section}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {item.ranking}
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 line-clamp-2 leading-snug">
                      {item.title}
                    </div>
                    {watchedEps.length > 0 && (
                      <div className="text-[11px] font-mono text-emerald-700 font-bold">
                        ✓ {watchedEps.length} episode ditandai
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onOpenCatalogItem(item.title)}
                    className="btn-crimson px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka di Katalog</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveWatchlist(item)}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-red-400 text-xs font-bold text-slate-500 hover:text-red-500 inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {readerTarget && (
        <JapaneseNovelReaderModal
          target={readerTarget}
          userId={userId}
          onClose={() => setReaderTarget(null)}
          onLogReadingSession={(title, mins) =>
            onLogReadingSession(title, mins)
          }
          onBookLibraryChanged={() => {
            void refreshLibrary();
            scheduleCloudLibraryPush(userId);
          }}
        />
      )}
    </div>
  );
};
