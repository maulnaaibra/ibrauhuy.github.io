import React, { useMemo, useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { MediaCover } from '../components/MediaCover';
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
    <section className="surface">
      <div className="px-5 py-4 border-b border-[#242730] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#ededef]">
            {compact ? 'Riwayat Sesi Terbaru' : 'Semua Riwayat Immersion'}
          </h3>
          <p className="text-xs text-[#9aa0ac] mt-0.5 tabular-nums">
            {filtered.length} sesi tercatat
          </p>
        </div>

        {compact && onViewAll && logs.length > 6 && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-[#9aa0ac] hover:text-[#ededef] transition-colors cursor-pointer self-start sm:self-center"
          >
            Lihat semua ({logs.length}) →
          </button>
        )}
      </div>

      {!compact && (
        <div className="px-5 py-4 border-b border-[#242730] space-y-3 bg-[#121316]/50">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6c727f] absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul atau catatan..."
                className="input-field w-full pl-9 pr-3 py-2 text-sm"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'newest' | 'duration' | 'xp')
              }
              aria-label="Urutkan riwayat"
              className="input-field px-3 py-2 text-xs font-medium text-[#ededef]"
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
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-[#ededef] text-[#111215]'
                  : 'bg-[#1b1e23] text-[#9aa0ac] hover:text-[#ededef] border border-[#242730]'
              }`}
            >
              Semua
            </button>
            {availableCategories.map(([catKey, shortLabel]) => (
              <button
                key={catKey}
                type="button"
                onClick={() => setCategoryFilter(catKey)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  categoryFilter === catKey
                    ? 'bg-[#ededef] text-[#111215]'
                    : 'bg-[#1b1e23] text-[#9aa0ac] hover:text-[#ededef] border border-[#242730]'
                }`}
              >
                {shortLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {displayLogs.length === 0 ? (
        <p className="text-center text-sm text-[#6c727f] py-12 px-4">
          Belum ada catatan immersion yang cocok.
        </p>
      ) : (
        <div className="divide-y divide-[#22252d]">
          {displayLogs.map((log) => {
            const meta = getCategoryMeta(log.category);
            const xp = getLogXp(log);
            const isConfirming = confirmDeleteId === log.id;

            return (
              <div
                key={log.id}
                className="px-5 py-3.5 hover:bg-[#1b1e23]/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <MediaCover
                    title={log.title}
                    category={log.category}
                    className="w-10 h-14 rounded-md"
                  />

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-[#ededef] truncate">
                        {log.title}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#9aa0ac]">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        {meta.shortLabel}
                      </span>
                    </div>

                    <div className="text-xs text-[#6c727f] flex items-center gap-2 flex-wrap font-mono tabular-nums">
                      <span>{log.logged_date}</span>
                      <span>·</span>
                      <span className="text-[#ededef] font-medium">
                        {log.duration_minutes} mnt
                      </span>
                      <span>·</span>
                      <span className="text-[#5cd697]">+{xp} XP</span>
                      {log.cards_mined > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-[#9aa0ac]">
                            +{log.cards_mined} kartu
                          </span>
                        </>
                      )}
                    </div>

                    {log.notes && (
                      <p className="text-xs text-[#9aa0ac] line-clamp-1 max-w-xl">
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
                        className="px-2.5 py-1 rounded-md bg-[#3a1c20] hover:bg-[#4c2329] border border-[#5c2a30] text-xs font-medium text-[#f29b9b] transition-colors cursor-pointer"
                      >
                        Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="btn-secondary px-2.5 py-1 rounded-md text-xs text-[#9aa0ac] cursor-pointer"
                      >
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(log)}
                        className="p-1.5 rounded-md text-[#6c727f] hover:text-[#ededef] hover:bg-[#22252d] transition-colors cursor-pointer"
                        title="Edit"
                        aria-label={`Edit ${log.title}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(log.id)}
                        className="p-1.5 rounded-md text-[#6c727f] hover:text-[#e57373] hover:bg-[#2a191b] transition-colors cursor-pointer"
                        title="Hapus"
                        aria-label={`Hapus ${log.title}`}
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
    </section>
  );
};
