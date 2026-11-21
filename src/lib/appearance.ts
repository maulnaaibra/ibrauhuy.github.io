export type BackgroundPresetId =
  | 'burgundy-cream'
  | 'burgundy-velvet'
  | 'ivory-clean'
  | 'rose-dusk'
  | 'wine-night'
  | 'custom';

export type CustomOverlayStrength = 'light' | 'medium' | 'strong';

export interface AppearanceSettings {
  preset: BackgroundPresetId;
  customImageUrl: string;
  customOverlayStrength: CustomOverlayStrength;
}

export interface BackgroundPresetMeta {
  id: Exclude<BackgroundPresetId, 'custom'>;
  name: string;
  description: string;
  swatchStyle: string;
  isDarkCanvas: boolean;
}

const APPEARANCE_STORAGE_KEY = 'immersiontrack_appearance_v1';

export const BACKGROUND_PRESETS: BackgroundPresetMeta[] = [
  {
    id: 'burgundy-cream',
    name: 'Burgundy & Peach Cream',
    description: 'Gradasi lembut peach #fed7b8 berpadu aksen maroon #59171b',
    swatchStyle:
      'linear-gradient(135deg, #fed7b8 0%, #fff4eb 55%, #f5d0c5 100%)',
    isDarkCanvas: false,
  },
  {
    id: 'burgundy-velvet',
    name: 'Gradasi Wine Velvet',
    description: 'Gradasi penuh dari peach terang #fed7b8 ke maroon #59171b',
    swatchStyle:
      'linear-gradient(160deg, #fed7b8 0%, #b06c64 48%, #59171b 100%)',
    isDarkCanvas: true,
  },
  {
    id: 'ivory-clean',
    name: 'Putih Gading Bersih',
    description: 'Latar bersih terang dengan sentuhan hangat minimal',
    swatchStyle: 'linear-gradient(135deg, #ffffff 0%, #fdf5ee 100%)',
    isDarkCanvas: false,
  },
  {
    id: 'rose-dusk',
    name: 'Peach Senja Hangat',
    description: 'Nuansa aprikot & terracotta lembut yang nyaman di mata',
    swatchStyle: 'linear-gradient(135deg, #fed7b8 0%, #f2baa8 52%, #e69e8e 100%)',
    isDarkCanvas: false,
  },
  {
    id: 'wine-night',
    name: 'Burgundy Malam',
    description: 'Latar merah marun tua #59171b yang tenang untuk sesi malam',
    swatchStyle: 'linear-gradient(145deg, #2b090c 0%, #59171b 60%, #7d252a 100%)',
    isDarkCanvas: true,
  },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  preset: 'burgundy-cream',
  customImageUrl: '',
  customOverlayStrength: 'medium',
};

export function loadAppearanceSettings(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
      const validPresets: BackgroundPresetId[] = [
        'burgundy-cream',
        'burgundy-velvet',
        'ivory-clean',
        'rose-dusk',
        'wine-night',
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
      return {
        preset,
        customImageUrl:
          typeof parsed.customImageUrl === 'string'
            ? parsed.customImageUrl
            : '',
        customOverlayStrength: overlay,
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
}

export function applyAppearanceToDocument(settings: AppearanceSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-bg-preset', settings.preset);

  if (settings.preset === 'custom' && settings.customImageUrl.trim()) {
    const safeUrl = settings.customImageUrl.trim().replace(/"/g, '\\"');
    root.style.setProperty('--app-custom-bg', `url("${safeUrl}")`);
  } else {
    root.style.removeProperty('--app-custom-bg');
  }

  const overlayAlpha =
    settings.customOverlayStrength === 'light'
      ? '0.28'
      : settings.customOverlayStrength === 'strong'
        ? '0.72'
        : '0.50';
  root.style.setProperty('--app-custom-overlay', overlayAlpha);
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
