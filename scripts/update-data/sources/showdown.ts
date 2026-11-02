/**
 * Pokémon Showdown's data files, used for cross-checks: event-only moves,
 * and which Pokémon and items Showdown's Champions mod treats as available.
 * https://github.com/smogon/pokemon-showdown
 */
import vm from 'node:vm';
import { transform } from 'esbuild';
import type { LearnMethod } from '../../../src/data/contracts';
import { sourceFile } from '../lib/net';
import { SOURCES } from './config';

export type Availability = 'available' | 'unavailable' | 'unknown';

export interface ShowdownData {
  /** Move → sources such as ["9M", "8L1", "6S0"] for one Showdown species ID (main games and both Legends games). */
  learnset(speciesId: string): Record<string, string[]> | undefined;
  itemStatus(itemId: string): Availability;
  speciesStatus(speciesId: string): Availability;
  /** Showdown's name for a species, form or cosmetic form ID: "Meowstic-F", "Vivillon-High Plains". */
  speciesName(showdownId: string): string | undefined;
}

/** Showdown's IDs: lowercase letters and digits only. */
export const toShowdownId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * The Showdown IDs a form may have, most likely first. Showdown writes genders
 * as letters ("Meowstic-F", "Meowstic-M-Mega") and drops words such as
 * "breed" and "plumage" ("Tauros-Paldea-Combat", "Squawkabilly-Blue").
 */
export function showdownCandidates(formId: string): string[] {
  const shorter = formId.replace(/-breed$/, '').replace(/-plumage$/, '');
  return [
    ...new Set([
      toShowdownId(formId),
      toShowdownId(shorter.replace(/-male(?=-|$)/, '').replace(/-female(?=-|$)/, '-f')),
      toShowdownId(shorter.replace(/-male(?=-|$)/, '-m').replace(/-female(?=-|$)/, '-f')),
    ]),
  ];
}

/**
 * Showdown learn-source letters → the app's learn methods. `V` (moves carried
 * over from the Virtual Console games) gives null: PokéAPI already covers those games.
 */
export function methodFromShowdownSource(source: string): LearnMethod | null {
  const letter = source.replace(/^\d+/, '').charAt(0);
  switch (letter) {
    case 'L':
      return 'level-up';
    case 'M':
      return 'machine';
    case 'T':
      return 'tutor';
    case 'E':
      return 'egg';
    case 'S':
      return 'event';
    case 'R':
      // Moves a form gets when it changes form (Rotom's appliance moves).
      return 'form-change';
    case 'D':
      // Pokémon Dream World promotions.
      return 'event';
    case 'V':
      return null;
    default:
      return 'other';
  }
}

/** Runs one of Showdown's TypeScript data files and returns what it exports. */
async function evaluate(code: string): Promise<Record<string, unknown>> {
  const { code: js } = await transform(code, { loader: 'ts', format: 'cjs', target: 'es2022' });
  const module = { exports: {} as Record<string, unknown> };
  // Data files only hold plain objects; anything they might import is replaced by a harmless stub.
  const stub: unknown = new Proxy(() => stub, { get: () => stub, apply: () => stub });
  vm.runInNewContext(js, { module, exports: module.exports, require: () => stub }, { timeout: 60_000 });
  return module.exports;
}

type Table = Record<string, Record<string, unknown>>;

export async function loadShowdown(revision: string): Promise<ShowdownData> {
  const file = (path: string) => sourceFile(SOURCES.showdown, revision, path);
  const [pokedex, learnsets, legendsArceus, legendsZa, items, formats] = await Promise.all([
    file('data/pokedex.ts').then(evaluate),
    file('data/learnsets.ts').then(evaluate),
    // The two Legends games keep their move pools in separate files.
    file('data/mods/gen8legends/learnsets.ts').then(evaluate),
    file('data/mods/gen9legends/learnsets.ts').then(evaluate),
    file('data/mods/champions/items.ts').then(evaluate),
    file('data/mods/champions/formats-data.ts').then(evaluate),
  ]);
  const learnsetTables = [learnsets, legendsArceus, legendsZa].map((m) => (m.Learnsets ?? {}) as Table);
  const itemTable = (items.Items ?? {}) as Table;
  const formatsTable = (formats.FormatsData ?? {}) as Table;
  // Species and forms by ID, plus cosmetic forms, which Showdown only lists by name.
  const speciesNames = new Map<string, string>();
  for (const [id, entry] of Object.entries((pokedex.Pokedex ?? {}) as Table)) {
    if (typeof entry.name === 'string') speciesNames.set(id, entry.name);
    const cosmetic = Array.isArray(entry.cosmeticFormes) ? (entry.cosmeticFormes as unknown[]) : [];
    for (const name of cosmetic) if (typeof name === 'string') speciesNames.set(toShowdownId(name), name);
  }

  return {
    learnset(speciesId) {
      const parts = learnsetTables
        .map((table) => table[speciesId]?.learnset as Record<string, string[]> | undefined)
        .filter((part): part is Record<string, string[]> => part !== undefined);
      if (parts.length === 0) return undefined;
      const merged: Record<string, string[]> = {};
      for (const part of parts) {
        for (const [move, sources] of Object.entries(part)) (merged[move] ??= []).push(...sources);
      }
      return merged;
    },
    itemStatus(itemId) {
      const entry = itemTable[toShowdownId(itemId)];
      if (!entry || !('isNonstandard' in entry)) return 'unknown';
      return entry.isNonstandard === null ? 'available' : 'unavailable';
    },
    speciesStatus(speciesId) {
      const entry = formatsTable[toShowdownId(speciesId)];
      if (!entry) return 'unknown';
      if (entry.isNonstandard || entry.tier === 'Illegal') return 'unavailable';
      return 'available';
    },
    speciesName: (showdownId) => speciesNames.get(showdownId),
  };
}
