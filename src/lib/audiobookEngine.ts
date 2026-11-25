export type AiTtsProvider = 'browser' | 'gemini' | 'openai' | 'voicevox';

export interface AiTtsSettings {
  provider: AiTtsProvider;
  rate: number;
  volume: number;
  autoAdvance: boolean;
  browserVoiceURI: string;
  geminiApiKey: string;
  geminiModel: 'gemini-2.5-flash-preview-tts' | 'gemini-2.5-pro-preview-tts';
  geminiVoice: string;
  geminiStylePrompt: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  openaiVoice: string;
  voicevoxUrl: string;
  voicevoxSpeakerId: number;
}

export const GEMINI_TTS_VOICES = [
  'Kore',
  'Aoede',
  'Puck',
  'Charon',
  'Fenrir',
  'Leda',
  'Zephyr',
  'Orus',
] as const;

export const OPENAI_TTS_VOICES = [
  'nova',
  'alloy',
  'ash',
  'coral',
  'echo',
  'fable',
  'onyx',
  'sage',
  'shimmer',
] as const;

export interface StoredAudiobookTrack {
  id: string;
  storageKey: string;
  name: string;
  kind: 'blob' | 'url';
  blob?: Blob;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
  order: number;
  addedAt: number;
}

export interface AudiobookPlaybackState {
  trackId: string;
  currentTimeSec: number;
  playbackRate: number;
  volume: number;
  updatedAt: number;
}

const AI_TTS_SETTINGS_KEY = 'immersiontrack_ai_tts_settings_v1';
const AUDIOBOOK_STATE_KEY = 'immersiontrack_audiobook_state_v1';
const AUDIOBOOK_DB_NAME = 'immersiontrack-novel-audiobooks';
const AUDIOBOOK_DB_VERSION = 2;
const AUDIOBOOK_STORE_NAME = 'audiobook_tracks';
const AUDIOBOOK_SUBTITLE_STORE_NAME = 'audiobook_subtitles';

export const DEFAULT_AI_TTS_SETTINGS: AiTtsSettings = {
  provider: 'browser',
  rate: 1.0,
  volume: 1.0,
  autoAdvance: true,
  browserVoiceURI: '',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash-preview-tts',
  geminiVoice: 'Kore',
  geminiStylePrompt: '自然に感情を込めて日本語の小説を朗読してください',
  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini-tts',
  openaiVoice: 'nova',
  voicevoxUrl: 'http://127.0.0.1:50021',
  voicevoxSpeakerId: 3,
};

