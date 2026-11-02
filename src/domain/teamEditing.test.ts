import { describe, expect, it } from 'vitest';
import type { Form, Species } from '@/data/contracts';
import { forms as fixtureForms, items, learnsets, rules } from '@/test/fixtures';
import { createMember, createTeam, type Team } from './team';
import {
  addMember,
  changeMemberForm,
  genderRule,
  insertMember,
  isSelectableForm,
  memberLook,
  memberStartFor,
  moveMember,
  moveSlots,
  newMember,
  nextTeamName,
  removeMember,
  selectableForms,
  setMoveSlot,
  updateMember,
  type TeamBuilderData,
} from './teamEditing';

function form(partial: Partial<Form> & Pick<Form, 'id' | 'speciesId'>): Form {
  const base = fixtureForms[0] as Form;
  return {
    ...base,
    kind: 'base',
    display: 'entry',
    parentEntry: null,
    gameplayForm: null,
    battleOnly: false,
    megaStone: null,
    abilities: ['overgrow'],
    ...partial,
  };
}

const extraForms: Form[] = [
  form({ id: 'meowstic', speciesId: 'meowstic', abilities: ['keen-eye', 'prankster'] }),
  form({
    id: 'meowstic-female',
    speciesId: 'meowstic',
    kind: 'gender',
    display: 'profile',
    parentEntry: 'meowstic',
    abilities: ['keen-eye', 'competitive'],
  }),
  form({ id: 'pyroar', speciesId: 'pyroar', abilities: ['rivalry', 'unnerve'] }),
  form({
    id: 'pyroar-female',
    speciesId: 'pyroar',
    kind: 'gender',
    display: 'appearance',
    parentEntry: 'pyroar',
    gameplayForm: 'pyroar',
  }),
  form({ id: 'aegislash', speciesId: 'aegislash', abilities: ['stance-change'] }),
  form({
    id: 'aegislash-blade',
    speciesId: 'aegislash',
    kind: 'battle',
    display: 'profile',
    parentEntry: 'aegislash',
    battleOnly: true,
  }),
  form({ id: 'rotom-wash', speciesId: 'rotom', kind: 'other', display: 'profile', parentEntry: 'rotom' }),
  form({ id: 'rotom', speciesId: 'rotom', abilities: ['levitate'] }),
];
const allForms = [...fixtureForms, ...extraForms];
const formsById = new Map(allForms.map((f) => [f.id, f]));
const get = (id: string) => formsById.get(id) as Form;

function species(id: string, gender: Species['gender']): Species {
  return {
    id,
    nationalDex: 1,
    generation: 1,
    color: 'green',
    gender,
    isBaby: false,
    isLegendary: false,
    isMythical: false,
    categories: [],
    forms: [id],
    familyId: id,
  };
}

const ratio = (femaleEighths: number) => ({ kind: 'ratio' as const, femaleEighths });
const speciesList = [
  species('venusaur', ratio(1)),
  species('charizard', ratio(1)),
  species('vivillon', ratio(4)),
  species('bulbasaur', ratio(1)),
  species('meowstic', ratio(4)),
  species('pyroar', ratio(7)),
  species('aegislash', ratio(4)),
  species('rotom', { kind: 'genderless' }),
];

const group = (kind: 'profile' | 'appearance') => {
  const map = new Map<string, Form[]>();
  for (const f of allForms) {
    if (!f.parentEntry || f.display !== kind) continue;
    map.set(f.parentEntry, [...(map.get(f.parentEntry) ?? []), f]);
  }
  return map;
};

const data: TeamBuilderData = {
  rules,
  formsById,
  speciesById: new Map(speciesList.map((s) => [s.id, s])),
  itemsById: new Map(items.map((item) => [item.id, item])),
  learnsetsByForm: new Map(
    Object.entries({
      ...learnsets,
      meowstic: learnsets.vivillon ?? [],
      'meowstic-female': learnsets.vivillon ?? [],
      pyroar: learnsets.vivillon ?? [],
      aegislash: learnsets.vivillon ?? [],
      rotom: learnsets.vivillon ?? [],
      'rotom-wash': learnsets.vivillon ?? [],
    }),
  ),
  championsEntries: allForms.filter((f) => f.display === 'entry' && f.availability === 'champions'),
  profilesByEntry: group('profile'),
  appearancesByEntry: group('appearance'),
  megaBase: new Map([['venusaur-mega', 'venusaur']]),
};

