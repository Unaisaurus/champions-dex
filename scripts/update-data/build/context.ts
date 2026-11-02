/**
 * The build context: every source, loaded once and indexed for quick lookups.
 * The build steps only read from it.
 */
import type { CsvRow } from '../lib/csv';
import { int } from '../lib/csv';
import type { ChampionsData } from '../sources/champions';
import type { PokeApiData } from '../sources/pokeapi';
import { POKEAPI_LANGUAGE } from '../sources/pokeapi';
import type { ShowdownData } from '../sources/showdown';
import type { SpriteIndex } from '../sources/sprites';
import type { SvText } from '../sources/svText';
import type { Overrides } from './overrides';
import type { Stats } from '../../../src/data/contracts';

export interface ApiSpecies {
  id: number;
  identifier: string;
  generation: number;
  evolvesFrom: number | null;
  chainId: number;
  color: string;
  /** Female chance in eighths, or -1 for genderless. */
  genderRate: number;
  isBaby: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  order: number;
}

export interface ApiPokemon {
  id: number;
  identifier: string;
  speciesId: number;
  heightDm: number;
  weightHg: number;
  isDefault: boolean;
}

export interface ApiForm {
  id: number;
  identifier: string;
  /** The part after the species name, e.g. `mega-x`, `alola`, `polar` ('' for plain default forms). */
  formIdentifier: string;
  pokemonId: number;
  isDefault: boolean;
  isBattleOnly: boolean;
  isMega: boolean;
  formOrder: number;
  generation: number | null;
}

export interface Sources {
  champions: ChampionsData;
  pokeapi: PokeApiData;
  sprites: SpriteIndex;
  showdown: ShowdownData;
  sv: SvText;
}

export interface Context extends Sources {
  overrides: Overrides;
  species: Map<number, ApiSpecies>;
  speciesByIdentifier: Map<string, ApiSpecies>;
  pokemon: Map<number, ApiPokemon>;
  pokemonByIdentifier: Map<string, ApiPokemon>;
  pokemonBySpecies: Map<number, ApiPokemon[]>;
  forms: Map<number, ApiForm>;
  formsByPokemon: Map<number, ApiForm[]>;
  /** Every PokéAPI form of a species, in PokéAPI's form order. */
  formsBySpecies: Map<number, ApiForm[]>;
  pokemonTypes: Map<number, string[]>;
  pokemonStats: Map<number, Stats>;
  typeIdentifier: Map<number, string>;
  moveIdentifier: Map<number, string>;
  itemIdentifier: Map<number, string>;
  itemIdByIdentifier: Map<string, number>;
  regionIdentifier: Map<number, string>;
  triggerIdentifier: Map<number, string>;
  versionIdentifier: Map<number, string>;
  versionIdByIdentifier: Map<string, number>;
  versionGroupOfVersion: Map<number, number>;
  generationOfVersionGroup: Map<number, number>;
  /** Natures in game order (Stat Alignments), with their raised/lowered stats. */
  natures: Array<{
    identifier: string;
    gameIndex: number;
    pokeapiId: number;
    raises: string;
    lowers: string;
  }>;
  /** PokéAPI names per language: table key → id → text. */
  apiNames: {
    species(language: keyof typeof POKEAPI_LANGUAGE, speciesId: number): string;
    genus(language: keyof typeof POKEAPI_LANGUAGE, speciesId: number): string;
    form(language: keyof typeof POKEAPI_LANGUAGE, formId: number): string;
    item(language: keyof typeof POKEAPI_LANGUAGE, itemId: number): string;
    region(language: keyof typeof POKEAPI_LANGUAGE, regionId: number): string;
    version(language: keyof typeof POKEAPI_LANGUAGE, versionId: number): string;
  };
}

export const STAT_FROM_POKEAPI: Record<string, keyof Stats> = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
};

function groupBy<T, K>(list: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of list) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

const identifiers = (rows: readonly CsvRow[]) =>
  new Map(rows.map((row) => [int(row.id), row.identifier ?? '']));

/** Builds a `language → id → name` lookup from a PokéAPI names table. */
function namesTable(rows: readonly CsvRow[], idColumn: string, textColumn: string) {
  const byLanguage = new Map<string, Map<number, string>>();
  for (const row of rows) {
    const language = row.local_language_id ?? '';
    const map = byLanguage.get(language) ?? new Map<number, string>();
    map.set(int(row[idColumn]), row[textColumn] ?? '');
    byLanguage.set(language, map);
  }
  return (language: keyof typeof POKEAPI_LANGUAGE, id: number) =>
    byLanguage.get(POKEAPI_LANGUAGE[language])?.get(id) ?? '';
}

