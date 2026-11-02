import { describe, expect, it } from 'vitest';
import type { Form, Species } from '@/data/contracts';
import {
  DEFAULT_QUERY,
  clearFilters,
  countActiveFilters,
  paramsFromQuery,
  queryFromParams,
  runPokedexQuery,
  sortValue,
  toggleValue,
  type PokedexQuery,
  type PokedexSource,
} from './pokedex';
import { buildSearchText } from './search';

// A tiny Pokédex: Charizard (with two Megas), Raichu and Alolan Raichu, Rotom and Wash Rotom.
// Base stats with the given Speed and total (the other four stats are 10 each; HP makes up the rest).
const stats = (spe: number, total = 300) => ({
  hp: total - 4 * 10 - spe,
  atk: 10,
  def: 10,
  spa: 10,
  spd: 10,
  spe,
});

function form(id: string, speciesId: string, extra: Partial<Form> = {}): Form {
  return {
    id,
    speciesId,
    kind: 'base',
    display: 'entry',
    parentEntry: null,
    gameplayForm: null,
    availability: 'champions',
    battleOnly: false,
    generation: 1,
    lineGeneration: 1,
    types: ['normal'],
    baseStats: stats(50),
    abilities: [],
    heightDm: 10,
    weightHg: 100,
    color: null,
    megaStone: null,
    art: {
      official: null,
      officialShiny: null,
      officialFemale: null,
      officialFemaleShiny: null,
      icon: null,
      iconShiny: null,
    },
    caveats: [],
    ...extra,
  };
}

function species(id: string, nationalDex: number, extra: Partial<Species> = {}): Species {
  return {
    id,
    nationalDex,
    generation: 1,
    color: 'red',
    gender: { kind: 'ratio', femaleEighths: 4 },
    isBaby: false,
    isLegendary: false,
    isMythical: false,
    categories: [],
    forms: [id],
    familyId: id,
    ...extra,
  };
}

const charizard = form('charizard', 'charizard', {
  types: ['fire', 'flying'],
  baseStats: stats(100, 534),
  abilities: ['blaze'],
});
const megaX = form('charizard-mega-x', 'charizard', {
  kind: 'mega',
  display: 'profile',
  parentEntry: 'charizard',
  battleOnly: true,
  generation: 6,
  types: ['fire', 'dragon'],
  baseStats: stats(100, 634),
  abilities: ['tough-claws'],
  heightDm: 17,
});
const megaY = form('charizard-mega-y', 'charizard', {
  kind: 'mega',
  display: 'profile',
  parentEntry: 'charizard',
  battleOnly: true,
  generation: 6,
  types: ['fire', 'flying'],
  baseStats: stats(100, 634),
  abilities: ['drought'],
});
const raichu = form('raichu', 'raichu', { types: ['electric'], baseStats: stats(110, 485), weightHg: 300 });
const raichuAlola = form('raichu-alola', 'raichu', {
  kind: 'regional',
  generation: 7,
  types: ['electric', 'psychic'],
  baseStats: stats(110, 485),
  weightHg: 210,
});
const rotom = form('rotom', 'rotom', {
  generation: 4,
  lineGeneration: 4,
  types: ['electric', 'ghost'],
  baseStats: stats(91, 440),
  heightDm: null,
});
const rotomWash = form('rotom-wash', 'rotom', {
  kind: 'other',
  display: 'profile',
  parentEntry: 'rotom',
  generation: 4,
  lineGeneration: 4,
  types: ['electric', 'water'],
  baseStats: stats(86, 520),
});

const speciesById = new Map([
  ['charizard', species('charizard', 6, { categories: ['starter'] })],
  ['raichu', species('raichu', 26, { color: 'yellow' })],
  ['rotom', species('rotom', 479, { generation: 4, color: 'red' })],
]);
const profiles = new Map([
  ['charizard', [megaX, megaY]],
  ['rotom', [rotomWash]],
]);
const names = new Map([
  ['charizard', 'Charizard'],
  ['charizard-mega-x', 'Charizard Mega Charizard X'],
  ['charizard-mega-y', 'Charizard Mega Charizard Y'],
  ['raichu', 'Raichu'],
  ['raichu-alola', 'Raichu Alolan Form'],
  ['rotom', 'Rotom'],
  ['rotom-wash', 'Rotom Wash Rotom'],
]);
const moves = new Map<string, string[]>([
  ['charizard', ['flamethrower', 'dragon-claw']],
  ['raichu', ['thunderbolt']],
  ['raichu-alola', ['thunderbolt', 'psychic']],
  ['rotom', ['thunderbolt']],
  ['rotom-wash', ['thunderbolt', 'hydro-pump']],
]);

