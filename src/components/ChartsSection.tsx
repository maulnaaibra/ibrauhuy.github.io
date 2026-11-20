import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  getCategoryMeta,
  type ImmersionLog,
  type SkillTrack,
} from '../types';
import {
  calculateLongestStreak,
  calculateStreak,
  getLocalDateString,
  getLogXp,
  getMilestoneProgress,
  getReadingListeningBalance,
} from '../utils/stats';

interface ChartsSectionProps {
  logs: ImmersionLog[];
}

const TOOLTIP_STYLE = {
  backgroundColor: '#181a1f',
  borderColor: '#2c303a',
  borderRadius: '8px',
  color: '#ededef',
  fontSize: '12px',
  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)',
};

export const ChartsSection: React.FC<ChartsSectionProps> = ({ logs }) => {
  const [range, setRange] = useState<7 | 30 | 90 | 'all'>(30);
  const [trackFilter, setTrackFilter] = useState<'all' | SkillTrack>('all');
  const [chartMetric, setChartMetric] = useState<'hours' | 'xp'>('hours');
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [pieMetric, setPieMetric] = useState<'minutes' | 'xp' | 'sessions'>(
    'minutes'
  );

  const filteredLogs = useMemo(() => {
    const today = new Date();
    const cutoffStr =
      range === 'all'
        ? null
        : (() => {
            const d = new Date(today);
            d.setDate(today.getDate() - (range - 1));
            return getLocalDateString(d);
          })();

    return logs.filter((l) => {
      if (cutoffStr && l.logged_date < cutoffStr) return false;
      if (trackFilter !== 'all') {
        return getCategoryMeta(l.category).track === trackFilter;
      }
      return true;
    });
  }, [logs, range, trackFilter]);

  const kpis = useMemo(() => {
    const totalMinutes = filteredLogs.reduce(
      (sum, l) => sum + l.duration_minutes,
      0
    );
    const totalHours = totalMinutes / 60;
    const totalXp = filteredLogs.reduce((sum, l) => sum + getLogXp(l), 0);
    const totalCards = filteredLogs.reduce((sum, l) => sum + l.cards_mined, 0);
    const activeDays = new Set(filteredLogs.map((l) => l.logged_date)).size;
    const spanDays = range === 'all' ? Math.max(1, activeDays) : range;
    const dailyAvgMinutes = Math.round(totalMinutes / Math.max(1, spanDays));

    const balance = getReadingListeningBalance(filteredLogs);
    const currentStreak = calculateStreak(logs);
    const longestStreak = calculateLongestStreak(logs);

    const allHours =
      logs.reduce((sum, l) => sum + l.duration_minutes, 0) / 60;
    const milestone = getMilestoneProgress(allHours);

    const last30Cutoff = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return getLocalDateString(d);
    })();
    const recent30Hours =
      logs
        .filter((l) => l.logged_date >= last30Cutoff)
        .reduce((s, l) => s + l.duration_minutes, 0) / 60;
    const avgHoursPerDay = recent30Hours / 30;
    const estDaysToNext =
      avgHoursPerDay > 0 && allHours < milestone.nextMilestone
        ? Math.ceil((milestone.nextMilestone - allHours) / avgHoursPerDay)
        : null;

    return {
      totalHours,
      totalXp,
      totalCards,
      logCount: filteredLogs.length,
      dailyAvgMinutes,
      balance,
      currentStreak,
      longestStreak,
      allHours,
      milestone,
      estDaysToNext,
    };
  }, [filteredLogs, logs, range]);

  const timelineData = useMemo(() => {
    const minutesMap = new Map<string, number>();
    const xpMap = new Map<string, number>();

    filteredLogs.forEach((l) => {
      minutesMap.set(
        l.logged_date,
        (minutesMap.get(l.logged_date) ?? 0) + l.duration_minutes
      );
      xpMap.set(l.logged_date, (xpMap.get(l.logged_date) ?? 0) + getLogXp(l));
    });

    if (range === 'all') {
      const monthMap = new Map<string, { minutes: number; xp: number }>();
      filteredLogs.forEach((l) => {
        const monthKey = l.logged_date.slice(0, 7);
        const cur = monthMap.get(monthKey) ?? { minutes: 0, xp: 0 };
        cur.minutes += l.duration_minutes;
        cur.xp += getLogXp(l);
        monthMap.set(monthKey, cur);
      });
      return Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([monthKey, val]) => ({
          label: monthKey,
          hours: Number((val.minutes / 60).toFixed(2)),
          xp: val.xp,
        }));
    }

    const result = [];
    const today = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = getLocalDateString(d);
      const mins = minutesMap.get(key) ?? 0;
      result.push({
        label: d.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
        }),
        hours: Number((mins / 60).toFixed(2)),
        xp: xpMap.get(key) ?? 0,
      });
    }
    return result;
  }, [filteredLogs, range]);

  const mediaDistribution = useMemo(() => {
    const buckets = new Map<
      string,
      { name: string; color: string; minutes: number; xp: number; sessions: number }
    >();

    filteredLogs.forEach((l) => {
      const meta = getCategoryMeta(l.category);
      const existing = buckets.get(meta.label);
      const xp = getLogXp(l);
      if (existing) {
        existing.minutes += l.duration_minutes;
        existing.xp += xp;
        existing.sessions += 1;
      } else {
        buckets.set(meta.label, {
          name: meta.label,
          color: meta.color,
          minutes: l.duration_minutes,
          xp,
          sessions: 1,
        });
      }
    });

    return Array.from(buckets.values())
      .map((item) => ({
        ...item,
        value:
          pieMetric === 'minutes'
            ? item.minutes
            : pieMetric === 'xp'
              ? item.xp
              : item.sessions,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLogs, pieMetric]);

  const totalPieValue = mediaDistribution.reduce((acc, c) => acc + c.value, 0);
  const seriesColor = chartMetric === 'hours' ? '#2eb872' : '#6b9be0';

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 bg-[#16181c] border border-[#242730] p-1 rounded-lg w-fit flex-wrap">
          {(
            [
              { id: 7, label: '7 Hari' },
              { id: 30, label: '30 Hari' },
              { id: 90, label: '90 Hari' },
              { id: 'all', label: 'Semua' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                range === item.id
                  ? 'bg-[#252831] text-[#ededef]'
                  : 'text-[#9aa0ac] hover:text-[#ededef]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1 bg-[#16181c] border border-[#242730] p-1 rounded-lg w-fit flex-wrap">
          {(
            [
              { id: 'all', label: 'Semua Tipe' },
              { id: 'listening', label: 'Listening' },
              { id: 'reading', label: 'Reading' },
              { id: 'study', label: 'Study' },
            ] as const
          ).map((tr) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => setTrackFilter(tr.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                trackFilter === tr.id
                  ? 'bg-[#252831] text-[#ededef]'
                  : 'text-[#9aa0ac] hover:text-[#ededef]'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified KPI strip */}
      <div className="surface grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[#242730]">
        <div className="p-4 sm:p-5">
          <div className="text-xs text-[#9aa0ac]">Total Durasi</div>
          <div className="text-xl font-semibold font-mono text-[#ededef] mt-1 tabular-nums">
            {kpis.totalHours.toFixed(1)} jam
          </div>
          <div className="text-[11px] text-[#6c727f] mt-1 font-mono tabular-nums">
            {kpis.logCount} sesi · {kpis.dailyAvgMinutes}m/hari
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="text-xs text-[#9aa0ac]">Perolehan XP</div>
          <div className="text-xl font-semibold font-mono text-[#5cd697] mt-1 tabular-nums">
            {kpis.totalXp.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#6c727f] mt-1 font-mono tabular-nums">
            {kpis.totalCards} kartu baru
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="text-xs text-[#9aa0ac]">Reading : Listening</div>
          <div className="text-xl font-semibold font-mono text-[#ededef] mt-1 tabular-nums">
            {kpis.balance.ratioLabel}
          </div>
          <div className="text-[11px] text-[#6c727f] mt-1 font-mono tabular-nums">
            R {(kpis.balance.readingMin / 60).toFixed(1)}j · L{' '}
            {(kpis.balance.listeningMin / 60).toFixed(1)}j
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="text-xs text-[#9aa0ac]">Streak Terbaik</div>
          <div className="text-xl font-semibold font-mono text-[#ededef] mt-1 tabular-nums">
            {kpis.longestStreak} hari
          </div>
          <div className="text-[11px] text-[#6c727f] mt-1 font-mono tabular-nums">
            Saat ini {kpis.currentStreak} hari
          </div>
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="surface p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-sm font-semibold text-[#ededef]">
              Tren Progres
            </h3>
            <p className="text-xs text-[#9aa0ac] mt-0.5">
              {chartMetric === 'hours' ? 'Durasi jam immersion' : 'Perolehan XP'}{' '}
              per {range === 'all' ? 'bulan' : 'hari'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#121316] p-0.5 rounded-lg border border-[#242730] text-xs">
              {(
                [
                  { id: 'hours', label: 'Jam' },
                  { id: 'xp', label: 'XP' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setChartMetric(m.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    chartMetric === m.id
                      ? 'bg-[#252831] text-[#ededef]'
                      : 'text-[#6c727f] hover:text-[#ededef]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex bg-[#121316] p-0.5 rounded-lg border border-[#242730] text-xs">
              {(
                [
                  { id: 'bar', label: 'Bar' },
                  { id: 'area', label: 'Garis' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setChartType(t.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    chartType === t.id
                      ? 'bg-[#252831] text-[#ededef]'
                      : 'text-[#6c727f] hover:text-[#ededef]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={timelineData}>
                <CartesianGrid stroke="#22252d" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#6c727f"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6c727f"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  formatter={(val) => [
                    `${val ?? 0} ${chartMetric === 'hours' ? 'jam' : 'XP'}`,
                    chartMetric === 'hours' ? 'Durasi' : 'XP',
                  ]}
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#ededef' }}
                  labelStyle={{ color: '#9aa0ac', marginBottom: '2px' }}
                />
                <Bar
                  dataKey={chartMetric}
                  fill={seriesColor}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : (
              <AreaChart data={timelineData}>
                <CartesianGrid stroke="#22252d" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#6c727f"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6c727f"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(val) => [
                    `${val ?? 0} ${chartMetric === 'hours' ? 'jam' : 'XP'}`,
                    chartMetric === 'hours' ? 'Durasi' : 'XP',
                  ]}
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: '#ededef' }}
                  labelStyle={{ color: '#9aa0ac', marginBottom: '2px' }}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke={seriesColor}
                  strokeWidth={2}
                  fill={seriesColor}
                  fillOpacity={0.12}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Media Distribution */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="surface p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-semibold text-[#ededef]">
              Distribusi Media
            </h3>
            <div className="flex bg-[#121316] p-0.5 rounded-lg border border-[#242730] text-xs">
              {(
                [
                  { id: 'minutes', label: 'Waktu' },
                  { id: 'xp', label: 'XP' },
                  { id: 'sessions', label: 'Sesi' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPieMetric(m.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    pieMetric === m.id
                      ? 'bg-[#252831] text-[#ededef]'
                      : 'text-[#6c727f] hover:text-[#ededef]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {mediaDistribution.length === 0 ? (
            <div className="flex-1 min-h-56 flex items-center justify-center text-sm text-[#6c727f]">
              Belum ada data pada filter ini.
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mediaDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={88}
                    paddingAngle={2}
                    stroke="#16181c"
                    strokeWidth={2}
                  >
                    {mediaDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [
                      `${val ?? 0} ${
                        pieMetric === 'minutes'
                          ? 'menit'
                          : pieMetric === 'xp'
                            ? 'XP'
                            : 'sesi'
                      }`,
                      'Total',
                    ]}
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={{ color: '#ededef' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="surface p-5">
          <h3 className="text-sm font-semibold text-[#ededef] mb-4">
            Rincian per Tipe Media
          </h3>
          {mediaDistribution.length === 0 ? (
            <p className="text-sm text-[#6c727f] py-12 text-center">
              Belum ada data media.
            </p>
          ) : (
            <div className="space-y-3.5">
              {mediaDistribution.map((item) => {
                const pct = totalPieValue
                  ? Math.round((item.value / totalPieValue) * 100)
                  : 0;
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-[#ededef] font-medium">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </span>
                      <span className="text-[#9aa0ac] font-mono tabular-nums">
                        {(item.minutes / 60).toFixed(1)}j · {item.xp} XP ·{' '}
                        <span className="text-[#ededef] font-medium">
                          {pct}%
                        </span>
                      </span>
                    </div>
                    <div className="progress-track h-1.5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Milestone Roadmap */}
      <div className="surface p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#ededef]">
              Peta Jalan Milestone ({kpis.allHours.toFixed(1)}j /{' '}
              {kpis.milestone.nextMilestone}j)
            </h3>
            <p className="text-xs text-[#9aa0ac] mt-0.5">
              {kpis.estDaysToNext
                ? `Dengan rata-rata 30 hari terakhir, target ${kpis.milestone.nextMilestone} jam tercapai dalam ~${kpis.estDaysToNext} hari.`
                : 'Catat sesi secara rutin untuk melihat estimasi pencapaian milestone berikutnya.'}
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-[#5cd697] tabular-nums">
            {Math.round(kpis.milestone.progress)}% menuju{' '}
            {kpis.milestone.nextMilestone}j
          </span>
        </div>

        <div className="progress-track h-1.5 mb-5">
          <div
            className="progress-fill h-full"
            style={{ width: `${kpis.milestone.progress}%` }}
          />
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {kpis.milestone.milestones.map((m) => {
            const reached = kpis.allHours >= m;
            const isNext = m === kpis.milestone.nextMilestone && !reached;
            return (
              <div
                key={m}
                className={`p-2.5 rounded-lg border text-center ${
                  reached
                    ? 'bg-[#14291f] border-[#214a36] text-[#5cd697]'
                    : isNext
                      ? 'bg-[#1e2128] border-[#3d4352] text-[#ededef]'
                      : 'bg-[#121316] border-[#22252d] text-[#6c727f]'
                }`}
              >
                <div className="text-sm font-semibold font-mono tabular-nums">
                  {m}j
                </div>
                <div className="text-[10px] mt-0.5">
                  {reached ? 'Tercapai' : isNext ? 'Target' : 'Terkunci'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
