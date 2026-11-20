import React, { useEffect, useState } from 'react';
import { Play, Pause, Square, RotateCcw, Sparkles } from 'lucide-react';
import {
  CATEGORY_META,
  PRIMARY_CATEGORIES,
  type PrimaryMediaCategory,
} from '../types';
import { calculateXp } from '../utils/stats';

const TIMER_STORAGE_KEY = 'immersiontrack_active_timer_v1';

interface StoredTimerState {
  running: boolean;
  startedAt: number | null;
  accumulatedMs: number;
  category: PrimaryMediaCategory;
  title: string;
}

function loadTimerState(): StoredTimerState {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredTimerState>;
      return {
        running: Boolean(parsed.running),
        startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
        accumulatedMs:
          typeof parsed.accumulatedMs === 'number' ? parsed.accumulatedMs : 0,
        category: PRIMARY_CATEGORIES.includes(
          parsed.category as PrimaryMediaCategory
        )
          ? (parsed.category as PrimaryMediaCategory)
          : 'anime',
        title: typeof parsed.title === 'string' ? parsed.title : '',
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    running: false,
    startedAt: null,
    accumulatedMs: 0,
    category: 'anime',
    title: '',
  };
}

function saveTimerState(state: StoredTimerState): void {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

interface LiveStopwatchProps {
  onSaveDuration: (payload: {
    minutes: number;
    category: PrimaryMediaCategory;
    title: string;
  }) => void;
}

export const LiveStopwatch: React.FC<LiveStopwatchProps> = ({
  onSaveDuration,
}) => {
  const [timer, setTimer] = useState<StoredTimerState>(loadTimerState);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const updateTimer = (
    updater: StoredTimerState | ((prev: StoredTimerState) => StoredTimerState)
  ) => {
    setTimer((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveTimerState(next);
      return next;
    });
  };

  useEffect(() => {
    const syncClock = () => setNowMs(Date.now());
    document.addEventListener('visibilitychange', syncClock);
    window.addEventListener('focus', syncClock);

    if (!timer.running) {
      return () => {
        document.removeEventListener('visibilitychange', syncClock);
        window.removeEventListener('focus', syncClock);
      };
    }

    const interval = setInterval(syncClock, 1000);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', syncClock);
      window.removeEventListener('focus', syncClock);
    };
  }, [timer.running]);

  const elapsedMs =
    timer.accumulatedMs +
    (timer.running && timer.startedAt ? Math.max(0, nowMs - timer.startedAt) : 0);
  const seconds = Math.floor(elapsedMs / 1000);

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const estimatedMinutes = Math.max(1, Math.round(seconds / 60));
  const previewXp =
    seconds > 0 ? calculateXp(timer.category, estimatedMinutes, 0) : 0;
  const meta = CATEGORY_META[timer.category];

  const handleToggle = () => {
    const now = Date.now();
    setNowMs(now);
    updateTimer((prev) => {
      if (prev.running) {
        const gained = prev.startedAt ? Math.max(0, now - prev.startedAt) : 0;
        return {
          ...prev,
          running: false,
          startedAt: null,
          accumulatedMs: prev.accumulatedMs + gained,
        };
      }
      return {
        ...prev,
        running: true,
        startedAt: now,
      };
    });
  };

  const handleReset = () => {
    setNowMs(Date.now());
    updateTimer((prev) => ({
      ...prev,
      running: false,
      startedAt: null,
      accumulatedMs: 0,
    }));
  };

  const handleStopAndSave = () => {
    const now = Date.now();
    const totalMs =
      timer.accumulatedMs +
      (timer.running && timer.startedAt ? Math.max(0, now - timer.startedAt) : 0);
    const finalMinutes = Math.max(1, Math.round(totalMs / 60000));
    const savedCategory = timer.category;
    const savedTitle = timer.title.trim();

    setNowMs(now);
    updateTimer({
      running: false,
      startedAt: null,
      accumulatedMs: 0,
      category: savedCategory,
      title: '',
    });

    onSaveDuration({
      minutes: finalMinutes,
      category: savedCategory,
      title: savedTitle,
    });
  };

  return (
    <div className="card-pro p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
        <div className="shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`w-2 h-2 rounded-full ${
                timer.running ? 'bg-red-600 animate-pulse' : 'bg-slate-300'
              }`}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Live Immersion Timer
            </span>
            {timer.running && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                Berjalan di latar belakang
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <div className="text-3xl font-mono font-bold text-slate-900 tabular-nums tracking-tight">
              {formatTime(seconds)}
            </div>
            {seconds > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                <Sparkles className="w-3 h-3" />+{previewXp} XP
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 flex-1 max-w-xl">
          <select
            value={timer.category}
            onChange={(e) =>
              updateTimer((prev) => ({
                ...prev,
                category: e.target.value as PrimaryMediaCategory,
              }))
            }
            aria-label="Pilih tipe media stopwatch"
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-red-500 shrink-0"
            style={{ borderLeftColor: meta.color, borderLeftWidth: '3px' }}
          >
            {PRIMARY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_META[cat].label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={timer.title}
            onChange={(e) =>
              updateTimer((prev) => ({
                ...prev,
                title: e.target.value,
              }))
            }
            placeholder="Sedang nonton/baca apa? (opsional)"
            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:bg-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleToggle}
          className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition cursor-pointer ${
            timer.running
              ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              : 'btn-crimson'
          }`}
        >
          {timer.running ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {timer.running ? 'Pause' : seconds > 0 ? 'Lanjut' : 'Mulai'}
        </button>

        {seconds > 0 && (
          <>
            <button
              type="button"
              onClick={handleStopAndSave}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Square className="w-4 h-4" />
              Simpan ({estimatedMinutes}m)
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Reset Timer"
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
