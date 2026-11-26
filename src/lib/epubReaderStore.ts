import JSZip from 'jszip';

export interface StoredNovelChapter {
  id: string;
  title: string;
  html: string;
  charCount: number;
}

export interface NovelBookmark {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  scrollRatio: number;
  vnIndex?: number;
  excerpt: string;
  createdAt: number;
}

export interface ChapterParagraphBlock {
  id: string;
  html: string;
  text: string;
  charCount: number;
  isMediaOnly: boolean;
}

export interface StoredNovelBook {
  storageKey: string;
  catalogItemId?: string;
  title: string;
  author?: string;
  fileName: string;
  coverDataUrl?: string;
  chapters: StoredNovelChapter[];
  totalChars: number;
  currentChapter: number;
  scrollRatio: number;
  vnIndex?: number;
  bookmarks?: NovelBookmark[];
  updatedAt: number;
}

export type StoredNovelSummary = Omit<StoredNovelBook, 'chapters'> & {
  chapterCount: number;
  bookmarkCount: number;
  currentChapterTitle?: string;
};

export interface NovelProgressSnapshot {
  storageKey: string;
  catalogItemId?: string;
  title: string;
  author?: string;
  fileName: string;
  totalChars: number;
  chapterCount: number;
  currentChapter: number;
  scrollRatio: number;
  vnIndex: number;
  bookmarks: NovelBookmark[];
  updatedAt: number;
}

export type ReaderMode = 'scroll' | 'paginated' | 'vn';
export type VnAnimationStyle =
  | 'fade-up'
  | 'typewriter'
  | 'slide'
  | 'blur-in'
  | 'none';
export type VnDisplayStyle = 'card' | 'stream';
export type ReaderBgMode = 'none' | 'app' | 'custom' | 'slideshow';
export type ReaderBgPosition = 'top' | 'center' | 'bottom';
export type ReaderBgMediaKind =
  | 'none'
  | 'image'
  | 'video'
  | 'youtube'
  | 'local-video';
export type ReaderTextColorMode = 'off' | 'vocab' | 'pos' | 'pitch';
export type ReaderWordClickAction = 'popover' | 'cycle' | 'off';

export interface VocabColorPalette {
  new: string;
  learning: string;
  due: string;
  known: string;
  ignored: string;
  particle: string;
}

export interface PosColorPalette {
  noun: string;
  verb: string;
  adj: string;
  particle: string;
  adverb: string;
  other: string;
}

export interface PitchColorPalette {
  heiban: string;
  atamadaka: string;
  nakadaka: string;
  odaka: string;
  unknown: string;
}

export const DEFAULT_VOCAB_COLORS: VocabColorPalette = {
  new: '#74d4b7',
  learning: '#797ab5',
  due: '#d9684e',
  known: '',
  ignored: '#8b949e',
  particle: '#797ab5',
};

export const DEFAULT_POS_COLORS: PosColorPalette = {
  noun: '#d9684e',
  verb: '#74d4b7',
  adj: '#f0b35e',
  particle: '#797ab5',
  adverb: '#c58be6',
  other: '',
};

export const DEFAULT_PITCH_COLORS: PitchColorPalette = {
  heiban: '#5cb8ff',
  atamadaka: '#e06c58',
  nakadaka: '#f0aa4f',
  odaka: '#63cfa5',
  unknown: '',
};

export const READER_WORD_COLOR_PRESETS: Array<{
  id: string;
  label: string;
  desc: string;
  vocabColors: VocabColorPalette;
  posColors: PosColorPalette;
  pitchColors: PitchColorPalette;
}> = [
  {
    id: 'screenshot-matte',
    label: 'Matte Studio (Contoh)',
    desc: 'Mint teal, lavender, & coral lembut di background gelap',
    vocabColors: DEFAULT_VOCAB_COLORS,
    posColors: DEFAULT_POS_COLORS,
    pitchColors: DEFAULT_PITCH_COLORS,
  },
  {
    id: 'migaku-vivid',
    label: 'Vivid Cerah',
    desc: 'Warna kontras tinggi jelas untuk semua mode',
    vocabColors: {
      new: '#38bdf8',
      learning: '#f59e0b',
      due: '#f43f5e',
      known: '',
      ignored: '#64748b',
      particle: '#818cf8',
    },
    posColors: {
      noun: '#fb7185',
      verb: '#34d399',
      adj: '#fbbf24',
      particle: '#818cf8',
      adverb: '#c084fc',
      other: '',
    },
    pitchColors: {
      heiban: '#38bdf8',
      atamadaka: '#fb7185',
      nakadaka: '#fbbf24',
      odaka: '#34d399',
      unknown: '',
    },
  },
  {
    id: 'sepia-ink',
    label: 'Kertas Sepia / Terang',
    desc: 'Kontras tinta dalam agar jelas di tema Sepia & Terang',
    vocabColors: {
      new: '#0f766e',
      learning: '#4338ca',
      due: '#b91c1c',
      known: '',
      ignored: '#78716c',
      particle: '#6366f1',
    },
    posColors: {
      noun: '#b91c1c',
      verb: '#0f766e',
      adj: '#b45309',
      particle: '#4338ca',
      adverb: '#7e22ce',
      other: '',
    },
    pitchColors: {
      heiban: '#0369a1',
      atamadaka: '#b91c1c',
      nakadaka: '#c2410c',
      odaka: '#047857',
      unknown: '',
    },
  },
];

export interface ParsedReaderBgMedia {
  kind: ReaderBgMediaKind;
  url: string;
  youtubeId?: string;
}

export const READER_BG_VIDEO_SENTINEL = 'idb:reader-bg-video';

export interface ReaderPreferences {
  readingMode: ReaderMode;
  writingMode: 'horizontal' | 'vertical';
  furigana: 'show' | 'hover' | 'hide';
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  theme: 'slate' | 'navy' | 'charcoal' | 'amoled' | 'sepia' | 'light';
  lineHeight: number;
  letterSpacing: number;
  maxWidth: 'narrow' | 'medium' | 'wide' | 'full' | 'custom';
  customMaxWidthPx: number;
  paragraphSpacing: number;
  cleanMode: boolean;
  indentParagraphs: boolean;
  vnParagraphsPerStep: number;
  vnAnimation: VnAnimationStyle;
  vnAnimationDurationMs: number;
  vnDisplayStyle: VnDisplayStyle;
  bgMode: ReaderBgMode;
  bgImageUrl: string;
  bgBlur: number;
  bgOpacity: number;
  bgPanelOpacity: number;
  bgPosition: ReaderBgPosition;
  bgVideoMuted: boolean;
  bgVideoVolume: number;
  bgSlideshowIntervalSec: number;
  bgSlideshowShuffle: boolean;
  bgSlideshowTransitionMs: number;
  textColorMode: ReaderTextColorMode;
  wordClickAction: ReaderWordClickAction;
  colorParticlesInVocab: boolean;
  hideKnownFurigana: boolean;
  showSpeedHud: boolean;
  vocabColors: VocabColorPalette;
  posColors: PosColorPalette;
  pitchColors: PitchColorPalette;
}

export const DEFAULT_READER_PREFS: ReaderPreferences = {
  readingMode: 'scroll',
  writingMode: 'horizontal',
  furigana: 'show',
  fontSize: 20,
  fontWeight: 400,
  fontFamily: 'serif',
  theme: 'navy',
  lineHeight: 1.95,
  letterSpacing: 0,
  maxWidth: 'medium',
  customMaxWidthPx: 1040,
  paragraphSpacing: 0.45,
  cleanMode: false,
  indentParagraphs: true,
  vnParagraphsPerStep: 2,
  vnAnimation: 'fade-up',
  vnAnimationDurationMs: 380,
  vnDisplayStyle: 'card',
  bgMode: 'none',
  bgImageUrl: '',
  bgBlur: 4,
  bgOpacity: 45,
  bgPanelOpacity: 72,
  bgPosition: 'center',
  bgVideoMuted: true,
  bgVideoVolume: 100,
  bgSlideshowIntervalSec: 12,
  bgSlideshowShuffle: false,
  bgSlideshowTransitionMs: 1000,
  textColorMode: 'off',
  wordClickAction: 'popover',
  colorParticlesInVocab: true,
  hideKnownFurigana: false,
  showSpeedHud: false,
  vocabColors: DEFAULT_VOCAB_COLORS,
  posColors: DEFAULT_POS_COLORS,
  pitchColors: DEFAULT_PITCH_COLORS,
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeReaderColorHex(value: unknown, fallback: string): string {
  if (value === '') return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return '';
    if (HEX_COLOR_RE.test(trimmed)) return trimmed.toLowerCase();
  }
  return fallback;
}

const READER_PREFS_STORAGE_KEY = 'immersiontrack_reader_prefs_v1';
const YATSU_LINKS_STORAGE_KEY = 'immersiontrack_yatsu_links_v1';
const NOVEL_PROGRESS_MIRROR_KEY = 'immersiontrack_novel_progress_mirror_v1';
const LAST_OPENED_NOVEL_KEY = 'immersiontrack_last_novel_key_v1';
const YATSU_DEFAULT_LIBRARY_URL = 'https://app.yatsu.moe/library';

const DB_NAME = 'immersiontrack_novel_reader_db';
const DB_VERSION = 1;
const STORE_NAME = 'books';

