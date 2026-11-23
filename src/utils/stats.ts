import {
  getCategoryMeta,
  type AchievementItem,
  type CustomGoal,
  type ImmersionCategory,
  type ImmersionLog,
  type SkillTrack,
} from '../types';

export type JlptLevelCode = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'Native';
export type JlptLevelSetting = 'auto' | JlptLevelCode;

export interface ImmersionStageInfo {
  code: JlptLevelCode;
  label: string;
  prevTargetHours: number;
  nextTargetHours: number;
  nextStageName: string;
  progressPct: number;
  remainingHours: number;
  isManual: boolean;
  estimatedCode: JlptLevelCode;
}

export const JLPT_STAGES: Array<{
  minHours: number;
  nextHours: number;
  code: JlptLevelCode;
  label: string;
  shortDesc: string;
  nextStageName: string;
}> = [
  {
    minHours: 0,
    nextHours: 150,
    code: 'N5',
    label: 'JLPT N5 · Pemula',
    shortDesc: 'Pemula',
    nextStageName: 'JLPT N5',
  },
  {
    minHours: 150,
    nextHours: 400,
    code: 'N4',
    label: 'JLPT N4 · Dasar',
    shortDesc: 'Dasar',
    nextStageName: 'JLPT N4',
  },
  {
    minHours: 400,
    nextHours: 950,
    code: 'N3',
    label: 'JLPT N3 · Menengah',
    shortDesc: 'Menengah',
    nextStageName: 'JLPT N3',
  },
  {
    minHours: 950,
    nextHours: 1600,
    code: 'N2',
    label: 'JLPT N2 · Mahir',
    shortDesc: 'Mahir',
    nextStageName: 'JLPT N2',
  },
  {
    minHours: 1600,
    nextHours: 2600,
    code: 'N1',
    label: 'JLPT N1 · Fasih',
    shortDesc: 'Fasih',
    nextStageName: 'JLPT N1',
  },
  {
    minHours: 2600,
    nextHours: 2600,
    code: 'Native',
    label: 'Native Fluency',
    shortDesc: 'Native',
    nextStageName: 'Native',
  },
];

export const getImmersionStage = (
  totalHours: number,
  manualLevel?: JlptLevelSetting | null
): ImmersionStageInfo => {
  const safeHours = Math.max(0, totalHours);
  const autoStage =
    [...JLPT_STAGES]
      .reverse()
      .find((s) => safeHours >= s.minHours) ?? JLPT_STAGES[0];

  const manualStage =
    manualLevel && manualLevel !== 'auto'
      ? JLPT_STAGES.find((s) => s.code === manualLevel)
      : undefined;

  const isManual = Boolean(manualStage);
  const stage = manualStage ?? autoStage;

  let progressPct = 0;
  if (stage.code === 'Native') {
    progressPct =
      safeHours >= stage.nextHours
        ? 100
        : Math.min(100, Math.round((safeHours / stage.nextHours) * 100));
  } else if (isManual && safeHours < stage.minHours) {
    progressPct = Math.min(
      100,
      Math.round((safeHours / Math.max(1, stage.nextHours)) * 100)
    );
  } else {
    const span = stage.nextHours - stage.minHours;
    progressPct =
      span <= 0
        ? 100
        : Math.min(100, Math.round(((safeHours - stage.minHours) / span) * 100));
  }

  const remainingHours = Math.max(
    0,
    Number((stage.nextHours - safeHours).toFixed(1))
  );

  return {
    code: stage.code,
    label: stage.label,
    prevTargetHours: stage.minHours,
    nextTargetHours: stage.nextHours,
    nextStageName: stage.nextStageName,
    progressPct,
    remainingHours,
    isManual,
    estimatedCode: autoStage.code,
  };
};

export const MILESTONES = [25, 100, 300, 600, 1000, 1500, 2500];

export const getLocalDateString = (date = new Date()): string => {
  return date.toLocaleDateString('en-CA');
};

export const calculateXp = (
  category: ImmersionCategory | string,
  durationMinutes: number,
  cardsMined = 0
): number => {
  const meta = getCategoryMeta(category);
  const timeXp = (Math.max(0, durationMinutes) / 60) * meta.xpPerHour;
  const cardXp = Math.max(0, cardsMined) * 4;
  return Math.round(timeXp + cardXp);
};

export const getLogXp = (
  log: Pick<ImmersionLog, 'category' | 'duration_minutes' | 'cards_mined'>
): number => {
  return calculateXp(log.category, log.duration_minutes, log.cards_mined);
};

