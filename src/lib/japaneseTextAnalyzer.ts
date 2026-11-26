import {
  countJapaneseMorae,
  katakanaToHiragana,
  lookupCoreLexicon,
  resolvePitchPattern,
  type CoreLexiconEntry,
  type JapanesePosCategory,
  type PitchAccentPattern,
} from './japaneseCoreLexicon';

export interface JapaneseToken {
  surface: string;
  reading: string;
  lemma: string;
  pos: JapanesePosCategory;
  pitchPattern: PitchAccentPattern;
  pitchNum?: number;
  meaning?: string;
  isWord: boolean;
  start: number;
  end: number;
}

const KANJI_RE = /[\u4E00-\u9FAF\u3400-\u4DBF々ヶ]/;
const HIRAGANA_ONLY_RE = /^[\u3041-\u3096ー]+$/;
const KATAKANA_ONLY_RE = /^[\u30A1-\u30FC・･ヽヾ]+$/;
const JAPANESE_CHAR_ANY_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF々ヶ]/;
const PUNCT_OR_SPACE_RE = /^[\s、。．，！？「」『』（）()［］\[\]{}〈〉《》・･…―—ｰ\-～〜:;"'`.,!?0-9０-９A-Za-zＡ-Ｚａ-ｚ]+$/;

const SINGLE_PARTICLE_CHARS = new Set([
  'の',
  'は',
  'が',
  'を',
  'に',
  'へ',
  'と',
  'で',
  'も',
  'や',
  'か',
]);

const VERB_ADJ_SUFFIX_STARTERS = new Set([
  'て',
  'で',
  'た',
  'だ',
  'ます',
  'ました',
  'ません',
  'ませんでした',
  'たい',
  'たかった',
  'たくない',
  'てる',
  'てた',
  'ている',
  'ていた',
  'ています',
  'ていました',
  'てい',
  'てある',
  'てあり',
  'ておく',
  'ておいた',
  'ておきます',
  'てしまう',
  'てしまった',
  'てしまいます',
  'ちゃう',
  'ちゃった',
  'てみる',
  'てみた',
  'てくる',
  'てきた',
  'ていく',
  'ていった',
  'した',
  'して',
  'してる',
  'してた',
  'している',
  'していた',
  'しています',
  'していました',
  'したい',
  'したかった',
  'したくない',
  'します',
  'しました',
  'しません',
  'しない',
  'しなかった',
  'しながら',
  'ながら',
  'ない',
  'なかった',
  'なく',
  'なくて',
  'られる',
  'られた',
  'られます',
  'れる',
  'れた',
  'せる',
  'せた',
  'させる',
  'させた',
  'かった',
  'くて',
  'すぎる',
  'すぎた',
  'そう',
  'そうだ',
  'そうに',
  'ば',
  'たら',
  'だら',
  'なら',
  'か',
  'っ',
]);

const INFLECTION_MERGE_SEGMENTS = new Set([
  ...VERB_ADJ_SUFFIX_STARTERS,
  'い',
  'う',
  'く',
  'ぐ',
  'す',
  'つ',
  'ぬ',
  'ぶ',
  'む',
  'る',
  'し',
  'き',
  'ぎ',
  'ち',
  'に',
  'び',
  'み',
  'り',
  'れ',
  'え',
  'せ',
  'け',
  'げ',
  'て',
  'で',
  'ね',
  'べ',
  'め',
  'ある',
  'いる',
  'おく',
  'くる',
  'いく',
  'しまう',
  'みる',
]);

const SUFFIX_NOUN_MARKERS = new Set([
  'さん',
  'ちゃん',
  'くん',
  '君',
  '様',
  'さま',
  'たち',
  '達',
  'ら',
  '等',
  '中',
  '的',
  '屋',
  '感',
  '性',
  '化',
  '者',
  '人',
  'ぼっこ',
  'っぱ',
]);

const DEINFLECT_RULES: Array<{
  suffix: string;
  replacements: Array<{ add: string; pos: JapanesePosCategory }>;
}> = [
  // Multi-syllable auxiliary endings (longest first)
  {
    suffix: 'ませんでした',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'う', pos: 'verb' },
      { add: 'く', pos: 'verb' },
      { add: 'ぐ', pos: 'verb' },
      { add: 'す', pos: 'verb' },
      { add: 'つ', pos: 'verb' },
      { add: 'ぬ', pos: 'verb' },
      { add: 'ぶ', pos: 'verb' },
      { add: 'む', pos: 'verb' },
    ],
  },
  {
    suffix: 'していました',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'しています',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'していた',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'している',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'したかった',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'したくない',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'しました',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'しません',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'しなかった',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'しながら',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'します',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'しない',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'した',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'して',
    replacements: [{ add: 'する', pos: 'verb' }],
  },
  {
    suffix: 'ています',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'す', pos: 'verb' },
      { add: 'く', pos: 'verb' },
      { add: 'つ', pos: 'verb' },
      { add: 'う', pos: 'verb' },
    ],
  },
  {
    suffix: 'ていた',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'す', pos: 'verb' },
    ],
  },
  {
    suffix: 'ている',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'す', pos: 'verb' },
    ],
  },
  {
    suffix: 'いてある',
    replacements: [{ add: 'く', pos: 'verb' }],
  },
  {
    suffix: 'てある',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'つ', pos: 'verb' },
      { add: 'う', pos: 'verb' },
    ],
  },
  {
    suffix: 'たかった',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'す', pos: 'verb' },
      { add: 'く', pos: 'verb' },
      { add: 'つ', pos: 'verb' },
      { add: 'う', pos: 'verb' },
    ],
  },
  {
    suffix: 'ました',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'す', pos: 'verb' },
      { add: 'く', pos: 'verb' },
      { add: 'つ', pos: 'verb' },
      { add: 'う', pos: 'verb' },
      { add: 'む', pos: 'verb' },
      { add: 'ぶ', pos: 'verb' },
    ],
  },
  {
    suffix: 'ません',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'す', pos: 'verb' },
      { add: 'く', pos: 'verb' },
      { add: 'つ', pos: 'verb' },
      { add: 'う', pos: 'verb' },
      { add: 'む', pos: 'verb' },
    ],
  },
  {
    suffix: 'ます',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'す', pos: 'verb' },
      { add: 'く', pos: 'verb' },
      { add: 'つ', pos: 'verb' },
      { add: 'う', pos: 'verb' },
      { add: 'む', pos: 'verb' },
      { add: 'ぶ', pos: 'verb' },
    ],
  },
  {
    suffix: 'なかった',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'い', pos: 'adj' },
    ],
  },
  {
    suffix: 'かった',
    replacements: [{ add: 'い', pos: 'adj' }],
  },
  {
    suffix: 'くない',
    replacements: [{ add: 'い', pos: 'adj' }],
  },
  {
    suffix: 'くて',
    replacements: [{ add: 'い', pos: 'adj' }],
  },
  {
    suffix: 'ながら',
    replacements: [{ add: 'る', pos: 'verb' }],
  },
  {
    suffix: 'いた',
    replacements: [{ add: 'く', pos: 'verb' }],
  },
  {
    suffix: 'いだ',
    replacements: [{ add: 'ぐ', pos: 'verb' }],
  },
  {
    suffix: 'いて',
    replacements: [{ add: 'く', pos: 'verb' }],
  },
  {
    suffix: 'いで',
    replacements: [{ add: 'ぐ', pos: 'verb' }],
  },
  {
    suffix: 'った',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'う', pos: 'verb' },
      { add: 'つ', pos: 'verb' },
    ],
  },
  {
    suffix: 'って',
    replacements: [
      { add: 'る', pos: 'verb' },
      { add: 'う', pos: 'verb' },
      { add: 'つ', pos: 'verb' },
    ],
  },
  {
    suffix: 'んだ',
    replacements: [
      { add: 'む', pos: 'verb' },
      { add: 'ぶ', pos: 'verb' },
      { add: 'ぬ', pos: 'verb' },
    ],
  },
  {
    suffix: 'んで',
    replacements: [
      { add: 'む', pos: 'verb' },
      { add: 'ぶ', pos: 'verb' },
      { add: 'ぬ', pos: 'verb' },
    ],
  },
  {
    suffix: 'ない',
    replacements: [{ add: 'る', pos: 'verb' }],
  },
  {
    suffix: 'た',
    replacements: [{ add: 'る', pos: 'verb' }],
  },
  {
    suffix: 'て',
    replacements: [{ add: 'る', pos: 'verb' }],
  },
];

