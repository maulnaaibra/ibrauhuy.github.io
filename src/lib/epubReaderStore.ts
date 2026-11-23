import JSZip from 'jszip';

export interface StoredNovelChapter {
  id: string;
  title: string;
  html: string;
  charCount: number;
}

export interface StoredNovelBook {
  storageKey: string;
  catalogItemId?: string;
  title: string;
  author?: string;
  fileName: string;
  chapters: StoredNovelChapter[];
  totalChars: number;
  currentChapter: number;
  scrollRatio: number;
  updatedAt: number;
}

export type StoredNovelSummary = Omit<StoredNovelBook, 'chapters'> & {
  chapterCount: number;
};

export interface ReaderPreferences {
  writingMode: 'horizontal' | 'vertical';
  furigana: 'show' | 'hover' | 'hide';
  fontSize: number;
  fontFamily: 'serif' | 'sans';
  theme: 'navy' | 'amoled' | 'sepia' | 'light';
}

export const DEFAULT_READER_PREFS: ReaderPreferences = {
  writingMode: 'horizontal',
  furigana: 'show',
  fontSize: 20,
  fontFamily: 'serif',
  theme: 'navy',
};

const READER_PREFS_STORAGE_KEY = 'immersiontrack_reader_prefs_v1';
const YATSU_LINKS_STORAGE_KEY = 'immersiontrack_yatsu_links_v1';
const YATSU_DEFAULT_LIBRARY_URL = 'https://app.yatsu.moe/library';

const DB_NAME = 'immersiontrack_novel_reader_db';
const DB_VERSION = 1;
const STORE_NAME = 'books';

export function loadReaderPrefs(): ReaderPreferences {
  try {
    const raw = localStorage.getItem(READER_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
      const writingMode =
        parsed.writingMode === 'vertical' ? 'vertical' : 'horizontal';
      const furigana =
        parsed.furigana === 'hover' || parsed.furigana === 'hide'
          ? parsed.furigana
          : 'show';
      const fontSize =
        typeof parsed.fontSize === 'number' && Number.isFinite(parsed.fontSize)
          ? Math.min(34, Math.max(16, Math.round(parsed.fontSize)))
          : DEFAULT_READER_PREFS.fontSize;
      const fontFamily = parsed.fontFamily === 'sans' ? 'sans' : 'serif';
      const theme =
        parsed.theme === 'amoled' ||
        parsed.theme === 'sepia' ||
        parsed.theme === 'light'
          ? parsed.theme
          : 'navy';
      return { writingMode, furigana, fontSize, fontFamily, theme };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_READER_PREFS;
}

export function saveReaderPrefs(prefs: ReaderPreferences): void {
  try {
    localStorage.setItem(READER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota errors
  }
}

export function loadYatsuBookLinks(): Record<string, string> {
  try {
    const raw = localStorage.getItem(YATSU_LINKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v.trim()) {
            clean[k] = v.trim();
          }
        }
        return clean;
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

export function normalizeYatsuUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.hostname.endsWith('yatsu.moe')) {
        return u.toString();
      }
    } catch {
      return null;
    }
    return null;
  }
  if (/^b\?id=/i.test(trimmed)) {
    return `https://app.yatsu.moe/${trimmed}`;
  }
  if (/^[a-zA-Z0-9_-]{3,128}$/.test(trimmed)) {
    return `https://app.yatsu.moe/b?id=${encodeURIComponent(trimmed)}`;
  }
  return null;
}

export function saveYatsuBookLink(
  key: string,
  url: string
): Record<string, string> {
  const current = loadYatsuBookLinks();
  const next = { ...current, [key]: url };
  try {
    localStorage.setItem(YATSU_LINKS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function removeYatsuBookLink(key: string): Record<string, string> {
  const current = loadYatsuBookLinks();
  const next = { ...current };
  delete next[key];
  try {
    localStorage.setItem(YATSU_LINKS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function resolveYatsuUrl(
  key: string,
  links: Record<string, string>
): string {
  return links[key] || YATSU_DEFAULT_LIBRARY_URL;
}

function openNovelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser ini tidak mendukung IndexedDB.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'storageKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error('Gagal membuka database reader novel.'));
  });
}

export async function saveStoredNovelBook(book: StoredNovelBook): Promise<void> {
  const db = await openNovelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(book);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menyimpan novel ke browser.'));
    };
  });
}

