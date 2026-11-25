import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Bot,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Eye,
  EyeOff,
  FileAudio,
  FileText,
  Headphones,
  Link2,
  Loader2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sparkles,
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
  deleteTrackSubtitlesIdb,
  extractSpeakableJapaneseText,
  fetchVoicevoxSpeakers,
  GEMINI_TTS_VOICES,
  listJapaneseBrowserVoices,
  listNovelAudiobookTracks,
  loadAiTtsSettings,
  loadAudiobookPlaybackState,
  loadTrackSubtitlesIdb,
  OPENAI_TTS_VOICES,
  saveAiTtsSettings,
  saveAudiobookPlaybackState,
  saveTrackSubtitlesIdb,
  splitLongJapaneseTextForTts,
  synthesizeAiSpeechBlob,
  type AiTtsProvider,
  type AiTtsSettings,
  type StoredAudiobookTrack,
} from '../lib/audiobookEngine';
import {
  alignSubtitlesToBook,
  alignTrackWithAi,
  analyzeAudioSpeechEnvelope,
  buildWeightedSyncTimeline,
  classifyStoryChapters,
  createDefaultTrackSyncConfig,
  extractMp4EmbeddedChapters,
  findCueAtAudioTime,
  findSegmentAtAudioTime,
  findSegmentForParagraph,
  loadGlobalTrackingPrefs,
  loadTrackSyncConfig,
  matchEmbeddedChaptersToAnchors,
  MAX_FULL_DECODE_BYTES,
  parseSubtitleTextToCues,
  saveGlobalTrackingPrefs,
  saveTrackSyncConfig,
  spotSyncAudioAtCurrentTimeWithAi,
  type AudioSpeechEnvelope,
  type GlobalTrackingPrefs,
  type SubtitleCue,
  type SyncParagraphMeta,
  type SyncTimelineSegment,
  type TrackSyncConfig,
} from '../lib/audiobookSync';
import type { ChapterParagraphBlock, ReaderMode } from '../lib/epubReaderStore';

export interface AudioTrackingStatusPayload {
  activeTarget: {
    chapterIndex: number;
    paraIndex: number;
    source: 'ai' | 'file';
    timeSec?: number;
  } | null;
  liveTrackingEnabled: boolean;
  autoFollow: boolean;
  clickToJump: boolean;
  hasAudiobookTracks: boolean;
  syncLabel: string;
  isPlaying: boolean;
  syncingSpotAudio: boolean;
  hasAiKey: boolean;
  resolvedScope: 'book' | 'chapter';
  resolvedChapterIndex: number;
  currentTimeSec: number;
  durationSec: number;
  offsetSec: number;
  subtitleCuesCount: number;
  subtitleMatchedCount: number;
  activeCueIndex: number;
  activeCueText: string;
  subtitleWindow: Array<{
    index: number;
    startSec: number;
    endSec: number;
    text: string;
  }>;
}

export interface AudioFocusControlRequest {
  id: number;
  action:
    | 'togglePlay'
    | 'seekDelta'
    | 'seekExact'
    | 'prevItem'
    | 'nextItem'
    | 'offsetDelta';
  value?: number;
}

interface ReaderAudiobookDockProps {
  open: boolean;
  initialTab?: 'ai' | 'file';
  onClose: () => void;
  bookStorageKey: string;
  bookTitle: string;
  chapterCount: number;
  chapterTitles: string[];
  currentChapterIndex: number;
  chapterParagraphs: ChapterParagraphBlock[];
  allSyncBlocks: SyncParagraphMeta[];
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
  jumpAudioRequest: {
    id: number;
    chapterIndex: number;
    paraIndex: number;
    calibrate?: boolean;
  } | null;
  spotSyncRequest: number;
  audioFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  audioControlRequest?: AudioFocusControlRequest | null;
  onAdvanceVnStep: () => void;
  onSwitchChapter: (chapterIndex: number) => void;
  onOpenDrawer?: (tab: 'ai' | 'file') => void;
  onPlaybackStatusChange?: (status: {
    active: boolean;
    mode: 'ai' | 'file' | null;
  }) => void;
  onTrackingStateChange?: (state: AudioTrackingStatusPayload) => void;
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
  chapterTitles,
  currentChapterIndex,
  chapterParagraphs,
  allSyncBlocks,
  readingMode,
  vnIndex,
  vnParagraphsPerStep,
  scrollRatio,
  isFullscreenOrZen,
  themeStyle,
  hasActiveBg,
  oneShotSpeakRequest,
  jumpAudioRequest,
  spotSyncRequest,
  audioFocusMode = false,
  onToggleFocusMode,
  audioControlRequest,
  onAdvanceVnStep,
  onSwitchChapter,
  onOpenDrawer,
  onPlaybackStatusChange,
  onTrackingStateChange,
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
  const pendingAiJumpParaRef = useRef<{
    chapterIndex: number;
    paraIndex: number;
  } | null>(null);
  const lastSpokenVnKeyRef = useRef('');
  const lastOneShotIdRef = useRef(0);
  const lastJumpIdRef = useRef(0);

  // ==================== FILE AUDIOBOOK STATE ====================
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const subtitleUploadInputRef = useRef<HTMLInputElement | null>(null);
  const fileAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileObjectUrlRef = useRef<string | null>(null);
  const pendingFileSeekRef = useRef<number | null>(null);
  const pendingTrackJumpParaRef = useRef<{
    trackId: string;
    chapterIndex: number;
    paraIndex: number;
  } | null>(null);
  const autoPlayTrackRef = useRef(false);
  const lastFilePersistMsRef = useRef(0);

  const [tracks, setTracks] = useState<StoredAudiobookTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [uploadingTracks, setUploadingTracks] = useState(false);
  const [syncingAiAudio, setSyncingAiAudio] = useState(false);
  const [aiSyncProgress, setAiSyncProgress] = useState('');
  const [syncingSpotAudio, setSyncingSpotAudio] = useState(false);
  const [speechEnvelope, setSpeechEnvelope] =
    useState<AudioSpeechEnvelope | null>(null);
  const [trackSubtitles, setTrackSubtitles] = useState<SubtitleCue[]>([]);
  const trackSubtitlesRef = useRef(trackSubtitles);
  trackSubtitlesRef.current = trackSubtitles;
  const [urlInput, setUrlInput] = useState('');
  const [urlTitleInput, setUrlTitleInput] = useState('');
  const [activeTrackId, setActiveTrackId] = useState('');
  const [filePlaying, setFilePlaying] = useState(false);
  const [fileCurrentTime, setFileCurrentTime] = useState(0);
  const [fileDuration, setFileDuration] = useState(0);
  const [filePlaybackRate, setFilePlaybackRate] = useState(1.0);
  const [fileVolume, setFileVolume] = useState(1.0);
  const [trackingPrefs, setTrackingPrefs] = useState<GlobalTrackingPrefs>(
    loadGlobalTrackingPrefs
  );
  const [syncConfig, setSyncConfig] = useState<TrackSyncConfig>(() =>
    createDefaultTrackSyncConfig(0)
  );

