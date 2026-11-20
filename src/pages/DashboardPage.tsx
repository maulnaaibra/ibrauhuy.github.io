import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  Clock,
  Flame,
  History,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  clearDemoLogs,
  DEMO_USER_ID,
  loadDemoLogs,
  loadUserGoals,
  resetDemoLogs,
  saveDemoLogs,
  saveUserGoals,
} from '../lib/demoData';
import {
  ackCompanionSessions,
  fetchCompanionStatus,
  loadCompanionSettings,
  saveCompanionSettings,
  type CompanionSettings,
  type CompanionStatus,
  type PendingTrackedSession,
} from '../lib/companionClient';
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
  getLocalDateString,
  getMilestoneProgress,
  getMonthlyComparison,
  getReadingListeningBalance,
  getRecentMediaCards,
  getSkillLevels,
} from '../utils/stats';
import { LiveStopwatch } from '../components/LiveStopwatch';
import { LogModal } from '../components/LogModal';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { ChartsSection } from '../components/ChartsSection';
import { GoalsSection } from '../components/GoalsSection';
import { AchievementsSection } from '../components/AchievementsSection';
import { ActivityLogList } from '../components/ActivityLogList';
import { DevicesSection } from '../components/DevicesSection';

type DashboardTab =
  | 'overview'
  | 'stats'
  | 'goals'
  | 'achievements'
  | 'activity'
  | 'devices';