export function loadReaderPrefs(): ReaderPreferences {
  try {
    const raw = localStorage.getItem(READER_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
      const readingMode: ReaderMode =
        parsed.readingMode === 'paginated' || parsed.readingMode === 'vn'
          ? parsed.readingMode
          : 'scroll';
      const writingMode =
        parsed.writingMode === 'vertical' ? 'vertical' : 'horizontal';
      const furigana =
        parsed.furigana === 'hover' || parsed.furigana === 'hide'
          ? parsed.furigana
          : 'show';
      const fontSize =
        typeof parsed.fontSize === 'number' && Number.isFinite(parsed.fontSize)
          ? Math.min(34, Math.max(16, Math.round(parsed.fontSize)))
          : DEFAULT_READER_PREFS.fontSize;
      const fontWeight =
        typeof parsed.fontWeight === 'number' &&
        Number.isFinite(parsed.fontWeight)
          ? Math.min(800, Math.max(200, Math.round(parsed.fontWeight / 50) * 50))
          : DEFAULT_READER_PREFS.fontWeight;
      const fontFamily =
        typeof parsed.fontFamily === 'string' && parsed.fontFamily.trim()
          ? parsed.fontFamily.trim()
          : DEFAULT_READER_PREFS.fontFamily;
      const theme =
        parsed.theme === 'slate' ||
        parsed.theme === 'charcoal' ||
        parsed.theme === 'amoled' ||
        parsed.theme === 'sepia' ||
        parsed.theme === 'light'
          ? parsed.theme
          : 'navy';
      const lineHeight =
        typeof parsed.lineHeight === 'number' &&
        Number.isFinite(parsed.lineHeight)
          ? Math.min(2.4, Math.max(1.35, Math.round(parsed.lineHeight * 20) / 20))
          : DEFAULT_READER_PREFS.lineHeight;
      const letterSpacing =
        typeof parsed.letterSpacing === 'number' &&
        Number.isFinite(parsed.letterSpacing)
          ? Math.min(0.3, Math.max(-0.02, Math.round(parsed.letterSpacing * 100) / 100))
          : DEFAULT_READER_PREFS.letterSpacing;
      const maxWidth: ReaderPreferences['maxWidth'] =
        parsed.maxWidth === 'narrow' ||
        parsed.maxWidth === 'wide' ||
        parsed.maxWidth === 'full' ||
        parsed.maxWidth === 'custom'
          ? parsed.maxWidth
          : 'medium';
      const customMaxWidthPx =
        typeof parsed.customMaxWidthPx === 'number' &&
        Number.isFinite(parsed.customMaxWidthPx)
          ? Math.min(1600, Math.max(480, Math.round(parsed.customMaxWidthPx)))
          : DEFAULT_READER_PREFS.customMaxWidthPx;
      const paragraphSpacing =
        typeof parsed.paragraphSpacing === 'number' &&
        Number.isFinite(parsed.paragraphSpacing)
          ? Math.min(
              1.2,
              Math.max(0, Math.round(parsed.paragraphSpacing * 100) / 100)
            )
          : DEFAULT_READER_PREFS.paragraphSpacing;
      const cleanMode =
        typeof parsed.cleanMode === 'boolean'
          ? parsed.cleanMode
          : DEFAULT_READER_PREFS.cleanMode;
      const indentParagraphs =
        typeof parsed.indentParagraphs === 'boolean'
          ? parsed.indentParagraphs
          : DEFAULT_READER_PREFS.indentParagraphs;
      const vnParagraphsPerStep =
        typeof parsed.vnParagraphsPerStep === 'number' &&
        Number.isFinite(parsed.vnParagraphsPerStep)
          ? Math.min(8, Math.max(1, Math.round(parsed.vnParagraphsPerStep)))
          : DEFAULT_READER_PREFS.vnParagraphsPerStep;
      const vnAnimation: VnAnimationStyle =
        parsed.vnAnimation === 'typewriter' ||
        parsed.vnAnimation === 'slide' ||
        parsed.vnAnimation === 'blur-in' ||
        parsed.vnAnimation === 'none'
          ? parsed.vnAnimation
          : 'fade-up';
      const vnAnimationDurationMs =
        typeof parsed.vnAnimationDurationMs === 'number' &&
        Number.isFinite(parsed.vnAnimationDurationMs)
          ? Math.min(2000, Math.max(100, Math.round(parsed.vnAnimationDurationMs)))
          : DEFAULT_READER_PREFS.vnAnimationDurationMs;
      const vnDisplayStyle: VnDisplayStyle =
        parsed.vnDisplayStyle === 'stream' ? 'stream' : 'card';
      const bgMode: ReaderBgMode =
        parsed.bgMode === 'app' ||
        parsed.bgMode === 'custom' ||
        parsed.bgMode === 'slideshow'
          ? parsed.bgMode
          : 'none';
      const bgImageUrl =
        typeof parsed.bgImageUrl === 'string' ? parsed.bgImageUrl : '';
      const bgBlur =
        typeof parsed.bgBlur === 'number' && Number.isFinite(parsed.bgBlur)
          ? Math.min(28, Math.max(0, Math.round(parsed.bgBlur)))
          : DEFAULT_READER_PREFS.bgBlur;
      const bgOpacity =
        typeof parsed.bgOpacity === 'number' && Number.isFinite(parsed.bgOpacity)
          ? Math.min(100, Math.max(0, Math.round(parsed.bgOpacity)))
          : DEFAULT_READER_PREFS.bgOpacity;
      const bgPanelOpacity =
        typeof parsed.bgPanelOpacity === 'number' &&
        Number.isFinite(parsed.bgPanelOpacity)
          ? Math.min(95, Math.max(0, Math.round(parsed.bgPanelOpacity)))
          : DEFAULT_READER_PREFS.bgPanelOpacity;
      const bgPosition: ReaderBgPosition =
        parsed.bgPosition === 'top' || parsed.bgPosition === 'bottom'
          ? parsed.bgPosition
          : 'center';
      const bgVideoMuted =
        typeof parsed.bgVideoMuted === 'boolean'
          ? parsed.bgVideoMuted
          : DEFAULT_READER_PREFS.bgVideoMuted;
      const bgVideoVolume =
        typeof parsed.bgVideoVolume === 'number' &&
        Number.isFinite(parsed.bgVideoVolume)
          ? Math.min(300, Math.max(0, Math.round(parsed.bgVideoVolume)))
          : DEFAULT_READER_PREFS.bgVideoVolume;
      const bgSlideshowIntervalSec =
        typeof parsed.bgSlideshowIntervalSec === 'number' &&
        Number.isFinite(parsed.bgSlideshowIntervalSec)
          ? Math.min(
              3600,
              Math.max(2, Math.round(parsed.bgSlideshowIntervalSec))
            )
          : DEFAULT_READER_PREFS.bgSlideshowIntervalSec;
      const bgSlideshowShuffle =
        typeof parsed.bgSlideshowShuffle === 'boolean'
          ? parsed.bgSlideshowShuffle
          : DEFAULT_READER_PREFS.bgSlideshowShuffle;
      const bgSlideshowTransitionMs =
        typeof parsed.bgSlideshowTransitionMs === 'number' &&
        Number.isFinite(parsed.bgSlideshowTransitionMs)
          ? Math.min(
              3000,
              Math.max(0, Math.round(parsed.bgSlideshowTransitionMs))
            )
          : DEFAULT_READER_PREFS.bgSlideshowTransitionMs;
      const textColorMode: ReaderTextColorMode =
        parsed.textColorMode === 'vocab' ||
        parsed.textColorMode === 'pos' ||
        parsed.textColorMode === 'pitch'
          ? parsed.textColorMode
          : 'off';
      const wordClickAction: ReaderWordClickAction =
        parsed.wordClickAction === 'cycle' || parsed.wordClickAction === 'off'
          ? parsed.wordClickAction
          : 'popover';
      const colorParticlesInVocab =
        typeof parsed.colorParticlesInVocab === 'boolean'
          ? parsed.colorParticlesInVocab
          : DEFAULT_READER_PREFS.colorParticlesInVocab;
      const hideKnownFurigana =
        typeof parsed.hideKnownFurigana === 'boolean'
          ? parsed.hideKnownFurigana
          : DEFAULT_READER_PREFS.hideKnownFurigana;
      const showSpeedHud =
        typeof parsed.showSpeedHud === 'boolean'
          ? parsed.showSpeedHud
          : DEFAULT_READER_PREFS.showSpeedHud;
      const rawVocabColors = parsed.vocabColors as
        | Partial<VocabColorPalette>
        | undefined;
      const vocabColors: VocabColorPalette = {
        new: sanitizeReaderColorHex(rawVocabColors?.new, DEFAULT_VOCAB_COLORS.new),
        learning: sanitizeReaderColorHex(
          rawVocabColors?.learning,
          DEFAULT_VOCAB_COLORS.learning
        ),
        due: sanitizeReaderColorHex(rawVocabColors?.due, DEFAULT_VOCAB_COLORS.due),
        known: sanitizeReaderColorHex(
          rawVocabColors?.known,
          DEFAULT_VOCAB_COLORS.known
        ),
        ignored: sanitizeReaderColorHex(
          rawVocabColors?.ignored,
          DEFAULT_VOCAB_COLORS.ignored
        ),
        particle: sanitizeReaderColorHex(
          rawVocabColors?.particle,
          DEFAULT_VOCAB_COLORS.particle
        ),
      };
      const rawPosColors = parsed.posColors as
        | Partial<PosColorPalette>
        | undefined;
      const posColors: PosColorPalette = {
        noun: sanitizeReaderColorHex(rawPosColors?.noun, DEFAULT_POS_COLORS.noun),
        verb: sanitizeReaderColorHex(rawPosColors?.verb, DEFAULT_POS_COLORS.verb),
        adj: sanitizeReaderColorHex(rawPosColors?.adj, DEFAULT_POS_COLORS.adj),
        particle: sanitizeReaderColorHex(
          rawPosColors?.particle,
          DEFAULT_POS_COLORS.particle
        ),
        adverb: sanitizeReaderColorHex(
          rawPosColors?.adverb,
          DEFAULT_POS_COLORS.adverb
        ),
        other: sanitizeReaderColorHex(
          rawPosColors?.other,
          DEFAULT_POS_COLORS.other
        ),
      };
      const rawPitchColors = parsed.pitchColors as
        | Partial<PitchColorPalette>
        | undefined;
      const pitchColors: PitchColorPalette = {
        heiban: sanitizeReaderColorHex(
          rawPitchColors?.heiban,
          DEFAULT_PITCH_COLORS.heiban
        ),
        atamadaka: sanitizeReaderColorHex(
          rawPitchColors?.atamadaka,
          DEFAULT_PITCH_COLORS.atamadaka
        ),
        nakadaka: sanitizeReaderColorHex(
          rawPitchColors?.nakadaka,
          DEFAULT_PITCH_COLORS.nakadaka
        ),
        odaka: sanitizeReaderColorHex(
          rawPitchColors?.odaka,
          DEFAULT_PITCH_COLORS.odaka
        ),
        unknown: sanitizeReaderColorHex(
          rawPitchColors?.unknown,
          DEFAULT_PITCH_COLORS.unknown
        ),
      };
      return {
        readingMode,
        writingMode,
        furigana,
        fontSize,
        fontWeight,
        fontFamily,
        theme,
        lineHeight,
        letterSpacing,
        maxWidth,
        customMaxWidthPx,
        paragraphSpacing,
        cleanMode,
        indentParagraphs,
        vnParagraphsPerStep,
        vnAnimation,
        vnAnimationDurationMs,
        vnDisplayStyle,
        bgMode,
        bgImageUrl,
        bgBlur,
        bgOpacity,
        bgPanelOpacity,
        bgPosition,
        bgVideoMuted,
        bgVideoVolume,
        bgSlideshowIntervalSec,
        bgSlideshowShuffle,
        bgSlideshowTransitionMs,
        textColorMode,
        wordClickAction,
        colorParticlesInVocab,
        hideKnownFurigana,
        showSpeedHud,
        vocabColors,
        posColors,
        pitchColors,
      };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_READER_PREFS;
}

export function saveReaderPrefs(prefs: ReaderPreferences): boolean {
  try {
    localStorage.setItem(READER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

function extractYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') {
    const first = url.pathname.split('/').filter(Boolean)[0] ?? '';
    return YOUTUBE_ID_PATTERN.test(first) ? first : null;
  }
  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    const vParam = url.searchParams.get('v')?.trim() ?? '';
    if (YOUTUBE_ID_PATTERN.test(vParam)) return vParam;
    const segments = url.pathname.split('/').filter(Boolean);
    if (
      segments.length >= 2 &&
      (segments[0] === 'shorts' ||
        segments[0] === 'live' ||
        segments[0] === 'embed' ||
        segments[0] === 'v') &&
      YOUTUBE_ID_PATTERN.test(segments[1])
    ) {
      return segments[1];
    }
  }
  return null;
}

export function parseReaderBackgroundMedia(rawUrl: string): ParsedReaderBgMedia {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { kind: 'none', url: '' };
  if (trimmed === READER_BG_VIDEO_SENTINEL) {
    return { kind: 'local-video', url: trimmed };
  }
  if (trimmed.startsWith('data:image/')) {
    return { kind: 'image', url: trimmed };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { kind: 'none', url: '' };
    }
    const ytId = extractYouTubeVideoId(parsed);
    if (ytId) {
      return { kind: 'youtube', url: trimmed, youtubeId: ytId };
    }
    if (/\.(mp4|webm|ogg|ogv|m4v|mov)$/i.test(parsed.pathname)) {
      return { kind: 'video', url: trimmed };
    }
    return { kind: 'image', url: trimmed };
  } catch {
    return { kind: 'none', url: '' };
  }
}

export function buildYouTubeBgEmbedUrl(
  videoId: string,
  muted: boolean
): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted ? '1' : '0',
    loop: '1',
    playlist: videoId,
    controls: '0',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
    disablekb: '1',
    fs: '0',
    enablejsapi: '1',
  });
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null'
  ) {
    params.set('origin', window.location.origin);
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

const MEDIA_DB_NAME = 'immersiontrack_reader_media_db';
const MEDIA_STORE_NAME = 'blobs';
const READER_BG_VIDEO_KEY = 'reader_bg_video';

function openReaderMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser tidak mendukung IndexedDB.'));
      return;
    }
    const req = indexedDB.open(MEDIA_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        db.createObjectStore(MEDIA_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error('Gagal membuka database media reader.'));
  });
}

