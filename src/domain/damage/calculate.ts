/**
 * Running Smogon's damage calculator on the calculator's state, and turning
 * its answer into plain numbers the page can show in any language.
 *
 * The calculator's own English description ("32+ SpA Charizard-Mega-Y Heat
 * Wave vs. 0 HP / 0 SpD Venusaur in Sun: 230-272 (122.9 - 145.4%) --
 * guaranteed OHKO") is kept as well, for copying into chats and Showdown.
 */
import { Field, Move, Pokemon, Side, calculate, toID } from '@smogon/calc';
import type * as I from '@smogon/calc/dist/data/interface';
import { checkAirLock, checkItem, getFinalSpeed } from '@smogon/calc/dist/mechanics/util';
import type { Id } from '@/data/contracts';
import {
  activeAbility,
  activeForms,
  calcStats,
  currentHp,
  moveOptionsAt,
  otherSide,
  type ActiveForms,
  type CalcField,
  type CalcPokemon,
  type CalculatorData,
  type SideConditions,
  type SideId,
  type Status,
  type Terrain,
  type Weather,
} from '../calculator';
import { genderRule } from '../teamEditing';
import type { DamageGeneration } from './generation';

/** Everything a calculation needs. */
export interface DamageContext {
  data: CalculatorData;
  generation: DamageGeneration;
  field: CalcField;
}

/** A Pokémon on one side of the field. */
export interface Combatant {
  pokemon: CalcPokemon;
  side: SideId;
}

/** Something counted at the end of each turn, or on switching in, when working out the KO. */
export type KoEffect =
  | { kind: 'item'; item: Id; heals: boolean }
  | { kind: 'ability'; ability: Id; heals: boolean }
  | { kind: 'weather'; weather: Weather | 'hail' }
  | { kind: 'terrain'; terrain: Terrain }
  | { kind: 'status'; status: Status; reduced: boolean }
  | { kind: 'stealthRock' }
  | { kind: 'spikes'; layers: number }
  /** Anything else, in the calculator's English. */
  | { kind: 'other'; text: string };

export interface KoChance {
  /** Hits needed: 1 is a one-hit KO. 0: not a KO even in 9 hits. */
  hits: number;
  /** Chance of the KO in that many hits (0–1). Null when it's possible but can't be worked out. */
  chance: number | null;
  /** Worked out from a shortened list of rolls (moves that hit 4 or more times). */
  approximate: boolean;
  /** End-of-turn effects and entry hazards counted. */
  effects: KoEffect[];
}

export type MoveOutcome = { kind: 'status'; moveId: Id } | { kind: 'noDamage'; moveId: Id } | DamageOutcome;

export interface DamageOutcome {
  kind: 'damage';
  moveId: Id;
  /** The 16 possible damage amounts of each hit (one list per hit for multi-hit moves). */
  hits: number[][];
  min: number;
  max: number;
  /** In percent of the target's maximum HP, one decimal, as Showdown shows them. */
  minPercent: number;
  maxPercent: number;
  target: { hp: number; maxHp: number };
  ko: KoChance;
  /** Hits both opponents (or everyone) in a double battle, so it does ×0.75. */
  spread: boolean;
  /** HP the attacker gets back (draining moves, Shell Bell): min and max. */
  recovery: [number, number] | null;
  /** Recoil, in percent of the attacker's maximum HP. */
  recoil: [number, number] | null;
  /** Loses half its HP if the move misses (High Jump Kick…). */
  crashDamage: boolean;
  /** The calculator's English description. */
  description: string;
  /**
   * Smogon's calculator doesn't know one of the Pokémon, the move, the
   * Ability or the item yet, so their extra details are missing.
   */
  incomplete: boolean;
}

const WEATHER_NAMES: Record<Weather, I.Weather> = { sun: 'Sun', rain: 'Rain', sand: 'Sand', snow: 'Snow' };
const TERRAIN_NAMES: Record<Terrain, I.Terrain> = {
  electric: 'Electric',
  grassy: 'Grassy',
  psychic: 'Psychic',
  misty: 'Misty',
};

/** The calculator's view of one Pokémon, and the forms it's in. */
export function smogonPokemon(
  ctx: DamageContext,
  pokemon: CalcPokemon,
): { calc: Pokemon; forms: ActiveForms } | null {
  const { data, generation } = ctx;
  const forms = activeForms(pokemon, data);
  if (!forms) return null;
  const name = generation.names.forms.get(forms.active.id);
  if (!name) return null;
  const { set } = pokemon;
  const abilityId = activeAbility(pokemon, forms);
  const maxHp = calcStats(pokemon, forms, data).hp;
  const calc = new Pokemon(generation.gen, name, {
    ability: abilityId !== null ? generation.names.abilities.get(abilityId) : undefined,
    abilityOn: pokemon.abilityOn,
    alliesFainted: pokemon.alliesFainted,
    item: set.itemId !== null ? generation.names.items.get(set.itemId) : undefined,
    nature: set.alignmentId !== null ? generation.names.alignments.get(set.alignmentId) : undefined,
    gender: genderOf(pokemon, forms, data),
    evs: { ...set.statPoints },
    boosts: { ...pokemon.stages },
    status: pokemon.status ?? '',
    curHP: currentHp(maxHp, pokemon.hpPercent),
  });
  return { calc, forms };
}

