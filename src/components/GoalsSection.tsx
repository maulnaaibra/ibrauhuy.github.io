import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
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
      {/* Daily target summary */}
      <div className="surface p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-[#9aa0ac]">Target Harian Aktif</div>
            <div className="text-2xl font-semibold font-mono text-[#ededef] tabular-nums">
              {todayMinutes}{' '}
              <span className="text-sm font-normal text-[#9aa0ac]">
                / {dailyGoal} menit ({dailyPct}%)
              </span>
            </div>
            <p className="text-xs text-[#6c727f]">
              {dailyRemaining === 0
                ? 'Target harian tercapai.'
                : `Sisa ${dailyRemaining} menit lagi hari ini untuk mencapai target.`}
            </p>
          </div>

          <Link
            to="/settings"
            className="btn-secondary px-3.5 py-2 rounded-lg text-xs font-medium self-start sm:self-center"
          >
            Ubah Target Harian
          </Link>
        </div>

        <div className="progress-track h-1.5 mt-4">
          <div className="progress-fill h-full" style={{ width: `${dailyPct}%` }} />
        </div>
      </div>

      {/* Long-term goals header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#ededef]">
            Target Jangka Panjang & Pace
          </h3>
          <p className="text-xs text-[#9aa0ac] mt-0.5">
            Pantau kecepatan belajarmu agar target selesai sesuai jadwal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="btn-primary px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Target
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="surface p-5 border-[#313540] space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9aa0ac] mb-1.5">
                Nama Target
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: 50 Jam Reading VN"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9aa0ac] mb-1.5">
                Target Jam
              </label>
              <input
                type="number"
                required
                min={1}
                max={5000}
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value))}
                className="input-field w-full px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9aa0ac] mb-1.5">
                Kategori Progres
              </label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value as 'all' | SkillTrack)}
                className="input-field w-full px-3 py-2 text-sm"
              >
                <option value="all">Semua Aktivitas</option>
                <option value="listening">Listening (Anime/Video/Audio)</option>
                <option value="reading">Reading (Manga/VN/LN/Buku)</option>
                <option value="study">Anki / Study</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9aa0ac] mb-1.5">
                Deadline
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="input-field w-full px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
            >
              Simpan Target
            </button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="surface p-10 text-center text-sm text-[#6c727f]">
          Belum ada target kustom. Klik{' '}
          <span className="text-[#ededef] font-medium">Tambah Target</span> untuk
          membuat target jam belajarmu.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => {
            const p = getGoalProgress(goal, logs);

            const statusBadge =
              p.status === 'completed'
                ? {
                    text: 'Tercapai',
                    cls: 'bg-[#14291f] text-[#5cd697] border-[#214a36]',
                    barCls: 'bg-[#2eb872]',
                    Icon: CheckCircle2,
                  }
                : p.status === 'ahead'
                  ? {
                      text: 'Lebih Cepat',
                      cls: 'bg-[#14291f] text-[#5cd697] border-[#214a36]',
                      barCls: 'bg-[#2eb872]',
                      Icon: TrendingUp,
                    }
                  : p.status === 'behind'
                    ? {
                        text: 'Tertinggal',
                        cls: 'bg-[#262013] text-[#e5b55c] border-[#3d331d]',
                        barCls: 'bg-[#d4a24c]',
                        Icon: AlertTriangle,
                      }
                    : {
                        text: 'On Track',
                        cls: 'bg-[#1b1e23] text-[#9aa0ac] border-[#2c303a]',
                        barCls: 'bg-[#6b9be0]',
                        Icon: TrendingUp,
                      };

            return (
              <div
                key={goal.id}
                className="surface p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs text-[#6c727f] capitalize">
                        {goal.track === 'all' ? 'Semua Media' : goal.track}
                      </span>
                      <h4 className="font-semibold text-sm text-[#ededef] mt-0.5 truncate">
                        {goal.title}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteGoal(goal.id)}
                      title="Hapus target"
                      aria-label={`Hapus target ${goal.title}`}
                      className="p-1.5 rounded-md text-[#6c727f] hover:text-[#e57373] hover:bg-[#2a191b] transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-semibold font-mono text-[#ededef] tabular-nums">
                      {p.loggedHours.toFixed(1)}j{' '}
                      <span className="text-xs font-normal text-[#6c727f]">
                        / {goal.targetHours}j
                      </span>
                    </span>
                    <span className="text-xs font-mono text-[#9aa0ac] tabular-nums">
                      {p.progressPct}%
                    </span>
                  </div>

                  <div className="progress-track h-1.5">
                    <div
                      className={`h-full rounded-full ${statusBadge.barCls}`}
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#22252d] flex items-center justify-between gap-2 text-xs">
                  <div className="text-[#9aa0ac] tabular-nums">
                    {p.status === 'completed' ? (
                      <span>Selesai sebelum {goal.deadline}</span>
                    ) : (
                      <span>
                        {p.daysLeft} hari lagi ·{' '}
                        <span className="text-[#ededef] font-mono font-medium">
                          {p.requiredDailyMinutes}m/hari
                        </span>
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium shrink-0 ${statusBadge.cls}`}
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
