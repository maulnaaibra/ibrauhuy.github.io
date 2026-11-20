import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editingLog ? 'Edit Sesi Immersion' : 'Catat Sesi Immersion'}
        className="w-full max-w-lg rounded-2xl bg-[#171c26] border border-white/[0.1] p-6 shadow-2xl my-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold text-white">
              {editingLog ? 'Edit Sesi Immersion' : 'Catat Sesi Immersion'}
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3 h-3" />+{estimatedXp} XP
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Judul Media / Konten
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Sousou no Frieren / Steins;Gate / Podcast"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Tipe Media ({getCategoryMeta(category).xpPerHour} XP/jam)
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {selectableCategories.map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 transition cursor-pointer text-left ${
                      active
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                        : 'bg-[#11151c] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/[0.15]'
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-400">
                Durasi (menit)
              </label>
              <div className="flex items-center gap-1 flex-wrap">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDuration(preset)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                      duration === preset
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#11151c] text-slate-400 hover:text-white border border-white/[0.06]'
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Tanggal
              </label>
              <input
                type="date"
                required
                value={loggedDate}
                onChange={(e) => setLoggedDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Kartu / Kosakata (+4 XP/kartu)
              </label>
              <input
                type="number"
                min={0}
                value={cardsMined}
                onChange={(e) => setCardsMined(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Catatan Sesi (opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Episode berapa, tingkat pemahaman, atau kosakata menarik..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11151c] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#11151c] border border-white/[0.08] hover:bg-slate-800 text-sm font-medium text-slate-300 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition disabled:opacity-60 cursor-pointer shadow-lg shadow-indigo-600/20"
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
