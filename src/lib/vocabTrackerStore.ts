import {
  detectJapaneseDecks,
  invokeAnki,
  loadAnkiSettings,
} from './ankiConnect';
import { loadCompanionSettings } from './companionClient';
import {
  getCoreParticleSet,
  type PitchAccentPattern,
} from './japaneseCoreLexicon';
import { tokenizeJapaneseText } from './japaneseTextAnalyzer';

export type VocabStatus = 'new' | 'learning' | 'due' | 'known' | 'ignored';

export interface VocabEntry {
  status: VocabStatus;
  customPitchPattern?: PitchAccentPattern;
  customPitchNum?: number;
  customMeaning?: string;
  updatedAt: number;
}

export type VocabDictionaryMap = Record<string, VocabEntry>;

const VOCAB_STORAGE_KEY = 'immersiontrack_vocab_status_v1';
export const VOCAB_CHANGED_EVENT = 'immersiontrack:vocab-changed';

let memoryCache: VocabDictionaryMap | null = null;

function isValidStatus(v: unknown): v is VocabStatus {
  return (
    v === 'new' ||
    v === 'learning' ||
    v === 'due' ||
    v === 'known' ||
    v === 'ignored'
  );
}

function isValidPitchPattern(v: unknown): v is PitchAccentPattern {
  return (
    v === 'heiban' ||
    v === 'atamadaka' ||
    v === 'nakadaka' ||
    v === 'odaka' ||
    v === 'unknown'
  );
}

export function loadVocabStore(): VocabDictionaryMap {
  if (memoryCache) return memoryCache;
  const out: VocabDictionaryMap = {};
  try {
    const raw = localStorage.getItem(VOCAB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Partial<VocabEntry>>;
      if (parsed && typeof parsed === 'object') {
        for (const [word, entry] of Object.entries(parsed)) {
          if (!word || !entry || typeof entry !== 'object') continue;
          if (!isValidStatus(entry.status)) continue;
          out[word] = {
            status: entry.status,
            ...(isValidPitchPattern(entry.customPitchPattern)
              ? { customPitchPattern: entry.customPitchPattern }
              : {}),
            ...(typeof entry.customPitchNum === 'number' &&
            Number.isFinite(entry.customPitchNum)
              ? { customPitchNum: entry.customPitchNum }
              : {}),
            ...(typeof entry.customMeaning === 'string' &&
            entry.customMeaning.trim()
              ? { customMeaning: entry.customMeaning.trim().slice(0, 140) }
              : {}),
            updatedAt:
              typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
                ? entry.updatedAt
                : Date.now(),
          };
        }
      }
    }
  } catch {
    // ignore corrupted local storage
  }
  memoryCache = out;
  return memoryCache;
}

function persistAndEmit(next: VocabDictionaryMap): void {
  memoryCache = next;
  try {
    localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VOCAB_CHANGED_EVENT));
  }
}

export function getWordVocabEntry(
  lemma: string,
  surface?: string
): VocabEntry | null {
  const store = loadVocabStore();
  if (lemma && store[lemma]) return store[lemma];
  if (surface && store[surface]) return store[surface];
  return null;
}

export function resolveEffectiveWordStatus(
  lemma: string,
  surface: string,
  pos: string,
  store?: VocabDictionaryMap
): VocabStatus | 'particle' {
  const map = store ?? loadVocabStore();
  const hit = (lemma && map[lemma]) || (surface && map[surface]);
  if (hit) return hit.status;
  if (pos === 'particle') return 'particle';
  return 'new';
}

export function setWordVocabStatus(
  key: string,
  status: VocabStatus
): VocabDictionaryMap {
  const cleanKey = key.trim();
  if (!cleanKey) return loadVocabStore();
  const prev = { ...loadVocabStore() };
  const existing = prev[cleanKey];
  if (
    status === 'new' &&
    !existing?.customPitchPattern &&
    !existing?.customMeaning &&
    existing?.customPitchNum === undefined
  ) {
    delete prev[cleanKey];
  } else {
    prev[cleanKey] = {
      ...(existing ?? {}),
      status,
      updatedAt: Date.now(),
    };
  }
  persistAndEmit(prev);
  return prev;
}

