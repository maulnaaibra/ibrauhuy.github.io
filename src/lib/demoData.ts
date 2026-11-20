import type { CustomGoal, ImmersionLog, Profile } from '../types';
import { getLocalDateString } from '../utils/stats';

export const DEMO_MODE_KEY = 'immersiontrack_demo_mode';
const DEMO_LOGS_KEY = 'immersiontrack_demo_logs_v2';
const DEMO_PROFILE_KEY = 'immersiontrack_demo_profile_v2';
const GOALS_STORAGE_PREFIX = 'immersiontrack_goals_v1_';

export const DEMO_USER_ID = 'local-workspace-user';

function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getLocalDateString(d);
}

function dateFuture(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return getLocalDateString(d);
}

export function createDefaultDemoProfile(): Profile {
  return {
    id: DEMO_USER_ID,
    full_name: 'Maulana',
    avatar_url: null,
    target_language: 'Japanese',
    daily_goal_minutes: 90,
    created_at: new Date().toISOString(),
  };
}

export function createDemoLogs(): ImmersionLog[] {
  const entries: Array<
    Omit<ImmersionLog, 'id' | 'user_id' | 'created_at' | 'logged_date'> & {
      daysAgo: number;
    }
  > = [
    { daysAgo: 0, title: 'Sousou no Frieren', category: 'anime', duration_minutes: 48, cards_mined: 7, notes: 'Episode 18-19 tanpa subtitle, dialog mulai terasa natural.' },
    { daysAgo: 0, title: 'Steins;Gate', category: 'visual_novel', duration_minutes: 35, cards_mined: 9, notes: 'Chapter 4, banyak istilah sci-fi tapi konteksnya kebaca.' },
    { daysAgo: 1, title: 'Yotsuba&! Vol. 4', category: 'manga', duration_minutes: 45, cards_mined: 6, notes: 'Selesai 2 chapter, baca lancar hampir tanpa kamus.' },
    { daysAgo: 1, title: 'Nihongo con Teppei Z', category: 'audio', duration_minutes: 40, cards_mined: 2, notes: 'Dengar sambil jalan pagi, fokus intonasi.' },
    { daysAgo: 2, title: 'Re:Zero kara Hajimeru Isekai Seikatsu Vol. 1', category: 'light_novel', duration_minutes: 65, cards_mined: 14, notes: 'Tembus 18 halaman hari ini.' },
    { daysAgo: 2, title: 'Anki Core 2k/6k Sentence Mining', category: 'study', duration_minutes: 25, cards_mined: 18, notes: 'Review harian + tambah kartu dari VN.' },
    { daysAgo: 3, title: 'Dungeon Meshi', category: 'anime', duration_minutes: 50, cards_mined: 5, notes: 'Episode 11-12 JP sub, kosakata memasak.' },
    { daysAgo: 3, title: 'Comprehensible Japanese', category: 'video', duration_minutes: 35, cards_mined: 4, notes: 'Video vlog kehidupan sehari-hari di Kyoto.' },
    { daysAgo: 4, title: 'Steins;Gate', category: 'visual_novel', duration_minutes: 75, cards_mined: 15, notes: 'Sesi membaca panjang sore hari.' },
    { daysAgo: 5, title: 'Nihongo con Teppei Z', category: 'audio', duration_minutes: 55, cards_mined: 3, notes: '3 episode berturut-turut.' },
    { daysAgo: 5, title: 'Konbini Ningen', category: 'book', duration_minutes: 45, cards_mined: 11, notes: 'Narasi orang pertama cukup mudah diikuti.' },
    { daysAgo: 6, title: 'Sousou no Frieren', category: 'anime', duration_minutes: 72, cards_mined: 8, notes: 'Maraton 3 episode.' },
    { daysAgo: 7, title: 'Yotsuba&! Vol. 4', category: 'manga', duration_minutes: 60, cards_mined: 9, notes: 'Membaca santai sebelum tidur.' },
    { daysAgo: 8, title: 'Comprehensible Japanese', category: 'video', duration_minutes: 45, cards_mined: 5, notes: 'Intermediate playlist.' },
    { daysAgo: 9, title: 'Re:Zero kara Hajimeru Isekai Seikatsu Vol. 1', category: 'light_novel', duration_minutes: 80, cards_mined: 16, notes: 'Adegan aksi mulai seru.' },
    { daysAgo: 10, title: 'Anki Core 2k/6k Sentence Mining', category: 'study', duration_minutes: 30, cards_mined: 20, notes: 'Retention rate 91%.' },
    { daysAgo: 10, title: 'Dungeon Meshi', category: 'anime', duration_minutes: 48, cards_mined: 6, notes: 'Episode 9-10.' },
    { daysAgo: 11, title: 'Kimi no Na wa', category: 'movie', duration_minutes: 106, cards_mined: 12, notes: 'Full movie dengan Japanese subtitle.' },
    { daysAgo: 13, title: 'Steins;Gate', category: 'visual_novel', duration_minutes: 90, cards_mined: 17, notes: 'Chapter 3 selesai.' },
    { daysAgo: 14, title: 'Nihongo con Teppei Z', category: 'audio', duration_minutes: 45, cards_mined: 2, notes: 'Shadowing ringan.' },
    { daysAgo: 15, title: 'Sousou no Frieren', category: 'anime', duration_minutes: 50, cards_mined: 7, notes: 'Episode 14-15.' },
    { daysAgo: 16, title: 'Konbini Ningen', category: 'book', duration_minutes: 55, cards_mined: 10, notes: 'Setengah buku terlewati.' },
    { daysAgo: 17, title: 'Yotsuba&! Vol. 4', category: 'manga', duration_minutes: 40, cards_mined: 4, notes: 'Kosa kata sehari-hari.' },
    { daysAgo: 19, title: 'Comprehensible Japanese', category: 'video', duration_minutes: 50, cards_mined: 6, notes: 'Topik kuliner Jepang.' },
    { daysAgo: 21, title: 'Steins;Gate', category: 'visual_novel', duration_minutes: 85, cards_mined: 14, notes: 'Texthooker + Yomitan lancar.' },
    { daysAgo: 23, title: 'Dungeon Meshi', category: 'anime', duration_minutes: 48, cards_mined: 5, notes: 'Episode 7-8.' },
    { daysAgo: 25, title: 'Nihongo con Teppei Z', category: 'audio', duration_minutes: 35, cards_mined: 0, notes: 'Passive listening di perjalanan.' },
    { daysAgo: 27, title: 'Re:Zero kara Hajimeru Isekai Seikatsu Vol. 1', category: 'light_novel', duration_minutes: 60, cards_mined: 12, notes: 'Bab 2.' },
    { daysAgo: 29, title: 'Anki Core 2k/6k Sentence Mining', category: 'study', duration_minutes: 25, cards_mined: 15, notes: 'Sapu bersih due cards.' },
    { daysAgo: 32, title: 'Sousou no Frieren', category: 'anime', duration_minutes: 48, cards_mined: 6, notes: 'Episode 10-11.' },
    { daysAgo: 35, title: 'Yotsuba&! Vol. 3', category: 'manga', duration_minutes: 55, cards_mined: 8, notes: 'Tamat volume 3!' },
    { daysAgo: 38, title: 'Comprehensible Japanese', category: 'video', duration_minutes: 40, cards_mined: 4, notes: 'Beginner-Intermediate bridge.' },
    { daysAgo: 41, title: 'Steins;Gate', category: 'visual_novel', duration_minutes: 70, cards_mined: 11, notes: 'Mulai rute awal.' },
    { daysAgo: 44, title: 'Nihongo con Teppei Z', category: 'audio', duration_minutes: 30, cards_mined: 1, notes: 'Podcast pagi.' },
    { daysAgo: 47, title: 'Sousou no Frieren', category: 'anime', duration_minutes: 48, cards_mined: 5, notes: 'Episode 6-7.' },
    { daysAgo: 51, title: 'Konbini Ningen', category: 'book', duration_minutes: 40, cards_mined: 9, notes: 'Bab pembuka.' },
    { daysAgo: 55, title: 'Dungeon Meshi', category: 'anime', duration_minutes: 48, cards_mined: 4, notes: 'Episode 3-4.' },
    { daysAgo: 60, title: 'Yotsuba&! Vol. 3', category: 'manga', duration_minutes: 45, cards_mined: 7, notes: 'Latihan membaca cepat.' },
    { daysAgo: 66, title: 'Anki Core 2k/6k Sentence Mining', category: 'study', duration_minutes: 20, cards_mined: 15, notes: 'Setup deck awal.' },
    { daysAgo: 72, title: 'Sousou no Frieren', category: 'anime', duration_minutes: 72, cards_mined: 8, notes: 'Mulai immersion tracker!' },
  ];

  return entries.map((item, idx) => {
    const logged_date = dateOffset(item.daysAgo);
    return {
      id: `log-${idx + 1}`,
      user_id: DEMO_USER_ID,
      title: item.title,
      category: item.category,
      duration_minutes: item.duration_minutes,
      cards_mined: item.cards_mined,
      notes: item.notes,
      logged_date,
      created_at: `${logged_date}T12:${String(59 - (idx % 50)).padStart(2, '0')}:00.000Z`,
    };
  });
}

