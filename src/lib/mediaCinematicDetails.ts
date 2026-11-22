import type { SheetCatalogItem } from '../components/MediaCatalogBrowser';

export interface CastMember {
  id: number;
  name: string;
  nativeName?: string;
  role: string;
  image: string;
  voiceActorName?: string;
  voiceActorNative?: string;
  voiceActorImage?: string;
}

export interface EnrichedCinematicMedia {
  bannerImage?: string;
  widescreenStill?: string;
  coverExtraLarge?: string;
  averageScore?: number; // e.g. 8.5
  popularity?: number;
  seasonYear?: number;
  episodes?: number;
  chapters?: number;
  volumes?: number;
  durationMinutes?: number;
  format?: string;
  status?: string;
  genres: string[];
  studio?: string;
  synopsisHtml?: string;
  cast: CastMember[];
}

const DETAILS_CACHE = new Map<string, EnrichedCinematicMedia>();
const WATCHLIST_STORAGE_KEY = 'immersiontrack_user_watchlist_v1';
const WATCHED_EPISODES_KEY = 'immersiontrack_watched_episodes_v1';

export function loadUserWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {
    // ignore
  }
  return [];
}

export function toggleUserWatchlistItem(itemId: string): {
  list: string[];
  added: boolean;
} {
  const current = loadUserWatchlist();
  const exists = current.includes(itemId);
  const next = exists
    ? current.filter((id) => id !== itemId)
    : [itemId, ...current];
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return { list: next, added: !exists };
}