function clampNum(val: unknown, fallback: number, min: number, max: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

export function loadAiTtsSettings(): AiTtsSettings {
  try {
    const raw = localStorage.getItem(AI_TTS_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AI_TTS_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AiTtsSettings>;
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_AI_TTS_SETTINGS };
    }
    const provider: AiTtsProvider =
      parsed.provider === 'gemini' ||
      parsed.provider === 'openai' ||
      parsed.provider === 'voicevox'
        ? parsed.provider
        : 'browser';
    const geminiModel =
      parsed.geminiModel === 'gemini-2.5-pro-preview-tts'
        ? 'gemini-2.5-pro-preview-tts'
        : 'gemini-2.5-flash-preview-tts';
    return {
      provider,
      rate: clampNum(parsed.rate, DEFAULT_AI_TTS_SETTINGS.rate, 0.6, 2.0),
      volume: clampNum(parsed.volume, DEFAULT_AI_TTS_SETTINGS.volume, 0, 1),
      autoAdvance:
        typeof parsed.autoAdvance === 'boolean'
          ? parsed.autoAdvance
          : DEFAULT_AI_TTS_SETTINGS.autoAdvance,
      browserVoiceURI:
        typeof parsed.browserVoiceURI === 'string' ? parsed.browserVoiceURI : '',
      geminiApiKey:
        typeof parsed.geminiApiKey === 'string' ? parsed.geminiApiKey : '',
      geminiModel,
      geminiVoice:
        typeof parsed.geminiVoice === 'string' && parsed.geminiVoice.trim()
          ? parsed.geminiVoice.trim()
          : DEFAULT_AI_TTS_SETTINGS.geminiVoice,
      geminiStylePrompt:
        typeof parsed.geminiStylePrompt === 'string'
          ? parsed.geminiStylePrompt
          : DEFAULT_AI_TTS_SETTINGS.geminiStylePrompt,
      openaiApiKey:
        typeof parsed.openaiApiKey === 'string' ? parsed.openaiApiKey : '',
      openaiBaseUrl:
        typeof parsed.openaiBaseUrl === 'string' && parsed.openaiBaseUrl.trim()
          ? parsed.openaiBaseUrl.trim()
          : DEFAULT_AI_TTS_SETTINGS.openaiBaseUrl,
      openaiModel:
        typeof parsed.openaiModel === 'string' && parsed.openaiModel.trim()
          ? parsed.openaiModel.trim()
          : DEFAULT_AI_TTS_SETTINGS.openaiModel,
      openaiVoice:
        typeof parsed.openaiVoice === 'string' && parsed.openaiVoice.trim()
          ? parsed.openaiVoice.trim()
          : DEFAULT_AI_TTS_SETTINGS.openaiVoice,
      voicevoxUrl:
        typeof parsed.voicevoxUrl === 'string' && parsed.voicevoxUrl.trim()
          ? parsed.voicevoxUrl.trim()
          : DEFAULT_AI_TTS_SETTINGS.voicevoxUrl,
      voicevoxSpeakerId: Math.max(
        0,
        Math.round(
          clampNum(
            parsed.voicevoxSpeakerId,
            DEFAULT_AI_TTS_SETTINGS.voicevoxSpeakerId,
            0,
            9999
          )
        )
      ),
    };
  } catch {
    return { ...DEFAULT_AI_TTS_SETTINGS };
  }
}

export function saveAiTtsSettings(settings: AiTtsSettings): void {
  try {
    const sanitized: AiTtsSettings = {
      ...settings,
      rate: clampNum(settings.rate, 1.0, 0.6, 2.0),
      volume: clampNum(settings.volume, 1.0, 0, 1),
      geminiApiKey: settings.geminiApiKey.trim(),
      openaiApiKey: settings.openaiApiKey.trim(),
      openaiBaseUrl:
        settings.openaiBaseUrl.trim() || DEFAULT_AI_TTS_SETTINGS.openaiBaseUrl,
      openaiModel:
        settings.openaiModel.trim() || DEFAULT_AI_TTS_SETTINGS.openaiModel,
      voicevoxUrl:
        settings.voicevoxUrl.trim() || DEFAULT_AI_TTS_SETTINGS.voicevoxUrl,
      voicevoxSpeakerId: Math.max(0, Math.round(settings.voicevoxSpeakerId || 0)),
    };
    localStorage.setItem(AI_TTS_SETTINGS_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore storage quota errors
  }
}

function openAudiobookDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser ini tidak mendukung IndexedDB.'));
      return;
    }
    const req = indexedDB.open(AUDIOBOOK_DB_NAME, AUDIOBOOK_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUDIOBOOK_STORE_NAME)) {
        const store = db.createObjectStore(AUDIOBOOK_STORE_NAME, {
          keyPath: 'id',
        });
        store.createIndex('by_storageKey', 'storageKey', { unique: false });
      }
      if (!db.objectStoreNames.contains(AUDIOBOOK_SUBTITLE_STORE_NAME)) {
        db.createObjectStore(AUDIOBOOK_SUBTITLE_STORE_NAME, {
          keyPath: 'key',
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error('Gagal membuka database audiobook.'));
  });
}

export async function listNovelAudiobookTracks(
  storageKey: string
): Promise<StoredAudiobookTrack[]> {
  if (!storageKey) return [];
  try {
    const db = await openAudiobookDb();
    const list = await new Promise<StoredAudiobookTrack[]>((resolve, reject) => {
      const tx = db.transaction(AUDIOBOOK_STORE_NAME, 'readonly');
      const idx = tx.objectStore(AUDIOBOOK_STORE_NAME).index('by_storageKey');
      const req = idx.getAll(IDBKeyRange.only(storageKey));
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredAudiobookTrack[]) ?? []);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('Gagal memuat daftar audiobook.'));
      };
    });
    return list.sort((a, b) => a.order - b.order || a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}