export async function saveReaderBgVideoBlob(blob: Blob): Promise<void> {
  const db = await openReaderMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    tx.objectStore(MEDIA_STORE_NAME).put(blob, READER_BG_VIDEO_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menyimpan video background.'));
    };
  });
}

export async function loadReaderBgVideoBlob(): Promise<Blob | null> {
  try {
    const db = await openReaderMediaDb();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const req = tx.objectStore(MEDIA_STORE_NAME).get(READER_BG_VIDEO_KEY);
      req.onsuccess = () => {
        db.close();
        resolve(req.result instanceof Blob ? req.result : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function deleteReaderBgVideoBlob(): Promise<void> {
  try {
    const db = await openReaderMediaDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
      tx.objectStore(MEDIA_STORE_NAME).delete(READER_BG_VIDEO_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore storage errors
  }
}

// === UNLIMITED BACKGROUND PHOTO SLIDESHOW STORAGE (IndexedDB) ===

export interface StoredReaderBgSlideMeta {
  id: string;
  kind: 'blob' | 'url';
  name: string;
  url?: string;
  addedAt: number;
}

const READER_BG_SLIDESHOW_META_KEY = 'reader_bg_slideshow_meta_v1';
const readerBgSlideKey = (id: string) => `reader_bg_slide:${id}`;

function sanitizeSlideMetas(raw: unknown): StoredReaderBgSlideMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredReaderBgSlideMeta[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<StoredReaderBgSlideMeta>;
    if (typeof rec.id !== 'string' || !rec.id.trim()) continue;
    if (rec.kind !== 'blob' && rec.kind !== 'url') continue;
    if (rec.kind === 'url' && (typeof rec.url !== 'string' || !rec.url.trim())) {
      continue;
    }
    out.push({
      id: rec.id,
      kind: rec.kind,
      name:
        typeof rec.name === 'string' && rec.name.trim()
          ? rec.name.trim().slice(0, 80)
          : 'Foto Background',
      ...(rec.kind === 'url' ? { url: rec.url!.trim() } : {}),
      addedAt:
        typeof rec.addedAt === 'number' && Number.isFinite(rec.addedAt)
          ? rec.addedAt
          : Date.now(),
    });
  }
  return out;
}

export async function loadReaderBgSlideMetas(): Promise<
  StoredReaderBgSlideMeta[]
> {
  try {
    const db = await openReaderMediaDb();
    return await new Promise<StoredReaderBgSlideMeta[]>((resolve) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const req = tx
        .objectStore(MEDIA_STORE_NAME)
        .get(READER_BG_SLIDESHOW_META_KEY);
      req.onsuccess = () => {
        db.close();
        resolve(sanitizeSlideMetas(req.result));
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

export async function loadReaderBgSlideBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openReaderMediaDb();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const req = tx.objectStore(MEDIA_STORE_NAME).get(readerBgSlideKey(id));
      req.onsuccess = () => {
        db.close();
        resolve(req.result instanceof Blob ? req.result : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function addReaderBgSlideFiles(
  files: FileList | File[]
): Promise<{
  slides: StoredReaderBgSlideMeta[];
  addedCount: number;
  skippedCount: number;
}> {
  const list = Array.from(files);
  const validImages = list.filter((f) => f.type.startsWith('image/') && f.size > 0);
  const skippedCount = list.length - validImages.length;
  if (validImages.length === 0) {
    return {
      slides: await loadReaderBgSlideMetas(),
      addedCount: 0,
      skippedCount,
    };
  }

  const existing = await loadReaderBgSlideMetas();
  const baseTs = Date.now();
  const newItems: Array<{ meta: StoredReaderBgSlideMeta; blob: Blob }> =
    validImages.map((file, idx) => {
      const id = `slide-${baseTs}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
      return {
        meta: {
          id,
          kind: 'blob',
          name: file.name || `Foto ${existing.length + idx + 1}`,
          addedAt: baseTs + idx,
        },
        blob: file,
      };
    });

  const nextMetas = [...existing, ...newItems.map((it) => it.meta)];
  const db = await openReaderMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE_NAME);
    for (const item of newItems) {
      store.put(item.blob, readerBgSlideKey(item.meta.id));
    }
    store.put(nextMetas, READER_BG_SLIDESHOW_META_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(
        tx.error ?? new Error('Gagal menyimpan foto slideshow ke browser.')
      );
    };
  });

  return {
    slides: nextMetas,
    addedCount: newItems.length,
    skippedCount,
  };
}

export async function addReaderBgSlideUrl(
  url: string,
  name?: string
): Promise<StoredReaderBgSlideMeta[]> {
  const clean = url.trim();
  if (!clean) return loadReaderBgSlideMetas();
  const existing = await loadReaderBgSlideMetas();
  const baseTs = Date.now();
  const id = `slide-url-${baseTs}-${Math.random().toString(36).slice(2, 7)}`;
  const meta: StoredReaderBgSlideMeta = {
    id,
    kind: 'url',
    name: name?.trim() || `URL #${existing.length + 1}`,
    url: clean,
    addedAt: baseTs,
  };
  const nextMetas = [...existing, meta];
  const db = await openReaderMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    tx.objectStore(MEDIA_STORE_NAME).put(nextMetas, READER_BG_SLIDESHOW_META_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menambahkan link foto slideshow.'));
    };
  });
  return nextMetas;
}

export async function deleteReaderBgSlide(
  id: string
): Promise<StoredReaderBgSlideMeta[]> {
  const existing = await loadReaderBgSlideMetas();
  const target = existing.find((s) => s.id === id);
  const nextMetas = existing.filter((s) => s.id !== id);
  const db = await openReaderMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE_NAME);
    if (target?.kind === 'blob') {
      store.delete(readerBgSlideKey(id));
    }
    store.put(nextMetas, READER_BG_SLIDESHOW_META_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menghapus foto slideshow.'));
    };
  });
  return nextMetas;
}

export async function moveReaderBgSlide(
  id: string,
  direction: -1 | 1
): Promise<StoredReaderBgSlideMeta[]> {
  const existing = await loadReaderBgSlideMetas();
  const idx = existing.findIndex((s) => s.id === id);
  const targetIdx = idx + direction;
  if (idx < 0 || targetIdx < 0 || targetIdx >= existing.length) {
    return existing;
  }
  const nextMetas = [...existing];
  const [removed] = nextMetas.splice(idx, 1);
  nextMetas.splice(targetIdx, 0, removed);

  const db = await openReaderMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    tx.objectStore(MEDIA_STORE_NAME).put(nextMetas, READER_BG_SLIDESHOW_META_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal mengurutkan foto slideshow.'));
    };
  });
  return nextMetas;
}

export async function clearReaderBgSlides(): Promise<StoredReaderBgSlideMeta[]> {
  const existing = await loadReaderBgSlideMetas();
  const db = await openReaderMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE_NAME);
    for (const s of existing) {
      if (s.kind === 'blob') {
        store.delete(readerBgSlideKey(s.id));
      }
    }
    store.put([], READER_BG_SLIDESHOW_META_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal membersihkan foto slideshow.'));
    };
  });
  return [];
}

export function loadYatsuBookLinks(): Record<string, string> {
  try {
    const raw = localStorage.getItem(YATSU_LINKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim()) {
            clean[k] = v.trim();
          }
        }
        return clean;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

export function normalizeYatsuUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.hostname.endsWith('yatsu.moe')) {
        return u.toString();
      }
    } catch {
      return null;
    }
    return null;
  }
  if (/^b\?id=/i.test(trimmed)) {
    return `https://app.yatsu.moe/${trimmed}`;
  }
  if (/^[a-zA-Z0-9_-]{3,128}$/.test(trimmed)) {
    return `https://app.yatsu.moe/b?id=${encodeURIComponent(trimmed)}`;
  }
  return null;
}