export function loadWatchedEpisodesMap(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(WATCHED_EPISODES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

export function toggleWatchedEpisode(
  itemId: string,
  episodeNumber: number
): number[] {
  const map = loadWatchedEpisodesMap();
  const current = Array.isArray(map[itemId]) ? map[itemId] : [];
  const exists = current.includes(episodeNumber);
  const next = exists
    ? current.filter((ep) => ep !== episodeNumber)
    : [...current, episodeNumber].sort((a, b) => a - b);
  map[itemId] = next;
  try {
    localStorage.setItem(WATCHED_EPISODES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  return next;
}

function stripHtmlTags(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFallbackGenres(item: SheetCatalogItem): string[] {
  switch (item.section) {
    case 'Anime':
      return ['Animation', 'Japanese Audio', item.ranking || 'JLPT Immersion'];
    case 'Novels':
      return ['Light Novel', 'Bungei', 'Japanese Literature'];
    case 'Manga':
      return ['Manga', ' Tankobon', 'Japanese Reading'];
    case 'Visual Novels':
      return ['Visual Novel', 'Interactive Story', 'Full Voice JP'];
    case 'Video Games':
      return ['JRPG / Adventure', 'Japanese UI & Dialogue'];
    case 'Drama & TV':
      return ['Live Action', 'J-Drama', 'Real Conversation'];
    case 'YouTube':
      return ['YouTube JP', 'Native Creator', 'Listening'];
    case 'VTubers':
      return ['VTuber Stream', 'Live Chatting', 'Casual Japanese'];
    case 'Podcasts':
      return ['Audio Podcast', 'Pure Listening', 'Comprehension'];
    default:
      return ['Japanese Immersion'];
  }
}

export async function fetchEnrichedCinematicMedia(
  item: SheetCatalogItem
): Promise<EnrichedCinematicMedia> {
  const cacheKey = `${item.section}::${item.anilistId || item.title}`;
  const cached = DETAILS_CACHE.get(cacheKey);
  if (cached) return cached;

  const fallback: EnrichedCinematicMedia = {
    genres: getFallbackGenres(item),
    averageScore:
      item.difficultyTier === 'Very Easy'
        ? 8.4
        : item.difficultyTier === 'Easy'
          ? 8.6
          : item.difficultyTier === 'Medium'
            ? 8.7
            : 8.8,
    durationMinutes: item.suggestedMinutes,
    episodes: item.section === 'Anime' ? 12 : item.section === 'Drama & TV' ? 10 : undefined,
    cast: [],
  };

  const isAniListSection =
    item.section === 'Anime' ||
    item.section === 'Manga' ||
    item.section === 'Novels';

  if (!isAniListSection && !item.anilistId) {
    DETAILS_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  const mediaType = item.section === 'Anime' ? 'ANIME' : 'MANGA';

  const queryById = `
    query ($id: Int) {
      Media(id: $id, isAdult: false) {
        id
        bannerImage
        coverImage { extraLarge large }
        averageScore
        popularity
        seasonYear
        startDate { year }
        episodes
        chapters
        volumes
        duration
        format
        status
        genres
        description(asHtml: false)
        trailer {
          id
          site
          thumbnail
        }
        streamingEpisodes {
          title
          thumbnail
        }
        studios(isMain: true) {
          nodes { name }
        }
        characters(sort: [ROLE, RELEVANCE, ID], perPage: 10) {
          edges {
            role
            node {
              id
              name { full native }
              image { large }
            }
            voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
              id
              name { full native }
              image { large }
            }
          }
        }
      }
    }
  `;

  const queryBySearch = `
    query ($search: String, $type: MediaType) {
      Media(search: $search, type: $type, isAdult: false) {
        id
        bannerImage
        coverImage { extraLarge large }
        averageScore
        popularity
        seasonYear
        startDate { year }
        episodes
        chapters
        volumes
        duration
        format
        status
        genres
        description(asHtml: false)
        trailer {
          id
          site
          thumbnail
        }
        streamingEpisodes {
          title
          thumbnail
        }
        studios(isMain: true) {
          nodes { name }
        }
        characters(sort: [ROLE, RELEVANCE, ID], perPage: 10) {
          edges {
            role
            node {
              id
              name { full native }
              image { large }
            }
            voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
              id
              name { full native }
              image { large }
            }
          }
        }
      }
    }
  `;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const body = item.anilistId
      ? { query: queryById, variables: { id: item.anilistId } }
      : {
          query: queryBySearch,
          variables: {
            search: item.romajiTitle || item.title,
            type: mediaType,
          },
        };

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      DETAILS_CACHE.set(cacheKey, fallback);
      return fallback;
    }

    const json = await res.json();
    const m = json?.data?.Media;
    if (!m) {
      DETAILS_CACHE.set(cacheKey, fallback);
      return fallback;
    }

    const cast: CastMember[] = (m.characters?.edges ?? [])
      .map((edge: Record<string, unknown>) => {
        const node = edge.node as Record<string, unknown> | undefined;
        if (!node) return null;
        const nameObj = (node.name as Record<string, string>) ?? {};
        const imgObj = (node.image as Record<string, string>) ?? {};
        const vas = Array.isArray(edge.voiceActors) ? edge.voiceActors : [];
        const va = vas[0] as Record<string, unknown> | undefined;
        const vaName = (va?.name as Record<string, string>) ?? {};
        const vaImg = (va?.image as Record<string, string>) ?? {};

        return {
          id: Number(node.id || Math.random()),
          name: nameObj.full || nameObj.native || 'Character',
          nativeName: nameObj.native,
          role: String(edge.role || 'MAIN'),
          image: imgObj.large || '',
          voiceActorName: vaName.full,
          voiceActorNative: vaName.native,
          voiceActorImage: vaImg.large,
        };
      })
      .filter(Boolean) as CastMember[];

    const studioNodes = m.studios?.nodes;
    const studioName =
      Array.isArray(studioNodes) && studioNodes.length > 0
        ? studioNodes[0]?.name
        : undefined;

    const epThumb =
      Array.isArray(m.streamingEpisodes) && m.streamingEpisodes.length > 0
        ? m.streamingEpisodes[0]?.thumbnail
        : undefined;
    const trailerThumb =
      m.trailer?.site === 'youtube' && m.trailer?.id
        ? `https://i.ytimg.com/vi/${m.trailer.id}/hqdefault.jpg`
        : m.trailer?.thumbnail;

    const enriched: EnrichedCinematicMedia = {
      bannerImage: m.bannerImage || undefined,
      widescreenStill: epThumb || trailerThumb || undefined,
      coverExtraLarge: m.coverImage?.extraLarge || m.coverImage?.large,
      averageScore: m.averageScore
        ? Number((m.averageScore / 10).toFixed(1))
        : fallback.averageScore,
      popularity: m.popularity || undefined,
      seasonYear: m.seasonYear || m.startDate?.year || undefined,
      episodes: m.episodes || fallback.episodes,
      chapters: m.chapters || undefined,
      volumes: m.volumes || undefined,
      durationMinutes: m.duration || item.suggestedMinutes,
      format: m.format || undefined,
      status: m.status || undefined,
      genres:
        Array.isArray(m.genres) && m.genres.length > 0
          ? m.genres.filter((g: string) => g !== 'Ecchi' && g !== 'Hentai')
          : fallback.genres,
      studio: studioName,
      synopsisHtml: stripHtmlTags(m.description),
      cast,
    };

    DETAILS_CACHE.set(cacheKey, enriched);
    return enriched;
  } catch {
    DETAILS_CACHE.set(cacheKey, fallback);
    return fallback;
  }
}