/** Its gender, for Rivalry. An unknown gender counts as neither. */
function genderOf(pokemon: CalcPokemon, forms: ActiveForms, data: DamageContext['data']): I.GenderName {
  const rule = genderRule(forms.chosen, data);
  const gender = rule.kind === 'fixed' ? rule.gender : pokemon.set.gender;
  return gender === 'male' ? 'M' : gender === 'female' ? 'F' : 'N';
}

function smogonSide(conditions: SideConditions, doubles: boolean): Side {
  return new Side({
    isReflect: conditions.reflect,
    isLightScreen: conditions.lightScreen,
    isAuroraVeil: conditions.auroraVeil,
    isHelpingHand: doubles && conditions.helpingHand,
    isFriendGuard: doubles && conditions.friendGuard,
    isTailwind: conditions.tailwind,
    isSR: conditions.stealthRock,
    spikes: conditions.spikes,
  });
}

/** The field, from the attacking side's point of view. */
export function smogonField(field: CalcField, attackerSide: SideId): Field {
  const doubles = field.format === 'doubles';
  return new Field({
    gameType: doubles ? 'Doubles' : 'Singles',
    weather: field.weather !== null ? WEATHER_NAMES[field.weather] : undefined,
    terrain: field.terrain !== null ? TERRAIN_NAMES[field.terrain] : undefined,
    isGravity: field.gravity,
    isMagicRoom: field.magicRoom,
    isWonderRoom: field.wonderRoom,
    attackerSide: smogonSide(field[attackerSide], doubles),
    defenderSide: smogonSide(field[otherSide(attackerSide)], doubles),
  });
}

/** How many times a multi-hit move can hit, and how many it hits when not chosen. */
export function hitChoices(
  ctx: DamageContext,
  moveId: Id,
  abilityId: Id | null,
): { min: number; max: number; usual: number } | null {
  const name = ctx.generation.names.moves.get(moveId);
  const move = name ? ctx.generation.gen.moves.get(toID(name)) : undefined;
  if (!move?.multihit) return null;
  if (typeof move.multihit === 'number') {
    // Moves that check accuracy for every hit (Triple Axel, Population Bomb) can stop early.
    return move.multiaccuracy && move.multihit > 1
      ? { min: 1, max: move.multihit, usual: move.multihit }
      : null;
  }
  const [min = 1, max = min] = move.multihit;
  const skillLink = abilityId !== null && ctx.generation.names.abilities.get(abilityId) === 'Skill Link';
  return { min, max, usual: skillLink ? max : Math.min(max, min + 1) };
}

/** What a move in one of the attacker's slots does to the defender. */
export function calculateMove(
  ctx: DamageContext,
  attacker: Combatant,
  defender: Combatant,
  slot: number,
): MoveOutcome | null {
  const moveId = attacker.pokemon.set.moves[slot] ?? null;
  if (moveId === null) return null;
  const moveName = ctx.generation.names.moves.get(moveId);
  const from = smogonPokemon(ctx, attacker.pokemon);
  const to = smogonPokemon(ctx, defender.pokemon);
  if (!moveName || !from || !to) return null;

  const { gen } = ctx.generation;
  const options = moveOptionsAt(attacker.pokemon, slot);
  const move = new Move(gen, moveName, {
    ability: from.calc.ability,
    item: from.calc.item,
    species: from.calc.name,
    isCrit: options.crit,
    ...(options.hits !== null ? { hits: options.hits } : {}),
  });
  if (move.category === 'Status') return { kind: 'status', moveId };

  const field = smogonField(ctx.field, attacker.side);
  const result = calculate(gen, from.calc, to.calc, move, field);
  const [min, max] = result.range();
  if (max === 0) return { kind: 'noDamage', moveId };

  const maxHp = result.defender.maxHP();
  const percentOf = (amount: number) => Math.floor((amount * 1000) / maxHp) / 10;
  const ko = result.kochance(false);
  const recovery = result.recovery().recovery;
  const recoil = result.recoil().recoil;
  const { missing } = ctx.generation;
  const unknown = (ids: ReadonlySet<Id>, id: Id | null) => id !== null && ids.has(id);
  const sides = [
    { pokemon: attacker.pokemon, forms: from.forms },
    { pokemon: defender.pokemon, forms: to.forms },
  ];

  return {
    kind: 'damage',
    moveId,
    hits: damageLists(result.damage),
    min,
    max,
    minPercent: percentOf(min),
    maxPercent: percentOf(max),
    target: { hp: result.defender.curHP(), maxHp },
    ko: {
      hits: ko.n,
      chance: ko.chance ?? null,
      approximate: ko.text.startsWith('approx.'),
      effects: koEffects(ko.text),
    },
    spread: ctx.field.format === 'doubles' && ['allAdjacent', 'allAdjacentFoes'].includes(move.target),
    recovery: recovery[1] !== 0 ? [recovery[0], recovery[1]] : null,
    recoil: Array.isArray(recoil) && recoil[1] > 0 ? [recoil[0], recoil[1]] : null,
    crashDamage: move.hasCrashDamage,
    description: result.fullDesc('%', false),
    incomplete:
      missing.moves.has(moveId) ||
      sides.some(
        ({ pokemon, forms }) =>
          missing.forms.has(forms.active.id) ||
          unknown(missing.abilities, activeAbility(pokemon, forms)) ||
          unknown(missing.items, pokemon.set.itemId),
      ),
  };
}

