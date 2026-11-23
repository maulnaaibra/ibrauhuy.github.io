import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  History,
  Keyboard,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Save,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  addStoredNovelBookmark,
  DEFAULT_READER_PREFS,
  deleteStoredNovelBook,
  deleteStoredNovelBookmark,
  extractChapterParagraphs,
  getStoredNovelBook,
  listStoredNovelBooks,
  loadReaderPrefs,
  loadYatsuBookLinks,
  normalizeYatsuUrl,
  parseNovelFile,
  resolveYatsuUrl,
  saveReaderPrefs,
  saveStoredNovelBook,
  saveYatsuBookLink,
  updateStoredNovelProgress,
  type NovelBookmark,
  type ReaderMode,
  type ReaderPreferences,
  type StoredNovelBook,
  type StoredNovelSummary,
  type VnAnimationStyle,
} from '../lib/epubReaderStore';

export interface NovelReaderTarget {
  storageKey: string;
  catalogItemId?: string;
  title: string;
  downloadUrl?: string;
  volumes?: Array<{ md5: string; title: string }>;
}

interface JapaneseNovelReaderModalProps {
  target: NovelReaderTarget;
  onClose: () => void;
  onLogReadingSession: (title: string, minutes: number) => void;
  onBookLibraryChanged?: () => void;
}

const READER_THEME_STYLES: Record<
  ReaderPreferences['theme'],
  {
    shell: string;
    toolbar: string;
    panel: string;
    subtleBtn: string;
    mutedText: string;
    articleBg: string;
    vnCard: string;
  }