  const activeTrack = useMemo(
    () => tracks.find((t) => t.id === activeTrackId) ?? tracks[0] ?? null,
    [tracks, activeTrackId]
  );

  const activeTrackIdx = useMemo(() => {
    if (!activeTrack) return 0;
    const idx = tracks.findIndex((t) => t.id === activeTrack.id);
    return idx >= 0 ? idx : 0;
  }, [tracks, activeTrack]);

  // Load per-track sync config & IndexedDB subtitles when activeTrack changes
  useEffect(() => {
    setSpeechEnvelope(null);
    if (!activeTrack) {
      setSyncConfig(createDefaultTrackSyncConfig(currentChapterIndexRef.current));
      setTrackSubtitles([]);
      return;
    }
    const cfg = loadTrackSyncConfig(
      bookStorageKey,
      activeTrack.id,
      currentChapterIndexRef.current
    );
    setSyncConfig(cfg);

    let cancelled = false;
    const trackId = activeTrack.id;
    void loadTrackSubtitlesIdb<SubtitleCue>(bookStorageKey, trackId).then(
      (idbCues) => {
        if (cancelled) return;
        if (idbCues.length > 0) {
          setTrackSubtitles(idbCues);
        } else if (cfg.cues && cfg.cues.length > 0) {
          setTrackSubtitles(cfg.cues);
          void saveTrackSubtitlesIdb(bookStorageKey, trackId, cfg.cues);
          const migrated: TrackSyncConfig = {
            ...cfg,
            cues: undefined,
            cueSource: cfg.cueSource ?? 'subtitle',
            syncMode: cfg.syncMode ?? 'subtitle',
          };
          setSyncConfig(migrated);
          saveTrackSyncConfig(bookStorageKey, trackId, migrated);
        } else {
          setTrackSubtitles([]);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [bookStorageKey, activeTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTrackingPrefs = useCallback(
    (patch: Partial<GlobalTrackingPrefs>) => {
      setTrackingPrefs((prev) => {
        const next = { ...prev, ...patch };
        saveGlobalTrackingPrefs(next);
        return next;
      });
    },
    []
  );

  const updateSyncConfig = useCallback(
    (updater: TrackSyncConfig | ((prev: TrackSyncConfig) => TrackSyncConfig)) => {
      if (!activeTrack) return;
      setSyncConfig((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveTrackSyncConfig(bookStorageKey, activeTrack.id, next);
        return next;
      });
    },
    [activeTrack, bookStorageKey]
  );

  // Automatic background VAD speech-energy analysis & M4B chapter marker extraction
  useEffect(() => {
    if (
      !activeTrack ||
      activeTrack.kind !== 'blob' ||
      !activeTrack.blob ||
      fileDuration <= 0
    ) {
      return;
    }
    let cancelled = false;
    const blob = activeTrack.blob;
    const trackId = activeTrack.id;
    const cacheKey = `${trackId}:${blob.size}`;

    if (blob.size <= MAX_FULL_DECODE_BYTES) {
      void analyzeAudioSpeechEnvelope(blob, cacheKey).then((env) => {
        if (cancelled || !env) return;
        setSpeechEnvelope(env);
        updateSyncConfig((prev) => {
          if (
            typeof prev.speechStartSec === 'number' &&
            typeof prev.speechEndSec === 'number' &&
            Math.abs(prev.speechStartSec - env.speechStartSec) < 0.25 &&
            Math.abs(prev.speechEndSec - env.speechEndSec) < 0.25
          ) {
            return prev;
          }
          return {
            ...prev,
            speechStartSec: env.speechStartSec,
            speechEndSec: env.speechEndSec,
            syncMode: prev.syncMode ?? 'vad',
          };
        });
      });
    }

    const lowerName = (activeTrack.name || '').toLowerCase();
    const lowerMime = (activeTrack.mimeType || blob.type || '').toLowerCase();
    const isMp4Container =
      lowerName.endsWith('.m4b') ||
      lowerName.endsWith('.m4a') ||
      lowerName.endsWith('.mp4') ||
      lowerMime.includes('mp4') ||
      lowerMime.includes('m4a');

    if (isMp4Container && allSyncBlocks.length > 0) {
      const existingCfg = loadTrackSyncConfig(
        bookStorageKey,
        trackId,
        currentChapterIndexRef.current
      );
      if (existingCfg.anchors.length === 0) {
        void extractMp4EmbeddedChapters(blob).then((emb) => {
          if (cancelled || emb.length < 2) return;
          const matched = matchEmbeddedChaptersToAnchors(
            emb,
            allSyncBlocks,
            chapterCount,
            chapterTitles
          );
          if (matched.length >= 2) {
            updateSyncConfig((prev) => {
              if (prev.anchors.length > 0) return prev;
              return {
                ...prev,
                scope: 'book',
                syncMode: 'm4b',
                anchors: matched,
              };
            });
            toast.success(
              `${matched.length} penanda bab M4B otomatis disinkronkan ke teks novel!`
            );
          }
        });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeTrack?.id,
    fileDuration,
    bookStorageKey,
    chapterCount,
    allSyncBlocks,
    chapterTitles,
    updateSyncConfig,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTimeline = useMemo(() => {
    if (!activeTrack || allSyncBlocks.length === 0) {
      return {
        segments: [] as SyncTimelineSegment[],
        resolvedScope: 'chapter' as const,
        resolvedChapterIndex: currentChapterIndex,
        targetBlocks: [] as SyncParagraphMeta[],
        subtitleMatchedCount: 0,
      };
    }
    const base = buildWeightedSyncTimeline(allSyncBlocks, {
      durationSec: fileDuration,
      trackCount: tracks.length,
      trackIndex: activeTrackIdx,
      trackName: activeTrack.name,
      currentChapterIndex,
      chapterCount,
      chapterTitles,
      config: syncConfig,
      speechEnvelope,
    });
    if (trackSubtitles.length > 0) {
      const subRes = alignSubtitlesToBook(
        allSyncBlocks,
        trackSubtitles,
        fileDuration,
        syncConfig.anchors,
        speechEnvelope
      );
      if (subRes.matchedCount >= 3 && subRes.segments.length > 0) {
        return {
          segments: subRes.segments,
          resolvedScope: (subRes.coveredChapters.length > 1
            ? 'book'
            : 'chapter') as 'book' | 'chapter',
          resolvedChapterIndex: subRes.firstChapterIndex,
          targetBlocks: base.targetBlocks,
          subtitleMatchedCount: subRes.matchedCount,
        };
      }
      return { ...base, subtitleMatchedCount: subRes.matchedCount };
    }
    return { ...base, subtitleMatchedCount: 0 };
  }, [
    activeTrack,
    allSyncBlocks,
    fileDuration,
    tracks.length,
    activeTrackIdx,
    currentChapterIndex,
    chapterCount,
    chapterTitles,
    syncConfig,
    speechEnvelope,
    trackSubtitles,
  ]);

  const fileTrackedSeg = useMemo(() => {
    if (!activeTrack || activeTimeline.segments.length === 0) return null;
    return findSegmentAtAudioTime(
      activeTimeline.segments,
      fileCurrentTime,
      syncConfig.offsetSec
    );
  }, [activeTrack, activeTimeline.segments, fileCurrentTime, syncConfig.offsetSec]);

  const activeCueInfo = useMemo(() => {
    if (trackSubtitles.length === 0) return null;
    return findCueAtAudioTime(
      trackSubtitles,
      fileCurrentTime,
      syncConfig.offsetSec
    );
  }, [trackSubtitles, fileCurrentTime, syncConfig.offsetSec]);

  const subtitleWindow = useMemo(() => {
    if (trackSubtitles.length === 0) return [];
    const centerIdx = activeCueInfo ? activeCueInfo.index : 0;
    const wStart = Math.max(0, centerIdx - 2);
    const wEnd = Math.min(trackSubtitles.length, wStart + 5);
    return trackSubtitles.slice(wStart, wEnd).map((c, offset) => ({
      index: wStart + offset,
      startSec: c.startSec,
      endSec: c.endSec,
      text: c.text,
    }));
  }, [trackSubtitles, activeCueInfo]);

  const syncLabel = useMemo(() => {
    if (aiPlaying || aiLoading) {
      return `AI ${aiSettings.provider.toUpperCase()}`;
    }
    if (trackSubtitles.length > 0) {
      return activeTimeline.subtitleMatchedCount >= 3
        ? 'Subtitle Match'
        : 'SRT Langsung';
    }
    if (syncConfig.syncMode === 'ai' && syncConfig.anchors.length > 0) {
      return `AI Forced Sync`;
    }
    if (syncConfig.syncMode === 'm4b' && syncConfig.anchors.length > 0) {
      return `M4B Chapters`;
    }
    if (syncConfig.anchors.length > 0) {
      return `Kalibrasi (${syncConfig.anchors.length})`;
    }
    if (speechEnvelope || syncConfig.syncMode === 'vad') {
      return 'VAD + Auto';
    }
    return 'Auto-Sync';
  }, [
    aiPlaying,
    aiLoading,
    aiSettings.provider,
    trackSubtitles.length,
    activeTimeline.subtitleMatchedCount,
    syncConfig.syncMode,
    syncConfig.anchors.length,
    speechEnvelope,
  ]);

  const hasAudioAiKey = Boolean(
    aiSettings.geminiApiKey.trim() || aiSettings.openaiApiKey.trim()
  );

  // Broadcast live tracking target to Reader Modal without re-rendering book DOM
  useEffect(() => {
    const isAiLive = (aiPlaying || aiLoading) && !isOneShotActive;
    const isFileLive = !isAiLive && Boolean(activeTrack && fileTrackedSeg);

    let activeTarget: AudioTrackingStatusPayload['activeTarget'] = null;
    if (trackingPrefs.liveTracking) {
      if (isAiLive) {
        activeTarget = {
          chapterIndex: currentChapterIndex,
          paraIndex: aiCurrentParaIdx,
          source: 'ai',
        };
      } else if (isFileLive && fileTrackedSeg) {
        activeTarget = {
          chapterIndex: fileTrackedSeg.chapterIndex,
          paraIndex: fileTrackedSeg.paraIndex,
          source: 'file',
          timeSec: fileCurrentTime,
        };
      }
    }

    onTrackingStateChange?.({
      activeTarget,
      liveTrackingEnabled: trackingPrefs.liveTracking,
      autoFollow: trackingPrefs.autoFollow,
      clickToJump: trackingPrefs.clickToJump,
      hasAudiobookTracks: tracks.length > 0,
      syncLabel,
      isPlaying: Boolean(aiPlaying || aiLoading || filePlaying),
      syncingSpotAudio,
      hasAiKey: hasAudioAiKey,
      resolvedScope: activeTimeline.resolvedScope,
      resolvedChapterIndex: activeTimeline.resolvedChapterIndex,
      currentTimeSec: fileCurrentTime,
      durationSec: fileDuration,
      offsetSec: syncConfig.offsetSec,
      subtitleCuesCount: trackSubtitles.length,
      subtitleMatchedCount: activeTimeline.subtitleMatchedCount,
      activeCueIndex: activeCueInfo?.index ?? -1,
      activeCueText: activeCueInfo?.cue.text ?? '',
      subtitleWindow,
    });
  }, [
    aiPlaying,
    aiLoading,
    isOneShotActive,
    currentChapterIndex,
    aiCurrentParaIdx,
    activeTrack,
    fileTrackedSeg,
    filePlaying,
    fileCurrentTime,
    fileDuration,
    syncConfig.offsetSec,
    trackSubtitles.length,
    activeTimeline.subtitleMatchedCount,
    activeCueInfo,
    subtitleWindow,
    trackingPrefs,
    tracks.length,
    syncLabel,
    syncingSpotAudio,
    hasAudioAiKey,
    activeTimeline.resolvedScope,
    activeTimeline.resolvedChapterIndex,
    onTrackingStateChange,
  ]);

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
      pendingAiJumpParaRef.current !== null &&
      pendingAiJumpParaRef.current.chapterIndex === currentChapterIndex
    ) {
      const targetParaIdx = pendingAiJumpParaRef.current.paraIndex;
      pendingAiJumpParaRef.current = null;
      const target =
        findNextSpeakableParagraphIdx(targetParaIdx) ??
        findNextSpeakableParagraphIdx(0);
      if (target) {
        const myRunId = ++runIdRef.current;
        void runSpeakLoop(target.text, target.idx, myRunId, false);
      } else {
        stopAiNarrator();
      }
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
        pendingFileSeekRef.current =
          saved.currentTimeSec > 0 ? saved.currentTimeSec : null;
        setFileCurrentTime(saved.currentTimeSec);
        setFilePlaybackRate(saved.playbackRate);
        setFileVolume(saved.volume);
      } else if (loaded.length > 0) {
        setActiveTrackId(loaded[0].id);
        pendingFileSeekRef.current = null;
      } else {
        setActiveTrackId('');
        pendingFileSeekRef.current = null;
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

  const seekFileAudioSafe = useCallback(
    (targetTimeSec: number, autoPlay = true) => {
      const audio = fileAudioRef.current;
      if (!audio) return;
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : fileDuration;
      const rawClamped = Math.max(
        0,
        Number.isFinite(targetTimeSec) ? targetTimeSec : 0
      );
      const clamped = dur > 0 ? Math.min(dur, rawClamped) : rawClamped;
      if (autoPlay) {
        stopAiNarrator();
      }
      audio.playbackRate = filePlaybackRate;
      audio.volume = fileVolume;
      if (audio.readyState < 1) {
        pendingFileSeekRef.current = clamped;
        autoPlayTrackRef.current = autoPlay;
        setFileCurrentTime(clamped);
        if (activeTrack?.id) {
          persistFileState({ trackId: activeTrack.id, timeSec: clamped });
        }
        if (audio.networkState === 0) {
          audio.load();
        }
        if (autoPlay) {
          void audio.play().catch(() => {});
        }
        return;
      }
      pendingFileSeekRef.current = null;
      audio.currentTime = clamped;
      setFileCurrentTime(clamped);
      if (activeTrack?.id) {
        persistFileState({ trackId: activeTrack.id, timeSec: clamped });
      }
      if (autoPlay) {
        void audio.play().catch(() => {});
      }
    },
    [
      activeTrack?.id,
      fileDuration,
      filePlaybackRate,
      fileVolume,
      persistFileState,
      stopAiNarrator,
    ]
  );

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
      pendingFileSeekRef.current = null;
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

  const handleSeekFileBy = useCallback(
    (deltaSec: number) => {
      const audio = fileAudioRef.current;
      if (!audio) return;
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : fileDuration;
      const baseCur =
        audio.readyState < 1 && pendingFileSeekRef.current !== null
          ? pendingFileSeekRef.current
          : audio.currentTime;
      const next = Math.min(
        dur > 0 ? dur : baseCur + Math.max(0, deltaSec),
        Math.max(0, baseCur + deltaSec)
      );
      seekFileAudioSafe(next, !audio.paused);
    },
    [fileDuration, seekFileAudioSafe]
  );

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
      if (!trackingPrefs.liveTracking) {
        updateTrackingPrefs({ liveTracking: true });
      }
      toast.success(
        `${files.length} file audiobook disimpan & Live Tracking teks aktif! Klik paragraf mana saja untuk loncat ke sana.`
      );
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
      if (!trackingPrefs.liveTracking) {
        updateTrackingPrefs({ liveTracking: true });
      }
      toast.success(
        'URL audio ditambahkan & Live Tracking teks aktif! Klik paragraf mana saja untuk loncat ke sana.'
      );
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

  const handleAdjustSyncOffset = useCallback(
    (deltaSec: number) => {
      if (!activeTrack) return;
      updateSyncConfig((prev) => ({
        ...prev,
        offsetSec: Math.min(
          300,
          Math.max(-300, Math.round((prev.offsetSec + deltaSec) * 10) / 10)
        ),
      }));
    },
    [activeTrack, updateSyncConfig]
  );

  const handleCalibrateChapterStart = () => {
    if (!activeTrack || !fileAudioRef.current) return;
    const targetChap = activeTimeline.resolvedChapterIndex;
    const firstPara = allSyncBlocks.find(
      (b) => b.chapterIndex === targetChap && b.speechWeight > 0
    );
    if (!firstPara) {
      toast.error('Paragraf awal bab ini tidak ditemukan.');
      return;
    }
    const nowSec = fileAudioRef.current.currentTime;
    updateSyncConfig((prev) => {
      const filtered = prev.anchors.filter(
        (a) => a.globalIndex !== firstPara.globalIndex
      );
      return {
        ...prev,
        anchors: [
          ...filtered,
          { globalIndex: firstPara.globalIndex, timeSec: nowSec },
        ].sort((a, b) => a.globalIndex - b.globalIndex),
      };
    });
    toast.success(
      `Awal Bab ${targetChap + 1} disinkronkan ke ${formatAudioTime(nowSec)}!`
    );
  };

  const handleResetSyncConfig = () => {
    if (!activeTrack) return;
    setTrackSubtitles([]);
    void deleteTrackSubtitlesIdb(bookStorageKey, activeTrack.id);
    updateSyncConfig(createDefaultTrackSyncConfig(currentChapterIndex));
    toast.success('Pengaturan sinkronisasi dikembalikan ke Auto-Sync.');
  };

  const handleUploadSubtitleFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeTrack) return;
    try {
      const raw = await file.text();
      const cues = parseSubtitleTextToCues(raw);
      if (cues.length === 0) {
        toast.error(
          'Format subtitle tidak dikenali. Gunakan .srt, .vtt, .ass, atau .lrc yang memiliki timestamp.'
        );
        return;
      }
      setTrackSubtitles(cues);
      await saveTrackSubtitlesIdb(bookStorageKey, activeTrack.id, cues);
      updateSyncConfig((prev) => ({
        ...prev,
        syncMode: 'subtitle',
        cues: undefined,
        cueSource: 'subtitle',
      }));

      const diag = alignSubtitlesToBook(
        allSyncBlocks,
        cues,
        fileDuration,
        syncConfig.anchors,
        speechEnvelope
      );
      if (diag.matchedCount >= 3) {
        toast.success(
          `Subtitle cocok! ${diag.matchedCount} paragraf (Bab ${diag.firstChapterIndex + 1}–${diag.lastChapterIndex + 1}) terkunci presisi ke audio.`
        );
      } else {
        toast(
          `Subtitle dimuat (${cues.length} baris), tapi hanya ${diag.matchedCount} cocok dengan teks EPUB. Gunakan Mode Fokus → Subtitle (.SRT) Langsung agar tetap 100% pas!`,
          { duration: 5500 }
        );
      }
    } catch {
      toast.error('Gagal membaca file subtitle.');
    }
  };

  const handleAiAudioSync = async () => {
    if (!activeTrack || syncingAiAudio) return;
    if (!hasAudioAiKey) {
      onOpenDrawer?.('ai');
      toast(
        'Masukkan API Key Google Gemini (gratis) atau OpenAI di tab AI Narator untuk Sinkron AI.'
      );
      return;
    }
    setSyncingAiAudio(true);
    setAiSyncProgress('Menyiapkan audio...');
    try {
      const targetBlocks =
        activeTimeline.targetBlocks.length > 0
          ? activeTimeline.targetBlocks
          : allSyncBlocks;
      const res = await alignTrackWithAi(
        activeTrack,
        targetBlocks,
        fileDuration,
        aiSettings,
        (_done, _total, detail) => {
          if (detail) setAiSyncProgress(detail);
        },
        undefined,
        allSyncBlocks
      );
      updateSyncConfig((prev) => ({
        ...prev,
        syncMode: 'ai',
        anchors: res.anchors,
        cues: undefined,
        cueSource: 'ai',
      }));
      toast.success(
        `Sinkron Penuh AI selesai! ${res.anchors.length} titik paragraf dikunci ke audio.`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Gagal menyinkronkan audio dengan AI.'
      );
    } finally {
      setSyncingAiAudio(false);
      setAiSyncProgress('');
    }
  };

  const handleSpotSyncNow = useCallback(async () => {
    if (!activeTrack || syncingSpotAudio) return;
    if (!hasAudioAiKey) {
      onOpenDrawer?.('ai');
      toast(
        'Masukkan API Key Google Gemini (gratis) atau OpenAI di tab AI Narator untuk AI Cari Posisi.'
      );
      return;
    }
    setSyncingSpotAudio(true);
    try {
      const currentSec = fileAudioRef.current?.currentTime ?? fileCurrentTime;
      const res = await spotSyncAudioAtCurrentTimeWithAi({
        track: activeTrack,
        audioEl: fileAudioRef.current,
        currentTimeSec: currentSec,
        durationSec: fileDuration,
        allSyncBlocks,
        settings: aiSettings,
      });

      updateSyncConfig((prev) => {
        const filtered = prev.anchors.filter(
          (a) => a.globalIndex !== res.block.globalIndex
        );
        const switchChapScope =
          activeTimeline.resolvedScope === 'chapter' &&
          res.block.chapterIndex !== activeTimeline.resolvedChapterIndex;
        return {
          ...prev,
          ...(switchChapScope
            ? { scope: 'chapter' as const, chapterIndex: res.block.chapterIndex }
            : {}),
          syncMode:
            prev.syncMode === 'ai' ||
            prev.syncMode === 'm4b' ||
            prev.syncMode === 'subtitle'
              ? prev.syncMode
              : 'manual',
          anchors: [
            ...filtered,
            { globalIndex: res.block.globalIndex, timeSec: res.timeSec },
          ].sort((a, b) => a.globalIndex - b.globalIndex),
        };
      });

      const snippet = res.block.text.slice(0, 26);
      toast.success(
        `Ketemu! Bab ${res.block.chapterIndex + 1} • #${res.block.paraIndex + 1} 「${snippet}…」`
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'AI gagal menemukan posisi teks sekarang.'
      );
    } finally {
      setSyncingSpotAudio(false);
    }
  }, [
    activeTrack,
    syncingSpotAudio,
    hasAudioAiKey,
    onOpenDrawer,
    fileCurrentTime,
    fileDuration,
    allSyncBlocks,
    aiSettings,
    updateSyncConfig,
    activeTimeline.resolvedScope,
    activeTimeline.resolvedChapterIndex,
  ]);

  const lastSpotSyncReqRef = useRef(spotSyncRequest);
  const handleSpotSyncNowRef = useRef(handleSpotSyncNow);
  handleSpotSyncNowRef.current = handleSpotSyncNow;

  useEffect(() => {
    if (spotSyncRequest > 0 && spotSyncRequest !== lastSpotSyncReqRef.current) {
      lastSpotSyncReqRef.current = spotSyncRequest;
      void handleSpotSyncNowRef.current();
    }
  }, [spotSyncRequest]);

  // Unified Focus Mode control dispatcher (play/pause, seek, prev/next, offset)
  const lastControlIdRef = useRef(0);
  useEffect(() => {
    if (!audioControlRequest) return;
    if (audioControlRequest.id === lastControlIdRef.current) return;
    lastControlIdRef.current = audioControlRequest.id;

    const { action, value } = audioControlRequest;
    if (action === 'togglePlay') {
      if (aiPlayingRef.current || aiLoading) {
        stopAiNarrator();
      } else {
        handleToggleFilePlay();
      }
      return;
    }
    if (action === 'offsetDelta') {
      handleAdjustSyncOffset(value ?? 0);
      return;
    }
    if (action === 'seekDelta') {
      handleSeekFileBy(value ?? 0);
      return;
    }
    if (action === 'seekExact') {
      const targetTime = Math.max(0, (value ?? 0) - syncConfig.offsetSec);
      seekFileAudioSafe(targetTime, true);
      return;
    }
    if (action === 'prevItem' || action === 'nextItem') {
      const dir = action === 'nextItem' ? 1 : -1;
      if (aiPlayingRef.current) {
        if (dir > 0) handleAiNextParagraph();
        else handleAiPrevParagraph();
        return;
      }
      if (
        trackSubtitles.length > 0 &&
        (audioFocusMode || activeTimeline.subtitleMatchedCount < 3)
      ) {
        const curIdx = activeCueInfo ? activeCueInfo.index : 0;
        const nextIdx = Math.max(
          0,
          Math.min(trackSubtitles.length - 1, curIdx + dir)
        );
        const cue = trackSubtitles[nextIdx];
        if (cue) {
          seekFileAudioSafe(Math.max(0, cue.startSec - syncConfig.offsetSec), true);
        }
        return;
      }
      const segs = activeTimeline.segments;
      if (segs.length > 0) {
        const curIdx = fileTrackedSeg
          ? segs.findIndex((s) => s.globalIndex === fileTrackedSeg.globalIndex)
          : 0;
        const safeCur = curIdx >= 0 ? curIdx : 0;
        const nextIdx = Math.max(0, Math.min(segs.length - 1, safeCur + dir));
        const seg = segs[nextIdx];
        if (seg) {
          seekFileAudioSafe(Math.max(0, seg.startSec - syncConfig.offsetSec), true);
        }
      }
    }
  }, [
    audioControlRequest,
    aiLoading,
    stopAiNarrator,
    handleToggleFilePlay,
    handleAdjustSyncOffset,
    handleSeekFileBy,
    syncConfig.offsetSec,
    seekFileAudioSafe,
    handleAiNextParagraph,
    handleAiPrevParagraph,
    trackSubtitles,
    audioFocusMode,
    activeTimeline.subtitleMatchedCount,
    activeTimeline.segments,
    activeCueInfo,
    fileTrackedSeg,
  ]);

  // Click any paragraph in book -> jump audio directly there (or Shift+Click / Pas Teks -> calibrate anchor)
  useEffect(() => {
    if (!jumpAudioRequest) return;
    if (jumpAudioRequest.id === lastJumpIdRef.current) return;
    lastJumpIdRef.current = jumpAudioRequest.id;

    const clickedBlock = allSyncBlocks.find(
      (b) =>
        b.chapterIndex === jumpAudioRequest.chapterIndex &&
        b.paraIndex === jumpAudioRequest.paraIndex
    );

    if (jumpAudioRequest.calibrate) {
      if (!activeTrack || !fileAudioRef.current) {
        toast.error('Putar atau muat file audiobook dahulu untuk kalibrasi.');
        return;
      }
      if (!clickedBlock) return;
      const t = fileAudioRef.current.currentTime;
      updateSyncConfig((prev) => {
        const filtered = prev.anchors.filter(
          (a) => a.globalIndex !== clickedBlock.globalIndex
        );
        const fixChap =
          prev.scope === 'chapter' || activeTimeline.resolvedScope === 'chapter';
        return {
          ...prev,
          ...(fixChap ? { chapterIndex: jumpAudioRequest.chapterIndex } : {}),
          syncMode:
            prev.syncMode === 'ai' ||
            prev.syncMode === 'm4b' ||
            prev.syncMode === 'subtitle'
              ? prev.syncMode
              : 'manual',
          anchors: [
            ...filtered,
            { globalIndex: clickedBlock.globalIndex, timeSec: t },
          ].sort((a, b) => a.globalIndex - b.globalIndex),
        };
      });
      toast.success(
        `Kalibrasi diset: Bab ${jumpAudioRequest.chapterIndex + 1} #${jumpAudioRequest.paraIndex + 1} ↔ ${formatAudioTime(t)}`
      );
      return;
    }

    const useFileMode =
      tracks.length > 0 && (!aiPlayingRef.current || activeTab === 'file');

    if (useFileMode) {
      const seg = findSegmentForParagraph(
        activeTimeline.segments,
        jumpAudioRequest.chapterIndex,
        jumpAudioRequest.paraIndex
      );

      if (tracks.length > 1) {
        const { storyChapterIndices } = classifyStoryChapters(
          allSyncBlocks,
          chapterCount,
          chapterTitles
        );
        const storyPos = storyChapterIndices.indexOf(
          jumpAudioRequest.chapterIndex
        );
        let expectedTrackIdx: number;
        if (storyPos >= 0 && storyChapterIndices.length > 0) {
          expectedTrackIdx =
            tracks.length >= storyChapterIndices.length
              ? Math.min(tracks.length - 1, storyPos)
              : Math.min(
                  tracks.length - 1,
                  Math.floor(
                    (storyPos / storyChapterIndices.length) * tracks.length
                  )
                );
        } else {
          expectedTrackIdx = Math.min(
            tracks.length - 1,
            Math.max(0, jumpAudioRequest.chapterIndex)
          );
        }
        if (
          (!seg || syncConfig.scope === 'auto') &&
          expectedTrackIdx !== activeTrackIdx &&
          tracks[expectedTrackIdx]
        ) {
          const nextTrack = tracks[expectedTrackIdx];
          pendingTrackJumpParaRef.current = {
            trackId: nextTrack.id,
            chapterIndex: jumpAudioRequest.chapterIndex,
            paraIndex: jumpAudioRequest.paraIndex,
          };
          handleSelectTrack(nextTrack, true);
          return;
        }
      }

      if (activeTrack && fileDuration <= 0 && activeTimeline.segments.length === 0) {
        stopAiNarrator();
        pendingTrackJumpParaRef.current = {
          trackId: activeTrack.id,
          chapterIndex: jumpAudioRequest.chapterIndex,
          paraIndex: jumpAudioRequest.paraIndex,
        };
        autoPlayTrackRef.current = true;
        if (fileAudioRef.current) {
          if (fileAudioRef.current.networkState === 0) {
            fileAudioRef.current.load();
          }
          void fileAudioRef.current.play().catch(() => {});
        }
        return;
      }

      let targetSeg = seg;
      if (
        !targetSeg &&
        activeTrack &&
        fileDuration > 0 &&
        activeTimeline.resolvedScope === 'chapter' &&
        jumpAudioRequest.chapterIndex !== activeTimeline.resolvedChapterIndex
      ) {
        const nextCfg = {
          ...syncConfig,
          scope: 'chapter' as const,
          chapterIndex: jumpAudioRequest.chapterIndex,
        };
        const rebuilt = buildWeightedSyncTimeline(allSyncBlocks, {
          durationSec: fileDuration,
          trackCount: tracks.length,
          trackIndex: Math.max(0, activeTrackIdx),
          trackName: activeTrack.name,
          currentChapterIndex: jumpAudioRequest.chapterIndex,
          chapterCount,
          chapterTitles,
          config: nextCfg,
          speechEnvelope,
        });
        targetSeg = findSegmentForParagraph(
          rebuilt.segments,
          jumpAudioRequest.chapterIndex,
          jumpAudioRequest.paraIndex
        );
        updateSyncConfig((prev) => ({
          ...prev,
          scope: 'chapter',
          chapterIndex: jumpAudioRequest.chapterIndex,
        }));
      }

      if (targetSeg) {
        const targetTime = Math.max(
          0,
          targetSeg.startSec - syncConfig.offsetSec
        );
        seekFileAudioSafe(targetTime, true);
      }
      return;
    }

    // AI Narator jump
    if (jumpAudioRequest.chapterIndex !== currentChapterIndexRef.current) {
      pendingAiJumpParaRef.current = {
        chapterIndex: jumpAudioRequest.chapterIndex,
        paraIndex: jumpAudioRequest.paraIndex,
      };
      aiPlayingRef.current = true;
      setAiPlaying(true);
      onSwitchChapterRef.current(jumpAudioRequest.chapterIndex);
    } else {
      startAiReadingFrom(jumpAudioRequest.paraIndex);
    }
  }, [
    jumpAudioRequest,
    allSyncBlocks,
    activeTrack,
    activeTrackIdx,
    tracks,
    activeTab,
    fileDuration,
    chapterCount,
    chapterTitles,
    speechEnvelope,
    activeTimeline.segments,
    activeTimeline.resolvedScope,
    activeTimeline.resolvedChapterIndex,
    syncConfig,
    handleSelectTrack,
    seekFileAudioSafe,
    stopAiNarrator,
    startAiReadingFrom,
    updateSyncConfig,
  ]);

  const miniPlayerActive =
    !open &&
    !audioFocusMode &&
    !isFullscreenOrZen &&
    (aiPlaying || aiLoading || filePlaying);

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
      <input
        ref={subtitleUploadInputRef}
        type="file"
        accept=".srt,.vtt,.lrc,.ass,.ssa,.txt"
        onChange={handleUploadSubtitleFile}
        className="hidden"
      />

      <audio
        ref={fileAudioRef}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          const dur = Number.isFinite(el.duration) ? el.duration : 0;
          setFileDuration(dur);
          el.playbackRate = filePlaybackRate;
          el.volume = fileVolume;

          const pendingJump = pendingTrackJumpParaRef.current;
          if (pendingJump && activeTrack && pendingJump.trackId === activeTrack.id) {
            pendingTrackJumpParaRef.current = null;
            pendingFileSeekRef.current = null;
            const trackIdx = tracks.findIndex((t) => t.id === activeTrack.id);
            const cfg = loadTrackSyncConfig(
              bookStorageKey,
              activeTrack.id,
              pendingJump.chapterIndex
            );
            const subs = trackSubtitlesRef.current;
            let segs: SyncTimelineSegment[] = [];
            if (subs.length > 0) {
              const subRes = alignSubtitlesToBook(
                allSyncBlocks,
                subs,
                dur,
                cfg.anchors
              );
              if (subRes.matchedCount >= 3 && subRes.segments.length > 0) {
                segs = subRes.segments;
              }
            }
            if (segs.length === 0) {
              const tl = buildWeightedSyncTimeline(allSyncBlocks, {
                durationSec: dur,
                trackCount: tracks.length,
                trackIndex: Math.max(0, trackIdx),
                trackName: activeTrack.name,
                currentChapterIndex: pendingJump.chapterIndex,
                chapterCount,
                chapterTitles,
                config: cfg,
              });
              segs = tl.segments;
            }
            const seg = findSegmentForParagraph(
              segs,
              pendingJump.chapterIndex,
              pendingJump.paraIndex
            );
            const targetSec = seg ? Math.max(0, seg.startSec - cfg.offsetSec) : 0;
            el.currentTime = targetSec;
            setFileCurrentTime(targetSec);
            persistFileState({ trackId: activeTrack.id, timeSec: targetSec });
          } else if (
            pendingFileSeekRef.current !== null &&
            pendingFileSeekRef.current >= 0
          ) {
            const targetSec =
              dur > 0
                ? Math.min(Math.max(0, dur - 0.5), pendingFileSeekRef.current)
                : pendingFileSeekRef.current;
            el.currentTime = Math.max(0, targetSec);
            setFileCurrentTime(Math.max(0, targetSec));
            pendingFileSeekRef.current = null;
          }

          if (autoPlayTrackRef.current && el.readyState >= 2) {
            autoPlayTrackRef.current = false;
            void el.play().catch(() => {});
          }
        }}
        onCanPlay={(e) => {
          const el = e.currentTarget;
          if (
            pendingFileSeekRef.current !== null &&
            pendingFileSeekRef.current >= 0
          ) {
            const dur = Number.isFinite(el.duration) ? el.duration : 0;
            const targetSec =
              dur > 0
                ? Math.min(Math.max(0, dur - 0.5), pendingFileSeekRef.current)
                : pendingFileSeekRef.current;
            el.currentTime = Math.max(0, targetSec);
            setFileCurrentTime(Math.max(0, targetSec));
            pendingFileSeekRef.current = null;
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
                <div className="text-[11px] font-bold truncate flex items-center gap-1.5">
                  {trackingPrefs.liveTracking && fileTrackedSeg && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] font-extrabold shrink-0">
                      LIVE
                    </span>
                  )}
                  <span className="truncate">
                    {activeTrack?.name ?? 'Audiobook'}
                  </span>
                </div>
                <div className={`text-[10px] font-mono ${themeStyle.mutedText}`}>
                  {formatAudioTime(fileCurrentTime)} /{' '}
                  {formatAudioTime(fileDuration)}
                  {trackingPrefs.liveTracking && fileTrackedSeg
                    ? ` • Bab ${fileTrackedSeg.chapterIndex + 1} #${fileTrackedSeg.paraIndex + 1}`
                    : ` (${filePlaybackRate}x)`}
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

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateTrackingPrefs({
                            liveTracking: !trackingPrefs.liveTracking,
                          })
                        }
                        className={`px-2 py-1.5 rounded-xl border text-[10px] font-bold transition cursor-pointer ${
                          trackingPrefs.liveTracking
                            ? 'bg-sky-500/20 border-sky-400/45 text-sky-300'
                            : themeStyle.subtleBtn
                        }`}
                      >
                        Sorot Teks: {trackingPrefs.liveTracking ? 'ON' : 'OFF'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateTrackingPrefs({
                            clickToJump: !trackingPrefs.clickToJump,
                          })
                        }
                        className={`px-2 py-1.5 rounded-xl border text-[10px] font-bold transition cursor-pointer ${
                          trackingPrefs.clickToJump
                            ? 'bg-sky-500/20 border-sky-400/45 text-sky-300'
                            : themeStyle.subtleBtn
                        }`}
                      >
                        Klik Teks: {trackingPrefs.clickToJump ? 'ON' : 'OFF'}
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

                  {/* LIVE TRACKING & KALIBRASI TEKS ↔ AUDIOBOOK */}
                  {activeTrack && (
                    <div className="p-3 rounded-2xl border border-sky-400/25 bg-sky-500/10 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-sky-300 inline-flex items-center gap-1.5">
                          <Radio
                            className={`w-3.5 h-3.5 ${
                              trackingPrefs.liveTracking
                                ? 'text-emerald-400 animate-pulse'
                                : 'opacity-50'
                            }`}
                          />
                          <span>Live Tracking Teks</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-black/30 border border-white/15 text-[10px] font-mono text-emerald-300">
                          {syncLabel}
                        </span>
                      </div>

                      {((trackingPrefs.liveTracking && fileTrackedSeg) ||
                        trackSubtitles.length > 0) && (
                        <div className="text-[11px] font-mono px-2.5 py-1.5 rounded-xl bg-black/25 border border-white/10 space-y-0.5">
                          {trackingPrefs.liveTracking && fileTrackedSeg && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-emerald-300 font-bold truncate">
                                ● Bab {fileTrackedSeg.chapterIndex + 1} • Paragraf #
                                {fileTrackedSeg.paraIndex + 1}
                              </span>
                              <span className="opacity-75 shrink-0 text-[10px]">
                                {activeTimeline.resolvedScope === 'book'
                                  ? 'Seluruh Buku'
                                  : `Bab ${activeTimeline.resolvedChapterIndex + 1}`}
                              </span>
                            </div>
                          )}
                          {activeTimeline.resolvedScope === 'chapter' &&
                            chapterTitles[activeTimeline.resolvedChapterIndex] && (
                              <div className="text-[10px] opacity-70 truncate">
                                Target:{' '}
                                {chapterTitles[activeTimeline.resolvedChapterIndex]}
                              </div>
                            )}
                          {trackSubtitles.length > 0 && (
                            <div
                              className={`text-[10px] truncate ${
                                activeTimeline.subtitleMatchedCount >= 3
                                  ? 'text-emerald-300/90'
                                  : 'text-amber-300/90'
                              }`}
                            >
                              Subtitle: {activeTimeline.subtitleMatchedCount}{' '}
                              paragraf cocok / {trackSubtitles.length} baris
                            </div>
                          )}
                        </div>
                      )}

                      {onToggleFocusMode && (
                        <button
                          type="button"
                          onClick={() => onToggleFocusMode()}
                          className={`w-full py-2 px-2.5 rounded-xl border text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            audioFocusMode
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-sky-500 hover:bg-sky-400 text-slate-950 border-sky-400 shadow-sm'
                          }`}
                        >
                          {audioFocusMode ? (
                            <EyeOff className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>
                            {audioFocusMode
                              ? 'Keluar Layar Fokus Audio'
                              : 'Buka Layar Fokus Audio (Tanpa Scroll)'}
                          </span>
                        </button>
                      )}

                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateTrackingPrefs({
                              liveTracking: !trackingPrefs.liveTracking,
                            })
                          }
                          className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                            trackingPrefs.liveTracking
                              ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          Sorot: {trackingPrefs.liveTracking ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateTrackingPrefs({
                              autoFollow: !trackingPrefs.autoFollow,
                            })
                          }
                          className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                            trackingPrefs.autoFollow
                              ? 'bg-sky-500/20 border-sky-400/45 text-sky-300'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          Ikuti: {trackingPrefs.autoFollow ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateTrackingPrefs({
                              clickToJump: !trackingPrefs.clickToJump,
                            })
                          }
                          className={`py-1.5 px-1.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                            trackingPrefs.clickToJump
                              ? 'bg-sky-500/20 border-sky-400/45 text-sky-300'
                              : themeStyle.subtleBtn
                          }`}
                        >
                          Klik Teks: {trackingPrefs.clickToJump ? 'ON' : 'OFF'}
                        </button>
                      </div>

                      {/* Target Scope & Chapter Picker */}
                      <div className="space-y-1.5">
                        <span className={`block text-[10px] font-bold ${themeStyle.mutedText}`}>
                          Cakupan Audio Track Ini
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              { id: 'auto', label: 'Otomatis' },
                              { id: 'book', label: 'Seluruh Buku' },
                              { id: 'chapter', label: 'Per Bab' },
                            ] as const
                          ).map((sc) => (
                            <button
                              key={sc.id}
                              type="button"
                              onClick={() =>
                                updateSyncConfig((prev) => ({
                                  ...prev,
                                  scope: sc.id,
                                  chapterIndex:
                                    sc.id === 'chapter'
                                      ? activeTimeline.resolvedChapterIndex
                                      : prev.chapterIndex,
                                }))
                              }
                              className={`py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                                syncConfig.scope === sc.id
                                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                                  : themeStyle.subtleBtn
                              }`}
                            >
                              {sc.label}
                            </button>
                          ))}
                        </div>
                        {(syncConfig.scope === 'chapter' ||
                          activeTimeline.resolvedScope === 'chapter') &&
                          chapterTitles.length > 1 && (
                            <select
                              value={activeTimeline.resolvedChapterIndex}
                              onChange={(e) =>
                                updateSyncConfig((prev) => ({
                                  ...prev,
                                  scope: 'chapter',
                                  chapterIndex: Number(e.target.value),
                                }))
                              }
                              title="Pilih Bab EPUB yang sesuai dengan file audio ini"
                              className="w-full px-2 py-1.5 rounded-lg bg-black/30 border border-white/15 text-[11px] font-medium focus:outline-none focus:border-sky-400 cursor-pointer"
                            >
                              {chapterTitles.map((title, idx) => (
                                <option
                                  key={`sync-ch-${idx}`}
                                  value={idx}
                                  className="bg-slate-900 text-white"
                                >
                                  Bab {idx + 1}: {title || `Bagian ${idx + 1}`}
                                </option>
                              ))}
                            </select>
                          )}
                      </div>

                      {/* Fine Offset & Anchor Controls */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-bold ${themeStyle.mutedText}`}>
                            Geser Sinkronisasi (Offset)
                          </span>
                          <span className="font-mono font-bold text-sky-300">
                            {syncConfig.offsetSec >= 0 ? '+' : ''}
                            {syncConfig.offsetSec.toFixed(1)}s
                          </span>
                        </div>
                        <div className="grid grid-cols-6 gap-1">
                          {([-10, -2, -0.5, 0.5, 2, 10] as const).map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => handleAdjustSyncOffset(d)}
                              className={`py-1 rounded-lg text-[10px] font-mono font-bold border cursor-pointer ${themeStyle.subtleBtn}`}
                            >
                              {d > 0 ? `+${d}s` : `${d}s`}
                            </button>
                          ))}
                        </div>
                        <div className={`text-[9.5px] opacity-75 ${themeStyle.mutedText}`}>
                          Teks kecepatan? Tekan (-) • Teks ketinggalan? Tekan (+)
                        </div>
                      </div>

                      {/* Precision & AI Sync Buttons */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={handleCalibrateChapterStart}
                          className={`py-1.5 px-2 rounded-xl border text-[10px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                        >
                          <Crosshair className="w-3 h-3 text-sky-400 shrink-0" />
                          <span>Pas Awal Bab</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => subtitleUploadInputRef.current?.click()}
                          className={`py-1.5 px-2 rounded-xl border text-[10px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${themeStyle.subtleBtn}`}
                        >
                          <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>+ .SRT / .LRC</span>
                        </button>

                        <button
                          type="button"
                          disabled={syncingSpotAudio || syncingAiAudio}
                          onClick={() => void handleSpotSyncNow()}
                          className="col-span-2 py-1.5 px-2.5 rounded-xl border border-cyan-400/45 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100 text-[10.5px] font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {syncingSpotAudio ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          ) : (
                            <AudioLines className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>
                            {syncingSpotAudio
                              ? 'AI Mendengarkan Cuplikan...'
                              : 'AI Dengarkan & Cari Posisi Sekarang'}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={syncingAiAudio || syncingSpotAudio}
                          onClick={() => void handleAiAudioSync()}
                          className="col-span-2 py-1.5 px-2.5 rounded-xl border border-violet-400/40 bg-violet-500/20 hover:bg-violet-500/30 text-violet-100 text-[10px] font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {syncingAiAudio ? (
                            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                          ) : (
                            <Sparkles className="w-3 h-3 shrink-0" />
                          )}
                          <span className="truncate">
                            {syncingAiAudio
                              ? aiSyncProgress || 'AI Sedang Menyinkronkan...'
                              : 'Sinkron Penuh AI (Track Ini)'}
                          </span>
                        </button>
                      </div>

                      {(syncConfig.anchors.length > 0 ||
                        syncConfig.offsetSec !== 0 ||
                        trackSubtitles.length > 0 ||
                        (syncConfig.cues?.length ?? 0) > 0) && (
                        <button
                          type="button"
                          onClick={handleResetSyncConfig}
                          className="w-full py-1 rounded-lg border border-white/10 text-[10px] opacity-75 hover:opacity-100 cursor-pointer"
                        >
                          Reset Kalibrasi &amp; Subtitle Track Ini
                        </button>
                      )}

                      <p className={`text-[10px] leading-relaxed ${themeStyle.mutedText}`}>
                        Klik paragraf mana saja untuk lompat audio. Atau aktifkan tombol <b>Pas Teks</b> (di layar baca) / tahan <b>Shift + Klik</b> tepat pada kata yang sedang terdengar.
                      </p>
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
