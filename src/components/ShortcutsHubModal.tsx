import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Command,
  Compass,
  ExternalLink,
  Globe,
  History,
  Keyboard,
  LayoutDashboard,
  Library,
  MonitorSmartphone,
  Plus,
  Search,
  Sparkles,
  Target,
  User,
  X,
} from 'lucide-react';
import rawCatalog from '../data/immersionCatalog.json';
import type { PrimaryMediaCategory } from '../types';

export type SidebarDashboardTab =
  | 'overview'
  | 'profile'
  | 'library'
  | 'catalog'
  | 'stats'
  | 'goals'
  | 'achievements'
  | 'activity'
  | 'devices';

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
    id: 'sc-yatsu',
    label: 'Yatsu Reader',
    url: 'https://app.yatsu.moe/library',
    badge: 'Light Novel',
    group: 'media',
    category: 'light_novel',
    description:
      'Baca Light Novel & EPUB bahasa Jepang di Yatsu Library (kompatibel Yomitan)',
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
    keys: ['1', '–', '9'],
    label: 'Pindah Tab Dashboard Instan',
    description:
      '1: Overview • 2: Profil • 3: Library • 4: Katalog • 5: Stats • 6: Goals • 7: Achievements • 8: Activity • 9: Devices',
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

interface LeftSidebarNavigationProps {
  activeTab: SidebarDashboardTab;
  onSelectTab: (tab: SidebarDashboardTab) => void;
  companionConnected: boolean;
  onOpenCommandPalette: () => void;
  onQuickLog: () => void;
}

export const LeftSidebarNavigation: React.FC<LeftSidebarNavigationProps> = ({
  activeTab,
  onSelectTab,
  companionConnected,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const navItems: Array<{
    id: SidebarDashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    dot?: boolean;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'catalog', label: 'Katalog', icon: Compass },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'achievements', label: 'Achievements', icon: Award },
    { id: 'activity', label: 'Activity', icon: History },
    {
      id: 'devices',
      label: 'Devices',
      icon: MonitorSmartphone,
      dot: companionConnected,
    },
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 sticky top-16 h-[calc(100vh-4rem)] bg-white/95 backdrop-blur-md border-r border-slate-200/85 transition-all duration-300 select-none ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div className="p-3 flex items-center justify-between border-b border-slate-100">
        {!collapsed && (
          <span className="px-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Navigasi
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? 'Perluas Sidebar' : 'Kecilkan Sidebar'}
          className={`p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer ${
            collapsed ? 'w-full flex justify-center' : ''
          }`}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      <nav className="p-2.5 space-y-1">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              title={item.label}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
              } ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <span className="inline-flex items-center gap-2.5 min-w-0">
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </span>
              {!collapsed && item.dot && (
                <span
                  className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
                    active ? 'bg-white' : 'bg-emerald-500'
                  }`}
                />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
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
  onJumpTab: (tab: SidebarDashboardTab) => void;
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
    tab: SidebarDashboardTab;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { keyNum: '1', label: 'Overview', tab: 'overview', icon: LayoutDashboard },
    { keyNum: '2', label: 'Profil & Background', tab: 'profile', icon: User },
    { keyNum: '3', label: 'Library & Riwayat Baca', tab: 'library', icon: Library },
    { keyNum: '4', label: 'Katalog Media', tab: 'catalog', icon: Compass },
    { keyNum: '5', label: 'Stats & Grafik', tab: 'stats', icon: BarChart3 },
    { keyNum: '6', label: 'Goals / Target', tab: 'goals', icon: Target },
    {
      keyNum: '7',
      label: 'Achievements',
      tab: 'achievements',
      icon: Award,
    },
    { keyNum: '8', label: 'Activity Log', tab: 'activity', icon: History },
    {
      keyNum: '9',
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
            placeholder="Cari shortcut website (Bettermelon, Jisho, Yatsu, Epub.moe), fitur, atau judul anime/novel..."
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
              <Command className="w-3.5 h-3.5 text-rose-600" />
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