// Godan i-stem -> u-stem conversion for polite ます endings (`切り出し` -> `切り出す`)
const I_ROW_TO_U_ROW: Record<string, string> = {
  い: 'う',
  き: 'く',
  ぎ: 'ぐ',
  し: 'す',
  ち: 'つ',
  に: 'ぬ',
  び: 'ぶ',
  み: 'む',
  り: 'る',
};

const A_ROW_TO_U_ROW: Record<string, string> = {
  わ: 'う',
  か: 'く',
  が: 'ぐ',
  さ: 'す',
  た: 'つ',
  な: 'ぬ',
  ば: 'ぶ',
  ま: 'む',
  ら: 'る',
};

let sharedSegmenter: Intl.Segmenter | null | undefined;
function getSegmenter(): Intl.Segmenter | null {
  if (sharedSegmenter !== undefined) return sharedSegmenter;
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    sharedSegmenter = new Intl.Segmenter('ja-JP', { granularity: 'word' });
  } else {
    sharedSegmenter = null;
  }
  return sharedSegmenter;
}

export function deinflectJapaneseWord(surface: string): {
  lemma: string;
  entry: CoreLexiconEntry | null;
  inferredPos?: JapanesePosCategory;
} {
  const direct = lookupCoreLexicon(surface);
  if (direct) {
    return { lemma: direct.lemma, entry: direct, inferredPos: direct.pos };
  }

  // Exact standalone する conjugations before generic stem stripping
  if (
    /^(しています|していました|していた|している|してる|してた|したかった|したくない|しました|しません|しませんでした|しなかった|しながら|します|しない|したい|した|して|する)$/.test(
      surface
    )
  ) {
    const suru = lookupCoreLexicon('する');
    return {
      lemma: 'する',
      entry: suru,
      inferredPos: 'verb',
    };
  }

  // Handle [KanjiCompound] + する conjugations (e.g. 面した -> 面する, 勉強しています -> 勉強する)
  const suruSuffixMatch = surface.match(
    /^([\u4E00-\u9FAF々]+)(しています|していました|していた|している|したかった|したくない|しました|しません|しなかった|しながら|します|しない|したい|した|して|される|された|できる|できた)$/
  );
  if (suruSuffixMatch) {
    const suruLemma = `${suruSuffixMatch[1]}する`;
    const hit = lookupCoreLexicon(suruLemma);
    return {
      lemma: hit?.lemma ?? suruLemma,
      entry: hit,
      inferredPos: 'verb',
    };
  }

  // Handle compound continuous/aspect suffixes BEFORE simple ます stripping (`ています`, `ていた`, `てある`, etc.)
  const aspectRule = DEINFLECT_RULES.filter(
    (r) =>
      r.suffix.startsWith('て') ||
      r.suffix.startsWith('いて') ||
      r.suffix.startsWith('して') ||
      r.suffix === 'たかった' ||
      r.suffix === 'なかった'
  );
  for (const rule of aspectRule) {
    if (!surface.endsWith(rule.suffix) || surface.length <= rule.suffix.length) {
      continue;
    }
    const stem = surface.slice(0, surface.length - rule.suffix.length);
    for (const rep of rule.replacements) {
      const cand = stem + rep.add;
      const hit = lookupCoreLexicon(cand);
      if (hit) {
        return { lemma: hit.lemma, entry: hit, inferredPos: rep.pos };
      }
    }
  }

  // Handle verb polite stems (`切り出します` -> `切り出す`, fallback Ichidan/Godan)
  for (const polite of ['ませんでした', 'ました', 'ません', 'ます', 'たい', 'たかった']) {
    if (surface.endsWith(polite) && surface.length > polite.length) {
      const stem = surface.slice(0, surface.length - polite.length);
      if (stem === 'し' || stem === 'してい') {
        return { lemma: 'する', entry: lookupCoreLexicon('する'), inferredPos: 'verb' };
      }
      const lastChar = stem.slice(-1);
      const uChar = I_ROW_TO_U_ROW[lastChar];
      const candidates: string[] = [];
      if (uChar) {
        candidates.push(stem.slice(0, -1) + uChar);
      }
      candidates.push(stem + 'る');
      if (stem === 'き') candidates.push('来る');
      for (const cand of candidates) {
        const hit = lookupCoreLexicon(cand);
        if (hit) {
          return { lemma: hit.lemma, entry: hit, inferredPos: 'verb' };
        }
      }
      return {
        lemma: uChar ? stem.slice(0, -1) + uChar : stem + 'る',
        entry: null,
        inferredPos: 'verb',
      };
    }
  }

  // Handle negative -ない stems (e.g. 分からない -> 分かる)
  for (const neg of ['なかった', 'ない', 'なくて']) {
    if (surface.endsWith(neg) && surface.length > neg.length) {
      const stem = surface.slice(0, surface.length - neg.length);
      const lastChar = stem.slice(-1);
      const uChar = A_ROW_TO_U_ROW[lastChar];
      const candidates: string[] = [];
      if (uChar) candidates.push(stem.slice(0, -1) + uChar);
      candidates.push(stem + 'る');
      for (const cand of candidates) {
        const hit = lookupCoreLexicon(cand);
        if (hit) {
          return { lemma: hit.lemma, entry: hit, inferredPos: hit.pos };
        }
      }
    }
  }

  // Generic deinflect rules
  for (const rule of DEINFLECT_RULES) {
    if (!surface.endsWith(rule.suffix) || surface.length <= rule.suffix.length) {
      continue;
    }
    const stem = surface.slice(0, surface.length - rule.suffix.length);
    for (const rep of rule.replacements) {
      const cand = stem + rep.add;
      const hit = lookupCoreLexicon(cand);
      if (hit) {
        return { lemma: hit.lemma, entry: hit, inferredPos: rep.pos };
      }
    }
    return {
      lemma: stem + rule.replacements[0].add,
      entry: null,
      inferredPos: rule.replacements[0].pos,
    };
  }

  return { lemma: surface, entry: null };
}