export const DashboardPage: React.FC = () => {
  const { user, profile, isDemoMode, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [logs, setLogs] = useState<ImmersionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [goals, setGoals] = useState<CustomGoal[]>(() =>
    loadUserGoals(user?.id ?? DEMO_USER_ID)
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
      if (isDemoMode) {
        if (active) {
          setLogs(loadDemoLogs());
          setGoals(loadUserGoals(user.id));
          setLoadingLogs(false);
        }
        return;
      }

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
  }, [user, isDemoMode]);

  const importPendingSessions = useCallback(
    async (sessions: PendingTrackedSession[], notify = true) => {
      if (!user || sessions.length === 0) return;

      const freshSessions = sessions.filter(
        (s) => !importedPendingIdsRef.current.has(s.id)
      );
      if (freshSessions.length === 0) return;

      freshSessions.forEach((s) => importedPendingIdsRef.current.add(s.id));

      if (isDemoMode) {
        const mapped: ImmersionLog[] = freshSessions.map((s) => ({
          id: s.id,
          user_id: user.id,
          title: s.title,
          category: s.category,
          duration_minutes: s.duration_minutes,
          cards_mined: s.cards_mined,
          notes: s.notes,
          logged_date: s.logged_date,
          created_at: s.created_at,
        }));

        setLogs((prev) => {
          const existingIds = new Set(prev.map((l) => l.id));
          const unique = mapped.filter((m) => !existingIds.has(m.id));
          const next = [...unique, ...prev];
          saveDemoLogs(next);
          return next;
        });
      } else {
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
      }

      try {
        await ackCompanionSessions(
          companionSettings.url,
          freshSessions.map((s) => s.id)
        );
      } catch {
        // ignore ack failure; ref protects against double-import in session
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
    [user, isDemoMode, companionSettings.url]
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
    const skills = getSkillLevels(logs);
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
      skills,
      monthly,
      balance,
      recentMedia,
    };
  }, [logs, profile]);

  const handleSaveLog = async (payload: {
    title: string;
    category: ImmersionCategory;
    duration_minutes: number;
    cards_mined: number;
    notes: string;
    logged_date: string;
  }) => {
    if (!user) return;

    if (isDemoMode) {
      if (editingLog) {
        const updated = logs.map((l) =>
          l.id === editingLog.id ? { ...l, ...payload } : l
        );
        saveDemoLogs(updated);
        setLogs(updated);
        toast.success('Sesi diperbarui (Mode Demo)');
      } else {
        const created: ImmersionLog = {
          id: `demo-${Date.now()}`,
          user_id: user.id,
          ...payload,
          created_at: new Date().toISOString(),
        };
        const updated = [created, ...logs];
        saveDemoLogs(updated);
        setLogs(updated);
        toast.success('Sesi berhasil dicatat!');
      }
      setEditingLog(null);
      return;
    }

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

    if (isDemoMode) {
      if (existingToday) {
        const updated = logs.map((l) =>
          l.id === existingToday.id
            ? {
                ...l,
                title,
                duration_minutes: durationMinutes,
                cards_mined: cardsMined,
                notes,
              }
            : l
        );
        saveDemoLogs(updated);
        setLogs(updated);
        toast.success('Log Anki hari ini diperbarui!');
      } else {
        const created: ImmersionLog = {
          id: `anki-${Date.now()}`,
          user_id: user.id,
          title,
          category: 'study',
          duration_minutes: durationMinutes,
          cards_mined: cardsMined,
          notes,
          logged_date: todayStr,
          created_at: new Date().toISOString(),
        };
        const updated = [created, ...logs];
        saveDemoLogs(updated);
        setLogs(updated);
        toast.success('Statistik Anki hari ini tersimpan ke log!');
      }
      return;
    }

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
    if (isDemoMode) {
      const updated = logs.filter((l) => l.id !== id);
      saveDemoLogs(updated);
      setLogs(updated);
      toast.success('Sesi dihapus');
      return;
    }

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
      return <span className="text-[11px] text-slate-500">Baru bulan ini</span>;
    }
    const positive = pct >= 0;
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          positive
            ? 'bg-emerald-500/15 text-emerald-300'
            : 'bg-rose-500/15 text-rose-300'
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
    <div className="min-h-screen bg-[#0e1218] text-slate-100">
      <header className="sticky top-0 z-30 bg-[#0e1218]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white">
              I
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base leading-tight">
                  ImmersionTrack
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-mono font-semibold text-indigo-300">
                  Lv.{stats.skills.overall.level}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {profile?.target_language ?? 'Japanese'} •{' '}
                {stats.skills.overall.rankTitle}
              </p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-[#171c26] p-1 rounded-xl border border-white/[0.07]">
            {navTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
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
            <button
              type="button"
              onClick={() => openNewLogModal()}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Catat Sesi</span>
              <span className="sm:hidden">Log</span>
            </button>

            <Link
              to="/settings"
              title="Pengaturan"
              className="p-2 rounded-xl bg-[#171c26] border border-white/[0.08] hover:border-white/[0.2] text-slate-300 transition"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/[0.08]">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name ?? 'User'}
                  className="w-8 h-8 rounded-full object-cover border border-white/[0.15]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-pink-500/30 border border-white/[0.12] flex items-center justify-center text-xs font-bold text-white">
                  {avatarInitial}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={signOut}
              title="Keluar"
              className="p-2 rounded-xl bg-[#171c26] border border-white/[0.08] hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 text-slate-400 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:hidden border-t border-white/[0.06] overflow-x-auto">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1.5 min-w-max">
            {navTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#171c26] text-slate-400 hover:text-white border border-white/[0.06]'
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {isDemoMode && (
          <div className="px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-indigo-200">
              <strong>Mode Demo Lokal:</strong> semua catatan tersimpan otomatis
              di browser Anda.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLogs(resetDemoLogs());
                  toast.success('Data contoh demo dipulihkan');
                }}
                className="px-2.5 py-1 rounded-lg bg-[#171c26] border border-white/[0.1] hover:text-white text-slate-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Demo
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogs(clearDemoLogs());
                  toast.success('Riwayat dikosongkan — siap mulai dari 0!');
                }}
                className="px-2.5 py-1 rounded-lg bg-[#171c26] border border-white/[0.1] hover:text-rose-300 text-slate-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Mulai Kosong
              </button>
            </div>
          </div>
        )}

        {companionConnected && companionStatus?.activeSession && (
          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            className="w-full px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 text-xs text-left hover:bg-emerald-500/15 transition cursor-pointer"
          >
            <span className="flex items-center gap-2 text-emerald-200 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>
                <strong>PC Companion aktif merekam:</strong>{' '}
                {companionStatus.activeSession.title} (
                {Math.floor(companionStatus.activeSession.activeSeconds / 60)}m{' '}
                {companionStatus.activeSession.activeSeconds % 60}d)
              </span>
            </span>
            <span className="text-emerald-300 font-semibold shrink-0">
              Kelola →
            </span>
          </button>
        )}

        {loadingLogs ? (
          <div className="grid sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-2xl bg-[#171c26] border border-white/[0.08] animate-pulse"
              />
            ))}
          </div>
        ) : activeTab === 'overview' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  Welcome back
                </p>
                <h2 className="text-2xl font-bold text-white mt-0.5">
                  {profile?.full_name || user?.email || 'Learner'}
                </h2>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => openNewLogModal()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />+ Create Log
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('devices')}
                  className="px-3.5 py-2 rounded-xl bg-[#171c26] border border-white/[0.08] hover:border-white/[0.2] text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <MonitorSmartphone
                    className={`w-3.5 h-3.5 ${
                      companionConnected ? 'text-emerald-400' : 'text-indigo-400'
                    }`}
                  />
                  {companionConnected ? 'PC Terhubung' : 'Connect Device'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className="px-3.5 py-2 rounded-xl bg-[#171c26] border border-white/[0.08] hover:border-white/[0.2] text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  Stats
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('goals')}
                  className="px-3.5 py-2 rounded-xl bg-[#171c26] border border-white/[0.08] hover:border-white/[0.2] text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  Goals
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Progress & RPG Level
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-indigo-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    {stats.skills.overall.totalXp.toLocaleString()} XP
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-2xl font-bold text-white">
                      Level {stats.skills.overall.level}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {stats.skills.overall.currentLevelXp} /{' '}
                      {stats.skills.overall.nextLevelXp} XP
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#11151c] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 rounded-full transition-all"
                      style={{ width: `${stats.skills.overall.progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-xl bg-[#11151c] border border-white/[0.05]">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Listening</span>
                      <span className="font-mono text-cyan-300 font-semibold">
                        Lv.{stats.skills.listening.level}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-cyan-400 rounded-full"
                        style={{
                          width: `${stats.skills.listening.progressPct}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#11151c] border border-white/[0.05]">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Reading</span>
                      <span className="font-mono text-violet-300 font-semibold">
                        Lv.{stats.skills.reading.level}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-violet-400 rounded-full"
                        style={{
                          width: `${stats.skills.reading.progressPct}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-pink-500/10 via-[#171c26] to-[#171c26] border border-pink-500/20 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-pink-300">
                    Streak & Akumulasi
                  </span>
                  <Flame className="w-5 h-5 text-pink-400" />
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold font-mono text-white tabular-nums">
                    {stats.streak} Hari
                  </span>
                  <span className="text-xs text-slate-400">
                    (Terbaik: {stats.longestStreak} hari)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-mono font-semibold">
                      {stats.totalHours.toFixed(1)}j
                    </span>
                    <span className="text-slate-500">total</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <BookOpen className="w-3.5 h-3.5 text-pink-400" />
                    <span className="font-mono font-semibold">
                      {stats.totalCards}
                    </span>
                    <span className="text-slate-500">kartu</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-[#171c26] to-[#171c26] border border-emerald-500/20 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                    Target Hari Ini
                  </span>
                  <Target className="w-5 h-5 text-emerald-400" />
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-2xl font-bold font-mono text-white tabular-nums">
                      {stats.todayMinutes}{' '}
                      <span className="text-sm font-normal text-slate-400">
                        / {stats.dailyGoal} mnt
                      </span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-emerald-300">
                      {stats.dailyProgress}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#11151c] overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${stats.dailyProgress}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
                  <span>Milestone {stats.milestone.nextMilestone}j</span>
                  <span className="font-mono text-slate-200">
                    {Math.round(stats.milestone.progress)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Progres Bulan Ini vs Bulan Lalu
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Rasio Reading : Listening ={' '}
                  <strong className="text-slate-200">
                    {stats.balance.ratioLabel}
                  </strong>
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#11151c] border border-white/[0.06] space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-400">
                    Reading
                  </div>
                  <div className="text-2xl font-bold font-mono text-white tabular-nums">
                    {(stats.monthly.thisMonth.readingMin / 60).toFixed(1)} jam
                  </div>
                  <div>{renderDeltaBadge(stats.monthly.deltas.readingPct)}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#11151c] border border-white/[0.06] space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                    Listening
                  </div>
                  <div className="text-2xl font-bold font-mono text-white tabular-nums">
                    {(stats.monthly.thisMonth.listeningMin / 60).toFixed(1)} jam
                  </div>
                  <div>
                    {renderDeltaBadge(stats.monthly.deltas.listeningPct)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#11151c] border border-white/[0.06] space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                    Total Bulan Ini
                  </div>
                  <div className="text-2xl font-bold font-mono text-white tabular-nums">
                    {(stats.monthly.thisMonth.totalMin / 60).toFixed(1)} jam
                  </div>
                  <div>{renderDeltaBadge(stats.monthly.deltas.totalPct)}</div>
                </div>
              </div>
            </div>

            <LiveStopwatch
              onSaveDuration={({ minutes, category, title }) => {
                openNewLogModal({
                  duration: minutes,
                  category,
                  title,
                });
              }}
            />

            {stats.recentMedia.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-100">
                      Quick-Log Media Terakhir
                    </h3>
                    <p className="text-xs text-slate-400">
                      Klik satu kali untuk mencatat sesi lanjutan dari media
                      yang sedang kamu ikuti.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stats.recentMedia.map((media) => {
                    const meta = getCategoryMeta(media.category);
                    return (
                      <button
                        key={`${media.title}-${media.category}`}
                        type="button"
                        onClick={() =>
                          openNewLogModal({
                            title: media.title,
                            category: media.category,
                            duration: 30,
                          })
                        }
                        className={`p-4 rounded-2xl bg-[#171c26] bg-gradient-to-br ${meta.gradientClass} border border-white/[0.08] hover:border-white/[0.22] text-left flex items-center justify-between gap-3 transition group cursor-pointer`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              {meta.shortLabel}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              • {media.sessions} sesi
                            </span>
                          </div>
                          <div className="font-semibold text-sm text-white truncate">
                            {media.title}
                          </div>
                          <div className="text-xs font-mono text-slate-400">
                            {(media.totalMinutes / 60).toFixed(1)} jam •{' '}
                            {media.totalXp} XP
                          </div>
                        </div>

                        <span className="px-2.5 py-1.5 rounded-xl bg-[#11151c] border border-white/[0.1] group-hover:bg-indigo-600 group-hover:border-indigo-500 group-hover:text-white text-xs font-semibold text-indigo-300 transition shrink-0">
                          + Log
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <ActivityHeatmap logs={logs} dailyGoal={stats.dailyGoal} />

            <ActivityLogList
              logs={logs}
              compact
              onEdit={openEditLogModal}
              onDelete={handleDeleteLog}
              onViewAll={() => setActiveTab('activity')}
            />
          </div>
        ) : activeTab === 'stats' ? (
          <ChartsSection logs={logs} />
        ) : activeTab === 'goals' ? (
          <GoalsSection
            logs={logs}
            dailyGoal={stats.dailyGoal}
            goals={goals}
            onAddGoal={handleAddGoal}
            onDeleteGoal={handleDeleteGoal}
          />
        ) : activeTab === 'achievements' ? (
          <AchievementsSection logs={logs} />
        ) : activeTab === 'devices' ? (
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
        ) : (
          <ActivityLogList
            logs={logs}
            onEdit={openEditLogModal}
            onDelete={handleDeleteLog}
          />
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
