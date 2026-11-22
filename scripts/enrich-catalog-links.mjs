import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'src', 'data', 'immersionCatalog.json');
const SHEET_ID = '1w42HEKEu2AzZg9K7PI0ma9ICmr2qYEKQ9IF4XxFSnQU';

const TABS = [
  { section: 'Novels', gid: '2065345633' },
  { section: 'Anime', gid: '1019246469' },
  { section: 'Manga', gid: '1293737411' },
  { section: 'Visual Novels', gid: '1514303440' },
  { section: 'Video Games', gid: '1564583131' },
  { section: 'Drama & TV', gid: '1215607333' },
  { section: 'YouTube', gid: '1148532140' },
  { section: 'VTubers', gid: '2108034225' },
  { section: 'Podcasts', gid: '304582628' },
];

function decodeHtmlEntities(str) {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function cleanText(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(str) {
  return cleanText(str).toLowerCase();
}

function unwrapGoogleRedirect(href) {
  try {
    const u = new URL(href);
    if (u.hostname.includes('google.com') && u.searchParams.get('q')) {
      return u.searchParams.get('q');
    }
  } catch {
    // ignore
  }
  return href;
}

function extractRowLinksFromHtml(html) {
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const imgRegex = /<img[^>]+src="([^"]+)"/i;
  const aRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  const rows = [];
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const trBody = trMatch[1];
    if (!imgRegex.test(trBody)) continue;

    const cells = [];
    const links = [];
    let tdMatch;
    tdRegex.lastIndex = 0;
    while ((tdMatch = tdRegex.exec(trBody)) !== null) {
      const tdHtml = tdMatch[1];
      const text = cleanText(decodeHtmlEntities(tdHtml.replace(/<[^>]+>/g, ' ')));
      cells.push(text);

      let aMatch;
      aRegex.lastIndex = 0;
      while ((aMatch = aRegex.exec(tdHtml)) !== null) {
        const url = unwrapGoogleRedirect(decodeHtmlEntities(aMatch[1]));
        const label = cleanText(
          decodeHtmlEntities(aMatch[2].replace(/<[^>]+>/g, ' '))
        );
        if (url.startsWith('http') && !url.includes('docs.google.com')) {
          links.push({ url, label, cellText: text });
        }
      }
    }

    rows.push({ cells, links });
  }
  return rows;
}

