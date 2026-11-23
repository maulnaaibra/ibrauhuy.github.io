import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  Clock,
  Cloud,
  Compass,
  ExternalLink,
  Flame,
  History,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  Moon,
  Plus,
  Settings,
  Sun,
  Target,
  Trophy,
  User,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  loadAppearanceSettings,
  subscribeAppearanceChanges,
  toggleDarkThemeMode,
} from '../lib/appearance';
import { supabase } from '../lib/supabase';
import { getCatalogMediaDestinations } from '../lib/mediaLinks';
import {
  buildCommunityMemberSnapshot,
  buildPublicProfileSnapshot,
  loadExtendedProfileMeta,
  saveExtendedProfileMeta,
  type ExtendedUserProfile,
} from '../lib/profileMeta';
import { ProfileDashboardSection } from '../components/ProfileDashboardSection';
import { COMMUNITY_LEADERBOARD } from '../lib/publicShowcase';
import { loadUserGoals, saveUserGoals } from '../lib/demoData';
import {
  ackCompanionSessions,
  claimCompanionSessions,
  fetchCompanionStatus,
  loadCompanionSettings,
  releaseCompanionClaim,
  saveCompanionSettings,
  type CompanionSettings,
  type CompanionStatus,
  type PendingTrackedSession,
} from '../lib/companionClient';
import {
  fetchAnkiTodayStats,
  loadAnkiSettings,
} from '../lib/ankiConnect';
import { MediaCover } from '../components/MediaCover';
import { WallpaperNavbarButton } from '../components/WallpaperCustomizerPopover';
import { useAuth } from '../context/AuthContext';
import {
  getCategoryMeta,
  type CustomGoal,
  type ImmersionCategory,
  type ImmersionLog,
} from '../types';
import {
  calculateLongestStreak,
  calculateStreak,
  getImmersionStage,
  getLocalDateString,
  getMilestoneProgress,
  getMonthlyComparison,
  getReadingListeningBalance,
  getRecentMediaCards,
  type JlptLevelSetting,
} from '../utils/stats';
import { LiveStopwatch } from '../components/LiveStopwatch';
import { LogModal } from '../components/LogModal';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { ChartsSection } from '../components/ChartsSection';
import { GoalsSection } from '../components/GoalsSection';
import { AchievementsSection } from '../components/AchievementsSection';
import { ActivityLogList } from '../components/ActivityLogList';
import { DevicesSection } from '../components/DevicesSection';
import { MediaCatalogBrowser } from '../components/MediaCatalogBrowser';
import {
  LeftSidebarNavigation,
  ShortcutsHubModal,
} from '../components/ShortcutsHubModal';

type DashboardTab =
  | 'overview'
  | 'profile'
  | 'catalog'
  | 'stats'
  | 'goals'
  | 'achievements'
  | 'activity'
  | 'devices';

const QUICK_LOG_PRESETS: Array<{
  label: string;
  title: string;
  category: ImmersionCategory;
  duration: number;
}> = [
  {
    label: '+24m Anime (1 Eps)',
    title: 'Anime Episode',
    category: 'anime',
    duration: 24,
  },
  {
    label: '+30m Manga',
    title: 'Manga Reading',
    category: 'manga',
    duration: 30,
  },
  {
    label: '+45m Visual Novel',
    title: 'Visual Novel',
    category: 'visual_novel',
    duration: 45,
  },
  {
    label: '+20m Anki Review',
    title: 'Anki Review',
    category: 'study',
    duration: 20,
  },
  {
    label: '+25m Podcast',
    title: 'Podcast Bahasa',
    category: 'audio',
    duration: 25,
  },
];

const VALID_DASHBOARD_TABS: DashboardTab[] = [
  'overview',
  'profile',
  'catalog',
  'stats',
  'goals',
  'achievements',
  'activity',
  'devices',
];
const ACTIVE_TAB_STORAGE_KEY = 'immersiontrack_active_tab_v1';

function isValidDashboardTab(val: string | null): val is DashboardTab {
  return Boolean(val && VALID_DASHBOARD_TABS.includes(val as DashboardTab));
}

