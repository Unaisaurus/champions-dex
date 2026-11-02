/**
 * Team analysis: how the whole team fares against each attacking type, which
 * types its moves hit hard, and who moves first. Pure functions: the overview
 * page only shows their results.
 */
import type { Alignment, Form, Id, Item, Move, Rules, Stats, TypesFile } from '@/data/contracts';
import { megaFormWith } from '@/mechanics/mega';
import { ABILITY_TYPE_MODIFIERS } from './abilityMatchups';
import { calculateStats } from './stats';
import type { Team } from './team';
import { effectiveness } from './typeEffectiveness';
import { gameplayFormOf } from './validation';

/** One member, as the analysis sees it. */
export interface AnalysedMember {
  memberId: string;
  /** The form whose types and stats count: the Mega Evolution, when Megas are shown. */
  form: Form;
  /** True when `form` is the Mega Evolution. */
  megaEvolved: boolean;
  abilityId: Id | null;
  itemId: Id | null;
  /** The member's chosen moves that exist in the data. */
  moves: Move[];
  /** Battle stats at the battle level. */
  stats: Stats;
}

export interface TeamAnalysisData {
  rules: Rules;
  formsById: ReadonlyMap<Id, Form>;
  movesById: ReadonlyMap<Id, Move>;
  itemsById: ReadonlyMap<Id, Item>;
  alignmentsById: ReadonlyMap<Id, Alignment>;
}

/**
 * The team's members ready for analysis. Members whose Pokémon isn't in the
 * data are left out. With `megaEvolved`, members holding their Mega Stone count
 * as their Mega Evolution (its types, Ability and stats).
 */
export function analyseMembers(
  team: Team,
  data: TeamAnalysisData,
  { megaEvolved = false }: { megaEvolved?: boolean } = {},
): AnalysedMember[] {
  return team.members.flatMap((member) => {
    const chosen = data.formsById.get(member.formId);
    if (!chosen) return [];
    const base = gameplayFormOf(chosen, data.formsById);
    const mega = megaEvolved
      ? megaFormWith(member.formId, member.itemId, { forms: data.formsById, items: data.itemsById })
      : null;
    const form = mega ?? base;
    const alignment = member.alignmentId !== null ? data.alignmentsById.get(member.alignmentId) : undefined;
    return [
      {
        memberId: member.id,
        form,
        megaEvolved: mega !== null,
        // A Mega Evolution has its own Ability.
        abilityId: mega ? (mega.abilities[0] ?? member.abilityId) : member.abilityId,
        itemId: member.itemId,
        moves: member.moves.flatMap((id) => {
          const move = id !== null ? data.movesById.get(id) : undefined;
          return move ? [move] : [];
        }),
        stats: calculateStats(form.baseStats, member.statPoints, alignment, data.rules),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Defence: what each attacking type does to each member
// ---------------------------------------------------------------------------

/** Damage multiplier of an attacking type against a member, counting its Ability (Levitate…). */
export function damageTaken(attacking: Id, member: AnalysedMember, typesFile: TypesFile): number {
  const fromTypes = effectiveness(attacking, member.form.types, typesFile.chart);
  const modifier =
    member.abilityId !== null ? ABILITY_TYPE_MODIFIERS[member.abilityId]?.[attacking] : undefined;
  return fromTypes * (modifier ?? 1);
}

export interface DefenceRow {
  /** The attacking type. */
  type: Id;
  /** Multiplier per member, in team order. */
  multipliers: number[];
  /** Members that take more than normal damage. */
  weak: number;
  /** Members that take less than normal damage, immunities included. */
  resist: number;
  /** Members that take no damage at all. */
  immune: number;
}

export function defenceTable(members: readonly AnalysedMember[], typesFile: TypesFile): DefenceRow[] {
  return typesFile.types.map((type) => {
    const multipliers = members.map((member) => damageTaken(type, member, typesFile));
    return {
      type,
      multipliers,
      weak: multipliers.filter((m) => m > 1).length,
      resist: multipliers.filter((m) => m < 1).length,
      immune: multipliers.filter((m) => m === 0).length,
    };
  });
}

/** How hard a type hits the members weak to it (×4 counts double). */
const severity = (row: DefenceRow) => row.multipliers.filter((m) => m > 1).reduce((sum, m) => sum + m, 0);

/** Types that two or more members are weak to and fewer resist: the team's weak spots, worst first. */
export function weakSpots(rows: readonly DefenceRow[]): DefenceRow[] {
  return rows
    .filter((row) => row.weak >= 2 && row.weak > row.resist)
    .sort((a, b) => b.weak - b.resist - (a.weak - a.resist) || severity(b) - severity(a));
}

// ---------------------------------------------------------------------------
// Offence: which types the team's attacking moves hit hard
// ---------------------------------------------------------------------------

/** Moves whose effectiveness doesn't follow their type alone. */
function moveEffectiveness(move: Move, defending: Id, typesFile: TypesFile): number {
  if (move.id === 'freeze-dry' && defending === 'water') return 2;
  const multiplier = effectiveness(move.type, [defending], typesFile.chart);
  // Flying Press is both Fighting and Flying.
  if (move.id === 'flying-press') return multiplier * effectiveness('flying', [defending], typesFile.chart);
  return multiplier;
}

export const isDamaging = (move: Move) => move.category !== 'status';

export interface CoverageEntry {
  /** The defending type. */
  type: Id;
  /** Best multiplier the team's attacking moves reach against it (null: no attacking moves). */
  best: number | null;
  /** Members with a super-effective attacking move against it, in team order. */
  members: string[];
}

export function coverageTable(members: readonly AnalysedMember[], typesFile: TypesFile): CoverageEntry[] {
  return typesFile.types.map((type) => {
    let best: number | null = null;
    const hitting: string[] = [];
    for (const member of members) {
      const attacks = member.moves.filter(isDamaging);
      if (attacks.length === 0) continue;
      const own = Math.max(...attacks.map((move) => moveEffectiveness(move, type, typesFile)));
      best = best === null ? own : Math.max(best, own);
      if (own > 1) hitting.push(member.memberId);
    }
    return { type, best, members: hitting };
  });
}

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

export interface SpeedEntry {
  memberId: string;
  speed: number;
  /** With a Choice Scarf held: its Speed ×1.5. */
  withScarf: number | null;
}

/** Fastest first. */
export function speedOrder(members: readonly AnalysedMember[]): SpeedEntry[] {
  return members
    .map((member) => ({
      memberId: member.memberId,
      speed: member.stats.spe,
      withScarf: member.itemId === 'choice-scarf' ? Math.floor(member.stats.spe * 1.5) : null,
    }))
    .sort((a, b) => (b.withScarf ?? b.speed) - (a.withScarf ?? a.speed));
}
