/**
 * How the game data and Smogon's damage calculator (@smogon/calc, which the
 * app's calculator uses) line up, for the update report: what the
 * calculator's own copy of the data lacks, and where the two disagree.
 *
 * Nothing here changes the data. The app's calculator always uses the game
 * data's base stats, types, move power, type, category and priority; the
 * calculator's copy adds details the game data doesn't keep (punch and sound
 * moves, multi-hit counts, which moves hit both opponents…).
 */
import { Generations, toID } from '@smogon/calc';
import type { CoreData, MoveKind } from '../../../src/data/contracts';
import { damageGeneration } from '../../../src/domain/damage/generation';

export interface CalculatorNotes {
  missing: string[];
  borrowed: string[];
  differences: string[];
}

const STAT_NAMES = {
  hp: 'HP',
  atk: 'Attack',
  def: 'Defense',
  spa: 'Sp. Atk',
  spd: 'Sp. Def',
  spe: 'Speed',
} as const;
const SPREAD = new Set(['allAdjacent', 'allAdjacentFoes']);
/** Move kinds the calculator keeps as flags of its own. */
export const KIND_FLAGS: ReadonlyArray<
  [MoveKind, 'punch' | 'sound' | 'bullet' | 'pulse' | 'bite' | 'slicing' | 'wind']
> = [
  ['punch', 'punch'],
  ['sound', 'sound'],
  ['ball', 'bullet'],
  ['pulse', 'pulse'],
  ['bite', 'bite'],
  ['slicing', 'slicing'],
  ['wind', 'wind'],
];
const ourSpread = (target: string) => target === 'all-opponents' || target === 'all-other-pokemon';

export function calculatorNotes(
  core: Pick<CoreData, 'forms' | 'moves' | 'abilities' | 'items' | 'alignments'>,
): CalculatorNotes {
  const generation = damageGeneration(core);
  const champions = Generations.get(0);
  const inChampions = {
    forms: new Set(core.forms.filter((form) => form.availability === 'champions').map((form) => form.id)),
    moves: new Set(core.moves.filter((move) => move.availableInChampions).map((move) => move.id)),
    abilities: new Set(
      core.abilities.filter((ability) => ability.availableInChampions).map((ability) => ability.id),
    ),
    items: new Set(core.items.filter((item) => item.availableInChampions).map((item) => item.id)),
  };
  const list = (kind: keyof typeof inChampions, ids: ReadonlySet<string>, label: string) =>
    [...ids].filter((id) => inChampions[kind].has(id)).map((id) => `${label} \`${id}\``);

  const missing = [
    ...list('forms', generation.missing.forms, 'Pokémon'),
    ...list('moves', generation.missing.moves, 'Move'),
    ...list('abilities', generation.missing.abilities, 'Ability'),
    ...list('items', generation.missing.items, 'Item'),
  ];
  const borrowed = [
    ...list('forms', generation.borrowed.forms, 'Pokémon'),
    ...list('moves', generation.borrowed.moves, 'Move'),
    ...list('abilities', generation.borrowed.abilities, 'Ability'),
    ...list('items', generation.borrowed.items, 'Item'),
  ];

  const differences: string[] = [];
  for (const form of core.forms) {
    if (form.availability !== 'champions' || form.display === 'appearance') continue;
    const name = generation.names.forms.get(form.id);
    const theirs = name ? champions.species.get(toID(name)) : undefined;
    if (!theirs) continue;
    const stats = (Object.keys(STAT_NAMES) as (keyof typeof STAT_NAMES)[])
      .filter((stat) => theirs.baseStats[stat] !== form.baseStats[stat])
      .map((stat) => `${STAT_NAMES[stat]} ${form.baseStats[stat]} (calculator: ${theirs.baseStats[stat]})`);
    const types = theirs.types.map((type) => type.toLowerCase());
    if (types.join('/') !== form.types.join('/'))
      stats.push(`types ${form.types.join('/')} (calculator: ${types.join('/')})`);
    if (stats.length) differences.push(`\`${form.id}\`: ${stats.join(', ')}. The game data is used.`);
  }
  for (const move of core.moves) {
    if (!move.availableInChampions) continue;
    const name = generation.names.moves.get(move.id);
    const theirs = name ? champions.moves.get(toID(name)) : undefined;
    if (!theirs) continue;
    const found: string[] = [];
    if (theirs.type.toLowerCase() !== move.type)
      found.push(`type ${move.type} (calculator: ${theirs.type.toLowerCase()})`);
    const category = (theirs.category ?? 'Status').toLowerCase();
    if (category !== move.category) found.push(`category ${move.category} (calculator: ${category})`);
    if (move.power !== null && theirs.basePower > 0 && theirs.basePower !== move.power) {
      found.push(`power ${move.power} (calculator: ${theirs.basePower})`);
    }
    if (move.priority > 0 !== (theirs.priority ?? 0) > 0) {
      found.push(`priority ${move.priority} (calculator: ${theirs.priority ?? 0})`);
    }
    if (found.length) differences.push(`\`${move.id}\`: ${found.join(', ')}. The game data is used.`);
    if (move.category !== 'status' && ourSpread(move.target) !== SPREAD.has(theirs.target ?? '')) {
      differences.push(
        `\`${move.id}\`: hits ${ourSpread(move.target) ? 'several Pokémon' : 'one Pokémon'} here (\`${move.target}\`), ` +
          `${SPREAD.has(theirs.target ?? '') ? 'several' : 'one'} in the calculator (\`${theirs.target}\`). ` +
          'The game data is used.',
      );
    }
    const flags = theirs.flags ?? {};
    const kinds = [
      ...(move.makesContact !== !!flags.contact ? [`contact ${move.makesContact ? 'yes' : 'no'}`] : []),
      ...KIND_FLAGS.filter(([kind, flag]) => move.kinds.includes(kind) !== !!flags[flag]).map(
        ([kind, flag]) =>
          `${kind} ${move.kinds.includes(kind) ? 'yes' : 'no'} (calculator: ${flags[flag] ? 'yes' : 'no'})`,
      ),
    ];
    if (kinds.length) differences.push(`\`${move.id}\`: ${kinds.join(', ')}. The game data is used.`);
  }
  return { missing, borrowed, differences };
}
