export interface BuiltinReaderFont {
  id: string;
  label: string;
  sampleTag: string;
  cssFamily: string;
  googleFamily?: string;
}

export interface CustomReaderFont {
  id: string;
  name: string;
  source: 'file' | 'google' | 'system';
  familyName: string;
  fileName?: string;
  addedAt: number;
}

export const BUILTIN_READER_FONTS: BuiltinReaderFont[] = [
  {
    id: 'serif',
    label: 'Noto Serif JP',
    sampleTag: 'Mincho Klasik',
    cssFamily: "'Noto Serif JP', 'Yu Mincho', 'Hiragino Mincho ProN', serif",
  },
  {
    id: 'sans',
    label: 'Noto Sans JP',
    sampleTag: 'Gothic Modern',
    cssFamily: "'Noto Sans JP', 'Plus Jakarta Sans', system-ui, sans-serif",
  },
  {
    id: 'shippori',
    label: 'Shippori Mincho',
    sampleTag: 'Novel Cetak',
    cssFamily: "'Shippori Mincho', 'Noto Serif JP', serif",
    googleFamily: 'Shippori+Mincho:wght@400;500;600;700;800',
  },
  {
    id: 'klee',
    label: 'Klee One',
    sampleTag: 'Buku / VN',
    cssFamily: "'Klee One', 'Noto Serif JP', serif",
    googleFamily: 'Klee+One:wght@400;600',
  },
  {
    id: 'zen-maru',
    label: 'Zen Maru Gothic',
    sampleTag: 'Bulat Lembut',
    cssFamily: "'Zen Maru Gothic', 'Noto Sans JP', sans-serif",
    googleFamily: 'Zen+Maru+Gothic:wght@300;400;500;700',
  },
  {
    id: 'biz-udmincho',
    label: 'BIZ UDMincho',
    sampleTag: 'UD Mincho Tajam',
    cssFamily: "'BIZ UDMincho', 'Noto Serif JP', serif",
    googleFamily: 'BIZ+UDMincho:wght@400;700',
  },
  {
    id: 'biz-udgothic',
    label: 'BIZ UDGothic',
    sampleTag: 'UD Gothic Jelas',
    cssFamily: "'BIZ UDGothic', 'Noto Sans JP', sans-serif",
    googleFamily: 'BIZ+UDGothic:wght@400;700',
  },
  {
    id: 'kaisei',
    label: 'Kaisei Opti',
    sampleTag: 'Klasik Fantasi',
    cssFamily: "'Kaisei Opti', 'Noto Serif JP', serif",
    googleFamily: 'Kaisei+Opti:wght@400;500;700',
  },
  {
    id: 'yuji',
    label: 'Yuji Syuku',
    sampleTag: 'Kaligrafi Kuas',
    cssFamily: "'Yuji Syuku', 'Noto Serif JP', serif",
    googleFamily: 'Yuji+Syuku',
  },
];

const CUSTOM_FONTS_META_KEY = 'immersiontrack_reader_custom_fonts_v1';
const FONT_DB_NAME = 'immersiontrack_reader_fonts_db';
const FONT_DB_VERSION = 1;
const FONT_STORE_NAME = 'fonts';
const MAX_FONT_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_FONT_EXT_RE = /\.(ttf|otf|woff2?)$/i;

const loadedGoogleLinks = new Set<string>();
const loadedFaceIds = new Set<string>();

function openFontDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser ini tidak mendukung IndexedDB untuk font.'));
      return;
    }
    const req = indexedDB.open(FONT_DB_NAME, FONT_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FONT_STORE_NAME)) {
        db.createObjectStore(FONT_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error('Gagal membuka penyimpanan font.'));
  });
}

async function putFontBlob(id: string, blob: Blob): Promise<void> {
  const db = await openFontDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FONT_STORE_NAME, 'readwrite');
    tx.objectStore(FONT_STORE_NAME).put(blob, id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menyimpan file font ke browser.'));
    };
  });
}

