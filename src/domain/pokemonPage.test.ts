import { describe, expect, it } from 'vitest';
import type { Form, LearnsetEntry, Move, TypesFile } from '@/data/contracts';
import { abilityMatchupNotes } from './abilityMatchups';
import { describeCondition } from './evolution';
import {
  DEFAULT_LEARNSET_QUERY,
  learnFilterCounts,
  learnsetFormId,
  viewLearnset,
  type LearnsetViewSource,
} from './learnsetView';
import { buildSearchText } from './search';

const typesFile: TypesFile = {
  types: ['normal', 'fire', 'water', 'electric', 'grass', 'ground', 'ghost', 'flying'],
  chart: {
    ground: { electric: 2, flying: 0 },
    water: { fire: 2, grass: 0.5 },
    fire: { grass: 2, water: 0.5 },
    normal: { ghost: 0 },
  },
};

describe('ability matchup notes', () => {
  it('notes what an Ability changes', () => {
    expect(abilityMatchupNotes(['electric', 'ghost'], ['levitate'], typesFile)).toEqual([
      { ability: 'levitate', changes: [{ type: 'ground', before: 2, after: 0 }] },
    ]);
  });

  it('skips Abilities that change nothing', () => {
    // A Flying type is already immune to Ground.
    expect(abilityMatchupNotes(['flying'], ['levitate', 'blaze'], typesFile)).toEqual([]);
  });

  it('handles several changes', () => {
    expect(abilityMatchupNotes(['grass'], ['dry-skin'], typesFile)[0]?.changes).toEqual([
      { type: 'water', before: 0.5, after: 0 },
      { type: 'fire', before: 2, after: 2.5 },
    ]);
  });
});

describe('evolution phrases', () => {
  it('describes levels, items and trades', () => {
    expect(describeCondition({ trigger: 'level-up', minLevel: 16 })).toEqual([{ key: 'level', level: 16 }]);
    expect(describeCondition({ trigger: 'use-item', item: 'thunder-stone', region: 'alola' })).toEqual([
      { key: 'item', item: 'thunder-stone' },
      { key: 'region', region: 'alola' },
    ]);
    expect(describeCondition({ trigger: 'trade', heldItem: 'kings-rock' })).toEqual([
      { key: 'trade' },
      { key: 'holding', item: 'kings-rock' },
    ]);
  });

  it('describes friendship, time and gender', () => {
    expect(describeCondition({ trigger: 'level-up', minHappiness: 160, timeOfDay: 'night' })).toEqual([
      { key: 'levelUp' },
      { key: 'friendship' },
      { key: 'time', time: 'night' },
    ]);
    expect(describeCondition({ trigger: 'use-item', item: 'dawn-stone', gender: 'male' })[1]).toEqual({
      key: 'gender',
      gender: 'male',
    });
  });

  it('describes move-based and special methods', () => {
    expect(describeCondition({ trigger: 'use-move', usedMove: 'rage-fist', moveCount: 20 })).toEqual([
      { key: 'useMove', move: 'rage-fist', count: 20 },
    ]);
    expect(describeCondition({ trigger: 'three-defeated-bisharp' })).toEqual([{ key: 'bisharp' }]);
    expect(describeCondition({ trigger: 'something-new' })).toEqual([{ key: 'other' }]);
  });
});

function move(id: string, extra: Partial<Move>): Move {
  return {
    id,
    type: 'normal',
    category: 'physical',
    power: 50,
    accuracy: 100,
    pp: 16,
    priority: 0,
    target: 'selected-pokemon',
    makesContact: true,
    availableInChampions: true,
    caveats: [],
    ...extra,
  };
}

