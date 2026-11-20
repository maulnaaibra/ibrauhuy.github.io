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

const DEFAULT_CONFIG = {
  idleThresholdSeconds: 180,
  minSessionMinutes: 1,
  inactivityCommitSeconds: 45,
  rules: [
    {
      id: 'rule-mpv-vlc',
      name: 'Video Player (MPV / VLC / PotPlayer)',
      enabled: true,
      matchType: 'process',
      pattern: 'mpv|vlc|potplayer|mpc-hc|mpc-be',
      category: 'anime',
    },
    {
      id: 'rule-anime-sites',
      name: 'Streaming Anime (Netflix / Crunchyroll / Muse)',
      enabled: true,
      matchType: 'title',
      pattern: 'netflix|crunchyroll|animelon|muse|ani-one|bilibili.*anime|anime',
      category: 'anime',
    },
    {
      id: 'rule-youtube-video',
      name: 'Video Online (YouTube / Niconico / Abema / TVer)',
      enabled: true,
      matchType: 'title',
      pattern: 'youtube|niconico|abema|tver|bilibili',
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
      id: 'rule-manga',
      name: 'Manga Reader (Mokuro / MangaDex / BookWalker)',
      enabled: true,
      matchType: 'title',
      pattern: 'mangadex|mokuro|bookwalker|manga',
      category: 'manga',
    },
    {
      id: 'rule-vn',
      name: 'Visual Novel & Texthooker',
      enabled: true,
      matchType: 'title',
      pattern: 'textractor|lunatranslator|texthooker|visual novel|vnreader|steins;gate|clannad',
      category: 'visual_novel',
    },
    {
      id: 'rule-ln',
      name: 'Light Novel / Web Novel (Ttsu / Syosetsu / Kakuyomu)',
      enabled: true,
      matchType: 'title',
      pattern: 'ttsu|syosetsu|kakuyomu|light novel|kindle|calibre',
      category: 'light_novel',
    },
    {
      id: 'rule-book',
      name: 'Pembaca Buku PDF / EPUB (SumatraPDF)',
      enabled: true,
      matchType: 'process',
      pattern: 'sumatrapdf',
      category: 'book',
    },
    {
      id: 'rule-audio',
      name: 'Podcast & Audio (Spotify / Teppei / Audible)',
      enabled: true,
      matchType: 'title',
      pattern: 'podcast|teppei|sakura tips|audible|spotify',
      category: 'audio',
    },
  ],
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

let config = readJsonSafe(RULES_FILE, null);
if (!config || !Array.isArray(config.rules)) {
  config = structuredClone(DEFAULT_CONFIG);
  writeJsonSafe(RULES_FILE, config);
}

let pendingSessions = readJsonSafe(PENDING_FILE, []);
if (!Array.isArray(pendingSessions)) {
  pendingSessions = [];
}

let trackingEnabled = true;
let lastWindow = {
  process: '',
  title: '',
  idleSeconds: 0,
  matchedRule: null,
  timestamp: new Date().toISOString(),
};
let activeSession = null;
let awaySeconds = 0;
let lastSampleTime = Date.now();

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function cleanDisplayTitle(rawTitle, processName, fallbackName) {
  const cleaned = String(rawTitle || '')
    .replace(/\s+-\s+(Google Chrome|Microsoft Edge|Mozilla Firefox|Brave|Opera|VLC media player|mpv|YouTube)$/i, '')
    .replace(/\s+\|\s+(YouTube|Netflix|Crunchyroll)$/i, '')
    .trim();
  return cleaned || fallbackName || processName || 'Sesi Immersion';
}

function matchWindowRule(processName, windowTitle) {
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

function commitActiveSession(force = false) {
  if (!activeSession) return null;

  const durationMinutes = force
    ? activeSession.activeSeconds >= 10
      ? Math.max(1, Math.round(activeSession.activeSeconds / 60))
      : 0
    : Math.round(activeSession.activeSeconds / 60);

  const minReq = force ? 1 : Number(config.minSessionMinutes || 1);
  let committed = null;

  if (durationMinutes >= minReq) {
    const now = new Date();
    committed = {
      id: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: activeSession.title,
      category: activeSession.category,
      duration_minutes: durationMinutes,
      cards_mined: 0,
      notes: `Auto-tracked dari ${DEVICE_NAME} (${activeSession.process})`,
      logged_date: getLocalDateString(now),
      created_at: now.toISOString(),
      source_device: DEVICE_NAME,
    };
    pendingSessions.push(committed);
    writeJsonSafe(PENDING_FILE, pendingSessions);
    console.log(
      `[Commit] +${committed.duration_minutes}m | ${committed.category} | ${committed.title}`
    );
  }

  activeSession = null;
  awaySeconds = 0;
  return committed;
}

function handleWindowSample(sample) {
  const now = Date.now();
  const deltaSec = Math.min(5, Math.max(1, Math.round((now - lastSampleTime) / 1000)));
  lastSampleTime = now;

  const proc = String(sample.process || '');
  const title = String(sample.title || '');
  const idle = Number(sample.idleSeconds || 0);
  const rule = trackingEnabled ? matchWindowRule(proc, title) : null;

  lastWindow = {
    process: proc,
    title,
    idleSeconds: idle,
    matchedRule: rule ? rule.name : null,
    timestamp: new Date(now).toISOString(),
  };

  const isIdle = idle >= Number(config.idleThresholdSeconds || 180);

  if (!trackingEnabled || isIdle || !rule) {
    if (activeSession) {
      awaySeconds += deltaSec;
      if (awaySeconds >= Number(config.inactivityCommitSeconds || 45)) {
        commitActiveSession(false);
      }
    }
    return;
  }

  awaySeconds = 0;
  const displayTitle = cleanDisplayTitle(title, proc, rule.name);

  if (
    activeSession &&
    activeSession.title === displayTitle &&
    activeSession.category === rule.category
  ) {
    activeSession.activeSeconds += deltaSec;
    activeSession.lastSeenAt = new Date(now).toISOString();
    return;
  }

  if (activeSession) {
    commitActiveSession(false);
  }

  activeSession = {
    title: displayTitle,
    category: rule.category,
    process: proc,
    ruleName: rule.name,
    startedAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
    activeSeconds: deltaSec,
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
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class Win32Tracker {
  [DllImport("user32.dll")]
  private static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [StructLayout(LayoutKind.Sequential)]
  private struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
  }

  [DllImport("user32.dll")]
  private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

  public static object GetSnapshot() {
    IntPtr hwnd = GetForegroundWindow();
    StringBuilder sb = new StringBuilder(512);
    if (hwnd != IntPtr.Zero) {
      GetWindowText(hwnd, sb, sb.Capacity);
    }

    uint pid = 0;
    string procName = "";
    if (hwnd != IntPtr.Zero) {
      GetWindowThreadProcessId(hwnd, out pid);
      if (pid != 0) {
        try {
          procName = Process.GetProcessById((int)pid).ProcessName;
        } catch {}
      }
    }

    LASTINPUTINFO lii = new LASTINPUTINFO();
    lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
    uint idleSec = 0;
    if (GetLastInputInfo(ref lii)) {
      uint elapsedMs = unchecked((uint)Environment.TickCount - lii.dwTime);
      idleSec = elapsedMs / 1000;
    }

    return new {
      process = procName,
      title = sb.ToString(),
      idleSeconds = idleSec
    };
  }
}
"@
Add-Type -TypeDefinition $code -Language CSharp
while ($true) {
  try {
    $snap = [Win32Tracker]::GetSnapshot()
    [Console]::WriteLine(($snap | ConvertTo-Json -Compress))
  } catch {}
  Start-Sleep -Seconds 2
}
`;

  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
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
      console.error(`[Watcher Exited] code=${code}`);
    }
  });

  return child;
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Anki-Url',
    'Access-Control-Allow-Private-Network': 'true',
  });
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

function proxyToAnki(targetUrl, bodyStr, res) {
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
      timeout: 2500,
    },
    (proxyRes) => {
      let data = '';
      proxyRes.on('data', (chunk) => {
        data += chunk.toString('utf8');
      });
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Anki-Url',
          'Access-Control-Allow-Private-Network': 'true',
        });
        res.end(data);
      });
    }
  );

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    sendJson(res, 504, { result: null, error: 'Koneksi ke AnkiConnect timeout' });
  });

  proxyReq.on('error', () => {
    sendJson(res, 502, {
      result: null,
      error: 'Anki / AnkiConnect tidak merespons di port tersebut',
    });
  });

  proxyReq.write(bodyStr);
  proxyReq.end();
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Anki-Url',
      'Access-Control-Allow-Private-Network': 'true',
    });
    res.end();
    return;
  }

  const reqPath = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && reqPath === '/health') {
    sendJson(res, 200, {
      ok: true,
      version: '1.0.0',
      deviceName: DEVICE_NAME,
      platform: process.platform,
      trackingEnabled,
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      pendingCount: pendingSessions.length,
    });
    return;
  }

  if (req.method === 'GET' && reqPath === '/status') {
    sendJson(res, 200, {
      ok: true,
      deviceName: DEVICE_NAME,
      trackingEnabled,
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      config,
      lastWindow,
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
    sendJson(res, 200, { ok: true, trackingEnabled });
    return;
  }

  if (req.method === 'POST' && reqPath === '/flush') {
    const committed = commitActiveSession(true);
    sendJson(res, 200, {
      ok: true,
      committed,
      pending: pendingSessions,
    });
    return;
  }

  if (req.method === 'GET' && reqPath === '/pending') {
    sendJson(res, 200, { ok: true, pending: pendingSessions });
    return;
  }

  if (req.method === 'POST' && reqPath === '/ack') {
    const raw = await readRequestBody(req);
    let ids = [];
    try {
      const parsed = JSON.parse(raw || '{}');
      if (Array.isArray(parsed.ids)) ids = parsed.ids;
    } catch {
      ids = [];
    }
    const ackSet = new Set(ids);
    pendingSessions = pendingSessions.filter((s) => !ackSet.has(s.id));
    writeJsonSafe(PENDING_FILE, pendingSessions);
    sendJson(res, 200, { ok: true, remaining: pendingSessions.length });
    return;
  }

  if (req.method === 'GET' && reqPath === '/rules') {
    sendJson(res, 200, { ok: true, config });
    return;
  }

  if (req.method === 'POST' && reqPath === '/rules') {
    const raw = await readRequestBody(req);
    try {
      const incoming = JSON.parse(raw || '{}');
      config = {
        idleThresholdSeconds: Math.max(
          30,
          Number(incoming.idleThresholdSeconds ?? config.idleThresholdSeconds)
        ),
        minSessionMinutes: Math.max(
          1,
          Number(incoming.minSessionMinutes ?? config.minSessionMinutes)
        ),
        inactivityCommitSeconds: Math.max(
          10,
          Number(
            incoming.inactivityCommitSeconds ?? config.inactivityCommitSeconds
          )
        ),
        rules: Array.isArray(incoming.rules) ? incoming.rules : config.rules,
      };
      writeJsonSafe(RULES_FILE, config);
      sendJson(res, 200, { ok: true, config });
    } catch {
      sendJson(res, 400, { ok: false, error: 'Format JSON tidak valid' });
    }
    return;
  }

  if (req.method === 'POST' && reqPath === '/anki') {
    const raw = await readRequestBody(req);
    const targetUrl = resolveAnkiUrl(req.headers['x-anki-url']);
    proxyToAnki(targetUrl, raw || '{}', res);
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Endpoint tidak ditemukan' });
});

const watcher = startWindowsWatcher();

server.listen(PORT, HOST, () => {
  console.log(`==============================================`);
  console.log(` ImmersionTrack Background Agent aktif!`);
  console.log(` Device : ${DEVICE_NAME}`);
  console.log(` API    : http://${HOST}:${PORT}`);
  console.log(` Rules  : ${RULES_FILE}`);
  console.log(`==============================================`);
});

function shutdown() {
  commitActiveSession(false);
  if (watcher && !watcher.killed) {
    watcher.kill();
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
