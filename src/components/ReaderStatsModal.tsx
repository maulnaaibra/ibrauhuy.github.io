import React, { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Clock,
  Flame,
  Gauge,
  History,
  Pause,
  Play,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { StoredNovelBook } from '../lib/epubReaderStore';
import {
  classifyReadingPace,
  clearAllReaderStats,
  computeCharsPerHour,
  formatEstimatedRemaining,
  formatReaderDurationShort,
  formatStopwatchClock,
  getReaderSummary,
  READER_STATS_CHANGED_EVENT,
  type ReaderSpeedSample,
} from '../lib/readerStatsStore';

interface ThemeStyleLite {
  panel: string;
  subtleBtn: string;
  mutedText: string;
  accentText: string;
}

interface ReaderStatsModalProps {
  open: boolean;
  onClose: () => void;
  book: StoredNovelBook | null;
  readCharsInBook: number;
  chapterRemainingChars: number;
  bookPct: number;
  sessionCharsRead: number;
  sessionActiveSec: number;
  sessionCph: number;
  rollingCph: number;
  speedSamples: ReaderSpeedSample[];
  isPaused: boolean;
  isIdle: boolean;
  showSpeedHud: boolean;
  onToggleShowSpeedHud: () => void;
  onTogglePause: () => void;
  onResetSession: () => void;
  onLogSessionToTracker: (minutes: number) => void;
  onJumpChapter: (chapterIdx: number) => void;
  themeStyle: ThemeStyleLite;
}

export const ReaderStatsModal: React.FC<ReaderStatsModalProps> = ({
  open,
  onClose,
  book,
  readCharsInBook,
  chapterRemainingChars,
  bookPct,
  sessionCharsRead,
  sessionActiveSec,
  sessionCph,
  rollingCph,
  speedSamples,
  isPaused,
  isIdle,
  showSpeedHud,
  onToggleShowSpeedHud,
  onTogglePause,
  onResetSession,
  onLogSessionToTracker,
  onJumpChapter,
  themeStyle,
}) => {
  const [tab, setTab] = useState<'trends' | 'chapters' | 'history'>('trends');
  const [confirmClearStats, setConfirmClearStats] = useState(false);
  const [statsVersion, setStatsVersion] = useState(0);

  useEffect(() => {
    const onChanged = () => setStatsVersion((v) => v + 1);
    window.addEventListener(READER_STATS_CHANGED_EVENT, onChanged);
    return () =>
      window.removeEventListener(READER_STATS_CHANGED_EVENT, onChanged);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  void statsVersion;
  const summary = getReaderSummary(book?.storageKey);
  const totalBookChars = book?.totalChars ?? 0;
  const remainingBookChars = Math.max(0, totalBookChars - readCharsInBook);

  const lifetimeCph = summary.bookLifetime
    ? computeCharsPerHour(
        summary.bookLifetime.totalCharsRead,
        summary.bookLifetime.totalActiveSec
      )
    : 0;
  const effectiveEtaCph =
    sessionCph >= 100
      ? sessionCph
      : rollingCph >= 100
        ? rollingCph
        : lifetimeCph >= 100
          ? lifetimeCph
          : summary.allTimeAvgCph;

  const charsPerMin =
    sessionCph > 0 ? Math.round(sessionCph / 60) : Math.round(rollingCph / 60);
  const paceMeta = classifyReadingPace(sessionCph || rollingCph);
  const activeMinutesForLog = Math.max(1, Math.round(sessionActiveSec / 60));

  // Build SVG path for real-time speed curve
  const speedPoints =
    speedSamples.length >= 2
      ? speedSamples
      : sessionCharsRead > 0 && sessionActiveSec >= 5
        ? [
            { elapsedSec: 0, totalChars: 0, instantCph: sessionCph, avgCph: sessionCph },
            {
              elapsedSec: sessionActiveSec,
              totalChars: sessionCharsRead,
              instantCph: rollingCph || sessionCph,
              avgCph: sessionCph,
            },
          ]
        : [];

  const maxGraphCph = Math.max(
    4000,
    ...speedPoints.map((p) => Math.max(p.instantCph, p.avgCph))
  );
  const svgW = 360;
  const svgH = 110;
  const padX = 8;
  const padY = 12;

  const buildPolyline = (pick: (s: ReaderSpeedSample) => number): string => {
    if (speedPoints.length < 2) return '';
    const lastIdx = speedPoints.length - 1;
    return speedPoints
      .map((pt, i) => {
        const x = padX + (i / lastIdx) * (svgW - padX * 2);
        const norm = Math.min(1, Math.max(0, pick(pt) / maxGraphCph));
        const y = svgH - padY - norm * (svgH - padY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const instantLinePoints = buildPolyline((p) => p.instantCph);
  const avgLinePoints = buildPolyline((p) => p.avgCph);
  const maxDailyChars = Math.max(1000, ...summary.last14Days.map((d) => d.charsRead));

  // Chapter cumulative offsets for Chapter Progress tab
  const chapterRows = (() => {
    if (!book) return [];
    let runningBefore = 0;
    return book.chapters.map((ch, idx) => {
      const chChars = ch.charCount ?? 0;
      let pct = 0;
      if (idx < book.currentChapter) {
        pct = 100;
      } else if (idx === book.currentChapter && chChars > 0) {
        const readInCh = Math.max(0, readCharsInBook - runningBefore);
        pct = Math.min(100, Math.round((readInCh / chChars) * 100));
      }
      runningBefore += chChars;
      return {
        idx,
        title: ch.title || `Bab ${idx + 1}`,
        chChars,
        pct,
        estMinutes:
          effectiveEtaCph >= 100 && chChars > 0
            ? Math.max(1, Math.round((chChars / effectiveEtaCph) * 60))
            : null,
      };
    });
  })();

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Statistik & Kecepatan Membaca"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl max-h-[90dvh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-scale-in ${themeStyle.panel}`}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-current/12 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Gauge className={`w-4 h-4 shrink-0 ${themeStyle.accentText}`} />
              <h2 className="text-sm sm:text-base font-black tracking-tight">
                Statistik &amp; Kecepatan Baca
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                  isPaused
                    ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                    : isIdle
                      ? 'bg-slate-500/20 border-slate-400/35 text-slate-300'
                      : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                }`}
              >
                {isPaused
                  ? 'Dijeda'
                  : isIdle
                    ? 'Idle (Auto-Pause)'
                    : 'Tracking Aktif'}
              </span>
            </div>
            {book && (
              <div className={`text-[11px] truncate mt-0.5 ${themeStyle.mutedText}`}>
                {book.title} • {bookPct}% selesai
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onTogglePause}
              title={isPaused ? 'Lanjutkan stopwatch sesi' : 'Jeda stopwatch sesi'}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Lanjut</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-300" />
                  <span>Jeda</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onResetSession}
              title="Mulai ulang penghitung kecepatan sesi ini"
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Sesi</span>
            </button>
            <button
              type="button"
              onClick={() => onLogSessionToTracker(activeMinutesForLog)}
              title="Simpan durasi aktif sesi ini ke Dashboard Immersion Log"
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer hover:bg-emerald-400 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Catat {activeMinutesForLog}m</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Statistik"
              className="p-1.5 rounded-xl opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {/* HUD Speed Widget Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl border border-current/12 bg-black/15">
            <div className="text-[11px]">
              <span className="font-bold">Mini HUD Kecepatan Melayang</span>
              <span className={`ml-1.5 ${themeStyle.mutedText}`}>
                Tampilkan badge live speed &amp; ETA di pojok saat membaca
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleShowSpeedHud}
              className={`px-3 py-1 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${
                showSpeedHud
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : themeStyle.subtleBtn
              }`}
            >
              {showSpeedHud ? 'HUD: AKTIF' : 'HUD: MATI'}
            </button>
          </div>

          {/* 4 Hero Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Speed */}
            <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-sky-300">
                <span>Kecepatan Sesi</span>
                <Gauge className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono leading-tight">
                {sessionCph > 0
                  ? sessionCph.toLocaleString('id-ID')
                  : rollingCph > 0
                    ? rollingCph.toLocaleString('id-ID')
                    : '—'}
                <span className="text-[11px] font-bold ml-1 opacity-80">
                  huruf/j
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[10px]">
                <span className={`font-extrabold ${paceMeta.colorClass}`}>
                  {paceMeta.label}
                </span>
                {charsPerMin > 0 && (
                  <span className="font-mono opacity-80">
                    ~{charsPerMin.toLocaleString('id-ID')}/mnt
                  </span>
                )}
              </div>
              {rollingCph > 0 && rollingCph !== sessionCph && (
                <div className={`text-[10px] font-mono ${themeStyle.mutedText}`}>
                  1 mnt terakhir: {rollingCph.toLocaleString('id-ID')}/j
                </div>
              )}
            </div>

            {/* Active Time & Chars */}
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <span>Sesi Ini</span>
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono leading-tight">
                +{sessionCharsRead.toLocaleString('id-ID')}
                <span className="text-[11px] font-bold ml-1 opacity-80">
                  huruf
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-emerald-300 font-bold">
                  Waktu: {formatStopwatchClock(sessionActiveSec)}
                </span>
              </div>
              {summary.bookLifetime && (
                <div className={`text-[10px] ${themeStyle.mutedText}`}>
                  Total buku ini:{' '}
                  {summary.bookLifetime.totalCharsRead.toLocaleString('id-ID')} huruf
                </div>
              )}
            </div>

            {/* ETA */}
            <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-violet-300">
                <span>Estimasi Selesai</span>
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <div className="text-base sm:text-lg font-black leading-snug">
                {formatEstimatedRemaining(remainingBookChars, effectiveEtaCph)}
              </div>
              <div className={`text-[10px] ${themeStyle.mutedText}`}>
                Sisa buku: {remainingBookChars.toLocaleString('id-ID')} huruf
              </div>
              <div className="text-[10px] font-semibold text-violet-200">
                Bab ini: {formatEstimatedRemaining(chapterRemainingChars, effectiveEtaCph)}
              </div>
            </div>

            {/* Today & Record */}
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-amber-300">
                <span>Hari Ini &amp; Rekor</span>
                <Flame className="w-3.5 h-3.5" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono leading-tight">
                {summary.todayChars.toLocaleString('id-ID')}
                <span className="text-[11px] font-bold ml-1 opacity-80">
                  huruf
                </span>
              </div>
              <div className={`text-[10px] ${themeStyle.mutedText}`}>
                {formatReaderDurationShort(summary.todaySec)}
                {summary.todayCph > 0
                  ? ` • ${summary.todayCph.toLocaleString('id-ID')}/j`
                  : ''}
              </div>
              <div className="text-[10px] font-bold text-amber-200 inline-flex items-center gap-1">
                <Award className="w-3 h-3 shrink-0" />
                <span>
                  Rekor:{' '}
                  {summary.bestCph > 0
                    ? `${summary.bestCph.toLocaleString('id-ID')}/j`
                    : 'Belum tercatat'}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'trends', label: 'Grafik Kecepatan' },
                { id: 'chapters', label: `Bab (${book?.chapters.length ?? 0})` },
                { id: 'history', label: `Riwayat (${summary.recentSessions.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                  tab === t.id
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: REAL-TIME SPEED CHART & 14-DAY ACTIVITY */}
          {tab === 'trends' && (
            <div className="space-y-3">
              {/* Live Speed Curve */}
              <div className="rounded-2xl border border-current/12 bg-black/15 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold inline-flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    <span>Grafik Kecepatan Membaca Sesi Ini</span>
                  </span>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="inline-flex items-center gap-1 text-sky-300">
                      <span className="w-2.5 h-0.5 bg-sky-400 inline-block" />
                      Saat Ini
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                      Rata-rata
                    </span>
                  </div>
                </div>

                {speedPoints.length >= 2 ? (
                  <div className="w-full">
                    <svg
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      className="w-full h-28 overflow-visible"
                    >
                      {[0.25, 0.5, 0.75, 1].map((frac) => {
                        const y = svgH - padY - frac * (svgH - padY * 2);
                        return (
                          <g key={frac}>
                            <line
                              x1={padX}
                              y1={y}
                              x2={svgW - padX}
                              y2={y}
                              stroke="currentColor"
                              strokeOpacity={0.12}
                              strokeDasharray="3 3"
                            />
                            <text
                              x={padX}
                              y={y - 2}
                              fill="currentColor"
                              fillOpacity={0.45}
                              fontSize="8"
                              fontFamily="monospace"
                            >
                              {Math.round((maxGraphCph * frac) / 1000)}k
                            </text>
                          </g>
                        );
                      })}
                      {avgLinePoints && (
                        <polyline
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="1.75"
                          strokeDasharray="4 2"
                          points={avgLinePoints}
                        />
                      )}
                      {instantLinePoints && (
                        <polyline
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={instantLinePoints}
                        />
                      )}
                    </svg>
                    <div className={`flex justify-between text-[10px] font-mono ${themeStyle.mutedText}`}>
                      <span>Mulai</span>
                      <span>Puncak grafik: {maxGraphCph.toLocaleString('id-ID')} huruf/jam</span>
                      <span>{formatStopwatchClock(sessionActiveSec)}</span>
                    </div>
                  </div>
                ) : (
                  <div className={`py-7 text-center text-xs ${themeStyle.mutedText}`}>
                    Mulai membaca sekitar ~15–20 detik agar grafik kecepatan sesi terbentuk otomatis.
                  </div>
                )}
              </div>

              {/* 14-Day Reading Volume Chart */}
              <div className="rounded-2xl border border-current/12 bg-black/15 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span>Volume Baca 14 Hari Terakhir</span>
                  <span className={`text-[10px] font-mono ${themeStyle.mutedText}`}>
                    Total: {summary.allTimeChars.toLocaleString('id-ID')} huruf
                  </span>
                </div>
                <div
                  className="grid gap-1 items-end h-24 pt-2"
                  style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}
                >
                  {summary.last14Days.map((day) => {
                    const pctH =
                      day.charsRead > 0
                        ? Math.max(8, Math.round((day.charsRead / maxDailyChars) * 100))
                        : 4;
                    return (
                      <div
                        key={day.dateStr}
                        title={`${day.label}: ${day.charsRead.toLocaleString('id-ID')} huruf (${formatReaderDurationShort(day.activeSec)})${day.cph > 0 ? ` • ${day.cph.toLocaleString('id-ID')}/j` : ''}`}
                        className="h-full flex flex-col items-center justify-end gap-1 group"
                      >
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className={`w-full rounded-t-md transition-all ${
                              day.charsRead > 0
                                ? 'bg-sky-400/80 group-hover:bg-sky-300'
                                : 'bg-current/10'
                            }`}
                            style={{ height: `${pctH}%` }}
                          />
                        </div>
                        <span className={`text-[8px] font-mono ${themeStyle.mutedText}`}>
                          {day.label.split('/')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHAPTER PROGRESS & TIME ESTIMATES */}
          {tab === 'chapters' && (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {chapterRows.length === 0 ? (
                <div className={`py-8 text-center text-xs ${themeStyle.mutedText}`}>
                  Belum ada buku yang sedang dibuka.
                </div>
              ) : (
                chapterRows.map((ch) => {
                  const isCurrent = book?.currentChapter === ch.idx;
                  return (
                    <button
                      key={`stat-ch-${ch.idx}`}
                      type="button"
                      onClick={() => {
                        onJumpChapter(ch.idx);
                        onClose();
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition cursor-pointer space-y-1.5 ${
                        isCurrent
                          ? 'bg-sky-500/15 border-sky-400/45'
                          : 'border-current/12 bg-black/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold ${
                              isCurrent
                                ? 'bg-sky-500 text-slate-950'
                                : ch.pct === 100
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-white/10 opacity-80'
                            }`}
                          >
                            Bab {ch.idx + 1}
                          </span>
                          <span className="text-xs font-bold truncate">
                            {ch.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                          <span className={themeStyle.mutedText}>
                            {ch.chChars.toLocaleString('id-ID')} hrf
                          </span>
                          {ch.estMinutes !== null && (
                            <span className="text-sky-300 font-bold">
                              ~{ch.estMinutes}m
                            </span>
                          )}
                          <span className="font-extrabold w-8 text-right">
                            {ch.pct}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            ch.pct === 100 ? 'bg-emerald-400' : 'bg-sky-400'
                          }`}
                          style={{ width: `${ch.pct}%` }}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: SESSION HISTORY & LIFETIME SUMMARY */}
          {tab === 'history' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-current/12 bg-black/15 p-2.5">
                  <div className="text-sm font-black font-mono">
                    {summary.allTimeChars.toLocaleString('id-ID')}
                  </div>
                  <div className={`text-[10px] ${themeStyle.mutedText}`}>
                    Total Huruf Semua Sesi
                  </div>
                </div>
                <div className="rounded-xl border border-current/12 bg-black/15 p-2.5">
                  <div className="text-sm font-black font-mono">
                    {formatReaderDurationShort(summary.allTimeSec)}
                  </div>
                  <div className={`text-[10px] ${themeStyle.mutedText}`}>
                    Total Waktu Fokus Baca
                  </div>
                </div>
                <div className="rounded-xl border border-current/12 bg-black/15 p-2.5">
                  <div className="text-sm font-black font-mono text-sky-300">
                    {summary.allTimeAvgCph > 0
                      ? `${summary.allTimeAvgCph.toLocaleString('id-ID')}/j`
                      : '—'}
                  </div>
                  <div className={`text-[10px] ${themeStyle.mutedText}`}>
                    Rata-rata Kecepatan
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {summary.recentSessions.length === 0 ? (
                  <div className={`py-8 text-center text-xs ${themeStyle.mutedText}`}>
                    Belum ada riwayat sesi membaca tersimpan. Baca beberapa paragraf atau halaman untuk mencatat statistik otomatis!
                  </div>
                ) : (
                  summary.recentSessions.map((ses) => (
                    <div
                      key={ses.id}
                      className="px-3 py-2 rounded-xl border border-current/12 bg-black/10 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {ses.bookTitle}
                        </div>
                        <div className={`text-[10px] flex items-center gap-2 ${themeStyle.mutedText}`}>
                          <span className="inline-flex items-center gap-1">
                            <History className="w-2.5 h-2.5" />
                            {ses.dateStr}
                          </span>
                          <span>•</span>
                          <span>+{ses.charsRead.toLocaleString('id-ID')} huruf</span>
                          <span>•</span>
                          <span>{formatReaderDurationShort(ses.activeSec)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-mono font-black text-sky-300">
                          {ses.cph > 0
                            ? `${ses.cph.toLocaleString('id-ID')}/j`
                            : '—'}
                        </div>
                        <div className={`text-[9px] ${themeStyle.mutedText}`}>
                          {ses.cph > 0 ? `${Math.round(ses.cph / 60)}/mnt` : ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {summary.recentSessions.length > 0 && (
                <div className="pt-1 flex justify-end">
                  {!confirmClearStats ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearStats(true)}
                      className="text-[11px] font-bold text-red-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Semua Riwayat Statistik</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-300 font-bold">
                        Hapus permanen?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          clearAllReaderStats();
                          setConfirmClearStats(false);
                          toast.success('Statistik membaca dibersihkan.');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-500 text-white font-bold cursor-pointer"
                      >
                        Ya, Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearStats(false)}
                        className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${themeStyle.subtleBtn}`}
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
