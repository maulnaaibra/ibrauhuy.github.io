import type {
  BettermelonLanguageStats,
  CatalogSection,
  SheetCatalogItem,
} from '../components/MediaCatalogBrowser';

export interface UniversalSearchPortal {
  id: string;
  section: Exclude<CatalogSection, 'Semua'>;
  label: string;
  siteName: string;
  url: string;
  badgeColor: string;
}

const NSFW_BLOCK_REGEX =
  /\b(hentai|eroge|nukige|18\+|nsfw|porn|pornographic|erotica|ecchi|r-18|r18|sex|sexual|sexuality|smut|fetish|brothel|incest|jav|uncensored|lewd|nude|nudity|naked|stripper|prostitut|whore|virginity|lingerie|panties|boobs|breasts|cleavage|orgasm|masturbat|rape|molest|adultery|affair|seduc|lust|pervert|lolicon|shotacon|succubus|concubine|courtesan|dominatrix|sadomasoch|bondage|bdsm|voyeur|exhibitionis|futanari|ahegao|oppai|pantsu|gravure)\b|エロ|18禁|官能|巨乳|下着|不倫|情事|快楽|誘惑|淫|裸|痴漢|風俗|処女|童貞|変態/i;

const BLOCKED_ADULT_TAGS = new Set([
  'nudity',
  'sex',
  'erotica',
  'defloration',
  'incest',
  'netorare',
  'prostitution',
  'rape',
  'bdsm',
  'ahegao',
  'large breasts',
  'flat chest',
  'futanari',
  'voyeur',
  'exhibitionism',
  'succubus',
  'oiran',
  'sadism',
  'masochism',
  'bondage',
  'virginity',
  'inseki',
  'lactation',
  'public sex',
  'sweat',
  'teens love',
]);

export function isContentNsfwOrHentai(params: {
  text?: string;
  genres?: string[];
  tags?: Array<{ name?: string; isAdult?: boolean }>;
  isAdult?: boolean;
}): boolean {
  if (params.isAdult) return true;
  if (
    params.genres?.some((g) => {
      const lower = g.toLowerCase();
      return (
        lower === 'hentai' ||
        lower === 'ecchi' ||
        lower === 'erotica' ||
        lower === 'smut'
      );
    })
  ) {
    return true;
  }
  if (
    params.tags?.some(
      (t) =>
        t.isAdult ||
        (t.name && BLOCKED_ADULT_TAGS.has(t.name.trim().toLowerCase()))
    )
  ) {
    return true;
  }
  if (params.text && NSFW_BLOCK_REGEX.test(params.text)) {
    return true;
  }
  return false;
}

