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

export const CATEGORY_META: Record<ImmersionCategory, CategoryMeta> = {
  anime: {
    label: 'Anime',
    shortLabel: 'Anime',
    track: 'listening',
    color: '#06b6d4',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    gradientClass: 'from-cyan-500/20 via-sky-500/10 to-transparent',
    xpPerHour: 135,
  },
  video: {
    label: 'Video / YouTube',
    shortLabel: 'Video',
    track: 'listening',
    color: '#14b8a6',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    gradientClass: 'from-teal-500/20 via-emerald-500/10 to-transparent',
    xpPerHour: 130,
  },
  movie: {
    label: 'Film / Drama',
    shortLabel: 'Film',
    track: 'listening',
    color: '#f97316',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    gradientClass: 'from-orange-500/20 via-amber-500/10 to-transparent',
    xpPerHour: 135,
  },
  audio: {
    label: 'Podcast / Audio',
    shortLabel: 'Audio',
    track: 'listening',
    color: '#ec4899',
    badgeClass: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    gradientClass: 'from-pink-500/20 via-rose-500/10 to-transparent',
    xpPerHour: 140,
  },
  manga: {
    label: 'Manga',
    shortLabel: 'Manga',
    track: 'reading',
    color: '#f43f5e',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    gradientClass: 'from-rose-500/20 via-pink-500/10 to-transparent',
    xpPerHour: 150,
  },
  visual_novel: {
    label: 'Visual Novel',
    shortLabel: 'VN',
    track: 'reading',
    color: '#3b82f6',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    gradientClass: 'from-blue-500/20 via-indigo-500/10 to-transparent',
    xpPerHour: 165,
  },
  light_novel: {
    label: 'Light Novel',
    shortLabel: 'LN',
    track: 'reading',
    color: '#8b5cf6',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    gradientClass: 'from-violet-500/20 via-purple-500/10 to-transparent',
    xpPerHour: 170,
  },
  book: {
    label: 'Buku / Artikel',
    shortLabel: 'Buku',
    track: 'reading',
    color: '#f59e0b',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    gradientClass: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    xpPerHour: 170,
  },
  study: {
    label: 'Anki / Study',
    shortLabel: 'Study',
    track: 'study',
    color: '#d946ef',
    badgeClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    gradientClass: 'from-fuchsia-500/20 via-purple-500/10 to-transparent',
    xpPerHour: 110,
  },
  watching: {
    label: 'Watching',
    shortLabel: 'Watch',
    track: 'listening',
    color: '#6366f1',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    gradientClass: 'from-indigo-500/20 via-blue-500/10 to-transparent',
    xpPerHour: 135,
  },
  listening: {
    label: 'Listening',
    shortLabel: 'Listen',
    track: 'listening',
    color: '#10b981',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    gradientClass: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    xpPerHour: 140,
  },
  reading: {
    label: 'Reading',
    shortLabel: 'Read',
    track: 'reading',
    color: '#f59e0b',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    gradientClass: 'from-amber-500/20 via-orange-500/10 to-transparent',
    xpPerHour: 160,
  },
};

export function getCategoryMeta(category: string): CategoryMeta {
  if (category in CATEGORY_META) {
    return CATEGORY_META[category as ImmersionCategory];
  }
  return CATEGORY_META.anime;
}
