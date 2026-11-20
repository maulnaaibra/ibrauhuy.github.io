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
      {/* Windows Companion Agent */}
      <section className="surface p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg border shrink-0 ${
                connected
                  ? 'bg-[#14291f] border-[#214a36] text-[#5cd697]'
                  : 'bg-[#1b1e23] border-[#282c35] text-[#9aa0ac]'
              }`}
            >
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-[#ededef]">
                  Windows Desktop Companion Agent
                </h3>
                {connected ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#14291f] border border-[#214a36] text-[11px] font-medium text-[#5cd697]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2eb872]" />
                    Terhubung · {companionStatus?.deviceName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1b1e23] border border-[#282c35] text-[11px] text-[#9aa0ac]">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-[#9aa0ac] mt-1">
                Deteksi otomatis media aktif di Windows (MPV, VLC, Anki,
                YouTube, Netflix, Manga, VN) meskipun browser ditutup.
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
              className="input-field px-3 py-1.5 text-xs font-mono w-52"
            />
            <button
              type="submit"
              disabled={companionChecking}
              className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
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
          <div className="space-y-5 pt-4 border-t border-[#242730]">
            {/* Hairline split instead of nested boxes */}
            <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#242730] bg-[#121316] border border-[#242730] rounded-lg">
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9aa0ac] flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#5cd697]" />
                    Jendela Aktif Saat Ini
                  </span>
                  <span className="font-mono text-[#6c727f] tabular-nums">
                    Idle {companionStatus.lastWindow.idleSeconds}d
                  </span>
                </div>
                <div className="text-sm font-medium text-[#ededef] truncate">
                  {companionStatus.lastWindow.title || '(Tidak ada judul)'}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#6c727f]">
                  <span className="px-2 py-0.5 rounded bg-[#1b1e23] border border-[#282c35] font-mono text-[#9aa0ac]">
                    {companionStatus.lastWindow.process || 'unknown'}
                  </span>
                  <span className="truncate">
                    {companionStatus.lastWindow.matchedRule
                      ? `Cocok: ${companionStatus.lastWindow.matchedRule}`
                      : 'Tidak cocok aturan immersion'}
                  </span>
                </div>
              </div>

              <div className="p-4 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9aa0ac]">Sesi di Background</span>
                  {activeSession && activeMeta ? (
                    <span className="text-[#ededef] font-medium">
                      {activeMeta.label}
                    </span>
                  ) : (
                    <span className="text-[#6c727f]">Standby</span>
                  )}
                </div>

                {activeSession ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#ededef] truncate">
                        {activeSession.title}
                      </div>
                      <div className="text-xs font-mono text-[#5cd697] mt-0.5">
                        +
                        {calculateXp(
                          activeSession.category,
                          Math.max(
                            1,
                            Math.round(activeSession.activeSeconds / 60)
                          ),
                          0
                        )}{' '}
                        XP est.
                      </div>
                    </div>
                    <div className="text-xl font-mono font-semibold text-[#5cd697] tabular-nums shrink-0">
                      {formatDurationSec(activeSession.activeSeconds)}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#6c727f]">
                    Buka MPV, VLC, Anki, atau konten sesuai aturan di bawah agar
                    agent mulai menghitung otomatis.
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={handleToggleTracking}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 border cursor-pointer ${
                      companionStatus.trackingEnabled
                        ? 'bg-[#262013] text-[#e5b55c] border-[#3d331d]'
                        : 'bg-[#14291f] text-[#5cd697] border-[#214a36]'
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
                      className="btn-primary px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Sesi
                    </button>
                  )}

                  {companionStatus.pendingCount > 0 && (
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={handlePullPending}
                      className="px-3 py-1.5 rounded-md bg-[#19382a] hover:bg-[#1f4735] border border-[#245940] text-xs font-medium text-[#7ae2ac] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      Tarik {companionStatus.pendingCount} Sesi Pending
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-[#ededef]">
                <input
                  type="checkbox"
                  checked={companionAutoSync}
                  onChange={(e) => onToggleCompanionAutoSync(e.target.checked)}
                  className="accent-[#2eb872] w-4 h-4 rounded"
                />
                <span>
                  Auto-sync otomatis setiap kali sesi dari PC selesai
                </span>
              </label>

              <div className="flex items-center gap-4 text-[#9aa0ac] font-mono tabular-nums">
                <span>
                  Idle pause:{' '}
                  <span className="text-[#ededef]">
                    {Math.round(
                      companionStatus.config.idleThresholdSeconds / 60
                    )}
                    m
                  </span>
                </span>
                <span>
                  Min sesi:{' '}
                  <span className="text-[#ededef]">
                    {companionStatus.config.minSessionMinutes}m
                  </span>
                </span>
              </div>
            </div>

            {/* Detection rules */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-[#9aa0ac]">
                Aturan Deteksi ({companionStatus.config.rules.length})
              </h4>

              <form
                onSubmit={handleAddRule}
                className="grid sm:grid-cols-12 gap-2"
              >
                <input
                  type="text"
                  required
                  placeholder="Nama (mis. Bilibili)"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="input-field sm:col-span-3 px-3 py-2 text-xs"
                />
                <select
                  value={newRuleMatchType}
                  onChange={(e) =>
                    setNewRuleMatchType(e.target.value as 'process' | 'title')
                  }
                  className="input-field sm:col-span-2 px-2.5 py-2 text-xs"
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
                  className="input-field sm:col-span-3 px-3 py-2 text-xs font-mono"
                />
                <select
                  value={newRuleCategory}
                  onChange={(e) =>
                    setNewRuleCategory(e.target.value as PrimaryMediaCategory)
                  }
                  className="input-field sm:col-span-2 px-2.5 py-2 text-xs"
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
                  className="btn-primary sm:col-span-2 px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah
                </button>
              </form>

              <div className="grid md:grid-cols-2 gap-2">
                {companionStatus.config.rules.map((rule) => {
                  const meta = getCategoryMeta(rule.category);
                  return (
                    <div
                      key={rule.id}
                      className="px-3 py-2.5 rounded-lg bg-[#121316] border border-[#242730] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="text-xs font-medium text-[#ededef] truncate">
                            {rule.name}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#6c727f] truncate">
                          [{rule.matchType}] /{rule.pattern}/i →{' '}
                          {meta.shortLabel}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer ${
                            rule.enabled
                              ? 'bg-[#14291f] text-[#5cd697] border-[#214a36]'
                              : 'bg-[#1b1e23] text-[#6c727f] border-[#282c35]'
                          }`}
                        >
                          {rule.enabled ? 'Aktif' : 'Nonaktif'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          title="Hapus aturan"
                          aria-label={`Hapus aturan ${rule.name}`}
                          className="p-1 rounded text-[#6c727f] hover:text-[#e57373] cursor-pointer"
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

        <div className="border-t border-[#242730] pt-3">
          <button
            type="button"
            onClick={() => setShowCompanionGuide(!showCompanionGuide)}
            className="text-xs font-medium text-[#9aa0ac] hover:text-[#ededef] flex items-center gap-1.5 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            Cara menjalankan background agent di Windows
            {showCompanionGuide ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showCompanionGuide && (
            <div className="mt-3 p-4 rounded-lg bg-[#121316] border border-[#242730] text-xs text-[#9aa0ac] space-y-2">
              <p>
                1. Jalankan di terminal folder proyek:{' '}
                <code className="px-1.5 py-0.5 rounded bg-[#1b1e23] border border-[#282c35] font-mono text-[#ededef]">
                  npm run tracker
                </code>
              </p>
              <p>
                2. Atau klik ganda{' '}
                <code className="px-1.5 py-0.5 rounded bg-[#1b1e23] border border-[#282c35] font-mono text-[#ededef]">
                  companion\start-hidden.vbs
                </code>{' '}
                agar berjalan diam-diam tanpa jendela CMD.
              </p>
              <p>
                3. Agar otomatis jalan saat startup: tekan{' '}
                <code className="font-mono text-[#ededef]">Win + R</code> →
                ketik{' '}
                <code className="font-mono text-[#ededef]">shell:startup</code>{' '}
                → simpan shortcut{' '}
                <code className="font-mono text-[#ededef]">
                  start-hidden.vbs
                </code>{' '}
                di sana.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* AnkiConnect & Mobile PWA */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="surface p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg border shrink-0 ${
                ankiCheck?.connected
                  ? 'bg-[#14291f] border-[#214a36] text-[#5cd697]'
                  : 'bg-[#1b1e23] border-[#282c35] text-[#9aa0ac]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-[#ededef]">
                  Integrasi AnkiConnect
                </h3>
                {ankiCheck?.connected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#14291f] border border-[#214a36] text-[11px] font-medium text-[#5cd697]">
                    <CheckCircle2 className="w-3 h-3" />v{ankiCheck.version}
                    {ankiCheck.viaProxy ? ' (via Agent)' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#9aa0ac] mt-1">
                Tarik jumlah review dan kartu baru hari ini langsung dari Anki
                PC.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={ankiSettings.url}
              onChange={(e) => updateAnkiSetting({ url: e.target.value })}
              aria-label="URL AnkiConnect"
              className="input-field flex-1 px-3 py-2 text-xs font-mono"
            />
            <button
              type="button"
              disabled={checkingAnki}
              onClick={handleTestAnki}
              className="btn-primary px-3.5 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checkingAnki ? 'animate-spin' : ''}`}
              />
              Test
            </button>
          </div>

          {ankiCheck?.connected && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[#9aa0ac] mb-1">
                    Filter Deck Kartu Baru
                  </label>
                  <select
                    value={ankiSettings.selectedDeck}
                    onChange={(e) =>
                      updateAnkiSetting({ selectedDeck: e.target.value })
                    }
                    className="input-field w-full px-3 py-2 text-xs"
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
                  <label className="block text-[11px] text-[#9aa0ac] mb-1">
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
                    className="input-field w-full px-3 py-2 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              {ankiStats && (
                <div className="grid grid-cols-3 divide-x divide-[#242730] bg-[#121316] border border-[#242730] rounded-lg py-3 text-center">
                  <div>
                    <div className="text-[11px] text-[#9aa0ac]">Kartu Baru</div>
                    <div className="text-base font-semibold font-mono text-[#ededef] mt-0.5 tabular-nums">
                      +{ankiStats.newCardsToday}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#9aa0ac]">Review</div>
                    <div className="text-base font-semibold font-mono text-[#ededef] mt-0.5 tabular-nums">
                      {ankiStats.reviewsToday}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#9aa0ac]">Est. Waktu</div>
                    <div className="text-base font-semibold font-mono text-[#5cd697] mt-0.5 tabular-nums">
                      {ankiStats.estimatedMinutes}m
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={syncingAnki}
                onClick={handleSyncAnki}
                className="btn-primary w-full py-2 rounded-lg text-xs font-medium cursor-pointer"
              >
                {syncingAnki
                  ? 'Menyinkronkan...'
                  : 'Sinkronkan Anki Hari Ini ke Log'}
              </button>
            </div>
          )}

          <div className="border-t border-[#242730] pt-3">
            <button
              type="button"
              onClick={() => setShowAnkiGuide(!showAnkiGuide)}
              className="text-xs font-medium text-[#9aa0ac] hover:text-[#ededef] flex items-center gap-1.5 cursor-pointer"
            >
              Setup Add-on AnkiConnect (Kode: 2055492159)
              {showAnkiGuide ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showAnkiGuide && (
              <div className="mt-2.5 p-3.5 rounded-lg bg-[#121316] border border-[#242730] text-xs text-[#9aa0ac] space-y-1.5">
                <p>1. Buka Anki → Tools → Add-ons → Get Add-ons...</p>
                <p>
                  2. Masukkan kode{' '}
                  <strong className="text-[#ededef] font-mono">
                    2055492159
                  </strong>{' '}
                  lalu restart Anki.
                </p>
                <p>
                  3. Jika Windows Companion Agent sedang aktif, web ini otomatis
                  mem-proxy koneksi Anki tanpa perlu edit CORS di Anki.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="surface p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[#1b1e23] border border-[#282c35] text-[#9aa0ac] shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-[#ededef]">
                  HP (Android / iOS) & Background Timer
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#14291f] border border-[#214a36] text-[11px] font-medium text-[#5cd697]">
                  <Wifi className="w-3 h-3" />
                  Background-Safe
                </span>
              </div>
              <p className="text-xs text-[#9aa0ac] mt-1">
                Stopwatch memakai timestamp perangkat sehingga waktu tetap
                akurat walaupun HP dikunci atau tab ditutup.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#121316] border border-[#242730] space-y-2 text-xs text-[#9aa0ac]">
            <div className="font-medium text-[#ededef]">
              Akses dari HP via Browser / Wi-Fi Lokal
            </div>
            <p>
              Buka{' '}
              <span className="text-[#ededef] font-mono">
                nihongotracker.my.id
              </span>{' '}
              langsung dari HP Anda, atau jalankan lokal dengan:
            </p>
            <code className="block px-3 py-2 rounded bg-[#16181c] border border-[#242730] font-mono text-[#ededef]">
              npm run dev:host
            </code>
          </div>

          {installPrompt ? (
            <button
              type="button"
              onClick={handleInstallPwa}
              className="btn-primary w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Install sebagai Aplikasi (PWA)
            </button>
          ) : (
            <div className="p-3.5 rounded-lg bg-[#121316] border border-[#242730] text-xs text-[#9aa0ac] leading-relaxed">
              <strong className="text-[#ededef] font-medium">
                Install di HP:
              </strong>{' '}
              Di Chrome Android pilih menu{' '}
              <span className="text-[#ededef]">⋮ → Install app</span>, atau di
              Safari iOS pilih{' '}
              <span className="text-[#ededef]">Share → Add to Home Screen</span>{' '}
              agar tampil full-screen seperti aplikasi native.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
