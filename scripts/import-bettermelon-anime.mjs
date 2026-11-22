import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'src', 'data', 'immersionCatalog.json');
const COVERS_DIR = path.join(ROOT, 'public', 'covers');
const OUT_DIR =
  'C:/Users/mmaul/.gemini/antigravity/brain/ab2fab2d-5aaf-4e24-9bbe-4eb5dc80fb20/browser_sandbox/outputs';

function parseCompactCount(raw) {
  if (!raw) return undefined;
  const s = String(raw).trim().toUpperCase();
  if (s.endsWith('M')) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith('K')) return Math.round(parseFloat(s) * 1_000);
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function mapBmDifficultyToTier(bmDiff) {
  switch (bmDiff) {
    case 'Beginner':
      return 'Very Easy';
    case 'Easy':
      return 'Easy';
    case 'Average':
      return 'Medium';
    case 'Hard':
      return 'Hard';
    case 'Expert':
    case 'Insane':
      return 'Very Hard';
    default:
      return 'Medium';
  }
}

function mapTierToBmDefaults(tier) {
  switch (tier) {
    case 'Very Easy':
      return { bmDifficulty: 'Beginner', jlptLevel: 'N5' };
    case 'Easy':
      return { bmDifficulty: 'Easy', jlptLevel: 'N4' };
    case 'Medium':
      return { bmDifficulty: 'Average', jlptLevel: 'N3' };
    case 'Hard':
      return { bmDifficulty: 'Hard', jlptLevel: 'N2' };
    case 'Very Hard':
      return { bmDifficulty: 'Expert', jlptLevel: 'N1' };
    default:
      return { bmDifficulty: 'Average', jlptLevel: 'N3' };
  }
}

