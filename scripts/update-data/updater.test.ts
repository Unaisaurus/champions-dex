// @vitest-environment node
/**
 * Tests for the data updater's building blocks. They use small inline samples,
 * so they run offline and in a fraction of a second.
 */
import { describe, expect, it } from 'vitest';
import { usualChampionsPp } from './build/catalog';
import { cleanEntryText, entryKey } from './build/dexEntries';
import { mergeConditions } from './build/families';
import { identifierTokens, isRegionalIdentifier, tokens } from './build/matching';
import { flatten } from './build/text';
import { int, intOrNull, parseCsv } from './lib/csv';
import { formatJson } from './lib/output';
import { methodFromShowdownSource, toShowdownId } from './sources/showdown';
import { cleanDumpText, isPlaceholder, parseDump } from './sources/svText';
import { typeFromTextLabel } from './sources/champions';

describe('CSV reader', () => {
  it('reads quoted fields with commas, quotes and line breaks', () => {
    const rows = parseCsv('id,text\n1,"a, ""quoted""\nline"\n2,plain\r\n');
    expect(rows).toEqual([
      { id: '1', text: 'a, "quoted"\nline' },
      { id: '2', text: 'plain' },
    ]);
  });

  it('parses integers, treating empty cells as 0 or null', () => {
    expect(int('42')).toBe(42);
    expect(int('')).toBe(0);
    expect(intOrNull('')).toBeNull();
    expect(intOrNull('x')).toBeNull();
  });
});

describe('form matching words', () => {
  it('keeps only the words that tell forms apart', () => {
    expect([...tokens('Paldean Form (Combat Breed)')]).toEqual(['paldea', 'combat']);
    expect([...tokens('Mega Charizard X', new Set(['charizard']))]).toEqual(['mega', 'x']);
    expect([...tokens('Jumbo Variety')]).toEqual(['super']);
    expect([...tokens('Poké Ball Pattern')]).toEqual(['poke', 'ball']);
  });

  it('keeps every word of PokéAPI identifiers', () => {
    expect(identifierTokens('vanilla-cream-flower-sweet')).toEqual(['vanilla', 'cream', 'flower', 'sweet']);
  });

  it('recognises regional variants', () => {
    expect(isRegionalIdentifier('paldea-combat-breed')).toBe(true);
    expect(isRegionalIdentifier('alola')).toBe(true);
    expect(isRegionalIdentifier('mega-x')).toBe(false);
  });
});

describe('evolution conditions', () => {
  it('removes duplicates', () => {
    const a = { trigger: 'level-up', minLevel: 12 };
    expect(mergeConditions([a, { ...a }])).toEqual([a]);
  });

  it('keeps a few real alternatives', () => {
    const merged = mergeConditions([
      { trigger: 'use-item', item: 'cracked-pot' },
      { trigger: 'use-item', item: 'chipped-pot' },
    ]);
    expect(merged).toHaveLength(2);
  });

  it('folds long lists into what they have in common', () => {
    const sweets = ['strawberry-sweet', 'berry-sweet', 'love-sweet', 'star-sweet'];
    const merged = mergeConditions(sweets.map((heldItem) => ({ trigger: 'spin', heldItem })));
    expect(merged).toEqual([{ trigger: 'spin' }]);
  });

  it('drops minor differences such as chances', () => {
    const merged = mergeConditions([
      { trigger: 'in-battle-level-up', minLevel: 25, chancePercent: 99 },
      { trigger: 'in-battle-level-up', minLevel: 25, chancePercent: 1 },
    ]);
    expect(merged).toEqual([{ trigger: 'in-battle-level-up', minLevel: 25 }]);
  });
});

describe('moves', () => {
  it('knows the usual Champions PP', () => {
    expect(usualChampionsPp(5)).toBe(8);
    expect(usualChampionsPp(10)).toBe(12);
    expect(usualChampionsPp(15)).toBe(16);
    expect(usualChampionsPp(35)).toBe(20);
    expect(usualChampionsPp(1)).toBe(1);
  });

  it('maps Showdown learn sources', () => {
    expect(methodFromShowdownSource('9M')).toBe('machine');
    expect(methodFromShowdownSource('8L1')).toBe('level-up');
    expect(methodFromShowdownSource('6S0')).toBe('event');
    expect(methodFromShowdownSource('9R')).toBe('form-change');
    expect(methodFromShowdownSource('7V')).toBeNull();
    expect(toShowdownId('raichu-alola')).toBe('raichualola');
  });

  it('reads type labels, which skip the old "???" type', () => {
    expect(typeFromTextLabel('TYPENAME_010')).toBe('fire');
    expect(typeFromTextLabel('TYPENAME_011')).toBe('water');
  });
});

describe('text', () => {
  it('reads the Scarlet/Violet text dump', () => {
    const dump = [
      '~~~~~~~~~~~~~~~',
      'Text File : monsname.dat',
      '~~~~~~~~~~~~~~~',
      'Egg',
      'Bulbasaur',
      '~~~~~~~~~~~~~~~',
      'Text File : zukan_comment_A.dat',
      '~~~~~~~~~~~~~~~',
      '',
      '[~ 1]',
      'It rigs foes with pollen-\\npacked flower\\nbombs.',
    ].join('\n');
    const files = parseDump(dump);
    expect(files.get('monsname.dat')?.[1]).toBe('Bulbasaur');
    const entries = files.get('zukan_comment_A.dat') ?? [];
    expect(isPlaceholder(entries[1])).toBe(true);
    expect(cleanDumpText(entries[2] ?? '')).toBe('It rigs foes with pollen-packed flower bombs.');
  });

  it('tidies PokéAPI entries and groups equal ones', () => {
    expect(cleanEntryText('A strange seed was\nplanted on its\fback. This POKéMON')).toBe(
      'A strange seed was planted on its back. This Pokémon',
    );
    expect(entryKey('This Pokémon’s tail.')).toBe(entryKey("This POKéMON's  tail"));
  });

  it('joins game text lines', () => {
    expect(flatten('Knocks out the target.\nAccuracy is 30%.')).toBe(
      'Knocks out the target. Accuracy is 30%.',
    );
  });

  it('writes one record per line', () => {
    expect(formatJson([{ a: 1 }, { b: 2 }])).toBe('[\n{"a":1},\n{"b":2}\n]\n');
    expect(formatJson({ x: 'y' })).toBe('{\n"x": "y"\n}\n');
    expect(formatJson([])).toBe('[]\n');
  });
});