function inferFallbackPos(surface: string): JapanesePosCategory {
  if (!JAPANESE_CHAR_ANY_RE.test(surface) || PUNCT_OR_SPACE_RE.test(surface)) {
    return 'other';
  }
  if (KATAKANA_ONLY_RE.test(surface)) return 'noun';

  const deinf = deinflectJapaneseWord(surface);
  if (deinf.inferredPos) return deinf.inferredPos;

  // Reduplicated mimetic / adverb pattern (もぐもぐ, にこにこ, きらきら)
  if (
    HIRAGANA_ONLY_RE.test(surface) &&
    surface.length === 4 &&
    surface.slice(0, 2) === surface.slice(2, 4)
  ) {
    return 'adverb';
  }

  if (KANJI_RE.test(surface)) {
    const last = surface.slice(-1);
    if (last === 'い') return 'adj';
    if ('るうくぐすつぬぶむ'.includes(last) && surface.length >= 2) {
      return 'verb';
    }
    return 'noun';
  }

  if (HIRAGANA_ONLY_RE.test(surface)) {
    if (surface.length === 1 || SINGLE_PARTICLE_CHARS.has(surface)) {
      return 'particle';
    }
    return 'adverb';
  }

  return 'noun';
}

interface RawSeg {
  text: string;
  isWordLike: boolean;
}

