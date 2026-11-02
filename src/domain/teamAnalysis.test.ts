import { describe, expect, it } from 'vitest';
import type { Form, Move } from '@/data/contracts';
import { alignments, forms, items, moves, rules, typesFile } from '@/test/fixtures';
import { createMember, createTeam, type Team, type TeamMember } from './team';
import {
  analyseMembers,
  coverageTable,
  defenceTable,
  speedOrder,
  weakSpots,
  type TeamAnalysisData,
} from './teamAnalysis';

const base = forms[0] as Form;
const extraForms: Form[] = [
  { ...base, id: 'rotom-wash', speciesId: 'rotom', types: ['electric', 'water'], abilities: ['levitate'] },
  { ...base, id: 'charizard', speciesId: 'charizard', types: ['fire', 'flying'], abilities: ['blaze'] },
  {
    ...base,
    id: 'gengar',
    speciesId: 'gengar',
    types: ['ghost'],
    abilities: ['cursed-body'],
    baseStats: { hp: 60, atk: 65, def: 60, spa: 130, spd: 75, spe: 110 },
  },
];
const extraMoves: Move[] = [
  { ...(moves[0] as Move), id: 'thunderbolt', type: 'electric', category: 'special', power: 90 },
  { ...(moves[0] as Move), id: 'earthquake', type: 'ground', category: 'physical', power: 100 },
];

const data: TeamAnalysisData = {
  rules,
  formsById: new Map([...forms, ...extraForms].map((form) => [form.id, form])),
  movesById: new Map([...moves, ...extraMoves].map((move) => [move.id, move])),
  itemsById: new Map(items.map((item) => [item.id, item])),
  alignmentsById: new Map(alignments.map((alignment) => [alignment.id, alignment])),
};

const member = (formId: string, extra: Partial<TeamMember> = {}): TeamMember => ({
  ...createMember(formId, rules),
  id: formId,
  ...extra,
});
const team = (...members: TeamMember[]): Team => ({ ...createTeam('Test'), members });
const rowOf = (rows: ReturnType<typeof defenceTable>, type: string) => rows.find((row) => row.type === type);

describe('team defence', () => {
  it('multiplies both types and counts Abilities such as Levitate', () => {
    const members = analyseMembers(
      team(member('rotom-wash', { abilityId: 'levitate' }), member('charizard', { abilityId: 'blaze' })),
      data,
    );
    const rows = defenceTable(members, typesFile);
    // Electric/Water would take ×2 from Ground, but Levitate makes it ×0; Charizard is immune anyway.
    expect(rowOf(rows, 'ground')).toMatchObject({ multipliers: [0, 0], weak: 0, resist: 2, immune: 2 });
    // Rock: ×1 on Rotom-Wash, ×4 on Charizard.
    expect(rowOf(rows, 'rock')?.multipliers).toEqual([1, 4]);
    // Electric: ×1 on Rotom-Wash (½ × 2), ×2 on Charizard.
    expect(rowOf(rows, 'electric')).toMatchObject({ multipliers: [1, 2], weak: 1, resist: 0 });
  });

  it('finds the types several members are weak to', () => {
    const members = analyseMembers(team(member('charizard'), member('charizard', { id: 'second' })), data);
    const spots = weakSpots(defenceTable(members, typesFile)).map((row) => row.type);
    // Rock does ×4 to both, so it comes first.
    expect(spots).toEqual(['rock', 'water', 'electric']);
  });

  it('can count members as their Mega Evolution', () => {
    const venusaur = member('venusaur', { abilityId: 'chlorophyll', itemId: 'venusaurite' });
    const [regular] = analyseMembers(team(venusaur), data);
    const [mega] = analyseMembers(team(venusaur), data, { megaEvolved: true });
    expect(regular).toMatchObject({ megaEvolved: false, abilityId: 'chlorophyll' });
    expect(mega).toMatchObject({ megaEvolved: true, abilityId: 'thick-fat' });
    expect(mega?.form.id).toBe('venusaur-mega');
    // Thick Fat halves Fire damage: ×2 (Grass) × ½.
    expect(rowOf(defenceTable([mega!], typesFile), 'fire')?.multipliers).toEqual([1]);
  });
});

describe('team coverage', () => {
  it("uses only attacking moves and finds each type's best hit", () => {
    const members = analyseMembers(
      team(
        member('rotom-wash', { moves: ['thunderbolt', 'protect', null, null] }),
        member('charizard', { moves: ['earthquake', null, null, null] }),
      ),
      data,
    );
    const coverage = coverageTable(members, typesFile);
    const of = (type: string) => coverage.find((entry) => entry.type === type);
    expect(of('water')).toEqual({ type: 'water', best: 2, members: ['rotom-wash'] });
    expect(of('steel')).toEqual({ type: 'steel', best: 2, members: ['charizard'] });
    // Flying: Earthquake can't touch it, but Thunderbolt hits it hard.
    expect(of('flying')).toEqual({ type: 'flying', best: 2, members: ['rotom-wash'] });
    expect(of('grass')).toEqual({ type: 'grass', best: 0.5, members: [] });
  });

  it('says when a team has no attacking moves at all', () => {
    const members = analyseMembers(team(member('rotom-wash', { moves: ['protect'] })), data);
    expect(coverageTable(members, typesFile)[0]?.best).toBeNull();
  });
});

describe('speed order', () => {
  it('puts the fastest first and counts a Choice Scarf', () => {
    const members = analyseMembers(
      team(
        member('gengar', { statPoints: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 32 } }),
        member('charizard', { itemId: 'choice-scarf' }),
      ),
      data,
    );
    // Gengar: 110 + 32 + 20 = 162. This test's Charizard has 80 base Speed: 100, ×1.5 = 150.
    expect(speedOrder(members)).toEqual([
      { memberId: 'gengar', speed: 162, withScarf: null },
      { memberId: 'charizard', speed: 100, withScarf: 150 },
    ]);
  });
});