export async function getStoredNovelBook(
  storageKey: string
): Promise<StoredNovelBook | null> {
  try {
    const db = await openNovelDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(storageKey);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredNovelBook | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('Gagal membaca novel tersimpan.'));
      };
    });
  } catch {
    return null;
  }
}

export async function listStoredNovelBooks(): Promise<StoredNovelSummary[]> {
  try {
    const db = await openNovelDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        db.close();
        const items = ((req.result as StoredNovelBook[]) ?? []).map((b) => ({
          storageKey: b.storageKey,
          catalogItemId: b.catalogItemId,
          title: b.title,
          author: b.author,
          fileName: b.fileName,
          totalChars: b.totalChars,
          currentChapter: b.currentChapter,
          scrollRatio: b.scrollRatio,
          updatedAt: b.updatedAt,
          chapterCount: b.chapters?.length ?? 0,
        }));
        items.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(items);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('Gagal memuat daftar buku tersimpan.'));
      };
    });
  } catch {
    return [];
  }
}

export async function updateStoredNovelProgress(
  storageKey: string,
  currentChapter: number,
  scrollRatio: number
): Promise<void> {
  try {
    const existing = await getStoredNovelBook(storageKey);
    if (!existing) return;
    await saveStoredNovelBook({
      ...existing,
      currentChapter,
      scrollRatio,
      updatedAt: Date.now(),
    });
  } catch {
    // ignore background progress persistence errors
  }
}

export async function deleteStoredNovelBook(storageKey: string): Promise<void> {
  const db = await openNovelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(storageKey);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menghapus novel tersimpan.'));
    };
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeZipPath(path: string): string {
  let clean = path.replace(/\\/g, '/').split('#')[0].split('?')[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // keep original if malformed percent-encoding
  }
  const parts: string[] = [];
  for (const segment of clean.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join('/');
}

function getDirPath(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '' : filePath.slice(0, idx);
}

function resolveZipRelative(baseDir: string, href: string): string {
  if (!href) return '';
  const stripped = href.trim();
  if (stripped.startsWith('/')) {
    return normalizeZipPath(stripped.slice(1));
  }
  return normalizeZipPath(baseDir ? `${baseDir}/${stripped}` : stripped);
}

function getMimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
}

function computeJapaneseCharCount(container: Element): number {
  const clone = container.cloneNode(true) as Element;
  clone.querySelectorAll('rt, rp').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, '').length;
}

function parseXmlOrHtmlDocument(raw: string): Document {
  const parser = new DOMParser();
  const xhtmlDoc = parser.parseFromString(raw, 'application/xhtml+xml');
  if (!xhtmlDoc.querySelector('parsererror')) {
    return xhtmlDoc;
  }
  return parser.parseFromString(raw, 'text/html');
}

const DISALLOWED_TAGS_SELECTOR =
  'script, style, iframe, object, embed, link, meta, form, input, textarea, select, button, noscript, audio, video';