function parseAnilistUrl(url) {
  if (!url) return null;
  const m = url.match(/anilist\.co\/(anime|manga)\/(\d+)(?:\/([^/?#]+))?/i);
  if (!m) return null;
  const slug = m[3] ? m[3].replace(/-/g, ' ').trim() : '';
  return {
    type: m[1].toLowerCase(),
    id: Number(m[2]),
    romajiSlug: slug,
  };
}

function parseMyDramaListSlug(url) {
  if (!url) return '';
  const m = url.match(/mydramalist\.com\/\d+-([a-z0-9-]+)/i);
  return m ? m[1].replace(/-/g, ' ').trim() : '';
}

function parseBackloggdSlug(url) {
  if (!url) return '';
  const m = url.match(/backloggd\.com\/games\/([a-z0-9-]+)/i);
  return m ? m[1].replace(/-/g, ' ').trim() : '';
}

async function fetchAnilistIdByTitle(title, type = 'ANIME') {
  const query = `
    query ($search: String, $type: MediaType) {
      Media(search: $search, type: $type) {
        id
        title {
          romaji
          english
          native
        }
      }
    }
  `;
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { search: title, type } }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.Media ?? null;
  } catch {
    return null;
  }
}

async function searchEpubMoe(rawTitle) {
  const candidates = [
    rawTitle,
    rawTitle.replace(/【[^】]*】/g, '').trim(),
    rawTitle.split(/[～~〜—\-!！?？\s]/)[0]?.trim(),
  ].filter((x, idx, arr) => x && x.length >= 2 && arr.indexOf(x) === idx);

  for (const query of candidates) {
    try {
      const url = `https://epub.moe/api/search?q=${encodeURIComponent(query)}&language=jp`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.success && Array.isArray(data.results) && data.results.length > 0) {
        // Sort results so Volume 1 or shortest title comes first
        const sorted = [...data.results].sort((a, b) => {
          const aVol1 = /(?:^|[^\d])0?1(?:[^\d]|$)/.test(a.title) ? 0 : 1;
          const bVol1 = /(?:^|[^\d])0?1(?:[^\d]|$)/.test(b.title) ? 0 : 1;
          if (aVol1 !== bVol1) return aVol1 - bVol1;
          return (a.title?.length || 999) - (b.title?.length || 999);
        });
        return {
          primaryMd5: sorted[0].md5,
          primaryTitle: sorted[0].title,
          volumes: sorted.slice(0, 8).map((r) => ({
            md5: r.md5,
            title: r.title,
          })),
        };
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function searchMangaDex(title, romajiSlug) {
  const queries = [title, romajiSlug].filter(Boolean);
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.mangadex.org/manga?limit=3&title=${encodeURIComponent(q)}`
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data?.data) && data.data.length > 0) {
        return data.data[0].id;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function searchWikipediaEnglishTitle(jpTitle) {
  try {
    const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=en&titles=${encodeURIComponent(
      jpTitle
    )}&redirects=1&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      const ll = p?.langlinks?.[0]?.['*'];
      if (ll) {
        return ll.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function runPool(items, concurrency, fn) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));

  // 1. Fetch HTML links from all 9 sheet tabs
  const sheetRowsBySection = new Map();
  for (const tab of TABS) {
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview/sheet?headers=true&gid=${tab.gid}`;
    const res = await fetch(htmlUrl);
    const html = await res.text();
    const rows = extractRowLinksFromHtml(html);
    sheetRowsBySection.set(tab.section, rows);
  }

  // Group catalog items by section to match row-by-row and by title
  const bySection = new Map();
  for (const item of catalog) {
    if (!bySection.has(item.section)) bySection.set(item.section, []);
    bySection.get(item.section).push(item);
  }

  for (const [section, items] of bySection.entries()) {
    const htmlRows = sheetRowsBySection.get(section) || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const normTitle = normalizeKey(item.title);
      const matchedRow =
        htmlRows.find((r) =>
          r.cells.some((c) => normalizeKey(c) === normTitle)
        ) || htmlRows[i];

      if (matchedRow && matchedRow.links.length > 0) {
        item.sourceUrl = matchedRow.links[0].url;
        if (matchedRow.links.length > 1) {
          item.sampleUrl = matchedRow.links[1].url;
        }
      }
    }
  }

  // 2. Enrich Anime -> Bettermelon direct /info/<anilist_id> & /watch/<anilist_id>/1
  const animeItems = bySection.get('Anime') || [];
  await runPool(animeItems, 6, async (item) => {
    const parsed = parseAnilistUrl(item.sourceUrl);
    if (parsed?.id) {
      item.anilistId = parsed.id;
      if (parsed.romajiSlug) item.romajiTitle = parsed.romajiSlug;
    } else {
      const media = await fetchAnilistIdByTitle(item.title, 'ANIME');
      if (media?.id) {
        item.anilistId = media.id;
        item.romajiTitle =
          media.title?.romaji || media.title?.english || undefined;
      }
    }
    if (item.anilistId) {
      item.directUrl = `https://bettermelon.ru/info/${item.anilistId}`;
      item.watchUrl = `https://bettermelon.ru/watch/${item.anilistId}/1`;
    } else {
      item.directUrl = `https://bettermelon.ru/search?query=${encodeURIComponent(
        item.title
      )}`;
    }
  });
  console.log(
    `Anime enriched: ${animeItems.filter((x) => x.anilistId).length}/${animeItems.length} have direct Bettermelon /info/<id>`
  );

  // 3. Enrich Novels -> Epub.moe direct reader.epub.moe/?md5=<md5>
  const novelItems = bySection.get('Novels') || [];
  await runPool(novelItems, 8, async (item) => {
    const parsed = parseAnilistUrl(item.sourceUrl);
    if (parsed?.romajiSlug) {
      item.romajiTitle = parsed.romajiSlug;
    }
    const epubRes = await searchEpubMoe(item.title);
    if (epubRes?.primaryMd5) {
      item.epubMoeMd5 = epubRes.primaryMd5;
      item.directUrl = `https://reader.epub.moe/?md5=${epubRes.primaryMd5}`;
      item.downloadUrl = `https://epub.moe/books/${epubRes.primaryMd5}/download`;
      item.epubMoeVolumes = epubRes.volumes;
    }
  });
  console.log(
    `Novels enriched: ${novelItems.filter((x) => x.epubMoeMd5).length}/${novelItems.length} have direct Epub.moe reader MD5`
  );

  // 4. Enrich Manga -> MangaDex direct /title/<uuid> + Rawkuma
  const mangaItems = bySection.get('Manga') || [];
  await runPool(mangaItems, 5, async (item) => {
    const parsed = parseAnilistUrl(item.sourceUrl);
    if (parsed?.id) {
      item.anilistId = parsed.id;
      if (parsed.romajiSlug) item.romajiTitle = parsed.romajiSlug;
    }
    const mdId = await searchMangaDex(item.title, item.romajiTitle);
    if (mdId) {
      item.mangadexId = mdId;
      item.directUrl = `https://mangadex.org/title/${mdId}`;
    } else if (item.sourceUrl) {
      item.directUrl = item.sourceUrl;
    }
  });
  console.log(
    `Manga enriched: ${mangaItems.filter((x) => x.mangadexId).length}/${mangaItems.length} have direct MangaDex /title/<uuid>`
  );

  // 5. Enrich Visual Novels -> direct VNDB URL from sheet
  const vnItems = bySection.get('Visual Novels') || [];
  for (const item of vnItems) {
    if (item.sourceUrl) {
      item.directUrl = item.sourceUrl;
    }
  }
  console.log(
    `Visual Novels enriched: ${vnItems.filter((x) => x.directUrl).length}/${vnItems.length} have direct VNDB page`
  );

  // 6. Enrich Video Games -> Backloggd slug + direct URL
  const gameItems = bySection.get('Video Games') || [];
  for (const item of gameItems) {
    const slugTitle = parseBackloggdSlug(item.sourceUrl);
    if (slugTitle) {
      item.romajiTitle = slugTitle;
    }
    if (item.sourceUrl) {
      item.directUrl = item.sourceUrl;
    }
  }
  console.log(
    `Video Games enriched: ${gameItems.filter((x) => x.directUrl).length}/${gameItems.length} have direct game page`
  );

  // 7. Enrich Drama & TV -> English/Romaji title for Cinejoy.pk + MyDramaList sourceUrl
  const dramaItems = bySection.get('Drama & TV') || [];
  await runPool(dramaItems, 8, async (item) => {
    const mdlSlug = parseMyDramaListSlug(item.sourceUrl);
    const wikiEn = await searchWikipediaEnglishTitle(item.title);
    const searchTitle = wikiEn || mdlSlug || item.title;
    item.romajiTitle = searchTitle;
    item.directUrl = `https://cinejoy.pk/search?q=${encodeURIComponent(
      searchTitle
    )}`;
  });
  console.log(
    `Drama & TV enriched: ${dramaItems.filter((x) => x.directUrl).length}/${dramaItems.length} have direct Cinejoy search with English/Romaji title`
  );

  // 8. Enrich YouTube, VTubers, Podcasts -> exact direct channel/show/video URL
  for (const sec of ['YouTube', 'VTubers', 'Podcasts']) {
    const list = bySection.get(sec) || [];
    for (const item of list) {
      if (item.sourceUrl) {
        item.directUrl = item.sourceUrl;
      }
      if (item.sampleUrl) {
        item.watchUrl = item.sampleUrl;
      }
    }
    console.log(
      `${sec} enriched: ${list.filter((x) => x.directUrl).length}/${list.length} have direct channel/show URL`
    );
  }

  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog), 'utf8');
  console.log('Saved enriched catalog to', CATALOG_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
