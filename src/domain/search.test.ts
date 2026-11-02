import { describe, expect, it } from 'vitest';
import { slugify } from './ids';
import { buildSearchText, matchesSearch, normalizeForSearch, parseDexNumberQuery } from './search';

describe('search normalisation', () => {
  it('ignores accents, capitals and punctuation', () => {
    expect(normalizeForSearch('Pokémon')).toBe('pokemon');
    expect(normalizeForSearch('Farfetch’d')).toBe('farfetchd');
    expect(normalizeForSearch('Mr. Mime')).toBe('mr mime');
    expect(normalizeForSearch('Nidoran♀')).toBe('nidoran f');
    expect(normalizeForSearch('  Ho-Oh ')).toBe('ho oh');
  });

  it('finds a Pokémon by any of its names', () => {
    const text = buildSearchText(['Charizard', 'Charizard', 'Glurak', 'リザードン']);
    expect(matchesSearch(text, 'char')).toBe(true);
    expect(matchesSearch(text, 'GLURAK')).toBe(true);
    expect(matchesSearch(text, 'リザ')).toBe(true);
    expect(matchesSearch(text, 'pikachu')).toBe(false);
  });

  it('requires every word of the query', () => {
    const text = buildSearchText(['Alolan Raichu', 'Raichu de Alola']);
    expect(matchesSearch(text, 'raichu alola')).toBe(true);
    expect(matchesSearch(text, 'raichu galar')).toBe(false);
  });

  it('recognises Pokédex number searches', () => {
    expect(parseDexNumberQuery('3')).toBe(3);
    expect(parseDexNumberQuery('#003')).toBe(3);
    expect(parseDexNumberQuery('nº 25')).toBe(25);
    expect(parseDexNumberQuery('pikachu')).toBeNull();
    expect(parseDexNumberQuery('0')).toBeNull();
  });
});

describe('IDs', () => {
  it('turns English names into stable IDs', () => {
    expect(slugify('Choice Scarf')).toBe('choice-scarf');
    expect(slugify('Farfetch’d')).toBe('farfetchd');
    expect(slugify('Mr. Mime')).toBe('mr-mime');
    expect(slugify('Flabébé')).toBe('flabebe');
    expect(slugify('Nidoran♀')).toBe('nidoran-f');
  });
});
