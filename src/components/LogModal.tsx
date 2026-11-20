import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { MediaCover } from '../components/MediaCover';
import {
  CATEGORY_META,
  PRIMARY_CATEGORIES,
  getCategoryMeta,
  type ImmersionCategory,
  type ImmersionLog,
} from '../types';
import { calculateXp, getLocalDateString } from '../utils/stats';

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    category: ImmersionCategory;
    duration_minutes: number;
    cards_mined: number;
    notes: string;
    logged_date: string;
  }) => Promise<void>;
  editingLog?: ImmersionLog | null;
  initialDuration?: number;
  initialTitle?: string;
  initialCategory?: ImmersionCategory;
}

const DURATION_PRESETS = [15, 25, 30, 45, 60, 90];

export const LogModal: React.FC<LogModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingLog,
  initialDuration,
  initialTitle,
  initialCategory,
}) => {
  const [title, setTitle] = useState(
    () => editingLog?.title ?? initialTitle ?? ''
  );
  const [category, setCategory] = useState<ImmersionCategory>(
    () => editingLog?.category ?? initialCategory ?? 'anime'
  );
  const [duration, setDuration] = useState(
    () => editingLog?.duration_minutes ?? initialDuration ?? 30
  );
  const [cardsMined, setCardsMined] = useState(
    () => editingLog?.cards_mined ?? 0
  );
  const [notes, setNotes] = useState(() => editingLog?.notes ?? '');
  const [loggedDate, setLoggedDate] = useState(
    () => editingLog?.logged_date ?? getLocalDateString()
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const estimatedXp = calculateXp(category, duration, cardsMined);
  const currentMeta = getCategoryMeta(category);
  const selectableCategories: ImmersionCategory[] = PRIMARY_CATEGORIES.includes(
    category as (typeof PRIMARY_CATEGORIES)[number]
  )
    ? PRIMARY_CATEGORIES
    : [category, ...PRIMARY_CATEGORIES];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        category,
        duration_minutes: Math.max(1, Number(duration)),
        cards_mined: Math.max(0, Number(cardsMined)),
        notes: notes.trim(),
        logged_date: loggedDate,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto animate-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editingLog ? 'Edit Sesi Immersion' : 'Catat Sesi Immersion'}
        className="w-full max-w-lg rounded-xl bg-[#16181c] border border-[#2c303a] p-6 my-auto"
      >
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#242730]">
          <div className="flex items-baseline gap-3">
            <h2 className="text-base font-semibold text-[#ededef]">
              {editingLog ? 'Edit Sesi' : 'Catat Sesi Immersion'}
            </h2>
            <span className="text-xs font-mono text-[#5cd697]">
              +{estimatedXp} XP
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 rounded-lg text-[#6c727f] hover:text-[#ededef] hover:bg-[#21242b] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          <div className="flex items-start gap-3.5">
            <MediaCover
              title={title || currentMeta.label}
              category={category}
              className="w-12 h-16 rounded-md mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-[#9aa0ac] mb-1.5">
                Judul Media / Konten
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Sousou no Frieren / Steins;Gate"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field w-full px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-[#6c727f] mt-1.5">
                Sampul media akan dicocokkan otomatis di riwayat aktivitas.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#9aa0ac]">
                Tipe Media
              </label>
              <span className="text-[11px] font-mono text-[#6c727f]">
                {currentMeta.xpPerHour} XP/jam
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {selectableCategories.map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-2 rounded-lg text-xs border flex items-center gap-2 transition-colors cursor-pointer text-left ${
                      active
                        ? 'bg-[#21242b] border-[#525866] text-[#ededef] font-medium'
                        : 'bg-[#121316] border-[#242730] text-[#9aa0ac] hover:text-[#ededef] hover:border-[#313540]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="truncate">{meta.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <label className="text-xs font-medium text-[#9aa0ac]">
                Durasi (menit)
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDuration(preset)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      duration === preset
                        ? 'bg-[#ededef] text-[#111215] font-medium'
                        : 'bg-[#1b1e23] text-[#9aa0ac] hover:text-[#ededef] border border-[#242730]'
                    }`}
                  >
                    {preset}m
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              required
              min={1}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="input-field w-full px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9aa0ac] mb-1.5">
                Tanggal
              </label>
              <input
                type="date"
                required
                value={loggedDate}
                onChange={(e) => setLoggedDate(e.target.value)}
                className="input-field w-full px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9aa0ac] mb-1.5">
                Kartu Baru (+4 XP)
              </label>
              <input
                type="number"
                min={0}
                value={cardsMined}
                onChange={(e) => setCardsMined(Number(e.target.value))}
                className="input-field w-full px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9aa0ac] mb-1.5">
              Catatan (opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Episode berapa, tingkat pemahaman, atau kosakata menarik..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field w-full px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242730]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            >
              {submitting
                ? 'Menyimpan...'
                : editingLog
                  ? 'Simpan Perubahan'
                  : 'Simpan Sesi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
