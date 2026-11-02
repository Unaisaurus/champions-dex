import { describe, expect, it } from 'vitest';
import { typesFile } from '@/test/fixtures';
import { defensiveProfile, effectiveness, offensiveCoverage } from './typeEffectiveness';

describe('type effectiveness', () => {
  it('multiplies both types', () => {
    const charizard = ['fire', 'flying'];
    expect(effectiveness('rock', charizard, typesFile.chart)).toBe(4);
    expect(effectiveness('water', charizard, typesFile.chart)).toBe(2);
    expect(effectiveness('grass', charizard, typesFile.chart)).toBe(0.25);
    expect(effectiveness('ground', charizard, typesFile.chart)).toBe(0);
    expect(effectiveness('normal', charizard, typesFile.chart)).toBe(1);
  });

  it('sorts weaknesses, resistances and immunities', () => {
    const profile = defensiveProfile(['fire', 'flying'], typesFile);
    expect(profile.weaknesses).toEqual(['rock', 'water', 'electric']);
    expect(profile.resistances).toEqual(['grass', 'fire', 'steel']);
    expect(profile.immunities).toEqual(['ground']);
  });

  it('finds the best coverage from a set of move types', () => {
    const coverage = offensiveCoverage(['electric', 'ground'], typesFile);
    expect(coverage.flying).toBe(2); // electric
    expect(coverage.steel).toBe(2); // ground
    expect(coverage.grass).toBe(0.5); // both resisted
    expect(offensiveCoverage([], typesFile).fire).toBe(1);
  });
});
