import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BarChart3,
  Command,
  Compass,
  ExternalLink,
  Globe,
  History,
  Keyboard,
  LayoutDashboard,
  MonitorSmartphone,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import rawCatalog from '../data/immersionCatalog.json';
import {
  loadCompanionSettings,
  notifyCompanionMediaLaunch,
} from '../lib/companionClient';
import type { PrimaryMediaCategory } from '../types';

export interface WebShortcutItem {
  id: string;
  label: string;
  url: string;
  badge: string;
  group: 'media' | 'tools' | 'custom';
  category?: PrimaryMediaCategory;
  description: string;
}

export const BUILTIN_WEB_SHORTCUTS: WebShortcutItem[] = [
  // Media & Streaming Portals
  {
    id: 'sc-bettermelon',
    label: 'Bettermelon',
    url: 'https://bettermelon.ru/',
    badge: 'Anime Sub JP',
    group: 'media',
    category: 'anime',
    description: 'Nonton anime dengan subtitle Jepang interaktif & metrik JLPT',
  },
  {
    id: 'sc-epubmoe',
    label: 'Epub.moe',
    url: 'https://epub.moe/',
    badge: 'Light Novel',
    group: 'media',
    category: 'light_novel',
    description: 'Baca online & download ribuan Light Novel EPUB bahasa Jepang',
  },
  {
    id: 'sc-ttsu',
    label: 'Ttsu Reader',
    url: 'https://reader.ttsu.app/',
    badge: 'EPUB Reader',
    group: 'media',
    category: 'light_novel',
    description: 'Pembaca buku EPUB di browser (kompatibel penuh dengan Yomitan)',
  },
  {
    id: 'sc-cinejoy',
    label: 'Cinejoy',
    url: 'https://cinejoy.pk/',
    badge: 'Drama & TV',
    group: 'media',
    category: 'video',
    description: 'Streaming drama Jepang (J-Drama), film, dan acara TV',
  },
  {
    id: 'sc-mangadex',
    label: 'MangaDex',
    url: 'https://mangadex.org/',
    badge: 'Manga',
    group: 'media',
    category: 'manga',
    description: 'Baca ribuan manga populer langsung di browser',
  },
  {
    id: 'sc-rawkuma',
    label: 'Rawkuma',
    url: 'https://rawkuma.net/',
    badge: 'Manga Raw JP',
    group: 'media',
    category: 'manga',
    description: 'Katalog manga raw bahasa Jepang asli',
  },
  {
    id: 'sc-syosetu',
    label: 'Syosetu (なろう)',
    url: 'https://syosetu.com/',
    badge: 'Web Novel JP',
    group: 'media',
    category: 'light_novel',
    description: 'Portal web novel terbesar di Jepang (Shousetsuka ni Narou)',
  },
  {
    id: 'sc-youtube',
    label: 'YouTube JP',
    url: 'https://www.youtube.com/',
    badge: 'Video & VTuber',
    group: 'media',
    category: 'video',
    description: 'Tonton vlog, VTuber, dan konten kreator Jepang',
  },
  {
    id: 'sc-spotify',
    label: 'Spotify Podcast',
    url: 'https://open.spotify.com/',
    badge: 'Podcast JP',
    group: 'media',
    category: 'audio',
    description: 'Dengarkan podcast bahasa Jepang (Nihongo con Teppei, dll.)',
  },

  // Dictionaries, Mining & SRS Tools
  {
    id: 'sc-jisho',
    label: 'Jisho.org',
    url: 'https://jisho.org/',
    badge: 'Kamus & Kanji',
    group: 'tools',
    category: 'study',
    description: 'Kamus bahasa Jepang–Inggris, radikal kanji, & contoh kalimat',
  },
  {
    id: 'sc-jpdb',
    label: 'JPDB.io',
    url: 'https://jpdb.io/',
    badge: 'SRS & Deck Media',
    group: 'tools',
    category: 'study',
    description: 'Deck kosakata otomatis berdasarkan judul Anime, Novel, & VN',
  },
  {
    id: 'sc-jimaku',
    label: 'Jimaku.cc',
    url: 'https://jimaku.cc/',
    badge: 'Subtitle JP',
    group: 'tools',
    category: 'anime',
    description: 'Download file subtitle bahasa Jepang (.srt / .ass) untuk anime & drama',
  },
  {
    id: 'sc-asbplayer',
    label: 'asbplayer',
    url: 'https://killergerbah.github.io/asbplayer/',
    badge: 'Video Mining',
    group: 'tools',
    category: 'anime',
    description: 'Putar video lokal/streaming dengan subtitle Jepang & 1-klik mining ke Anki',
  },
  {
    id: 'sc-nhkeasy',
    label: 'NHK News Easy',
    url: 'https://www3.nhk.or.jp/news/easy/',
    badge: 'Berita N4/N3',
    group: 'tools',
    category: 'study',
    description: 'Berita harian Jepang dengan furigana dan audio narasi asli',
  },
  {
    id: 'sc-wanikani',
    label: 'WaniKani',
    url: 'https://www.wanikani.com/',
    badge: 'Kanji SRS',
    group: 'tools',
    category: 'study',
    description: 'Belajar 2.000+ Kanji dan 6.000+ kosakata bahasa Jepang',
  },
  {
    id: 'sc-bunpro',
    label: 'Bunpro.jp',
    url: 'https://bunpro.jp/',
    badge: 'Grammar JLPT',
    group: 'tools',
    category: 'study',
    description: 'Referensi & SRS tata bahasa (grammar) JLPT N5 sampai N1',
  },
  {
    id: 'sc-vndb',
    label: 'VNDB.org',
    url: 'https://vndb.org/',
    badge: 'Visual Novel DB',
    group: 'tools',
    category: 'visual_novel',
    description: 'Database lengkap Visual Novel Jepang',
  },
];

