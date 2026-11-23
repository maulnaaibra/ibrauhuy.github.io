import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  List,
  Loader2,
  Save,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DEFAULT_READER_PREFS,
  deleteStoredNovelBook,
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
  type ReaderPreferences,
  type StoredNovelBook,
  type StoredNovelSummary,
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
  },
  amoled: {
    shell: 'bg-black text-[#e5e7eb]',
    toolbar: 'bg-[#09090b]/95 border-white/15 text-white',
    panel: 'bg-[#121216] border-white/15 text-white',
    subtleBtn:
      'bg-white/10 hover:bg-white/15 border-white/15 text-neutral-200',
    mutedText: 'text-neutral-400',
    articleBg: 'bg-black text-[#e5e7eb]',
  },
  sepia: {
    shell: 'bg-[#f4ecd8] text-[#3b2f1e]',
    toolbar: 'bg-[#ebe0c6]/95 border-[#d6c6a5] text-[#2e2315]',
    panel: 'bg-[#f8f2e4] border-[#d6c6a5] text-[#2e2315]',
    subtleBtn:
      'bg-[#e6d9bb] hover:bg-[#dccba7] border-[#cbb892] text-[#3b2f1e]',
    mutedText: 'text-[#756248]',
    articleBg: 'bg-[#f4ecd8] text-[#3b2f1e]',
  },
  light: {
    shell: 'bg-[#f8fafc] text-[#0f172a]',
    toolbar: 'bg-white/95 border-slate-200 text-slate-900',
    panel: 'bg-white border-slate-200 text-slate-900',
    subtleBtn:
      'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700',
    mutedText: 'text-slate-500',
    articleBg: 'bg-white text-[#0f172a]',
  },
};

export const JapaneseNovelReaderModal: React.FC<
  JapaneseNovelReaderModalProps
