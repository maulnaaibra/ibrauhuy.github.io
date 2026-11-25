import type { AiTtsSettings, StoredAudiobookTrack } from './audiobookEngine';
import type { StoredNovelChapter } from './epubReaderStore';

export interface SyncParagraphMeta {
  globalIndex: number;
  chapterIndex: number;
  paraIndex: number;
  text: string;
  readingText: string;
  html: string;
  charCount: number;
  speechWeight: number;
  isMediaOnly: boolean;
}

export interface SyncTimelineSegment {
  globalIndex: number;
  chapterIndex: number;
  paraIndex: number;
  startSec: number;
  endSec: number;
}

export interface SyncAnchorPoint {
  globalIndex: number;
  timeSec: number;
}

export interface SubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

export type TrackSyncMode =
  | 'auto'
  | 'vad'
  | 'm4b'
  | 'manual'
  | 'subtitle'
  | 'ai';

export interface TrackSyncConfig {
  scope: 'auto' | 'book' | 'chapter';
  chapterIndex: number;
  offsetSec: number;
  anchors: SyncAnchorPoint[];
  syncMode?: TrackSyncMode;
  speechStartSec?: number;
  speechEndSec?: number;
  cues?: SubtitleCue[];
  cueSource?: 'subtitle' | 'ai';
}

export interface AudioSpeechEnvelope {
  durationSec: number;
  speechStartSec: number;
  speechEndSec: number;
  cumSpeechAtGrid: number[];
}

export interface EmbeddedAudioChapter {
  startSec: number;
  title: string;
}

export interface GlobalTrackingPrefs {
  liveTracking: boolean;
  autoFollow: boolean;
  clickToJump: boolean;
}

export const MAX_FULL_DECODE_BYTES = 45 * 1024 * 1024;

const MIN_MORA_RATE = 3.2;
const MAX_MORA_RATE = 11.5;
const DEFAULT_MORA_RATE = 6.2;

const SYNC_CONFIG_STORAGE_KEY = 'immersiontrack_audiobook_sync_v1';
const TRACKING_PREFS_STORAGE_KEY = 'immersiontrack_audiobook_tracking_prefs_v1';

export const DEFAULT_TRACKING_PREFS: GlobalTrackingPrefs = {
  liveTracking: true,
  autoFollow: true,
  clickToJump: true,
};

export function createDefaultTrackSyncConfig(
  chapterIndex = 0
): TrackSyncConfig {
  return {
    scope: 'auto',
    chapterIndex: Math.max(0, chapterIndex),
    offsetSec: 0,
    anchors: [],
  };
}

export function loadGlobalTrackingPrefs(): GlobalTrackingPrefs {
  try {
    const raw = localStorage.getItem(TRACKING_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TRACKING_PREFS };
    const parsed = JSON.parse(raw) as Partial<GlobalTrackingPrefs>;
    return {
      liveTracking:
        typeof parsed.liveTracking === 'boolean'
          ? parsed.liveTracking
          : DEFAULT_TRACKING_PREFS.liveTracking,
      autoFollow:
        typeof parsed.autoFollow === 'boolean'
          ? parsed.autoFollow
          : DEFAULT_TRACKING_PREFS.autoFollow,
      clickToJump:
        typeof parsed.clickToJump === 'boolean'
          ? parsed.clickToJump
          : DEFAULT_TRACKING_PREFS.clickToJump,
    };
  } catch {
    return { ...DEFAULT_TRACKING_PREFS };
  }
}

export function saveGlobalTrackingPrefs(prefs: GlobalTrackingPrefs): void {
  try {
    localStorage.setItem(TRACKING_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota errors
  }
}

function clampNum(
  val: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

export function loadTrackSyncConfig(
  storageKey: string,
  trackId: string,
  defaultChapter = 0
): TrackSyncConfig {
  if (!storageKey || !trackId) {
    return createDefaultTrackSyncConfig(defaultChapter);
  }
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
    if (!raw) return createDefaultTrackSyncConfig(defaultChapter);
    const map = JSON.parse(raw) as Record<string, Partial<TrackSyncConfig>>;
    const entry = map?.[`${storageKey}::${trackId}`];
    if (!entry || typeof entry !== 'object') {
      return createDefaultTrackSyncConfig(defaultChapter);
    }
    const scope: TrackSyncConfig['scope'] =
      entry.scope === 'book' || entry.scope === 'chapter' ? entry.scope : 'auto';
    const anchors: SyncAnchorPoint[] = Array.isArray(entry.anchors)
      ? entry.anchors
          .filter(
            (a): a is SyncAnchorPoint =>
              Boolean(a) &&
              typeof a.globalIndex === 'number' &&
              Number.isFinite(a.globalIndex) &&
              typeof a.timeSec === 'number' &&
              Number.isFinite(a.timeSec)
          )
          .map((a) => ({
            globalIndex: Math.max(0, Math.round(a.globalIndex)),
            timeSec: Math.max(0, a.timeSec),
          }))
      : [];
    const cues: SubtitleCue[] | undefined = Array.isArray(entry.cues)
      ? entry.cues
          .filter(
            (c): c is SubtitleCue =>
              Boolean(c) &&
              typeof c.startSec === 'number' &&
              typeof c.endSec === 'number' &&
              typeof c.text === 'string'
          )
          .slice(0, 10000)
      : undefined;
    const syncMode: TrackSyncMode | undefined =
      entry.syncMode === 'auto' ||
      entry.syncMode === 'vad' ||
      entry.syncMode === 'm4b' ||
      entry.syncMode === 'manual' ||
      entry.syncMode === 'subtitle' ||
      entry.syncMode === 'ai'
        ? entry.syncMode
        : undefined;
    return {
      scope,
      chapterIndex: Math.max(0, Math.round(entry.chapterIndex ?? defaultChapter)),
      offsetSec: clampNum(entry.offsetSec, 0, -300, 300),
      anchors,
      ...(syncMode ? { syncMode } : {}),
      ...(typeof entry.speechStartSec === 'number' &&
      Number.isFinite(entry.speechStartSec)
        ? { speechStartSec: Math.max(0, entry.speechStartSec) }
        : {}),
      ...(typeof entry.speechEndSec === 'number' &&
      Number.isFinite(entry.speechEndSec)
        ? { speechEndSec: Math.max(0, entry.speechEndSec) }
        : {}),
      ...(cues && cues.length > 0 ? { cues } : {}),
      ...(entry.cueSource === 'subtitle' || entry.cueSource === 'ai'
        ? { cueSource: entry.cueSource }
        : {}),
    };
  } catch {
    return createDefaultTrackSyncConfig(defaultChapter);
  }
}

export function saveTrackSyncConfig(
  storageKey: string,
  trackId: string,
  config: TrackSyncConfig
): void {
  if (!storageKey || !trackId) return;
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
    const map: Record<string, TrackSyncConfig> = raw
      ? (JSON.parse(raw) as Record<string, TrackSyncConfig>)
      : {};
    map[`${storageKey}::${trackId}`] = {
      scope: config.scope,
      chapterIndex: Math.max(0, Math.round(config.chapterIndex)),
      offsetSec: clampNum(config.offsetSec, 0, -300, 300),
      anchors: config.anchors,
      ...(config.syncMode ? { syncMode: config.syncMode } : {}),
      ...(typeof config.speechStartSec === 'number' &&
      Number.isFinite(config.speechStartSec)
        ? { speechStartSec: Math.max(0, config.speechStartSec) }
        : {}),
      ...(typeof config.speechEndSec === 'number' &&
      Number.isFinite(config.speechEndSec)
        ? { speechEndSec: Math.max(0, config.speechEndSec) }
        : {}),
      ...(config.cues && config.cues.length > 0
        ? { cues: config.cues.slice(0, 10000), cueSource: config.cueSource }
        : {}),
    };
    localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Fallback: if oversized cues exceeded storage quota, strip cues and keep compact anchors
    try {
      const raw = localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
      const map: Record<string, TrackSyncConfig> = raw
        ? (JSON.parse(raw) as Record<string, TrackSyncConfig>)
        : {};
      map[`${storageKey}::${trackId}`] = {
        scope: config.scope,
        chapterIndex: Math.max(0, Math.round(config.chapterIndex)),
        offsetSec: clampNum(config.offsetSec, 0, -300, 300),
        anchors: config.anchors,
        ...(config.syncMode ? { syncMode: config.syncMode } : {}),
        ...(typeof config.speechStartSec === 'number'
          ? { speechStartSec: Math.max(0, config.speechStartSec) }
          : {}),
        ...(typeof config.speechEndSec === 'number'
          ? { speechEndSec: Math.max(0, config.speechEndSec) }
          : {}),
      };
      localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // ignore storage quota errors
    }
  }
}

export function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

const SMALL_YOON_CHARS = new Set([
  'ぁ',
  'ぃ',
  'ぅ',
  'ぇ',
  'ぉ',
  'ゃ',
  'ゅ',
  'ょ',
  'ゎ',
  'ァ',
  'ィ',
  'ゥ',
  'ェ',
  'ォ',
  'ャ',
  'ュ',
  'ョ',
  'ヮ',
  'ヵ',
  'ヶ',
]);

const SENTENCE_STOP_CHARS = new Set(['。', '！', '？', '!', '?']);
const CLAUSE_STOP_CHARS = new Set(['、', '，', '…', '―', '—']);
const BRACKET_CHARS = new Set([
  '「',
  '」',
  '『',
  '』',
  '（',
  '）',
  '(',
  ')',
  '【',
  '】',
  '［',
  '］',
  '[',
  ']',
]);

function countMoraWeight(str: string): number {
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);
    if (/\s/.test(ch)) continue;
    if (SENTENCE_STOP_CHARS.has(ch)) {
      w += 3.4;
    } else if (CLAUSE_STOP_CHARS.has(ch)) {
      w += 1.4;
    } else if (BRACKET_CHARS.has(ch)) {
      w += 0.35;
    } else if (SMALL_YOON_CHARS.has(ch)) {
      w += 0.35;
    } else if (ch === 'っ' || ch === 'ッ' || ch === 'ー') {
      w += 0.85;
    } else if (
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff)
    ) {
      w += 1.0;
    } else if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      ch === '々'
    ) {
      w += 1.95;
    } else if (/[A-Za-z0-9]/.test(ch)) {
      w += 1.6;
    } else if (/[・：；.,~〜\-'"’”]/.test(ch)) {
      w += 0.4;
    } else {
      w += 1.0;
    }
  }
  return w;
}

// Mirror epubReaderStore.ts extractChapterParagraphs leaf traversal exactly so paraIndex matches 1-to-1
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

