import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Image as ImageIcon,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  APPEARANCE_GLASS_PRESETS,
  BACKGROUND_PRESETS,
  compressImageToDataUrl,
  DEFAULT_APPEARANCE,
  loadAppearanceSettings,
  saveAppearanceSettings,
  subscribeAppearanceChanges,
  toggleDarkThemeMode,
  type AppearanceSettings,
  type BackgroundPresetId,
} from '../lib/appearance';

interface AppearanceControlsContentProps {
  compact?: boolean;
}

export const AppearanceControlsContent: React.FC<
  AppearanceControlsContentProps
> = ({ compact = false }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [appearance, setAppearance] = useState<AppearanceSettings>(
    loadAppearanceSettings
  );
  const [urlDraft, setUrlDraft] = useState<string>(() => {
    const saved = loadAppearanceSettings().customImageUrl;
    return saved.startsWith('data:') ? '' : saved;
  });

  useEffect(() => {
    return subscribeAppearanceChanges((next) => {
      setAppearance(next);
    });
  }, []);

  const patchAppearance = (patch: Partial<AppearanceSettings>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch };
      saveAppearanceSettings(next);
      return next;
    });
  };

  const handleSelectPreset = (preset: BackgroundPresetId) => {
    const isDarkPreset = preset === 'midnight-slate';
    patchAppearance({
      preset,
      darkMode: isDarkPreset,
      glassMode: true,
    });
  };

  const handleUploadWallpaper = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      patchAppearance({
        preset: 'custom',
        customImageUrl: dataUrl,
        glassMode: true,
      });
      setUrlDraft('');
      toast.success('Wallpaper kustom diterapkan!');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal memasang wallpaper.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = urlDraft.trim();
    if (!clean.startsWith('https://') && !clean.startsWith('http://')) {
      toast.error('Masukkan URL gambar yang valid (https://...).');
      return;
    }
    patchAppearance({
      preset: 'custom',
      customImageUrl: clean,
      glassMode: true,
    });
    toast.success('URL wallpaper diterapkan!');
  };

  const handleRemoveCustomWallpaper = () => {
    setUrlDraft('');
    patchAppearance({
      preset: appearance.darkMode ? 'midnight-slate' : 'porcelain-clean',
      customImageUrl: '',
    });
    toast.success('Wallpaper kustom dihapus.');
  };

  const handleResetDefault = () => {
    setUrlDraft('');
    setAppearance(DEFAULT_APPEARANCE);
    saveAppearanceSettings(DEFAULT_APPEARANCE);
    toast.success('Pengaturan tampilan dikembalikan ke default.');
  };

  const hasCustomWallpaper = Boolean(appearance.customImageUrl.trim());
  const isCustomActive = appearance.preset === 'custom' && hasCustomWallpaper;
  const activePresetMeta = BACKGROUND_PRESETS.find(
    (p) => p.id === appearance.preset
  );

  return (
    <div className="space-y-4">
      {/* Section 1: Wallpaper Source & Preview */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <ImageIcon className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Wallpaper Kustom</span>
          </div>

          <div className="flex items-center gap-1.5">
            {hasCustomWallpaper && !isCustomActive && (
              <button
                type="button"
                onClick={() => patchAppearance({ preset: 'custom' })}
                className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700 hover:brightness-105 transition cursor-pointer"
              >
                Pakai Wallpaper Saya
              </button>
            )}
            {hasCustomWallpaper && (
              <button
                type="button"
                onClick={handleRemoveCustomWallpaper}
                title="Hapus wallpaper kustom"
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-red-500 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-crimson px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Unggah Gambar
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadWallpaper}
              className="hidden"
            />
          </div>
        </div>

        {/* Live mini preview strip */}
        <div className="relative h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
          {hasCustomWallpaper ? (
            <div
              className="absolute -inset-4 bg-cover bg-center"
              style={{
                backgroundImage: `url("${appearance.customImageUrl.trim().replace(/"/g, '\\"')}")`,
                opacity: appearance.wallpaperOpacity / 100,
                filter: `blur(${appearance.wallpaperBlur}px)`,
              }}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  activePresetMeta?.swatchStyle ??
                  'linear-gradient(145deg, #0b121c 0%, #111c2d 60%, #1c324a 100%)',
              }}
            />
          )}
          <div className="relative z-10 h-full px-3 flex items-center justify-between gap-2">
            <div
              className="px-2.5 py-1 rounded-lg border text-[11px] font-bold shadow-sm"
              style={{
                backgroundColor: appearance.darkMode
                  ? `rgba(15, 24, 38, ${(appearance.themeGlassOpacity / 100).toFixed(2)})`
                  : `rgba(255, 255, 255, ${(appearance.themeGlassOpacity / 100).toFixed(2)})`,
                backdropFilter: `blur(${appearance.themeBlur}px)`,
                WebkitBackdropFilter: `blur(${appearance.themeBlur}px)`,
                borderColor: appearance.darkMode
                  ? 'rgba(148, 179, 214, 0.22)'
                  : 'rgba(148, 163, 184, 0.35)',
                color: appearance.darkMode ? '#f3f7fc' : '#0f172a',
              }}
            >
              {isCustomActive
                ? 'Preview Wallpaper & Kaca'
                : (activePresetMeta?.name ?? 'Tema Dasar')}
            </div>
            <span className="px-2 py-0.5 rounded-md bg-black/45 text-white font-mono text-[10px] backdrop-blur-xs">
              WP {appearance.wallpaperOpacity}% • Blur {appearance.themeBlur}px
            </span>
          </div>
        </div>

        <form onSubmit={handleApplyUrl} className="flex gap-1.5">
          <input
            type="url"
            placeholder="Tempel URL gambar (https://...)"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-rose-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-xs font-bold text-rose-600 cursor-pointer shrink-0"
          >
            Pakai
          </button>
        </form>
      </div>

      {/* Section 2: Wallpaper Blur & Opacity */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <SlidersHorizontal className="w-3.5 h-3.5 text-rose-500" />
            Atur Wallpaper (Blur &amp; Opacity)
          </span>
        </div>

        <div className="space-y-2.5">
          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-600">
                Blur Wallpaper
              </span>
              <span className="font-mono font-bold text-rose-600 tabular-nums">
                {appearance.wallpaperBlur}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={28}
              step={1}
              value={appearance.wallpaperBlur}
              onChange={(e) =>
                patchAppearance({ wallpaperBlur: Number(e.target.value) })
              }
              aria-label="Blur Wallpaper"
              className="w-full h-1.5 accent-sky-400 cursor-pointer"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-600">
                Opacity Wallpaper
              </span>
              <span className="font-mono font-bold text-rose-600 tabular-nums">
                {appearance.wallpaperOpacity}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={appearance.wallpaperOpacity}
              onChange={(e) =>
                patchAppearance({ wallpaperOpacity: Number(e.target.value) })
              }
              aria-label="Opacity Wallpaper"
              className="w-full h-1.5 accent-sky-400 cursor-pointer"
            />
          </label>
        </div>

        {appearance.preset !== 'custom' && (
          <p className="text-[11px] text-slate-500 leading-snug">
            Unggah gambar atau tempel URL di atas agar efek blur &amp; opacity
            wallpaper terlihat langsung di layar.
          </p>
        )}
      </div>

      {/* Section 3: Theme Blur & Glass Transparency */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
            Atur Blur &amp; Transparansi Tema
          </span>
        </div>

        <div className="space-y-2.5">
          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-600">
                Blur Kaca Tema (Kartu &amp; Navbar)
              </span>
              <span className="font-mono font-bold text-rose-600 tabular-nums">
                {appearance.themeBlur}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={36}
              step={1}
              value={appearance.themeBlur}
              onChange={(e) =>
                patchAppearance({ themeBlur: Number(e.target.value) })
              }
              aria-label="Blur Kaca Tema"
              className="w-full h-1.5 accent-sky-400 cursor-pointer"
            />
          </label>

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-600">
                Opacity Kartu Tema
              </span>
              <span className="font-mono font-bold text-rose-600 tabular-nums">
                {appearance.themeGlassOpacity}%
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={95}
              step={1}
              value={appearance.themeGlassOpacity}
              onChange={(e) =>
                patchAppearance({ themeGlassOpacity: Number(e.target.value) })
              }
              aria-label="Opacity Kartu Tema"
              className="w-full h-1.5 accent-sky-400 cursor-pointer"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {APPEARANCE_GLASS_PRESETS.map((gp) => {
              const selected =
                appearance.wallpaperBlur === gp.wallpaperBlur &&
                appearance.wallpaperOpacity === gp.wallpaperOpacity &&
                appearance.themeBlur === gp.themeBlur &&
                appearance.themeGlassOpacity === gp.themeGlassOpacity;
              return (
                <button
                  key={gp.id}
                  type="button"
                  onClick={() =>
                    patchAppearance({
                      wallpaperBlur: gp.wallpaperBlur,
                      wallpaperOpacity: gp.wallpaperOpacity,
                      themeBlur: gp.themeBlur,
                      themeGlassOpacity: gp.themeGlassOpacity,
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    selected
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300'
                  }`}
                >
                  {gp.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Default
          </button>
        </div>
      </div>

      {/* Section 4: Base Color Theme Presets */}
      {compact ? (
        <div className="space-y-1.5">
          <span className="block text-[11px] font-bold text-slate-500">
            Preset Warna Dasar
          </span>
          <div className="grid grid-cols-5 gap-1.5">
            {BACKGROUND_PRESETS.map((preset) => {
              const active = appearance.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  title={preset.name}
                  className={`p-1 rounded-xl border text-center transition cursor-pointer space-y-1 ${
                    active
                      ? 'border-rose-400 ring-2 ring-rose-500/25'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className="h-6 rounded-lg border border-black/15"
                    style={{ background: preset.swatchStyle }}
                  />
                  <div className="text-[10px] font-bold text-slate-700 truncate">
                    {preset.id === 'midnight-slate'
                      ? 'Navy'
                      : preset.id === 'porcelain-clean'
                        ? 'Putih'
                        : preset.id === 'sakura-mist'
                          ? 'Sakura'
                          : preset.id === 'sky-breeze'
                            ? 'Langit'
                            : 'Krem'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <span className="block text-xs font-bold text-slate-700">
            Preset Tema Dasar
          </span>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {BACKGROUND_PRESETS.map((preset) => {
              const active = appearance.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer space-y-2 ${
                    active
                      ? 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className="h-12 rounded-lg border border-black/10 shadow-inner"
                    style={{ background: preset.swatchStyle }}
                  />
                  <div>
                    <div className="text-xs font-extrabold text-slate-900 flex items-center justify-between gap-1">
                      <span>{preset.name}</span>
                      {active && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {preset.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const WallpaperNavbarButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>(
    loadAppearanceSettings
  );

  useEffect(() => {
    return subscribeAppearanceChanges(setAppearance);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title="Atur Wallpaper, Blur Wallpaper, & Blur Tema"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
          open
            ? 'bg-rose-50 border-rose-400 text-rose-700'
            : 'bg-slate-100 hover:bg-rose-50 border-slate-200 hover:border-rose-300 text-slate-700 hover:text-rose-700'
        }`}
      >
        <ImageIcon className="w-3.5 h-3.5 text-rose-500" />
        <span className="hidden sm:inline">Wallpaper</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Pengaturan Wallpaper dan Blur Tema"
            className="fixed top-[calc(3.75rem+env(safe-area-inset-top))] right-3 sm:right-6 z-50 w-[min(24.5rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl p-4 shadow-2xl appearance-popover-panel animate-scale-in space-y-3"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                  Wallpaper &amp; Blur Tema
                </h3>
                <p className="text-[11px] text-slate-500">
                  Geser slider untuk melihat perubahan langsung
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleDarkThemeMode()}
                  title={
                    appearance.darkMode
                      ? 'Ganti ke Mode Terang'
                      : 'Ganti ke Mode Gelap'
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 border border-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  {appearance.darkMode ? (
                    <>
                      <Moon className="w-3 h-3 text-rose-400" />
                      <span>Gelap</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-3 h-3 text-amber-500" />
                      <span>Terang</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Tutup panel wallpaper"
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <AppearanceControlsContent compact />
          </div>
        </>
      )}
    </div>
  );
};
