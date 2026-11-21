import React, { useMemo, useState } from 'react';
import { Clock, Pencil, Search, Trash2 } from 'lucide-react';
import { MediaCover } from '../components/MediaCover';
import { getCategoryMeta, type ImmersionLog } from '../types';

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
  const [sortBy, setSortBy] = useState<'newest' | 'duration' | 'cards'>('newest');
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
    if (sortBy === 'cards') {
      return [...list].sort((a, b) => b.cards_mined - a.cards_mined);
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
    <div className="card-pro p-5 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">
            {compact ? 'Riwayat Sesi Terbaru' : 'Semua Riwayat Immersion'}
          </h3>
          <p className="text-xs text-slate-500">
            {filtered.length} sesi tercatat
          </p>
        </div>

        {compact && onViewAll && logs.length > 6 && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors cursor-pointer self-start sm:self-center"
          >
            Lihat Semua ({logs.length}) →
          </button>
        )}
      </div>

      {!compact && (
        <div className="space-y-3 mb-5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul atau catatan..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:bg-white"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'newest' | 'duration' | 'cards')
              }
              className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:border-red-500 focus:bg-white"
            >
              <option value="newest">Urutkan: Terbaru</option>
              <option value="duration">Urutkan: Durasi Terlama</option>
              <option value="cards">Urutkan: Kartu Terbanyak</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
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
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {shortLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {displayLogs.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">
          Belum ada catatan immersion yang cocok.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {displayLogs.map((log) => {
            const meta = getCategoryMeta(log.category);
            const isConfirming = confirmDeleteId === log.id;

            return (
              <div
                key={log.id}
                className="py-3.5 px-2.5 -mx-2.5 rounded-xl hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <MediaCover
                    title={log.title}
                    category={log.category}
                    className="w-12 h-16 rounded-xl"
                  />

                  <div className="space-y-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {log.title}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        {meta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                        <Clock className="w-2.5 h-2.5" />
                        {log.duration_minutes} mnt
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-2.5 flex-wrap font-mono">
                      <span>{log.logged_date}</span>
                      <span>• {log.duration_minutes} mnt</span>
                      {log.cards_mined > 0 && (
                        <span className="text-slate-700 font-medium">
                          • +{log.cards_mined} kartu
                        </span>
                      )}
                    </div>

                    {log.notes && (
                      <p className="text-xs text-slate-500 line-clamp-1 max-w-xl">
                        {log.notes}
                      </p>
                    )}
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
                        className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition cursor-pointer"
                      >
                        Ya, Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 hover:text-slate-900 transition cursor-pointer"
                      >
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(log)}
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(log.id)}
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-400 transition cursor-pointer"
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
