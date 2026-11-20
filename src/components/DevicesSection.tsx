import React, { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Laptop,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Smartphone,
  Sparkles,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  CATEGORY_META,
  PRIMARY_CATEGORIES,
  getCategoryMeta,
  type PrimaryMediaCategory,
} from '../types';
import {
  ackCompanionSessions,
  flushCompanionSession,
  saveCompanionConfig,
  toggleCompanionTracking,
  type CompanionConfig,
  type CompanionStatus,
  type PendingTrackedSession,
  type TrackerRule,
} from '../lib/companionClient';
import {
  checkAnkiConnection,
  fetchAnkiTodayStats,
  loadAnkiSettings,
  saveAnkiSettings,
  type AnkiConnectionCheck,
  type AnkiSettings,
  type AnkiTodayStats,
} from '../lib/ankiConnect';
import { calculateXp } from '../utils/stats';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface DevicesSectionProps {
  companionUrl: string;
  onChangeCompanionUrl: (url: string) => void;
  companionAutoSync: boolean;
  onToggleCompanionAutoSync: (enabled: boolean) => void;
  companionStatus: CompanionStatus | null;
  companionChecking: boolean;
  onRefreshCompanion: () => Promise<void>;
  onImportPending: (sessions: PendingTrackedSession[]) => Promise<void>;
  onSyncAnkiToday: (payload: {
    deckName: string;
    durationMinutes: number;
    cardsMined: number;
    reviewsToday: number;
  }) => Promise<void>;
}