function parseSearchHudCards(text) {
  const results = [];
  const infoRegex = /\/url:\s*https:\/\/bettermelon\.ru\/info\/(\d+)/g;
  const matches = [...text.matchAll(infoRegex)];

  for (let i = 0; i < matches.length; i++) {
    const anilistId = Number(matches[i][1]);
    const endIdx = matches[i].index;
    const startIdx = i > 0 ? matches[i - 1].index : Math.max(0, endIdx - 3500);
    const chunk = text.slice(startIdx, endIdx);

    const titleMatches = [
      ...chunk.matchAll(/-\s*text:\s*"?([^"\n]+?\s·\s[^"\n]+?)"?\r?\n/g),
    ];
    if (titleMatches.length === 0) continue;
    const rawTitlePair = titleMatches[titleMatches.length - 1][1].trim();
    const dotIdx = rawTitlePair.lastIndexOf(' · ');
    if (dotIdx < 0) continue;
    const enTitle = rawTitlePair.slice(0, dotIdx).trim();
    const jpTitle = rawTitlePair.slice(dotIdx + 3).trim();

    const jlptMatch = chunk.match(/-\s*text:\s*"?(N[1-5])\s*·\s*([^"\n]+)"?/);
    const jlptLevel = jlptMatch ? jlptMatch[1].trim() : 'N3';

    const diffMatch = chunk.match(
      /Difficulty\s*·\s*(Beginner|Easy|Average|Hard|Expert|Insane)\s*·\s*Unique kanji\s*(\d+)\s*once\s*·\s*(\d+)\s*·\s*Word count\s*·\s*(\d+)\s*·\s*Unique words\s*(\d+)\s*once\s*·\s*(\d+)\s*·\s*Speech duration\s*·\s*([^·]+?)\s*·\s*Speech speed\s*·\s*(\d+)(?:\s*·\s*Episodes\s*·\s*(\d*))?(?:\s*·\s*External Rating\s*·\s*(\d+)\s*%)?(?:\s*·\s*([^"\n]+))?/
    );
    if (!diffMatch) continue;

    const genres = [
      ...chunk.matchAll(
        /\/url:\s*https:\/\/bettermelon\.ru\/search\?genres=([^\s\n]+)/g
      ),
    ].map((m) => decodeURIComponent(m[1]));

    results.push({
      anilistId,
      enTitle,
      jpTitle,
      jlptLevel,
      bmDifficulty: diffMatch[1],
      uniqueKanji: Number(diffMatch[3]),
      wordCount: Number(diffMatch[4]),
      uniqueWords: Number(diffMatch[6]),
      speechDuration: diffMatch[7].trim(),
      speechSpeed: Number(diffMatch[8]),
      episodes: diffMatch[9] ? Number(diffMatch[9]) : undefined,
      externalRating: diffMatch[10] ? Number(diffMatch[10]) : undefined,
      synopsis: (diffMatch[11] || '').replace(/"$/, '').trim(),
      genres,
    });
  }
  return results;
}

function parseHomepageHudCards(text) {
  const results = [];
  const cardRegex =
    /\/url:\s*https:\/\/bettermelon\.ru\/info\/(\d+)\s+-\s*generic\s*"Approximate JLPT level\s*·\s*difficulty\s*([\d.]+)\/5"[^:]*:\s*(N[1-5])\s+-\s*'?generic\s*"([^"]+)"[^\n]*\n\s*-\s*text:\s*(\d{4})\s*·\s*([A-Z]+)\s*·\s*(Beginner|Easy|Average|Hard|Expert|Insane)\s*·\s*([\d.]+[KM]?)\s*words\s*·\s*([\d.]+[KM]?)\s*kanji\s*·\s*(\d+)\s*mora\/min\s*·\s*([^\n]+?)\s*speech/g;

  let m;
  while ((m = cardRegex.exec(text)) !== null) {
    results.push({
      anilistId: Number(m[1]),
      bmScore: `${m[2]}/5`,
      jlptLevel: m[3],
      enTitle: m[4].trim(),
      bmDifficulty: m[7],
      wordCount: parseCompactCount(m[8]),
      uniqueKanji: parseCompactCount(m[9]),
      speechSpeed: Number(m[10]),
      speechDuration: m[11].trim(),
    });
  }
  return results;
}

async function fetchAnilistMediaBatch(ids) {
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
          title {
            native
            romaji
            english
          }
          coverImage {
            extraLarge
            large
          }
          description(asHtml: false)
          episodes
          duration
          genres
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
      const list = json?.data?.Page?.media || [];
      for (const media of list) {
        map.set(media.id, media);
      }
    } catch {
      // ignore
    }
  }
  return map;
}

function cleanSynopsis(str) {
  return (str || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDifficultyExplanation(rec) {
  const parts = [`Bettermelon Difficulty: ${rec.bmDifficulty}`];
  if (rec.bmScore) parts[0] += ` (${rec.bmScore})`;
  if (rec.jlptLevel) parts.push(`Level Bahasa: JLPT ${rec.jlptLevel}`);
  if (rec.speechSpeed) parts.push(`Kecepatan bicara: ${rec.speechSpeed} mora/menit`);
  if (rec.uniqueKanji) parts.push(`Kanji unik: ${rec.uniqueKanji.toLocaleString('en-US')}`);
  if (rec.wordCount) parts.push(`Total kata: ${rec.wordCount.toLocaleString('en-US')}`);
  if (rec.speechDuration) parts.push(`Durasi dialog: ${rec.speechDuration}`);
  return parts.join(' • ');
}

async function downloadCover(url, filename) {
  if (!url) return null;
  try {
    const targetPath = path.join(COVERS_DIR, filename);
    try {
      const st = await fs.stat(targetPath);
      if (st.size > 200) return `covers/${filename}`;
    } catch {
      // file does not exist yet
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(targetPath, buf);
    return `covers/${filename}`;
  } catch {
    return null;
  }
}

async function main() {
  const files = (await fs.readdir(OUT_DIR)).filter((f) => f.endsWith('_hud.txt'));
  const bmById = new Map();

  for (const file of files) {
    const content = await fs.readFile(path.join(OUT_DIR, file), 'utf8');
    for (const c of parseSearchHudCards(content)) {
      const prev = bmById.get(c.anilistId) || {};
      bmById.set(c.anilistId, {
        ...prev,
        ...c,
        synopsis:
          (c.synopsis?.length || 0) > (prev.synopsis?.length || 0)
            ? c.synopsis
            : prev.synopsis,
      });
    }
    for (const h of parseHomepageHudCards(content)) {
      const prev = bmById.get(h.anilistId) || {};
      bmById.set(h.anilistId, {
        ...h,
        ...prev,
        bmScore: h.bmScore || prev.bmScore,
        jlptLevel: h.jlptLevel || prev.jlptLevel,
        bmDifficulty: h.bmDifficulty || prev.bmDifficulty,
        wordCount: prev.wordCount || h.wordCount,
        uniqueKanji: prev.uniqueKanji || h.uniqueKanji,
        speechSpeed: prev.speechSpeed || h.speechSpeed,
        speechDuration: prev.speechDuration || h.speechDuration,
      });
    }
  }

  // Known exact scores from /info/<id> inspections
  const exactScores = {
    6862: '0.99/5',
    127331: '1.01/5',
    12403: '1.17/5',
    100178: '1.62/5',
    154587: '2.68/5',
    21838: '4.31/5',
    11741: '4.99/5',
  };
  for (const [idStr, score] of Object.entries(exactScores)) {
    const id = Number(idStr);
    if (bmById.has(id)) {
      bmById.get(id).bmScore = score;
    }
  }

  // Also add Frieren (154587), Crayon Shin-chan (127331), and Liz and the Blue Bird (100178) from /info/<id>
  const extraInfoRecords = [
    {
      anilistId: 154587,
      enTitle: "Frieren: Beyond Journey's End",
      jpTitle: '葬送のフリーレン',
      jlptLevel: 'N3',
      bmDifficulty: 'Average',
      bmScore: '2.68/5',
      wordCount: 44483,
      uniqueWords: 5240,
      uniqueKanji: 1395,
      speechSpeed: 279,
      speechDuration: '7h 13min',
    },
    {
      anilistId: 127331,
      enTitle: 'Crayon Shin-chan: Nazo Meki! Hana no Tenkasu Gakuen',
      jpTitle: '映画クレヨンしんちゃん 謎メキ！花の天カス学園',
      jlptLevel: 'N4',
      bmDifficulty: 'Beginner',
      bmScore: '1.01/5',
      wordCount: 7714,
      uniqueWords: 1790,
      uniqueKanji: 294,
      speechSpeed: 271,
      speechDuration: '1h 15min',
    },
    {
      anilistId: 100178,
      enTitle: 'Liz and the Blue Bird',
      jpTitle: 'リズと青い鳥',
      jlptLevel: 'N4',
      bmDifficulty: 'Easy',
      bmScore: '1.62/5',
      wordCount: 3688,
      uniqueWords: 934,
      uniqueKanji: 394,
      speechSpeed: 265,
      speechDuration: '37min',
    },
  ];
  for (const rec of extraInfoRecords) {
    const prev = bmById.get(rec.anilistId) || {};
    bmById.set(rec.anilistId, { ...prev, ...rec });
  }

  console.log('Total Bettermelon difficulty-analyzed anime extracted:', bmById.size);

  // Fetch AniList metadata for all extracted Bettermelon anime IDs
  const anilistMap = await fetchAnilistMediaBatch([...bmById.keys()]);
  console.log('Fetched AniList metadata for:', anilistMap.size, 'anime');

  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
  const existingAnimeByAnilistId = new Map();
  for (const item of catalog) {
    if (item.section === 'Anime' && item.anilistId) {
      existingAnimeByAnilistId.set(Number(item.anilistId), item);
    }
  }

  let updatedExisting = 0;
  let addedNew = 0;
  const newAnimeItems = [];

  for (const [anilistId, bm] of bmById.entries()) {
    const al = anilistMap.get(anilistId);
    const nativeTitle = bm.jpTitle || al?.title?.native || bm.enTitle;
    const romajiOrEn =
      bm.enTitle || al?.title?.english || al?.title?.romaji || nativeTitle;
    const tier = mapBmDifficultyToTier(bm.bmDifficulty);
    const rankingLabel = `${bm.bmDifficulty} • ${bm.jlptLevel}${
      bm.bmScore ? ` (${bm.bmScore})` : ''
    }`;
    const diffExplanation = buildDifficultyExplanation(bm);
    const description =
      cleanSynopsis(bm.synopsis) ||
      cleanSynopsis(al?.description) ||
      'Anime bahasa Jepang dengan subtitle interaktif di Bettermelon.ru.';

    const bmStats = {
      jlptLevel: bm.jlptLevel,
      bmDifficulty: bm.bmDifficulty,
      bmScore: bm.bmScore,
      wordCount: bm.wordCount,
      uniqueWords: bm.uniqueWords,
      uniqueKanji: bm.uniqueKanji,
      speechSpeed: bm.speechSpeed,
      speechDuration: bm.speechDuration,
    };

    const existing = existingAnimeByAnilistId.get(anilistId);
    if (existing) {
      existing.ranking = rankingLabel;
      existing.difficultyTier = tier;
      existing.romajiTitle = romajiOrEn;
      existing.difficultyExplanation = existing.difficultyExplanation
        ? `${diffExplanation} — ${existing.difficultyExplanation}`
        : diffExplanation;
      if (!existing.description && description) {
        existing.description = description;
      }
      existing.bmStats = bmStats;
      existing.directUrl = `https://bettermelon.ru/info/${anilistId}`;
      existing.watchUrl = `https://bettermelon.ru/watch/${anilistId}/1`;
      updatedExisting++;
    } else {
      const coverUrl = al?.coverImage?.large || al?.coverImage?.extraLarge;
      const localCover = await downloadCover(coverUrl, `bm-${anilistId}.jpg`);

      newAnimeItems.push({
        id: `bm-${anilistId}`,
        section: 'Anime',
        category: 'anime',
        ranking: rankingLabel,
        difficultyTier: tier,
        title:
          nativeTitle && nativeTitle !== romajiOrEn
            ? `${nativeTitle} (${romajiOrEn})`
            : nativeTitle,
        romajiTitle: romajiOrEn,
        difficultyExplanation: diffExplanation,
        description,
        suggestedMinutes: al?.duration || 24,
        coverImage: localCover || undefined,
        anilistId,
        sourceUrl: `https://anilist.co/anime/${anilistId}`,
        directUrl: `https://bettermelon.ru/info/${anilistId}`,
        watchUrl: `https://bettermelon.ru/watch/${anilistId}/1`,
        bmStats,
      });
      addedNew++;
    }
  }

  // Also ensure every remaining Anime in catalog has Bettermelon difficulty + JLPT badge
  for (const item of catalog) {
    if (item.section === 'Anime' && !item.bmStats) {
      const def = mapTierToBmDefaults(item.difficultyTier);
      item.bmStats = {
        jlptLevel: def.jlptLevel,
        bmDifficulty: def.bmDifficulty,
      };
      item.ranking = `${def.bmDifficulty} • ${def.jlptLevel}`;
    }
  }

  // Insert new Bettermelon anime right after existing Anime items, sorted by difficulty tier
  const tierOrder = {
    'Very Easy': 1,
    Easy: 2,
    Medium: 3,
    Hard: 4,
    'Very Hard': 5,
  };
  newAnimeItems.sort(
    (a, b) =>
      (tierOrder[a.difficultyTier] || 3) - (tierOrder[b.difficultyTier] || 3)
  );

  const lastAnimeIdx = catalog.reduce(
    (acc, item, idx) => (item.section === 'Anime' ? idx : acc),
    -1
  );
  catalog.splice(lastAnimeIdx + 1, 0, ...newAnimeItems);

  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog), 'utf8');
  const totalAnime = catalog.filter((x) => x.section === 'Anime').length;
  const missingCovers = catalog.filter((x) => !x.coverImage).length;
  console.log(
    `Updated ${updatedExisting} existing anime, added ${addedNew} new Bettermelon anime. Total Anime in catalog: ${totalAnime}. Total catalog items: ${catalog.length}. Missing covers: ${missingCovers}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
