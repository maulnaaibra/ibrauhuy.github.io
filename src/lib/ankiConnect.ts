export const DEFAULT_ANKI_URL = 'http://127.0.0.1:8765';
const ANKI_SETTINGS_KEY = 'immersiontrack_anki_settings_v1';

export interface AnkiSettings {
  url: string;
  selectedDeck: string;
  selectedDecks: string[];
  secondsPerReview: number;
  autoSync: boolean;
  includeIntroducedCards: boolean;
  rolloverHour: 'auto' | number;
}

const JAPANESE_CHAR_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
const JAPANESE_DECK_KEYWORD_RE =
  /\b(jlpt|n[1-5]|jp|japanese|nihongo|bunpou|kanji|kana|vocab|goi|dokkai|choukai|kiku|lapis|kaishi|core|mining|onigiri|wanikani|jpdb|anime|manga|vn|novel|moshi|soumatome|minna|genki|tobira|quartet|tango)\b/i;
const NON_JAPANESE_DECK_KEYWORD_RE =
  /^(default)$|matematika|sistem operasi|algoritma|pemrograman|kewarganegaraan|sistem informasi|msim|mata\d|mkwn|embs/i;

export function getTopLevelDeck(deckName: string): string {
  const idx = deckName.indexOf('::');
  return idx >= 0 ? deckName.slice(0, idx) : deckName;
}

export function detectJapaneseDecks(allDecks: string[]): string[] {
  const topDecks = Array.from(new Set(allDecks.map(getTopLevelDeck)));
  return topDecks.filter((top) => {
    const relatedNames = allDecks.filter(
      (d) => d === top || d.startsWith(`${top}::`)
    );
    const hasNonJpSignal = NON_JAPANESE_DECK_KEYWORD_RE.test(top);
    const hasJpSignal = relatedNames.some(
      (name) =>
        JAPANESE_CHAR_RE.test(name) || JAPANESE_DECK_KEYWORD_RE.test(name)
    );
    return hasJpSignal && !hasNonJpSignal;
  });
}

