import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BarChart3,
  History,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  Plus,
  Settings,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  DEMO_USER_ID,
  loadDemoLogs,
  loadUserGoals,
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
  | 'activity'
  | 'stats'
  | 'goals'
  | 'achievements'
  | 'devices';

const TAB_HEADINGS: Record<DashboardTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'Ringkasan',
    subtitle: 'Catat sesi dan pantau progres harianmu.',
  },
  activity: {
    title: 'Riwayat',
    subtitle: 'Cari, filter, atau ubah seluruh catatan immersion.',
  },
  stats: {
    title: 'Statistik',
    subtitle: 'Tren durasi, distribusi media, dan peta milestone.',
  },
  goals: {
    title: 'Target',
    subtitle: 'Target harian dan proyeksi penyelesaian jangka panjang.',
  },
  achievements: {
    title: 'Pencapaian',
    subtitle: 'Tonggak konsistensi berdasarkan akumulasi immersion.',
  },
  devices: {
    title: 'Perangkat',
    subtitle: 'Hubungkan Windows Companion Agent, AnkiConnect, dan HP.',
  },
};

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
        toast.success('Sesi diperbarui');
      } else {
        const created: ImmersionLog = {
          id: `log-${Date.now()}`,
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

  const displayName = profile?.full_name || user?.email || 'Learner';
  const avatarInitial = displayName[0].toUpperCase();
  const companionConnected = Boolean(companionStatus?.ok);

  const renderDeltaText = (pct: number | null) => {
    if (pct === null) {
      return <span className="text-xs text-[#6c727f]">Baru bulan ini</span>;
    }
    const positive = pct >= 0;
    return (
      <span
        className={`text-xs font-mono tabular-nums ${
          positive ? 'text-[#5cd697]' : 'text-[#e57373]'
        }`}
      >
        {positive ? '+' : '-'}
        {Math.abs(pct)}% vs bulan lalu
      </span>
    );
  };

  const navTabs: Array<{
    id: DashboardTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    dot?: boolean;
  }> = [
    {
      id: 'overview',
      label: 'Ringkasan',
      shortLabel: 'Home',
      icon: LayoutDashboard,
    },
    { id: 'activity', label: 'Riwayat', shortLabel: 'Riwayat', icon: History },
    { id: 'stats', label: 'Statistik', shortLabel: 'Stats', icon: BarChart3 },
    { id: 'goals', label: 'Target', shortLabel: 'Target', icon: Target },
    {
      id: 'achievements',
      label: 'Pencapaian',
      shortLabel: 'Lencana',
      icon: Award,
    },
    {
      id: 'devices',
      label: 'Perangkat',
      shortLabel: 'PC/HP',
      icon: MonitorSmartphone,
      dot: companionConnected,
    },
  ];

  const currentHeading = TAB_HEADINGS[activeTab];

  return (
    <div className="min-h-screen bg-[#0e0f11] text-[#ededef] flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 sticky top-0 h-screen flex-col bg-[#121316] border-r border-[#242730]">
        <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#1b1e23] border border-[#2c303a] flex items-center justify-center font-semibold text-xs text-[#ededef]">
            I
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#ededef] leading-tight truncate">
              ImmersionTrack
            </div>
            <div className="text-[11px] text-[#6c727f] truncate">
              {profile?.target_language ?? 'Japanese'}
            </div>
          </div>
        </div>

        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={() => openNewLogModal()}
            className="btn-primary w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Catat Sesi
          </button>
        </div>

        <nav aria-label="Navigasi utama" className="px-2.5 flex-1 space-y-0.5">
          {navTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1f222a] text-[#ededef] font-medium'
                    : 'text-[#9aa0ac] hover:text-[#ededef] hover:bg-[#191b21]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <tab.icon
                    className={`w-4 h-4 ${
                      active ? 'text-[#ededef]' : 'text-[#6c727f]'
                    }`}
                  />
                  {tab.label}
                </span>
                {tab.dot && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#2eb872]"
                    title="PC Terhubung"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar profile & footer actions */}
        <div className="mt-auto p-3 border-t border-[#242730] space-y-2">
          <div className="flex items-center gap-2.5 px-1.5 py-1">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="w-7 h-7 rounded-full object-cover border border-[#2c303a]"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#1b1e23] border border-[#2c303a] flex items-center justify-center text-xs font-semibold text-[#ededef] shrink-0">
                {avatarInitial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-[#ededef] truncate">
                {displayName}
              </div>
              <div className="text-[11px] text-[#6c727f] truncate font-mono">
                Lv.{stats.skills.overall.level} · {stats.skills.overall.rankTitle}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Link
              to="/settings"
              className="px-2.5 py-1.5 rounded-md bg-[#16181c] border border-[#242730] hover:border-[#313540] text-xs text-[#9aa0ac] hover:text-[#ededef] flex items-center justify-center gap-1.5 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Setelan
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="px-2.5 py-1.5 rounded-md bg-[#16181c] border border-[#242730] hover:border-[#3f262a] text-xs text-[#9aa0ac] hover:text-[#e57373] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Compact Header */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-[#121316]/95 backdrop-blur-sm border-b border-[#242730] px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-[#1b1e23] border border-[#2c303a] flex items-center justify-center font-semibold text-xs text-[#ededef] shrink-0">
            I
          </div>
          <span className="text-sm font-semibold text-[#ededef] truncate">
            {currentHeading.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => openNewLogModal()}
            className="btn-primary px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Catat
          </button>
          <Link
            to="/settings"
            title="Pengaturan"
            aria-label="Pengaturan"
            className="p-2 rounded-md bg-[#16181c] border border-[#242730] text-[#9aa0ac] hover:text-[#ededef]"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={signOut}
            title="Keluar"
            aria-label="Keluar"
            className="p-2 rounded-md bg-[#16181c] border border-[#242730] text-[#9aa0ac] hover:text-[#e57373] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-1">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[#ededef] tracking-tight">
                {activeTab === 'overview' ? displayName : currentHeading.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#9aa0ac] mt-0.5">
                {activeTab === 'overview'
                  ? `${profile?.target_language ?? 'Japanese'} · Level ${stats.skills.overall.level} (${stats.skills.overall.rankTitle})`
                  : currentHeading.subtitle}
              </p>
            </div>
          </div>

          {/* Active PC Companion Recording Notice */}
          {companionConnected && companionStatus?.activeSession && (
            <button
              type="button"
              onClick={() => setActiveTab('devices')}
              className="w-full px-4 py-2.5 rounded-lg bg-[#14291f] border border-[#214a36] flex items-center justify-between gap-3 text-xs text-left hover:bg-[#183326] transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-[#d5f5e3] truncate">
                <span className="w-2 h-2 rounded-full bg-[#2eb872] shrink-0" />
                <span className="truncate">
                  <strong className="font-medium">PC Tracker aktif:</strong>{' '}
                  {companionStatus.activeSession.title} (
                  {Math.floor(companionStatus.activeSession.activeSeconds / 60)}m{' '}
                  {companionStatus.activeSession.activeSeconds % 60}d)
                </span>
              </span>
              <span className="text-[#5cd697] font-medium shrink-0">
                Kelola →
              </span>
            </button>
          )}

          {loadingLogs ? (
            <div className="space-y-4">
              <div className="surface h-20 opacity-60" />
              <div className="surface h-32 opacity-60" />
              <div className="surface h-48 opacity-60" />
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* 1. Primary tool first: Live Stopwatch */}
              <LiveStopwatch
                onSaveDuration={({ minutes, category, title }) => {
                  openNewLogModal({
                    duration: minutes,
                    category,
                    title,
                  });
                }}
              />

              {/* 2. Unified Key Metrics Strip (flat, hairline-divided, no nested cards) */}
              <section
                aria-label="Ringkasan utama"
                className="surface grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#242730]"
              >
                {/* Today's Goal */}
                <div className="p-5 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between text-xs text-[#9aa0ac]">
                    <span>Target Hari Ini</span>
                    <span className="font-mono text-[#5cd697] tabular-nums">
                      {stats.dailyProgress}%
                    </span>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold font-mono text-[#ededef] tabular-nums">
                      {stats.todayMinutes}{' '}
                      <span className="text-sm font-normal text-[#6c727f]">
                        / {stats.dailyGoal} mnt
                      </span>
                    </div>
                    <div className="progress-track h-1.5 mt-3">
                      <div
                        className="progress-fill h-full"
                        style={{ width: `${stats.dailyProgress}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-[#6c727f] flex items-center justify-between font-mono tabular-nums">
                    <span>Milestone {stats.milestone.nextMilestone}j</span>
                    <span className="text-[#9aa0ac]">
                      {Math.round(stats.milestone.progress)}%
                    </span>
                  </div>
                </div>

                {/* Streak & Accumulation */}
                <div className="p-5 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between text-xs text-[#9aa0ac]">
                    <span>Streak Aktif</span>
                    <span className="font-mono text-[#6c727f] tabular-nums">
                      Rekor {stats.longestStreak}h
                    </span>
                  </div>
                  <div className="text-2xl font-semibold font-mono text-[#ededef] tabular-nums">
                    {stats.streak}{' '}
                    <span className="text-sm font-normal text-[#6c727f]">
                      hari
                    </span>
                  </div>
                  <div className="text-xs text-[#9aa0ac] flex items-center gap-3 font-mono tabular-nums">
                    <span>{stats.totalHours.toFixed(1)} jam total</span>
                    <span className="text-[#313540]">·</span>
                    <span>{stats.totalCards} kartu</span>
                  </div>
                </div>

                {/* Level & XP */}
                <div className="p-5 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between text-xs text-[#9aa0ac]">
                    <span>Level & XP</span>
                    <span className="font-mono text-[#9aa0ac] tabular-nums">
                      {stats.skills.overall.totalXp.toLocaleString()} XP
                    </span>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-2xl font-semibold text-[#ededef]">
                        Level {stats.skills.overall.level}
                      </span>
                      <span className="text-xs font-mono text-[#6c727f] tabular-nums">
                        {stats.skills.overall.currentLevelXp} /{' '}
                        {stats.skills.overall.nextLevelXp}
                      </span>
                    </div>
                    <div className="progress-track h-1.5 mt-3">
                      <div
                        className="progress-fill h-full"
                        style={{ width: `${stats.skills.overall.progressPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-[#9aa0ac] flex items-center gap-3 font-mono tabular-nums">
                    <span>Listening Lv.{stats.skills.listening.level}</span>
                    <span className="text-[#313540]">·</span>
                    <span>Reading Lv.{stats.skills.reading.level}</span>
                  </div>
                </div>
              </section>

              {/* 3. Monthly Summary Strip (flat hairline dividers, zero nested boxes) */}
              <section className="surface">
                <div className="px-5 py-3.5 border-b border-[#242730] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h2 className="text-sm font-semibold text-[#ededef]">
                    Ringkasan Bulan Ini
                  </h2>
                  <span className="text-xs text-[#9aa0ac] font-mono tabular-nums">
                    Rasio Reading : Listening ={' '}
                    <span className="text-[#ededef] font-medium">
                      {stats.balance.ratioLabel}
                    </span>
                  </span>
                </div>

                <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#242730]">
                  <div className="p-5 space-y-1">
                    <div className="text-xs text-[#9aa0ac]">Total Bulan Ini</div>
                    <div className="text-xl font-semibold font-mono text-[#ededef] tabular-nums">
                      {(stats.monthly.thisMonth.totalMin / 60).toFixed(1)} jam
                    </div>
                    <div>{renderDeltaText(stats.monthly.deltas.totalPct)}</div>
                  </div>

                  <div className="p-5 space-y-1">
                    <div className="text-xs text-[#9aa0ac]">Reading</div>
                    <div className="text-xl font-semibold font-mono text-[#ededef] tabular-nums">
                      {(stats.monthly.thisMonth.readingMin / 60).toFixed(1)} jam
                    </div>
                    <div>
                      {renderDeltaText(stats.monthly.deltas.readingPct)}
                    </div>
                  </div>

                  <div className="p-5 space-y-1">
                    <div className="text-xs text-[#9aa0ac]">Listening</div>
                    <div className="text-xl font-semibold font-mono text-[#ededef] tabular-nums">
                      {(stats.monthly.thisMonth.listeningMin / 60).toFixed(1)}{' '}
                      jam
                    </div>
                    <div>
                      {renderDeltaText(stats.monthly.deltas.listeningPct)}
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Recent Media Quick Log */}
              {stats.recentMedia.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[#ededef]">
                      Media yang Sedang Diikuti
                    </h2>
                    <span className="text-xs text-[#6c727f]">
                      Klik untuk catat sesi lanjutan
                    </span>
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
                          className="surface-interactive p-3 text-left flex items-center gap-3 group cursor-pointer"
                        >
                          <MediaCover
                            title={media.title}
                            category={media.category}
                            className="w-11 h-15 rounded-md"
                          />

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#9aa0ac]">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: meta.color }}
                              />
                              <span>{meta.shortLabel}</span>
                              <span className="text-[#6c727f] font-mono">
                                · {media.sessions} sesi
                              </span>
                            </div>
                            <div className="font-medium text-sm text-[#ededef] truncate">
                              {media.title}
                            </div>
                            <div className="text-xs font-mono text-[#6c727f] tabular-nums">
                              {(media.totalMinutes / 60).toFixed(1)}j ·{' '}
                              {media.totalXp} XP
                            </div>
                          </div>

                          <span className="text-xs font-medium text-[#6c727f] group-hover:text-[#ededef] transition-colors shrink-0 pr-1">
                            + Log
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 5. Yearly Activity Heatmap */}
              <ActivityHeatmap logs={logs} dailyGoal={stats.dailyGoal} />

              {/* 6. Recent Logs */}
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
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi bawah"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#121316]/95 backdrop-blur-sm border-t border-[#242730]"
      >
        <div className="grid grid-cols-6 max-w-lg mx-auto">
          {navTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-2.5 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active ? 'text-[#ededef]' : 'text-[#6c727f]'
                }`}
              >
                {active && (
                  <span className="absolute top-0 inset-x-3 h-[2px] bg-[#ededef] rounded-full" />
                )}
                <span className="relative">
                  <tab.icon className="w-4 h-4" />
                  {tab.dot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2eb872] absolute -top-0.5 -right-1" />
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none">
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

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
