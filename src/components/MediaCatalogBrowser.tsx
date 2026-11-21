import React, { useMemo, useState } from 'react';
import { BookOpen, Info, Play, Search, X } from 'lucide-react';
import rawCatalog from '../data/immersionCatalog.json';
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
  { id: 'Very Easy', label: 'Very Easy' },
  { id: 'Easy', label: 'Easy' },
  { id: 'Medium', label: 'Medium' },
  { id: 'Hard', label: 'Hard' },
  { id: 'Very Hard', label: 'Very Hard / Hell' },
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

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = { Semua: ALL_ITEMS.length };
    for (const item of ALL_ITEMS) {
      counts[item.section] = (counts[item.section] ?? 0) + 1;
    }
    return counts;
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_ITEMS.filter((item) => {
      if (section !== 'Semua' && item.section !== section) return false;
      if (tierFilter !== 'all' && item.difficultyTier !== tierFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.ranking.toLowerCase().includes(q) ||
        item.difficultyExplanation.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [section, tierFilter, searchQuery]);

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
              placeholder="Cari judul novel, anime, manga, VN, atau kata kunci..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition"
            />
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

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 app-canvas-subtitle px-1">
        <span>
          Menampilkan {visibleItems.length} dari {filteredItems.length} judul
          {section !== 'Semua' ? ` di ${section}` : ''}
        </span>
        <span className="font-mono">Total Katalog: {ALL_ITEMS.length} Media</span>
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
                    <MediaCover
                      title={item.title}
                      category={item.category}
                      coverImage={item.coverImage}
                      className="w-16 h-22 rounded-xl"
                    />
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
                      <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-rose-700 transition-colors">
                        {item.title}
                      </h3>
                      <div className="text-[11px] font-mono text-slate-500">
                        {meta.shortLabel} • ~{item.suggestedMinutes} mnt/sesi
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {blurb}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onStartMedia(
                        item.title,
                        item.category,
                        item.suggestedMinutes
                      )
                    }
                    className="btn-crimson flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Mulai Immersion
                  </button>

                  {(item.description ||
                    item.difficultyExplanation ||
                    item.exampleVideo) && (
                    <button
                      type="button"
                      onClick={() => setSelectedDetail(item)}
                      title="Lihat detail & sinopsis"
                      className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  )}
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
                className="btn-crimson px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Mulai Immersion ({selectedDetail.suggestedMinutes}m)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