export function loadAnkiSettings(): AnkiSettings {
  try {
    const raw = localStorage.getItem(ANKI_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AnkiSettings>;
      const legacySingle = parsed.selectedDeck || 'all';
      const selectedDecks = Array.isArray(parsed.selectedDecks)
        ? parsed.selectedDecks.filter((d): d is string => typeof d === 'string' && d.length > 0)
        : legacySingle !== 'all'
          ? [legacySingle]
          : [];
      const rollover =
        parsed.rolloverHour === 'auto' ||
        (typeof parsed.rolloverHour === 'number' &&
          Number.isFinite(parsed.rolloverHour) &&
          parsed.rolloverHour >= 0 &&
          parsed.rolloverHour <= 23)
          ? parsed.rolloverHour
          : 'auto';

      return {
        url: parsed.url || DEFAULT_ANKI_URL,
        selectedDeck: legacySingle,
        selectedDecks,
        secondsPerReview: Number(parsed.secondsPerReview || 10),
        autoSync: parsed.autoSync ?? false,
        includeIntroducedCards: parsed.includeIntroducedCards ?? true,
        rolloverHour: rollover,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    url: DEFAULT_ANKI_URL,
    selectedDeck: 'all',
    selectedDecks: [],
    secondsPerReview: 10,
    autoSync: false,
    includeIntroducedCards: true,
    rolloverHour: 'auto',
  };
}

export function saveAnkiSettings(settings: AnkiSettings): void {
  try {
    localStorage.setItem(ANKI_SETTINGS_KEY, JSON.stringify(settings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('immersiontrack:anki-settings'));
    }
  } catch {
    // ignore storage errors
  }
}

interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

async function postJson<T>(
  url: string,
  body: string,
  extraHeaders?: Record<string, string>,
  timeoutMs = 10000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(extraHeaders ?? {}),
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function invokeAnki<T>(
  action: string,
  params: Record<string, unknown>,
  ankiUrl: string,
  companionUrl?: string
): Promise<{ result: T; viaProxy: boolean }> {
  const cleanAnkiUrl = ankiUrl.trim().replace(/\/+$/, '') || DEFAULT_ANKI_URL;
  const payload = JSON.stringify({ action, version: 6, params });

  try {
    const direct = await postJson<AnkiConnectResponse<T>>(cleanAnkiUrl, payload);
    if (direct.error) throw new Error(direct.error);
    return { result: direct.result, viaProxy: false };
  } catch (directErr) {
    if (!companionUrl) {
      throw directErr;
    }
    const proxyBase = companionUrl.trim().replace(/\/+$/, '');
    const proxied = await postJson<AnkiConnectResponse<T>>(
      `${proxyBase}/anki`,
      payload,
      { 'X-Anki-Url': cleanAnkiUrl }
    );
    if (proxied.error) throw new Error(proxied.error);
    return { result: proxied.result, viaProxy: true };
  }
}

export interface AnkiConnectionCheck {
  connected: boolean;
  version?: number;
  viaProxy?: boolean;
  decks?: string[];
  error?: string;
}

export async function checkAnkiConnection(
  ankiUrl: string,
  companionUrl?: string
): Promise<AnkiConnectionCheck> {
  try {
    const ver = await invokeAnki<number>('version', {}, ankiUrl, companionUrl);
    const decksRes = await invokeAnki<string[]>(
      'deckNames',
      {},
      ankiUrl,
      companionUrl
    );
    return {
      connected: true,
      version: ver.result,
      viaProxy: ver.viaProxy,
      decks: decksRes.result ?? [],
    };
  } catch (err: unknown) {
    return {
      connected: false,
      error:
        err instanceof Error
          ? err.message
          : 'Tidak dapat terhubung ke AnkiConnect',
    };
  }
}

export interface AnkiDeckDaySummary {
  deck: string;
  reviews: number;
  minutes: number;
}

export interface AnkiTodayStats {
  reviewsToday: number;
  uniqueCardsReviewedToday: number;
  notesAddedToday: number;
  cardsIntroducedToday: number;
  newCardsToday: number;
  actualMinutes: number;
  estimatedMinutes: number;
  usedExactTimer: boolean;
  detectedRolloverHour: number;
  perDeckBreakdown: AnkiDeckDaySummary[];
  allDecksSummary: AnkiDeckDaySummary[];
  selectedDeckLabel: string;
  viaProxy: boolean;
}

type CardReviewTuple = [
  number, // 0: reviewTime ms
  number, // 1: cardID
  number, // 2: usn
  number, // 3: buttonPressed
  number, // 4: newInterval
  number, // 5: previousInterval
  number, // 6: newFactor
  number, // 7: reviewDuration ms
  number, // 8: reviewType (0=learn,1=review,2=relearn,3=cram/filtered)
];

function getCutoffMsForRollover(rolloverHour: number): number {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    rolloverHour,
    0,
    0,
    0
  );
  if (now.getHours() < rolloverHour) {
    start.setDate(start.getDate() - 1);
  }
  return start.getTime();
}

function escapeDeckQuery(deck: string): string {
  return deck.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildDeckFilterClause(selectedDecks: string[]): string {
  if (selectedDecks.length === 0) return '';
  if (selectedDecks.length === 1) {
    return `"deck:${escapeDeckQuery(selectedDecks[0])}"`;
  }
  return `(${selectedDecks.map((d) => `"deck:${escapeDeckQuery(d)}"`).join(' OR ')})`;
}

export async function fetchAnkiTodayStats(
  ankiUrl: string,
  settingsOrDeck: AnkiSettings | string,
  secondsPerReviewFallback = 10,
  companionUrl?: string
): Promise<AnkiTodayStats> {
  const normalizedSelectedDecks: string[] =
    typeof settingsOrDeck === 'string'
      ? settingsOrDeck === 'all'
        ? []
        : [settingsOrDeck]
      : Array.isArray(settingsOrDeck.selectedDecks) &&
          settingsOrDeck.selectedDecks.length > 0
        ? settingsOrDeck.selectedDecks
        : settingsOrDeck.selectedDeck && settingsOrDeck.selectedDeck !== 'all'
          ? [settingsOrDeck.selectedDeck]
          : [];

  const secondsPerReview =
    typeof settingsOrDeck === 'string'
      ? secondsPerReviewFallback
      : settingsOrDeck.secondsPerReview;
  const includeIntroducedCards =
    typeof settingsOrDeck === 'string'
      ? true
      : settingsOrDeck.includeIntroducedCards;
  const rolloverSetting =
    typeof settingsOrDeck === 'string' ? 'auto' : settingsOrDeck.rolloverHour;

  const initRes = await invokeAnki<Array<unknown>>(
    'multi',
    {
      actions: [
        { action: 'deckNames', params: {} },
        { action: 'getNumCardsReviewedToday', params: {} },
      ],
    },
    ankiUrl,
    companionUrl
  );

  const allDecks = Array.isArray(initRes.result?.[0])
    ? (initRes.result[0] as string[])
    : [];
  const globalReviewsToday = Number(initRes.result?.[1] || 0);

  const activeSelection = normalizedSelectedDecks.filter((sel) =>
    allDecks.some((d) => d === sel || d.startsWith(`${sel}::`))
  );

  const targetDecks =
    activeSelection.length === 0
      ? allDecks
      : allDecks.filter((d) =>
          activeSelection.some((sel) => d === sel || d.startsWith(`${sel}::`))
        );
  const targetDeckSet = new Set(targetDecks);

  const deckClause = buildDeckFilterClause(activeSelection);
  const addedNotesQuery = deckClause ? `added:1 ${deckClause}` : 'added:1';
  const introducedCardsQuery = deckClause
    ? `introduced:1 ${deckClause}`
    : 'introduced:1';
  const unionNotesQuery = deckClause
    ? `(added:1 OR introduced:1) ${deckClause}`
    : 'added:1 OR introduced:1';

  const cardQueries: Array<{ action: string; params: Record<string, unknown> }> =
    [
      { action: 'findNotes', params: { query: addedNotesQuery } },
      { action: 'findCards', params: { query: introducedCardsQuery } },
      { action: 'findNotes', params: { query: unionNotesQuery } },
    ];

  const cardQueryRes = await invokeAnki<Array<number[]>>(
    'multi',
    { actions: cardQueries },
    ankiUrl,
    companionUrl
  );

  const addedNoteIds = Array.isArray(cardQueryRes.result?.[0])
    ? cardQueryRes.result[0]
    : [];
  const introducedCardIds = Array.isArray(cardQueryRes.result?.[1])
    ? cardQueryRes.result[1]
    : [];
  const unionNoteIds = Array.isArray(cardQueryRes.result?.[2])
    ? cardQueryRes.result[2]
    : [];

  const notesAddedToday = addedNoteIds.length;
  const cardsIntroducedToday = introducedCardIds.length;
  const newCardsToday = includeIntroducedCards
    ? unionNoteIds.length
    : notesAddedToday;

  // Query exact review logs across all decks for past ~24h so we can auto-detect Anki's local rollover hour
  let usedExactTimer = false;
  let detectedRolloverHour =
    typeof rolloverSetting === 'number' ? rolloverSetting : 4;
  let reviewsToday = 0;
  let uniqueCardsReviewedToday = 0;
  let actualDurationMs = 0;
  let perDeckBreakdown: AnkiDeckDaySummary[] = [];
  let allDecksSummary: AnkiDeckDaySummary[] = [];

  if (allDecks.length > 0) {
    try {
      const lookbackStartMs = Date.now() - 24 * 60 * 60 * 1000 - 60000;
      const revRes = await invokeAnki<Array<CardReviewTuple[] | null>>(
        'multi',
        {
          actions: allDecks.map((deck) => ({
            action: 'cardReviews',
            params: { deck, startID: lookbackStartMs },
          })),
        },
        ankiUrl,
        companionUrl
      );

      if (Array.isArray(revRes.result)) {
        const deckRows: Array<{ deck: string; rows: CardReviewTuple[] }> = [];
        for (let i = 0; i < allDecks.length; i++) {
          const rows = revRes.result[i];
          if (Array.isArray(rows) && rows.length > 0) {
            deckRows.push({ deck: allDecks[i], rows });
          }
        }

        if (rolloverSetting === 'auto' && globalReviewsToday > 0) {
          const candidates = [
            4, 0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
            19, 20, 21, 22, 23,
          ];
          let bestHour = 4;
          let bestDiff = Number.POSITIVE_INFINITY;
          for (const hr of candidates) {
            const cutoff = getCutoffMsForRollover(hr);
            let totalAtHr = 0;
            for (const entry of deckRows) {
              for (const r of entry.rows) {
                if (Number(r[0]) >= cutoff) totalAtHr++;
              }
            }
            const diff = Math.abs(totalAtHr - globalReviewsToday);
            if (diff === 0) {
              bestHour = hr;
              bestDiff = 0;
              break;
            }
            if (diff < bestDiff) {
              bestDiff = diff;
              bestHour = hr;
            }
          }
          detectedRolloverHour = bestHour;
        }

        const cutoffMs = getCutoffMsForRollover(detectedRolloverHour);
        const allTopBuckets = new Map<
          string,
          { reviews: number; durationMs: number }
        >();
        const selectedTopBuckets = new Map<
          string,
          { reviews: number; durationMs: number }
        >();
        const selectedUniqueCards = new Set<number>();
        const seenReviewKeys = new Set<string>();

        for (const entry of deckRows) {
          const topName = getTopLevelDeck(entry.deck);
          const isTarget =
            activeSelection.length === 0 || targetDeckSet.has(entry.deck);

          for (const r of entry.rows) {
            const revTime = Number(r[0]);
            if (revTime < cutoffMs) continue;
            const cardId = Number(r[1]);
            const revKey = `${revTime}:${cardId}`;
            if (seenReviewKeys.has(revKey)) continue;
            seenReviewKeys.add(revKey);

            // Cap single-card timer at 180s to avoid extreme idle outliers while preserving Anki revlog fidelity
            const durMs = Math.min(180000, Math.max(0, Number(r[7] || 0)));

            const allBucket = allTopBuckets.get(topName) ?? {
              reviews: 0,
              durationMs: 0,
            };
            allBucket.reviews += 1;
            allBucket.durationMs += durMs;
            allTopBuckets.set(topName, allBucket);

            if (isTarget) {
              reviewsToday += 1;
              actualDurationMs += durMs;
              selectedUniqueCards.add(cardId);
              const selBucket = selectedTopBuckets.get(topName) ?? {
                reviews: 0,
                durationMs: 0,
              };
              selBucket.reviews += 1;
              selBucket.durationMs += durMs;
              selectedTopBuckets.set(topName, selBucket);
            }
          }
        }

        uniqueCardsReviewedToday = selectedUniqueCards.size;
        usedExactTimer = true;

        allDecksSummary = Array.from(allTopBuckets.entries())
          .map(([deck, v]) => ({
            deck,
            reviews: v.reviews,
            minutes: Math.max(0, Math.round(v.durationMs / 60000)),
          }))
          .sort((a, b) => b.reviews - a.reviews);

        perDeckBreakdown = Array.from(selectedTopBuckets.entries())
          .map(([deck, v]) => ({
            deck,
            reviews: v.reviews,
            minutes: Math.max(0, Math.round(v.durationMs / 60000)),
          }))
          .sort((a, b) => b.reviews - a.reviews);
      }
    } catch {
      // Fallback below for older AnkiConnect versions without cardReviews
    }
  }

  if (!usedExactTimer) {
    const ratedQuery = deckClause ? `rated:1 ${deckClause}` : 'rated:1';
    try {
      const ratedRes = await invokeAnki<number[]>(
        'findCards',
        { query: ratedQuery },
        ankiUrl,
        companionUrl
      );
      const ratedCount = Array.isArray(ratedRes.result)
        ? ratedRes.result.length
        : 0;
      uniqueCardsReviewedToday = ratedCount;
      reviewsToday =
        activeSelection.length === 0
          ? Math.max(globalReviewsToday, ratedCount)
          : ratedCount;
    } catch {
      reviewsToday = activeSelection.length === 0 ? globalReviewsToday : 0;
      uniqueCardsReviewedToday = reviewsToday;
    }
  }

  const actualMinutes = usedExactTimer
    ? actualDurationMs > 0
      ? Math.max(1, Math.round(actualDurationMs / 60000))
      : newCardsToday > 0
        ? Math.max(1, newCardsToday)
        : 0
    : reviewsToday > 0
      ? Math.max(
          1,
          Math.round((reviewsToday * Math.max(3, secondsPerReview)) / 60)
        )
      : newCardsToday > 0
        ? Math.max(1, newCardsToday * 2)
        : 0;

  const selectedDeckLabel =
    activeSelection.length === 0
      ? 'Semua Deck'
      : activeSelection.length === 1
        ? activeSelection[0]
        : `${activeSelection.length} Deck Terpilih`;

  return {
    reviewsToday,
    uniqueCardsReviewedToday,
    notesAddedToday,
    cardsIntroducedToday,
    newCardsToday,
    actualMinutes,
    estimatedMinutes: actualMinutes,
    usedExactTimer,
    detectedRolloverHour,
    perDeckBreakdown,
    allDecksSummary,
    selectedDeckLabel,
    viaProxy: initRes.viaProxy,
  };
}
