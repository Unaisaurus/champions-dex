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
} as const satisfies Record<string, GitSource>;

export type SourceKey = keyof typeof SOURCES;
export type Revisions = Record<SourceKey, string>;