describe('learnset view', () => {
  const moves = new Map([
    ['thunderbolt', move('thunderbolt', { type: 'electric', category: 'special', power: 90 })],
    ['protect', move('protect', { category: 'status', power: null, accuracy: null, pp: 8 })],
    ['earthquake', move('earthquake', { type: 'ground', power: 100 })],
    ['aerial-ace', move('aerial-ace', { type: 'flying', power: 60, accuracy: null })],
  ]);
  const names: Record<string, string> = {
    thunderbolt: 'Thunderbolt',
    protect: 'Protect',
    earthquake: 'Earthquake',
    'aerial-ace': 'Aerial Ace',
  };
  const source: LearnsetViewSource = {
    move: (id) => moves.get(id),
    name: (id) => names[id] ?? id,
    searchText: (id) => buildSearchText([names[id] ?? id, id === 'thunderbolt' ? 'Rayo' : '']),
    compareNames: (a, b) => a.localeCompare(b),
    typeOrder: (type) => typesFile.types.indexOf(type),
  };
  const entries: LearnsetEntry[] = [
    { move: 'thunderbolt', methods: ['machine'], newInChampions: false },
    { move: 'protect', methods: ['machine'], newInChampions: false },
    { move: 'earthquake', methods: [], newInChampions: true },
    { move: 'aerial-ace', methods: ['tutor'], newInChampions: false },
  ];
  const view = (query: Partial<typeof DEFAULT_LEARNSET_QUERY>) =>
    viewLearnset(entries, source, { ...DEFAULT_LEARNSET_QUERY, ...query }).map((row) => row.move.id);

  it('sorts by name by default', () => {
    expect(view({})).toEqual(['aerial-ace', 'earthquake', 'protect', 'thunderbolt']);
  });

  it('sorts by power with status moves last', () => {
    expect(view({ sort: 'power', direction: 'desc' })).toEqual([
      'earthquake',
      'thunderbolt',
      'aerial-ace',
      'protect',
    ]);
    expect(view({ sort: 'power', direction: 'asc' })).toEqual([
      'aerial-ace',
      'thunderbolt',
      'earthquake',
      'protect',
    ]);
  });

  it('counts never-missing moves as the most accurate', () => {
    expect(view({ sort: 'accuracy', direction: 'desc' })).toEqual([
      'aerial-ace',
      'protect',
      'earthquake',
      'thunderbolt',
    ]);
  });

  it('filters by search in any language, type and category', () => {
    expect(view({ search: 'rayo' })).toEqual(['thunderbolt']);
    expect(view({ type: 'ground' })).toEqual(['earthquake']);
    expect(view({ category: 'status' })).toEqual(['protect']);
  });

  it('filters by how moves were learned before, or new in Champions', () => {
    expect(view({ methods: ['new'] })).toEqual(['earthquake']);
    expect(view({ methods: ['tutor'] })).toEqual(['aerial-ace']);
    // Several tags: moves with any of them.
    expect(view({ methods: ['tutor', 'new'] })).toEqual(['aerial-ace', 'earthquake']);
    // Combined with the other filters.
    expect(view({ methods: ['machine'], category: 'status' })).toEqual(['protect']);
  });

  it('counts the tags a learnset has', () => {
    expect([...learnFilterCounts(entries)]).toEqual([
      ['machine', 2],
      ['tutor', 1],
      ['new', 1],
    ]);
  });

  it('finds which learnset a form uses', () => {
    const base = { id: 'charizard', gameplayForm: null, parentEntry: null } as Form;
    const mega = { id: 'charizard-mega-x', gameplayForm: null, parentEntry: 'charizard' } as Form;
    const pattern = { id: 'vivillon-polar', gameplayForm: 'vivillon', parentEntry: 'vivillon' } as Form;
    const has = (id: string) => ['charizard', 'vivillon', 'meowstic-female'].includes(id);
    const megaBase = (id: string) => (id === 'meowstic-female-mega' ? 'meowstic-female' : undefined);
    expect(learnsetFormId(base, has, megaBase)).toBe('charizard');
    expect(learnsetFormId(mega, has, megaBase)).toBe('charizard');
    expect(learnsetFormId(pattern, has, megaBase)).toBe('vivillon');
    const femaleMega = { id: 'meowstic-female-mega', gameplayForm: null, parentEntry: 'meowstic' } as Form;
    expect(learnsetFormId(femaleMega, has, megaBase)).toBe('meowstic-female');
  });
});
