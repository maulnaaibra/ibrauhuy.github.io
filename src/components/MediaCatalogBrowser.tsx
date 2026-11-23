import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FolderInput,
  Globe,
  HardDrive,
  Home,
  Library,
  Loader2,
  Play,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import rawCatalog from '../data/immersionCatalog.json';
import { useAuth } from '../context/AuthContext';
import {
  getUniversalDirectSearchPortals,
  isContentNsfwOrHentai,
  searchLiveCatalogMedia,
} from '../lib/liveCatalogSearch';
import {
  getCatalogMediaDestinations,
  type EpubMoeVolume,
} from '../lib/mediaLinks';
import {
  deleteStoredNovelBook,
  getLastOpenedNovelKey,
  getLibraryStorageInfo,
  listStoredNovelBooks,
  loadYatsuBookLinks,
  makeLibraryStorageKey,
  normalizeYatsuUrl,
  parseNovelFile,
  removeYatsuBookLink,
  requestPersistentLibraryStorage,
  resolveYatsuUrl,
  saveStoredNovelBook,
  saveYatsuBookLink,
  setLastOpenedNovelKey,
  type StoredNovelSummary,
} from '../lib/epubReaderStore';
import {
  LIBRARY_DATA_CHANGED_EVENT,
  fetchEnrichedCinematicMedia,
  loadUserWatchlist,
  loadWatchedEpisodesMap,
  toggleUserWatchlistItem,
  toggleWatchedEpisode,
  type EnrichedCinematicMedia,
} from '../lib/mediaCinematicDetails';
import {
  exportFullLibraryBackup,
  importFullLibraryBackup,
  pullCloudLibraryState,
  scheduleCloudLibraryPush,
} from '../lib/libraryCloudSync';
import {
  loadCompanionSettings,
  notifyCompanionMediaLaunch,
} from '../lib/companionClient';
import { resolveCoverUrl } from '../lib/mediaCovers';
import {
  JapaneseNovelReaderModal,
  type NovelReaderTarget,
} from './JapaneseNovelReaderModal';
import { MediaCover } from './MediaCover';
import { getCategoryMeta, type PrimaryMediaCategory } from '../types';

export type CatalogSection =
  | 'Semua'
  | 'Novels'
  | 'Anime'
  | 'Manga'
  | 'Visual Novels'
  | 'Video Games'
  | 'Drama & TV'
  | 'YouTube'
  | 'VTubers'
  | 'Podcasts';

export type DifficultyTier =
  | 'all'
  | 'Very Easy'
  | 'Easy'
  | 'Medium'
  | 'Hard'
  | 'Very Hard';

export interface BettermelonLanguageStats {
  jlptLevel?: string;
  bmDifficulty?: string;
  bmScore?: string;
  wordCount?: number;
  uniqueWords?: number;
  uniqueKanji?: number;
  speechSpeed?: number;
  speechDuration?: string;
}

export interface SheetCatalogItem {
  id: string;
  section: Exclude<CatalogSection, 'Semua'>;
  category: PrimaryMediaCategory;
  ranking: string;
  difficultyTier: string;
  title: string;
  difficultyExplanation: string;
  description: string;
  exampleVideo?: string;
  coverImage?: string;
  suggestedMinutes: number;
  romajiTitle?: string;
  anilistId?: number;
  epubMoeMd5?: string;
  epubMoeVolumes?: EpubMoeVolume[];
  mangadexId?: string;
  sourceUrl?: string;
  sampleUrl?: string;
  directUrl?: string;
  watchUrl?: string;
  downloadUrl?: string;
  bmStats?: BettermelonLanguageStats;
  isNsfw?: boolean;
}

const ALL_ITEMS = rawCatalog as SheetCatalogItem[];

const SECTION_ORDER: CatalogSection[] = [
  'Semua',
  'Novels',
  'Anime',
  'Manga',
  'Visual Novels',
  'Video Games',
  'Drama & TV',
  'YouTube',
  'VTubers',
  'Podcasts',
];

const DIFFICULTY_FILTERS: Array<{ id: DifficultyTier; label: string }> = [
  { id: 'all', label: 'Semua Level' },
  { id: 'Very Easy', label: 'Beginner • N5' },
  { id: 'Easy', label: 'Easy • N4' },
  { id: 'Medium', label: 'Average • N3' },
  { id: 'Hard', label: 'Hard • N2' },
  { id: 'Very Hard', label: 'Expert / Insane • N1' },
];

