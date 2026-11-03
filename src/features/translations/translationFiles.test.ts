import { describe, expect, it } from 'vitest';
import { groupDrafts, unflattenStrings, withDraftDexEntries } from '@/i18n/drafts';
import {
  draftCount,
  editorItems,
  filterItems,
  missingPlaceholders,
  translationFiles,
  type TranslationSources,
} from './translationFiles';

const sources = (drafts: TranslationSources['drafts'] = {}): TranslationSources => ({
  ui: {
    english: { 'pokemon.dex.title': 'Pokédex entries', 'teams.members_one': '{{count}} Pokémon' },
    spanish: { 'pokemon.dex.title': 'Entradas de la Pokédex' },
    file: { 'pokemon.dex.title': 'Pokédex sarrerak', 'old.key': 'Zaharra' },
  },
  text: {
    english: {
      'pokemon-names': { raichu: 'Raichu' },
      'form-names': { 'raichu-alola': 'Alolan Form' },
      'move-names': { thunderbolt: 'Thunderbolt' },
      'move-descriptions': { thunderbolt: 'A strong electric blast.' },
    },
    spanish: { 'move-descriptions': { thunderbolt: 'Un fuerte ataque eléctrico.' } },
    file: { 'move-descriptions': { thunderbolt: '' } },
  },
  dex: {
    english: { 'raichu-alola': [{ games: ['sun', 'moon'], text: 'It only evolves to this form in Alola.' }] },
    spanish: { 'raichu-alola': [{ games: ['sun'], text: 'Solo evoluciona así en Alola.' }] },
    file: {},
  },
  drafts,
  context: {
    formSpecies: (formId) => (formId.startsWith('raichu') ? 'raichu' : undefined),
    gameName: (gameId) => ({ sun: 'Sun', moon: 'Moon' })[gameId] ?? gameId,
  },
});

describe('translation editor', () => {
  it('lists every English text with its context and translation', () => {
    const [description] = editorItems('move-descriptions', sources());
    expect(description).toMatchObject({
      entry: 'thunderbolt',
      english: 'A strong electric blast.',
      spanish: 'Un fuerte ataque eléctrico.',
      context: 'Thunderbolt',
      value: '',
      changed: false,
    });
    const [entry] = editorItems('dex-entries', sources());
    expect(entry).toMatchObject({
      entry: 'raichu-alola/sun',
      context: 'Raichu (Alolan Form) — Sun · Moon',
      spanish: 'Solo evoluciona así en Alola.',
    });
  });

  it('shows drafts on top of the translation files', () => {
    const items = editorItems('ui', sources({ ui: { 'teams.members_one': '{{count}} Pokémon' } }));
    expect(items.map((item) => [item.entry, item.value, item.changed])).toEqual([
      ['pokemon.dex.title', 'Pokédex sarrerak', false],
      ['teams.members_one', '{{count}} Pokémon', true],
    ]);
  });

  it('filters by what is left to translate, what changed, and by search words', () => {
    const items = editorItems('ui', sources({ ui: { 'teams.members_one': 'x' } }));
    expect(filterItems(items, 'todo', '')).toHaveLength(0);
    expect(filterItems(items, 'changed', '').map((item) => item.entry)).toEqual(['teams.members_one']);
    expect(filterItems(items, 'all', 'POKEDEX entradas').map((item) => item.entry)).toEqual([
      'pokemon.dex.title',
    ]);
  });

  it('warns about placeholders left out of a translation', () => {
    expect(missingPlaceholders('{{count}} Pokémon', 'Pokémon')).toEqual(['{{count}}']);
    expect(missingPlaceholders('{{count}} Pokémon', '{{count}} Pokémon')).toEqual([]);
    expect(missingPlaceholders('{{count}} Pokémon', '')).toEqual([]);
  });

  it('writes the files the way the sync script does, keeping old translations', () => {
    const files = translationFiles(
      sources({ 'move-descriptions': { thunderbolt: 'Tximista indartsua.' } }),
      true,
    );
    expect(JSON.parse(files['ui.json'] ?? '')).toEqual({
      pokemon: { dex: { title: 'Pokédex sarrerak' } },
      teams: { members_one: '' },
      old: { key: 'Zaharra' },
    });
    expect(files['move-descriptions.json']).toBe('{\n  "thunderbolt": "Tximista indartsua."\n}\n');
    expect(JSON.parse(files['dex-entries.json'] ?? '')).toEqual({ 'raichu-alola/sun': '' });
  });

  it('counts the drafts that change a file', () => {
    const drafts = { ui: { 'pokemon.dex.title': 'Pokédex sarrerak', 'teams.members_one': 'x' } };
    expect(draftCount(drafts, sources(drafts))).toBe(1);
  });
});

describe('translation drafts', () => {
  it('group database records per language and file', () => {
    const drafts = groupDrafts([
      { key: 'eu:ui:a.b', language: 'eu', domain: 'ui', entry: 'a.b', text: 'Kaixo', updatedAt: '' },
      { key: 'eu:bad:x', language: 'eu', domain: 'bad', entry: 'x', text: '?', updatedAt: '' },
    ]);
    expect(drafts).toEqual({ eu: { ui: { 'a.b': 'Kaixo' } } });
    expect(
      withDraftDexEntries({ eu: { 'dex-entries': { 'raichu/red': 'Sarrera' } } }).eu?.['raichu/red'],
    ).toBe('Sarrera');
  });

  it('turn "section.key" pairs back into nested strings', () => {
    expect(unflattenStrings({ 'a.b': '1', 'a.c': '2', d: '3' })).toEqual({ a: { b: '1', c: '2' }, d: '3' });
  });
});
