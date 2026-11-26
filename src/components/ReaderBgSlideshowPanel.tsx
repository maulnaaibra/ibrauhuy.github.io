import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  Images,
  Pause,
  Play,
  Plus,
  Shuffle,
  Trash2,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ReaderPreferences } from '../lib/epubReaderStore';

export interface HydratedReaderBgSlide {
  id: string;
  kind: 'blob' | 'url';
  name: string;
  resolvedUrl: string;
  addedAt: number;
}

interface ThemeStyleLite {
  subtleBtn: string;
  mutedText: string;
  accentText: string;
}

interface ReaderBgSlideshowPanelProps {
  prefs: ReaderPreferences;
  updatePrefs: (patch: Partial<ReaderPreferences>) => void;
  themeStyle: ThemeStyleLite;
  slides: HydratedReaderBgSlide[];
  activeSlideIndex: number;
  paused: boolean;
  onTogglePaused: () => void;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onSelectSlide: (idx: number) => void;
  onAddFiles: (files: FileList | File[]) => Promise<void>;
  onAddUrl: (url: string) => Promise<void>;
  onMoveSlide: (id: string, dir: -1 | 1) => Promise<void>;
  onDeleteSlide: (id: string) => Promise<void>;
  onClearSlides: () => Promise<void>;
}

