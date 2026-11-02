/**
 * PokéAPI's data tables (CSV): history, names, evolutions, earlier learnsets…
 * https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv
 */
import { parseCsv, type CsvRow } from '../lib/csv';
import { mapLimit, sourceFile } from '../lib/net';
import { SOURCES } from './config';

export const POKEAPI_TABLES = [
  'abilities',
  'evolution_triggers',
  'item_categories',
  'item_game_indices',
  'item_names',
  'items',
  'move_names',
  'move_targets',
  'moves',
  'natures',
  'pokemon',
  'pokemon_colors',
  'pokemon_evolution',
  'pokemon_form_names',
  'pokemon_forms',
  'pokemon_moves',
  'pokemon_species',
  'pokemon_species_flavor_text',
  'pokemon_species_names',
  'pokemon_stats',
  'pokemon_types',
  'region_names',
  'regions',
  'stats',
  'type_efficacy',
  'types',
  'version_groups',
  'version_names',
  'versions',
] as const;

export type PokeApiTable = (typeof POKEAPI_TABLES)[number];
export type PokeApiData = Record<PokeApiTable, CsvRow[]>;

/** PokéAPI language IDs used by the app. */
export const POKEAPI_LANGUAGE = { en: '9', es: '7' } as const;

export async function loadPokeApi(revision: string): Promise<PokeApiData> {
  const entries = await mapLimit(POKEAPI_TABLES, 6, async (table) => {
    const text = await sourceFile(SOURCES.pokeapi, revision, `data/v2/csv/${table}.csv`);
    return [table, parseCsv(text)] as const;
  });
  return Object.fromEntries(entries) as PokeApiData;
}