async function sanitizeChapterRoot(
  root: Element,
  chapterDir: string,
  zipLookup: Map<string, JSZip.JSZipObject>,
  imageCache: Map<string, string>
): Promise<{ html: string; charCount: number; hasMedia: boolean }> {
  root
    .querySelectorAll(DISALLOWED_TAGS_SELECTOR)
    .forEach((el) => el.remove());

  const loadDataUrl = async (href: string): Promise<string | null> => {
    if (!href || /^(https?:|data:|blob:|javascript:)/i.test(href)) {
      return null;
    }
    const resolved = resolveZipRelative(chapterDir, href);
    if (!resolved) return null;
    const cached = imageCache.get(resolved);
    if (cached) return cached;

    const entry =
      zipLookup.get(resolved) ?? zipLookup.get(resolved.toLowerCase());
    if (!entry) return null;
    try {
      const b64 = await entry.async('base64');
      const dataUrl = `data:${getMimeFromPath(resolved)};base64,${b64}`;
      imageCache.set(resolved, dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  };

  const imgs = Array.from(root.querySelectorAll('img'));
  for (const img of imgs) {
    const src = img.getAttribute('src') ?? '';
    const dataUrl = await loadDataUrl(src);
    if (dataUrl) {
      img.setAttribute('src', dataUrl);
    } else if (!/^https?:/i.test(src) && !/^data:/i.test(src)) {
      img.removeAttribute('src');
    }
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.setAttribute('loading', 'lazy');
  }

  const svgImages = Array.from(root.querySelectorAll('image'));
  for (const svgImg of svgImages) {
    const href =
      svgImg.getAttribute('xlink:href') ?? svgImg.getAttribute('href') ?? '';
    const dataUrl = await loadDataUrl(href);
    if (dataUrl) {
      svgImg.setAttribute('href', dataUrl);
      svgImg.removeAttribute('xlink:href');
    }
  }

  const allElements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of allElements) {
    for (const attr of Array.from(el.attributes)) {
      const nameLower = attr.name.toLowerCase();
      if (
        nameLower.startsWith('on') ||
        nameLower === 'style' ||
        nameLower === 'srcset' ||
        nameLower === 'xmlns' ||
        nameLower === 'xml:lang'
      ) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (nameLower === 'href' || nameLower === 'src') &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.tagName.toLowerCase() === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (href && !/^https?:/i.test(href)) {
        el.removeAttribute('href');
      } else if (/^https?:/i.test(href)) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }

  const charCount = computeJapaneseCharCount(root);
  const hasMedia =
    root.querySelectorAll('img[src], svg image[href]').length > 0;

  return {
    html: root.innerHTML,
    charCount,
    hasMedia,
  };
}

function decodeTextBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('shift_jis').decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }
}