function segmentRawJapanese(text: string): RawSeg[] {
  const seg = getSegmenter();
  if (seg) {
    const out: RawSeg[] = [];
    for (const item of seg.segment(text)) {
      out.push({
        text: item.segment,
        isWordLike: Boolean(item.isWordLike) && JAPANESE_CHAR_ANY_RE.test(item.segment),
      });
    }
    return out;
  }

  // Portable fallback if Intl.Segmenter is absent
  const out: RawSeg[] = [];
  const re = /([\u4E00-\u9FAF\u3400-\u4DBF]+[\u3041-\u3096]*|[\u30A1-\u30FC・]+|[\u3041-\u3096]+|[^\u3040-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      text: m[0],
      isWordLike: JAPANESE_CHAR_ANY_RE.test(m[0]),
    });
  }
  return out;
}

function canFormConjugatedVerbOrAdj(combined: string): boolean {
  if (lookupCoreLexicon(combined)) return true;
  const d = deinflectJapaneseWord(combined);
  if (d.entry) return true;
  if (
    /(ます|ました|ません|ている|ていた|てある|ながら|ない|なかった|かった|れた|られた|せた|させた)$/.test(
      combined
    )
  ) {
    return true;
  }
  return false;
}

function refineRawSegments(raw: RawSeg[]): RawSeg[] {
  // Pass 1: Split bogus leading-particle merges from Intl.Segmenter
  // (e.g. "のち"+"ぎ"+"れ"+"た" -> "の"+"ち"+"ぎ"+"れ"+"た", or "に従う" -> "に"+"従う")
  const splitPass: RawSeg[] = [];
  const leadingCaseParticles = new Set(['の', 'は', 'が', 'を', 'に', 'へ']);
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    if (
      cur.isWordLike &&
      cur.text.length >= 2 &&
      leadingCaseParticles.has(cur.text[0]) &&
      KANJI_RE.test(cur.text[1]) &&
      !lookupCoreLexicon(cur.text)
    ) {
      splitPass.push({ text: cur.text[0], isWordLike: true });
      splitPass.push({ text: cur.text.slice(1), isWordLike: true });
      continue;
    }
    if (
      cur.isWordLike &&
      HIRAGANA_ONLY_RE.test(cur.text) &&
      cur.text.length === 2 &&
      SINGLE_PARTICLE_CHARS.has(cur.text[0])
    ) {
      // Peek next 1..4 hiragana segments to see if splitting leading particle produces a cleaner verb/adj/word
      const rest = cur.text.slice(1);
      let joinedAhead = rest;
      let formed = false;
      for (let k = 1; k <= 4 && i + k < raw.length; k++) {
        if (!raw[i + k].isWordLike) break;
        joinedAhead += raw[i + k].text;
        if (canFormConjugatedVerbOrAdj(joinedAhead)) {
          formed = true;
          break;
        }
      }
      if (formed) {
        splitPass.push({ text: cur.text[0], isWordLike: true });
        splitPass.push({ text: rest, isWordLike: true });
        continue;
      }
    }
    splitPass.push(cur);
  }

  // Pass 2: Merge katakana runs, lexicon compounds, polite prefixes/suffixes, and inflections
  const merged: RawSeg[] = [];
  let i = 0;
  while (i < splitPass.length) {
    const cur = splitPass[i];
    if (!cur.isWordLike || PUNCT_OR_SPACE_RE.test(cur.text)) {
      merged.push(cur);
      i += 1;
      continue;
    }

    // Check longest core lexicon compound up to 5 segments ahead
    let bestLexJoinLen = 0;
    let accum = cur.text;
    for (let look = 1; look <= 4 && i + look < splitPass.length; look++) {
      const nxt = splitPass[i + look];
      if (!nxt.isWordLike || PUNCT_OR_SPACE_RE.test(nxt.text)) break;
      accum += nxt.text;
      if (lookupCoreLexicon(accum)) {
        bestLexJoinLen = look;
      }
    }
    if (bestLexJoinLen > 0) {
      let joined = '';
      for (let k = 0; k <= bestLexJoinLen; k++) joined += splitPass[i + k].text;
      merged.push({ text: joined, isWordLike: true });
      i += bestLexJoinLen + 1;
      continue;
    }

    // Merge consecutive katakana loanword segments (e.g. マドレー + ヌ)
    if (KATAKANA_ONLY_RE.test(cur.text)) {
      let endIdx = i;
      let kText = cur.text;
      while (
        endIdx + 1 < splitPass.length &&
        splitPass[endIdx + 1].isWordLike &&
        KATAKANA_ONLY_RE.test(splitPass[endIdx + 1].text)
      ) {
        endIdx += 1;
        kText += splitPass[endIdx].text;
      }
      if (endIdx > i) {
        merged.push({ text: kText, isWordLike: true });
        i = endIdx + 1;
        continue;
      }
    }

    // Merge polite prefix お/ご + word when not followed by isolated single char
    if (
      (cur.text === 'お' || cur.text === 'ご') &&
      i + 1 < splitPass.length &&
      splitPass[i + 1].isWordLike &&
      splitPass[i + 1].text.length >= 2
    ) {
      merged.push({ text: cur.text + splitPass[i + 1].text, isWordLike: true });
      i += 2;
      continue;
    }

    // Merge conjugated verb/adjective inflection chains & suffixes (e.g. ちぎれ+た, 置+い+て+ある, した+か+っ+た, 切り出し+ます)
    let endIdx = i;
    let chain = cur.text;
    const isStandaloneParticle =
      SINGLE_PARTICLE_CHARS.has(cur.text) ||
      lookupCoreLexicon(cur.text)?.pos === 'particle';
    const isMimeticAdverb =
      HIRAGANA_ONLY_RE.test(cur.text) &&
      cur.text.length === 4 &&
      cur.text.slice(0, 2) === cur.text.slice(2, 4);

    if (!isStandaloneParticle && !isMimeticAdverb) {
      while (endIdx + 1 < splitPass.length) {
        const nxt = splitPass[endIdx + 1];
        if (!nxt.isWordLike || PUNCT_OR_SPACE_RE.test(nxt.text)) break;

        // Avoid swallowing a grammatical particle into a noun/verb unless it is part of a conjugated inflection!
        if (SINGLE_PARTICLE_CHARS.has(nxt.text)) {
          // Only swallow 'か' inside `...か + っ + た` desiderative past!
          const after = splitPass[endIdx + 2]?.text;
          if (nxt.text === 'か' && after === 'っ') {
            chain += nxt.text;
            endIdx += 1;
            continue;
          }
          break;
        }

        // Check if cur + nxt forms a suffix noun (さん/ちゃん/ぼっこ/っぱ)
        if (SUFFIX_NOUN_MARKERS.has(nxt.text)) {
          chain += nxt.text;
          endIdx += 1;
          continue;
        }

        // Only attach した/して/します onto a kanji suru-stem when appropriate (e.g. 面+した, 勉強+している), NOT onto ordinary non-suru nouns like 私/今日/廊下!
        if (/^(した|して|している|していた|しています|します|しない)$/.test(nxt.text)) {
          const isKanjiSuruCandidate =
            chain === cur.text &&
            /^[\u4E00-\u9FAF々]+$/.test(chain) &&
            (Boolean(lookupCoreLexicon(`${chain}する`)) ||
              chain.length >= 2 ||
              chain === '面' ||
              chain === '関' ||
              chain === '接' ||
              chain === '対' ||
              chain === '達' ||
              chain === '愛');
          if (!isKanjiSuruCandidate) {
            break;
          }
          chain += nxt.text;
          endIdx += 1;
          continue;
        }

        // Do NOT merge し onto a Kanji noun unless cur+する exists
        if (nxt.text === 'し' && /^[\u4E00-\u9FAF々]+$/.test(chain) && !lookupCoreLexicon(`${chain}する`)) {
          break;
        }

        // Conjugated chain if previous ends in stem/inflection or combined matches verb/adj pattern
        const canMergeInflection =
          INFLECTION_MERGE_SEGMENTS.has(nxt.text) &&
          (KANJI_RE.test(cur.text) ||
            chain.length >= 2 ||
            nxt.text === 'てい' ||
            nxt.text === 'ながら' ||
            nxt.text === 'た' ||
            nxt.text === 'ます' ||
            nxt.text === 'れる' ||
            nxt.text === 'れた' ||
            nxt.text === 'ぎ');

        // Special case: de-segmented hiragana verb stem chunks like ち + ぎ + れ + た
        const nextLooksLikeOkuriganaStep =
          HIRAGANA_ONLY_RE.test(nxt.text) &&
          (canMergeInflection ||
            (chain.length <= 2 &&
              HIRAGANA_ONLY_RE.test(chain) &&
              splitPass[endIdx + 2]?.text &&
              INFLECTION_MERGE_SEGMENTS.has(splitPass[endIdx + 2].text)));

        if (nextLooksLikeOkuriganaStep) {
          // Stop if nxt itself is an independent content adverb/noun or non-inflection particle
          const nxtLex = lookupCoreLexicon(nxt.text);
          if (
            nxtLex &&
            nxtLex.pos === 'particle' &&
            !VERB_ADJ_SUFFIX_STARTERS.has(nxt.text)
          ) {
            break;
          }
          // Avoid merging isolated hiragana verb `する`/`ある`/`いる` onto unrelated nouns unless preceded by `て`/`で`/`に`/kanji stem
          if (
            (nxt.text === 'ある' || nxt.text === 'いる') &&
            !chain.endsWith('て') &&
            !chain.endsWith('で')
          ) {
            break;
          }
          chain += nxt.text;
          endIdx += 1;
          continue;
        }

        break;
      }
    }

    merged.push({ text: chain, isWordLike: true });
    i = endIdx + 1;
  }

  return merged;
}