> = {
  navy: {
    shell: 'bg-[#0b121c] text-[#eef4fb]',
    toolbar: 'bg-[#0f1826]/95 border-[#1e2d42] text-[#f3f7fc]',
    panel: 'bg-[#121e30] border-[#253751] text-[#f3f7fc]',
    subtleBtn:
      'bg-[#172438] hover:bg-[#1f314c] border-[#293d5a] text-[#dce7f5]',
    mutedText: 'text-[#8ea0b5]',
    articleBg: 'bg-[#0b121c] text-[#e8eff8]',
    vnCard:
      'bg-[#111c2d]/95 border-[#253852] shadow-[0_24px_60px_-15px_rgba(4,9,17,0.75)]',
  },
  amoled: {
    shell: 'bg-black text-[#e5e7eb]',
    toolbar: 'bg-[#09090b]/95 border-white/15 text-white',
    panel: 'bg-[#121216] border-white/15 text-white',
    subtleBtn:
      'bg-white/10 hover:bg-white/15 border-white/15 text-neutral-200',
    mutedText: 'text-neutral-400',
    articleBg: 'bg-black text-[#e5e7eb]',
    vnCard: 'bg-[#0b0b0f]/95 border-white/15 shadow-2xl',
  },
  sepia: {
    shell: 'bg-[#f4ecd8] text-[#3b2f1e]',
    toolbar: 'bg-[#ebe0c6]/95 border-[#d6c6a5] text-[#2e2315]',
    panel: 'bg-[#f8f2e4] border-[#d6c6a5] text-[#2e2315]',
    subtleBtn:
      'bg-[#e6d9bb] hover:bg-[#dccba7] border-[#cbb892] text-[#3b2f1e]',
    mutedText: 'text-[#756248]',
    articleBg: 'bg-[#f4ecd8] text-[#3b2f1e]',
    vnCard: 'bg-[#fbf6ea] border-[#d6c6a5] shadow-xl',
  },
  light: {
    shell: 'bg-[#f8fafc] text-[#0f172a]',
    toolbar: 'bg-white/95 border-slate-200 text-slate-900',
    panel: 'bg-white border-slate-200 text-slate-900',
    subtleBtn:
      'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700',
    mutedText: 'text-slate-500',
    articleBg: 'bg-white text-[#0f172a]',
    vnCard: 'bg-white border-slate-200 shadow-xl',
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
  { keys: ['P'], desc: 'Ganti mode baca (Scroll / Halaman / VN)' },
  { keys: ['T'], desc: 'Ganti arah baca (Horizontal ↔ Vertikal 縦書き)' },
  { keys: ['F'], desc: 'Ganti mode Furigana (Tampil / Hover / Sembunyi)' },
  { keys: ['+', '-'], desc: 'Perbesar / perkecil ukuran huruf' },
  { keys: ['B'], desc: 'Simpan Bookmark posisi sekarang' },
  { keys: ['C'], desc: 'Buka Daftar Bab & Bookmark' },
  { keys: ['H'], desc: 'Buka Riwayat Paragraf (Backlog Mode VN)' },
  { keys: ['S'], desc: 'Buka Pengaturan Reader' },
  { keys: ['M'], desc: 'Mode Fullscreen / Fokus (sembunyikan toolbar)' },
  { keys: ['?'], desc: 'Tampilkan panduan shortcut ini' },
  { keys: ['Esc'], desc: 'Tutup panel / keluar dari Reader' },
];

export const JapaneseNovelReaderModal: React.FC<
  JapaneseNovelReaderModalProps
> = ({ target, onClose, onLogReadingSession, onBookLibraryChanged }) => {
  const readerRootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const vnVerticalViewportRef = useRef<HTMLDivElement | null>(null);
  const vnStreamEndRef = useRef<HTMLDivElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const pendingJumpToEndRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  const [activeKey, setActiveKey] = useState(target.storageKey);
  const [book, setBook] = useState<StoredNovelBook | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [importing, setImporting] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);

  const [savedBooks, setSavedBooks] = useState<StoredNovelSummary[]>([]);
  const [prefs, setPrefs] = useState<ReaderPreferences>(loadReaderPrefs);
  const [showToc, setShowToc] = useState(false);
  const [tocTab, setTocTab] = useState<'chapters' | 'bookmarks'>('chapters');
  const [showSettings, setShowSettings] = useState(false);
  const [showBacklog, setShowBacklog] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [scrollPct, setScrollPct] = useState(0);
  const [pageInfo, setPageInfo] = useState<{ current: number; total: number }>({
    current: 1,
    total: 1,
  });
  const [vnIndex, setVnIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
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

  const loadBookByKey = useCallback(async (key: string) => {
    setLoadingBook(true);
    const [loaded, allSaved] = await Promise.all([
      getStoredNovelBook(key),
      listStoredNovelBooks(),
    ]);
    setBook(loaded);
    setVnIndex(loaded?.vnIndex ?? 0);
    setSavedBooks(allSaved);
    setLoadingBook(false);
  }, []);

  useEffect(() => {
    setActiveKey(target.storageKey);
    setYatsuInput(yatsuLinks[target.storageKey] ?? '');
    void loadBookByKey(target.storageKey);
  }, [target.storageKey, loadBookByKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!book) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [book]);

  const updatePrefs = useCallback((patch: Partial<ReaderPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveReaderPrefs(next);
      return next;
    });
  }, []);

  const computeScrollMetrics = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return { ratio: 0, current: 1, total: 1 };

    if (prefs.writingMode === 'vertical') {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const stepPx = Math.max(220, Math.round(el.clientWidth * 0.88));
      const total = Math.max(1, Math.ceil(el.scrollWidth / stepPx));
      if (maxScroll <= 2) {
        return { ratio: 0, current: 1, total };
      }
      const scrolled = Math.abs(el.scrollLeft);
      const ratio = Math.min(1, Math.max(0, scrolled / maxScroll));
      const current =
        scrolled >= maxScroll - 16
          ? total
          : Math.min(total, Math.floor(scrolled / stepPx) + 1);
      return { ratio, current, total };
    }

    const maxScroll = el.scrollHeight - el.clientHeight;
    const stepPx = Math.max(220, Math.round(el.clientHeight * 0.88));
    const total = Math.max(1, Math.ceil(el.scrollHeight / stepPx));
    if (maxScroll <= 2) {
      return { ratio: 0, current: 1, total };
    }
    const ratio = Math.min(1, Math.max(0, el.scrollTop / maxScroll));
    const current =
      el.scrollTop >= maxScroll - 16
        ? total
        : Math.min(total, Math.floor(el.scrollTop / stepPx) + 1);
    return { ratio, current, total };
  }, [prefs.writingMode]);

  const persistCurrentProgress = useCallback(
    async (explicitRatio?: number, explicitVnIdx?: number) => {
      if (!book) return;
      const metrics = computeScrollMetrics();
      const ratio =
        explicitRatio ??
        (prefs.readingMode === 'vn'
          ? chapterParagraphs.length > 0
            ? Math.min(
                1,
                (explicitVnIdx ?? vnIndex) /
                  Math.max(1, chapterParagraphs.length - 1)
              )
            : 0
          : metrics.ratio);
      await updateStoredNovelProgress(
        book.storageKey,
        book.currentChapter,
        ratio,
        explicitVnIdx ?? vnIndex
      );
    },
    [
      book,
      computeScrollMetrics,
      prefs.readingMode,
      chapterParagraphs.length,
      vnIndex,
    ]
  );

  const handleCloseReader = useCallback(async () => {
    await persistCurrentProgress();
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore fullscreen exit error
      }
    }
    onClose();
  }, [persistCurrentProgress, onClose]);

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

      pendingJumpToEndRef.current = Boolean(opts?.jumpToEnd);

      const updated: StoredNovelBook = {
        ...book,
        currentChapter: clamped,
        scrollRatio: targetRatio,
        vnIndex: targetVn,
        updatedAt: Date.now(),
      };
      setBook(updated);
      setVnIndex(targetVn);
      setShowToc(false);
      setShowBacklog(false);
      setSelectedSentence('');
      void saveStoredNovelBook(updated);

      const el = scrollContainerRef.current;
      if (el && !opts?.jumpToEnd && !opts?.targetScrollRatio) {
        el.scrollTop = 0;
        el.scrollLeft = 0;
        setScrollPct(0);
      }
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

  // Restore scroll position cleanly when chapter or writingMode changes
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !book || prefs.readingMode === 'vn') return;
    const raf = window.requestAnimationFrame(() => {
      const ratio = pendingJumpToEndRef.current ? 1 : book.scrollRatio || 0;
      pendingJumpToEndRef.current = false;
      if (prefs.writingMode === 'vertical') {
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        el.scrollLeft = ratio > 0 ? -(maxScroll * ratio) : 0;
      } else {
        const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTop = Math.round(maxScroll * ratio);
      }
      const m = computeScrollMetrics();
      setScrollPct(Math.round(m.ratio * 100));
      setPageInfo({ current: m.current, total: m.total });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [
    book?.storageKey,
    book?.currentChapter,
    prefs.writingMode,
    prefs.readingMode,
    prefs.fontSize,
    prefs.lineHeight,
    prefs.maxWidth,
    computeScrollMetrics,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep page counter updated when viewport resizes
  useEffect(() => {
    const onResize = () => {
      if (!book || prefs.readingMode === 'vn') return;
      const m = computeScrollMetrics();
      setPageInfo({ current: m.current, total: m.total });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [book, prefs.readingMode, computeScrollMetrics]);

  const handleStepForward = useCallback(() => {
    if (!book) return;

    if (prefs.readingMode === 'vn') {
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
      setVnIndex(nextVn);
      setSelectedSentence('');
      const ratio =
        chapterParagraphs.length > 1
          ? Math.min(1, nextVn / (chapterParagraphs.length - 1))
          : 0;
      setScrollPct(Math.round(ratio * 100));
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

    if (prefs.writingMode === 'vertical') {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      const scrolled = Math.abs(el.scrollLeft);
      if (scrolled >= maxScroll - 18) {
        if (book.currentChapter < book.chapters.length - 1) {
          handleSwitchChapter(book.currentChapter + 1);
        } else {
          toast('Sudah di halaman terakhir buku ini.');
        }
        return;
      }
      const step = Math.max(220, Math.round(el.clientWidth * 0.88));
      el.scrollBy({ left: -step, behavior: 'smooth' });
      return;
    }

    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    if (el.scrollTop >= maxScroll - 18) {
      if (book.currentChapter < book.chapters.length - 1) {
        handleSwitchChapter(book.currentChapter + 1);
      } else {
        toast('Sudah di halaman terakhir buku ini.');
      }
      return;
    }
    const step = Math.max(220, Math.round(el.clientHeight * 0.88));
    el.scrollBy({ top: step, behavior: 'smooth' });
  }, [
    book,
    prefs.readingMode,
    prefs.vnParagraphsPerStep,
    prefs.writingMode,
    vnIndex,
    chapterParagraphs.length,
    handleSwitchChapter,
  ]);

  const handleStepBackward = useCallback(() => {
    if (!book) return;

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
      setVnIndex(prevVn);
      setSelectedSentence('');
      const ratio =
        chapterParagraphs.length > 1
          ? Math.min(1, prevVn / (chapterParagraphs.length - 1))
          : 0;
      setScrollPct(Math.round(ratio * 100));
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

    if (prefs.writingMode === 'vertical') {
      const scrolled = Math.abs(el.scrollLeft);
      if (scrolled <= 18) {
        if (book.currentChapter > 0) {
          handleSwitchChapter(book.currentChapter - 1, { jumpToEnd: true });
        }
        return;
      }
      const step = Math.max(220, Math.round(el.clientWidth * 0.88));
      el.scrollBy({ left: step, behavior: 'smooth' });
      return;
    }

    if (el.scrollTop <= 18) {
      if (book.currentChapter > 0) {
        handleSwitchChapter(book.currentChapter - 1, { jumpToEnd: true });
      }
      return;
    }
    const step = Math.max(220, Math.round(el.clientHeight * 0.88));
    el.scrollBy({ top: -step, behavior: 'smooth' });
  }, [
    book,
    prefs.readingMode,
    prefs.vnParagraphsPerStep,
    prefs.writingMode,
    vnIndex,
    chapterParagraphs.length,
    handleSwitchChapter,
  ]);

  const handleAddBookmark = useCallback(async () => {
    if (!book || !activeChapter) return;
    const metrics = computeScrollMetrics();
    const excerpt =
      prefs.readingMode === 'vn'
        ? chapterParagraphs[vnIndex]?.text || activeChapter.title
        : chapterParagraphs[
            Math.min(
              Math.max(0, chapterParagraphs.length - 1),
              Math.floor(metrics.ratio * Math.max(1, chapterParagraphs.length - 1))
            )
          ]?.text || activeChapter.title;

    const bookmark: NovelBookmark = {
      id: `bm-${Date.now()}`,
      chapterIndex: book.currentChapter,
      chapterTitle: activeChapter.title,
      scrollRatio:
        prefs.readingMode === 'vn'
          ? chapterParagraphs.length > 1
            ? vnIndex / (chapterParagraphs.length - 1)
            : 0
          : metrics.ratio,
      vnIndex: prefs.readingMode === 'vn' ? vnIndex : undefined,
      excerpt: excerpt.slice(0, 75),
      createdAt: Date.now(),
    };
    const nextBookmarks = await addStoredNovelBookmark(book.storageKey, bookmark);
    setBook((prev) => (prev ? { ...prev, bookmarks: nextBookmarks } : prev));
    toast.success(`Bookmark disimpan di Bab ${book.currentChapter + 1}!`);
  }, [
    book,
    activeChapter,
    computeScrollMetrics,
    prefs.readingMode,
    chapterParagraphs,
    vnIndex,
  ]);

  const handleDeleteBookmark = async (bookmarkId: string) => {
    if (!book) return;
    const nextBookmarks = await deleteStoredNovelBookmark(
      book.storageKey,
      bookmarkId
    );
    setBook((prev) => (prev ? { ...prev, bookmarks: nextBookmarks } : prev));
    toast.success('Bookmark dihapus.');
  };

  // Global keyboard shortcuts inside Reader
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcuts) {
          setShowShortcuts(false);
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

      if (showShortcuts || showToc || showBacklog) return;

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
          nextMode === 'vn' ? 'Mode VN aktif' : 'Mode Halaman aktif'
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
              ? 'Mode Halaman'
              : 'Mode Scroll'
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
      } else if (lower === 'h') {
        e.preventDefault();
        setShowBacklog((prev) => !prev);
        setShowSettings(false);
      } else if (lower === 's') {
        e.preventDefault();
        setShowSettings((prev) => !prev);
      } else if (lower === 'm') {
        e.preventDefault();
        void handleToggleFullscreen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    book,
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

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const parsed = await parseNovelFile(file, {
        storageKey: activeKey,
        catalogItemId: target.catalogItemId,
        fallbackTitle: target.title,
      });
      await saveStoredNovelBook(parsed);
      setBook(parsed);
      setVnIndex(0);
      setElapsedSec(0);
      const list = await listStoredNovelBooks();
      setSavedBooks(list);
      onBookLibraryChanged?.();
      toast.success(
        `「${parsed.title}」 (${parsed.chapters.length} bab) siap dibaca & support Yomitan!`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal membuka file EPUB/TXT.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleScroll = () => {
    if (!book || prefs.readingMode === 'vn') return;
    const metrics = computeScrollMetrics();
    setScrollPct(Math.round(metrics.ratio * 100));
    setPageInfo({ current: metrics.current, total: metrics.total });

    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
    }
    progressTimerRef.current = window.setTimeout(() => {
      void updateStoredNovelProgress(
        book.storageKey,
        book.currentChapter,
        metrics.ratio
      );
    }, 350);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (prefs.writingMode !== 'vertical') return;
    const el =
      prefs.readingMode === 'vn'
        ? vnVerticalViewportRef.current
        : scrollContainerRef.current;
    if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    el.scrollLeft -= e.deltaY;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
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
    await deleteStoredNovelBook(book.storageKey);
    const remaining = await listStoredNovelBooks();
    setSavedBooks(remaining);
    setBook(null);
    setShowSettings(false);
    onBookLibraryChanged?.();
    toast.success('Buku dihapus dari penyimpanan browser.');
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
    toast.success('Link buku Yatsu disimpan!');
  };

  const handleLogCurrentSession = () => {
    const mins = Math.max(1, Math.round(elapsedSec / 60));
    onLogReadingSession(book?.title || target.title, mins);
  };

  const themeStyle = READER_THEME_STYLES[prefs.theme];
  const directYatsuUrl = resolveYatsuUrl(activeKey, yatsuLinks);
  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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
    const charsPerHour =
      elapsedSec >= 20 && chapterCharsRead > 0
        ? Math.round((chapterCharsRead / elapsedSec) * 3600)
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
    elapsedSec,
  ]);

  const vnAnimClass =
    prefs.vnAnimation === 'none' ? '' : `jp-vn-anim-${prefs.vnAnimation}`;

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
    prefs.writingMode === 'horizontal'
      ? `jp-width-${prefs.maxWidth}`
      : '';
  const indentClass = prefs.indentParagraphs ? 'jp-indent-on' : '';
  const contentFontClass =
    prefs.fontFamily === 'serif' ? 'jp-font-serif' : 'jp-font-sans';
  const contentDirClass =
    prefs.writingMode === 'vertical'
      ? 'jp-writing-vertical'
      : 'jp-writing-horizontal';

  const isFullscreenOrZen = isFullscreen || zenMode;

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
        const f = e.dataTransfer.files?.[0];
        if (f) void handleImportFile(f);
      }}
    >
      {/* Hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.txt,.html,.htm,.xhtml"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImportFile(f);
          e.target.value = '';
        }}
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
          className={`shrink-0 border-b backdrop-blur-md z-20 pt-[max(0.5rem,env(safe-area-inset-top))] ${themeStyle.toolbar}`}
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
                  {/* Desktop Reading Mode Switcher: Scroll | Halaman | VN */}
                  <div
                    className={`hidden md:inline-flex items-center p-0.5 rounded-xl border ${themeStyle.subtleBtn}`}
                  >
                    {(
                      [
                        { id: 'scroll', label: 'Scroll' },
                        { id: 'paginated', label: 'Halaman' },
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

                  {/* Live Timer & Save to Log */}
                  <button
                    type="button"
                    onClick={handleLogCurrentSession}
                    title="Catat durasi baca saat ini ke Immersion Log"
                    className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-xs font-mono font-bold inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatElapsed(elapsedSec)}</span>
                    <Save className="w-3 h-3 hidden sm:inline shrink-0" />
                  </button>

                  {/* Desktop Bookmark */}
                  <button
                    type="button"
                    onClick={() => void handleAddBookmark()}
                    title="Simpan Bookmark (B)"
                    className={`hidden md:inline-flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold items-center gap-1 transition cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <Bookmark className="w-3.5 h-3.5 text-sky-400" />
                  </button>

                  {/* TOC + Bookmarks Drawer */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowToc((prev) => !prev);
                      setShowSettings(false);
                      setShowBacklog(false);
                    }}
                    title="Daftar Bab & Bookmark (C)"
                    className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer ${themeStyle.subtleBtn}`}
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
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                title="Pilih / Ganti file EPUB atau TXT"
                className={`hidden md:inline-flex p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border text-xs font-bold items-center gap-1 transition cursor-pointer ${themeStyle.subtleBtn}`}
              >
                {importing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span className="hidden xl:inline">
                  {book ? 'Ganti EPUB' : 'Pilih EPUB'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSettings((prev) => !prev);
                  setShowToc(false);
                  setShowBacklog(false);
                }}
                title="Pengaturan Baca, Mode VN & Animasi (S)"
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
                    { id: 'scroll', label: 'Scroll' },
                    { id: 'paginated', label: 'Hal' },
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
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${themeStyle.subtleBtn}`}
              >
                <Upload className="w-3 h-3" />
                <span>EPUB</span>
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

      {/* SETTINGS POPOVER */}
      {showSettings && (
        <div
          className={`fixed top-14 right-3 sm:right-5 z-[110] w-[21rem] max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border p-4 shadow-2xl space-y-4 animate-scale-in ${themeStyle.panel}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Pengaturan Reader Novel
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Reading Mode */}
          <div className="space-y-1.5">
            <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
              Mode Membaca (P / V)
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'scroll', label: 'Scroll' },
                  { id: 'paginated', label: 'Halaman' },
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

          {/* VN Mode Specific Options */}
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/25 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-sky-300 inline-flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Pengaturan Mode VN
              </span>
              {prefs.readingMode !== 'vn' && (
                <button
                  type="button"
                  onClick={() => updatePrefs({ readingMode: 'vn' })}
                  className="text-[10px] font-bold text-sky-300 underline cursor-pointer"
                >
                  Aktifkan
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className={themeStyle.mutedText}>
                  Paragraf Sekali Muncul
                </span>
                <span className="font-mono font-bold text-sky-300">
                  {prefs.vnParagraphsPerStep} paragraf
                </span>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updatePrefs({ vnParagraphsPerStep: n })}
                    className={`py-1 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer ${
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

            <div className="space-y-1">
              <span className={`block text-[11px] ${themeStyle.mutedText}`}>
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
                    onClick={() => updatePrefs({ vnAnimation: anim.id })}
                    className={`py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
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

            <div className="space-y-1">
              <span className={`block text-[11px] ${themeStyle.mutedText}`}>
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
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
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
                className="flex-1 h-1.5 accent-sky-400 cursor-pointer"
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
              className="w-full h-1.5 accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Horizontal Width & Indent */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                Lebar Teks
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'narrow', label: 'S' },
                    { id: 'medium', label: 'M' },
                    { id: 'wide', label: 'L' },
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

          {/* Font Family */}
          <div className="space-y-1.5">
            <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
              Font Bahasa Jepang
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'serif', label: 'Mincho (Serif)' },
                  { id: 'sans', label: 'Gothic (Sans)' },
                ] as const
              ).map((ff) => (
                <button
                  key={ff.id}
                  type="button"
                  onClick={() => updatePrefs({ fontFamily: ff.id })}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    prefs.fontFamily === ff.id
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : themeStyle.subtleBtn
                  }`}
                >
                  {ff.label}
                </button>
              ))}
            </div>
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

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => updatePrefs(DEFAULT_READER_PREFS)}
              className="text-[11px] font-bold text-sky-400 hover:underline cursor-pointer"
            >
              Reset Pengaturan
            </button>
            {book && (
              <button
                type="button"
                onClick={() => void handleDeleteCurrentBook()}
                className="text-[11px] font-bold text-red-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Buku
              </button>
            )}
          </div>
        </div>
      )}

      {/* TOC & BOOKMARKS DRAWER */}
      {showToc && book && (
        <>
          <div
            className="fixed inset-0 z-[105] bg-black/50"
            onClick={() => setShowToc(false)}
          />
          <aside
            className={`fixed inset-y-0 left-0 z-[110] w-80 max-w-[88vw] border-r p-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-3 shadow-2xl ${themeStyle.panel}`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wider truncate">
                  {book.title}
                </div>
                <div className={`text-[11px] ${themeStyle.mutedText}`}>
                  {book.chapters.length} bab •{' '}
                  {book.bookmarks?.length ?? 0} bookmark
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

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setTocTab('chapters')}
                className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  tocTab === 'chapters'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                Daftar Bab ({book.chapters.length})
              </button>
              <button
                type="button"
                onClick={() => setTocTab('bookmarks')}
                className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  tocTab === 'bookmarks'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                Bookmark ({book.bookmarks?.length ?? 0})
              </button>
            </div>

            {tocTab === 'chapters' ? (
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
            ) : (
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
                        <div className="text-[11px] font-extrabold text-sky-300 truncate">
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
      <div className={`relative flex-1 min-h-0 flex flex-col ${themeStyle.articleBg}`}>
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
                    onClick={() => setShowBacklog(true)}
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
                ref={vnVerticalViewportRef}
                onWheel={handleWheel}
                className={`flex-1 min-h-0 flex ${
                  prefs.writingMode === 'vertical'
                    ? 'jp-scroll-viewport-vertical px-4 py-2'
                    : 'items-center justify-center overflow-y-auto px-1 sm:px-4'
                }`}
              >
                <div
                  className={`rounded-3xl border p-5 sm:p-8 ${themeStyle.vnCard} ${
                    prefs.writingMode === 'vertical'
                      ? 'h-full min-w-[min(42rem,92vw)] overflow-x-auto'
                      : 'w-full max-w-3xl max-h-full overflow-y-auto'
                  }`}
                >
                  <article
                    ref={articleRef}
                    data-furigana={prefs.furigana}
                    className={`jp-novel-reader-content ${contentFontClass} ${contentDirClass} ${indentClass}`}
                    style={{
                      fontSize: `${prefs.fontSize}px`,
                      lineHeight: prefs.lineHeight,
                    }}
                  >
                    {vnVisibleParagraphs.map((p, idx) => (
                      <div
                        key={`${book.currentChapter}-${vnIndex}-${p.id}`}
                        className={vnAnimClass}
                        style={
                          {
                            '--vn-delay': `${idx * 75}ms`,
                          } as React.CSSProperties
                        }
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
                  className={`jp-novel-reader-content ${contentFontClass} ${contentDirClass} ${widthClass} ${indentClass}`}
                  style={{
                    fontSize: `${prefs.fontSize}px`,
                    lineHeight: prefs.lineHeight,
                  }}
                >
                  {vnVisibleParagraphs.map((p, idx) => {
                    const isNewBatch = idx >= vnIndex;
                    return (
                      <div
                        key={`${book.currentChapter}-stream-${p.id}`}
                        className={isNewBatch ? vnAnimClass : undefined}
                        style={
                          isNewBatch
                            ? ({
                                '--vn-delay': `${Math.max(0, idx - vnIndex) * 70}ms`,
                              } as React.CSSProperties)
                            : undefined
                        }
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
        ) : book && activeChapter ? (
          /* SCROLL / PAGINATED READING VIEWPORT (Horizontal & True Vertical Tategaki) */
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
                ? 'jp-scroll-viewport-vertical px-4 sm:px-10 py-5 sm:py-8'
                : 'overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6 sm:py-10'
            }`}
          >
            <article
              ref={articleRef}
              data-furigana={prefs.furigana}
              className={`jp-novel-reader-content ${contentFontClass} ${contentDirClass} ${widthClass} ${indentClass}`}
              style={{
                fontSize: `${prefs.fontSize}px`,
                lineHeight: prefs.lineHeight,
              }}
              dangerouslySetInnerHTML={{ __html: activeChapter.html }}
            />
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

              {savedBooks.length > 0 && (
                <div className={`rounded-2xl border p-4 space-y-2.5 ${themeStyle.panel}`}>
                  <div className="text-xs font-extrabold uppercase tracking-wider">
                    Novel Tersimpan di Browser Anda ({savedBooks.length})
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {savedBooks.map((sb) => (
                      <button
                        key={sb.storageKey}
                        type="button"
                        onClick={() => {
                          setActiveKey(sb.storageKey);
                          void loadBookByKey(sb.storageKey);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${themeStyle.subtleBtn}`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {sb.title}
                          </div>
                          <div className={`text-[10px] font-mono ${themeStyle.mutedText}`}>
                            Bab {sb.currentChapter + 1}/{sb.chapterCount} •{' '}
                            {sb.totalChars.toLocaleString('id-ID')} huruf
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FLOATING SENTENCE HELPER BAR ON TEXT SELECTION */}
      {selectedSentence && book && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-2xl bg-[#0b121c]/95 border border-sky-400/40 text-white shadow-2xl flex items-center gap-2 max-w-[92vw] backdrop-blur-md">
          <span className="text-xs truncate max-w-[16rem] sm:max-w-xs font-medium text-sky-100">
            「{selectedSentence}」
          </span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(selectedSentence);
              toast.success('Kalimat disalin ke clipboard!');
            }}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Copy className="w-3 h-3" />
            Salin
          </button>
          <a
            href={`https://jisho.org/search/${encodeURIComponent(selectedSentence)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0"
          >
            <Search className="w-3 h-3" />
            Jisho
          </a>
        </div>
      )}

      {/* BOTTOM SLIDE / PAGE & CHAPTER NAVIGATION BAR */}
      {!isFullscreenOrZen &&
        book &&
        activeChapter &&
        prefs.readingMode !== 'vn' && (
          <footer
            className={`shrink-0 px-2.5 sm:px-5 py-2 border-t flex items-center justify-between gap-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${themeStyle.toolbar}`}
          >
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
              }}
              title="Buka Daftar Bab & Bookmark"
              className={`min-w-0 flex-1 text-[11px] font-mono text-center truncate px-2 py-1 rounded-lg hover:bg-white/10 transition cursor-pointer flex items-center justify-center gap-1.5 ${themeStyle.mutedText}`}
            >
              <span className="truncate max-w-[9rem] sm:max-w-xs font-semibold">
                Bab {book.currentChapter + 1}/{book.chapters.length}
              </span>
              <span>•</span>
              {prefs.readingMode === 'paginated' ? (
                <span>
                  Hal {pageInfo.current}/{pageInfo.total}
                </span>
              ) : (
                <span>{scrollPct}%</span>
              )}
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
