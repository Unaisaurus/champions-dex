/**
 * Spanish Pokédex entries for the games before X and Y (Red and Blue to
 * Black 2 and White 2), imported from WikiDex. No game text dump covers those
 * games in Spanish, so this is the one source for them.
 *
 *   npm run import-wikidex                 read the downloaded pages
 *   npm run import-wikidex -- --download   download them first (needs WikiDex)
 *
 * Writes data/wikidex/dex-entries-es.json (used by the data updater) and
 * data/wikidex/import-report.md (what was checked and corrected).
 *
 * Every entry is checked against the English entries of the same games:
 * - WikiDex often writes "perla = diamante" (Pearl's entry is Diamond's).
 *   Where the English shows the two games' entries really differ, that
 *   shortcut is wrong: the entry is taken from a game whose English entry is
 *   the same, if there's one with a Spanish text, or left out.
 * - data/overrides/wikidex.json holds corrections found by hand.
 * The report also measures WikiDex against the games' own Spanish text for X
 * and Y onwards, to show how reliable its copies are.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { downloadPages, PAGES_FILE, type PagesFile } from './download';
import {
  cleanWikiText,
  IMPORTED_PARAMETERS,
  isParameterName,
  leftoverMarkup,
  pokedexTemplate,
  templateParameters,
  WIKIDEX_GAMES,
} from './parse';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SNAPSHOT_FILE = join(ROOT, 'data', 'wikidex', 'dex-entries-es.json');
const REPORT_FILE = join(ROOT, 'data', 'wikidex', 'import-report.md');
const CORRECTIONS_FILE = join(ROOT, 'data', 'overrides', 'wikidex.json');

type DexFile = Record<string, Array<{ games: string[]; text: string }>>;

/** WikiDex's parameter for each imported game, e.g. `black-2` → `negro 2`. */
const PARAMETER_OF = new Map<string, string>(
  IMPORTED_PARAMETERS.flatMap((parameter) => WIKIDEX_GAMES[parameter]!.map((game) => [game, parameter])),
);
const OLD_GAMES = new Set(PARAMETER_OF.keys());

const CorrectionsSchema = z.object({
  note: z.string().optional(),
  corrections: z
    .record(
      z.string(),
      z.record(
        z.string(),
        z.union([
          z.object({ drop: z.literal(true), note: z.string() }),
          z.object({ use: z.string(), note: z.string() }),
        ]),
      ),
    )
    .default({}),
});

/** Equal apart from case, accents, spacing and punctuation. */
export const looseKey = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

/** Rough likeness of two texts (shared three-letter pieces, 0–1). */
export function likeness(a: string, b: string): number {
  const pieces = (text: string) => {
    const set = new Set<string>();
    for (const word of looseKey(text).split(' ')) {
      const padded = ` ${word} `;
      for (let i = 0; i + 3 <= padded.length; i++) set.add(padded.slice(i, i + 3));
    }
    return set;
  };
  const left = pieces(a);
  const right = pieces(b);
  let shared = 0;
  for (const piece of left) if (right.has(piece)) shared += 1;
  return left.size + right.size === 0 ? 0 : (2 * shared) / (left.size + right.size);
}

/** English entries this alike are the same entry, reworded a little ("could" → "can"). */
const SAME_ENTRY_LIKENESS = 0.7;

/** A game's entry and where it came from, following WikiDex's "same as" shortcuts. */
interface Found {
  text: string;
  /** The parameter whose text it is (itself, or the one it's a shortcut to). */
  from: string;
}

function followShortcuts(parameters: ReadonlyMap<string, string>, parameter: string): Found | null {
  let current = parameter;
  for (let step = 0; step < 6; step++) {
    const value = (parameters.get(current) ?? '').trim();
    if (isParameterName(value)) {
      current = value.toLowerCase();
      continue;
    }
    return value ? { text: cleanWikiText(value), from: current } : null;
  }
  return null;
}

export interface ImportResult {
  entries: Record<string, Record<string, string>>;
  /** Entries deliberately left out (no reliable Spanish text), by species. */
  leftOut: Record<string, string[]>;
  pages: Record<string, { title: string; revision: number }>;
  report: string[];
}