export const DashboardPage: React.FC = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTabParam = searchParams.get('tab');

  const activeTab: DashboardTab = isValidDashboardTab(urlTabParam)
    ? urlTabParam
    : (() => {
        try {
          const fromStorage = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
          if (isValidDashboardTab(fromStorage)) return fromStorage;
        } catch {
          // ignore storage errors
        }
        return 'overview';
      })();

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch {
      // ignore storage errors
    }
  }, [activeTab]);

  useEffect(() => {
    if (!urlTabParam || !isValidDashboardTab(urlTabParam)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', activeTab);
          return next;
        },
        { replace: true }
      );
    }
  }, [urlTabParam, activeTab, setSearchParams]);

  const setActiveTab = useCallback(
    (nextTab: DashboardTab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', nextTab);
        next.delete('media');
        return next;
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setSearchParams]
  );
  const [initialCatalogTitle, setInitialCatalogTitle] = useState<string | null>(
    null
  );
  const [inspectedMemberId, setInspectedMemberId] = useState<string | null>(
    null
  );
  const [extProfileOverride, setExtProfileOverride] =
    useState<ExtendedUserProfile | null>(null);
  const [logs, setLogs] = useState<ImmersionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [goals, setGoals] = useState<CustomGoal[]>(() =>
    loadUserGoals(user?.id ?? 'default')
  );

  const [companionSettings, setCompanionSettings] = useState<CompanionSettings>(
    loadCompanionSettings
  );
  const [companionStatus, setCompanionStatus] = useState<CompanionStatus | null>(
    null
  );
  const [companionChecking, setCompanionChecking] = useState(false);
  const importedPendingIdsRef = useRef<Set<string>>(new Set());
  const logsLoadedRef = useRef(false);
  const isPollingCompanionRef = useRef(false);
  const ankiSyncInFlightRef = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(
    () => loadAppearanceSettings().darkMode
  );
  const [modalKey, setModalKey] = useState(0);

  useEffect(() => {
    return subscribeAppearanceChanges((next) => {
      setIsDarkTheme(next.darkMode);
    });
  }, []);

  const handleToggleDarkGlassTheme = () => {
    const next = toggleDarkThemeMode();
    setIsDarkTheme(next.darkMode);
    toast.success(
      next.darkMode
        ? 'Tema Gelap • Blur Transparan diaktifkan!'
        : 'Tema Terang • Blur Transparan diaktifkan!'
    );
  };
  const [editingLog, setEditingLog] = useState<ImmersionLog | null>(null);
  const [prefillDuration, setPrefillDuration] = useState<number | undefined>(
    undefined
  );
  const [prefillTitle, setPrefillTitle] = useState<string | undefined>(
    undefined
  );
  const [prefillCategory, setPrefillCategory] = useState<
    ImmersionCategory | undefined
  >(undefined);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('immersion_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!active) return;
      if (error) {
        toast.error('Gagal memuat riwayat belajar');
      } else {
        const loaded = (data as ImmersionLog[]) ?? [];
        logsRef.current = loaded;
        setLogs(loaded);
      }
      logsLoadedRef.current = true;
      setGoals(loadUserGoals(user.id));
      setLoadingLogs(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [user]);

  const logsRef = useRef<ImmersionLog[]>([]);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const importPendingSessions = useCallback(
    async (
      sessions: PendingTrackedSession[],
      notify = false,
      claimId?: string | null
    ) => {
      if (!user || sessions.length === 0) {
        if (claimId) {
          void releaseCompanionClaim(companionSettings.url, claimId).catch(() => {});
        }
        return;
      }

      const freshSessions = sessions.filter(
        (s) => !importedPendingIdsRef.current.has(s.id)
      );
      if (freshSessions.length === 0) {
        if (claimId) {
          void releaseCompanionClaim(companionSettings.url, claimId).catch(() => {});
        }
        return;
      }

      freshSessions.forEach((s) => importedPendingIdsRef.current.add(s.id));

      const ackedIds: string[] = [];
      let anyInsertedOrUpdated = false;

      for (const s of freshSessions) {
        const isAnkiAutoTrack =
          s.category === 'study' && s.title.toLowerCase().includes('anki');
        const hasTodayAnkiConnectSync = logsRef.current.some(
          (l) =>
            l.logged_date === s.logged_date &&
            l.category === 'study' &&
            (l.notes ?? '').startsWith('AnkiConnect sync')
        );

        // If today's Anki is already synced accurately via AnkiConnect, ack & skip auto-tracked Anki chunks
        if (isAnkiAutoTrack && hasTodayAnkiConnectSync) {
          ackedIds.push(s.id);
          continue;
        }

        const safeDuration = Math.min(
          60,
          Math.max(1, Math.round(Number(s.duration_minutes || 0)))
        );

        const existingAutoLog = logsRef.current.find(
          (l) =>
            l.logged_date === s.logged_date &&
            l.category === s.category &&
            l.title === s.title &&
            (l.notes ?? '').startsWith('Auto-tracked')
        );

        if (existingAutoLog) {
          const nextDuration = existingAutoLog.duration_minutes + safeDuration;
          const { data, error } = await supabase
            .from('immersion_logs')
            .update({ duration_minutes: nextDuration })
            .eq('id', existingAutoLog.id)
            .select()
            .single();

          if (error) {
            importedPendingIdsRef.current.delete(s.id);
            continue;
          }
          ackedIds.push(s.id);
          if (data) {
            const updatedRow = data as ImmersionLog;
            logsRef.current = logsRef.current.map((l) =>
              l.id === updatedRow.id ? updatedRow : l
            );
            setLogs((prev) =>
              prev.map((l) => (l.id === updatedRow.id ? updatedRow : l))
            );
            anyInsertedOrUpdated = true;
          }
        } else {
          const { data, error } = await supabase
            .from('immersion_logs')
            .insert({
              user_id: user.id,
              title: s.title,
              category: s.category,
              duration_minutes: safeDuration,
              cards_mined: s.cards_mined,
              notes: s.notes,
              logged_date: s.logged_date,
            })
            .select()
            .single();

          if (error) {
            importedPendingIdsRef.current.delete(s.id);
            continue;
          }
          ackedIds.push(s.id);
          if (data) {
            const insertedRow = data as ImmersionLog;
            logsRef.current = [insertedRow, ...logsRef.current];
            setLogs((prev) => [insertedRow, ...prev]);
            anyInsertedOrUpdated = true;
          }
        }
      }

      if (ackedIds.length > 0) {
        try {
          await ackCompanionSessions(
            companionSettings.url,
            ackedIds,
            claimId
          );
        } catch {
          // ignore ack failure
        }
      } else if (claimId) {
        try {
          await releaseCompanionClaim(companionSettings.url, claimId);
        } catch {
          // ignore release failure
        }
      }

      if (!anyInsertedOrUpdated) return;

      if (notify) {
        if (freshSessions.length === 1) {
          toast.success(
            `Auto-logged dari PC: ${freshSessions[0].title} (+${freshSessions[0].duration_minutes}m)`
          );
        } else {
          toast.success(
            `${freshSessions.length} sesi dari PC berhasil disinkronkan!`
          );
        }
      }
    },
    [user, companionSettings.url]
  );

  const pollCompanion = useCallback(async () => {
    if (isPollingCompanionRef.current) return;
    isPollingCompanionRef.current = true;
    try {
      const status = await fetchCompanionStatus(companionSettings.url);
      setCompanionStatus(status);
      if (
        status?.ok &&
        companionSettings.autoSync &&
        logsLoadedRef.current &&
        status.pendingCount > 0
      ) {
        const claimed = await claimCompanionSessions(companionSettings.url);
        if (claimed && claimed.ok && claimed.sessions.length > 0) {
          await importPendingSessions(
            claimed.sessions,
            false,
            claimed.claimId
          );
        } else if (claimed === null && status.pending.length > 0) {
          // Legacy v2.0 fallback when /claim is unavailable
          await importPendingSessions(status.pending, false, null);
        }
        const updated = await fetchCompanionStatus(companionSettings.url);
        if (updated) setCompanionStatus(updated);
      }
    } finally {
      isPollingCompanionRef.current = false;
    }
  }, [companionSettings.url, companionSettings.autoSync, importPendingSessions]);

  useEffect(() => {
    if (!user) return;
    void pollCompanion();
    const timer = setInterval(() => {
      void pollCompanion();
    }, 2500);
    return () => clearInterval(timer);
  }, [user, pollCompanion]);

  // Global keyboard shortcuts (Ctrl+K, /, ?, N, 1..8, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShortcutsModalOpen((prev) => !prev);
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if (isTyping) return;

      if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        setShortcutsModalOpen(true);
      } else if (
        (e.key === 'n' || e.key === 'N') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setEditingLog(null);
        setPrefillDuration(undefined);
        setPrefillTitle(undefined);
        setPrefillCategory(undefined);
        setModalKey((k) => k + 1);
        setModalOpen(true);
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tabMap: Record<string, DashboardTab> = {
          '1': 'overview',
          '2': 'profile',
          '3': 'catalog',
          '4': 'stats',
          '5': 'goals',
          '6': 'achievements',
          '7': 'activity',
          '8': 'devices',
        };
        if (tabMap[e.key]) {
          e.preventDefault();
          setActiveTab(tabMap[e.key]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveTab]);

  useEffect(() => {
    if (!user) return;
    const goalParam = searchParams.get('goal');
    const logTitleParam = searchParams.get('logTitle');
    const logCatParam = searchParams.get('logCategory') as
      | ImmersionCategory
      | null;
    const logDurationParam = searchParams.get('logDuration');

    if (!goalParam && !logTitleParam) return;

    const timer = setTimeout(() => {
      if (goalParam) {
        const parsedGoal = Number(goalParam);
        if (Number.isFinite(parsedGoal) && parsedGoal >= 5 && parsedGoal <= 1440) {
          void supabase
            .from('profiles')
            .update({ daily_goal_minutes: parsedGoal })
            .eq('id', user.id)
            .then(() => refreshProfile());
        }
      }

      if (logTitleParam) {
        const parsedDuration = Number(logDurationParam);
        setEditingLog(null);
        setPrefillTitle(logTitleParam);
        setPrefillCategory(logCatParam ?? 'anime');
        setPrefillDuration(
          Number.isFinite(parsedDuration) && parsedDuration > 0
            ? parsedDuration
            : 30
        );
        setModalKey((k) => k + 1);
        setModalOpen(true);
      }

      setSearchParams({ tab: activeTab }, { replace: true });
    }, 0);

    return () => clearTimeout(timer);
  }, [user, searchParams, setSearchParams, refreshProfile, activeTab]);

  const handleManualRefreshCompanion = async () => {
    setCompanionChecking(true);
    try {
      await pollCompanion();
    } finally {
      setCompanionChecking(false);
    }
  };

  const updateCompanionSettings = (patch: Partial<CompanionSettings>) => {
    setCompanionSettings((prev) => {
      const next = { ...prev, ...patch };
      saveCompanionSettings(next);
      return next;
    });
  };

  const openNewLogModal = (opts?: {
    duration?: number;
    title?: string;
    category?: ImmersionCategory;
  }) => {
    setEditingLog(null);
    setPrefillDuration(opts?.duration);
    setPrefillTitle(opts?.title);
    setPrefillCategory(opts?.category);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  };

  const openEditLogModal = (log: ImmersionLog) => {
    setEditingLog(log);
    setPrefillDuration(undefined);
    setPrefillTitle(undefined);
    setPrefillCategory(undefined);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  };

  const ownExtProfile = useMemo(() => {
    const base = loadExtendedProfileMeta(
      user?.id ?? 'default',
      profile,
      user?.email,
      user?.user_metadata
    );
    return extProfileOverride ?? base;
  }, [user, profile, extProfileOverride]);

  const stats = useMemo(() => {
    const totalMinutes = logs.reduce((sum, l) => sum + l.duration_minutes, 0);
    const totalHours = totalMinutes / 60;
    const totalCards = logs.reduce((sum, l) => sum + l.cards_mined, 0);
    const todayStr = getLocalDateString();
    const todayMinutes = logs
      .filter((l) => l.logged_date === todayStr)
      .reduce((sum, l) => sum + l.duration_minutes, 0);

    const streak = calculateStreak(logs);
    const longestStreak = calculateLongestStreak(logs);
    const milestone = getMilestoneProgress(totalHours);
    const dailyGoal = profile?.daily_goal_minutes ?? 90;
    const dailyProgress = Math.min(
      100,
      Math.round((todayMinutes / Math.max(1, dailyGoal)) * 100)
    );
    const stage = getImmersionStage(totalHours, ownExtProfile.jlpt_level);
    const monthly = getMonthlyComparison(logs);
    const balance = getReadingListeningBalance(logs);
    const recentMedia = getRecentMediaCards(logs, 6);

    return {
      totalHours,
      totalCards,
      todayMinutes,
      dailyGoal,
      dailyProgress,
      streak,
      longestStreak,
      milestone,
      stage,
      monthly,
      balance,
      recentMedia,
    };
  }, [logs, profile, ownExtProfile.jlpt_level]);

  const rankedLeaderboard = useMemo(() => {
    const selfEntry = {
      id: user?.id ?? 'self',
      name: `${profile?.full_name || user?.email?.split('@')[0] || 'Anda'} (Anda)`,
      targetLanguage: profile?.target_language ?? 'Japanese',
      rankTitle: stats.stage.label,
      streak: stats.streak,
      totalHours: Number(stats.totalHours.toFixed(1)),
      favoriteMedia: stats.recentMedia[0]?.title || 'Belum ada media',
      isSelf: true,
    };

    return [
      ...COMMUNITY_LEADERBOARD.map((item) => ({ ...item, isSelf: false })),
      selfEntry,
    ].sort((a, b) => b.totalHours - a.totalHours);
  }, [user, profile, stats]);

  const handleSaveLog = async (payload: {
    title: string;
    category: ImmersionCategory;
    duration_minutes: number;
    cards_mined: number;
    notes: string;
    logged_date: string;
  }) => {
    if (!user) return;

    if (editingLog) {
      const { data, error } = await supabase
        .from('immersion_logs')
        .update(payload)
        .eq('id', editingLog.id)
        .select()
        .single();

      if (error) {
        toast.error('Gagal memperbarui log');
        return;
      }
      setLogs((prev) =>
        prev.map((l) => (l.id === editingLog.id ? (data as ImmersionLog) : l))
      );
      toast.success('Sesi berhasil diperbarui');
    } else {
      const { data, error } = await supabase
        .from('immersion_logs')
        .insert([{ ...payload, user_id: user.id }])
        .select()
        .single();

      if (error) {
        toast.error('Gagal menyimpan log');
        return;
      }
      setLogs((prev) => [data as ImmersionLog, ...prev]);
      toast.success('Sesi immersion berhasil dicatat!');
    }

    setEditingLog(null);
  };

  const handleSyncAnkiToday = useCallback(
    async ({
      deckLabel,
      durationMinutes,
      cardsMined,
      reviewsToday,
      notesAdded = 0,
      cardsIntroduced = 0,
      usedExactTimer = false,
      silent = false,
    }: {
      deckLabel: string;
      durationMinutes: number;
      cardsMined: number;
      reviewsToday: number;
      notesAdded?: number;
      cardsIntroduced?: number;
      usedExactTimer?: boolean;
      silent?: boolean;
    }) => {
      if (!user) return;
      const todayStr = getLocalDateString();
      const title =
        deckLabel === 'Semua Deck' ? 'Anki Review' : `Anki — ${deckLabel}`;
      const methodLabel = usedExactTimer ? 'Revlog Asli' : 'Estimasi';
      const notes = `AnkiConnect sync (${methodLabel}): ${reviewsToday.toLocaleString('id-ID')} review, +${notesAdded} ditambang, +${cardsIntroduced} baru (${deckLabel})`;

      const matchingTodayAnkiLogs = logsRef.current.filter(
        (l) =>
          l.logged_date === todayStr &&
          l.category === 'study' &&
          ((l.notes ?? '').startsWith('AnkiConnect sync') ||
            l.title.toLowerCase().startsWith('anki'))
      );

      const primaryLog =
        matchingTodayAnkiLogs.find((l) =>
          (l.notes ?? '').startsWith('AnkiConnect sync')
        ) ?? matchingTodayAnkiLogs[0];
      const duplicateIds = matchingTodayAnkiLogs
        .filter((l) => primaryLog && l.id !== primaryLog.id)
        .map((l) => l.id);

      if (primaryLog) {
        if (
          primaryLog.title === title &&
          primaryLog.duration_minutes === durationMinutes &&
          primaryLog.cards_mined === cardsMined &&
          primaryLog.notes === notes &&
          duplicateIds.length === 0
        ) {
          if (!silent) {
            toast.success('Statistik Anki hari ini sudah paling mutakhir.');
          }
          return;
        }

        const { data, error } = await supabase
          .from('immersion_logs')
          .update({
            title,
            duration_minutes: durationMinutes,
            cards_mined: cardsMined,
            notes,
          })
          .eq('id', primaryLog.id)
          .select()
          .single();

        if (error) {
          if (!silent) toast.error('Gagal memperbarui log Anki');
          return;
        }

        if (duplicateIds.length > 0) {
          await supabase.from('immersion_logs').delete().in('id', duplicateIds);
        }

        const dupSet = new Set(duplicateIds);
        const updated = data as ImmersionLog;
        logsRef.current = logsRef.current
          .filter((l) => !dupSet.has(l.id))
          .map((l) => (l.id === primaryLog.id ? updated : l));
        setLogs((prev) =>
          prev
            .filter((l) => !dupSet.has(l.id))
            .map((l) => (l.id === primaryLog.id ? updated : l))
        );
        if (!silent) toast.success('Log Anki hari ini diperbarui dengan data akurat!');
      } else {
        const { data, error } = await supabase
          .from('immersion_logs')
          .insert([
            {
              user_id: user.id,
              title,
              category: 'study',
              duration_minutes: durationMinutes,
              cards_mined: cardsMined,
              notes,
              logged_date: todayStr,
            },
          ])
          .select()
          .single();

        if (error) {
          if (!silent) toast.error('Gagal menyimpan log Anki');
          return;
        }
        const inserted = data as ImmersionLog;
        logsRef.current = [inserted, ...logsRef.current];
        setLogs((prev) => [inserted, ...prev]);
        if (!silent) toast.success('Statistik Anki hari ini tersimpan ke log!');
      }
    },
    [user]
  );

  // Anki auto-sync loop (runs every 5 minutes when enabled)
  useEffect(() => {
    if (!user) return;

    const runAutoAnkiSync = async () => {
      if (!logsLoadedRef.current || ankiSyncInFlightRef.current) return;
      const settings = loadAnkiSettings();
      if (!settings.autoSync) return;

      ankiSyncInFlightRef.current = true;
      try {
        const proxyUrl = companionStatus?.ok ? companionSettings.url : undefined;
        const ankiStats = await fetchAnkiTodayStats(
          settings.url,
          settings,
          settings.secondsPerReview,
          proxyUrl
        );
        if (ankiStats.reviewsToday > 0 || ankiStats.newCardsToday > 0) {
          await handleSyncAnkiToday({
            deckLabel: ankiStats.selectedDeckLabel,
            durationMinutes: Math.max(1, ankiStats.actualMinutes),
            cardsMined: ankiStats.newCardsToday,
            reviewsToday: ankiStats.reviewsToday,
            notesAdded: ankiStats.notesAddedToday,
            cardsIntroduced: ankiStats.cardsIntroducedToday,
            usedExactTimer: ankiStats.usedExactTimer,
            silent: true,
          });
        }
      } catch {
        // Silent in background if Anki is closed
      } finally {
        ankiSyncInFlightRef.current = false;
      }
    };

    const timer = setInterval(() => {
      void runAutoAnkiSync();
    }, 5 * 60 * 1000);

    const onSettingsChanged = () => {
      const s = loadAnkiSettings();
      if (s.autoSync) {
        void runAutoAnkiSync();
      }
    };
    window.addEventListener('immersiontrack:anki-settings', onSettingsChanged);

    return () => {
      clearInterval(timer);
      window.removeEventListener('immersiontrack:anki-settings', onSettingsChanged);
    };
  }, [user, companionStatus?.ok, companionSettings.url, handleSyncAnkiToday]);

  const handleDeleteLog = async (id: string) => {
    const { error } = await supabase
      .from('immersion_logs')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Gagal menghapus sesi');
    } else {
      toast.success('Sesi dihapus');
      logsRef.current = logsRef.current.filter((l) => l.id !== id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleDeleteMultipleLogs = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('immersion_logs')
      .delete()
      .in('id', ids);
    if (error) {
      toast.error('Gagal menghapus sesi terpilih');
    } else {
      const idSet = new Set(ids);
      toast.success(`${ids.length} sesi berhasil dihapus`);
      logsRef.current = logsRef.current.filter((l) => !idSet.has(l.id));
      setLogs((prev) => prev.filter((l) => !idSet.has(l.id)));
    }
  };

  const handleAddGoal = (goalInput: Omit<CustomGoal, 'id'>) => {
    if (!user) return;
    const next = [...goals, { ...goalInput, id: `goal-${Date.now()}` }];
    saveUserGoals(user.id, next);
    setGoals(next);
    toast.success('Target baru ditambahkan!');
  };

  const handleDeleteGoal = (id: string) => {
    if (!user) return;
    const next = goals.filter((g) => g.id !== id);
    saveUserGoals(user.id, next);
    setGoals(next);
    toast.success('Target dihapus');
  };

  const avatarInitial = (
    profile?.full_name ||
    user?.email ||
    'U'
  )[0].toUpperCase();

  const companionConnected = Boolean(companionStatus?.ok);

  const renderDeltaBadge = (pct: number | null) => {
    if (pct === null) {
      return <span className="text-[11px] text-slate-400">Baru bulan ini</span>;
    }
    const positive = pct >= 0;
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
          positive ? 'text-emerald-600' : 'text-red-600'
        }`}
      >
        {positive ? '▲' : '▼'} {Math.abs(pct)}% vs bulan lalu
      </span>
    );
  };

  const activeProfileSnapshot = useMemo(() => {
    if (inspectedMemberId) {
      const comm = buildCommunityMemberSnapshot(inspectedMemberId);
      if (comm) return comm;
    }
    return buildPublicProfileSnapshot(ownExtProfile, logs);
  }, [inspectedMemberId, ownExtProfile, logs]);

  const handleSaveProfileMeta = async (updated: ExtendedUserProfile) => {
    if (!user) return { ok: false, error: 'Sesi tidak ditemukan' };
    const res = await saveExtendedProfileMeta(user.id, updated);
    if (res.ok) {
      setExtProfileOverride(updated);
      await refreshProfile();
    }
    return res;
  };

  const handleQuickChangeJlptLevel = async (level: JlptLevelSetting) => {
    const updated: ExtendedUserProfile = {
      ...ownExtProfile,
      jlpt_level: level,
    };
    setExtProfileOverride(updated);
    const res = await saveExtendedProfileMeta(user?.id ?? 'default', updated);
    if (res.ok) {
      toast.success(
        level === 'auto'
          ? 'Level JLPT diatur ke Otomatis (berdasarkan jam)'
          : `Level JLPT diatur ke ${level}`
      );
      await refreshProfile();
    } else {
      toast.error(res.error || 'Gagal menyimpan level JLPT');
    }
  };

  const navTabs: Array<{
    id: DashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    dot?: boolean;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'catalog', label: 'Katalog', icon: Compass },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'achievements', label: 'Achievements', icon: Award },
    { id: 'activity', label: 'Activity', icon: History },
    {
      id: 'devices',
      label: 'Devices',
      icon: MonitorSmartphone,
      dot: companionConnected,
    },
  ];

  return (
    <div className="min-h-screen app-bg-canvas text-slate-900">
      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/showcase" className="flex items-center gap-2.5 sm:gap-3 min-w-0 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center font-extrabold text-white shadow-sm shadow-rose-500/25 shrink-0">
              I
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base leading-tight text-slate-900 group-hover:text-rose-600 transition-colors truncate">
                  ImmersionTrack
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-mono text-rose-700 shrink-0">
                  {stats.stage.code}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 truncate">
                {profile?.target_language ?? 'Japanese'} •{' '}
                {stats.stage.label}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleDarkGlassTheme}
              title={
                isDarkTheme
                  ? 'Ganti ke Tema Terang (Glass)'
                  : 'Ganti ke Tema Gelap (Blur Transparan)'
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-[11px] font-bold text-slate-700 hover:text-rose-700 transition cursor-pointer"
            >
              {isDarkTheme ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Tema Gelap</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Tema Terang</span>
                </>
              )}
            </button>

            <WallpaperNavbarButton />

            <button
              type="button"
              onClick={() => setShortcutsModalOpen(true)}
              title="Buka Pintasan & Command Palette (Ctrl + K)"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-[11px] font-bold text-slate-700 hover:text-rose-700 transition cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-rose-600" />
              <span>Shortcuts</span>
              <kbd className="px-1.5 py-0.2 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-500">
                Ctrl+K
              </kbd>
            </button>

            <span
              title="Data tersinkron dengan akun cloud Supabase"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700"
            >
              <Cloud className="w-3.5 h-3.5" />
              Cloud Synced
            </span>

            <button
              type="button"
              onClick={() => openNewLogModal()}
              className="btn-crimson px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Catat Sesi</span>
              <span className="sm:hidden">Log</span>
            </button>

            <Link
              to="/settings"
              title="Pengaturan & Background"
              className="p-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-600 transition"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={() => {
                setInspectedMemberId(null);
                setActiveTab('profile');
              }}
              title="Buka & Edit Profil Publik Saya"
              className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 cursor-pointer group"
            >
              {ownExtProfile.avatar_url ? (
                <img
                  src={ownExtProfile.avatar_url}
                  alt={ownExtProfile.full_name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 group-hover:border-rose-500 transition"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 group-hover:bg-rose-600 group-hover:text-white flex items-center justify-center text-xs font-extrabold text-rose-700 transition">
                  {avatarInitial}
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={signOut}
              title="Keluar"
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 text-slate-600 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:hidden border-t border-slate-200/80 overflow-x-auto">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-1.5 min-w-max">
            {navTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.dot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex items-start">
        <LeftSidebarNavigation
          activeTab={activeTab}
          onSelectTab={(t) => setActiveTab(t)}
          companionConnected={companionConnected}
          onOpenCommandPalette={() => setShortcutsModalOpen(true)}
          onQuickLog={() => openNewLogModal()}
        />

        <main className="flex-1 min-w-0 max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-7 pb-[max(2.5rem,env(safe-area-inset-bottom))] space-y-5 sm:space-y-6">
        {loadingLogs ? (
          <div className="grid sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-pro h-40 animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'overview' ? (
          <div key="tab-overview" className="space-y-6 animate-tab-in">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-up">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 app-canvas-subtitle">
                  Ringkasan Progres
                </p>
                <h2 className="text-2xl font-extrabold text-slate-900 app-canvas-title mt-0.5">
                  {profile?.full_name || user?.email || 'Learner'}
                </h2>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => openNewLogModal()}
                  className="btn-crimson px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Catat Sesi
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Compass className="w-3.5 h-3.5 text-rose-600" />
                  Jelajahi Katalog
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('devices')}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <MonitorSmartphone
                    className={`w-3.5 h-3.5 ${
                      companionConnected ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  />
                  {companionConnected ? 'PC Terhubung' : 'Hubungkan Perangkat'}
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4 animate-fade-up delay-1">
              <div className="card-pro p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Level JLPT
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
                      {stats.stage.isManual ? 'Manual' : 'Auto'}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-rose-600">
                    <Award className="w-3.5 h-3.5" />
                    {stats.totalHours.toFixed(1)} jam
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1.5 gap-2">
                    <span className="text-lg sm:text-xl font-extrabold text-slate-900">
                      {stats.stage.label}
                    </span>
                    <span className="text-xs font-mono text-slate-500 shrink-0">
                      {stats.totalHours.toFixed(1)} / {stats.stage.nextTargetHours}j
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-rose-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full animate-bar"
                      style={{ width: `${stats.stage.progressPct}%` }}
                    />
                  </div>
                </div>

                {/* 1-Click JLPT Stage Selector */}
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      'N5',
                      'N4',
                      'N3',
                      'N2',
                      'N1',
                      'Native',
                      'auto',
                    ] as const
                  ).map((lvl) => {
                    const selected =
                      (ownExtProfile.jlpt_level ?? 'auto') === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => void handleQuickChangeJlptLevel(lvl)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition cursor-pointer ${
                          selected
                            ? 'bg-rose-600 border-rose-600 text-white shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600'
                        }`}
                      >
                        {lvl === 'auto' ? 'Auto' : lvl}
                      </button>
                    );
                  })}
                </div>

                {/* Clean 3-Track Immersion Distribution */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold uppercase tracking-wider text-slate-500">
                      Distribusi Input
                    </span>
                    <span className="font-mono font-semibold text-slate-600">
                      L/R: {stats.balance.inputListeningPct}% /{' '}
                      {stats.balance.inputReadingPct}%
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden flex">
                    {stats.balance.listeningPct > 0 && (
                      <div
                        className="h-full bg-sky-400 transition-all duration-500"
                        style={{ width: `${stats.balance.listeningPct}%` }}
                        title={`Listening ${stats.balance.listeningPct}%`}
                      />
                    )}
                    {stats.balance.readingPct > 0 && (
                      <div
                        className="h-full bg-indigo-400 transition-all duration-500"
                        style={{ width: `${stats.balance.readingPct}%` }}
                        title={`Reading ${stats.balance.readingPct}%`}
                      />
                    )}
                    {stats.balance.studyPct > 0 && (
                      <div
                        className="h-full bg-emerald-400 transition-all duration-500"
                        style={{ width: `${stats.balance.studyPct}%` }}
                        title={`Anki / Study ${stats.balance.studyPct}%`}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                        <span className="truncate">Listening</span>
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between gap-1 font-mono">
                        <span className="text-xs font-bold text-slate-900">
                          {(stats.balance.listeningMin / 60).toFixed(1)}j
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {stats.balance.listeningPct}%
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        <span className="truncate">Reading</span>
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between gap-1 font-mono">
                        <span className="text-xs font-bold text-slate-900">
                          {(stats.balance.readingMin / 60).toFixed(1)}j
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {stats.balance.readingPct}%
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="truncate">Anki/Study</span>
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between gap-1 font-mono">
                        <span className="text-xs font-bold text-slate-900">
                          {(stats.balance.studyMin / 60).toFixed(1)}j
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {stats.balance.studyPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-pro p-5 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Streak & Akumulasi
                  </span>
                  <Flame className="w-4 h-4 text-rose-600" />
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums">
                    {stats.streak} Hari
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Terbaik: {stats.longestStreak} hari
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs font-medium">
                  <div className="flex items-center gap-1.5 text-slate-900">
                    <Clock className="w-3.5 h-3.5 text-rose-600" />
                    <span className="font-mono">
                      {stats.totalHours.toFixed(1)}j
                    </span>
                    <span className="text-slate-500">total</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-900">
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono">
                      {stats.totalCards}
                    </span>
                    <span className="text-slate-500">kartu</span>
                  </div>
                </div>
              </div>

              <div className="card-pro p-5 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Target Hari Ini
                  </span>
                  <Target className="w-4 h-4 text-rose-600" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
                      {stats.todayMinutes}{' '}
                      <span className="text-sm font-semibold text-slate-500">
                        / {stats.dailyGoal} mnt
                      </span>
                    </span>
                    <span className="text-xs font-mono text-rose-600">
                      {stats.dailyProgress}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-rose-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full animate-bar"
                      style={{ width: `${stats.dailyProgress}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Milestone {stats.milestone.nextMilestone}j</span>
                  <span className="font-mono text-slate-900">
                    {Math.round(stats.milestone.progress)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="card-pro p-5 space-y-4 animate-fade-up delay-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Ringkasan Bulan Ini
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Rasio Input Listening : Reading ={' '}
                  <strong className="text-slate-900">
                    {stats.balance.ratioLabel}
                  </strong>
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Reading
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {(stats.monthly.thisMonth.readingMin / 60).toFixed(1)} jam
                  </div>
                  <div>{renderDeltaBadge(stats.monthly.deltas.readingPct)}</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Listening
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {(stats.monthly.thisMonth.listeningMin / 60).toFixed(1)} jam
                  </div>
                  <div>
                    {renderDeltaBadge(stats.monthly.deltas.listeningPct)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Total Bulan Ini
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {(stats.monthly.thisMonth.totalMin / 60).toFixed(1)} jam
                  </div>
                  <div>{renderDeltaBadge(stats.monthly.deltas.totalPct)}</div>
                </div>
              </div>
            </div>

            <div className="card-pro p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up delay-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 shrink-0">
                <Zap className="w-4 h-4 text-rose-600" />
                Catat Cepat 1-Klik:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_LOG_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      openNewLogModal({
                        title: preset.title,
                        category: preset.category,
                        duration: preset.duration,
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-rose-600 border border-slate-200 hover:border-rose-600 text-xs font-bold text-rose-700 hover:text-white transition cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="animate-fade-up delay-3">
              <LiveStopwatch
                companionUrl={companionSettings.url}
                companionStatus={companionStatus}
                onRefreshCompanion={handleManualRefreshCompanion}
                onImportPending={(items, notify) =>
                  importPendingSessions(items, notify ?? true)
                }
                onOpenDevicesTab={() => setActiveTab('devices')}
              />
            </div>

            {stats.recentMedia.length > 0 && (
              <div className="space-y-3 animate-fade-up delay-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 app-canvas-title">
                    Media yang Sedang Diikuti
                  </h3>
                  <p className="text-xs font-medium text-slate-500 app-canvas-subtitle">
                    Pilih media terakhir untuk langsung mencatat sesi lanjutan.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {stats.recentMedia.map((media) => {
                    const meta = getCategoryMeta(media.category);
                    const mediaDest =
                      media.category !== 'study'
                        ? getCatalogMediaDestinations({
                            title: media.title,
                            category: media.category,
                          })
                        : null;
                    return (
                      <div
                        key={`${media.title}-${media.category}`}
                        className="card-pro-interactive p-3.5 text-left flex items-center gap-3.5 group"
                      >
                        <MediaCover
                          title={media.title}
                          category={media.category}
                          className="w-14 h-20 rounded-xl"
                        />

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              {meta.shortLabel}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              • {media.sessions} sesi
                            </span>
                          </div>
                          <div className="font-bold text-sm text-slate-900 truncate">
                            {media.title}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {(media.totalMinutes / 60).toFixed(1)} jam •{' '}
                            {media.sessions} sesi
                            {media.totalCards > 0
                              ? ` • +${media.totalCards} kartu`
                              : ''}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {mediaDest && (
                            <button
                              type="button"
                              onClick={() => {
                                setInitialCatalogTitle(media.title);
                                setActiveTab('catalog');
                              }}
                              title="Buka tampilan detail & timeline"
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-700 hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Timeline
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              openNewLogModal({
                                title: media.title,
                                category: media.category,
                                duration: 30,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-600 hover:border-rose-600 hover:text-white text-xs font-bold text-rose-700 transition cursor-pointer"
                          >
                            + Log
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="animate-fade-up delay-5">
              <ActivityHeatmap logs={logs} dailyGoal={stats.dailyGoal} />
            </div>

            <div className="card-pro p-5 space-y-4 animate-fade-up delay-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-rose-600" />
                  <h3 className="font-extrabold text-slate-900">
                    Peringkat Komunitas
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Posisi Anda: #
                  {rankedLeaderboard.findIndex((item) => item.isSelf) + 1} dari{' '}
                  {rankedLeaderboard.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {rankedLeaderboard.map((member, idx) => (
                  <div
                    key={member.id}
                    className={`py-2.5 px-3 rounded-xl flex items-center justify-between gap-3 ${
                      member.isSelf
                        ? 'bg-rose-50/80 border border-rose-200 my-1'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono shrink-0 ${
                          member.isSelf || idx === 0
                            ? 'bg-gradient-to-br from-rose-600 to-rose-500 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {member.name}
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 truncate">
                          {member.rankTitle} • {member.favoriteMedia}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-mono text-slate-900">
                          {member.totalHours.toLocaleString('id-ID')} j
                        </div>
                        <div className="text-[11px] font-mono text-rose-600 inline-flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {member.streak}h
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setInspectedMemberId(
                            member.isSelf ? null : member.id
                          );
                          setActiveTab('profile');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-600 hover:text-white border border-slate-200 text-xs font-bold text-rose-600 transition cursor-pointer"
                      >
                        {member.isSelf ? 'Profil Saya' : 'Cek Profil'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ActivityLogList
              logs={logs}
              compact
              onEdit={openEditLogModal}
              onDelete={handleDeleteLog}
              onViewAll={() => setActiveTab('activity')}
            />
          </div>
        ) : activeTab === 'profile' ? (
          <div key="tab-profile" className="space-y-4 animate-tab-in">
            {inspectedMemberId && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-rose-900">
                  Menampilkan Dashboard Profil Publik:{' '}
                  <strong>{activeProfileSnapshot.profile.full_name}</strong> (@
                  {activeProfileSnapshot.profile.username})
                </span>
                <button
                  type="button"
                  onClick={() => setInspectedMemberId(null)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  Kembali ke Profil Saya
                </button>
              </div>
            )}

            <ProfileDashboardSection
              snapshot={activeProfileSnapshot}
              logs={inspectedMemberId ? undefined : logs}
              isOwnProfile={!inspectedMemberId}
              onSaveProfile={handleSaveProfileMeta}
              onInspectMember={(memberId) => setInspectedMemberId(memberId)}
            />
          </div>
        ) : activeTab === 'catalog' ? (
          <div key="tab-catalog" className="space-y-4 animate-tab-in">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 app-canvas-title">
                  Katalog 1.130+ Media & Live Search Semua Judul
                </h2>
                <p className="text-xs font-medium text-slate-500 app-canvas-subtitle mt-0.5">
                  Anime Bettermelon lengkap dengan level bahasa JLPT, Novel Yatsu
                  Reader, Manga, Visual Novel, Game, Drama Cinejoy, YouTube, &
                  Podcast — ketik judul apa saja untuk langsung buka.
                </p>
              </div>
              {!searchParams.get('media') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="lg:hidden px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  ← Overview
                </button>
              )}
            </div>
            <MediaCatalogBrowser
              defaultSection="Semua"
              pageSize={12}
              initialSelectedTitle={initialCatalogTitle}
              onClearInitialSelected={() => setInitialCatalogTitle(null)}
              onBackToOverview={() => setActiveTab('overview')}
              onStartMedia={(title, category, suggestedMinutes) =>
                openNewLogModal({
                  title,
                  category,
                  duration: suggestedMinutes,
                })
              }
            />
          </div>
        ) : activeTab === 'stats' ? (
          <div key="tab-stats" className="animate-tab-in">
            <ChartsSection logs={logs} />
          </div>
        ) : activeTab === 'goals' ? (
          <div key="tab-goals" className="animate-tab-in">
            <GoalsSection
              logs={logs}
              dailyGoal={stats.dailyGoal}
              goals={goals}
              onAddGoal={handleAddGoal}
              onDeleteGoal={handleDeleteGoal}
            />
          </div>
        ) : activeTab === 'achievements' ? (
          <div key="tab-achievements" className="animate-tab-in">
            <AchievementsSection logs={logs} />
          </div>
        ) : activeTab === 'devices' ? (
          <div key="tab-devices" className="animate-tab-in">
            <DevicesSection
              companionUrl={companionSettings.url}
              onChangeCompanionUrl={(url) => updateCompanionSettings({ url })}
              companionAutoSync={companionSettings.autoSync}
              onToggleCompanionAutoSync={(autoSync) =>
                updateCompanionSettings({ autoSync })
              }
              companionStatus={companionStatus}
              companionChecking={companionChecking}
              onRefreshCompanion={handleManualRefreshCompanion}
              onImportPending={(items) => importPendingSessions(items, false)}
              onSyncAnkiToday={handleSyncAnkiToday}
            />
          </div>
        ) : (
          <div key="tab-activity" className="animate-tab-in">
            <ActivityLogList
              logs={logs}
              onEdit={openEditLogModal}
              onDelete={handleDeleteLog}
              onDeleteMultiple={handleDeleteMultipleLogs}
            />
          </div>
        )}
        </main>
      </div>

      <LogModal
        key={modalKey}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingLog(null);
        }}
        onSubmit={handleSaveLog}
        editingLog={editingLog}
        initialDuration={prefillDuration}
        initialTitle={prefillTitle}
        initialCategory={prefillCategory}
      />

      <ShortcutsHubModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        onJumpTab={(t) => setActiveTab(t)}
        onQuickLog={() => openNewLogModal()}
        onSelectCatalogTitle={(title) => {
          setInitialCatalogTitle(title);
          setActiveTab('catalog');
        }}
      />
    </div>
  );
};
