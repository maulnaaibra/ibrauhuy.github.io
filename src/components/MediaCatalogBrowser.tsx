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
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Easy':
      return 'bg-[#fff3e8] text-[#59171b] border-[#f2c3a4]';
    case 'Medium':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Hard':
      return 'bg-rose-50 text-[#59171b] border-rose-200';
    case 'Very Hard':
      return 'bg-[#59171b] text-[#fed7b8] border-[#59171b]';
    default:
      return 'bg-[#f8efe8] text-[#5c3d40] border-[#e7d1c3]';
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
            <Search className="w-4 h-4 text-[#7c5659] absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(pageSize);
              }}
              placeholder="Cari judul novel, anime, manga, VN, atau kata kunci..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#fffaf6] border border-[#e7d1c3] text-sm font-medium text-[#241113] placeholder:text-[#8e6d70] focus:outline-none focus:border-[#59171b] focus:bg-white transition"
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
                    ? 'bg-[#59171b] text-[#fff8f2] border-[#59171b] shadow-xs'
                    : 'bg-white text-[#5c3d40] border-[#e7d1c3] hover:border-[#59171b]'
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition cursor-pointer inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-gradient-to-r from-[#59171b] to-[#83262c] text-[#fff8f2] border-[#59171b] shadow-xs'
                    : 'bg-[#fffaf6] text-[#5c3d40] border-[#ead6c9] hover:border-[#a9524c] hover:text-[#241113]'
                }`}
              >
                <span>{sec}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    active
                      ? 'bg-[#fed7b8]/25 text-[#fed7b8]'
                      : 'bg-[#f4e4d9] text-[#59171b]'
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
      <div className="flex items-center justify-between text-xs font-semibold text-[#5c3d40] app-canvas-subtitle px-1">
        <span>
          Menampilkan {visibleItems.length} dari {filteredItems.length} judul
          {section !== 'Semua' ? ` di ${section}` : ''}
        </span>
        <span className="font-mono">Total Katalog: {ALL_ITEMS.length} Media</span>
      </div>

      {/* Grid */}
      {visibleItems.length === 0 ? (
        <div className="card-pro p-10 text-center space-y-2">
          <BookOpen className="w-6 h-6 text-[#59171b] mx-auto opacity-60" />
          <p className="text-sm font-bold text-[#241113]">
            Tidak ada media yang cocok dengan pencarianmu.
          </p>
          <button
            type="button"
            onClick={() => {
              setSection('Semua');
              setTierFilter('all');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-[#59171b] underline cursor-pointer"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map((item) => {
            const meta = getCategoryMeta(item.category);
            const blurb =
              item.difficultyExplanation ||
              item.description ||
              item.exampleVideo ||
              'Rekomendasi media immersion berbahasa Jepang.';

            return (
              <div
                key={item.id}
                className="card-pro-interactive p-4 flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5">
                    <MediaCover
                      title={item.title}
                      category={item.category}
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
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c5659]">
                          {item.section}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-[#241113] leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                      <div className="text-[11px] font-mono text-[#5c3d40]">
                        {meta.shortLabel} • ~{item.suggestedMinutes} mnt/sesi
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#5c3d40] leading-relaxed line-clamp-3">
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

                  {(item.description || item.difficultyExplanation || item.exampleVideo) && (
                    <button
                      type="button"
                      onClick={() => setSelectedDetail(item)}
                      title="Lihat detail & sinopsis"
                      className="p-2 rounded-xl bg-[#fffaf6] hover:bg-[#fed7b8]/40 border border-[#e7d1c3] text-[#59171b] transition cursor-pointer"
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
            className="px-6 py-2.5 rounded-xl bg-white hover:bg-[#fff3e8] border border-[#dfc3b1] text-[#59171b] text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Muat {Math.min(pageSize, filteredItems.length - visibleLimit)} Judul
            Lainnya ({filteredItems.length - visibleLimit} tersisa)
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDetail && (
        <div
          className="fixed inset-0 z-50 bg-[#241113]/55 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDetail(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-[#fffdfb] border border-[#e7d1c3] p-6 shadow-2xl space-y-4 animate-scale-in max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <MediaCover
                  title={selectedDetail.title}
                  category={selectedDetail.category}
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
                    <span className="text-xs font-bold text-[#7c5659]">
                      {selectedDetail.section}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-[#241113]">
                    {selectedDetail.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-[#7c5659] hover:text-[#241113] hover:bg-[#f9ebe0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedDetail.difficultyExplanation && (
              <div className="p-3.5 rounded-xl bg-[#fff5ed] border border-[#f2d0ba] space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#59171b]">
                  Catatan Tingkat Kesulitan
                </div>
                <p className="text-xs text-[#241113] leading-relaxed">
                  {selectedDetail.difficultyExplanation}
                </p>
              </div>
            )}

            {selectedDetail.description && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7c5659]">
                  Sinopsis & Deskripsi
                </div>
                <p className="text-xs text-[#5c3d40] leading-relaxed">
                  {selectedDetail.description}
                </p>
              </div>
            )}

            {selectedDetail.exampleVideo && (
              <div className="p-3 rounded-xl bg-[#faf4ef] border border-[#e7d1c3] space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#7c5659]">
                  Contoh Konten / Video
                </div>
                <p className="text-xs font-semibold text-[#241113]">
                  {selectedDetail.exampleVideo}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#efe0d5]">
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 rounded-xl bg-white border border-[#e7d1c3] text-xs font-bold text-[#5c3d40] hover:text-[#241113] cursor-pointer"
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
