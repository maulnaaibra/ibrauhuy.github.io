import type { PrimaryMediaCategory } from '../types';

export type CatalogLevelFilter =
  | 'all'
  | 'Pemula N5–N4'
  | 'Menengah N3'
  | 'Mahir N2–N1';

export interface CuratedMediaItem {
  title: string;
  category: PrimaryMediaCategory;
  level: Exclude<CatalogLevelFilter, 'all'>;
  summary: string;
  suggestedMinutes: number;
}

export interface JlptMilestoneTarget {
  code: 'N4' | 'N3' | 'N2' | 'N1';
  label: string;
  subtitle: string;
  hours: number;
}

export interface CommunityLearner {
  id: string;
  name: string;
  targetLanguage: string;
  rankTitle: string;
  streak: number;
  totalHours: number;
  favoriteMedia: string;
}

export interface CommunityFeedItem {
  id: string;
  userName: string;
  action: string;
  title: string;
  category: PrimaryMediaCategory;
  minutes: number;
  timeAgo: string;
}

export const JLPT_MILESTONES: JlptMilestoneTarget[] = [
  { code: 'N4', label: 'JLPT N4 · 400 Jam', subtitle: 'Dasar Sehari-hari', hours: 400 },
  { code: 'N3', label: 'JLPT N3 · 950 Jam', subtitle: 'Percakapan & Manga Ringan', hours: 950 },
  { code: 'N2', label: 'JLPT N2 · 1.600 Jam', subtitle: 'Lancar Anime & Novel', hours: 1600 },
  { code: 'N1', label: 'JLPT N1 · 2.600 Jam', subtitle: 'Pemahaman Native', hours: 2600 },
];

export const CURATED_MEDIA_CATALOG: CuratedMediaItem[] = [
  {
    title: 'Shirokuma Cafe',
    category: 'anime',
    level: 'Pemula N5–N4',
    summary: 'Dialog sehari-hari yang jelas dengan tempo santai dan kosakata umum.',
    suggestedMinutes: 24,
  },
  {
    title: 'Yotsuba&! Vol. 4',
    category: 'manga',
    level: 'Pemula N5–N4',
    summary: 'Manga slice-of-life dengan furigana penuh, ideal untuk transisi membaca.',
    suggestedMinutes: 30,
  },
  {
    title: 'NHK News Web Easy',
    category: 'book',
    level: 'Pemula N5–N4',
    summary: 'Berita Jepang ringkas harian lengkap dengan furigana dan audio narasi.',
    suggestedMinutes: 20,
  },
  {
    title: 'Sousou no Frieren',
    category: 'anime',
    level: 'Menengah N3',
    summary: 'Pelafalan jernih dengan campuran percakapan santai dan kosakata fantasi.',
    suggestedMinutes: 24,
  },
  {
    title: 'Bocchi the Rock!',
    category: 'anime',
    level: 'Menengah N3',
    summary: 'Dialog natural remaja modern untuk melatih pemahaman kecepatan normal.',
    suggestedMinutes: 24,
  },
  {
    title: 'Spy x Family',
    category: 'manga',
    level: 'Menengah N3',
    summary: 'Komedi keluarga & aksi dengan kombinasi kalimat formal dan kasual.',
    suggestedMinutes: 30,
  },
  {
    title: 'Steins;Gate',
    category: 'visual_novel',
    level: 'Mahir N2–N1',
    summary: 'Visual novel penuh suara dengan dialog padat untuk mendongkrak reading speed.',
    suggestedMinutes: 45,
  },
  {
    title: 'Re:Zero kara Hajimeru Isekai Seikatsu',
    category: 'light_novel',
    level: 'Mahir N2–N1',
    summary: 'Light novel deskriptif untuk memperluas perbendaharaan kata sastra dan kanji.',
    suggestedMinutes: 40,
  },
];

export const COMMUNITY_LEADERBOARD: CommunityLearner[] = [
  {
    id: 'comm-1',
    name: 'Raka Pratama',
    targetLanguage: 'Japanese',
    rankTitle: 'Tahap N2 · Mahir',
    streak: 94,
    totalHours: 1420.5,
    favoriteMedia: 'Light Novel & Visual Novel',
  },
  {
    id: 'comm-2',
    name: 'Siti Aulia',
    targetLanguage: 'Japanese',
    rankTitle: 'Tahap N2 · Mahir',
    streak: 61,
    totalHours: 985.2,
    favoriteMedia: 'Anime & Podcast',
  },
  {
    id: 'comm-3',
    name: 'Dimas Wijaya',
    targetLanguage: 'Japanese',
    rankTitle: 'Tahap N3 · Menengah',
    streak: 38,
    totalHours: 612.8,
    favoriteMedia: 'Manga & Anki Mining',
  },
  {
    id: 'comm-4',
    name: 'Nadia Kusuma',
    targetLanguage: 'Japanese',
    rankTitle: 'Tahap N4 · Percakapan',
    streak: 25,
    totalHours: 348.4,
    favoriteMedia: 'Anime & NHK Easy',
  },
  {
    id: 'comm-5',
    name: 'Fajar Nugroho',
    targetLanguage: 'Japanese',
    rankTitle: 'Tahap N5 · Dasar',
    streak: 14,
    totalHours: 146.0,
    favoriteMedia: 'Anime Slice of Life',
  },
];

export const COMMUNITY_ACTIVITY_FEED: CommunityFeedItem[] = [
  {
    id: 'feed-1',
    userName: 'Raka Pratama',
    action: 'menamatkan bab baru',
    title: 'Steins;Gate',
    category: 'visual_novel',
    minutes: 55,
    timeAgo: '8 mnt lalu',
  },
  {
    id: 'feed-2',
    userName: 'Siti Aulia',
    action: 'menonton tanpa subtitle',
    title: 'Sousou no Frieren',
    category: 'anime',
    minutes: 48,
    timeAgo: '23 mnt lalu',
  },
  {
    id: 'feed-3',
    userName: 'Dimas Wijaya',
    action: 'membaca & mining +18 kartu',
    title: 'Yotsuba&! Vol. 4',
    category: 'manga',
    minutes: 35,
    timeAgo: '1 jam lalu',
  },
  {
    id: 'feed-4',
    userName: 'Nadia Kusuma',
    action: 'menyelesaikan target harian',
    title: 'Bocchi the Rock!',
    category: 'anime',
    minutes: 72,
    timeAgo: '2 jam lalu',
  },
];