export function importEntries(
  file: PagesFile,
  english: DexFile,
  spanish: DexFile,
  corrections: z.infer<typeof CorrectionsSchema>['corrections'],
): ImportResult {
  const entries: Record<string, Record<string, string>> = {};
  const pages: Record<string, { title: string; revision: number }> = {};
  const corrected: string[] = [];
  const dropped: string[] = [];
  const leftOut: Record<string, string[]> = {};
  const leaveOut = (key: string, game: string, line: string) => {
    dropped.push(line);
    leftOut[key] = [...(leftOut[key] ?? []), game].sort();
  };
  const punctuated: string[] = [];
  const problems: string[] = [];
  let checkedNewer = 0;
  let sameNewer = 0;
  const newerDifferences: string[] = [];

  const englishOf = (key: string, game: string) => english[key]?.find((e) => e.games.includes(game))?.text;
  const spanishOf = (key: string, game: string) => spanish[key]?.find((e) => e.games.includes(game))?.text;

  for (const key of Object.keys(english).sort()) {
    const games = [...OLD_GAMES].filter((game) => englishOf(key, game));
    if (games.length === 0) continue;
    const page = file.pages[key];
    if (!page) {
      problems.push(`${key}: no WikiDex page downloaded (run with --download)`);
      continue;
    }
    pages[key] = { title: page.title, revision: page.revision };
    const template = pokedexTemplate(page.wikitext);
    if (!template) {
      problems.push(`${key}: the WikiDex page has no Pokédex template`);
      continue;
    }
    const parameters = templateParameters(template);

    // How reliable this page is: its entries for X and Y onwards against the games' own text.
    for (const [parameter, versions] of Object.entries(WIKIDEX_GAMES)) {
      if ((IMPORTED_PARAMETERS as readonly string[]).includes(parameter)) continue;
      const value = parameters.get(parameter) ?? '';
      if (!value || /\{\{|'''/.test(value)) continue; // per-form texts: not comparable
      const found = followShortcuts(parameters, parameter);
      for (const version of versions) {
        const game = spanishOf(key, version);
        if (!found || !game) continue;
        checkedNewer += 1;
        if (looseKey(found.text) === looseKey(game)) sameNewer += 1;
        else newerDifferences.push(`${key} (${version})`);
      }
    }

    const result: Record<string, string> = {};
    for (const game of games) {
      const where = `${key} (${game})`;
      const own = englishOf(key, game) as string;
      const correction = corrections[key]?.[game];
      if (correction && 'drop' in correction) {
        leaveOut(key, game, `${where}: ${correction.note} (data/overrides/wikidex.json)`);
        continue;
      }
      let text: string | undefined;
      if (correction && 'use' in correction) {
        text = OLD_GAMES.has(correction.use)
          ? followShortcuts(parameters, PARAMETER_OF.get(correction.use) as string)?.text
          : spanishOf(key, correction.use);
        if (!text) {
          problems.push(`${where}: the correction's "${correction.use}" has no Spanish text`);
          continue;
        }
        corrected.push(`${where}: ${correction.note} (data/overrides/wikidex.json)`);
      } else {
        const found = followShortcuts(parameters, PARAMETER_OF.get(game) as string);
        if (!found) {
          leaveOut(key, game, `${where}: no entry on WikiDex`);
          continue;
        }
        const fromGames = WIKIDEX_GAMES[found.from] ?? [];
        const sourceEnglish = fromGames.map((g) => englishOf(key, g)).find(Boolean);
        const shortcut = found.from !== PARAMETER_OF.get(game);
        if (
          !shortcut ||
          !sourceEnglish ||
          looseKey(sourceEnglish) === looseKey(own) ||
          likeness(sourceEnglish, own) >= SAME_ENTRY_LIKENESS
        ) {
          text = found.text;
        } else {
          // WikiDex says it's another game's entry, but the English shows it isn't.
          // A game whose English entry is this one: its Spanish, from WikiDex
          // (written out there, not a shortcut) or from the game's own text.
          const sameEnglish = [...new Set(english[key]?.flatMap((e) => e.games) ?? [])].filter(
            (g) => g !== game && looseKey(englishOf(key, g) ?? '') === looseKey(own),
          );
          const fromWikidex = sameEnglish
            .filter((g) => OLD_GAMES.has(g))
            .map((g) => ({ g, found: followShortcuts(parameters, PARAMETER_OF.get(g) as string) }))
            .find(({ g, found: f }) => f && f.from === PARAMETER_OF.get(g));
          const fromGame = sameEnglish.filter((g) => !OLD_GAMES.has(g)).find((g) => spanishOf(key, g));
          const via = `WikiDex gives ${game} the same entry as "${found.from}", but their English entries differ`;
          if (fromWikidex?.found) {
            text = fromWikidex.found.text;
            corrected.push(`${where}: ${via}; used ${fromWikidex.g}'s, whose English is the same`);
          } else if (fromGame) {
            text = spanishOf(key, fromGame);
            corrected.push(`${where}: ${via}; used ${fromGame}'s (from the game), whose English is the same`);
          } else {
            leaveOut(key, game, `${where}: ${via}, and no other game has the same English entry`);
            continue;
          }
        }
      }
      if (!text) continue;
      const markup = leftoverMarkup(text);
      if (markup) {
        problems.push(`${where}: leftover markup "${markup}"`);
        continue;
      }
      // Every entry ends with a full stop in the games; WikiDex sometimes leaves it out.
      if (/[\p{L}\p{N}]$/u.test(text)) {
        text = `${text}.`;
        punctuated.push(where);
      }
      result[game] = text;
    }
    if (Object.keys(result).length > 0) entries[key] = result;
  }

  const imported = Object.values(entries).reduce((sum, games) => sum + Object.keys(games).length, 0);
  const percent = (part: number, whole: number) => `${Math.round((1000 * part) / Math.max(whole, 1)) / 10}%`;
  const report = [
    '# Spanish Pokédex entries from WikiDex',
    '',
    `Pages retrieved ${file.retrieved}. ${imported} entries for ${Object.keys(entries).length} Pokémon, for the games before X and Y.`,
    '',
    '## How reliable WikiDex is',
    '',
    `For X and Y onwards, the app has the games' own Spanish text. On these pages, WikiDex's entries for those games match it in ${sameNewer} of ${checkedNewer} cases (${percent(sameNewer, checkedNewer)}, ignoring punctuation and case). Nearly all the differences are in X, Y, Omega Ruby and Alpha Sapphire, where WikiDex gives an older game's text that those games reworded.`,
    '',
    `## Corrected (${corrected.length})`,
    '',
    ...corrected.map((line) => `- ${line}`),
    '',
    `## Left out (${dropped.length})`,
    '',
    ...dropped.map((line) => `- ${line}`),
    '',
    `## Full stop added at the end (${punctuated.length})`,
    '',
    ...punctuated.map((line) => `- ${line}`),
    '',
    `## Problems (${problems.length})`,
    '',
    ...problems.map((line) => `- ${line}`),
    '',
    `## Entries for X onwards that differ from the games' text (${newerDifferences.length})`,
    '',
    newerDifferences.join(', '),
    '',
  ];
  return { entries, leftOut, pages, report };
}

async function main() {
  const download = process.argv.includes('--download');
  let file: PagesFile;
  if (download || !existsSync(PAGES_FILE)) {
    console.log('Downloading the WikiDex pages…');
    file = await downloadPages();
    mkdirSync(dirname(PAGES_FILE), { recursive: true });
    writeFileSync(PAGES_FILE, JSON.stringify(file), 'utf8');
  } else {
    file = JSON.parse(readFileSync(PAGES_FILE, 'utf8')) as PagesFile;
  }
  const read = (path: string) => JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as DexFile;
  const corrections = existsSync(CORRECTIONS_FILE)
    ? CorrectionsSchema.parse(JSON.parse(readFileSync(CORRECTIONS_FILE, 'utf8'))).corrections
    : {};
  const result = importEntries(
    file,
    read('public/data/text/en/dex-entries.json'),
    read('public/data/text/es/dex-entries.json'),
    corrections,
  );
  const snapshot = {
    note: 'Spanish Pokédex entries for the games before X and Y, from WikiDex (https://www.wikidex.net), made by `npm run import-wikidex`. See import-report.md for what was checked and corrected.',
    source: 'https://www.wikidex.net',
    retrieved: file.retrieved,
    pages: result.pages,
    leftOut: result.leftOut,
    entries: result.entries,
  };
  mkdirSync(dirname(SNAPSHOT_FILE), { recursive: true });
  writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(snapshot, null, 1)}\n`, 'utf8');
  writeFileSync(REPORT_FILE, result.report.join('\n'), 'utf8');
  console.log(result.report.slice(0, 7).join('\n'));
  console.log(`\nWrote ${SNAPSHOT_FILE} and ${REPORT_FILE}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