export const DevicesSection: React.FC<DevicesSectionProps> = ({
  companionUrl,
  onChangeCompanionUrl,
  companionAutoSync,
  onToggleCompanionAutoSync,
  companionStatus,
  companionChecking,
  onRefreshCompanion,
  onImportPending,
  onSyncAnkiToday,
}) => {
  const [urlDraft, setUrlDraft] = useState(companionUrl);
  const [showCompanionGuide, setShowCompanionGuide] = useState(
    () => !companionStatus?.ok
  );
  const [busyAction, setBusyAction] = useState(false);

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleMatchType, setNewRuleMatchType] = useState<'process' | 'title'>(
    'title'
  );
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleCategory, setNewRuleCategory] =
    useState<PrimaryMediaCategory>('anime');

  const [ankiSettings, setAnkiSettings] = useState<AnkiSettings>(loadAnkiSettings);
  const [ankiCheck, setAnkiCheck] = useState<AnkiConnectionCheck | null>(null);
  const [ankiStats, setAnkiStats] = useState<AnkiTodayStats | null>(null);
  const [checkingAnki, setCheckingAnki] = useState(false);
  const [syncingAnki, setSyncingAnki] = useState(false);
  const [showAnkiGuide, setShowAnkiGuide] = useState(false);

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () =>
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const formatDurationSec = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleApplyUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    onChangeCompanionUrl(urlDraft);
    await onRefreshCompanion();
  };

  const handleToggleTracking = async () => {
    if (!companionStatus) return;
    setBusyAction(true);
    try {
      await toggleCompanionTracking(
        companionUrl,
        !companionStatus.trackingEnabled
      );
      await onRefreshCompanion();
      toast.success(
        companionStatus.trackingEnabled
          ? 'Tracking background di-pause'
          : 'Tracking background dilanjutkan'
      );
    } catch {
      toast.error('Gagal mengubah status tracking');
    } finally {
      setBusyAction(false);
    }
  };

  const handleFlushNow = async () => {
    setBusyAction(true);
    try {
      const res = await flushCompanionSession(companionUrl);
      if (res.pending.length > 0) {
        await onImportPending(res.pending);
        await ackCompanionSessions(
          companionUrl,
          res.pending.map((p) => p.id)
        );
        toast.success('Sesi aktif berhasil disimpan ke riwayat!');
      } else {
        toast('Belum ada durasi minimal 10 detik pada sesi aktif.');
      }
      await onRefreshCompanion();
    } catch {
      toast.error('Gagal menyimpan sesi aktif dari PC');
    } finally {
      setBusyAction(false);
    }
  };

  const handlePullPending = async () => {
    if (!companionStatus || companionStatus.pending.length === 0) return;
    setBusyAction(true);
    try {
      const items = companionStatus.pending;
      await onImportPending(items);
      await ackCompanionSessions(
        companionUrl,
        items.map((p) => p.id)
      );
      await onRefreshCompanion();
      toast.success(`${items.length} sesi dari PC berhasil disinkronkan!`);
    } catch {
      toast.error('Gagal menarik sesi pending');
    } finally {
      setBusyAction(false);
    }
  };

  const updateRemoteConfig = async (nextConfig: CompanionConfig) => {
    setBusyAction(true);
    try {
      await saveCompanionConfig(companionUrl, nextConfig);
      await onRefreshCompanion();
      toast.success('Aturan deteksi PC diperbarui');
    } catch {
      toast.error('Gagal menyimpan aturan ke Companion Agent');
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleRule = (ruleId: string) => {
    if (!companionStatus) return;
    const nextRules = companionStatus.config.rules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    updateRemoteConfig({ ...companionStatus.config, rules: nextRules });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!companionStatus) return;
    const nextRules = companionStatus.config.rules.filter(
      (r) => r.id !== ruleId
    );
    updateRemoteConfig({ ...companionStatus.config, rules: nextRules });
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companionStatus || !newRuleName.trim() || !newRulePattern.trim()) return;
    const added: TrackerRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      enabled: true,
      matchType: newRuleMatchType,
      pattern: newRulePattern.trim(),
      category: newRuleCategory,
    };
    updateRemoteConfig({
      ...companionStatus.config,
      rules: [added, ...companionStatus.config.rules],
    });
    setNewRuleName('');
    setNewRulePattern('');
  };

  const updateAnkiSetting = (patch: Partial<AnkiSettings>) => {
    setAnkiSettings((prev) => {
      const next = { ...prev, ...patch };
      saveAnkiSettings(next);
      return next;
    });
  };

  const handleTestAnki = async () => {
    setCheckingAnki(true);
    const activeProxy = companionStatus?.ok ? companionUrl : undefined;
    const check = await checkAnkiConnection(ankiSettings.url, activeProxy);
    setAnkiCheck(check);

    if (check.connected) {
      try {
        const stats = await fetchAnkiTodayStats(
          ankiSettings.url,
          ankiSettings.selectedDeck,
          ankiSettings.secondsPerReview,
          activeProxy
        );
        setAnkiStats(stats);
        toast.success(
          `AnkiConnect v${check.version} terhubung${
            check.viaProxy ? ' (via Proxy Agent)' : ''
          }!`
        );
      } catch {
        toast.success(`AnkiConnect v${check.version} terhubung!`);
      }
    } else {
      setAnkiStats(null);
      toast.error(check.error || 'AnkiConnect belum merespons');
    }
    setCheckingAnki(false);
  };

  const handleSyncAnki = async () => {
    setSyncingAnki(true);
    const activeProxy = companionStatus?.ok ? companionUrl : undefined;
    try {
      const stats = await fetchAnkiTodayStats(
        ankiSettings.url,
        ankiSettings.selectedDeck,
        ankiSettings.secondsPerReview,
        activeProxy
      );
      setAnkiStats(stats);
      if (stats.reviewsToday === 0 && stats.newCardsToday === 0) {
        toast('Belum ada review atau kartu baru Anki hari ini.');
        setSyncingAnki(false);
        return;
      }
      await onSyncAnkiToday({
        deckName: ankiSettings.selectedDeck,
        durationMinutes: Math.max(1, stats.estimatedMinutes),
        cardsMined: stats.newCardsToday,
        reviewsToday: stats.reviewsToday,
      });
    } catch {
      toast.error('Gagal mengambil statistik Anki hari ini');
    } finally {
      setSyncingAnki(false);
    }
  };

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const res = await installPrompt.userChoice;
    if (res.outcome === 'accepted') {
      toast.success('ImmersionTrack diinstall ke perangkatmu!');
      setInstallPrompt(null);
    }
  };

  const connected = Boolean(companionStatus?.ok);
  const activeSession = companionStatus?.activeSession ?? null;
  const activeMeta = activeSession
    ? getCategoryMeta(activeSession.category)
    : null;

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                connected
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-800/80 border-white/[0.08] text-slate-400'
              }`}
            >
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-semibold text-slate-100">
                  Windows Desktop Companion Agent
                </h3>
                {connected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Terhubung • {companionStatus?.deviceName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 border border-white/[0.08] text-[11px] font-medium text-slate-400">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Otomatis deteksi aplikasi/media aktif di Windows (MPV, VLC, Anki,
                YouTube, Netflix, Manga, VN) walaupun browser ditutup.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleApplyUrl}
            className="flex items-center gap-2 flex-wrap"
          >
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              aria-label="URL Companion Agent"
              className="px-3 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-xs font-mono text-slate-200 w-52 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={companionChecking}
              className="px-3.5 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] hover:border-white/[0.2] text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  companionChecking ? 'animate-spin' : ''
                }`}
              />
              Cek Koneksi
            </button>
          </form>
        </div>

        {connected && companionStatus && (
          <div className="space-y-5 pt-2 border-t border-white/[0.06]">
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#11151c] border border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Jendela Aktif Saat Ini
                  </span>
                  <span className="font-mono text-slate-500">
                    Idle: {companionStatus.lastWindow.idleSeconds}d
                  </span>
                </div>
                <div className="text-sm font-medium text-white truncate">
                  {companionStatus.lastWindow.title || '(Tidak ada judul)'}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="px-2 py-0.5 rounded-md bg-[#171c26] border border-white/[0.06] font-mono text-slate-300">
                    {companionStatus.lastWindow.process || 'unknown'}
                  </span>
                  <span>
                    {companionStatus.lastWindow.matchedRule
                      ? `Cocok: ${companionStatus.lastWindow.matchedRule}`
                      : 'Tidak cocok aturan immersion'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#11151c] border border-white/[0.06] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Sesi Berjalan di Background
                  </span>
                  {activeSession && activeMeta ? (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${activeMeta.badgeClass}`}
                    >
                      {activeMeta.label}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">Standby</span>
                  )}
                </div>

                {activeSession ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {activeSession.title}
                      </div>
                      <div className="text-xs font-mono text-indigo-300 mt-0.5">
                        +{calculateXp(
                          activeSession.category,
                          Math.max(1, Math.round(activeSession.activeSeconds / 60)),
                          0
                        )}{' '}
                        XP est.
                      </div>
                    </div>
                    <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                      {formatDurationSec(activeSession.activeSeconds)}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Buka MPV, VLC, Anki, atau tonton/baca konten sesuai aturan di
                    bawah—agent akan mulai menghitung otomatis.
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={handleToggleTracking}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                      companionStatus.trackingEnabled
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {companionStatus.trackingEnabled ? (
                      <>
                        <Pause className="w-3.5 h-3.5" /> Pause Agent
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Lanjut Agent
                      </>
                    )}
                  </button>

                  {activeSession && (
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={handleFlushNow}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Sesi Sekarang
                    </button>
                  )}

                  {companionStatus.pendingCount > 0 && (
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={handlePullPending}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      Tarik {companionStatus.pendingCount} Sesi Pending
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#11151c] border border-white/[0.06] text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={companionAutoSync}
                  onChange={(e) => onToggleCompanionAutoSync(e.target.checked)}
                  className="accent-indigo-500 w-4 h-4 rounded"
                />
                <span>
                  <strong>Auto-Sync otomatis</strong> setiap kali sesi dari PC
                  selesai
                </span>
              </label>

              <div className="flex items-center gap-3 text-slate-400">
                <span>
                  Idle pause:{' '}
                  <strong className="text-slate-200">
                    {Math.round(
                      companionStatus.config.idleThresholdSeconds / 60
                    )}{' '}
                    mnt
                  </strong>
                </span>
                <span>
                  Min sesi:{' '}
                  <strong className="text-slate-200">
                    {companionStatus.config.minSessionMinutes} mnt
                  </strong>
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Aturan Deteksi Aplikasi & Judul ({companionStatus.config.rules.length})
              </h4>

              <form
                onSubmit={handleAddRule}
                className="grid sm:grid-cols-12 gap-2 p-3 rounded-xl bg-[#11151c] border border-white/[0.06]"
              >
                <input
                  type="text"
                  required
                  placeholder="Nama (mis. Bilibili)"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 rounded-lg bg-[#171c26] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={newRuleMatchType}
                  onChange={(e) =>
                    setNewRuleMatchType(e.target.value as 'process' | 'title')
                  }
                  className="sm:col-span-2 px-2.5 py-2 rounded-lg bg-[#171c26] border border-white/[0.08] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="title">Judul Jendela</option>
                  <option value="process">Nama Proses</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Kata kunci / regex (mis. bilibili|anime)"
                  value={newRulePattern}
                  onChange={(e) => setNewRulePattern(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 rounded-lg bg-[#171c26] border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={newRuleCategory}
                  onChange={(e) =>
                    setNewRuleCategory(e.target.value as PrimaryMediaCategory)
                  }
                  className="sm:col-span-2 px-2.5 py-2 rounded-lg bg-[#171c26] border border-white/[0.08] text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {PRIMARY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_META[cat].shortLabel}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={busyAction}
                  className="sm:col-span-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
              </form>

              <div className="grid md:grid-cols-2 gap-2.5">
                {companionStatus.config.rules.map((rule) => {
                  const meta = getCategoryMeta(rule.category);
                  return (
                    <div
                      key={rule.id}
                      className="p-3 rounded-xl bg-[#11151c] border border-white/[0.06] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {rule.name}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          [{rule.matchType}] /{rule.pattern}/i →{' '}
                          {meta.shortLabel}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id)}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                            rule.enabled
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {rule.enabled ? 'Aktif' : 'Nonaktif'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Hapus aturan"
                          className="p-1.5 rounded-md text-slate-500 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={() => setShowCompanionGuide(!showCompanionGuide)}
            className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            Cara Menjalankan Background Agent di Windows
            {showCompanionGuide ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showCompanionGuide && (
            <div className="mt-3 p-4 rounded-xl bg-[#11151c] border border-white/[0.06] text-xs text-slate-300 space-y-2.5">
              <p>
                1. Jalankan lewat terminal di folder proyek:{' '}
                <code className="px-2 py-0.5 rounded bg-[#171c26] font-mono text-indigo-300">
                  npm run tracker
                </code>
              </p>
              <p>
                2. Atau klik ganda{' '}
                <code className="px-2 py-0.5 rounded bg-[#171c26] font-mono text-slate-200">
                  companion\start-hidden.vbs
                </code>{' '}
                agar berjalan diam-diam di background tanpa jendela CMD.
              </p>
              <p>
                3. Supaya otomatis jalan saat laptop menyala: tekan{' '}
                <code className="font-mono text-slate-200">Win + R</code> →
                ketik <code className="font-mono text-slate-200">shell:startup</code>{' '}
                → taruh shortcut <code className="font-mono">start-hidden.vbs</code>{' '}
                di sana.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  ankiCheck?.connected
                    ? 'bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300'
                    : 'bg-slate-800/80 border-white/[0.08] text-slate-400'
                }`}
              >
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-100">
                    Integrasi AnkiConnect
                  </h3>
                  {ankiCheck?.connected && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      v{ankiCheck.version}
                      {ankiCheck.viaProxy ? ' (via Agent)' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Tarik jumlah review & kartu baru yang ditambang hari ini
                  langsung dari Anki PC.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={ankiSettings.url}
              onChange={(e) => updateAnkiSetting({ url: e.target.value })}
              aria-label="URL AnkiConnect"
              className="flex-1 px-3 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              disabled={checkingAnki}
              onClick={handleTestAnki}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checkingAnki ? 'animate-spin' : ''}`}
              />
              Test Koneksi
            </button>
          </div>

          {ankiCheck?.connected && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Filter Deck Kartu Baru
                  </label>
                  <select
                    value={ankiSettings.selectedDeck}
                    onChange={(e) =>
                      updateAnkiSetting({ selectedDeck: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">Semua Deck</option>
                    {(ankiCheck.decks ?? []).map((deck) => (
                      <option key={deck} value={deck}>
                        {deck}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Estimasi Detik / Review
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={ankiSettings.secondsPerReview}
                    onChange={(e) =>
                      updateAnkiSetting({
                        secondsPerReview: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {ankiStats && (
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#11151c] border border-white/[0.06] text-center">
                  <div>
                    <div className="text-[11px] text-slate-400">Kartu Baru</div>
                    <div className="text-lg font-bold font-mono text-pink-400">
                      +{ankiStats.newCardsToday}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Review</div>
                    <div className="text-lg font-bold font-mono text-white">
                      {ankiStats.reviewsToday}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Est. Waktu</div>
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      {ankiStats.estimatedMinutes}m
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={syncingAnki}
                onClick={handleSyncAnki}
                className="w-full py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {syncingAnki
                  ? 'Menyinkronkan...'
                  : 'Sinkronkan Anki Hari Ini ke Log'}
              </button>
            </div>
          )}

          <div className="border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => setShowAnkiGuide(!showAnkiGuide)}
              className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              Setup Add-on AnkiConnect (Kode: 2055492159)
              {showAnkiGuide ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showAnkiGuide && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-[#11151c] border border-white/[0.06] text-xs text-slate-400 space-y-1.5">
                <p>1. Buka Anki → Tools → Add-ons → Get Add-ons...</p>
                <p>
                  2. Masukkan kode{' '}
                  <strong className="text-slate-200 font-mono">
                    2055492159
                  </strong>{' '}
                  lalu restart Anki.
                </p>
                <p>
                  3. Jika Windows Companion Agent di atas sedang aktif, web ini
                  otomatis mem-proxy koneksi Anki tanpa perlu edit CORS di Anki!
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08] space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-100">
                  HP (Android / iOS) & Background Timer
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300">
                  <Wifi className="w-3 h-3" />
                  Background-Safe
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Stopwatch di tab Overview memakai timestamp perangkat sehingga
                waktu tetap akurat walau HP dikunci atau tab ditutup.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#11151c] border border-white/[0.06] space-y-2 text-xs text-slate-300">
            <div className="font-semibold text-slate-100">
              Buka dari HP lewat Wi-Fi yang sama:
            </div>
            <p className="text-slate-400">
              Jalankan perintah ini di PC lalu buka alamat IP lokal yang muncul
              di browser HP Anda:
            </p>
            <code className="block px-3 py-2 rounded-lg bg-[#171c26] border border-white/[0.06] font-mono text-indigo-300">
              npm run dev:host
            </code>
          </div>

          {installPrompt ? (
            <button
              type="button"
              onClick={handleInstallPwa}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Install sebagai Aplikasi (PWA)
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#11151c] border border-white/[0.06] text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200">Tips Install di HP:</strong> Di
              Chrome Android ketuk menu <strong>⋮ → Install app</strong>, atau di
              Safari iOS ketuk <strong>Share → Add to Home Screen</strong> agar
              ImmersionTrack tampil full-screen seperti aplikasi native.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
