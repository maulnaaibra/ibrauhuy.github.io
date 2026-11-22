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
  Plus,
  Settings,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { getCatalogMediaDestinations } from '../lib/mediaLinks';
import { COMMUNITY_LEADERBOARD } from '../lib/publicShowcase';
import { loadUserGoals, saveUserGoals } from '../lib/demoData';
import {
  ackCompanionSessions,
  fetchCompanionStatus,
  loadCompanionSettings,
  saveCompanionSettings,
  type CompanionSettings,
  type CompanionStatus,
  type PendingTrackedSession,
} from '../lib/companionClient';
import { MediaCover } from '../components/MediaCover';
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

type DashboardTab =
  | 'overview'
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

export const DashboardPage: React.FC = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
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

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
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
        setLogs((data as ImmersionLog[]) ?? []);
      }
      setGoals(loadUserGoals(user.id));
      setLoadingLogs(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [user]);

  const importPendingSessions = useCallback(
    async (sessions: PendingTrackedSession[], notify = true) => {
      if (!user || sessions.length === 0) return;

      const freshSessions = sessions.filter(
        (s) => !importedPendingIdsRef.current.has(s.id)
      );
      if (freshSessions.length === 0) return;

      freshSessions.forEach((s) => importedPendingIdsRef.current.add(s.id));

      const rows = freshSessions.map((s) => ({
        user_id: user.id,
        title: s.title,
        category: s.category,
        duration_minutes: s.duration_minutes,
        cards_mined: s.cards_mined,
        notes: s.notes,
        logged_date: s.logged_date,
      }));
      const { data, error } = await supabase
        .from('immersion_logs')
        .insert(rows)
        .select();

      if (error) {
        freshSessions.forEach((s) =>
          importedPendingIdsRef.current.delete(s.id)
        );
        toast.error('Gagal menyimpan sesi otomatis dari PC');
        return;
      }
      if (data) {
        setLogs((prev) => [...(data as ImmersionLog[]), ...prev]);
      }

      try {
        await ackCompanionSessions(
          companionSettings.url,
          freshSessions.map((s) => s.id)
        );
      } catch {
        // ignore ack failure
      }

      if (notify) {
        if (freshSessions.length === 1) {
          toast.success(
            `Auto-logged dari PC: ${freshSessions[0].title} (${freshSessions[0].duration_minutes}m)`
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
    const status = await fetchCompanionStatus(companionSettings.url);
    setCompanionStatus(status);
    if (
      status?.ok &&
      companionSettings.autoSync &&
      status.pending.length > 0
    ) {
      await importPendingSessions(status.pending, true);
      const updated = await fetchCompanionStatus(companionSettings.url);
      if (updated) setCompanionStatus(updated);
    }
  }, [companionSettings.url, companionSettings.autoSync, importPendingSessions]);

  useEffect(() => {
    if (!user) return;
    void pollCompanion();
    const timer = setInterval(() => {
      void pollCompanion();
    }, 8000);
    return () => clearInterval(timer);
  }, [user, pollCompanion]);

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

      setSearchParams({}, { replace: true });
    }, 0);

    return () => clearTimeout(timer);
  }, [user, searchParams, setSearchParams, refreshProfile]);

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
    const stage = getImmersionStage(totalHours);
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
  }, [logs, profile]);

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

  const handleSyncAnkiToday = async ({
    deckName,
    durationMinutes,
    cardsMined,
    reviewsToday,
  }: {
    deckName: string;
    durationMinutes: number;
    cardsMined: number;
    reviewsToday: number;
  }) => {
    if (!user) return;
    const todayStr = getLocalDateString();
    const title = deckName === 'all' ? 'Anki Review' : `Anki — ${deckName}`;
    const notes = `AnkiConnect sync: ${reviewsToday} review, +${cardsMined} kartu baru`;

    const existingToday = logs.find(
      (l) =>
        l.logged_date === todayStr &&
        l.category === 'study' &&
        l.title.startsWith('Anki')
    );

    if (existingToday) {
      const { data, error } = await supabase
        .from('immersion_logs')
        .update({
          title,
          duration_minutes: durationMinutes,
          cards_mined: cardsMined,
          notes,
        })
        .eq('id', existingToday.id)
        .select()
        .single();

      if (error) {
        toast.error('Gagal memperbarui log Anki');
        return;
      }
      setLogs((prev) =>
        prev.map((l) =>
          l.id === existingToday.id ? (data as ImmersionLog) : l
        )
      );
      toast.success('Log Anki hari ini diperbarui!');
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
        toast.error('Gagal menyimpan log Anki');
        return;
      }
      setLogs((prev) => [data as ImmersionLog, ...prev]);
      toast.success('Statistik Anki hari ini tersimpan ke log!');
    }
  };

  const handleDeleteLog = async (id: string) => {
    const { error } = await supabase
      .from('immersion_logs')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Gagal menghapus sesi');
    } else {
      toast.success('Sesi dihapus');
      setLogs((prev) => prev.filter((l) => l.id !== id));
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

  const navTabs: Array<{
    id: DashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    dot?: boolean;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
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
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/showcase" className="flex items-center gap-3 shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center font-extrabold text-white shadow-sm shadow-rose-500/25">
              I
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base leading-tight text-slate-900 group-hover:text-rose-600 transition-colors">
                  ImmersionTrack
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-mono text-rose-700">
                  {stats.stage.code}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500">
                {profile?.target_language ?? 'Japanese'} •{' '}
                {stats.stage.label}
              </p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            {navTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
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
          </nav>

          <div className="flex items-center gap-2 shrink-0">
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

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name ?? 'User'}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-xs font-extrabold text-rose-700">
                  {avatarInitial}
                </div>
              )}
            </div>

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

        <div className="lg:hidden border-t border-slate-200/80 overflow-x-auto bg-white">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1.5 min-w-max">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-7 space-y-6">
        {companionConnected && companionStatus?.activeSession && (
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className="w-full px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-left hover:bg-emerald-100/70 transition cursor-pointer animate-fade-in"
          >
            <span className="flex items-center gap-2 text-emerald-900 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>
                <strong>PC Tracker aktif merekam:</strong>{' '}
                {companionStatus.activeSession.title} (
                {Math.floor(companionStatus.activeSession.activeSeconds / 60)}m{' '}
                {companionStatus.activeSession.activeSeconds % 60}d)
              </span>
            </span>
            <span className="text-emerald-700 font-semibold shrink-0">
              Kelola →
            </span>
          </button>
        )}

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
              <div className="card-pro p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Tahap Kemahiran (JLPT)
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-rose-600">
                    <Award className="w-3.5 h-3.5" />
                    {stats.totalHours.toFixed(1)} jam
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xl font-extrabold text-slate-900">
                      {stats.stage.label}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
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

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>Listening</span>
                      <span className="font-mono text-slate-900">
                        {(stats.balance.listeningMin / 60).toFixed(1)}j
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-rose-600 rounded-full animate-bar"
                        style={{
                          width: `${stats.balance.listeningPct}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>Reading</span>
                      <span className="font-mono text-slate-900">
                        {(stats.balance.readingMin / 60).toFixed(1)}j
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-rose-400 rounded-full animate-bar"
                        style={{
                          width: `${stats.balance.readingPct}%`,
                        }}
                      />
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
                  Rasio Reading : Listening ={' '}
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
                onSaveDuration={({ minutes, category, title }) => {
                  openNewLogModal({
                    duration: minutes,
                    category,
                    title,
                  });
                }}
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
                            <a
                              href={mediaDest.primary.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                try {
                                  void navigator.clipboard?.writeText(
                                    media.title
                                  );
                                } catch {
                                  // ignore clipboard error
                                }
                                toast.success(
                                  `Membuka ${mediaDest.primary.siteName} (${media.title})`
                                );
                              }}
                              title={mediaDest.primary.label}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-700 hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {mediaDest.primary.shortLabel}
                            </a>
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

                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono text-slate-900">
                        {member.totalHours.toLocaleString('id-ID')} j
                      </div>
                      <div className="text-[11px] font-mono text-rose-600 inline-flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        {member.streak}h
                      </div>
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
        ) : activeTab === 'catalog' ? (
          <div key="tab-catalog" className="space-y-4 animate-tab-in">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 app-canvas-title">
                Katalog 660+ Media Immersion
              </h2>
              <p className="text-xs font-medium text-slate-500 app-canvas-subtitle mt-0.5">
                Pilih novel, anime, manga, visual novel, game, YouTube, atau
                podcast lalu langsung catat sesinya.
              </p>
            </div>
            <MediaCatalogBrowser
              defaultSection="Semua"
              pageSize={12}
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
            />
          </div>
        )}
      </main>

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
    </div>
  );
};
