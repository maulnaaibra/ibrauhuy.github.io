import React, { useEffect, useState } from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
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
    <section
      aria-label="Live Immersion Timer"
      className={`surface p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
        timer.running ? 'border-[#2eb872]/50' : ''
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
        {/* Timer readout */}
        <div className="shrink-0 min-w-[144px]">
          <div className="flex items-center gap-2 text-xs text-[#9aa0ac]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                timer.running ? 'bg-[#2eb872]' : 'bg-[#4b5263]'
              }`}
            />
            <span>{timer.running ? 'Sedang berjalan' : 'Stopwatch'}</span>
            {seconds > 0 && (
              <span className="font-mono text-[11px] text-[#5cd697]">
                +{previewXp} XP
              </span>
            )}
          </div>
          <div className="text-2xl sm:text-[28px] font-mono font-semibold text-[#ededef] tabular-nums tracking-tight mt-0.5 leading-none">
            {formatTime(seconds)}
          </div>
        </div>

        {/* Media inputs */}
        <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-xl">
          <select
            value={timer.category}
            onChange={(e) =>
              updateTimer((prev) => ({
                ...prev,
                category: e.target.value as PrimaryMediaCategory,
              }))
            }
            aria-label="Pilih tipe media stopwatch"
            className="input-field px-3 py-2 text-xs font-medium shrink-0"
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
            placeholder="Judul yang sedang diikuti (opsional)"
            className="input-field w-full px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleToggle}
          className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors cursor-pointer ${
            timer.running
              ? 'bg-[#262013] text-[#e5b55c] border border-[#3d331d] hover:bg-[#302817]'
              : 'btn-primary'
          }`}
        >
          {timer.running ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {timer.running ? 'Pause' : seconds > 0 ? 'Lanjut' : 'Mulai'}
        </button>

        {seconds > 0 && (
          <>
            <button
              type="button"
              onClick={handleStopAndSave}
              className="px-3.5 py-2 rounded-lg bg-[#19382a] hover:bg-[#1f4735] border border-[#245940] text-[#7ae2ac] font-medium text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              Simpan ({estimatedMinutes}m)
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Reset Timer"
              aria-label="Reset Timer"
              className="btn-secondary p-2 rounded-lg text-[#9aa0ac] hover:text-[#ededef] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </section>
  );
};
