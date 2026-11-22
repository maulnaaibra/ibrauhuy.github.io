import { compressImageToDataUrl } from './appearance';
import { COMMUNITY_LEADERBOARD } from './publicShowcase';
import { supabase } from './supabase';
import type {
  ImmersionCategory,
  ImmersionLog,
  PrimaryMediaCategory,
  Profile,
} from '../types';
import {
  calculateLongestStreak,
  calculateStreak,
  computeAchievements,
  getImmersionStage,
  getLocalDateString,
  getReadingListeningBalance,
  getRecentMediaCards,
} from '../utils/stats';

export type ProfileBannerThemeId =
  | 'sakura-crimson'
  | 'tokyo-neon'
  | 'kyoto-matcha'
  | 'fuji-dawn'
  | 'kanagawa-wave'
  | 'obsidian-gold';

export interface ProfileBannerTheme {
  id: ProfileBannerThemeId;
  name: string;
  gradientClass: string;
  accentText: string;
  backgroundStyle: string;
}

export const PROFILE_BANNER_THEMES: ProfileBannerTheme[] = [
  {
    id: 'sakura-crimson',
    name: 'Sakura Crimson',
    gradientClass: 'from-rose-600 via-rose-500 to-amber-500',
    accentText: 'text-rose-100',
    backgroundStyle:
      'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.24) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(254,205,211,0.28) 0%, transparent 50%), linear-gradient(135deg, #e11d48 0%, #f43f5e 52%, #f59e0b 100%)',
  },
  {
    id: 'tokyo-neon',
    name: 'Tokyo Indigo',
    gradientClass: 'from-indigo-700 via-violet-600 to-rose-500',
    accentText: 'text-indigo-100',
    backgroundStyle:
      'radial-gradient(circle at 85% 20%, rgba(244,63,94,0.35) 0%, transparent 48%), radial-gradient(circle at 15% 80%, rgba(129,140,248,0.32) 0%, transparent 50%), linear-gradient(135deg, #4338ca 0%, #7c3aed 52%, #f43f5e 100%)',
  },
  {
    id: 'kyoto-matcha',
    name: 'Kyoto Matcha',
    gradientClass: 'from-emerald-700 via-teal-600 to-cyan-600',
    accentText: 'text-emerald-100',
    backgroundStyle:
      'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.22) 0%, transparent 45%), radial-gradient(circle at 75% 75%, rgba(167,243,208,0.25) 0%, transparent 50%), linear-gradient(135deg, #047857 0%, #0d9488 54%, #0891b2 100%)',
  },
  {
    id: 'fuji-dawn',
    name: 'Fuji Sunrise',
    gradientClass: 'from-rose-700 via-orange-500 to-amber-400',
    accentText: 'text-amber-100',
    backgroundStyle:
      'radial-gradient(circle at 50% 15%, rgba(255,255,255,0.28) 0%, transparent 50%), linear-gradient(135deg, #be123c 0%, #f97316 55%, #fbbf24 100%)',
  },
  {
    id: 'kanagawa-wave',
    name: 'Kanagawa Ocean',
    gradientClass: 'from-sky-700 via-blue-600 to-indigo-700',
    accentText: 'text-sky-100',
    backgroundStyle:
      'radial-gradient(circle at 80% 25%, rgba(186,230,253,0.28) 0%, transparent 48%), linear-gradient(135deg, #0369a1 0%, #2563eb 54%, #4338ca 100%)',
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian Kuro',
    gradientClass: 'from-slate-900 via-slate-800 to-rose-900',
    accentText: 'text-rose-200',
    backgroundStyle:
      'radial-gradient(circle at 80% 20%, rgba(225,29,72,0.38) 0%, transparent 48%), linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #881337 100%)',
  },
];