export function cycleWordVocabStatus(key: string): VocabStatus {
  const cleanKey = key.trim();
  if (!cleanKey) return 'new';
  const existing = loadVocabStore()[cleanKey]?.status ?? 'new';
  const order: VocabStatus[] = ['new', 'learning', 'known'];
  const idx = order.indexOf(existing);
  const nextStatus = idx >= 0 ? order[(idx + 1) % order.length] : 'known';
  setWordVocabStatus(cleanKey, nextStatus);
  return nextStatus;
}

export function setWordPitchOverride(
  key: string,
  pitchPattern: PitchAccentPattern,
  pitchNum?: number
): VocabDictionaryMap {
  const cleanKey = key.trim();
  if (!cleanKey) return loadVocabStore();
  const prev = { ...loadVocabStore() };
  const existing = prev[cleanKey] ?? {
    status: 'new' as VocabStatus,
    updatedAt: Date.now(),
  };
  prev[cleanKey] = {
    ...existing,
    customPitchPattern: pitchPattern,
    ...(typeof pitchNum === 'number' && Number.isFinite(pitchNum)
      ? { customPitchNum: pitchNum }
      : {}),
    updatedAt: Date.now(),
  };
  persistAndEmit(prev);
  return prev;
}

export function markCoreParticlesKnown(): { updatedCount: number } {
  const prev = { ...loadVocabStore() };
  const particles = getCoreParticleSet();
  const now = Date.now();
  let updatedCount = 0;
  for (const p of particles) {
    if (!prev[p] || prev[p].status !== 'known') {
      prev[p] = {
        ...(prev[p] ?? {}),
        status: 'known',
        updatedAt: now,
      };
      updatedCount += 1;
    }
  }
  if (updatedCount > 0) persistAndEmit(prev);
  return { updatedCount };
}

export function bulkMarkChapterWords(
  plainText: string,
  status: VocabStatus
): { updatedCount: number } {
  const toks = tokenizeJapaneseText(plainText);
  const prev = { ...loadVocabStore() };
  const now = Date.now();
  let updatedCount = 0;
  for (const tok of toks) {
    if (!tok.isWord || tok.pos === 'other' || tok.pos === 'particle') continue;
    const key = tok.lemma || tok.surface;
    if (!key) continue;
    if (prev[key]?.status !== status) {
      prev[key] = {
        ...(prev[key] ?? {}),
        status,
        updatedAt: now,
      };
      updatedCount += 1;
    }
  }
  if (updatedCount > 0) persistAndEmit(prev);
  return { updatedCount };
}

export function clearVocabStore(): void {
  persistAndEmit({});
}

export function getVocabStats(store?: VocabDictionaryMap): {
  total: number;
  known: number;
  learning: number;
  due: number;
  ignored: number;
} {
  const map = store ?? loadVocabStore();
  let known = 0;
  let learning = 0;
  let due = 0;
  let ignored = 0;
  for (const entry of Object.values(map)) {
    if (entry.status === 'known') known += 1;
    else if (entry.status === 'learning') learning += 1;
    else if (entry.status === 'due') due += 1;
    else if (entry.status === 'ignored') ignored += 1;
  }
  return {
    total: Object.keys(map).length,
    known,
    learning,
    due,
    ignored,
  };
}

