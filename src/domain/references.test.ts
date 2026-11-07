// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameData } from '@/data/gameData';
import { realGameData } from '@/test/realData';
import { localeOf } from '@/i18n/languages';
import {
  DEFAULT_MOVE_LIST_QUERY,
  moveListFromParams,
  paramsFromMoveList,
  viewMoves,
  type MoveListQuery,
} from './moveList';
import { abilityHolders, evolutionItems, kindsForAbility, moveLearners } from './references';

let data: GameData;
beforeAll(async () => {
  data = await realGameData();
});

describe('who uses what', () => {
  it('lists the Pokémon that learn a move, once each, without Megas', () => {
    const learners = moveLearners(data);
    const thunderbolt = (learners.get('thunderbolt') ?? []).map((learner) => learner.form.id);
    expect(thunderbolt).toContain('pikachu');
    expect(thunderbolt).toContain('raichu-alola');
    expect(thunderbolt).not.toContain('venusaur');
    expect(thunderbolt.some((id) => id.includes('-mega'))).toBe(false);
    expect(new Set(thunderbolt).size).toBe(thunderbolt.length);
    // Vivillon's patterns all learn the same moves: it's listed once.
    const vivillon = (learners.get('hurricane') ?? []).filter(
      (learner) => learner.form.speciesId === 'vivillon',
    );
    expect(vivillon.map((learner) => learner.form.id)).toEqual(['vivillon']);
  });

  it('lists the Pokémon with an Ability, Mega Evolutions included', () => {
    const holders = abilityHolders(data);
    const drought = (holders.get('drought') ?? []).map((form) => form.id);
    expect(drought).toContain('ninetales');
    expect(drought).toContain('charizard-mega-y');
    expect(holders.get('mega-sol')?.map((form) => form.id)).toEqual(['meganium-mega']);
  });

  it('knows which evolutions an item is for', () => {
    const uses = evolutionItems(data);
    expect(uses.get('thunder-stone')).toContainEqual({ from: 'pikachu', to: 'raichu', how: 'use' });
    expect(uses.get('kings-rock')).toContainEqual({ from: 'slowpoke', to: 'slowking', how: 'hold' });
  });

  it('knows which Abilities react to a kind of move', () => {
    expect(kindsForAbility('iron-fist')).toEqual(['punch']);
    expect(kindsForAbility('punk-rock')).toEqual(['sound']);
    expect(kindsForAbility('intimidate')).toEqual([]);
  });
});

describe('the move list', () => {
  const view = (query: Partial<MoveListQuery>) => {
    const collator = new Intl.Collator(localeOf('en'), { sensitivity: 'base' });
    return viewMoves(
      data.moves,
      {
        name: (id) => id,
        searchText: (id) => id.replace(/-/g, ' '),
        compareNames: (a, b) => collator.compare(a, b),
        typeOrder: (type) => data.types.types.indexOf(type),
      },
      { ...DEFAULT_MOVE_LIST_QUERY, ...query },
    );
  };

  it('shows only moves usable in Champions', () => {
    const all = view({});
    expect(all.length).toBe(data.moves.filter((move) => move.availableInChampions).length);
    expect(all.every(({ move }) => move.availableInChampions)).toBe(true);
  });

  it('filters by type, category, kind and Champions changes', () => {
    const punches = view({ kind: 'punch' });
    expect(punches.length).toBeGreaterThan(10);
    expect(punches.every(({ move }) => move.kinds.includes('punch'))).toBe(true);
    expect(view({ type: 'fire', category: 'special' }).every(({ move }) => move.type === 'fire')).toBe(true);
    expect(view({ changedOnly: true }).every(({ move }) => move.mainSeries !== undefined)).toBe(true);
    expect(view({ search: 'thunder punch' }).map(({ move }) => move.id)).toEqual(['thunder-punch']);
  });

  it('sorts by power, strongest first, with status moves last', () => {
    const rows = view({ sort: 'power', direction: 'desc' });
    expect(rows[0]?.move.power).toBe(Math.max(...rows.map(({ move }) => move.power ?? 0)));
    expect(rows.at(-1)?.move.power).toBeNull();
  });

  it('keeps its choices in the page address', () => {
    const query: MoveListQuery = {
      ...DEFAULT_MOVE_LIST_QUERY,
      search: 'fang',
      type: 'fire',
      kind: 'bite',
      changedOnly: true,
      sort: 'power',
      direction: 'asc',
    };
    expect(moveListFromParams(paramsFromMoveList(query))).toEqual(query);
    expect(paramsFromMoveList(DEFAULT_MOVE_LIST_QUERY).toString()).toBe('');
    expect(moveListFromParams(new URLSearchParams('kind=nonsense&sort=oops&type=Fire!'))).toEqual(
      DEFAULT_MOVE_LIST_QUERY,
    );
  });
});
