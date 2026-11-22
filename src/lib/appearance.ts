export type BackgroundPresetId =
  | 'porcelain-clean'
  | 'sakura-mist'
  | 'sky-breeze'
  | 'warm-cream'
  | 'midnight-slate'
  | 'custom';

export type CustomOverlayStrength = 'light' | 'medium' | 'strong';

export interface AppearanceSettings {
  preset: BackgroundPresetId;
  customImageUrl: string;
  customOverlayStrength: CustomOverlayStrength;
  darkMode: boolean;
  glassMode: boolean;
  wallpaperBlur: number;
  wallpaperOpacity: number;
  themeBlur: number;
  themeGlassOpacity: number;
}

export interface BackgroundPresetMeta {
  id: Exclude<BackgroundPresetId, 'custom'>;
  name: string;
  description: string;
  swatchStyle: string;
  isDarkCanvas: boolean;
}

const APPEARANCE_STORAGE_KEY = 'immersiontrack_appearance_v2';
const APPEARANCE_EVENT_NAME = 'immersiontrack:appearance-changed';

export const BACKGROUND_PRESETS: BackgroundPresetMeta[] = [
  {
    id: 'midnight-slate',
    name: 'Manatan Navy (Gelap Glass)',
    description: 'Tema gelap navy & sky-cyan lembut di mata dengan efek blur kaca transparan',
    swatchStyle: 'linear-gradient(145deg, #0b121c 0%, #111c2d 60%, #1c324a 100%)',
    isDarkCanvas: true,
  },
  {
    id: 'porcelain-clean',
    name: 'Putih Bersih Modern',
    description: 'Latar putih bersih & abu netral dengan aksen sky-blue cerah',
    swatchStyle: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 60%, #e0f2fe 100%)',
    isDarkCanvas: false,
  },
  {
    id: 'sakura-mist',
    name: 'Sakura & Putih Lembut',
    description: 'Gradasi tipis merah muda sakura ke putih yang sejuk di mata',
    swatchStyle: 'linear-gradient(135deg, #fff1f2 0%, #ffffff 55%, #fce7f3 100%)',
    isDarkCanvas: false,
  },
  {
    id: 'sky-breeze',
    name: 'Biru Langit Segar',
    description: 'Gradasi biru langit muda & putih bersih yang menenangkan',
    swatchStyle: 'linear-gradient(135deg, #e0f2fe 0%, #ffffff 55%, #eff6ff 100%)',
    isDarkCanvas: false,
  },
  {
    id: 'warm-cream',
    name: 'Krem Hangat & Coral',
    description: 'Latar putih gading hangat yang lembut untuk membaca lama',
    swatchStyle: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 58%, #fef2f2 100%)',
    isDarkCanvas: false,
  },
];

export const APPEARANCE_GLASS_PRESETS: Array<{
  id: string;
  label: string;
  wallpaperBlur: number;
  wallpaperOpacity: number;
  themeBlur: number;
  themeGlassOpacity: number;
}> = [
  {
    id: 'crystal',
    label: 'Kaca Bening',
    wallpaperBlur: 0,
    wallpaperOpacity: 85,
    themeBlur: 8,
    themeGlassOpacity: 40,
  },
  {
    id: 'balanced',
    label: 'Seimbang',
    wallpaperBlur: 0,
    wallpaperOpacity: 65,
    themeBlur: 20,
    themeGlassOpacity: 68,
  },
  {
    id: 'soft-frosted',
    label: 'Blur Lembut',
    wallpaperBlur: 10,
    wallpaperOpacity: 55,
    themeBlur: 28,
    themeGlassOpacity: 74,
  },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  preset: 'midnight-slate',
  customImageUrl: '',
  customOverlayStrength: 'medium',
  darkMode: true,
  glassMode: true,
  wallpaperBlur: 0,
  wallpaperOpacity: 65,
  themeBlur: 20,
  themeGlassOpacity: 68,
};

function clampNumber(
  val: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, Math.round(val)));
}