export function buildContext(sources: Sources, overrides: Overrides): Context {
  const api = sources.pokeapi;
  const colorIdentifier = identifiers(api.pokemon_colors);
  const generationOfVersionGroup = new Map(
    api.version_groups.map((row) => [int(row.id), int(row.generation_id)]),
  );

  const species = new Map<number, ApiSpecies>();
  for (const row of api.pokemon_species) {
    const id = int(row.id);
    species.set(id, {
      id,
      identifier: row.identifier ?? '',
      generation: int(row.generation_id),
      evolvesFrom: row.evolves_from_species_id ? int(row.evolves_from_species_id) : null,
      chainId: int(row.evolution_chain_id),
      color: colorIdentifier.get(int(row.color_id)) ?? 'gray',
      genderRate: int(row.gender_rate),
      isBaby: row.is_baby === '1',
      isLegendary: row.is_legendary === '1',
      isMythical: row.is_mythical === '1',
      order: int(row.order),
    });
  }

  const pokemon = new Map<number, ApiPokemon>();
  for (const row of api.pokemon) {
    const id = int(row.id);
    pokemon.set(id, {
      id,
      identifier: row.identifier ?? '',
      speciesId: int(row.species_id),
      heightDm: int(row.height),
      weightHg: int(row.weight),
      isDefault: row.is_default === '1',
    });
  }

  const forms = new Map<number, ApiForm>();
  for (const row of api.pokemon_forms) {
    const id = int(row.id);
    const vg = row.introduced_in_version_group_id ? int(row.introduced_in_version_group_id) : null;
    forms.set(id, {
      id,
      identifier: row.identifier ?? '',
      formIdentifier: row.form_identifier ?? '',
      pokemonId: int(row.pokemon_id),
      isDefault: row.is_default === '1',
      isBattleOnly: row.is_battle_only === '1',
      isMega: row.is_mega === '1',
      formOrder: int(row.form_order),
      generation: vg === null ? null : (generationOfVersionGroup.get(vg) ?? null),
    });
  }
  const formsByPokemon = groupBy([...forms.values()], (form) => form.pokemonId);
  const formsBySpecies = new Map<number, ApiForm[]>();
  for (const form of forms.values()) {
    const speciesId = pokemon.get(form.pokemonId)?.speciesId;
    if (speciesId === undefined) continue;
    const list = formsBySpecies.get(speciesId) ?? [];
    list.push(form);
    formsBySpecies.set(speciesId, list);
  }
  for (const list of formsBySpecies.values()) {
    list.sort((a, b) => {
      const pa = pokemon.get(a.pokemonId);
      const pb = pokemon.get(b.pokemonId);
      // Default Pokémon first, then PokéAPI's own form order.
      return Number(pb?.isDefault) - Number(pa?.isDefault) || a.formOrder - b.formOrder || a.id - b.id;
    });
  }

  const typeIdentifier = identifiers(api.types);
  const pokemonTypes = new Map<number, string[]>();
  for (const [pokemonId, rows] of groupBy(api.pokemon_types, (row) => int(row.pokemon_id))) {
    pokemonTypes.set(
      pokemonId,
      rows
        .sort((a, b) => int(a.slot) - int(b.slot))
        .map((row) => typeIdentifier.get(int(row.type_id)) ?? 'normal'),
    );
  }

  const statIdentifier = identifiers(api.stats);
  const pokemonStats = new Map<number, Stats>();
  for (const row of api.pokemon_stats) {
    const stat = STAT_FROM_POKEAPI[statIdentifier.get(int(row.stat_id)) ?? ''];
    if (!stat) continue;
    const pokemonId = int(row.pokemon_id);
    const stats = pokemonStats.get(pokemonId) ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    stats[stat] = int(row.base_stat);
    pokemonStats.set(pokemonId, stats);
  }

  const versionIdentifier = identifiers(api.versions);
  const natures = api.natures
    .map((row) => ({
      identifier: row.identifier ?? '',
      gameIndex: int(row.game_index),
      pokeapiId: int(row.id),
      raises: STAT_FROM_POKEAPI[statIdentifier.get(int(row.increased_stat_id)) ?? ''] ?? 'atk',
      lowers: STAT_FROM_POKEAPI[statIdentifier.get(int(row.decreased_stat_id)) ?? ''] ?? 'atk',
    }))
    .sort((a, b) => a.gameIndex - b.gameIndex);

  const itemIdentifier = identifiers(api.items);
  const speciesNames = namesTable(api.pokemon_species_names, 'pokemon_species_id', 'name');
  const genusNames = namesTable(api.pokemon_species_names, 'pokemon_species_id', 'genus');

  return {
    ...sources,
    overrides,
    species,
    speciesByIdentifier: new Map([...species.values()].map((s) => [s.identifier, s])),
    pokemon,
    pokemonByIdentifier: new Map([...pokemon.values()].map((p) => [p.identifier, p])),
    pokemonBySpecies: groupBy([...pokemon.values()], (p) => p.speciesId),
    forms,
    formsByPokemon,
    formsBySpecies,
    pokemonTypes,
    pokemonStats,
    typeIdentifier,
    moveIdentifier: identifiers(api.moves),
    itemIdentifier,
    itemIdByIdentifier: new Map([...itemIdentifier].map(([id, identifier]) => [identifier, id])),
    regionIdentifier: identifiers(api.regions),
    triggerIdentifier: identifiers(api.evolution_triggers),
    versionIdentifier,
    versionIdByIdentifier: new Map([...versionIdentifier].map(([id, identifier]) => [identifier, id])),
    versionGroupOfVersion: new Map(api.versions.map((row) => [int(row.id), int(row.version_group_id)])),
    generationOfVersionGroup,
    natures,
    apiNames: {
      species: speciesNames,
      genus: genusNames,
      form: namesTable(api.pokemon_form_names, 'pokemon_form_id', 'form_name'),
      item: namesTable(api.item_names, 'item_id', 'name'),
      region: namesTable(api.region_names, 'region_id', 'name'),
      version: namesTable(api.version_names, 'version_id', 'name'),
    },
  };
}

/** The default Pokémon (and its default form) of a species. */
export function defaultPokemonOf(ctx: Context, speciesId: number): ApiPokemon | undefined {
  return ctx.pokemonBySpecies.get(speciesId)?.find((p) => p.isDefault);
}

export function defaultFormOf(ctx: Context, pokemonId: number): ApiForm | undefined {
  const list = ctx.formsByPokemon.get(pokemonId) ?? [];
  return list.find((form) => form.isDefault) ?? list[0];
}
