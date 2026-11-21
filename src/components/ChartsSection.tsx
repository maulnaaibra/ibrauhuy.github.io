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
  getMilestoneProgress,
  getReadingListeningBalance,
} from '../utils/stats';

interface ChartsSectionProps {
  logs: ImmersionLog[];
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ logs }) => {
  const [range, setRange] = useState<7 | 30 | 90 | 'all'>(30);
  const [trackFilter, setTrackFilter] = useState<'all' | SkillTrack>('all');
  const [chartMetric, setChartMetric] = useState<'hours' | 'cards'>('hours');
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [pieMetric, setPieMetric] = useState<'minutes' | 'cards' | 'sessions'>(
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
    const cardsMap = new Map<string, number>();

    filteredLogs.forEach((l) => {
      minutesMap.set(
        l.logged_date,
        (minutesMap.get(l.logged_date) ?? 0) + l.duration_minutes
      );
      cardsMap.set(l.logged_date, (cardsMap.get(l.logged_date) ?? 0) + l.cards_mined);
    });

    if (range === 'all') {
      const monthMap = new Map<string, { minutes: number; cards: number }>();
      filteredLogs.forEach((l) => {
        const monthKey = l.logged_date.slice(0, 7);
        const cur = monthMap.get(monthKey) ?? { minutes: 0, cards: 0 };
        cur.minutes += l.duration_minutes;
        cur.cards += l.cards_mined;
        monthMap.set(monthKey, cur);
      });
      return Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([monthKey, val]) => ({
          label: monthKey,
          hours: Number((val.minutes / 60).toFixed(2)),
          cards: val.cards,
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
        cards: cardsMap.get(key) ?? 0,
      });
    }
    return result;
  }, [filteredLogs, range]);

  const mediaDistribution = useMemo(() => {
    const buckets = new Map<
      string,
      { name: string; color: string; minutes: number; cards: number; sessions: number }
    >();

    filteredLogs.forEach((l) => {
      const meta = getCategoryMeta(l.category);
      const existing = buckets.get(meta.label);
      if (existing) {
        existing.minutes += l.duration_minutes;
        existing.cards += l.cards_mined;
        existing.sessions += 1;
      } else {
        buckets.set(meta.label, {
          name: meta.label,
          color: meta.color,
          minutes: l.duration_minutes,
          cards: l.cards_mined,
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
            : pieMetric === 'cards'
              ? item.cards
              : item.sessions,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLogs, pieMetric]);

  const totalPieValue = mediaDistribution.reduce((acc, c) => acc + c.value, 0);

  return (
    <div className="space-y-6">
      <div className="card-pro p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
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
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
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
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-pro p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Totals (Periode Dipilih)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500">Total Jam</div>
              <div className="text-xl font-bold font-mono text-red-600 mt-1 tabular-nums">
                {kpis.totalHours.toFixed(1)}j
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Kartu Anki</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                {kpis.totalCards.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Jumlah Sesi</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                {kpis.logCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Rata-rata / Hari</div>
              <div className="text-xl font-bold font-mono text-emerald-600 mt-1 tabular-nums">
                {kpis.dailyAvgMinutes}m
              </div>
            </div>
          </div>
        </div>

        <div className="card-pro p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Balance & Konsistensi
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500">Listening</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                {(kpis.balance.listeningMin / 60).toFixed(1)}j
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Reading</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                {(kpis.balance.readingMin / 60).toFixed(1)}j
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Rasio R : L</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                {kpis.balance.ratioLabel}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Streak Terbaik</div>
              <div className="text-xl font-bold font-mono text-red-600 mt-1 tabular-nums">
                {kpis.longestStreak}h
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-pro p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-semibold text-slate-900">Progress Timeline</h3>
            <p className="text-xs text-slate-500">
              Tren {chartMetric === 'hours' ? 'jam immersion' : 'kartu Anki harian'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              {(
                [
                  { id: 'hours', label: 'Jam' },
                  { id: 'cards', label: 'Kartu' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setChartMetric(m.id)}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    chartMetric === m.id
                      ? 'bg-red-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
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
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
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
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
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
                    `${val ?? 0} ${chartMetric === 'hours' ? 'jam' : 'kartu'}`,
                    chartMetric === 'hours' ? 'Durasi' : 'Kartu Anki',
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '12px',
                    color: '#0f172a',
                    boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
                  }}
                />
                <Bar
                  dataKey={chartMetric}
                  fill={chartMetric === 'hours' ? '#dc2626' : '#be123c'}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            ) : (
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={chartMetric === 'hours' ? '#dc2626' : '#be123c'}
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="95%"
                      stopColor={chartMetric === 'hours' ? '#dc2626' : '#be123c'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
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
                    `${val ?? 0} ${chartMetric === 'hours' ? 'jam' : 'kartu'}`,
                    chartMetric === 'hours' ? 'Durasi' : 'Kartu Anki',
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '12px',
                    color: '#0f172a',
                    boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke={chartMetric === 'hours' ? '#dc2626' : '#be123c'}
                  strokeWidth={2}
                  fill="url(#timelineFill)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-pro p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold text-slate-900">Distribusi Media</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              {(
                [
                  { id: 'minutes', label: 'Waktu' },
                  { id: 'cards', label: 'Kartu' },
                  { id: 'sessions', label: 'Sesi' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPieMetric(m.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    pieMetric === m.id
                      ? 'bg-red-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {mediaDistribution.length === 0 ? (
            <div className="flex-1 min-h-56 flex items-center justify-center text-sm text-slate-400">
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
                          : pieMetric === 'cards'
                            ? 'kartu'
                            : 'sesi'
                      }`,
                      'Total',
                    ]}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '12px',
                      color: '#0f172a',
                      boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card-pro p-5">
          <h3 className="font-semibold text-slate-900 mb-4">
            Rincian per Tipe Media
          </h3>
          {mediaDistribution.length === 0 ? (
            <p className="text-sm text-slate-400 py-12 text-center">
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
                      <span className="flex items-center gap-2 text-slate-800 font-medium">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </span>
                      <span className="text-slate-500 font-mono tabular-nums">
                        {(item.minutes / 60).toFixed(1)}j • {item.sessions} sesi •{' '}
                        <span className="text-slate-900 font-semibold">
                          {pct}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full animate-bar"
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

      <div className="card-pro p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">
              Peta Jalan Milestone ({kpis.allHours.toFixed(1)}j /{' '}
              {kpis.milestone.nextMilestone}j)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {kpis.estDaysToNext
                ? `Dengan pace 30 hari terakhirmu, milestone ${kpis.milestone.nextMilestone} jam tercapai dalam ~${kpis.estDaysToNext} hari.`
                : 'Terus tambah sesi immersion untuk membuka proyeksi menuju milestone berikutnya.'}
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-red-600">
            {Math.round(kpis.milestone.progress)}% menuju{' '}
            {kpis.milestone.nextMilestone}j
          </span>
        </div>

        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full animate-bar"
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
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : m === kpis.milestone.nextMilestone
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
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
