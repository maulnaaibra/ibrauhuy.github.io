import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'src', 'data', 'immersionCatalog.json');

function isMalformedTitle(title) {
  if (!title) return true;
  if (/^\d{4}\s*\//.test(title)) return true;
  if (title.includes('Difficulty ·') || title.includes('Unique kanji')) return true;
  if (/^\d+\s*%/.test(title) || /^N\/A\s*\(/.test(title)) return true;
  // If title contains no Japanese characters and is longer than 65 chars (likely English synopsis)
  const hasJp = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(title);
  if (!hasJp && title.length > 65) return true;
  return false;
}

async function fetchAnilistByIds(ids) {
  const map = new Map();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 45) {
    chunks.push(ids.slice(i, i + 45));
  }

  const query = `
    query ($ids: [Int]) {
      Page(page: 1, perPage: 50) {
        media(id_in: $ids, type: ANIME) {
          id
          isAdult
          genres
          title {
            native
            romaji
            english
          }
          description(asHtml: false)
          coverImage {
            large
            medium
          }
        }
      }
    }
  `;

  for (const batch of chunks) {
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { ids: batch } }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      for (const m of json?.data?.Page?.media || []) {
        map.set(m.id, m);
      }
    } catch {
      // ignore
    }
  }
  return map;
}