function makeSceneryBannerDataUrl(
  c1: string,
  c2: string,
  c3: string,
  sunColor: string,
  kanji: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="55%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c3}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="360" fill="url(#sky)"/>
    <circle cx="920" cy="145" r="95" fill="${sunColor}" opacity="0.85"/>
    <path d="M0 290 L220 190 L430 275 L680 150 L920 265 L1200 185 L1200 360 L0 360 Z" fill="rgba(15,23,42,0.42)"/>
    <path d="M180 360 L540 135 L600 135 L960 360 Z" fill="rgba(15,23,42,0.62)"/>
    <path d="M495 163 L540 135 L600 135 L645 163 L615 172 L570 155 L525 172 Z" fill="rgba(255,255,255,0.85)"/>
    <text x="1140" y="315" text-anchor="end" fill="rgba(255,255,255,0.14)" font-family="sans-serif" font-weight="900" font-size="140">${kanji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface BannerImagePreset {
  id: string;
  label: string;
  url: string;
}

export const BANNER_IMAGE_PRESETS: BannerImagePreset[] = [
  {
    id: 'fuji-crimson',
    label: 'Mt. Fuji Dusk',
    url: makeSceneryBannerDataUrl('#1e1b4b', '#be123c', '#f97316', '#fde047', '富士'),
  },
  {
    id: 'tokyo-cyber',
    label: 'Tokyo Night',
    url: makeSceneryBannerDataUrl('#090d16', '#312e81', '#e11d48', '#38bdf8', '東京'),
  },
  {
    id: 'kyoto-forest',
    label: 'Kyoto Arashiyama',
    url: makeSceneryBannerDataUrl('#022c22', '#0f766e', '#10b981', '#fef08a', '京都'),
  },
  {
    id: 'sakura-dream',
    label: 'Sakura Horizon',
    url: makeSceneryBannerDataUrl('#881337', '#e11d48', '#fda4af', '#fff1f2', '桜花'),
  },
];

function makeSvgAvatarDataUrl(
  bg1: string,
  bg2: string,
  kanji: string,
  sub: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="60" fill="url(#g)"/>
    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
    <text x="60" y="68" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="800" font-size="44">${kanji}</text>
    <text x="60" y="96" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-family="sans-serif" font-weight="700" font-size="11" letter-spacing="1">${sub}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface AvatarPreset {
  id: string;
  label: string;
  url: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'sakura',
    label: '桜 Sakura',
    url: makeSvgAvatarDataUrl('#e11d48', '#fb7185', '桜', 'SAKURA'),
  },
  {
    id: 'shinobi',
    label: '忍 Shinobi',
    url: makeSvgAvatarDataUrl('#1e293b', '#475569', '忍', 'SHINOBI'),
  },
  {
    id: 'kitsune',
    label: '狐 Kitsune',
    url: makeSvgAvatarDataUrl('#ea580c', '#f59e0b', '狐', 'KITSUNE'),
  },
  {
    id: 'ryu',
    label: '龍 Ryuu',
    url: makeSvgAvatarDataUrl('#0284c7', '#38bdf8', '龍', 'RYUU'),
  },
  {
    id: 'matcha',
    label: '茶 Matcha',
    url: makeSvgAvatarDataUrl('#059669', '#34d399', '茶', 'MATCHA'),
  },
  {
    id: 'tsuki',
    label: '月 Tsuki',
    url: makeSvgAvatarDataUrl('#4f46e5', '#818cf8', '月', 'TSUKI'),
  },
  {
    id: 'hon',
    label: '本 Dokusho',
    url: makeSvgAvatarDataUrl('#be123c', '#e11d48', '本', 'READER'),
  },
  {
    id: 'hikari',
    label: '光 Hikari',
    url: makeSvgAvatarDataUrl('#9333ea', '#ec4899', '光', 'HIKARI'),
  },
];

export interface ExtendedUserProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
  banner_url?: string | null;
  banner_theme: ProfileBannerThemeId;
  bio: string;
  jlpt_target: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  favorite_media: string;
  favorite_category: PrimaryMediaCategory;
  location: string;
  discord_handle: string;
  target_language: string;
  daily_goal_minutes: number;
  is_public: boolean;
  created_at: string;
}

export interface PublicProfileSnapshot {
  v: 1;
  profile: ExtendedUserProfile;
  stats: {
    totalHours: number;
    streak: number;
    longestStreak: number;
    totalCards: number;
    totalSessions: number;
    todayMinutes: number;
    stageCode: string;
    stageLabel: string;
    stageProgressPct: number;
    nextTargetHours: number;
    listeningHours: number;
    readingHours: number;
    studyHours: number;
    ratioLabel: string;
  };
  topMedia: Array<{
    title: string;
    category: ImmersionCategory;
    totalMinutes: number;
    sessions: number;
    totalCards: number;
  }>;
  recentLogs: Array<{
    id: string;
    title: string;
    category: ImmersionCategory;
    duration_minutes: number;
    cards_mined: number;
    logged_date: string;
    notes: string | null;
  }>;
  unlockedBadges: Array<{
    id: string;
    title: string;
    description: string;
    rarity: string;
  }>;
}

const LOCAL_PROFILE_META_PREFIX = 'immersiontrack_profile_meta_v1_';

export function sanitizeUsername(raw: string, fallbackName?: string): string {
  const base = (raw || fallbackName || 'learner')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 24);
  return base || 'learner';
}

export function loadExtendedProfileMeta(
  userId: string,
  baseProfile: Profile | null,
  userEmail?: string | null,
  authMeta?: Record<string, unknown> | null
): ExtendedUserProfile {
  let cached: Partial<ExtendedUserProfile> = {};
  try {
    const raw = localStorage.getItem(`${LOCAL_PROFILE_META_PREFIX}${userId}`);
    if (raw) {
      cached = JSON.parse(raw) as Partial<ExtendedUserProfile>;
    }
  } catch {
    // ignore storage error
  }

  const meta = (authMeta ?? {}) as Partial<ExtendedUserProfile>;
  const fullName =
    baseProfile?.full_name ||
    cached.full_name ||
    (typeof meta.full_name === 'string' ? meta.full_name : '') ||
    userEmail?.split('@')[0] ||
    'Pelajar Immersion';

  const username = sanitizeUsername(
    cached.username ||
      (typeof meta.username === 'string' ? meta.username : '') ||
      userEmail?.split('@')[0] ||
      fullName
  );

  return {
    id: userId,
    full_name: fullName,
    username,
    avatar_url:
      cached.avatar_url ??
      baseProfile?.avatar_url ??
      (typeof meta.avatar_url === 'string' ? meta.avatar_url : null) ??
      null,
    banner_url:
      cached.banner_url ??
      (typeof meta.banner_url === 'string' ? meta.banner_url : null) ??
      null,
    banner_theme:
      cached.banner_theme ||
      (meta.banner_theme as ProfileBannerThemeId | undefined) ||
      'sakura-crimson',
    bio:
      cached.bio ??
      (typeof meta.bio === 'string' ? meta.bio : '') ??
      'Belajar bahasa Jepang setiap hari melalui immersion anime, novel, dan Anki.',
    jlpt_target:
      cached.jlpt_target ||
      (meta.jlpt_target as ExtendedUserProfile['jlpt_target'] | undefined) ||
      'N2',
    favorite_media:
      cached.favorite_media ??
      (typeof meta.favorite_media === 'string' ? meta.favorite_media : '') ??
      "葬送のフリーレン (Frieren: Beyond Journey's End)",
    favorite_category:
      cached.favorite_category ||
      (meta.favorite_category as PrimaryMediaCategory | undefined) ||
      'anime',
    location:
      cached.location ??
      (typeof meta.location === 'string' ? meta.location : '') ??
      'Indonesia',
    discord_handle:
      cached.discord_handle ??
      (typeof meta.discord_handle === 'string' ? meta.discord_handle : '') ??
      '',
    target_language:
      baseProfile?.target_language ||
      cached.target_language ||
      'Japanese',
    daily_goal_minutes:
      baseProfile?.daily_goal_minutes ||
      cached.daily_goal_minutes ||
      90,
    is_public:
      cached.is_public ??
      (typeof meta.is_public === 'boolean' ? meta.is_public : true),
    created_at: baseProfile?.created_at || new Date().toISOString(),
  };
}

export async function saveExtendedProfileMeta(
  userId: string,
  next: ExtendedUserProfile
): Promise<{ ok: boolean; error?: string }> {
  const cleaned: ExtendedUserProfile = {
    ...next,
    id: userId,
    full_name: next.full_name.trim() || 'Pelajar Immersion',
    username: sanitizeUsername(next.username, next.full_name),
    bio: next.bio.trim(),
    favorite_media: next.favorite_media.trim(),
    location: next.location.trim(),
    discord_handle: next.discord_handle.trim(),
    target_language: next.target_language.trim() || 'Japanese',
    daily_goal_minutes: Math.max(
      5,
      Math.min(1440, Number(next.daily_goal_minutes) || 90)
    ),
  };

  try {
    localStorage.setItem(
      `${LOCAL_PROFILE_META_PREFIX}${userId}`,
      JSON.stringify(cleaned)
    );
  } catch {
    // ignore storage errors
  }

  // 1. Update core columns in public.profiles
  const { error: profileErr } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: cleaned.full_name,
    avatar_url: cleaned.avatar_url,
    target_language: cleaned.target_language,
    daily_goal_minutes: cleaned.daily_goal_minutes,
  });

  // 2. Also attempt updating optional extended columns in public.profiles if they exist
  void supabase
    .from('profiles')
    .update({
      username: cleaned.username,
      bio: cleaned.bio,
      jlpt_target: cleaned.jlpt_target,
      favorite_media: cleaned.favorite_media,
      banner_theme: cleaned.banner_theme,
      is_public: cleaned.is_public,
    })
    .eq('id', userId);

  // 3. Persist lightweight extended profile fields in Supabase Auth user_metadata
  // Avoid stuffing large base64 data URLs (>2000 chars) into JWT user_metadata
  const safeJwtAvatar =
    cleaned.avatar_url && cleaned.avatar_url.length <= 2000
      ? cleaned.avatar_url
      : undefined;
  const safeJwtBanner =
    cleaned.banner_url && cleaned.banner_url.length <= 2000
      ? cleaned.banner_url
      : undefined;

  try {
    await supabase.auth.updateUser({
      data: {
        full_name: cleaned.full_name,
        ...(safeJwtAvatar !== undefined ? { avatar_url: safeJwtAvatar } : {}),
        ...(safeJwtBanner !== undefined ? { banner_url: safeJwtBanner } : {}),
        username: cleaned.username,
        banner_theme: cleaned.banner_theme,
        bio: cleaned.bio,
        jlpt_target: cleaned.jlpt_target,
        favorite_media: cleaned.favorite_media,
        favorite_category: cleaned.favorite_category,
        location: cleaned.location,
        discord_handle: cleaned.discord_handle,
        target_language: cleaned.target_language,
        daily_goal_minutes: cleaned.daily_goal_minutes,
        is_public: cleaned.is_public,
      },
    });
  } catch {
    // ignore JWT metadata size warnings
  }

  if (profileErr) {
    return { ok: false, error: profileErr.message };
  }
  return { ok: true };
}

