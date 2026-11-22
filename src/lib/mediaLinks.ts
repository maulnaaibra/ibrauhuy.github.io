import rawCatalog from '../data/immersionCatalog.json';
import type { ImmersionCategory } from '../types';

export interface EpubMoeVolume {
  md5: string;
  title: string;
}

export interface CatalogLinkMetadata {
  id?: string;
  title: string;
  section?: string;
  category?: ImmersionCategory;
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
}

export interface ExternalMediaLink {
  label: string;
  shortLabel: string;
  siteName: string;
  url: string;
  description: string;
}

export interface MediaDestinationSet {
  primary: ExternalMediaLink;
  quickSecondary?: ExternalMediaLink;
  alternatives: ExternalMediaLink[];
  volumes?: EpubMoeVolume[];
}

function normalizeTitleForSearch(rawTitle: string): string {
  return rawTitle
    .replace(/【[^】]*】/g, ' ')
    .replace(/（[^）]*）/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CATALOG_BY_TITLE = new Map<string, CatalogLinkMetadata>();
for (const entry of rawCatalog as CatalogLinkMetadata[]) {
  if (entry.title) {
    CATALOG_BY_TITLE.set(entry.title.trim().toLowerCase(), entry);
  }
}

export function getCatalogMediaDestinations(
  input: CatalogLinkMetadata
): MediaDestinationSet {
  const matched =
    CATALOG_BY_TITLE.get((input.title || '').trim().toLowerCase()) ?? {};
  const params: CatalogLinkMetadata = { ...matched, ...input };

  const cleanTitle = normalizeTitleForSearch(params.title || '');
  const q = encodeURIComponent(cleanTitle);
  const romajiQuery = encodeURIComponent(params.romajiTitle || cleanTitle);
  const section = params.section ?? '';
  const category = params.category ?? 'anime';

  // 1. Anime -> Bettermelon.ru direct /info/<anilist_id> & /watch/<anilist_id>/1 & /search?query=<q>
  if (section === 'Anime') {
    const infoUrl = params.anilistId
      ? `https://bettermelon.ru/info/${params.anilistId}`
      : params.directUrl || `https://bettermelon.ru/search?query=${q}`;
    const watchEp1Url = params.anilistId
      ? `https://bettermelon.ru/watch/${params.anilistId}/1`
      : params.watchUrl;

    const alternatives: ExternalMediaLink[] = [];
    if (watchEp1Url) {
      alternatives.push({
        label: 'Putar Episode 1 Langsung (Bettermelon)',
        shortLabel: 'Ep 1',
        siteName: 'Bettermelon.ru',
        url: watchEp1Url,
        description:
          'Langsung buka pemutar Episode 1 dengan subtitle bahasa Jepang di Bettermelon.',
      });
    }
    alternatives.push({
      label: 'Halaman Pencarian Bettermelon',
      shortLabel: 'Cari Bettermelon',
      siteName: 'Bettermelon.ru',
      url: `https://bettermelon.ru/search?query=${q}`,
      description: 'Cari judul anime ini di katalog Bettermelon.ru.',
    });
    if (params.sourceUrl) {
      alternatives.push({
        label: 'Lihat Halaman AniList',
        shortLabel: 'AniList',
        siteName: 'AniList.co',
        url: params.sourceUrl,
        description: 'Detail episode & informasi resmi di AniList.',
      });
    }
    alternatives.push({
      label: 'Cari Subtitle JP di Jimaku.cc',
      shortLabel: 'Jimaku.cc',
      siteName: 'Jimaku.cc',
      url: `https://jimaku.cc/?q=${q}`,
      description: 'Arsip file subtitle bahasa Jepang (.srt / .ass).',
    });

    return {
      primary: {
        label: 'Tonton di Bettermelon',
        shortLabel: 'Tonton Anime',
        siteName: 'Bettermelon.ru',
        url: infoUrl,
        description: params.anilistId
          ? `Langsung menuju halaman anime ini di Bettermelon.ru (ID #${params.anilistId}).`
          : 'Langsung mencari judul anime ini di Bettermelon.ru.',
      },
      quickSecondary: watchEp1Url
        ? {
            label: 'Putar Ep 1',
            shortLabel: 'Ep 1',
            siteName: 'Bettermelon.ru',
            url: watchEp1Url,
            description: 'Langsung putar Episode 1 di Bettermelon.ru.',
          }
        : undefined,
      alternatives,
    };
  }

  // 2. Novels -> Epub.moe direct reader.epub.moe/?md5=<md5> & download /books/<md5>/download
  if (
    section === 'Novels' ||
    category === 'light_novel' ||
    category === 'book'
  ) {
    if (params.epubMoeMd5) {
      const readerUrl = `https://reader.epub.moe/?md5=${params.epubMoeMd5}`;
      const downloadUrl =
        params.downloadUrl ||
        `https://epub.moe/books/${params.epubMoeMd5}/download`;

      const alternatives: ExternalMediaLink[] = [
        {
          label: 'Unduh File EPUB Langsung (Epub.moe)',
          shortLabel: 'Unduh EPUB',
          siteName: 'Epub.moe',
          url: downloadUrl,
          description: 'Unduh file .epub bahasa Jepang langsung dari Epub.moe.',
        },
        {
          label: 'Buka Portal Pencarian Epub.moe',
          shortLabel: 'Epub.moe',
          siteName: 'Epub.moe',
          url: 'https://epub.moe/',
          description: 'Cari volume lain di Epub.moe (judul otomatis disalin).',
        },
      ];
      if (params.sourceUrl) {
        alternatives.push({
          label: 'Halaman Info Buku (AniList / Bookmeter)',
          shortLabel: 'Info Buku',
          siteName: params.sourceUrl.includes('bookmeter')
            ? 'Bookmeter'
            : 'AniList',
          url: params.sourceUrl,
          description: 'Lihat ulasan dan detail novel.',
        });
      }
      alternatives.push({
        label: 'Cari di BookWalker JP',
        shortLabel: 'BookWalker JP',
        siteName: 'BookWalker.jp',
        url: `https://bookwalker.jp/search/?word=${q}`,
        description: 'Preview resmi light novel bahasa Jepang.',
      });

      return {
        primary: {
          label: 'Baca di Epub.moe',
          shortLabel: 'Baca Novel',
          siteName: 'reader.epub.moe',
          url: readerUrl,
          description:
            'Langsung membuka novel ini di pembaca web Epub.moe (reader.epub.moe).',
        },
        quickSecondary: {
          label: 'Unduh EPUB',
          shortLabel: 'EPUB',
          siteName: 'Epub.moe',
          url: downloadUrl,
          description: 'Unduh file EPUB langsung dari Epub.moe.',
        },
        alternatives,
        volumes: params.epubMoeVolumes,
      };
    }

    const isAozora = Boolean(params.sourceUrl?.includes('aozora.gr.jp'));
    const primaryUrl = isAozora
      ? params.sourceUrl!
      : params.directUrl || `https://bookwalker.jp/search/?word=${q}`;

    const alternatives: ExternalMediaLink[] = [
      {
        label: 'Cari EPUB di Epub.moe (Judul Otomatis Disalin)',
        shortLabel: 'Epub.moe',
        siteName: 'Epub.moe',
        url: 'https://epub.moe/',
        description:
          'Buka Epub.moe dan tempel (Ctrl+V) judul yang sudah disalin otomatis.',
      },
      {
        label: 'Cari di BookWalker JP',
        shortLabel: 'BookWalker JP',
        siteName: 'BookWalker.jp',
        url: `https://bookwalker.jp/search/?word=${q}`,
        description: 'Langsung cari judul novel ini di BookWalker JP.',
      },
    ];
    if (params.sourceUrl && !isAozora) {
      alternatives.push({
        label: 'Halaman Info Buku (AniList / Bookmeter)',
        shortLabel: 'Info Buku',
        siteName: params.sourceUrl.includes('bookmeter')
          ? 'Bookmeter'
          : 'AniList',
        url: params.sourceUrl,
        description: 'Lihat halaman referensi novel ini.',
      });
    }

    return {
      primary: {
        label: isAozora ? 'Baca di Aozora Bunko' : 'Buka Novel Langsung',
        shortLabel: 'Baca Novel',
        siteName: isAozora ? 'Aozora.gr.jp' : 'BookWalker JP',
        url: primaryUrl,
        description: isAozora
          ? 'Langsung membuka teks lengkap sastra Jepang di Aozora Bunko.'
          : 'Langsung menuju halaman pencarian judul novel ini.',
      },
      quickSecondary: {
        label: 'Epub.moe',
        shortLabel: 'Epub.moe',
        siteName: 'Epub.moe',
        url: 'https://epub.moe/',
        description: 'Buka Epub.moe (judul otomatis disalin ke clipboard).',
      },
      alternatives,
    };
  }

  // 3. Drama & TV -> Cinejoy.pk direct search with English/Romaji title + MyDramaList page
  if (section === 'Drama & TV' || category === 'movie') {
    const cinejoyUrl =
      params.directUrl || `https://cinejoy.pk/search?q=${romajiQuery}`;
    const alternatives: ExternalMediaLink[] = [];

    if (params.sourceUrl) {
      alternatives.push({
        label: 'Buka Halaman Drama (MyDramaList)',
        shortLabel: 'MyDramaList',
        siteName: 'MyDramaList.com',
        url: params.sourceUrl,
        description: 'Halaman detail drama/TV langsung di MyDramaList.',
      });
    }
    alternatives.push({
      label: 'Cari dengan Judul Jepang di Cinejoy.pk',
      shortLabel: 'Cinejoy (JP)',
      siteName: 'Cinejoy.pk',
      url: `https://cinejoy.pk/search?q=${q}`,
      description: 'Cari menggunakan judul huruf Jepang di Cinejoy.pk.',
    });
    alternatives.push({
      label: 'Cari Subtitle Drama JP di Jimaku.cc',
      shortLabel: 'Jimaku.cc',
      siteName: 'Jimaku.cc',
      url: `https://jimaku.cc/?q=${q}`,
      description: 'Unduh subtitle bahasa Jepang untuk drama & film.',
    });

    return {
      primary: {
        label: 'Tonton di Cinejoy',
        shortLabel: 'Tonton Drama/TV',
        siteName: 'Cinejoy.pk',
        url: cinejoyUrl,
        description: `Langsung mencari "${params.romajiTitle || cleanTitle}" di Cinejoy.pk.`,
      },
      quickSecondary: params.sourceUrl
        ? {
            label: 'Info Drama',
            shortLabel: 'MDL',
            siteName: 'MyDramaList',
            url: params.sourceUrl,
            description: 'Lihat halaman drama di MyDramaList.',
          }
        : undefined,
      alternatives,
    };
  }

  // 4. Manga -> Direct MangaDex /title/<uuid> + Rawkuma
  if (section === 'Manga' || category === 'manga') {
    const primaryUrl = params.mangadexId
      ? `https://mangadex.org/title/${params.mangadexId}`
      : params.directUrl || `https://rawkuma.net/?s=${romajiQuery}`;
    const rawkumaUrl = `https://rawkuma.net/?s=${romajiQuery}`;

    const alternatives: ExternalMediaLink[] = [
      {
        label: 'Cari Raw Manga di Rawkuma',
        shortLabel: 'Rawkuma',
        siteName: 'Rawkuma.net',
        url: rawkumaUrl,
        description: 'Cari raw manga bahasa Jepang di Rawkuma.',
      },
      {
        label: 'Cari di Rawkuma (Judul Jepang)',
        shortLabel: 'Rawkuma (JP)',
        siteName: 'Rawkuma.net',
        url: `https://rawkuma.net/?s=${q}`,
        description: 'Cari dengan huruf Jepang di Rawkuma.',
      },
      {
        label: 'Cari di BookWalker Manga JP',
        shortLabel: 'BookWalker JP',
        siteName: 'BookWalker.jp',
        url: `https://bookwalker.jp/search/?word=${q}`,
        description: 'Baca sample gratis manga asli bahasa Jepang.',
      },
    ];
    if (params.sourceUrl) {
      alternatives.push({
        label: 'Halaman AniList Manga',
        shortLabel: 'AniList',
        siteName: 'AniList.co',
        url: params.sourceUrl,
        description: 'Halaman informasi manga di AniList.',
      });
    }

    return {
      primary: {
        label: params.mangadexId ? 'Baca di MangaDex' : 'Baca Manga Langsung',
        shortLabel: 'Baca Manga',
        siteName: params.mangadexId ? 'MangaDex.org' : 'AniList / Rawkuma',
        url: primaryUrl,
        description: params.mangadexId
          ? 'Langsung membuka halaman komik ini di MangaDex.'
          : 'Langsung membuka halaman manga ini.',
      },
      quickSecondary: {
        label: 'Rawkuma',
        shortLabel: 'Raw',
        siteName: 'Rawkuma.net',
        url: rawkumaUrl,
        description: 'Cari raw bahasa Jepang di Rawkuma.net.',
      },
      alternatives,
    };
  }

  // 5. Visual Novels -> Direct VNDB page (https://vndb.org/v...)
  if (section === 'Visual Novels' || category === 'visual_novel') {
    if (section === 'Video Games') {
      // Handled in section 6 below
    } else {
      const vndbUrl =
        params.directUrl || params.sourceUrl || `https://vndb.org/v?sq=${q}`;
      const steamUrl = `https://store.steampowered.com/search/?term=${q}`;

      return {
        primary: {
          label: 'Buka di VNDB',
          shortLabel: 'Buka VN',
          siteName: 'VNDB.org',
          url: vndbUrl,
          description:
            'Langsung membuka halaman Visual Novel ini di VNDB (lengkap dengan link rilis resmi & Steam/DLsite).',
        },
        quickSecondary: {
          label: 'Steam',
          shortLabel: 'Steam',
          siteName: 'Steam Store',
          url: steamUrl,
          description: 'Cari Visual Novel ini di Steam Store.',
        },
        alternatives: [
          {
            label: 'Cari Visual Novel di Steam Store',
            shortLabel: 'Steam',
            siteName: 'Steam',
            url: steamUrl,
            description: 'Cari rilis PC Visual Novel di Steam.',
          },
          {
            label: 'Cari di DLsite JP',
            shortLabel: 'DLsite JP',
            siteName: 'DLsite.com',
            url: `https://www.dlsite.com/home/fsr/=/keyword/${q}`,
            description: 'Cari rilis digital bahasa Jepang di DLsite.',
          },
        ],
      };
    }
  }

  // 6. Video Games -> Direct Backloggd / Steam / YouTube JP Longplay
  if (section === 'Video Games') {
    const primaryUrl =
      params.directUrl ||
      params.sourceUrl ||
      `https://store.steampowered.com/search/?term=${romajiQuery}`;
    const jpWalkthroughUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `${cleanTitle} 実況`
    )}`;
    const steamUrl = `https://store.steampowered.com/search/?term=${romajiQuery}`;

    return {
      primary: {
        label: 'Buka Halaman Game',
        shortLabel: 'Buka Game',
        siteName: params.directUrl?.includes('backloggd')
          ? 'Backloggd'
          : 'Steam Store',
        url: primaryUrl,
        description: 'Langsung membuka halaman detail video game ini.',
      },
      quickSecondary: {
        label: 'Gameplay JP',
        shortLabel: '実況',
        siteName: 'YouTube',
        url: jpWalkthroughUrl,
        description: 'Tonton walkthrough bahasa Jepang (実況) di YouTube.',
      },
      alternatives: [
        {
          label: 'Cari Game di Steam Store',
          shortLabel: 'Steam Store',
          siteName: 'Steam',
          url: steamUrl,
          description: 'Cari halaman rilis PC di Steam Store.',
        },
        {
          label: 'Tonton Walkthrough Bahasa Jepang (実況)',
          shortLabel: 'YouTube 実況',
          siteName: 'YouTube',
          url: jpWalkthroughUrl,
          description: 'Tonton gameplay bahasa Jepang penuh di YouTube.',
        },
      ],
    };
  }

  // 7. YouTube & 8. VTubers -> Direct YouTube Channel & Direct Sample Video
  if (section === 'YouTube' || section === 'VTubers') {
    const channelUrl =
      params.directUrl ||
      params.sourceUrl ||
      `https://www.youtube.com/results?search_query=${q}`;
    const sampleVideoUrl = params.watchUrl || params.sampleUrl;

    const alternatives: ExternalMediaLink[] = [];
    if (sampleVideoUrl) {
      alternatives.push({
        label: 'Putar Video / Stream Contoh Langsung',
        shortLabel: 'Putar Video',
        siteName: 'YouTube',
        url: sampleVideoUrl,
        description:
          'Langsung memutar video rekomendasi dari channel ini di YouTube.',
      });
    }
    alternatives.push({
      label: 'Cari Video Terbaru di YouTube',
      shortLabel: 'Cari Video',
      siteName: 'YouTube',
      url: `https://www.youtube.com/results?search_query=${q}`,
      description: 'Lihat daftar video dari channel ini di YouTube.',
    });

    return {
      primary: {
        label:
          section === 'VTubers'
            ? 'Buka Channel VTuber'
            : 'Buka Channel YouTube',
        shortLabel: 'YouTube',
        siteName: 'YouTube.com',
        url: channelUrl,
        description: 'Langsung menuju halaman channel resmi di YouTube.',
      },
      quickSecondary: sampleVideoUrl
        ? {
            label: 'Putar Video',
            shortLabel: 'Video',
            siteName: 'YouTube.com',
            url: sampleVideoUrl,
            description: 'Langsung putar contoh video dari channel ini.',
          }
        : undefined,
      alternatives,
    };
  }

  // 9. Podcasts -> Direct Spotify Show URL / Official Podcast Site
  if (section === 'Podcasts' || category === 'audio') {
    const showUrl =
      params.directUrl ||
      params.sourceUrl ||
      `https://open.spotify.com/search/${q}/shows`;
    const isSpotify = showUrl.includes('spotify.com');

    return {
      primary: {
        label: isSpotify ? 'Dengar di Spotify' : 'Buka Situs Podcast',
        shortLabel: 'Dengar Podcast',
        siteName: isSpotify ? 'Spotify' : 'Podcast Web',
        url: showUrl,
        description:
          'Langsung membuka halaman podcast ini di Spotify / situs resminya.',
      },
      alternatives: [
        {
          label: 'Cari Episode di YouTube',
          shortLabel: 'YouTube',
          siteName: 'YouTube',
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
            `${cleanTitle} podcast`
          )}`,
          description: 'Dengarkan episode podcast ini di YouTube.',
        },
      ],
    };
  }

  // Default fallback for general anime
  return {
    primary: {
      label: 'Tonton di Bettermelon',
      shortLabel: 'Tonton Anime',
      siteName: 'Bettermelon.ru',
      url: `https://bettermelon.ru/search?query=${q}`,
      description: 'Cari & tonton anime dengan subtitle Jepang di Bettermelon.',
    },
    alternatives: [],
  };
}
