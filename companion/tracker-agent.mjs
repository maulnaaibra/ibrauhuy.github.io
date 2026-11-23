import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending-sessions.json');

const PORT = Number(process.env.TRACKER_PORT || 41937);
const HOST = '127.0.0.1';
const DEVICE_NAME = os.hostname();
const STARTED_AT = Date.now();

const DEFAULT_RULES = [
  {
    id: 'rule-fushi',
    name: 'Fushi / Hoshi Reader (Immersion Suite)',
    enabled: true,
    matchType: 'process',
    pattern: '^fushi$',
    category: 'light_novel',
  },
  {
    id: 'rule-mpv-vlc',
    name: 'Video Player (MPV / VLC / PotPlayer / MPC)',
    enabled: true,
    matchType: 'process',
    pattern: '^(mpv|vlc|potplayer|potplayer64|potplayermini64|mpc-hc|mpc-hc64|mpc-be|mpc-be64|kmplayer|gom)$',
    category: 'anime',
  },
  {
    id: 'rule-anime-sites',
    name: 'Streaming Anime (Bettermelon / Animelon / Netflix / Crunchyroll / Muse)',
    enabled: true,
    matchType: 'title',
    pattern: 'bettermelon|animelon|crunchyroll|netflix|muse indonesia|ani-one|bilibili.*anime|hianime|aniwatch|9anime|gogoanime|miruro|animepahe|nyaa|asbplayer|anime',
    category: 'anime',
  },
  {
    id: 'rule-ln',
    name: 'Light Novel & Web Novel (Yatsu Reader / Epub.moe / Ttsu / Syosetsu / Kakuyomu)',
    enabled: true,
    matchType: 'title',
    pattern: 'yatsu\\.moe|app\\.yatsu|yatsu|epub\\.moe|reader\\.epub|ttsu|📘|syosetu|syosetsu|小説家になろう|カクヨム|kakuyomu|青空文庫|aozora|bookwalker|honto|kindle|calibre|koodo|thorium|foliate|hoshi reader|light novel|web novel',
    category: 'light_novel',
  },
  {
    id: 'rule-drama-tv',
    name: 'Drama & TV Jepang (Cinejoy / MyDramaList / TVer / Abema / NHK)',
    enabled: true,
    matchType: 'title',
    pattern: 'cinejoy|mydramalist|tver|abema|nhkプラス|nhk world|jdrama|dorama|paravi|u-next',
    category: 'video',
  },
  {
    id: 'rule-youtube-video',
    name: 'Video Online (YouTube / Niconico / Bilibili / Twitch / VTuber)',
    enabled: true,
    matchType: 'title',
    pattern: 'youtube|niconico|ニコニコ|bilibili|twitch|holodex|hololive|nijisanji|実況',
    category: 'video',
  },
  {
    id: 'rule-anki',
    name: 'Anki Flashcards & Mining',
    enabled: true,
    matchType: 'process',
    pattern: '^anki$',
    category: 'study',
  },
  {
    id: 'rule-study-sites',
    name: 'SRS & Kamus Jepang (JPDB / WaniKani / Bunpro / Jisho / Renshuu)',
    enabled: true,
    matchType: 'title',
    pattern: 'jpdb\\.io|jpdb|wanikani|bunpro|renshuu|jisho\\.org|jisho|weblio|kotobank|goo辞書|takoboto|marumori|satori reader|nhk news web easy|やさしいことばニュース',
    category: 'study',
  },
  {
    id: 'rule-manga',
    name: 'Manga Reader (MangaDex / Rawkuma / Mokuro / Comick / Mihon)',
    enabled: true,
    matchType: 'title',
    pattern: 'mangadex|rawkuma|mokuro|comick|mangaplus|shonenjump|comic-walker|カドコミ|tonarinoyj|少年ジャンプ|cmoa|manga|マンガ|漫画|tachiyomi|mihon|suwayomi|houdoku|yomikiru',
    category: 'manga',
  },
  {
    id: 'rule-vn-process',
    name: 'Aplikasi Texthooker & Emulator Game Jepang',
    enabled: true,
    matchType: 'process',
    pattern: '^(textractor|lunatranslator|agent|chiitranslite|vnr|yuzu|ryujinx|ppssppwindows64|ppsspp|pcsx2|pcsx2-qt|rpcs3|citra-qt|dolphin|retroarch)$',
    category: 'visual_novel',
  },
  {
    id: 'rule-vn',
    name: 'Visual Novel & Game (VNDB / Textractor / LunaTranslator / Steam VN)',
    enabled: true,
    matchType: 'title',
    pattern: 'textractor|lunatranslator|texthooker|visual novel|vndb|vnreader|steins;gate|clannad|fate/stay|tsukihime|umineko|higurashi|subahibi|white album|muramasa|baldr sky|aokana|yuzusoft|kirikiri|siglus|renpy|backloggd',
    category: 'visual_novel',
  },
  {
    id: 'rule-book',
    name: 'Pembaca Buku PDF / EPUB (SumatraPDF / Calibre / Kindle)',
    enabled: true,
    matchType: 'process',
    pattern: '^(sumatrapdf|ebook-viewer|calibre|kindle|thorium|koodo-reader)$',
    category: 'book',
  },
  {
    id: 'rule-audio-process',
    name: 'Aplikasi Audio & Podcast (Spotify / Foobar2000 / MusicBee)',
    enabled: true,
    matchType: 'process',
    pattern: '^(spotify|foobar2000|musicbee|aimp)$',
    category: 'audio',
  },
  {
    id: 'rule-audio',
    name: 'Podcast & Audio Jepang (Spotify / Teppei / Sakura Tips / Audible)',
    enabled: true,
    matchType: 'title',
    pattern: 'podcast|teppei|sakura tips|yuyuの日本語|audible|radiko|spotify|soundcloud',
    category: 'audio',
  },
  {
    id: 'rule-jp-script',
    name: 'Jendela Berjudul Bahasa Jepang (Kanji / Hiragana / Katakana)',
    enabled: false,
    matchType: 'title',
    pattern: '[\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF]{2,}',
    category: 'study',
  },
];

