/**
 * Speed: who moves first. Battle Speed with the usual modifiers, and the
 * Speed tier list (every Champions Pokémon at the usual Stat Point spreads).
 *
 * The rounding follows the games (and Smogon's damage calculator, which the
 * tests compare against): the stage first, then Tailwind and Choice Scarf
 * chained as 4096ths, then paralysis.
 */
import type { Alignment, Form, Id, Rules } from '@/data/contracts';
import { activeForms, calcPokemonFromMember, calcStats, stagedStat, type CalculatorData } from './calculator';
import { calculateStat } from './stats';
import type { TeamMember } from './team';

/** The item that multiplies Speed by 1.5. */
export const CHOICE_SCARF: Id = 'choice-scarf';

/** Modifiers that change a Pokémon's Speed in battle. */
export interface SpeedModifiers {
  /** −6 to +6. */
  stage: number;
  tailwind: boolean;
  choiceScarf: boolean;
  paralysis: boolean;
}

export const NO_SPEED_MODIFIERS: SpeedModifiers = Object.freeze({
  stage: 0,
  tailwind: false,
  choiceScarf: false,
  paralysis: false,
});

/** Multiplies 4096ths the way the games do, rounding at each step. */
function chain(modifiers: readonly number[]): number {
  let total = 4096;
  for (const modifier of modifiers) total = (total * modifier + 2048) >> 12;
  return total;
}

/** Rounds to the nearest whole number, halves down (the games' rounding). */
const roundHalfDown = (value: number) => (value % 1 > 0.5 ? Math.ceil(value) : Math.floor(value));

/** Speed in battle, from the Speed stat. */
export function battleSpeed(stat: number, modifiers: SpeedModifiers): number {
  let speed = stagedStat(stat, modifiers.stage);
  const chained = chain([...(modifiers.tailwind ? [8192] : []), ...(modifiers.choiceScarf ? [6144] : [])]);
  speed = roundHalfDown((speed * chained) / 4096);
  if (modifiers.paralysis) speed = Math.floor((speed * 50) / 100);
  return Math.max(0, Math.min(10000, speed));
}

/** The usual Stat Point spreads for Speed, fastest first. */
export const SPEED_SPREADS = ['fastest', 'max', 'none', 'slowest'] as const;
export type SpeedSpread = (typeof SPEED_SPREADS)[number];

/** Speed stat at a spread: all points (or none) in Speed, with a Speed-raising, neutral or lowering alignment. */
export function spreadSpeed(base: number, spread: SpeedSpread, rules: Rules): number {
  const points = spread === 'fastest' || spread === 'max' ? rules.statPoints.perStat : 0;
  const alignment: Alignment | null =
    spread === 'fastest'
      ? { id: 'raise', raises: 'spe', lowers: 'atk' }
      : spread === 'slowest'
        ? { id: 'lower', raises: 'atk', lowers: 'spe' }
        : null;
  return calculateStat('spe', base, points, alignment, rules);
}

export interface SpeedTierEntry {
  /** Unique within the list. */
  key: string;
  formId: Id;
  /** A spread, or "member" for one of your own Pokémon (its real Stat Points). */
  spread: SpeedSpread | 'member';
  /** Base Speed of the form. */
  base: number;
  /** Speed in battle, with the modifiers. */
  speed: number;
  /** For your own Pokémon: the team member. */
  memberId?: string;
}

/**
 * The forms for the Speed tiers: each Pokémon that can be picked for a team
 * once (art-only variants share their form's Speed), plus every Mega
 * Evolution, and any other battle form whose Speed is its own.
 */
export function speedTierForms(
  selectable: readonly Form[],
  formsById: ReadonlyMap<Id, Form>,
  megaBase: ReadonlyMap<Id, Id>,
): Form[] {
  const result = new Map<Id, Form>();
  for (const form of selectable) {
    const gameplay =
      form.display === 'appearance' && form.gameplayForm ? formsById.get(form.gameplayForm) : form;
    if (gameplay && !result.has(gameplay.id)) result.set(gameplay.id, gameplay);
  }
  for (const form of formsById.values()) {
    if (form.availability !== 'champions' || !form.battleOnly || result.has(form.id)) continue;
    const base = formsById.get(megaBase.get(form.id) ?? form.parentEntry ?? '');
    if (form.kind === 'mega' || (base && base.baseStats.spe !== form.baseStats.spe))
      result.set(form.id, form);
  }
  return [...result.values()];
}

/** Every form at each spread, with the modifiers, fastest first (slowest first in Trick Room). */
export function speedTiers(
  forms: readonly Form[],
  spreads: readonly SpeedSpread[],
  modifiers: SpeedModifiers,
  rules: Rules,
  { trickRoom = false }: { trickRoom?: boolean } = {},
): SpeedTierEntry[] {
  const entries = forms.flatMap((form) =>
    spreads.map((spread): SpeedTierEntry => ({
      key: `${form.id}:${spread}`,
      formId: form.id,
      spread,
      base: form.baseStats.spe,
      speed: battleSpeed(spreadSpeed(form.baseStats.spe, spread, rules), modifiers),
    })),
  );
  return sortBySpeed(entries, trickRoom);
}

/**
 * Fastest first (slowest first in Trick Room). Ties keep a fixed order:
 * your own Pokémon first, then by spread, then by the order given.
 */
export function sortBySpeed(entries: readonly SpeedTierEntry[], trickRoom = false): SpeedTierEntry[] {
  const rank = (entry: SpeedTierEntry) =>
    entry.spread === 'member' ? -1 : SPEED_SPREADS.indexOf(entry.spread);
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        (trickRoom ? a.entry.speed - b.entry.speed : b.entry.speed - a.entry.speed) ||
        rank(a.entry) - rank(b.entry) ||
        a.index - b.index,
    )
    .map(({ entry }) => entry);
}

/** Who moves first between two Speeds: "first", "second", or a tie (decided at random). */
export function moveOrder(ours: number, theirs: number, trickRoom = false): 'first' | 'second' | 'tie' {
  if (ours === theirs) return 'tie';
  return ours > theirs !== trickRoom ? 'first' : 'second';
}

/**
 * Your team's members in the Speed tiers, with their own Stat Points and
 * alignment. A member holding its Mega Stone counts as its Mega Evolution
 * (whose Speed applies from the turn it Mega Evolves), and one holding a
 * Choice Scarf gets it.
 */
export function memberSpeeds(
  members: readonly TeamMember[],
  data: CalculatorData,
  modifiers: SpeedModifiers,
): SpeedTierEntry[] {
  return members.flatMap((member) => {
    const pokemon = calcPokemonFromMember(member, data);
    const forms = activeForms(pokemon, data);
    if (!forms) return [];
    const stat = calcStats(pokemon, forms, data).spe;
    const choiceScarf = modifiers.choiceScarf || member.itemId === CHOICE_SCARF;
    return [
      {
        key: `member:${member.id}`,
        formId: forms.active.id,
        spread: 'member' as const,
        base: forms.active.baseStats.spe,
        speed: battleSpeed(stat, { ...modifiers, choiceScarf }),
        memberId: member.id,
      },
    ];
  });
}
