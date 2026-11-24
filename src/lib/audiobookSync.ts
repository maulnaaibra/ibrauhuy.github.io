import type { AiTtsSettings, StoredAudiobookTrack } from './audiobookEngine';
import type { StoredNovelChapter } from './epubReaderStore';

export interface SyncParagraphMeta {
  globalIndex: number;
  chapterIndex: number;
  paraIndex: number;
  text: string;
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

export interface TrackSyncConfig {
  scope: 'auto' | 'book' | 'chapter';
  chapterIndex: number;
  offsetSec: number;
  anchors: SyncAnchorPoint[];
  cues?: SubtitleCue[];
  cueSource?: 'subtitle' | 'ai';
}

export interface GlobalTrackingPrefs {
  liveTracking: boolean;
  autoFollow: boolean;
  clickToJump: boolean;
}

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

function clampNum(val: unknown, fallback: number, min: number, max: number): number {
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
    return {
      scope,
      chapterIndex: Math.max(0, Math.round(entry.chapterIndex ?? defaultChapter)),
      offsetSec: clampNum(entry.offsetSec, 0, -300, 300),
      anchors,
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
      ...(config.cues && config.cues.length > 0
        ? { cues: config.cues.slice(0, 10000), cueSource: config.cueSource }
        : {}),
    };
    localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
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

function extractCleanSpeakText(el: Element): {
  text: string;
  charCount: number;
} {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('rt, rp, script, style').forEach((n) => n.remove());
  const raw = clone.textContent ?? '';
  const charCount = raw.replace(/\s+/g, '').length;
  const text = raw.replace(/\s+/g, ' ').trim();
  return { text, charCount };
}

function computeSpeechWeight(text: string, charCount: number): number {
  if (charCount <= 0) return 0;
  let sentenceStops = 0;
  let commaStops = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '。' || ch === '！' || ch === '？' || ch === '!' || ch === '?') {
      sentenceStops += 1;
    } else if (
      ch === '、' ||
      ch === '…' ||
      ch === '―' ||
      ch === '—' ||
      ch === '，'
    ) {
      commaStops += 1;
    }
  }
  return charCount + sentenceStops * 2.5 + commaStops * 1.2 + 3.0;
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
      const { text, charCount } = extractCleanSpeakText(el);
      if (charCount === 0 && !hasMedia) return;

