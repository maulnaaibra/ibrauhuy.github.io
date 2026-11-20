import React, { useMemo, useState } from 'react';
import type { ImmersionLog } from '../types';
import { getLocalDateString } from '../utils/stats';

interface ActivityHeatmapProps {
  logs: ImmersionLog[];
  dailyGoal: number;
}

interface DayCell {
  dateStr: string;
  minutes: number;
  sessions: number;
  monthLabel: string | null;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  logs,
  dailyGoal,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null);

  const { weeks, weekMonthLabels, activeDays, totalHours } = useMemo(() => {
    const minutesMap = new Map<string, number>();
    const sessionsMap = new Map<string, number>();

    logs.forEach((l) => {
      minutesMap.set(
        l.logged_date,
        (minutesMap.get(l.logged_date) ?? 0) + l.duration_minutes
      );
      sessionsMap.set(l.logged_date, (sessionsMap.get(l.logged_date) ?? 0) + 1);
    });

    const cells: DayCell[] = [];
    const today = new Date();
    let prevMonth = -1;
    let activeCount = 0;
    let totalMins = 0;

    for (let i = 363; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = getLocalDateString(d);
      const minutes = minutesMap.get(dateStr) ?? 0;
      const sessions = sessionsMap.get(dateStr) ?? 0;

      if (minutes > 0) {
        activeCount++;
        totalMins += minutes;
      }

      const month = d.getMonth();
      const monthLabel =
        month !== prevMonth
          ? d.toLocaleDateString('id-ID', { month: 'short' })
          : null;
      prevMonth = month;

      cells.push({ dateStr, minutes, sessions, monthLabel });
    }

    const columns: DayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      columns.push(cells.slice(i, i + 7));
    }

    const rawLabels = columns.map(
      (week) => week.find((c) => c.monthLabel)?.monthLabel ?? null
    );
    const labels: Array<string | null> = rawLabels.map(() => null);
    let lastShownIdx = -10;

    for (let idx = 0; idx < rawLabels.length; idx++) {
      const label = rawLabels[idx];
      if (!label) continue;
      const nextSoon =
        idx === 0 && rawLabels.slice(1, 3).some((l) => l !== null);
      if (nextSoon || idx - lastShownIdx < 3) {
        continue;
      }
      labels[idx] = label;
      lastShownIdx = idx;
    }

    return {
      weeks: columns,
      weekMonthLabels: labels,
      activeDays: activeCount,
      totalHours: totalMins / 60,
    };
  }, [logs]);

  const getIntensityClass = (mins: number) => {
    if (mins === 0) return 'bg-white/[0.04] hover:bg-white/[0.1]';
    const ratio = mins / Math.max(1, dailyGoal);
    if (ratio < 0.35) return 'bg-indigo-950 border border-indigo-800/50';
    if (ratio < 0.7) return 'bg-indigo-800/80 border border-indigo-600/40';
    if (ratio < 1) return 'bg-indigo-500 border border-indigo-400/50';
    return 'bg-emerald-400 border border-emerald-300/60 shadow-[0_0_8px_rgba(52,211,153,0.35)]';
  };

  return (
    <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-100">Immersion Activity</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeDays} hari aktif • {totalHours.toFixed(1)} jam dalam 364 hari
            terakhir
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {selectedDay && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-[#11151c] border border-white/[0.08] text-slate-300 font-mono">
              {selectedDay.dateStr}: {selectedDay.minutes}m ({selectedDay.sessions}{' '}
              sesi)
            </span>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Kurang</span>
            <span className="w-3 h-3 rounded-[3px] bg-white/[0.04]" />
            <span className="w-3 h-3 rounded-[3px] bg-indigo-950 border border-indigo-800/50" />
            <span className="w-3 h-3 rounded-[3px] bg-indigo-800/80" />
            <span className="w-3 h-3 rounded-[3px] bg-indigo-500" />
            <span className="w-3 h-3 rounded-[3px] bg-emerald-400" />
            <span>Target</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          <div className="flex gap-1 pl-7 text-[10px] text-slate-500 h-4">
            {weekMonthLabels.map((label, idx) => (
              <div key={idx} className="w-3.5 shrink-0 whitespace-nowrap">
                {label ?? ''}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="grid grid-rows-7 gap-1 text-[10px] text-slate-500 pr-1">
              <span className="h-3.5 leading-[14px]"></span>
              <span className="h-3.5 leading-[14px]">Sen</span>
              <span className="h-3.5 leading-[14px]"></span>
              <span className="h-3.5 leading-[14px]">Rab</span>
              <span className="h-3.5 leading-[14px]"></span>
              <span className="h-3.5 leading-[14px]">Jum</span>
              <span className="h-3.5 leading-[14px]"></span>
            </div>

            <div className="flex gap-1">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-rows-7 gap-1">
                  {week.map((day) => (
                    <button
                      key={day.dateStr}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      onMouseEnter={() => setSelectedDay(day)}
                      title={`${day.dateStr}: ${day.minutes} menit (${day.sessions} sesi)`}
                      className={`w-3.5 h-3.5 rounded-[3px] transition-all cursor-pointer ${getIntensityClass(
                        day.minutes
                      )}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