> = ({ target, onClose, onLogReadingSession, onBookLibraryChanged }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  const [activeKey, setActiveKey] = useState(target.storageKey);
  const [book, setBook] = useState<StoredNovelBook | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [importing, setImporting] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);

  const [savedBooks, setSavedBooks] = useState<StoredNovelSummary[]>([]);
  const [prefs, setPrefs] = useState<ReaderPreferences>(loadReaderPrefs);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [selectedSentence, setSelectedSentence] = useState('');

  const [yatsuLinks, setYatsuLinks] = useState<Record<string, string>>(
    loadYatsuBookLinks
  );
  const [yatsuInput, setYatsuInput] = useState(
    () => loadYatsuBookLinks()[target.storageKey] ?? ''
  );

  const loadBookByKey = useCallback(async (key: string) => {
    setLoadingBook(true);
    const [loaded, allSaved] = await Promise.all([
      getStoredNovelBook(key),
      listStoredNovelBooks(),
    ]);
    setBook(loaded);
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

  const computeScrollRatio = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return 0;
    if (prefs.writingMode === 'vertical') {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return 0;
      const scrolled = Math.abs(el.scrollLeft);
      return Math.min(1, Math.max(0, scrolled / maxScroll));
    }
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return 0;
    return Math.min(1, Math.max(0, el.scrollTop / maxScroll));
  }, [prefs.writingMode]);

  const persistCurrentProgress = useCallback(
    async (explicitRatio?: number) => {
      if (!book) return;
      const ratio = explicitRatio ?? computeScrollRatio();
      await updateStoredNovelProgress(book.storageKey, book.currentChapter, ratio);
    },
    [book, computeScrollRatio]
  );

  const handleCloseReader = useCallback(async () => {
    await persistCurrentProgress();
    onClose();
  }, [persistCurrentProgress, onClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showSettings) {
          setShowSettings(false);
        } else if (showToc) {
          setShowToc(false);
        } else {
          void handleCloseReader();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSettings, showToc, handleCloseReader]);

  // Restore chapter scroll ratio cleanly when chapter changes or book loads
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !book) return;
    const raf = window.requestAnimationFrame(() => {
      const ratio = book.scrollRatio || 0;
      if (prefs.writingMode === 'vertical') {
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        el.scrollLeft = ratio > 0 ? -(maxScroll * ratio) : 0;
      } else {
        const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTop = Math.round(maxScroll * ratio);
      }
      setScrollPct(Math.round(ratio * 100));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [book?.storageKey, book?.currentChapter, prefs.writingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePrefs = (patch: Partial<ReaderPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveReaderPrefs(next);
      return next;
    });
  };

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

  const handleSwitchChapter = (nextIdx: number) => {
    if (!book) return;
    const clamped = Math.max(0, Math.min(book.chapters.length - 1, nextIdx));
    const updated: StoredNovelBook = {
      ...book,
      currentChapter: clamped,
      scrollRatio: 0,
      updatedAt: Date.now(),
    };
    setBook(updated);
    setShowToc(false);
    setSelectedSentence('');
    void saveStoredNovelBook(updated);
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
    setScrollPct(0);
  };

  const handleScroll = () => {
    const ratio = computeScrollRatio();
    setScrollPct(Math.round(ratio * 100));
    if (!book) return;
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
    }
    progressTimerRef.current = window.setTimeout(() => {
      void updateStoredNovelProgress(book.storageKey, book.currentChapter, ratio);
    }, 350);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (prefs.writingMode !== 'vertical') return;
    const el = scrollContainerRef.current;
    if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    el.scrollLeft -= e.deltaY;
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
    onBookLibraryChanged?.();
    toast.success('Buku dihapus dari penyimpanan browser.');
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
  const activeChapter = book
    ? book.chapters[
        Math.min(book.chapters.length - 1, Math.max(0, book.currentChapter))
      ]
    : null;
  const directYatsuUrl = resolveYatsuUrl(activeKey, yatsuLinks);
  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${themeStyle.shell}`}
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
        <div className="fixed inset-0 z-[70] bg-sky-500/20 backdrop-blur-sm border-4 border-dashed border-sky-400 flex items-center justify-center pointer-events-none">
          <div className="px-6 py-4 rounded-2xl bg-[#0b121c]/95 text-white font-bold text-sm shadow-2xl border border-sky-400/50">
            Lepaskan file .EPUB / .TXT di sini untuk langsung membaca
          </div>
        </div>
      )}

      {/* TOP TOOLBAR */}
      <header
        className={`shrink-0 px-3 sm:px-5 py-2.5 border-b backdrop-blur-md flex items-center justify-between gap-2 z-20 pt-[max(0.625rem,env(safe-area-inset-top))] ${themeStyle.toolbar}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => void handleCloseReader()}
            className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 ${themeStyle.subtleBtn}`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Tutup</span>
          </button>

          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold truncate flex items-center gap-1.5">
              <span className="truncate">{book?.title || target.title}</span>
            </div>
            <div className={`text-[11px] flex items-center gap-2 ${themeStyle.mutedText}`}>
              {book ? (
                <span>
                  Bab {book.currentChapter + 1}/{book.chapters.length} •{' '}
                  {book.totalChars.toLocaleString('id-ID')} huruf
                </span>
              ) : (
                <span>Reader DOM Native • Yomitan Ready</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {book && (
            <>
              <button
                type="button"
                onClick={handleLogCurrentSession}
                title="Catat durasi baca saat ini ke Immersion Log"
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-xs font-mono font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{formatElapsed(elapsedSec)}</span>
                <Save className="w-3.5 h-3.5 hidden sm:inline shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowToc((prev) => !prev);
                  setShowSettings(false);
                }}
                title="Daftar Bab"
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${themeStyle.subtleBtn}`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bab</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Pilih / Ganti file EPUB atau TXT"
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${themeStyle.subtleBtn}`}
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">
              {book ? 'Ganti EPUB' : 'Pilih EPUB'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowSettings((prev) => !prev);
              setShowToc(false);
            }}
            title="Pengaturan Tampilan & Furigana"
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${themeStyle.subtleBtn}`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tampilan</span>
          </button>

          <a
            href={directYatsuUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka di Yatsu Reader"
            className="btn-crimson px-3 py-1.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Yatsu</span>
          </a>
        </div>
      </header>

      {/* SETTINGS POPOVER */}
      {showSettings && (
        <div
          className={`fixed top-14 right-3 sm:right-5 z-40 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border p-4 shadow-2xl space-y-4 animate-scale-in ${themeStyle.panel}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Pengaturan Reader
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
              Arah Baca
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'horizontal', label: 'Horizontal' },
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

          <div className="space-y-1.5">
            <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
              Furigana (ルビ)
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className={`font-bold ${themeStyle.mutedText}`}>
                Ukuran Huruf
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

      {/* TOC SLIDE-OVER DRAWER */}
      {showToc && book && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/45"
            onClick={() => setShowToc(false)}
          />
          <aside
            className={`fixed top-12 bottom-0 left-0 z-40 w-80 max-w-[85vw] border-r p-4 flex flex-col gap-3 shadow-2xl ${themeStyle.panel}`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wider">
                  Daftar Bab ({book.chapters.length})
                </div>
                <div className={`text-[11px] truncate ${themeStyle.mutedText}`}>
                  {book.title}
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
          </aside>
        </>
      )}

      {/* MAIN BODY */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onMouseUp={handleMouseOrKeySelection}
        onKeyUp={handleMouseOrKeySelection}
        className={`flex-1 min-h-0 ${
          book && prefs.writingMode === 'vertical'
            ? 'overflow-x-auto overflow-y-hidden px-6 py-4'
            : 'overflow-y-auto px-4 sm:px-8 py-6 sm:py-10'
        } ${themeStyle.articleBg}`}
      >
        {loadingBook ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm font-semibold opacity-75">
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
              <span>Memuat novel dari penyimpanan browser...</span>
            </div>
          </div>
        ) : book && activeChapter ? (
          <article
            ref={articleRef}
            data-furigana={prefs.furigana}
            className={`jp-novel-reader-content ${
              prefs.fontFamily === 'serif' ? 'jp-font-serif' : 'jp-font-sans'
            } ${
              prefs.writingMode === 'vertical'
                ? 'jp-writing-vertical'
                : 'jp-writing-horizontal'
            }`}
            style={{ fontSize: `${prefs.fontSize}px` }}
            dangerouslySetInnerHTML={{ __html: activeChapter.html }}
          />
        ) : (
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
                  Berbeda dengan <em>reader.epub.moe</em> yang terkunci di dalam
                  iframe/Shadow DOM, Reader bawaan ini merender teks langsung ke
                  halaman web sehingga <strong>Yomitan</strong> bisa langsung
                  scan kata &amp; membuat kartu kalimat Anki (<em>sentence mining</em>).
                </p>
              </div>

              {/* 2-step quick onboarding */}
              <div className="grid sm:grid-cols-2 gap-3 text-left pt-1">
                {target.downloadUrl && (
                  <a
                    href={target.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-4 rounded-xl border transition flex flex-col justify-between gap-2 ${themeStyle.subtleBtn}`}
                  >
                    <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                      Langkah 1 (Jika belum punya file)
                    </div>
                    <div className="font-extrabold text-sm flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>Unduh File .EPUB</span>
                    </div>
                    <p className={`text-[11px] ${themeStyle.mutedText}`}>
                      Simpan file .epub dari Epub.moe ke perangkat Anda (cukup
                      sekali).
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

              {target.volumes && target.volumes.length > 1 && (
                <div className="pt-2 border-t border-white/10 text-left space-y-2">
                  <div className={`text-[11px] font-bold ${themeStyle.mutedText}`}>
                    Unduh Volume Lainnya (.EPUB):
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {target.volumes.map((v, i) => (
                      <a
                        key={v.md5}
                        href={`https://epub.moe/books/${v.md5}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
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

      {/* BOTTOM CHAPTER NAVIGATION BAR */}
      {book && activeChapter && (
        <footer
          className={`shrink-0 px-3 sm:px-5 py-2 border-t flex items-center justify-between gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${themeStyle.toolbar}`}
        >
          <button
            type="button"
            disabled={book.currentChapter <= 0}
            onClick={() => handleSwitchChapter(book.currentChapter - 1)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer ${themeStyle.subtleBtn}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Bab Sebelumnya</span>
          </button>

          <div className={`text-[11px] font-mono text-center truncate px-2 ${themeStyle.mutedText}`}>
            <span>{activeChapter.title}</span>
            <span className="mx-1.5">•</span>
            <span>{scrollPct}%</span>
          </div>

          <button
            type="button"
            disabled={book.currentChapter >= book.chapters.length - 1}
            onClick={() => handleSwitchChapter(book.currentChapter + 1)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer ${themeStyle.subtleBtn}`}
          >
            <span>Bab Berikutnya</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </footer>
      )}
    </div>
  );
};