const CUSTOM_SHORTCUTS_KEY = 'immersiontrack_custom_shortcuts_v1';

export function loadCustomShortcuts(): WebShortcutItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SHORTCUTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveCustomShortcuts(items: WebShortcutItem[]): void {
  try {
    localStorage.setItem(CUSTOM_SHORTCUTS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export const KEYBOARD_SHORTCUT_GUIDE: Array<{
  keys: string[];
  label: string;
  description: string;
}> = [
  {
    keys: ['Ctrl', 'K'],
    label: 'Command Palette & Cari Cepat',
    description: 'Buka menu pintasan semua fitur, website, dan pencarian media',
  },
  {
    keys: ['/'],
    label: 'Pencarian Cepat',
    description: 'Langsung fokus ke kotak pencarian dari halaman mana saja',
  },
  {
    keys: ['N'],
    label: 'Catat Sesi Immersion Baru',
    description: 'Buka modal pencatatan waktu belajar (+ Log Sesi)',
  },
  {
    keys: ['1', '–', '8'],
    label: 'Pindah Tab Dashboard Instan',
    description:
      '1: Overview • 2: Profil • 3: Katalog • 4: Stats • 5: Goals • 6: Achievements • 7: Activity • 8: Devices',
  },
  {
    keys: ['P'],
    label: 'Play Media (Di Halaman Timeline)',
    description: 'Langsung buka pemutar media saat sedang melihat detail judul',
  },
  {
    keys: ['L'],
    label: 'Add to List (Di Halaman Timeline)',
    description: 'Simpan/hapus judul ke Daftar Saya (Watchlist)',
  },
  {
    keys: ['Esc'],
    label: 'Kembali / Tutup Modal',
    description: 'Tutup popup atau kembali dari halaman Timeline ke Katalog',
  },
  {
    keys: ['?'],
    label: 'Panduan Pintasan Keyboard',
    description: 'Tampilkan daftar seluruh shortcut keyboard dan portal web',
  },
];

interface ShortcutsQuickDockProps {
  onOpenCommandPalette: () => void;
  onQuickLog: () => void;
  onJumpTab: (
    tab:
      | 'overview'
      | 'profile'
      | 'catalog'
      | 'stats'
      | 'goals'
      | 'achievements'
      | 'activity'
      | 'devices'
  ) => void;
}

export const ShortcutsQuickDock: React.FC<ShortcutsQuickDockProps> = ({
  onOpenCommandPalette,
  onQuickLog,
  onJumpTab,
}) => {
  const [activeGroup, setActiveGroup] = useState<'all' | 'media' | 'tools'>(
    'all'
  );
  const [customShortcuts, setCustomShortcuts] =
    useState<WebShortcutItem[]>(loadCustomShortcuts);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customBadge, setCustomBadge] = useState('Custom');

  const allShortcuts = useMemo(() => {
    const combined = [...customShortcuts, ...BUILTIN_WEB_SHORTCUTS];
    if (activeGroup === 'all') return combined;
    return combined.filter(
      (s) => s.group === activeGroup || s.group === 'custom'
    );
  }, [activeGroup, customShortcuts]);

  const handleLaunchShortcut = (sc: WebShortcutItem) => {
    if (sc.category) {
      const companion = loadCompanionSettings();
      void notifyCompanionMediaLaunch(companion.url, {
        title: sc.label,
        category: sc.category,
        url: sc.url,
      });
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const label = customLabel.trim();
    let url = customUrl.trim();
    if (!label || !url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    const added: WebShortcutItem = {
      id: `custom-${Date.now()}`,
      label,
      url,
      badge: customBadge.trim() || 'Pintasan',
      group: 'custom',
      category: 'study',
      description: url,
    };
    const next = [added, ...customShortcuts];
    setCustomShortcuts(next);
    saveCustomShortcuts(next);
    setCustomLabel('');
    setCustomUrl('');
    setAddingCustom(false);
    toast.success(`Shortcut "${label}" berhasil ditambahkan ke dashboard!`);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = customShortcuts.filter((s) => s.id !== id);
    setCustomShortcuts(next);
    saveCustomShortcuts(next);
    toast.success('Shortcut kustom dihapus');
  };

  return (
    <div className="card-pro p-4 sm:p-5 space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-extrabold text-slate-900">
                Pintasan Cepat (Shortcuts Portal, Tools Jepang & Keyboard)
              </h3>
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-rose-600 text-white text-[10px] font-mono font-bold inline-flex items-center gap-1 transition cursor-pointer"
              >
                <Command className="w-3 h-3" />
                Ctrl + K
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Akses 1-klik ke semua website streaming, novel, kamus, mining
              tools, atau tekan <kbd className="font-mono font-bold">Ctrl+K</kbd>{' '}
              / angka <kbd className="font-mono font-bold">1–8</kbd> di
              keyboard.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveGroup('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeGroup === 'all'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({BUILTIN_WEB_SHORTCUTS.length + customShortcuts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveGroup('media')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeGroup === 'media'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Nonton & Baca
          </button>
          <button
            type="button"
            onClick={() => setActiveGroup('tools')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeGroup === 'tools'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            Kamus & Mining
          </button>
          <button
            type="button"
            onClick={() => setAddingCustom((prev) => !prev)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-600 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Shortcut
          </button>
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            Daftar Hotkey
          </button>
        </div>
      </div>

      {/* Add Custom Shortcut Form */}
      {addingCustom && (
        <form
          onSubmit={handleAddCustom}
          className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 grid sm:grid-cols-12 gap-2 animate-fade-in"
        >
          <input
            type="text"
            required
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Nama Web (mis. Nyaa / Animelon)"
            className="sm:col-span-3 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-rose-500"
          />
          <input
            type="text"
            required
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="URL (mis. https://nyaa.si)"
            className="sm:col-span-5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-rose-500"
          />
          <input
            type="text"
            value={customBadge}
            onChange={(e) => setCustomBadge(e.target.value)}
            placeholder="Label (mis. Torrent / Kamus)"
            className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-rose-500"
          />
          <button
            type="submit"
            className="btn-crimson sm:col-span-2 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
          >
            Simpan
          </button>
        </form>
      )}

      {/* Quick Internal Dashboard Action Shortcuts */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={onQuickLog}
          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Catat Sesi
          <kbd className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-mono">
            N
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => onJumpTab('catalog')}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-rose-600" />
          Buka Katalog Media
          <kbd className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500">
            3
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => onJumpTab('profile')}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <User className="w-3.5 h-3.5 text-rose-600" />
          Profil & Background
          <kbd className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500">
            2
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => onJumpTab('devices')}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <MonitorSmartphone className="w-3.5 h-3.5 text-emerald-600" />
          Atur Companion PC (ON/OFF)
          <kbd className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500">
            8
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => onJumpTab('stats')}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
          Grafik & Analitik
          <kbd className="px-1.5 py-0.2 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500">
            4
          </kbd>
        </button>
      </div>

      {/* External Immersion & Tool Shortcuts Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {allShortcuts.map((sc) => (
          <a
            key={sc.id}
            href={sc.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleLaunchShortcut(sc)}
            title={sc.description}
            className="group p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50/70 border border-slate-200/80 hover:border-rose-300 flex flex-col justify-between gap-1.5 transition"
          >
            <div className="flex items-center justify-between gap-1">
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  sc.group === 'media'
                    ? 'bg-rose-100 text-rose-700'
                    : sc.group === 'tools'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {sc.badge}
              </span>
              {sc.group === 'custom' ? (
                <button
                  type="button"
                  onClick={(e) => handleDeleteCustom(sc.id, e)}
                  className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                  title="Hapus shortcut"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              ) : (
                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-rose-600 transition shrink-0" />
              )}
            </div>
            <div className="text-xs font-extrabold text-slate-900 group-hover:text-rose-700 truncate">
              {sc.label}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

interface CatalogMinimalEntry {
  id: string;
  title: string;
  romajiTitle?: string;
  section: string;
  category: PrimaryMediaCategory;
  ranking: string;
}

const QUICK_SEARCH_CATALOG = (rawCatalog as CatalogMinimalEntry[]).slice(
  0,
  1130
);

interface ShortcutsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpTab: (
    tab:
      | 'overview'
      | 'profile'
      | 'catalog'
      | 'stats'
      | 'goals'
      | 'achievements'
      | 'activity'
      | 'devices'
  ) => void;
  onQuickLog: () => void;
  onSelectCatalogTitle: (title: string) => void;
}

export const ShortcutsHubModal: React.FC<ShortcutsHubModalProps> = ({
  isOpen,
  onClose,
  onJumpTab,
  onQuickLog,
  onSelectCatalogTitle,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const customShortcuts = useMemo(
    () => (isOpen ? loadCustomShortcuts() : []),
    [isOpen]
  );

  const matchingShortcuts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...customShortcuts, ...BUILTIN_WEB_SHORTCUTS];
    if (!q) return list;
    return list.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.badge.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [query, customShortcuts]);

  const matchingCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return QUICK_SEARCH_CATALOG.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.romajiTitle && item.romajiTitle.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [query]);

  if (!isOpen) return null;

  const navActions: Array<{
    keyNum: string;
    label: string;
    tab:
      | 'overview'
      | 'profile'
      | 'catalog'
      | 'stats'
      | 'goals'
      | 'achievements'
      | 'activity'
      | 'devices';
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { keyNum: '1', label: 'Overview', tab: 'overview', icon: LayoutDashboard },
    { keyNum: '2', label: 'Profil & Background', tab: 'profile', icon: User },
    { keyNum: '3', label: 'Katalog Media', tab: 'catalog', icon: Compass },
    { keyNum: '4', label: 'Stats & Grafik', tab: 'stats', icon: BarChart3 },
    { keyNum: '5', label: 'Goals / Target', tab: 'goals', icon: Target },
    {
      keyNum: '6',
      label: 'Achievements',
      tab: 'achievements',
      icon: Award,
    },
    { keyNum: '7', label: 'Activity Log', tab: 'activity', icon: History },
    {
      keyNum: '8',
      label: 'Devices & Companion PC',
      tab: 'devices',
      icon: MonitorSmartphone,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-start justify-center p-4 pt-14 sm:pt-20 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-scale-in max-h-[82vh] flex flex-col"
      >
        {/* Top Command Search Input */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <Search className="w-4 h-4 text-rose-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari shortcut website (Bettermelon, Jisho, Epub.moe), fitur, atau judul anime/novel..."
            className="flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Quick Catalog Matches if user typed a media query */}
          {matchingCatalog.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Buka Timeline Media di Katalog ({matchingCatalog.length})
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {matchingCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectCatalogTitle(item.title);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-rose-50/60 hover:bg-rose-600 text-slate-900 hover:text-white border border-rose-200 text-left flex items-center justify-between gap-2 transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] opacity-75 truncate">
                        {item.section} • {item.ranking}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/20 shrink-0">
                      Timeline →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Dashboard Tab Navigation */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-rose-600" />
              Navigasi Cepat Halaman & Aksi
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onQuickLog();
                }}
                className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  Catat Sesi Baru
                </span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">
                  N
                </kbd>
              </button>

              {navActions.map((act) => (
                <button
                  key={act.tab}
                  type="button"
                  onClick={() => {
                    onJumpTab(act.tab);
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-xs font-bold text-slate-800 hover:text-rose-700 flex items-center justify-between gap-2 transition cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <act.icon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">{act.label}</span>
                  </span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500 shrink-0">
                    {act.keyNum}
                  </kbd>
                </button>
              ))}
            </div>
          </div>

          {/* All Web Portals & Japanese Learning Tools Shortcuts */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-rose-600" />
              Pintasan Website Streaming, Novel, Kamus & Mining Tools (
              {matchingShortcuts.length})
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {matchingShortcuts.map((sc) => (
                <a
                  key={sc.id}
                  href={sc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onClose()}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-rose-50/70 border border-slate-200 hover:border-rose-300 flex items-start justify-between gap-2 transition"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {sc.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-rose-600">
                        {sc.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {sc.description}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />
                </a>
              ))}
            </div>
          </div>

          {/* Keyboard Shortcuts Reference Table */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-rose-600" />
              Daftar Shortcut Keyboard Umum
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {KEYBOARD_SHORTCUT_GUIDE.map((item) => (
                <div
                  key={item.label}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {item.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-300 shadow-2xs text-[11px] font-mono font-bold text-slate-800"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
