import { useEffect, useState } from 'react';
import { getCategoryMeta, type ImmersionCategory } from '../types';

const COVERS_CACHE_KEY = 'immersiontrack_covers_v1';
const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const inflightRequests = new Map<string, Promise<string | null>>();

function readCoverCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(COVERS_CACHE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // ignore storage errors
  }
  return {};
}

function writeCoverCache(cache: Record<string, string>): void {
  try {
    localStorage.setItem(COVERS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

function makeCacheKey(title: string, category: string): string {
  return `${category}:${title.trim().toLowerCase()}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generatePosterSvgDataUrl(
  title: string,
  category: ImmersionCategory | string
): string {
  const meta = getCategoryMeta(category);
  const cleanTitle = title.trim() || meta.label;
  const words = cleanTitle.split(/\s+/).filter(Boolean);
  const monogram =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : cleanTitle.slice(0, 2).toUpperCase();

  const shortTitle =
    cleanTitle.length > 26 ? `${cleanTitle.slice(0, 25)}…` : cleanTitle;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#dc2626"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.88" cy="0.16" r="0.72">
      <stop offset="0%" stop-color="${meta.color}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${meta.color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="240" height="320" rx="16" fill="url(#bg)"/>
  <rect width="240" height="320" rx="16" fill="url(#glow)"/>
  <rect x="0" y="0" width="240" height="6" fill="url(#accent)"/>
  <circle cx="195" cy="54" r="76" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  <rect x="18" y="22" width="84" height="22" rx="11" fill="rgba(255,255,255,0.1)"/>
  <circle cx="30" cy="33" r="3.5" fill="${meta.color}"/>
  <text x="40" y="37" font-family="Inter,system-ui,sans-serif" font-size="10" font-weight="600" fill="#f1f5f9">${escapeXml(
    meta.shortLabel.toUpperCase()
  )}</text>
  <text x="120" y="170" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="58" font-weight="800" letter-spacing="-2" fill="rgba(255,255,255,0.16)">${escapeXml(
    monogram
  )}</text>
  <line x1="18" y1="250" x2="222" y2="250" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  <text x="18" y="274" font-family="Inter,system-ui,sans-serif" font-size="13" font-weight="600" fill="#ffffff">${escapeXml(
    shortTitle
  )}</text>
  <text x="18" y="294" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#94a3b8">${escapeXml(
    meta.label
  )}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getAniListMediaType(
  category: ImmersionCategory | string
): 'ANIME' | 'MANGA' | null {
  if (category === 'anime' || category === 'movie' || category === 'watching') {
    return 'ANIME';
  }
  if (
    category === 'manga' ||
    category === 'light_novel' ||
    category === 'book' ||
    category === 'reading'
  ) {
    return 'MANGA';
  }
  return null;
}

function cleanSearchTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\b(vol\.?|volume|ep\.?|episode|ch\.?|chapter)\s*\d+.*$/i, '')
    .replace(/\s*[-–|]\s*.*$/, '')
    .trim();
}

async function resolveAniListCover(
  title: string,
  category: ImmersionCategory | string
): Promise<string | null> {
  const mediaType = getAniListMediaType(category);
  if (!mediaType) return null;

  const key = makeCacheKey(title, category);
  const cache = readCoverCache();
  if (key in cache) {
    return cache[key] || null;
  }

  const existing = inflightRequests.get(key);
  if (existing) return existing;

  const search = cleanSearchTitle(title);
  if (search.length < 3) return null;

  const reqPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(ANILIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query ($search: String, $type: MediaType) {
            Media(search: $search, type: $type) {
              coverImage {
                large
              }
            }
          }`,
          variables: { search, type: mediaType },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const json = (await res.json()) as {
        data?: { Media?: { coverImage?: { large?: string } } };
      };
      const url = json.data?.Media?.coverImage?.large ?? '';
      const nextCache = readCoverCache();
      nextCache[key] = url;
      writeCoverCache(nextCache);
      return url || null;
    } catch {
      return null;
    } finally {
      inflightRequests.delete(key);
    }
  })();

  inflightRequests.set(key, reqPromise);
  return reqPromise;
}

export function useMediaCover(
  title: string,
  category: ImmersionCategory | string
) {
  const key = makeCacheKey(title, category);
  const fallbackUrl = generatePosterSvgDataUrl(title, category);
  const [resolved, setResolved] = useState<{ key: string; url: string } | null>(
    () => {
      const cached = readCoverCache()[key];
      return cached ? { key, url: cached } : null;
    }
  );

  useEffect(() => {
    let active = true;
    const cached = readCoverCache()[key];
    if (cached) {
      return;
    }
    if (!getAniListMediaType(category) || title.trim().length < 3) {
      return;
    }

    void resolveAniListCover(title, category).then((url) => {
      if (active && url) {
        setResolved({ key, url });
      }
    });

    return () => {
      active = false;
    };
  }, [key, title, category]);

  const cachedNow = readCoverCache()[key];
  const remoteUrl =
    cachedNow || (resolved && resolved.key === key ? resolved.url : null);

  return {
    coverUrl: remoteUrl || fallbackUrl,
    fallbackUrl,
    hasRemoteCover: Boolean(remoteUrl),
  };
}
