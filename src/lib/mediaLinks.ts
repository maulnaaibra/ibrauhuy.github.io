import type { ImmersionCategory } from '../types';

export interface ExternalMediaLink {
  label: string;
  shortLabel: string;
  siteName: string;
  url: string;
  homeUrl: string;
  description: string;
}

export interface MediaDestinationSet {
  primary: ExternalMediaLink;
  alternatives: ExternalMediaLink[];
}

function normalizeTitleForSearch(rawTitle: string): string {
  return rawTitle
    .replace(/【[^】]*】/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCatalogMediaDestinations(params: {
  title: string;
  section?: string;
  category?: ImmersionCategory;
}): MediaDestinationSet {
  const cleanTitle = normalizeTitleForSearch(params.title || '');
  const q = encodeURIComponent(cleanTitle);
  const section = params.section ?? '';
  const category = params.category ?? 'anime';

  // 1. Anime -> https://bettermelon.ru/
  if (section === 'Anime') {
    return {
      primary: {
        label: 'Tonton di Bettermelon',
        shortLabel: 'Tonton Anime',
        siteName: 'Bettermelon.ru',
        url: `https://bettermelon.ru/?q=${q}&search=${q}`,
        homeUrl: 'https://bettermelon.ru/',
        description:
          'Streaming anime dengan subtitle bahasa Jepang interaktif di Bettermelon.ru.',
      },
      alternatives: [
        {
          label: 'Buka Beranda Bettermelon.ru',
          shortLabel: 'Bettermelon',
          siteName: 'Bettermelon.ru',
          url: 'https://bettermelon.ru/',
          homeUrl: 'https://bettermelon.ru/',
          description: 'Buka langsung katalog utama Bettermelon.ru.',
        },
        {
          label: 'Cari Subtitle JP di Jimaku.cc',
          shortLabel: 'Jimaku.cc',
          siteName: 'Jimaku.cc',
          url: `https://jimaku.cc/?q=${q}`,
          homeUrl: 'https://jimaku.cc/',
          description: 'Arsip subtitle bahasa Jepang untuk anime & film.',
        },
        {
          label: 'Lihat Info di AniList',
          shortLabel: 'AniList',
          siteName: 'AniList.co',
          url: `https://anilist.co/search/anime?search=${q}`,
          homeUrl: 'https://anilist.co/',
          description: 'Database episode, karakter, dan sinopsis anime.',
        },
      ],
    };
  }

  // 2. Novels -> https://epub.moe/
  if (
    section === 'Novels' ||
    category === 'light_novel' ||
    category === 'book'
  ) {
    return {
      primary: {
        label: 'Baca di Epub.moe',
        shortLabel: 'Baca Novel',
        siteName: 'Epub.moe',
        url: `https://epub.moe/?q=${q}&search=${q}`,
        homeUrl: 'https://epub.moe/',
        description:
          'Cari & baca EPUB light novel / buku bahasa Jepang di Epub.moe.',
      },
      alternatives: [
        {
          label: 'Buka Beranda Epub.moe',
          shortLabel: 'Epub.moe',
          siteName: 'Epub.moe',
          url: 'https://epub.moe/',
          homeUrl: 'https://epub.moe/',
          description: 'Buka halaman pencarian utama Epub.moe.',
        },
        {
          label: 'Buka Pembaca Ttu Ebook Reader',
          shortLabel: 'Ttu Reader',
          siteName: 'reader.ttsu.app',
          url: 'https://reader.ttsu.app/',
          homeUrl: 'https://reader.ttsu.app/',
          description:
            'Pembaca EPUB vertikal bahasa Jepang di browser (cocok dengan Yomitan).',
        },
        {
          label: 'Cari di BookWalker JP',
          shortLabel: 'BookWalker JP',
          siteName: 'BookWalker.jp',
          url: `https://bookwalker.jp/search/?word=${q}`,
          homeUrl: 'https://bookwalker.jp/',
          description: 'Preview & katalog resmi light novel bahasa Jepang.',
        },
      ],
    };
  }

  // 3. Drama & TV -> https://cinejoy.pk/
  if (section === 'Drama & TV' || category === 'movie') {
    return {
      primary: {
        label: 'Tonton di Cinejoy',
        shortLabel: 'Tonton Drama/TV',
        siteName: 'Cinejoy.pk',
        url: `https://cinejoy.pk/search?q=${q}`,
        homeUrl: 'https://cinejoy.pk/',
        description: 'Streaming drama, live-action, dan acara TV di Cinejoy.pk.',
      },
      alternatives: [
        {
          label: 'Buka Beranda Cinejoy.pk',
          shortLabel: 'Cinejoy.pk',
          siteName: 'Cinejoy.pk',
          url: 'https://cinejoy.pk/',
          homeUrl: 'https://cinejoy.pk/',
          description: 'Buka halaman utama Cinejoy.pk.',
        },
        {
          label: 'Cari Subtitle Drama JP di Jimaku.cc',
          shortLabel: 'Jimaku.cc',
          siteName: 'Jimaku.cc',
          url: `https://jimaku.cc/?q=${q}`,
          homeUrl: 'https://jimaku.cc/',
          description: 'Unduh subtitle bahasa Jepang untuk drama & TV.',
        },
        {
          label: 'Lihat Info di MyDramaList',
          shortLabel: 'MyDramaList',
          siteName: 'MyDramaList.com',
          url: `https://mydramalist.com/search?q=${q}`,
          homeUrl: 'https://mydramalist.com/',
          description: 'Informasi episode & pemeran drama Jepang.',
        },
      ],
    };
  }

  // 4. Manga -> Rawkuma / MangaDex / Bilingual Manga
  if (section === 'Manga' || category === 'manga') {
    return {
      primary: {
        label: 'Baca di Rawkuma',
        shortLabel: 'Baca Manga',
        siteName: 'Rawkuma.net',
        url: `https://rawkuma.net/?s=${q}`,
        homeUrl: 'https://rawkuma.net/',
        description:
          'Baca raw manga bahasa Jepang langsung berdasarkan judul di Rawkuma.',
      },
      alternatives: [
        {
          label: 'Cari di MangaDex',
          shortLabel: 'MangaDex',
          siteName: 'MangaDex.org',
          url: `https://mangadex.org/titles?q=${q}`,
          homeUrl: 'https://mangadex.org/',
          description: 'Cari bab & informasi manga di MangaDex.',
        },
        {
          label: 'Buka Bilingual Manga',
          shortLabel: 'Bilingual Manga',
          siteName: 'BilingualManga.org',
          url: 'https://bilingualmanga.org/manga',
          homeUrl: 'https://bilingualmanga.org/',
          description: 'Manga dwibahasa Jepang–Inggris dengan teks yang bisa diklik.',
        },
        {
          label: 'Cari di BookWalker Manga JP',
          shortLabel: 'BookWalker JP',
          siteName: 'BookWalker.jp',
          url: `https://bookwalker.jp/search/?word=${q}`,
          homeUrl: 'https://bookwalker.jp/',
          description: 'Baca sample gratis manga asli bahasa Jepang.',
        },
      ],
    };
  }

  // 5. Visual Novels -> VNDB / Steam / DLsite
  if (section === 'Visual Novels' || category === 'visual_novel') {
    return {
      primary: {
        label: 'Buka di VNDB',
        shortLabel: 'Buka VN',
        siteName: 'VNDB.org',
        url: `https://vndb.org/v?sq=${q}`,
        homeUrl: 'https://vndb.org/',
        description:
          'Halaman Visual Novel Database lengkap dengan link rilis resmi, durasi baca, & karakter.',
      },
      alternatives: [
        {
          label: 'Cari Visual Novel di Steam',
          shortLabel: 'Steam Store',
          siteName: 'Steam',
          url: `https://store.steampowered.com/search/?term=${q}`,
          homeUrl: 'https://store.steampowered.com/',
          description: 'Cari rilis PC Visual Novel di Steam Store.',
        },
        {
          label: 'Cari di DLsite JP',
          shortLabel: 'DLsite JP',
          siteName: 'DLsite.com',
          url: `https://www.dlsite.com/home/fsr/=/keyword/${q}`,
          homeUrl: 'https://www.dlsite.com/',
          description: 'Toko digital visual novel & indie game Jepang.',
        },
      ],
    };
  }

  // 6. Video Games -> Steam / YouTube JP Longplay / GameFAQs
  if (section === 'Video Games') {
    const jpWalkthroughQuery = encodeURIComponent(`${cleanTitle} 実況`);
    return {
      primary: {
        label: 'Cari Game di Steam',
        shortLabel: 'Buka Game',
        siteName: 'Steam Store',
        url: `https://store.steampowered.com/search/?term=${q}`,
        homeUrl: 'https://store.steampowered.com/',
        description: 'Cari halaman game & dukungan bahasa Jepang di Steam.',
      },
      alternatives: [
        {
          label: 'Tonton Walkthrough Bahasa Jepang (実況)',
          shortLabel: 'YouTube 実況',
          siteName: 'YouTube',
          url: `https://www.youtube.com/results?search_query=${jpWalkthroughQuery}`,
          homeUrl: 'https://www.youtube.com/',
          description:
            'Tonton gameplay & dialog bahasa Jepang penuh di YouTube.',
        },
        {
          label: 'Lihat Info di GameFAQs',
          shortLabel: 'GameFAQs',
          siteName: 'GameFAQs',
          url: `https://gamefaqs.gamespot.com/search?game=${q}`,
          homeUrl: 'https://gamefaqs.gamespot.com/',
          description: 'Panduan & database rilis video game.',
        },
      ],
    };
  }

  // 7. YouTube
  if (section === 'YouTube') {
    return {
      primary: {
        label: 'Tonton di YouTube',
        shortLabel: 'Buka YouTube',
        siteName: 'YouTube',
        url: `https://www.youtube.com/results?search_query=${q}`,
        homeUrl: 'https://www.youtube.com/',
        description: 'Buka channel atau video langsung di YouTube.',
      },
      alternatives: [],
    };
  }

  // 8. VTubers
  if (section === 'VTubers') {
    return {
      primary: {
        label: 'Buka Channel VTuber',
        shortLabel: 'Tonton VTuber',
        siteName: 'YouTube',
        url: `https://www.youtube.com/results?search_query=${q}`,
        homeUrl: 'https://www.youtube.com/',
        description: 'Buka channel & arsip live stream VTuber di YouTube.',
      },
      alternatives: [
        {
          label: 'Cari Klip Bahasa Jepang (切り抜き)',
          shortLabel: 'Klip 切り抜き',
          siteName: 'YouTube',
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
            `${cleanTitle} 切り抜き`
          )}`,
          homeUrl: 'https://www.youtube.com/',
          description: 'Klip pendek dengan subtitle bahasa Jepang (切り抜き).',
        },
      ],
    };
  }

  // 9. Podcasts / Audio
  if (section === 'Podcasts' || category === 'audio') {
    return {
      primary: {
        label: 'Dengar di Spotify',
        shortLabel: 'Buka Podcast',
        siteName: 'Spotify',
        url: `https://open.spotify.com/search/${q}/shows`,
        homeUrl: 'https://open.spotify.com/',
        description: 'Dengarkan episode podcast bahasa Jepang di Spotify.',
      },
      alternatives: [
        {
          label: 'Cari Episode di YouTube',
          shortLabel: 'YouTube Podcast',
          siteName: 'YouTube',
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(
            `${cleanTitle} podcast`
          )}`,
          homeUrl: 'https://www.youtube.com/',
          description: 'Cari episode podcast di YouTube.',
        },
      ],
    };
  }

  // Fallback for general anime / video
  if (category === 'anime') {
    return {
      primary: {
        label: 'Tonton di Bettermelon',
        shortLabel: 'Tonton Anime',
        siteName: 'Bettermelon.ru',
        url: `https://bettermelon.ru/?q=${q}&search=${q}`,
        homeUrl: 'https://bettermelon.ru/',
        description:
          'Streaming anime dengan subtitle bahasa Jepang di Bettermelon.ru.',
      },
      alternatives: [],
    };
  }

  return {
    primary: {
      label: 'Tonton di YouTube',
      shortLabel: 'Buka Media',
      siteName: 'YouTube',
      url: `https://www.youtube.com/results?search_query=${q}`,
      homeUrl: 'https://www.youtube.com/',
      description: 'Cari media immersion berdasarkan judul.',
    },
    alternatives: [],
  };
}