export function createDefaultGoals(): CustomGoal[] {
  return [
    {
      id: 'goal-monthly-all',
      title: 'Target 30 Jam Bulan Ini',
      targetHours: 30,
      track: 'all',
      startDate: dateOffset(20),
      deadline: dateFuture(10),
    },
    {
      id: 'goal-listening-100',
      title: 'Listening Marathon 25 Jam',
      targetHours: 25,
      track: 'listening',
      startDate: dateOffset(45),
      deadline: dateFuture(25),
    },
    {
      id: 'goal-reading-20',
      title: 'Reading Challenge 20 Jam',
      targetHours: 20,
      track: 'reading',
      startDate: dateOffset(35),
      deadline: dateFuture(20),
    },
  ];
}

export function loadDemoProfile(): Profile {
  try {
    const raw = localStorage.getItem(DEMO_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Profile;
      if (parsed.full_name === 'Maulana (Demo)') {
        const cleaned = { ...parsed, full_name: 'Maulana' };
        saveDemoProfile(cleaned);
        return cleaned;
      }
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  const fresh = createDefaultDemoProfile();
  saveDemoProfile(fresh);
  return fresh;
}

export function saveDemoProfile(profile: Profile): void {
  try {
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

export function loadDemoLogs(): ImmersionLog[] {
  try {
    const raw = localStorage.getItem(DEMO_LOGS_KEY);
    if (raw) {
      return JSON.parse(raw) as ImmersionLog[];
    }
  } catch {
    // ignore storage errors
  }
  const seed = createDemoLogs();
  saveDemoLogs(seed);
  return seed;
}

export function saveDemoLogs(logs: ImmersionLog[]): void {
  try {
    localStorage.setItem(DEMO_LOGS_KEY, JSON.stringify(logs));
  } catch {
    // ignore storage errors
  }
}

export function resetDemoLogs(): ImmersionLog[] {
  const seed = createDemoLogs();
  saveDemoLogs(seed);
  return seed;
}

export function clearDemoLogs(): ImmersionLog[] {
  saveDemoLogs([]);
  return [];
}

export function loadUserGoals(userId: string): CustomGoal[] {
  try {
    const raw = localStorage.getItem(`${GOALS_STORAGE_PREFIX}${userId}`);
    if (raw) {
      return JSON.parse(raw) as CustomGoal[];
    }
  } catch {
    // ignore storage errors
  }
  const defaults = createDefaultGoals();
  saveUserGoals(userId, defaults);
  return defaults;
}

export function saveUserGoals(userId: string, goals: CustomGoal[]): void {
  try {
    localStorage.setItem(`${GOALS_STORAGE_PREFIX}${userId}`, JSON.stringify(goals));
  } catch {
    // ignore storage errors
  }
}

export interface WorkspaceBackup {
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  logs: ImmersionLog[];
  goals: CustomGoal[];
}

export function exportWorkspaceJson(
  logs: ImmersionLog[],
  profile: Profile | null,
  goals: CustomGoal[]
): string {
  const payload: WorkspaceBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    logs,
    goals,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseWorkspaceBackup(raw: string): WorkspaceBackup {
  const parsed = JSON.parse(raw) as Partial<WorkspaceBackup>;
  if (!Array.isArray(parsed.logs)) {
    throw new Error('Format file backup tidak valid (data logs tidak ditemukan).');
  }
  return {
    version: 1,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    profile: parsed.profile ?? null,
    logs: parsed.logs,
    goals: Array.isArray(parsed.goals) ? parsed.goals : [],
  };
}