function cleanAnkiFieldToJapaneseToken(rawHtml: string): string {
  const noRuby = rawHtml
    .replace(/<rt>.*?<\/rt>/gi, '')
    .replace(/<rp>.*?<\/rp>/gi, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  const match = noRuby.match(/[\u3040-\u30FF\u4E00-\u9FAF々ヶー]+/);
  return match ? match[0] : '';
}

interface AnkiCardInfoRow {
  interval?: number;
  type?: number;
  queue?: number;
  fields?: Record<string, { value: string; order: number }>;
}

const PREFERRED_WORD_FIELD_NAMES = [
  'expression',
  'word',
  'vocab',
  'vocabulary',
  'kanji',
  'front',
  'term',
  'target',
  'sentenceword',
  '単語',
  '表現',
];

function extractWordFromAnkiFields(
  fields?: Record<string, { value: string; order: number }>
): string {
  if (!fields) return '';
  const entries = Object.entries(fields).sort(
    (a, b) => (a[1]?.order ?? 99) - (b[1]?.order ?? 99)
  );
  for (const [name, info] of entries) {
    const low = name.toLowerCase().replace(/[^a-z\u3040-\u9faf]/g, '');
    if (PREFERRED_WORD_FIELD_NAMES.some((p) => low.includes(p))) {
      const token = cleanAnkiFieldToJapaneseToken(info?.value ?? '');
      if (token) return token;
    }
  }
  for (const [, info] of entries) {
    const token = cleanAnkiFieldToJapaneseToken(info?.value ?? '');
    if (token) return token;
  }
  return '';
}

export async function syncVocabFromAnki(): Promise<{
  importedCount: number;
  knownCount: number;
  learningCount: number;
  dueCount: number;
  deckSummary: string;
}> {
  const ankiSettings = loadAnkiSettings();
  const companion = loadCompanionSettings();
  const companionUrl = companion.url || undefined;

  const decksRes = await invokeAnki<string[]>(
    'deckNames',
    {},
    ankiSettings.url,
    companionUrl
  );
  const allDecks = decksRes.result ?? [];
  const selectedDecks =
    ankiSettings.selectedDecks.length > 0
      ? ankiSettings.selectedDecks
      : detectJapaneseDecks(allDecks);

  const deckFilterClause =
    selectedDecks.length > 0
      ? `(${selectedDecks.map((d) => `"deck:${d.replace(/"/g, '\\"')}"`).join(' OR ')}) `
      : '';

  // Query introduced cards (excluding suspended/new untouched)
  const cardsRes = await invokeAnki<number[]>(
    'findCards',
    { query: `${deckFilterClause}-is:new -is:suspended`.trim() },
    ankiSettings.url,
    companionUrl
  );
  const cardIds = (cardsRes.result ?? []).slice(0, 8000);
  if (cardIds.length === 0) {
    return {
      importedCount: 0,
      knownCount: 0,
      learningCount: 0,
      dueCount: 0,
      deckSummary:
        selectedDecks.length > 0 ? selectedDecks.join(', ') : 'Semua Deck',
    };
  }

  const prev = { ...loadVocabStore() };
  const now = Date.now();
  let importedCount = 0;
  let knownCount = 0;
  let learningCount = 0;
  let dueCount = 0;

  const CHUNK = 500;
  for (let i = 0; i < cardIds.length; i += CHUNK) {
    const batch = cardIds.slice(i, i + CHUNK);
    const infoRes = await invokeAnki<AnkiCardInfoRow[]>(
      'cardsInfo',
      { cards: batch },
      ankiSettings.url,
      companionUrl
    );
    for (const row of infoRes.result ?? []) {
      const word = extractWordFromAnkiFields(row.fields);
      if (!word || word.length > 16) continue;
      const ivl = Number(row.interval ?? 0);
      // queue === 2 && due? cardsInfo gives ivl>=21 as Mature/Known
      const status: VocabStatus =
        ivl >= 21 ? 'known' : row.queue === 1 || row.queue === 3 ? 'due' : 'learning';

      const toks = tokenizeJapaneseText(word);
      const lemma = toks.find((t) => t.isWord)?.lemma || word;

      prev[lemma] = {
        ...(prev[lemma] ?? {}),
        status,
        updatedAt: now,
      };
      importedCount += 1;
      if (status === 'known') knownCount += 1;
      else if (status === 'due') dueCount += 1;
      else learningCount += 1;
    }
  }

  persistAndEmit(prev);
  return {
    importedCount,
    knownCount,
    learningCount,
    dueCount,
    deckSummary:
      selectedDecks.length > 0 ? selectedDecks.join(', ') : 'Semua Deck',
  };
}