describe('which forms can join a team', () => {
  it('leaves out battle-only forms, art-only gender variants and Pokémon outside Champions', () => {
    expect(isSelectableForm(get('venusaur'))).toBe(true);
    expect(isSelectableForm(get('vivillon-polar'))).toBe(true);
    expect(isSelectableForm(get('meowstic-female'))).toBe(true);
    expect(isSelectableForm(get('venusaur-mega'))).toBe(false);
    expect(isSelectableForm(get('aegislash-blade'))).toBe(false);
    expect(isSelectableForm(get('pyroar-female'))).toBe(false);
    expect(isSelectableForm(get('bulbasaur'))).toBe(false);
  });

  it('lists each entry followed by its forms', () => {
    const ids = selectableForms(data).map((f) => f.id);
    expect(ids).not.toContain('venusaur-mega');
    expect(ids.indexOf('vivillon-polar')).toBe(ids.indexOf('vivillon') + 1);
    expect(ids.indexOf('meowstic-female')).toBe(ids.indexOf('meowstic') + 1);
  });
});

describe('gender rules', () => {
  it('fixes the gender of genderless species and of species with a separate female form', () => {
    expect(genderRule(get('rotom'), data)).toEqual({ kind: 'fixed', gender: null });
    expect(genderRule(get('meowstic'), data)).toEqual({ kind: 'fixed', gender: 'male' });
    expect(genderRule(get('meowstic-female'), data)).toEqual({ kind: 'fixed', gender: 'female' });
  });

  it('lets other species be either', () => {
    expect(genderRule(get('venusaur'), data)).toEqual({ kind: 'choice' });
    expect(genderRule(get('pyroar'), data)).toEqual({ kind: 'choice' });
  });

  it('shows female Pyroar with its own art', () => {
    const pyroar = createMember('pyroar', rules);
    expect(memberLook(pyroar, data)?.id).toBe('pyroar');
    expect(memberLook({ ...pyroar, gender: 'female' }, data)?.id).toBe('pyroar-female');
    expect(memberLook({ ...createMember('venusaur', rules), gender: 'female' }, data)?.id).toBe('venusaur');
  });
});

describe('starting a member from any form', () => {
  it('turns a Mega Evolution into its regular form holding the Mega Stone', () => {
    expect(memberStartFor(get('venusaur-mega'), data)).toEqual({
      formId: 'venusaur',
      gender: null,
      itemId: 'venusaurite',
    });
  });

  it('turns other battle-only forms into their regular form', () => {
    expect(memberStartFor(get('aegislash-blade'), data)?.formId).toBe('aegislash');
  });

  it('turns an art-only female variant into the regular form set to female', () => {
    expect(memberStartFor(get('pyroar-female'), data)).toEqual({
      formId: 'pyroar',
      gender: 'female',
      itemId: null,
    });
  });

  it('refuses Pokémon outside Champions', () => {
    expect(memberStartFor(get('bulbasaur'), data)).toBeNull();
    expect(newMember(get('bulbasaur'), data)).toBeNull();
  });

  it('picks the first Ability and the fixed gender', () => {
    const member = newMember(get('meowstic-female'), data);
    expect(member).toMatchObject({ formId: 'meowstic-female', abilityId: 'keen-eye', gender: 'female' });
    expect(member?.moves).toEqual([null, null, null, null]);
    // Appearances use their gameplay form's Abilities.
    expect(newMember(get('vivillon-polar'), data)?.abilityId).toBe('shield-dust');
  });
});

