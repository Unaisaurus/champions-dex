import { describe, expect, it } from 'vitest';
import type { Form, Species } from '@/data/contracts';
import {
  abilities,
  alignments,
  forms as fixtureForms,
  items,
  learnsets,
  moves,
  rules,
} from '@/test/fixtures';
import {
  createShowdownLookup,
  formatShowdownSet,
  formatShowdownTeam,
  parseHeader,
  parseShowdown,
  type EnglishNames,
} from './showdown';
import { createMember, type TeamMember } from './team';
import type { TeamBuilderData } from './teamEditing';

/** "giga-drain" → "Giga Drain", standing in for the English game text. */
const title = (id: string) =>
  id.replace(
    /(^|-)([a-z])/g,
    (_, dash: string, letter: string) => `${dash ? ' ' : ''}${letter.toUpperCase()}`,
  );
const names: EnglishNames = { pokemon: title, move: title, item: title, ability: title, alignment: title };

const forms: Form[] = fixtureForms.map((form) => ({
  ...form,
  showdownName:
    { 'venusaur-mega': 'Venusaur-Mega', 'vivillon-polar': 'Vivillon-Polar' }[form.id] ??
    title(form.speciesId),
}));
const species = (id: string): Species => ({
  id,
  nationalDex: 1,
  generation: 1,
  color: 'green',
  gender: { kind: 'ratio', femaleEighths: 1 },
  isBaby: false,
  isLegendary: false,
  isMythical: false,
  categories: [],
  forms: forms.filter((form) => form.speciesId === id).map((form) => form.id),
  familyId: id,
});
const byParent = (display: 'profile' | 'appearance') => {
  const map = new Map<string, Form[]>();
  for (const form of forms.filter((f) => f.display === display && f.parentEntry)) {
    map.set(form.parentEntry as string, [...(map.get(form.parentEntry as string) ?? []), form]);
  }
  return map;
};

const data: TeamBuilderData & Parameters<typeof createShowdownLookup>[0] = {
  rules,
  forms,
  moves,
  items,
  abilities,
  alignments,
  formsById: new Map(forms.map((form) => [form.id, form])),
  speciesById: new Map(['venusaur', 'bulbasaur', 'charizard', 'vivillon'].map((id) => [id, species(id)])),
  itemsById: new Map(items.map((item) => [item.id, item])),
  learnsetsByForm: new Map(Object.entries(learnsets)),
  championsEntries: forms.filter((form) => form.display === 'entry' && form.availability === 'champions'),
  profilesByEntry: byParent('profile'),
  appearancesByEntry: byParent('appearance'),
  megaBase: new Map([['venusaur-mega', 'venusaur']]),
};
const lookup = createShowdownLookup(data, names);

const leafy = (): TeamMember => ({
  ...createMember('venusaur', rules),
  nickname: 'Leafy',
  gender: 'female',
  shiny: true,
  itemId: 'venusaurite',
  abilityId: 'chlorophyll',
  alignmentId: 'modest',
  statPoints: { hp: 32, atk: 0, def: 2, spa: 32, spd: 0, spe: 0 },
  moves: ['giga-drain', 'sludge-bomb', null, 'protect'],
});

const LEAFY = `Leafy (Venusaur) (F) @ Venusaurite
Ability: Chlorophyll
Level: 50
Shiny: Yes
EVs: 32 HP / 2 Def / 32 SpA
Modest Nature
- Giga Drain
- Sludge Bomb
- Protect`;

describe('Showdown export', () => {
  it('writes a set the way Showdown does, with Stat Points in the EVs line', () => {
    expect(formatShowdownSet(leafy(), data, names)).toBe(LEAFY);
  });

  it('leaves out what was never chosen', () => {
    expect(formatShowdownSet(createMember('vivillon-polar', rules), data, names)).toBe(
      'Vivillon-Polar\nLevel: 50',
    );
  });

  it('can put the team name in a heading', () => {
    expect(formatShowdownTeam([leafy()], data, names, 'Sun')).toBe(`=== Sun ===\n\n${LEAFY}\n`);
  });
});

describe('Showdown import', () => {
  it('reads back what it writes', () => {
    const { teams, problems } = parseShowdown(LEAFY, lookup, data);
    expect(problems).toEqual([]);
    const [member] = teams[0]?.members ?? [];
    const { id: _id, ...expected } = { ...leafy(), moves: ['giga-drain', 'sludge-bomb', 'protect', null] };
    expect(member).toMatchObject(expected);
  });

  it('converts main-series EVs and reports what it had to leave out', () => {
    const text = `Venusaur @ Mystery Berry
Ability: Chlorophyll
Tera Type: Fire
EVs: 252 SpA / 4 SpD / 252 Spe
IVs: 0 Atk
Timid Nature
- Giga Drain
- Sludge Bomb
- Earth Power
- Protect
- Quiver Dance`;
    const { teams, problems } = parseShowdown(text, lookup, data);
    expect(teams[0]?.members[0]?.statPoints).toEqual({ hp: 0, atk: 0, def: 0, spa: 32, spd: 1, spe: 32 });
    expect(problems).toEqual([
      { code: 'unknownItem', line: 1, value: 'Mystery Berry' },
      { code: 'evsConverted', line: 4 },
      { code: 'tooManyMoves', line: 11, value: 'Quiver Dance' },
    ]);
  });

  it('skips Pokémon it doesn’t know or that aren’t in Champions', () => {
    const { teams, problems } = parseShowdown('Missingno\n\nBulbasaur\n- Tackle\n\nCharizard', lookup, data);
    expect(teams[0]?.members.map((member) => member.formId)).toEqual(['charizard']);
    expect(problems).toEqual([
      { code: 'unknownPokemon', line: 1, value: 'Missingno' },
      { code: 'notInChampions', line: 3, value: 'Bulbasaur' },
    ]);
  });

  it('turns a Mega Evolution into its regular form holding the Mega Stone', () => {
    const { teams } = parseShowdown('Venusaur-Mega\nAbility: Thick Fat', lookup, data);
    expect(teams[0]?.members[0]).toMatchObject({ formId: 'venusaur', itemId: 'venusaurite' });
  });

  it('reads several teams, each under its heading', () => {
    const text = `=== [gen9championsvgc2026regm] Rain ===

Charizard

=== Sun ===

Venusaur
- Protect`;
    const { teams } = parseShowdown(text, lookup, data);
    expect(teams.map((team) => [team.name, team.members.length])).toEqual([
      ['Rain', 1],
      ['Sun', 1],
    ]);
  });
});

describe('Showdown set headings', () => {
  it('finds the nickname, species, gender and item', () => {
    expect(parseHeader('Garchomp')).toEqual({ nickname: '', species: 'Garchomp', gender: null, item: null });
    expect(parseHeader('Garchomp (M) @ Choice Scarf')).toEqual({
      nickname: '',
      species: 'Garchomp',
      gender: 'male',
      item: 'Choice Scarf',
    });
    expect(parseHeader('Mr. (Cool) (Garchomp) (F)')).toEqual({
      nickname: 'Mr. (Cool)',
      species: 'Garchomp',
      gender: 'female',
      item: null,
    });
  });
});