function extractCleanSpeakAndReadingText(el: Element): {
  text: string;
  readingText: string;
  charCount: number;
  speechWeight: number;
} {
  const surfaceClone = el.cloneNode(true) as Element;
  surfaceClone.querySelectorAll('rt, rp, script, style').forEach((n) => n.remove());
  const raw = surfaceClone.textContent ?? '';
  const charCount = raw.replace(/\s+/g, '').length;
  const text = raw.replace(/\s+/g, ' ').trim();

  if (charCount === 0) {
    return { text: '', readingText: '', charCount: 0, speechWeight: 0 };
  }

  const readingClone = el.cloneNode(true) as Element;
  readingClone.querySelectorAll('rp, script, style').forEach((n) => n.remove());
  readingClone.querySelectorAll('ruby').forEach((rubyEl) => {
    const rtNodes = Array.from(rubyEl.querySelectorAll('rt'));
    const rtJoined = rtNodes
      .map((rt) => (rt.textContent ?? '').trim())
      .join('');
    if (rtJoined) {
      const docRef = rubyEl.ownerDocument ?? document;
      rubyEl.replaceWith(docRef.createTextNode(rtJoined));
    } else {
      rtNodes.forEach((n) => n.remove());
    }
  });

  const readingRaw = readingClone.textContent ?? raw;
  const readingText = katakanaToHiragana(readingRaw)
    .replace(/\s+/g, ' ')
    .trim();

  let speechWeight = countMoraWeight(readingRaw) + 3.0;
  if (text.startsWith('「') || text.startsWith('『')) {
    speechWeight += 1.5;
  }

  return { text, readingText, charCount, speechWeight };
}

export function annotateBookChaptersForSync(chapters: StoredNovelChapter[]): {
  annotatedChapters: StoredNovelChapter[];
  syncBlocks: SyncParagraphMeta[];
} {
  if (typeof DOMParser === 'undefined' || chapters.length === 0) {
    return { annotatedChapters: chapters, syncBlocks: [] };
  }

  const parser = new DOMParser();
  const annotatedChapters: StoredNovelChapter[] = [];
  const syncBlocks: SyncParagraphMeta[] = [];
  let globalCounter = 0;

  chapters.forEach((ch, chIdx) => {
    if (!ch.html.trim()) {
      annotatedChapters.push(ch);
      return;
    }

    const doc = parser.parseFromString(ch.html, 'text/html');
    const body = doc.body;
    if (!body) {
      annotatedChapters.push(ch);
      return;
    }

    let paraCounter = 0;

    const annotateLeaf = (el: Element) => {
      const hasMedia =
        el.tagName === 'IMG' ||
        el.tagName === 'SVG' ||
        el.querySelector('img[src], svg image[href]') !== null;
      const { text, readingText, charCount, speechWeight } =
        extractCleanSpeakAndReadingText(el);
      if (charCount === 0 && !hasMedia) return;

      const paraIdx = paraCounter++;
      const globalIdx = globalCounter++;
      const isMediaOnly = charCount === 0 && hasMedia;
      const paraHtml =
        el === body
          ? body.innerHTML
          : el.tagName === 'IMG' || el.tagName === 'SVG'
            ? el.outerHTML
            : el.innerHTML;

      if (el !== body) {
        el.setAttribute('data-sync-chapter', String(chIdx));
        el.setAttribute('data-sync-para', String(paraIdx));
        el.classList.add('jp-sync-block');
      } else {
        const wrapper = doc.createElement('div');
        wrapper.setAttribute('data-sync-chapter', String(chIdx));
        wrapper.setAttribute('data-sync-para', String(paraIdx));
        wrapper.className = 'jp-sync-block';
        wrapper.innerHTML = body.innerHTML;
        body.innerHTML = '';
        body.appendChild(wrapper);
      }

      syncBlocks.push({
        globalIndex: globalIdx,
        chapterIndex: chIdx,
        paraIndex: paraIdx,
        text,
        readingText,
        html: paraHtml,
        charCount,
        speechWeight: isMediaOnly ? 0 : speechWeight,
        isMediaOnly,
      });
    };

    const walk = (container: Element) => {
      const children = Array.from(container.children);
      if (children.length === 0) {
        annotateLeaf(container);
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
          annotateLeaf(child);
        }
      }
    };

    walk(body);

    annotatedChapters.push({
      ...ch,
      html: body.innerHTML,
    });
  });

  return { annotatedChapters, syncBlocks };
}

const NON_STORY_TITLE_RE =
  /^(表紙|カバー|口絵|カラー|イラスト|目次|contents|toc|cover|title|扉|奥付|クレジット|copyright|権利表記|電子書籍|刊行|宣伝|広告|キャラクター紹介|登場人物)/i;

export function classifyStoryChapters(
  syncBlocks: SyncParagraphMeta[],
  chapterCount: number,
  chapterTitles?: string[]
): {
  storyChapterIndices: number[];
  storyChapterSet: Set<number>;
  chapterWeights: number[];
  chapterChars: number[];
} {
  const safeCount = Math.max(0, chapterCount);
  const chapterWeights = new Array<number>(safeCount).fill(0);
  const chapterChars = new Array<number>(safeCount).fill(0);
  const chapterSpeakableCounts = new Array<number>(safeCount).fill(0);

  for (const b of syncBlocks) {
    if (b.chapterIndex >= 0 && b.chapterIndex < safeCount && b.speechWeight > 0) {
      chapterWeights[b.chapterIndex] += b.speechWeight;
      chapterChars[b.chapterIndex] += b.charCount;
      chapterSpeakableCounts[b.chapterIndex] += 1;
    }
  }

  let firstSubstantial = -1;
  let lastSubstantial = -1;
  for (let c = 0; c < safeCount; c++) {
    const title = (chapterTitles?.[c] ?? '').trim();
    const isNonStoryTitle = NON_STORY_TITLE_RE.test(title);
    if (!isNonStoryTitle && chapterChars[c] >= 350) {
      if (firstSubstantial === -1) firstSubstantial = c;
      lastSubstantial = c;
    }
  }

  const storyChapterIndices: number[] = [];
  for (let c = 0; c < safeCount; c++) {
    if (chapterSpeakableCounts[c] === 0) continue;
    const title = (chapterTitles?.[c] ?? '').trim();
    if (NON_STORY_TITLE_RE.test(title)) continue;
    if (firstSubstantial !== -1 && c < firstSubstantial && chapterChars[c] < 150) {
      continue;
    }
    if (lastSubstantial !== -1 && c > lastSubstantial && chapterChars[c] < 150) {
      continue;
    }
    storyChapterIndices.push(c);
  }

  if (storyChapterIndices.length === 0) {
    for (let c = 0; c < safeCount; c++) {
      if (chapterSpeakableCounts[c] > 0) {
        storyChapterIndices.push(c);
      }
    }
  }

  return {
    storyChapterIndices,
    storyChapterSet: new Set(storyChapterIndices),
    chapterWeights,
    chapterChars,
  };
}

function parseKanjiOrArabicInt(raw: string): number | null {
  const nfkc = raw.normalize('NFKC').trim();
  if (/^\d+$/.test(nfkc)) return Number(nfkc);
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  let total = 0;
  let current = 0;
  let seen = false;
  for (const ch of nfkc) {
    if (ch in digits) {
      current = digits[ch];
      seen = true;
    } else if (ch === '十') {
      total += (current === 0 ? 1 : current) * 10;
      current = 0;
      seen = true;
    } else if (ch === '百') {
      total += (current === 0 ? 1 : current) * 100;
      current = 0;
      seen = true;
    } else {
      return null;
    }
  }
  total += current;
  return seen && total > 0 ? total : null;
}

function extractChapterNumberFromLabel(label: string): number | null {
  const norm = label.normalize('NFKC');
  const mJa = norm.match(/第\s*(\d+|[一二三四五六七八九十百]+)\s*[章話節部]/);
  if (mJa) {
    const num = parseKanjiOrArabicInt(mJa[1]);
    if (num !== null) return num;
  }
  const mEn = norm.match(
    /(?:chapter|chap|ch|ep|episode|bab|part)[\s._-]*0*(\d+)/i
  );
  if (mEn) return Number(mEn[1]);
  return null;
}

function normalizeLabelForMatch(raw: string): string {
  return katakanaToHiragana(raw.normalize('NFKC').toLowerCase()).replace(
    /[\s\u3000「」『』（）()【】［］[\]・：:、。._-]+/g,
    ''
  );
}

function matchTrackNameToChapter(
  trackName: string | undefined,
  storyChapterIndices: number[],
  chapterTitles?: string[]
): number | null {
  if (!trackName || !chapterTitles || chapterTitles.length === 0) return null;
  const stem = trackName.replace(/\.[a-z0-9]{2,5}$/i, '').trim();
  if (!stem) return null;
  const normTrack = normalizeLabelForMatch(stem);
  if (!normTrack) return null;

  const candidateSet =
    storyChapterIndices.length > 0
      ? storyChapterIndices
      : chapterTitles.map((_, i) => i);

  // 1. Direct normalized title substring match (prefer longest matching title)
  let bestLen = 0;
  let bestChap: number | null = null;
  for (const c of candidateSet) {
    const rawTitle = (chapterTitles[c] ?? '').trim();
    if (!rawTitle || NON_STORY_TITLE_RE.test(rawTitle)) continue;
    const normTitle = normalizeLabelForMatch(rawTitle);
    if (
      normTitle.length >= 2 &&
      (normTrack.includes(normTitle) ||
        (normTrack.length >= 4 && normTitle.includes(normTrack)))
    ) {
      if (normTitle.length > bestLen) {
        bestLen = normTitle.length;
        bestChap = c;
      }
    }
  }
  if (bestChap !== null) return bestChap;

  // 2. Prologue / Epilogue keywords
  const isPrologueTrack = /(プロローグ|序章|prologue)/i.test(stem);
  if (isPrologueTrack) {
    const pIdx = candidateSet.find((c) =>
      /(プロローグ|序章|prologue)/i.test(chapterTitles[c] ?? '')
    );
    if (pIdx !== undefined) return pIdx;
  }
  const isEpilogueTrack = /(エピローグ|終章|epilogue)/i.test(stem);
  if (isEpilogueTrack) {
    const eIdx = candidateSet.find((c) =>
      /(エピローグ|終章|epilogue)/i.test(chapterTitles[c] ?? '')
    );
    if (eIdx !== undefined) return eIdx;
  }

  // 3. Explicit chapter number match
  const trackNum = extractChapterNumberFromLabel(stem);
  if (trackNum !== null) {
    const byNum = candidateSet.find((c) => {
      const titleNum = extractChapterNumberFromLabel(chapterTitles[c] ?? '');
      return titleNum === trackNum;
    });
    if (byNum !== undefined) return byNum;
  }

  return null;
}

