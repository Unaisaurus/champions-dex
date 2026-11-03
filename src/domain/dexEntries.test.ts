import { describe, expect, it } from 'vitest';
import { latestEntries, newestFirst, type GameRelease } from './dexEntries';

const games: GameRelease[] = [
  { id: 'red', group: 'red-blue' },
  { id: 'blue', group: 'red-blue' },
  { id: 'scarlet', group: 'scarlet-violet' },
  { id: 'violet', group: 'scarlet-violet' },
  { id: 'legends-za', group: 'legends-za' },
];
const entry = (...list: string[]) => ({ games: list, text: list.join('+') });

describe('latest Pokédex entries', () => {
  it('keep both games of the newest pair', () => {
    const entries = [entry('violet'), entry('scarlet'), entry('red', 'blue')];
    expect(latestEntries(entries, games).map((e) => e.text)).toEqual(['violet', 'scarlet']);
  });

  it('keep only the newest game when it was released alone', () => {
    const entries = [entry('legends-za', 'red'), entry('violet'), entry('scarlet')];
    expect(latestEntries(entries, games).map((e) => e.text)).toEqual(['legends-za+red']);
  });

  it('keep everything without release information', () => {
    const entries = [entry('violet'), entry('red')];
    expect(latestEntries(entries, [])).toHaveLength(2);
    expect(latestEntries(entries, [{ id: 'other', group: 'other' }])).toHaveLength(2);
  });
});

describe('Pokédex entry order', () => {
  it('puts the newest release first, and paired games in their own order', () => {
    // Oldest first, as in the data files.
    const entries = [entry('red', 'blue'), entry('scarlet'), entry('violet'), entry('red', 'legends-za')];
    expect(newestFirst(entries, games).map((e) => e.text)).toEqual([
      'red+legends-za',
      'scarlet',
      'violet',
      'red+blue',
    ]);
  });

  it('keeps the data order, reversed, without release information', () => {
    expect(newestFirst([entry('a'), entry('b')], []).map((e) => e.text)).toEqual(['b', 'a']);
  });
});
