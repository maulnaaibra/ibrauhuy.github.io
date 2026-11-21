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

export function isAnkiMedia(
  title: string,
  category: ImmersionCategory | string
): boolean {
  return category === 'study' || /\banki\b/i.test(title);
}

export function generateAnkiLogoDataUrl(title: string): string {
  const cleanTitle = title.trim() || 'Anki Review';
  const shortTitle =
    cleanTitle.length > 22 ? `${cleanTitle.slice(0, 21)}…` : cleanTitle;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320">
  <defs>
    <linearGradient id="ankiBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="55%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#09111e"/>
    </linearGradient>
    <radialGradient id="ankiHalo" cx="0.5" cy="0.42" r="0.46">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ankiStar" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#7dd3fc"/>
      <stop offset="50%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <rect width="240" height="320" rx="18" fill="url(#ankiBg)"/>
  <rect width="240" height="320" rx="18" fill="url(#ankiHalo)"/>
  <rect x="0" y="0" width="240" height="6" fill="#0ea5e9"/>
  <rect x="18" y="20" width="70" height="24" rx="12" fill="rgba(56,189,248,0.18)" stroke="rgba(125,211,252,0.45)" stroke-width="1"/>
  <text x="53" y="36" text-anchor="middle" font-family="'Plus Jakarta Sans',system-ui,sans-serif" font-size="11" font-weight="800" letter-spacing="0.8" fill="#e0f2fe">ANKI</text>
  <g transform="translate(120 142) rotate(-12)">
    <rect x="-56" y="-56" width="112" height="112" rx="26" fill="rgba(15,23,42,0.75)" stroke="rgba(125,211,252,0.3)" stroke-width="2"/>
    <path d="M0 -42 L12.4 -15.8 L41.2 -12.6 L19.8 7.4 L25.6 36 L0 21.8 L-25.6 36 L-19.8 7.4 L-41.2 -12.6 L-12.4 -15.8 Z"
      fill="url(#ankiStar)" stroke="#e0f2fe" stroke-width="4" stroke-linejoin="round"/>
  </g>
  <line x1="18" y1="246" x2="222" y2="246" stroke="rgba(148,163,184,0.22)" stroke-width="1"/>
  <text x="18" y="272" font-family="'Plus Jakarta Sans','Noto Sans JP',system-ui,sans-serif" font-size="13.5" font-weight="700" fill="#f8fafc">${escapeXml(
    shortTitle
  )}</text>
  <text x="18" y="294" font-family="'Plus Jakarta Sans',system-ui,sans-serif" font-size="10.5" font-weight="600" fill="#7dd3fc">Spaced Repetition</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function generatePosterSvgDataUrl(
  title: string,
  category: ImmersionCategory | string
): string {
  if (isAnkiMedia(title, category)) {
    return generateAnkiLogoDataUrl(title);
  }

  const meta = getCategoryMeta(category);
  const cleanTitle = title.trim() || meta.label;
  const words = cleanTitle.split(/\s+/).filter(Boolean);
  const monogram =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : cleanTitle.slice(0, 2).toUpperCase();

  const shortTitle =
    cleanTitle.length > 24 ? `${cleanTitle.slice(0, 23)}…` : cleanTitle;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#59171b"/>
      <stop offset="55%" stop-color="#3c0e11"/>
      <stop offset="100%" stop-color="#220709"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fed7b8"/>
      <stop offset="100%" stop-color="#f2a988"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.14" r="0.72">
      <stop offset="0%" stop-color="#fed7b8" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#fed7b8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="240" height="320" rx="16" fill="url(#bg)"/>
  <rect width="240" height="320" rx="16" fill="url(#glow)"/>
  <rect x="0" y="0" width="240" height="6" fill="url(#accent)"/>
  <circle cx="195" cy="54" r="76" fill="none" stroke="rgba(254,215,184,0.12)" stroke-width="1"/>
  <rect x="18" y="22" width="90" height="22" rx="11" fill="rgba(254,215,184,0.16)" stroke="rgba(254,215,184,0.35)" stroke-width="1"/>
  <circle cx="30" cy="33" r="3.5" fill="#fed7b8"/>
  <text x="41" y="37" font-family="'Plus Jakarta Sans',system-ui,sans-serif" font-size="10" font-weight="700" fill="#fff3e8">${escapeXml(
    meta.shortLabel.toUpperCase()
  )}</text>
  <text x="120" y="170" text-anchor="middle" font-family="'Plus Jakarta Sans','Noto Sans JP',system-ui,sans-serif" font-size="56" font-weight="800" letter-spacing="-1" fill="rgba(254,215,184,0.22)">${escapeXml(
    monogram
  )}</text>
  <line x1="18" y1="248" x2="222" y2="248" stroke="rgba(254,215,184,0.2)" stroke-width="1"/>
  <text x="18" y="274" font-family="'Plus Jakarta Sans','Noto Sans JP',system-ui,sans-serif" font-size="13.5" font-weight="700" fill="#ffffff">${escapeXml(
    shortTitle
  )}</text>
  <text x="18" y="294" font-family="'Plus Jakarta Sans',system-ui,sans-serif" font-size="10.5" font-weight="600" fill="#fed7b8">${escapeXml(
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
  if (isAnkiMedia(title, category)) return null;
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
  if (search.length < 2) return null;

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
  category: ImmersionCategory | string,
  enabled = true
) {
  const key = makeCacheKey(title, category);
  const isAnki = isAnkiMedia(title, category);
  const fallbackUrl = generatePosterSvgDataUrl(title, category);
  const [resolved, setResolved] = useState<{ key: string; url: string } | null>(
    () => {
      if (isAnki) return null;
      const cached = readCoverCache()[key];
      return cached ? { key, url: cached } : null;
    }
  );

  useEffect(() => {
    if (!enabled || isAnki) return;
    let active = true;
    const cached = readCoverCache()[key];
    if (cached) {
      return;
    }
    if (!getAniListMediaType(category) || title.trim().length < 2) {
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
  }, [key, title, category, enabled, isAnki]);

  const cachedNow = isAnki ? null : readCoverCache()[key];
  const remoteUrl = isAnki
    ? null
    : cachedNow || (resolved && resolved.key === key ? resolved.url : null);

  return {
    coverUrl: remoteUrl || fallbackUrl,
    fallbackUrl,
    hasRemoteCover: Boolean(remoteUrl),
  };
}