export async function parseNovelFile(
  file: File,
  options: { storageKey: string; catalogItemId?: string; fallbackTitle?: string }
): Promise<StoredNovelBook> {
  const lowerName = file.name.toLowerCase();
  const baseFileNameTitle = file.name.replace(/\.(epub|txt|html?|xhtml)$/i, '');

  if (lowerName.endsWith('.txt')) {
    const buffer = await file.arrayBuffer();
    const rawText = decodeTextBuffer(buffer).replace(/\r\n?/g, '\n');
    const paragraphs = rawText.split(/\n{2,}/);
    const chapters: StoredNovelChapter[] = [];
    let chunkHtml: string[] = [];
    let chunkChars = 0;

    const flushChunk = () => {
      if (chunkHtml.length === 0) return;
      const idx = chapters.length + 1;
      chapters.push({
        id: `txt-${idx}`,
        title: chapters.length === 0 && paragraphs.length <= 80 ? 'Teks Lengkap' : `Bagian ${idx}`,
        html: chunkHtml.join('\n'),
        charCount: chunkChars,
      });
      chunkHtml = [];
      chunkChars = 0;
    };

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      const safe = escapeHtml(trimmed).replace(/\n/g, '<br />');
      chunkHtml.push(`<p>${safe}</p>`);
      chunkChars += trimmed.replace(/\s+/g, '').length;
      if (chunkChars >= 18000) {
        flushChunk();
      }
    }
    flushChunk();

    if (chapters.length === 0) {
      throw new Error('File TXT kosong atau tidak berisi teks.');
    }

    const totalChars = chapters.reduce((acc, ch) => acc + ch.charCount, 0);
    return {
      storageKey: options.storageKey,
      catalogItemId: options.catalogItemId,
      title: options.fallbackTitle || baseFileNameTitle,
      fileName: file.name,
      chapters,
      totalChars,
      currentChapter: 0,
      scrollRatio: 0,
      updatedAt: Date.now(),
    };
  }

  if (
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.xhtml')
  ) {
    const buffer = await file.arrayBuffer();
    const rawHtml = decodeTextBuffer(buffer);
    const doc = parseXmlOrHtmlDocument(rawHtml);
    const body = doc.body ?? doc.documentElement;
    const cleaned = await sanitizeChapterRoot(
      body,
      '',
      new Map(),
      new Map()
    );
    const docTitle = doc.querySelector('title')?.textContent?.trim();
    return {
      storageKey: options.storageKey,
      catalogItemId: options.catalogItemId,
      title: docTitle || options.fallbackTitle || baseFileNameTitle,
      fileName: file.name,
      chapters: [
        {
          id: 'html-1',
          title: docTitle || 'Teks Novel',
          html: cleaned.html,
          charCount: cleaned.charCount,
        },
      ],
      totalChars: cleaned.charCount,
      currentChapter: 0,
      scrollRatio: 0,
      updatedAt: Date.now(),
    };
  }

  if (!lowerName.endsWith('.epub')) {
    throw new Error(
      'Format tidak didukung. Pilih file .epub, .txt, atau .html/.xhtml.'
    );
  }

  const zip = await JSZip.loadAsync(file);
  const zipLookup = new Map<string, JSZip.JSZipObject>();
  let fallbackOpfPath = '';

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const norm = normalizeZipPath(relativePath);
    zipLookup.set(norm, entry);
    zipLookup.set(norm.toLowerCase(), entry);
    if (!fallbackOpfPath && norm.toLowerCase().endsWith('.opf')) {
      fallbackOpfPath = norm;
    }
  });

  let opfPath = fallbackOpfPath;
  const containerEntry =
    zipLookup.get('META-INF/container.xml') ??
    zipLookup.get('meta-inf/container.xml');
  if (containerEntry) {
    const containerXml = await containerEntry.async('string');
    const containerDoc = new DOMParser().parseFromString(
      containerXml,
      'application/xml'
    );
    const rootfile = containerDoc.querySelector('rootfile[full-path]');
    const fullPath = rootfile?.getAttribute('full-path');
    if (fullPath) {
      opfPath = normalizeZipPath(fullPath);
    }
  }

  const opfEntry =
    (opfPath ? zipLookup.get(opfPath) ?? zipLookup.get(opfPath.toLowerCase()) : undefined) ??
    (fallbackOpfPath ? zipLookup.get(fallbackOpfPath) : undefined);

  if (!opfEntry) {
    throw new Error('Struktur EPUB tidak valid (file .opf tidak ditemukan).');
  }

  const opfDir = getDirPath(opfPath);
  const opfXml = await opfEntry.async('string');
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

  const metaTitle =
    opfDoc.getElementsByTagName('dc:title')[0]?.textContent?.trim() ||
    opfDoc.getElementsByTagNameNS('*', 'title')[0]?.textContent?.trim();
  const metaAuthor =
    opfDoc.getElementsByTagName('dc:creator')[0]?.textContent?.trim() ||
    opfDoc.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim();

  const manifest = new Map<
    string,
    { href: string; mediaType: string; properties: string }
  >();
  let ncxId = '';
  let navHref = '';

  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id') ?? '';
    const href = item.getAttribute('href') ?? '';
    const mediaType = item.getAttribute('media-type') ?? '';
    const properties = item.getAttribute('properties') ?? '';
    if (id && href) {
      manifest.set(id, { href, mediaType, properties });
      if (properties.split(/\s+/).includes('nav')) {
        navHref = href;
      }
      if (mediaType === 'application/x-dtbncx+xml') {
        ncxId = id;
      }
    }
  });

  const spineEl = opfDoc.querySelector('spine');
  if (!ncxId) {
    ncxId = spineEl?.getAttribute('toc') ?? '';
  }

  const tocTitleMap = new Map<string, string>();
  if (navHref) {
    const navPath = resolveZipRelative(opfDir, navHref);
    const navEntry =
      zipLookup.get(navPath) ?? zipLookup.get(navPath.toLowerCase());
    if (navEntry) {
      const navDir = getDirPath(navPath);
      const navDoc = parseXmlOrHtmlDocument(await navEntry.async('string'));
      navDoc.querySelectorAll('nav a[href]').forEach((a) => {
        const href = a.getAttribute('href') ?? '';
        const label = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
        const targetPath = resolveZipRelative(navDir, href);
        if (targetPath && label && !tocTitleMap.has(targetPath)) {
          tocTitleMap.set(targetPath, label);
        }
      });
    }
  } else if (ncxId && manifest.has(ncxId)) {
    const ncxPath = resolveZipRelative(opfDir, manifest.get(ncxId)!.href);
    const ncxEntry =
      zipLookup.get(ncxPath) ?? zipLookup.get(ncxPath.toLowerCase());
    if (ncxEntry) {
      const ncxDir = getDirPath(ncxPath);
      const ncxDoc = new DOMParser().parseFromString(
        await ncxEntry.async('string'),
        'application/xml'
      );
      ncxDoc.querySelectorAll('navPoint').forEach((pt) => {
        const label =
          pt.querySelector('navLabel > text')?.textContent?.trim() ?? '';
        const src = pt.querySelector('content')?.getAttribute('src') ?? '';
        const targetPath = resolveZipRelative(ncxDir, src);
        if (targetPath && label && !tocTitleMap.has(targetPath)) {
          tocTitleMap.set(targetPath, label);
        }
      });
    }
  }

  const spineIds: string[] = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
    const idref = ref.getAttribute('idref');
    if (idref && ref.getAttribute('linear') !== 'no') {
      spineIds.push(idref);
    }
  });
  if (spineIds.length === 0) {
    manifest.forEach((v, id) => {
      if (v.mediaType.includes('html')) spineIds.push(id);
    });
  }

  const imageCache = new Map<string, string>();
  const chapters: StoredNovelChapter[] = [];

  for (const idref of spineIds) {
    const item = manifest.get(idref);
    if (!item) continue;
    const chapterPath = resolveZipRelative(opfDir, item.href);
    const entry =
      zipLookup.get(chapterPath) ?? zipLookup.get(chapterPath.toLowerCase());
    if (!entry) continue;

    const rawXhtml = await entry.async('string');
    const doc = parseXmlOrHtmlDocument(rawXhtml);
    const body = doc.body ?? doc.documentElement;
    if (!body) continue;

    const chapterDir = getDirPath(chapterPath);
    const cleaned = await sanitizeChapterRoot(
      body,
      chapterDir,
      zipLookup,
      imageCache
    );

    if (cleaned.charCount === 0 && !cleaned.hasMedia) {
      continue;
    }

    const headingText = body
      .querySelector('h1, h2, h3')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    const chapterTitle =
      tocTitleMap.get(chapterPath) ||
      headingText ||
      (cleaned.charCount === 0 && cleaned.hasMedia
        ? `Ilustrasi (${chapters.length + 1})`
        : `Bab ${chapters.length + 1}`);

    chapters.push({
      id: idref,
      title: chapterTitle,
      html: cleaned.html,
      charCount: cleaned.charCount,
    });
  }

  if (chapters.length === 0) {
    throw new Error(
      'Tidak ada isi teks atau bab yang terbaca di dalam file EPUB ini.'
    );
  }

  const totalChars = chapters.reduce((acc, ch) => acc + ch.charCount, 0);

  return {
    storageKey: options.storageKey,
    catalogItemId: options.catalogItemId,
    title: metaTitle || options.fallbackTitle || baseFileNameTitle,
    author: metaAuthor || undefined,
    fileName: file.name,
    chapters,
    totalChars,
    currentChapter: 0,
    scrollRatio: 0,
    updatedAt: Date.now(),
  };
}