function resolveTargetScope(
  syncBlocks: SyncParagraphMeta[],
  options: {
    durationSec: number;
    trackCount: number;
    trackIndex: number;
    trackName?: string;
    currentChapterIndex: number;
    chapterCount: number;
    chapterTitles?: string[];
    config: TrackSyncConfig;
  }
): {
  targetBlocks: SyncParagraphMeta[];
  resolvedScope: 'book' | 'chapter';
  resolvedChapterIndex: number;
} {
  const {
    durationSec,
    trackCount,
    trackIndex,
    trackName,
    currentChapterIndex,
    chapterCount,
    chapterTitles,
    config,
  } = options;
  const maxChap = Math.max(0, chapterCount - 1);
  const { storyChapterIndices, storyChapterSet, chapterWeights } =
    classifyStoryChapters(syncBlocks, chapterCount, chapterTitles);
  const storyBlocks =
    storyChapterSet.size > 0
      ? syncBlocks.filter((b) => storyChapterSet.has(b.chapterIndex))
      : syncBlocks;

  if (config.scope === 'book') {
    return {
      targetBlocks: storyBlocks.length > 0 ? storyBlocks : syncBlocks,
      resolvedScope: 'book',
      resolvedChapterIndex: currentChapterIndex,
    };
  }

  if (config.scope === 'chapter') {
    const ch = Math.max(0, Math.min(maxChap, config.chapterIndex));
    return {
      targetBlocks: syncBlocks.filter((b) => b.chapterIndex === ch),
      resolvedScope: 'chapter',
      resolvedChapterIndex: ch,
    };
  }

  // Multi-track automatic scope: match track name first, then map across story chapters (skipping Cover/TOC)
  if (trackCount > 1) {
    const namedMatch = matchTrackNameToChapter(
      trackName,
      storyChapterIndices,
      chapterTitles
    );
    if (namedMatch !== null) {
      return {
        targetBlocks: syncBlocks.filter((b) => b.chapterIndex === namedMatch),
        resolvedScope: 'chapter',
        resolvedChapterIndex: namedMatch,
      };
    }

    if (storyChapterIndices.length > 0) {
      const safeIdx = Math.max(0, Math.min(trackCount - 1, trackIndex));
      if (trackCount >= storyChapterIndices.length) {
        const mappedChap =
          storyChapterIndices[
            Math.min(storyChapterIndices.length - 1, safeIdx)
          ];
        return {
          targetBlocks: syncBlocks.filter((b) => b.chapterIndex === mappedChap),
          resolvedScope: 'chapter',
          resolvedChapterIndex: mappedChap,
        };
      }
      // Proportionally slice story chapters when audio has fewer parts than EPUB chapters
      const startPos = Math.floor(
        (safeIdx / trackCount) * storyChapterIndices.length
      );
      const endPos = Math.max(
        startPos + 1,
        Math.floor(((safeIdx + 1) / trackCount) * storyChapterIndices.length)
      );
      const sliceSet = new Set(storyChapterIndices.slice(startPos, endPos));
      return {
        targetBlocks: syncBlocks.filter((b) => sliceSet.has(b.chapterIndex)),
        resolvedScope: 'chapter',
        resolvedChapterIndex: storyChapterIndices[startPos],
      };
    }

    const ch = Math.max(0, Math.min(maxChap, Math.max(0, trackIndex)));
    return {
      targetBlocks: syncBlocks.filter((b) => b.chapterIndex === ch),
      resolvedScope: 'chapter',
      resolvedChapterIndex: ch,
    };
  }

  if (chapterCount <= 1 || storyChapterIndices.length <= 1) {
    const onlyChap = storyChapterIndices[0] ?? 0;
    return {
      targetBlocks: storyBlocks.length > 0 ? storyBlocks : syncBlocks,
      resolvedScope: 'book',
      resolvedChapterIndex: onlyChap,
    };
  }

  // Single-track multi-chapter book
  const activeChapCandidate = Math.max(0, Math.min(maxChap, currentChapterIndex));
  const namedChap = matchTrackNameToChapter(
    trackName,
    storyChapterIndices,
    chapterTitles
  );
  const preferredChap =
    namedChap !== null
      ? namedChap
      : storyChapterSet.has(activeChapCandidate)
        ? activeChapCandidate
        : (storyChapterIndices[0] ?? activeChapCandidate);

  const totalStoryWeight = storyBlocks.reduce((s, b) => s + b.speechWeight, 0);
  const maxChapWeight = storyChapterIndices.reduce(
    (mx, c) => Math.max(mx, chapterWeights[c] ?? 0),
    0
  );
  const preferredChapWeight = chapterWeights[preferredChap] ?? 0;

  const expectedBookSec = totalStoryWeight / DEFAULT_MORA_RATE;
  const expectedMaxChapSec = maxChapWeight / DEFAULT_MORA_RATE;
  const expectedPrefChapSec =
    (preferredChapWeight > 0
      ? preferredChapWeight
      : totalStoryWeight / Math.max(1, storyChapterIndices.length)) /
    DEFAULT_MORA_RATE;

  const looksLikeFullBook =
    durationSec > 0 &&
    (durationSec >= expectedBookSec * 0.35 ||
      (durationSec >= Math.max(expectedPrefChapSec, expectedMaxChapSec) * 1.65 &&
        durationSec >= 1200));

  if (looksLikeFullBook) {
    return {
      targetBlocks: storyBlocks.length > 0 ? storyBlocks : syncBlocks,
      resolvedScope: 'book',
      resolvedChapterIndex: preferredChap,
    };
  }

  return {
    targetBlocks: syncBlocks.filter((b) => b.chapterIndex === preferredChap),
    resolvedScope: 'chapter',
    resolvedChapterIndex: preferredChap,
  };
}

function evalCumSpeechAtTime(
  env: AudioSpeechEnvelope,
  timeSec: number
): number {
  const span = Math.max(0.01, env.speechEndSec - env.speechStartSec);
  const u = Math.min(1, Math.max(0, (timeSec - env.speechStartSec) / span));
  const grid = env.cumSpeechAtGrid;
  if (grid.length < 2) return u;
  const pos = u * (grid.length - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(grid.length - 1, i0 + 1);
  const alpha = pos - i0;
  return grid[i0] * (1 - alpha) + grid[i1] * alpha;
}

function invertCumSpeechValue(
  env: AudioSpeechEnvelope,
  cTarget: number
): number {
  const clamped = Math.min(1, Math.max(0, cTarget));
  const grid = env.cumSpeechAtGrid;
  const span = Math.max(0.01, env.speechEndSec - env.speechStartSec);
  if (grid.length < 2) {
    return env.speechStartSec + clamped * span;
  }

  let lo = 0;
  let hi = grid.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (grid[mid] <= clamped) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const c0 = grid[lo];
  const c1 = grid[hi];
  const localAlpha = c1 > c0 ? (clamped - c0) / (c1 - c0) : 0;
  const u = (lo + localAlpha) / (grid.length - 1);
  return env.speechStartSec + u * span;
}

function mapSpanTime(
  tA: number,
  tB: number,
  frac: number,
  env?: AudioSpeechEnvelope | null
): number {
  const f = Math.min(1, Math.max(0, frac));
  if (!env || env.cumSpeechAtGrid.length < 2) {
    return tA + (tB - tA) * f;
  }
  const cA = evalCumSpeechAtTime(env, tA);
  const cB = evalCumSpeechAtTime(env, tB);
  if (cB - cA <= 1e-5) {
    return tA + (tB - tA) * f;
  }
  return invertCumSpeechValue(env, cA + (cB - cA) * f);
}

function interpolateBlocksWithAnchors(
  speakable: SyncParagraphMeta[],
  anchors: SyncAnchorPoint[],
  durationSec: number,
  config?: TrackSyncConfig,
  speechEnvelope?: AudioSpeechEnvelope | null
): SyncTimelineSegment[] {
  const n = speakable.length;
  if (n === 0) return [];

  const totalWeight = speakable.reduce((s, b) => s + b.speechWeight, 0);
  const fallbackDur = Math.max(10, totalWeight / DEFAULT_MORA_RATE);
  const rawDuration = durationSec > 0 ? durationSec : fallbackDur;

  const effStart = clampNum(
    speechEnvelope?.speechStartSec ?? config?.speechStartSec ?? 0,
    0,
    0,
    Math.max(0, rawDuration - 2)
  );
  const effEnd = Math.max(
    effStart + 2,
    speechEnvelope?.speechEndSec ?? config?.speechEndSec ?? rawDuration
  );

  const naturalRate = clampNum(
    totalWeight / Math.max(10, effEnd - effStart),
    DEFAULT_MORA_RATE,
    MIN_MORA_RATE,
    MAX_MORA_RATE
  );

  const cumWeights = new Array<number>(n + 1);
  cumWeights[0] = 0;
  for (let i = 0; i < n; i++) {
    cumWeights[i + 1] = cumWeights[i] + speakable[i].speechWeight;
  }

  const globalToPos = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    globalToPos.set(speakable[i].globalIndex, i);
  }

  const rawPoints: Array<{ pos: number; timeSec: number }> = [];
  for (const a of anchors) {
    const pos = globalToPos.get(a.globalIndex);
    if (pos === undefined) continue;
    rawPoints.push({
      pos,
      timeSec: clampNum(a.timeSec, 0, 0, Math.max(rawDuration, a.timeSec)),
    });
  }
  rawPoints.sort((a, b) => a.pos - b.pos || a.timeSec - b.timeSec);

  const cleanKnots: Array<{ pos: number; timeSec: number }> = [];
  for (const pt of rawPoints) {
    if (cleanKnots.length === 0) {
      cleanKnots.push(pt);
    } else {
      const prev = cleanKnots[cleanKnots.length - 1];
      if (pt.pos > prev.pos && pt.timeSec >= prev.timeSec) {
        cleanKnots.push(pt);
      }
    }
  }

  // Case 0: Zero anchors -> full weight (+ VAD curve if available) across [effStart, effEnd]
  if (cleanKnots.length === 0) {
    const segments: SyncTimelineSegment[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const f0 = totalWeight > 0 ? cumWeights[i] / totalWeight : i / n;
      const f1 = totalWeight > 0 ? cumWeights[i + 1] / totalWeight : (i + 1) / n;
      const startSec = mapSpanTime(effStart, effEnd, f0, speechEnvelope);
      const endSec = Math.max(
        startSec,
        mapSpanTime(effStart, effEnd, f1, speechEnvelope)
      );
      segments[i] = {
        globalIndex: speakable[i].globalIndex,
        chapterIndex: speakable[i].chapterIndex,
        paraIndex: speakable[i].paraIndex,
        startSec,
        endSec,
      };
    }
    return segments;
  }

  const segments: SyncTimelineSegment[] = new Array(n);
  const firstKnot = cleanKnots[0];
  const lastKnot = cleanKnots[cleanKnots.length - 1];

  const calibratedOverallRate =
    cleanKnots.length >= 2 && lastKnot.timeSec > firstKnot.timeSec + 0.5
      ? clampNum(
          (cumWeights[lastKnot.pos] - cumWeights[firstKnot.pos]) /
            (lastKnot.timeSec - firstKnot.timeSec),
          naturalRate,
          MIN_MORA_RATE,
          MAX_MORA_RATE
        )
      : naturalRate;

  // 1. Extrapolate before first anchor using bounded rate (keeps 1-anchor calibration accurate!)
  if (firstKnot.pos > 0) {
    const preWeight = cumWeights[firstKnot.pos];
    const preRate = calibratedOverallRate;
    const estStart = Math.max(0, firstKnot.timeSec - preWeight / preRate);
    const useVad = speechEnvelope && firstKnot.timeSec - estStart > 1.5;
    for (let i = 0; i < firstKnot.pos; i++) {
      const f0 =
        preWeight > 0 ? cumWeights[i] / preWeight : i / firstKnot.pos;
      const f1 =
        preWeight > 0 ? cumWeights[i + 1] / preWeight : (i + 1) / firstKnot.pos;
      const startSec = useVad
        ? mapSpanTime(estStart, firstKnot.timeSec, f0, speechEnvelope)
        : Math.max(0, firstKnot.timeSec - (preWeight - cumWeights[i]) / preRate);
      const endSec = Math.max(
        startSec,
        useVad
          ? mapSpanTime(estStart, firstKnot.timeSec, f1, speechEnvelope)
          : Math.max(
              0,
              firstKnot.timeSec - (preWeight - cumWeights[i + 1]) / preRate
            )
      );
      segments[i] = {
        globalIndex: speakable[i].globalIndex,
        chapterIndex: speakable[i].chapterIndex,
        paraIndex: speakable[i].paraIndex,
        startSec,
        endSec,
      };
    }
  }

  // 2. Interpolate strictly between calibrated anchor pairs
  for (let k = 0; k < cleanKnots.length - 1; k++) {
    const a = cleanKnots[k];
    const b = cleanKnots[k + 1];
    const spanWeight = cumWeights[b.pos] - cumWeights[a.pos];
    const count = Math.max(1, b.pos - a.pos);

    for (let i = a.pos; i < b.pos; i++) {
      const f0 =
        spanWeight > 0
          ? (cumWeights[i] - cumWeights[a.pos]) / spanWeight
          : (i - a.pos) / count;
      const f1 =
        spanWeight > 0
          ? (cumWeights[i + 1] - cumWeights[a.pos]) / spanWeight
          : (i + 1 - a.pos) / count;
      const startSec = mapSpanTime(a.timeSec, b.timeSec, f0, speechEnvelope);
      const endSec = Math.max(
        startSec,
        mapSpanTime(a.timeSec, b.timeSec, f1, speechEnvelope)
      );
      segments[i] = {
        globalIndex: speakable[i].globalIndex,
        chapterIndex: speakable[i].chapterIndex,
        paraIndex: speakable[i].paraIndex,
        startSec,
        endSec,
      };
    }
  }

  // 3. Extrapolate from last anchor forward using calibrated rate (gently converging near effEnd)
  if (lastKnot.pos < n) {
    const postWeight = cumWeights[n] - cumWeights[lastKnot.pos];
    const remainingDur = Math.max(0, effEnd - lastKnot.timeSec);
    let postEnd = lastKnot.timeSec + postWeight / calibratedOverallRate;
    if (durationSec > 0 && remainingDur > 0) {
      const impliedRate = postWeight / remainingDur;
      if (impliedRate >= MIN_MORA_RATE && impliedRate <= MAX_MORA_RATE) {
        // Remaining audio cleanly fits natural human reading speed -> converge softly to speechEnd
        postEnd = postEnd * 0.35 + effEnd * 0.65;
      }
      postEnd = Math.min(Math.max(lastKnot.timeSec + 1, rawDuration), postEnd);
    }

    for (let i = lastKnot.pos; i < n; i++) {
      const f0 =
        postWeight > 0
          ? (cumWeights[i] - cumWeights[lastKnot.pos]) / postWeight
          : (i - lastKnot.pos) / (n - lastKnot.pos);
      const f1 =
        postWeight > 0
          ? (cumWeights[i + 1] - cumWeights[lastKnot.pos]) / postWeight
          : (i + 1 - lastKnot.pos) / (n - lastKnot.pos);
      const startSec = mapSpanTime(lastKnot.timeSec, postEnd, f0, speechEnvelope);
      const endSec = Math.max(
        startSec,
        mapSpanTime(lastKnot.timeSec, postEnd, f1, speechEnvelope)
      );
      segments[i] = {
        globalIndex: speakable[i].globalIndex,
        chapterIndex: speakable[i].chapterIndex,
        paraIndex: speakable[i].paraIndex,
        startSec,
        endSec,
      };
    }
  }

  return segments;
}

