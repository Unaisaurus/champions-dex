/**
 * Type matchups. Everything works from the type chart in types.json, so new
 * types (or chart changes) only need a data update.
 */
import type { Id, TypesFile } from '@/data/contracts';

type Chart = TypesFile['chart'];

/** Damage multiplier of an attack of type `attacking` against a Pokémon with `defending` types. */
export function effectiveness(attacking: Id, defending: readonly Id[], chart: Chart): number {
  return defending.reduce((multiplier, type) => multiplier * (chart[attacking]?.[type] ?? 1), 1);
}

export interface DefensiveProfile {
  /** Multiplier taken from each attacking type. */
  multipliers: Record<Id, number>;
  /** Types that hit for more than ×1, strongest first. */
  weaknesses: Id[];
  /** Types that hit for less than ×1 (but not ×0), most resisted first. */
  resistances: Id[];
  /** Types that do no damage. */
  immunities: Id[];
}

/** How every attacking type fares against a Pokémon with the given types. */
export function defensiveProfile(defending: readonly Id[], typesFile: TypesFile): DefensiveProfile {
  const multipliers: Record<Id, number> = {};
  for (const attacking of typesFile.types) {
    multipliers[attacking] = effectiveness(attacking, defending, typesFile.chart);
  }
  const byStrength = (a: Id, b: Id) => (multipliers[b] ?? 1) - (multipliers[a] ?? 1);
  const types = typesFile.types;
  return {
    multipliers,
    weaknesses: types.filter((t) => (multipliers[t] ?? 1) > 1).sort(byStrength),
    resistances: types
      .filter((t) => {
        const m = multipliers[t] ?? 1;
        return m > 0 && m < 1;
      })
      .sort((a, b) => byStrength(b, a)),
    immunities: types.filter((t) => multipliers[t] === 0),
  };
}

/**
 * Best multiplier a set of attacking types achieves against each single
 * defending type. Used for team coverage summaries.
 */
export function offensiveCoverage(attackingTypes: readonly Id[], typesFile: TypesFile): Record<Id, number> {
  const coverage: Record<Id, number> = {};
  for (const defending of typesFile.types) {
    coverage[defending] = attackingTypes.reduce(
      (best, attacking) => Math.max(best, effectiveness(attacking, [defending], typesFile.chart)),
      attackingTypes.length > 0 ? 0 : 1,
    );
  }
  return coverage;
}
