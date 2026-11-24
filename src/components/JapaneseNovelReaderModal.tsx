import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  FolderInput,
  HardDrive,
  Headphones,
  History,
  Image as ImageIcon,
  Keyboard,
  Library,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  compressImageToDataUrl,
  loadAppearanceSettings,
  subscribeAppearanceChanges,
} from '../lib/appearance';
import {
  addStoredNovelBookmark,
  buildYouTubeBgEmbedUrl,
  DEFAULT_READER_PREFS,
  deleteReaderBgVideoBlob,
  deleteStoredNovelBook,
  deleteStoredNovelBookmark,
  extractChapterParagraphs,
  getLastOpenedNovelKey,
  getLibraryStorageInfo,
  getStoredNovelBook,
  importNovelFileToLibrary,
  listStoredNovelBooks,
  loadReaderBgVideoBlob,
  loadReaderPrefs,
  loadYatsuBookLinks,
  normalizeYatsuUrl,
  parseReaderBackgroundMedia,
  READER_BG_VIDEO_SENTINEL,
  requestPersistentLibraryStorage,
  resolveYatsuUrl,
  saveNovelProgressSync,
  saveReaderBgVideoBlob,
  saveReaderPrefs,
  saveStoredNovelBook,
  saveYatsuBookLink,
  setLastOpenedNovelKey,
  updateStoredNovelProgress,
  type NovelBookmark,
  type ReaderBgMode,
  type ReaderBgPosition,
  type ReaderMode,
  type ReaderPreferences,
  type StoredNovelBook,
  type StoredNovelChapter,
  type StoredNovelSummary,
  type VnAnimationStyle,
} from '../lib/epubReaderStore';
import {
  exportFullLibraryBackup,
  importFullLibraryBackup,
  pushCloudLibraryNow,
  scheduleCloudLibraryPush,
} from '../lib/libraryCloudSync';
import { LIBRARY_DATA_CHANGED_EVENT } from '../lib/mediaCinematicDetails';
import {
  BUILTIN_READER_FONTS,
  addNamedCustomFont,
  deleteCustomReaderFont,
  ensureReaderFontLoaded,
  loadCustomReaderFonts,
  resolveReaderFontCss,
  saveCustomFontFile,
  type CustomReaderFont,
} from '../lib/readerFonts';
import {
  startLineByLineReveal,
  type VnRevealController,
} from '../lib/vnLineReveal';
import {
  explainJapaneseSentenceWithAi,
  hasAiTextKey,
  loadAiTtsSettings,
} from '../lib/audiobookEngine';
import { ReaderAudiobookDock } from './ReaderAudiobookDock';

export interface NovelReaderTarget {
  storageKey: string;
  catalogItemId?: string;
  title: string;
  downloadUrl?: string;
  volumes?: Array<{ md5: string; title: string }>;
  initialChapter?: number;
  initialScrollRatio?: number;
  initialVnIndex?: number;
}

interface JapaneseNovelReaderModalProps {
  target: NovelReaderTarget;
  userId?: string;
  onClose: () => void;
  onLogReadingSession: (title: string, minutes: number) => void;
  onBookLibraryChanged?: () => void;
}

const READER_THEME_STYLES: Record<
  ReaderPreferences['theme'],
  {
    shell: string;
    toolbar: string;
    toolbarGlass: string;
    panel: string;
    subtleBtn: string;
    mutedText: string;
    articleBg: string;
    vnCard: string;
    cardRgb: string;
    surfaceRgb: string;
    cardBorder: string;
    accentText: string;
  }
> = {
  navy: {
    shell: 'bg-[#0b121c] text-[#eef4fb]',
    toolbar: 'bg-[#0f1826]/95 border-[#1e2d42] text-[#f3f7fc]',
    toolbarGlass: 'bg-[#0f1826]/78 border-white/15 text-[#f3f7fc]',
    panel: 'bg-[#121e30] border-[#253751] text-[#f3f7fc]',
    subtleBtn:
      'bg-[#172438] hover:bg-[#1f314c] border-[#293d5a] text-[#dce7f5]',
    mutedText: 'text-[#8ea0b5]',
    articleBg: 'bg-[#0b121c] text-[#e8eff8]',
    vnCard:
      'bg-[#111c2d]/95 border-[#253852] shadow-[0_24px_60px_-15px_rgba(4,9,17,0.75)]',
    cardRgb: '17, 28, 45',
    surfaceRgb: '11, 18, 28',
    cardBorder: 'rgba(148, 179, 214, 0.24)',
    accentText: 'text-sky-300',
  },
  amoled: {
    shell: 'bg-black text-[#e5e7eb]',
    toolbar: 'bg-[#09090b]/95 border-white/15 text-white',
    toolbarGlass: 'bg-[#09090b]/78 border-white/15 text-white',
    panel: 'bg-[#121216] border-white/15 text-white',
    subtleBtn:
      'bg-white/10 hover:bg-white/15 border-white/15 text-neutral-200',
    mutedText: 'text-neutral-400',
    articleBg: 'bg-black text-[#e5e7eb]',
    vnCard: 'bg-[#0b0b0f]/95 border-white/15 shadow-2xl',
    cardRgb: '11, 11, 15',
    surfaceRgb: '0, 0, 0',
    cardBorder: 'rgba(255, 255, 255, 0.16)',
    accentText: 'text-sky-300',
  },
  sepia: {
    shell: 'bg-[#f4ecd8] text-[#3b2f1e]',
    toolbar: 'bg-[#ebe0c6]/95 border-[#d6c6a5] text-[#2e2315]',
    toolbarGlass: 'bg-[#ebe0c6]/82 border-[#c8b691]/70 text-[#2e2315]',
    panel: 'bg-[#f8f2e4] border-[#d6c6a5] text-[#2e2315]',
    subtleBtn:
      'bg-[#e6d9bb] hover:bg-[#dccba7] border-[#cbb892] text-[#3b2f1e]',
    mutedText: 'text-[#756248]',
    articleBg: 'bg-[#f4ecd8] text-[#3b2f1e]',
    vnCard: 'bg-[#fbf6ea] border-[#d6c6a5] shadow-xl',
    cardRgb: '251, 246, 234',
    surfaceRgb: '244, 236, 216',
    cardBorder: 'rgba(180, 158, 116, 0.45)',
    accentText: 'text-sky-700',
  },
  light: {
    shell: 'bg-[#f8fafc] text-[#0f172a]',
    toolbar: 'bg-white/95 border-slate-200 text-slate-900',
    toolbarGlass: 'bg-white/80 border-slate-300/75 text-slate-900',
    panel: 'bg-white border-slate-200 text-slate-900',
    subtleBtn:
      'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700',
    mutedText: 'text-slate-500',
    articleBg: 'bg-white text-[#0f172a]',
    vnCard: 'bg-white border-slate-200 shadow-xl',
    cardRgb: '255, 255, 255',
    surfaceRgb: '255, 255, 255',
    cardBorder: 'rgba(148, 163, 184, 0.35)',
    accentText: 'text-sky-600',
  },
};

const READER_SHORTCUTS: Array<{ keys: string[]; desc: string }> = [
  { keys: ['Space', 'Enter', 'PageDown'], desc: 'Halaman / Paragraf VN berikutnya' },
  { keys: ['Backspace', 'PageUp'], desc: 'Halaman / Paragraf VN sebelumnya' },
  { keys: ['Swipe Kiri / Kanan'], desc: 'Geser layar di HP untuk pindah slide / halaman' },
  { keys: ['→ / J'], desc: 'Maju (Horizontal) / Mundur (Vertikal)' },
  { keys: ['← / K'], desc: 'Mundur (Horizontal) / Maju (Vertikal)' },
  { keys: ['['], desc: 'Bab sebelumnya' },
  { keys: [']'], desc: 'Bab berikutnya' },
  { keys: ['V'], desc: 'Aktif / matikan Mode VN' },
  { keys: ['P'], desc: 'Ganti mode baca (Continuous / Page / VN)' },
  { keys: ['T'], desc: 'Ganti arah baca (Horizontal ↔ Vertikal 縦書き)' },
  { keys: ['F'], desc: 'Ganti mode Furigana (Tampil / Hover / Sembunyi)' },
  { keys: ['+', '-'], desc: 'Perbesar / perkecil ukuran huruf' },
  { keys: ['B'], desc: 'Simpan Bookmark posisi sekarang' },
  { keys: ['C'], desc: 'Buka Daftar Bab & Bookmark' },
  { keys: ['H'], desc: 'Buka Riwayat Paragraf (Backlog Mode VN)' },
  { keys: ['A'], desc: 'Buka panel Audiobook & AI Narator' },
  { keys: ['S'], desc: 'Buka Pengaturan Reader' },
  { keys: ['M'], desc: 'Mode Fullscreen / Fokus (sembunyikan toolbar)' },
  { keys: ['?'], desc: 'Tampilkan panduan shortcut ini' },
  { keys: ['Esc'], desc: 'Tutup panel / keluar dari Reader' },
];

const ReaderSessionTimerButton: React.FC<{
  active: boolean;
  resetToken: number;
  onLog: (minutes: number) => void;
}> = React.memo(({ active, resetToken, onLog }) => {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    setElapsedSec(0);
  }, [resetToken]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <button
      type="button"
      onClick={() => onLog(Math.max(1, Math.round(elapsedSec / 60)))}
      title="Catat durasi baca saat ini ke Immersion Log"
      className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-xs font-mono font-bold inline-flex items-center gap-1 transition cursor-pointer"
    >
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
      <Save className="w-3 h-3 hidden sm:inline shrink-0" />
    </button>
  );
});

const PAGE_GAP = 48;

const BookChaptersContent: React.FC<{
  chapters: StoredNovelChapter[];
  showChapterDividers: boolean;
}> = React.memo(({ chapters, showChapterDividers }) => (
  <>
    {chapters.map((ch, idx) => (
      <section
        key={ch.id || `ch-${idx}`}
        data-chapter-index={idx}
        className="jp-chapter-section"
      >
        {showChapterDividers && chapters.length > 1 && (
          <div
            className="jp-chapter-divider"
            aria-label={`Bab ${idx + 1}: ${ch.title}`}
          >
            <span className="jp-chapter-badge">
              <span>Bab {idx + 1}</span>
              {ch.title && <span className="opacity-80">• {ch.title}</span>}
            </span>
          </div>
        )}
        <div dangerouslySetInnerHTML={{ __html: ch.html }} />
      </section>
    ))}
  </>
));

export const JapaneseNovelReaderModal: React.FC<
  JapaneseNovelReaderModalProps