describe('changing a member’s Pokémon', () => {
  const venusaur = {
    ...createMember('venusaur', rules),
    nickname: 'Leafy',
    abilityId: 'chlorophyll',
    itemId: 'choice-scarf',
    alignmentId: 'modest',
    moves: ['giga-drain', 'protect', 'sludge-bomb', null],
  };

  it('keeps what still fits and takes out moves the new Pokémon can’t learn', () => {
    const { member, removedMoves } = changeMemberForm(venusaur, get('vivillon'), data);
    expect(member).toMatchObject({
      id: venusaur.id,
      formId: 'vivillon',
      nickname: 'Leafy',
      itemId: 'choice-scarf',
      alignmentId: 'modest',
      // Chlorophyll isn't one of Vivillon's Abilities, so its first one is chosen.
      abilityId: 'shield-dust',
      moves: [null, 'protect', null, null],
    });
    expect(removedMoves).toEqual(['giga-drain', 'sludge-bomb']);
  });

  it('keeps the Ability when the new form has it too', () => {
    const meowstic = { ...createMember('meowstic', rules), abilityId: 'keen-eye', gender: 'male' as const };
    const { member } = changeMemberForm(meowstic, get('meowstic-female'), data);
    expect(member).toMatchObject({ abilityId: 'keen-eye', gender: 'female' });
  });

  it('gives the Mega Stone when a Mega Evolution is picked', () => {
    const { member } = changeMemberForm(venusaur, get('venusaur-mega'), data);
    expect(member).toMatchObject({ formId: 'venusaur', itemId: 'venusaurite' });
  });

  it('ignores forms that can’t be used', () => {
    expect(changeMemberForm(venusaur, get('bulbasaur'), data).member).toBe(venusaur);
  });
});

describe('move slots', () => {
  it('keeps every move in its slot', () => {
    expect(moveSlots(['protect'], rules)).toEqual(['protect', null, null, null]);
    const member = { ...createMember('venusaur', rules), moves: ['protect', 'giga-drain', null, null] };
    expect(setMoveSlot(member, 0, null, rules).moves).toEqual([null, 'giga-drain', null, null]);
    expect(setMoveSlot(member, 3, 'sludge-bomb', rules).moves).toEqual([
      'protect',
      'giga-drain',
      null,
      'sludge-bomb',
    ]);
  });
});

describe('team members', () => {
  const team = (): Team => {
    const base = createTeam('Rain', new Date('2026-11-01T10:00:00.000Z'));
    return {
      ...base,
      members: ['a', 'b', 'c'].map((id) => ({ ...createMember('venusaur', rules), id })),
    };
  };
  const ids = (t: Team) => t.members.map((member) => member.id);

  it('adds members up to the team size', () => {
    let current: Team | null = team();
    for (let i = 0; i < 3; i++) current = addMember(current as Team, createMember('venusaur', rules), rules);
    expect(current?.members).toHaveLength(6);
    expect(addMember(current as Team, createMember('venusaur', rules), rules)).toBeNull();
  });

  it('removes, re-inserts and reorders members', () => {
    const removed = removeMember(team(), 'b');
    expect(ids(removed)).toEqual(['a', 'c']);
    const member = team().members[1];
    expect(ids(insertMember(removed, member!, 1))).toEqual(['a', 'b', 'c']);
    expect(ids(moveMember(team(), 'a', 1))).toEqual(['b', 'a', 'c']);
    expect(ids(moveMember(team(), 'c', -2))).toEqual(['c', 'a', 'b']);
    expect(ids(moveMember(team(), 'a', -1))).toEqual(['a', 'b', 'c']);
  });

  it('only creates a new team object when a member changes', () => {
    const original = team();
    expect(updateMember(original, 'a', (member) => member)).toBe(original);
    const renamed = updateMember(original, 'a', (member) => ({ ...member, nickname: 'Drizzle' }));
    expect(renamed.members[0]?.nickname).toBe('Drizzle');
    expect(renamed.members[1]).toBe(original.members[1]);
  });

  it('suggests the lowest free default name', () => {
    const name = (n: number) => `Team ${n}`;
    expect(nextTeamName([], name)).toBe('Team 1');
    expect(nextTeamName(['Team 1', 'Team 2'], name)).toBe('Team 3');
    expect(nextTeamName(['Team 2', 'Rain'], name)).toBe('Team 1');
  });
});
