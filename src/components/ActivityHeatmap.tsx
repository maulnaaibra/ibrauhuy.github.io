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

  /* Calm 4-step bamboo green intensity scale for matte dark background */
  const getIntensityClass = (mins: number) => {
    if (mins === 0) return 'bg-[#1f222a] hover:bg-[#2a2e38]';
    const ratio = mins / Math.max(1, dailyGoal);
    if (ratio < 0.35) return 'bg-[#153626]';
    if (ratio < 0.7) return 'bg-[#1d5b3d]';
    if (ratio < 1) return 'bg-[#268556]';
    return 'bg-[#2eb872]';
  };

  return (
    <section className="surface p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#ededef]">
            Aktivitas 12 Bulan Terakhir
          </h3>
          <p className="text-xs text-[#9aa0ac] mt-0.5 tabular-nums">
            {activeDays} hari aktif · {totalHours.toFixed(1)} jam tercatat
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {selectedDay && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-[#121316] border border-[#242730] text-[#ededef] font-mono tabular-nums">
              {selectedDay.dateStr} · {selectedDay.minutes}m ({selectedDay.sessions}{' '}
              sesi)
            </span>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-[#6c727f]">
            <span>Kurang</span>
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#1f222a]" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#153626]" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#1d5b3d]" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#268556]" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#2eb872]" />
            <span>Target</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          <div className="flex gap-1 pl-7 text-[10px] text-[#6c727f] h-4">
            {weekMonthLabels.map((label, idx) => (
              <div key={idx} className="w-3 shrink-0 whitespace-nowrap">
                {label ?? ''}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="grid grid-rows-7 gap-1 text-[10px] text-[#6c727f] pr-1">
              <span className="h-3 leading-[12px]" />
              <span className="h-3 leading-[12px]">Sen</span>
              <span className="h-3 leading-[12px]" />
              <span className="h-3 leading-[12px]">Rab</span>
              <span className="h-3 leading-[12px]" />
              <span className="h-3 leading-[12px]">Jum</span>
              <span className="h-3 leading-[12px]" />
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
                      aria-label={`${day.dateStr}: ${day.minutes} menit`}
                      className={`w-3 h-3 rounded-[2px] transition-colors cursor-pointer ${getIntensityClass(
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
    </section>
  );
};
