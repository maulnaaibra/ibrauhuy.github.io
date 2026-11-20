import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Target,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
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
  const dailyPct = Math.min(
    100,
    Math.round((todayMinutes / Math.max(1, dailyGoal)) * 100)
  );
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
      <div className="card-pro p-5 border-t-2 border-t-red-600">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-red-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Target Harian Aktif
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {todayMinutes}{' '}
              <span className="text-sm font-normal text-slate-500">
                / {dailyGoal} menit ({dailyPct}%)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {dailyRemaining === 0
                ? 'Target harian tercapai! Pertahankan konsistensimu.'
                : `Butuh ${dailyRemaining} menit lagi hari ini untuk mencapai target.`}
            </p>
          </div>

          <Link
            to="/settings"
            className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 transition self-start sm:self-center"
          >
            Ubah Target Harian
          </Link>
        </div>

        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-4">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full animate-bar"
            style={{ width: `${dailyPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">
            Target Jangka Panjang & Pace
          </h3>
          <p className="text-xs text-slate-500">
            Pantau kecepatan belajarmu agar target selesai tepat waktu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn-crimson px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tambah Target
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="card-pro p-5 border-red-200 space-y-4 animate-scale-in"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nama Target
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: 50 Jam Reading VN"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Target Jam
              </label>
              <input
                type="number"
                required
                min={1}
                max={5000}
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Kategori Progres
              </label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value as 'all' | SkillTrack)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
              >
                <option value="all">Semua Aktivitas</option>
                <option value="listening">Listening (Anime/Video/Audio)</option>
                <option value="reading">Reading (Manga/VN/LN/Buku)</option>
                <option value="study">Anki / Study</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Deadline
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-crimson px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Simpan Target
            </button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="card-pro p-10 text-center text-sm text-slate-500">
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
                  : 'border-t-red-600';

            const statusBadge =
              p.status === 'completed'
                ? {
                    text: 'Tercapai',
                    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    Icon: CheckCircle2,
                  }
                : p.status === 'ahead'
                  ? {
                      text: 'Lebih Cepat',
                      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      Icon: TrendingUp,
                    }
                  : p.status === 'behind'
                    ? {
                        text: 'Tertinggal Pace',
                        cls: 'bg-amber-50 text-amber-800 border-amber-200',
                        Icon: AlertTriangle,
                      }
                    : {
                        text: 'On Track',
                        cls: 'bg-red-50 text-red-700 border-red-200',
                        Icon: TrendingUp,
                      };

            return (
              <div
                key={goal.id}
                className={`card-pro p-5 border-t-2 ${topColor} flex flex-col justify-between gap-4`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                        {goal.track === 'all' ? 'Semua Media' : goal.track}
                      </span>
                      <h4 className="font-semibold text-slate-900 mt-0.5">
                        {goal.title}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteGoal(goal.id)}
                      title="Hapus target"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      {p.loggedHours.toFixed(1)}j{' '}
                      <span className="text-xs font-normal text-slate-500">
                        / {goal.targetHours}j
                      </span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {p.progressPct}%
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full animate-bar ${
                        p.status === 'completed' || p.status === 'ahead'
                          ? 'bg-emerald-500'
                          : p.status === 'behind'
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-red-600 to-rose-500'
                      }`}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="text-slate-500">
                    {p.status === 'completed' ? (
                      <span>Selesai sebelum {goal.deadline}</span>
                    ) : (
                      <span>
                        {p.daysLeft} hari lagi •{' '}
                        <strong className="text-slate-900">
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