export function buildWeightedSyncTimeline(
  syncBlocks: SyncParagraphMeta[],
  options: {
    durationSec: number;
    trackCount: number;
    trackIndex: number;
    trackName?: string;
    currentChapterIndex: number;
    chapterCount: number;
    chapterTitles?: string[];
    config: TrackSyncConfig;
    speechEnvelope?: AudioSpeechEnvelope | null;
  }
): {
  segments: SyncTimelineSegment[];
  resolvedScope: 'book' | 'chapter';
  resolvedChapterIndex: number;
  targetBlocks: SyncParagraphMeta[];
} {
  const { targetBlocks, resolvedScope, resolvedChapterIndex } =
    resolveTargetScope(syncBlocks, options);
  const speakable = targetBlocks.filter((b) => b.speechWeight > 0);
  const segments = interpolateBlocksWithAnchors(
    speakable,
    options.config.anchors,
    options.durationSec,
    options.config,
    options.speechEnvelope
  );
  return {
    segments,
    resolvedScope,
    resolvedChapterIndex,
    targetBlocks: speakable,
  };
}

function parseTimestampSec(raw: string): number | null {
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

function cleanSubtitleCueText(raw: string): string {
  return raw
    .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, '')
    .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSubtitleTextToCues(rawText: string): SubtitleCue[] {
  const text = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const cues: SubtitleCue[] = [];

  // 1. Line-by-line SRT / VTT parser (resilient to whitespace blank lines or missing blank lines)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('-->')) continue;
    const arrowIdx = line.indexOf('-->');
    const leftPart = line.slice(0, arrowIdx).trim().split(/\s+/).pop() ?? '';
    const rightPart = line.slice(arrowIdx + 3).trim().split(/\s+/)[0] ?? '';
    const startSec = parseTimestampSec(leftPart);
    const endSec = parseTimestampSec(rightPart);
    if (startSec === null || endSec === null) continue;

    const collected: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
      const nextLine = lines[j];
      const trimmed = nextLine.trim();
      if (trimmed === '') break;
      if (nextLine.includes('-->')) break;
      if (
        /^\d+$/.test(trimmed) &&
        j + 1 < lines.length &&
        lines[j + 1].includes('-->')
      ) {
        break;
      }
      collected.push(trimmed);
      j++;
    }
    i = j - 1;

    const cueText = cleanSubtitleCueText(collected.join(' '));
    if (!cueText) continue;
    cues.push({
      startSec: Math.max(0, startSec),
      endSec: Math.max(startSec + 0.1, endSec),
      text: cueText,
    });
  }

  // 2. ASS / SSA Dialogue lines
  if (cues.length === 0) {
    for (const rawLine of lines) {
      if (!/^\s*dialogue\s*:/i.test(rawLine)) continue;
      const colonIdx = rawLine.indexOf(':');
      const body = rawLine.slice(colonIdx + 1);
      const parts = body.split(',');
      if (parts.length < 10) continue;
      const startSec = parseTimestampSec(parts[1]);
      const endSec = parseTimestampSec(parts[2]);
      if (startSec === null || endSec === null) continue;
      const dialogue = parts.slice(9).join(',').replace(/\\[Nn]/g, ' ');
      const cueText = cleanSubtitleCueText(dialogue);
      if (!cueText) continue;
      cues.push({
        startSec: Math.max(0, startSec),
        endSec: Math.max(startSec + 0.1, endSec),
        text: cueText,
      });
    }
  }

  // 3. Fallback: LRC [MM:SS.xx] (including multi-timestamp lines)
  if (cues.length === 0) {
    const lrcRaw: Array<{ startSec: number; text: string }> = [];
    const lrcTagRe = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    for (const line of lines) {
      const matches = Array.from(line.matchAll(lrcTagRe));
      if (matches.length === 0) continue;
      const lyric = cleanSubtitleCueText(line.replace(lrcTagRe, ''));
      if (!lyric) continue;
      for (const m of matches) {
        const mins = Number(m[1]);
        const secs = Number(m[2]);
        const sub = m[3] ? Number(m[3].padEnd(3, '0')) / 1000 : 0;
        const startSec = mins * 60 + secs + sub;
        lrcRaw.push({ startSec, text: lyric });
      }
    }

    lrcRaw.sort((a, b) => a.startSec - b.startSec);
    for (let k = 0; k < lrcRaw.length; k++) {
      const startSec = Math.max(0, lrcRaw[k].startSec);
      const endSec =
        k + 1 < lrcRaw.length
          ? Math.max(startSec + 0.1, lrcRaw[k + 1].startSec)
          : startSec + 5;
      cues.push({ startSec, endSec, text: lrcRaw[k].text });
    }
  }

  return cues.sort((a, b) => a.startSec - b.startSec);
}

export function findCueAtAudioTime(
  cues: SubtitleCue[],
  timeSec: number,
  offsetSec = 0
): { cue: SubtitleCue; index: number } | null {
  const n = cues.length;
  if (n === 0) return null;
  const effectiveTime = Math.max(0, timeSec + offsetSec);
  let lo = 0;
  let hi = n - 1;
  let lastStarted = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].startSec <= effectiveTime) {
      lastStarted = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const idx = lastStarted >= 0 ? lastStarted : 0;
  return { cue: cues[idx], index: idx };
}