async function getFontBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openFontDb();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(FONT_STORE_NAME, 'readonly');
      const req = tx.objectStore(FONT_STORE_NAME).get(id);
      req.onsuccess = () => {
        db.close();
        resolve(req.result instanceof Blob ? req.result : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

async function removeFontBlob(id: string): Promise<void> {
  try {
    const db = await openFontDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(FONT_STORE_NAME, 'readwrite');
      tx.objectStore(FONT_STORE_NAME).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore storage errors
  }
}

function saveCustomReaderFontsMeta(fonts: CustomReaderFont[]): void {
  try {
    localStorage.setItem(CUSTOM_FONTS_META_KEY, JSON.stringify(fonts));
  } catch {
    // ignore storage quota errors
  }
}

export function loadCustomReaderFonts(): CustomReaderFont[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FONTS_META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const clean: CustomReaderFont[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const f = item as Partial<CustomReaderFont>;
      if (
        typeof f.id !== 'string' ||
        typeof f.name !== 'string' ||
        typeof f.familyName !== 'string'
      ) {
        continue;
      }
      const source: CustomReaderFont['source'] =
        f.source === 'google' || f.source === 'system' ? f.source : 'file';
      clean.push({
        id: f.id,
        name: f.name,
        source,
        familyName: f.familyName,
        fileName: typeof f.fileName === 'string' ? f.fileName : undefined,
        addedAt:
          typeof f.addedAt === 'number' && Number.isFinite(f.addedAt)
            ? f.addedAt
            : Date.now(),
      });
    }
    return clean;
  } catch {
    return [];
  }
}

function injectGoogleFontCss(googleFamilyParam: string): void {
  if (typeof document === 'undefined' || !googleFamilyParam) return;
  const href = `https://fonts.googleapis.com/css2?family=${googleFamilyParam}&display=swap`;
  if (loadedGoogleLinks.has(href)) return;
  loadedGoogleLinks.add(href);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  if (googleFamilyParam.includes(':')) {
    link.onerror = () => {
      const bareFamily = googleFamilyParam.split(':')[0];
      if (bareFamily) {
        injectGoogleFontCss(bareFamily);
      }
    };
  }
  document.head.appendChild(link);
}

function sanitizeFontDisplayName(raw: string): string {
  return raw
    .replace(/['";\r\n]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

export async function saveCustomFontFile(
  file: File,
  displayName?: string
): Promise<CustomReaderFont> {
  if (!ALLOWED_FONT_EXT_RE.test(file.name)) {
    throw new Error(
      'Format font tidak didukung. Pilih file .ttf, .otf, .woff, atau .woff2.'
    );
  }
  if (file.size > MAX_FONT_FILE_BYTES) {
    throw new Error('Ukuran file font maksimal 25 MB.');
  }
  if (typeof FontFace === 'undefined' || !document.fonts) {
    throw new Error('Browser ini tidak mendukung pemuatan file font kustom.');
  }

  const baseName =
    sanitizeFontDisplayName(
      displayName?.trim() || file.name.replace(ALLOWED_FONT_EXT_RE, '')
    ) || 'Custom Font';
  const id = `font-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const familyName = `ReaderCustomFont_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

  const buffer = await file.arrayBuffer();
  const face = new FontFace(familyName, buffer, { weight: '100 900' });
  const loadedFace = await face.load();
  document.fonts.add(loadedFace);
  loadedFaceIds.add(id);

  await putFontBlob(id, file);

  const entry: CustomReaderFont = {
    id,
    name: baseName,
    source: 'file',
    familyName,
    fileName: file.name,
    addedAt: Date.now(),
  };

  const current = loadCustomReaderFonts();
  saveCustomReaderFontsMeta([entry, ...current]);
  return entry;
}

export function addNamedCustomFont(
  name: string,
  source: 'google' | 'system'
): CustomReaderFont {
  const cleanName = sanitizeFontDisplayName(name);
  if (!cleanName) {
    throw new Error('Masukkan nama font terlebih dahulu.');
  }

  const current = loadCustomReaderFonts();
  const existing = current.find(
    (f) =>
      f.source === source &&
      f.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    if (source === 'google') {
      injectGoogleFontCss(
        `${encodeURIComponent(existing.familyName).replace(/%20/g, '+')}:wght@300;400;500;600;700`
      );
    }
    return existing;
  }

  const entry: CustomReaderFont = {
    id: `named-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    name: cleanName,
    source,
    familyName: cleanName,
    addedAt: Date.now(),
  };

  if (source === 'google') {
    injectGoogleFontCss(
      `${encodeURIComponent(cleanName).replace(/%20/g, '+')}:wght@300;400;500;600;700`
    );
  }

  saveCustomReaderFontsMeta([entry, ...current]);
  return entry;
}

export async function deleteCustomReaderFont(
  fontId: string
): Promise<CustomReaderFont[]> {
  const current = loadCustomReaderFonts();
  const next = current.filter((f) => f.id !== fontId);
  saveCustomReaderFontsMeta(next);
  loadedFaceIds.delete(fontId);
  await removeFontBlob(fontId);
  return next;
}

export async function ensureReaderFontLoaded(
  fontId: string,
  customFonts: CustomReaderFont[] = loadCustomReaderFonts()
): Promise<void> {
  const builtin = BUILTIN_READER_FONTS.find((b) => b.id === fontId);
  if (builtin) {
    if (builtin.googleFamily) {
      injectGoogleFontCss(builtin.googleFamily);
      try {
        await document.fonts?.ready;
      } catch {
        // ignore font loading wait failures
      }
    }
    return;
  }

  const custom = customFonts.find((f) => f.id === fontId);
  if (!custom) return;

  if (custom.source === 'google') {
    injectGoogleFontCss(
      `${encodeURIComponent(custom.familyName).replace(/%20/g, '+')}:wght@300;400;500;600;700`
    );
    try {
      await document.fonts?.ready;
    } catch {
      // ignore
    }
    return;
  }

  if (custom.source === 'file' && !loadedFaceIds.has(custom.id)) {
    if (typeof FontFace === 'undefined' || !document.fonts) return;
    const blob = await getFontBlob(custom.id);
    if (!blob) return;
    try {
      const buffer = await blob.arrayBuffer();
      const face = new FontFace(custom.familyName, buffer, {
        weight: '100 900',
      });
      const loadedFace = await face.load();
      document.fonts.add(loadedFace);
      loadedFaceIds.add(custom.id);
    } catch {
      // ignore corrupted font blob gracefully
    }
  }
}

export function resolveReaderFontCss(
  fontId: string,
  customFonts: CustomReaderFont[]
): string {
  const builtin = BUILTIN_READER_FONTS.find((b) => b.id === fontId);
  if (builtin) return builtin.cssFamily;

  const custom = customFonts.find((f) => f.id === fontId);
  if (custom) {
    const safeFamily = custom.familyName.replace(/'/g, '');
    return `'${safeFamily}', 'Noto Serif JP', 'Noto Sans JP', serif`;
  }

  return BUILTIN_READER_FONTS[0].cssFamily;
}
