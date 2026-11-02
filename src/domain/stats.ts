/**
 * Battle stat calculations for Pokémon Champions.
 *
 * Champions has no IVs or EVs. Instead each Pokémon gets Stat Points (SP) and a
 * Stat Alignment (the equivalent of a Nature). At level 50, with formula
 * `champions-v1`:
 *
 *   HP          = base + SP + 75
 *   other stats = ⌊(base + SP + 20) × alignment⌋   (alignment: 110%, 100% or 90%)
 *
 * This matches the main-series formula at level 50 with perfect IVs, and the
 * implementation used by Pokémon Showdown's Champions mod. All limits and
 * percentages come from rules.json, so a rules change is a data change.
 */
import { STAT_IDS, type Alignment, type Rules, type StatId, type Stats } from '@/data/contracts';

/** Stat Points have the same shape as stats: one number per stat. */
export type StatPoints = Stats;

export const EMPTY_STAT_POINTS: StatPoints = Object.freeze({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

/** Percentage applied to `stat` by an alignment: e.g. 110, 100 or 90. */
export function alignmentPercent(
  stat: StatId,
  alignment: Alignment | null | undefined,
  rules: Rules,
): number {
  if (!alignment) return 100;
  if (stat === 'hp' && !rules.alignment.affectsHp) return 100;
  // Neutral alignments raise and lower the same stat (or nothing), which cancels out.
  if (alignment.raises === alignment.lowers) return 100;
  if (alignment.raises === stat) return rules.alignment.raisePercent;
  if (alignment.lowers === stat) return rules.alignment.lowerPercent;
  return 100;
}

/** One battle stat. */
export function calculateStat(
  stat: StatId,
  base: number,
  statPoints: number,
  alignment: Alignment | null | undefined,
  rules: Rules,
): number {
  switch (rules.statFormula) {
    case 'champions-v1': {
      if (stat === 'hp') return base + statPoints + 75;
      const beforeAlignment = base + statPoints + 20;
      // Integer maths (×110 / 100) avoids floating-point rounding surprises.
      return Math.floor((beforeAlignment * alignmentPercent(stat, alignment, rules)) / 100);
    }
  }
}

/** All six battle stats. */
export function calculateStats(
  base: Stats,
  statPoints: StatPoints,
  alignment: Alignment | null | undefined,
  rules: Rules,
): Stats {
  const result = { ...EMPTY_STAT_POINTS };
  for (const stat of STAT_IDS) {
    result[stat] = calculateStat(stat, base[stat], statPoints[stat], alignment, rules);
  }
  return result;
}

export function totalStatPoints(statPoints: StatPoints): number {
  return STAT_IDS.reduce((sum, stat) => sum + statPoints[stat], 0);
}

export function remainingStatPoints(statPoints: StatPoints, rules: Rules): number {
  return rules.statPoints.total - totalStatPoints(statPoints);
}

export type StatPointIssue =
  | { code: 'sp.invalid'; stat: StatId; value: number }
  | { code: 'sp.perStatExceeded'; stat: StatId; value: number; limit: number }
  | { code: 'sp.totalExceeded'; value: number; limit: number };

/** Lists every way a Stat Point spread breaks the rules (empty list = valid). */
export function checkStatPoints(statPoints: StatPoints, rules: Rules): StatPointIssue[] {
  const issues: StatPointIssue[] = [];
  for (const stat of STAT_IDS) {
    const value = statPoints[stat];
    if (!Number.isInteger(value) || value < 0) {
      issues.push({ code: 'sp.invalid', stat, value });
    } else if (value > rules.statPoints.perStat) {
      issues.push({ code: 'sp.perStatExceeded', stat, value, limit: rules.statPoints.perStat });
    }
  }
  const total = totalStatPoints(statPoints);
  if (total > rules.statPoints.total) {
    issues.push({ code: 'sp.totalExceeded', value: total, limit: rules.statPoints.total });
  }
  return issues;
}

/**
 * The highest value `stat` can take, given the points already spent elsewhere.
 * Used by sliders so they can't go past either limit.
 */
export function maxStatPointsFor(stat: StatId, statPoints: StatPoints, rules: Rules): number {
  const spentElsewhere = totalStatPoints(statPoints) - statPoints[stat];
  return Math.max(0, Math.min(rules.statPoints.perStat, rules.statPoints.total - spentElsewhere));
}

/** Sets one stat's points, clamped to what the rules allow. Returns a new object. */
export function setStatPoint(
  statPoints: StatPoints,
  stat: StatId,
  requested: number,
  rules: Rules,
): StatPoints {
  const value = Math.max(0, Math.min(Math.round(requested), maxStatPointsFor(stat, statPoints, rules)));
  return { ...statPoints, [stat]: value };
}