      const paraIdx = paraCounter++;
      const globalIdx = globalCounter++;
      const isMediaOnly = charCount === 0 && hasMedia;

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
        charCount,
        speechWeight: isMediaOnly ? 0 : computeSpeechWeight(text, charCount),
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

function resolveTargetScope(
  syncBlocks: SyncParagraphMeta[],
  options: {
    durationSec: number;
    trackCount: number;
    trackIndex: number;
    currentChapterIndex: number;
    chapterCount: number;
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
    currentChapterIndex,
    chapterCount,
    config,
  } = options;
  const maxChap = Math.max(0, chapterCount - 1);

  if (config.scope === 'book') {
    return {
      targetBlocks: syncBlocks,
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

  // Automatic scope detection
  if (trackCount > 1) {
    const ch = Math.max(0, Math.min(maxChap, Math.max(0, trackIndex)));
    return {
      targetBlocks: syncBlocks.filter((b) => b.chapterIndex === ch),
      resolvedScope: 'chapter',
      resolvedChapterIndex: ch,
    };
  }

  if (chapterCount <= 1) {
    return {
      targetBlocks: syncBlocks,
      resolvedScope: 'book',
      resolvedChapterIndex: 0,
    };
  }

  const activeChap = Math.max(0, Math.min(maxChap, currentChapterIndex));
  const activeChapChars = syncBlocks
    .filter((b) => b.chapterIndex === activeChap)
    .reduce((sum, b) => sum + b.charCount, 0);
  const avgChapChars =
    syncBlocks.reduce((sum, b) => sum + b.charCount, 0) /
    Math.max(1, chapterCount);
  const referenceChars = activeChapChars > 0 ? activeChapChars : avgChapChars;

  // Normal Japanese narration is ~5.5 chars/sec; if audio exceeds ~chapterChars / 2.2, assume full-book file
  if (durationSec > 0 && referenceChars > 0 && durationSec > referenceChars / 2.2) {
    return {
      targetBlocks: syncBlocks,
      resolvedScope: 'book',
      resolvedChapterIndex: activeChap,
    };
  }

  return {
    targetBlocks: syncBlocks.filter((b) => b.chapterIndex === activeChap),
    resolvedScope: 'chapter',
    resolvedChapterIndex: activeChap,
  };
}

function interpolateBlocksWithAnchors(
  speakable: SyncParagraphMeta[],
  anchors: SyncAnchorPoint[],
  durationSec: number
): SyncTimelineSegment[] {
  const n = speakable.length;
  if (n === 0) return [];

  const totalNaturalSec =
    durationSec > 0
      ? durationSec
      : Math.max(
          10,
          speakable.reduce((s, b) => s + b.speechWeight, 0) / 5.5
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
      timeSec: Math.max(0, Math.min(totalNaturalSec, a.timeSec)),
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

  if (cleanKnots.length === 0 || cleanKnots[0].pos > 0) {
    const firstTime =
      cleanKnots.length > 0 ? Math.min(0, cleanKnots[0].timeSec) : 0;
    cleanKnots.unshift({ pos: 0, timeSec: firstTime });
  }
  const lastKnot = cleanKnots[cleanKnots.length - 1];
  if (lastKnot.pos < n) {
    cleanKnots.push({
      pos: n,
      timeSec: Math.max(lastKnot.timeSec, totalNaturalSec),
    });
  }

  const segments: SyncTimelineSegment[] = new Array(n);
  for (let k = 0; k < cleanKnots.length - 1; k++) {
    const a = cleanKnots[k];
    const b = cleanKnots[k + 1];
    const spanSec = Math.max(0, b.timeSec - a.timeSec);
    const spanWeight = cumWeights[b.pos] - cumWeights[a.pos];
    const count = Math.max(1, b.pos - a.pos);

    for (let i = a.pos; i < b.pos; i++) {
      const frac0 =
        spanWeight > 0
          ? (cumWeights[i] - cumWeights[a.pos]) / spanWeight
          : (i - a.pos) / count;
      const frac1 =
        spanWeight > 0
          ? (cumWeights[i + 1] - cumWeights[a.pos]) / spanWeight
          : (i + 1 - a.pos) / count;
      const startSec = a.timeSec + spanSec * frac0;
      const endSec = Math.max(startSec, a.timeSec + spanSec * frac1);
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
    currentChapterIndex: number;
    chapterCount: number;
    config: TrackSyncConfig;
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
    options.durationSec
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
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSubtitleTextToCues(rawText: string): SubtitleCue[] {
  const text = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const cues: SubtitleCue[] = [];

  // 1. Try SRT / VTT cue blocks first
  const blocks = text.split(/\n{2,}/);
  for (const blk of blocks) {
    const lines = blk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    const timingIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingIdx === -1) continue;
    const [left, right] = lines[timingIdx].split('-->');
    if (!left || !right) continue;
    const startSec = parseTimestampSec(left.trim().split(/\s+/)[0]);
    const endSec = parseTimestampSec(right.trim().split(/\s+/)[0]);
    if (startSec === null || endSec === null) continue;
    const cueText = cleanSubtitleCueText(lines.slice(timingIdx + 1).join(' '));
    if (!cueText) continue;
    cues.push({
      startSec: Math.max(0, startSec),
      endSec: Math.max(startSec, endSec),
      text: cueText,
    });
  }

  if (cues.length > 0) {
    return cues.sort((a, b) => a.startSec - b.startSec);
  }

  // 2. Fallback: LRC [MM:SS.xx] lines
  const lrcLines = text.split('\n');
  const lrcRaw: Array<{ startSec: number; text: string }> = [];
  const lrcRe = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/;
  for (const line of lrcLines) {
    const m = line.match(lrcRe);
    if (!m) continue;
    const mins = Number(m[1]);
    const secs = Number(m[2]);
    const sub = m[3] ? Number(m[3].padEnd(3, '0')) / 1000 : 0;
    const startSec = mins * 60 + secs + sub;
    const cueText = cleanSubtitleCueText(
      line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '')
    );
    if (!cueText) continue;
    lrcRaw.push({ startSec, text: cueText });
  }

  lrcRaw.sort((a, b) => a.startSec - b.startSec);
  for (let i = 0; i < lrcRaw.length; i++) {
    const startSec = lrcRaw[i].startSec;
    const endSec =
      i + 1 < lrcRaw.length ? Math.max(startSec, lrcRaw[i + 1].startSec) : startSec + 5;
    cues.push({ startSec, endSec, text: lrcRaw[i].text });
  }

  return cues;
}

function normalizeJaForMatch(raw: string): string {
  return raw
    .replace(
      /[\s\u3000「」『』（）()【】［］[\]、。，．.,!！?？…―—\-~〜・:：;；"'’”]/g,
      ''
    )
    .toLowerCase();
}

function computeJaSimilarity(cueNorm: string, paraNorm: string): number {
  if (!cueNorm || !paraNorm) return 0;
  if (
    cueNorm.length >= 4 &&
    (paraNorm.includes(cueNorm) || cueNorm.includes(paraNorm))
  ) {
    return 0.9;
  }
  if (cueNorm.length < 2 || paraNorm.length < 2) {
    return cueNorm[0] === paraNorm[0] ? 0.5 : 0;
  }

  const paraBigrams = new Set<string>();
  for (let i = 0; i < paraNorm.length - 1; i++) {
    paraBigrams.add(paraNorm.slice(i, i + 2));
  }
  const cueCount = cueNorm.length - 1;
  let hits = 0;
  for (let i = 0; i < cueCount; i++) {
    if (paraBigrams.has(cueNorm.slice(i, i + 2))) {
      hits += 1;
    }
  }
  return hits / cueCount;
}

export function buildSubtitleAlignedTimeline(
  targetBlocks: SyncParagraphMeta[],
  cues: SubtitleCue[],
  durationSec: number,
  extraAnchors: SyncAnchorPoint[] = []
): SyncTimelineSegment[] {
  const speakable = targetBlocks.filter((b) => b.speechWeight > 0);
  if (speakable.length === 0) return [];
  if (cues.length === 0) {
    return interpolateBlocksWithAnchors(speakable, extraAnchors, durationSec);
  }

  const paraNorms = speakable.map((b) => normalizeJaForMatch(b.text));
  const sortedCues = [...cues].sort((a, b) => a.startSec - b.startSec);

  const alignedAnchors: SyncAnchorPoint[] = [];
  let cursorP = 0;

  for (const cue of sortedCues) {
    const cueNorm = normalizeJaForMatch(cue.text);
    if (cueNorm.length < 2) continue;

    const searchLimit = Math.min(speakable.length, cursorP + 28);
    let bestScore = 0;
    let bestP = -1;

    for (let p = cursorP; p < searchLimit; p++) {
      const score = computeJaSimilarity(cueNorm, paraNorms[p]);
      if (score > bestScore) {
        bestScore = score;
        bestP = p;
      }
    }

    if (bestP !== -1 && bestScore >= 0.34) {
      alignedAnchors.push({
        globalIndex: speakable[bestP].globalIndex,
        timeSec: cue.startSec,
      });
      cursorP = bestP + 1;
      if (cursorP >= speakable.length) break;
    }
  }

  const mergedAnchors = [...alignedAnchors, ...extraAnchors];
  return interpolateBlocksWithAnchors(speakable, mergedAnchors, durationSec);
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file audio.'));
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudioCuesWithAi(
  track: StoredAudiobookTrack,
  settings: AiTtsSettings,
  signal?: AbortSignal
): Promise<SubtitleCue[]> {
  if (track.kind !== 'blob' || !track.blob) {
    throw new Error(
      'Sinkronisasi AI membutuhkan file audio lokal yang diunggah (bukan URL eksternal).'
    );
  }
  if (track.blob.size > 20 * 1024 * 1024) {
    throw new Error(
      'Ukuran file audio maksimal 20 MB untuk Sinkron AI. Untuk file lebih besar, gunakan file subtitle (.srt / .vtt / .lrc) atau kalibrasi manual (Shift+Klik).'
    );
  }

  const geminiKey = settings.geminiApiKey.trim();
  const openaiKey = settings.openaiApiKey.trim();
  const preferOpenAi =
    Boolean(openaiKey) && (settings.provider === 'openai' || !geminiKey);

  if (preferOpenAi && openaiKey) {
    const baseUrl = (
      settings.openaiBaseUrl.trim() || 'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    const form = new FormData();
    form.append('file', track.blob, track.name || 'audiobook.mp3');
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
    if (cues.length === 0) {
      throw new Error('Whisper tidak menghasilkan segmen waktu audio.');
    }
    return cues;
  }

  if (geminiKey) {
    const base64Audio = await blobToBase64(track.blob);
    const mimeType = track.mimeType || track.blob.type || 'audio/mpeg';
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
                  text: 'Transcribe this Japanese audiobook audio chronologically into a JSON array of segments with exact startSec, endSec (in seconds), and text (Japanese transcript). Return ONLY raw JSON array like [{"startSec":0,"endSec":4.5,"text":"..."}].',
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
      throw new Error(`Gemini Audio Sync gagal (HTTP ${res.status}).`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const rawJson =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';
    const cleaned = rawJson
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as Array<{
      startSec?: number;
      endSec?: number;
      text?: string;
    }>;
    if (!Array.isArray(parsed)) {
      throw new Error('Format hasil sinkronisasi Gemini tidak valid.');
    }
    const cues = parsed
      .filter(
        (c) =>
          typeof c.startSec === 'number' &&
          typeof c.text === 'string' &&
          c.text.trim().length > 0
      )
      .map((c) => ({
        startSec: Math.max(0, c.startSec!),
        endSec: Math.max(c.startSec!, typeof c.endSec === 'number' ? c.endSec : c.startSec! + 3),
        text: c.text!.trim(),
      }));
    if (cues.length === 0) {
      throw new Error('Gemini tidak menemukan teks ucapan Jepang di audio ini.');
    }
    return cues;
  }

  throw new Error(
    'Masukkan API Key Google Gemini atau OpenAI di tab AI Narator untuk menggunakan Sinkron AI.'
  );
}
