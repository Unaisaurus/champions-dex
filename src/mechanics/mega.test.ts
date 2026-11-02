import { describe, expect, it } from 'vitest';
import type { Form, Item } from '@/data/contracts';
import { forms as fixtureForms } from '@/test/fixtures';
import { megaFormWith } from './mega';

const base = fixtureForms[0] as Form;
const form = (id: string, partial: Partial<Form> = {}): Form => ({
  ...base,
  id,
  speciesId: 'meowstic',
  kind: 'base',
  display: 'entry',
  parentEntry: null,
  gameplayForm: null,
  battleOnly: false,
  megaStone: null,
  ...partial,
});

const forms = new Map(
  [
    form('meowstic'),
    form('meowstic-female', { kind: 'gender', display: 'profile', parentEntry: 'meowstic' }),
    form('meowstic-male-mega', {
      kind: 'mega',
      display: 'profile',
      parentEntry: 'meowstic',
      battleOnly: true,
    }),
    form('meowstic-female-mega', {
      kind: 'mega',
      display: 'profile',
      parentEntry: 'meowstic',
      battleOnly: true,
    }),
  ].map((entry) => [entry.id, entry]),
);
const meowsticite: Item = {
  id: 'meowsticite',
  category: 'mega-stone',
  availableInChampions: true,
  icon: null,
  megaEvolutions: [
    { from: 'meowstic', to: 'meowstic-male-mega' },
    { from: 'meowstic-female', to: 'meowstic-female-mega' },
  ],
  caveats: [],
};
const ctx = { forms, items: new Map([[meowsticite.id, meowsticite]]) };

describe('Mega Evolution', () => {
  it('gives each form its own Mega when one stone works for several', () => {
    expect(megaFormWith('meowstic', 'meowsticite', ctx)?.id).toBe('meowstic-male-mega');
    // Female Meowstic's Pokédex entry is male Meowstic, but its own match comes first.
    expect(megaFormWith('meowstic-female', 'meowsticite', ctx)?.id).toBe('meowstic-female-mega');
  });

  it('finds nothing without a matching stone', () => {
    expect(megaFormWith('meowstic', null, ctx)).toBeNull();
    expect(megaFormWith('venusaur', 'meowsticite', ctx)).toBeNull();
  });
});