function getRankingBadgeStyle(tier: string): string {
  switch (tier) {
    case 'Very Easy':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Easy':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Hard':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Very Hard':
      return 'bg-rose-700 text-white border-rose-700';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

interface MediaCatalogBrowserProps {
  onStartMedia: (
    title: string,
    category: PrimaryMediaCategory,
    suggestedMinutes: number
  ) => void;
  defaultSection?: CatalogSection;
  pageSize?: number;
  compact?: boolean;
  initialSelectedTitle?: string | null;
  onClearInitialSelected?: () => void;
  onBackToOverview?: () => void;
}

const CATALOG_SECTION_STORAGE_KEY = 'immersiontrack_catalog_section_v1';
const CATALOG_TIER_STORAGE_KEY = 'immersiontrack_catalog_tier_v1';
const CATALOG_DETAIL_ITEM_CACHE_KEY = 'immersiontrack_catalog_detail_item_v1';

export const MediaCatalogBrowser: React.FC<MediaCatalogBrowserProps> = ({
  onStartMedia,
  defaultSection = 'Semua',
  pageSize: customPageSize,
  compact = false,
  initialSelectedTitle = null,
  onClearInitialSelected,
  onBackToOverview,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<CatalogSection>(() => {
    try {
      const saved = sessionStorage.getItem(CATALOG_SECTION_STORAGE_KEY);
      if (saved && SECTION_ORDER.includes(saved as CatalogSection)) {
        return saved as CatalogSection;
      }
    } catch {
      // ignore
    }
    return defaultSection;
  });
  const [tierFilter, setTierFilter] = useState<DifficultyTier>(() => {
    try {
      const saved = sessionStorage.getItem(CATALOG_TIER_STORAGE_KEY);
      if (
        saved &&
        DIFFICULTY_FILTERS.some((f) => f.id === (saved as DifficultyTier))
      ) {
        return saved as DifficultyTier;
      }
    } catch {
      // ignore
    }
    return 'all';
  });
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [watchlistIds, setWatchlistIds] = useState<string[]>(loadUserWatchlist);
  const [watchedEpisodesMap, setWatchedEpisodesMap] = useState<
    Record<string, number[]>
  >(loadWatchedEpisodesMap);

  const [searchQuery, setSearchQuery] = useState('');
  const [cachedLiveDetail, setCachedLiveDetail] =
    useState<SheetCatalogItem | null>(() => {
      try {
        const raw = sessionStorage.getItem(CATALOG_DETAIL_ITEM_CACHE_KEY);
        return raw ? (JSON.parse(raw) as SheetCatalogItem) : null;
      } catch {
        return null;
      }
    });

  const [liveResults, setLiveResults] = useState<SheetCatalogItem[]>([]);
  const [searchingLive, setSearchingLive] = useState(false);

  const { user } = useAuth();
  const libraryUploadInputRef = useRef<HTMLInputElement | null>(null);
  const libraryBackupInputRef = useRef<HTMLInputElement | null>(null);

  const [readerTarget, setReaderTarget] = useState<NovelReaderTarget | null>(
    null
  );
  const [savedNovels, setSavedNovels] = useState<StoredNovelSummary[]>([]);
  const [showLibraryShelf, setShowLibraryShelf] = useState(false);
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [importingLibrary, setImportingLibrary] = useState(false);
  const [restoringLibrary, setRestoringLibrary] = useState(false);

  const storedBooksMap = useMemo(() => {
    const map: Record<
      string,
      { totalChars: number; currentChapter: number; chapterCount: number }
    > = {};
    for (const item of savedNovels) {
      map[item.storageKey] = {
        totalChars: item.totalChars,
        currentChapter: item.currentChapter,
        chapterCount: item.chapterCount,
      };
    }
    return map;
  }, [savedNovels]);

  const [yatsuLinks, setYatsuLinks] = useState<Record<string, string>>(
    loadYatsuBookLinks
  );
  const [yatsuInputDraft, setYatsuInputDraft] = useState('');

  const refreshStoredBooks = useCallback(async () => {
    const [items, storage] = await Promise.all([
      listStoredNovelBooks(),
      getLibraryStorageInfo(),
    ]);
    setSavedNovels(items);
    setStoragePersisted(storage.persisted);
  }, []);

  useEffect(() => {
    void requestPersistentLibraryStorage().then((persisted) => {
      if (persisted) setStoragePersisted(true);
    });
    void refreshStoredBooks();
  }, [refreshStoredBooks]);

  useEffect(() => {
    if (!user?.id) return;
    void pullCloudLibraryState(user.id).then((pulled) => {
      if (pulled) {
        setWatchlistIds(loadUserWatchlist());
        setWatchedEpisodesMap(loadWatchedEpisodesMap());
        setYatsuLinks(loadYatsuBookLinks());
        void refreshStoredBooks();
      }
    });
  }, [user?.id, refreshStoredBooks]);

  useEffect(() => {
    const syncLocalViews = () => {
      setWatchlistIds(loadUserWatchlist());
      setWatchedEpisodesMap(loadWatchedEpisodesMap());
      setYatsuLinks(loadYatsuBookLinks());
      void refreshStoredBooks();
    };
    window.addEventListener(LIBRARY_DATA_CHANGED_EVENT, syncLocalViews);
    return () =>
      window.removeEventListener(LIBRARY_DATA_CHANGED_EVENT, syncLocalViews);
  }, [refreshStoredBooks]);

  const mediaIdFromUrl = searchParams.get('media');

  const selectedDetail = useMemo<SheetCatalogItem | null>(() => {
    if (!mediaIdFromUrl) return null;
    const fromStatic = ALL_ITEMS.find((i) => i.id === mediaIdFromUrl);
    if (fromStatic) return fromStatic;
    const fromLive = liveResults.find((i) => i.id === mediaIdFromUrl);
    if (fromLive) return fromLive;
    if (cachedLiveDetail && cachedLiveDetail.id === mediaIdFromUrl) {
      return cachedLiveDetail;
    }
    return null;
  }, [mediaIdFromUrl, liveResults, cachedLiveDetail]);

  useEffect(() => {
    if (!selectedDetail) {
      setYatsuInputDraft('');
      return;
    }
    setYatsuInputDraft(yatsuLinks[`catalog:${selectedDetail.id}`] ?? '');
  }, [selectedDetail, yatsuLinks]);

  const setSelectedDetail = useCallback(
    (item: SheetCatalogItem | null) => {
      if (item) {
        setCachedLiveDetail(item);
        try {
          sessionStorage.setItem(
            CATALOG_DETAIL_ITEM_CACHE_KEY,
            JSON.stringify(item)
          );
        } catch {
          // ignore
        }
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('media', item.id);
          return next;
        });
      } else {
        setSearchParams((prev) => {
          if (!prev.has('media')) return prev;
          const next = new URLSearchParams(prev);
          next.delete('media');
          return next;
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [setSearchParams]
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(CATALOG_SECTION_STORAGE_KEY, section);
    } catch {
      // ignore
    }
  }, [section]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CATALOG_TIER_STORAGE_KEY, tierFilter);
    } catch {
      // ignore
    }
  }, [tierFilter]);

  const [enrichedMedia, setEnrichedMedia] =
    useState<EnrichedCinematicMedia | null>(null);
  const [loadingEnriched, setLoadingEnriched] = useState(false);

  const pageSize = customPageSize ?? (compact ? 12 : 24);
  const [visibleLimit, setVisibleLimit] = useState(pageSize);

  // Open initial selected title if passed from Overview
  useEffect(() => {
    if (!initialSelectedTitle) return;
    const norm = initialSelectedTitle.trim().toLowerCase();
    const match = ALL_ITEMS.find(
      (i) =>
        i.title.trim().toLowerCase() === norm ||
        (i.romajiTitle && i.romajiTitle.trim().toLowerCase() === norm)
    );
    if (match) {
      setSelectedDetail(match);
    }
    onClearInitialSelected?.();
  }, [initialSelectedTitle, onClearInitialSelected, setSelectedDetail]);

  // Fetch rich cinematic details (backdrop banner, score, episodes, cast & seiyuu) when an item is selected
  useEffect(() => {
    if (!selectedDetail) {
      setEnrichedMedia(null);
      return;
    }
    let active = true;
    setLoadingEnriched(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    fetchEnrichedCinematicMedia(selectedDetail)
      .then((res) => {
        if (!active) return;
        setEnrichedMedia(res);
      })
      .finally(() => {
        if (active) setLoadingEnriched(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDetail]);

  // Keyboard shortcuts inside Cinematic Showcase View (Esc / Backspace = Back, P = Play, L = Add to List)
  useEffect(() => {
    if (!selectedDetail || readerTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        setSelectedDetail(null);
      } else if (
        (e.key === 'p' || e.key === 'P') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        const dest = getCatalogMediaDestinations(selectedDetail);
        if (selectedDetail.section === 'Novels') {
          setReaderTarget({
            storageKey: `catalog:${selectedDetail.id}`,
            catalogItemId: selectedDetail.id,
            title: selectedDetail.title,
            downloadUrl: 'https://epub.moe/',
            volumes: dest.volumes,
          });
        } else {
          window.open(dest.primary.url, '_blank', 'noopener,noreferrer');
        }
      } else if (
        (e.key === 'l' || e.key === 'L') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        const res = toggleUserWatchlistItem(selectedDetail.id);
        setWatchlistIds(res.list);
        toast.success(
          res.added
            ? `「${selectedDetail.title}」 ditambahkan ke Daftar Saya!`
            : `「${selectedDetail.title}」 dihapus dari Daftar Saya`
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedDetail, setSelectedDetail, readerTarget]);

  // Live API Search (AniList Anime/Manga/Novel + VNDB)
  useEffect(() => {
    const clean = searchQuery.trim();
    if (clean.length < 2 || isContentNsfwOrHentai({ text: clean })) {
      setLiveResults([]);
      setSearchingLive(false);
      return;
    }

    let cancelled = false;
    setSearchingLive(true);
    const timer = setTimeout(async () => {
      try {
        const fetched = await searchLiveCatalogMedia(clean, section);
        if (!cancelled) {
          setLiveResults(fetched);
        }
      } catch {
        if (!cancelled) {
          setLiveResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchingLive(false);
        }
      }
    }, 380);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, section]);

  // Permanent safe items (all NSFW/Hentai/18+ items are strictly excluded)
  const safeCatalogItems = useMemo(() => {
    return ALL_ITEMS.filter(
      (item) =>
        !item.isNsfw &&
        !isContentNsfwOrHentai({
          text: `${item.title} ${item.romajiTitle ?? ''} ${item.description}`,
        })
    );
  }, []);

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = { Semua: safeCatalogItems.length };
    for (const item of safeCatalogItems) {
      counts[item.section] = (counts[item.section] ?? 0) + 1;
    }
    return counts;
  }, [safeCatalogItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q && isContentNsfwOrHentai({ text: q })) {
      return [];
    }

    const localMatched = safeCatalogItems.filter((item) => {
      if (onlyWatchlist && !watchlistIds.includes(item.id)) return false;
      if (section !== 'Semua' && item.section !== section) return false;
      if (tierFilter !== 'all' && item.difficultyTier !== tierFilter)
        return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.romajiTitle && item.romajiTitle.toLowerCase().includes(q)) ||
        item.description.toLowerCase().includes(q) ||
        item.difficultyExplanation.toLowerCase().includes(q) ||
        item.ranking.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
      );
    });

    if (!q || liveResults.length === 0 || onlyWatchlist) {
      return localMatched;
    }

    const seenAnilist = new Set<number>();
    const seenTitles = new Set<string>();
    for (const item of localMatched) {
      if (item.anilistId) seenAnilist.add(item.anilistId);
      seenTitles.add(item.title.trim().toLowerCase());
    }

    const extraLive = liveResults.filter((item) => {
      if (item.isNsfw) return false;
      if (section !== 'Semua' && item.section !== section) return false;
      if (tierFilter !== 'all' && item.difficultyTier !== tierFilter)
        return false;
      if (item.anilistId && seenAnilist.has(item.anilistId)) return false;
      const norm = item.title.trim().toLowerCase();
      if (seenTitles.has(norm)) return false;
      if (item.anilistId) seenAnilist.add(item.anilistId);
      seenTitles.add(norm);
      return true;
    });

    return [...localMatched, ...extraLive];
  }, [
    safeCatalogItems,
    section,
    tierFilter,
    searchQuery,
    liveResults,
    onlyWatchlist,
    watchlistIds,
  ]);

  const universalPortals = useMemo(() => {
    const portals = getUniversalDirectSearchPortals(searchQuery);
    if (section === 'Semua') return portals;
    const filtered = portals.filter((p) => p.section === section);
    return filtered.length > 0 ? filtered : portals;
  }, [searchQuery, section]);

  const visibleItems = filteredItems.slice(0, visibleLimit);
  const hasMore = visibleLimit < filteredItems.length;

  const handleSelectSection = (nextSection: CatalogSection) => {
    setSection(nextSection);
    setVisibleLimit(pageSize);
  };

  const handleSelectTier = (nextTier: DifficultyTier) => {
    setTierFilter(nextTier);
    setVisibleLimit(pageSize);
  };

  const handleExternalLaunch = (
    title: string,
    siteName: string,
    category: PrimaryMediaCategory = 'anime',
    url?: string
  ) => {
    const companion = loadCompanionSettings();
    void notifyCompanionMediaLaunch(companion.url, { title, category, url });
    try {
      void navigator.clipboard?.writeText(title);
      toast.success(`Membuka ${siteName} • Tracking 「${title}」 dimulai!`);
    } catch {
      toast.success(`Membuka ${siteName}...`);
    }
  };

  const handleToggleWatchlist = (item: SheetCatalogItem) => {
    const res = toggleUserWatchlistItem(item.id);
    setWatchlistIds(res.list);
    scheduleCloudLibraryPush(user?.id);
    toast.success(
      res.added
        ? `「${item.title}」 ditambahkan ke Daftar Saya!`
        : `「${item.title}」 dihapus dari Daftar Saya`
    );
  };

  const handleToggleEpisodeWatched = (
    item: SheetCatalogItem,
    epNum: number,
    autoLog = false
  ) => {
    const updated = toggleWatchedEpisode(item.id, epNum);
    setWatchedEpisodesMap((prev) => ({ ...prev, [item.id]: updated }));
    scheduleCloudLibraryPush(user?.id);
    if (autoLog && updated.includes(epNum)) {
      onStartMedia(
        `${item.title} (Episode ${epNum})`,
        item.category,
        item.suggestedMinutes
      );
    }
  };

  const handleUploadBooksToLibrary = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImportingLibrary(true);
    let importedCount = 0;
    let lastTitle = '';
    try {
      for (const file of Array.from(files)) {
        const storageKey = makeLibraryStorageKey(file.name);
        const parsed = await parseNovelFile(file, { storageKey });
        await saveStoredNovelBook(parsed);
        importedCount += 1;
        lastTitle = parsed.title;
      }
      await refreshStoredBooks();
      scheduleCloudLibraryPush(user?.id);
      setShowLibraryShelf(true);
      toast.success(
        importedCount === 1
          ? `「${lastTitle}」 tersimpan di Library permanen!`
          : `${importedCount} buku tersimpan di Library permanen!`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal menambah buku ke Library.'
      );
    } finally {
      setImportingLibrary(false);
    }
  };

  const handleDeleteBookFromShelf = async (storageKey: string, title: string) => {
    await deleteStoredNovelBook(storageKey);
    await refreshStoredBooks();
    scheduleCloudLibraryPush(user?.id);
    toast.success(`「${title}」 dihapus dari Library.`);
  };

  const handleExportLibraryBackup = async () => {
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
        `Backup (${backup.bookCount} buku, ${backup.watchlistCount} Daftar Saya) diunduh!`
      );
    } catch {
      toast.error('Gagal mengunduh backup library.');
    }
  };

  const handleRestoreLibraryBackup = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoringLibrary(true);
    try {
      const raw = await file.text();
      const res = await importFullLibraryBackup(raw, user?.id);
      setWatchlistIds(loadUserWatchlist());
      setWatchedEpisodesMap(loadWatchedEpisodesMap());
      setYatsuLinks(loadYatsuBookLinks());
      await refreshStoredBooks();
      setShowLibraryShelf(true);
      toast.success(
        `Dipulihkan: ${res.booksImported} buku & ${res.watchlistCount} Daftar Saya!`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal memulihkan file backup.'
      );
    } finally {
      setRestoringLibrary(false);
      e.target.value = '';
    }
  };

  const handleOpenLastOrFirstLibraryBook = () => {
    const lastKey = getLastOpenedNovelKey();
    const matched =
      savedNovels.find((b) => b.storageKey === lastKey) ?? savedNovels[0];
    if (matched) {
      setLastOpenedNovelKey(matched.storageKey);
      setReaderTarget({
        storageKey: matched.storageKey,
        catalogItemId: matched.catalogItemId,
        title: matched.title,
      });
      return;
    }
    setReaderTarget({
      storageKey: 'local:library',
      title: 'Reader Novel EPUB (Support Yomitan)',
    });
  };

  const handleCopyTitle = async (title: string) => {
    try {
      await navigator.clipboard.writeText(title);
      toast.success(`Judul 「${title}」 berhasil disalin!`);
    } catch {
      toast.error('Gagal menyalin judul');
    }
  };

  const handleOpenEpubDownloadPortal = (titleToCopy: string) => {
    try {
      void navigator.clipboard?.writeText(titleToCopy);
    } catch {
      // ignore clipboard errors
    }
    toast.success(
      `Judul 「${titleToCopy}」 disalin! Tempel (Ctrl+V) di Epub.moe → Enter → klik Download.`
    );
  };

  const readerModal = readerTarget ? (
    <JapaneseNovelReaderModal
      target={readerTarget}
      userId={user?.id}
      onClose={() => setReaderTarget(null)}
      onLogReadingSession={(title, mins) =>
        onStartMedia(title, 'light_novel', mins)
      }
      onBookLibraryChanged={() => {
        void refreshStoredBooks();
        scheduleCloudLibraryPush(user?.id);
      }}
    />
  ) : null;

  // ============================================================================
  // CINEMATIC SHOWCASE & TIMELINE VIEW (Movy / Netflix Theater Layout)
  // Rendered when user clicks any media item instead of jumping directly out!
  // ============================================================================
  if (selectedDetail) {
    const dest = getCatalogMediaDestinations(selectedDetail);
    const inWatchlist = watchlistIds.includes(selectedDetail.id);
    const watchedEps = watchedEpisodesMap[selectedDetail.id] ?? [];

    const coverUrl =
      enrichedMedia?.coverExtraLarge ||
      resolveCoverUrl(selectedDetail.coverImage);
    const wideBannerUrl =
      enrichedMedia?.bannerImage || enrichedMedia?.widescreenStill || null;

    const scoreDisplay =
      enrichedMedia?.averageScore ??
      (selectedDetail.bmStats?.bmScore
        ? Number(selectedDetail.bmStats.bmScore)
        : 8.6);
    const yearDisplay = enrichedMedia?.seasonYear ?? 2024;
    const totalEpisodes =
      enrichedMedia?.episodes ||
      (selectedDetail.section === 'Anime'
        ? 12
        : selectedDetail.section === 'Drama & TV'
          ? 10
          : 0);
    const durationText =
      selectedDetail.section === 'Anime'
        ? `${enrichedMedia?.durationMinutes ?? selectedDetail.suggestedMinutes}m / eps`
        : `~${selectedDetail.suggestedMinutes}m / sesi`;

    const genresList =
      enrichedMedia?.genres && enrichedMedia.genres.length > 0
        ? enrichedMedia.genres
        : [selectedDetail.section, selectedDetail.ranking];

    const synopsisText =
      selectedDetail.description ||
      enrichedMedia?.synopsisHtml ||
      selectedDetail.difficultyExplanation ||
      'Klik tombol Play di bawah untuk mulai menonton atau membaca konten ini dalam bahasa Jepang asli, lengkap dengan pelacakan durasi otomatis.';

    const playUrl =
      selectedDetail.section === 'Anime' && selectedDetail.anilistId
        ? `https://bettermelon.ru/watch/${selectedDetail.anilistId}/${
            watchedEps.length > 0 ? Math.min(totalEpisodes || 99, Math.max(...watchedEps) + 1) : 1
          }`
        : dest.primary.url;

    const isNovel = selectedDetail.section === 'Novels';
    const isAozoraNovel = Boolean(
      selectedDetail.sourceUrl?.includes('aozora.gr.jp')
    );
    const novelOnlineUrl =
      isAozoraNovel && selectedDetail.sourceUrl
        ? selectedDetail.sourceUrl
        : `https://yomou.syosetu.com/search.php?word=${encodeURIComponent(
            selectedDetail.title
          )}`;

    const downloadOrSecondaryLink = isNovel
      ? 'https://epub.moe/'
      : dest.quickSecondary?.url ||
        dest.alternatives[0]?.url ||
        dest.primary.url;

    const episodeNumbers =
      totalEpisodes > 0
        ? Array.from({ length: Math.min(totalEpisodes, 48) }, (_, i) => i + 1)
        : [];

    const novelStorageKey = `catalog:${selectedDetail.id}`;
    const hasSavedBook = Boolean(storedBooksMap[novelStorageKey]);
    const linkedYatsuBookUrl = yatsuLinks[novelStorageKey];
    const yatsuTargetUrl = resolveYatsuUrl(novelStorageKey, yatsuLinks);

    return (
      <div className="rounded-2xl sm:rounded-3xl bg-[#09090d] text-white overflow-hidden shadow-2xl border border-white/10 animate-fade-in">
        {/* DEDICATED TOP BACK NAVIGATION BAR (Always clear & easy to tap on iOS / Mobile) */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-[#12121a] border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedDetail(null)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/20 active:bg-white/25 border border-white/15 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Kembali ke Katalog</span>
            </button>

            {onBackToOverview && (
              <button
                type="button"
                onClick={onBackToOverview}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/85 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Home className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Overview</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {loadingEnriched && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/75">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                <span className="hidden sm:inline">Memuat info...</span>
              </span>
            )}
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-white/70">
              Esc: Kembali • P: Play • L: List
            </span>
            <span className="px-2.5 py-1 rounded-full bg-rose-600/20 border border-rose-500/35 text-[11px] font-bold text-rose-300">
              {selectedDetail.section}
            </span>
          </div>
        </div>

        {/* HERO STAGE — Proportional Widescreen Banner + Overlap Info Stage */}
        <div className="relative overflow-hidden">
          {/* Top Proportional Widescreen Backdrop Stage */}
          <div className="relative h-40 sm:h-64 lg:h-76 w-full overflow-hidden bg-[#101018]">
            {wideBannerUrl ? (
              <img
                src={wideBannerUrl}
                alt={selectedDetail.title}
                className="w-full h-full object-cover object-center"
              />
            ) : coverUrl ? (
              <>
                <img
                  src={coverUrl}
                  alt=""
                  className="w-full h-full object-cover object-center scale-110 blur-2xl opacity-45"
                />
                <div className="absolute inset-0 flex items-center justify-end pr-6 sm:pr-12 opacity-65">
                  <img
                    src={coverUrl}
                    alt={selectedDetail.title}
                    className="h-full w-auto object-contain"
                  />
                </div>
              </>
            ) : null}

            {/* Smooth Cinema Vignette Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090d]/85 via-[#09090d]/35 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090d] via-[#09090d]/45 to-transparent" />
          </div>

          {/* Hero Info & Action Controls */}
          <div className="relative z-10 -mt-8 sm:-mt-24 px-4 sm:px-10 pb-6 sm:pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8">
            <div className="space-y-3 sm:space-y-4 max-w-2xl">
              {/* Romaji / Section Eyebrow */}
              {selectedDetail.romajiTitle &&
                selectedDetail.romajiTitle !== selectedDetail.title && (
                  <div className="text-[11px] sm:text-sm font-bold uppercase tracking-widest text-rose-400/95 drop-shadow">
                    {selectedDetail.romajiTitle}
                  </div>
                )}

              {/* Big Display Title */}
              <h1 className="text-2xl sm:text-5xl font-black tracking-tight text-white leading-[1.1] drop-shadow-lg">
                {selectedDetail.title}
              </h1>

              {/* Metadata Line: ★ Score • ↑ Kanji/Pop • Year • Duration • [4K/HD] [JLPT] */}
              <div className="flex items-center gap-2.5 flex-wrap text-xs sm:text-sm font-semibold text-white/85">
                <span className="inline-flex items-center gap-1 text-rose-500 font-extrabold">
                  <Star className="w-4 h-4 fill-rose-500 text-rose-500" />
                  {scoreDisplay}
                </span>

                <span>•</span>

                {selectedDetail.bmStats?.uniqueKanji ? (
                  <span className="inline-flex items-center gap-1 text-white/80">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    {selectedDetail.bmStats.uniqueKanji.toLocaleString('id-ID')}{' '}
                    Kanji
                  </span>
                ) : enrichedMedia?.popularity ? (
                  <span className="inline-flex items-center gap-1 text-white/80">
                    ↑ {(enrichedMedia.popularity / 1000).toFixed(1)}k
                  </span>
                ) : null}

                <span>•</span>
                <span>{yearDisplay}</span>

                <span>•</span>
                <span>{durationText}</span>

                {totalEpisodes > 0 && (
                  <>
                    <span>•</span>
                    <span>{totalEpisodes} Eps</span>
                  </>
                )}

                <span className="px-2 py-0.5 rounded border border-white/25 bg-white/10 text-[11px] font-mono font-bold tracking-wide">
                  SUB JP
                </span>

                <span className="px-2 py-0.5 rounded border border-rose-500/50 bg-rose-500/20 text-rose-200 text-[11px] font-mono font-bold">
                  {selectedDetail.bmStats?.jlptLevel
                    ? `JLPT ${selectedDetail.bmStats.jlptLevel}`
                    : selectedDetail.ranking}
                </span>
              </div>

              {/* Genres Row */}
              <div className="text-xs sm:text-sm font-medium text-white/75 flex items-center gap-2 flex-wrap">
                {genresList.map((g, idx) => (
                  <React.Fragment key={g}>
                    {idx > 0 && <span className="text-white/40">•</span>}
                    <span>{g}</span>
                  </React.Fragment>
                ))}
                {enrichedMedia?.studio && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="text-rose-300 font-semibold">
                      Studio: {enrichedMedia.studio}
                    </span>
                  </>
                )}
              </div>

              {/* Synopsis */}
              <p className="text-xs sm:text-[15px] text-white/80 leading-relaxed line-clamp-4 max-w-xl">
                {synopsisText}
              </p>

              {/* Primary Action Buttons Row (Exact Match to Screenshot: Play | + Add to List | Download | + Log) */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap pt-2">
                {isNovel ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setReaderTarget({
                          storageKey: novelStorageKey,
                          catalogItemId: selectedDetail.id,
                          title: selectedDetail.title,
                          downloadUrl: downloadOrSecondaryLink,
                          volumes: dest.volumes,
                        })
                      }
                      className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 shadow-xl transition cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-slate-950 shrink-0" />
                      <span>
                        {hasSavedBook
                          ? 'Lanjut Baca (Yomitan)'
                          : 'Baca di Reader (Yomitan)'}
                      </span>
                    </button>

                    <a
                      href={yatsuTargetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        handleExternalLaunch(
                          selectedDetail.title,
                          'Yatsu Reader',
                          selectedDetail.category,
                          yatsuTargetUrl
                        )
                      }
                      className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span>
                        {linkedYatsuBookUrl
                          ? 'Baca di Yatsu (Langsung)'
                          : 'Buka Yatsu Library'}
                      </span>
                    </a>

                    <a
                      href={novelOnlineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        handleExternalLaunch(
                          selectedDetail.title,
                          isAozoraNovel ? 'Aozora Bunko' : 'Syosetu',
                          selectedDetail.category,
                          novelOnlineUrl
                        )
                      }
                      className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition cursor-pointer"
                    >
                      <Globe className="w-4 h-4 shrink-0" />
                      <span>
                        {isAozoraNovel
                          ? 'Baca Online (Aozora • Yomitan)'
                          : 'Baca Online (Syosetu • Yomitan)'}
                      </span>
                    </a>
                  </>
                ) : (
                  <a
                    href={playUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      handleExternalLaunch(
                        selectedDetail.title,
                        dest.primary.siteName,
                        selectedDetail.category,
                        playUrl
                      )
                    }
                    className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 shadow-xl transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                    <span>
                      {selectedDetail.section === 'Manga' ? 'Baca' : 'Play'}{' '}
                      {selectedDetail.section === 'Anime' &&
                      watchedEps.length > 0
                        ? `Ep ${Math.min(
                            totalEpisodes || 99,
                            Math.max(...watchedEps) + 1
                          )}`
                        : `(${dest.primary.siteName})`}
                    </span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => handleToggleWatchlist(selectedDetail)}
                  className={`px-5 py-3 rounded-xl backdrop-blur-md border text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer ${
                    inWatchlist
                      ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/35'
                      : 'bg-white/15 hover:bg-white/25 border-white/15 text-white'
                  }`}
                >
                  {inWatchlist ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>In My List</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Add to List</span>
                    </>
                  )}
                </button>

                <a
                  href={downloadOrSecondaryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (isNovel) {
                      handleOpenEpubDownloadPortal(selectedDetail.title);
                    } else {
                      handleExternalLaunch(
                        selectedDetail.title,
                        dest.quickSecondary?.siteName || dest.primary.siteName,
                        selectedDetail.category,
                        downloadOrSecondaryLink
                      );
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/15 text-white text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {isNovel
                      ? 'Unduh EPUB (Epub.moe)'
                      : dest.quickSecondary?.shortLabel || 'Download / Portal'}
                  </span>
                </a>

                <button
                  type="button"
                  onClick={() =>
                    onStartMedia(
                      selectedDetail.title,
                      selectedDetail.category,
                      selectedDetail.suggestedMinutes
                    )
                  }
                  className="px-5 py-3 rounded-xl bg-rose-600/90 hover:bg-rose-600 border border-rose-400/30 text-white text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Catat Sesi (+{selectedDetail.suggestedMinutes}m)</span>
                </button>
              </div>
            </div>

            {/* Optional Poster Card on the Right (Desktop) */}
            {coverUrl && (
              <div className="hidden lg:block shrink-0">
                <img
                  src={coverUrl}
                  alt={selectedDetail.title}
                  className="w-44 h-64 object-cover rounded-2xl border-2 border-white/15 shadow-2xl"
                />
              </div>
            )}
          </div>
        </div>

        {/* LOWER SECTIONS: Cast, Timeline Episodes / Volumes, Language Metrics & Portals */}
        <div className="px-6 sm:px-10 pb-10 pt-4 space-y-8 border-t border-white/10">
          {/* 1. CAST & SEIYUU (Just like the Cast row in the screenshot!) */}
          {enrichedMedia?.cast && enrichedMedia.cast.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Cast & Seiyuu (Pengisi Suara)
                </h2>
                <span className="text-xs text-white/50">
                  {enrichedMedia.cast.length} karakter utama
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                {enrichedMedia.cast.map((c) => (
                  <div
                    key={c.id}
                    className="group rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 overflow-hidden transition flex flex-col"
                  >
                    <div className="h-52 sm:h-60 w-full bg-white/5 overflow-hidden relative">
                      {c.image ? (
                        <img
                          src={c.image}
                          alt={c.name}
                          loading="lazy"
                          className="w-full h-full object-cover object-top group-hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                          No Image
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white/90">
                        {c.role}
                      </span>
                    </div>
                    <div className="p-3 space-y-1 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-white truncate">
                          {c.nativeName || c.name}
                        </div>
                        {c.nativeName && c.name !== c.nativeName && (
                          <div className="text-[11px] text-white/55 truncate">
                            {c.name}
                          </div>
                        )}
                      </div>
                      {(c.voiceActorNative || c.voiceActorName) && (
                        <div className="pt-1.5 border-t border-white/10 text-[11px] text-rose-300/90 truncate">
                          CV: {c.voiceActorNative || c.voiceActorName}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. TIMELINE EPISODE / VOLUME & PROGRES IMMERSION */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {selectedDetail.section === 'Anime' ||
                  selectedDetail.section === 'Drama & TV'
                    ? `Timeline Episode (${watchedEps.length}/${totalEpisodes || 12} Selesai)`
                    : dest.volumes && dest.volumes.length > 0
                      ? `Timeline Volume Novel — Yatsu Reader (${dest.volumes.length} Volume)`
                      : 'Timeline & Sumber Immersion Langsung'}
                </h2>
                <p className="text-xs text-white/55 mt-0.5">
                  Pilih episode atau volume untuk mulai menonton/membaca, atau
                  tandai selesai untuk mencatat progres ke timeline Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCopyTitle(selectedDetail.title)}
                className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white/90 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Salin Judul Jepang
              </button>
            </div>

            {/* Anime / Drama Episode Timeline Grid */}
            {episodeNumbers.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {episodeNumbers.map((ep) => {
                  const isDone = watchedEps.includes(ep);
                  const epWatchUrl =
                    selectedDetail.section === 'Anime' &&
                    selectedDetail.anilistId
                      ? `https://bettermelon.ru/watch/${selectedDetail.anilistId}/${ep}`
                      : dest.primary.url;

                  return (
                    <div
                      key={ep}
                      className={`p-3 rounded-2xl border transition flex flex-col justify-between gap-2.5 ${
                        isDone
                          ? 'bg-emerald-500/15 border-emerald-400/40'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-white">
                          Episode {ep}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleEpisodeWatched(selectedDetail, ep, true)
                          }
                          title={
                            isDone
                              ? 'Batal tandai selesai'
                              : 'Tandai selesai & catat sesi'
                          }
                          className={`p-1 rounded-lg transition cursor-pointer ${
                            isDone
                              ? 'text-emerald-400 hover:bg-emerald-500/20'
                              : 'text-white/40 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-[11px] text-white/50 font-mono">
                        ~{enrichedMedia?.durationMinutes ?? selectedDetail.suggestedMinutes} menit
                      </div>

                      <a
                        href={epWatchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          handleExternalLaunch(
                            `${selectedDetail.title} - Episode ${ep}`,
                            dest.primary.siteName,
                            selectedDetail.category,
                            epWatchUrl
                          )
                        }
                        className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition ${
                          isDone
                            ? 'bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/35'
                            : 'bg-white text-slate-950 hover:bg-slate-200'
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{isDone ? 'Tonton Ulang' : 'Putar'}</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Novel Yatsu Direct Book Link Connector */}
            {isNovel && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-500/[0.08] border border-sky-400/25 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>
                      Hubungkan Link Buku Yatsu (Opsional — agar tombol Yatsu
                      langsung buka bukunya)
                    </span>
                  </div>
                  {linkedYatsuBookUrl && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-[10px] font-bold text-emerald-300">
                      ✓ Link Yatsu Terpasang
                    </span>
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const normalized = normalizeYatsuUrl(yatsuInputDraft);
                    if (!normalized) {
                      toast.error(
                        'Tempel link buku dari Yatsu, misalnya https://app.yatsu.moe/b?id=...'
                      );
                      return;
                    }
                    const next = saveYatsuBookLink(novelStorageKey, normalized);
                    setYatsuLinks(next);
                    setYatsuInputDraft(normalized);
                    scheduleCloudLibraryPush(user?.id);
                    toast.success('Link buku Yatsu tersimpan!');
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    value={yatsuInputDraft}
                    onChange={(e) => setYatsuInputDraft(e.target.value)}
                    placeholder="Tempel link https://app.yatsu.moe/b?id=... atau ID buku Yatsu"
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-black/30 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-sky-400"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="submit"
                      className="btn-crimson px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Simpan Link
                    </button>
                    {linkedYatsuBookUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = removeYatsuBookLink(novelStorageKey);
                          setYatsuLinks(next);
                          setYatsuInputDraft('');
                          scheduleCloudLibraryPush(user?.id);
                          toast.success('Link Yatsu dihapus.');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white/80 cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* Novel Yomitan / Yatsu Reader Volumes Timeline */}
            {dest.volumes && dest.volumes.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dest.volumes.map((vol, idx) => {
                  const volKey = `vol:${vol.md5}`;
                  const volSaved = Boolean(storedBooksMap[volKey]);
                  const volYatsuUrl = yatsuLinks[volKey] || yatsuTargetUrl;
                  return (
                    <div
                      key={vol.md5}
                      className="p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex flex-col justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-rose-400">
                            Volume {idx + 1}
                          </div>
                          <div className="text-xs font-bold text-white truncate">
                            {vol.title}
                          </div>
                        </div>
                        {volSaved && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-[10px] font-bold text-emerald-300 shrink-0">
                            ✓ Siap Baca
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setReaderTarget({
                              storageKey: volKey,
                              catalogItemId: selectedDetail.id,
                              title: vol.title,
                              downloadUrl: 'https://epub.moe/',
                            })
                          }
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white text-slate-950 text-xs font-extrabold hover:bg-slate-200 inline-flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3 text-slate-950" />
                          <span>{volSaved ? 'Lanjut Baca' : 'Baca'}</span>
                        </button>
                        <a
                          href="https://epub.moe/"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            handleOpenEpubDownloadPortal(vol.title)
                          }
                          title="Salin judul volume ini & buka Epub.moe untuk download EPUB"
                          className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          EPUB
                        </a>
                        <a
                          href={volYatsuUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            handleExternalLaunch(
                              vol.title,
                              'Yatsu Reader',
                              selectedDetail.category,
                              volYatsuUrl
                            )
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 text-xs font-bold inline-flex items-center gap-1"
                        >
                          Yatsu
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Alternative Sources & Portals Bar */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-white/60">
                Semua Server & Portal Akses ({selectedDetail.title})
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={dest.primary.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    handleExternalLaunch(
                      selectedDetail.title,
                      dest.primary.siteName,
                      selectedDetail.category,
                      dest.primary.url
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold inline-flex items-center gap-2 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {dest.primary.label} ({dest.primary.siteName})
                </a>

                {dest.alternatives.map((alt) => (
                  <a
                    key={alt.label}
                    href={alt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      handleExternalLaunch(
                        selectedDetail.title,
                        alt.siteName,
                        selectedDetail.category,
                        alt.url
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
                    {alt.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* 3. LANGUAGE DIFFICULTY & BETTERMELON METRICS */}
          {(selectedDetail.bmStats ||
            selectedDetail.difficultyExplanation) && (
            <div className="grid md:grid-cols-2 gap-4">
              {selectedDetail.bmStats && (
                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                      Analisis Bahasa & JLPT (Bettermelon)
                    </span>
                    {selectedDetail.bmStats.jlptLevel && (
                      <span className="px-2.5 py-0.5 rounded-md bg-rose-600 text-white text-xs font-mono font-bold">
                        JLPT {selectedDetail.bmStats.jlptLevel}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    {selectedDetail.bmStats.bmDifficulty && (
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <div className="text-[11px] text-white/50">
                          Level Bahasa
                        </div>
                        <div className="font-extrabold text-white mt-0.5">
                          {selectedDetail.bmStats.bmDifficulty}
                        </div>
                      </div>
                    )}
                    {selectedDetail.bmStats.uniqueKanji && (
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <div className="text-[11px] text-white/50">
                          Kanji Unik
                        </div>
                        <div className="font-mono font-extrabold text-white mt-0.5">
                          {selectedDetail.bmStats.uniqueKanji.toLocaleString(
                            'id-ID'
                          )}{' '}
                          kanji
                        </div>
                      </div>
                    )}
                    {selectedDetail.bmStats.speechSpeed && (
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <div className="text-[11px] text-white/50">
                          Kecepatan Dialog
                        </div>
                        <div className="font-mono font-extrabold text-white mt-0.5">
                          {selectedDetail.bmStats.speechSpeed} mora/m
                        </div>
                      </div>
                    )}
                    {selectedDetail.bmStats.wordCount && (
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <div className="text-[11px] text-white/50">
                          Total Kata
                        </div>
                        <div className="font-mono font-extrabold text-white mt-0.5">
                          {selectedDetail.bmStats.wordCount.toLocaleString(
                            'id-ID'
                          )}
                        </div>
                      </div>
                    )}
                    {selectedDetail.bmStats.uniqueWords && (
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <div className="text-[11px] text-white/50">
                          Kosakata Unik
                        </div>
                        <div className="font-mono font-extrabold text-white mt-0.5">
                          {selectedDetail.bmStats.uniqueWords.toLocaleString(
                            'id-ID'
                          )}
                        </div>
                      </div>
                    )}
                    {selectedDetail.bmStats.speechDuration && (
                      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                        <div className="text-[11px] text-white/50">
                          Durasi Dialog
                        </div>
                        <div className="font-mono font-extrabold text-white mt-0.5">
                          {selectedDetail.bmStats.speechDuration}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedDetail.difficultyExplanation && (
                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Catatan Tingkat Kesulitan & Rekomendasi Belajar
                  </div>
                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                    {selectedDetail.difficultyExplanation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bottom Back Bar for convenient mobile scrolling */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedDetail(null)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-extrabold inline-flex items-center gap-2 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar Katalog
            </button>
            {onBackToOverview && (
              <button
                type="button"
                onClick={onBackToOverview}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600/85 hover:bg-rose-600 text-white text-xs font-extrabold inline-flex items-center gap-2 transition cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Kembali ke Overview
              </button>
            )}
          </div>
        </div>
        {readerModal}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter & Search Bar */}
      <div className="card-pro p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(pageSize);
              }}
              placeholder="Ketik judul anime, novel, manga, VN, game, atau drama apa saja..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition"
            />
            {searchingLive ? (
              <Loader2 className="w-4 h-4 text-rose-600 animate-spin absolute right-3 top-3" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-700 absolute right-3 top-3 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowLibraryShelf((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                showLibraryShelf
                  ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
              }`}
            >
              <Library className="w-3.5 h-3.5" />
              <span>Library Novel ({savedNovels.length})</span>
            </button>
            {(section === 'Novels' || section === 'Semua') && (
              <button
                type="button"
                onClick={handleOpenLastOrFirstLibraryBook}
                className="btn-crimson px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Reader Novel (Yomitan)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOnlyWatchlist(!onlyWatchlist);
                setVisibleLimit(pageSize);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                onlyWatchlist
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Daftar Saya ({watchlistIds.length})
            </button>
            <div className="text-xs font-semibold text-slate-500">
              Menampilkan{' '}
              <span className="font-mono font-bold text-slate-900">
                {filteredItems.length}
              </span>{' '}
              judul media (Klik kartu untuk buka tampilan detail & timeline)
            </div>
          </div>
        </div>

        {/* Universal Direct Launch Bar */}
        {universalPortals.length > 0 && (
          <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200/80 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-rose-600" />
                Buka & Cari Langsung{' '}
                <span className="underline">
                  &ldquo;{searchQuery.trim()}&rdquo;
                </span>{' '}
                di Portal Utama (1-Klik):
              </span>
              {searchingLive && (
                <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Mencari semua judul di database global...
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {universalPortals.map((portal) => (
                <a
                  key={portal.label}
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    handleExternalLaunch(searchQuery.trim(), portal.siteName)
                  }
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-600 text-slate-800 hover:text-white border border-rose-200 hover:border-rose-600 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span>{portal.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Section Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {SECTION_ORDER.map((sec) => {
            const active = section === sec;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => handleSelectSection(sec)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <span>{sec}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-slate-600'
                  }`}
                >
                  {sectionCounts[sec] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Difficulty / JLPT Tier Pills */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {DIFFICULTY_FILTERS.map((tf) => {
              const active = tierFilter === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => handleSelectTier(tf.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-rose-600'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hidden Library Inputs */}
      <input
        ref={libraryUploadInputRef}
        type="file"
        multiple
        accept=".epub,.txt,.html,.htm,.xhtml"
        onChange={(e) => {
          void handleUploadBooksToLibrary(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={libraryBackupInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleRestoreLibraryBackup}
        className="hidden"
      />

      {/* Library Novel Saya Shelf (Anti-Reset & Multi-Buku) */}
      {showLibraryShelf && (
        <div className="card-pro p-4 sm:p-5 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Library className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Library Novel Saya ({savedNovels.length})
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 inline-flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {storagePersisted
                    ? 'Anti-Reset Permanen Aktif'
                    : 'Tersimpan di IndexedDB'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Setiap EPUB/TXT tersimpan terpisah — menambah buku baru tidak akan
                menimpa buku atau posisi bab Anda sebelumnya.
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <button
                type="button"
                disabled={importingLibrary}
                onClick={() => libraryUploadInputRef.current?.click()}
                className="btn-crimson px-3 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {importingLibrary ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Tambah Novel (.EPUB / .TXT)</span>
              </button>
              <button
                type="button"
                onClick={() => void handleExportLibraryBackup()}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Backup</span>
              </button>
              <button
                type="button"
                disabled={restoringLibrary}
                onClick={() => libraryBackupInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span>{restoringLibrary ? 'Memulihkan...' : 'Pulihkan'}</span>
              </button>
            </div>
          </div>

          {savedNovels.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                Belum ada file EPUB/TXT di Library Anda.
              </p>
              <p className="text-xs text-slate-500">
                Klik <strong>Tambah Novel (.EPUB / .TXT)</strong> untuk mengimpor
                beberapa novel sekaligus agar selalu siap dibaca kapan saja.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedNovels.map((sb) => {
                const progressPct =
                  sb.chapterCount > 0
                    ? Math.min(
                        100,
                        Math.round(
                          ((sb.currentChapter + sb.scrollRatio) /
                            sb.chapterCount) *
                            100
                        )
                      )
                    : 0;
                return (
                  <div
                    key={sb.storageKey}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setLastOpenedNovelKey(sb.storageKey);
                        setReaderTarget({
                          storageKey: sb.storageKey,
                          catalogItemId: sb.catalogItemId,
                          title: sb.title,
                        });
                      }}
                      className="flex items-start gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                    >
                      {sb.coverDataUrl ? (
                        <img
                          src={sb.coverDataUrl}
                          alt={sb.title}
                          className="w-12 h-16 rounded-lg object-cover shrink-0 border border-slate-200"
                        />
                      ) : (
                        <MediaCover
                          title={sb.title}
                          category="light_novel"
                          className="w-12 h-16 rounded-lg shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs font-extrabold text-slate-900 group-hover:text-rose-600 line-clamp-2 leading-snug">
                          {sb.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          Bab {sb.currentChapter + 1}/{sb.chapterCount} •{' '}
                          {progressPct}%
                          {sb.bookmarkCount > 0
                            ? ` • ${sb.bookmarkCount} mark`
                            : ''}
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-rose-600 rounded-full"
                            style={{ width: `${Math.max(4, progressPct)}%` }}
                          />
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeleteBookFromShelf(sb.storageKey, sb.title)
                      }
                      title="Hapus buku dari Library"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!showLibraryShelf &&
        section === 'Novels' &&
        savedNovels.length > 0 && (
          <div className="card-pro p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {savedNovels[0].coverDataUrl ? (
                <img
                  src={savedNovels[0].coverDataUrl}
                  alt={savedNovels[0].title}
                  className="w-9 h-12 rounded-lg object-cover shrink-0 border border-slate-200"
                />
              ) : (
                <div className="w-9 h-12 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                  <Library className="w-4 h-4 text-rose-600" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600">
                  Lanjut Baca Terakhir ({savedNovels.length} buku di Library)
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                  {savedNovels[0].title}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Bab {savedNovels[0].currentChapter + 1}/
                  {savedNovels[0].chapterCount}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowLibraryShelf(true)}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Lihat Semua ({savedNovels.length})
              </button>
              <button
                type="button"
                onClick={handleOpenLastOrFirstLibraryBook}
                className="btn-crimson px-3.5 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Lanjut Baca</span>
              </button>
            </div>
          </div>
        )}

      {/* Media Cards Grid (Clicking any card opens the Cinematic Showcase View first!) */}
      {visibleItems.length === 0 ? (
        <div className="card-pro p-8 text-center space-y-3">
          {searchingLive ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-700">
                Mencari &ldquo;{searchQuery}&rdquo; di katalog global...
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-700">
                {onlyWatchlist
                  ? 'Belum ada judul di Daftar Saya. Klik sebuah judul lalu pilih "+ Add to List".'
                  : 'Tidak ada judul lokal yang cocok dengan filter ini — gunakan tombol Portal 1-Klik di atas untuk langsung membuka judul tersebut.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSection('Semua');
                  setTierFilter('all');
                  setOnlyWatchlist(false);
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                Reset Filter
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {visibleItems.map((item, idx) => {
            const meta = getCategoryMeta(item.category);
            const destinations = getCatalogMediaDestinations(item);
            const inList = watchlistIds.includes(item.id);
            const watchedCount = (watchedEpisodesMap[item.id] ?? []).length;
            const blurb =
              item.description ||
              item.difficultyExplanation ||
              'Rekomendasi media immersion bahasa Jepang.';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedDetail(item)}
                style={{
                  animationDelay: `${Math.min(idx % pageSize, 8) * 35}ms`,
                }}
                className="card-pro-interactive p-4 flex flex-col justify-between gap-3.5 group animate-fade-up cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5">
                    <div className="shrink-0 relative">
                      <MediaCover
                        title={item.title}
                        category={item.category}
                        coverImage={item.coverImage}
                        className="w-16 h-22 rounded-xl group-hover:scale-[1.03] transition-transform"
                      />
                      {inList && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${getRankingBadgeStyle(
                            item.difficultyTier
                          )}`}
                        >
                          {item.ranking}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {item.section}
                        </span>
                        {watchedCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
                            {watchedCount} Ep
                          </span>
                        )}
                        {item.section === 'Novels' &&
                          Boolean(storedBooksMap[`catalog:${item.id}`]) && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
                              ✓ Siap Baca (Yomitan)
                            </span>
                          )}
                      </div>
                      <div className="block font-bold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-rose-700 transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span>
                          {meta.shortLabel} • ~{item.suggestedMinutes}m
                        </span>
                        <span className="text-rose-600 font-sans font-bold">
                          • {destinations.primary.siteName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {blurb}
                  </p>

                  {item.bmStats &&
                    (item.bmStats.uniqueKanji ||
                      item.bmStats.speechSpeed ||
                      item.bmStats.wordCount) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {item.bmStats.jlptLevel && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[10px] font-mono font-bold text-rose-700">
                            JLPT {item.bmStats.jlptLevel}
                          </span>
                        )}
                        {item.bmStats.uniqueKanji && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-700">
                            {item.bmStats.uniqueKanji.toLocaleString('id-ID')}{' '}
                            kanji
                          </span>
                        )}
                        {item.bmStats.speechSpeed && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-700">
                            {item.bmStats.speechSpeed} mora/m
                          </span>
                        )}
                        {item.bmStats.wordCount && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-700">
                            {(item.bmStats.wordCount / 1000).toFixed(1)}k kata
                          </span>
                        )}
                      </div>
                    )}
                </div>

                <div
                  className="flex items-center gap-1.5 pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedDetail(item)}
                    className="btn-crimson flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {item.section === 'Novels' ? (
                      <>
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {storedBooksMap[`catalog:${item.id}`]
                            ? 'Lanjut Baca (Yomitan)'
                            : 'Baca Novel & Timeline'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                        <span className="truncate">Buka Timeline & Play</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleWatchlist(item)}
                    title={
                      inList ? 'Hapus dari Daftar Saya' : 'Tambah ke Daftar Saya'
                    }
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0 ${
                      inList
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    }`}
                  >
                    {inList ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onStartMedia(
                        item.title,
                        item.category,
                        item.suggestedMinutes
                      )
                    }
                    title="Catat sesi immersion untuk judul ini"
                    className="py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Log</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + pageSize)}
            className="px-6 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-600 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Muat {Math.min(pageSize, filteredItems.length - visibleLimit)} Judul
            Lainnya ({filteredItems.length - visibleLimit} tersisa)
          </button>
        </div>
      )}

      {readerModal}
    </div>
  );
};