export function saveYatsuBookLink(
  key: string,
  url: string
): Record<string, string> {
  const current = loadYatsuBookLinks();
  const next = { ...current, [key]: url };
  try {
    localStorage.setItem(YATSU_LINKS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function removeYatsuBookLink(key: string): Record<string, string> {
  const current = loadYatsuBookLinks();
  const next = { ...current };
  delete next[key];
  try {
    localStorage.setItem(YATSU_LINKS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function resolveYatsuUrl(
  key: string,
  links: Record<string, string>
): string {
  return links[key] || YATSU_DEFAULT_LIBRARY_URL;
}

export function saveAllYatsuBookLinks(
  links: Record<string, string>
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(links)) {
    if (typeof v === 'string' && v.trim()) {
      clean[k] = v.trim();
    }
  }
  try {
    localStorage.setItem(YATSU_LINKS_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // ignore quota errors
  }
  return clean;
}

export function makeLibraryStorageKey(fileName: string, title?: string): string {
  const source = (fileName || title || 'novel').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const slug = source
    .replace(/\.(epub|txt|html?|xhtml)$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28);
  const hex = (hash >>> 0).toString(36);
  return `library:${slug ? `${slug}-` : ''}${hex}`;
}

export function getLastOpenedNovelKey(): string {
  try {
    return localStorage.getItem(LAST_OPENED_NOVEL_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function setLastOpenedNovelKey(storageKey: string): void {
  try {
    if (storageKey.trim()) {
      localStorage.setItem(LAST_OPENED_NOVEL_KEY, storageKey.trim());
    } else {
      localStorage.removeItem(LAST_OPENED_NOVEL_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

let persistRequestInFlight: Promise<boolean> | null = null;

export async function requestPersistentLibraryStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return false;
  }
  try {
    if (navigator.storage.persisted) {
      const already = await navigator.storage.persisted();
      if (already) return true;
    }
    if (navigator.storage.persist) {
      if (!persistRequestInFlight) {
        persistRequestInFlight = navigator.storage
          .persist()
          .catch(() => false);
      }
      return await persistRequestInFlight;
    }
  } catch {
    // ignore browser restrictions
  }
  return false;
}

export async function getLibraryStorageInfo(): Promise<{
  persisted: boolean;
  usageMb: number | null;
  quotaMb: number | null;
}> {
  let persisted = false;
  let usageMb: number | null = null;
  let quotaMb: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (typeof est.usage === 'number') {
          usageMb = Number((est.usage / (1024 * 1024)).toFixed(1));
        }
        if (typeof est.quota === 'number') {
          quotaMb = Number((est.quota / (1024 * 1024)).toFixed(0));
        }
      }
    } catch {
      // ignore estimate errors
    }
  }
  return { persisted, usageMb, quotaMb };
}

function sanitizeMirrorBookmarks(raw: unknown): NovelBookmark[] {
  if (!Array.isArray(raw)) return [];
  const clean: NovelBookmark[] = [];
  for (const item of raw.slice(0, 80)) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Partial<NovelBookmark>;
    if (typeof b.id !== 'string' || typeof b.chapterIndex !== 'number') continue;
    clean.push({
      id: b.id,
      chapterIndex: Math.max(0, Math.round(b.chapterIndex)),
      chapterTitle:
        typeof b.chapterTitle === 'string' ? b.chapterTitle.slice(0, 120) : '',
      scrollRatio:
        typeof b.scrollRatio === 'number' && Number.isFinite(b.scrollRatio)
          ? Math.min(1, Math.max(0, b.scrollRatio))
          : 0,
      vnIndex:
        typeof b.vnIndex === 'number' && Number.isFinite(b.vnIndex)
          ? Math.max(0, Math.round(b.vnIndex))
          : 0,
      excerpt: typeof b.excerpt === 'string' ? b.excerpt.slice(0, 140) : '',
      createdAt:
        typeof b.createdAt === 'number' && Number.isFinite(b.createdAt)
          ? b.createdAt
          : Date.now(),
    });
  }
  return clean;
}

export function loadNovelProgressMirror(): Record<string, NovelProgressSnapshot> {
  try {
    const raw = localStorage.getItem(NOVEL_PROGRESS_MIRROR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const clean: Record<string, NovelProgressSnapshot> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (!val || typeof val !== 'object') continue;
      const snap = val as Partial<NovelProgressSnapshot>;
      if (typeof snap.title !== 'string') continue;
      clean[key] = {
        storageKey:
          typeof snap.storageKey === 'string' && snap.storageKey
            ? snap.storageKey
            : key,
        catalogItemId:
          typeof snap.catalogItemId === 'string'
            ? snap.catalogItemId
            : undefined,
        title: snap.title,
        author: typeof snap.author === 'string' ? snap.author : undefined,
        fileName: typeof snap.fileName === 'string' ? snap.fileName : '',
        totalChars:
          typeof snap.totalChars === 'number' && Number.isFinite(snap.totalChars)
            ? Math.max(0, Math.round(snap.totalChars))
            : 0,
        chapterCount:
          typeof snap.chapterCount === 'number' &&
          Number.isFinite(snap.chapterCount)
            ? Math.max(0, Math.round(snap.chapterCount))
            : 0,
        currentChapter:
          typeof snap.currentChapter === 'number' &&
          Number.isFinite(snap.currentChapter)
            ? Math.max(0, Math.round(snap.currentChapter))
            : 0,
        scrollRatio:
          typeof snap.scrollRatio === 'number' &&
          Number.isFinite(snap.scrollRatio)
            ? Math.min(1, Math.max(0, snap.scrollRatio))
            : 0,
        vnIndex:
          typeof snap.vnIndex === 'number' && Number.isFinite(snap.vnIndex)
            ? Math.max(0, Math.round(snap.vnIndex))
            : 0,
        bookmarks: sanitizeMirrorBookmarks(snap.bookmarks),
        updatedAt:
          typeof snap.updatedAt === 'number' && Number.isFinite(snap.updatedAt)
            ? snap.updatedAt
            : 0,
      };
    }
    return clean;
  } catch {
    return {};
  }
}

function writeNovelProgressMirror(
  mirror: Record<string, NovelProgressSnapshot>
): void {
  try {
    localStorage.setItem(NOVEL_PROGRESS_MIRROR_KEY, JSON.stringify(mirror));
  } catch {
    // ignore storage quota errors
  }
}

export function saveNovelProgressSync(snapshot: NovelProgressSnapshot): void {
  const mirror = loadNovelProgressMirror();
  const existing = mirror[snapshot.storageKey];
  if (existing && existing.updatedAt > snapshot.updatedAt) {
    return;
  }
  mirror[snapshot.storageKey] = snapshot;
  writeNovelProgressMirror(mirror);
}

export function removeNovelProgressMirror(storageKey: string): void {
  const mirror = loadNovelProgressMirror();
  if (storageKey in mirror) {
    delete mirror[storageKey];
    writeNovelProgressMirror(mirror);
  }
}

export function mergeNovelProgressSnapshots(
  incoming: Record<string, NovelProgressSnapshot>
): Record<string, NovelProgressSnapshot> {
  const current = loadNovelProgressMirror();
  let changed = false;
  for (const [key, inc] of Object.entries(incoming)) {
    if (!inc || typeof inc !== 'object' || typeof inc.title !== 'string') {
      continue;
    }
    const existing = current[key];
    if (!existing) {
      current[key] = inc;
      changed = true;
      continue;
    }
    const useIncoming = (inc.updatedAt ?? 0) > (existing.updatedAt ?? 0);
    const mergedBookmarksMap = new Map<string, NovelBookmark>();
    for (const bm of existing.bookmarks ?? []) {
      mergedBookmarksMap.set(bm.id, bm);
    }
    for (const bm of inc.bookmarks ?? []) {
      if (!mergedBookmarksMap.has(bm.id)) {
        mergedBookmarksMap.set(bm.id, bm);
      }
    }
    const mergedBookmarks = Array.from(mergedBookmarksMap.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 80);

    if (
      useIncoming ||
      mergedBookmarks.length !== (existing.bookmarks ?? []).length
    ) {
      const winner = useIncoming ? inc : existing;
      current[key] = {
        ...winner,
        bookmarks: mergedBookmarks,
        updatedAt: Math.max(inc.updatedAt ?? 0, existing.updatedAt ?? 0),
      };
      changed = true;
    }
  }
  if (changed) {
    writeNovelProgressMirror(current);
  }
  return current;
}

export function findExistingProgressForBook(
  storageKey: string,
  fileName: string,
  title: string
): NovelProgressSnapshot | null {
  const mirror = loadNovelProgressMirror();
  if (mirror[storageKey]) return mirror[storageKey];
  const normFile = fileName.trim().toLowerCase();
  const normTitle = title.trim().toLowerCase();
  for (const snap of Object.values(mirror)) {
    if (normFile && snap.fileName.trim().toLowerCase() === normFile) {
      return snap;
    }
    if (normTitle && snap.title.trim().toLowerCase() === normTitle) {
      return snap;
    }
  }
  return null;
}

function bookToProgressSnapshot(book: StoredNovelBook): NovelProgressSnapshot {
  return {
    storageKey: book.storageKey,
    catalogItemId: book.catalogItemId,
    title: book.title,
    author: book.author,
    fileName: book.fileName,
    totalChars: book.totalChars,
    chapterCount: book.chapters?.length ?? 0,
    currentChapter: book.currentChapter,
    scrollRatio: book.scrollRatio,
    vnIndex: book.vnIndex ?? 0,
    bookmarks: book.bookmarks ?? [],
    updatedAt: book.updatedAt,
  };
}

function openNovelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser ini tidak mendukung IndexedDB.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'storageKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error('Gagal membuka database reader novel.'));
  });
}

async function putBookRecordOnly(book: StoredNovelBook): Promise<void> {
  const db = await openNovelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(book);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menyimpan novel ke browser.'));
    };
  });
}

export async function saveStoredNovelBook(book: StoredNovelBook): Promise<void> {
  saveNovelProgressSync(bookToProgressSnapshot(book));
  void requestPersistentLibraryStorage();
  await putBookRecordOnly(book);
}

function reconcileBookWithMirror(
  book: StoredNovelBook,
  mirror: Record<string, NovelProgressSnapshot>
): { book: StoredNovelBook; updatedFromMirror: boolean } {
  const snap = mirror[book.storageKey];
  if (!snap || snap.updatedAt <= book.updatedAt) {
    return { book, updatedFromMirror: false };
  }
  const maxChapter = Math.max(0, (book.chapters?.length ?? 1) - 1);
  return {
    book: {
      ...book,
      currentChapter: Math.min(maxChapter, Math.max(0, snap.currentChapter)),
      scrollRatio: Math.min(1, Math.max(0, snap.scrollRatio)),
      vnIndex: Math.max(0, snap.vnIndex),
      bookmarks:
        snap.bookmarks.length >= (book.bookmarks?.length ?? 0)
          ? snap.bookmarks
          : book.bookmarks,
      updatedAt: snap.updatedAt,
    },
    updatedFromMirror: true,
  };
}

export async function getStoredNovelBook(
  storageKey: string
): Promise<StoredNovelBook | null> {
  try {
    const db = await openNovelDb();
    const rawBook = await new Promise<StoredNovelBook | null>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(storageKey);
        req.onsuccess = () => {
          db.close();
          resolve((req.result as StoredNovelBook | undefined) ?? null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error('Gagal membaca novel tersimpan.'));
        };
      }
    );
    if (!rawBook) return null;
    const mirror = loadNovelProgressMirror();
    const { book, updatedFromMirror } = reconcileBookWithMirror(rawBook, mirror);
    if (updatedFromMirror) {
      void putBookRecordOnly(book);
    } else if (!mirror[book.storageKey]) {
      saveNovelProgressSync(bookToProgressSnapshot(book));
    }
    return book;
  } catch {
    return null;
  }
}