const tokenSentenceCache = new Map<string, JapaneseToken[]>();
const MAX_SENTENCE_CACHE = 4000;

export function tokenizeJapaneseText(text: string): JapaneseToken[] {
  if (!text) return [];
  const cached = tokenSentenceCache.get(text);
  if (cached) return cached;

  const refined = refineRawSegments(segmentRawJapanese(text));
  const tokens: JapaneseToken[] = [];
  let cursor = 0;

  for (const seg of refined) {
    const start = cursor;
    const end = cursor + seg.text.length;
    cursor = end;

    if (!seg.isWordLike || PUNCT_OR_SPACE_RE.test(seg.text)) {
      tokens.push({
        surface: seg.text,
        reading: seg.text,
        lemma: seg.text,
        pos: 'other',
        pitchPattern: 'unknown',
        isWord: false,
        start,
        end,
      });
      continue;
    }

    const deinf = deinflectJapaneseWord(seg.text);
    const lex = deinf.entry;
    const pos: JapanesePosCategory =
      lex?.pos ?? deinf.inferredPos ?? inferFallbackPos(seg.text);
    const reading = lex?.reading || katakanaToHiragana(seg.text);
    const lemma = lex?.lemma || deinf.lemma || seg.text;
    const pitchNum = lex?.pitchNum;
    const pitchPattern =
      lex?.pitchPattern ?? resolvePitchPattern(reading, pitchNum);

    tokens.push({
      surface: seg.text,
      reading,
      lemma,
      pos,
      pitchPattern,
      pitchNum,
      meaning: lex?.meaning,
      isWord: true,
      start,
      end,
    });
  }

  if (tokenSentenceCache.size >= MAX_SENTENCE_CACHE) {
    // Evict oldest ~25%
    let count = 0;
    for (const k of tokenSentenceCache.keys()) {
      tokenSentenceCache.delete(k);
      count += 1;
      if (count >= 1000) break;
    }
  }
  tokenSentenceCache.set(text, tokens);
  return tokens;
}

