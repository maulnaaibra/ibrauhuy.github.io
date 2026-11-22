import type {
  BettermelonLanguageStats,
  CatalogSection,
  NsfwFilterMode,
  SheetCatalogItem,
} from '../components/MediaCatalogBrowser';

export interface UniversalSearchPortal {
  id: string;
  section: Exclude<CatalogSection, 'Semua'>;
  label: string;
  siteName: string;
  url: string;
  badgeColor: string;
  isNsfwPortal?: boolean;
}

export function getNsfwDirectPortals(rawQuery: string): UniversalSearchPortal[] {
  const clean = rawQuery.trim();
  const q = encodeURIComponent(clean);

  return [
    {
      id: 'bm-ecchi',
      section: 'Anime',
      label: clean
        ? `Cari Anime 18+ "${clean}" di Bettermelon`
        : 'Browse Anime 18+ / Ecchi di Bettermelon',
      siteName: 'Bettermelon.ru',
      url: clean
        ? `https://bettermelon.ru/search?query=${q}`
        : 'https://bettermelon.ru/search?genres=Ecchi',
      badgeColor: 'bg-rose-700 text-white border-rose-700',
      isNsfwPortal: true,
    },
    {
      id: 'dlsite-r18',
      section: 'Visual Novels',
      label: clean
        ? `Cari Eroge / VN / ASMR 18+ "${clean}" di DLsite R18`
        : 'Buka Katalog Eroge & Doujin 18+ (DLsite R18 JP)',
      siteName: 'DLsite R18',
      url: clean
        ? `https://www.dlsite.com/maniax/fsr/=/keyword/${q}`
        : 'https://www.dlsite.com/maniax/',
      badgeColor: 'bg-fuchsia-700 text-white border-fuchsia-700',
      isNsfwPortal: true,
    },
    {
      id: 'vndb-r18',
      section: 'Visual Novels',
      label: clean
        ? `Cari Visual Novel 18+ "${clean}" di VNDB`
        : 'Database Visual Novel Eroge 18+ (VNDB)',
      siteName: 'VNDB.org',
      url: clean ? `https://vndb.org/v?sq=${q}` : 'https://vndb.org/v?f=0280UJ',
      badgeColor: 'bg-indigo-700 text-white border-indigo-700',
      isNsfwPortal: true,
    },
    {
      id: 'mangadex-r18',
      section: 'Manga',
      label: clean
        ? `Baca Manga 18+ "${clean}" di MangaDex`
        : 'Browse Manga 18+ / Erotica (MangaDex)',
      siteName: 'MangaDex 18+',
      url: clean
        ? `https://mangadex.org/titles?q=${q}&content=suggestive,erotica,pornographic`
        : 'https://mangadex.org/titles?content=erotica,pornographic',
      badgeColor: 'bg-red-700 text-white border-red-700',
      isNsfwPortal: true,
    },
    {
      id: 'rawkuma-r18',
      section: 'Manga',
      label: clean
        ? `Cari Raw Manga 18+ "${clean}" di Rawkuma`
        : 'Baca Raw Manga Ecchi / Mature (Rawkuma)',
      siteName: 'Rawkuma.net',
      url: clean
        ? `https://rawkuma.net/?s=${q}`
        : 'https://rawkuma.net/manga/?genre%5B%5D=ecchi',
      badgeColor: 'bg-slate-900 text-white border-slate-900',
      isNsfwPortal: true,
    },
    {
      id: 'syosetu-r18',
      section: 'Novels',
      label: clean
        ? `Baca Web Novel 18+ "${clean}" (Nocturne Syosetu)`
        : 'Buka Web Novel 18+ Jepang (Syosetu R18)',
      siteName: 'Syosetu R18',
      url: clean
        ? `https://noc.syosetu.com/search/search/search.php?word=${q}`
        : 'https://noc.syosetu.com/',
      badgeColor: 'bg-amber-700 text-white border-amber-700',
      isNsfwPortal: true,
    },
    {
      id: 'epub-r18',
      section: 'Novels',
      label: clean
        ? `Cari EPUB Novel 18+ "${clean}" di Epub.moe`
        : 'Cari Light Novel 18+ di Epub.moe',
      siteName: 'Epub.moe',
      url: clean ? `https://epub.moe/?q=${q}` : 'https://epub.moe/',
      badgeColor: 'bg-rose-50 text-rose-800 border-rose-300',
      isNsfwPortal: true,
    },
  ];
}