function normalizeBookText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getBookProgressScore(
  book: Pick<StoredNovelBook, 'currentChapter' | 'scrollRatio' | 'vnIndex'>
): number {
  return (
    book.currentChapter + Math.min(0.9999, Math.max(0, book.scrollRatio ?? 0))
  );
}

function isSameBookContent(a: StoredNovelBook, b: StoredNovelBook): boolean {
  if (a.storageKey === b.storageKey) return true;
  if (a.totalChars <= 0 || b.totalChars <= 0) return false;
  if (a.totalChars !== b.totalChars) return false;

  const chA = a.chapters?.length ?? 0;
  const chB = b.chapters?.length ?? 0;
  const titleA = normalizeBookText(a.title);
  const titleB = normalizeBookText(b.title);
  if (chA === chB && titleA && titleA === titleB) {
    return true;
  }

  const fileA = normalizeBookText(a.fileName);
  const fileB = normalizeBookText(b.fileName);
  if (fileA && fileA === fileB) {
    return true;
  }

  return false;
}

function mergeDuplicateBooks(group: StoredNovelBook[]): StoredNovelBook {
  const sortedByProgress = [...group].sort((a, b) => {
    const scoreDiff = getBookProgressScore(b) - getBookProgressScore(a);
    if (Math.abs(scoreDiff) > 1e-6) return scoreDiff;
    const vnDiff = (b.vnIndex ?? 0) - (a.vnIndex ?? 0);
    if (vnDiff !== 0) return vnDiff;
    return b.updatedAt - a.updatedAt;
  });

  const winner = sortedByProgress[0];
  const mergedBookmarks: NovelBookmark[] = [];
  const seenBmIds = new Set<string>();
  const seenBmContent = new Set<string>();

  for (const item of group) {
    for (const bm of item.bookmarks ?? []) {
      const contentKey = `${bm.chapterIndex}:${normalizeBookText(bm.excerpt)}`;
      if (seenBmIds.has(bm.id) || seenBmContent.has(contentKey)) continue;
      seenBmIds.add(bm.id);
      seenBmContent.add(contentKey);
      mergedBookmarks.push(bm);
    }
  }
  mergedBookmarks.sort((a, b) => b.createdAt - a.createdAt);

  return {
    ...winner,
    bookmarks: mergedBookmarks.slice(0, 80),
    coverDataUrl:
      winner.coverDataUrl ||
      group.find((b) => Boolean(b.coverDataUrl))?.coverDataUrl,
    author: winner.author || group.find((b) => Boolean(b.author))?.author,
    catalogItemId:
      winner.catalogItemId ||
      group.find((b) => Boolean(b.catalogItemId))?.catalogItemId,
    updatedAt: Math.max(...group.map((b) => b.updatedAt)),
  };
}

let listBooksInFlight: Promise<StoredNovelBook[]> | null = null;

