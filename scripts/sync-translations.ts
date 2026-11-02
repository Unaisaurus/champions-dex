/**
 * Keeps the hand-made translation files in step with the English ones.
 *
 *   npm run translations:sync
 *
 * (The data updater also runs this after every update.)
 *
 * For each hand-made language it:
 * - adds every missing key with an empty value "" (empty = not translated yet),
 * - keeps everything you've already translated, untouched,
 * - lists translated keys that no longer exist in English (they're kept, so
 *   nothing is lost; delete them yourself once you're sure). Untranslated (empty)
 *   leftovers are simply removed.
 *
 * Spanish game text comes from the game itself, so for Spanish only the
 * Pokédex entries the sources don't have get empty slots to fill in
 * (translations/es/dex-entries.json).
 *
 * It never deletes or overwrites a translation.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TEXT_DOMAINS } from '../src/data/contracts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRANSLATIONS = join(ROOT, 'translations');
const GENERATED_TEXT = join(ROOT, 'public', 'data', 'text');

/** Languages whose interface text is written by hand (all except English). */
const UI_LANGUAGES = ['es', 'eu'];
/** Languages whose game text is written entirely by hand. */
const GAME_TEXT_LANGUAGES = ['eu'];
/** Languages with generated Pokédex entries that may still miss some species. */
const PARTIAL_DEX_LANGUAGES = ['es'];

type Json = string | { [key: string]: Json };
type DexEntries = Record<string, Array<{ games: string[] }>>;

interface Report {
  file: string;
  added: number;
  obsolete: string[];
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Merges nested interface strings: reference order, existing values kept, missing ones "". */
function mergeNested(reference: Json, target: Json | undefined, path: string, report: Report): Json {
  if (typeof reference === 'string') {
    if (typeof target === 'string') return target;
    report.added += 1;
    return '';
  }
  const source = typeof target === 'object' ? target : {};
  const result: Record<string, Json> = {};
  for (const [key, child] of Object.entries(reference)) {
    result[key] = mergeNested(child, source[key], path ? `${path}.${key}` : key, report);
  }
  for (const [key, child] of Object.entries(source)) {
    // Keys that no longer exist: kept if translated, dropped if still empty.
    if (!(key in reference) && child !== '') {
      result[key] = child;
      report.obsolete.push(path ? `${path}.${key}` : key);
    }
  }
  return result;
}

function mergeFlat(reference: Record<string, string>, target: Record<string, string>, report: Report) {
  const result: Record<string, string> = {};
  for (const key of Object.keys(reference)) {
    if (typeof target[key] === 'string') result[key] = target[key];
    else {
      result[key] = '';
      report.added += 1;
    }
  }
  for (const [key, value] of Object.entries(target)) {
    if (!(key in reference) && value !== '') {
      result[key] = value;
      report.obsolete.push(key);
    }
  }
  return result;
}

/** One key per English Pokédex entry group: "species/first-game". */
function dexKeys(entries: DexEntries, onlySpecies?: ReadonlySet<string>): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const [species, groups] of Object.entries(entries)) {
    if (onlySpecies && !onlySpecies.has(species)) continue;
    for (const group of groups) keys[`${species}/${group.games[0]}`] = '';
  }
  return keys;
}

export function syncTranslations(): void {
  const reports: Report[] = [];
  const syncFile = (file: string, reference: Record<string, string>) => {
    const report: Report = { file: `translations/${file}`, added: 0, obsolete: [] };
    const full = join(TRANSLATIONS, file);
    writeJson(full, mergeFlat(reference, readJson<Record<string, string>>(full, {}), report));
    reports.push(report);
  };

  for (const language of UI_LANGUAGES) {
    const file = join(TRANSLATIONS, language, 'ui.json');
    const report: Report = { file: `translations/${language}/ui.json`, added: 0, obsolete: [] };
    const merged = mergeNested(
      readJson<Json>(join(TRANSLATIONS, 'en', 'ui.json'), {}),
      readJson<Json>(file, {}),
      '',
      report,
    );
    writeJson(file, merged);
    reports.push(report);
  }

  const english = join(GENERATED_TEXT, 'en');
  if (!existsSync(english)) {
    console.warn('No generated English game text found in public/data/text/en — skipping game text.');
  } else {
    const englishEntries = readJson<DexEntries>(join(english, 'dex-entries.json'), {});
    for (const language of GAME_TEXT_LANGUAGES) {
      for (const domain of TEXT_DOMAINS) {
        syncFile(
          `${language}/${domain}.json`,
          readJson<Record<string, string>>(join(english, `${domain}.json`), {}),
        );
      }
      syncFile(`${language}/dex-entries.json`, dexKeys(englishEntries));
    }
    for (const language of PARTIAL_DEX_LANGUAGES) {
      const own = readJson<DexEntries>(join(GENERATED_TEXT, language, 'dex-entries.json'), {});
      const missing = new Set(Object.keys(englishEntries).filter((species) => !own[species]?.length));
      syncFile(`${language}/dex-entries.json`, dexKeys(englishEntries, missing));
    }
  }

  for (const report of reports) {
    const parts = [`${report.added} new key(s)`];
    if (report.obsolete.length > 0) {
      const shown = report.obsolete.slice(0, 20).join(', ');
      parts.push(
        `${report.obsolete.length} no longer used: ${shown}${report.obsolete.length > 20 ? '…' : ''}`,
      );
    }
    console.log(`  ${report.file}: ${parts.join('; ')}`);
  }
}

// Run directly: npm run translations:sync
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncTranslations();
}