const RANK_TITLES: Array<{ minLevel: number; title: string }> = [
  { minLevel: 50, title: 'Immersion Legend' },
  { minLevel: 35, title: 'Native Echo' },
  { minLevel: 25, title: 'Fluency Seeker' },
  { minLevel: 15, title: 'Input Grinder' },
  { minLevel: 8, title: 'Story Explorer' },
  { minLevel: 3, title: 'Daily Listener' },
  { minLevel: 1, title: 'Novice Learner' },
];

export interface LevelInfo {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
  rankTitle: string;
}

export const getLevelInfo = (totalXp: number): LevelInfo => {
  let level = 1;
  let remaining = Math.max(0, Math.round(totalXp));

  const xpForNext = (lvl: number) => 120 + (lvl - 1) * 55;

  while (remaining >= xpForNext(level)) {
    remaining -= xpForNext(level);
    level++;
  }

  const nextLevelXp = xpForNext(level);
  const progressPct = Math.min(100, Math.round((remaining / nextLevelXp) * 100));
  const rankTitle =
    RANK_TITLES.find((r) => level >= r.minLevel)?.title ?? 'Novice Learner';

  return {
    level,
    totalXp: Math.round(totalXp),
    currentLevelXp: remaining,
    nextLevelXp,
    progressPct,
    rankTitle,
  };
};

export const getSkillLevels = (logs: ImmersionLog[]) => {
  let totalXp = 0;
  let listeningXp = 0;
  let readingXp = 0;
  let studyXp = 0;

  for (const log of logs) {
    const xp = getLogXp(log);
    totalXp += xp;
    const track = getCategoryMeta(log.category).track;
    if (track === 'listening') listeningXp += xp;
    else if (track === 'reading') readingXp += xp;
    else studyXp += xp;
  }

  return {
    overall: getLevelInfo(totalXp),
    listening: getLevelInfo(listeningXp),
    reading: getLevelInfo(readingXp),
    study: getLevelInfo(studyXp),
  };
};

export const calculateStreak = (logs: ImmersionLog[]): number => {
  if (!logs.length) return 0;

  const uniqueDates = new Set(logs.map((l) => l.logged_date));
  const today = new Date();
  const todayStr = getLocalDateString(today);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  let cursor = new Date(today);
  if (uniqueDates.has(todayStr)) {
    cursor = new Date(today);
  } else if (uniqueDates.has(yesterdayStr)) {
    cursor = new Date(yesterday);
  } else {
    return 0;
  }

  let streak = 0;
  while (uniqueDates.has(getLocalDateString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export const calculateLongestStreak = (logs: ImmersionLog[]): number => {
  if (!logs.length) return 0;

  const sortedDates = Array.from(new Set(logs.map((l) => l.logged_date))).sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(`${sortedDates[i - 1]}T00:00:00`);
    const curr = new Date(`${sortedDates[i]}T00:00:00`);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 1) {
      current++;
      if (current > longest) longest = current;
    } else if (diffDays > 1) {
      current = 1;
    }
  }

  return longest;
};

export const getMilestoneProgress = (totalHours: number) => {
  const nextMilestone =
    MILESTONES.find((m) => totalHours < m) ?? MILESTONES[MILESTONES.length - 1];
  const idx = MILESTONES.indexOf(nextMilestone);
  const prevMilestone = idx > 0 ? MILESTONES[idx - 1] : 0;

  const progress =
    totalHours >= MILESTONES[MILESTONES.length - 1]
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            ((totalHours - prevMilestone) / (nextMilestone - prevMilestone)) * 100
          )
        );

  return {
    nextMilestone,
    prevMilestone,
    progress,
    milestones: MILESTONES,
  };
};

