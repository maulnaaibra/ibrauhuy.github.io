import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import rawCatalog from '../data/immersionCatalog.json';
import {
  getUniversalDirectSearchPortals,
  isContentNsfwOrHentai,
  searchLiveCatalogMedia,
} from '../lib/liveCatalogSearch';
import {
  getCatalogMediaDestinations,
  type EpubMoeVolume,
} from '../lib/mediaLinks';
import { MediaCover } from './MediaCover';
import { getCategoryMeta, type PrimaryMediaCategory } from '../types';

export type CatalogSection =
  | 'Semua'
  | 'Novels'
  | 'Anime'
  | 'Manga'
  | 'Visual Novels'
  | 'Video Games'
  | 'Drama & TV'
  | 'YouTube'
  | 'VTubers'
  | 'Podcasts';

export type DifficultyTier =
  | 'all'
  | 'Very Easy'
  | 'Easy'
  | 'Medium'
  | 'Hard'
  | 'Very Hard';

export interface BettermelonLanguageStats {
  jlptLevel?: string;
  bmDifficulty?: string;
  bmScore?: string;
  wordCount?: number;
  uniqueWords?: number;
  uniqueKanji?: number;
  speechSpeed?: number;
  speechDuration?: string;
}

export interface SheetCatalogItem {
  id: string;
  section: Exclude<CatalogSection, 'Semua'>;
  category: PrimaryMediaCategory;
  ranking: string;
  difficultyTier: string;
  title: string;
  difficultyExplanation: string;
  description: string;
  exampleVideo?: string;
  coverImage?: string;
  suggestedMinutes: number;
  romajiTitle?: string;
  anilistId?: number;
  epubMoeMd5?: string;
  epubMoeVolumes?: EpubMoeVolume[];
  mangadexId?: string;
  sourceUrl?: string;
  sampleUrl?: string;
  directUrl?: string;
  watchUrl?: string;
  downloadUrl?: string;
  bmStats?: BettermelonLanguageStats;
  isNsfw?: boolean;
}

const ALL_ITEMS = rawCatalog as SheetCatalogItem[];

const SECTION_ORDER: CatalogSection[] = [
  'Semua',
  'Novels',
  'Anime',
  'Manga',
  'Visual Novels',
  'Video Games',
  'Drama & TV',
  'YouTube',
  'VTubers',
  'Podcasts',
];

const DIFFICULTY_FILTERS: Array<{ id: DifficultyTier; label: string }> = [
  { id: 'all', label: 'Semua Level' },
  { id: 'Very Easy', label: 'Beginner • N5' },
  { id: 'Easy', label: 'Easy • N4' },
  { id: 'Medium', label: 'Average • N3' },
  { id: 'Hard', label: 'Hard • N2' },
  { id: 'Very Hard', label: 'Expert / Insane • N1' },
];