export function loadAppearanceSettings(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
      const validPresets: BackgroundPresetId[] = [
        'porcelain-clean',
        'sakura-mist',
        'sky-breeze',
        'warm-cream',
        'midnight-slate',
        'custom',
      ];
      const preset = validPresets.includes(parsed.preset as BackgroundPresetId)
        ? (parsed.preset as BackgroundPresetId)
        : DEFAULT_APPEARANCE.preset;
      const overlay: CustomOverlayStrength =
        parsed.customOverlayStrength === 'light' ||
        parsed.customOverlayStrength === 'strong'
          ? parsed.customOverlayStrength
          : 'medium';
      const legacyOpacity =
        overlay === 'light' ? 82 : overlay === 'strong' ? 35 : 65;
      const darkMode =
        typeof parsed.darkMode === 'boolean'
          ? parsed.darkMode
          : true;
      const glassMode =
        typeof parsed.glassMode === 'boolean'
          ? parsed.glassMode
          : true;
      return {
        preset,
        customImageUrl:
          typeof parsed.customImageUrl === 'string'
            ? parsed.customImageUrl
            : '',
        customOverlayStrength: overlay,
        darkMode,
        glassMode,
        wallpaperBlur: clampNumber(
          parsed.wallpaperBlur,
          0,
          28,
          DEFAULT_APPEARANCE.wallpaperBlur
        ),
        wallpaperOpacity: clampNumber(
          parsed.wallpaperOpacity,
          0,
          100,
          legacyOpacity
        ),
        themeBlur: clampNumber(
          parsed.themeBlur,
          0,
          36,
          DEFAULT_APPEARANCE.themeBlur
        ),
        themeGlassOpacity: clampNumber(
          parsed.themeGlassOpacity,
          15,
          95,
          DEFAULT_APPEARANCE.themeGlassOpacity
        ),
      };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_APPEARANCE;
}

export function saveAppearanceSettings(settings: AppearanceSettings): void {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
  applyAppearanceToDocument(settings);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT_NAME));
  }
}

export function toggleDarkThemeMode(): AppearanceSettings {
  const current = loadAppearanceSettings();
  const nextDark = !current.darkMode;
  const next: AppearanceSettings = {
    ...current,
    darkMode: nextDark,
    glassMode: true,
    preset:
      current.preset === 'custom' && current.customImageUrl
        ? 'custom'
        : nextDark
          ? 'midnight-slate'
          : 'porcelain-clean',
  };
  saveAppearanceSettings(next);
  return next;
}

export function subscribeAppearanceChanges(
  callback: (settings: AppearanceSettings) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback(loadAppearanceSettings());
  window.addEventListener(APPEARANCE_EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(APPEARANCE_EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

export function applyAppearanceToDocument(settings: AppearanceSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-bg-preset', settings.preset);
  root.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light');
  root.setAttribute('data-glass', settings.glassMode ? 'true' : 'false');

  if (settings.preset === 'custom' && settings.customImageUrl.trim()) {
    const safeUrl = settings.customImageUrl.trim().replace(/"/g, '\\"');
    root.style.setProperty('--app-custom-bg', `url("${safeUrl}")`);
  } else {
    root.style.removeProperty('--app-custom-bg');
  }

  root.style.setProperty('--app-wallpaper-blur', `${settings.wallpaperBlur}px`);
  root.style.setProperty(
    '--app-wallpaper-opacity',
    (settings.wallpaperOpacity / 100).toFixed(2)
  );
  root.style.setProperty('--app-glass-blur', `${settings.themeBlur}px`);
  root.style.setProperty(
    '--app-glass-blur-sm',
    `${Math.round(settings.themeBlur * 0.6)}px`
  );
  root.style.setProperty(
    '--app-glass-alpha',
    (settings.themeGlassOpacity / 100).toFixed(2)
  );
  root.style.setProperty(
    '--app-glass-hover-alpha',
    Math.min(0.96, (settings.themeGlassOpacity + 10) / 100).toFixed(2)
  );
  root.style.setProperty(
    '--app-header-alpha',
    Math.min(0.96, (settings.themeGlassOpacity + 10) / 100).toFixed(2)
  );
  root.style.setProperty(
    '--app-inner-alpha',
    Math.max(0.12, (settings.themeGlassOpacity - 8) / 100).toFixed(2)
  );
  root.style.setProperty(
    '--app-custom-overlay',
    (1 - settings.wallpaperOpacity / 100).toFixed(2)
  );
  root.setAttribute(
    'data-wallpaper-light-canvas',
    !settings.darkMode &&
      settings.preset === 'custom' &&
      settings.wallpaperOpacity < 35
      ? 'true'
      : 'false'
  );
}

export function compressImageToDataUrl(
  file: File,
  maxWidth = 1600
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () =>
        reject(new Error('Format gambar tidak valid atau rusak.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(1, img.width));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressed);
        } catch (err) {
          reject(
            err instanceof Error
              ? err
              : new Error('Gagal memproses gambar background.')
          );
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