export async function compressAvatarFile(file: File): Promise<string> {
  return compressImageToDataUrl(file, 360);
}

export async function compressBannerFile(file: File): Promise<string> {
  return compressImageToDataUrl(file, 1360);
}

export function buildPublicProfileSnapshot(
  extProfile: ExtendedUserProfile,
  logs: ImmersionLog[]
): PublicProfileSnapshot {
  const totalMinutes = logs.reduce((acc, l) => acc + l.duration_minutes, 0);
  const totalHours = Number((totalMinutes / 60).toFixed(1));
  const totalCards = logs.reduce((acc, l) => acc + (l.cards_mined || 0), 0);
  const streak = calculateStreak(logs);
  const longestStreak = calculateLongestStreak(logs);
  const stage = getImmersionStage(totalHours);
  const balance = getReadingListeningBalance(logs);
  const todayStr = getLocalDateString();
  const todayMinutes = logs
    .filter((l) => l.logged_date === todayStr)
    .reduce((acc, l) => acc + l.duration_minutes, 0);

  const recentMedia = getRecentMediaCards(logs, 6);
  const achievements = computeAchievements(logs)
    .filter((a) => a.unlocked)
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      rarity: a.rarity,
    }));

  const shareableAvatar =
    extProfile.avatar_url &&
    extProfile.avatar_url.startsWith('data:image/') &&
    !extProfile.avatar_url.startsWith('data:image/svg+xml') &&
    extProfile.avatar_url.length > 1800
      ? null
      : extProfile.avatar_url;

  const shareableBanner =
    extProfile.banner_url &&
    extProfile.banner_url.startsWith('data:image/') &&
    !extProfile.banner_url.startsWith('data:image/svg+xml') &&
    extProfile.banner_url.length > 1800
      ? null
      : extProfile.banner_url;

  return {
    v: 1,
    profile: {
      ...extProfile,
      avatar_url: shareableAvatar,
      banner_url: shareableBanner,
    },
    stats: {
      totalHours,
      streak,
      longestStreak,
      totalCards,
      totalSessions: logs.length,
      todayMinutes,
      stageCode: stage.code,
      stageLabel: stage.label,
      stageProgressPct: stage.progressPct,
      nextTargetHours: stage.nextTargetHours,
      listeningHours: Number((balance.listeningMin / 60).toFixed(1)),
      readingHours: Number((balance.readingMin / 60).toFixed(1)),
      studyHours: Number((balance.studyMin / 60).toFixed(1)),
      ratioLabel: balance.ratioLabel,
    },
    topMedia: recentMedia,
    recentLogs: logs.slice(0, 8).map((l) => ({
      id: l.id,
      title: l.title,
      category: l.category,
      duration_minutes: l.duration_minutes,
      cards_mined: l.cards_mined,
      logged_date: l.logged_date,
      notes: l.notes,
    })),
    unlockedBadges: achievements,
  };
}

