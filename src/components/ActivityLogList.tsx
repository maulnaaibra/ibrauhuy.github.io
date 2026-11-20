import React, { useMemo, useState } from 'react';
import { Pencil, Search, Sparkles, Trash2 } from 'lucide-react';
import { getCategoryMeta, type ImmersionLog } from '../types';
import { getLogXp } from '../utils/stats';

interface ActivityLogListProps {
  logs: ImmersionLog[];
  onEdit: (log: ImmersionLog) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
  onViewAll?: () => void;
}

export const ActivityLogList: React.FC<ActivityLogListProps> = ({
  logs,
  onEdit,
  onDelete,
  compact = false,
  onViewAll,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'duration' | 'xp'>('newest');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const availableCategories = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      const meta = getCategoryMeta(l.category);
      map.set(l.category, meta.shortLabel);
    });
    return Array.from(map.entries());
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = logs.filter((l) => {
      if (categoryFilter !== 'all' && l.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        (l.notes ?? '').toLowerCase().includes(q)
      );
    });

    if (sortBy === 'duration') {
      return [...list].sort((a, b) => b.duration_minutes - a.duration_minutes);
    }
    if (sortBy === 'xp') {
      return [...list].sort((a, b) => getLogXp(b) - getLogXp(a));
    }
    return [...list].sort((a, b) => {
      if (a.logged_date !== b.logged_date) {
        return b.logged_date.localeCompare(a.logged_date);
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [logs, search, categoryFilter, sortBy]);

  const displayLogs = compact ? filtered.slice(0, 6) : filtered;

  return (
    <div className="p-5 rounded-2xl bg-[#171c26] border border-white/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-100">
            {compact ? 'Aktivitas Terbaru' : 'Semua Riwayat Immersion'}
          </h3>
          <p className="text-xs text-slate-400">
            {filtered.length} sesi tercatat
          </p>
        </div>

        {compact && onViewAll && logs.length > 6 && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition cursor-pointer self-start sm:self-center"
          >
            Lihat Semua ({logs.length}) →
          </button>
        )}
      </div>

      {!compact && (
        <div className="space-y-3 mb-5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul atau catatan..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'newest' | 'duration' | 'xp')
              }
              className="px-3.5 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] text-xs font-medium text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="newest">Urutkan: Terbaru</option>
              <option value="duration">Urutkan: Durasi Terlama</option>
              <option value="xp">Urutkan: XP Terbanyak</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#11151c] text-slate-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              Semua
            </button>
            {availableCategories.map(([catKey, shortLabel]) => (
              <button
                key={catKey}
                type="button"
                onClick={() => setCategoryFilter(catKey)}
                className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                  categoryFilter === catKey
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#11151c] text-slate-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {shortLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {displayLogs.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-10">
          Belum ada catatan immersion yang cocok.
        </p>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {displayLogs.map((log) => {
            const meta = getCategoryMeta(log.category);
            const xp = getLogXp(log);
            const isConfirming = confirmDeleteId === log.id;

            return (
              <div
                key={log.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold border border-white/[0.08]"
                    style={{
                      backgroundColor: `${meta.color}20`,
                      color: meta.color,
                    }}
                  >
                    {meta.shortLabel.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-100 truncate">
                        {log.title}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        <Sparkles className="w-2.5 h-2.5" />+{xp} XP
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-2.5 flex-wrap font-mono">
                      <span>{log.logged_date}</span>
                      <span>• {log.duration_minutes} mnt</span>
                      {log.cards_mined > 0 && (
                        <span className="text-pink-300">
                          • +{log.cards_mined} kartu
                        </span>
                      )}
                      {log.notes && (
                        <span className="font-sans text-slate-500 truncate max-w-md">
                          — {log.notes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {isConfirming ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(log.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition cursor-pointer"
                      >
                        Ya, Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#11151c] border border-white/[0.08] text-xs text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(log)}
                        className="p-2 rounded-lg bg-[#11151c] border border-white/[0.06] hover:border-white/[0.18] text-slate-300 transition cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(log.id)}
                        className="p-2 rounded-lg bg-[#11151c] border border-white/[0.06] hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 text-slate-400 transition cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