export function getUniversalDirectSearchPortals(
  rawQuery: string
): UniversalSearchPortal[] {
  const clean = rawQuery.trim();
  if (!clean || isContentNsfwOrHentai({ text: clean })) return [];
  const q = encodeURIComponent(clean);

  return [
    {
      id: 'bm-anime',
      section: 'Anime',
      label: `Tonton "${clean}" di Bettermelon`,
      siteName: 'Bettermelon.ru',
      url: `https://bettermelon.ru/search?query=${q}`,
      badgeColor: 'bg-rose-600 text-white border-rose-600',
    },
    {
      id: 'epub-novel',
      section: 'Novels',
      label: `Baca Novel "${clean}" (Epub.moe)`,
      siteName: 'Epub.moe',
      url: `https://epub.moe/?q=${q}`,
      badgeColor: 'bg-amber-600 text-white border-amber-600',
    },
    {
      id: 'bw-novel',
      section: 'Novels',
      label: `Cari Novel "${clean}" di BookWalker JP`,
      siteName: 'BookWalker.jp',
      url: `https://bookwalker.jp/search/?word=${q}`,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    {
      id: 'cinejoy-drama',
      section: 'Drama & TV',
      label: `Tonton Drama/TV "${clean}" di Cinejoy`,
      siteName: 'Cinejoy.pk',
      url: `https://cinejoy.pk/search?q=${q}`,
      badgeColor: 'bg-purple-600 text-white border-purple-600',
    },
    {
      id: 'mangadex-manga',
      section: 'Manga',
      label: `Baca Manga "${clean}" di MangaDex`,
      siteName: 'MangaDex.org',
      url: `https://mangadex.org/titles?q=${q}&content=safe`,
      badgeColor: 'bg-sky-600 text-white border-sky-600',
    },
    {
      id: 'rawkuma-manga',
      section: 'Manga',
      label: `Baca Raw Manga "${clean}" di Rawkuma`,
      siteName: 'Rawkuma.net',
      url: `https://rawkuma.net/?s=${q}`,
      badgeColor: 'bg-sky-50 text-sky-800 border-sky-200',
    },
    {
      id: 'vndb-vn',
      section: 'Visual Novels',
      label: `Buka VN "${clean}" di VNDB`,
      siteName: 'VNDB.org',
      url: `https://vndb.org/v?sq=${q}`,
      badgeColor: 'bg-indigo-600 text-white border-indigo-600',
    },
    {
      id: 'steam-game',
      section: 'Video Games',
      label: `Cari Game "${clean}" di Steam`,
      siteName: 'Steam Store',
      url: `https://store.steampowered.com/search/?term=${q}`,
      badgeColor: 'bg-slate-800 text-white border-slate-800',
    },
    {
      id: 'yt-game',
      section: 'Video Games',
      label: `Walkthrough JP "${clean} 実況"`,
      siteName: 'YouTube',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${clean} 実況`
      )}`,
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      id: 'yt-video',
      section: 'YouTube',
      label: `Cari Video / VTuber "${clean}" di YouTube`,
      siteName: 'YouTube.com',
      url: `https://www.youtube.com/results?search_query=${q}`,
      badgeColor: 'bg-red-600 text-white border-red-600',
    },
    {
      id: 'spotify-podcast',
      section: 'Podcasts',
      label: `Dengar Podcast "${clean}" di Spotify`,
      siteName: 'Spotify',
      url: `https://open.spotify.com/search/${q}/shows`,
      badgeColor: 'bg-emerald-600 text-white border-emerald-600',
    },
  ];
}

interface AniListLiveMedia {
  id: number;
  type: 'ANIME' | 'MANGA';
  format?: string;
  isAdult?: boolean;
  title?: {
    native?: string;
    romaji?: string;
    english?: string;
  };
  coverImage?: {
    large?: string;
    medium?: string;
  };
  description?: string;
  episodes?: number;
  duration?: number;
  genres?: string[];
  tags?: Array<{ name?: string; isAdult?: boolean }>;
}

function estimateLiveBmStats(media: AniListLiveMedia): {
  difficultyTier: string;
  ranking: string;
  bmStats: BettermelonLanguageStats;
} {
  const genres = new Set(media.genres || []);
  let score = 2.35;
  if (genres.has('Slice of Life') || genres.has('Romance')) score -= 0.6;
  if (
    genres.has('Psychological') ||
    genres.has('Mystery') ||
    genres.has('Sci-Fi')
  ) {
    score += 0.7;
  }
  const jitter = ((media.id % 31) - 15) * 0.015;
  score = Math.max(0.9, Math.min(4.7, Number((score + jitter).toFixed(2))));

  let bmDifficulty = 'Average';
  let jlptLevel = 'N3';
  let difficultyTier = 'Medium';

  if (score <= 1.15) {
    bmDifficulty = 'Beginner';
    jlptLevel = 'N5';
    difficultyTier = 'Very Easy';
  } else if (score <= 1.99) {
    bmDifficulty = 'Easy';
    jlptLevel = 'N4';
    difficultyTier = 'Easy';
  } else if (score <= 2.99) {
    bmDifficulty = 'Average';
    jlptLevel = 'N3';
    difficultyTier = 'Medium';
  } else if (score <= 3.95) {
    bmDifficulty = 'Hard';
    jlptLevel = 'N2';
    difficultyTier = 'Hard';
  } else {
    bmDifficulty = 'Expert';
    jlptLevel = 'N1';
    difficultyTier = 'Very Hard';
  }

  const episodes = Math.max(1, media.episodes || 12);
  const duration = Math.max(5, media.duration || 24);
  const speechSpeed = Math.round(240 + score * 26);
  const totalSpeechMins = Math.max(10, Math.round(episodes * duration * 0.52));
  const wordCount = totalSpeechMins * Math.round(speechSpeed * 0.45);
  const uniqueKanji = Math.round(280 + score * 310);
  const hrs = Math.floor(totalSpeechMins / 60);
  const mins = totalSpeechMins % 60;

  return {
    difficultyTier,
    ranking: `${bmDifficulty} • ${jlptLevel} (${score.toFixed(2)}/5)`,
    bmStats: {
      jlptLevel,
      bmDifficulty,
      bmScore: `${score.toFixed(2)}/5`,
      wordCount,
      uniqueKanji,
      speechSpeed,
      speechDuration: hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`,
    },
  };
}

function cleanHtml(str?: string): string {
  return (str || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchAniListLive(
  search: string,
  section: CatalogSection
): Promise<SheetCatalogItem[]> {
  if (isContentNsfwOrHentai({ text: search })) return [];

  const wantAnime = section === 'Semua' || section === 'Anime';
  const wantMangaOrNovel =
    section === 'Semua' || section === 'Manga' || section === 'Novels';

  if (!wantAnime && !wantMangaOrNovel) return [];

  const query = `
    query ($search: String, $includeAnime: Boolean!, $includeManga: Boolean!) {
      animePage: Page(page: 1, perPage: 18) @include(if: $includeAnime) {
        media(search: $search, type: ANIME, isAdult: false, genre_not_in: ["Hentai", "Ecchi"], sort: [POPULARITY_DESC]) {
          id
          type
          format
          isAdult
          title {
            native
            romaji
            english
          }
          coverImage {
            large
            medium
          }
          description(asHtml: false)
          episodes
          duration
          genres
          tags {
            name
            isAdult
          }
        }
      }
      mangaPage: Page(page: 1, perPage: 12) @include(if: $includeManga) {
        media(search: $search, type: MANGA, isAdult: false, genre_not_in: ["Hentai", "Ecchi"], sort: [POPULARITY_DESC]) {
          id
          type
          format
          isAdult
          title {
            native
            romaji
            english
          }
          coverImage {
            large
            medium
          }
          description(asHtml: false)
          genres
          tags {
            name
            isAdult
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: {
          search,
          includeAnime: wantAnime,
          includeManga: wantMangaOrNovel,
        },
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: {
        animePage?: { media?: AniListLiveMedia[] };
        mangaPage?: { media?: AniListLiveMedia[] };
      };
    };

    const results: SheetCatalogItem[] = [];

    for (const m of json.data?.animePage?.media || []) {
      const nativeTitle = (m.title?.native || '').trim();
      const romajiOrEn = (
        m.title?.english ||
        m.title?.romaji ||
        nativeTitle
      ).trim();
      const desc = cleanHtml(m.description);

      if (
        isContentNsfwOrHentai({
          text: `${nativeTitle} ${romajiOrEn} ${desc}`,
          genres: m.genres,
          tags: m.tags,
          isAdult: m.isAdult,
        })
      ) {
        continue;
      }

      const fullTitle =
        nativeTitle && romajiOrEn && nativeTitle !== romajiOrEn
          ? `${nativeTitle} (${romajiOrEn})`
          : nativeTitle || romajiOrEn;

      const est = estimateLiveBmStats(m);
      results.push({
        id: `live-anime-${m.id}`,
        section: 'Anime',
        category: 'anime',
        ranking: est.ranking,
        difficultyTier: est.difficultyTier,
        title: fullTitle,
        romajiTitle: romajiOrEn,
        difficultyExplanation: `Bettermelon Difficulty: ${est.bmStats.bmDifficulty} (${est.bmStats.bmScore}) • Level Bahasa: JLPT ${est.bmStats.jlptLevel} • Kecepatan bicara: ${est.bmStats.speechSpeed} mora/mnt`,
        description:
          desc ||
          'Tersedia langsung di Bettermelon.ru dengan subtitle bahasa Jepang interaktif.',
        suggestedMinutes: m.duration || 24,
        coverImage: m.coverImage?.large || m.coverImage?.medium,
        anilistId: m.id,
        sourceUrl: `https://anilist.co/anime/${m.id}`,
        directUrl: `https://bettermelon.ru/info/${m.id}`,
        watchUrl: `https://bettermelon.ru/watch/${m.id}/1`,
        bmStats: est.bmStats,
      });
    }

    for (const m of json.data?.mangaPage?.media || []) {
      const isNovel = m.format === 'NOVEL';
      if (section === 'Novels' && !isNovel) continue;
      if (section === 'Manga' && isNovel) continue;

      const nativeTitle = (m.title?.native || '').trim();
      const romajiOrEn = (
        m.title?.romaji ||
        m.title?.english ||
        nativeTitle
      ).trim();
      const desc = cleanHtml(m.description);

      if (
        isContentNsfwOrHentai({
          text: `${nativeTitle} ${romajiOrEn} ${desc}`,
          genres: m.genres,
          tags: m.tags,
          isAdult: m.isAdult,
        })
      ) {
        continue;
      }

      const fullTitle =
        nativeTitle && romajiOrEn && nativeTitle !== romajiOrEn
          ? `${nativeTitle} (${romajiOrEn})`
          : nativeTitle || romajiOrEn;

      const searchWord = encodeURIComponent(nativeTitle || romajiOrEn);
      results.push({
        id: `live-manga-${m.id}`,
        section: isNovel ? 'Novels' : 'Manga',
        category: isNovel ? 'light_novel' : 'manga',
        ranking: isNovel ? 'Light Novel • N3–N2' : 'Manga • N4–N3',
        difficultyTier: isNovel ? 'Medium' : 'Easy',
        title: fullTitle,
        romajiTitle: romajiOrEn,
        difficultyExplanation: isNovel
          ? 'Hasil pencarian langsung Light Novel bahasa Jepang.'
          : 'Hasil pencarian langsung Manga bahasa Jepang.',
        description:
          desc ||
          'Klik tombol utama untuk langsung membuka halaman baca media ini.',
        suggestedMinutes: isNovel ? 35 : 30,
        coverImage: m.coverImage?.large || m.coverImage?.medium,
        anilistId: m.id,
        sourceUrl: `https://anilist.co/manga/${m.id}`,
        directUrl: isNovel
          ? `https://bookwalker.jp/search/?word=${searchWord}`
          : `https://mangadex.org/titles?q=${encodeURIComponent(romajiOrEn)}&content=safe`,
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function searchVndbLive(
  search: string,
  section: CatalogSection
): Promise<SheetCatalogItem[]> {
  if (isContentNsfwOrHentai({ text: search })) return [];
  if (section !== 'Semua' && section !== 'Visual Novels') return [];
  try {
    const res = await fetch('https://api.vndb.org/kana/vn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ['search', '=', search],
        fields: 'id, title, alttitle, description, image.url, image.sexual, rating',
        results: 8,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        id: string;
        title?: string;
        alttitle?: string;
        description?: string;
        image?: { url?: string; sexual?: number };
        rating?: number;
      }>;
    };

    const items: SheetCatalogItem[] = [];
    for (const vn of data.results || []) {
      if ((vn.image?.sexual ?? 0) > 0) continue;

      const jpTitle = vn.alttitle || vn.title || vn.id;
      const romaji = vn.title || jpTitle;
      const desc = cleanHtml(vn.description);
      if (isContentNsfwOrHentai({ text: `${jpTitle} ${romaji} ${desc}` })) {
        continue;
      }

      const fullTitle =
        jpTitle && romaji && jpTitle !== romaji
          ? `${jpTitle} (${romaji})`
          : jpTitle;
      items.push({
        id: `live-vn-${vn.id}`,
        section: 'Visual Novels',
        category: 'visual_novel',
        ranking: vn.rating
          ? `VNDB ${(vn.rating / 10).toFixed(1)}★`
          : 'Visual Novel • N3–N2',
        difficultyTier: 'Medium',
        title: fullTitle,
        romajiTitle: romaji,
        difficultyExplanation: `Halaman resmi VNDB #${vn.id} — Klik untuk membuka langsung di VNDB.org.`,
        description:
          desc || 'Visual Novel bahasa Jepang dari database VNDB.org.',
        suggestedMinutes: 45,
        coverImage: vn.image?.url,
        sourceUrl: `https://vndb.org/${vn.id}`,
        directUrl: `https://vndb.org/${vn.id}`,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function searchLiveCatalogMedia(
  query: string,
  section: CatalogSection
): Promise<SheetCatalogItem[]> {
  const clean = query.trim();
  if (clean.length < 2 || isContentNsfwOrHentai({ text: clean })) return [];

  const [anilistItems, vndbItems] = await Promise.all([
    searchAniListLive(clean, section),
    searchVndbLive(clean, section),
  ]);

  return [...anilistItems, ...vndbItems];
}
