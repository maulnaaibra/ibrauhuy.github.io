import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Bot,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  FileAudio,
  Headphones,
  Link2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  addNovelAudiobookFiles,
  addNovelAudiobookUrl,
  deleteNovelAudiobookTrack,
  extractSpeakableJapaneseText,
  fetchVoicevoxSpeakers,
  GEMINI_TTS_VOICES,
  listJapaneseBrowserVoices,
  listNovelAudiobookTracks,
  loadAiTtsSettings,
  loadAudiobookPlaybackState,
  OPENAI_TTS_VOICES,
  saveAiTtsSettings,
  saveAudiobookPlaybackState,
  splitLongJapaneseTextForTts,
  synthesizeAiSpeechBlob,
  type AiTtsProvider,
  type AiTtsSettings,
  type StoredAudiobookTrack,
} from '../lib/audiobookEngine';
import type { ChapterParagraphBlock, ReaderMode } from '../lib/epubReaderStore';

interface ReaderAudiobookDockProps {
  open: boolean;
  initialTab?: 'ai' | 'file';
  onClose: () => void;
  bookStorageKey: string;
  bookTitle: string;
  chapterCount: number;
  currentChapterIndex: number;
  chapterParagraphs: ChapterParagraphBlock[];
  readingMode: ReaderMode;
  vnIndex: number;
  vnParagraphsPerStep: number;
  scrollRatio: number;
  isFullscreenOrZen: boolean;
  themeStyle: {
    panel: string;
    subtleBtn: string;
    mutedText: string;
    accentText: string;
    toolbar: string;
    toolbarGlass: string;
  };
  hasActiveBg: boolean;
  oneShotSpeakRequest: { id: number; text: string } | null;
  onAdvanceVnStep: () => void;
  onSwitchChapter: (chapterIndex: number) => void;
  onOpenDrawer?: (tab: 'ai' | 'file') => void;
  onPlaybackStatusChange?: (status: {
    active: boolean;
    mode: 'ai' | 'file' | null;
  }) => void;
}

const SPEED_PRESETS = [0.75, 0.9, 1.0, 1.15, 1.25, 1.5, 2.0] as const;

function formatAudioTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatBytesMb(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toFixed(1)} MB`;
}

export const ReaderAudiobookDock: React.FC<ReaderAudiobookDockProps> = ({
  open,
  initialTab,
  onClose,
  bookStorageKey,
  bookTitle,
  chapterCount,
  currentChapterIndex,
  chapterParagraphs,
  readingMode,
  vnIndex,
  vnParagraphsPerStep,
  scrollRatio,
  isFullscreenOrZen,
  themeStyle,
  hasActiveBg,
  oneShotSpeakRequest,
  onAdvanceVnStep,
  onSwitchChapter,
  onOpenDrawer,
  onPlaybackStatusChange,
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'file'>(initialTab ?? 'ai');

  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // Keep latest props in refs for async playback callbacks
  const chapterParagraphsRef = useRef(chapterParagraphs);
  chapterParagraphsRef.current = chapterParagraphs;
  const currentChapterIndexRef = useRef(currentChapterIndex);
  currentChapterIndexRef.current = currentChapterIndex;
  const chapterCountRef = useRef(chapterCount);
  chapterCountRef.current = chapterCount;
  const readingModeRef = useRef(readingMode);
  readingModeRef.current = readingMode;
  const vnIndexRef = useRef(vnIndex);
  vnIndexRef.current = vnIndex;
  const vnStepRef = useRef(vnParagraphsPerStep);
  vnStepRef.current = vnParagraphsPerStep;
  const scrollRatioRef = useRef(scrollRatio);
  scrollRatioRef.current = scrollRatio;
  const onAdvanceVnStepRef = useRef(onAdvanceVnStep);
  onAdvanceVnStepRef.current = onAdvanceVnStep;
  const onSwitchChapterRef = useRef(onSwitchChapter);
  onSwitchChapterRef.current = onSwitchChapter;

  // ==================== AI NARATOR / TTS STATE ====================
  const [aiSettings, setAiSettings] = useState<AiTtsSettings>(loadAiTtsSettings);
  const aiSettingsRef = useRef<AiTtsSettings>(aiSettings);
  aiSettingsRef.current = aiSettings;

  const [aiPlaying, setAiPlaying] = useState(false);
  const aiPlayingRef = useRef(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCurrentParaIdx, setAiCurrentParaIdx] = useState(0);
  const aiCurrentParaIdxRef = useRef(0);
  const [aiCurrentText, setAiCurrentText] = useState('');
  const [aiError, setAiError] = useState('');
  const [isOneShotActive, setIsOneShotActive] = useState(false);
  const isOneShotRef = useRef(false);

  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicevoxSpeakers, setVoicevoxSpeakers] = useState<
    Array<{ id: number; label: string }>
  >([]);
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const runIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const aiAudioRef = useRef<HTMLAudioElement | null>(null);
  const aiObjectUrlRef = useRef<string | null>(null);
  const prefetchCacheRef = useRef<Map<string, Promise<Blob>>>(new Map());
  const pendingAiNextChapterRef = useRef<number | null>(null);
  const lastSpokenVnKeyRef = useRef('');
  const lastOneShotIdRef = useRef(0);

  // ==================== FILE AUDIOBOOK STATE ====================
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const fileAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileObjectUrlRef = useRef<string | null>(null);
  const pendingFileSeekRef = useRef(0);
  const autoPlayTrackRef = useRef(false);
  const lastFilePersistMsRef = useRef(0);

  const [tracks, setTracks] = useState<StoredAudiobookTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [uploadingTracks, setUploadingTracks] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlTitleInput, setUrlTitleInput] = useState('');
  const [activeTrackId, setActiveTrackId] = useState('');
  const [filePlaying, setFilePlaying] = useState(false);
  const [fileCurrentTime, setFileCurrentTime] = useState(0);
  const [fileDuration, setFileDuration] = useState(0);
  const [filePlaybackRate, setFilePlaybackRate] = useState(1.0);
  const [fileVolume, setFileVolume] = useState(1.0);

  const activeTrack = useMemo(
    () => tracks.find((t) => t.id === activeTrackId) ?? tracks[0] ?? null,
    [tracks, activeTrackId]
  );

  // Notify parent when audio activity toggles
  useEffect(() => {
    const active = aiPlaying || aiLoading || filePlaying;
    const mode = aiPlaying || aiLoading ? 'ai' : filePlaying ? 'file' : null;
    onPlaybackStatusChange?.({ active, mode });
  }, [aiPlaying, aiLoading, filePlaying, onPlaybackStatusChange]);

  // Refresh browser TTS voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    const refreshVoices = () => {
      setBrowserVoices(listJapaneseBrowserVoices());
    };
    refreshVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.(
        'voiceschanged',
        refreshVoices
      );
    };
  }, []);

  const updateAiSettings = useCallback((patch: Partial<AiTtsSettings>) => {
    setAiSettings((prev) => {
      const next = { ...prev, ...patch };
      aiSettingsRef.current = next;
      saveAiTtsSettings(next);
      return next;
    });
    if (patch.provider || patch.geminiVoice || patch.openaiVoice) {
      prefetchCacheRef.current.clear();
    }
    const a = aiAudioRef.current;
    if (a) {
      if (typeof patch.volume === 'number') {
        a.volume = Math.min(1, Math.max(0, patch.volume));
      }
      if (
        typeof patch.rate === 'number' &&
        aiSettingsRef.current.provider === 'gemini'
      ) {
        a.playbackRate = Math.min(2, Math.max(0.6, patch.rate));
      }
    }
  }, []);

  const releaseAiAudioUrl = useCallback(() => {
    if (aiObjectUrlRef.current) {
      URL.revokeObjectURL(aiObjectUrlRef.current);
      aiObjectUrlRef.current = null;
    }
  }, []);

  const stopAiNarrator = useCallback(() => {
    runIdRef.current += 1;
    pendingAiNextChapterRef.current = null;
    lastSpokenVnKeyRef.current = '';
    isOneShotRef.current = false;
    aiPlayingRef.current = false;
    setIsOneShotActive(false);
    setAiPlaying(false);
    setAiLoading(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore speechSynthesis cancel error
      }
    }
    if (aiAudioRef.current) {
      aiAudioRef.current.pause();
      aiAudioRef.current.onended = null;
      aiAudioRef.current.onerror = null;
      aiAudioRef.current.removeAttribute('src');
    }
    releaseAiAudioUrl();
  }, [releaseAiAudioUrl]);

  const stopFileAudiobook = useCallback(() => {
    const audio = fileAudioRef.current;
    if (audio) {
      audio.pause();
    }
    setFilePlaying(false);
  }, []);

  // Build stable prefetch cache key & 1-item cache for non-browser TTS
  const fetchOrCachedSpeechBlob = useCallback(
    async (text: string, settings: AiTtsSettings, signal: AbortSignal) => {
      const rateKey =
        settings.provider === 'gemini' ? '1' : String(settings.rate);
      const voiceKey =
        settings.provider === 'gemini'
          ? `${settings.geminiModel}:${settings.geminiVoice}:${settings.geminiStylePrompt}`
          : settings.provider === 'openai'
            ? `${settings.openaiBaseUrl}:${settings.openaiModel}:${settings.openaiVoice}`
            : `${settings.voicevoxUrl}:${settings.voicevoxSpeakerId}`;
      const cacheKey = `${settings.provider}|${voiceKey}|${rateKey}|${text}`;

      const existing = prefetchCacheRef.current.get(cacheKey);
      if (existing) return existing;

      const promise = synthesizeAiSpeechBlob(text, settings, signal).catch(
        (err) => {
          prefetchCacheRef.current.delete(cacheKey);
          throw err;
        }
      );
      if (prefetchCacheRef.current.size >= 3) {
        const oldestKey = prefetchCacheRef.current.keys().next().value;
        if (oldestKey) prefetchCacheRef.current.delete(oldestKey);
      }
      prefetchCacheRef.current.set(cacheKey, promise);
      return promise;
    },
    []
  );

  const findNextSpeakableParagraphIdx = useCallback(
    (startFrom: number): { idx: number; text: string } | null => {
      const paras = chapterParagraphsRef.current;
      for (let i = Math.max(0, startFrom); i < paras.length; i++) {
        if (paras[i]?.isMediaOnly) continue;
        const clean = extractSpeakableJapaneseText(paras[i]?.html ?? '');
        if (clean) {
          return { idx: i, text: clean };
        }
      }
      return null;
    },
    []
  );

  const findPrevSpeakableParagraphIdx = useCallback(
    (startBefore: number): { idx: number; text: string } | null => {
      const paras = chapterParagraphsRef.current;
      for (
        let i = Math.min(paras.length - 1, startBefore);
        i >= 0;
        i--
      ) {
        if (paras[i]?.isMediaOnly) continue;
        const clean = extractSpeakableJapaneseText(paras[i]?.html ?? '');
        if (clean) {
          return { idx: i, text: clean };
        }
      }
      return null;
    },
    []
  );

  const speakBrowserChunks = useCallback(
    async (text: string, myRunId: number, settings: AiTtsSettings) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        throw new Error('Browser ini tidak mendukung Web Speech Synthesis.');
      }
      const chunks = splitLongJapaneseTextForTts(text, 220);
      if (chunks.length === 0) return true;

      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      await new Promise((r) => window.setTimeout(r, 25));
      if (runIdRef.current !== myRunId) return false;

      const available = listJapaneseBrowserVoices();
      const chosenVoice =
        available.find((v) => v.voiceURI === settings.browserVoiceURI) ??
        available[0];

      for (const chunk of chunks) {
        if (runIdRef.current !== myRunId) return false;
        const ok = await new Promise<boolean>((resolve, reject) => {
          const utter = new SpeechSynthesisUtterance(chunk);
          utter.lang = chosenVoice?.lang || 'ja-JP';
          if (chosenVoice) utter.voice = chosenVoice;
          utter.rate = Math.min(2, Math.max(0.6, settings.rate));
          utter.volume = Math.min(1, Math.max(0, settings.volume));
          utter.onend = () => resolve(runIdRef.current === myRunId);
          utter.onerror = (ev) => {
            const errType = (ev as SpeechSynthesisErrorEvent).error;
            if (errType === 'canceled' || errType === 'interrupted') {
              resolve(false);
            } else {
              reject(new Error(`Browser TTS gagal (${errType || 'error'}).`));
            }
          };
          window.speechSynthesis.speak(utter);
        });
        if (!ok || runIdRef.current !== myRunId) return false;
      }
      return runIdRef.current === myRunId;
    },
    []
  );

  const playBlobWithAudio = useCallback(
    async (blob: Blob, myRunId: number, settings: AiTtsSettings) => {
      if (runIdRef.current !== myRunId) return false;
      releaseAiAudioUrl();
      const objUrl = URL.createObjectURL(blob);
      aiObjectUrlRef.current = objUrl;

      let audio = aiAudioRef.current;
      if (!audio) {
        audio = new Audio();
        aiAudioRef.current = audio;
      }
      audio.src = objUrl;
      audio.volume = Math.min(1, Math.max(0, settings.volume));
      audio.playbackRate =
        settings.provider === 'gemini'
          ? Math.min(2, Math.max(0.6, settings.rate))
          : 1.0;

      return new Promise<boolean>((resolve, reject) => {
        if (!audio) {
          resolve(false);
          return;
        }
        audio.onended = () => resolve(runIdRef.current === myRunId);
        audio.onerror = () => {
          if (runIdRef.current !== myRunId) {
            resolve(false);
          } else {
            reject(new Error('Gagal memutar file audio hasil AI TTS.'));
          }
        };
        void audio.play().catch((err) => {
          if (runIdRef.current !== myRunId) {
            resolve(false);
          } else {
            reject(
              err instanceof Error
                ? err
                : new Error('Browser memblokir pemutaran audio otomatis.')
            );
          }
        });
      });
    },
    [releaseAiAudioUrl]
  );

  const runSpeakLoop = useCallback(
    async (
      rawText: string,
      paraIdx: number,
      myRunId: number,
      oneShot: boolean
    ) => {
      const settings = aiSettingsRef.current;
      const clean = rawText.trim();
      if (!clean || runIdRef.current !== myRunId) return;

      setAiError('');
      setAiCurrentText(clean);
      setAiCurrentParaIdx(paraIdx);
      aiCurrentParaIdxRef.current = paraIdx;

      try {
        if (settings.provider === 'browser') {
          const completed = await speakBrowserChunks(clean, myRunId, settings);
          if (!completed || runIdRef.current !== myRunId) return;
        } else {
          setAiLoading(true);
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          const ac = new AbortController();
          abortControllerRef.current = ac;

          const blob = await fetchOrCachedSpeechBlob(clean, settings, ac.signal);
          if (runIdRef.current !== myRunId) return;
          setAiLoading(false);

          // 1-paragraph lookahead prefetch when auto-advance is enabled
          if (
            !oneShot &&
            settings.autoAdvance &&
            readingModeRef.current !== 'vn'
          ) {
            const nextP = findNextSpeakableParagraphIdx(paraIdx + 1);
            if (nextP) {
              void fetchOrCachedSpeechBlob(
                nextP.text,
                settings,
                ac.signal
              ).catch(() => {});
            }
          }

          const completed = await playBlobWithAudio(blob, myRunId, settings);
          if (!completed || runIdRef.current !== myRunId) return;
        }

        if (oneShot) {
          stopAiNarrator();
          return;
        }

        if (!aiSettingsRef.current.autoAdvance) {
          stopAiNarrator();
          return;
        }

        if (readingModeRef.current === 'vn') {
          const paras = chapterParagraphsRef.current;
          const nextVn = vnIndexRef.current + vnStepRef.current;
          const hasNextChapter =
            currentChapterIndexRef.current < chapterCountRef.current - 1;
          if (nextVn >= paras.length && !hasNextChapter) {
            stopAiNarrator();
            toast('Pembacaan AI selesai sampai akhir buku.');
            return;
          }
          onAdvanceVnStepRef.current();
          return;
        }

        const nextP = findNextSpeakableParagraphIdx(paraIdx + 1);
        if (nextP) {
          void runSpeakLoop(nextP.text, nextP.idx, myRunId, false);
          return;
        }

        if (currentChapterIndexRef.current < chapterCountRef.current - 1) {
          const nextChap = currentChapterIndexRef.current + 1;
          pendingAiNextChapterRef.current = nextChap;
          onSwitchChapterRef.current(nextChap);
        } else {
          stopAiNarrator();
          toast('Pembacaan AI selesai sampai akhir buku.');
        }
      } catch (err: unknown) {
        if (runIdRef.current !== myRunId) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg =
          err instanceof Error ? err.message : 'Gagal menjalankan AI Narator.';
        setAiError(msg);
        toast.error(msg);
        stopAiNarrator();
      }
    },
    [
      fetchOrCachedSpeechBlob,
      findNextSpeakableParagraphIdx,
      playBlobWithAudio,
      speakBrowserChunks,
      stopAiNarrator,
    ]
  );

  const startAiReadingFrom = useCallback(
    (explicitStartParaIdx?: number) => {
      stopFileAudiobook();
      stopAiNarrator();

      const myRunId = runIdRef.current;
      isOneShotRef.current = false;
      setIsOneShotActive(false);

      if (readingModeRef.current === 'vn') {
        const paras = chapterParagraphsRef.current;
        const batch = paras.slice(
          vnIndexRef.current,
          vnIndexRef.current + vnStepRef.current
        );
        const batchText = batch
          .filter((p) => !p.isMediaOnly)
          .map((p) => extractSpeakableJapaneseText(p.html))
          .filter(Boolean)
          .join('\n');
        if (!batchText) {
          toast.error('Paragraf VN saat ini tidak berisi teks Jepang.');
          return;
        }
        lastSpokenVnKeyRef.current = `${currentChapterIndexRef.current}:${vnIndexRef.current}`;
        aiPlayingRef.current = true;
        setAiPlaying(true);
        void runSpeakLoop(batchText, vnIndexRef.current, myRunId, false);
        return;
      }

      const paras = chapterParagraphsRef.current;
      const fallbackStart = Math.min(
        Math.max(0, paras.length - 1),
        Math.floor(scrollRatioRef.current * Math.max(1, paras.length - 1))
      );
      const startFrom = explicitStartParaIdx ?? fallbackStart;
      const target =
        findNextSpeakableParagraphIdx(startFrom) ??
        findNextSpeakableParagraphIdx(0);
      if (!target) {
        toast.error('Tidak ditemukan teks untuk dibacakan di bab ini.');
        return;
      }

      aiPlayingRef.current = true;
      setAiPlaying(true);
      void runSpeakLoop(target.text, target.idx, myRunId, false);
    },
    [
      findNextSpeakableParagraphIdx,
      runSpeakLoop,
      stopAiNarrator,
      stopFileAudiobook,
    ]
  );

  const speakCustomTextOnce = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      stopFileAudiobook();
      stopAiNarrator();

      const myRunId = runIdRef.current;
      isOneShotRef.current = true;
      setIsOneShotActive(true);
      aiPlayingRef.current = true;
      setAiPlaying(true);
      void runSpeakLoop(clean, aiCurrentParaIdxRef.current, myRunId, true);
    },
    [runSpeakLoop, stopAiNarrator, stopFileAudiobook]
  );

  // Speak one-shot highlighted Japanese sentence when requested
  useEffect(() => {
    if (!oneShotSpeakRequest) return;
    if (oneShotSpeakRequest.id === lastOneShotIdRef.current) return;
    lastOneShotIdRef.current = oneShotSpeakRequest.id;
    speakCustomTextOnce(oneShotSpeakRequest.text);
  }, [oneShotSpeakRequest, speakCustomTextOnce]);

  // Sync AI narration automatically when VN step or chapter changes while active
  useEffect(() => {
    if (!aiPlayingRef.current || isOneShotRef.current) return;

    if (readingMode === 'vn') {
      const key = `${currentChapterIndex}:${vnIndex}`;
      if (lastSpokenVnKeyRef.current === key) return;
      const batch = chapterParagraphs.slice(vnIndex, vnIndex + vnParagraphsPerStep);
      const batchText = batch
        .filter((p) => !p.isMediaOnly)
        .map((p) => extractSpeakableJapaneseText(p.html))
        .filter(Boolean)
        .join('\n');
      if (!batchText) return;
      lastSpokenVnKeyRef.current = key;
      const myRunId = ++runIdRef.current;
      void runSpeakLoop(batchText, vnIndex, myRunId, false);
      return;
    }

    if (
      pendingAiNextChapterRef.current !== null &&
      pendingAiNextChapterRef.current === currentChapterIndex
    ) {
      pendingAiNextChapterRef.current = null;
      const first = findNextSpeakableParagraphIdx(0);
      if (first) {
        const myRunId = ++runIdRef.current;
        void runSpeakLoop(first.text, first.idx, myRunId, false);
      } else {
        stopAiNarrator();
      }
    }
  }, [
    vnIndex,
    vnParagraphsPerStep,
    currentChapterIndex,
    readingMode,
    chapterParagraphs,
    findNextSpeakableParagraphIdx,
    runSpeakLoop,
    stopAiNarrator,
  ]);

  const handleAiNextParagraph = useCallback(() => {
    if (readingModeRef.current === 'vn') {
      onAdvanceVnStepRef.current();
      return;
    }
    const nextP = findNextSpeakableParagraphIdx(aiCurrentParaIdxRef.current + 1);
    if (nextP) {
      startAiReadingFrom(nextP.idx);
    } else if (currentChapterIndexRef.current < chapterCountRef.current - 1) {
      pendingAiNextChapterRef.current = currentChapterIndexRef.current + 1;
      onSwitchChapterRef.current(currentChapterIndexRef.current + 1);
    } else {
      toast('Sudah di paragraf terakhir bab ini.');
    }
  }, [findNextSpeakableParagraphIdx, startAiReadingFrom]);

  const handleAiPrevParagraph = useCallback(() => {
    if (readingModeRef.current === 'vn') {
      toast('Gunakan tombol Mundur VN untuk kembali paragraf.');
      return;
    }
    const prevP = findPrevSpeakableParagraphIdx(aiCurrentParaIdxRef.current - 1);
    if (prevP) {
      startAiReadingFrom(prevP.idx);
    } else {
      toast('Sudah di paragraf awal bab ini.');
    }
  }, [findPrevSpeakableParagraphIdx, startAiReadingFrom]);

  const handleLoadVoicevoxSpeakers = async () => {
    setLoadingSpeakers(true);
    try {
      const list = await fetchVoicevoxSpeakers(aiSettings.voicevoxUrl);
      setVoicevoxSpeakers(list);
      toast.success(`Berhasil memuat ${list.length} suara VOICEVOX!`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke server VOICEVOX.'
      );
    } finally {
      setLoadingSpeakers(false);
    }
  };

  // ==================== FILE AUDIOBOOK PERSISTENCE & PLAYBACK ====================
  const persistFileState = useCallback(
    (override?: {
      trackId?: string;
      timeSec?: number;
      rate?: number;
      volume?: number;
    }) => {
      if (!bookStorageKey) return;
      const trackId = override?.trackId ?? activeTrack?.id;
      if (!trackId) return;
      const audio = fileAudioRef.current;
      saveAudiobookPlaybackState(bookStorageKey, {
        trackId,
        currentTimeSec:
          override?.timeSec ?? (audio ? audio.currentTime : fileCurrentTime),
        playbackRate: override?.rate ?? filePlaybackRate,
        volume: override?.volume ?? fileVolume,
        updatedAt: Date.now(),
      });
    },
    [
      bookStorageKey,
      activeTrack?.id,
      fileCurrentTime,
      filePlaybackRate,
      fileVolume,
    ]
  );

  // Load tracks & saved timestamp when switching novels
  useEffect(() => {
    let cancelled = false;
    setLoadingTracks(true);
    setFilePlaying(false);
    setFileCurrentTime(0);
    setFileDuration(0);

    void listNovelAudiobookTracks(bookStorageKey).then((loaded) => {
      if (cancelled) return;
      setTracks(loaded);
      const saved = loadAudiobookPlaybackState(bookStorageKey);
      if (saved && loaded.some((t) => t.id === saved.trackId)) {
        setActiveTrackId(saved.trackId);
        pendingFileSeekRef.current = saved.currentTimeSec;
        setFileCurrentTime(saved.currentTimeSec);
        setFilePlaybackRate(saved.playbackRate);
        setFileVolume(saved.volume);
      } else if (loaded.length > 0) {
        setActiveTrackId(loaded[0].id);
        pendingFileSeekRef.current = 0;
      } else {
        setActiveTrackId('');
        pendingFileSeekRef.current = 0;
      }
      setLoadingTracks(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bookStorageKey]);

  // Lazily create object URL ONLY for active track
  useEffect(() => {
    if (fileObjectUrlRef.current) {
      URL.revokeObjectURL(fileObjectUrlRef.current);
      fileObjectUrlRef.current = null;
    }
    const audio = fileAudioRef.current;
    if (!audio) return;

    if (!activeTrack) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    let nextSrc = '';
    if (activeTrack.kind === 'blob' && activeTrack.blob) {
      nextSrc = URL.createObjectURL(activeTrack.blob);
      fileObjectUrlRef.current = nextSrc;
    } else if (activeTrack.url) {
      nextSrc = activeTrack.url;
    }

    if (!nextSrc) return;
    audio.src = nextSrc;
    audio.playbackRate = filePlaybackRate;
    audio.volume = fileVolume;
    audio.load();
  }, [activeTrack?.id, activeTrack?.kind, activeTrack?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync audio rate & volume when changed
  useEffect(() => {
    const audio = fileAudioRef.current;
    if (!audio) return;
    audio.playbackRate = filePlaybackRate;
    audio.volume = fileVolume;
  }, [filePlaybackRate, fileVolume]);

  // Flush playback position on pagehide / beforeunload and stop everything on unmount
  useEffect(() => {
    const onUnload = () => {
      persistFileState();
    };
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
      persistFileState();
      stopAiNarrator();
      if (fileAudioRef.current) {
        fileAudioRef.current.pause();
        fileAudioRef.current.removeAttribute('src');
      }
      if (fileObjectUrlRef.current) {
        URL.revokeObjectURL(fileObjectUrlRef.current);
        fileObjectUrlRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleFilePlay = useCallback(() => {
    const audio = fileAudioRef.current;
    if (!audio || !activeTrack) {
      toast.error('Tambahkan file atau URL audiobook terlebih dahulu.');
      return;
    }
    if (!audio.paused) {
      audio.pause();
      persistFileState();
      return;
    }
    stopAiNarrator();
    audio.playbackRate = filePlaybackRate;
    audio.volume = fileVolume;
    void audio.play().catch(() => {
      toast.error(
        'Gagal memutar file audio ini. Pastikan format atau link audio valid.'
      );
    });
  }, [
    activeTrack,
    filePlaybackRate,
    fileVolume,
    persistFileState,
    stopAiNarrator,
  ]);

  const handleSelectTrack = useCallback(
    (track: StoredAudiobookTrack, autoPlay = true) => {
      persistFileState();
      stopAiNarrator();
      pendingFileSeekRef.current = 0;
      autoPlayTrackRef.current = autoPlay;
      setActiveTrackId(track.id);
      setFileCurrentTime(0);
      setFileDuration(0);
      persistFileState({ trackId: track.id, timeSec: 0 });
    },
    [persistFileState, stopAiNarrator]
  );

  const handleStepFileTrack = useCallback(
    (delta: number) => {
      if (tracks.length === 0) return;
      const curIdx = tracks.findIndex((t) => t.id === activeTrack?.id);
      const nextIdx = curIdx + delta;
      if (nextIdx < 0 || nextIdx >= tracks.length) {
        toast(
          delta > 0
            ? 'Sudah di track terakhir audiobook.'
            : 'Ini track pertama audiobook.'
        );
        return;
      }
      handleSelectTrack(tracks[nextIdx], true);
    },
    [activeTrack?.id, handleSelectTrack, tracks]
  );

  const handleSeekFileBy = (deltaSec: number) => {
    const audio = fileAudioRef.current;
    if (!audio) return;
    const dur = Number.isFinite(audio.duration) ? audio.duration : fileDuration;
    const next = Math.min(
      dur > 0 ? dur : audio.currentTime + Math.max(0, deltaSec),
      Math.max(0, audio.currentTime + deltaSec)
    );
    audio.currentTime = next;
    setFileCurrentTime(next);
    persistFileState({ timeSec: next });
  };

  const handleUploadAudioFiles = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingTracks(true);
    try {
      const updated = await addNovelAudiobookFiles(bookStorageKey, files);
      setTracks(updated);
      if (!activeTrackId && updated.length > 0) {
        setActiveTrackId(updated[0].id);
      }
      toast.success(`${files.length} file audiobook disimpan permanen!`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal menyimpan file audio.'
      );
    } finally {
      setUploadingTracks(false);
      e.target.value = '';
    }
  };

  const handleAddAudioUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setUploadingTracks(true);
    try {
      const updated = await addNovelAudiobookUrl(
        bookStorageKey,
        urlInput,
        urlTitleInput
      );
      setTracks(updated);
      if (!activeTrackId && updated.length > 0) {
        setActiveTrackId(updated[0].id);
      }
      setUrlInput('');
      setUrlTitleInput('');
      toast.success('URL audio ditambahkan ke playlist novel ini!');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal menambahkan URL audio.'
      );
    } finally {
      setUploadingTracks(false);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (activeTrack?.id === trackId && fileAudioRef.current) {
      fileAudioRef.current.pause();
      setFilePlaying(false);
    }
    const updated = await deleteNovelAudiobookTrack(bookStorageKey, trackId);
    setTracks(updated);
    if (activeTrackId === trackId) {
      setActiveTrackId(updated[0]?.id ?? '');
      setFileCurrentTime(0);
      setFileDuration(0);
    }
    toast.success('Track dihapus dari audiobook novel ini.');
  };

  const miniPlayerActive =
    !open && !isFullscreenOrZen && (aiPlaying || aiLoading || filePlaying);

  return (
    <>
      <input
        ref={fileUploadInputRef}
        type="file"
        multiple
        accept=".mp3,.m4b,.m4a,.wav,.ogg,.opus,.aac,.webm,audio/*"
        onChange={handleUploadAudioFiles}
        className="hidden"
      />

      <audio
        ref={fileAudioRef}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          const dur = Number.isFinite(el.duration) ? el.duration : 0;
          setFileDuration(dur);
          el.playbackRate = filePlaybackRate;
          el.volume = fileVolume;
          if (pendingFileSeekRef.current > 0) {
            const targetSec =
              dur > 0
                ? Math.min(dur - 0.5, pendingFileSeekRef.current)
                : pendingFileSeekRef.current;
            el.currentTime = Math.max(0, targetSec);
            setFileCurrentTime(Math.max(0, targetSec));
            pendingFileSeekRef.current = 0;
          }
          if (autoPlayTrackRef.current) {
            autoPlayTrackRef.current = false;
            void el.play().catch(() => {});
          }
        }}
        onPlay={() => setFilePlaying(true)}
        onPause={() => {
          setFilePlaying(false);
          persistFileState();
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setFileCurrentTime(t);
          const now = Date.now();
          if (now - lastFilePersistMsRef.current > 3000) {
            lastFilePersistMsRef.current = now;
            persistFileState({ timeSec: t });
          }
        }}
        onSeeked={() => persistFileState()}
        onEnded={() => {
          setFilePlaying(false);
          persistFileState({ timeSec: 0 });
          const idx = tracks.findIndex((t) => t.id === activeTrack?.id);
          if (idx >= 0 && idx < tracks.length - 1) {
            handleSelectTrack(tracks[idx + 1], true);
          } else {
            toast('Track audiobook selesai diputar.');
          }
        }}
      />

      {/* COMPACT FLOATING MINI-PLAYER PILL */}
      {miniPlayerActive && (
        <div
          className={`fixed bottom-16 right-3 sm:right-5 z-[105] max-w-[min(92vw,24rem)] px-3 py-2 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center gap-2 ${
            hasActiveBg ? themeStyle.toolbarGlass : themeStyle.panel
          }`}
        >
          {aiPlaying || aiLoading ? (
            <>
              <button
                type="button"
                onClick={stopAiNarrator}
                title="Hentikan AI Narator"
                className="p-1.5 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 hover:bg-rose-500/30 cursor-pointer shrink-0"
              >
                {aiLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5 fill-current" />
                )}
              </button>

              {!isOneShotActive && readingMode !== 'vn' && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleAiPrevParagraph}
                    title="Paragraf sebelumnya"
                    className={`p-1 rounded-lg border text-xs cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleAiNextParagraph}
                    title="Paragraf berikutnya"
                    className={`p-1 rounded-lg border text-xs cursor-pointer ${themeStyle.subtleBtn}`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveTab('ai');
                  onOpenDrawer?.('ai');
                }}
                title="Buka panel AI Narator"
                className="min-w-0 flex-1 text-left cursor-pointer hover:opacity-90"
              >
                <div className="text-[10px] font-extrabold text-sky-400 flex items-center gap-1">
                  <AudioLines className="w-3 h-3 shrink-0" />
                  <span>
                    {isOneShotActive
                      ? 'AI Membaca Pilihan'
                      : `AI Bab ${currentChapterIndex + 1} (${aiSettings.provider.toUpperCase()})`}
                  </span>
                </div>
                <div className="text-[11px] truncate opacity-85">
                  {aiCurrentText || 'Menyiapkan suara Jepang...'}
                </div>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleToggleFilePlay}
                title={filePlaying ? 'Jeda Audiobook' : 'Putar Audiobook'}
                className="p-1.5 rounded-xl bg-sky-500 text-slate-950 hover:bg-sky-400 cursor-pointer shrink-0"
              >
                {filePlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSeekFileBy(-10)}
                title="Mundur 10 detik"
                className={`p-1 rounded-lg border text-[10px] font-bold cursor-pointer shrink-0 ${themeStyle.subtleBtn}`}
              >
                -10s
              </button>
              <button
                type="button"
                onClick={() => handleSeekFileBy(10)}
                title="Maju 10 detik"
                className={`p-1 rounded-lg border text-[10px] font-bold cursor-pointer shrink-0 ${themeStyle.subtleBtn}`}
              >
                +10s
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('file');
                  onOpenDrawer?.('file');
                }}
                title="Buka panel File Audiobook"
                className="min-w-0 flex-1 text-left cursor-pointer hover:opacity-90"
              >
                <div className="text-[11px] font-bold truncate">
                  {activeTrack?.name ?? 'Audiobook'}
                </div>
                <div className={`text-[10px] font-mono ${themeStyle.mutedText}`}>
                  {formatAudioTime(fileCurrentTime)} /{' '}
                  {formatAudioTime(fileDuration)} ({filePlaybackRate}x)
                </div>
              </button>
              <button
                type="button"
                onClick={stopFileAudiobook}
                title="Tutup mini-player"
                className="p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* SLIDE-OVER AUDIOBOOK & AI NARATOR DRAWER */}
      {open && (
        <div
          className="fixed inset-0 z-[112] bg-black/50 flex justify-end"
          onClick={onClose}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className={`w-[min(92vw,24.5rem)] h-full border-l flex flex-col shadow-2xl overflow-hidden ${themeStyle.panel}`}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <h3 className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Audiobook &amp; AI Narator</span>
                </h3>
                <div className={`text-[10px] truncate mt-0.5 ${themeStyle.mutedText}`}>
                  {bookTitle}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-4 pt-3 pb-1 grid grid-cols-2 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className={`py-2 px-2 rounded-xl text-[11px] font-extrabold border inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'ai'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                <Bot className="w-3.5 h-3.5 shrink-0" />
                <span>AI Narator (TTS)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('file')}
                className={`py-2 px-2 rounded-xl text-[11px] font-extrabold border inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'file'
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : themeStyle.subtleBtn
                }`}
              >
                <FileAudio className="w-3.5 h-3.5 shrink-0" />
                <span>
                  File Audio {tracks.length > 0 ? `(${tracks.length})` : ''}
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {activeTab === 'ai' ? (
                <>
                  {/* Main Playback Card */}
                  <div className="p-3 rounded-2xl border border-white/15 bg-black/20 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-sky-400">
                        Bab {currentChapterIndex + 1}/{Math.max(1, chapterCount)}{' '}
                        {readingMode === 'vn'
                          ? `• VN #${vnIndex + 1}`
                          : aiPlaying
                            ? `• Paragraf #${aiCurrentParaIdx + 1}`
                            : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono uppercase">
                        {aiSettings.provider}
                      </span>
                    </div>

                    {aiCurrentText && (
                      <div className="text-xs leading-relaxed line-clamp-3 p-2 rounded-xl bg-black/25 border border-white/10 opacity-90">
                        {aiCurrentText}
                      </div>
                    )}

                    {aiError && (
                      <div className="text-[11px] text-rose-300 bg-rose-500/15 border border-rose-400/30 rounded-xl p-2">
                        {aiError}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {aiPlaying || aiLoading ? (
                        <button
                          type="button"
                          onClick={stopAiNarrator}
                          className="flex-1 py-2 px-3 rounded-xl bg-rose-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {aiLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Square className="w-3.5 h-3.5 fill-current" />
                          )}
                          <span>
                            {aiLoading ? 'Menyiapkan Suara...' : 'Stop Narator'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startAiReadingFrom()}
                          className="flex-1 btn-crimson py-2 px-3 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Bacakan dari Sini</span>
                        </button>
                      )}

                      {readingMode !== 'vn' && (
                        <>
                          <button
                            type="button"
                            onClick={handleAiPrevParagraph}
                            title="Paragraf Sebelumnya"
                            className={`p-2 rounded-xl border cursor-pointer ${themeStyle.subtleBtn}`}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleAiNextParagraph}
                            title="Paragraf Berikutnya"
                            className={`p-2 rounded-xl border cursor-pointer ${themeStyle.subtleBtn}`}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          speakCustomTextOnce(
                            'こんにちは。日本語のオーディオブック再生テストです。'
                          )
                        }
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                      >
                        <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Tes Suara</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateAiSettings({
                            autoAdvance: !aiSettings.autoAdvance,
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                          aiSettings.autoAdvance
                            ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
                            : themeStyle.subtleBtn
                        }`}
                      >
                        {aiSettings.autoAdvance
                          ? 'Auto-Lanjut: ON'
                          : 'Auto-Lanjut: OFF'}
                      </button>
                    </div>
                  </div>

                  {/* Provider Picker */}
                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Sumber Mesin Suara AI
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'browser', label: 'Browser (Gratis)' },
                          { id: 'gemini', label: 'Google Gemini AI' },
                          { id: 'openai', label: 'OpenAI / Kokoro' },
                          { id: 'voicevox', label: 'VOICEVOX Lokal' },
                        ] as const
                      ).map((p: { id: AiTtsProvider; label: string }) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            stopAiNarrator();
                            updateAiSettings({ provider: p.id });
                          }}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                            aiSettings.provider === p.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Speed & Volume */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className={`font-bold ${themeStyle.mutedText}`}>
                          Kecepatan
                        </span>
                        <span className="font-mono font-bold">
                          {aiSettings.rate.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.6}
                        max={2.0}
                        step={0.05}
                        value={aiSettings.rate}
                        onChange={(e) =>
                          updateAiSettings({ rate: Number(e.target.value) })
                        }
                        className="w-full accent-sky-400 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className={`font-bold ${themeStyle.mutedText}`}>
                          Volume
                        </span>
                        <span className="font-mono font-bold">
                          {Math.round(aiSettings.volume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={aiSettings.volume}
                        onChange={(e) =>
                          updateAiSettings({ volume: Number(e.target.value) })
                        }
                        className="w-full accent-sky-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Provider-specific Settings */}
                  {aiSettings.provider === 'browser' && (
                    <div className="space-y-2 p-3 rounded-xl border border-white/10 bg-white/5">
                      <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                        Suara Jepang Bawaan Browser ({browserVoices.length})
                      </span>
                      <select
                        value={aiSettings.browserVoiceURI}
                        onChange={(e) =>
                          updateAiSettings({ browserVoiceURI: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 text-xs focus:outline-none focus:border-sky-400"
                      >
                        <option value="">
                          Otomatis (Prioritas Neural / Natural ja-JP)
                        </option>
                        {browserVoices.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                      <p className={`text-[10px] leading-relaxed ${themeStyle.mutedText}`}>
                        Tips: Di Microsoft Edge, suara <b>Nanami / Keita Natural</b> gratis dengan kualitas mendekati AI berbayar.
                      </p>
                    </div>
                  )}

                  {aiSettings.provider === 'gemini' && (
                    <div className="space-y-2.5 p-3 rounded-xl border border-white/10 bg-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-bold ${themeStyle.mutedText}`}>
                          Google Gemini API Key
                        </span>
                        <a
                          href="https://aistudio.google.com/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-sky-400 hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>Dapatkan Gratis</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={aiSettings.geminiApiKey}
                          onChange={(e) =>
                            updateAiSettings({ geminiApiKey: e.target.value })
                          }
                          placeholder="AIza..."
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 text-xs font-mono focus:outline-none focus:border-sky-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey((s) => !s)}
                          className={`p-1.5 rounded-xl border cursor-pointer ${themeStyle.subtleBtn}`}
                        >
                          {showApiKey ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                            Model TTS
                          </span>
                          <select
                            value={aiSettings.geminiModel}
                            onChange={(e) =>
                              updateAiSettings({
                                geminiModel: e.target.value as
                                  | 'gemini-2.5-flash-preview-tts'
                                  | 'gemini-2.5-pro-preview-tts',
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-xl bg-black/35 border border-white/15 text-[11px] focus:outline-none focus:border-sky-400"
                          >
                            <option value="gemini-2.5-flash-preview-tts">
                              Flash TTS (Cepat)
                            </option>
                            <option value="gemini-2.5-pro-preview-tts">
                              Pro TTS (Ekspresif)
                            </option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                            Karakter Suara
                          </span>
                          <select
                            value={aiSettings.geminiVoice}
                            onChange={(e) =>
                              updateAiSettings({ geminiVoice: e.target.value })
                            }
                            className="w-full px-2 py-1.5 rounded-xl bg-black/35 border border-white/15 text-[11px] focus:outline-none focus:border-sky-400"
                          >
                            {GEMINI_TTS_VOICES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                          Arahan Gaya Bicara AI (Style Prompt)
                        </span>
                        <input
                          type="text"
                          value={aiSettings.geminiStylePrompt}
                          onChange={(e) =>
                            updateAiSettings({
                              geminiStylePrompt: e.target.value,
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 text-[11px] focus:outline-none focus:border-sky-400"
                        />
                      </div>
                      <p className={`text-[10px] ${themeStyle.mutedText}`}>
                        API Key disimpan hanya di browser Anda dan juga mengaktifkan fitur <b>Tanya AI</b> untuk bedah kalimat Jepang.
                      </p>
                    </div>
                  )}

                  {aiSettings.provider === 'openai' && (
                    <div className="space-y-2.5 p-3 rounded-xl border border-white/10 bg-white/5">
                      <div className="space-y-1">
                        <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                          Base URL (OpenAI / Kokoro-FastAPI Lokal)
                        </span>
                        <input
                          type="text"
                          value={aiSettings.openaiBaseUrl}
                          onChange={(e) =>
                            updateAiSettings({ openaiBaseUrl: e.target.value })
                          }
                          placeholder="https://api.openai.com/v1"
                          className="w-full px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 text-xs font-mono focus:outline-none focus:border-sky-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                          API Key (opsional untuk server lokal Kokoro)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={aiSettings.openaiApiKey}
                            onChange={(e) =>
                              updateAiSettings({ openaiApiKey: e.target.value })
                            }
                            placeholder="sk-..."
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 text-xs font-mono focus:outline-none focus:border-sky-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey((s) => !s)}
                            className={`p-1.5 rounded-xl border cursor-pointer ${themeStyle.subtleBtn}`}
                          >
                            {showApiKey ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                            Model
                          </span>
                          <input
                            type="text"
                            value={aiSettings.openaiModel}
                            onChange={(e) =>
                              updateAiSettings({ openaiModel: e.target.value })
                            }
                            placeholder="gpt-4o-mini-tts"
                            className="w-full px-2 py-1.5 rounded-xl bg-black/35 border border-white/15 text-[11px] font-mono focus:outline-none focus:border-sky-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                            Voice
                          </span>
                          <select
                            value={aiSettings.openaiVoice}
                            onChange={(e) =>
                              updateAiSettings({ openaiVoice: e.target.value })
                            }
                            className="w-full px-2 py-1.5 rounded-xl bg-black/35 border border-white/15 text-[11px] focus:outline-none focus:border-sky-400"
                          >
                            {OPENAI_TTS_VOICES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {aiSettings.provider === 'voicevox' && (
                    <div className="space-y-2.5 p-3 rounded-xl border border-white/10 bg-white/5">
                      <div className="space-y-1">
                        <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                          URL VOICEVOX Engine Lokal
                        </span>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={aiSettings.voicevoxUrl}
                            onChange={(e) =>
                              updateAiSettings({ voicevoxUrl: e.target.value })
                            }
                            placeholder="http://127.0.0.1:50021"
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 text-xs font-mono focus:outline-none focus:border-sky-400"
                          />
                          <button
                            type="button"
                            disabled={loadingSpeakers}
                            onClick={() => void handleLoadVoicevoxSpeakers()}
                            title="Muat daftar karakter VOICEVOX"
                            className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 ${themeStyle.subtleBtn}`}
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${loadingSpeakers ? 'animate-spin' : ''}`}
                            />
                            <span>Muat</span>
                          </button>
                        </div>
                      </div>

                      {voicevoxSpeakers.length > 0 ? (
                        <div className="space-y-1">
                          <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                            Pilih Karakter ({voicevoxSpeakers.length})
                          </span>
                          <select
                            value={aiSettings.voicevoxSpeakerId}
                            onChange={(e) =>
                              updateAiSettings({
                                voicevoxSpeakerId: Number(e.target.value),
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 text-xs focus:outline-none focus:border-sky-400"
                          >
                            {voicevoxSpeakers.map((sp) => (
                              <option key={sp.id} value={sp.id}>
                                #{sp.id} {sp.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                            Speaker ID (contoh: 3 = Zundamon, 2 = Shikoku Metan)
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={aiSettings.voicevoxSpeakerId}
                            onChange={(e) =>
                              updateAiSettings({
                                voicevoxSpeakerId: Number(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 text-xs font-mono focus:outline-none focus:border-sky-400"
                          />
                        </div>
                      )}
                      <p className={`text-[10px] leading-relaxed ${themeStyle.mutedText}`}>
                        Pastikan aplikasi <b>VOICEVOX</b> terbuka di PC dan CORS diizinkan bila mengakses dari web HTTPS.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* FILE AUDIOBOOK TAB */}
                  {activeTrack ? (
                    <div className="p-3 rounded-2xl border border-white/15 bg-black/20 space-y-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-extrabold text-sky-400 uppercase tracking-wider">
                          Sedang Dipilih
                        </div>
                        <div className="text-xs font-extrabold truncate mt-0.5">
                          {activeTrack.name}
                        </div>
                      </div>

                      {/* Seek slider */}
                      <div className="space-y-1">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(1, fileDuration || 1)}
                          step={0.5}
                          value={Math.min(
                            fileCurrentTime,
                            Math.max(1, fileDuration || 1)
                          )}
                          onChange={(e) => {
                            const nextSec = Number(e.target.value);
                            setFileCurrentTime(nextSec);
                            if (fileAudioRef.current) {
                              fileAudioRef.current.currentTime = nextSec;
                            }
                            persistFileState({ timeSec: nextSec });
                          }}
                          className="w-full accent-sky-400 cursor-pointer"
                        />
                        <div className={`flex justify-between text-[10px] font-mono ${themeStyle.mutedText}`}>
                          <span>{formatAudioTime(fileCurrentTime)}</span>
                          <span>{formatAudioTime(fileDuration)}</span>
                        </div>
                      </div>

                      {/* Main transport controls */}
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStepFileTrack(-1)}
                          title="Track Sebelumnya"
                          className={`p-2 rounded-xl border cursor-pointer ${themeStyle.subtleBtn}`}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSeekFileBy(-10)}
                          title="Mundur 10 detik"
                          className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>10s</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleFilePlay}
                          className="btn-crimson px-5 py-2.5 rounded-2xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {filePlaying ? (
                            <>
                              <Pause className="w-4 h-4" />
                              <span>Jeda</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>Putar</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSeekFileBy(10)}
                          title="Maju 10 detik"
                          className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                        >
                          <span>10s</span>
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStepFileTrack(1)}
                          title="Track Berikutnya"
                          className={`p-2 rounded-xl border cursor-pointer ${themeStyle.subtleBtn}`}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Speed presets */}
                      <div className="space-y-1">
                        <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                          Kecepatan Putar
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {SPEED_PRESETS.map((spd) => (
                            <button
                              key={spd}
                              type="button"
                              onClick={() => {
                                setFilePlaybackRate(spd);
                                persistFileState({ rate: spd });
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition cursor-pointer ${
                                Math.abs(filePlaybackRate - spd) < 0.01
                                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                                  : themeStyle.subtleBtn
                              }`}
                            >
                              {spd}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Volume */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className={`font-bold ${themeStyle.mutedText}`}>
                            Volume Audiobook
                          </span>
                          <span className="font-mono font-bold">
                            {Math.round(fileVolume * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={fileVolume}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setFileVolume(v);
                            persistFileState({ volume: v });
                          }}
                          className="w-full accent-sky-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className={`p-4 rounded-2xl border border-dashed border-white/20 text-center text-xs ${themeStyle.mutedText}`}>
                      Belum ada file audiobook untuk novel ini. Unggah MP3/M4B/M4A atau tempel link audio di bawah — tersimpan permanen per novel beserta posisi detiknya.
                    </div>
                  )}

                  {/* Upload File / URL */}
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      disabled={uploadingTracks}
                      onClick={() => fileUploadInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {uploadingTracks ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>Unggah File Audiobook (.mp3 / .m4b / .m4a)</span>
                    </button>

                    <form onSubmit={handleAddAudioUrlSubmit} className="space-y-1.5">
                      <input
                        type="text"
                        value={urlTitleInput}
                        onChange={(e) => setUrlTitleInput(e.target.value)}
                        placeholder="Judul track (opsional, misal: Bab 1)"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/15 text-xs focus:outline-none focus:border-sky-400"
                      />
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="Tempel URL audio (https://...mp3)"
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/15 text-xs focus:outline-none focus:border-sky-400"
                        />
                        <button
                          type="submit"
                          disabled={uploadingTracks}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 ${themeStyle.subtleBtn}`}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Playlist */}
                  <div className="space-y-1.5">
                    <span className={`block text-[11px] font-bold ${themeStyle.mutedText}`}>
                      Daftar Track ({tracks.length})
                    </span>
                    {loadingTracks ? (
                      <div className="py-4 text-center text-xs opacity-70">
                        Memuat playlist...
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {tracks.map((tr, idx) => {
                          const isSelected = tr.id === activeTrack?.id;
                          return (
                            <div
                              key={tr.id}
                              className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition ${
                                isSelected
                                  ? 'bg-sky-500/20 border-sky-400/50'
                                  : themeStyle.subtleBtn
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectTrack(tr, true)}
                                className="flex-1 min-w-0 text-left flex items-center gap-2 cursor-pointer"
                              >
                                <span className="text-[10px] font-mono opacity-65 shrink-0">
                                  {idx + 1}.
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">
                                    {tr.name}
                                  </div>
                                  <div className={`text-[10px] font-mono ${themeStyle.mutedText}`}>
                                    {tr.kind === 'blob'
                                      ? formatBytesMb(tr.sizeBytes) || 'File Lokal'
                                      : 'Audio URL'}
                                  </div>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteTrack(tr.id)}
                                title="Hapus track"
                                className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:text-rose-400 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