function source(extra: Partial<PokedexSource> = {}): PokedexSource {
  return {
    entries: [charizard, raichu, raichuAlola, rotom],
    profilesOf: (id) => profiles.get(id) ?? [],
    species: (id) => speciesById.get(id),
    // Megas use their base form's moves.
    movesOf: (f) => new Set(moves.get(f.parentEntry && f.kind === 'mega' ? f.parentEntry : f.id) ?? []),
    canMegaEvolve: (f) => f.id === 'charizard',
    searchText: (id) => buildSearchText([names.get(id) ?? id]),
    displayName: (f) => names.get(f.id) ?? f.id,
    compareNames: (a, b) => a.localeCompare(b),
    favourites: new Set(),
    generationMode: 'family',
    ...extra,
  };
}

const run = (query: Partial<PokedexQuery>, extra?: Partial<PokedexSource>) =>
  runPokedexQuery(source(extra), { ...DEFAULT_QUERY, ...query }).map((row) => row.form.id);

describe('Pokédex list', () => {
  it('lists every entry in Pokédex order by default', () => {
    expect(run({})).toEqual(['charizard', 'raichu', 'raichu-alola', 'rotom']);
  });

  it('shows the form that matched a filter', () => {
    expect(run({ types: ['dragon'] })).toEqual(['charizard-mega-x']);
    expect(run({ types: ['water'] })).toEqual(['rotom-wash']);
    expect(run({ ability: 'drought' })).toEqual(['charizard-mega-y']);
    expect(run({ search: 'wash' })).toEqual(['rotom-wash']);
  });

  it('keeps the entry itself when it matches', () => {
    expect(run({ types: ['fire'] })).toEqual(['charizard']);
    expect(run({ search: 'charizard' })).toEqual(['charizard']);
  });

  it('lists every matching form when forms are shown separately', () => {
    expect(run({ types: ['fire'], listMode: 'forms' })).toEqual([
      'charizard',
      'charizard-mega-x',
      'charizard-mega-y',
    ]);
    expect(run({ listMode: 'forms' })).toHaveLength(7);
  });

  it('folds regional forms into their species when listing one card per species', () => {
    expect(run({ listMode: 'species' })).toEqual(['charizard', 'raichu', 'rotom']);
    // The card shows whichever form matched.
    expect(run({ listMode: 'species', types: ['psychic'] })).toEqual(['raichu-alola']);
    expect(run({ listMode: 'species', generations: [7] }, { generationMode: 'strict' })).toEqual([
      'raichu-alola',
    ]);
    expect(
      run({ listMode: 'species', favouritesOnly: true }, { favourites: new Set(['raichu-alola']) }),
    ).toEqual(['raichu-alola']);
  });

  it('needs all chosen types', () => {
    expect(run({ types: ['electric', 'psychic'] })).toEqual(['raichu-alola']);
  });

  it('filters by generation on the entry, in either mode', () => {
    // Alolan Raichu debuted in Gen 7 but its line in Gen 1.
    expect(run({ generations: [7] })).toEqual(['raichu-alola']);
    expect(run({ generations: [1] })).toEqual(['charizard', 'raichu', 'raichu-alola']);
    expect(run({ generations: [1] }, { generationMode: 'strict' })).toEqual(['charizard', 'raichu']);
    // Megas count as the entry's generation, not Gen 6.
    expect(run({ generations: [6], listMode: 'forms' })).toEqual([]);
  });

  it('filters by colour, category, favourites and moves', () => {
    expect(run({ colors: ['yellow'] })).toEqual(['raichu', 'raichu-alola']);
    expect(run({ categories: ['starter'] })).toEqual(['charizard']);
    expect(run({ categories: ['regional'] })).toEqual(['raichu-alola']);
    expect(run({ categories: ['mega'], listMode: 'forms' })).toEqual([
      'charizard',
      'charizard-mega-x',
      'charizard-mega-y',
    ]);
    expect(run({ favouritesOnly: true }, { favourites: new Set(['rotom']) })).toEqual(['rotom']);
    expect(run({ move: 'hydro-pump' })).toEqual(['rotom-wash']);
    expect(run({ move: 'dragon-claw', listMode: 'forms' })).toEqual([
      'charizard',
      'charizard-mega-x',
      'charizard-mega-y',
    ]);
  });

  it('finds Pokémon by number', () => {
    expect(run({ search: '#26' })).toEqual(['raichu', 'raichu-alola']);
  });

  it('sorts by stats, highest first, with unknown values last', () => {
    expect(run({ sort: 'spe', direction: 'desc' })).toEqual(['raichu', 'raichu-alola', 'charizard', 'rotom']);
    expect(run({ sort: 'total', direction: 'desc', listMode: 'forms' }).slice(0, 2)).toEqual([
      'charizard-mega-x',
      'charizard-mega-y',
    ]);
    expect(run({ sort: 'height', direction: 'asc' }).at(-1)).toBe('rotom');
    expect(run({ sort: 'height', direction: 'desc' }).at(-1)).toBe('rotom');
  });

  it('sorts by name and by weight', () => {
    expect(run({ sort: 'name', direction: 'desc' })).toEqual([
      'rotom',
      'raichu-alola',
      'raichu',
      'charizard',
    ]);
    expect(run({ sort: 'weight', direction: 'asc' })).toEqual([
      'charizard',
      'rotom',
      'raichu-alola',
      'raichu',
    ]);
  });

  it('works out sort values', () => {
    expect(sortValue(charizard, 'total')).toBe(534);
    expect(sortValue(charizard, 'spe')).toBe(100);
    expect(sortValue(rotom, 'height')).toBeNull();
    expect(sortValue(charizard, 'dex')).toBeNull();
  });
});