function normalizeJaForMatch(raw: string): string {
  return katakanaToHiragana(raw.normalize('NFKC'))
    .replace(
      /[\s\u3000「」『』（）()【】［］[\]、。，．.,!！?？…―—\-~〜・:：;；"'’”]/g,
      ''
    )
    .toLowerCase();
}

function computeNormalizedSimilarity(aNorm: string, bNorm: string): number {
  if (!aNorm || !bNorm) return 0;
  if (aNorm.length >= 4 && (bNorm.includes(aNorm) || aNorm.includes(bNorm))) {
    return 0.92;
  }
  if (aNorm.length < 2 || bNorm.length < 2) {
    return aNorm[0] === bNorm[0] ? 0.45 : 0;
  }

  const bBigrams = new Set<string>();
  for (let i = 0; i < bNorm.length - 1; i++) {
    bBigrams.add(bNorm.slice(i, i + 2));
  }
  const aCount = aNorm.length - 1;
  let hits = 0;
  for (let i = 0; i < aCount; i++) {
    if (bBigrams.has(aNorm.slice(i, i + 2))) {
      hits += 1;
    }
  }
  return hits / aCount;
}

function computeDualJaSimilarity(
  cueNorm: string,
  paraSurfaceNorm: string,
  paraReadingNorm: string
): number {
  const s1 = computeNormalizedSimilarity(cueNorm, paraSurfaceNorm);
  const s2 =
    paraReadingNorm && paraReadingNorm !== paraSurfaceNorm
      ? computeNormalizedSimilarity(cueNorm, paraReadingNorm)
      : 0;
  return Math.max(s1, s2);
}

export interface BookSubtitleAlignmentResult {
  segments: SyncTimelineSegment[];
  matchedCount: number;
  totalCues: number;
  coveredChapters: number[];
  firstChapterIndex: number;
  lastChapterIndex: number;
}

export function alignSubtitlesToBook(
  allSyncBlocks: SyncParagraphMeta[],
  cues: SubtitleCue[],
  durationSec: number,
  extraAnchors: SyncAnchorPoint[] = [],
  speechEnvelope?: AudioSpeechEnvelope | null
): BookSubtitleAlignmentResult {
  const speakable = allSyncBlocks.filter((b) => b.speechWeight > 0);
  const sortedCues = [...cues].sort((a, b) => a.startSec - b.startSec);
  if (speakable.length === 0 || sortedCues.length === 0) {
    return {
      segments: [],
      matchedCount: 0,
      totalCues: sortedCues.length,
      coveredChapters: [],
      firstChapterIndex: 0,
      lastChapterIndex: 0,
    };
  }

  const n = speakable.length;
  const paraSurf = new Array<string>(n);
  const paraRead = new Array<string>(n);
  const cumWeights = new Array<number>(n + 1);
  cumWeights[0] = 0;

  const triIndex = new Map<string, number[]>();
  const biIndex = new Map<string, number[]>();

  const pushPosting = (map: Map<string, number[]>, key: string, p: number) => {
    let list = map.get(key);
    if (!list) {
      map.set(key, [p]);
    } else if (list[list.length - 1] !== p) {
      list.push(p);
    }
  };

  for (let p = 0; p < n; p++) {
    const s = normalizeJaForMatch(speakable[p].text);
    const r = normalizeJaForMatch(speakable[p].readingText || speakable[p].text);
    paraSurf[p] = s;
    paraRead[p] = r;
    cumWeights[p + 1] = cumWeights[p] + speakable[p].speechWeight;

    const forms = r && r !== s ? [s, r] : [s];
    for (const f of forms) {
      for (let k = 0; k <= f.length - 2; k++) {
        pushPosting(biIndex, f.slice(k, k + 2), p);
        if (k <= f.length - 3) {
          pushPosting(triIndex, f.slice(k, k + 3), p);
        }
      }
    }
  }

  interface CandidateHit {
    cueIdx: number;
    paraIdx: number;
    startSec: number;
    endSec: number;
    weight: number;
  }

  const hits: CandidateHit[] = [];
  const candVotes = new Map<number, number>();
  const MAX_TRI_DF = 80;
  const MAX_BI_DF = 120;

  for (let ci = 0; ci < sortedCues.length; ci++) {
    const cNorm = normalizeJaForMatch(sortedCues[ci].text);
    if (cNorm.length < 2) continue;

    candVotes.clear();
    for (let k = 0; k <= cNorm.length - 3; k++) {
      const list = triIndex.get(cNorm.slice(k, k + 3));
      if (list && list.length <= MAX_TRI_DF) {
        for (let t = 0; t < list.length; t++) {
          const p = list[t];
          candVotes.set(p, (candVotes.get(p) ?? 0) + 3);
        }
      }
    }
    for (let k = 0; k <= cNorm.length - 2; k++) {
      const list = biIndex.get(cNorm.slice(k, k + 2));
      if (list && list.length <= MAX_BI_DF) {
        for (let t = 0; t < list.length; t++) {
          const p = list[t];
          candVotes.set(p, (candVotes.get(p) ?? 0) + 1);
        }
      }
    }

    if (candVotes.size === 0) continue;

    const topCands = Array.from(candVotes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14);

    const minSim =
      cNorm.length >= 5 ? 0.34 : cNorm.length >= 3 ? 0.48 : 0.72;
    const lenFactor = Math.min(22, cNorm.length);

    const scored: Array<{ paraIdx: number; sim: number }> = [];
    for (const [p] of topCands) {
      const sim = computeDualJaSimilarity(cNorm, paraSurf[p], paraRead[p]);
      if (sim >= minSim) {
        scored.push({ paraIdx: p, sim });
      }
    }
    if (scored.length === 0) continue;

    scored.sort((a, b) => b.sim - a.sim);
    const keep = scored.slice(0, 6).sort((a, b) => a.paraIdx - b.paraIdx);
    for (const item of keep) {
      hits.push({
        cueIdx: ci,
        paraIdx: item.paraIdx,
        startSec: sortedCues[ci].startSec,
        endSec: sortedCues[ci].endSec,
        weight: item.sim * lenFactor,
      });
    }
  }

  if (hits.length === 0) {
    return {
      segments: [],
      matchedCount: 0,
      totalCues: sortedCues.length,
      coveredChapters: [],
      firstChapterIndex: 0,
      lastChapterIndex: 0,
    };
  }

  // Windowed Maximum-Weight Monotonic Chain DP
  const L = hits.length;
  const dpScore = new Float64Array(L);
  const parent = new Int32Array(L);
  parent.fill(-1);

  let bestEndIdx = 0;
  let bestEndScore = -1;

  for (let i = 0; i < L; i++) {
    const hi = hits[i];
    let bestScore = hi.weight;
    let bestPrev = -1;

    const lookStart = Math.max(0, i - 220);
    for (let j = i - 1; j >= lookStart; j--) {
      const hj = hits[j];
      if (hj.cueIdx === hi.cueIdx) continue;
      if (hj.paraIdx > hi.paraIdx) continue;
      if (hj.startSec > hi.startSec) continue;

      if (hi.paraIdx > hj.paraIdx) {
        const dw = cumWeights[hi.paraIdx] - cumWeights[hj.paraIdx];
        const dt = Math.max(0.5, hi.startSec - hj.startSec);
        const rate = dw / dt;
        if ((dw > 80 && rate > 35) || (dt > 20 && rate < 0.35)) continue;
      }

      const paraGap = hi.paraIdx - hj.paraIdx;
      const chapJump =
        speakable[hi.paraIdx].chapterIndex !== speakable[hj.paraIdx].chapterIndex;
      const bonus = paraGap <= 3 ? 0.5 : chapJump && paraGap > 25 ? -0.8 : 0;

      const candScore = dpScore[j] + hi.weight + bonus;
      if (candScore > bestScore) {
        bestScore = candScore;
        bestPrev = j;
      }
    }

    dpScore[i] = bestScore;
    parent[i] = bestPrev;
    if (bestScore > bestEndScore) {
      bestEndScore = bestScore;
      bestEndIdx = i;
    }
  }

  const chain: CandidateHit[] = [];
  let cur = bestEndIdx;
  while (cur !== -1) {
    chain.push(hits[cur]);
    cur = parent[cur];
  }
  chain.reverse();

  const paraMatchMap = new Map<
    number,
    { firstStartSec: number; lastEndSec: number }
  >();
  for (const h of chain) {
    const existing = paraMatchMap.get(h.paraIdx);
    if (!existing) {
      paraMatchMap.set(h.paraIdx, {
        firstStartSec: h.startSec,
        lastEndSec: h.endSec,
      });
    } else {
      existing.firstStartSec = Math.min(existing.firstStartSec, h.startSec);
      existing.lastEndSec = Math.max(existing.lastEndSec, h.endSec);
    }
  }

  const coveredChapSet = new Set<number>();
  paraMatchMap.forEach((_, p) => {
    coveredChapSet.add(speakable[p].chapterIndex);
  });
  const coveredChapters = Array.from(coveredChapSet).sort((a, b) => a - b);
  if (coveredChapters.length === 0) {
    return {
      segments: [],
      matchedCount: 0,
      totalCues: sortedCues.length,
      coveredChapters: [],
      firstChapterIndex: 0,
      lastChapterIndex: 0,
    };
  }

  const firstChapterIndex = coveredChapters[0];
  const lastChapterIndex = coveredChapters[coveredChapters.length - 1];
  const targetSpeakable = speakable.filter(
    (b) => b.chapterIndex >= firstChapterIndex && b.chapterIndex <= lastChapterIndex
  );

  const anchorByGlobal = new Map<number, SyncAnchorPoint>();
  paraMatchMap.forEach((info, p) => {
    const g = speakable[p].globalIndex;
    anchorByGlobal.set(g, { globalIndex: g, timeSec: info.firstStartSec });
  });
  for (const a of extraAnchors) {
    anchorByGlobal.set(a.globalIndex, a);
  }

  const maxCueSec = sortedCues[sortedCues.length - 1]?.endSec ?? 0;
  const effDur = durationSec > 0 ? durationSec : Math.max(10, maxCueSec + 2);

  const segments = interpolateBlocksWithAnchors(
    targetSpeakable,
    Array.from(anchorByGlobal.values()),
    effDur,
    undefined,
    speechEnvelope
  );

  return {
    segments,
    matchedCount: paraMatchMap.size,
    totalCues: sortedCues.length,
    coveredChapters,
    firstChapterIndex,
    lastChapterIndex,
  };
}

export function buildSubtitleAlignedTimeline(
  targetBlocks: SyncParagraphMeta[],
  cues: SubtitleCue[],
  durationSec: number,
  extraAnchors: SyncAnchorPoint[] = [],
  speechEnvelope?: AudioSpeechEnvelope | null
): SyncTimelineSegment[] {
  const speakable = targetBlocks.filter((b) => b.speechWeight > 0);
  if (speakable.length === 0) return [];
  if (cues.length === 0) {
    return interpolateBlocksWithAnchors(
      speakable,
      extraAnchors,
      durationSec,
      undefined,
      speechEnvelope
    );
  }
  const res = alignSubtitlesToBook(
    speakable,
    cues,
    durationSec,
    extraAnchors,
    speechEnvelope
  );
  if (res.matchedCount >= 1 && res.segments.length > 0) {
    return res.segments;
  }
  return interpolateBlocksWithAnchors(
    speakable,
    extraAnchors,
    durationSec,
    undefined,
    speechEnvelope
  );
}

export function findSegmentAtAudioTime(
  segments: SyncTimelineSegment[],
  timeSec: number,
  offsetSec = 0
): SyncTimelineSegment | null {
  const n = segments.length;
  if (n === 0) return null;
  const effectiveTime = Math.max(0, timeSec + offsetSec);

  let lo = 0;
  let hi = n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (effectiveTime < seg.startSec) {
      hi = mid - 1;
    } else if (effectiveTime > seg.endSec && mid < n - 1) {
      lo = mid + 1;
    } else {
      return seg;
    }
  }

  if (hi >= 0) return segments[hi];
  return segments[0];
}

export function findSegmentForParagraph(
  segments: SyncTimelineSegment[],
  chapterIndex: number,
  paraIndex: number
): SyncTimelineSegment | null {
  if (segments.length === 0) return null;
  const exact = segments.find(
    (s) => s.chapterIndex === chapterIndex && s.paraIndex === paraIndex
  );
  if (exact) return exact;

  // Fallback to closest speakable paragraph in that chapter (e.g. if user clicked an illustration)
  let fallback: SyncTimelineSegment | null = null;
  for (const seg of segments) {
    if (seg.chapterIndex === chapterIndex) {
      fallback = seg;
      if (seg.paraIndex >= paraIndex) return seg;
    }
  }
  return fallback;
}

// ==================== BROWSER AUDIO DECODE / VAD ENVELOPE ====================

const speechEnvelopeCache = new Map<string, AudioSpeechEnvelope>();

async function decodeAudioBlobOnce(blob: Blob): Promise<AudioBuffer> {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) {
    throw new Error('Browser ini tidak mendukung Web AudioContext.');
  }
  const ctx = new Ctx();
  try {
    const arr = await blob.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  } finally {
    void ctx.close().catch(() => {});
  }
}

