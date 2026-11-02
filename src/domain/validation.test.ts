import { describe, expect, it } from 'vitest';
import { megaMechanic } from '@/mechanics/mega';
import { rules, validationContext } from '@/test/fixtures';
import { createMember, createTeam, normalizeMoveSlots, type TeamMember } from './team';
import { validateMember, validateTeam, worstSeverity } from './validation';

const ctx = validationContext();

function venusaur(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    ...createMember('venusaur', rules),
    abilityId: 'chlorophyll',
    alignmentId: 'modest',
    itemId: 'venusaurite',
    statPoints: { hp: 32, atk: 0, def: 2, spa: 32, spd: 0, spe: 0 },
    moves: ['giga-drain', 'sludge-bomb', 'earth-power', 'protect'],
    ...overrides,
  };
}

const codes = (member: TeamMember) => validateMember(member, ctx, [megaMechanic]).map((issue) => issue.code);

describe('team member checks', () => {
  it('accepts a complete, legal member', () => {
    expect(validateMember(venusaur(), ctx, [megaMechanic])).toEqual([]);
  });

  it('flags moves the Pokémon cannot learn, repeated moves and moves missing from Champions', () => {
    expect(codes(venusaur({ moves: ['giga-drain', 'quiver-dance', null, null] }))).toEqual([
      'move.emptySlots',
      'move.notInLearnset',
    ]);
    expect(codes(venusaur({ moves: ['protect', 'protect', 'giga-drain', 'sludge-bomb'] }))).toEqual([
      'move.duplicate',
    ]);
    expect(codes(venusaur({ moves: ['absorb', 'protect', 'giga-drain', 'sludge-bomb'] }))).toEqual([
      'move.notInChampions',
    ]);
  });

  it('flags abilities the form does not have', () => {
    expect(codes(venusaur({ abilityId: 'levitate' }))).toEqual(['ability.notAllowed']);
  });

  it('flags Stat Point spreads over the limits', () => {
    expect(codes(venusaur({ statPoints: { hp: 32, atk: 32, def: 32, spa: 0, spd: 0, spe: 0 } }))).toEqual([
      'sp.totalExceeded',
    ]);
  });

  it('flags forms that are not usable in Champions or only exist in battle', () => {
    expect(codes(venusaur({ formId: 'bulbasaur', abilityId: null, itemId: null }))).toContain(
      'member.notInChampions',
    );
    expect(codes(venusaur({ formId: 'venusaur-mega', abilityId: null }))).toContain('member.battleOnlyForm');
  });

  it('reports unknown IDs without crashing', () => {
    expect(codes(venusaur({ formId: 'missingno' }))).toEqual(['member.unknownForm']);
    expect(codes(venusaur({ itemId: 'mystery-item' }))).toEqual(['item.unknown']);
  });

  it('uses the gameplay form for appearance variants', () => {
    const polar = {
      ...createMember('vivillon-polar', rules),
      abilityId: 'shield-dust',
      alignmentId: 'timid',
      moves: ['quiver-dance', 'protect', null, null],
    };
    expect(codes(polar)).toEqual(['move.emptySlots']);
  });

  it('warns when a Mega Stone does not match the holder', () => {
    expect(codes(venusaur({ itemId: 'charizardite-x' }))).toEqual(['mega.stoneMismatch']);
  });

  it('flags items that are not in Champions', () => {
    expect(codes(venusaur({ itemId: 'old-amber' }))).toEqual(['item.notInChampions']);
  });
});

describe('team checks', () => {
  it('warns about repeated species and items, and about several possible Megas', () => {
    const team = { ...createTeam('Test'), members: [venusaur(), venusaur()] };
    const issues = validateTeam(team, ctx, [megaMechanic]);
    expect(issues.map((issue) => issue.code)).toEqual([
      'team.duplicateSpecies',
      'team.duplicateItem',
      'mega.onlyOnePerBattle',
    ]);
    expect(worstSeverity(issues)).toBe('warning');
  });

  it('can switch tournament rules off', () => {
    const team = { ...createTeam('Test'), members: [venusaur(), venusaur({ itemId: null })] };
    const issues = validateTeam(team, ctx, [], { speciesClause: false, itemClause: false });
    expect(issues).toEqual([]);
  });

  it('flags teams with too many members', () => {
    const team = {
      ...createTeam('Big'),
      members: Array.from({ length: 7 }, () => venusaur({ itemId: null })),
    };
    expect(validateTeam(team, ctx, [], { speciesClause: false, itemClause: false })[0]?.code).toBe(
      'team.tooManyMembers',
    );
  });
});

describe('move slots', () => {
  it('pads and compacts move slots', () => {
    expect(createMember('venusaur', rules).moves).toEqual([null, null, null, null]);
    expect(normalizeMoveSlots([null, 'protect', null], rules)).toEqual(['protect', null, null, null]);
  });
});