/** The calculator's damage, always as one list of rolls per hit. */
function damageLists(damage: number | number[] | number[][]): number[][] {
  if (typeof damage === 'number') return [[damage]];
  if (damage.length === 0) return [];
  if (Array.isArray(damage[0])) return damage as number[][];
  const rolls = damage as number[];
  // A short list is a fixed amount per hit (Parental Bond with a fixed-damage move).
  return rolls.length < 16 ? rolls.map((amount) => [amount]) : [rolls];
}

/** End-of-turn effects and hazards named in the calculator's KO text, by what they are. */
const KO_EFFECTS: ReadonlyArray<[string, KoEffect]> = [
  ['Leftovers recovery', { kind: 'item', item: 'leftovers', heals: true }],
  ['Black Sludge recovery', { kind: 'item', item: 'black-sludge', heals: true }],
  ['Black Sludge damage', { kind: 'item', item: 'black-sludge', heals: false }],
  ['Sticky Barb damage', { kind: 'item', item: 'sticky-barb', heals: false }],
  ['Dry Skin recovery', { kind: 'ability', ability: 'dry-skin', heals: true }],
  ['Dry Skin damage', { kind: 'ability', ability: 'dry-skin', heals: false }],
  ['Solar Power damage', { kind: 'ability', ability: 'solar-power', heals: false }],
  ['Rain Dish recovery', { kind: 'ability', ability: 'rain-dish', heals: true }],
  ['Ice Body recovery', { kind: 'ability', ability: 'ice-body', heals: true }],
  ['Poison Heal', { kind: 'ability', ability: 'poison-heal', heals: true }],
  ['sandstorm damage', { kind: 'weather', weather: 'sand' }],
  ['hail damage', { kind: 'weather', weather: 'hail' }],
  ['Grassy Terrain recovery', { kind: 'terrain', terrain: 'grassy' }],
  ['reduced burn damage', { kind: 'status', status: 'brn', reduced: true }],
  ['burn damage', { kind: 'status', status: 'brn', reduced: false }],
  ['toxic damage', { kind: 'status', status: 'tox', reduced: false }],
  ['poison damage', { kind: 'status', status: 'psn', reduced: false }],
  ['Stealth Rock', { kind: 'stealthRock' }],
  ['1 layer of Spikes', { kind: 'spikes', layers: 1 }],
  ['2 layers of Spikes', { kind: 'spikes', layers: 2 }],
  ['3 layers of Spikes', { kind: 'spikes', layers: 3 }],
];

/**
 * The effects listed after "after" in the calculator's KO text ("… 2HKO after
 * Stealth Rock, sandstorm damage, and Leftovers recovery"), in order, each once.
 */
export function koEffects(text: string): KoEffect[] {
  const effects: KoEffect[] = [];
  const seen = new Set<string>();
  for (const [, list = ''] of text.matchAll(/ after ([^()]+)/g)) {
    for (const phrase of list
      .trim()
      .split(/, and |, | and /)
      .map((part) => part.trim())
      .filter(Boolean)) {
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      const known = KO_EFFECTS.find(([english]) => english === phrase);
      effects.push(known ? known[1] : { kind: 'other', text: phrase });
    }
  }
  return effects;
}

/**
 * Both Pokémon's Speed in battle, with everything the calculator counts:
 * stages, Tailwind, Choice Scarf, paralysis, Swift Swim and the like.
 */
export function battleSpeeds(
  ctx: DamageContext,
  ours: CalcPokemon,
  theirs: CalcPokemon,
): { ours: number; theirs: number } | null {
  const a = smogonPokemon(ctx, ours);
  const b = smogonPokemon(ctx, theirs);
  if (!a || !b) return null;
  const field = smogonField(ctx.field, 'ours');
  // Cloud Nine and Air Lock cancel the weather; Magic Room and Klutz the items.
  checkAirLock(a.calc, field);
  checkAirLock(b.calc, field);
  checkItem(a.calc, field.isMagicRoom);
  checkItem(b.calc, field.isMagicRoom);
  const { gen } = ctx.generation;
  return {
    ours: getFinalSpeed(gen, a.calc, field, field.attackerSide),
    theirs: getFinalSpeed(gen, b.calc, field, field.defenderSide),
  };
}