export function encodeProfileSnapshotToToken(
  snapshot: PublicProfileSnapshot
): string {
  try {
    const jsonStr = JSON.stringify(snapshot);
    const utf8Bytes = encodeURIComponent(jsonStr).replace(
      /%([0-9A-F]{2})/g,
      (_, p1: string) => String.fromCharCode(parseInt(p1, 16))
    );
    return btoa(utf8Bytes)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeProfileSnapshotFromToken(
  token: string
): PublicProfileSnapshot | null {
  if (!token) return null;
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '='
    );
    const bin = atob(padded);
    const jsonStr = decodeURIComponent(
      bin
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    const parsed = JSON.parse(jsonStr) as PublicProfileSnapshot;
    if (parsed && parsed.v === 1 && parsed.profile && parsed.stats) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function getPublicProfileShareUrl(
  snapshot: PublicProfileSnapshot
): string {
  const token = encodeProfileSnapshotToToken(snapshot);
  const handle = encodeURIComponent(
    snapshot.profile.username || snapshot.profile.id
  );
  const base = `${window.location.origin}${import.meta.env.BASE_URL}u/${handle}`;
  return token ? `${base}?s=${token}` : base;
}

export function buildCommunityMemberSnapshot(
  memberIdOrName: string
): PublicProfileSnapshot | null {
  const clean = memberIdOrName.trim().toLowerCase();
  const member = COMMUNITY_LEADERBOARD.find(
    (m) =>
      m.id.toLowerCase() === clean ||
      m.name.toLowerCase() === clean ||
      sanitizeUsername(m.name) === clean
  );
  if (!member) return null;

  const presetIndex =
    Math.abs(
      member.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    ) % AVATAR_PRESETS.length;
  const themeIndex = presetIndex % PROFILE_BANNER_THEMES.length;

  const sampleMediaByMember: Record<
    string,
    Array<{
      title: string;
      category: PrimaryMediaCategory;
      totalMinutes: number;
      sessions: number;
      totalCards: number;
    }>
  > = {
    'comm-1': [
      {
        title: 'Re:ゼロから始める異世界生活',
        category: 'light_novel',
        totalMinutes: 28400,
        sessions: 410,
        totalCards: 1850,
      },
      {
        title: 'ツユチル・レター～海と栞に雨音を～',
        category: 'visual_novel',
        totalMinutes: 19200,
        sessions: 245,
        totalCards: 1120,
      },
      {
        title: "葬送のフリーレン (Frieren: Beyond Journey's End)",
        category: 'anime',
        totalMinutes: 14600,
        sessions: 310,
        totalCards: 640,
      },
    ],
    'comm-2': [
      {
        title: "葬送のフリーレン (Frieren: Beyond Journey's End)",
        category: 'anime',
        totalMinutes: 22400,
        sessions: 460,
        totalCards: 980,
      },
      {
        title: 'Japanese podcast for beginners (Nihongo con Teppei)',
        category: 'audio',
        totalMinutes: 16800,
        sessions: 520,
        totalCards: 310,
      },
      {
        title: 'くま クマ 熊 ベアー',
        category: 'light_novel',
        totalMinutes: 11200,
        sessions: 190,
        totalCards: 740,
      },
    ],
    'comm-3': [
      {
        title: 'ゆるゆり',
        category: 'manga',
        totalMinutes: 14500,
        sessions: 310,
        totalCards: 1420,
      },
      {
        title: 'あずまんが大王',
        category: 'manga',
        totalMinutes: 11800,
        sessions: 240,
        totalCards: 920,
      },
      {
        title: 'Anki — Core 2k/6k Mining',
        category: 'study',
        totalMinutes: 9400,
        sessions: 365,
        totalCards: 2150,
      },
    ],
    'comm-4': [
      {
        title: 'しろくまカフェ',
        category: 'anime',
        totalMinutes: 9800,
        sessions: 230,
        totalCards: 540,
      },
      {
        title: 'ご注文はうさぎですか？',
        category: 'anime',
        totalMinutes: 6400,
        sessions: 150,
        totalCards: 380,
      },
    ],
    'comm-5': [
      {
        title: 'わかば＊ガール',
        category: 'anime',
        totalMinutes: 4600,
        sessions: 115,
        totalCards: 240,
      },
      {
        title: 'けいおん!「ライブハウス！」 (K-ON!: Live House!)',
        category: 'anime',
        totalMinutes: 4160,
        sessions: 98,
        totalCards: 190,
      },
    ],
  };

  const topMedia =
    sampleMediaByMember[member.id] ?? sampleMediaByMember['comm-1'];
  const stage = getImmersionStage(member.totalHours);
  const listeningHours = Number((member.totalHours * 0.54).toFixed(1));
  const readingHours = Number((member.totalHours * 0.38).toFixed(1));
  const studyHours = Number((member.totalHours * 0.08).toFixed(1));
  const totalCards = topMedia.reduce((a, b) => a + b.totalCards, 0);
  const totalSessions = topMedia.reduce((a, b) => a + b.sessions, 0);

  return {
    v: 1,
    profile: {
      id: member.id,
      full_name: member.name,
      username: sanitizeUsername(member.name),
      avatar_url: AVATAR_PRESETS[presetIndex].url,
      banner_url:
        BANNER_IMAGE_PRESETS[presetIndex % BANNER_IMAGE_PRESETS.length].url,
      banner_theme: PROFILE_BANNER_THEMES[themeIndex].id,
      bio: `Pelajar aktif ${member.targetLanguage} (${member.rankTitle}) • Fokus pada ${member.favoriteMedia}.`,
      jlpt_target: member.totalHours > 1000 ? 'N1' : 'N2',
      favorite_media: topMedia[0].title,
      favorite_category: topMedia[0].category,
      location: 'Indonesia',
      discord_handle: `@${sanitizeUsername(member.name)}_jp`,
      target_language: member.targetLanguage,
      daily_goal_minutes: 120,
      is_public: true,
      created_at: '2026-01-15T08:00:00.000Z',
    },
    stats: {
      totalHours: member.totalHours,
      streak: member.streak,
      longestStreak: member.streak + 12,
      totalCards,
      totalSessions,
      todayMinutes: 95,
      stageCode: stage.code,
      stageLabel: stage.label,
      stageProgressPct: stage.progressPct,
      nextTargetHours: stage.nextTargetHours,
      listeningHours,
      readingHours,
      studyHours,
      ratioLabel: '42% : 58%',
    },
    topMedia,
    recentLogs: topMedia.map((m, idx) => ({
      id: `${member.id}-log-${idx}`,
      title: m.title,
      category: m.category,
      duration_minutes: 45,
      cards_mined: 12,
      logged_date: getLocalDateString(),
      notes: 'Immersion tanpa subtitle bahasa Indonesia + mining kalimat baru.',
    })),
    unlockedBadges: [
      {
        id: 'first-session',
        title: 'Langkah Pertama',
        description: 'Mencatat sesi immersion pertama.',
        rarity: 'common',
      },
      {
        id: 'streak-7',
        title: 'Konsistensi 7 Hari',
        description: 'Menjaga streak belajar selama 7 hari berturut-turut.',
        rarity: 'uncommon',
      },
      {
        id: 'hours-100',
        title: '100 Jam Immersion',
        description: 'Menembus 100 jam total input bahasa target.',
        rarity: 'rare',
      },
    ],
  };
}
