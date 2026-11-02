/**
 * Keeps the hand-made translation files in step with the English ones.
 *
 *   npm run translations:sync
 *
 * For each hand-made language it:
 * - adds every missing key with an empty value "" (empty = not translated yet),
 * - keeps everything you've already translated, untouched,
 * - lists keys that no longer exist in English (they're kept, so nothing is lost;
 *   delete them yourself once you're sure).
 *
 * It never deletes or overwrites a translation.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRANSLATIONS = join(ROOT, 'translations');
const GENERATED_TEXT = join(ROOT, 'public', 'data', 'text', 'en');

/** Languages whose interface text is written by hand (all except English). */
const UI_LANGUAGES = ['es', 'eu'];
/** Languages whose game text is written by hand (the others are generated from the game). */
const GAME_TEXT_LANGUAGES = ['eu'];
const GAME_TEXT_DOMAINS = [
  'pokemon-names',
  'form-names',
  'genus',
  'move-names',
  'move-descriptions',
  'ability-names',
  'ability-descriptions',
  'item-names',
  'item-descriptions',
  'type-names',
  'alignment-names',
  'game-names',
];

type Json = string | { [key: string]: Json };

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
}

function writeJson(path: string, value: unknown): void {
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
    if (!(key in reference)) {
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
    if (!(key in reference)) {
      result[key] = value;
      report.obsolete.push(key);
    }
  }
  return result;
}

interface Report {
  file: string;
  added: number;
  obsolete: string[];
}

const reports: Report[] = [];

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

if (!existsSync(GENERATED_TEXT)) {
  console.warn('No generated English game text found in public/data/text/en — skipping game text.');
} else {
  for (const language of GAME_TEXT_LANGUAGES) {
    for (const domain of GAME_TEXT_DOMAINS) {
      const file = join(TRANSLATIONS, language, `${domain}.json`);
      const report: Report = { file: `translations/${language}/${domain}.json`, added: 0, obsolete: [] };
      writeJson(
        file,
        mergeFlat(
          readJson<Record<string, string>>(join(GENERATED_TEXT, `${domain}.json`), {}),
          readJson<Record<string, string>>(file, {}),
          report,
        ),
      );
      reports.push(report);
    }
    // Pokédex entries: one key per English entry, "species/first-game".
    const entries = readJson<Record<string, { games: string[] }[]>>(
      join(GENERATED_TEXT, 'dex-entries.json'),
      {},
    );
    const reference: Record<string, string> = {};
    for (const [species, groups] of Object.entries(entries)) {
      for (const group of groups) reference[`${species}/${group.games[0]}`] = '';
    }
    const file = join(TRANSLATIONS, language, 'dex-entries.json');
    const report: Report = { file: `translations/${language}/dex-entries.json`, added: 0, obsolete: [] };
    writeJson(file, mergeFlat(reference, readJson<Record<string, string>>(file, {}), report));
    reports.push(report);
  }
}

for (const report of reports) {
  const parts = [`${report.added} new key(s)`];
  if (report.obsolete.length > 0)
    parts.push(`${report.obsolete.length} no longer used: ${report.obsolete.join(', ')}`);
  console.log(`${report.file}: ${parts.join('; ')}`);
}