const DEFAULT_CONFIG = {
  idleThresholdSeconds: 1800,
  minSessionMinutes: 1,
  inactivityCommitSeconds: 60,
  trackBackgroundWindows: true,
  disabledProcesses: [],
  rules: DEFAULT_RULES,
};

fs.mkdirSync(DATA_DIR, { recursive: true });

function readJsonSafe(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {
    // ignore corrupt cache
  }
  return fallback;
}

function writeJsonSafe(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function upgradeAndMergeConfig(loaded) {
  if (!loaded || !Array.isArray(loaded.rules)) {
    return structuredClone(DEFAULT_CONFIG);
  }

  const byId = new Map();
  for (const r of loaded.rules) {
    if (r && r.id) byId.set(r.id, r);
  }
  // Ensure all default rules exist and upgrade outdated default patterns
  const mergedRules = [];
  const seenIds = new Set();
  for (const defRule of DEFAULT_RULES) {
    const existing = byId.get(defRule.id);
    if (existing) {
      mergedRules.push({
        ...defRule,
        enabled: typeof existing.enabled === 'boolean' ? existing.enabled : true,
      });
    } else {
      mergedRules.push(structuredClone(defRule));
    }
    seenIds.add(defRule.id);
  }
  // Preserve custom user-added rules
  for (const r of loaded.rules) {
    if (r && r.id && !seenIds.has(r.id)) {
      mergedRules.push(r);
    }
  }

  // Upgrade old 180s idle threshold that prematurely paused video watching
  const rawIdle = Number(loaded.idleThresholdSeconds || 1800);
  const idleThresholdSeconds = rawIdle <= 180 ? 1800 : Math.max(60, rawIdle);

  return {
    idleThresholdSeconds,
    minSessionMinutes: Math.max(1, Number(loaded.minSessionMinutes || 1)),
    inactivityCommitSeconds: Math.max(20, Number(loaded.inactivityCommitSeconds || 60)),
    trackBackgroundWindows:
      typeof loaded.trackBackgroundWindows === 'boolean'
        ? loaded.trackBackgroundWindows
        : true,
    disabledProcesses: Array.isArray(loaded.disabledProcesses)
      ? loaded.disabledProcesses.map((p) => String(p).toLowerCase())
      : [],
    rules: mergedRules,
  };
}

let config = upgradeAndMergeConfig(readJsonSafe(RULES_FILE, null));
writeJsonSafe(RULES_FILE, config);

let pendingSessions = readJsonSafe(PENDING_FILE, []);
if (!Array.isArray(pendingSessions)) {
  pendingSessions = [];
}
const inFlightClaims = new Map(); // claimId -> { sessions, expiresAt }
const CLAIM_TTL_MS = 30000;

function reclaimExpiredClaims(forceAll = false) {
  const now = Date.now();
  let changed = false;
  for (const [claimId, entry] of inFlightClaims.entries()) {
    if (forceAll || entry.expiresAt <= now) {
      inFlightClaims.delete(claimId);
      if (Array.isArray(entry.sessions) && entry.sessions.length > 0) {
        const existingIds = new Set(pendingSessions.map((p) => p.id));
        for (const s of entry.sessions) {
          if (!existingIds.has(s.id)) {
            pendingSessions.push(s);
            existingIds.add(s.id);
          }
        }
        changed = true;
      }
    }
  }
  if (changed) {
    writeJsonSafe(PENDING_FILE, pendingSessions);
  }
}

const PASSIVE_MEDIA_CATEGORIES = new Set(['anime', 'video', 'movie', 'audio']);

let trackingEnabled = true;
let lastWindow = {
  process: '',
  title: '',
  foregroundProcess: '',
  foregroundTitle: '',
  idleSeconds: 0,
  matchedRule: null,
  trackingSource: 'none',
  timestamp: new Date().toISOString(),
};
let openWindows = [];
let activeSession = null;
let pinnedTarget = null; // { process, title, category, ruleName }
let catalogHint = null; // { title, category, url, expiresAt }
let lastFocusedImmersionKey = null; // "process::category"
let awaySeconds = 0;
let lastSampleTime = Date.now();

const GENERIC_SUBWINDOW_TITLES = new Set([
  'add',
  'browse',
  'preview',
  'edit current',
  'statistics',
  'preferences',
  'new tab',
  'tab baru',
  'untitled',
  'fushi',
  'anki',
]);

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isTrackerDashboardWindow(title) {
  const t = String(title || '').toLowerCase();
  return (
    t.includes('immersiontrack') ||
    t.includes('nihongotracker') ||
    t.includes('pelacak progres immersion')
  );
}

function cleanDisplayTitle(rawTitle, processName, fallbackName) {
  const cleaned = String(rawTitle || '')
    .replace(
      /\s+[-—|]\s+(Google Chrome|Microsoft​? Edge|Mozilla Firefox|Brave|Opera|Vivaldi|Arc|VLC media player|mpv|YouTube|Netflix|Crunchyroll|Bettermelon|MangaDex)$/i,
      ''
    )
    .replace(
      /\s+[-—|]\s+(Google Chrome|Microsoft​? Edge|Mozilla Firefox|Brave|Opera)$/i,
      ''
    )
    .replace(/^\(\d+\)\s+/, '')
    .trim();

  if (!cleaned) {
    return fallbackName || processName || 'Sesi Immersion';
  }
  if (cleaned.toLowerCase() === 'fushi') {
    return 'Fushi (Hoshi Reader / Immersion)';
  }
  if (/^user \d+ - anki$/i.test(cleaned)) {
    return 'Anki SRS & Mining';
  }
  return cleaned;
}

function isGenericTitle(title) {
  const lower = String(title || '').trim().toLowerCase();
  if (!lower || lower.length <= 3) return true;
  if (GENERIC_SUBWINDOW_TITLES.has(lower)) return true;
  if (/^browse\s*\(/i.test(lower)) return true;
  return false;
}

function isProcessDisabled(processName) {
  if (!processName) return false;
  const list = Array.isArray(config.disabledProcesses)
    ? config.disabledProcesses
    : [];
  return list.includes(String(processName).toLowerCase());
}

function matchWindowRule(processName, windowTitle) {
  if (!processName && !windowTitle) return null;
  if (isTrackerDashboardWindow(windowTitle)) return null;
  if (isProcessDisabled(processName)) return null;

  for (const rule of config.rules) {
    if (!rule.enabled || !rule.pattern) continue;
    try {
      const regex = new RegExp(rule.pattern, 'i');
      const target = rule.matchType === 'process' ? processName : windowTitle;
      if (regex.test(target || '')) {
        return rule;
      }
    } catch {
      // skip invalid user regex
    }
  }
  return null;
}

function enqueuePendingMinutes(sessionObj, durationMinutes) {
  const safeMinutes = Math.min(60, Math.max(0, Math.round(Number(durationMinutes || 0))));
  if (!sessionObj || safeMinutes <= 0) return null;
  const now = new Date();
  const todayStr = getLocalDateString(now);

  const existingIdx = pendingSessions.findIndex(
    (p) =>
      p.logged_date === todayStr &&
      p.category === sessionObj.category &&
      p.title === sessionObj.title
  );

  let committed = null;
  if (existingIdx >= 0) {
    // Keep existing id immutable so parallel claim/ack calls never lose or duplicate IDs
    pendingSessions[existingIdx].duration_minutes += safeMinutes;
    pendingSessions[existingIdx].created_at = now.toISOString();
    committed = pendingSessions[existingIdx];
  } else {
    committed = {
      id: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: sessionObj.title,
      category: sessionObj.category,
      duration_minutes: safeMinutes,
      cards_mined: 0,
      notes: `Auto-tracked dari ${DEVICE_NAME} (${sessionObj.process || 'Windows'})`,
      logged_date: todayStr,
      created_at: now.toISOString(),
      source_device: DEVICE_NAME,
    };
    pendingSessions.push(committed);
  }

  writeJsonSafe(PENDING_FILE, pendingSessions);
  console.log(
    `[Checkpoint] +${safeMinutes}m | ${committed.category} | ${committed.title}`
  );
  return committed;
}

function commitActiveSession(force = false) {
  if (!activeSession) return null;

  const uncommitted = Number(
    activeSession.uncommittedSeconds ?? activeSession.activeSeconds ?? 0
  );
  const alreadyCheckpointed = Number(activeSession.checkpointedMinutes ?? 0);

  let extraMinutes = 0;
  if (force) {
    if (alreadyCheckpointed === 0 && uncommitted >= 1) {
      extraMinutes = Math.max(1, Math.round(uncommitted / 60));
    } else if (uncommitted >= 15) {
      extraMinutes = Math.max(1, Math.round(uncommitted / 60));
    }
  } else {
    if (alreadyCheckpointed === 0 && uncommitted >= 15) {
      extraMinutes = Math.max(1, Math.round(uncommitted / 60));
    } else if (uncommitted >= 30) {
      extraMinutes = Math.max(1, Math.round(uncommitted / 60));
    }
  }

  let committed = null;
  if (extraMinutes > 0) {
    committed = enqueuePendingMinutes(activeSession, extraMinutes);
  }

  activeSession = null;
  awaySeconds = 0;
  return committed;
}

function selectTargetWindow(fgProc, fgTitle, rawOpenWindows) {
  // Annotate all open windows with rule match info
  const annotated = [];
  for (const w of rawOpenWindows) {
    const proc = String(w.process || '');
    const title = String(w.title || '');
    const procDisabled = isProcessDisabled(proc);
    const rule = matchWindowRule(proc, title);
    annotated.push({
      hwnd: Number(w.hwnd || 0),
      pid: Number(w.pid || 0),
      process: proc,
      title,
      isForeground: Boolean(w.isForeground),
      isMinimized: Boolean(w.isMinimized),
      processDisabled: procDisabled,
      appEnabled: !procDisabled && Boolean(rule),
      matchedRule: rule ? rule.name : null,
      matchedCategory: rule ? rule.category : null,
      _rule: rule,
    });
  }

  // 1. Check if a manual pinned target matches any open window
  if (pinnedTarget) {
    const matchPinned = annotated.find(
      (w) =>
        (pinnedTarget.hwnd && w.hwnd === pinnedTarget.hwnd) ||
        (pinnedTarget.process &&
          w.process.toLowerCase() === pinnedTarget.process.toLowerCase())
    );
    if (matchPinned) {
      return {
        targetProc: matchPinned.process,
        targetTitle:
          pinnedTarget.customTitle || matchPinned.title || pinnedTarget.title,
        rule: {
          id: 'rule-pinned-manual',
          name: pinnedTarget.ruleName || 'Dikunci Manual dari Dashboard',
          category:
            pinnedTarget.category || matchPinned.matchedCategory || 'study',
        },
        source: 'pinned',
        annotated,
      };
    }
    // If pinned from catalog hint and still valid
    if (pinnedTarget.fromCatalog) {
      return {
        targetProc: pinnedTarget.process || fgProc || 'browser',
        targetTitle: pinnedTarget.title,
        rule: {
          id: 'rule-catalog-launch',
          name: 'Katalog Media (Direct Track)',
          category: pinnedTarget.category || 'anime',
        },
        source: 'catalog',
        annotated,
      };
    }
  }

  // 2. Check if the foreground window itself matches an immersion rule
  if (fgTitle.trim().toLowerCase() !== 'fushi lookup') {
    const fgRule = matchWindowRule(fgProc, fgTitle);
    if (fgRule) {
      lastFocusedImmersionKey = `${fgProc.toLowerCase()}::${fgRule.category}`;
      return {
        targetProc: fgProc,
        targetTitle: fgTitle,
        rule: fgRule,
        source: 'foreground',
        annotated,
      };
    }
  }

  // 3. Background window detection (strictly ignore minimized windows; non-passive study/reading apps only continue if viewing dashboard)
  if (config.trackBackgroundWindows !== false) {
    const viewingDashboard = isTrackerDashboardWindow(fgTitle);
    const nonMinimized = annotated.filter(
      (w) =>
        w._rule !== null &&
        !w.isMinimized &&
        w.title.trim().toLowerCase() !== 'fushi lookup'
    );

    // If user is simply checking the ImmersionTrack dashboard, preserve their most recently focused active app
    if (viewingDashboard && lastFocusedImmersionKey) {
      const recentMatch = nonMinimized.find(
        (w) =>
          `${w.process.toLowerCase()}::${w._rule.category}` ===
          lastFocusedImmersionKey
      );
      if (recentMatch) {
        return {
          targetProc: recentMatch.process,
          targetTitle: recentMatch.title,
          rule: recentMatch._rule,
          source: 'background',
          annotated,
        };
      }
    }

    // Outside the dashboard, only allow genuine passive media (anime/video/movie/audio) in background
    // Never ghost-track Anki, SRS, novel/manga readers, or VN windows while user works in unrelated apps
    const passiveBackground = nonMinimized.filter((w) =>
      PASSIVE_MEDIA_CATEGORIES.has(w._rule.category)
    );
    if (passiveBackground.length > 0) {
      let chosen = null;
      if (lastFocusedImmersionKey) {
        chosen = passiveBackground.find(
          (w) =>
            `${w.process.toLowerCase()}::${w._rule.category}` ===
            lastFocusedImmersionKey
        );
      }
      if (!chosen) {
        chosen = passiveBackground.find((w) =>
          /^(mpv|vlc|potplayer|potplayer64|potplayermini64|mpc-hc|mpc-hc64|mpc-be|mpc-be64|spotify|foobar2000|musicbee)$/i.test(
            w.process
          )
        );
      }
      if (!chosen) {
        chosen = passiveBackground[0];
      }

      return {
        targetProc: chosen.process,
        targetTitle: chosen.title,
        rule: chosen._rule,
        source: 'background',
        annotated,
      };
    }
  }

  return {
    targetProc: fgProc,
    targetTitle: fgTitle,
    rule: null,
    source: 'none',
    annotated,
  };
}

function handleWindowSample(sample) {
  const now = Date.now();
  const deltaSec = Math.min(
    5,
    Math.max(1, Math.round((now - lastSampleTime) / 1000))
  );
  lastSampleTime = now;

  const fgProc = String(sample.process || '');
  const fgTitle = String(sample.title || '');
  const idle = Number(sample.idleSeconds || 0);
  const rawOpen = Array.isArray(sample.openWindows) ? sample.openWindows : [];

  const { targetProc, targetTitle, rule, source, annotated } = trackingEnabled
    ? selectTargetWindow(fgProc, fgTitle, rawOpen)
    : {
        targetProc: fgProc,
        targetTitle: fgTitle,
        rule: null,
        source: 'none',
        annotated: rawOpen.map((w) => ({
          hwnd: Number(w.hwnd || 0),
          pid: Number(w.pid || 0),
          process: String(w.process || ''),
          title: String(w.title || ''),
          isForeground: Boolean(w.isForeground),
          matchedRule: null,
          matchedCategory: null,
        })),
      };

  openWindows = annotated.map(({ _rule, ...rest }) => ({
    ...rest,
    isTracked:
      Boolean(rule) &&
      rest.process === targetProc &&
      rest.title === targetTitle,
  }));

  lastWindow = {
    process: targetProc || fgProc,
    title: targetTitle || fgTitle,
    foregroundProcess: fgProc,
    foregroundTitle: fgTitle,
    idleSeconds: idle,
    matchedRule: rule ? rule.name : null,
    trackingSource: source,
    timestamp: new Date(now).toISOString(),
  };

  const idleLimit = Number(config.idleThresholdSeconds || 1800);
  // Strict idle limits for active study/reading vs passive media viewing
  let effectiveIdleLimit = idleLimit;
  if (source === 'pinned' || source === 'catalog') {
    effectiveIdleLimit = Math.max(idleLimit, 5400);
  } else if (rule?.category === 'study') {
    effectiveIdleLimit = Math.min(idleLimit, 180);
  } else if (
    rule?.category &&
    ['manga', 'light_novel', 'book', 'visual_novel'].includes(rule.category)
  ) {
    effectiveIdleLimit = Math.min(idleLimit, 300);
  }
  const isIdle = idle >= effectiveIdleLimit;

  if (!trackingEnabled || isIdle || !rule) {
    // If user is simply checking the ImmersionTrack dashboard tab, don't kill the active session!
    if (
      activeSession &&
      trackingEnabled &&
      !isIdle &&
      isTrackerDashboardWindow(fgTitle)
    ) {
      return;
    }

    if (activeSession) {
      awaySeconds += deltaSec;
      if (awaySeconds >= Number(config.inactivityCommitSeconds || 60)) {
        commitActiveSession(false);
      }
    }
    return;
  }

  awaySeconds = 0;

  // Apply catalog hint title if it matches the active category and hasn't expired
  let displayTitle = cleanDisplayTitle(targetTitle, targetProc, rule.name);
  if (
    catalogHint &&
    catalogHint.expiresAt > now &&
    (catalogHint.category === rule.category || source === 'catalog')
  ) {
    displayTitle = catalogHint.title;
  }

  // Continue existing session if same category & same process/rule (prevents session loss on sub-window/chapter changes)
  if (
    activeSession &&
    activeSession.category === rule.category &&
    (activeSession.title === displayTitle ||
      activeSession.process.toLowerCase() === targetProc.toLowerCase() ||
      activeSession.ruleId === rule.id)
  ) {
    activeSession.activeSeconds += deltaSec;
    activeSession.uncommittedSeconds =
      (activeSession.uncommittedSeconds ?? 0) + deltaSec;
    activeSession.lastSeenAt = new Date(now).toISOString();
    activeSession.trackingSource = source;
    if (!isGenericTitle(displayTitle) && isGenericTitle(activeSession.title)) {
      activeSession.title = displayTitle;
    } else if (
      !isGenericTitle(displayTitle) &&
      activeSession.process.toLowerCase() !== 'anki'
    ) {
      activeSession.title = displayTitle;
    }

    // Auto-checkpoint every 60 seconds so dashboard logs update live without waiting for app close!
    if (activeSession.uncommittedSeconds >= 60) {
      const minsToCheckpoint = Math.floor(
        activeSession.uncommittedSeconds / 60
      );
      activeSession.uncommittedSeconds =
        activeSession.uncommittedSeconds % 60;
      activeSession.checkpointedMinutes =
        (activeSession.checkpointedMinutes ?? 0) + minsToCheckpoint;
      enqueuePendingMinutes(activeSession, minsToCheckpoint);
    }
    return;
  }

  if (activeSession) {
    commitActiveSession(false);
  }

  activeSession = {
    title: displayTitle,
    category: rule.category,
    process: targetProc,
    ruleId: rule.id,
    ruleName: rule.name,
    trackingSource: source,
    startedAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    activeSeconds: deltaSec,
    uncommittedSeconds: deltaSec,
    checkpointedMinutes: 0,
  };
}

function startWindowsWatcher() {
  if (process.platform !== 'win32') {
    console.warn('Watcher Win32 hanya berjalan di Windows.');
    return null;
  }

  const psScript = `
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$code = @"
using System;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinInfo {
  public long hwnd;
  public uint pid;
  public string process;
  public string title;
  public bool isForeground;
  public bool isMinimized;
}

public class SnapInfo {
  public string process;
  public string title;
  public uint idleSeconds;
  public List<WinInfo> openWindows;
}

public static class Win32Tracker {
  [DllImport("user32.dll")]
  private static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

  [DllImport("user32.dll")]
  private static extern bool SetThreadDesktop(IntPtr hDesktop);

  [DllImport("user32.dll")]
  private static extern bool CloseDesktop(IntPtr hDesktop);

  [DllImport("user32.dll")]
  private static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  private static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  private static extern bool IsIconic(IntPtr hWnd);

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  private static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  private struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
  }

  [DllImport("user32.dll")]
  private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

  private static string SafeGetProcessName(uint pid) {
    if (pid == 0) return "";
    try {
      return Process.GetProcessById((int)pid).ProcessName;
    } catch {
      return "";
    }
  }

  public static SnapInfo GetSnapshot() {
    SnapInfo snapshot = null;
    Thread worker = new Thread(() => {
      IntPtr desk = OpenInputDesktop(0, false, 0x01FF);
      if (desk == IntPtr.Zero) {
        desk = OpenDesktop("Default", 0, false, 0x01FF);
      }
      if (desk != IntPtr.Zero) {
        SetThreadDesktop(desk);
      }

      IntPtr fg = GetForegroundWindow();
      StringBuilder fgSb = new StringBuilder(512);
      if (fg != IntPtr.Zero) {
        GetWindowText(fg, fgSb, fgSb.Capacity);
      }

      uint fgPid = 0;
      if (fg != IntPtr.Zero) {
        GetWindowThreadProcessId(fg, out fgPid);
      }
      string fgProc = SafeGetProcessName(fgPid);
      string fgTitle = fgSb.ToString().Trim();

      var openList = new List<WinInfo>();
      EnumDesktopWindows(desk, (hWnd, lParam) => {
        if (!IsWindowVisible(hWnd)) return true;
        StringBuilder sb = new StringBuilder(512);
        int len = GetWindowText(hWnd, sb, sb.Capacity);
        if (len <= 0) return true;
        string wTitle = sb.ToString().Trim();
        if (string.IsNullOrEmpty(wTitle)) return true;
        if (
          wTitle == "Program Manager" ||
          wTitle == "Windows Input Experience" ||
          wTitle == "Default IME" ||
          wTitle == "MSCTFIME UI" ||
          wTitle == "NVIDIA GeForce Overlay" ||
          wTitle == "Fushi Floating Ball" ||
          wTitle == "Nahimic" ||
          wTitle.StartsWith("data:text/html")
        ) {
          return true;
        }

        uint wPid = 0;
        GetWindowThreadProcessId(hWnd, out wPid);
        string wProc = SafeGetProcessName(wPid);
        if (string.IsNullOrEmpty(wProc)) return true;

        var info = new WinInfo();
        info.hwnd = hWnd.ToInt64();
        info.pid = wPid;
        info.process = wProc;
        info.title = wTitle;
        info.isForeground = (hWnd == fg);
        info.isMinimized = IsIconic(hWnd);
        openList.Add(info);
        return true;
      }, IntPtr.Zero);

      if (fg == IntPtr.Zero && openList.Count > 0) {
        fgProc = openList[0].process;
        fgTitle = openList[0].title;
      }

      LASTINPUTINFO lii = new LASTINPUTINFO();
      lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
      uint idleSec = 0;
      if (GetLastInputInfo(ref lii)) {
        uint elapsedMs = unchecked((uint)Environment.TickCount - lii.dwTime);
        idleSec = elapsedMs / 1000;
      }

      if (desk != IntPtr.Zero) {
        CloseDesktop(desk);
      }

      var s = new SnapInfo();
      s.process = fgProc;
      s.title = fgTitle;
      s.idleSeconds = idleSec;
      s.openWindows = openList;
      snapshot = s;
    });
    worker.Start();
    worker.Join(1500);
    return snapshot;
  }
}
"@
Add-Type -TypeDefinition $code -Language CSharp
while ($true) {
  try {
    $snap = [Win32Tracker]::GetSnapshot()
    if ($null -ne $snap) {
      [Console]::WriteLine(($snap | ConvertTo-Json -Compress -Depth 4))
    }
  } catch {}
  Start-Sleep -Seconds 2
}
`;

  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encoded,
    ],
    { windowsHide: true }
  );

  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) continue;
      try {
        handleWindowSample(JSON.parse(trimmed));
      } catch {
        // ignore partial line
      }
    }
  });

  child.stderr.on('data', (err) => {
    const msg = err.toString('utf8').trim();
    if (!msg || msg.startsWith('#< CLIXML') || msg.startsWith('<Objs ')) return;
    console.error('[Watcher Error]', msg);
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[Watcher Exited] code=${code}, restarting in 3s...`);
      setTimeout(() => {
        watcher = startWindowsWatcher();
      }, 3000);
    }
  });

  return child;
}

function getCorsHeaders(req) {
  const origin = req?.headers?.origin || '*';
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      req?.headers?.['access-control-request-headers'] ||
      'Content-Type, X-Anki-Url',
    'Access-Control-Allow-Private-Network': 'true',
  };
}

function sendJson(req, res, statusCode, data) {
  res.writeHead(statusCode, getCorsHeaders(req));
  res.end(JSON.stringify(data));
}

function readRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

function resolveAnkiUrl(headerVal) {
  const fallback = 'http://127.0.0.1:8765';
  if (!headerVal) return fallback;
  try {
    const parsed = new URL(String(headerVal));
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
    ) {
      return parsed.toString();
    }
  } catch {
    // fallback
  }
  return fallback;
}

function proxyToAnki(req, targetUrl, bodyStr, res) {
  const parsed = new URL(targetUrl);
  const proxyReq = http.request(
    {
      hostname: parsed.hostname,
      port: Number(parsed.port || 8765),
      path: parsed.pathname || '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr, 'utf8'),
      },
      timeout: 12000,
    },
    (proxyRes) => {
      let data = '';
      proxyRes.on('data', (chunk) => {
        data += chunk.toString('utf8');
      });
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode || 200, getCorsHeaders(req));
        res.end(data);
      });
    }
  );

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    sendJson(req, res, 504, {
      result: null,
      error: 'Koneksi ke AnkiConnect timeout',
    });
  });

  proxyReq.on('error', () => {
    sendJson(req, res, 502, {
      result: null,
      error: 'Anki / AnkiConnect tidak merespons di port tersebut',
    });
  });

  proxyReq.write(bodyStr);
  proxyReq.end();
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, getCorsHeaders(req));
    res.end();
    return;
  }

  const reqPath = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && reqPath === '/health') {
    reclaimExpiredClaims();
    sendJson(req, res, 200, {
      ok: true,
      version: '2.1.0',
      deviceName: DEVICE_NAME,
      platform: process.platform,
      trackingEnabled,
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      pendingCount: pendingSessions.length,
    });
    return;
  }

  if (req.method === 'GET' && reqPath === '/status') {
    reclaimExpiredClaims();
    sendJson(req, res, 200, {
      ok: true,
      version: '2.1.0',
      deviceName: DEVICE_NAME,
      trackingEnabled,
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      config,
      lastWindow,
      openWindows,
      pinnedTarget,
      activeSession,
      pendingCount: pendingSessions.length,
      pending: pendingSessions,
    });
    return;
  }

  if (req.method === 'POST' && reqPath === '/toggle') {
    const raw = await readRequestBody(req);
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = {};
    }
    trackingEnabled =
      typeof parsed.enabled === 'boolean' ? parsed.enabled : !trackingEnabled;
    if (!trackingEnabled && activeSession) {
      commitActiveSession(false);
    }
    sendJson(req, res, 200, { ok: true, trackingEnabled });
    return;
  }

  if (req.method === 'POST' && reqPath === '/pin-window') {
    const raw = await readRequestBody(req);
    try {
      const parsed = JSON.parse(raw || '{}');
      if (parsed.clear) {
        pinnedTarget = null;
        catalogHint = null;
        sendJson(req, res, 200, { ok: true, pinnedTarget: null });
        return;
      }

      const proc = String(parsed.process || '').trim();
      const rawTitle = String(parsed.title || proc || 'Sesi Immersion').trim();
      const cat = String(parsed.category || 'study').trim();
      const display = cleanDisplayTitle(rawTitle, proc, rawTitle);

      pinnedTarget = {
        hwnd: Number(parsed.hwnd || 0) || undefined,
        process: proc,
        title: rawTitle,
        customTitle: parsed.customTitle ? String(parsed.customTitle).trim() : display,
        category: cat,
        ruleName: `Pinned: ${proc || display}`,
        fromCatalog: Boolean(parsed.fromCatalog),
      };

      // Switch or start active session immediately so user sees instant recording
      if (
        activeSession &&
        (activeSession.category !== cat || activeSession.title !== display)
      ) {
        commitActiveSession(false);
      }

      trackingEnabled = true;
      if (!activeSession) {
        const nowIso = new Date().toISOString();
        activeSession = {
          title: pinnedTarget.customTitle || display,
          category: cat,
          process: proc || 'Windows',
          ruleId: 'rule-pinned-manual',
          ruleName: pinnedTarget.ruleName,
          trackingSource: parsed.fromCatalog ? 'catalog' : 'pinned',
          startedAt: nowIso,
          lastSeenAt: nowIso,
          activeSeconds: 1,
          uncommittedSeconds: 1,
          checkpointedMinutes: 0,
        };
      }

      sendJson(req, res, 200, {
        ok: true,
        pinnedTarget,
        activeSession,
      });
    } catch {
      sendJson(req, res, 400, { ok: false, error: 'Payload tidak valid' });
    }
    return;
  }

  if (req.method === 'POST' && reqPath === '/hint') {
    const raw = await readRequestBody(req);
    try {
      const parsed = JSON.parse(raw || '{}');
      const title = String(parsed.title || '').trim();
      const category = String(parsed.category || 'anime').trim();
      if (!title) {
        sendJson(req, res, 400, { ok: false, error: 'Judul diperlukan' });
        return;
      }

      catalogHint = {
        title,
        category,
        url: String(parsed.url || ''),
        expiresAt: Date.now() + 2 * 3600 * 1000,
      };

      pinnedTarget = {
        process: '',
        title,
        customTitle: title,
        category,
        ruleName: 'Katalog Media (Direct Track)',
        fromCatalog: true,
      };

      if (
        activeSession &&
        (activeSession.title !== title || activeSession.category !== category)
      ) {
        commitActiveSession(false);
      }

      trackingEnabled = true;
      if (!activeSession) {
        const nowIso = new Date().toISOString();
        activeSession = {
          title,
          category,
          process: 'Browser (Katalog)',
          ruleId: 'rule-catalog-launch',
          ruleName: 'Katalog Media (Direct Track)',
          trackingSource: 'catalog',
          startedAt: nowIso,
          lastSeenAt: nowIso,
          activeSeconds: 1,
          uncommittedSeconds: 1,
          checkpointedMinutes: 0,
        };
      }

      sendJson(req, res, 200, {
        ok: true,
        catalogHint,
        activeSession,
      });
    } catch {
      sendJson(req, res, 400, { ok: false, error: 'Payload tidak valid' });
    }
    return;
  }

  if (req.method === 'POST' && reqPath === '/flush') {
    const committed = commitActiveSession(true);
    pinnedTarget = null;
    catalogHint = null;
    sendJson(req, res, 200, {
      ok: true,
      committed,
      pending: pendingSessions,
    });
    return;
  }

  if (req.method === 'GET' && reqPath === '/pending') {
    reclaimExpiredClaims();
    sendJson(req, res, 200, { ok: true, pending: pendingSessions });
    return;
  }

  if (req.method === 'POST' && reqPath === '/claim') {
    reclaimExpiredClaims();
    if (pendingSessions.length === 0) {
      sendJson(req, res, 200, { ok: true, claimId: null, sessions: [] });
      return;
    }
    const sessions = pendingSessions.slice();
    pendingSessions = [];
    writeJsonSafe(PENDING_FILE, pendingSessions);
    const claimId = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    inFlightClaims.set(claimId, {
      sessions,
      expiresAt: Date.now() + CLAIM_TTL_MS,
    });
    sendJson(req, res, 200, { ok: true, claimId, sessions });
    return;
  }

  if (req.method === 'POST' && reqPath === '/ack') {
    const raw = await readRequestBody(req);
    let ids = [];
    let claimId = null;
    try {
      const parsed = JSON.parse(raw || '{}');
      if (Array.isArray(parsed.ids)) ids = parsed.ids;
      if (typeof parsed.claimId === 'string' && parsed.claimId) {
        claimId = parsed.claimId;
      }
    } catch {
      ids = [];
    }
    const ackSet = new Set(ids);

    if (claimId && inFlightClaims.has(claimId)) {
      const claim = inFlightClaims.get(claimId);
      inFlightClaims.delete(claimId);
      const unacked = (claim?.sessions ?? []).filter((s) => !ackSet.has(s.id));
      if (unacked.length > 0) {
        const existingIds = new Set(pendingSessions.map((p) => p.id));
        for (const s of unacked) {
          if (!existingIds.has(s.id)) {
            pendingSessions.push(s);
          }
        }
      }
    }

    pendingSessions = pendingSessions.filter((s) => !ackSet.has(s.id));
    writeJsonSafe(PENDING_FILE, pendingSessions);
    sendJson(req, res, 200, { ok: true, remaining: pendingSessions.length });
    return;
  }

  if (req.method === 'POST' && reqPath === '/release') {
    const raw = await readRequestBody(req);
    let claimId = null;
    try {
      const parsed = JSON.parse(raw || '{}');
      if (typeof parsed.claimId === 'string') claimId = parsed.claimId;
    } catch {
      claimId = null;
    }
    let restored = 0;
    if (claimId && inFlightClaims.has(claimId)) {
      const claim = inFlightClaims.get(claimId);
      inFlightClaims.delete(claimId);
      const existingIds = new Set(pendingSessions.map((p) => p.id));
      for (const s of claim?.sessions ?? []) {
        if (!existingIds.has(s.id)) {
          pendingSessions.push(s);
          existingIds.add(s.id);
          restored++;
        }
      }
      writeJsonSafe(PENDING_FILE, pendingSessions);
    }
    sendJson(req, res, 200, { ok: true, restored });
    return;
  }

  if (req.method === 'GET' && reqPath === '/rules') {
    sendJson(req, res, 200, { ok: true, config });
    return;
  }

  if (req.method === 'POST' && reqPath === '/toggle-app') {
    const raw = await readRequestBody(req);
    try {
      const parsed = JSON.parse(raw || '{}');
      const proc = String(parsed.process || '').trim();
      const procLower = proc.toLowerCase();
      const title = String(parsed.title || '').trim();
      const category = String(parsed.category || 'study').trim();
      const enabled = Boolean(parsed.enabled);

      if (!proc) {
        sendJson(req, res, 400, { ok: false, error: 'Process diperlukan' });
        return;
      }

      const disabledSet = new Set(
        (config.disabledProcesses || []).map((p) => String(p).toLowerCase())
      );

      if (!enabled) {
        disabledSet.add(procLower);
        config.disabledProcesses = Array.from(disabledSet);

        // If pinnedTarget or activeSession was tracking this process, stop it
        if (
          pinnedTarget &&
          pinnedTarget.process &&
          pinnedTarget.process.toLowerCase() === procLower
        ) {
          pinnedTarget = null;
        }
        if (
          activeSession &&
          activeSession.process &&
          activeSession.process.toLowerCase() === procLower
        ) {
          commitActiveSession(false);
        }
      } else {
        disabledSet.delete(procLower);
        config.disabledProcesses = Array.from(disabledSet);

        // Ensure at least one rule matches this window/process
        const existingMatch = matchWindowRule(proc, title);
        if (!existingMatch) {
          // Check if there is a disabled rule that would match it
          let reEnabledAny = false;
          for (const rule of config.rules) {
            if (!rule.pattern) continue;
            try {
              const regex = new RegExp(rule.pattern, 'i');
              const target = rule.matchType === 'process' ? proc : title;
              if (regex.test(target || '')) {
                rule.enabled = true;
                reEnabledAny = true;
              }
            } catch {
              // ignore
            }
          }

          if (!reEnabledAny) {
            const isBrowser =
              /^(chrome|msedge|brave|firefox|opera|vivaldi)$/i.test(proc);
            const cleanT = cleanDisplayTitle(title, proc, proc);
            const pattern = isBrowser
              ? cleanT.slice(0, 28).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              : `^${proc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
            config.rules.unshift({
              id: `rule-app-${procLower}-${Date.now()}`,
              name: isBrowser ? `Web: ${cleanT.slice(0, 30)}` : `Aplikasi: ${proc}`,
              enabled: true,
              matchType: isBrowser ? 'title' : 'process',
              pattern,
              category,
            });
          }
        }
      }

      writeJsonSafe(RULES_FILE, config);
      sendJson(req, res, 200, { ok: true, config });
    } catch {
      sendJson(req, res, 400, { ok: false, error: 'Payload tidak valid' });
    }
    return;
  }

  if (req.method === 'POST' && reqPath === '/bulk-rules') {
    const raw = await readRequestBody(req);
    try {
      const parsed = JSON.parse(raw || '{}');
      const enabled = Boolean(parsed.enabled);
      config.rules = config.rules.map((r) => ({ ...r, enabled }));
      if (!enabled) {
        pinnedTarget = null;
        catalogHint = null;
        if (activeSession) {
          commitActiveSession(false);
        }
      } else {
        config.disabledProcesses = [];
      }
      writeJsonSafe(RULES_FILE, config);
      sendJson(req, res, 200, { ok: true, config });
    } catch {
      sendJson(req, res, 400, { ok: false, error: 'Payload tidak valid' });
    }
    return;
  }

  if (req.method === 'POST' && reqPath === '/rules') {
    const raw = await readRequestBody(req);
    try {
      const incoming = JSON.parse(raw || '{}');
      config = {
        idleThresholdSeconds: Math.max(
          60,
          Number(incoming.idleThresholdSeconds ?? config.idleThresholdSeconds)
        ),
        minSessionMinutes: Math.max(
          1,
          Number(incoming.minSessionMinutes ?? config.minSessionMinutes)
        ),
        inactivityCommitSeconds: Math.max(
          15,
          Number(
            incoming.inactivityCommitSeconds ?? config.inactivityCommitSeconds
          )
        ),
        trackBackgroundWindows:
          typeof incoming.trackBackgroundWindows === 'boolean'
            ? incoming.trackBackgroundWindows
            : (config.trackBackgroundWindows ?? true),
        disabledProcesses: Array.isArray(incoming.disabledProcesses)
          ? incoming.disabledProcesses.map((p) => String(p).toLowerCase())
          : (config.disabledProcesses ?? []),
        rules: Array.isArray(incoming.rules) ? incoming.rules : config.rules,
      };
      writeJsonSafe(RULES_FILE, config);
      sendJson(req, res, 200, { ok: true, config });
    } catch {
      sendJson(req, res, 400, { ok: false, error: 'Format JSON tidak valid' });
    }
    return;
  }

  if (req.method === 'POST' && reqPath === '/anki') {
    const raw = await readRequestBody(req);
    const targetUrl = resolveAnkiUrl(req.headers['x-anki-url']);
    proxyToAnki(req, targetUrl, raw || '{}', res);
    return;
  }

  sendJson(req, res, 404, { ok: false, error: 'Endpoint tidak ditemukan' });
});

let watcher = startWindowsWatcher();

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.log(
      `[ImmersionTrack] Companion Agent sudah berjalan di http://${HOST}:${PORT}`
    );
    process.exit(0);
  }
  console.error('[Server Error]', err);
});

server.listen(PORT, HOST, () => {
  console.log(`==============================================`);
  console.log(` ImmersionTrack Background Agent v2.1 aktif!`);
  console.log(` Device : ${DEVICE_NAME}`);
  console.log(` API    : http://${HOST}:${PORT}`);
  console.log(` Rules  : ${RULES_FILE}`);
  console.log(`==============================================`);
});

function shutdown() {
  reclaimExpiredClaims(true);
  commitActiveSession(false);
  if (watcher && !watcher.killed) {
    watcher.kill();
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
