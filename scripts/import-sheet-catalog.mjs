import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'immersionCatalog.json');

const SHEET_ID = '1w42HEKEu2AzZg9K7PI0ma9ICmr2qYEKQ9IF4XxFSnQU';

const TABS = [
  {
    section: 'Novels',
    gid: '2065345633',
    category: 'light_novel',
    suggestedMinutes: 35,
  },
  {
    section: 'Anime',
    gid: '1019246469',
    category: 'anime',
    suggestedMinutes: 24,
  },
  {
    section: 'Manga',
    gid: '1293737411',
    category: 'manga',
    suggestedMinutes: 30,
  },
  {
    section: 'Visual Novels',
    gid: '1514303440',
    category: 'visual_novel',
    suggestedMinutes: 45,
  },
  {
    section: 'Video Games',
    gid: '1564583131',
    category: 'visual_novel',
    suggestedMinutes: 45,
  },
  {
    section: 'Drama & TV',
    gid: '1215607333',
    category: 'movie',
    suggestedMinutes: 45,
  },
  {
    section: 'YouTube',
    gid: '1148532140',
    category: 'video',
    suggestedMinutes: 20,
  },
  {
    section: 'VTubers',
    gid: '2108034225',
    category: 'video',
    suggestedMinutes: 30,
  },
  {
    section: 'Podcasts',
    gid: '304582628',
    category: 'audio',
    suggestedMinutes: 25,
  },
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeTier(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return 'Umum';
  if (s.includes('very easy')) return 'Very Easy';
  if (s.startsWith('easy')) return 'Easy';
  if (s.startsWith('medium')) return 'Medium';
  if (s.includes('very hard') || s.includes('hell')) return 'Very Hard';
  if (s.startsWith('hard')) return 'Hard';
  return 'Umum';
}

function cleanText(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

async function fetchTab(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${tab.gid}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${tab.section}`);
  }
  const csvText = await res.text();
  const matrix = parseCsv(csvText);
  if (matrix.length < 2) return [];

  const headers = matrix[0].map((h) => cleanText(h).toLowerCase());
  const idx = (names) => headers.findIndex((h) => names.includes(h));

  const rankingIdx = idx(['ranking', 'difficulty']);
  const titleIdx = idx(['title', 'channel name']);
  const diffExpIdx = idx(['difficulty explanation']);
  const genreIdx = idx(['genre', 'company', 'medium']);
  const descIdx = idx(['description']);
  const sampleIdx = idx(['example video']);

  const items = [];
  for (let r = 1; r < matrix.length; r++) {
    const cols = matrix[r];
    const title = cleanText(cols[titleIdx >= 0 ? titleIdx : 1]);
    if (!title) continue;

    const rawRanking =
      rankingIdx >= 0 ? cleanText(cols[rankingIdx]) : '';
    const extraTag = genreIdx >= 0 ? cleanText(cols[genreIdx]) : '';
    const ranking = rawRanking || extraTag || 'Umum';
    const difficultyExplanation =
      diffExpIdx >= 0 ? cleanText(cols[diffExpIdx]) : '';
    const description = descIdx >= 0 ? cleanText(cols[descIdx]) : '';
    const exampleVideo = sampleIdx >= 0 ? cleanText(cols[sampleIdx]) : '';

    items.push({
      id: `${tab.gid}-${r}`,
      section: tab.section,
      category: tab.category,
      ranking,
      difficultyTier: normalizeTier(rawRanking),
      title,
      difficultyExplanation,
      description,
      exampleVideo: exampleVideo || undefined,
      suggestedMinutes: tab.suggestedMinutes,
    });
  }
  return items;
}

async function main() {
  const all = [];
  for (const tab of TABS) {
    const items = await fetchTab(tab);
    console.log(`${tab.section} (gid=${tab.gid}): ${items.length} items`);
    all.push(...items);
  }
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(all), 'utf8');
  console.log(`Total catalog entries written: ${all.length} -> ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
