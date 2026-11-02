import { describe, expect, it } from 'vitest';
import { ancestorsOf, computeLineGeneration, generationTags, matchesGenerations } from './generations';

describe('line generation', () => {
  const cases: Array<[string, number, number, number[], number]> = [
    // name, form generation, species generation, ancestors' species generations, expected
    ['Rhyperior (Rhyhorn, Rhydon)', 4, 4, [1, 1], 1],
    ['Gallade (branch from Kirlia)', 4, 4, [3, 3], 3],
    ['Kingambit', 9, 9, [5, 5], 5],
    ['Raichu (later baby Pichu does not count)', 1, 1, [1, 2], 1],
    ['Snorlax (later baby Munchlax)', 1, 1, [4], 1],
    ['Alolan Raichu (regional form)', 7, 1, [1, 2], 1],
    ['Paldean Tauros (regional, no pre-evolution)', 9, 1, [], 1],
    ['Sneasler (from Hisuian Sneasel)', 8, 8, [2], 2],
    ['Venusaur (same generation)', 1, 1, [1, 1], 1],
  ];

  it.each(cases)('%s', (_name, formGeneration, speciesGeneration, ancestors, expected) => {
    expect(
      computeLineGeneration({
        formGeneration,
        speciesGeneration,
        ancestorSpeciesGenerations: ancestors,
      }),
    ).toBe(expected);
  });
});

describe('ancestors', () => {
  const parents: Record<string, string | null> = {
    gallade: 'kirlia',
    gardevoir: 'kirlia',
    kirlia: 'ralts',
    ralts: null,
  };
  const getParent = (id: string) => parents[id] ?? null;

  it('walks up the tree, nearest first', () => {
    expect(ancestorsOf('gallade', getParent)).toEqual(['kirlia', 'ralts']);
  });

  it('stops on accidental loops', () => {
    const loop: Record<string, string> = { a: 'b', b: 'a' };
    expect(ancestorsOf('a', (id) => loop[id] ?? null)).toEqual(['b']);
  });
});

describe('generation filter', () => {
  const rhyperior = { generation: 4, lineGeneration: 1 };
  const venusaur = { generation: 1, lineGeneration: 1 };

  it('uses only the debut generation in strict mode', () => {
    expect(generationTags(rhyperior, 'strict')).toEqual([4]);
    expect(matchesGenerations(rhyperior, new Set([1]), 'strict')).toBe(false);
  });

  it('adds the line generation in family mode', () => {
    expect(generationTags(rhyperior, 'family')).toEqual([1, 4]);
    expect(generationTags(venusaur, 'family')).toEqual([1]);
    expect(matchesGenerations(rhyperior, new Set([1]), 'family')).toBe(true);
  });

  it('matches everything when nothing is selected', () => {
    expect(matchesGenerations(rhyperior, new Set(), 'strict')).toBe(true);
  });
});