describe('Pokédex address', () => {
  it('round-trips a query', () => {
    const query: PokedexQuery = {
      ...DEFAULT_QUERY,
      search: 'char',
      sort: 'spe',
      direction: 'desc',
      generations: [1, 4],
      types: ['fire'],
      colors: ['red'],
      categories: ['starter', 'mega'],
      favouritesOnly: true,
      listMode: 'forms',
      move: 'thunderbolt',
      ability: 'levitate',
    };
    const params = paramsFromQuery(query);
    // Speed sorts highest-first by default, so the direction isn't written.
    expect(params.has('dir')).toBe(false);
    expect(queryFromParams(new URLSearchParams(params.toString()))).toEqual(query);
  });

  it('still reads addresses from before the three list modes', () => {
    expect(queryFromParams(new URLSearchParams('forms=1')).listMode).toBe('forms');
    expect(queryFromParams(new URLSearchParams('list=species')).listMode).toBe('species');
    expect(queryFromParams(new URLSearchParams('')).listMode).toBe('regional');
  });

  it('leaves defaults out of the address', () => {
    expect(paramsFromQuery(DEFAULT_QUERY).toString()).toBe('');
  });

  it('ignores anything malformed', () => {
    const query = queryFromParams(
      new URLSearchParams(
        'sort=nope&gen=1,99,x&types=fire,water,grass&colors=red,mauve&cat=starter,cool&move=Not%20An%20Id',
      ),
    );
    expect(query.sort).toBe('dex');
    expect(query.generations).toEqual([1]);
    expect(query.types).toEqual(['fire', 'water']);
    expect(query.colors).toEqual(['red']);
    expect(query.categories).toEqual(['starter']);
    expect(query.move).toBeNull();
  });

  it('counts and clears filters, keeping search and sorting', () => {
    const query: PokedexQuery = {
      ...DEFAULT_QUERY,
      search: 'x',
      sort: 'spe',
      types: ['fire'],
      generations: [1, 2],
    };
    expect(countActiveFilters(query)).toBe(3);
    expect(clearFilters(query)).toEqual({ ...DEFAULT_QUERY, search: 'x', sort: 'spe' });
  });

  it('toggles values, keeping at most two types', () => {
    expect(toggleValue(['fire'], 'water', 2)).toEqual(['fire', 'water']);
    expect(toggleValue(['fire', 'water'], 'grass', 2)).toEqual(['water', 'grass']);
    expect(toggleValue(['fire', 'water'], 'fire', 2)).toEqual(['water']);
  });
});
