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
}

export interface BackgroundPresetMeta {
  id: Exclude<BackgroundPresetId, 'custom'>;
  name: string;
  description: string;
  swatchStyle: string;
  isDarkCanvas: boolean;
}

const APPEARANCE_STORAGE_KEY = 'immersiontrack_appearance_v2';

export const BACKGROUND_PRESETS: BackgroundPresetMeta[] = [
  {
    id: 'porcelain-clean',
    name: 'Putih Bersih Modern',
    description: 'Latar putih bersih & abu netral dengan aksen crimson cerah',
    swatchStyle: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 60%, #ffe4e6 100%)',
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
  {
    id: 'midnight-slate',
    name: 'Gelap Elegan (Midnight)',
    description: 'Latar slate gelap modern yang nyaman untuk sesi belajar malam',
    swatchStyle: 'linear-gradient(145deg, #0f172a 0%, #1e293b 65%, #334155 100%)',
    isDarkCanvas: true,
  },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  preset: 'porcelain-clean',
  customImageUrl: '',
  customOverlayStrength: 'medium',
};

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
      ? '0.22'
      : settings.customOverlayStrength === 'strong'
        ? '0.68'
        : '0.45';
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
