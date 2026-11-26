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
  customAccentColor: string;
  customBgColor: string;
  customCardColor: string;
  customTextColor: string;
}

export interface BackgroundPresetMeta {
  id: Exclude<BackgroundPresetId, 'custom'>;
  name: string;
  description: string;
  swatchStyle: string;
  isDarkCanvas: boolean;
}

export interface CustomThemePaletteMeta {
  id: string;
  name: string;
  darkMode: boolean;
  accentColor: string;
  bgColor: string;
  cardColor: string;
  textColor: string;
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

export const CUSTOM_THEME_PALETTES: CustomThemePaletteMeta[] = [
  {
    id: 'manatan-navy',
    name: 'Manatan',
    darkMode: true,
    accentColor: '#38bdf8',
    bgColor: '#0b121c',
    cardColor: '#0f1826',
    textColor: '',
  },
  {
    id: 'sakura-night',
    name: 'Sakura',
    darkMode: true,
    accentColor: '#fb7185',
    bgColor: '#160b14',
    cardColor: '#23121f',
    textColor: '',
  },
  {
    id: 'matcha-dark',
    name: 'Matcha',
    darkMode: true,
    accentColor: '#34d399',
    bgColor: '#081511',
    cardColor: '#0f241c',
    textColor: '',
  },
  {
    id: 'amethyst-dark',
    name: 'Amethyst',
    darkMode: true,
    accentColor: '#a78bfa',
    bgColor: '#110a1f',
    cardColor: '#1b1132',
    textColor: '',
  },
  {
    id: 'sunset-gold',
    name: 'Sunset',
    darkMode: true,
    accentColor: '#fbbf24',
    bgColor: '#161008',
    cardColor: '#24190d',
    textColor: '',
  },
  {
    id: 'crimson-day',
    name: 'Crimson',
    darkMode: false,
    accentColor: '#e11d48',
    bgColor: '#fff5f7',
    cardColor: '#ffffff',
    textColor: '',
  },
  {
    id: 'matcha-day',
    name: 'Mint Day',
    darkMode: false,
    accentColor: '#059669',
    bgColor: '#ecfdf5',
    cardColor: '#ffffff',
    textColor: '',
  },
  {
    id: 'sky-day',
    name: 'Sky Day',
    darkMode: false,
    accentColor: '#0ea5e9',
    bgColor: '#f0f9ff',
    cardColor: '#ffffff',
    textColor: '',
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
  customAccentColor: '',
  customBgColor: '',
  customCardColor: '',
  customTextColor: '',
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

export function normalizeHexColor(val: unknown): string {
  if (typeof val !== 'string') return '';
  let s = val.trim().toLowerCase();
  if (!s) return '';
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return /^#[0-9a-f]{6}$/.test(s) ? s : '';
}

function parseHexRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const clean = normalizeHexColor(hex);
  if (!clean) return null;
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16),
  };
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const sn = Math.min(100, Math.max(0, s)) / 100;
  const ln = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ln - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) {
    rp = c;
    gp = x;
  } else if (hh < 120) {
    rp = x;
    gp = c;
  } else if (hh < 180) {
    gp = c;
    bp = x;
  } else if (hh < 240) {
    gp = x;
    bp = c;
  } else if (hh < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function shiftHexLightness(
  hex: string,
  deltaL: number,
  sOverride?: number
): { hex: string; rgbStr: string } {
  const rgb = parseHexRgb(hex) ?? { r: 15, g: 24, b: 38 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const nextL = Math.min(98, Math.max(3, hsl.l + deltaL));
  const nextS = typeof sOverride === 'number' ? sOverride : hsl.s;
  const nextRgb = hslToRgb(hsl.h, nextS, nextL);
  return {
    hex: hslToHex(hsl.h, nextS, nextL),
    rgbStr: `${nextRgb.r}, ${nextRgb.g}, ${nextRgb.b}`,
  };
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const toLin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

export function isHexColorDark(hex: string): boolean {
  const rgb = parseHexRgb(hex);
  if (!rgb) return true;
  return getRelativeLuminance(rgb.r, rgb.g, rgb.b) < 0.34;
}

function buildAccentRamp(accentHex: string) {
  const rgb = parseHexRgb(accentHex) ?? { r: 56, g: 189, b: 248 };
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const lum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  const contrast = lum > 0.38 ? '#06131f' : '#ffffff';

  const ramp: Record<string, string> = {
    '50': hslToHex(h, Math.min(s, 96), 96),
    '100': hslToHex(h, Math.min(s, 92), 92),
    '200': hslToHex(h, Math.min(s, 90), 84),
    '300': hslToHex(h, s, Math.max(66, Math.min(82, l + 16))),
    '400': hslToHex(h, s, Math.max(54, Math.min(74, l + 7))),
    '500': accentHex,
    '600': hslToHex(h, s, Math.max(24, Math.min(54, l * 0.84))),
    '700': hslToHex(h, s, Math.max(18, Math.min(44, l * 0.68))),
    '800': hslToHex(h, s, Math.max(14, Math.min(36, l * 0.54))),
    '900': hslToHex(h, s, Math.max(10, Math.min(28, l * 0.42))),
    '950': hslToHex(h, s, Math.max(6, Math.min(20, l * 0.28))),
  };

  return {
    ramp,
    rgbStr: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    contrast,
    gradFrom: hslToHex(h, Math.min(100, s), Math.min(90, Math.max(44, l + 9))),
    gradTo: accentHex,
    darkTextBright: ramp['300'],
    darkTextMid: ramp['400'],
  };
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
        customAccentColor: normalizeHexColor(parsed.customAccentColor),
        customBgColor: normalizeHexColor(parsed.customBgColor),
        customCardColor: normalizeHexColor(parsed.customCardColor),
        customTextColor: normalizeHexColor(parsed.customTextColor),
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
    customBgColor: '',
    customCardColor: '',
    customTextColor: '',
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

const ACCENT_SHADE_KEYS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const;

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

  // 1. Dynamic Primary Accent Color + Full Tailwind rose-* Ramp
  const accentHex = normalizeHexColor(settings.customAccentColor);
  if (accentHex) {
    const acc = buildAccentRamp(accentHex);
    root.setAttribute('data-custom-accent', 'true');
    for (const k of ACCENT_SHADE_KEYS) {
      root.style.setProperty(`--color-rose-${k}`, acc.ramp[k]);
    }
    root.style.setProperty('--app-accent-primary', accentHex);
    root.style.setProperty('--app-accent-grad-from', acc.gradFrom);
    root.style.setProperty('--app-accent-grad-to', acc.gradTo);
    root.style.setProperty('--app-accent-rgb', acc.rgbStr);
    root.style.setProperty('--app-accent-contrast', acc.contrast);
    root.style.setProperty('--app-accent-soft', `rgba(${acc.rgbStr}, 0.16)`);
    root.style.setProperty('--app-accent-border', `rgba(${acc.rgbStr}, 0.32)`);
    root.style.setProperty('--app-accent-light', acc.darkTextBright);
    root.style.setProperty('--app-accent-mid', acc.darkTextMid);
    root.style.setProperty('--brand-primary', accentHex);
    root.style.setProperty('--brand-primary-dark', acc.ramp['600']);
  } else {
    root.setAttribute('data-custom-accent', 'false');
    for (const k of ACCENT_SHADE_KEYS) {
      root.style.removeProperty(`--color-rose-${k}`);
    }
    [
      '--app-accent-primary',
      '--app-accent-grad-from',
      '--app-accent-grad-to',
      '--app-accent-rgb',
      '--app-accent-contrast',
      '--app-accent-soft',
      '--app-accent-border',
      '--app-accent-light',
      '--app-accent-mid',
      '--brand-primary',
      '--brand-primary-dark',
    ].forEach((p) => root.style.removeProperty(p));
  }

  // 2. Dynamic Page Background Color
  const bgHex = normalizeHexColor(settings.customBgColor);
  if (bgHex) {
    const gradA = shiftHexLightness(bgHex, settings.darkMode ? -2 : 4);
    const gradB = shiftHexLightness(bgHex, settings.darkMode ? 6 : -5);
    root.setAttribute('data-custom-bg', 'true');
    root.style.setProperty('--app-bg-base', bgHex);
    root.style.setProperty('--app-bg-grad-a', gradA.hex);
    root.style.setProperty('--app-bg-grad-mid', bgHex);
    root.style.setProperty('--app-bg-grad-b', gradB.hex);
  } else {
    root.setAttribute('data-custom-bg', 'false');
    [
      '--app-bg-base',
      '--app-bg-grad-a',
      '--app-bg-grad-mid',
      '--app-bg-grad-b',
    ].forEach((p) => root.style.removeProperty(p));
  }

  // 3. Dynamic Card, Navbar, Header, Inner Panels & Harmonic Border Colors
  const cardHex = normalizeHexColor(settings.customCardColor);
  const effectiveCardBase =
    cardHex ||
    (bgHex
      ? shiftHexLightness(bgHex, settings.darkMode ? 5 : 4).hex
      : '');
  if (effectiveCardBase) {
    const cardRgb = parseHexRgb(effectiveCardBase) ?? { r: 15, g: 24, b: 38 };
    const hoverShift = shiftHexLightness(
      effectiveCardBase,
      settings.darkMode ? 4 : -2
    );
    const headerShift = shiftHexLightness(
      effectiveCardBase,
      settings.darkMode ? -3 : 0
    );
    const innerShift = shiftHexLightness(
      effectiveCardBase,
      settings.darkMode ? 5 : -3
    );
    const borderShift = shiftHexLightness(
      effectiveCardBase,
      settings.darkMode ? 48 : -22,
      24
    );

    root.setAttribute('data-custom-card', 'true');
    root.style.setProperty(
      '--app-card-rgb',
      `${cardRgb.r}, ${cardRgb.g}, ${cardRgb.b}`
    );
    root.style.setProperty('--app-card-hover-rgb', hoverShift.rgbStr);
    root.style.setProperty('--app-header-rgb', headerShift.rgbStr);
    root.style.setProperty('--app-inner-rgb', innerShift.rgbStr);
    root.style.setProperty('--app-border-rgb', borderShift.rgbStr);
  } else {
    root.setAttribute('data-custom-card', 'false');
    [
      '--app-card-rgb',
      '--app-card-hover-rgb',
      '--app-header-rgb',
      '--app-inner-rgb',
      '--app-border-rgb',
    ].forEach((p) => root.style.removeProperty(p));
  }

  // 4. Dynamic Text Color
  const textHex = normalizeHexColor(settings.customTextColor);
  const textRgb = textHex ? parseHexRgb(textHex) : null;
  if (textHex && textRgb) {
    root.setAttribute('data-custom-text', 'true');
    root.style.setProperty('--app-ink-primary', textHex);
    root.style.setProperty(
      '--app-ink-secondary',
      `rgba(${textRgb.r}, ${textRgb.g}, ${textRgb.b}, 0.78)`
    );
    root.style.setProperty(
      '--app-ink-muted',
      `rgba(${textRgb.r}, ${textRgb.g}, ${textRgb.b}, 0.58)`
    );
  } else {
    root.setAttribute('data-custom-text', 'false');
    [
      '--app-ink-primary',
      '--app-ink-secondary',
      '--app-ink-muted',
    ].forEach((p) => root.style.removeProperty(p));
  }
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