// === HTML RUBY-PRESERVING TOKENIZER ===

interface LogicalUnit {
  char: string;
  sourceType: 'text' | 'ruby';
  textNode?: Text;
  offsetInTextNode?: number;
  rubyEl?: Element;
  rubyReading?: string;
}

const STYLE_RECURSE_INLINE_TAGS = new Set([
  'EM',
  'STRONG',
  'I',
  'B',
  'U',
  'S',
  'MARK',
  'SMALL',
  'SUB',
  'SUP',
  'A',
]);

function extractRubyInfo(rubyEl: Element): { baseText: string; rtText: string } {
  let baseText = '';
  let rtText = '';
  for (const child of Array.from(rubyEl.childNodes)) {
    if (child.nodeType === 3) {
      baseText += child.textContent ?? '';
    } else if (child.nodeType === 1) {
      const tag = (child as Element).tagName.toUpperCase();
      if (tag === 'RT') {
        rtText += child.textContent ?? '';
      } else if (tag === 'RP') {
        // skip parentheses
      } else {
        baseText += child.textContent ?? '';
      }
    }
  }
  return { baseText, rtText: katakanaToHiragana(rtText.trim()) };
}

function isRubyPreservingInlineFlow(el: Element): boolean {
  const tag = el.tagName.toUpperCase();
  if (tag === 'RUBY') return true;
  if (tag === 'SPAN') {
    if (el.hasAttribute('class') || el.hasAttribute('style')) return false;
    return !el.querySelector(
      'p, div, h1, h2, h3, h4, h5, h6, ul, ol, li, img, svg, br, table, hr, a, em, strong, i, b, u, mark'
    );
  }
  return false;
}

