/**
 * Pokédex entries in English and Spain Spanish, from every game that has them,
 * with games that share the same text grouped together.
 *
 * - PokéAPI: English for every game; Spanish from X and Y to Sword and Shield.
 * - Scarlet/Violet text dump: both languages for Scarlet and Violet.
 */
import type { DexEntriesFile } from '../../../src/data/contracts';
import { int } from '../lib/csv';
import { POKEAPI_LANGUAGE } from '../sources/pokeapi';
import { cleanDumpText, isPlaceholder } from '../sources/svText';
import type { Context } from './context';

export type TextLanguage = 'en' | 'es';
export const TEXT_LANGUAGES: readonly TextLanguage[] = ['en', 'es'];

/** Tidies PokéAPI text: joins hyphenated line breaks, fixes "POKéMON". */
export function cleanEntryText(text: string): string {
  return text
    .replace(/­\s*/g, '')
    .replace(/-\n/g, '-')
    .replace(/[\n\f\r]+/g, ' ')
    .replace(/POK[ée]MON/g, 'Pokémon')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Two texts count as the same entry if they only differ in spacing, case or punctuation. */
export function entryKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

interface Raw {
  versionId: number;
  text: string;
}

export interface DexEntriesResult {
  files: Record<TextLanguage, DexEntriesFile>;
  versionsUsed: Set<number>;
  /** Species without any entry, per language. */
  missing: Record<TextLanguage, string[]>;
}

export function buildDexEntries(ctx: Context, speciesNos: readonly number[]): DexEntriesResult {
  const wanted = new Set(speciesNos);
  const raw: Record<TextLanguage, Map<number, Raw[]>> = { en: new Map(), es: new Map() };
  const add = (language: TextLanguage, speciesNo: number, entry: Raw) => {
    const list = raw[language].get(speciesNo) ?? [];
    list.push(entry);
    raw[language].set(speciesNo, list);
  };

  for (const row of ctx.pokeapi.pokemon_species_flavor_text) {
    const speciesNo = int(row.species_id);
    if (!wanted.has(speciesNo)) continue;
    const language = TEXT_LANGUAGES.find((lang) => POKEAPI_LANGUAGE[lang] === row.language_id);
    if (!language) continue;
    add(language, speciesNo, { versionId: int(row.version_id), text: cleanEntryText(row.flavor_text ?? '') });
  }

  // Scarlet/Violet dump. Species up to #905 sit at their National Dex number;
  // Paldea's species are in another order, found by matching PokéAPI's English text.
  const scarlet = ctx.versionIdByIdentifier.get('scarlet');
  const violet = ctx.versionIdByIdentifier.get('violet');
  if (scarlet !== undefined && violet !== undefined) {
    const englishA = ctx.sv.file('eng', 'zukan_comment_A.dat');
    const indexByText = new Map<string, number>();
    englishA.forEach((line, index) => {
      if (!isPlaceholder(line)) indexByText.set(entryKey(cleanDumpText(line)), index);
    });
    const indexOf = (speciesNo: number): number | undefined => {
      if (speciesNo <= 905) return speciesNo;
      const known = (raw.en.get(speciesNo) ?? []).find((entry) => entry.versionId === scarlet);
      return known ? indexByText.get(entryKey(known.text)) : undefined;
    };
    for (const speciesNo of wanted) {
      const index = indexOf(speciesNo);
      if (index === undefined) continue;
      for (const [language, dumpLanguage] of [
        ['en', 'eng'],
        ['es', 'esp'],
      ] as const) {
        for (const [file, versionId] of [
          ['zukan_comment_A.dat', scarlet],
          ['zukan_comment_B.dat', violet],
        ] as const) {
          const line = ctx.sv.file(dumpLanguage, file)[index];
          if (!line || isPlaceholder(line)) continue;
          add(language, speciesNo, { versionId, text: cleanDumpText(line) });
        }
      }
    }
  }

  const versionsUsed = new Set<number>();
  const files: Record<TextLanguage, DexEntriesFile> = { en: {}, es: {} };
  const missing: Record<TextLanguage, string[]> = { en: [], es: [] };
  for (const language of TEXT_LANGUAGES) {
    for (const speciesNo of [...wanted].sort((a, b) => a - b)) {
      const species = ctx.species.get(speciesNo);
      if (!species) continue;
      const entries = (raw[language].get(speciesNo) ?? []).filter((entry) => entry.text);
      if (entries.length === 0) {
        missing[language].push(species.identifier);
        continue;
      }
      const groups = new Map<string, { versions: Set<number>; text: string; newest: number }>();
      for (const entry of entries.sort((a, b) => a.versionId - b.versionId)) {
        const key = entryKey(entry.text);
        const group = groups.get(key) ?? { versions: new Set<number>(), text: entry.text, newest: -1 };
        group.versions.add(entry.versionId);
        // Show the newest game's wording.
        if (entry.versionId >= group.newest) {
          group.newest = entry.versionId;
          group.text = entry.text;
        }
        groups.set(key, group);
      }
      files[language][species.identifier] = [...groups.values()]
        .map((group) => {
          const versions = [...group.versions].sort((a, b) => a - b);
          versions.forEach((v) => versionsUsed.add(v));
          return {
            first: versions[0] ?? 0,
            games: versions.map((v) => ctx.versionIdentifier.get(v) ?? String(v)),
            text: group.text,
          };
        })
        .sort((a, b) => a.first - b.first)
        .map(({ games, text }) => ({ games, text }));
    }
  }
  return { files, versionsUsed, missing };
}