export const getMonthlyComparison = (logs: ImmersionLog[]) => {
  const now = new Date();
  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(
    lastMonthDate.getMonth() + 1
  ).padStart(2, '0')}`;

  const createBucket = () => ({
    readingMin: 0,
    listeningMin: 0,
    studyMin: 0,
    totalMin: 0,
    xp: 0,
  });

  const thisMonth = createBucket();
  const lastMonth = createBucket();

  for (const log of logs) {
    const target = log.logged_date.startsWith(thisMonthPrefix)
      ? thisMonth
      : log.logged_date.startsWith(lastMonthPrefix)
        ? lastMonth
        : null;

    if (!target) continue;

    const track = getCategoryMeta(log.category).track;
    if (track === 'reading') target.readingMin += log.duration_minutes;
    else if (track === 'listening') target.listeningMin += log.duration_minutes;
    else target.studyMin += log.duration_minutes;

    target.totalMin += log.duration_minutes;
    target.xp += getLogXp(log);
  }

  const calcDelta = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr > 0 ? 100 : null;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    thisMonth,
    lastMonth,
    deltas: {
      readingPct: calcDelta(thisMonth.readingMin, lastMonth.readingMin),
      listeningPct: calcDelta(thisMonth.listeningMin, lastMonth.listeningMin),
      totalPct: calcDelta(thisMonth.totalMin, lastMonth.totalMin),
    },
  };
};

function allocateExactPercentages(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floored = raw.map((x) => Math.floor(x));
  let remainder = 100 - floored.reduce((s, v) => s + v, 0);
  const order = raw
    .map((x, idx) => ({ idx, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i++) {
    floored[order[i % order.length].idx] += 1;
  }
  return floored;
}

export const getReadingListeningBalance = (logs: ImmersionLog[]) => {
  let readingMin = 0;
  let listeningMin = 0;
  let studyMin = 0;

  for (const log of logs) {
    const mins = Math.max(0, log.duration_minutes || 0);
    const track = getCategoryMeta(log.category).track;
    if (track === 'reading') readingMin += mins;
    else if (track === 'listening') listeningMin += mins;
    else studyMin += mins;
  }

  const totalMin = readingMin + listeningMin + studyMin;
  const [listeningPct, readingPct, studyPct] = allocateExactPercentages([
    listeningMin,
    readingMin,
    studyMin,
  ]);

  const inputTotal = listeningMin + readingMin;
  const [inputListeningPct, inputReadingPct] = allocateExactPercentages([
    listeningMin,
    readingMin,
  ]);

  const ratioLabel =
    inputTotal > 0 ? `${inputListeningPct}% : ${inputReadingPct}%` : '0% : 0%';

  return {
    readingMin,
    listeningMin,
    studyMin,
    totalMin,
    readingPct,
    listeningPct,
    studyPct,
    inputListeningPct,
    inputReadingPct,
    ratioLabel,
  };
};

export interface RecentMediaCard {
  title: string;
  category: ImmersionCategory;
  totalMinutes: number;
  totalCards: number;
  sessions: number;
  lastDate: string;
}

export const getRecentMediaCards = (
  logs: ImmersionLog[],
  limit = 6
): RecentMediaCard[] => {
  const map = new Map<string, RecentMediaCard>();

  const sorted = [...logs].sort((a, b) => {
    if (a.logged_date !== b.logged_date) {
      return b.logged_date.localeCompare(a.logged_date);
    }
    return b.created_at.localeCompare(a.created_at);
  });

  for (const log of sorted) {
    const key = log.title.trim().toLowerCase();
    if (!key) continue;

    const existing = map.get(key);
    if (existing) {
      existing.totalMinutes += log.duration_minutes;
      existing.totalCards += log.cards_mined;
      existing.sessions += 1;
    } else {
      map.set(key, {
        title: log.title,
        category: log.category,
        totalMinutes: log.duration_minutes,
        totalCards: log.cards_mined,
        sessions: 1,
        lastDate: log.logged_date,
      });
    }
  }

  return Array.from(map.values()).slice(0, limit);
};

export const getGoalProgress = (goal: CustomGoal, logs: ImmersionLog[]) => {
  const matchingMinutes = logs
    .filter((log) => {
      if (log.logged_date < goal.startDate || log.logged_date > goal.deadline) {
        return false;
      }
      if (goal.track === 'all') return true;
      return getCategoryMeta(log.category).track === goal.track;
    })
    .reduce((sum, l) => sum + l.duration_minutes, 0);

  const loggedHours = matchingMinutes / 60;
  const remainingHours = Math.max(0, goal.targetHours - loggedHours);
  const progressPct = Math.min(
    100,
    Math.round((loggedHours / Math.max(0.1, goal.targetHours)) * 100)
  );

  const today = new Date(`${getLocalDateString()}T00:00:00`);
  const start = new Date(`${goal.startDate}T00:00:00`);
  const end = new Date(`${goal.deadline}T00:00:00`);

  const totalSpanDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const elapsedDays = Math.max(
    1,
    Math.min(
      totalSpanDays,
      Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    )
  );
  const daysLeft = Math.max(
    0,
    Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  const expectedPct = (elapsedDays / totalSpanDays) * 100;
  const requiredDailyMinutes =
    daysLeft > 0 ? Math.ceil((remainingHours * 60) / daysLeft) : Math.ceil(remainingHours * 60);

  let status: 'completed' | 'ahead' | 'on_track' | 'behind' = 'on_track';
  if (loggedHours >= goal.targetHours) {
    status = 'completed';
  } else if (progressPct >= expectedPct + 8) {
    status = 'ahead';
  } else if (progressPct < expectedPct - 10) {
    status = 'behind';
  }

  return {
    loggedHours,
    remainingHours,
    progressPct,
    daysLeft,
    requiredDailyMinutes,
    status,
  };
};

export const computeAchievements = (logs: ImmersionLog[]): AchievementItem[] => {
  const totalMinutes = logs.reduce((s, l) => s + l.duration_minutes, 0);
  const totalHours = totalMinutes / 60;
  const totalCards = logs.reduce((s, l) => s + l.cards_mined, 0);
  const totalLogs = logs.length;
  const longestStreak = calculateLongestStreak(logs);
  const maxSessionMinutes = logs.reduce(
    (max, l) => Math.max(max, l.duration_minutes),
    0
  );

  const trackHours: Record<SkillTrack, number> = {
    listening: 0,
    reading: 0,
    study: 0,
  };
  const usedCategories = new Set<string>();

  for (const l of logs) {
    const meta = getCategoryMeta(l.category);
    trackHours[meta.track] += l.duration_minutes / 60;
    usedCategories.add(meta.label);
  }

  const makeItem = (
    id: string,
    title: string,
    description: string,
    rarity: AchievementItem['rarity'],
    points: number,
    icon: AchievementItem['icon'],
    current: number,
    target: number,
    unit: string
  ): AchievementItem => {
    const unlocked = current >= target;
    const progressPct = Math.min(100, Math.round((current / target) * 100));
    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    return {
      id,
      title,
      description,
      rarity,
      points,
      unlocked,
      progressPct,
      currentLabel: `${fmt(Math.min(current, target))} ${unit}`,
      targetLabel: `${fmt(target)} ${unit}`,
      icon,
    };
  };

  return [
    makeItem('first-log', 'Langkah Pertama', 'Catat sesi immersion pertamamu.', 'common', 10, 'sparkles', totalLogs, 1, 'sesi'),
    makeItem('ten-logs', 'Kebiasaan Baru', 'Selesaikan 10 sesi immersion tercatat.', 'common', 15, 'layers', totalLogs, 10, 'sesi'),
    makeItem('streak-3', 'Pemanasan 3 Hari', 'Pertahankan streak 3 hari berturut-turut.', 'common', 15, 'flame', longestStreak, 3, 'hari'),
    makeItem('hours-10', 'Sepuluh Jam Pertama', 'Kumpulkan total 10 jam immersion.', 'common', 20, 'clock', totalHours, 10, 'jam'),

    makeItem('streak-7', 'Minggu Konsisten', 'Capai streak 7 hari berturut-turut.', 'uncommon', 30, 'flame', longestStreak, 7, 'hari'),
    makeItem('cards-100', 'Penambang Kosakata', 'Tambang 100 kartu / kosakata baru.', 'uncommon', 30, 'zap', totalCards, 100, 'kartu'),
    makeItem('hours-25', 'Quarter Century', 'Kumpulkan total 25 jam immersion.', 'uncommon', 35, 'clock', totalHours, 25, 'jam'),
    makeItem('marathon-90', 'Sesi Fokus 90 Menit', 'Catat satu sesi berdurasi minimal 90 menit.', 'uncommon', 30, 'zap', maxSessionMinutes, 90, 'mnt'),

    makeItem('variety-4', 'Omnivore Pembelajar', 'Gunakan minimal 4 jenis media berbeda.', 'rare', 50, 'layers', usedCategories.size, 4, 'media'),
    makeItem('listening-25', 'Telinga Tajam', 'Capai 25 jam listening immersion.', 'rare', 60, 'headphones', trackHours.listening, 25, 'jam'),
    makeItem('reading-25', 'Kutu Buku', 'Capai 25 jam reading immersion.', 'rare', 60, 'book', trackHours.reading, 25, 'jam'),
    makeItem('streak-14', 'Dua Minggu Tanpa Putus', 'Capai streak 14 hari berturut-turut.', 'rare', 75, 'flame', longestStreak, 14, 'hari'),

    makeItem('hours-100', 'Centurion Input', 'Tembus milestone 100 jam total immersion.', 'epic', 120, 'trophy', totalHours, 100, 'jam'),
    makeItem('cards-500', 'Kolektor 500 Kartu', 'Tambang total 500 kosakata baru.', 'epic', 110, 'zap', totalCards, 500, 'kartu'),
    makeItem('streak-30', 'Ritual 30 Hari', 'Bangun streak 30 hari penuh tanpa bolong.', 'epic', 150, 'flame', longestStreak, 30, 'hari'),

    makeItem('hours-500', 'Master Immersion 500J', 'Capai 500 jam akumulasi immersion.', 'legendary', 300, 'trophy', totalHours, 500, 'jam'),
  ];
};