export async function analyzeAudioSpeechEnvelope(
  blob: Blob,
  cacheKey?: string
): Promise<AudioSpeechEnvelope | null> {
  if (cacheKey && speechEnvelopeCache.has(cacheKey)) {
    return speechEnvelopeCache.get(cacheKey)!;
  }
  if (!blob || blob.size > MAX_FULL_DECODE_BYTES) return null;

  try {
    const audioBuf = await decodeAudioBlobOnce(blob);
    const dur = audioBuf.duration;
    if (!Number.isFinite(dur) || dur <= 1) return null;

    const sr = audioBuf.sampleRate;
    const chCount = Math.min(2, audioBuf.numberOfChannels);
    const channels = Array.from({ length: chCount }, (_, i) =>
      audioBuf.getChannelData(i)
    );
    const winSamples = Math.max(1, Math.round(sr * 0.1));
    const totalWins = Math.max(1, Math.ceil(audioBuf.length / winSamples));
    const rmsArr = new Float32Array(totalWins);

    for (let w = 0; w < totalWins; w++) {
      const s0 = w * winSamples;
      const s1 = Math.min(audioBuf.length, s0 + winSamples);
      const count = Math.max(1, s1 - s0);
      let sumSq = 0;
      const stride = Math.max(1, Math.floor(count / 240));
      let sampled = 0;
      for (let i = s0; i < s1; i += stride) {
        let v = 0;
        for (let c = 0; c < chCount; c++) {
          v += channels[c][i];
        }
        v /= chCount;
        sumSq += v * v;
        sampled++;
      }
      rmsArr[w] = Math.sqrt(sumSq / Math.max(1, sampled));
    }

    const sorted = Array.from(rmsArr).sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.12)] ?? 0;
    const peakRms = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const threshold = Math.max(0.004, noiseFloor * 2.4, peakRms * 0.06);

    let firstActive = 0;
    let foundFirst = false;
    for (let w = 0; w < totalWins; w++) {
      let run = 0;
      for (let k = w; k < Math.min(totalWins, w + 3); k++) {
        if (rmsArr[k] > threshold) run++;
      }
      if (run >= 2) {
        firstActive = w;
        foundFirst = true;
        break;
      }
    }
    if (!foundFirst) {
      firstActive = rmsArr.findIndex((v) => v > threshold);
      if (firstActive < 0) firstActive = 0;
    }

    let lastActive = totalWins - 1;
    for (let w = totalWins - 1; w >= firstActive; w--) {
      if (rmsArr[w] > threshold) {
        lastActive = w;
        break;
      }
    }

    const speechStartSec = Math.max(0, firstActive * 0.1 - 0.1);
    const speechEndSec = Math.min(
      dur,
      Math.max(speechStartSec + 1, (lastActive + 1) * 0.1 + 0.1)
    );

    const gridLen = 256;
    const cumSpeechAtGrid = new Array<number>(gridLen);
    let cum = 0;
    cumSpeechAtGrid[0] = 0;

    for (let g = 1; g < gridLen; g++) {
      const t0 =
        speechStartSec +
        ((g - 1) / (gridLen - 1)) * (speechEndSec - speechStartSec);
      const t1 =
        speechStartSec +
        (g / (gridLen - 1)) * (speechEndSec - speechStartSec);
      const w0 = Math.max(0, Math.floor(t0 / 0.1));
      const w1 = Math.min(totalWins - 1, Math.floor(t1 / 0.1));
      let activeSum = 0;
      let count = 0;
      for (let w = w0; w <= w1; w++) {
        const isSpoken = rmsArr[w] > threshold;
        activeSum += isSpoken ? 1.0 : 0.06;
        count++;
      }
      cum += activeSum / Math.max(1, count);
      cumSpeechAtGrid[g] = cum;
    }

    if (cum > 0) {
      for (let g = 0; g < gridLen; g++) {
        cumSpeechAtGrid[g] /= cum;
      }
    } else {
      for (let g = 0; g < gridLen; g++) {
        cumSpeechAtGrid[g] = g / (gridLen - 1);
      }
    }
    cumSpeechAtGrid[gridLen - 1] = 1;

    const result: AudioSpeechEnvelope = {
      durationSec: dur,
      speechStartSec,
      speechEndSec,
      cumSpeechAtGrid,
    };
    if (cacheKey) {
      speechEnvelopeCache.set(cacheKey, result);
    }
    return result;
  } catch {
    return null;
  }
}

// ==================== PURE DATAVIEW M4B / MP4 CHAPTER PARSER ====================

