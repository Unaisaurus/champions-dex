import { describe, expect, it } from 'vitest';
import { alignments, rules } from '@/test/fixtures';
import {
  EMPTY_STAT_POINTS,
  calculateStat,
  calculateStats,
  checkStatPoints,
  maxStatPointsFor,
  remainingStatPoints,
  setStatPoint,
} from './stats';

const venusaur = { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 };
const alignment = (id: string) => alignments.find((a) => a.id === id) ?? null;

describe('Champions stat formula', () => {
  it('matches the reference example: Venusaur with 2 HP, 32 Def and 32 Sp. Atk points', () => {
    const points = { ...EMPTY_STAT_POINTS, hp: 2, def: 32, spa: 32 };
    expect(calculateStats(venusaur, points, alignment('hardy'), rules)).toEqual({
      hp: 157,
      atk: 102,
      def: 135,
      spa: 152,
      spd: 120,
      spe: 100,
    });
  });

  it('applies alignments as ×1.1 / ×0.9, rounding down', () => {
    const points = { ...EMPTY_STAT_POINTS, spa: 32 };
    const stats = calculateStats(venusaur, points, alignment('modest'), rules);
    expect(stats.spa).toBe(167); // ⌊152 × 1.1⌋ = ⌊167.2⌋
    expect(stats.atk).toBe(91); // ⌊102 × 0.9⌋ = ⌊91.8⌋
  });

  it('agrees with the main-series level 50 formula with perfect IVs', () => {
    // Main series: ⌊(2B + 31 + EV/4) × 50/100⌋ + 5, where 1 SP = 4 EVs and each further SP = 8 EVs.
    for (const base of [5, 45, 80, 100, 135, 160]) {
      for (const sp of [0, 1, 2, 17, 32]) {
        const evs = sp === 0 ? 0 : 4 + 8 * (sp - 1);
        const mainSeries = Math.floor(((2 * base + 31 + Math.floor(evs / 4)) * 50) / 100) + 5;
        expect(calculateStat('spe', base, sp, null, rules)).toBe(mainSeries);
        const mainSeriesHp = Math.floor(((2 * base + 31 + Math.floor(evs / 4)) * 50) / 100) + 60;
        expect(calculateStat('hp', base, sp, null, rules)).toBe(mainSeriesHp);
      }
    }
  });

  it('never lets an alignment change HP', () => {
    const fakeHpAlignment = { id: 'test', raises: 'hp' as const, lowers: 'atk' as const };
    expect(calculateStat('hp', 80, 0, fakeHpAlignment, rules)).toBe(155);
  });
});

describe('Stat Point limits', () => {
  it('accepts a full legal spread', () => {
    const points = { ...EMPTY_STAT_POINTS, hp: 2, def: 32, spa: 32 };
    expect(checkStatPoints(points, rules)).toEqual([]);
    expect(remainingStatPoints(points, rules)).toBe(0);
  });

  it('reports too many points in one stat and in total', () => {
    const points = { ...EMPTY_STAT_POINTS, hp: 33, def: 32, spa: 32 };
    expect(checkStatPoints(points, rules).map((issue) => issue.code)).toEqual([
      'sp.perStatExceeded',
      'sp.totalExceeded',
    ]);
  });

  it('reports negative or fractional values', () => {
    const points = { ...EMPTY_STAT_POINTS, atk: -1, spe: 1.5 };
    expect(checkStatPoints(points, rules).map((issue) => issue.code)).toEqual(['sp.invalid', 'sp.invalid']);
  });

  it('clamps slider values to both limits', () => {
    const points = { ...EMPTY_STAT_POINTS, hp: 32, def: 30 };
    expect(maxStatPointsFor('spa', points, rules)).toBe(4);
    expect(setStatPoint(points, 'spa', 20, rules).spa).toBe(4);
    expect(setStatPoint(points, 'spa', -3, rules).spa).toBe(0);
    expect(setStatPoint(EMPTY_STAT_POINTS, 'spe', 40, rules).spe).toBe(32);
  });
});