function collectFlowUnits(node: Node, units: LogicalUnit[]): boolean {
  if (node.nodeType === 3) {
    const val = node.nodeValue ?? '';
    for (let i = 0; i < val.length; i++) {
      units.push({
        char: val[i],
        sourceType: 'text',
        textNode: node as Text,
        offsetInTextNode: i,
      });
    }
    return true;
  }
  if (node.nodeType !== 1) return false;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();

  if (tag === 'RUBY') {
    const { baseText, rtText } = extractRubyInfo(el);
    if (!baseText) return true;
    for (let i = 0; i < baseText.length; i++) {
      units.push({
        char: baseText[i],
        sourceType: 'ruby',
        rubyEl: el,
        rubyReading: rtText,
      });
    }
    return true;
  }

  if (isRubyPreservingInlineFlow(el)) {
    for (const child of Array.from(el.childNodes)) {
      collectFlowUnits(child, units);
    }
    return true;
  }

  return false;
}

function buildTokenSpan(
  doc: Document,
  token: JapaneseToken,
  rubyReading?: string
): HTMLSpanElement {
  const span = doc.createElement('span');
  span.className = 'jp-tok';
  span.setAttribute('data-jp-w', token.surface);
  span.setAttribute('data-jp-l', token.lemma);
  span.setAttribute('data-jp-pos', token.pos);
  span.setAttribute('data-jp-pitch', token.pitchPattern);
  const reading = rubyReading || token.reading || '';
  if (reading) span.setAttribute('data-jp-r', reading);
  if (typeof token.pitchNum === 'number') {
    span.setAttribute('data-jp-pn', String(token.pitchNum));
  }
  if (token.meaning) {
    span.setAttribute('data-jp-m', token.meaning);
  }
  return span;
}

function annotateInlineRun(
  doc: Document,
  runNodes: Node[],
  parent: Element,
  beforeRef: Node | null
): void {
  const units: LogicalUnit[] = [];
  for (const n of runNodes) {
    collectFlowUnits(n, units);
  }
  if (units.length === 0) return;

  const fullText = units.map((u) => u.char).join('');
  if (!JAPANESE_CHAR_ANY_RE.test(fullText)) return;

  const rawTokens = tokenizeJapaneseText(fullText);
  if (rawTokens.length === 0) return;

  // Snap token boundaries so a <ruby> element is NEVER sliced across two spans
  const resolvedTokens: JapaneseToken[] = [];
  let tIdx = 0;
  while (tIdx < rawTokens.length) {
    const tok = { ...rawTokens[tIdx] };
    while (tIdx + 1 < rawTokens.length && tok.end > 0 && tok.end < units.length) {
      const prevRuby = units[tok.end - 1]?.rubyEl;
      const nextRuby = units[tok.end]?.rubyEl;
      if (prevRuby && nextRuby && prevRuby === nextRuby) {
        tIdx += 1;
        const nextTok = rawTokens[tIdx];
        tok.end = nextTok.end;
        tok.surface = fullText.slice(tok.start, tok.end);
        const re = deinflectJapaneseWord(tok.surface);
        tok.lemma = re.entry?.lemma || re.lemma || tok.surface;
        tok.pos = re.entry?.pos || re.inferredPos || tok.pos;
        tok.reading = re.entry?.reading || katakanaToHiragana(tok.surface);
        tok.isWord = tok.isWord || nextTok.isWord;
      } else {
        break;
      }
    }
    resolvedTokens.push(tok);
    tIdx += 1;
  }

  // Build replacement fragment preserving exact <ruby> nodes!
  const frag = doc.createDocumentFragment();

  for (const tok of resolvedTokens) {
    const sliceUnits = units.slice(tok.start, tok.end);
    if (!tok.isWord) {
      appendSliceNodes(doc, frag, sliceUnits);
      continue;
    }

    // Reconstruct combined reading using actual <rt> from <ruby> elements where present
    let customReading = '';
    let hasCustomRubyRt = false;
    let u = 0;
    while (u < sliceUnits.length) {
      const unit = sliceUnits[u];
      if (unit.rubyEl) {
        const curRuby = unit.rubyEl;
        if (unit.rubyReading) {
          customReading += unit.rubyReading;
          hasCustomRubyRt = true;
        } else {
          customReading += unit.char;
        }
        while (u < sliceUnits.length && sliceUnits[u].rubyEl === curRuby) {
          u += 1;
        }
      } else {
        customReading += katakanaToHiragana(unit.char);
        u += 1;
      }
    }

    const span = buildTokenSpan(
      doc,
      tok,
      hasCustomRubyRt ? customReading : undefined
    );
    appendSliceNodes(doc, span, sliceUnits);
    frag.appendChild(span);
  }

  for (const n of runNodes) {
    parent.removeChild(n);
  }
  parent.insertBefore(frag, beforeRef);
}

