import React, { useEffect, useState } from 'react';
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Download,
  Laptop,
  Layers,
  Pause,
  Pin,
  PinOff,
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
  bulkToggleCompanionRules,
  flushCompanionSession,
  pinCompanionWindow,
  saveCompanionConfig,
  toggleCompanionApp,
  toggleCompanionTracking,
  unpinCompanionWindow,
  type CompanionConfig,
  type CompanionStatus,
  type OpenWindowItem,
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

  // Smooth 1-second client-side timer synced with companionStatus.activeSession
  const [liveElapsedSec, setLiveElapsedSec] = useState<number>(
    companionStatus?.activeSession?.activeSeconds ?? 0
  );
  const [windowCategoryOverrides, setWindowCategoryOverrides] = useState<
    Record<string, PrimaryMediaCategory>
  >({});

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleMatchType, setNewRuleMatchType] = useState<'process' | 'title'>(
    'title'
  );
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleCategory, setNewRuleCategory] =
    useState<PrimaryMediaCategory>('anime');

  const [ankiSettings, setAnkiSettings] =
    useState<AnkiSettings>(loadAnkiSettings);
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

  useEffect(() => {
    const remoteSec = companionStatus?.activeSession?.activeSeconds ?? 0;
    setLiveElapsedSec(remoteSec);
  }, [
    companionStatus?.activeSession?.activeSeconds,
    companionStatus?.activeSession?.title,
    companionStatus?.activeSession?.startedAt,
  ]);

  useEffect(() => {
    if (
      !companionStatus?.ok ||
      !companionStatus.trackingEnabled ||
      !companionStatus.activeSession
    ) {
      return;
    }
    const timer = setInterval(() => {
      setLiveElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [
    companionStatus?.ok,
    companionStatus?.trackingEnabled,
    companionStatus?.activeSession,
  ]);

  const formatDurationSec = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const rem = sec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
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
        toast.error('Tidak ada sesi aktif untuk disimpan.');
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

  const handleToggleWindowApp = async (win: OpenWindowItem) => {
    const key = `${win.process}::${win.hwnd}`;
    const chosenCat =
      windowCategoryOverrides[key] ?? win.matchedCategory ?? 'study';
    const currentlyEnabled = Boolean(win.appEnabled);
    const nextEnabled = !currentlyEnabled;
    setBusyAction(true);
    try {
      await toggleCompanionApp(companionUrl, {
        process: win.process,
        title: win.title,
        category: chosenCat,
        enabled: nextEnabled,
      });
      await onRefreshCompanion();
      toast.success(
        nextEnabled
          ? `Tracking diaktifkan untuk: ${win.process}`
          : `Tracking dimatikan untuk: ${win.process}`
      );
    } catch {
      toast.error('Gagal mengubah status aplikasi');
    } finally {
      setBusyAction(false);
    }
  };

  const handleBulkToggleRules = async (enabled: boolean) => {
    setBusyAction(true);
    try {
      await bulkToggleCompanionRules(companionUrl, enabled);
      await onRefreshCompanion();
      toast.success(
        enabled
          ? 'Semua aturan deteksi diaktifkan!'
          : 'Semua aturan dimatikan — silakan nyalakan hanya aplikasi yang Anda inginkan.'
      );
    } catch {
      toast.error('Gagal mengubah aturan secara massal');
    } finally {
      setBusyAction(false);
    }
  };

  const handlePinWindow = async (win: OpenWindowItem) => {
    const key = `${win.process}::${win.hwnd}`;
    const chosenCat =
      windowCategoryOverrides[key] ?? win.matchedCategory ?? 'study';
    setBusyAction(true);
    try {
      await pinCompanionWindow(companionUrl, {
        hwnd: win.hwnd,
        process: win.process,
        title: win.title,
        category: chosenCat,
      });
      await onRefreshCompanion();
      toast.success(`Mulai merekam jendela: ${win.title} (${win.process})`);
    } catch {
      toast.error('Gagal mengunci jendela untuk tracking');
    } finally {
      setBusyAction(false);
    }
  };

  const handleUnpinWindow = async () => {
    setBusyAction(true);
    try {
      await unpinCompanionWindow(companionUrl);
      await onRefreshCompanion();
      toast.success('Kembali ke mode deteksi otomatis');
    } catch {
      toast.error('Gagal melepas kunci jendela');
    } finally {
      setBusyAction(false);
    }
  };

  const updateRemoteConfig = async (nextConfig: CompanionConfig) => {
    setBusyAction(true);
    try {
      await saveCompanionConfig(companionUrl, nextConfig);
      await onRefreshCompanion();
      toast.success('Pengaturan & aturan deteksi PC diperbarui');
    } catch {
      toast.error('Gagal menyimpan aturan ke Companion Agent');
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleBackgroundMode = (enabled: boolean) => {
    if (!companionStatus) return;
    void updateRemoteConfig({
      ...companionStatus.config,
      trackBackgroundWindows: enabled,
    });
  };

  const handleToggleRule = (ruleId: string) => {
    if (!companionStatus) return;
    const nextRules = companionStatus.config.rules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    void updateRemoteConfig({ ...companionStatus.config, rules: nextRules });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!companionStatus) return;
    const nextRules = companionStatus.config.rules.filter(
      (r) => r.id !== ruleId
    );
    void updateRemoteConfig({ ...companionStatus.config, rules: nextRules });
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companionStatus || !newRuleName.trim() || !newRulePattern.trim())
      return;
    const added: TrackerRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      enabled: true,
      matchType: newRuleMatchType,
      pattern: newRulePattern.trim(),
      category: newRuleCategory,
    };
    void updateRemoteConfig({
      ...companionStatus.config,
      rules: [added, ...companionStatus.config.rules],
    });
    setNewRuleName('');
    setNewRulePattern('');
  };

  const handleDownloadQuickLauncher = () => {
    const batContent = [
      '@echo off',
      'title ImmersionTrack Windows Companion Auto-Starter',
      'echo ========================================================',
      'echo   Menyiapkan ImmersionTrack Windows Companion Agent v2.0',
      'echo ========================================================',
      'set "REPO_AGENT=C:\\Users\\mmaul\\immersion-vite\\companion\\tracker-agent.mjs"',
      'set "REPO_VBS=C:\\Users\\mmaul\\immersion-vite\\companion\\start-hidden.vbs"',
      'set "STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"',
      'if exist "%REPO_VBS%" (',
      '  copy /Y "%REPO_VBS%" "%STARTUP_DIR%\\ImmersionTrack-Companion.vbs" >nul',
      '  wscript.exe "%REPO_VBS%"',
      '  echo [OK] Companion Agent dijalankan dan didaftarkan ke Windows Startup!',
      ') else (',
      '  echo Pastikan folder proyek C:\\Users\\mmaul\\immersion-vite tersedia.',
      ')',
      'timeout /t 3',
    ].join('\r\n');

    const blob = new Blob([batContent], { type: 'application/bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ImmersionTrack-Companion-Start.bat';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(
      'File ImmersionTrack-Companion-Start.bat diunduh! Klik ganda file tersebut untuk menyalakan Agent.'
    );
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
  const openWindows = companionStatus?.openWindows ?? [];
  const pinnedTarget = companionStatus?.pinnedTarget ?? null;

  const getTrackingSourceBadge = (source?: string) => {
    switch (source) {
      case 'foreground':
        return {
          label: 'Aktif di Foreground',
          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'background':
        return {
          label: 'Terdeteksi di Background',
          cls: 'bg-sky-50 text-sky-700 border-sky-200',
        };
      case 'pinned':
        return {
          label: 'Dikunci Manual',
          cls: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'catalog':
        return {
          label: 'Dari Katalog Media',
          cls: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      default:
        return null;
    }
  };

  const sourceBadge = getTrackingSourceBadge(
    activeSession?.trackingSource ?? companionStatus?.lastWindow?.trackingSource
  );

  return (
    <div className="space-y-6">
      <div className="card-pro p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-semibold text-slate-900">
                  Windows Desktop Companion Agent
                </h3>
                {connected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Terhubung • {companionStatus?.deviceName} (v
                    {companionStatus?.version ?? '2.0'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Otomatis mendeteksi aplikasi & jendela immersion di Windows
                (Fushi, Anki, MPV, VLC, Bettermelon, Yatsu Reader, Epub.moe,
                Cinejoy, YouTube, MangaDex, Visual Novel) di foreground maupun
                background.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!connected && (
              <button
                type="button"
                onClick={handleDownloadQuickLauncher}
                className="btn-crimson px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Starter (.BAT)
              </button>
            )}
            <form
              onSubmit={handleApplyUrl}
              className="flex items-center gap-2 flex-wrap"
            >
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                aria-label="URL Companion Agent"
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 w-48 focus:outline-none focus:border-rose-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={companionChecking}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
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
        </div>

        {connected && companionStatus && (
          <div className="space-y-5 pt-3 border-t border-slate-100">
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                  <span className="font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-600" />
                    Target Jendela Terdeteksi
                  </span>
                  <div className="flex items-center gap-2">
                    {sourceBadge && (
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sourceBadge.cls}`}
                      >
                        {sourceBadge.label}
                      </span>
                    )}
                    <span className="font-mono text-slate-400">
                      Idle: {companionStatus.lastWindow.idleSeconds}d
                    </span>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {companionStatus.lastWindow.title || '(Tidak ada judul)'}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-slate-700">
                    {companionStatus.lastWindow.process || 'unknown'}
                  </span>
                  <span
                    className={
                      companionStatus.lastWindow.matchedRule
                        ? 'text-emerald-700 font-medium'
                        : 'text-slate-500'
                    }
                  >
                    {companionStatus.lastWindow.matchedRule
                      ? `✓ Cocok: ${companionStatus.lastWindow.matchedRule}`
                      : 'Tidak cocok aturan immersion'}
                  </span>
                </div>
                {companionStatus.lastWindow.foregroundTitle &&
                  companionStatus.lastWindow.foregroundTitle !==
                    companionStatus.lastWindow.title && (
                    <div className="text-[11px] text-slate-400 truncate pt-1 border-t border-slate-200/60">
                      Layar Depan (Foreground):{' '}
                      <span className="font-mono text-slate-600">
                        {companionStatus.lastWindow.foregroundProcess}
                      </span>{' '}
                      — {companionStatus.lastWindow.foregroundTitle}
                    </div>
                  )}
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Sesi Berjalan di Background
                  </span>
                  <div className="flex items-center gap-1.5">
                    {pinnedTarget && (
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={handleUnpinWindow}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <PinOff className="w-3 h-3" />
                        Lepas Kunci
                      </button>
                    )}
                    {activeSession && activeMeta ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 font-medium">
                        {activeMeta.label}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Standby</span>
                    )}
                  </div>
                </div>

                {activeSession ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {activeSession.title}
                      </div>
                      <div className="text-xs font-mono text-rose-600 mt-0.5 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                        {activeMeta?.label ?? activeSession.category} •{' '}
                        {activeSession.process} • Sedang direkam
                      </div>
                    </div>
                    <div className="text-2xl font-mono font-bold text-emerald-600 tabular-nums shrink-0">
                      {formatDurationSec(liveElapsedSec)}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Buka Fushi, Anki, MPV, VLC, atau pilih salah satu jendela
                    terbuka di bawah untuk mulai menghitung waktu secara
                    otomatis.
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={handleToggleTracking}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                      companionStatus.trackingEnabled
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
                      className="btn-crimson px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Sesi Sekarang (
                      {Math.max(1, Math.round(liveElapsedSec / 60))}m)
                    </button>
                  )}

                  {companionStatus.pendingCount > 0 && (
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={handlePullPending}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      Tarik {companionStatus.pendingCount} Sesi Pending
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={companionAutoSync}
                    onChange={(e) =>
                      onToggleCompanionAutoSync(e.target.checked)
                    }
                    className="accent-sky-400 w-4 h-4 rounded"
                  />
                  <span>
                    <strong>Auto-Sync ke Log</strong> saat sesi selesai
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      companionStatus.config.trackBackgroundWindows !== false
                    }
                    onChange={(e) =>
                      handleToggleBackgroundMode(e.target.checked)
                    }
                    className="accent-sky-400 w-4 h-4 rounded"
                  />
                  <span>
                    <strong>Track Aplikasi Immersion di Background</strong>{' '}
                    (Fushi, Anki, MPV, Browser)
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 text-slate-500">
                <span>
                  Batas Idle:{' '}
                  <strong className="text-slate-900">
                    {Math.round(
                      companionStatus.config.idleThresholdSeconds / 60
                    )}{' '}
                    mnt
                  </strong>
                </span>
                <span>
                  Min sesi:{' '}
                  <strong className="text-slate-900">
                    {companionStatus.config.minSessionMinutes} mnt
                  </strong>
                </span>
              </div>
            </div>

            {/* Live Open Windows Picker with ON / OFF Toggles */}
            {openWindows.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-rose-600" />
                      Pilih Aplikasi / Jendela Windows yang Di-Track (
                      {openWindows.filter((w) => w.appEnabled).length}/
                      {openWindows.length} Aktif)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Nyalakan tombol <strong>ON / OFF</strong> hanya pada
                      aplikasi yang ingin Anda track (misalnya hanya Fushi atau
                      Anki saja).
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {openWindows.map((win) => {
                    const key = `${win.process}::${win.hwnd}`;
                    const selectedCat =
                      windowCategoryOverrides[key] ??
                      win.matchedCategory ??
                      'study';
                    const isAppOn = Boolean(win.appEnabled);
                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition ${
                          win.isTracked
                            ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
                            : isAppOn
                              ? 'bg-white border-emerald-200'
                              : 'bg-slate-50/80 border-slate-200/70 opacity-80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold shrink-0 ${
                                  isAppOn
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {win.process}
                              </span>
                              {win.isForeground && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold shrink-0">
                                  Foreground
                                </span>
                              )}
                              {win.isTracked && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-semibold shrink-0 inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  Sedang Direkam
                                </span>
                              )}
                            </div>
                            <div
                              className="text-xs font-semibold text-slate-800 truncate"
                              title={win.title}
                            >
                              {win.title}
                            </div>
                          </div>

                          {/* ON / OFF Switch per Application */}
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() => void handleToggleWindowApp(win)}
                            title={
                              isAppOn
                                ? `Matikan tracking untuk ${win.process}`
                                : `Aktifkan tracking untuk ${win.process}`
                            }
                            className={`px-2.5 py-1 rounded-full border text-[11px] font-extrabold inline-flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                              isAppOn
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isAppOn ? 'bg-white' : 'bg-slate-400'
                              }`}
                            />
                            <span>{isAppOn ? 'ON' : 'OFF'}</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60">
                          <select
                            value={selectedCat}
                            onChange={(e) =>
                              setWindowCategoryOverrides((prev) => ({
                                ...prev,
                                [key]: e.target.value as PrimaryMediaCategory,
                              }))
                            }
                            aria-label={`Kategori untuk ${win.process}`}
                            className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700 focus:outline-none focus:border-rose-500"
                          >
                            {PRIMARY_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {CATEGORY_META[cat].shortLabel}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() => void handlePinWindow(win)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer ${
                              win.isTracked
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-700'
                            }`}
                          >
                            {win.isTracked ? (
                              <>
                                <Crosshair className="w-3 h-3" />
                                Fokus Aktif
                              </>
                            ) : (
                              <>
                                <Pin className="w-3 h-3" />
                                Fokus Ini Saja
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Pilih Aturan Deteksi Aplikasi & Website (
                    {
                      companionStatus.config.rules.filter((r) => r.enabled)
                        .length
                    }
                    /{companionStatus.config.rules.length} Aktif)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Klik tombol <strong>ON / OFF</strong> pada setiap aturan,
                    atau klik &ldquo;Matikan Semua&rdquo; lalu aktifkan hanya
                    yang Anda butuhkan.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleBulkToggleRules(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer"
                  >
                    Matikan Semua
                  </button>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleBulkToggleRules(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Aktifkan Semua
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleAddRule}
                className="grid sm:grid-cols-12 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80"
              >
                <input
                  type="text"
                  required
                  placeholder="Nama (mis. Bilibili / Fushi)"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                />
                <select
                  value={newRuleMatchType}
                  onChange={(e) =>
                    setNewRuleMatchType(e.target.value as 'process' | 'title')
                  }
                  className="sm:col-span-2 px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-rose-500"
                >
                  <option value="title">Judul Jendela</option>
                  <option value="process">Nama Proses</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Kata kunci / regex (mis. fushi|anime)"
                  value={newRulePattern}
                  onChange={(e) => setNewRulePattern(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-rose-500"
                />
                <select
                  value={newRuleCategory}
                  onChange={(e) =>
                    setNewRuleCategory(e.target.value as PrimaryMediaCategory)
                  }
                  className="sm:col-span-2 px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-rose-500"
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
                  className="btn-crimson sm:col-span-2 px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
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
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition ${
                        rule.enabled
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-slate-50 border-slate-200/70 opacity-75'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: rule.enabled
                                ? meta.color
                                : '#94a3b8',
                            }}
                          />
                          <span
                            className={`text-xs font-bold truncate ${
                              rule.enabled
                                ? 'text-slate-900'
                                : 'text-slate-500 line-through'
                            }`}
                          >
                            {rule.name}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">
                          [{rule.matchType}] /{rule.pattern}/i →{' '}
                          {meta.shortLabel}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id)}
                          className={`px-3 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer ${
                            rule.enabled
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              rule.enabled ? 'bg-white' : 'bg-slate-400'
                            }`}
                          />
                          {rule.enabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Hapus aturan"
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-600 cursor-pointer"
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

        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowCompanionGuide(!showCompanionGuide)}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer"
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
            <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-2.5">
              <p>
                1. Klik tombol <strong>Download Starter (.BAT)</strong> di atas
                atau klik ganda{' '}
                <code className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-slate-800">
                  companion\start-hidden.vbs
                </code>{' '}
                agar berjalan diam-diam di background Windows.
              </p>
              <p>
                2. Atau jalankan lewat terminal di folder proyek:{' '}
                <code className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-rose-700">
                  npm run tracker
                </code>
              </p>
              <p>
                3. Agent v2.0 sudah otomatis mendeteksi aplikasi seperti{' '}
                <strong>Fushi</strong>, <strong>Anki</strong>,{' '}
                <strong>MPV / VLC</strong>, <strong>Bettermelon</strong>,{' '}
                <strong>Yatsu Reader</strong>, <strong>Epub.moe</strong>,{' '}
                <strong>Cinejoy</strong>,{' '}
                <strong>MangaDex</strong>, dan <strong>YouTube</strong> baik di
                jendela depan maupun saat sedang dibuka di background.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-pro p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                ankiCheck?.connected
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">
                  Integrasi AnkiConnect
                </h3>
                {ankiCheck?.connected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />v{ankiCheck.version}
                    {ankiCheck.viaProxy ? ' (via Agent)' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tarik jumlah review & kartu baru yang ditambang hari ini
                langsung dari Anki PC.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={ankiSettings.url}
              onChange={(e) => updateAnkiSetting({ url: e.target.value })}
              aria-label="URL AnkiConnect"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-rose-500 focus:bg-white"
            />
            <button
              type="button"
              disabled={checkingAnki}
              onClick={handleTestAnki}
              className="btn-crimson px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
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
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Filter Deck Kartu Baru
                  </label>
                  <select
                    value={ankiSettings.selectedDeck}
                    onChange={(e) =>
                      updateAnkiSetting({ selectedDeck: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
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
                  <label className="block text-[11px] text-slate-500 mb-1">
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {ankiStats && (
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                  <div>
                    <div className="text-[11px] text-slate-500">Kartu Baru</div>
                    <div className="text-lg font-bold font-mono text-rose-600">
                      +{ankiStats.newCardsToday}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Review</div>
                    <div className="text-lg font-bold font-mono text-slate-900">
                      {ankiStats.reviewsToday}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Est. Waktu</div>
                    <div className="text-lg font-bold font-mono text-emerald-600">
                      {ankiStats.estimatedMinutes}m
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={syncingAnki}
                onClick={handleSyncAnki}
                className="btn-crimson w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {syncingAnki
                  ? 'Menyinkronkan...'
                  : 'Sinkronkan Anki Hari Ini ke Log'}
              </button>
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowAnkiGuide(!showAnkiGuide)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
            >
              Setup Add-on AnkiConnect (Kode: 2055492159)
              {showAnkiGuide ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showAnkiGuide && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                <p>1. Buka Anki → Tools → Add-ons → Get Add-ons...</p>
                <p>
                  2. Masukkan kode{' '}
                  <strong className="text-slate-900 font-mono">
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

        <div className="card-pro p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">
                  HP (Android / iOS) & Background Timer
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                  <Wifi className="w-3 h-3" />
                  Background-Safe
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Stopwatch di tab Overview memakai timestamp perangkat sehingga
                waktu tetap akurat walau HP dikunci atau tab ditutup.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600">
            <div className="font-semibold text-slate-900">
              Akses dari HP via Wi-Fi Lokal:
            </div>
            <p>
              Atau langsung buka{' '}
              <strong className="text-rose-700">nihongotracker.my.id</strong>{' '}
              dari HP Anda, atau jalankan lokal dengan:
            </p>
            <code className="block px-3 py-2 rounded-lg bg-white border border-slate-200 font-mono text-rose-700">
              npm run dev:host
            </code>
          </div>

          {installPrompt ? (
            <button
              type="button"
              onClick={handleInstallPwa}
              className="btn-crimson w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Install sebagai Aplikasi (PWA)
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900">Tips Install di HP:</strong> Di
              Chrome Android ketuk menu <strong>⋮ → Install app</strong>, atau
              di Safari iOS ketuk <strong>Share → Add to Home Screen</strong>{' '}
              agar ImmersionTrack tampil full-screen seperti aplikasi native.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
