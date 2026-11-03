import { describe, expect, it } from 'vitest';
import { isEmptySummary, summariseChanges } from './changelog';

describe('data changelog', () => {
  it('reads back the change notes the updater writes', () => {
    const summary = summariseChanges({
      added: { forms: ['raichu-mega-x'], moves: ['tera-blast'] },
      removed: { items: ['old-amber'] },
      changed: {
        forms: ['venusaur (types, baseStats)'],
        moves: ['protect (pp: 10 → 8, priority: 4 → 3)'],
        learnsets: ['venusaur: +frenzy-plant −tackle'],
        'dex-entries': ['raichu-alola'],
        text: ['genus:5'],
      },
    });
    expect(summary.formsChanged).toEqual([{ id: 'venusaur', fields: ['types', 'baseStats'] }]);
    expect(summary.movesChanged).toEqual([
      {
        id: 'protect',
        details: [
          { field: 'pp', from: '10', to: '8' },
          { field: 'priority', from: '4', to: '3' },
        ],
      },
    ]);
    expect(summary.learnsets).toEqual([{ id: 'venusaur', gained: ['frenzy-plant'], lost: ['tackle'] }]);
    expect(summary.text).toEqual([{ file: 'genus', count: 5 }]);
    expect(summary.itemsRemoved).toEqual(['old-amber']);
    expect(isEmptySummary(summary)).toBe(false);
  });

  it('knows when an update changed nothing', () => {
    expect(isEmptySummary(summariseChanges({ added: {}, removed: {}, changed: {} }))).toBe(true);
  });
});
