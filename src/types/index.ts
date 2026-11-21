export type SkillTrack = 'listening' | 'reading' | 'study';

export type PrimaryMediaCategory =
  | 'anime'
  | 'video'
  | 'movie'
  | 'audio'
  | 'manga'
  | 'visual_novel'
  | 'light_novel'
  | 'book'
  | 'study';

export type ImmersionCategory =
  | PrimaryMediaCategory
  | 'watching'
  | 'listening'
  | 'reading';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  target_language: string;
  daily_goal_minutes: number;
  created_at: string;
}

export interface ImmersionLog {
  id: string;
  user_id: string;
  title: string;
  category: ImmersionCategory;
  duration_minutes: number;
  cards_mined: number;
  notes: string | null;
  logged_date: string;
  created_at: string;
}

export interface CustomGoal {
  id: string;
  title: string;
  targetHours: number;
  track: 'all' | SkillTrack;
  startDate: string;
  deadline: string;
}

export type AchievementRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  rarity: AchievementRarity;
  points: number;
  unlocked: boolean;
  progressPct: number;
  currentLabel: string;
  targetLabel: string;
  icon:
    | 'clock'
    | 'flame'
    | 'book'
    | 'headphones'
    | 'sparkles'
    | 'trophy'
    | 'zap'
    | 'layers';
}

export interface CategoryMeta {
  label: string;
  shortLabel: string;
  track: SkillTrack;
  color: string;
  badgeClass: string;
  gradientClass: string;
  xpPerHour: number;
}

export const PRIMARY_CATEGORIES: PrimaryMediaCategory[] = [
  'anime',
  'video',
  'movie',
  'audio',
  'manga',
  'visual_novel',
  'light_novel',
  'book',
  'study',
];

const UNIFIED_BADGE = 'bg-slate-50 text-slate-600 border-slate-200';
const UNIFIED_GRADIENT = 'from-rose-100/50 to-transparent';

export const CATEGORY_META: Record<ImmersionCategory, CategoryMeta> = {
  anime: {
    label: 'Anime',
    shortLabel: 'Anime',
    track: 'listening',
    color: '#e11d48',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 135,
  },
  video: {
    label: 'Video / YouTube',
    shortLabel: 'Video',
    track: 'listening',
    color: '#0284c7',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 130,
  },
  movie: {
    label: 'Film / Drama',
    shortLabel: 'Film',
    track: 'listening',
    color: '#ea580c',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 135,
  },
  audio: {
    label: 'Podcast / Audio',
    shortLabel: 'Audio',
    track: 'listening',
    color: '#e11d48',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 140,
  },
  manga: {
    label: 'Manga',
    shortLabel: 'Manga',
    track: 'reading',
    color: '#be123c',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 150,
  },
  visual_novel: {
    label: 'Visual Novel',
    shortLabel: 'VN',
    track: 'reading',
    color: '#2563eb',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 165,
  },
  light_novel: {
    label: 'Light Novel',
    shortLabel: 'LN',
    track: 'reading',
    color: '#7c3aed',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 170,
  },
  book: {
    label: 'Buku / Artikel',
    shortLabel: 'Buku',
    track: 'reading',
    color: '#d97706',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 170,
  },
  study: {
    label: 'Anki / Study',
    shortLabel: 'Study',
    track: 'study',
    color: '#0d9488',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 110,
  },
  watching: {
    label: 'Watching',
    shortLabel: 'Watch',
    track: 'listening',
    color: '#dc2626',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 135,
  },
  listening: {
    label: 'Listening',
    shortLabel: 'Listen',
    track: 'listening',
    color: '#059669',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 140,
  },
  reading: {
    label: 'Reading',
    shortLabel: 'Read',
    track: 'reading',
    color: '#d97706',
    badgeClass: UNIFIED_BADGE,
    gradientClass: UNIFIED_GRADIENT,
    xpPerHour: 160,
  },
};

export function getCategoryMeta(category: string): CategoryMeta {
  if (category in CATEGORY_META) {
    return CATEGORY_META[category as ImmersionCategory];
  }
  return CATEGORY_META.anime;
}