function formatSlideDuration(sec: number): string {
  const s = Math.max(2, Math.round(sec));
  if (s < 60) return `${s} detik`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m} menit (${s} dtk)` : `${m} mnt ${rem} dtk`;
}

export const ReaderBgSlideshowPanel: React.FC<ReaderBgSlideshowPanelProps> = ({
  prefs,
  updatePrefs,
  themeStyle,
  slides,
  activeSlideIndex,
  paused,
  onTogglePaused,
  onPrevSlide,
  onNextSlide,
  onSelectSlide,
  onAddFiles,
  onAddUrl,
  onMoveSlide,
  onDeleteSlide,
  onClearSlides,
}) => {
  const multiFileRef = useRef<HTMLInputElement | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [intervalDraft, setIntervalDraft] = useState(
    String(prefs.bgSlideshowIntervalSec)
  );
  const [uploading, setUploading] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  React.useEffect(() => {
    setIntervalDraft(String(prefs.bgSlideshowIntervalSec));
  }, [prefs.bgSlideshowIntervalSec]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await onAddFiles(files);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = urlDraft.trim();
    if (!/^https?:\/\//i.test(clean)) {
      toast.error('Masukkan URL foto yang valid (https://... atau http://...).');
      return;
    }
    await onAddUrl(clean);
    setUrlDraft('');
  };

  const commitCustomSeconds = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setIntervalDraft(String(prefs.bgSlideshowIntervalSec));
      return;
    }
    const clamped = Math.min(3600, Math.max(2, Math.round(n)));
    updatePrefs({ bgSlideshowIntervalSec: clamped });
    setIntervalDraft(String(clamped));
  };

  const safeIdx =
    slides.length > 0 ? Math.min(slides.length - 1, Math.max(0, activeSlideIndex)) : 0;

  return (
    <div className="space-y-3 rounded-xl border border-sky-400/30 bg-sky-500/8 p-3">
      <input
        ref={multiFileRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => void handleFileChange(e)}
        className="hidden"
      />

      {/* Header + Slide Counter + Play/Prev/Next */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold inline-flex items-center gap-1.5">
            <Images className={`w-3.5 h-3.5 shrink-0 ${themeStyle.accentText}`} />
            <span>Slideshow Foto ({slides.length} Foto)</span>
          </div>
          <div className={`text-[10px] leading-tight mt-0.5 ${themeStyle.mutedText}`}>
            {slides.length === 0
              ? 'Pilih banyak foto sekaligus dari galeri/PC'
              : slides.length === 1
                ? 'Tambah minimal 2 foto agar otomatis berganti'
                : `Foto #${safeIdx + 1}/${slides.length} • Ganti tiap ${formatSlideDuration(prefs.bgSlideshowIntervalSec)}`}
          </div>
        </div>

        {slides.length > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onPrevSlide}
              title="Foto Sebelumnya"
              className={`p-1.5 rounded-lg border cursor-pointer ${themeStyle.subtleBtn}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onTogglePaused}
              title={paused ? 'Lanjutkan Slideshow' : 'Jeda Slideshow'}
              className={`p-1.5 rounded-lg border cursor-pointer ${
                paused
                  ? 'bg-amber-500/25 border-amber-400/50 text-amber-200'
                  : 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
              }`}
            >
              {paused ? (
                <Play className="w-3.5 h-3.5" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onNextSlide}
              title="Foto Berikutnya"
              className={`p-1.5 rounded-lg border cursor-pointer ${themeStyle.subtleBtn}`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Add Multiple Photos & URL */}
      <div className="space-y-1.5">
        <button
          type="button"
          disabled={uploading}
          onClick={() => multiFileRef.current?.click()}
          className="btn-crimson w-full py-2 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>
            {uploading
              ? 'Menyimpan foto...'
              : '+ Tambah Foto (Bisa Pilih Banyak Sekaligus)'}
          </span>
        </button>

        <form onSubmit={(e) => void handleUrlSubmit(e)} className="flex gap-1.5">
          <input
            type="url"
            placeholder="Atau tempel URL gambar ke slideshow (https://...)"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-black/25 border border-current/15 text-[11px] focus:outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer ${themeStyle.subtleBtn}`}
          >
            <Plus className="w-3 h-3" />
            <span>Tambah</span>
          </button>
        </form>
      </div>

      {/* Timer / Interval Controls */}
      <div className="space-y-2 rounded-xl border border-current/12 bg-black/15 p-2.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className={`font-bold inline-flex items-center gap-1 ${themeStyle.mutedText}`}>
            <Clock className="w-3.5 h-3.5" />
            <span>Waktu Ganti Foto</span>
          </span>
          <span className={`font-mono font-bold ${themeStyle.accentText}`}>
            {formatSlideDuration(prefs.bgSlideshowIntervalSec)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min={2}
            max={120}
            step={1}
            value={Math.min(120, prefs.bgSlideshowIntervalSec)}
            onChange={(e) =>
              updatePrefs({ bgSlideshowIntervalSec: Number(e.target.value) })
            }
            className="flex-1 h-2 accent-sky-400 cursor-pointer"
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={2}
              max={3600}
              value={intervalDraft}
              onChange={(e) => {
                setIntervalDraft(e.target.value);
                const parsed = Number(e.target.value);
                if (Number.isFinite(parsed) && parsed >= 2 && parsed <= 3600) {
                  updatePrefs({ bgSlideshowIntervalSec: Math.round(parsed) });
                }
              }}
              onBlur={() => commitCustomSeconds(intervalDraft)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitCustomSeconds(intervalDraft);
              }}
              aria-label="Waktu ganti slideshow dalam detik"
              className="w-14 px-1.5 py-1 rounded-lg bg-black/25 border border-current/15 text-[11px] font-mono text-center focus:outline-none focus:border-sky-400"
            />
            <span className={`text-[10px] font-bold ${themeStyle.mutedText}`}>
              dtk
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {[
            { sec: 3, label: '3 dtk' },
            { sec: 5, label: '5 dtk' },
            { sec: 10, label: '10 dtk' },
            { sec: 20, label: '20 dtk' },
            { sec: 30, label: '30 dtk' },
            { sec: 60, label: '1 mnt' },
            { sec: 180, label: '3 mnt' },
            { sec: 300, label: '5 mnt' },
          ].map((preset) => (
            <button
              key={preset.sec}
              type="button"
              onClick={() => updatePrefs({ bgSlideshowIntervalSec: preset.sec })}
              className={`py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                prefs.bgSlideshowIntervalSec === preset.sec
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : themeStyle.subtleBtn
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Crossfade Speed + Shuffle Order */}
        <div className="pt-1 border-t border-current/10 space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className={`font-bold ${themeStyle.mutedText}`}>
              Efek Transisi Fade
            </span>
            <button
              type="button"
              onClick={() =>
                updatePrefs({ bgSlideshowShuffle: !prefs.bgSlideshowShuffle })
              }
              className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                prefs.bgSlideshowShuffle
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : themeStyle.subtleBtn
              }`}
            >
              <Shuffle className="w-2.5 h-2.5" />
              <span>{prefs.bgSlideshowShuffle ? 'Urutan Acak' : 'Berurutan'}</span>
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[
              { ms: 0, label: 'Instan' },
              { ms: 400, label: 'Cepat' },
              { ms: 1000, label: 'Halus' },
              { ms: 2000, label: 'Lembut' },
            ].map((tr) => (
              <button
                key={tr.ms}
                type="button"
                onClick={() => updatePrefs({ bgSlideshowTransitionMs: tr.ms })}
                className={`py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                  prefs.bgSlideshowTransitionMs === tr.ms
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Photo Gallery List */}
      {slides.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className={`font-bold ${themeStyle.mutedText}`}>
              Daftar Foto (klik foto untuk langsung tampilkan)
            </span>
            {!confirmClearAll ? (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="text-red-400 hover:underline font-bold cursor-pointer"
              >
                Hapus Semua
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClearAll(false);
                    void onClearSlides();
                  }}
                  className="px-1.5 py-0.5 rounded bg-red-500 text-white font-bold cursor-pointer"
                >
                  Ya Hapus
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className={`px-1.5 py-0.5 rounded border font-bold cursor-pointer ${themeStyle.subtleBtn}`}
                >
                  Batal
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
            {slides.map((slide, idx) => {
              const isCurrent = idx === safeIdx;
              return (
                <div
                  key={slide.id}
                  className={`group relative rounded-xl overflow-hidden border aspect-[4/3] bg-black/30 ${
                    isCurrent
                      ? 'border-sky-400 ring-2 ring-sky-400/50'
                      : 'border-white/15 hover:border-white/35'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSlide(idx)}
                    title={`${slide.name} (Klik untuk tampilkan)`}
                    className="w-full h-full block cursor-pointer"
                  >
                    {slide.resolvedUrl ? (
                      <img
                        src={slide.resolvedUrl}
                        alt={slide.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] opacity-60">
                        Memuat...
                      </div>
                    )}
                  </button>

                  {/* Index badge */}
                  <span
                    className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-extrabold pointer-events-none ${
                      isCurrent
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-black/65 text-white'
                    }`}
                  >
                    #{idx + 1}
                  </span>

                  {/* Top-right Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDeleteSlide(slide.id);
                    }}
                    title="Hapus foto ini"
                    className="absolute top-1 right-1 p-1 rounded-md bg-black/70 hover:bg-red-500 text-white transition cursor-pointer"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>

                  {/* Bottom Reorder controls */}
                  {slides.length > 1 && (
                    <div className="absolute bottom-1 inset-x-1 flex items-center justify-between gap-1 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onMoveSlide(slide.id, -1);
                        }}
                        title="Geser maju"
                        className="p-0.5 rounded bg-black/75 hover:bg-sky-500 hover:text-slate-950 text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-2.5 h-2.5 -rotate-90" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === slides.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onMoveSlide(slide.id, 1);
                        }}
                        title="Geser mundur"
                        className="p-0.5 rounded bg-black/75 hover:bg-sky-500 hover:text-slate-950 text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-2.5 h-2.5 -rotate-90" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
