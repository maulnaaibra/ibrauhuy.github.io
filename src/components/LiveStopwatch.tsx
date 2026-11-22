import React, { useEffect, useState } from 'react';
import {
  Crosshair,
  Laptop,
  Pause,
  Pin,
  PinOff,
  Play,
  RefreshCw,
  Save,
  Settings2,
  WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  flushCompanionSession,
  pinCompanionWindow,
  toggleCompanionApp,
  toggleCompanionTracking,
  unpinCompanionWindow,
  type CompanionStatus,
  type OpenWindowItem,
  type PendingTrackedSession,
} from '../lib/companionClient';
import {
  CATEGORY_META,
  PRIMARY_CATEGORIES,
  getCategoryMeta,
  type PrimaryMediaCategory,
} from '../types';

interface LiveStopwatchProps {
  companionUrl: string;
  companionStatus: CompanionStatus | null;
  onRefreshCompanion: () => Promise<void>;
  onImportPending: (
    sessions: PendingTrackedSession[],
    notify?: boolean
  ) => Promise<void>;
  onOpenDevicesTab: () => void;
}

export const LiveStopwatch: React.FC<LiveStopwatchProps> = ({
  companionUrl,
  companionStatus,
  onRefreshCompanion,
  onImportPending,
  onOpenDevicesTab,
}) => {
  const [busy, setBusy] = useState(false);
  const [selectedHwnd, setSelectedHwnd] = useState<string>('');
  const [selectedCategory, setSelectedCategory] =
    useState<PrimaryMediaCategory>('light_novel');

  const connected = Boolean(companionStatus?.ok);
  const trackingEnabled = Boolean(companionStatus?.trackingEnabled);
  const activeSession = companionStatus?.activeSession ?? null;
  const openWindows = companionStatus?.openWindows ?? [];
  const pinnedTarget = companionStatus?.pinnedTarget ?? null;

  // Smooth 1-second local ticker synced with companionStatus.activeSession
  const [liveSec, setLiveSec] = useState<number>(
    activeSession?.activeSeconds ?? 0
  );

  useEffect(() => {
    setLiveSec(activeSession?.activeSeconds ?? 0);
  }, [
    activeSession?.activeSeconds,
    activeSession?.title,
    activeSession?.startedAt,
  ]);

  useEffect(() => {
    if (!connected || !trackingEnabled || !activeSession) return;
    const timer = setInterval(() => {
      setLiveSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [connected, trackingEnabled, activeSession]);

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const handleToggleMaster = async () => {
    if (!companionStatus) return;
    setBusy(true);
    try {
      const nextState = !companionStatus.trackingEnabled;
      await toggleCompanionTracking(companionUrl, nextState);
      await onRefreshCompanion();
      toast.success(
        nextState
          ? 'Windows Companion diaktifkan!'
          : 'Windows Companion di-pause'
      );
    } catch {
      toast.error('Gagal mengubah status Windows Companion');
    } finally {
      setBusy(false);
    }
  };

  const handleFlushNow = async () => {
    setBusy(true);
    try {
      const res = await flushCompanionSession(companionUrl);
      if (res.pending.length > 0) {
        await onImportPending(res.pending, true);
      } else {
        toast('Belum ada sesi aktif untuk disimpan.');
      }
      await onRefreshCompanion();
    } catch {
      toast.error('Gagal menyimpan sesi sekarang');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleApp = async (win: OpenWindowItem) => {
    const nextEnabled = !win.appEnabled;
    setBusy(true);
    try {
      await toggleCompanionApp(companionUrl, {
        process: win.process,
        title: win.title,
        category: win.matchedCategory ?? selectedCategory,
        enabled: nextEnabled,
      });
      await onRefreshCompanion();
      toast.success(
        nextEnabled
          ? `${win.process} diaktifkan untuk auto-track`
          : `${win.process} dimatikan dari auto-track`
      );
    } catch {
      toast.error('Gagal mengubah status aplikasi');
    } finally {
      setBusy(false);
    }
  };

  const handleLockSelectedWindow = async () => {
    const targetWin =
      openWindows.find((w) => String(w.hwnd) === selectedHwnd) ??
      openWindows[0];
    if (!targetWin) return;
    setBusy(true);
    try {
      await pinCompanionWindow(companionUrl, {
        hwnd: targetWin.hwnd,
        process: targetWin.process,
        title: targetWin.title,
        category: targetWin.matchedCategory ?? selectedCategory,
      });
      await onRefreshCompanion();
      toast.success(
        `Fokus merekam: ${targetWin.title} (${targetWin.process})`
      );
    } catch {
      toast.error('Gagal mengunci jendela');
    } finally {
      setBusy(false);
    }
  };

  const handleUnpin = async () => {
    setBusy(true);
    try {
      await unpinCompanionWindow(companionUrl);
      await onRefreshCompanion();
      toast.success('Kembali ke mode auto-detect');
    } catch {
      toast.error('Gagal melepas kunci jendela');
    } finally {
      setBusy(false);
    }
  };

  const activeMeta = activeSession
    ? getCategoryMeta(activeSession.category)
    : null;

  return (
    <div className="card-pro p-5 space-y-4 border-emerald-200/90">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Status & Real-Time Digital Counter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
          <div className="shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  !connected
                    ? 'bg-slate-300'
                    : !trackingEnabled
                      ? 'bg-amber-500'
                      : activeSession
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-emerald-400'
                }`}
              />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                Windows Companion Aktif Merekam
              </span>
              {connected ? (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    trackingEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {trackingEnabled
                    ? `ON • ${companionStatus?.deviceName}`
                    : 'PAUSED'}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3 mt-1">
              <div
                className={`text-3xl font-mono font-extrabold tabular-nums tracking-tight ${
                  activeSession && trackingEnabled
                    ? 'text-emerald-600'
                    : 'text-slate-900'
                }`}
              >
                {formatTime(activeSession ? liveSec : 0)}
              </div>
            </div>
          </div>

          {/* Middle: Active Recording Info or Quick Window Selector */}
          <div className="flex-1 min-w-0 space-y-2">
            {connected ? (
              activeSession && trackingEnabled ? (
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/90 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-mono text-[10px] font-bold">
                        {activeSession.process}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-800">
                        {activeMeta?.label ?? activeSession.category}
                      </span>
                      <span className="text-[10px] text-emerald-700/80">
                        • Auto-sync ke log setiap 1 menit
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">
                      {activeSession.title}
                    </div>
                  </div>

                  {pinnedTarget && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleUnpin()}
                      className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <PinOff className="w-3 h-3" />
                      Auto
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                  {trackingEnabled ? (
                    <span>
                      <strong>Standby:</strong> Nyalakan tombol{' '}
                      <strong>ON</strong> pada aplikasi di bawah atau pilih
                      jendela untuk mulai merekam otomatis.
                    </span>
                  ) : (
                    <span>
                      <strong>Tracking Di-Pause:</strong> Klik tombol{' '}
                      <strong>Aktifkan Companion</strong> di sebelah kanan untuk
                      mulai merekam aplikasi Windows Anda.
                    </span>
                  )}
                </div>
              )
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between gap-2">
                <span>
                  Windows Companion Agent belum terdeteksi di{' '}
                  <code className="font-mono text-rose-600">
                    {companionUrl}
                  </code>
                  .
                </span>
                <button
                  type="button"
                  onClick={() => void onRefreshCompanion()}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Cek
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Master Toggle ON/OFF, Save Now, & Manage Devices */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {connected && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleToggleMaster()}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 transition cursor-pointer ${
                trackingEnabled
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              {trackingEnabled ? (
                <>
                  <Pause className="w-4 h-4" />
                  Matikan / Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Aktifkan Companion
                </>
              )}
            </button>
          )}

          {connected && activeSession && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleFlushNow()}
              className="btn-crimson px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Simpan Sekarang ({Math.max(1, Math.round(liveSec / 60))}m)
            </button>
          )}

          <button
            type="button"
            onClick={onOpenDevicesTab}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-rose-600" />
            <span>Atur Aplikasi ({openWindows.length})</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Instant App ON/OFF Toggles & Manual Window Picker */}
      {connected && openWindows.length > 0 && (
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick ON/OFF Chips for Open Windows */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Laptop className="w-3.5 h-3.5 text-rose-600" />
              Pilih App (ON/OFF):
            </span>
            {openWindows.slice(0, 6).map((win) => {
              const isOn = Boolean(win.appEnabled);
              return (
                <button
                  key={`${win.process}-${win.hwnd}`}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleToggleApp(win)}
                  title={`${win.title} (${
                    isOn ? 'Klik untuk OFF' : 'Klik untuk ON'
                  })`}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                    win.isTracked
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                      : isOn
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      win.isTracked
                        ? 'bg-white animate-ping'
                        : isOn
                          ? 'bg-emerald-500'
                          : 'bg-slate-400'
                    }`}
                  />
                  <span>{win.process}</span>
                  <span
                    className={`text-[10px] font-mono px-1 rounded ${
                      win.isTracked || isOn
                        ? 'bg-black/15 text-current'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isOn ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Direct Window Focus Picker */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <select
              value={selectedHwnd || String(openWindows[0]?.hwnd ?? '')}
              onChange={(e) => {
                setSelectedHwnd(e.target.value);
                const w = openWindows.find(
                  (item) => String(item.hwnd) === e.target.value
                );
                if (w?.matchedCategory) {
                  setSelectedCategory(w.matchedCategory);
                }
              }}
              aria-label="Pilih jendela terbuka di Windows"
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 max-w-52 truncate focus:outline-none focus:border-rose-500"
            >
              {openWindows.map((w) => (
                <option key={w.hwnd} value={String(w.hwnd)}>
                  [{w.process}] {w.title.slice(0, 38)}
                </option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(e.target.value as PrimaryMediaCategory)
              }
              aria-label="Pilih kategori tracking"
              className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-rose-500"
            >
              {PRIMARY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_META[cat].shortLabel}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleLockSelectedWindow()}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
            >
              {pinnedTarget ? (
                <>
                  <Crosshair className="w-3.5 h-3.5" />
                  Ganti Fokus
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5" />
                  Fokus Track
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