export async function listAllStoredNovelBooksFull(): Promise<StoredNovelBook[]> {
  if (listBooksInFlight) return listBooksInFlight;

  listBooksInFlight = (async () => {
    try {
      const db = await openNovelDb();
      const rawList = await new Promise<StoredNovelBook[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => {
          db.close();
          resolve((req.result as StoredNovelBook[]) ?? []);
        };
        req.onerror = () => {
          db.close();
          reject(
            req.error ?? new Error('Gagal memuat daftar buku tersimpan.')
          );
        };
      });

      const mirror = loadNovelProgressMirror();
      const reconciled = rawList.map(
        (b) => reconcileBookWithMirror(b, mirror).book
      );

      const groups: StoredNovelBook[][] = [];
      for (const item of reconciled) {
        const existingGroup = groups.find((grp) =>
          grp.some((member) => isSameBookContent(member, item))
        );
        if (existingGroup) {
          existingGroup.push(item);
        } else {
          groups.push([item]);
        }
      }

      const dedupedList: StoredNovelBook[] = [];
      const currentLastKey = getLastOpenedNovelKey();

      for (const grp of groups) {
        if (grp.length === 1) {
          dedupedList.push(grp[0]);
          continue;
        }

        const merged = mergeDuplicateBooks(grp);
        const removedKeys = grp
          .map((g) => g.storageKey)
          .filter((k) => k !== merged.storageKey);

        await saveStoredNovelBook(merged);
        for (const rmKey of removedKeys) {
          await deleteStoredNovelBook(rmKey);
        }
        if (currentLastKey && removedKeys.includes(currentLastKey)) {
          setLastOpenedNovelKey(merged.storageKey);
        }
        dedupedList.push(merged);
      }

      return dedupedList;
    } catch {
      return [];
    } finally {
      listBooksInFlight = null;
    }
  })();

  return listBooksInFlight;
}

export async function listStoredNovelBooks(): Promise<StoredNovelSummary[]> {
  const fullBooks = await listAllStoredNovelBooksFull();
  const mirror = loadNovelProgressMirror();
  const items: StoredNovelSummary[] = fullBooks.map((b) => {
    if (!mirror[b.storageKey]) {
      saveNovelProgressSync(bookToProgressSnapshot(b));
    }
    return {
      storageKey: b.storageKey,
      catalogItemId: b.catalogItemId,
      title: b.title,
      author: b.author,
      fileName: b.fileName,
      coverDataUrl: b.coverDataUrl,
      totalChars: b.totalChars,
      currentChapter: b.currentChapter,
      currentChapterTitle: b.chapters?.[b.currentChapter]?.title ?? '',
      scrollRatio: b.scrollRatio,
      vnIndex: b.vnIndex ?? 0,
      bookmarks: b.bookmarks ?? [],
      bookmarkCount: b.bookmarks?.length ?? 0,
      updatedAt: b.updatedAt,
      chapterCount: b.chapters?.length ?? 0,
    };
  });
  items.sort((a, b) => b.updatedAt - a.updatedAt);
  return items;
}

export async function importNovelFileToLibrary(
  file: File,
  options?: {
    preferredStorageKey?: string;
    catalogItemId?: string;
    fallbackTitle?: string;
  }
): Promise<{ book: StoredNovelBook; deduplicated: boolean }> {
  const preferredKey =
    options?.preferredStorageKey ||
    makeLibraryStorageKey(file.name, options?.fallbackTitle);
  const parsed = await parseNovelFile(file, {
    storageKey: preferredKey,
    catalogItemId: options?.catalogItemId,
    fallbackTitle: options?.fallbackTitle,
  });

  const existingBooks = await listAllStoredNovelBooksFull();
  const matched = existingBooks.find((b) => isSameBookContent(b, parsed));

  if (matched) {
    const merged = mergeDuplicateBooks([
      matched,
      { ...parsed, storageKey: matched.storageKey },
    ]);
    const canonical: StoredNovelBook = {
      ...merged,
      storageKey: matched.storageKey,
      updatedAt: Date.now(),
    };
    await saveStoredNovelBook(canonical);
    return { book: canonical, deduplicated: true };
  }

  await saveStoredNovelBook(parsed);
  return { book: parsed, deduplicated: false };
}

export async function updateStoredNovelProgress(
  storageKey: string,
  currentChapter: number,
  scrollRatio: number,
  vnIndex?: number
): Promise<void> {
  try {
    const mirror = loadNovelProgressMirror();
    const snap = mirror[storageKey];
    const now = Math.max(Date.now(), (snap?.updatedAt ?? 0) + 1);
    if (snap) {
      saveNovelProgressSync({
        ...snap,
        currentChapter,
        scrollRatio,
        ...(typeof vnIndex === 'number' ? { vnIndex } : {}),
        updatedAt: now,
      });
    }
    const existing = await getStoredNovelBook(storageKey);
    if (!existing) return;
    const latestMirror = loadNovelProgressMirror()[storageKey];
    if (
      (latestMirror && latestMirror.updatedAt > now) ||
      existing.updatedAt > now
    ) {
      return;
    }
    await saveStoredNovelBook({
      ...existing,
      currentChapter,
      scrollRatio,
      ...(typeof vnIndex === 'number' ? { vnIndex } : {}),
      updatedAt: now,
    });
  } catch {
    // ignore background progress persistence errors
  }
}

export async function addStoredNovelBookmark(
  storageKey: string,
  bookmark: NovelBookmark
): Promise<NovelBookmark[]> {
  const existing = await getStoredNovelBook(storageKey);
  if (!existing) return [];
  const next = [bookmark, ...(existing.bookmarks ?? [])].slice(0, 80);
  await saveStoredNovelBook({
    ...existing,
    bookmarks: next,
    updatedAt: Date.now(),
  });
  return next;
}

export async function deleteStoredNovelBookmark(
  storageKey: string,
  bookmarkId: string
): Promise<NovelBookmark[]> {
  const existing = await getStoredNovelBook(storageKey);
  if (!existing) return [];
  const next = (existing.bookmarks ?? []).filter((b) => b.id !== bookmarkId);
  await saveStoredNovelBook({
    ...existing,
    bookmarks: next,
    updatedAt: Date.now(),
  });
  return next;
}

export async function deleteStoredNovelBook(storageKey: string): Promise<void> {
  removeNovelProgressMirror(storageKey);
  if (getLastOpenedNovelKey() === storageKey) {
    setLastOpenedNovelKey('');
  }
  const db = await openNovelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(storageKey);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menghapus novel tersimpan.'));
    };
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeZipPath(path: string): string {
  let clean = path.replace(/\\/g, '/').split('#')[0].split('?')[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // keep original if malformed percent-encoding
  }
  const parts: string[] = [];
  for (const segment of clean.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join('/');
}

function getDirPath(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '' : filePath.slice(0, idx);
}

function resolveZipRelative(baseDir: string, href: string): string {
  if (!href) return '';
  const stripped = href.trim();
  if (stripped.startsWith('/')) {
    return normalizeZipPath(stripped.slice(1));
  }
  return normalizeZipPath(baseDir ? `${baseDir}/${stripped}` : stripped);
}

function getMimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
}

function computeJapaneseCharCount(container: Element): number {
  const clone = container.cloneNode(true) as Element;
  clone.querySelectorAll('rt, rp').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, '').length;
}

function extractCleanTextExcerpt(container: Element): string {
  const clone = container.cloneNode(true) as Element;
  clone.querySelectorAll('rt, rp').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const CONTAINER_WRAPPER_TAGS = new Set([
  'DIV',
  'SECTION',
  'ARTICLE',
  'MAIN',
  'ASIDE',
  'HEADER',
  'FOOTER',
  'BLOCKQUOTE',
  'BODY',
]);

const BLOCK_CHILD_SELECTOR =
  ':scope > p, :scope > div, :scope > section, :scope > article, :scope > blockquote, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul, :scope > ol, :scope > li, :scope > figure';

export function extractChapterParagraphs(
  chapterHtml: string
): ChapterParagraphBlock[] {
  if (!chapterHtml.trim()) return [];
  const doc = new DOMParser().parseFromString(chapterHtml, 'text/html');
  const body = doc.body;
  if (!body) return [];

  body
    .querySelectorAll(DISALLOWED_TAGS_SELECTOR)
    .forEach((node) => node.remove());
  body.querySelectorAll('*').forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const nameLower = attr.name.toLowerCase();
      if (
        nameLower.startsWith('on') ||
        nameLower === 'srcdoc' ||
        nameLower === 'formaction' ||
        nameLower === 'action' ||
        ((nameLower === 'href' ||
          nameLower === 'xlink:href' ||
          nameLower === 'src' ||
          nameLower === 'poster' ||
          nameLower === 'data') &&
          hasDangerousUriScheme(attr.value))
      ) {
        node.removeAttribute(attr.name);
      }
    }
  });

  const blocks: ChapterParagraphBlock[] = [];

  const pushElement = (el: Element) => {
    const hasMedia =
      el.tagName === 'IMG' ||
      el.tagName === 'SVG' ||
      el.querySelector('img[src], svg image[href]') !== null;
    const charCount = computeJapaneseCharCount(el);
    if (charCount === 0 && !hasMedia) return;

    const text = extractCleanTextExcerpt(el);
    const wrappedHtml =
      el.tagName === 'IMG' || el.tagName === 'SVG'
        ? `<div class="jp-vn-media">${el.outerHTML}</div>`
        : el.outerHTML;

    blocks.push({
      id: `p-${blocks.length}`,
      html: wrappedHtml,
      text: text.slice(0, 140),
      charCount,
      isMediaOnly: charCount === 0 && hasMedia,
    });
  };

  const walk = (container: Element) => {
    const children = Array.from(container.children);
    if (children.length === 0) {
      pushElement(container);
      return;
    }

    for (const child of children) {
      const tagUpper = child.tagName.toUpperCase();
      if (
        CONTAINER_WRAPPER_TAGS.has(tagUpper) &&
        child.querySelector(BLOCK_CHILD_SELECTOR) !== null
      ) {
        walk(child);
      } else {
        pushElement(child);
      }
    }
  };

  walk(body);

  if (blocks.length === 0) {
    const fallbackChars = computeJapaneseCharCount(body);
    const hasMedia = body.querySelector('img[src], svg image[href]') !== null;
    if (fallbackChars > 0 || hasMedia) {
      blocks.push({
        id: 'p-0',
        html: body.innerHTML,
        text: extractCleanTextExcerpt(body).slice(0, 140),
        charCount: fallbackChars,
        isMediaOnly: fallbackChars === 0 && hasMedia,
      });
    }
  }

  return blocks;
}

