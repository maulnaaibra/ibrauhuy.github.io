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
    const spanDays =
      range === 'all' ? Math.max(1, activeDays) : range;
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

  return (
    <div className="space-y-6">
      <div className="p-3 rounded-2xl bg-[#171c26] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 7, label: '7 Hari' },
              { id: 30, label: '30 Hari' },
              { id: 90, label: '90 Hari' },
              { id: 'all', label: 'Semua Waktu' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                range === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#11151c] text-slate-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                trackFilter === tr.id
                  ? 'bg-white/[0.12] text-white border border-white/[0.15]'
                  : 'bg-[#11151c] text-slate-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Totals (Periode Dipilih)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-400">Total XP</div>
              <div className="text-xl font-bold font-mono text-indigo-400 mt-1 tabular-nums">
                {kpis.totalXp.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Total Jam</div>
              <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
                {kpis.totalHours.toFixed(1)}j
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Jumlah Sesi</div>
              <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
                {kpis.logCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Rata-rata / Hari</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                {kpis.dailyAvgMinutes}m
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Balance & Konsistensi
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-400">Listening</div>
              <div className="text-xl font-bold font-mono text-cyan-400 mt-1 tabular-nums">
                {(kpis.balance.listeningMin / 60).toFixed(1)}j
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Reading</div>
              <div className="text-xl font-bold font-mono text-violet-400 mt-1 tabular-nums">
                {(kpis.balance.readingMin / 60).toFixed(1)}j
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Rasio R : L</div>
              <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
                {kpis.balance.ratioLabel}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Streak Terbaik</div>
              <div className="text-xl font-bold font-mono text-pink-400 mt-1 tabular-nums">
                {kpis.longestStreak}h
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-semibold text-slate-100">Progress Timeline</h3>
            <p className="text-xs text-slate-400">
              Tren {chartMetric === 'hours' ? 'jam immersion' : 'perolehan XP'} harian
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#11151c] p-1 rounded-xl border border-white/[0.06] text-xs">
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
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    chartMetric === m.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex bg-[#11151c] p-1 rounded-xl border border-white/[0.06] text-xs">
              {(
                [
                  { id: 'bar', label: 'Bar' },
                  { id: 'area', label: 'Area' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setChartType(t.id)}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    chartType === t.id
                      ? 'bg-white/[0.12] text-white'
                      : 'text-slate-400 hover:text-white'
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
                <CartesianGrid
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(val) => [
                    `${val ?? 0} ${chartMetric === 'hours' ? 'jam' : 'XP'}`,
                    chartMetric === 'hours' ? 'Durasi' : 'XP',
                  ]}
                  contentStyle={{
                    backgroundColor: '#11151c',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Bar
                  dataKey={chartMetric}
                  fill={chartMetric === 'hours' ? '#6366f1' : '#ec4899'}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            ) : (
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={chartMetric === 'hours' ? '#6366f1' : '#ec4899'}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={chartMetric === 'hours' ? '#6366f1' : '#ec4899'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(val) => [
                    `${val ?? 0} ${chartMetric === 'hours' ? 'jam' : 'XP'}`,
                    chartMetric === 'hours' ? 'Durasi' : 'XP',
                  ]}
                  contentStyle={{
                    backgroundColor: '#11151c',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke={chartMetric === 'hours' ? '#6366f1' : '#ec4899'}
                  strokeWidth={2}
                  fill="url(#timelineFill)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08] flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold text-slate-100">Distribusi Media</h3>
            <div className="flex bg-[#11151c] p-1 rounded-xl border border-white/[0.06] text-xs">
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
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    pieMetric === m.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {mediaDistribution.length === 0 ? (
            <div className="flex-1 min-h-56 flex items-center justify-center text-sm text-slate-500">
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
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
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
                    contentStyle={{
                      backgroundColor: '#11151c',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08]">
          <h3 className="font-semibold text-slate-100 mb-4">
            Rincian per Tipe Media
          </h3>
          {mediaDistribution.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center">
              Belum ada data media.
            </p>
          ) : (
            <div className="space-y-3">
              {mediaDistribution.map((item) => {
                const pct = totalPieValue
                  ? Math.round((item.value / totalPieValue) * 100)
                  : 0;
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-200 font-medium">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </span>
                      <span className="text-slate-400 font-mono tabular-nums">
                        {(item.minutes / 60).toFixed(1)}j • {item.xp} XP •{' '}
                        <span className="text-slate-200">{pct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#11151c] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
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

      <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-semibold text-slate-100">
              Peta Jalan Milestone ({kpis.allHours.toFixed(1)}j /{' '}
              {kpis.milestone.nextMilestone}j)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {kpis.estDaysToNext
                ? `Dengan pace 30 hari terakhirmu, milestone ${kpis.milestone.nextMilestone} jam tercapai dalam ~${kpis.estDaysToNext} hari.`
                : 'Terus tambah sesi immersion untuk membuka proyeksi menuju milestone berikutnya.'}
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-indigo-300">
            {Math.round(kpis.milestone.progress)}% menuju{' '}
            {kpis.milestone.nextMilestone}j
          </span>
        </div>

        <div className="h-2 rounded-full bg-[#11151c] overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all"
            style={{ width: `${kpis.milestone.progress}%` }}
          />
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {kpis.milestone.milestones.map((m) => {
            const reached = kpis.allHours >= m;
            return (
              <div
                key={m}
                className={`p-2.5 rounded-xl border text-center transition ${
                  reached
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : m === kpis.milestone.nextMilestone
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                      : 'bg-[#11151c] border-white/[0.06] text-slate-500'
                }`}
              >
                <div className="text-sm font-bold font-mono">{m}j</div>
                <div className="text-[10px] mt-0.5">
                  {reached
                    ? 'Tercapai'
                    : m === kpis.milestone.nextMilestone
                      ? 'Target'
                      : 'Terkunci'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