function isSupportedAudioFile(file: File): boolean {
  if (file.type && file.type.startsWith('audio/')) return true;
  return /\.(mp3|m4b|m4a|wav|ogg|opus|aac|webm)$/i.test(file.name);
}

export async function addNovelAudiobookFiles(
  storageKey: string,
  files: FileList | File[]
): Promise<StoredAudiobookTrack[]> {
  const incoming = Array.from(files).filter(isSupportedAudioFile);
  if (incoming.length === 0) {
    throw new Error(
      'Pilih file audio yang valid (.mp3, .m4b, .m4a, .wav, .ogg, .opus, .aac, .webm).'
    );
  }
  incoming.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );

  const existing = await listNovelAudiobookTracks(storageKey);
  const maxOrder = existing.reduce((m, t) => Math.max(m, t.order), -1);
  const now = Date.now();

  const db = await openAudiobookDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIOBOOK_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AUDIOBOOK_STORE_NAME);
    incoming.forEach((file, i) => {
      const track: StoredAudiobookTrack = {
        id: `ab-${now}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        storageKey,
        name: file.name,
        kind: 'blob',
        blob: file,
        mimeType: file.type || 'audio/mpeg',
        sizeBytes: file.size,
        order: maxOrder + 1 + i,
        addedAt: now + i,
      };
      store.put(track);
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menyimpan file audiobook.'));
    };
  });

  return listNovelAudiobookTracks(storageKey);
}

export async function addNovelAudiobookUrl(
  storageKey: string,
  url: string,
  title?: string
): Promise<StoredAudiobookTrack[]> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Masukkan URL audio yang diawali http:// atau https://');
  }
  const existing = await listNovelAudiobookTracks(storageKey);
  const maxOrder = existing.reduce((m, t) => Math.max(m, t.order), -1);
  const now = Date.now();

  let derivedName = title?.trim() || '';
  if (!derivedName) {
    try {
      const u = new URL(trimmed);
      const lastSeg = decodeURIComponent(
        u.pathname.split('/').filter(Boolean).pop() || ''
      );
      derivedName = lastSeg || u.hostname;
    } catch {
      derivedName = 'Audio URL';
    }
  }

  const db = await openAudiobookDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIOBOOK_STORE_NAME, 'readwrite');
    const track: StoredAudiobookTrack = {
      id: `ab-url-${now}-${Math.random().toString(36).slice(2, 7)}`,
      storageKey,
      name: derivedName,
      kind: 'url',
      url: trimmed,
      order: maxOrder + 1,
      addedAt: now,
    };
    tx.objectStore(AUDIOBOOK_STORE_NAME).put(track);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Gagal menyimpan URL audiobook.'));
    };
  });

  return listNovelAudiobookTracks(storageKey);
}

export async function deleteNovelAudiobookTrack(
  storageKey: string,
  trackId: string
): Promise<StoredAudiobookTrack[]> {
  try {
    const db = await openAudiobookDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIOBOOK_STORE_NAME, 'readwrite');
      tx.objectStore(AUDIOBOOK_STORE_NAME).delete(trackId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Gagal menghapus track audiobook.'));
      };
    });
  } catch {
    // ignore delete error
  }
  void deleteTrackSubtitlesIdb(storageKey, trackId);
  return listNovelAudiobookTracks(storageKey);
}

export async function saveTrackSubtitlesIdb<T>(
  storageKey: string,
  trackId: string,
  cues: T[]
): Promise<void> {
  if (!storageKey || !trackId) return;
  try {
    const db = await openAudiobookDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIOBOOK_SUBTITLE_STORE_NAME, 'readwrite');
      tx.objectStore(AUDIOBOOK_SUBTITLE_STORE_NAME).put({
        key: `${storageKey}::${trackId}`,
        storageKey,
        trackId,
        cues,
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Gagal menyimpan subtitle audiobook.'));
      };
    });
  } catch {
    // ignore IDB write error
  }
}

export async function loadTrackSubtitlesIdb<T>(
  storageKey: string,
  trackId: string
): Promise<T[]> {
  if (!storageKey || !trackId) return [];
  try {
    const db = await openAudiobookDb();
    const cues = await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(AUDIOBOOK_SUBTITLE_STORE_NAME, 'readonly');
      const req = tx
        .objectStore(AUDIOBOOK_SUBTITLE_STORE_NAME)
        .get(`${storageKey}::${trackId}`);
      req.onsuccess = () => {
        db.close();
        const row = req.result as { cues?: T[] } | undefined;
        resolve(Array.isArray(row?.cues) ? row.cues : []);
      };
      req.onerror = () => {
        db.close();
        reject(req.error ?? new Error('Gagal memuat subtitle audiobook.'));
      };
    });
    return cues;
  } catch {
    return [];
  }
}

export async function deleteTrackSubtitlesIdb(
  storageKey: string,
  trackId: string
): Promise<void> {
  if (!storageKey || !trackId) return;
  try {
    const db = await openAudiobookDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIOBOOK_SUBTITLE_STORE_NAME, 'readwrite');
      tx.objectStore(AUDIOBOOK_SUBTITLE_STORE_NAME).delete(
        `${storageKey}::${trackId}`
      );
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Gagal menghapus subtitle audiobook.'));
      };
    });
  } catch {
    // ignore IDB delete error
  }
}

export function loadAudiobookPlaybackState(
  storageKey: string
): AudiobookPlaybackState | null {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(AUDIOBOOK_STATE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, Partial<AudiobookPlaybackState>>;
    const entry = all?.[storageKey];
    if (!entry || typeof entry.trackId !== 'string') return null;
    return {
      trackId: entry.trackId,
      currentTimeSec: clampNum(entry.currentTimeSec, 0, 0, 864000),
      playbackRate: clampNum(entry.playbackRate, 1.0, 0.5, 3.0),
      volume: clampNum(entry.volume, 1.0, 0, 1),
      updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveAudiobookPlaybackState(
  storageKey: string,
  state: AudiobookPlaybackState
): void {
  if (!storageKey) return;
  try {
    const raw = localStorage.getItem(AUDIOBOOK_STATE_KEY);
    const all: Record<string, AudiobookPlaybackState> = raw
      ? (JSON.parse(raw) as Record<string, AudiobookPlaybackState>)
      : {};
    all[storageKey] = {
      ...state,
      currentTimeSec: Math.max(0, state.currentTimeSec || 0),
      playbackRate: clampNum(state.playbackRate, 1.0, 0.5, 3.0),
      volume: clampNum(state.volume, 1.0, 0, 1),
      updatedAt: state.updatedAt || Date.now(),
    };
    localStorage.setItem(AUDIOBOOK_STATE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
}

export function extractSpeakableJapaneseText(html: string): string {
  if (!html || !html.trim()) return '';
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.body;
  if (!root) return '';
  root.querySelectorAll('rt, rp, script, style').forEach((n) => n.remove());
  return (root.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function splitLongJapaneseTextForTts(
  text: string,
  maxLen = 220
): string[] {
  const clean = text.replace(/\r/g, '').trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const segments = clean
    .split(/(?<=[。！？!?」』\n])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = '';
  for (const seg of segments) {
    if (seg.length > maxLen) {
      if (buf) {
        chunks.push(buf);
        buf = '';
      }
      // Hard-slice abnormally long clause without sentence punctuation
      for (let i = 0; i < seg.length; i += maxLen) {
        chunks.push(seg.slice(i, i + maxLen));
      }
      continue;
    }
    if (!buf) {
      buf = seg;
    } else if (buf.length + seg.length <= maxLen) {
      buf += seg;
    } else {
      chunks.push(buf);
      buf = seg;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export function listJapaneseBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices() ?? [];
  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const lang = v.lang.toLowerCase();
    const name = v.name.toLowerCase();
    let score = 0;
    if (lang.startsWith('ja')) score += 100;
    if (name.includes('natural')) score += 50;
    if (name.includes('online')) score += 40;
    if (name.includes('google')) score += 30;
    if (
      name.includes('nanami') ||
      name.includes('keita') ||
      name.includes('kyoko') ||
      name.includes('otoya') ||
      name.includes('haruka') ||
      name.includes('ayumi')
    ) {
      score += 20;
    }
    if (v.localService) score += 5;
    return score;
  };
  const jaVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('ja'));
  const pool = jaVoices.length > 0 ? jaVoices : voices;
  return [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
}

export function pcm16MonoToWavBlob(
  pcmBytes: Uint8Array,
  sampleRate = 24000
): Blob {
  const byteLength = pcmBytes.byteLength;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + byteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate = sampleRate * channels * bytesPerSample
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, byteLength, true);

  const safePcm = new Uint8Array(pcmBytes.byteLength);
  safePcm.set(pcmBytes);
  return new Blob([header, safePcm], { type: 'audio/wav' });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function synthesizeAiSpeechBlob(
  text: string,
  settings: AiTtsSettings,
  signal?: AbortSignal
): Promise<Blob> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks kosong untuk dibacakan.');
  }

  if (settings.provider === 'gemini') {
    const apiKey = settings.geminiApiKey.trim();
    if (!apiKey) {
      throw new Error(
        'API Key Gemini belum diisi. Masukkan API Key di pengaturan AI Narator.'
      );
    }
    const promptPrefix = settings.geminiStylePrompt.trim();
    const spokenInput = promptPrefix
      ? `${promptPrefix}:\n\n${cleanText}`
      : cleanText;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.geminiModel}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: spokenInput }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: settings.geminiVoice || 'Kore',
              },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error('API Key Gemini tidak valid atau akses ditolak.');
      }
      if (res.status === 429) {
        throw new Error(
          'Kuota / rate limit Gemini TTS habis sementara. Coba jeda sebentar atau pakai Browser TTS.'
        );
      }
      throw new Error(
        `Gagal memanggil Gemini TTS (HTTP ${res.status}): ${errBody.slice(0, 120)}`
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType?: string; data?: string };
          }>;
        };
      }>;
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((p) => p.inlineData?.data)?.inlineData;
    if (!inline?.data) {
      throw new Error('Gemini TTS tidak mengembalikan data audio.');
    }

    const bytes = base64ToUint8Array(inline.data);
    const mime = (inline.mimeType ?? '').toLowerCase();
    if (
      mime.includes('audio/mpeg') ||
      mime.includes('audio/mp3') ||
      mime.includes('audio/wav') ||
      mime.includes('audio/ogg') ||
      mime.includes('audio/webm')
    ) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return new Blob([copy], { type: inline.mimeType || 'audio/wav' });
    }
    const rateMatch = mime.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
    return pcm16MonoToWavBlob(bytes, sampleRate);
  }

  if (settings.provider === 'openai') {
    const baseUrl = (
      settings.openaiBaseUrl.trim() || 'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    const apiKey = settings.openaiApiKey.trim();
    const isOfficialOpenAi = baseUrl.includes('api.openai.com');
    if (isOfficialOpenAi && !apiKey) {
      throw new Error(
        'API Key OpenAI belum diisi. Masukkan API Key atau gunakan endpoint lokal (seperti Kokoro-FastAPI).'
      );
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify({
        model: settings.openaiModel || 'gpt-4o-mini-tts',
        voice: settings.openaiVoice || 'nova',
        input: cleanText,
        speed: clampNum(settings.rate, 1.0, 0.25, 4.0),
        response_format: 'mp3',
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error('API Key OpenAI TTS tidak valid.');
      }
      if (res.status === 429) {
        throw new Error('Rate limit / saldo OpenAI TTS tidak mencukupi.');
      }
      throw new Error(
        `Gagal memanggil OpenAI TTS (HTTP ${res.status}): ${errBody.slice(0, 120)}`
      );
    }

    return res.blob();
  }

  if (settings.provider === 'voicevox') {
    const baseUrl = (
      settings.voicevoxUrl.trim() || 'http://127.0.0.1:50021'
    ).replace(/\/+$/, '');
    const speaker = Math.max(0, Math.round(settings.voicevoxSpeakerId || 0));

    let queryRes: Response;
    try {
      queryRes = await fetch(
        `${baseUrl}/audio_query?text=${encodeURIComponent(cleanText)}&speaker=${speaker}`,
        { method: 'POST', signal }
      );
    } catch {
      throw new Error(
        `Tidak bisa terhubung ke VOICEVOX di ${baseUrl}. Pastikan aplikasi VOICEVOX Engine sudah berjalan di PC dan mengizinkan CORS.`
      );
    }
    if (!queryRes.ok) {
      throw new Error(`VOICEVOX audio_query gagal (HTTP ${queryRes.status}).`);
    }
    const queryJson = (await queryRes.json()) as Record<string, unknown>;
    queryJson.speedScale = clampNum(settings.rate, 1.0, 0.5, 2.0);

    const synthRes = await fetch(
      `${baseUrl}/synthesis?speaker=${speaker}`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryJson),
      }
    );
    if (!synthRes.ok) {
      throw new Error(`VOICEVOX synthesis gagal (HTTP ${synthRes.status}).`);
    }
    return synthRes.blob();
  }

  throw new Error('Provider TTS ini menggunakan SpeechSynthesis bawaan browser.');
}

export async function fetchVoicevoxSpeakers(
  baseUrl: string
): Promise<Array<{ id: number; label: string }>> {
  const cleanUrl = (baseUrl.trim() || 'http://127.0.0.1:50021').replace(
    /\/+$/,
    ''
  );
  const res = await fetch(`${cleanUrl}/speakers`);
  if (!res.ok) {
    throw new Error(`Gagal memuat speaker VOICEVOX (HTTP ${res.status}).`);
  }
  const speakers = (await res.json()) as Array<{
    name: string;
    styles?: Array<{ id: number; name: string }>;
  }>;
  const flattened: Array<{ id: number; label: string }> = [];
  for (const sp of speakers) {
    for (const st of sp.styles ?? []) {
      flattened.push({
        id: st.id,
        label: `${sp.name} (${st.name})`,
      });
    }
  }
  return flattened;
}

export function hasAiTextKey(settings: AiTtsSettings): boolean {
  return Boolean(settings.geminiApiKey.trim() || settings.openaiApiKey.trim());
}

export async function explainJapaneseSentenceWithAi(
  sentence: string,
  settings: AiTtsSettings,
  signal?: AbortSignal
): Promise<string> {
  const clean = sentence.trim();
  if (!clean) throw new Error('Tidak ada kalimat yang dipilih.');

  const prompt = `Jelaskan kalimat novel Jepang berikut secara ringkas, jelas, dan mudah dipahami dalam Bahasa Indonesia:

「${clean}」

Format jawaban:
1. **Arti Natural** (terjemahan bahasa Indonesia yang luwes sesuai konteks novel)
2. **Kosakata Penting** (daftar kata/kanji + cara baca hiragana + artinya)
3. **Tata Bahasa & Nuansa** (jelaskan pola kalimat/partikel penting secara singkat)`;

  const geminiKey = settings.geminiApiKey.trim();
  const openaiKey = settings.openaiApiKey.trim();
  const preferOpenAi =
    settings.provider === 'openai' && Boolean(openaiKey);

  if (geminiKey && !preferOpenAi) {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      }
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('API Key Gemini tidak valid atau ditolak.');
      }
      if (res.status === 429) {
        throw new Error('Batas pemakaian Gemini API tercapai sementara.');
      }
      throw new Error(`Gagal memanggil Gemini AI (HTTP ${res.status}).`);
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const reply =
      json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';
    if (!reply) throw new Error('Gemini AI tidak mengembalikan penjelasan.');
    return reply;
  }

  if (openaiKey) {
    const baseUrl = (
      settings.openaiBaseUrl.trim() || 'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Kamu adalah tutor bahasa Jepang yang membantu pembaca light novel memahami kalimat dalam Bahasa Indonesia.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      throw new Error(`Gagal memanggil OpenAI Chat (HTTP ${res.status}).`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? '';
    if (!reply) throw new Error('OpenAI tidak mengembalikan penjelasan.');
    return reply;
  }

  throw new Error(
    'Masukkan API Key Gemini atau OpenAI di panel Audio/AI terlebih dahulu.'
  );
}