function parseXmlOrHtmlDocument(raw: string): Document {
  const parser = new DOMParser();
  const xhtmlDoc = parser.parseFromString(raw, 'application/xhtml+xml');
  if (!xhtmlDoc.querySelector('parsererror')) {
    return xhtmlDoc;
  }
  return parser.parseFromString(raw, 'text/html');
}

const DISALLOWED_TAGS_SELECTOR =
  'script, style, iframe, object, embed, link, meta, base, foreignobject, animate, animatemotion, animatetransform, set, mpath, handler, use, template, portal, form, input, textarea, select, button, noscript, audio, video';

function hasDangerousUriScheme(raw: string): boolean {
  let normalized = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code <= 32) continue;
    normalized += raw[i];
  }
  const lower = normalized.toLowerCase();
  return (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('data:application/') ||
    lower.startsWith('data:image/svg+xml')
  );
}

async function sanitizeChapterRoot(
  root: Element,
  chapterDir: string,
  zipLookup: Map<string, JSZip.JSZipObject>,
  imageCache: Map<string, string>
): Promise<{ html: string; charCount: number; hasMedia: boolean }> {
  root
    .querySelectorAll(DISALLOWED_TAGS_SELECTOR)
    .forEach((el) => el.remove());

  const loadDataUrl = async (href: string): Promise<string | null> => {
    if (!href || /^(https?:|data:|blob:|javascript:|vbscript:)/i.test(href)) {
      return null;
    }
    const resolved = resolveZipRelative(chapterDir, href);
    if (!resolved) return null;
    const mime = getMimeFromPath(resolved);
    if (!mime.startsWith('image/') || mime === 'image/svg+xml') {
      return null;
    }
    const cached = imageCache.get(resolved);
    if (cached) return cached;

    const entry =
      zipLookup.get(resolved) ?? zipLookup.get(resolved.toLowerCase());
    if (!entry) return null;
    try {
      const b64 = await entry.async('base64');
      const dataUrl = `data:${mime};base64,${b64}`;
      imageCache.set(resolved, dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  };

  const imgs = Array.from(root.querySelectorAll('img'));
  for (const img of imgs) {
    const src = img.getAttribute('src') ?? '';
    const dataUrl = await loadDataUrl(src);
    if (dataUrl) {
      img.setAttribute('src', dataUrl);
    } else if (
      !/^https?:/i.test(src) &&
      !/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)
    ) {
      img.removeAttribute('src');
    }
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.setAttribute('loading', 'lazy');
  }

  const svgImages = Array.from(root.querySelectorAll('image'));
  for (const svgImg of svgImages) {
    const href =
      svgImg.getAttribute('xlink:href') ?? svgImg.getAttribute('href') ?? '';
    const dataUrl = await loadDataUrl(href);
    if (dataUrl) {
      svgImg.setAttribute('href', dataUrl);
      svgImg.removeAttribute('xlink:href');
    } else if (
      !/^https?:/i.test(href) &&
      !/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(href)
    ) {
      svgImg.removeAttribute('href');
      svgImg.removeAttribute('xlink:href');
    }
  }

  const allElements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of allElements) {
    for (const attr of Array.from(el.attributes)) {
      const nameLower = attr.name.toLowerCase();
      if (
        nameLower.startsWith('on') ||
        nameLower === 'style' ||
        nameLower === 'srcset' ||
        nameLower === 'srcdoc' ||
        nameLower === 'allow' ||
        nameLower === 'sandbox' ||
        nameLower === 'formaction' ||
        nameLower === 'action' ||
        nameLower === 'xmlns' ||
        nameLower === 'xml:lang'
      ) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (nameLower === 'href' ||
          nameLower === 'xlink:href' ||
          nameLower === 'src' ||
          nameLower === 'poster' ||
          nameLower === 'data' ||
          nameLower === 'background') &&
        hasDangerousUriScheme(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.tagName.toLowerCase() === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (href && !/^https?:/i.test(href)) {
        el.removeAttribute('href');
      } else if (/^https?:/i.test(href)) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }

  const charCount = computeJapaneseCharCount(root);
  const hasMedia =
    root.querySelectorAll('img[src], svg image[href]').length > 0;

  return {
    html: root.innerHTML,
    charCount,
    hasMedia,
  };
}

function decodeTextBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('shift_jis').decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }
}

async function compressCoverDataUrl(
  rawDataUrl: string,
  maxWidth = 280
): Promise<string | undefined> {
  if (!rawDataUrl || rawDataUrl.length < 40) return undefined;
  if (rawDataUrl.startsWith('data:image/svg+xml')) {
    return rawDataUrl.length <= 65000 ? rawDataUrl : undefined;
  }
  return await new Promise<string | undefined>((resolve) => {
    const img = new Image();
    img.onerror = () =>
      resolve(rawDataUrl.length <= 80000 ? rawDataUrl : undefined);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / Math.max(1, img.width));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl.length <= 80000 ? rawDataUrl : undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      } catch {
        resolve(rawDataUrl.length <= 80000 ? rawDataUrl : undefined);
      }
    };
    img.src = rawDataUrl;
  });
}

async function resolvePreservedProgress(
  storageKey: string,
  fileName: string,
  title: string,
  chapterCount: number
): Promise<{
  currentChapter: number;
  scrollRatio: number;
  vnIndex: number;
  bookmarks: NovelBookmark[];
}> {
  const existingIdb = await getStoredNovelBook(storageKey);
  const mirrorSnap = findExistingProgressForBook(storageKey, fileName, title);
  const source =
    existingIdb && (!mirrorSnap || existingIdb.updatedAt >= mirrorSnap.updatedAt)
      ? existingIdb
      : mirrorSnap;
  if (!source) {
    return { currentChapter: 0, scrollRatio: 0, vnIndex: 0, bookmarks: [] };
  }
  const maxChapter = Math.max(0, chapterCount - 1);
  return {
    currentChapter: Math.min(maxChapter, Math.max(0, source.currentChapter)),
    scrollRatio: Math.min(1, Math.max(0, source.scrollRatio)),
    vnIndex: Math.max(0, source.vnIndex ?? 0),
    bookmarks: source.bookmarks ?? [],
  };
}

