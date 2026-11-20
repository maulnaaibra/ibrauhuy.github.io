import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Target, Trash2, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import type { CustomGoal, ImmersionLog, SkillTrack } from '../types';
import { getGoalProgress, getLocalDateString } from '../utils/stats';

interface GoalsSectionProps {
  logs: ImmersionLog[];
  dailyGoal: number;
  goals: CustomGoal[];
  onAddGoal: (goal: Omit<CustomGoal, 'id'>) => void;
  onDeleteGoal: (id: string) => void;
}

export const GoalsSection: React.FC<GoalsSectionProps> = ({
  logs,
  dailyGoal,
  goals,
  onAddGoal,
  onDeleteGoal,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [targetHours, setTargetHours] = useState(30);
  const [track, setTrack] = useState<'all' | SkillTrack>('all');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return getLocalDateString(d);
  });

  const todayStr = getLocalDateString();
  const todayMinutes = logs
    .filter((l) => l.logged_date === todayStr)
    .reduce((sum, l) => sum + l.duration_minutes, 0);
  const dailyPct = Math.min(100, Math.round((todayMinutes / Math.max(1, dailyGoal)) * 100));
  const dailyRemaining = Math.max(0, dailyGoal - todayMinutes);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddGoal({
      title: title.trim(),
      targetHours: Math.max(1, Number(targetHours)),
      track,
      startDate: todayStr,
      deadline,
    });
    setTitle('');
    setTargetHours(30);
    setTrack('all');
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08] border-t-2 border-t-emerald-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Target Harian Aktif
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {todayMinutes}{' '}
              <span className="text-sm font-normal text-slate-400">
                / {dailyGoal} menit ({dailyPct}%)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {dailyRemaining === 0
                ? 'Target harian tercapai! Mantap, pertahankan streak-mu.'
                : `Butuh ${dailyRemaining} menit lagi hari ini untuk mencapai target.`}
            </p>
          </div>

          <Link
            to="/settings"
            className="px-4 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] hover:border-white/[0.2] text-xs font-semibold text-slate-200 transition self-start sm:self-center"
          >
            Ubah Target Harian
          </Link>
        </div>

        <div className="h-2 rounded-full bg-[#11151c] overflow-hidden mt-4">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all"
            style={{ width: `${dailyPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-100">
            Target Jangka Panjang & Pace
          </h3>
          <p className="text-xs text-slate-400">
            Pantau kecepatan belajarmu agar target selesai tepat waktu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tambah Target
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="p-5 rounded-2xl bg-[#171c26] border border-indigo-500/30 space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nama Target
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: 50 Jam Reading VN"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Target Jam
              </label>
              <input
                type="number"
                required
                min={1}
                max={5000}
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Kategori Progres
              </label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value as 'all' | SkillTrack)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Semua Aktivitas</option>
                <option value="listening">Listening (Anime/Video/Audio)</option>
                <option value="reading">Reading (Manga/VN/LN/Buku)</option>
                <option value="study">Anki / Study</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Deadline
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-xs font-medium text-slate-300 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer"
            >
              Simpan Target
            </button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[#171c26] border border-white/[0.08] text-center text-sm text-slate-400">
          Belum ada target kustom. Klik <strong>Tambah Target</strong> untuk
          membuat target jam belajarmu.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const p = getGoalProgress(goal, logs);
            const topColor =
              p.status === 'completed' || p.status === 'ahead'
                ? 'border-t-emerald-500'
                : p.status === 'behind'
                  ? 'border-t-amber-500'
                  : 'border-t-indigo-500';

            const statusBadge =
              p.status === 'completed'
                ? {
                    text: 'Tercapai',
                    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                    Icon: CheckCircle2,
                  }
                : p.status === 'ahead'
                  ? {
                      text: 'Lebih Cepat',
                      cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                      Icon: TrendingUp,
                    }
                  : p.status === 'behind'
                    ? {
                        text: 'Tertinggal Pace',
                        cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                        Icon: AlertTriangle,
                      }
                    : {
                        text: 'On Track',
                        cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
                        Icon: TrendingUp,
                      };

            return (
              <div
                key={goal.id}
                className={`p-5 rounded-2xl bg-[#171c26] border border-white/[0.08] border-t-2 ${topColor} flex flex-col justify-between gap-4`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                        {goal.track === 'all' ? 'Semua Media' : goal.track}
                      </span>
                      <h4 className="font-semibold text-slate-100 mt-0.5">
                        {goal.title}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteGoal(goal.id)}
                      title="Hapus target"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-white tabular-nums">
                      {p.loggedHours.toFixed(1)}j{' '}
                      <span className="text-xs font-normal text-slate-400">
                        / {goal.targetHours}j
                      </span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-300">
                      {p.progressPct}%
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-[#11151c] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        p.status === 'completed' || p.status === 'ahead'
                          ? 'bg-emerald-400'
                          : p.status === 'behind'
                            ? 'bg-amber-400'
                            : 'bg-indigo-500'
                      }`}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                  <div className="text-slate-400">
                    {p.status === 'completed' ? (
                      <span>Selesai sebelum {goal.deadline}</span>
                    ) : (
                      <span>
                        {p.daysLeft} hari lagi •{' '}
                        <strong className="text-slate-200">
                          {p.requiredDailyMinutes}m/hari
                        </strong>
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0 ${statusBadge.cls}`}
                  >
                    <statusBadge.Icon className="w-3 h-3" />
                    {statusBadge.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