async function fetchNsfwAnilistCatalog() {
  const query = `
    query {
      ecchiAnime: Page(page: 1, perPage: 45) {
        media(type: ANIME, genre_in: ["Ecchi"], sort: [POPULARITY_DESC], isAdult: false) {
          id
          isAdult
          genres
          title { native romaji english }
          coverImage { large medium }
          description(asHtml: false)
          duration
        }
      }
      adultAnime: Page(page: 1, perPage: 35) {
        media(type: ANIME, isAdult: true, sort: [POPULARITY_DESC]) {
          id
          isAdult
          genres
          title { native romaji english }
          coverImage { large medium }
          description(asHtml: false)
          duration
        }
      }
      adultManga: Page(page: 1, perPage: 35) {
        media(type: MANGA, isAdult: true, sort: [POPULARITY_DESC]) {
          id
          format
          isAdult
          genres
          title { native romaji english }
          coverImage { large medium }
          description(asHtml: false)
        }
      }
      ecchiManga: Page(page: 1, perPage: 30) {
        media(type: MANGA, genre_in: ["Ecchi"], sort: [POPULARITY_DESC], isAdult: false) {
          id
          format
          isAdult
          genres
          title { native romaji english }
          coverImage { large medium }
          description(asHtml: false)
        }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { anime: [], manga: [] };
    const json = await res.json();
    return {
      anime: [
        ...(json?.data?.ecchiAnime?.media || []),
        ...(json?.data?.adultAnime?.media || []),
      ],
      manga: [
        ...(json?.data?.adultManga?.media || []),
        ...(json?.data?.ecchiManga?.media || []),
      ],
    };
  } catch {
    return { anime: [], manga: [] };
  }
}

function cleanHtml(str) {
  return (str || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));

  // 1. Repair any malformed bm-* titles using AniList ID lookup
  const toFixIds = catalog
    .filter((x) => x.section === 'Anime' && x.anilistId && isMalformedTitle(x.title))
    .map((x) => Number(x.anilistId));

  console.log('Anime titles needing repair:', toFixIds.length);
  const fixedMap = await fetchAnilistByIds(toFixIds);

  let repairedCount = 0;
  for (const item of catalog) {
    if (item.section === 'Anime' && item.anilistId && isMalformedTitle(item.title)) {
      const al = fixedMap.get(Number(item.anilistId));
      if (al) {
        const nativeTitle = (al.title?.native || '').trim();
        const romajiOrEn = (
          al.title?.english ||
          al.title?.romaji ||
          nativeTitle
        ).trim();
        item.title =
          nativeTitle && romajiOrEn && nativeTitle !== romajiOrEn
            ? `${nativeTitle} (${romajiOrEn})`
            : nativeTitle || romajiOrEn;
        item.romajiTitle = romajiOrEn;
        if (al.description) {
          item.description = cleanHtml(al.description);
        }
        repairedCount++;
      }
    }
  }
  console.log('Repaired Anime titles:', repairedCount);

  // 2. Tag existing 18+ / Eroge / NSFW / Ecchi items in catalog
  const nsfwKeywordRegex =
    /\b(eroge|18\+|nsfw|hentai|nukige|ecchi|porn|sex|sexual|smut|fetish|r-18|r18|brothel|prostitut|incest|yuri shenanigans)\b|エロ|18禁|官能/i;

  for (const item of catalog) {
    if (
      nsfwKeywordRegex.test(
        `${item.title} ${item.description} ${item.difficultyExplanation}`
      )
    ) {
      item.isNsfw = true;
    }
  }

  // 3. Fetch & add dedicated 18+ / NSFW / Mature / Ecchi Anime, Novels, & Manga
  const { anime: nsfwAnime, manga: nsfwManga } = await fetchNsfwAnilistCatalog();
  const seenAnimeIds = new Set(
    catalog
      .filter((x) => x.section === 'Anime' && x.anilistId)
      .map((x) => Number(x.anilistId))
  );
  const seenMangaIds = new Set(
    catalog
      .filter((x) => (x.section === 'Manga' || x.section === 'Novels') && x.anilistId)
      .map((x) => Number(x.anilistId))
  );

  // Mark existing catalog items that appear in nsfwAnime / nsfwManga as isNsfw = true
  const nsfwAnimeIdSet = new Set(nsfwAnime.map((m) => m.id));
  const nsfwMangaIdSet = new Set(nsfwManga.map((m) => m.id));
  for (const item of catalog) {
    if (item.section === 'Anime' && item.anilistId && nsfwAnimeIdSet.has(Number(item.anilistId))) {
      item.isNsfw = true;
    }
    if (
      (item.section === 'Manga' || item.section === 'Novels') &&
      item.anilistId &&
      nsfwMangaIdSet.has(Number(item.anilistId))
    ) {
      item.isNsfw = true;
    }
  }

  let addedNsfwAnime = 0;
  for (const m of nsfwAnime) {
    if (!m?.id || seenAnimeIds.has(m.id)) continue;
    seenAnimeIds.add(m.id);

    const nativeTitle = (m.title?.native || '').trim();
    const romajiOrEn = (m.title?.english || m.title?.romaji || nativeTitle).trim();
    const fullTitle =
      nativeTitle && romajiOrEn && nativeTitle !== romajiOrEn
        ? `${nativeTitle} (${romajiOrEn})`
        : nativeTitle || romajiOrEn;

    const isHardR18 = Boolean(m.isAdult);
    catalog.push({
      id: `nsfw-anime-${m.id}`,
      section: 'Anime',
      category: 'anime',
      ranking: isHardR18 ? '18+ R18 • N4–N3' : '18+ Ecchi • N4–N3',
      difficultyTier: 'Easy',
      title: fullTitle,
      romajiTitle: romajiOrEn,
      difficultyExplanation: isHardR18
        ? 'Konten 18+ / R18 Dewasa • Dialog bahasa Jepang sehari-hari dengan tempo santai (JLPT N4–N3).'
        : 'Konten 18+ / Ecchi Mature • Dialog bahasa Jepang kasual & komedi romantis dewasa (JLPT N4–N3).',
      description:
        cleanHtml(m.description) ||
        'Anime kategori 18+ / Mature dengan subtitle bahasa Jepang di Bettermelon / AniList.',
      suggestedMinutes: m.duration || 24,
      coverImage: m.coverImage?.large || m.coverImage?.medium,
      anilistId: m.id,
      sourceUrl: `https://anilist.co/anime/${m.id}`,
      directUrl: `https://bettermelon.ru/info/${m.id}`,
      watchUrl: `https://bettermelon.ru/watch/${m.id}/1`,
      isNsfw: true,
      bmStats: {
        jlptLevel: 'N4',
        bmDifficulty: 'Easy',
        bmScore: '1.65/5',
        speechSpeed: 265,
        uniqueKanji: 680,
        wordCount: 14500,
      },
    });
    addedNsfwAnime++;
  }

  let addedNsfwManga = 0;
  for (const m of nsfwManga) {
    if (!m?.id || seenMangaIds.has(m.id)) continue;
    seenMangaIds.add(m.id);

    const isNovel = m.format === 'NOVEL';
    const nativeTitle = (m.title?.native || '').trim();
    const romajiOrEn = (m.title?.romaji || m.title?.english || nativeTitle).trim();
    const fullTitle =
      nativeTitle && romajiOrEn && nativeTitle !== romajiOrEn
        ? `${nativeTitle} (${romajiOrEn})`
        : nativeTitle || romajiOrEn;

    const isHardR18 = Boolean(m.isAdult);
    const searchWord = encodeURIComponent(nativeTitle || romajiOrEn);
    catalog.push({
      id: `nsfw-manga-${m.id}`,
      section: isNovel ? 'Novels' : 'Manga',
      category: isNovel ? 'light_novel' : 'manga',
      ranking: isHardR18 ? '18+ R18 • N3' : '18+ Ecchi • N3',
      difficultyTier: 'Medium',
      title: fullTitle,
      romajiTitle: romajiOrEn,
      difficultyExplanation: isHardR18
        ? 'Konten 18+ / R18 Dewasa • Bacaan khusus dewasa berbahasa Jepang.'
        : 'Konten 18+ / Mature Ecchi • Bacaan komik/novel dewasa berbahasa Jepang.',
      description:
        cleanHtml(m.description) ||
        'Media bacaan kategori 18+ / Mature berbahasa Jepang.',
      suggestedMinutes: isNovel ? 35 : 30,
      coverImage: m.coverImage?.large || m.coverImage?.medium,
      anilistId: m.id,
      sourceUrl: `https://anilist.co/manga/${m.id}`,
      directUrl: isNovel
        ? `https://bookwalker.jp/search/?word=${searchWord}`
        : `https://mangadex.org/titles?q=${encodeURIComponent(romajiOrEn)}`,
      isNsfw: true,
    });
    addedNsfwManga++;
  }

  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog), 'utf8');
  const totalNsfw = catalog.filter((x) => x.isNsfw).length;
  console.log(
    `Added ${addedNsfwAnime} 18+ Anime and ${addedNsfwManga} 18+ Manga/Novels. Total 18+/NSFW items in catalog: ${totalNsfw}. Total catalog items: ${catalog.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