export async function parseNovelFile(
  file: File,
  options: { storageKey: string; catalogItemId?: string; fallbackTitle?: string }
): Promise<StoredNovelBook> {
  const lowerName = file.name.toLowerCase();
  const baseFileNameTitle = file.name.replace(/\.(epub|txt|html?|xhtml)$/i, '');

  if (lowerName.endsWith('.txt')) {
    const buffer = await file.arrayBuffer();
    const rawText = decodeTextBuffer(buffer).replace(/\r\n?/g, '\n');
    const paragraphs = rawText.split(/\n{2,}/);
    const chapters: StoredNovelChapter[] = [];
    let chunkHtml: string[] = [];
    let chunkChars = 0;

    const flushChunk = () => {
      if (chunkHtml.length === 0) return;
      const idx = chapters.length + 1;
      chapters.push({
        id: `txt-${idx}`,
        title: chapters.length === 0 && paragraphs.length <= 80 ? 'Teks Lengkap' : `Bagian ${idx}`,
        html: chunkHtml.join('\n'),
        charCount: chunkChars,
      });
      chunkHtml = [];
      chunkChars = 0;
    };

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      const safe = escapeHtml(trimmed).replace(/\n/g, '<br />');
      chunkHtml.push(`<p>${safe}</p>`);
      chunkChars += trimmed.replace(/\s+/g, '').length;
      if (chunkChars >= 18000) {
        flushChunk();
      }
    }
    flushChunk();

    if (chapters.length === 0) {
      throw new Error('File TXT kosong atau tidak berisi teks.');
    }

    const totalChars = chapters.reduce((acc, ch) => acc + ch.charCount, 0);
    const resolvedTitle = options.fallbackTitle || baseFileNameTitle;
    const preserved = await resolvePreservedProgress(
      options.storageKey,
      file.name,
      resolvedTitle,
      chapters.length
    );
    return {
      storageKey: options.storageKey,
      catalogItemId: options.catalogItemId,
      title: resolvedTitle,
      fileName: file.name,
      chapters,
      totalChars,
      currentChapter: preserved.currentChapter,
      scrollRatio: preserved.scrollRatio,
      vnIndex: preserved.vnIndex,
      bookmarks: preserved.bookmarks,
      updatedAt: Date.now(),
    };
  }

  if (
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.xhtml')
  ) {
    const buffer = await file.arrayBuffer();
    const rawHtml = decodeTextBuffer(buffer);
    const doc = parseXmlOrHtmlDocument(rawHtml);
    const body = doc.body ?? doc.documentElement;
    const cleaned = await sanitizeChapterRoot(
      body,
      '',
      new Map(),
      new Map()
    );
    const docTitle = doc.querySelector('title')?.textContent?.trim();
    const resolvedTitle = docTitle || options.fallbackTitle || baseFileNameTitle;
    const preserved = await resolvePreservedProgress(
      options.storageKey,
      file.name,
      resolvedTitle,
      1
    );
    return {
      storageKey: options.storageKey,
      catalogItemId: options.catalogItemId,
      title: resolvedTitle,
      fileName: file.name,
      chapters: [
        {
          id: 'html-1',
          title: docTitle || 'Teks Novel',
          html: cleaned.html,
          charCount: cleaned.charCount,
        },
      ],
      totalChars: cleaned.charCount,
      currentChapter: preserved.currentChapter,
      scrollRatio: preserved.scrollRatio,
      vnIndex: preserved.vnIndex,
      bookmarks: preserved.bookmarks,
      updatedAt: Date.now(),
    };
  }

  if (!lowerName.endsWith('.epub')) {
    throw new Error(
      'Format tidak didukung. Pilih file .epub, .txt, atau .html/.xhtml.'
    );
  }

  const zip = await JSZip.loadAsync(file);
  const zipLookup = new Map<string, JSZip.JSZipObject>();
  let fallbackOpfPath = '';

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const norm = normalizeZipPath(relativePath);
    zipLookup.set(norm, entry);
    zipLookup.set(norm.toLowerCase(), entry);
    if (!fallbackOpfPath && norm.toLowerCase().endsWith('.opf')) {
      fallbackOpfPath = norm;
    }
  });

  let opfPath = fallbackOpfPath;
  const containerEntry =
    zipLookup.get('META-INF/container.xml') ??
    zipLookup.get('meta-inf/container.xml');
  if (containerEntry) {
    const containerXml = await containerEntry.async('string');
    const containerDoc = new DOMParser().parseFromString(
      containerXml,
      'application/xml'
    );
    const rootfile = containerDoc.querySelector('rootfile[full-path]');
    const fullPath = rootfile?.getAttribute('full-path');
    if (fullPath) {
      opfPath = normalizeZipPath(fullPath);
    }
  }

  const opfEntry =
    (opfPath ? zipLookup.get(opfPath) ?? zipLookup.get(opfPath.toLowerCase()) : undefined) ??
    (fallbackOpfPath ? zipLookup.get(fallbackOpfPath) : undefined);

  if (!opfEntry) {
    throw new Error('Struktur EPUB tidak valid (file .opf tidak ditemukan).');
  }

  const opfDir = getDirPath(opfPath);
  const opfXml = await opfEntry.async('string');
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

  const metaTitle =
    opfDoc.getElementsByTagName('dc:title')[0]?.textContent?.trim() ||
    opfDoc.getElementsByTagNameNS('*', 'title')[0]?.textContent?.trim();
  const metaAuthor =
    opfDoc.getElementsByTagName('dc:creator')[0]?.textContent?.trim() ||
    opfDoc.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim();

  const manifest = new Map<
    string,
    { href: string; mediaType: string; properties: string }
  >();
  let ncxId = '';
  let navHref = '';

  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id') ?? '';
    const href = item.getAttribute('href') ?? '';
    const mediaType = item.getAttribute('media-type') ?? '';
    const properties = item.getAttribute('properties') ?? '';
    if (id && href) {
      manifest.set(id, { href, mediaType, properties });
      if (properties.split(/\s+/).includes('nav')) {
        navHref = href;
      }
      if (mediaType === 'application/x-dtbncx+xml') {
        ncxId = id;
      }
    }
  });

  // Extract cover image thumbnail for persistent Library Shelf display
  const metaCoverId =
    opfDoc
      .querySelector('metadata > meta[name="cover"]')
      ?.getAttribute('content')
      ?.trim() ?? '';
  let coverHref = metaCoverId ? manifest.get(metaCoverId)?.href ?? '' : '';
  if (!coverHref) {
    for (const [, item] of manifest) {
      if (item.properties.split(/\s+/).includes('cover-image')) {
        coverHref = item.href;
        break;
      }
    }
  }
  if (!coverHref) {
    for (const [id, item] of manifest) {
      if (
        item.mediaType.startsWith('image/') &&
        (id.toLowerCase().includes('cover') ||
          item.href.toLowerCase().includes('cover'))
      ) {
        coverHref = item.href;
        break;
      }
    }
  }

  let coverDataUrl: string | undefined;
  if (coverHref) {
    const coverPath = resolveZipRelative(opfDir, coverHref);
    const coverEntry =
      zipLookup.get(coverPath) ?? zipLookup.get(coverPath.toLowerCase());
    if (coverEntry) {
      try {
        const b64 = await coverEntry.async('base64');
        const rawCover = `data:${getMimeFromPath(coverPath)};base64,${b64}`;
        coverDataUrl = await compressCoverDataUrl(rawCover, 280);
      } catch {
        // ignore broken cover images
      }
    }
  }

  const spineEl = opfDoc.querySelector('spine');
  if (!ncxId) {
    ncxId = spineEl?.getAttribute('toc') ?? '';
  }

  const tocTitleMap = new Map<string, string>();
  if (navHref) {
    const navPath = resolveZipRelative(opfDir, navHref);
    const navEntry =
      zipLookup.get(navPath) ?? zipLookup.get(navPath.toLowerCase());
    if (navEntry) {
      const navDir = getDirPath(navPath);
      const navDoc = parseXmlOrHtmlDocument(await navEntry.async('string'));
      navDoc.querySelectorAll('nav a[href]').forEach((a) => {
        const href = a.getAttribute('href') ?? '';
        const label = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
        const targetPath = resolveZipRelative(navDir, href);
        if (targetPath && label && !tocTitleMap.has(targetPath)) {
          tocTitleMap.set(targetPath, label);
        }
      });
    }
  } else if (ncxId && manifest.has(ncxId)) {
    const ncxPath = resolveZipRelative(opfDir, manifest.get(ncxId)!.href);
    const ncxEntry =
      zipLookup.get(ncxPath) ?? zipLookup.get(ncxPath.toLowerCase());
    if (ncxEntry) {
      const ncxDir = getDirPath(ncxPath);
      const ncxDoc = new DOMParser().parseFromString(
        await ncxEntry.async('string'),
        'application/xml'
      );
      ncxDoc.querySelectorAll('navPoint').forEach((pt) => {
        const label =
          pt.querySelector('navLabel > text')?.textContent?.trim() ?? '';
        const src = pt.querySelector('content')?.getAttribute('src') ?? '';
        const targetPath = resolveZipRelative(ncxDir, src);
        if (targetPath && label && !tocTitleMap.has(targetPath)) {
          tocTitleMap.set(targetPath, label);
        }
      });
    }
  }

  const spineIds: string[] = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
    const idref = ref.getAttribute('idref');
    if (idref && ref.getAttribute('linear') !== 'no') {
      spineIds.push(idref);
    }
  });
  if (spineIds.length === 0) {
    manifest.forEach((v, id) => {
      if (v.mediaType.includes('html')) spineIds.push(id);
    });
  }

  const imageCache = new Map<string, string>();
  const chapters: StoredNovelChapter[] = [];

  for (const idref of spineIds) {
    const item = manifest.get(idref);
    if (!item) continue;
    const chapterPath = resolveZipRelative(opfDir, item.href);
    const entry =
      zipLookup.get(chapterPath) ?? zipLookup.get(chapterPath.toLowerCase());
    if (!entry) continue;

    const rawXhtml = await entry.async('string');
    const doc = parseXmlOrHtmlDocument(rawXhtml);
    const body = doc.body ?? doc.documentElement;
    if (!body) continue;

    const chapterDir = getDirPath(chapterPath);
    const cleaned = await sanitizeChapterRoot(
      body,
      chapterDir,
      zipLookup,
      imageCache
    );

    if (cleaned.charCount === 0 && !cleaned.hasMedia) {
      continue;
    }

    const headingText = body
      .querySelector('h1, h2, h3')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    const chapterTitle =
      tocTitleMap.get(chapterPath) ||
      headingText ||
      (cleaned.charCount === 0 && cleaned.hasMedia
        ? `Ilustrasi (${chapters.length + 1})`
        : `Bab ${chapters.length + 1}`);

    chapters.push({
      id: idref,
      title: chapterTitle,
      html: cleaned.html,
      charCount: cleaned.charCount,
    });
  }

  if (chapters.length === 0) {
    throw new Error(
      'Tidak ada isi teks atau bab yang terbaca di dalam file EPUB ini.'
    );
  }

  const totalChars = chapters.reduce((acc, ch) => acc + ch.charCount, 0);
  const resolvedTitle = metaTitle || options.fallbackTitle || baseFileNameTitle;
  const preserved = await resolvePreservedProgress(
    options.storageKey,
    file.name,
    resolvedTitle,
    chapters.length
  );

  return {
    storageKey: options.storageKey,
    catalogItemId: options.catalogItemId,
    title: resolvedTitle,
    author: metaAuthor || undefined,
    fileName: file.name,
    coverDataUrl,
    chapters,
    totalChars,
    currentChapter: preserved.currentChapter,
    scrollRatio: preserved.scrollRatio,
    vnIndex: preserved.vnIndex,
    bookmarks: preserved.bookmarks,
    updatedAt: Date.now(),
  };
}
