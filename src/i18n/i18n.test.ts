import { describe, expect, it } from 'vitest';
import { dexEntriesFor, dexEntryKey, lookupText, mergeTextFiles, type TextFilesByLanguage } from './gameText';
import { setupI18n, uiResources } from './setup';
import { coverage, flattenStrings, percent } from './translationStatus';

const files: TextFilesByLanguage = {
  en: { 'move-names': { thunderbolt: 'Thunderbolt', surf: 'Surf' } },
  es: { 'move-names': { thunderbolt: 'Rayo', surf: 'Surf' } },
  eu: { 'move-names': { thunderbolt: 'Tximista', surf: '' } },
};

describe('game text lookup', () => {
  it('uses the requested language when the text exists', () => {
    expect(lookupText(files, 'eu', 'move-names', 'thunderbolt')).toEqual({
      text: 'Tximista',
      language: 'eu',
      isFallback: false,
    });
  });

  it('falls back to English for missing or empty texts, and says so', () => {
    expect(lookupText(files, 'eu', 'move-names', 'surf')).toEqual({
      text: 'Surf',
      language: 'en',
      isFallback: true,
    });
    expect(lookupText(files, 'es', 'type-names', 'fire')).toBeNull();
  });

  it('lets hand-made files override generated ones, ignoring empty entries', () => {
    const merged = mergeTextFiles(
      { es: { 'move-names': { thunderbolt: 'Rayo', surf: 'Surf' } } },
      { es: { 'move-names': { surf: 'Surf (corregido)', thunderbolt: '' } } },
    );
    expect(merged.es?.['move-names']).toEqual({ thunderbolt: 'Rayo', surf: 'Surf (corregido)' });
  });
});

describe('Pokédex entries', () => {
  const generated = {
    en: {
      venusaur: [
        { games: ['red', 'blue'], text: 'English one' },
        { games: ['x'], text: 'English two' },
      ],
    },
    es: { venusaur: [{ games: ['x', 'y'], text: 'Una entrada' }] },
  };

  it('uses the generated entries of the language', () => {
    expect(dexEntriesFor('venusaur', 'es', generated, {}).map((e) => e.text)).toEqual(['Una entrada']);
  });

  it("uses a form's own entries when it has them, and its species' otherwise", () => {
    const withForms = {
      ...generated,
      en: {
        ...generated.en,
        'venusaur-mega': [],
        'raichu-alola': [{ games: ['sword'], text: 'Psychic surfer' }],
      },
    };
    expect(dexEntryKey({ id: 'raichu-alola', speciesId: 'raichu' }, withForms)).toBe('raichu-alola');
    // An empty list is a Mega with no entries yet: it must not show Venusaur's.
    expect(dexEntryKey({ id: 'venusaur-mega', speciesId: 'venusaur' }, withForms)).toBe('venusaur-mega');
    expect(dexEntryKey({ id: 'venusaur-gmax', speciesId: 'venusaur' }, withForms)).toBe('venusaur');
    expect(dexEntryKey({ id: 'pichu', speciesId: 'pichu' }, withForms)).toBeNull();
  });

  it('follows the English groups for hand-made languages, entry by entry', () => {
    const entries = dexEntriesFor('venusaur', 'eu', generated, {
      eu: { 'venusaur/blue': 'Euskarazko sarrera' },
    });
    expect(entries.map((e) => [e.text, e.isFallback])).toEqual([
      ['Euskarazko sarrera', false],
      ['English two', true],
    ]);
  });
});

describe('translation progress', () => {
  it('flattens nested interface strings', () => {
    expect(flattenStrings({ a: { b: 'x', c: { d: 'y' } } })).toEqual({ 'a.b': 'x', 'a.c.d': 'y' });
  });

  it('counts empty and missing texts as untranslated', () => {
    const result = coverage({ a: 'A', b: 'B', c: 'C' }, { a: 'Ah', b: '' });
    expect(result).toEqual({ total: 3, translated: 1, missing: ['b', 'c'] });
    expect(percent(result)).toBe(33);
  });

  it('has a complete Spanish interface', () => {
    const english = flattenStrings(uiResources.en);
    expect(coverage(english, flattenStrings(uiResources.es)).missing).toEqual([]);
  });

  it('has the same keys in every interface file', () => {
    const englishKeys = Object.keys(flattenStrings(uiResources.en)).sort();
    for (const strings of Object.values(uiResources)) {
      expect(Object.keys(flattenStrings(strings)).sort()).toEqual(englishKeys);
    }
  });
});

describe('interface text', () => {
  it('falls back to English for untranslated Basque texts', async () => {
    const i18n = await setupI18n('eu');
    i18n.addResource('en', 'ui', 'testOnly.greeting', 'Hello');
    i18n.addResource('eu', 'ui', 'testOnly.greeting', '');
    expect(i18n.t('testOnly.greeting')).toBe('Hello');
    i18n.addResource('eu', 'ui', 'testOnly.greeting', 'Kaixo');
    expect(i18n.t('testOnly.greeting')).toBe('Kaixo');
    await i18n.changeLanguage('es');
    expect(i18n.t('nav.teams')).toBe('Equipos');
    expect(i18n.t('pokedex.results', { count: 1 })).toBe('1 Pokémon');
    expect(i18n.t('validation.move.emptySlots', { count: 2 })).toBe('Hay 2 huecos de movimiento vacíos.');
  });
});