> = ({ target, userId, onClose, onLogReadingSession, onBookLibraryChanged }) => {
  const readerRootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addBookInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const fontFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const bgYtIframeRef = useRef<HTMLIFrameElement | null>(null);
  const bgAudioCtxRef = useRef<AudioContext | null>(null);
  const bgGainNodeRef = useRef<GainNode | null>(null);
  const bgAudioSourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const ytRetryTimersRef = useRef<number[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const vnVerticalViewportRef = useRef<HTMLDivElement | null>(null);
  const vnStreamEndRef = useRef<HTMLDivElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const vnRevealControllerRef = useRef<VnRevealController | null>(null);
  const vnPreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const vnPreviewControllerRef = useRef<VnRevealController | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const pendingJumpToEndRef = useRef(false);
  const pendingJumpTargetRef = useRef<{
    chapterIndex: number;
    chapterRatio: number;
  } | null>(null);
  const restoringScrollRef = useRef(false);
  const wheelPageCooldownRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  const [activeKey, setActiveKey] = useState(target.storageKey);
  const [book, setBook] = useState<StoredNovelBook | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [importing, setImporting] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);

  const [savedBooks, setSavedBooks] = useState<StoredNovelSummary[]>([]);
  const [storageInfo, setStorageInfo] = useState<{
    persisted: boolean;
    usageMb: number | null;
    quotaMb: number | null;
  }>({ persisted: false, usageMb: null, quotaMb: null });
  const [prefs, setPrefs] = useState<ReaderPreferences>(loadReaderPrefs);
  const prefsRef = useRef<ReaderPreferences>(prefs);
  prefsRef.current = prefs;
  const [showToc, setShowToc] = useState(false);
  const [tocTab, setTocTab] = useState<'chapters' | 'bookmarks' | 'library'>(
    'chapters'
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'reading' | 'vn' | 'background'>(
    'reading'
  );
  const [bgUrlDraft, setBgUrlDraft] = useState<string>(() => {
    const saved = loadReaderPrefs().bgImageUrl;
    return saved.startsWith('data:') || saved.startsWith('idb:') ? '' : saved;
  });
  const [localVideoObjectUrl, setLocalVideoObjectUrl] = useState('');
  const [appWallpaperUrl, setAppWallpaperUrl] = useState<string>(
    () => loadAppearanceSettings().customImageUrl
  );
  const [customFonts, setCustomFonts] = useState<CustomReaderFont[]>(
    loadCustomReaderFonts
  );
  const [uploadingFont, setUploadingFont] = useState(false);
  const [customFontNameDraft, setCustomFontNameDraft] = useState('');
  const [customFontSourceDraft, setCustomFontSourceDraft] = useState<
    'google' | 'system'
  >('google');
  const [animPreviewTick, setAnimPreviewTick] = useState(0);
  const [showBacklog, setShowBacklog] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [audioPanelTab, setAudioPanelTab] = useState<'ai' | 'file'>('ai');
  const [audioPlaybackActive, setAudioPlaybackActive] = useState(false);
  const [oneShotSpeakRequest, setOneShotSpeakRequest] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const [aiExplainState, setAiExplainState] = useState<{
    sentence: string;
    loading: boolean;
    text: string;
    error: string;
  } | null>(null);
  const aiExplainAbortRef = useRef<AbortController | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [scrollPct, setScrollPct] = useState(0);
  const [bookBarPct, setBookBarPct] = useState(0);
  const [pagedWidthPx, setPagedWidthPx] = useState(0);
  const [explicitJumpToken, setExplicitJumpToken] = useState(0);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number }>({
    current: 1,
    total: 1,
  });
  const [vnIndex, setVnIndex] = useState(0);
  const sessionStartMsRef = useRef<number>(Date.now());
  const [timerResetToken, setTimerResetToken] = useState(0);
  const [selectedSentence, setSelectedSentence] = useState('');

  const [yatsuLinks, setYatsuLinks] = useState<Record<string, string>>(
    loadYatsuBookLinks
  );
  const [yatsuInput, setYatsuInput] = useState(
    () => loadYatsuBookLinks()[target.storageKey] ?? ''
  );

  const activeChapter = useMemo(() => {
    if (!book || book.chapters.length === 0) return null;
    const idx = Math.min(
      book.chapters.length - 1,
      Math.max(0, book.currentChapter)
    );
    return book.chapters[idx];
  }, [book]);

  const chapterParagraphs = useMemo(
    () => (activeChapter ? extractChapterParagraphs(activeChapter.html) : []),
    [activeChapter]
  );

  const bookRef = useRef<StoredNovelBook | null>(book);
  bookRef.current = book;
  const loadingBookRef = useRef(true);
  const liveChapterRef = useRef(0);
  const liveScrollRatioRef = useRef(0);
  const hasSavedOnCloseRef = useRef(false);
  const userInteractedSinceRestoreRef = useRef(false);
  const flushProgressSyncRef = useRef<() => void>(() => {});
  const getLiveProgressRef = useRef<
    () => { chapterIndex: number; ratio: number; vnIndex: number } | null
  >(() => null);
  const vnIndexRef = useRef(vnIndex);
  vnIndexRef.current = vnIndex;
  const scrollPctRef = useRef(scrollPct);
  scrollPctRef.current = scrollPct;
  const chapterParaLenRef = useRef(chapterParagraphs.length);
  chapterParaLenRef.current = chapterParagraphs.length;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refreshStorageStatus = useCallback(async () => {
    await requestPersistentLibraryStorage();
    const info = await getLibraryStorageInfo();
    setStorageInfo(info);
  }, []);

  const loadBookByKey = useCallback(
    async (key: string) => {
      loadingBookRef.current = true;
      hasSavedOnCloseRef.current = false;
      userInteractedSinceRestoreRef.current = false;
      setLoadingBook(true);
      const allSaved = await listStoredNovelBooks();
      let resolvedKey = key;

      if (key === 'local:quick-reader' || key === 'local:library') {
        const lastKey = getLastOpenedNovelKey();
        if (lastKey && allSaved.some((b) => b.storageKey === lastKey)) {
          resolvedKey = lastKey;
        } else if (allSaved.length > 0) {
          resolvedKey = allSaved[0].storageKey;
        }
      }

      let loaded = await getStoredNovelBook(resolvedKey);
      if (!loaded && key !== 'local:quick-reader' && key !== 'local:library') {
        const normTitle = target.title.trim().toLowerCase();
        const fallbackMatch = allSaved.find(
          (b) =>
            (target.catalogItemId &&
              b.catalogItemId === target.catalogItemId) ||
            (normTitle && b.title.trim().toLowerCase() === normTitle)
        );
        if (fallbackMatch) {
          resolvedKey = fallbackMatch.storageKey;
          loaded = await getStoredNovelBook(resolvedKey);
        }
      }

      if (
        loaded &&
        key === target.storageKey &&
        typeof target.initialChapter === 'number'
      ) {
        const clampedChapter = Math.max(
          0,
          Math.min(loaded.chapters.length - 1, target.initialChapter)
        );
        loaded = {
          ...loaded,
          currentChapter: clampedChapter,
          scrollRatio:
            typeof target.initialScrollRatio === 'number'
              ? Math.min(1, Math.max(0, target.initialScrollRatio))
              : loaded.scrollRatio,
          vnIndex:
            typeof target.initialVnIndex === 'number'
              ? Math.max(0, target.initialVnIndex)
              : (loaded.vnIndex ?? 0),
        };
      }

      const initChapter = loaded?.currentChapter ?? 0;
      const initRatio = loaded?.scrollRatio || 0;
      const initVn = loaded?.vnIndex ?? 0;
      liveChapterRef.current = initChapter;
      liveScrollRatioRef.current = initRatio;
      vnIndexRef.current = initVn;

      pendingJumpTargetRef.current = loaded
        ? {
            chapterIndex: initChapter,
            chapterRatio: initRatio,
          }
        : null;
      setExplicitJumpToken((t) => t + 1);
      setActiveKey(loaded?.storageKey ?? resolvedKey);
      setYatsuInput(yatsuLinks[loaded?.storageKey ?? resolvedKey] ?? '');
      setBook(loaded);
      setVnIndex(initVn);
      setScrollPct(Math.round(initRatio * 100));
      sessionStartMsRef.current = Date.now();
      setTimerResetToken((t) => t + 1);
      setSavedBooks(allSaved);
      if (loaded) {
        setLastOpenedNovelKey(loaded.storageKey);
      }
      loadingBookRef.current = false;
      setLoadingBook(false);
      void refreshStorageStatus();
    },
    [
      refreshStorageStatus,
      target.catalogItemId,
      target.title,
      target.storageKey,
      target.initialChapter,
      target.initialScrollRatio,
      target.initialVnIndex,
    ] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    void loadBookByKey(target.storageKey);
  }, [target.storageKey, loadBookByKey]);

  useEffect(() => {
    void ensureReaderFontLoaded(prefs.fontFamily, customFonts);
  }, [prefs.fontFamily, customFonts]);

  useEffect(() => {
    if (!showSettings || settingsTab !== 'reading') return;
    customFonts.forEach((cf) => {
      void ensureReaderFontLoaded(cf.id, customFonts);
    });
  }, [showSettings, settingsTab, customFonts]);

  useEffect(() => {
    return subscribeAppearanceChanges((next) => {
      setAppWallpaperUrl(next.customImageUrl);
    });
  }, []);

  useEffect(() => {
    if (
      prefs.bgMode !== 'custom' ||
      prefs.bgImageUrl !== READER_BG_VIDEO_SENTINEL
    ) {
      setLocalVideoObjectUrl('');
      return;
    }
    let cancelled = false;
    let createdUrl = '';
    void loadReaderBgVideoBlob().then((blob) => {
      if (cancelled || !blob) return;
      createdUrl = URL.createObjectURL(blob);
      setLocalVideoObjectUrl(createdUrl);
    });
    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [prefs.bgMode, prefs.bgImageUrl]);

  const updatePrefs = useCallback((patch: Partial<ReaderPreferences>): boolean => {
    const prevPrefs = prefsRef.current;
    const next = { ...prevPrefs, ...patch };
    const modeChanged =
      patch.readingMode !== undefined &&
      patch.readingMode !== prevPrefs.readingMode &&
      Boolean(bookRef.current) &&
      !loadingBookRef.current;
    const writingChanged =
      patch.writingMode !== undefined &&
      patch.writingMode !== prevPrefs.writingMode &&
      Boolean(bookRef.current) &&
      !loadingBookRef.current;

    if ((modeChanged || writingChanged) && bookRef.current) {
      const curBook = bookRef.current;
      const live = getLiveProgressRef.current() ?? {
        chapterIndex: liveChapterRef.current,
        ratio: liveScrollRatioRef.current,
        vnIndex: vnIndexRef.current,
      };
      const clampedChap = Math.max(
        0,
        Math.min(curBook.chapters.length - 1, live.chapterIndex)
      );
      liveChapterRef.current = clampedChap;
      liveScrollRatioRef.current = live.ratio;
      pendingJumpTargetRef.current = {
        chapterIndex: clampedChap,
        chapterRatio: live.ratio,
      };

      if (next.readingMode === 'vn' && modeChanged) {
        const paras = extractChapterParagraphs(
          curBook.chapters[clampedChap]?.html ?? ''
        );
        const targetVn =
          paras.length > 0
            ? Math.min(
                paras.length - 1,
                Math.max(
                  0,
                  Math.round(live.ratio * Math.max(0, paras.length - 1))
                )
              )
            : 0;
        vnIndexRef.current = targetVn;
        setVnIndex(targetVn);
        setScrollPct(Math.round(live.ratio * 100));
        setBook((prev) =>
          prev && prev.storageKey === curBook.storageKey
            ? {
                ...prev,
                currentChapter: clampedChap,
                scrollRatio: live.ratio,
                vnIndex: targetVn,
              }
            : prev
        );
      } else if (prevPrefs.readingMode === 'vn' && modeChanged) {
        setExplicitJumpToken((t) => t + 1);
      }
    }

    const saved = saveReaderPrefs(next);
    prefsRef.current = next;
    setPrefs(next);
    scheduleCloudLibraryPush(userIdRef.current);
    return saved;
  }, []);

  const handleUploadReaderBg = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.type.startsWith('video/')) {
        if (file.size > 60 * 1024 * 1024) {
          toast.error(
            'Ukuran video maksimal 60 MB agar pemutaran tetap lancar di HP & laptop.'
          );
          return;
        }
        await saveReaderBgVideoBlob(file);
        updatePrefs({ bgMode: 'custom', bgImageUrl: READER_BG_VIDEO_SENTINEL });
        setBgUrlDraft('');
        toast.success('Video background kustom diterapkan!');
        return;
      }

      await deleteReaderBgVideoBlob();
      let dataUrl = await compressImageToDataUrl(file, 1440);
      let saved = updatePrefs({ bgMode: 'custom', bgImageUrl: dataUrl });
      if (!saved) {
        dataUrl = await compressImageToDataUrl(file, 960);
        saved = updatePrefs({ bgMode: 'custom', bgImageUrl: dataUrl });
      }
      setBgUrlDraft('');
      if (saved) {
        toast.success('Background reader kustom diterapkan!');
      } else {
        toast.error(
          'Background diterapkan sementara (penyimpanan browser penuh).'
        );
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal memasang file background reader.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleApplyBgUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = bgUrlDraft.trim();
    const parsed = parseReaderBackgroundMedia(clean);
    if (
      parsed.kind === 'none' ||
      (!clean.startsWith('https://') && !clean.startsWith('http://'))
    ) {
      toast.error(
        'Masukkan URL Gambar, YouTube, atau Video (.mp4/.webm) yang valid.'
      );
      return;
    }
    void deleteReaderBgVideoBlob();
    updatePrefs({ bgMode: 'custom', bgImageUrl: clean });
    if (parsed.kind === 'youtube') {
      toast.success('Video YouTube diterapkan sebagai background reader!');
    } else if (parsed.kind === 'video') {
      toast.success('Link video diterapkan sebagai background reader!');
    } else {
      toast.success('URL gambar background reader diterapkan!');
    }
  };

  const computeScrollMetrics = useCallback(() => {
    const el = scrollContainerRef.current;
    const article = articleRef.current;
    const curBook = bookRef.current;
    const fallbackChapter = curBook?.currentChapter ?? 0;
    if (!el) {
      return {
        ratio: 0,
        bookRatio: 0,
        chapterIndex: fallbackChapter,
        current: 1,
        total: 1,
      };
    }

    const mode = prefsRef.current.readingMode;
    const isVertical = prefsRef.current.writingMode === 'vertical';
    const isPaginated = mode === 'paginated';

    let bookRatio = 0;
    let current = 1;
    let total = 1;

    if (isVertical) {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const scrolled = Math.abs(el.scrollLeft);
      const clientW = Math.max(
        200,
        Math.floor(el.getBoundingClientRect().width) || el.clientWidth
      );
      const stepPx = isPaginated
        ? Math.max(200, Math.round(clientW * 0.92))
        : Math.max(220, Math.round(el.clientWidth * 0.88));
      total =
        maxScroll <= 2
          ? 1
          : isPaginated
            ? Math.floor((maxScroll - 1) / stepPx) + 2
            : Math.max(1, Math.ceil(el.scrollWidth / stepPx));
      if (maxScroll > 2) {
        bookRatio = Math.min(1, Math.max(0, scrolled / maxScroll));
        if (scrolled >= maxScroll - 16) {
          current = total;
        } else {
          current = Math.min(
            total,
            Math.max(
              1,
              (isPaginated
                ? Math.round(scrolled / stepPx)
                : Math.floor(scrolled / stepPx)) + 1
            )
          );
        }
      }
    } else if (isPaginated) {
      const pageW = Math.max(
        200,
        pagedWidthPx ||
          Math.floor(el.getBoundingClientRect().width) ||
          el.clientWidth
      );
      const stride = pageW + PAGE_GAP;
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      total = Math.max(1, Math.round((el.scrollWidth + PAGE_GAP) / stride));
      if (maxScroll > 2) {
        bookRatio = Math.min(1, Math.max(0, el.scrollLeft / maxScroll));
        current = Math.min(
          total,
          Math.max(1, Math.round(el.scrollLeft / stride) + 1)
        );
      }
    } else {
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const stepPx = Math.max(220, Math.round(el.clientHeight * 0.88));
      total = Math.max(1, Math.ceil(el.scrollHeight / stepPx));
      if (maxScroll > 2) {
        bookRatio = Math.min(1, Math.max(0, el.scrollTop / maxScroll));
        current =
          el.scrollTop >= maxScroll - 16
            ? total
            : Math.min(total, Math.floor(el.scrollTop / stepPx) + 1);
      }
    }

    let chapterIndex = fallbackChapter;
    let ratio = bookRatio;

    if (article && curBook && curBook.chapters.length > 0) {
      const sections = Array.from(
        article.querySelectorAll<HTMLElement>('section[data-chapter-index]')
      );
      if (sections.length > 0) {
        const vpRect = el.getBoundingClientRect();
        const scrolledX = Math.abs(el.scrollLeft);

        if (isVertical) {
          const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
          if (maxScroll > 2 && scrolledX >= maxScroll - 8) {
            const lastIdx = sections.length - 1;
            chapterIndex = Number(
              sections[lastIdx].dataset.chapterIndex ?? lastIdx
            );
            ratio = 1;
          } else {
            const bounds = sections.map((sec) => {
              const r = sec.getBoundingClientRect();
              const start = Math.max(0, vpRect.right - r.right + scrolledX);
              const end = Math.max(start, vpRect.right - r.left + scrolledX);
              return {
                idx: Number(sec.dataset.chapterIndex ?? 0),
                start,
                end,
              };
            });
            const threshold =
              scrolledX + Math.min(96, Math.round(el.clientWidth * 0.25));
            let activeB = bounds[0];
            for (let i = 0; i < bounds.length; i++) {
              if (bounds[i].start <= threshold) {
                activeB = bounds[i];
              } else {
                break;
              }
            }
            chapterIndex = activeB.idx;
            const span = Math.max(1, activeB.end - activeB.start);
            ratio = Math.min(
              1,
              Math.max(0, (scrolledX - activeB.start) / span)
            );
          }
        } else if (isPaginated) {
          const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
          if (maxScroll > 2 && el.scrollLeft >= maxScroll - 8) {
            const lastIdx = sections.length - 1;
            chapterIndex = Number(
              sections[lastIdx].dataset.chapterIndex ?? lastIdx
            );
            ratio = 1;
          } else {
            const bounds = sections.map((sec) => {
              const r = sec.getBoundingClientRect();
              const start = Math.max(0, r.left - vpRect.left + el.scrollLeft);
              const end = Math.max(
                start,
                r.right - vpRect.left + el.scrollLeft
              );
              return {
                idx: Number(sec.dataset.chapterIndex ?? 0),
                start,
                end,
              };
            });
            const threshold =
              el.scrollLeft + Math.min(120, Math.round(el.clientWidth * 0.35));
            let activeB = bounds[0];
            for (let i = 0; i < bounds.length; i++) {
              if (bounds[i].start <= threshold) {
                activeB = bounds[i];
              } else {
                break;
              }
            }
            chapterIndex = activeB.idx;
            const span = Math.max(1, activeB.end - activeB.start);
            ratio = Math.min(
              1,
              Math.max(0, (el.scrollLeft - activeB.start) / span)
            );
          }
        } else {
          const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
          if (maxScroll > 2 && el.scrollTop >= maxScroll - 8) {
            const lastIdx = sections.length - 1;
            chapterIndex = Number(
              sections[lastIdx].dataset.chapterIndex ?? lastIdx
            );
            ratio = 1;
          } else {
            const bounds = sections.map((sec) => {
              const r = sec.getBoundingClientRect();
              const start = Math.max(0, r.top - vpRect.top + el.scrollTop);
              const end = Math.max(start, r.bottom - vpRect.top + el.scrollTop);
              return {
                idx: Number(sec.dataset.chapterIndex ?? 0),
                start,
                end,
              };
            });
            const threshold =
              el.scrollTop + Math.min(96, Math.round(el.clientHeight * 0.2));
            let activeB = bounds[0];
            for (let i = 0; i < bounds.length; i++) {
              if (bounds[i].start <= threshold) {
                activeB = bounds[i];
              } else {
                break;
              }
            }
            chapterIndex = activeB.idx;
            const span = Math.max(1, activeB.end - activeB.start);
            ratio = Math.min(
              1,
              Math.max(0, (el.scrollTop - activeB.start) / span)
            );
          }
        }
      }
    }

    return { ratio, bookRatio, chapterIndex, current, total };
  }, [pagedWidthPx]);

  const scrollToChapterPosition = useCallback(
    (chapterIndex: number, chapterRatio = 0) => {
      const el = scrollContainerRef.current;
      const article = articleRef.current;
      const curBook = bookRef.current;
      if (!el || !curBook || curBook.chapters.length === 0) return;

      const safeIdx = Math.max(
        0,
        Math.min(curBook.chapters.length - 1, chapterIndex)
      );
      const ratio = Math.min(1, Math.max(0, chapterRatio || 0));
      const sec = article?.querySelector<HTMLElement>(
        `section[data-chapter-index="${safeIdx}"]`
      );

      const isVertical = prefsRef.current.writingMode === 'vertical';
      const isPaginated = prefsRef.current.readingMode === 'paginated';
      const hasMoreChaptersAfter = safeIdx < curBook.chapters.length - 1;

      if (!sec) {
        if (isVertical) {
          const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
          el.scrollLeft = ratio > 0 ? -(maxScroll * ratio) : 0;
        } else if (isPaginated) {
          const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
          el.scrollLeft = Math.round(maxScroll * ratio);
        } else {
          const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
          el.scrollTop = Math.round(maxScroll * ratio);
        }
        return;
      }

      const vpRect = el.getBoundingClientRect();
      const secRect = sec.getBoundingClientRect();

      if (isVertical) {
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        const curScrolled = Math.abs(el.scrollLeft);
        const secStart = Math.max(
          0,
          vpRect.right - secRect.right + curScrolled
        );
        const secEnd = Math.max(
          secStart,
          vpRect.right - secRect.left + curScrolled
        );
        const span = Math.max(0, secEnd - secStart);
        if (isPaginated) {
          const clientW = Math.max(
            200,
            Math.floor(vpRect.width) || el.clientWidth
          );
          const stride = Math.max(200, Math.round(clientW * 0.92));
          const usableSpan =
            ratio >= 0.995 && hasMoreChaptersAfter
              ? Math.max(0, span - stride * 0.35)
              : span;
          const rawTarget = secStart + ratio * usableSpan;
          const pageIdx =
            ratio <= 0
              ? Math.floor((secStart + 4) / stride)
              : Math.round(rawTarget / stride);
          const targetScrolled = Math.min(
            maxScroll,
            Math.max(0, pageIdx * stride)
          );
          el.scrollLeft = targetScrolled > 0 ? -targetScrolled : 0;
        } else {
          const usableSpan =
            ratio >= 0.995 && hasMoreChaptersAfter
              ? Math.max(0, span - el.clientWidth * 0.45)
              : span;
          const targetScrolled = Math.min(
            maxScroll,
            Math.max(
              0,
              Math.round(
                ratio <= 0 ? secStart : secStart + ratio * usableSpan
              )
            )
          );
          el.scrollLeft = targetScrolled > 0 ? -targetScrolled : 0;
        }
        return;
      }

      if (isPaginated) {
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        const secStart = Math.max(0, secRect.left - vpRect.left + el.scrollLeft);
        const secEnd = Math.max(
          secStart,
          secRect.right - vpRect.left + el.scrollLeft
        );
        const span = Math.max(0, secEnd - secStart);
        const pageW = Math.max(
          200,
          pagedWidthPx || Math.floor(vpRect.width) || el.clientWidth
        );
        const stride = pageW + PAGE_GAP;
        const usableSpan =
          ratio >= 0.995 && hasMoreChaptersAfter
            ? Math.max(0, span - stride * 0.35)
            : span;
        const rawTarget = secStart + ratio * usableSpan;
        const pageIdx =
          ratio <= 0
            ? Math.floor((secStart + 4) / stride)
            : Math.round(rawTarget / stride);
        const targetLeft = Math.min(maxScroll, Math.max(0, pageIdx * stride));
        el.scrollLeft = targetLeft;
        return;
      }

      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const secStart = Math.max(0, secRect.top - vpRect.top + el.scrollTop);
      const secEnd = Math.max(
        secStart,
        secRect.bottom - vpRect.top + el.scrollTop
      );
      const span = Math.max(0, secEnd - secStart);
      const usableSpan =
        ratio >= 0.995 && hasMoreChaptersAfter
          ? Math.max(0, span - el.clientHeight * 0.45)
          : span;
      const targetTop = Math.min(
        maxScroll,
        Math.max(
          0,
          Math.round(ratio <= 0 ? secStart : secStart + ratio * usableSpan)
        )
      );
      el.scrollTop = targetTop;
    },
    [pagedWidthPx]
  );

  const syncProgressFromViewport = useCallback(
    (persistDb = true, updateLiveRefs = true) => {
      const curBook = bookRef.current;
      if (!curBook || prefsRef.current.readingMode === 'vn') return;
      const metrics = computeScrollMetrics();
      const maxChapIdx = Math.max(0, curBook.chapters.length - 1);
      const clampedChap = Math.max(0, Math.min(maxChapIdx, metrics.chapterIndex));
      const clampedRatio = Math.min(1, Math.max(0, metrics.ratio));

      setScrollPct(Math.round(clampedRatio * 100));
      setBookBarPct(Math.round(metrics.bookRatio * 100));
      setPageInfo({ current: metrics.current, total: metrics.total });

      if (updateLiveRefs) {
        const prevLiveChap = liveChapterRef.current;
        liveChapterRef.current = clampedChap;
        liveScrollRatioRef.current = clampedRatio;

        if (prevLiveChap !== clampedChap) {
          setBook((prev) =>
            prev && prev.storageKey === curBook.storageKey
              ? {
                  ...prev,
                  currentChapter: clampedChap,
                  scrollRatio: clampedRatio,
                }
              : prev
          );
        }
      }

      if (!persistDb) return;
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
      }
      const snapKey = curBook.storageKey;
      const snapBook = curBook;
      const snapVnIdx = vnIndexRef.current;
      progressTimerRef.current = window.setTimeout(() => {
        progressTimerRef.current = null;
        if (loadingBookRef.current || hasSavedOnCloseRef.current) return;
        saveNovelProgressSync({
          storageKey: snapBook.storageKey,
          catalogItemId: snapBook.catalogItemId,
          title: snapBook.title,
          author: snapBook.author,
          fileName: snapBook.fileName,
          totalChars: snapBook.totalChars,
          chapterCount: snapBook.chapters.length,
          currentChapter: clampedChap,
          scrollRatio: clampedRatio,
          vnIndex: snapVnIdx,
          bookmarks: snapBook.bookmarks ?? [],
          updatedAt: Date.now(),
        });
        void updateStoredNovelProgress(
          snapKey,
          clampedChap,
          clampedRatio,
          snapVnIdx
        );
      }, 250);
    },
    [computeScrollMetrics]
  );

  const getCurrentLiveProgress = useCallback(
    (explicitRatio?: number, explicitVnIdx?: number) => {
      const curBook = bookRef.current;
      if (
        loadingBookRef.current ||
        !curBook ||
        curBook.chapters.length === 0
      ) {
        return null;
      }
      const maxChapIdx = Math.max(0, curBook.chapters.length - 1);
      const isVn = prefsRef.current.readingMode === 'vn';
      if (isVn) {
        const chapterIndex = Math.max(
          0,
          Math.min(maxChapIdx, liveChapterRef.current)
        );
        const vnIdx = Math.max(0, explicitVnIdx ?? vnIndexRef.current);
        const ratio =
          explicitRatio ??
          (chapterParaLenRef.current > 1
            ? Math.min(1, vnIdx / (chapterParaLenRef.current - 1))
            : liveScrollRatioRef.current);
        return {
          chapterIndex,
          ratio: Math.min(1, Math.max(0, ratio)),
          vnIndex: vnIdx,
        };
      }

      const el = scrollContainerRef.current;
      const domReady = Boolean(
        el &&
          !restoringScrollRef.current &&
          userInteractedSinceRestoreRef.current &&
          el.clientWidth > 0 &&
          el.clientHeight > 0 &&
          (el.scrollHeight > el.clientHeight + 2 ||
            el.scrollWidth > el.clientWidth + 2 ||
            curBook.chapters.length <= 1)
      );

      if (domReady && explicitRatio === undefined) {
        const metrics = computeScrollMetrics();
        const chapterIndex = Math.max(
          0,
          Math.min(maxChapIdx, metrics.chapterIndex)
        );
        const ratio = Math.min(1, Math.max(0, metrics.ratio));
        liveChapterRef.current = chapterIndex;
        liveScrollRatioRef.current = ratio;
        return {
          chapterIndex,
          ratio,
          vnIndex: vnIndexRef.current,
        };
      }

      return {
        chapterIndex: Math.max(0, Math.min(maxChapIdx, liveChapterRef.current)),
        ratio: Math.min(
          1,
          Math.max(0, explicitRatio ?? liveScrollRatioRef.current)
        ),
        vnIndex: Math.max(0, explicitVnIdx ?? vnIndexRef.current),
      };
    },
    [computeScrollMetrics]
  );
  getLiveProgressRef.current = getCurrentLiveProgress;

  const flushProgressSyncNow = useCallback(
    (explicitRatio?: number, explicitVnIdx?: number) => {
      const currentBook = bookRef.current;
      if (!currentBook) return;
      const live = getCurrentLiveProgress(explicitRatio, explicitVnIdx);
      if (!live) return;

      liveChapterRef.current = live.chapterIndex;
      liveScrollRatioRef.current = live.ratio;
      vnIndexRef.current = live.vnIndex;

      saveNovelProgressSync({
        storageKey: currentBook.storageKey,
        catalogItemId: currentBook.catalogItemId,
        title: currentBook.title,
        author: currentBook.author,
        fileName: currentBook.fileName,
        totalChars: currentBook.totalChars,
        chapterCount: currentBook.chapters.length,
        currentChapter: live.chapterIndex,
        scrollRatio: live.ratio,
        vnIndex: live.vnIndex,
        bookmarks: currentBook.bookmarks ?? [],
        updatedAt: Date.now(),
      });
      scheduleCloudLibraryPush(userIdRef.current);
    },
    [getCurrentLiveProgress]
  );
  flushProgressSyncRef.current = () => {
    flushProgressSyncNow();
  };

  const persistCurrentProgress = useCallback(
    async (explicitRatio?: number, explicitVnIdx?: number) => {
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      const curBook = bookRef.current;
      if (!curBook) return null;
      const live = getCurrentLiveProgress(explicitRatio, explicitVnIdx);
      if (!live) return null;

      flushProgressSyncNow(live.ratio, live.vnIndex);
      await updateStoredNovelProgress(
        curBook.storageKey,
        live.chapterIndex,
        live.ratio,
        live.vnIndex
      );

      setBook((prev) =>
        prev && prev.storageKey === curBook.storageKey
          ? {
              ...prev,
              currentChapter: live.chapterIndex,
              scrollRatio: live.ratio,
              vnIndex: live.vnIndex,
            }
          : prev
      );
      return live;
    },
    [getCurrentLiveProgress, flushProgressSyncNow]
  );

  useEffect(() => {
    const onHideOrUnload = () => {
      if (!hasSavedOnCloseRef.current && !loadingBookRef.current) {
        flushProgressSyncRef.current();
      }
    };
    const onVisibilityChange = () => {
      if (
        document.visibilityState === 'hidden' &&
        !hasSavedOnCloseRef.current &&
        !loadingBookRef.current
      ) {
        flushProgressSyncRef.current();
      }
    };
    window.addEventListener('pagehide', onHideOrUnload);
    window.addEventListener('beforeunload', onHideOrUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (!hasSavedOnCloseRef.current && !loadingBookRef.current) {
        flushProgressSyncRef.current();
      }
      window.removeEventListener('pagehide', onHideOrUnload);
      window.removeEventListener('beforeunload', onHideOrUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const handleCloseReader = useCallback(async () => {
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    await persistCurrentProgress();
    hasSavedOnCloseRef.current = true;
    onBookLibraryChanged?.();
    window.dispatchEvent(new CustomEvent(LIBRARY_DATA_CHANGED_EVENT));
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore fullscreen exit error
      }
    }
    onClose();
  }, [persistCurrentProgress, onBookLibraryChanged, onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onFsChange = () => {
      const fsActive = Boolean(document.fullscreenElement);
      setIsFullscreen(fsActive);
      if (!fsActive) {
        setZenMode(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const isCurrentlyFsOrZen = Boolean(document.fullscreenElement) || zenMode;
    if (isCurrentlyFsOrZen) {
      setZenMode(false);
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // ignore
        }
      }
      return;
    }

    setShowSettings(false);
    setShowToc(false);
    setShowBacklog(false);
    setZenMode(true);
    try {
      await readerRootRef.current?.requestFullscreen?.();
    } catch {
      // Fallback gracefully to full-viewport 100dvh edge-to-edge Zen Mode (e.g. iOS Safari)
    }
  }, [zenMode]);

  const handleSwitchChapter = useCallback(
    (
      nextIdx: number,
      opts?: { jumpToEnd?: boolean; targetScrollRatio?: number; targetVnIndex?: number }
    ) => {
      if (!book) return;
      const clamped = Math.max(0, Math.min(book.chapters.length - 1, nextIdx));
      const targetRatio = opts?.targetScrollRatio ?? (opts?.jumpToEnd ? 1 : 0);
      const nextChapterParagraphs = extractChapterParagraphs(
        book.chapters[clamped]?.html ?? ''
      );
      const targetVn =
        typeof opts?.targetVnIndex === 'number'
          ? Math.max(0, Math.min(nextChapterParagraphs.length - 1, opts.targetVnIndex))
          : opts?.jumpToEnd
            ? Math.max(0, nextChapterParagraphs.length - prefs.vnParagraphsPerStep)
            : 0;

      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      pendingJumpToEndRef.current = Boolean(opts?.jumpToEnd);
      pendingJumpTargetRef.current = {
        chapterIndex: clamped,
        chapterRatio: targetRatio,
      };
      liveChapterRef.current = clamped;
      liveScrollRatioRef.current = targetRatio;
      vnIndexRef.current = targetVn;
      userInteractedSinceRestoreRef.current = false;
      setExplicitJumpToken((t) => t + 1);

      const updated: StoredNovelBook = {
        ...book,
        currentChapter: clamped,
        scrollRatio: targetRatio,
        vnIndex: targetVn,
        updatedAt: Date.now(),
      };
      bookRef.current = updated;
      setBook(updated);
      setVnIndex(targetVn);
      setScrollPct(Math.round(targetRatio * 100));
      setShowToc(false);
      setShowBacklog(false);
      setSelectedSentence('');
      void saveStoredNovelBook(updated);
      scheduleCloudLibraryPush(userIdRef.current);
    },
    [book, prefs.vnParagraphsPerStep]
  );

  // Clamp vnIndex cleanly if chapter paragraphs change
  useEffect(() => {
    if (chapterParagraphs.length === 0) return;
    if (vnIndex >= chapterParagraphs.length) {
      setVnIndex(Math.max(0, chapterParagraphs.length - 1));
    }
  }, [chapterParagraphs.length, vnIndex]);

  // Reset vertical scroll position inside VN vertical viewport when advancing/stepping
  useEffect(() => {
    if (prefs.readingMode !== 'vn' || prefs.writingMode !== 'vertical') return;
    const el = vnVerticalViewportRef.current;
    if (el) el.scrollLeft = 0;
  }, [vnIndex, book?.currentChapter, prefs.readingMode, prefs.writingMode]);

  // Smoothly scroll stream view to latest revealed VN paragraph
  useEffect(() => {
    if (
      prefs.readingMode === 'vn' &&
      prefs.vnDisplayStyle === 'stream' &&
      vnStreamEndRef.current
    ) {
      vnStreamEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [vnIndex, prefs.readingMode, prefs.vnDisplayStyle]);

  // Synchronously initialize strict line-by-line reveal in VN mode before frame paint
  useLayoutEffect(() => {
    if (
      loadingBook ||
      !book ||
      !activeChapter ||
      prefs.readingMode !== 'vn' ||
      chapterParagraphs.length === 0
    ) {
      vnRevealControllerRef.current?.cancel();
      vnRevealControllerRef.current = null;
      return;
    }

    const article = articleRef.current;
    if (!article) return;

    const targets = Array.from(
      article.querySelectorAll<HTMLElement>('[data-vn-reveal="true"]')
    );
    if (targets.length === 0) return;

    const controller = startLineByLineReveal(targets, {
      style: prefs.vnAnimation,
      writingMode: prefs.writingMode,
      durationPerLineMs: prefsRef.current.vnAnimationDurationMs,
    });
    vnRevealControllerRef.current = controller;

    return () => {
      controller.cancel();
      if (vnRevealControllerRef.current === controller) {
        vnRevealControllerRef.current = null;
      }
    };
  }, [
    loadingBook,
    book?.storageKey,
    book?.currentChapter,
    Boolean(activeChapter),
    prefs.readingMode,
    prefs.vnDisplayStyle,
    prefs.writingMode,
    prefs.vnAnimation,
    prefs.vnParagraphsPerStep,
    vnIndex,
    chapterParagraphs.length,
    animPreviewTick,
  ]);

  // Live line-by-line preview in Settings -> VN & Animasi tab
  useLayoutEffect(() => {
    if (!showSettings || settingsTab !== 'vn') {
      vnPreviewControllerRef.current?.cancel();
      vnPreviewControllerRef.current = null;
      return;
    }

    const previewEl = vnPreviewContainerRef.current;
    if (!previewEl) return;

    const controller = startLineByLineReveal([previewEl], {
      style: prefs.vnAnimation,
      writingMode: 'horizontal',
      durationPerLineMs: prefsRef.current.vnAnimationDurationMs,
    });
    vnPreviewControllerRef.current = controller;

    return () => {
      controller.cancel();
      if (vnPreviewControllerRef.current === controller) {
        vnPreviewControllerRef.current = null;
      }
    };
  }, [
    showSettings,
    settingsTab,
    prefs.vnAnimation,
    animPreviewTick,
  ]);

  // Guard passive scroll sync across layout transitions before scroll restore completes
  useLayoutEffect(() => {
    if (loadingBook || !book || prefs.readingMode === 'vn') {
      restoringScrollRef.current = false;
      return;
    }
    restoringScrollRef.current = true;
  }, [
    loadingBook,
    book?.storageKey,
    explicitJumpToken,
    prefs.writingMode,
    prefs.readingMode,
    prefs.fontSize,
    prefs.lineHeight,
    prefs.letterSpacing,
    prefs.maxWidth,
    prefs.indentParagraphs,
    pagedWidthPx,
  ]);

  // Restore scroll position cleanly on explicit navigation or layout reflow (never on passive scroll)
  useEffect(() => {
    if (loadingBook || !book || prefs.readingMode === 'vn') return;
    if (prefs.readingMode === 'paginated' && pagedWidthPx <= 0) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    let raf3 = 0;

    const applyRestore = (isFontReanchor: boolean) => {
      if (cancelled) return;
      if (isFontReanchor && userInteractedSinceRestoreRef.current) return;
      const jumpTarget = isFontReanchor ? null : pendingJumpTargetRef.current;
      if (!isFontReanchor) {
        pendingJumpTargetRef.current = null;
      }
      const maxChap = Math.max(0, (bookRef.current?.chapters.length ?? 1) - 1);
      const targetChapter = Math.max(
        0,
        Math.min(maxChap, jumpTarget?.chapterIndex ?? liveChapterRef.current)
      );
      const targetRatio = Math.min(
        1,
        Math.max(
          0,
          jumpTarget?.chapterRatio ??
            (!isFontReanchor && pendingJumpToEndRef.current
              ? 1
              : liveScrollRatioRef.current)
        )
      );
      if (!isFontReanchor) {
        pendingJumpToEndRef.current = false;
        liveChapterRef.current = targetChapter;
        liveScrollRatioRef.current = targetRatio;
      }

      scrollToChapterPosition(targetChapter, targetRatio);
      const m = computeScrollMetrics();
      setScrollPct(Math.round(targetRatio * 100));
      setBookBarPct(Math.round(m.bookRatio * 100));
      setPageInfo({ current: m.current, total: m.total });
    };

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        applyRestore(false);
        userInteractedSinceRestoreRef.current = false;
        raf3 = window.requestAnimationFrame(() => {
          if (!cancelled) {
            restoringScrollRef.current = false;
          }
        });
      });
    });

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (cancelled || userInteractedSinceRestoreRef.current) return;
        window.requestAnimationFrame(() => {
          applyRestore(true);
        });
      });
    }

    return () => {
      cancelled = true;
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      if (raf3) window.cancelAnimationFrame(raf3);
    };
  }, [
    loadingBook,
    book?.storageKey,
    explicitJumpToken,
    prefs.writingMode,
    prefs.readingMode,
    prefs.fontSize,
    prefs.lineHeight,
    prefs.letterSpacing,
    prefs.maxWidth,
    prefs.indentParagraphs,
    pagedWidthPx,
    scrollToChapterPosition,
    computeScrollMetrics,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep page counter updated when viewport resizes
  useEffect(() => {
    const onResize = () => {
      if (!bookRef.current || prefsRef.current.readingMode === 'vn') return;
      const m = computeScrollMetrics();
      setPageInfo({ current: m.current, total: m.total });
      setBookBarPct(Math.round(m.bookRatio * 100));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computeScrollMetrics]);

  const handleStepForward = useCallback(() => {
    if (!book) return;
    userInteractedSinceRestoreRef.current = true;

    if (prefs.readingMode === 'vn') {
      if (vnRevealControllerRef.current?.isRunning()) {
        vnRevealControllerRef.current.finishNow();
        return;
      }
      const nextVn = vnIndex + prefs.vnParagraphsPerStep;
      if (nextVn >= chapterParagraphs.length) {
        if (book.currentChapter < book.chapters.length - 1) {
          handleSwitchChapter(book.currentChapter + 1);
          toast.success(`Masuk Bab ${book.currentChapter + 2}`);
        } else {
          toast('Sudah di paragraf terakhir buku ini.');
        }
        return;
      }
      vnIndexRef.current = nextVn;
      setVnIndex(nextVn);
      setSelectedSentence('');
      const ratio =
        chapterParagraphs.length > 1
          ? Math.min(1, nextVn / (chapterParagraphs.length - 1))
          : 0;
      liveChapterRef.current = book.currentChapter;
      liveScrollRatioRef.current = ratio;
      setScrollPct(Math.round(ratio * 100));
      flushProgressSyncNow(ratio, nextVn);
      if (progressTimerRef.current) window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = window.setTimeout(() => {
        void updateStoredNovelProgress(
          book.storageKey,
          book.currentChapter,
          ratio,
          nextVn
        );
      }, 250);
      return;
    }

    const el = scrollContainerRef.current;
    if (!el) return;

    if (prefs.readingMode === 'paginated') {
      if (prefs.writingMode === 'vertical') {
        const clientW = Math.max(
          200,
          Math.floor(el.getBoundingClientRect().width) || el.clientWidth
        );
        const stride = Math.max(200, Math.round(clientW * 0.92));
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        const scrolled = Math.abs(el.scrollLeft);
        if (scrolled >= maxScroll - 4) {
          toast('Sudah di halaman terakhir buku ini.');
          return;
        }
        const nextScrolled = Math.min(maxScroll, scrolled + stride);
        el.scrollTo({
          left: nextScrolled > 0 ? -nextScrolled : 0,
          behavior: 'auto',
        });
        syncProgressFromViewport(true);
        return;
      }

      const pageW = Math.max(
        200,
        pagedWidthPx ||
          Math.floor(el.getBoundingClientRect().width) ||
          el.clientWidth
      );
      const stride = pageW + PAGE_GAP;
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (el.scrollLeft >= maxScroll - 4) {
        toast('Sudah di halaman terakhir buku ini.');
        return;
      }
      const curIdx = Math.round(el.scrollLeft / stride);
      const targetLeft = Math.min(maxScroll, (curIdx + 1) * stride);
      el.scrollTo({ left: targetLeft, behavior: 'auto' });
      syncProgressFromViewport(true);
      return;
    }

    if (prefs.writingMode === 'vertical') {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const scrolled = Math.abs(el.scrollLeft);
      if (scrolled >= maxScroll - 18) {
        toast('Sudah di bagian akhir buku ini.');
        return;
      }
      const step = Math.max(220, Math.round(el.clientWidth * 0.88));
      el.scrollBy({ left: -step, behavior: 'smooth' });
      return;
    }

    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    if (el.scrollTop >= maxScroll - 18) {
      toast('Sudah di bagian akhir buku ini.');
      return;
    }
    const step = Math.max(220, Math.round(el.clientHeight * 0.88));
    el.scrollBy({ top: step, behavior: 'smooth' });
  }, [
    book,
    prefs.readingMode,
    prefs.vnParagraphsPerStep,
    prefs.writingMode,
    pagedWidthPx,
    vnIndex,
    chapterParagraphs.length,
    flushProgressSyncNow,
    syncProgressFromViewport,
    handleSwitchChapter,
  ]);

  const handleStepBackward = useCallback(() => {
    if (!book) return;
    userInteractedSinceRestoreRef.current = true;

    if (prefs.readingMode === 'vn') {
      if (vnIndex <= 0) {
        if (book.currentChapter > 0) {
          handleSwitchChapter(book.currentChapter - 1, { jumpToEnd: true });
        } else {
          toast('Ini paragraf pertama bab awal.');
        }
        return;
      }
      const prevVn = Math.max(0, vnIndex - prefs.vnParagraphsPerStep);
      vnIndexRef.current = prevVn;
      setVnIndex(prevVn);
      setSelectedSentence('');
      const ratio =
        chapterParagraphs.length > 1
          ? Math.min(1, prevVn / (chapterParagraphs.length - 1))
          : 0;
      liveChapterRef.current = book.currentChapter;
      liveScrollRatioRef.current = ratio;
      setScrollPct(Math.round(ratio * 100));
      flushProgressSyncNow(ratio, prevVn);
      if (progressTimerRef.current) window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = window.setTimeout(() => {
        void updateStoredNovelProgress(
          book.storageKey,
          book.currentChapter,
          ratio,
          prevVn
        );
      }, 250);
      return;
    }

    const el = scrollContainerRef.current;
    if (!el) return;

    if (prefs.readingMode === 'paginated') {
      if (prefs.writingMode === 'vertical') {
        const clientW = Math.max(
          200,
          Math.floor(el.getBoundingClientRect().width) || el.clientWidth
        );
        const stride = Math.max(200, Math.round(clientW * 0.92));
        const scrolled = Math.abs(el.scrollLeft);
        if (scrolled <= 4) {
          toast('Ini halaman pertama buku ini.');
          return;
        }
        const prevScrolled = Math.max(0, scrolled - stride);
        el.scrollTo({
          left: prevScrolled > 0 ? -prevScrolled : 0,
          behavior: 'auto',
        });
        syncProgressFromViewport(true);
        return;
      }

      const pageW = Math.max(
        200,
        pagedWidthPx ||
          Math.floor(el.getBoundingClientRect().width) ||
          el.clientWidth
      );
      const stride = pageW + PAGE_GAP;
      if (el.scrollLeft <= 4) {
        toast('Ini halaman pertama buku ini.');
        return;
      }
      const curIdx = Math.round(el.scrollLeft / stride);
      const targetLeft = Math.max(0, (curIdx - 1) * stride);
      el.scrollTo({ left: targetLeft, behavior: 'auto' });
      syncProgressFromViewport(true);
      return;
    }

    if (prefs.writingMode === 'vertical') {
      const scrolled = Math.abs(el.scrollLeft);
      if (scrolled <= 18) {
        toast('Ini bagian awal buku ini.');
        return;
      }
      const step = Math.max(220, Math.round(el.clientWidth * 0.88));
      el.scrollBy({ left: step, behavior: 'smooth' });
      return;
    }

    if (el.scrollTop <= 18) {
      toast('Ini bagian awal buku ini.');
      return;
    }
    const step = Math.max(220, Math.round(el.clientHeight * 0.88));
    el.scrollBy({ top: -step, behavior: 'smooth' });
  }, [
    book,
    prefs.readingMode,
    prefs.vnParagraphsPerStep,
    prefs.writingMode,
    pagedWidthPx,
    vnIndex,
    chapterParagraphs.length,
    flushProgressSyncNow,
    syncProgressFromViewport,
    handleSwitchChapter,
  ]);

  const handleAddBookmark = useCallback(async () => {
    if (!book || !activeChapter) return;
    const isVn = prefs.readingMode === 'vn';
    const live = getCurrentLiveProgress();
    const bmChapterIdx = live?.chapterIndex ?? book.currentChapter;
    const bmRatio = live?.ratio ?? book.scrollRatio ?? 0;
    const bmChapter = book.chapters[bmChapterIdx] ?? activeChapter;
    const bmParagraphs =
      bmChapterIdx === book.currentChapter
        ? chapterParagraphs
        : extractChapterParagraphs(bmChapter.html);
    const excerpt = isVn
      ? bmParagraphs[vnIndex]?.text || bmChapter.title
      : bmParagraphs[
          Math.min(
            Math.max(0, bmParagraphs.length - 1),
            Math.floor(bmRatio * Math.max(1, bmParagraphs.length - 1))
          )
        ]?.text || bmChapter.title;

    const bookmark: NovelBookmark = {
      id: `bm-${Date.now()}`,
      chapterIndex: bmChapterIdx,
      chapterTitle: bmChapter.title,
      scrollRatio: isVn
        ? bmParagraphs.length > 1
          ? vnIndex / (bmParagraphs.length - 1)
          : 0
        : bmRatio,
      vnIndex: isVn ? vnIndex : undefined,
      excerpt: excerpt.slice(0, 75),
      createdAt: Date.now(),
    };
    const nextBookmarks = await addStoredNovelBookmark(book.storageKey, bookmark);
    setBook((prev) => (prev ? { ...prev, bookmarks: nextBookmarks } : prev));
    scheduleCloudLibraryPush(userIdRef.current);
    window.dispatchEvent(new CustomEvent(LIBRARY_DATA_CHANGED_EVENT));
    toast.success(`Bookmark disimpan di Bab ${bmChapterIdx + 1}!`);
  }, [
    book,
    activeChapter,
    getCurrentLiveProgress,
    prefs.readingMode,
    chapterParagraphs,
    vnIndex,
  ]);

  const handleSavePositionNow = useCallback(async () => {
    const currentBook = bookRef.current;
    if (!currentBook) return;

    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    const saved = await persistCurrentProgress();
    if (!saved) return;

    const cloudRes = await pushCloudLibraryNow(userIdRef.current);
    const updatedList = await listStoredNovelBooks();
    setSavedBooks(updatedList);
    onBookLibraryChanged?.();
    window.dispatchEvent(new CustomEvent(LIBRARY_DATA_CHANGED_EVENT));

    const pct = Math.min(100, Math.max(0, Math.round(saved.ratio * 100)));
    toast.success(
      `Posisi tersimpan: Bab ${saved.chapterIndex + 1}/${currentBook.chapters.length} (${pct}%)${
        cloudRes === 'synced' ? ' • Cloud' : ''
      }`
    );
  }, [persistCurrentProgress, onBookLibraryChanged]);

  const handleDeleteBookmark = async (bookmarkId: string) => {
    if (!book) return;
    const nextBookmarks = await deleteStoredNovelBookmark(
      book.storageKey,
      bookmarkId
    );
    setBook((prev) => (prev ? { ...prev, bookmarks: nextBookmarks } : prev));
    scheduleCloudLibraryPush(userIdRef.current);
    toast.success('Bookmark dihapus.');
  };

  const handleSpeakSelectedSentence = useCallback(() => {
    const clean = selectedSentence.trim();
    if (!clean) return;
    setOneShotSpeakRequest({ id: Date.now(), text: clean });
  }, [selectedSentence]);

  const handleExplainSelectedSentence = useCallback(async () => {
    const clean = selectedSentence.trim();
    if (!clean) return;
    const ttsSettings = loadAiTtsSettings();
    if (!hasAiTextKey(ttsSettings)) {
      setAudioPanelTab('ai');
      setShowAudioPanel(true);
      setShowSettings(false);
      setShowToc(false);
      setShowBacklog(false);
      toast(
        'Pilih Google Gemini AI (API Key gratis dari AI Studio) atau OpenAI di panel Audio/AI terlebih dahulu.'
      );
      return;
    }

    if (aiExplainAbortRef.current) {
      aiExplainAbortRef.current.abort();
    }
    const ac = new AbortController();
    aiExplainAbortRef.current = ac;

    setAiExplainState({
      sentence: clean,
      loading: true,
      text: '',
      error: '',
    });

    try {
      const answer = await explainJapaneseSentenceWithAi(
        clean,
        ttsSettings,
        ac.signal
      );
      setAiExplainState((prev) =>
        prev && prev.sentence === clean
          ? { sentence: clean, loading: false, text: answer, error: '' }
          : prev
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal meminta penjelasan dari AI.';
      setAiExplainState((prev) =>
        prev && prev.sentence === clean
          ? { sentence: clean, loading: false, text: '', error: msg }
          : prev
      );
    }
  }, [selectedSentence]);

  useEffect(() => {
    return () => {
      if (aiExplainAbortRef.current) {
        aiExplainAbortRef.current.abort();
      }
    };
  }, []);

  // Global keyboard shortcuts inside Reader
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (aiExplainState) {
          aiExplainAbortRef.current?.abort();
          setAiExplainState(null);
        } else if (showShortcuts) {
          setShowShortcuts(false);
        } else if (showAudioPanel) {
          setShowAudioPanel(false);
        } else if (showBacklog) {
          setShowBacklog(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else if (showToc) {
          setShowToc(false);
        } else if (zenMode) {
          setZenMode(false);
        } else {
          void handleCloseReader();
        }
        return;
      }

      if (!book) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      if (showShortcuts || showToc || showBacklog || showAudioPanel) return;

      const lower = e.key.toLowerCase();
      const isVertical = prefs.writingMode === 'vertical';

      if (
        e.key === ' ' ||
        e.key === 'Enter' ||
        e.key === 'PageDown' ||
        lower === 'j' ||
        (!isVertical && e.key === 'ArrowRight') ||
        (isVertical && e.key === 'ArrowLeft')
      ) {
        e.preventDefault();
        handleStepForward();
      } else if (
        e.key === 'Backspace' ||
        e.key === 'PageUp' ||
        lower === 'k' ||
        (!isVertical && e.key === 'ArrowLeft') ||
        (isVertical && e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        handleStepBackward();
      } else if (e.key === '[') {
        e.preventDefault();
        if (book.currentChapter > 0) {
          handleSwitchChapter(book.currentChapter - 1);
        }
      } else if (e.key === ']') {
        e.preventDefault();
        if (book.currentChapter < book.chapters.length - 1) {
          handleSwitchChapter(book.currentChapter + 1);
        }
      } else if (lower === 'v') {
        e.preventDefault();
        const nextMode: ReaderMode =
          prefs.readingMode === 'vn' ? 'paginated' : 'vn';
        updatePrefs({ readingMode: nextMode });
        toast.success(
          nextMode === 'vn' ? 'Mode VN aktif' : 'Mode Page aktif'
        );
      } else if (lower === 'p') {
        e.preventDefault();
        const nextMode: ReaderMode =
          prefs.readingMode === 'scroll'
            ? 'paginated'
            : prefs.readingMode === 'paginated'
              ? 'vn'
              : 'scroll';
        updatePrefs({ readingMode: nextMode });
        toast.success(
          nextMode === 'vn'
            ? 'Mode VN'
            : nextMode === 'paginated'
              ? 'Mode Page'
              : 'Mode Continuous'
        );
      } else if (lower === 't') {
        e.preventDefault();
        const nextWriting = isVertical ? 'horizontal' : 'vertical';
        updatePrefs({ writingMode: nextWriting });
        toast.success(
          nextWriting === 'vertical'
            ? 'Teks Vertikal (縦書き) aktif'
            : 'Teks Horizontal aktif'
        );
      } else if (lower === 'f') {
        e.preventDefault();
        const nextFurigana =
          prefs.furigana === 'show'
            ? 'hover'
            : prefs.furigana === 'hover'
              ? 'hide'
              : 'show';
        updatePrefs({ furigana: nextFurigana });
        toast.success(
          nextFurigana === 'show'
            ? 'Furigana: Tampil'
            : nextFurigana === 'hover'
              ? 'Furigana: Hover'
              : 'Furigana: Sembunyi'
        );
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        updatePrefs({ fontSize: Math.min(34, prefs.fontSize + 1) });
      } else if (e.key === '-') {
        e.preventDefault();
        updatePrefs({ fontSize: Math.max(16, prefs.fontSize - 1) });
      } else if (lower === 'b') {
        e.preventDefault();
        void handleAddBookmark();
      } else if (lower === 'c') {
        e.preventDefault();
        setShowToc((prev) => !prev);
        setShowSettings(false);
        setShowAudioPanel(false);
      } else if (lower === 'h') {
        e.preventDefault();
        setShowBacklog((prev) => !prev);
        setShowSettings(false);
        setShowAudioPanel(false);
      } else if (lower === 'a') {
        e.preventDefault();
        setShowAudioPanel((prev) => !prev);
        setShowSettings(false);
        setShowToc(false);
        setShowBacklog(false);
      } else if (lower === 's') {
        e.preventDefault();
        setShowSettings((prev) => !prev);
        setShowAudioPanel(false);
      } else if (lower === 'm') {
        e.preventDefault();
        void handleToggleFullscreen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    book,
    aiExplainState,
    showAudioPanel,
    showShortcuts,
    showBacklog,
    showSettings,
    showToc,
    zenMode,
    prefs.writingMode,
    prefs.readingMode,
    prefs.furigana,
    prefs.fontSize,
    handleCloseReader,
    handleStepForward,
    handleStepBackward,
    handleSwitchChapter,
    handleAddBookmark,
    handleToggleFullscreen,
    updatePrefs,
  ]);

  const handleSelectLibraryBook = useCallback(
    async (targetKey: string) => {
      if (bookRef.current && bookRef.current.storageKey !== targetKey) {
        flushProgressSyncNow();
        await persistCurrentProgress();
      }
      setLastOpenedNovelKey(targetKey);
      await loadBookByKey(targetKey);
      setShowToc(false);
    },
    [flushProgressSyncNow, persistCurrentProgress, loadBookByKey]
  );

  const handleImportFiles = async (
    files: FileList | File[],
    mode: 'context' | 'add' = 'add'
  ) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    if (bookRef.current) {
      flushProgressSyncNow();
      await persistCurrentProgress();
    }

    setImporting(true);
    let lastParsed: StoredNovelBook | null = null;
    let lastDeduplicated = false;
    let importedCount = 0;

    try {
      for (const file of fileArray) {
        const useContextKey =
          mode === 'context' &&
          fileArray.length === 1 &&
          activeKey !== 'local:quick-reader' &&
          activeKey !== 'local:library';

        const result = await importNovelFileToLibrary(file, {
          preferredStorageKey: useContextKey ? activeKey : undefined,
          catalogItemId: useContextKey ? target.catalogItemId : undefined,
          fallbackTitle:
            fileArray.length === 1 && mode === 'context'
              ? target.title
              : undefined,
        });

        lastParsed = result.book;
        lastDeduplicated = result.deduplicated;
        importedCount += 1;
      }

      if (lastParsed) {
        const initChapter = lastParsed.currentChapter;
        const initRatio = lastParsed.scrollRatio || 0;
        const initVn = lastParsed.vnIndex ?? 0;
        hasSavedOnCloseRef.current = false;
        userInteractedSinceRestoreRef.current = false;
        liveChapterRef.current = initChapter;
        liveScrollRatioRef.current = initRatio;
        vnIndexRef.current = initVn;
        pendingJumpTargetRef.current = {
          chapterIndex: initChapter,
          chapterRatio: initRatio,
        };
        setExplicitJumpToken((t) => t + 1);
        setActiveKey(lastParsed.storageKey);
        setLastOpenedNovelKey(lastParsed.storageKey);
        setBook(lastParsed);
        setVnIndex(initVn);
        setScrollPct(Math.round(initRatio * 100));
        sessionStartMsRef.current = Date.now();
        setTimerResetToken((t) => t + 1);
        loadingBookRef.current = false;
        setLoadingBook(false);
      }

      const list = await listStoredNovelBooks();
      setSavedBooks(list);
      void refreshStorageStatus();
      onBookLibraryChanged?.();
      window.dispatchEvent(new CustomEvent(LIBRARY_DATA_CHANGED_EVENT));
      scheduleCloudLibraryPush(userIdRef.current);

      if (importedCount === 1 && lastParsed) {
        toast.success(
          lastDeduplicated
            ? `「${lastParsed.title}」 dilanjutkan dari Library (Bab ${lastParsed.currentChapter + 1}/${lastParsed.chapters.length})!`
            : `「${lastParsed.title}」 (${lastParsed.chapters.length} bab) tersimpan di Library permanen!`
        );
      } else if (importedCount > 1) {
        toast.success(
          `${importedCount} buku diproses ke Library permanen!`
        );
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal membuka file EPUB/TXT.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteLibraryBook = async (storageKey: string) => {
    await deleteStoredNovelBook(storageKey);
    const remaining = await listStoredNovelBooks();
    setSavedBooks(remaining);
    if (bookRef.current?.storageKey === storageKey) {
      if (remaining.length > 0) {
        await loadBookByKey(remaining[0].storageKey);
      } else {
        liveChapterRef.current = 0;
        liveScrollRatioRef.current = 0;
        vnIndexRef.current = 0;
        setBook(null);
      }
    }
    void refreshStorageStatus();
    onBookLibraryChanged?.();
    scheduleCloudLibraryPush(userIdRef.current);
    toast.success('Buku dihapus dari Library.');
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
        `Backup (${backup.bookCount} buku, ${backup.watchlistCount} Daftar Saya) berhasil diunduh!`
      );
    } catch {
      toast.error('Gagal membuat file backup library.');
    }
  };

  const handleRestoreLibraryBackup = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoringBackup(true);
    try {
      const raw = await file.text();
      const res = await importFullLibraryBackup(raw, userIdRef.current);
      const list = await listStoredNovelBooks();
      setSavedBooks(list);
      if (!bookRef.current && list.length > 0) {
        await loadBookByKey(list[0].storageKey);
      }
      onBookLibraryChanged?.();
      toast.success(
        `Dipulihkan: ${res.booksImported} buku & ${res.watchlistCount} Daftar Saya!`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal memulihkan file backup.'
      );
    } finally {
      setRestoringBackup(false);
      e.target.value = '';
    }
  };

  const handleScroll = () => {
    if (!book || prefs.readingMode === 'vn' || restoringScrollRef.current) {
      return;
    }
    userInteractedSinceRestoreRef.current = true;
    syncProgressFromViewport(true);
  };

  const handleScrubBookProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!book || prefs.readingMode === 'vn') return;
    const el = scrollContainerRef.current;
    if (!el) return;
    userInteractedSinceRestoreRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width))
    );

    if (prefs.writingMode === 'vertical') {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (prefs.readingMode === 'paginated') {
        const clientW = Math.max(
          200,
          Math.floor(el.getBoundingClientRect().width) || el.clientWidth
        );
        const stride = Math.max(200, Math.round(clientW * 0.92));
        const pageIdx = Math.round((maxScroll * clickRatio) / stride);
        const targetScrolled = Math.min(maxScroll, Math.max(0, pageIdx * stride));
        el.scrollTo({
          left: targetScrolled > 0 ? -targetScrolled : 0,
          behavior: 'auto',
        });
        syncProgressFromViewport(true);
      } else {
        const targetScrolled = Math.round(maxScroll * clickRatio);
        el.scrollTo({
          left: targetScrolled > 0 ? -targetScrolled : 0,
          behavior: 'smooth',
        });
      }
      return;
    }

    if (prefs.readingMode === 'paginated') {
      const pageW = Math.max(
        200,
        pagedWidthPx ||
          Math.floor(el.getBoundingClientRect().width) ||
          el.clientWidth
      );
      const stride = pageW + PAGE_GAP;
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const pageIdx = Math.round((maxScroll * clickRatio) / stride);
      const targetLeft = Math.min(maxScroll, Math.max(0, pageIdx * stride));
      el.scrollTo({ left: targetLeft, behavior: 'auto' });
      syncProgressFromViewport(true);
      return;
    }

    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTo({ top: Math.round(maxScroll * clickRatio), behavior: 'smooth' });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (prefs.readingMode === 'paginated') {
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
      e.preventDefault();
      userInteractedSinceRestoreRef.current = true;
      const now = Date.now();
      if (now - wheelPageCooldownRef.current < 180) return;
      wheelPageCooldownRef.current = now;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        if (e.deltaY > 0) handleStepForward();
        else handleStepBackward();
      } else if (prefs.writingMode === 'vertical') {
        if (e.deltaX < 0) handleStepForward();
        else handleStepBackward();
      } else {
        if (e.deltaX > 0) handleStepForward();
        else handleStepBackward();
      }
      return;
    }

    if (prefs.writingMode !== 'vertical') return;
    const el =
      prefs.readingMode === 'vn'
        ? vnVerticalViewportRef.current
        : scrollContainerRef.current;
    if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    userInteractedSinceRestoreRef.current = true;
    el.scrollLeft -= e.deltaY;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    userInteractedSinceRestoreRef.current = true;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !book || e.changedTouches.length !== 1) return;

    // Never turn page if user just selected text for Yomitan / copy
    const activeSel = window.getSelection()?.toString().trim();
    if (activeSel) return;

    const elapsed = Date.now() - start.time;
    if (elapsed > 800) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (Math.abs(dx) < 48 || Math.abs(dy) > Math.abs(dx) * 0.85) return;

    const swipedLeft = dx < 0;
    if (prefs.writingMode === 'vertical') {
      if (swipedLeft) handleStepBackward();
      else handleStepForward();
    } else {
      if (swipedLeft) handleStepForward();
      else handleStepBackward();
    }
  };

  const handleMouseOrKeySelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectedSentence('');
      return;
    }
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (
      text.length >= 2 &&
      text.length <= 320 &&
      articleRef.current &&
      sel.anchorNode &&
      articleRef.current.contains(sel.anchorNode)
    ) {
      setSelectedSentence(text);
    } else {
      setSelectedSentence('');
    }
  };

  const handleDeleteCurrentBook = async () => {
    if (!book) return;
    await handleDeleteLibraryBook(book.storageKey);
    setShowSettings(false);
  };

  const handleOpenEpubPortal = (copyTitle: string) => {
    try {
      void navigator.clipboard?.writeText(copyTitle);
    } catch {
      // ignore clipboard errors
    }
    toast.success(
      `Judul 「${copyTitle}」 disalin! Tempel (Ctrl+V) di Epub.moe → Enter → klik Download.`
    );
  };

  const handleSaveYatsuLink = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeYatsuUrl(yatsuInput);
    if (!normalized) {
      toast.error(
        'Tempel link buku Yatsu seperti https://app.yatsu.moe/b?id=... atau ID bukunya.'
      );
      return;
    }
    const updated = saveYatsuBookLink(activeKey, normalized);
    setYatsuLinks(updated);
    setYatsuInput(normalized);
    scheduleCloudLibraryPush(userIdRef.current);
    toast.success('Link buku Yatsu disimpan!');
  };

  const handleUploadCustomFont = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFont(true);
    try {
      const added = await saveCustomFontFile(file);
      setCustomFonts(loadCustomReaderFonts());
      updatePrefs({ fontFamily: added.id });
      toast.success(`Font 「${added.name}」 berhasil dipasang!`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal memuat file font kustom.'
      );
    } finally {
      setUploadingFont(false);
      e.target.value = '';
    }
  };

  const handleAddNamedFont = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const added = addNamedCustomFont(
        customFontNameDraft,
        customFontSourceDraft
      );
      setCustomFonts(loadCustomReaderFonts());
      updatePrefs({ fontFamily: added.id });
      setCustomFontNameDraft('');
      toast.success(`Font 「${added.name}」 ditambahkan & diterapkan!`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal menambahkan nama font.'
      );
    }
  };

  const handleDeleteCustomFont = async (fontId: string) => {
    const next = await deleteCustomReaderFont(fontId);
    setCustomFonts(next);
    if (prefsRef.current.fontFamily === fontId) {
      updatePrefs({ fontFamily: 'serif' });
    }
    toast.success('Font tambahan dihapus.');
  };

  const handleLogTimerSession = useCallback(
    (mins: number) => {
      onLogReadingSession(bookRef.current?.title || target.title, mins);
    },
    [onLogReadingSession, target.title]
  );

  const themeStyle = READER_THEME_STYLES[prefs.theme];
  const directYatsuUrl = resolveYatsuUrl(activeKey, yatsuLinks);

  // Compute live character progress & reading speed across entire book
  const readingProgressStats = useMemo(() => {
    if (!book || !activeChapter) {
      return { readChars: 0, totalChars: 0, bookPct: 0, charsPerHour: 0 };
    }
    let charsBefore = 0;
    for (let i = 0; i < book.currentChapter; i++) {
      charsBefore += book.chapters[i]?.charCount ?? 0;
    }
    let chapterCharsRead = 0;
    if (prefs.readingMode === 'vn') {
      const upto = Math.min(
        chapterParagraphs.length,
        vnIndex + prefs.vnParagraphsPerStep
      );
      for (let i = 0; i < upto; i++) {
        chapterCharsRead += chapterParagraphs[i]?.charCount ?? 0;
      }
    } else {
      chapterCharsRead = Math.round(activeChapter.charCount * (scrollPct / 100));
    }
    const readChars = Math.min(book.totalChars, charsBefore + chapterCharsRead);
    const bookPct =
      book.totalChars > 0 ? Math.round((readChars / book.totalChars) * 100) : 0;
    const elapsedNowSec = Math.max(
      0,
      Math.floor((Date.now() - sessionStartMsRef.current) / 1000)
    );
    const charsPerHour =
      elapsedNowSec >= 20 && chapterCharsRead > 0
        ? Math.round((chapterCharsRead / elapsedNowSec) * 3600)
        : 0;
    return { readChars, totalChars: book.totalChars, bookPct, charsPerHour };
  }, [
    book,
    activeChapter,
    prefs.readingMode,
    prefs.vnParagraphsPerStep,
    chapterParagraphs,
    vnIndex,
    scrollPct,
  ]);

  const resolvedRawBgUrl = useMemo(() => {
    if (prefs.bgMode === 'app') return appWallpaperUrl.trim();
    if (prefs.bgMode === 'custom') return prefs.bgImageUrl.trim();
    return '';
  }, [prefs.bgMode, appWallpaperUrl, prefs.bgImageUrl]);

  const bgMedia = useMemo(
    () => parseReaderBackgroundMedia(resolvedRawBgUrl),
    [resolvedRawBgUrl]
  );

  const safeBgUrl = useMemo(() => {
    if (bgMedia.kind !== 'image') return '';
    return bgMedia.url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }, [bgMedia]);

  const activeVideoSrc =
    bgMedia.kind === 'local-video'
      ? localVideoObjectUrl
      : bgMedia.kind === 'video'
        ? bgMedia.url
        : '';

  const isVideoBg =
    (bgMedia.kind === 'youtube' && Boolean(bgMedia.youtubeId)) ||
    Boolean(activeVideoSrc);

  const hasActiveBg =
    isVideoBg || (bgMedia.kind === 'image' && Boolean(safeBgUrl));

  const ytEmbedUrl = useMemo(() => {
    if (bgMedia.kind !== 'youtube' || !bgMedia.youtubeId) return '';
    return buildYouTubeBgEmbedUrl(bgMedia.youtubeId, true);
  }, [bgMedia.kind, bgMedia.youtubeId]);

  const sendYtPlayerCommand = useCallback(
    (func: string, args: unknown[] = []) => {
      const win = bgYtIframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    },
    []
  );

  const registerYtListening = useCallback(() => {
    const win = bgYtIframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
      '*'
    );
  }, []);

  const syncYouTubeAudio = useCallback(
    (muted: boolean, volumePct: number) => {
      const ytVol = Math.min(100, Math.max(0, Math.round(volumePct)));
      if (muted || ytVol <= 0) {
        sendYtPlayerCommand('mute');
        return;
      }
      sendYtPlayerCommand('unMute');
      sendYtPlayerCommand('setVolume', [ytVol]);
      sendYtPlayerCommand('playVideo');
    },
    [sendYtPlayerCommand]
  );

  const applyLocalVideoAudio = useCallback(
    (
      vid: HTMLVideoElement,
      muted: boolean,
      volumePct: number,
      isLocalBlob: boolean
    ) => {
      const effectiveMuted = muted || volumePct <= 0;
      vid.muted = effectiveMuted;

      const clampedGain = Math.min(3, Math.max(0, volumePct / 100));
      const shouldUseBoost =
        isLocalBlob && !effectiveMuted && volumePct > 100;

      if (shouldUseBoost && bgAudioSourceVideoRef.current !== vid) {
        const Ctx =
          window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (Ctx) {
          try {
            if (bgAudioCtxRef.current) {
              void bgAudioCtxRef.current.close().catch(() => {});
            }
            const ctx = new Ctx();
            const source = ctx.createMediaElementSource(vid);
            const gain = ctx.createGain();
            const limiter = ctx.createDynamicsCompressor();
            limiter.threshold.value = -6;
            limiter.knee.value = 18;
            limiter.ratio.value = 6;
            limiter.attack.value = 0.003;
            limiter.release.value = 0.2;

            gain.gain.value = clampedGain;
            source.connect(gain);
            gain.connect(limiter);
            limiter.connect(ctx.destination);

            bgAudioCtxRef.current = ctx;
            bgGainNodeRef.current = gain;
            bgAudioSourceVideoRef.current = vid;
          } catch {
            // Fall back cleanly to native HTMLVideoElement volume
          }
        }
      }

      if (bgAudioSourceVideoRef.current === vid && bgGainNodeRef.current) {
        vid.volume = 1;
        bgGainNodeRef.current.gain.value = effectiveMuted ? 0 : clampedGain;
        if (
          !effectiveMuted &&
          bgAudioCtxRef.current?.state === 'suspended'
        ) {
          void bgAudioCtxRef.current.resume().catch(() => {});
        }
      } else {
        vid.volume = effectiveMuted ? 0 : Math.min(1, clampedGain);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      ytRetryTimersRef.current.forEach((id) => window.clearTimeout(id));
      ytRetryTimersRef.current = [];
      if (bgAudioCtxRef.current) {
        void bgAudioCtxRef.current.close().catch(() => {});
        bgAudioCtxRef.current = null;
        bgGainNodeRef.current = null;
        bgAudioSourceVideoRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (bgMedia.kind !== 'youtube') return;
    const onYtMessage = (event: MessageEvent) => {
      if (
        typeof event.origin === 'string' &&
        !event.origin.includes('youtube')
      ) {
        return;
      }
      let parsed: { event?: string } | null = null;
      if (typeof event.data === 'string') {
        try {
          parsed = JSON.parse(event.data) as { event?: string };
        } catch {
          return;
        }
      } else if (event.data && typeof event.data === 'object') {
        parsed = event.data as { event?: string };
      }
      if (!parsed) return;
      if (parsed.event === 'onReady' || parsed.event === 'initialDelivery') {
        syncYouTubeAudio(
          prefsRef.current.bgVideoMuted,
          prefsRef.current.bgVideoVolume
        );
      }
    };
    window.addEventListener('message', onYtMessage);
    return () => window.removeEventListener('message', onYtMessage);
  }, [bgMedia.kind, syncYouTubeAudio]);

  useEffect(() => {
    const vid = bgVideoRef.current;
    if (vid && activeVideoSrc) {
      applyLocalVideoAudio(
        vid,
        prefs.bgVideoMuted,
        prefs.bgVideoVolume,
        activeVideoSrc.startsWith('blob:')
      );
    }
    if (bgMedia.kind === 'youtube') {
      syncYouTubeAudio(prefs.bgVideoMuted, prefs.bgVideoVolume);
    }
  }, [
    bgMedia.kind,
    activeVideoSrc,
    prefs.bgVideoMuted,
    prefs.bgVideoVolume,
    applyLocalVideoAudio,
    syncYouTubeAudio,
  ]);

  const handleToggleVideoMute = useCallback(() => {
    const nextMuted = !prefsRef.current.bgVideoMuted;
    const nextVolume =
      !nextMuted && prefsRef.current.bgVideoVolume <= 0
        ? 100
        : prefsRef.current.bgVideoVolume;
    updatePrefs({ bgVideoMuted: nextMuted, bgVideoVolume: nextVolume });
    if (bgVideoRef.current && activeVideoSrc) {
      applyLocalVideoAudio(
        bgVideoRef.current,
        nextMuted,
        nextVolume,
        activeVideoSrc.startsWith('blob:')
      );
      if (!nextMuted && bgVideoRef.current.paused) {
        void bgVideoRef.current.play().catch(() => {});
      }
    }
    if (bgMedia.kind === 'youtube') {
      syncYouTubeAudio(nextMuted, nextVolume);
    }
  }, [
    bgMedia.kind,
    activeVideoSrc,
    updatePrefs,
    applyLocalVideoAudio,
    syncYouTubeAudio,
  ]);

  const handleChangeBgVideoVolume = useCallback(
    (rawVol: number) => {
      const isLocalBlob = bgMedia.kind === 'local-video';
      const maxVol = isLocalBlob ? 300 : 100;
      const clampedVol = Math.min(maxVol, Math.max(0, Math.round(rawVol)));
      const nextMuted = clampedVol <= 0;
      updatePrefs({
        bgVideoVolume: clampedVol,
        bgVideoMuted: nextMuted,
      });
      if (bgVideoRef.current && activeVideoSrc) {
        applyLocalVideoAudio(
          bgVideoRef.current,
          nextMuted,
          clampedVol,
          activeVideoSrc.startsWith('blob:')
        );
        if (!nextMuted && bgVideoRef.current.paused) {
          void bgVideoRef.current.play().catch(() => {});
        }
      }
      if (bgMedia.kind === 'youtube') {
        syncYouTubeAudio(nextMuted, clampedVol);
      }
    },
    [
      bgMedia.kind,
      activeVideoSrc,
      updatePrefs,
      applyLocalVideoAudio,
      syncYouTubeAudio,
    ]
  );

  const bgPositionCss =
    prefs.bgPosition === 'top'
      ? 'center top'
      : prefs.bgPosition === 'bottom'
        ? 'center bottom'
        : 'center center';
  const ytPositionTop =
    prefs.bgPosition === 'top'
      ? '38%'
      : prefs.bgPosition === 'bottom'
        ? '62%'
        : '50%';

  const articleGlassStyle: React.CSSProperties = useMemo(() => {
    if (!hasActiveBg) return {};
    if (prefs.bgPanelOpacity > 0) {
      const glassBlur = isVideoBg ? 'none' : 'blur(8px)';
      return {
        backgroundColor: `rgba(${themeStyle.surfaceRgb}, ${(prefs.bgPanelOpacity / 100).toFixed(2)})`,
        backdropFilter: glassBlur,
        WebkitBackdropFilter: glassBlur,
        border: `1px solid ${themeStyle.cardBorder}`,
        borderRadius: '1.25rem',
      };
    }
    return {
      backgroundColor: 'transparent',
      textShadow:
        prefs.theme === 'navy' || prefs.theme === 'amoled'
          ? '0 1px 10px rgba(0, 0, 0, 0.85)'
          : 'none',
    };
  }, [
    hasActiveBg,
    isVideoBg,
    prefs.bgPanelOpacity,
    prefs.theme,
    themeStyle.surfaceRgb,
    themeStyle.cardBorder,
  ]);

  const vnCardStyle: React.CSSProperties | undefined = useMemo(() => {
    if (!hasActiveBg) return undefined;
    if (prefs.bgPanelOpacity > 0) {
      const glassBlur = isVideoBg ? 'none' : 'blur(8px)';
      return {
        backgroundColor: `rgba(${themeStyle.cardRgb}, ${(prefs.bgPanelOpacity / 100).toFixed(2)})`,
        backdropFilter: glassBlur,
        WebkitBackdropFilter: glassBlur,
        borderColor: themeStyle.cardBorder,
      };
    }
    return {
      backgroundColor: 'transparent',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      borderColor: 'transparent',
      boxShadow: 'none',
      textShadow:
        prefs.theme === 'navy' || prefs.theme === 'amoled'
          ? '0 1px 10px rgba(0, 0, 0, 0.85)'
          : 'none',
    };
  }, [
    hasActiveBg,
    isVideoBg,
    prefs.bgPanelOpacity,
    prefs.theme,
    themeStyle.cardRgb,
    themeStyle.cardBorder,
  ]);

  const vnVisibleParagraphs = useMemo(() => {
    if (chapterParagraphs.length === 0) return [];
    if (prefs.vnDisplayStyle === 'stream') {
      return chapterParagraphs.slice(0, vnIndex + prefs.vnParagraphsPerStep);
    }
    return chapterParagraphs.slice(vnIndex, vnIndex + prefs.vnParagraphsPerStep);
  }, [
    chapterParagraphs,
    prefs.vnDisplayStyle,
    vnIndex,
    prefs.vnParagraphsPerStep,
  ]);

  const widthClass =
    prefs.writingMode === 'vertical'
      ? `jp-vheight-${prefs.maxWidth}`
      : `jp-width-${prefs.maxWidth}`;
  const indentClass = prefs.indentParagraphs ? 'jp-indent-on' : '';
  const activeFontCss = useMemo(
    () => resolveReaderFontCss(prefs.fontFamily, customFonts),
    [prefs.fontFamily, customFonts]
  );
  const contentDirClass =
    prefs.writingMode === 'vertical'
      ? 'jp-writing-vertical'
      : 'jp-writing-horizontal';

  const isFullscreenOrZen = isFullscreen || zenMode;

  // Measure exact CSS multi-column page container width in Paginated mode
  useEffect(() => {
    if (loadingBook || !book || prefs.readingMode !== 'paginated') return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const measure = () => {
      const exactW = Math.floor(el.getBoundingClientRect().width);
      if (exactW > 40) {
        setPagedWidthPx((prev) => (prev === exactW ? prev : exactW));
      }
    };

    measure();
    const raf = window.requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [
    loadingBook,
    book?.storageKey,
    prefs.readingMode,
    prefs.writingMode,
    prefs.maxWidth,
    hasActiveBg,
    prefs.bgPanelOpacity,
    isFullscreenOrZen,
  ]);

  return createPortal(
    <div
      ref={readerRootRef}
      className={`fixed inset-0 z-[100] w-screen h-[100dvh] flex flex-col overflow-hidden ${themeStyle.shell}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDraggingOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDraggingOver(false);
        if (e.dataTransfer.files?.length) {
          void handleImportFiles(
            e.dataTransfer.files,
            bookRef.current ? 'add' : 'context'
          );
        }
      }}
    >
      {/* FULL-BLEED RESPONSIVE READER BACKGROUND LAYER (Yomitan-safe, non-blocking) */}
      {hasActiveBg && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
        >
          {bgMedia.kind === 'youtube' && bgMedia.youtubeId ? (
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none transition-[opacity,filter] duration-200"
              style={{
                opacity: prefs.bgOpacity / 100,
                filter: `blur(${prefs.bgBlur}px)`,
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
              }}
            >
              <iframe
                ref={bgYtIframeRef}
                src={ytEmbedUrl}
                title="Background Video Reader"
                allow="autoplay; encrypted-media; picture-in-picture"
                onLoad={() => {
                  registerYtListening();
                  syncYouTubeAudio(
                    prefsRef.current.bgVideoMuted,
                    prefsRef.current.bgVideoVolume
                  );
                  ytRetryTimersRef.current.forEach((id) =>
                    window.clearTimeout(id)
                  );
                  ytRetryTimersRef.current = [
                    window.setTimeout(() => {
                      registerYtListening();
                      syncYouTubeAudio(
                        prefsRef.current.bgVideoMuted,
                        prefsRef.current.bgVideoVolume
                      );
                    }, 600),
                    window.setTimeout(() => {
                      syncYouTubeAudio(
                        prefsRef.current.bgVideoMuted,
                        prefsRef.current.bgVideoVolume
                      );
                    }, 1600),
                  ];
                }}
                className="jp-reader-yt-cover"
                style={{ top: ytPositionTop }}
              />
            </div>
          ) : activeVideoSrc ? (
            <video
              ref={bgVideoRef}
              src={activeVideoSrc}
              autoPlay
              loop
              muted={prefs.bgVideoMuted}
              playsInline
              preload="auto"
              className="absolute -inset-8 w-[calc(100%+4rem)] h-[calc(100%+4rem)] object-cover pointer-events-none select-none transition-[opacity,filter,object-position] duration-200"
              style={{
                objectPosition: bgPositionCss,
                filter: `blur(${prefs.bgBlur}px)`,
                opacity: prefs.bgOpacity / 100,
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
              }}
            />
          ) : (
            <div
              className="absolute -inset-8 bg-cover bg-no-repeat transition-[opacity,filter,background-position] duration-200"
              style={{
                backgroundImage: `url("${safeBgUrl}")`,
                backgroundPosition: bgPositionCss,
                filter: `blur(${prefs.bgBlur}px)`,
                opacity: prefs.bgOpacity / 100,
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
              }}
            />
          )}
        </div>
      )}

      {/* Hidden file pickers */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".epub,.txt,.html,.htm,.xhtml"
        onChange={(e) => {
          if (e.target.files?.length) {
            void handleImportFiles(
              e.target.files,
              bookRef.current ? 'add' : 'context'
            );
          }
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={addBookInputRef}
        type="file"
        multiple
        accept=".epub,.txt,.html,.htm,.xhtml"
        onChange={(e) => {
          if (e.target.files?.length) {
            void handleImportFiles(e.target.files, 'add');
          }
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={backupInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleRestoreLibraryBackup}
        className="hidden"
      />
      <input
        ref={bgFileInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/ogg"
        onChange={handleUploadReaderBg}
        className="hidden"
      />
      <input
        ref={fontFileInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
        onChange={handleUploadCustomFont}
        className="hidden"
      />

      {/* Drag & drop overlay */}
      {draggingOver && (
        <div className="fixed inset-0 z-[120] bg-sky-500/20 backdrop-blur-sm border-4 border-dashed border-sky-400 flex items-center justify-center pointer-events-none">
          <div className="px-6 py-4 rounded-2xl bg-[#0b121c]/95 text-white font-bold text-sm shadow-2xl border border-sky-400/50">
            Lepaskan file .EPUB / .TXT di sini untuk langsung membaca
          </div>
        </div>
      )}

      {/* FULLSCREEN / ZEN MODE FLOATING CONTROLS (Yomitan-safe, non-blocking) */}
      {isFullscreenOrZen && book && (
        <>
          <button
            type="button"
            onClick={() => void handleToggleFullscreen()}
            title="Keluar Fullscreen (M)"
            className={`fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-[110] px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 backdrop-blur-md shadow-lg transition cursor-pointer ${themeStyle.subtleBtn}`}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Keluar Fullscreen</span>
          </button>

          <button
            type="button"
            onClick={
              prefs.writingMode === 'vertical'
                ? handleStepForward
                : handleStepBackward
            }
            aria-label={
              prefs.writingMode === 'vertical'
                ? 'Halaman Berikutnya'
                : 'Halaman Sebelumnya'
            }
            className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-[110] px-3.5 py-2.5 rounded-2xl border text-xs font-extrabold inline-flex items-center gap-1 opacity-75 active:opacity-100 hover:opacity-100 backdrop-blur-md shadow-lg transition cursor-pointer ${themeStyle.subtleBtn}`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{prefs.writingMode === 'vertical' ? 'Lanjut' : 'Prev'}</span>
          </button>

          <button
            type="button"
            onClick={
              prefs.writingMode === 'vertical'
                ? handleStepBackward
                : handleStepForward
            }
            aria-label={
              prefs.writingMode === 'vertical'
                ? 'Halaman Sebelumnya'
                : 'Halaman Berikutnya'
            }
            className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-[110] px-3.5 py-2.5 rounded-2xl border text-xs font-extrabold inline-flex items-center gap-1 opacity-75 active:opacity-100 hover:opacity-100 backdrop-blur-md shadow-lg transition cursor-pointer ${themeStyle.subtleBtn}`}
          >
            <span>{prefs.writingMode === 'vertical' ? 'Prev' : 'Lanjut'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* TOP TOOLBAR */}
      {!isFullscreenOrZen && (
        <header
          className={`relative z-20 shrink-0 border-b backdrop-blur-md pt-[max(0.5rem,env(safe-area-inset-top))] ${
            hasActiveBg ? themeStyle.toolbarGlass : themeStyle.toolbar
          }`}
        >
          {/* Row 1: Primary Bar (Zero Overlap on Mobile) */}
          <div className="px-3 sm:px-5 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => void handleCloseReader()}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 transition cursor-pointer shrink-0 ${themeStyle.subtleBtn}`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Tutup</span>
              </button>

              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-extrabold truncate">
                  {book?.title || target.title}
                </div>
                <div className={`text-[10px] sm:text-[11px] truncate ${themeStyle.mutedText}`}>
                  {book ? (
                    <span>
                      Bab {book.currentChapter + 1}/{book.chapters.length} •{' '}
                      {readingProgressStats.bookPct}% (
                      {readingProgressStats.totalChars.toLocaleString('id-ID')}{' '}
                      huruf)
                    </span>
                  ) : (
                    <span>Reader DOM Native • Yomitan Ready</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {book && (
                <>
                  {/* Desktop Reading Mode Switcher: Continuous | Page | Mode VN */}
                  <div
                    className={`hidden md:inline-flex items-center p-0.5 rounded-xl border ${themeStyle.subtleBtn}`}
                  >
                    {(
                      [
                        { id: 'scroll', label: 'Continuous' },
                        { id: 'paginated', label: 'Page' },
                        { id: 'vn', label: 'Mode VN' },
                      ] as const
                    ).map((rm) => (
                      <button
                        key={rm.id}
                        type="button"
                        onClick={() => updatePrefs({ readingMode: rm.id })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          prefs.readingMode === rm.id
                            ? 'bg-sky-500 text-slate-950'
                            : 'opacity-75 hover:opacity-100'
                        }`}
                      >
                        {rm.label}
                      </button>
                    ))}
                  </div>

                  {/* Desktop Quick Vertical / Horizontal toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      updatePrefs({
                        writingMode:
                          prefs.writingMode === 'vertical'
                            ? 'horizontal'
                            : 'vertical',
                      })
                    }
                    title="Ganti Arah Baca: Vertikal 縦書き / Horizontal (T)"
                    className={`hidden md:inline-flex px-2.5 py-1.5 rounded-xl border text-xs font-extrabold transition cursor-pointer ${
                      prefs.writingMode === 'vertical'
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : themeStyle.subtleBtn
                    }`}
                  >
                    {prefs.writingMode === 'vertical' ? '縦書き' : '横書き'}
                  </button>

                  {/* Isolated Live Timer & Save to Log */}
                  <ReaderSessionTimerButton
                    active={Boolean(book)}
                    resetToken={timerResetToken}
                    onLog={handleLogTimerSession}
                  />

                  {/* Desktop Bookmark */}
                  <button
                    type="button"
                    onClick={() => void handleAddBookmark()}
                    title="Simpan Bookmark (B)"
                    className={`hidden md:inline-flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold items-center gap-1 transition cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <Bookmark className="w-3.5 h-3.5 text-sky-400" />
                  </button>

                  {/* Explicit Save Position Now */}
                  <button
                    type="button"
                    onClick={() => void handleSavePositionNow()}
                    title="Simpan progres baca ke Library & Cloud sekarang"
                    className={`hidden md:inline-flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold items-center gap-1 transition cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden xl:inline">Simpan</span>
                  </button>

                  {/* TOC + Bookmarks Drawer */}
                  <button
                    type="button"
                    onClick={() => {
                      if (showToc && tocTab !== 'library') {
                        setShowToc(false);
                      } else {
                        setTocTab('chapters');
                        setShowToc(true);
                      }
                      setShowSettings(false);
                      setShowBacklog(false);
                      setShowAudioPanel(false);
                    }}
                    title="Daftar Bab & Bookmark (C)"
                    className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer ${
                      showToc && tocTab !== 'library'
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : themeStyle.subtleBtn
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Bab</span>
                  </button>

                  {/* Real Fullscreen / Zen Mode — VISIBLE ON MOBILE & DESKTOP */}
                  <button
                    type="button"
                    onClick={() => void handleToggleFullscreen()}
                    title="Mode Fullscreen / Fokus (M)"
                    aria-label="Fullscreen"
                    className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                    <span className="hidden xl:inline">Fullscreen</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  if (showToc && tocTab === 'library') {
                    setShowToc(false);
                  } else {
                    setTocTab('library');
                    setShowToc(true);
                  }
                  setShowSettings(false);
                  setShowBacklog(false);
                  setShowAudioPanel(false);
                }}
                title="Library Buku Permanen & Backup"
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer ${
                  showToc && tocTab === 'library'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                <Library className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Library</span>
                {savedBooks.length > 0 && (
                  <span className="font-mono text-[10px] opacity-80">
                    ({savedBooks.length})
                  </span>
                )}
              </button>

              {book && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAudioPanel((prev) => !prev);
                    setShowSettings(false);
                    setShowToc(false);
                    setShowBacklog(false);
                  }}
                  title="Audiobook & AI Narator (A)"
                  className={`hidden md:inline-flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold items-center gap-1 transition cursor-pointer ${
                    showAudioPanel
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : audioPlaybackActive
                        ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
                        : themeStyle.subtleBtn
                  }`}
                >
                  <Headphones className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xl:inline">Audio/AI</span>
                  {audioPlaybackActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => addBookInputRef.current?.click()}
                disabled={importing}
                title="Tambah buku EPUB/TXT ke Library (tanpa menimpa buku lain)"
                className={`hidden md:inline-flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold items-center gap-1 transition cursor-pointer ${themeStyle.subtleBtn}`}
              >
                {importing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span className="hidden xl:inline">+ EPUB</span>
              </button>

              {isVideoBg && (
                <button
                  type="button"
                  onClick={handleToggleVideoMute}
                  title={
                    prefs.bgVideoMuted
                      ? 'Aktifkan Suara Video Background'
                      : 'Bisukan Suara Video Background'
                  }
                  aria-label="Audio Background Video"
                  className={`hidden md:inline-flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold items-center gap-1 transition cursor-pointer ${
                    !prefs.bgVideoMuted
                      ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
                      : themeStyle.subtleBtn
                  }`}
                >
                  {prefs.bgVideoMuted ? (
                    <VolumeX className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="hidden xl:inline">
                    {prefs.bgVideoMuted ? 'Bisu' : 'Suara'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (showSettings && settingsTab === 'background') {
                    setShowSettings(false);
                  } else {
                    setSettingsTab('background');
                    setShowSettings(true);
                    setShowToc(false);
                    setShowBacklog(false);
                    setShowAudioPanel(false);
                  }
                }}
                title="Atur Background, Video, Blur & Opacity Reader"
                aria-label="Background Reader"
                className={`hidden md:inline-flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold items-center gap-1 transition cursor-pointer ${
                  showSettings && settingsTab === 'background'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : hasActiveBg
                      ? 'bg-sky-500/20 border-sky-400/45 text-sky-300'
                      : themeStyle.subtleBtn
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">BG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSettings((prev) => !prev);
                  setShowToc(false);
                  setShowBacklog(false);
                  setShowAudioPanel(false);
                }}
                title="Pengaturan Baca, Mode VN & Background (S)"
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer ${
                  showSettings
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tampilan</span>
              </button>

              <button
                type="button"
                onClick={() => setShowShortcuts((prev) => !prev)}
                title="Panduan Shortcut Keyboard (?)"
                className={`hidden sm:inline-flex p-1.5 rounded-xl border text-xs font-bold items-center transition cursor-pointer ${themeStyle.subtleBtn}`}
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>

              <a
                href={directYatsuUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Buka di Yatsu Reader"
                className="hidden md:inline-flex btn-crimson px-3 py-1.5 rounded-xl text-xs font-extrabold items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Yatsu</span>
              </a>
            </div>
          </div>

          {/* Row 2: Clean Mobile-Only Quick Controls Strip */}
          {book && (
            <div className="md:hidden px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <div
                className={`inline-flex items-center p-0.5 rounded-lg border shrink-0 ${themeStyle.subtleBtn}`}
              >
                {(
                  [
                    { id: 'scroll', label: 'Cont' },
                    { id: 'paginated', label: 'Page' },
                    { id: 'vn', label: 'VN' },
                  ] as const
                ).map((rm) => (
                  <button
                    key={rm.id}
                    type="button"
                    onClick={() => updatePrefs({ readingMode: rm.id })}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      prefs.readingMode === rm.id
                        ? 'bg-sky-500 text-slate-950'
                        : 'opacity-75'
                    }`}
                  >
                    {rm.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  updatePrefs({
                    writingMode:
                      prefs.writingMode === 'vertical'
                        ? 'horizontal'
                        : 'vertical',
                  })
                }
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold shrink-0 cursor-pointer ${
                  prefs.writingMode === 'vertical'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                {prefs.writingMode === 'vertical' ? '縦書き' : '横書き'}
              </button>

              <button
                type="button"
                onClick={() => void handleAddBookmark()}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${themeStyle.subtleBtn}`}
              >
                <Bookmark className="w-3 h-3 text-sky-400" />
                <span>Bookmark</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSavePositionNow()}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${themeStyle.subtleBtn}`}
              >
                <Save className="w-3 h-3 text-emerald-400" />
                <span>Simpan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAudioPanel((prev) => !prev);
                  setShowSettings(false);
                  setShowToc(false);
                  setShowBacklog(false);
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                  showAudioPanel
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : audioPlaybackActive
                      ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
                      : themeStyle.subtleBtn
                }`}
              >
                <Headphones className="w-3 h-3" />
                <span>Audio/AI</span>
              </button>

              <button
                type="button"
                onClick={() => addBookInputRef.current?.click()}
                disabled={importing}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${themeStyle.subtleBtn}`}
              >
                <Upload className="w-3 h-3" />
                <span>+ EPUB</span>
              </button>

              {isVideoBg && (
                <button
                  type="button"
                  onClick={handleToggleVideoMute}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                    !prefs.bgVideoMuted
                      ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
                      : themeStyle.subtleBtn
                  }`}
                >
                  {prefs.bgVideoMuted ? (
                    <VolumeX className="w-3 h-3" />
                  ) : (
                    <Volume2 className="w-3 h-3" />
                  )}
                  <span>{prefs.bgVideoMuted ? 'Bisu' : 'Suara'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSettingsTab('background');
                  setShowSettings(true);
                  setShowToc(false);
                  setShowBacklog(false);
                  setShowAudioPanel(false);
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                  hasActiveBg
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                <ImageIcon className="w-3 h-3" />
                <span>BG</span>
              </button>

              <a
                href={directYatsuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-crimson px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Yatsu</span>
              </a>
            </div>
          )}
        </header>
      )}

      {/* SETTINGS DRAWER (HP Bottom Sheet & Laptop Side Panel) */}
      {showSettings && (
        <>
          <div
            className="sm:hidden fixed inset-0 z-[105] bg-black/35"
            onClick={() => setShowSettings(false)}
          />
          <div
            role="dialog"
            aria-label="Pengaturan Reader Novel"
            className={`fixed inset-x-0 bottom-0 z-[110] max-h-[78dvh] rounded-t-3xl border-t flex flex-col pb-[env(safe-area-inset-bottom)] shadow-2xl animate-scale-in sm:inset-auto sm:top-16 sm:right-5 sm:w-[23.5rem] sm:max-w-[calc(100vw-2.5rem)] sm:max-h-[calc(100dvh-5.5rem)] sm:rounded-2xl sm:border sm:pb-0 ${themeStyle.panel}`}
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-current/25 mx-auto mt-2.5 shrink-0" />

            <div className="px-4 pt-3 pb-2.5 border-b border-current/10 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className={`w-3.5 h-3.5 ${themeStyle.accentText}`} />
                  <span>Pengaturan Reader</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  aria-label="Tutup Pengaturan"
                  className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'reading', label: 'Baca' },
                    { id: 'vn', label: 'VN & Animasi' },
                    { id: 'background', label: 'Background' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSettingsTab(tab.id)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${
                      settingsTab === tab.id
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : themeStyle.subtleBtn
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
              {settingsTab === 'reading' && (
                <>
                  {/* Reading Mode */}
                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Mode Membaca (P / V)
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'scroll', label: 'Continuous' },
                          { id: 'paginated', label: 'Page' },
                          { id: 'vn', label: 'Mode VN' },
                        ] as const
                      ).map((rm) => (
                        <button
                          key={rm.id}
                          type="button"
                          onClick={() => updatePrefs({ readingMode: rm.id })}
                          className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            prefs.readingMode === rm.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {rm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Writing Direction */}
                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Arah Baca (T)
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'horizontal', label: 'Horizontal (横書き)' },
                          { id: 'vertical', label: 'Vertikal (縦書き)' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updatePrefs({ writingMode: m.id })}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            prefs.writingMode === m.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Furigana */}
                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Furigana (F)
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'show', label: 'Tampil' },
                          { id: 'hover', label: 'Hover' },
                          { id: 'hide', label: 'Sembunyi' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updatePrefs({ furigana: f.id })}
                          className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            prefs.furigana === f.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${themeStyle.mutedText}`}>
                        Ukuran Huruf (+/-)
                      </span>
                      <span className="font-mono font-bold">{prefs.fontSize}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updatePrefs({ fontSize: Math.max(16, prefs.fontSize - 1) })
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${themeStyle.subtleBtn}`}
                      >
                        A-
                      </button>
                      <input
                        type="range"
                        min={16}
                        max={34}
                        step={1}
                        value={prefs.fontSize}
                        onChange={(e) =>
                          updatePrefs({ fontSize: Number(e.target.value) })
                        }
                        className="flex-1 h-2 accent-sky-400 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updatePrefs({ fontSize: Math.min(34, prefs.fontSize + 1) })
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${themeStyle.subtleBtn}`}
                      >
                        A+
                      </button>
                    </div>
                  </div>

                  {/* Line Height */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${themeStyle.mutedText}`}>
                        Jarak Baris
                      </span>
                      <span className="font-mono font-bold">
                        {prefs.lineHeight.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.6}
                      max={2.4}
                      step={0.05}
                      value={prefs.lineHeight}
                      onChange={(e) =>
                        updatePrefs({ lineHeight: Number(e.target.value) })
                      }
                      className="w-full h-2 accent-sky-400 cursor-pointer"
                    />
                  </div>

                  {/* Letter Spacing (Jarak Huruf) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${themeStyle.mutedText}`}>
                        Jarak Huruf
                      </span>
                      <span className="font-mono font-bold">
                        {prefs.letterSpacing.toFixed(2)}em
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updatePrefs({
                            letterSpacing: Math.max(
                              -0.02,
                              Math.round((prefs.letterSpacing - 0.01) * 100) / 100
                            ),
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${themeStyle.subtleBtn}`}
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={-0.02}
                        max={0.3}
                        step={0.01}
                        value={prefs.letterSpacing}
                        onChange={(e) =>
                          updatePrefs({
                            letterSpacing:
                              Math.round(Number(e.target.value) * 100) / 100,
                          })
                        }
                        className="flex-1 h-2 accent-sky-400 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updatePrefs({
                            letterSpacing: Math.min(
                              0.3,
                              Math.round((prefs.letterSpacing + 0.01) * 100) / 100
                            ),
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${themeStyle.subtleBtn}`}
                      >
                        +
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { label: 'Rapat', em: 0 },
                        { label: 'Normal', em: 0.04 },
                        { label: 'Lega', em: 0.1 },
                        { label: 'Lebar', em: 0.18 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            updatePrefs({ letterSpacing: preset.em })
                          }
                          className={`py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                            Math.abs(prefs.letterSpacing - preset.em) < 0.005
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Horizontal Width / Vertical Column Height & Indent */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                        {prefs.writingMode === 'vertical'
                          ? 'Tinggi Kolom'
                          : 'Lebar Teks'}
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            { id: 'narrow', label: 'S' },
                            { id: 'medium', label: 'M' },
                            { id: 'wide', label: 'L' },
                            { id: 'full', label: 'Full' },
                          ] as const
                        ).map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => updatePrefs({ maxWidth: w.id })}
                            className={`py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              prefs.maxWidth === w.id
                                ? 'bg-sky-500 text-slate-950 border-sky-400'
                                : themeStyle.subtleBtn
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                        Indent Paragraf
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updatePrefs({ indentParagraphs: !prefs.indentParagraphs })
                        }
                        className={`w-full py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                          prefs.indentParagraphs
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : themeStyle.subtleBtn
                        }`}
                      >
                        {prefs.indentParagraphs ? 'Aktif (字下げ)' : 'Mati'}
                      </button>
                    </div>
                  </div>

                  {/* Font Family & Custom Japanese Fonts */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-bold ${themeStyle.mutedText}`}>
                        Font Bahasa Jepang
                      </span>
                      <button
                        type="button"
                        disabled={uploadingFont}
                        onClick={() => fontFileInputRef.current?.click()}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                      >
                        {uploadingFont ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3 text-sky-400" />
                        )}
                        <span>Upload .TTF/.OTF/.WOFF2</span>
                      </button>
                    </div>

                    {/* Live Font Sample Preview */}
                    <div
                      className="px-3 py-2 rounded-xl border border-current/15 bg-black/15 text-sm leading-relaxed truncate"
                      style={{
                        fontFamily: activeFontCss,
                        letterSpacing: `${prefs.letterSpacing}em`,
                      }}
                    >
                      「桜の花びらが静かに舞い落ちる。」
                    </div>

                    {/* Built-in Japanese Presets Grid */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {BUILTIN_READER_FONTS.map((ff) => (
                        <button
                          key={ff.id}
                          type="button"
                          onClick={() => updatePrefs({ fontFamily: ff.id })}
                          className={`px-2.5 py-1.5 rounded-xl text-left border transition cursor-pointer ${
                            prefs.fontFamily === ff.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          <div className="text-[11px] font-extrabold truncate">
                            {ff.label}
                          </div>
                          <div
                            className={`text-[9px] truncate ${
                              prefs.fontFamily === ff.id
                                ? 'text-slate-900/80'
                                : 'opacity-65'
                            }`}
                          >
                            {ff.sampleTag}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* User Custom Fonts List */}
                    {customFonts.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className={`block text-[10px] font-bold uppercase tracking-wider ${themeStyle.mutedText}`}>
                          Font Tambahan Saya ({customFonts.length})
                        </span>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                          {customFonts.map((cf) => {
                            const active = prefs.fontFamily === cf.id;
                            return (
                              <div
                                key={cf.id}
                                className="flex items-center gap-1"
                              >
                                <button
                                  type="button"
                                  onClick={() => updatePrefs({ fontFamily: cf.id })}
                                  className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                                    active
                                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                                      : themeStyle.subtleBtn
                                  }`}
                                >
                                  <span
                                    className="text-xs font-bold truncate"
                                    style={{ fontFamily: `'${cf.familyName.replace(/'/g, '')}', serif` }}
                                  >
                                    {cf.name}
                                  </span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono shrink-0 ${
                                      active
                                        ? 'bg-slate-950/15 text-slate-950'
                                        : 'bg-black/20 opacity-75'
                                    }`}
                                  >
                                    {cf.source === 'file'
                                      ? 'File'
                                      : cf.source === 'google'
                                        ? 'Google'
                                        : 'Sistem'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteCustomFont(cf.id)}
                                  title="Hapus font tambahan"
                                  className={`p-1.5 rounded-xl border cursor-pointer shrink-0 hover:text-red-400 ${themeStyle.subtleBtn}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Add Google Font / Local OS System Font by Name */}
                    <form
                      onSubmit={handleAddNamedFont}
                      className="p-2.5 rounded-xl border border-current/15 bg-black/15 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`text-[10px] font-bold ${themeStyle.mutedText}`}>
                          Tambah Font Google / Sistem:
                        </span>
                        <div className="inline-flex rounded-lg border border-current/15 p-0.5 gap-0.5">
                          {(
                            [
                              { id: 'google', label: 'Google Font' },
                              { id: 'system', label: 'Font PC/HP' },
                            ] as const
                          ).map((src) => (
                            <button
                              key={src.id}
                              type="button"
                              onClick={() => setCustomFontSourceDraft(src.id)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                customFontSourceDraft === src.id
                                  ? 'bg-sky-500 text-slate-950'
                                  : 'opacity-70 hover:opacity-100'
                              }`}
                            >
                              {src.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={customFontNameDraft}
                          onChange={(e) => setCustomFontNameDraft(e.target.value)}
                          placeholder={
                            customFontSourceDraft === 'google'
                              ? 'Mis. Zen Old Mincho / Hachi Maru Pop'
                              : 'Mis. Yu Mincho / Meiryo / Hiragino Mincho ProN'
                          }
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-black/25 border border-current/15 text-[11px] focus:outline-none focus:border-sky-400"
                        />
                        <button
                          type="submit"
                          className="btn-crimson px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Tambah</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Theme Colors */}
                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Tema Warna Baca
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'navy', label: 'Navy' },
                          { id: 'amoled', label: 'AMOLED' },
                          { id: 'sepia', label: 'Sepia' },
                          { id: 'light', label: 'Terang' },
                        ] as const
                      ).map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => updatePrefs({ theme: th.id })}
                          className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                            prefs.theme === th.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {th.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {settingsTab === 'vn' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/25 flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-extrabold inline-flex items-center gap-1.5 ${themeStyle.accentText}`}>
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {prefs.readingMode === 'vn'
                          ? 'Mode VN Sedang Aktif'
                          : 'Aktifkan Mode VN untuk lihat animasi'}
                      </span>
                    </span>
                    {prefs.readingMode !== 'vn' && (
                      <button
                        type="button"
                        onClick={() => updatePrefs({ readingMode: 'vn' })}
                        className="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 text-[10px] font-extrabold cursor-pointer shrink-0"
                      >
                        Aktifkan
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${themeStyle.mutedText}`}>
                        Paragraf Sekali Muncul
                      </span>
                      <span className={`font-mono font-bold ${themeStyle.accentText}`}>
                        {prefs.vnParagraphsPerStep} paragraf
                      </span>
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => updatePrefs({ vnParagraphsPerStep: n })}
                          className={`py-1.5 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer ${
                            prefs.vnParagraphsPerStep === n
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Gaya Tampil VN
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'card', label: 'Kotak VN' },
                          { id: 'stream', label: 'Tumpuk Paragraf' },
                        ] as const
                      ).map((ds) => (
                        <button
                          key={ds.id}
                          type="button"
                          onClick={() => updatePrefs({ vnDisplayStyle: ds.id })}
                          className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                            prefs.vnDisplayStyle === ds.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {ds.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Animasi Teks Masuk
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      {(
                        [
                          { id: 'fade-up', label: 'Fade' },
                          { id: 'typewriter', label: 'Ketik' },
                          { id: 'slide', label: 'Geser' },
                          { id: 'blur-in', label: 'Blur' },
                          { id: 'none', label: 'Instan' },
                        ] as Array<{ id: VnAnimationStyle; label: string }>
                      ).map((anim) => (
                        <button
                          key={anim.id}
                          type="button"
                          onClick={() => {
                            updatePrefs({ vnAnimation: anim.id });
                            setAnimPreviewTick((t) => t + 1);
                          }}
                          className={`py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            prefs.vnAnimation === anim.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {anim.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* NEW: Animation Duration Control */}
                  <div
                    className={`space-y-2.5 transition-opacity ${
                      prefs.vnAnimation === 'none' ? 'opacity-50' : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${themeStyle.mutedText}`}>
                        Durasi Animasi per Baris
                      </span>
                      <span className={`font-mono font-bold ${themeStyle.accentText}`}>
                        {prefs.vnAnimationDurationMs} ms (
                        {(prefs.vnAnimationDurationMs / 1000).toFixed(2)} dtk)
                      </span>
                    </div>

                    <input
                      type="range"
                      min={100}
                      max={2000}
                      step={50}
                      disabled={prefs.vnAnimation === 'none'}
                      value={prefs.vnAnimationDurationMs}
                      onChange={(e) =>
                        updatePrefs({
                          vnAnimationDurationMs: Number(e.target.value),
                        })
                      }
                      onPointerUp={() => setAnimPreviewTick((t) => t + 1)}
                      onKeyUp={() => setAnimPreviewTick((t) => t + 1)}
                      className="w-full h-2 accent-sky-400 cursor-pointer disabled:cursor-not-allowed"
                    />

                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { label: 'Cepat', ms: 200 },
                        { label: 'Normal', ms: 380 },
                        { label: 'Santai', ms: 700 },
                        { label: 'Lambat', ms: 1200 },
                      ].map((preset) => (
                        <button
                          key={preset.ms}
                          type="button"
                          disabled={prefs.vnAnimation === 'none'}
                          onClick={() => {
                            updatePrefs({ vnAnimationDurationMs: preset.ms });
                            setAnimPreviewTick((t) => t + 1);
                          }}
                          className={`py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer disabled:cursor-not-allowed ${
                            prefs.vnAnimationDurationMs === preset.ms
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Live Japanese Line-by-Line Animation Preview */}
                    <div className="p-2.5 rounded-xl border border-current/15 bg-black/15 flex items-center justify-between gap-2 overflow-hidden">
                      <div
                        ref={vnPreviewContainerRef}
                        className="text-xs sm:text-sm font-medium leading-relaxed min-w-0"
                        style={{
                          fontFamily: activeFontCss,
                          letterSpacing: `${prefs.letterSpacing}em`,
                        }}
                      >
                        危険回避のため、脳内コンピューターを
                        <br />
                        フル稼働させ、瞬時に答えを導き出す。
                      </div>
                      <button
                        type="button"
                        onClick={() => setAnimPreviewTick((t) => t + 1)}
                        title="Putar Ulang Preview Animasi"
                        className={`px-2 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${themeStyle.subtleBtn}`}
                      >
                        <Play className="w-3 h-3" />
                        <span>Uji</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'background' && (
                <div className="space-y-4">
                  {/* Source Picker */}
                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Sumber Background Reader
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'none', label: 'Polos' },
                          { id: 'app', label: 'Ikuti Web' },
                          { id: 'custom', label: 'Kustom' },
                        ] as Array<{ id: ReaderBgMode; label: string }>
                      ).map((src) => (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => updatePrefs({ bgMode: src.id })}
                          className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            prefs.bgMode === src.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {src.label}
                        </button>
                      ))}
                    </div>
                    {prefs.bgMode === 'app' && !appWallpaperUrl.trim() && (
                      <p className={`text-[11px] leading-snug ${themeStyle.mutedText}`}>
                        Wallpaper web belum dipasang. Unggah gambar di bawah untuk
                        background khusus reader ini.
                      </p>
                    )}
                  </div>

                  {/* Live Mini Preview Strip */}
                  <div
                    className={`relative h-20 rounded-xl overflow-hidden border border-current/15 ${themeStyle.articleBg}`}
                  >
                    {bgMedia.kind === 'youtube' && bgMedia.youtubeId ? (
                      <div
                        className="absolute -inset-4 bg-cover bg-no-repeat"
                        style={{
                          backgroundImage: `url("https://i.ytimg.com/vi/${bgMedia.youtubeId}/hqdefault.jpg")`,
                          backgroundPosition: bgPositionCss,
                          filter: `blur(${prefs.bgBlur}px)`,
                          opacity: prefs.bgOpacity / 100,
                        }}
                      />
                    ) : activeVideoSrc ? (
                      <video
                        src={activeVideoSrc}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)] object-cover"
                        style={{
                          objectPosition: bgPositionCss,
                          filter: `blur(${prefs.bgBlur}px)`,
                          opacity: prefs.bgOpacity / 100,
                        }}
                      />
                    ) : hasActiveBg ? (
                      <div
                        className="absolute -inset-4 bg-cover bg-no-repeat"
                        style={{
                          backgroundImage: `url("${safeBgUrl}")`,
                          backgroundPosition: bgPositionCss,
                          filter: `blur(${prefs.bgBlur}px)`,
                          opacity: prefs.bgOpacity / 100,
                        }}
                      />
                    ) : null}
                    <div className="relative z-10 h-full px-3 flex items-center justify-between gap-2">
                      <div
                        className="px-3 py-1.5 rounded-lg border text-xs font-bold"
                        style={
                          hasActiveBg && prefs.bgPanelOpacity > 0
                            ? {
                                backgroundColor: `rgba(${themeStyle.cardRgb}, ${(prefs.bgPanelOpacity / 100).toFixed(2)})`,
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                borderColor: themeStyle.cardBorder,
                              }
                            : {
                                borderColor: 'transparent',
                                backgroundColor: 'transparent',
                              }
                        }
                      >
                        <span
                          style={{
                            fontFamily: activeFontCss,
                            letterSpacing: `${prefs.letterSpacing}em`,
                          }}
                        >
                          日本語の読書
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-black/55 text-white font-mono text-[10px]">
                        {hasActiveBg
                          ? `${
                              bgMedia.kind === 'youtube'
                                ? 'YT • '
                                : isVideoBg
                                  ? 'Video • '
                                  : ''
                            }Blur ${prefs.bgBlur}px • ${prefs.bgOpacity}%`
                          : 'Polos'}
                      </span>
                    </div>
                  </div>

                  {/* Upload & URL Actions */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => bgFileInputRef.current?.click()}
                        className="btn-crimson flex-1 py-2 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Unggah Gambar / Video</span>
                      </button>
                      {prefs.bgImageUrl.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setBgUrlDraft('');
                            void deleteReaderBgVideoBlob();
                            updatePrefs({ bgMode: 'none', bgImageUrl: '' });
                            toast.success('Background kustom reader dihapus.');
                          }}
                          title="Hapus background kustom"
                          className={`p-2 rounded-xl border text-xs font-bold text-red-400 cursor-pointer ${themeStyle.subtleBtn}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleApplyBgUrl} className="space-y-1">
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          placeholder="Tempel URL Gambar, YouTube, atau .MP4 (https://...)"
                          value={bgUrlDraft}
                          onChange={(e) => setBgUrlDraft(e.target.value)}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-black/20 border border-current/15 text-xs focus:outline-none focus:border-sky-400"
                        />
                        <button
                          type="submit"
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer shrink-0 ${themeStyle.subtleBtn}`}
                        >
                          Pakai
                        </button>
                      </div>
                      <p className={`text-[10px] leading-snug ${themeStyle.mutedText}`}>
                        Mendukung link YouTube, video .mp4 / .webm, unggah file
                        video lokal, atau link gambar.
                      </p>
                    </form>
                  </div>

                  {/* Audio Controls for Video / YouTube Background */}
                  {isVideoBg && (
                    <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/25 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[11px] font-extrabold inline-flex items-center gap-1.5 ${themeStyle.accentText}`}
                        >
                          <Video className="w-3.5 h-3.5 shrink-0" />
                          <span>Audio Video Background</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleVideoMute}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                            !prefs.bgVideoMuted
                              ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {prefs.bgVideoMuted ? (
                            <VolumeX className="w-3 h-3" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                          <span>
                            {prefs.bgVideoMuted ? 'Bisu (Autoplay)' : 'Suara Aktif'}
                          </span>
                        </button>
                      </div>

                      <label className="block space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={`font-bold ${themeStyle.mutedText}`}>
                            Volume Suara Video
                          </span>
                          <span className={`font-mono font-bold ${themeStyle.accentText}`}>
                            {prefs.bgVideoVolume}%
                            {bgMedia.kind === 'local-video' &&
                              prefs.bgVideoVolume > 100 && (
                                <span className="ml-1 text-emerald-300">
                                  (Boost)
                                </span>
                              )}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={bgMedia.kind === 'local-video' ? 300 : 100}
                          step={5}
                          value={Math.min(
                            bgMedia.kind === 'local-video' ? 300 : 100,
                            prefs.bgVideoVolume
                          )}
                          onChange={(e) =>
                            handleChangeBgVideoVolume(Number(e.target.value))
                          }
                          className="w-full h-2 accent-sky-400 cursor-pointer"
                        />
                      </label>

                      <div
                        className={`grid gap-1 ${
                          bgMedia.kind === 'local-video'
                            ? 'grid-cols-5'
                            : 'grid-cols-3'
                        }`}
                      >
                        {(bgMedia.kind === 'local-video'
                          ? [50, 100, 175, 250, 300]
                          : [50, 75, 100]
                        ).map((presetVol) => (
                          <button
                            key={presetVol}
                            type="button"
                            onClick={() => handleChangeBgVideoVolume(presetVol)}
                            className={`py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              prefs.bgVideoVolume === presetVol &&
                              !prefs.bgVideoMuted
                                ? 'bg-sky-500 text-slate-950 border-sky-400'
                                : themeStyle.subtleBtn
                            }`}
                          >
                            {presetVol}%
                          </button>
                        ))}
                      </div>

                      {bgMedia.kind === 'youtube' ? (
                        <p className={`text-[10px] leading-snug ${themeStyle.mutedText}`}>
                          Suara YouTube maksimal 100%. Untuk Boost suara hingga
                          300%, gunakan unggah file video lokal (.mp4/.webm). Jika
                          YouTube hitam, pemilik membatasi embed.
                        </p>
                      ) : bgMedia.kind === 'video' ? (
                        <p className={`text-[10px] leading-snug ${themeStyle.mutedText}`}>
                          Geser volume atau pilih preset hingga 100%. Untuk
                          Boost suara hingga 300%, unggah file video lokal.
                        </p>
                      ) : null}
                    </div>
                  )}

                  {/* Quick Glass & Blur Presets */}
                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Preset Cepat Blur &amp; Opacity
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        {
                          label: 'Bening',
                          bgBlur: 0,
                          bgOpacity: 65,
                          bgPanelOpacity: 55,
                        },
                        {
                          label: 'Seimbang',
                          bgBlur: 6,
                          bgOpacity: 45,
                          bgPanelOpacity: 72,
                        },
                        {
                          label: 'Fokus',
                          bgBlur: 14,
                          bgOpacity: 30,
                          bgPanelOpacity: 84,
                        },
                        {
                          label: 'Transparan',
                          bgBlur: 2,
                          bgOpacity: 80,
                          bgPanelOpacity: 0,
                        },
                      ].map((gp) => {
                        const active =
                          prefs.bgBlur === gp.bgBlur &&
                          prefs.bgOpacity === gp.bgOpacity &&
                          prefs.bgPanelOpacity === gp.bgPanelOpacity;
                        return (
                          <button
                            key={gp.label}
                            type="button"
                            onClick={() =>
                              updatePrefs({
                                bgBlur: gp.bgBlur,
                                bgOpacity: gp.bgOpacity,
                                bgPanelOpacity: gp.bgPanelOpacity,
                              })
                            }
                            className={`py-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                              active
                                ? 'bg-sky-500 text-slate-950 border-sky-400'
                                : themeStyle.subtleBtn
                            }`}
                          >
                            {gp.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3 Sliders: Background Blur, Background Opacity, Reading Panel Opacity */}
                  <div className="space-y-3">
                    <label className="block space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-bold ${themeStyle.mutedText}`}>
                          Blur Background
                        </span>
                        <span className={`font-mono font-bold ${themeStyle.accentText}`}>
                          {prefs.bgBlur} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={28}
                        step={1}
                        value={prefs.bgBlur}
                        onChange={(e) =>
                          updatePrefs({ bgBlur: Number(e.target.value) })
                        }
                        className="w-full h-2 accent-sky-400 cursor-pointer"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-bold ${themeStyle.mutedText}`}>
                          Opacity Gambar Background
                        </span>
                        <span className={`font-mono font-bold ${themeStyle.accentText}`}>
                          {prefs.bgOpacity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={prefs.bgOpacity}
                        onChange={(e) =>
                          updatePrefs({ bgOpacity: Number(e.target.value) })
                        }
                        className="w-full h-2 accent-sky-400 cursor-pointer"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-bold ${themeStyle.mutedText}`}>
                          Opacity Latar Teks / Kotak Baca
                        </span>
                        <span className={`font-mono font-bold ${themeStyle.accentText}`}>
                          {prefs.bgPanelOpacity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={95}
                        step={5}
                        value={prefs.bgPanelOpacity}
                        onChange={(e) =>
                          updatePrefs({ bgPanelOpacity: Number(e.target.value) })
                        }
                        className="w-full h-2 accent-sky-400 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Background Focus Position (Mobile Portrait & Laptop Landscape) */}
                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Posisi Fokus Gambar (HP &amp; Laptop)
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'top', label: 'Atas' },
                          { id: 'center', label: 'Tengah' },
                          { id: 'bottom', label: 'Bawah' },
                        ] as Array<{ id: ReaderBgPosition; label: string }>
                      ).map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => updatePrefs({ bgPosition: pos.id })}
                          className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            prefs.bgPosition === pos.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-current/10 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBgUrlDraft('');
                  void deleteReaderBgVideoBlob();
                  updatePrefs(DEFAULT_READER_PREFS);
                }}
                className={`text-[11px] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer ${themeStyle.accentText}`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Pengaturan</span>
              </button>
              {book && (
                <button
                  type="button"
                  onClick={() => void handleDeleteCurrentBook()}
                  className="text-[11px] font-bold text-red-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus Buku</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* TOC, BOOKMARKS & PERMANENT LIBRARY DRAWER */}
      {showToc && (book || tocTab === 'library') && (
        <>
          <div
            className="fixed inset-0 z-[105] bg-black/50"
            onClick={() => setShowToc(false)}
          />
          <aside
            className={`fixed inset-y-0 left-0 z-[110] w-84 max-w-[90vw] border-r p-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-3 shadow-2xl ${themeStyle.panel}`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-current/10">
              <div className="min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wider truncate">
                  {tocTab === 'library'
                    ? `Library Novel (${savedBooks.length})`
                    : book?.title || target.title}
                </div>
                <div className={`text-[11px] ${themeStyle.mutedText}`}>
                  {tocTab === 'library'
                    ? storageInfo.persisted
                      ? 'Penyimpanan Permanen Aktif'
                      : 'Tersimpan di IndexedDB Browser'
                    : book
                      ? `${book.chapters.length} bab • ${book.bookmarks?.length ?? 0} bookmark`
                      : 'Belum ada buku terbuka'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowToc(false)}
                className="p-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                disabled={!book}
                onClick={() => setTocTab('chapters')}
                className={`py-1.5 px-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer disabled:opacity-40 ${
                  tocTab === 'chapters'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                Bab {book ? `(${book.chapters.length})` : ''}
              </button>
              <button
                type="button"
                disabled={!book}
                onClick={() => setTocTab('bookmarks')}
                className={`py-1.5 px-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer disabled:opacity-40 ${
                  tocTab === 'bookmarks'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                Mark {book ? `(${book.bookmarks?.length ?? 0})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setTocTab('library')}
                className={`py-1.5 px-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                  tocTab === 'library'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                Library ({savedBooks.length})
              </button>
            </div>

            {tocTab === 'chapters' && book ? (
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {book.chapters.map((ch, idx) => {
                  const active = idx === book.currentChapter;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => handleSwitchChapter(idx)}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                        active
                          ? 'bg-sky-500/20 border border-sky-400/40 font-extrabold text-sky-300'
                          : 'hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <span className="truncate">
                        {idx + 1}. {ch.title}
                      </span>
                      <span className={`text-[10px] font-mono shrink-0 ${themeStyle.mutedText}`}>
                        {ch.charCount > 0 ? `${ch.charCount}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : tocTab === 'bookmarks' && book ? (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {(book.bookmarks ?? []).length === 0 ? (
                  <div className={`text-xs text-center py-8 ${themeStyle.mutedText}`}>
                    Belum ada bookmark. Tekan tombol <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">B</kbd> atau ikon Bookmark di atas saat membaca.
                  </div>
                ) : (
                  (book.bookmarks ?? []).map((bm) => (
                    <div
                      key={bm.id}
                      className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 ${themeStyle.subtleBtn}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleSwitchChapter(bm.chapterIndex, {
                            targetScrollRatio: bm.scrollRatio,
                            targetVnIndex: bm.vnIndex,
                          })
                        }
                        className="flex-1 min-w-0 text-left space-y-1 cursor-pointer"
                      >
                        <div className={`text-[11px] font-extrabold truncate ${themeStyle.accentText}`}>
                          Bab {bm.chapterIndex + 1}: {bm.chapterTitle}
                        </div>
                        <div className="text-xs line-clamp-2 opacity-90">
                          {bm.excerpt}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBookmark(bm.id)}
                        title="Hapus bookmark"
                        className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:text-red-400 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* PERMANENT LIBRARY TAB */
              <div className="flex-1 flex flex-col min-h-0 gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/25 flex items-center justify-between gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400 min-w-0">
                    <HardDrive className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {storageInfo.persisted
                        ? 'Anti-Reset Permanen Aktif'
                        : 'Penyimpanan IndexedDB Aman'}
                    </span>
                  </span>
                  {storageInfo.usageMb !== null && (
                    <span className={`font-mono shrink-0 ${themeStyle.mutedText}`}>
                      {storageInfo.usageMb} MB
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => addBookInputRef.current?.click()}
                    disabled={importing}
                    className="col-span-3 btn-crimson py-2 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {importing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Tambah Buku Baru (.EPUB / .TXT)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportLibraryBackup()}
                    className={`col-span-1 py-1.5 px-2 rounded-xl border text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <Download className="w-3 h-3" />
                    <span>Backup</span>
                  </button>
                  <button
                    type="button"
                    disabled={restoringBackup}
                    onClick={() => backupInputRef.current?.click()}
                    className={`col-span-2 py-1.5 px-2 rounded-xl border text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <FolderInput className="w-3 h-3" />
                    <span>
                      {restoringBackup ? 'Memulihkan...' : 'Pulihkan Backup (.json)'}
                    </span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {savedBooks.length === 0 ? (
                    <div className={`text-xs text-center py-8 space-y-2 ${themeStyle.mutedText}`}>
                      <p>Library Anda masih kosong.</p>
                      <p className="text-[11px]">
                        Klik <strong>Tambah Buku Baru</strong> untuk menyimpan
                        banyak novel sekaligus tanpa menimpa progres satu sama lain.
                      </p>
                    </div>
                  ) : (
                    savedBooks.map((sb) => {
                      const isCurrent = book?.storageKey === sb.storageKey;
                      const chapterPct =
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
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition ${
                            isCurrent
                              ? 'bg-sky-500/15 border-sky-400/45'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => void handleSelectLibraryBook(sb.storageKey)}
                            className="flex items-start gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            {sb.coverDataUrl ? (
                              <img
                                src={sb.coverDataUrl}
                                alt={sb.title}
                                className="w-10 h-14 rounded-lg object-cover shrink-0 border border-white/10"
                              />
                            ) : (
                              <div className="w-10 h-14 rounded-lg bg-sky-500/15 border border-sky-400/25 flex items-center justify-center shrink-0">
                                <BookOpen className="w-4 h-4 text-sky-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="text-xs font-extrabold line-clamp-2 leading-snug">
                                {sb.title}
                              </div>
                              <div className={`text-[10px] font-mono ${themeStyle.mutedText}`}>
                                Bab {sb.currentChapter + 1}/{sb.chapterCount} •{' '}
                                {chapterPct}%
                                {sb.bookmarkCount > 0
                                  ? ` • ${sb.bookmarkCount} mark`
                                  : ''}
                              </div>
                              <div className="h-1 rounded-full bg-black/25 overflow-hidden">
                                <div
                                  className="h-full bg-sky-400 rounded-full"
                                  style={{ width: `${Math.max(4, chapterPct)}%` }}
                                />
                              </div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteLibraryBook(sb.storageKey)}
                            title="Hapus buku dari Library"
                            className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:text-red-400 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </aside>
        </>
      )}

      {/* VN BACKLOG / HISTORY DRAWER */}
      {showBacklog && book && (
        <>
          <div
            className="fixed inset-0 z-[105] bg-black/50"
            onClick={() => setShowBacklog(false)}
          />
          <aside
            className={`fixed inset-y-0 right-0 z-[110] w-96 max-w-[92vw] border-l p-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-3 shadow-2xl ${themeStyle.panel}`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-sky-400" />
                  <span>Backlog / Riwayat Paragraf</span>
                </div>
                <div className={`text-[11px] truncate ${themeStyle.mutedText}`}>
                  Klik paragraf untuk langsung lompat ke baris tersebut
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBacklog(false)}
                className="p-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {chapterParagraphs
                .slice(0, Math.min(chapterParagraphs.length, vnIndex + prefs.vnParagraphsPerStep))
                .map((p, idx) => {
                  const isCurrent =
                    idx >= vnIndex && idx < vnIndex + prefs.vnParagraphsPerStep;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setVnIndex(idx);
                        updatePrefs({ readingMode: 'vn' });
                        setShowBacklog(false);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs leading-relaxed transition cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-500/20 border-sky-400/45 text-white font-semibold'
                          : `${themeStyle.subtleBtn} opacity-85 hover:opacity-100`
                      }`}
                    >
                      <div className="text-[10px] font-mono text-sky-400 mb-0.5">
                        Paragraf #{idx + 1}
                      </div>
                      <div className="line-clamp-3">
                        {p.text || '(Ilustrasi)'}
                      </div>
                    </button>
                  );
                })}
            </div>
          </aside>
        </>
      )}

      {/* SHORTCUTS CHEATSHEET MODAL */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl space-y-4 animate-scale-in ${themeStyle.panel}`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <Keyboard className="w-4 h-4 text-sky-400" />
                <span>Shortcut Keyboard Reader Novel</span>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-1.5 max-h-[65vh] overflow-y-auto pr-1">
              {READER_SHORTCUTS.map((sc) => (
                <div
                  key={sc.desc}
                  className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 text-xs"
                >
                  <span className={themeStyle.mutedText}>{sc.desc}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {sc.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 font-mono text-[11px] font-bold"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MAIN BODY */}
      <div
        className={`relative z-10 flex-1 min-h-0 flex flex-col ${
          hasActiveBg ? 'bg-transparent' : themeStyle.articleBg
        }`}
      >
        {/* Floating Paginated Side Arrow Buttons */}
        {book && activeChapter && prefs.readingMode === 'paginated' && (
          <>
            <button
              type="button"
              onClick={
                prefs.writingMode === 'vertical'
                  ? handleStepForward
                  : handleStepBackward
              }
              title={
                prefs.writingMode === 'vertical'
                  ? 'Halaman Berikutnya (←)'
                  : 'Halaman Sebelumnya (←)'
              }
              className={`hidden sm:flex fixed left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-16 rounded-2xl border items-center justify-center opacity-35 hover:opacity-95 transition cursor-pointer ${themeStyle.subtleBtn}`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={
                prefs.writingMode === 'vertical'
                  ? handleStepBackward
                  : handleStepForward
              }
              title={
                prefs.writingMode === 'vertical'
                  ? 'Halaman Sebelumnya (→)'
                  : 'Halaman Berikutnya (→)'
              }
              className={`hidden sm:flex fixed right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-16 rounded-2xl border items-center justify-center opacity-35 hover:opacity-95 transition cursor-pointer ${themeStyle.subtleBtn}`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {loadingBook ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm font-semibold opacity-75">
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
              <span>Memuat novel dari penyimpanan browser...</span>
            </div>
          </div>
        ) : book && activeChapter && prefs.readingMode === 'vn' ? (
          /* VISUAL NOVEL (VN) MODE STAGE — Horizontal & Vertical Tategaki + Animations */
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseUp={handleMouseOrKeySelection}
            onKeyUp={handleMouseOrKeySelection}
            className="flex-1 min-h-0 flex flex-col justify-between p-3 sm:p-6 overflow-hidden"
          >
            {/* Compact VN Controls Bar */}
            {!isFullscreenOrZen && (
              <div className="max-w-4xl w-full mx-auto mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBacklog(true);
                      setShowAudioPanel(false);
                    }}
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <History className="w-3.5 h-3.5 text-sky-400" />
                    <span>Riwayat (H)</span>
                  </button>

                  <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xl border text-[11px] font-bold ${themeStyle.subtleBtn}`}
                  >
                    <span className="opacity-75">Paragraf:</span>
                    <button
                      type="button"
                      onClick={() =>
                        updatePrefs({
                          vnParagraphsPerStep: Math.max(
                            1,
                            prefs.vnParagraphsPerStep - 1
                          ),
                        })
                      }
                      className="p-0.5 hover:text-sky-400 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-sky-400 w-3 text-center">
                      {prefs.vnParagraphsPerStep}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updatePrefs({
                          vnParagraphsPerStep: Math.min(
                            8,
                            prefs.vnParagraphsPerStep + 1
                          ),
                        })
                      }
                      className="p-0.5 hover:text-sky-400 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updatePrefs({
                        vnDisplayStyle:
                          prefs.vnDisplayStyle === 'card' ? 'stream' : 'card',
                      })
                    }
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    {prefs.vnDisplayStyle === 'card'
                      ? 'Gaya: Kotak VN'
                      : 'Gaya: Tumpuk'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSettingsTab('vn');
                      setShowSettings(true);
                      setShowToc(false);
                      setShowBacklog(false);
                      setShowAudioPanel(false);
                    }}
                    title="Atur Gaya & Durasi Animasi VN"
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <Sparkles className="w-3 h-3 text-sky-400 shrink-0" />
                    <span>
                      {prefs.vnAnimation === 'none'
                        ? 'Instan'
                        : `${(prefs.vnAnimationDurationMs / 1000).toFixed(2)}d`}
                    </span>
                  </button>
                </div>

                <div className={`text-[11px] font-mono ${themeStyle.mutedText}`}>
                  Paragraf {Math.min(vnIndex + 1, chapterParagraphs.length)}–
                  {Math.min(
                    vnIndex + prefs.vnParagraphsPerStep,
                    chapterParagraphs.length
                  )}{' '}
                  / {chapterParagraphs.length}
                </div>
              </div>
            )}

            {/* VN Reading Stage */}
            {chapterParagraphs.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm opacity-75">
                Bab ini tidak memiliki teks paragraf. Gunakan tombol Bab
                Berikutnya.
              </div>
            ) : prefs.vnDisplayStyle === 'card' ? (
              <div
                ref={
                  prefs.writingMode === 'horizontal'
                    ? vnVerticalViewportRef
                    : undefined
                }
                onWheel={
                  prefs.writingMode === 'horizontal' ? handleWheel : undefined
                }
                className={`flex-1 min-h-0 flex items-center justify-center ${
                  prefs.writingMode === 'vertical'
                    ? 'overflow-hidden px-2 sm:px-6 py-2'
                    : 'overflow-y-auto px-1 sm:px-4'
                }`}
              >
                <div
                  ref={
                    prefs.writingMode === 'vertical'
                      ? vnVerticalViewportRef
                      : undefined
                  }
                  onWheel={
                    prefs.writingMode === 'vertical' ? handleWheel : undefined
                  }
                  className={`rounded-3xl border ${
                    hasActiveBg ? 'bg-transparent' : themeStyle.vnCard
                  } ${
                    prefs.writingMode === 'vertical'
                      ? 'jp-scroll-viewport-vertical w-full max-w-4xl h-full max-h-[38rem] sm:max-h-[42rem] px-3 sm:px-6 py-3 sm:py-5'
                      : 'w-full max-w-3xl max-h-full overflow-y-auto p-5 sm:p-8'
                  }`}
                  style={vnCardStyle}
                >
                  <article
                    ref={articleRef}
                    data-furigana={prefs.furigana}
                    className={`jp-novel-reader-content ${contentDirClass} ${
                      prefs.writingMode === 'vertical' ? widthClass : ''
                    } ${indentClass}`}
                    style={{
                      fontFamily: activeFontCss,
                      fontSize: `${prefs.fontSize}px`,
                      lineHeight: prefs.lineHeight,
                      letterSpacing: `${prefs.letterSpacing}em`,
                    }}
                  >
                    {vnVisibleParagraphs.map((p) => (
                      <div
                        key={`${book.currentChapter}-${vnIndex}-${p.id}`}
                        data-vn-reveal="true"
                        dangerouslySetInnerHTML={{ __html: p.html }}
                      />
                    ))}
                  </article>
                </div>
              </div>
            ) : (
              /* Stream Mode (Tumpuk Paragraf) */
              <div
                ref={vnVerticalViewportRef}
                onWheel={handleWheel}
                className={`flex-1 min-h-0 px-2 sm:px-6 ${
                  prefs.writingMode === 'vertical'
                    ? 'jp-scroll-viewport-vertical py-4'
                    : 'overflow-y-auto py-4'
                }`}
              >
                <article
                  ref={articleRef}
                  data-furigana={prefs.furigana}
                  className={`jp-novel-reader-content ${contentDirClass} ${widthClass} ${indentClass} ${
                    hasActiveBg &&
                    prefs.bgPanelOpacity > 0 &&
                    prefs.writingMode === 'horizontal'
                      ? 'px-4 py-5 sm:px-8 sm:py-8 shadow-xl'
                      : ''
                  }`}
                  style={{
                    fontFamily: activeFontCss,
                    fontSize: `${prefs.fontSize}px`,
                    lineHeight: prefs.lineHeight,
                    letterSpacing: `${prefs.letterSpacing}em`,
                    ...articleGlassStyle,
                  }}
                >
                  {vnVisibleParagraphs.map((p, idx) => {
                    const isNewBatch = idx >= vnIndex;
                    return (
                      <div
                        key={`${book.currentChapter}-stream-${p.id}`}
                        data-vn-reveal={isNewBatch ? 'true' : undefined}
                        dangerouslySetInnerHTML={{ __html: p.html }}
                      />
                    );
                  })}
                  <div ref={vnStreamEndRef} />
                </article>
              </div>
            )}

            {/* VN Stepper Footer Bar */}
            {!isFullscreenOrZen && (
              <div className="max-w-3xl w-full mx-auto pt-3 flex items-center justify-between gap-2 pb-[env(safe-area-inset-bottom)]">
                <button
                  type="button"
                  onClick={handleStepBackward}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${themeStyle.subtleBtn}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Mundur</span>
                </button>

                <div className={`text-[11px] hidden sm:block ${themeStyle.mutedText}`}>
                  Tekan <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">Space</kbd> /{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">Enter</kbd> /{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono">
                    {prefs.writingMode === 'vertical' ? '←' : '→'}
                  </kbd>{' '}
                  atau swipe di HP untuk lanjut
                </div>

                <button
                  type="button"
                  onClick={handleStepForward}
                  className="btn-crimson px-5 sm:px-7 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Lanjut</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : book && activeChapter && prefs.readingMode === 'paginated' ? (
          /* PAGINATED FULL-BOOK VIEWPORT (Horizontal CSS Multi-Column & Vertical RTL) */
          <div
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="flex-1 min-h-0 flex flex-col px-2 sm:px-5 py-2.5 sm:py-4 overflow-hidden"
          >
            <div
              className={`mx-auto w-full flex flex-col overflow-hidden ${
                prefs.writingMode === 'horizontal'
                  ? prefs.maxWidth === 'full'
                    ? 'flex-1 min-h-0 max-w-none'
                    : prefs.maxWidth === 'narrow'
                      ? 'flex-1 min-h-0 max-w-[36rem]'
                      : prefs.maxWidth === 'wide'
                        ? 'flex-1 min-h-0 max-w-[60rem]'
                        : 'flex-1 min-h-0 max-w-[46rem]'
                  : prefs.maxWidth === 'narrow'
                    ? 'h-full max-h-[30rem] my-auto'
                    : prefs.maxWidth === 'medium'
                      ? 'h-full max-h-[40rem] my-auto'
                      : 'flex-1 min-h-0'
              } ${
                hasActiveBg && prefs.bgPanelOpacity > 0
                  ? 'px-4 py-4 sm:px-8 sm:py-6 shadow-xl'
                  : 'px-2 sm:px-4 py-2 sm:py-4'
              }`}
              style={articleGlassStyle}
            >
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                onMouseUp={handleMouseOrKeySelection}
                onKeyUp={handleMouseOrKeySelection}
                className={
                  prefs.writingMode === 'vertical'
                    ? 'jp-paged-v-viewport'
                    : 'jp-paged-h-viewport'
                }
              >
                <article
                  ref={articleRef}
                  data-furigana={prefs.furigana}
                  className={`jp-novel-reader-content ${contentDirClass} ${indentClass} ${
                    prefs.writingMode === 'vertical'
                      ? 'jp-paged-v-article'
                      : 'jp-paged-h-article'
                  }`}
                  style={{
                    fontFamily: activeFontCss,
                    fontSize: `${prefs.fontSize}px`,
                    lineHeight: prefs.lineHeight,
                    letterSpacing: `${prefs.letterSpacing}em`,
                    ...(prefs.writingMode === 'horizontal' && pagedWidthPx > 0
                      ? ({
                          '--jp-page-width': `${pagedWidthPx}px`,
                          '--jp-page-gap': `${PAGE_GAP}px`,
                        } as React.CSSProperties)
                      : {}),
                  }}
                >
                  <BookChaptersContent
                    chapters={book.chapters}
                    showChapterDividers={true}
                  />
                </article>
              </div>
            </div>
          </div>
        ) : book && activeChapter ? (
          /* CONTINUOUS FULL-BOOK SCROLL VIEWPORT (Horizontal & Vertical Tategaki) */
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseUp={handleMouseOrKeySelection}
            onKeyUp={handleMouseOrKeySelection}
            className={`flex-1 min-h-0 ${
              prefs.writingMode === 'vertical'
                ? `jp-scroll-viewport-vertical ${
                    prefs.maxWidth === 'full'
                      ? 'px-3 sm:px-6 py-4 sm:py-6'
                      : 'px-4 sm:px-10 py-5 sm:py-8'
                  }`
                : `overflow-y-auto overflow-x-hidden ${
                    prefs.maxWidth === 'full'
                      ? 'px-3 sm:px-6 py-5 sm:py-8'
                      : 'px-4 sm:px-8 py-6 sm:py-10'
                  }`
            }`}
          >
            <article
              ref={articleRef}
              data-furigana={prefs.furigana}
              className={`jp-novel-reader-content ${contentDirClass} ${widthClass} ${indentClass} ${
                hasActiveBg &&
                prefs.bgPanelOpacity > 0 &&
                prefs.writingMode === 'horizontal'
                  ? 'px-4 py-5 sm:px-8 sm:py-8 shadow-xl'
                  : ''
              }`}
              style={{
                fontFamily: activeFontCss,
                fontSize: `${prefs.fontSize}px`,
                lineHeight: prefs.lineHeight,
                letterSpacing: `${prefs.letterSpacing}em`,
                ...articleGlassStyle,
              }}
            >
              <BookChaptersContent
                chapters={book.chapters}
                showChapterDividers={true}
              />
            </article>
          </div>
        ) : (
          /* ONBOARDING / IMPORT EPUB VIEW (when no book loaded for this storageKey yet) */
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10">
            <div className="max-w-2xl mx-auto py-4 space-y-5">
              <div
                className={`rounded-2xl border p-6 text-center space-y-4 ${themeStyle.panel}`}
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-xs font-extrabold">
                  <span>✓ 100% Support Yomitan &amp; Sentence Mining (DOM Murni)</span>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-extrabold">
                    {target.title}
                  </h2>
                  <p className={`text-xs sm:text-sm leading-relaxed ${themeStyle.mutedText}`}>
                    Dilengkapi <strong>Mode VN + Animasi</strong>,{' '}
                    <strong>Vertikal (縦書き)</strong>, pengaturan jumlah
                    paragraf per tampil, Bookmark, &amp; <strong>Shortcut Keyboard</strong>{' '}
                    — semua merender HTML murni agar <strong>Yomitan</strong>{' '}
                    lancar scan kata &amp; kalimat.
                  </p>
                </div>

                {/* 2-step quick onboarding */}
                <div className="grid sm:grid-cols-2 gap-3 text-left pt-1">
                  {target.downloadUrl && (
                    <a
                      href="https://epub.moe/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleOpenEpubPortal(target.title)}
                      className={`p-4 rounded-xl border transition flex flex-col justify-between gap-2 ${themeStyle.subtleBtn}`}
                    >
                      <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                        Langkah 1 (Jika belum punya file)
                      </div>
                      <div className="font-extrabold text-sm flex items-center gap-1.5">
                        <Download className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>Unduh .EPUB di Epub.moe</span>
                      </div>
                      <p className={`text-[11px] ${themeStyle.mutedText}`}>
                        Buka Epub.moe (judul otomatis disalin — cukup tekan
                        Ctrl+V → Enter → Download), lalu tarik file .epub ke
                        kotak di kanan.
                      </p>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className={`p-4 rounded-xl border-2 border-dashed border-sky-400/50 bg-sky-500/10 hover:bg-sky-500/15 transition text-left flex flex-col justify-between gap-2 cursor-pointer ${
                      target.downloadUrl ? '' : 'sm:col-span-2'
                    }`}
                  >
                    <div className="text-[11px] font-mono uppercase tracking-wider text-sky-300 font-bold">
                      {target.downloadUrl
                        ? 'Langkah 2 (Sekali seumur hidup)'
                        : 'Muat Novel EPUB / TXT'}
                    </div>
                    <div className="font-extrabold text-sm flex items-center gap-1.5 text-sky-200">
                      {importing ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <FileUp className="w-4 h-4 shrink-0" />
                      )}
                      <span>
                        {importing
                          ? 'Membaca isi EPUB...'
                          : 'Pilih atau Tarik File .EPUB ke Sini'}
                      </span>
                    </div>
                    <p className={`text-[11px] ${themeStyle.mutedText}`}>
                      Tersimpan permanen di browser (IndexedDB). Lain kali klik
                      baca langsung terbuka!
                    </p>
                  </button>
                </div>

                {/* 1-click Pure HTML Web Novel portals for instant Yomitan without downloading */}
                <div className="pt-2 border-t border-white/10 text-left flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-[11px] font-bold ${themeStyle.mutedText}`}>
                    Atau Baca Langsung Online (Support Yomitan, Tanpa Download):
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <a
                      href={`https://yomou.syosetu.com/search.php?word=${encodeURIComponent(
                        target.title
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Syosetu (なろう)
                    </a>
                    <a
                      href={`https://kakuyomu.jp/search?q=${encodeURIComponent(
                        target.title
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-300 text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Kakuyomu
                    </a>
                  </div>
                </div>

                {target.volumes && target.volumes.length > 1 && (
                  <div className="pt-2 border-t border-white/10 text-left space-y-2">
                    <div className={`text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Cari &amp; Unduh Volume Spesifik di Epub.moe (Judul Otomatis Disalin):
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {target.volumes.map((v, i) => (
                        <a
                          key={v.md5}
                          href="https://epub.moe/"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleOpenEpubPortal(v.title)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 ${themeStyle.subtleBtn}`}
                        >
                          <Download className="w-3 h-3" />
                          Vol {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Direct Yatsu Book Link */}
                <div className="pt-3 border-t border-white/10 text-left space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                      Atau Hubungkan Link Buku di Yatsu Reader
                    </span>
                    <a
                      href={directYatsuUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-sky-400 hover:underline inline-flex items-center gap-1"
                    >
                      Buka Yatsu sekarang <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <form onSubmit={handleSaveYatsuLink} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Tempel URL buku Yatsu (https://app.yatsu.moe/b?id=...) atau ID buku"
                      value={yatsuInput}
                      onChange={(e) => setYatsuInput(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-black/25 border border-white/15 text-xs focus:outline-none focus:border-sky-400"
                    />
                    <button
                      type="submit"
                      className="btn-crimson px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer shrink-0"
                    >
                      Simpan Link
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI SENTENCE EXPLANATION POPOVER CARD */}
      {aiExplainState && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[114] w-[min(92vw,34rem)] rounded-2xl bg-[#0b121c]/95 border border-sky-400/45 text-white shadow-2xl backdrop-blur-md overflow-hidden">
          <div className="px-3.5 py-2 border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-300 min-w-0">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Penjelasan AI: 「{aiExplainState.sentence}」
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                aiExplainAbortRef.current?.abort();
                setAiExplainState(null);
              }}
              className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3.5 max-h-60 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap select-text">
            {aiExplainState.loading ? (
              <div className="py-4 flex items-center justify-center gap-2 text-sky-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI sedang menganalisis kalimat Jepang...</span>
              </div>
            ) : aiExplainState.error ? (
              <div className="text-rose-300">{aiExplainState.error}</div>
            ) : (
              <div>{aiExplainState.text}</div>
            )}
          </div>
        </div>
      )}

      {/* FLOATING SENTENCE HELPER BAR ON TEXT SELECTION */}
      {selectedSentence && book && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-2xl bg-[#0b121c]/95 border border-sky-400/40 text-white shadow-2xl flex items-center gap-1.5 sm:gap-2 max-w-[94vw] flex-wrap sm:flex-nowrap backdrop-blur-md">
          <span className="text-xs truncate max-w-[11rem] sm:max-w-[14rem] font-medium text-sky-100">
            「{selectedSentence}」
          </span>
          <button
            type="button"
            onClick={handleSpeakSelectedSentence}
            title="Bacakan kalimat ini dengan suara Jepang"
            className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 text-emerald-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Volume2 className="w-3 h-3" />
            Bacakan
          </button>
          <button
            type="button"
            onClick={() => void handleExplainSelectedSentence()}
            title="Tanya arti & tata bahasa kalimat ini ke AI"
            className="px-2 py-1 rounded-lg bg-violet-500/25 border border-violet-400/45 hover:bg-violet-500/35 text-violet-100 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Sparkles className="w-3 h-3" />
            Tanya AI
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(selectedSentence);
              toast.success('Kalimat disalin ke clipboard!');
            }}
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Copy className="w-3 h-3" />
            Salin
          </button>
          <a
            href={`https://jisho.org/search/${encodeURIComponent(selectedSentence)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded-lg bg-sky-500 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0"
          >
            <Search className="w-3 h-3" />
            Jisho
          </a>
        </div>
      )}

      {/* PER-NOVEL AUDIOBOOK & AI NARATOR DOCK */}
      {book && activeChapter && (
        <ReaderAudiobookDock
          open={showAudioPanel}
          initialTab={audioPanelTab}
          onClose={() => setShowAudioPanel(false)}
          onOpenDrawer={(tab) => {
            setAudioPanelTab(tab);
            setShowAudioPanel(true);
            setShowSettings(false);
            setShowToc(false);
            setShowBacklog(false);
          }}
          bookStorageKey={book.storageKey}
          bookTitle={book.title}
          chapterCount={book.chapters.length}
          currentChapterIndex={book.currentChapter}
          chapterParagraphs={chapterParagraphs}
          readingMode={prefs.readingMode}
          vnIndex={vnIndex}
          vnParagraphsPerStep={prefs.vnParagraphsPerStep}
          scrollRatio={liveScrollRatioRef.current}
          isFullscreenOrZen={isFullscreenOrZen}
          themeStyle={themeStyle}
          hasActiveBg={hasActiveBg}
          oneShotSpeakRequest={oneShotSpeakRequest}
          onAdvanceVnStep={handleStepForward}
          onSwitchChapter={(idx) => handleSwitchChapter(idx)}
          onPlaybackStatusChange={(st) => setAudioPlaybackActive(st.active)}
        />
      )}

      {/* BOTTOM SLIDE / PAGE & CHAPTER NAVIGATION BAR */}
      {!isFullscreenOrZen &&
        book &&
        activeChapter &&
        prefs.readingMode !== 'vn' && (
          <footer
            className={`relative z-20 shrink-0 px-2.5 sm:px-5 py-2 border-t backdrop-blur-md flex items-center justify-between gap-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${
              hasActiveBg ? themeStyle.toolbarGlass : themeStyle.toolbar
            }`}
          >
            {/* Clickable 3px full-book progress bar */}
            <div
              onClick={handleScrubBookProgress}
              title="Klik untuk lompat posisi baca dalam buku"
              className="absolute -top-1 inset-x-0 h-2.5 cursor-pointer group z-30 flex items-center"
            >
              <div className="w-full h-[3px] group-hover:h-1 bg-white/10 transition-all overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-[width] duration-150"
                  style={{ width: `${Math.min(100, Math.max(0, bookBarPct))}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={book.currentChapter <= 0}
                onClick={() => handleSwitchChapter(book.currentChapter - 1)}
                title="Bab Sebelumnya ([)"
                className={`p-2 rounded-xl border text-xs font-bold disabled:opacity-35 cursor-pointer ${themeStyle.subtleBtn}`}
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleStepBackward}
                title="Halaman / Slide Sebelumnya"
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowToc(true);
                setShowSettings(false);
                setShowBacklog(false);
                setShowAudioPanel(false);
              }}
              title="Buka Daftar Bab & Bookmark"
              className={`min-w-0 flex-1 text-[11px] font-mono text-center truncate px-2 py-1 rounded-lg hover:bg-white/10 transition cursor-pointer flex items-center justify-center gap-1.5 ${themeStyle.mutedText}`}
            >
              <span className="truncate max-w-[8rem] sm:max-w-xs font-semibold">
                Bab {book.currentChapter + 1}/{book.chapters.length}
              </span>
              <span>•</span>
              <span>
                Hal {pageInfo.current}/{pageInfo.total}
              </span>
              <span>•</span>
              <span>{readingProgressStats.bookPct}%</span>
              {readingProgressStats.charsPerHour > 0 && (
                <span className="hidden md:inline text-sky-400">
                  • ~{readingProgressStats.charsPerHour.toLocaleString('id-ID')}{' '}
                  huruf/jam
                </span>
              )}
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleStepForward}
                title="Halaman / Slide Berikutnya"
                className="btn-crimson px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Lanjut</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={book.currentChapter >= book.chapters.length - 1}
                onClick={() => handleSwitchChapter(book.currentChapter + 1)}
                title="Bab Berikutnya (])"
                className={`p-2 rounded-xl border text-xs font-bold disabled:opacity-35 cursor-pointer ${themeStyle.subtleBtn}`}
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </footer>
        )}
    </div>,
    document.body
  );
};