function readFourCc(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function parseChplBox(buf: ArrayBuffer, start: number, end: number): EmbeddedAudioChapter[] {
  const view = new DataView(buf);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  if (start + 9 > end) return [];

  const version = view.getUint8(start);
  let pos = start + 4; // skip version + 3-byte flags
  if (version === 1) {
    pos += 4; // reserved uint32 in Nero v1
  }
  if (pos >= end) return [];

  const count = view.getUint8(pos);
  pos += 1;
  if (count === 0) return [];

  const chapters: EmbeddedAudioChapter[] = [];
  for (let i = 0; i < count && pos + 9 <= end; i++) {
    const hi = view.getUint32(pos, false);
    const lo = view.getUint32(pos + 4, false);
    const ticks100Ns = hi * 4294967296 + lo;
    const startSec = ticks100Ns / 10_000_000;
    pos += 8;
    const titleLen = view.getUint8(pos);
    pos += 1;
    if (pos + titleLen > end) break;
    const title = decoder.decode(new Uint8Array(buf, pos, titleLen)).trim();
    pos += titleLen;
    if (Number.isFinite(startSec) && startSec >= 0 && startSec < 360000) {
      chapters.push({ startSec, title: title || `Bab ${i + 1}` });
    }
  }
  return chapters.sort((a, b) => a.startSec - b.startSec);
}

function scanContainerForChpl(
  buf: ArrayBuffer,
  start: number,
  end: number
): EmbeddedAudioChapter[] {
  const view = new DataView(buf);
  let pos = start;
  while (pos + 8 <= end) {
    const rawSize = view.getUint32(pos, false);
    const type = readFourCc(view, pos + 4);
    let headerSize = 8;
    let boxSize = rawSize;
    if (rawSize === 1 && pos + 16 <= end) {
      const hi = view.getUint32(pos + 8, false);
      const lo = view.getUint32(pos + 12, false);
      boxSize = hi * 4294967296 + lo;
      headerSize = 16;
    } else if (rawSize === 0) {
      boxSize = end - pos;
    }
    if (boxSize < headerSize || pos + boxSize > end) break;

    const bodyStart = pos + headerSize;
    const bodyEnd = pos + boxSize;
    if (type === 'chpl') {
      const found = parseChplBox(buf, bodyStart, bodyEnd);
      if (found.length > 0) return found;
    } else if (type === 'udta') {
      const found = scanContainerForChpl(buf, bodyStart, bodyEnd);
      if (found.length > 0) return found;
    } else if (type === 'meta' && bodyStart + 4 <= bodyEnd) {
      const found = scanContainerForChpl(buf, bodyStart + 4, bodyEnd);
      if (found.length > 0) return found;
    }
    pos = bodyEnd;
  }
  return [];
}

export async function extractMp4EmbeddedChapters(
  blob: Blob
): Promise<EmbeddedAudioChapter[]> {
  if (!blob || blob.size < 16) return [];
  try {
    let offset = 0;
    const limit = blob.size;
    while (offset + 8 <= limit) {
      const headerBuf = await blob
        .slice(offset, Math.min(limit, offset + 16))
        .arrayBuffer();
      if (headerBuf.byteLength < 8) break;
      const view = new DataView(headerBuf);
      const rawSize = view.getUint32(0, false);
      const type = readFourCc(view, 4);
      let headerSize = 8;
      let boxSize = rawSize;
      if (rawSize === 1 && headerBuf.byteLength >= 16) {
        const hi = view.getUint32(8, false);
        const lo = view.getUint32(12, false);
        boxSize = hi * 4294967296 + lo;
        headerSize = 16;
      } else if (rawSize === 0) {
        boxSize = limit - offset;
      }
      if (boxSize < headerSize || offset + boxSize > limit) break;

      if (type === 'moov') {
        if (boxSize > 25 * 1024 * 1024) return [];
        const moovBuf = await blob.slice(offset, offset + boxSize).arrayBuffer();
        return scanContainerForChpl(moovBuf, headerSize, moovBuf.byteLength);
      }
      offset += boxSize;
    }
  } catch {
    return [];
  }
  return [];
}

export function matchEmbeddedChaptersToAnchors(
  embedded: EmbeddedAudioChapter[],
  syncBlocks: SyncParagraphMeta[],
  chapterCount: number,
  chapterTitles?: string[]
): SyncAnchorPoint[] {
  if (embedded.length === 0 || syncBlocks.length === 0) return [];
  const { storyChapterIndices } = classifyStoryChapters(
    syncBlocks,
    chapterCount,
    chapterTitles
  );
  if (storyChapterIndices.length === 0) return [];

  const firstBlockByChap = new Map<number, SyncParagraphMeta>();
  for (const b of syncBlocks) {
    if (b.speechWeight > 0 && !firstBlockByChap.has(b.chapterIndex)) {
      firstBlockByChap.set(b.chapterIndex, b);
    }
  }

  const anchors: SyncAnchorPoint[] = [];
  const usedChaps = new Set<number>();

  // 1. Try matching embedded chapter titles against EPUB story chapters
  for (const emb of embedded) {
    const matchedChap = matchTrackNameToChapter(
      emb.title,
      storyChapterIndices,
      chapterTitles
    );
    if (matchedChap !== null && !usedChaps.has(matchedChap)) {
      const blk = firstBlockByChap.get(matchedChap);
      if (blk) {
        usedChaps.add(matchedChap);
        anchors.push({ globalIndex: blk.globalIndex, timeSec: emb.startSec });
      }
    }
  }

  // 2. If few titles matched, map sequentially onto story chapters (skipping intro chapter if +1 offset)
  if (anchors.length < 2) {
    anchors.length = 0;
    const filteredEmb = embedded.filter(
      (e) =>
        !/(opening|intro|cover|クレジット|タイトル|表紙)/i.test(e.title.trim())
    );
    const sourceEmb =
      filteredEmb.length >= storyChapterIndices.length ? filteredEmb : embedded;
    const count = Math.min(sourceEmb.length, storyChapterIndices.length);
    for (let i = 0; i < count; i++) {
      const blk = firstBlockByChap.get(storyChapterIndices[i]);
      if (blk) {
        anchors.push({
          globalIndex: blk.globalIndex,
          timeSec: sourceEmb[i].startSec,
        });
      }
    }
  }

  anchors.sort((a, b) => a.globalIndex - b.globalIndex);
  return anchors;
}

// ==================== WAV CHUNKING, LIVE CAPTURE & AI FORCED ALIGNMENT ====================

function writeAsciiToView(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeMonoWav12k(
  audioBuf: AudioBuffer,
  startSec: number,
  endSec: number
): Blob {
  const targetSr = 12000;
  const s0 = Math.max(0, Math.min(audioBuf.duration, startSec));
  const s1 = Math.max(s0 + 0.1, Math.min(audioBuf.duration, endSec));
  const outSamples = Math.max(1, Math.round((s1 - s0) * targetSr));
  const dataBytes = outSamples * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);

  writeAsciiToView(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAsciiToView(view, 8, 'WAVE');
  writeAsciiToView(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, targetSr, true);
  view.setUint32(28, targetSr * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAsciiToView(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const chCount = Math.min(2, audioBuf.numberOfChannels);
  const channels = Array.from({ length: chCount }, (_, i) =>
    audioBuf.getChannelData(i)
  );
  const srcSr = audioBuf.sampleRate;
  const maxSrcIdx = audioBuf.length - 1;

  let byteOffset = 44;
  for (let i = 0; i < outSamples; i++) {
    const t = s0 + i / targetSr;
    const fIdx = Math.min(maxSrcIdx, Math.max(0, t * srcSr));
    const idx0 = Math.floor(fIdx);
    const idx1 = Math.min(maxSrcIdx, idx0 + 1);
    const alpha = fIdx - idx0;

    let sample = 0;
    for (let c = 0; c < chCount; c++) {
      const chData = channels[c];
      sample += chData[idx0] * (1 - alpha) + chData[idx1] * alpha;
    }
    sample /= chCount;
    const clamped = Math.max(-1, Math.min(1, sample));
    const pcm = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    view.setInt16(byteOffset, pcm, true);
    byteOffset += 2;
  }

  return new Blob([buf], { type: 'audio/wav' });
}

type CaptureStreamAudioEl = HTMLAudioElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

async function captureLiveAudioClip(
  audioEl: HTMLAudioElement,
  durationMs = 6500
): Promise<Blob | null> {
  if (typeof MediaRecorder === 'undefined') return null;
  const el = audioEl as CaptureStreamAudioEl;
  try {
    const stream = el.captureStream?.() ?? el.mozCaptureStream?.();
    if (!stream || stream.getAudioTracks().length === 0) return null;

    const audioStream = new MediaStream(stream.getAudioTracks());
    const recorder = new MediaRecorder(audioStream);
    const chunks: Blob[] = [];

    return await new Promise<Blob | null>((resolve) => {
      let settled = false;
      const finish = (blob: Blob | null) => {
        if (settled) return;
        settled = true;
        resolve(blob);
      };

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };
      recorder.onerror = () => finish(null);
      recorder.onstop = () => {
        if (chunks.length === 0) {
          finish(null);
          return;
        }
        finish(
          new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        );
      };

      recorder.start(250);
      window.setTimeout(() => {
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        } catch {
          finish(null);
        }
      }, durationMs);
    });
  } catch {
    return null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = () => reject(new Error('Gagal membaca data audio.'));
    reader.readAsDataURL(blob);
  });
}

function isMp3Track(track: StoredAudiobookTrack): boolean {
  const mime = (track.mimeType || track.blob?.type || '').toLowerCase();
  const name = (track.name || '').toLowerCase();
  return mime.includes('mpeg') || mime.includes('mp3') || name.endsWith('.mp3');
}

function stripJsonCodeFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function callWhisperChunk(
  blob: Blob,
  fileName: string,
  settings: AiTtsSettings,
  signal?: AbortSignal
): Promise<SubtitleCue[]> {
  const openaiKey = settings.openaiApiKey.trim();
  const baseUrl = (
    settings.openaiBaseUrl.trim() || 'https://api.openai.com/v1'
  ).replace(/\/+$/, '');
  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('model', 'whisper-1');
  form.append('language', 'ja');
  form.append('response_format', 'verbose_json');

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`OpenAI Whisper gagal (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as {
    segments?: Array<{ start?: number; end?: number; text?: string }>;
    text?: string;
  };
  const cues = (json.segments ?? [])
    .filter(
      (s) =>
        typeof s.start === 'number' &&
        typeof s.end === 'number' &&
        typeof s.text === 'string' &&
        s.text.trim().length > 0
    )
    .map((s) => ({
      startSec: Math.max(0, s.start!),
      endSec: Math.max(s.start!, s.end!),
      text: s.text!.trim(),
    }));
  if (cues.length === 0 && typeof json.text === 'string' && json.text.trim()) {
    cues.push({ startSec: 0, endSec: 5, text: json.text.trim() });
  }
  return cues;
}

async function callGeminiForcedAlignChunk(
  blob: Blob,
  mimeType: string,
  candidates: Array<{ idx: number; text: string }>,
  chunkDurSec: number,
  settings: AiTtsSettings,
  signal?: AbortSignal
): Promise<Array<{ idx: number; startSec: number }>> {
  const geminiKey = settings.geminiApiKey.trim();
  const base64Audio = await blobToBase64(blob);
  const candidateLines = candidates
    .map((c) => `${c.idx}: ${c.text.slice(0, 95)}`)
    .join('\n');

  const prompt = `Listen to this Japanese audiobook excerpt (duration ~${chunkDurSec.toFixed(1)}s) and align it to the numbered novel paragraphs below.
For EVERY paragraph actually spoken in this audio clip, output its paragraph "idx" and the EXACT timestamp "startSec" (seconds from 0.0 at start of THIS audio clip) when the narrator begins reading that paragraph.
If a paragraph is not spoken in this clip, omit it.
Return ONLY a raw JSON array: [{"idx": number, "startSec": number}].

Paragraphs:
${candidateLines}`;

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini Audio Sync gagal (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ??
    '[]';
  const parsed = JSON.parse(stripJsonCodeFences(raw)) as Array<{
    idx?: number;
    startSec?: number;
  }>;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (item) =>
        typeof item.idx === 'number' &&
        Number.isFinite(item.idx) &&
        typeof item.startSec === 'number' &&
        Number.isFinite(item.startSec) &&
        item.startSec >= 0 &&
        item.startSec <= chunkDurSec + 3
    )
    .map((item) => ({
      idx: Math.round(item.idx!),
      startSec: Math.max(0, item.startSec!),
    }));
}

async function callGeminiSpotTranscript(
  blob: Blob,
  mimeType: string,
  settings: AiTtsSettings,
  signal?: AbortSignal
): Promise<string> {
  const geminiKey = settings.geminiApiKey.trim();
  const base64Audio = await blobToBase64(blob);
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
              {
                text: 'Transcribe verbatim ONLY the spoken Japanese words heard in this short audiobook clip. Output pure JSON object: {"transcript":"..."} with standard Japanese kanji/kana and no explanation.',
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini Audio Spot-Sync gagal (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ??
    '{}';
  const parsed = JSON.parse(stripJsonCodeFences(raw)) as {
    transcript?: string;
  };
  return (parsed.transcript ?? '').trim();
}

export async function alignTrackWithAi(
  track: StoredAudiobookTrack,
  targetBlocks: SyncParagraphMeta[],
  durationSec: number,
  settings: AiTtsSettings,
  onProgress?: (done: number, total: number, detail?: string) => void,
  signal?: AbortSignal,
  allSyncBlocks?: SyncParagraphMeta[]
): Promise<{ anchors: SyncAnchorPoint[]; cues: SubtitleCue[] }> {
  const geminiKey = settings.geminiApiKey.trim();
  const openaiKey = settings.openaiApiKey.trim();
  if (!geminiKey && !openaiKey) {
    throw new Error(
      'Masukkan API Key Google Gemini atau OpenAI di tab AI Narator untuk menggunakan Sinkron AI.'
    );
  }
  const preferOpenAi =
    Boolean(openaiKey) && (settings.provider === 'openai' || !geminiKey);

  const speakable = targetBlocks.filter((b) => b.speechWeight > 0);
  if (speakable.length === 0) {
    throw new Error('Tidak ada paragraf teks untuk disinkronkan.');
  }

  interface AudioChunkJob {
    chunkStartSec: number;
    chunkDurSec: number;
    blob: Blob;
    mimeType: string;
    fileName: string;
  }

  const jobs: AudioChunkJob[] = [];
  let expectedSpanSec = 0;

  if (
    track.kind === 'blob' &&
    track.blob &&
    track.blob.size <= MAX_FULL_DECODE_BYTES
  ) {
    onProgress?.(0, 1, 'Mendekode audio track...');
    const audioBuf = await decodeAudioBlobOnce(track.blob);
    const totalDur = audioBuf.duration;
    expectedSpanSec = Math.max(1, totalDur);
    const stepSec = 202; // 3m22s step + 8s overlap = 210s chunk (~5.0 MB WAV)
    const winSec = 210;
    for (let t = 0; t < totalDur; t += stepSec) {
      const end = Math.min(totalDur, t + winSec);
      if (end - t < 0.8 && t > 0) break;
      const wav = encodeMonoWav12k(audioBuf, t, end);
      jobs.push({
        chunkStartSec: t,
        chunkDurSec: end - t,
        blob: wav,
        mimeType: 'audio/wav',
        fileName: `chunk_${jobs.length}.wav`,
      });
    }
  } else if (
    track.kind === 'blob' &&
    track.blob &&
    isMp3Track(track) &&
    durationSec > 0
  ) {
    // Huge MP3 (> 45 MB): slice proportional MP3 byte window around targetBlocks (capped to 18 MB)
    const blob = track.blob;
    const allSpeak =
      allSyncBlocks && allSyncBlocks.length > 0
        ? allSyncBlocks.filter((b) => b.speechWeight > 0)
        : speakable;
    const totalAllW = allSpeak.reduce((s, b) => s + b.speechWeight, 0);
    const firstG = speakable[0].globalIndex;
    const lastG = speakable[speakable.length - 1].globalIndex;
    let wBefore = 0;
    let wTarget = 0;
    for (const b of allSpeak) {
      if (b.globalIndex < firstG) wBefore += b.speechWeight;
      else if (b.globalIndex <= lastG) wTarget += b.speechWeight;
    }

    let tStart =
      totalAllW > 0 ? Math.max(0, (wBefore / totalAllW - 0.03) * durationSec) : 0;
    let tEnd =
      totalAllW > 0
        ? Math.min(
            durationSec,
            ((wBefore + wTarget) / totalAllW + 0.03) * durationSec
          )
        : durationSec;
    expectedSpanSec = Math.max(1, tEnd - tStart);

    const maxBytesWindow = 18 * 1024 * 1024;
    let bStart = Math.floor((tStart / durationSec) * blob.size);
    let bEnd = Math.min(blob.size, Math.ceil((tEnd / durationSec) * blob.size));
    if (bEnd - bStart > maxBytesWindow) {
      bEnd = bStart + maxBytesWindow;
      tEnd = (bEnd / blob.size) * durationSec;
    }

    const sliceSize = 6 * 1024 * 1024;
    for (let b = bStart; b < bEnd; b += sliceSize) {
      const bNext = Math.min(bEnd, b + sliceSize);
      const cs = (b / blob.size) * durationSec;
      const ce = (bNext / blob.size) * durationSec;
      jobs.push({
        chunkStartSec: cs,
        chunkDurSec: Math.max(1, ce - cs),
        blob: blob.slice(b, bNext, 'audio/mpeg'),
        mimeType: 'audio/mpeg',
        fileName: `mp3_slice_${jobs.length}.mp3`,
      });
    }
  } else {
    throw new Error(
      'File audio non-MP3 di atas 45 MB atau URL streaming terlalu besar untuk Sinkron Penuh AI di browser. Gunakan tombol "AI Cari Posisi", "Pas Teks", atau unggah file subtitle (.srt / .vtt / .lrc).'
    );
  }

  if (jobs.length === 0) {
    throw new Error('Tidak ada segmen audio yang valid untuk disinkronkan.');
  }

  const totalTargetW = speakable.reduce((s, b) => s + b.speechWeight, 0);
  const cumTargetW = new Array<number>(speakable.length + 1);
  cumTargetW[0] = 0;
  for (let i = 0; i < speakable.length; i++) {
    cumTargetW[i + 1] = cumTargetW[i] + speakable[i].speechWeight;
  }

  const minJobT = jobs[0].chunkStartSec;
  const maxJobT =
    jobs[jobs.length - 1].chunkStartSec + jobs[jobs.length - 1].chunkDurSec;
  const jobsSpanT = Math.max(1, maxJobT - minJobT);

  if (preferOpenAi && openaiKey) {
    const allCues: SubtitleCue[] = [];
    for (let j = 0; j < jobs.length; j++) {
      if (signal?.aborted) throw new Error('Sinkronisasi AI dibatalkan.');
      const job = jobs[j];
      onProgress?.(
        j + 1,
        jobs.length,
        `Whisper bagian ${j + 1}/${jobs.length}...`
      );
      const chunkCues = await callWhisperChunk(
        job.blob,
        job.fileName,
        settings,
        signal
      );
      for (const c of chunkCues) {
        allCues.push({
          startSec: job.chunkStartSec + c.startSec,
          endSec: job.chunkStartSec + c.endSec,
          text: c.text,
        });
      }
    }
    if (allCues.length === 0) {
      throw new Error('Whisper tidak menghasilkan transkrip dari audio ini.');
    }
    const alignedSegs = buildSubtitleAlignedTimeline(
      speakable,
      allCues,
      durationSec > 0 ? durationSec : maxJobT
    );
    const step = Math.max(1, Math.floor(alignedSegs.length / 220));
    const anchors: SyncAnchorPoint[] = [];
    for (let i = 0; i < alignedSegs.length; i += step) {
      anchors.push({
        globalIndex: alignedSegs[i].globalIndex,
        timeSec: alignedSegs[i].startSec,
      });
    }
    if (alignedSegs.length > 0) {
      const lastSeg = alignedSegs[alignedSegs.length - 1];
      if (
        anchors[anchors.length - 1]?.globalIndex !== lastSeg.globalIndex
      ) {
        anchors.push({
          globalIndex: lastSeg.globalIndex,
          timeSec: lastSeg.startSec,
        });
      }
    }
    return { anchors, cues: allCues };
  }

  // Gemini Guided Forced Alignment per chunk
  const collectedMap = new Map<number, number>();
  for (let j = 0; j < jobs.length; j++) {
    if (signal?.aborted) throw new Error('Sinkronisasi AI dibatalkan.');
    const job = jobs[j];
    onProgress?.(
      j + 1,
      jobs.length,
      `Gemini melacak teks bagian ${j + 1}/${jobs.length}...`
    );

    const spanForFrac = expectedSpanSec > 0 ? expectedSpanSec : jobsSpanT;
    const fracStart = Math.max(
      0,
      (job.chunkStartSec - minJobT) / spanForFrac - 0.12
    );
    const fracEnd = Math.min(
      1,
      (job.chunkStartSec + job.chunkDurSec - minJobT) / spanForFrac + 0.12
    );
    const targetW0 = fracStart * totalTargetW;
    const targetW1 = fracEnd * totalTargetW;

    let iStart = cumTargetW.findIndex((w) => w >= targetW0);
    if (iStart < 0) iStart = 0;
    let iEnd = cumTargetW.findIndex((w) => w >= targetW1);
    if (iEnd < 0) iEnd = speakable.length;

    iStart = Math.max(0, iStart - 15);
    iEnd = Math.min(speakable.length, iEnd + 15);
    if (iEnd - iStart > 150) {
      iEnd = iStart + 150;
    }

    const candidates: Array<{ idx: number; text: string }> = [];
    for (let i = iStart; i < iEnd; i++) {
      candidates.push({ idx: i, text: speakable[i].text });
    }
    if (candidates.length === 0) continue;

    const alignedChunk = await callGeminiForcedAlignChunk(
      job.blob,
      job.mimeType,
      candidates,
      job.chunkDurSec,
      settings,
      signal
    );
    for (const hit of alignedChunk) {
      if (hit.idx < 0 || hit.idx >= speakable.length) continue;
      const absTime = job.chunkStartSec + hit.startSec;
      const prevTime = collectedMap.get(hit.idx);
      if (prevTime === undefined || absTime < prevTime) {
        collectedMap.set(hit.idx, absTime);
      }
    }
  }

  const rawPairs = Array.from(collectedMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pos, timeSec]) => ({ pos, timeSec }));

  const cleanAnchors: SyncAnchorPoint[] = [];
  let prevPos = -1;
  let prevTime = -1;
  for (const pt of rawPairs) {
    if (prevPos === -1) {
      cleanAnchors.push({
        globalIndex: speakable[pt.pos].globalIndex,
        timeSec: pt.timeSec,
      });
      prevPos = pt.pos;
      prevTime = pt.timeSec;
      continue;
    }
    if (pt.timeSec < prevTime) continue;
    const dw = cumTargetW[pt.pos] - cumTargetW[prevPos];
    const dt = pt.timeSec - prevTime;
    const rate = dt > 0.25 ? dw / dt : 999;
    if (rate >= 1.2 && rate <= 22.0) {
      cleanAnchors.push({
        globalIndex: speakable[pt.pos].globalIndex,
        timeSec: pt.timeSec,
      });
      prevPos = pt.pos;
      prevTime = pt.timeSec;
    }
  }

  if (cleanAnchors.length === 0) {
    throw new Error(
      'AI tidak menemukan kecocokan paragraf di audio track ini. Pastikan cakupan (Bab / Seluruh Buku) sudah sesuai dengan isi audio.'
    );
  }

  return { anchors: cleanAnchors, cues: [] };
}

export async function spotSyncAudioAtCurrentTimeWithAi(params: {
  track: StoredAudiobookTrack;
  audioEl: HTMLAudioElement | null;
  currentTimeSec: number;
  durationSec: number;
  allSyncBlocks: SyncParagraphMeta[];
  settings: AiTtsSettings;
  signal?: AbortSignal;
}): Promise<{
  block: SyncParagraphMeta;
  timeSec: number;
  transcript: string;
  confidence: number;
}> {
  const {
    track,
    audioEl,
    currentTimeSec,
    durationSec,
    allSyncBlocks,
    settings,
    signal,
  } = params;

  const geminiKey = settings.geminiApiKey.trim();
  const openaiKey = settings.openaiApiKey.trim();
  if (!geminiKey && !openaiKey) {
    throw new Error(
      'Masukkan API Key Google Gemini (gratis) atau OpenAI di tab AI Narator untuk menggunakan AI Cari Posisi.'
    );
  }

  const speakable = allSyncBlocks.filter((b) => b.speechWeight > 0);
  if (speakable.length === 0) {
    throw new Error('Tidak ada paragraf teks novel untuk dicocokkan.');
  }

  let clipBlob: Blob | null = null;
  let clipMime = 'audio/wav';
  let clipName = 'spot_sync.wav';

  if (
    track.kind === 'blob' &&
    track.blob &&
    track.blob.size <= MAX_FULL_DECODE_BYTES
  ) {
    const audioBuf = await decodeAudioBlobOnce(track.blob);
    const s0 = Math.max(0, Math.min(audioBuf.duration - 1, currentTimeSec - 0.5));
    const s1 = Math.min(audioBuf.duration, s0 + 11.5);
    clipBlob = encodeMonoWav12k(audioBuf, s0, s1);
  } else if (
    track.kind === 'blob' &&
    track.blob &&
    isMp3Track(track) &&
    durationSec > 0
  ) {
    const s0 = Math.max(0, currentTimeSec - 1);
    const s1 = Math.min(durationSec, currentTimeSec + 12);
    const b0 = Math.floor((s0 / durationSec) * track.blob.size);
    const b1 = Math.min(
      track.blob.size,
      Math.ceil((s1 / durationSec) * track.blob.size)
    );
    if (b1 > b0 + 4096) {
      clipBlob = track.blob.slice(b0, b1, 'audio/mpeg');
      clipMime = 'audio/mpeg';
      clipName = 'spot_sync.mp3';
    }
  } else if (audioEl && !audioEl.paused) {
    const liveBlob = await captureLiveAudioClip(audioEl, 6500);
    if (liveBlob) {
      clipBlob = liveBlob;
      clipMime = liveBlob.type || 'audio/webm';
      clipName = 'spot_sync.webm';
    }
  }

  if (!clipBlob) {
    throw new Error(
      'Putar file audio (atau gunakan file MP3 / audio ≤ 45 MB) agar AI bisa mendengarkan cuplikan suara sekarang.'
    );
  }

  const preferOpenAi =
    Boolean(openaiKey) && (settings.provider === 'openai' || !geminiKey);

  let transcript = '';
  if (preferOpenAi && openaiKey) {
    const cues = await callWhisperChunk(clipBlob, clipName, settings, signal);
    transcript = cues.map((c) => c.text).join(' ').trim();
  } else {
    transcript = await callGeminiSpotTranscript(clipBlob, clipMime, settings, signal);
  }

  const transNorm = normalizeJaForMatch(transcript);
  if (transNorm.length < 3) {
    throw new Error(
      'AI tidak mendengar ucapan bahasa Jepang di detik audio ini. Geser ke bagian berdialog/narasi lalu coba lagi.'
    );
  }

  // Build bigram set of spoken transcript to measure containment inside single or 2-paragraph windows
  const transBigrams = new Set<string>();
  for (let i = 0; i < transNorm.length - 1; i++) {
    transBigrams.add(transNorm.slice(i, i + 2));
  }

  const scoreAgainst = (candNorm: string): number => {
    if (!candNorm) return 0;
    if (
      transNorm.length >= 6 &&
      candNorm.includes(transNorm)
    ) {
      return 0.96;
    }
    if (
      candNorm.length >= 6 &&
      transNorm.includes(candNorm)
    ) {
      return 0.88 * Math.min(1, candNorm.length / Math.min(18, transNorm.length));
    }
    if (candNorm.length < 2 || transBigrams.size === 0) return 0;
    const candBigrams = new Set<string>();
    for (let i = 0; i < candNorm.length - 1; i++) {
      candBigrams.add(candNorm.slice(i, i + 2));
    }
    let hits = 0;
    candBigrams.forEach((bg) => {
      if (transBigrams.has(bg)) hits++;
    });
    const transRecall = hits / transBigrams.size;
    const candPrecision = hits / Math.max(1, candBigrams.size);
    return 0.65 * transRecall + 0.35 * candPrecision;
  };

  let bestScore = 0;
  let bestBlock = speakable[0];

  const surfNorms = speakable.map((b) => normalizeJaForMatch(b.text));
  const readNorms = speakable.map((b) =>
    normalizeJaForMatch(b.readingText || b.text)
  );

  for (let i = 0; i < speakable.length; i++) {
    let sc = Math.max(scoreAgainst(surfNorms[i]), scoreAgainst(readNorms[i]));
    if (i + 1 < speakable.length && surfNorms[i].length < 40) {
      const winSurf = surfNorms[i] + surfNorms[i + 1];
      const winRead = readNorms[i] + readNorms[i + 1];
      sc = Math.max(
        sc,
        0.95 * Math.max(scoreAgainst(winSurf), scoreAgainst(winRead))
      );
    }
    if (sc > bestScore) {
      bestScore = sc;
      bestBlock = speakable[i];
    }
  }

  if (bestScore < 0.25) {
    throw new Error(
      `AI mendengar「${transcript.slice(0, 32)}…」tapi belum cocok yakin dengan teks novel.`
    );
  }

  return {
    block: bestBlock,
    timeSec: currentTimeSec,
    transcript,
    confidence: bestScore,
  };
}

// Backwards-compatible helper preserved for direct cue callers
export async function transcribeAudioCuesWithAi(
  track: StoredAudiobookTrack,
  settings: AiTtsSettings,
  signal?: AbortSignal
): Promise<SubtitleCue[]> {
  const res = await alignTrackWithAi(track, [], 0, settings, undefined, signal);
  return res.cues;
}
