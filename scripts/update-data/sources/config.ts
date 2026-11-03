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
  svText: {
    id: 'pmsv',
    name: 'Pokémon Scarlet/Violet text dump',
    repo: 'giginet/PMSV',
    branch: 'main',
  },
  // Pokédex entries of single forms (Megas, regional forms, Rotom…) and of
  // Legends: Z-A, from the games' own text. See docs/DATA-SOURCES.md.
  zaText: {
    id: 'plza-text',
    name: 'Pokémon Legends: Z-A text dump',
    repo: 'CPokemon/plza-text',
    branch: 'main',
    pin: '3f149c41285b9fb290ab0b303d578545f569b663',
  },
  swshText: {
    id: 'swsh-text',
    name: 'Pokémon Sword/Shield text dump',
    repo: 'CPokemon/swsh-text',
    branch: 'master',
    pin: '76c6e4d50003403991ee00b282f7b6e77bf84b11',
  },
  laText: {
    id: 'pla-text',
    name: 'Pokémon Legends: Arceus text dump',
    repo: 'CPokemon/pla-text',
    branch: 'master',
    pin: '9b94ee8199b0d7f6bfb0d9c23a37a2a40937abbb',
  },
  usumText: {
    id: 'usum-data',
    name: 'Pokémon Ultra Sun/Ultra Moon text dump',
    repo: 'CPokemon/usum-data',
    branch: 'master',
    pin: '85e44888e2a49fc61bb988bd196992dae0e07704',
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
