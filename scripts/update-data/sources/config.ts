import type { GitSource } from '../lib/net';

/** Every external source the updater reads. All are public GitHub repositories. */
export const SOURCES = {
  champions: {
    id: 'champout',
    name: 'Pokémon Champions datamine (Project Pokémon)',
    repo: 'projectpokemon/champout',
    branch: 'main',
  },
  pokeapi: { id: 'pokeapi', name: 'PokéAPI data', repo: 'PokeAPI/pokeapi', branch: 'master' },
  sprites: { id: 'pokeapi-sprites', name: 'PokéAPI sprites', repo: 'PokeAPI/sprites', branch: 'master' },
  showdown: {
    id: 'showdown',
    name: 'Pokémon Showdown',
    repo: 'smogon/pokemon-showdown',
    branch: 'master',
  },
  // Game text: Scarlet/Violet's Spanish categories, and every Pokédex entry
  // PokéAPI doesn't have (Legends: Z-A, DLC, single forms). See docs/DATA-SOURCES.md.
  textDumps: {
    id: 'pokemon-text-dumps',
    name: 'Pokémon main series text dumps (tanripj)',
    repo: 'tanripj/pokemon_text_dumps',
    branch: 'main',
    pin: 'd67e1c3cbcf56571b84b1951a4d2dfc6619dc468',
  },
  // Brilliant Diamond and Shining Pearl's own text (PokéAPI has no entries for them).
  bdspText: {
    id: 'bdsp-text-dumps',
    name: 'Brilliant Diamond and Shining Pearl text dumps (tanripj)',
    repo: 'tanripj/bdsp_text_dumps',
    branch: 'master',
    pin: '1f94006a68387f041d11e06dc316ac5a5b8e888e',
  },
  zaText: {
    id: 'plza-text',
    name: 'Pokémon Legends: Z-A text dump with labels (CPokemon)',
    repo: 'CPokemon/plza-text',
    branch: 'main',
    pin: '3f149c41285b9fb290ab0b303d578545f569b663',
  },
  pkhex: {
    id: 'pkhex',
    name: 'PKHeX (game form tables)',
    repo: 'kwsch/PKHeX',
    branch: 'master',
    pin: '0660d1e1f4924b8478daec73281bb8071a82ad19',
  },
  towakey: {
    id: 'towakey-pokedex',
    name: 'Pokémon JSON API by towakey (Japanese Pokédex text per form)',
    repo: 'towakey/pokedex',
    branch: 'master',
    pin: '142c54d3f6a8c4ea790d0de28031ff68ae37aa29',
  },
} as const satisfies Record<string, GitSource>;

export type SourceKey = keyof typeof SOURCES;
export type Revisions = Record<SourceKey, string>;