export function getUniversalDirectSearchPortals(
  rawQuery: string,
  nsfwMode: NsfwFilterMode = 'all'
): UniversalSearchPortal[] {
  const clean = rawQuery.trim();
  const q = encodeURIComponent(clean);
  if (!clean) return [];

  if (nsfwMode === 'nsfw_only') {
    return getNsfwDirectPortals(clean);
  }

  const base: UniversalSearchPortal[] = [
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
      url: `https://mangadex.org/titles?q=${q}`,
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

  if (nsfwMode === 'all') {
    base.push({
      id: 'dlsite-r18-quick',
      section: 'Visual Novels',
      label: `18+ DLsite "${clean}"`,
      siteName: 'DLsite R18',
      url: `https://www.dlsite.com/maniax/fsr/=/keyword/${q}`,
      badgeColor: 'bg-fuchsia-700 text-white border-fuchsia-700',
      isNsfwPortal: true,
    });
  }

  return base;
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
  section: CatalogSection,
  nsfwMode: NsfwFilterMode
): Promise<SheetCatalogItem[]> {
  const wantAnime = section === 'Semua' || section === 'Anime';
  const wantMangaOrNovel =
    section === 'Semua' || section === 'Manga' || section === 'Novels';

  if (!wantAnime && !wantMangaOrNovel) return [];

  const isAdultFilter =
    nsfwMode === 'safe' ? false : nsfwMode === 'nsfw_only' ? true : undefined;

  const query = `
    query ($search: String, $includeAnime: Boolean!, $includeManga: Boolean!, $isAdult: Boolean) {
      animePage: Page(page: 1, perPage: 18) @include(if: $includeAnime) {
        media(search: $search, type: ANIME, isAdult: $isAdult, sort: [POPULARITY_DESC]) {
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
        }
      }
      mangaPage: Page(page: 1, perPage: 12) @include(if: $includeManga) {
        media(search: $search, type: MANGA, isAdult: $isAdult, sort: [POPULARITY_DESC]) {
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
          isAdult: isAdultFilter,
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
      const genres = m.genres || [];
      const isNsfw =
        Boolean(m.isAdult) ||
        genres.includes('Hentai') ||
        genres.includes('Ecchi');
      if (nsfwMode === 'safe' && isNsfw) continue;

      const nativeTitle = (m.title?.native || '').trim();
      const romajiOrEn = (
        m.title?.english ||
        m.title?.romaji ||
        nativeTitle
      ).trim();
      const fullTitle =
        nativeTitle && romajiOrEn && nativeTitle !== romajiOrEn
          ? `${nativeTitle} (${romajiOrEn})`
          : nativeTitle || romajiOrEn;

      const est = estimateLiveBmStats(m);
      results.push({
        id: `live-anime-${m.id}`,
        section: 'Anime',
        category: 'anime',
        ranking: isNsfw ? `18+ • ${est.ranking}` : est.ranking,
        difficultyTier: est.difficultyTier,
        title: fullTitle,
        romajiTitle: romajiOrEn,
        difficultyExplanation: `Bettermelon Difficulty: ${est.bmStats.bmDifficulty} (${est.bmStats.bmScore}) • Level Bahasa: JLPT ${est.bmStats.jlptLevel} • Kecepatan bicara: ${est.bmStats.speechSpeed} mora/mnt`,
        description:
          cleanHtml(m.description) ||
          'Tersedia langsung di Bettermelon.ru dengan subtitle bahasa Jepang interaktif.',
        suggestedMinutes: m.duration || 24,
        coverImage: m.coverImage?.large || m.coverImage?.medium,
        anilistId: m.id,
        sourceUrl: `https://anilist.co/anime/${m.id}`,
        directUrl: `https://bettermelon.ru/info/${m.id}`,
        watchUrl: `https://bettermelon.ru/watch/${m.id}/1`,
        bmStats: est.bmStats,
        isNsfw,
      });
    }

    for (const m of json.data?.mangaPage?.media || []) {
      const isNovel = m.format === 'NOVEL';
      if (section === 'Novels' && !isNovel) continue;
      if (section === 'Manga' && isNovel) continue;

      const genres = m.genres || [];
      const isNsfw =
        Boolean(m.isAdult) ||
        genres.includes('Hentai') ||
        genres.includes('Ecchi');
      if (nsfwMode === 'safe' && isNsfw) continue;

      const nativeTitle = (m.title?.native || '').trim();
      const romajiOrEn = (
        m.title?.romaji ||
        m.title?.english ||
        nativeTitle
      ).trim();
      const fullTitle =
        nativeTitle && romajiOrEn && nativeTitle !== romajiOrEn
          ? `${nativeTitle} (${romajiOrEn})`
          : nativeTitle || romajiOrEn;

      const searchWord = encodeURIComponent(nativeTitle || romajiOrEn);
      results.push({
        id: `live-manga-${m.id}`,
        section: isNovel ? 'Novels' : 'Manga',
        category: isNovel ? 'light_novel' : 'manga',
        ranking: isNsfw
          ? '18+ R18 • N3'
          : isNovel
            ? 'Light Novel • N3–N2'
            : 'Manga • N4–N3',
        difficultyTier: isNovel ? 'Medium' : 'Easy',
        title: fullTitle,
        romajiTitle: romajiOrEn,
        difficultyExplanation: isNovel
          ? 'Hasil pencarian langsung Light Novel bahasa Jepang.'
          : 'Hasil pencarian langsung Manga bahasa Jepang.',
        description:
          cleanHtml(m.description) ||
          'Klik tombol utama untuk langsung membuka halaman baca media ini.',
        suggestedMinutes: isNovel ? 35 : 30,
        coverImage: m.coverImage?.large || m.coverImage?.medium,
        anilistId: m.id,
        sourceUrl: `https://anilist.co/manga/${m.id}`,
        directUrl: isNovel
          ? `https://bookwalker.jp/search/?word=${searchWord}`
          : `https://mangadex.org/titles?q=${encodeURIComponent(romajiOrEn)}`,
        isNsfw,
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function searchVndbLive(
  search: string,
  section: CatalogSection,
  nsfwMode: NsfwFilterMode
): Promise<SheetCatalogItem[]> {
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
      const isNsfw = (vn.image?.sexual ?? 0) >= 1 || nsfwMode === 'nsfw_only';
      if (nsfwMode === 'safe' && (vn.image?.sexual ?? 0) >= 1) continue;

      const jpTitle = vn.alttitle || vn.title || vn.id;
      const romaji = vn.title || jpTitle;
      const fullTitle =
        jpTitle && romaji && jpTitle !== romaji
          ? `${jpTitle} (${romaji})`
          : jpTitle;
      items.push({
        id: `live-vn-${vn.id}`,
        section: 'Visual Novels',
        category: 'visual_novel',
        ranking: vn.rating
          ? `${isNsfw ? '18+ • ' : ''}VNDB ${(vn.rating / 10).toFixed(1)}★`
          : 'Visual Novel • N3–N2',
        difficultyTier: 'Medium',
        title: fullTitle,
        romajiTitle: romaji,
        difficultyExplanation: `Halaman resmi VNDB #${vn.id} — Klik untuk membuka langsung di VNDB.org.`,
        description:
          cleanHtml(vn.description) ||
          'Visual Novel bahasa Jepang dari database VNDB.org.',
        suggestedMinutes: 45,
        coverImage: vn.image?.url,
        sourceUrl: `https://vndb.org/${vn.id}`,
        directUrl: `https://vndb.org/${vn.id}`,
        isNsfw,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function searchLiveCatalogMedia(
  query: string,
  section: CatalogSection,
  nsfwMode: NsfwFilterMode = 'all'
): Promise<SheetCatalogItem[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const [anilistItems, vndbItems] = await Promise.all([
    searchAniListLive(clean, section, nsfwMode),
    searchVndbLive(clean, section, nsfwMode),
  ]);

  return [...anilistItems, ...vndbItems];
}
