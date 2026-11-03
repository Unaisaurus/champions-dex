/**
 * Downloads the WikiDex page of every Pokémon in Champions (its current
 * wikitext and revision), for the Spanish Pokédex entries of the games before
 * X and Y. Saved to data/sources/wikidex/pages.json (a download cache, like
 * the other sources).
 *
 * WikiDex isn't reachable from everywhere, so this normally runs on GitHub
 * (.github/workflows/import-wikidex.yml). It asks for 20 pages at a time,
 * one request after another, and says who it is.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PAGES_FILE = join(ROOT, 'data', 'sources', 'wikidex', 'pages.json');
const API = 'https://www.wikidex.net/api.php';
const USER_AGENT =
  'ChampionsDex/1.0 (+https://github.com/Unaisaurus/champions-dex; one-off import of Pokédex texts)';

export interface WikidexPage {
  /** The page's title (after following redirects). */
  title: string;
  revision: number;
  timestamp: string;
  wikitext: string;
}

export interface PagesFile {
  retrieved: string;
  pages: Record<string, WikidexPage>;
  /** Species whose page wasn't found. */
  missing: string[];
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** The Spanish name of each species in Champions, which is its WikiDex page title. */
function championsSpecies(): Array<{ id: string; title: string }> {
  const forms = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'forms.json'), 'utf8')) as Array<{
    speciesId: string;
    availability: string;
  }>;
  const names = JSON.parse(
    readFileSync(join(ROOT, 'public', 'data', 'text', 'es', 'pokemon-names.json'), 'utf8'),
  ) as Record<string, string>;
  const ids = [...new Set(forms.filter((f) => f.availability === 'champions').map((f) => f.speciesId))];
  return ids.map((id) => ({ id, title: (names[id] ?? id).replace(/’/g, "'") }));
}

interface ApiResponse {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Array<{
      title: string;
      missing?: boolean;
      revisions?: Array<{ revid: number; timestamp: string; slots: { main: { content: string } } }>;
    }>;
  };
  error?: { info: string };
}

async function request(titles: string[]): Promise<ApiResponse> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'ids|timestamp|content',
    rvslots: 'main',
    redirects: '1',
    format: 'json',
    formatversion: '2',
    titles: titles.join('|'),
  });
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(`${API}?${params}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (response.ok) return (await response.json()) as ApiResponse;
      lastError = new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(2000 * attempt);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function downloadPages(): Promise<PagesFile> {
  const species = championsSpecies();
  const pages: Record<string, WikidexPage> = {};
  const missing: string[] = [];
  for (let start = 0; start < species.length; start += 20) {
    const batch = species.slice(start, start + 20);
    const result = await request(batch.map((s) => s.title));
    if (result.error) throw new Error(`WikiDex: ${result.error.info}`);
    const renamed = new Map<string, string>();
    for (const { from, to } of [...(result.query?.normalized ?? []), ...(result.query?.redirects ?? [])]) {
      renamed.set(from, to);
    }
    const final = (title: string) => {
      let current = title;
      for (let i = 0; i < 5 && renamed.has(current); i++) current = renamed.get(current) as string;
      return current;
    };
    const byTitle = new Map((result.query?.pages ?? []).map((page) => [page.title, page]));
    for (const { id, title } of batch) {
      const page = byTitle.get(final(title));
      const revision = page?.revisions?.[0];
      if (!page || page.missing || !revision) {
        missing.push(id);
        continue;
      }
      pages[id] = {
        title: page.title,
        revision: revision.revid,
        timestamp: revision.timestamp,
        wikitext: revision.slots.main.content,
      };
    }
    console.log(`  ${Math.min(start + 20, species.length)} of ${species.length} pages`);
    await sleep(1500);
  }
  return { retrieved: new Date().toISOString(), pages, missing };
}

async function main() {
  console.log('Downloading WikiDex pages');
  const file = await downloadPages();
  mkdirSync(dirname(PAGES_FILE), { recursive: true });
  writeFileSync(PAGES_FILE, JSON.stringify(file), 'utf8');
  console.log(
    `Saved ${Object.keys(file.pages).length} pages; not found: ${file.missing.join(', ') || 'none'}`,
  );
  if (Object.keys(file.pages).length === 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