function getRankingBadgeStyle(tier: string): string {
  switch (tier) {
    case 'Very Easy':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Easy':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Hard':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Very Hard':
      return 'bg-rose-700 text-white border-rose-700';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

interface MediaCatalogBrowserProps {
  defaultSection?: CatalogSection;
  pageSize?: number;
  onStartMedia: (
    title: string,
    category: PrimaryMediaCategory,
    suggestedMinutes: number
  ) => void;
}

export const MediaCatalogBrowser: React.FC<MediaCatalogBrowserProps> = ({
  defaultSection = 'Novels',
  pageSize = 12,
  onStartMedia,
}) => {
  const [section, setSection] = useState<CatalogSection>(defaultSection);
  const [tierFilter, setTierFilter] = useState<DifficultyTier>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(pageSize);
  const [selectedDetail, setSelectedDetail] = useState<SheetCatalogItem | null>(
    null
  );
  const [liveResults, setLiveResults] = useState<SheetCatalogItem[]>([]);
  const [searchingLive, setSearchingLive] = useState(false);

  useEffect(() => {
    try {
      localStorage.removeItem('immersiontrack_nsfw_mode');
      localStorage.removeItem('immersiontrack_nsfw_blur');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const clean = searchQuery.trim();
    if (clean.length < 2 || isContentNsfwOrHentai({ text: clean })) {
      setLiveResults([]);
      setSearchingLive(false);
      return;
    }

    let cancelled = false;
    setSearchingLive(true);
    const timer = setTimeout(() => {
      void searchLiveCatalogMedia(clean, section)
        .then((items) => {
          if (!cancelled) {
            setLiveResults(items);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchingLive(false);
          }
        });
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, section]);

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = { Semua: 0 };
    for (const item of ALL_ITEMS) {
      if (item.isNsfw) continue;
      counts.Semua = (counts.Semua ?? 0) + 1;
      counts[item.section] = (counts[item.section] ?? 0) + 1;
    }
    return counts;
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q && isContentNsfwOrHentai({ text: q })) return [];

    const localMatched = ALL_ITEMS.filter((item) => {
      if (item.isNsfw) return false;
      if (section !== 'Semua' && item.section !== section) return false;
      if (tierFilter !== 'all' && item.difficultyTier !== tierFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.romajiTitle?.toLowerCase().includes(q) ?? false) ||
        item.ranking.toLowerCase().includes(q) ||
        (item.bmStats?.jlptLevel?.toLowerCase().includes(q) ?? false) ||
        (item.bmStats?.bmDifficulty?.toLowerCase().includes(q) ?? false) ||
        item.difficultyExplanation.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });

    if (!q || liveResults.length === 0) return localMatched;

    const seenAnilist = new Set<number>();
    const seenTitles = new Set<string>();
    for (const item of localMatched) {
      if (item.anilistId) seenAnilist.add(item.anilistId);
      seenTitles.add(item.title.trim().toLowerCase());
    }

    const extraLive = liveResults.filter((item) => {
      if (item.isNsfw) return false;
      if (section !== 'Semua' && item.section !== section) return false;
      if (tierFilter !== 'all' && item.difficultyTier !== tierFilter) return false;
      if (item.anilistId && seenAnilist.has(item.anilistId)) return false;
      const norm = item.title.trim().toLowerCase();
      if (seenTitles.has(norm)) return false;
      if (item.anilistId) seenAnilist.add(item.anilistId);
      seenTitles.add(norm);
      return true;
    });

    return [...localMatched, ...extraLive];
  }, [section, tierFilter, searchQuery, liveResults]);

  const universalPortals = useMemo(() => {
    const portals = getUniversalDirectSearchPortals(searchQuery);
    if (section === 'Semua') return portals;
    const filtered = portals.filter((p) => p.section === section);
    return filtered.length > 0 ? filtered : portals;
  }, [searchQuery, section]);

  const visibleItems = filteredItems.slice(0, visibleLimit);
  const hasMore = visibleLimit < filteredItems.length;

  const handleSelectSection = (nextSection: CatalogSection) => {
    setSection(nextSection);
    setVisibleLimit(pageSize);
  };

  const handleSelectTier = (nextTier: DifficultyTier) => {
    setTierFilter(nextTier);
    setVisibleLimit(pageSize);
  };

  const handleExternalLaunch = (title: string, siteName: string) => {
    try {
      void navigator.clipboard?.writeText(title);
      toast.success(
        `Membuka ${siteName} • Judul 「${title}」 disalin ke clipboard!`
      );
    } catch {
      toast.success(`Membuka ${siteName}...`);
    }
  };

  const handleCopyTitle = async (title: string) => {
    try {
      await navigator.clipboard.writeText(title);
      toast.success(`Judul 「${title}」 berhasil disalin!`);
    } catch {
      toast.error('Gagal menyalin judul');
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter & Search Bar */}
      <div className="card-pro p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(pageSize);
              }}
              placeholder="Ketik judul anime, novel, manga, VN, game, atau drama apa saja..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition"
            />
            {searchingLive ? (
              <Loader2 className="w-4 h-4 text-rose-600 animate-spin absolute right-3 top-3" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-700 absolute right-3 top-3 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {DIFFICULTY_FILTERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => handleSelectTier(tier.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  tierFilter === tier.id
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-slate-900'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spreadsheet Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {SECTION_ORDER.map((sec) => {
            const active = section === sec;
            const count = sectionCounts[sec] ?? 0;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => handleSelectSection(sec)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-rose-300 hover:text-slate-900'
                }`}
              >
                <span>{sec}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Universal 1-Click Direct Launch Bar whenever user types ANY safe search query */}
      {searchQuery.trim().length > 0 && universalPortals.length > 0 && (
        <div className="card-pro p-4 border-rose-200 bg-rose-50/40 space-y-2.5 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
              <Globe className="w-4 h-4 text-rose-600" />
              <span>
                Buka & Cari Langsung 「{searchQuery.trim()}」 (1-Klik Tinggal
                Pencet):
              </span>
              {searchingLive && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Mencari di database Bettermelon / AniList / VNDB...
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                onStartMedia(
                  searchQuery.trim(),
                  section === 'Novels'
                    ? 'light_novel'
                    : section === 'Manga'
                      ? 'manga'
                      : section === 'Visual Novels' || section === 'Video Games'
                        ? 'visual_novel'
                        : section === 'Drama & TV'
                          ? 'movie'
                          : section === 'Podcasts'
                            ? 'audio'
                            : section === 'YouTube' || section === 'VTubers'
                              ? 'video'
                              : 'anime',
                  30
                )
              }
              className="px-3 py-1 rounded-lg bg-white hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Catat Sesi "{searchQuery.trim()}"
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {universalPortals.map((portal) => (
              <a
                key={portal.id}
                href={portal.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  handleExternalLaunch(searchQuery.trim(), portal.siteName)
                }
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs hover:opacity-95 transition ${portal.badgeColor}`}
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>{portal.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-slate-500 app-canvas-subtitle px-1">
        <span>
          Menampilkan {visibleItems.length} dari {filteredItems.length} judul
          {section !== 'Semua' ? ` di ${section}` : ''}
          {liveResults.length > 0
            ? ` (termasuk +${liveResults.length} hasil pencarian live Bettermelon/AniList/VNDB)`
            : ''}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {ALL_ITEMS.length.toLocaleString('id-ID')}+ Katalog Bawaan + Live
            Search Semua Judul (Bettermelon • Epub.moe • Cinejoy • MangaDex •
            VNDB • Steam)
          </span>
        </div>
      </div>

      {/* Grid */}
      {visibleItems.length === 0 ? (
        <div className="card-pro p-10 text-center space-y-2">
          <BookOpen className="w-6 h-6 text-rose-600 mx-auto opacity-70" />
          <p className="text-sm font-bold text-slate-900">
            Tidak ada media yang cocok dengan pencarianmu.
          </p>
          <button
            type="button"
            onClick={() => {
              setSection('Semua');
              setTierFilter('all');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-rose-600 underline cursor-pointer"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        <div
          key={`${section}-${tierFilter}`}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-tab-in"
        >
          {visibleItems.map((item, idx) => {
            const meta = getCategoryMeta(item.category);
            const destinations = getCatalogMediaDestinations(item);
            const blurb =
              item.difficultyExplanation ||
              item.description ||
              item.exampleVideo ||
              'Rekomendasi media immersion berbahasa Jepang.';

            return (
              <div
                key={item.id}
                style={{ animationDelay: `${Math.min(idx % pageSize, 8) * 35}ms` }}
                className="card-pro-interactive p-4 flex flex-col justify-between gap-3.5 group animate-fade-up"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5">
                    <a
                      href={destinations.primary.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        handleExternalLaunch(
                          item.title,
                          destinations.primary.siteName
                        )
                      }
                      title={`${destinations.primary.label} (${item.title})`}
                      className="shrink-0"
                    >
                      <MediaCover
                        title={item.title}
                        category={item.category}
                        coverImage={item.coverImage}
                        className="w-16 h-22 rounded-xl"
                      />
                    </a>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${getRankingBadgeStyle(
                            item.difficultyTier
                          )}`}
                        >
                          {item.ranking}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {item.section}
                        </span>
                      </div>
                      <a
                        href={destinations.primary.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          handleExternalLaunch(
                            item.title,
                            destinations.primary.siteName
                          )
                        }
                        className="block font-bold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-rose-700 hover:underline transition-colors"
                      >
                        {item.title}
                      </a>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span>
                          {meta.shortLabel} • ~{item.suggestedMinutes}m
                        </span>
                        <span className="text-rose-600 font-sans font-bold">
                          • {destinations.primary.siteName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {blurb}
                  </p>

                  {item.bmStats &&
                    (item.bmStats.uniqueKanji ||
                      item.bmStats.speechSpeed ||
                      item.bmStats.wordCount) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {item.bmStats.jlptLevel && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[10px] font-mono font-bold text-rose-700">
                            JLPT {item.bmStats.jlptLevel}
                          </span>
                        )}
                        {item.bmStats.uniqueKanji && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-700">
                            {item.bmStats.uniqueKanji.toLocaleString('id-ID')}{' '}
                            kanji
                          </span>
                        )}
                        {item.bmStats.speechSpeed && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-700">
                            {item.bmStats.speechSpeed} mora/m
                          </span>
                        )}
                        {item.bmStats.wordCount && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-700">
                            {(item.bmStats.wordCount / 1000).toFixed(1)}k kata
                          </span>
                        )}
                      </div>
                    )}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <a
                    href={destinations.primary.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      handleExternalLaunch(
                        item.title,
                        destinations.primary.siteName
                      )
                    }
                    className="btn-crimson flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{destinations.primary.label}</span>
                  </a>

                  {destinations.quickSecondary && (
                    <a
                      href={destinations.quickSecondary.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        handleExternalLaunch(
                          item.title,
                          destinations.quickSecondary!.siteName
                        )
                      }
                      title={destinations.quickSecondary.description}
                      className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white border border-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0"
                    >
                      <span>{destinations.quickSecondary.shortLabel}</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onStartMedia(
                        item.title,
                        item.category,
                        item.suggestedMinutes
                      )
                    }
                    title="Catat sesi immersion untuk judul ini"
                    className="py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDetail(item)}
                    title="Lihat detail, sinopsis, & link alternatif"
                    className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-600 transition cursor-pointer shrink-0"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + pageSize)}
            className="px-6 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-600 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Muat {Math.min(pageSize, filteredItems.length - visibleLimit)} Judul
            Lainnya ({filteredItems.length - visibleLimit} tersisa)
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDetail(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4 animate-scale-in max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <MediaCover
                  title={selectedDetail.title}
                  category={selectedDetail.category}
                  coverImage={selectedDetail.coverImage}
                  className="w-16 h-22 rounded-xl"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getRankingBadgeStyle(
                        selectedDetail.difficultyTier
                      )}`}
                    >
                      {selectedDetail.ranking}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {selectedDetail.section}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedDetail.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedDetail.bmStats && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    Metrik Bahasa Bettermelon
                  </span>
                  {selectedDetail.bmStats.jlptLevel && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-mono font-bold">
                      JLPT {selectedDetail.bmStats.jlptLevel}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {selectedDetail.bmStats.bmDifficulty && (
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                      <div className="text-[10px] text-slate-500">
                        Difficulty Level
                      </div>
                      <div className="font-bold text-slate-900">
                        {selectedDetail.bmStats.bmDifficulty}
                        {selectedDetail.bmStats.bmScore
                          ? ` (${selectedDetail.bmStats.bmScore})`
                          : ''}
                      </div>
                    </div>
                  )}
                  {selectedDetail.bmStats.uniqueKanji && (
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                      <div className="text-[10px] text-slate-500">
                        Kanji Unik
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {selectedDetail.bmStats.uniqueKanji.toLocaleString(
                          'id-ID'
                        )}{' '}
                        kanji
                      </div>
                    </div>
                  )}
                  {selectedDetail.bmStats.speechSpeed && (
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                      <div className="text-[10px] text-slate-500">
                        Kecepatan Bicara
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {selectedDetail.bmStats.speechSpeed} mora/mnt
                      </div>
                    </div>
                  )}
                  {selectedDetail.bmStats.wordCount && (
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                      <div className="text-[10px] text-slate-500">
                        Total Kata
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {selectedDetail.bmStats.wordCount.toLocaleString(
                          'id-ID'
                        )}
                      </div>
                    </div>
                  )}
                  {selectedDetail.bmStats.uniqueWords && (
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                      <div className="text-[10px] text-slate-500">
                        Kosakata Unik
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {selectedDetail.bmStats.uniqueWords.toLocaleString(
                          'id-ID'
                        )}
                      </div>
                    </div>
                  )}
                  {selectedDetail.bmStats.speechDuration && (
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                      <div className="text-[10px] text-slate-500">
                        Durasi Dialog
                      </div>
                      <div className="font-mono font-bold text-slate-900">
                        {selectedDetail.bmStats.speechDuration}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedDetail.difficultyExplanation && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Catatan Tingkat Kesulitan
                </div>
                <p className="text-xs text-slate-800 leading-relaxed">
                  {selectedDetail.difficultyExplanation}
                </p>
              </div>
            )}

            {selectedDetail.description && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Sinopsis & Deskripsi
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedDetail.description}
                </p>
              </div>
            )}

            {selectedDetail.exampleVideo && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Contoh Konten / Video
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  {selectedDetail.exampleVideo}
                </p>
              </div>
            )}

            {/* Direct & Alternative Media Links */}
            {(() => {
              const dest = getCatalogMediaDestinations(selectedDetail);
              return (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Akses Langsung Media ({selectedDetail.section})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyTitle(selectedDetail.title)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      Salin Judul Jepang
                    </button>
                  </div>

                  <a
                    href={dest.primary.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      handleExternalLaunch(
                        selectedDetail.title,
                        dest.primary.siteName
                      )
                    }
                    className="btn-crimson w-full py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {dest.primary.label} — 「{selectedDetail.title}」
                    </span>
                    <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-md">
                      {dest.primary.siteName}
                    </span>
                  </a>

                  <p className="text-[11px] text-slate-500">
                    {dest.primary.description}
                  </p>

                  {dest.volumes && dest.volumes.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200/80 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Volume Tersedia di Epub.moe (Klik untuk Baca Langsung):
                      </div>
                      <div className="grid sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {dest.volumes.map((vol) => (
                          <div
                            key={vol.md5}
                            className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <span className="font-semibold text-slate-800 truncate">
                              {vol.title}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={`https://reader.epub.moe/?md5=${vol.md5}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold hover:bg-rose-700"
                              >
                                Baca
                              </a>
                              <a
                                href={`https://epub.moe/books/${vol.md5}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                              >
                                EPUB
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dest.alternatives.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200/80 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Sumber & Portal Alternatif:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {dest.alternatives.map((alt) => (
                          <a
                            key={alt.label}
                            href={alt.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              handleExternalLaunch(
                                selectedDetail.title,
                                alt.siteName
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-[11px] font-bold text-slate-700 hover:text-rose-700 inline-flex items-center gap-1 transition"
                          >
                            <ExternalLink className="w-3 h-3 text-rose-600" />
                            {alt.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = selectedDetail;
                  setSelectedDetail(null);
                  onStartMedia(
                    target.title,
                    target.category,
                    target.suggestedMinutes
                  );
                }}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Catat Sesi ({selectedDetail.suggestedMinutes}m)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