function appendSliceNodes(
  doc: Document,
  target: Node,
  sliceUnits: LogicalUnit[]
): void {
  let i = 0;
  while (i < sliceUnits.length) {
    const unit = sliceUnits[i];
    if (unit.rubyEl) {
      const rubyEl = unit.rubyEl;
      target.appendChild(rubyEl.cloneNode(true));
      while (i < sliceUnits.length && sliceUnits[i].rubyEl === rubyEl) {
        i += 1;
      }
    } else {
      let buf = unit.char;
      i += 1;
      while (i < sliceUnits.length && !sliceUnits[i].rubyEl) {
        buf += sliceUnits[i].char;
        i += 1;
      }
      target.appendChild(doc.createTextNode(buf));
    }
  }
}

function annotateElementTree(doc: Document, root: Element): void {
  const skipTags = new Set([
    'SCRIPT',
    'STYLE',
    'IMG',
    'SVG',
    'BR',
    'HR',
    'RUBY',
    'RT',
    'RP',
  ]);
  if (skipTags.has(root.tagName.toUpperCase())) return;
  if (
    root.classList.contains('jp-chapter-divider') ||
    root.classList.contains('jp-tok')
  ) {
    return;
  }

  const children = Array.from(root.childNodes);
  let i = 0;
  while (i < children.length) {
    const child = children[i];
    const isFlow =
      child.nodeType === 3 ||
      (child.nodeType === 1 && isRubyPreservingInlineFlow(child as Element));

    if (!isFlow) {
      if (child.nodeType === 1) {
        annotateElementTree(doc, child as Element);
      }
      i += 1;
      continue;
    }

    // Collect contiguous run of Text / <ruby> / unstyled <span>
    const run: Node[] = [];
    while (i < children.length) {
      const c = children[i];
      if (c.nodeType === 1 && STYLE_RECURSE_INLINE_TAGS.has((c as Element).tagName.toUpperCase())) {
        if (run.length > 0) break;
        annotateElementTree(doc, c as Element);
        i += 1;
        break;
      }
      const ok =
        c.nodeType === 3 ||
        (c.nodeType === 1 && isRubyPreservingInlineFlow(c as Element));
      if (!ok) break;
      run.push(c);
      i += 1;
    }

    if (run.length > 0) {
      const nextSibling = i < children.length ? children[i] : null;
      annotateInlineRun(doc, run, root, nextSibling);
    }
  }
}

const chapterHtmlTokenCache = new Map<string, string>();
const MAX_HTML_CACHE = 96;

export function annotateChapterHtmlWithTokens(html: string): string {
  if (!html || !JAPANESE_CHAR_ANY_RE.test(html)) return html;
  if (typeof DOMParser === 'undefined') return html;

  const cached = chapterHtmlTokenCache.get(html);
  if (cached !== undefined) return cached;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  if (!body) return html;

  annotateElementTree(doc, body);
  const out = body.innerHTML;

  if (chapterHtmlTokenCache.size >= MAX_HTML_CACHE) {
    const firstKey = chapterHtmlTokenCache.keys().next().value;
    if (firstKey !== undefined) chapterHtmlTokenCache.delete(firstKey);
  }
  chapterHtmlTokenCache.set(html, out);
  return out;
}

export function buildMoraPitchDiagram(
  reading: string,
  pitchNum?: number
): Array<{ mora: string; high: boolean; dropAfter: boolean }> {
  const s = katakanaToHiragana(reading.trim());
  const morae: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ('ゃゅょぁぃぅぇぉゎ'.includes(ch) && morae.length > 0) {
      morae[morae.length - 1] += ch;
    } else if (/[\u3040-\u309Fー]/.test(ch)) {
      morae.push(ch);
    }
  }
  if (morae.length === 0) return [];
  if (typeof pitchNum !== 'number' || !Number.isFinite(pitchNum) || pitchNum < 0) {
    return morae.map((m) => ({ mora: m, high: false, dropAfter: false }));
  }

  return morae.map((mora, idx) => {
    const pos = idx + 1;
    let high = false;
    if (pitchNum === 0) {
      high = pos >= 2;
    } else if (pitchNum === 1) {
      high = pos === 1;
    } else {
      high = pos >= 2 && pos <= pitchNum;
    }
    const dropAfter = pitchNum >= 1 && pos === pitchNum;
    return { mora, high, dropAfter };
  });
}

export { countJapaneseMorae, katakanaToHiragana, resolvePitchPattern };
