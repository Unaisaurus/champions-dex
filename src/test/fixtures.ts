/**
 * Small, hand-checked game data used by the tests. Values match the real game
 * (e.g. Venusaur's base stats) but only a tiny slice of it is included.
 */
import type { Ability, Alignment, Form, Item, LearnsetEntry, Move, Rules, TypesFile } from '@/data/contracts';
import type { ValidationContext } from '@/domain/validation';

export const rules: Rules = {
  level: 50,
  teamSize: 6,
  movesPerPokemon: 4,
  statPoints: { total: 66, perStat: 32 },
  alignment: { raisePercent: 110, lowerPercent: 90, affectsHp: false },
  statFormula: 'champions-v1',
  mechanics: { mega: true, tera: false },
  formatRules: { speciesClause: true, itemClause: true },
};

export const alignments: Alignment[] = [
  { id: 'hardy', raises: null, lowers: null },
  { id: 'adamant', raises: 'atk', lowers: 'spa' },
  { id: 'modest', raises: 'spa', lowers: 'atk' },
  { id: 'timid', raises: 'spe', lowers: 'atk' },
];

/** A partial type chart with the real values for the pairs the tests use. */
export const typesFile: TypesFile = {
  types: ['normal', 'fire', 'water', 'electric', 'grass', 'ground', 'flying', 'rock', 'ghost', 'steel'],
  chart: {
    normal: { rock: 0.5, ghost: 0, steel: 0.5 },
    fire: { fire: 0.5, water: 0.5, grass: 2, rock: 0.5, steel: 2 },
    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2 },
    electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2 },
    grass: { fire: 0.5, water: 2, grass: 0.5, ground: 2, flying: 0.5, rock: 2, steel: 0.5 },
    ground: { fire: 2, electric: 2, grass: 0.5, flying: 0, rock: 2, steel: 2 },
    flying: { electric: 0.5, grass: 2, rock: 0.5, steel: 0.5 },
    rock: { fire: 2, ground: 0.5, flying: 2, steel: 0.5 },
    ghost: { normal: 0, ghost: 2 },
    steel: { fire: 0.5, water: 0.5, electric: 0.5, rock: 2, steel: 0.5 },
  },
};

const noArt = {
  official: null,
  officialShiny: null,
  officialFemale: null,
  officialFemaleShiny: null,
  icon: null,
  iconShiny: null,
};

function form(partial: Partial<Form> & Pick<Form, 'id' | 'speciesId'>): Form {
  return {
    kind: 'base',
    display: 'entry',
    parentEntry: null,
    gameplayForm: null,
    availability: 'champions',
    battleOnly: false,
    generation: 1,
    lineGeneration: 1,
    types: ['normal'],
    baseStats: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 },
    abilities: [],
    heightDm: null,
    weightHg: null,
    color: null,
    megaStone: null,
    art: noArt,
    caveats: [],
    ...partial,
  };
}

export const forms: Form[] = [
  form({
    id: 'venusaur',
    speciesId: 'venusaur',
    types: ['grass', 'poison'],
    baseStats: { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 },
    abilities: ['overgrow', 'chlorophyll'],
  }),
  form({
    id: 'venusaur-mega',
    speciesId: 'venusaur',
    kind: 'mega',
    display: 'profile',
    parentEntry: 'venusaur',
    battleOnly: true,
    generation: 6,
    types: ['grass', 'poison'],
    baseStats: { hp: 80, atk: 100, def: 123, spa: 122, spd: 120, spe: 80 },
    abilities: ['thick-fat'],
    megaStone: 'venusaurite',
  }),
  form({ id: 'bulbasaur', speciesId: 'bulbasaur', availability: 'reference', types: ['grass', 'poison'] }),
  form({ id: 'charizard', speciesId: 'charizard', types: ['fire', 'flying'], abilities: ['blaze'] }),
  form({ id: 'vivillon', speciesId: 'vivillon', generation: 6, abilities: ['shield-dust'] }),
  form({
    id: 'vivillon-polar',
    speciesId: 'vivillon',
    kind: 'cosmetic',
    display: 'appearance',
    parentEntry: 'vivillon',
    gameplayForm: 'vivillon',
    generation: 6,
  }),
];

export const moves: Move[] = [
  { id: 'giga-drain', type: 'grass', category: 'special', power: 75, accuracy: 100, pp: 12 },
  { id: 'sludge-bomb', type: 'poison', category: 'special', power: 90, accuracy: 100, pp: 12 },
  { id: 'earth-power', type: 'ground', category: 'special', power: 90, accuracy: 100, pp: 12 },
  { id: 'protect', type: 'normal', category: 'status', power: null, accuracy: null, pp: 12 },
  { id: 'absorb', type: 'grass', category: 'special', power: 20, accuracy: 100, pp: 20, available: false },
  { id: 'quiver-dance', type: 'bug', category: 'status', power: null, accuracy: null, pp: 20 },
].map(({ available = true, ...move }) => ({
  ...move,
  priority: 0,
  target: 'selected-pokemon',
  makesContact: false,
  availableInChampions: available,
  caveats: [],
})) as Move[];

export const abilities: Ability[] = [
  'overgrow',
  'chlorophyll',
  'thick-fat',
  'blaze',
  'shield-dust',
  'levitate',
].map((id) => ({ id, availableInChampions: true, caveats: [] }));

export const items: Item[] = [
  {
    id: 'venusaurite',
    category: 'mega-stone',
    availableInChampions: true,
    icon: null,
    megaEvolutions: [{ from: 'venusaur', to: 'venusaur-mega' }],
    caveats: [],
  },
  {
    id: 'charizardite-x',
    category: 'mega-stone',
    availableInChampions: true,
    icon: null,
    megaEvolutions: [{ from: 'charizard', to: 'charizard-mega-x' }],
    caveats: [],
  },
  {
    id: 'choice-scarf',
    category: 'held',
    availableInChampions: true,
    icon: null,
    megaEvolutions: [],
    caveats: [],
  },
  {
    id: 'old-amber',
    category: 'other',
    availableInChampions: false,
    icon: null,
    megaEvolutions: [],
    caveats: [],
  },
];

const learn = (...ids: string[]): LearnsetEntry[] =>
  ids.map((move) => ({ move, methods: ['machine'], newInChampions: false }));

export const learnsets: Record<string, LearnsetEntry[]> = {
  venusaur: learn('giga-drain', 'sludge-bomb', 'earth-power', 'protect', 'absorb'),
  vivillon: learn('quiver-dance', 'protect'),
};

const byId = <T extends { id: string }>(list: readonly T[]) =>
  new Map(list.map((entry) => [entry.id, entry]));

export function validationContext(): ValidationContext {
  return {
    rules,
    forms: byId(forms),
    moves: byId(moves),
    abilities: byId(abilities),
    items: byId(items),
    alignments: byId(alignments),
    learnsets: new Map(Object.entries(learnsets)),
  };
}
