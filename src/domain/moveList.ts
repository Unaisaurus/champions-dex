/**
 * The move list (#/moves): every move usable in Champions, searched, filtered
 * and sorted. The choices live in the page address, like the Pokédex's.
 */
import { MOVE_KINDS, type Id, type Move, type MoveCategory, type MoveKind } from '@/data/contracts';
import {
  MOVE_SORT_KEYS,
  defaultMoveDirection,
  sortMoveRows,
  type LearnsetViewSource,
  type MoveSortKey,
} from './learnsetView';
import { matchesSearch } from './search';

export interface MoveListQuery {
  search: string;
  type: Id | null;
  category: MoveCategory | null;
  kind: MoveKind | null;
  /** Only moves Champions changed from the main series. */
  changedOnly: boolean;
  sort: MoveSortKey;
  direction: 'asc' | 'desc';
}

export const DEFAULT_MOVE_LIST_QUERY: MoveListQuery = {
  search: '',
  type: null,
  category: null,
  kind: null,
  changedOnly: false,
  sort: 'name',
  direction: 'asc',
};

const CATEGORIES: readonly MoveCategory[] = ['physical', 'special', 'status'];
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const oneOf = <T extends string>(values: readonly T[], value: string | null): T | null =>
  values.find((candidate) => candidate === value) ?? null;

/** Reads the list's choices from the address, ignoring anything malformed. */
export function moveListFromParams(params: URLSearchParams): MoveListQuery {
  const sort = oneOf(MOVE_SORT_KEYS, params.get('sort')) ?? DEFAULT_MOVE_LIST_QUERY.sort;
  const type = params.get('type');
  return {
    search: params.get('q') ?? '',
    type: type && ID_PATTERN.test(type) ? type : null,
    category: oneOf(CATEGORIES, params.get('cat')),
    kind: oneOf(MOVE_KINDS, params.get('kind')),
    changedOnly: params.get('changed') === '1',
    sort,
    direction: oneOf(['asc', 'desc'] as const, params.get('dir')) ?? defaultMoveDirection(sort),
  };
}

/** Writes the choices to the address, leaving out the defaults. */
export function paramsFromMoveList(query: MoveListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set('q', query.search);
  if (query.type) params.set('type', query.type);
  if (query.category) params.set('cat', query.category);
  if (query.kind) params.set('kind', query.kind);
  if (query.changedOnly) params.set('changed', '1');
  if (query.sort !== DEFAULT_MOVE_LIST_QUERY.sort) params.set('sort', query.sort);
  if (query.direction !== defaultMoveDirection(query.sort)) params.set('dir', query.direction);
  return params;
}

export interface MoveListRow {
  move: Move;
  name: string;
}

/** The moves to show, in order. */
export function viewMoves(
  moves: readonly Move[],
  source: Pick<LearnsetViewSource, 'name' | 'searchText' | 'compareNames' | 'typeOrder'>,
  query: MoveListQuery,
): MoveListRow[] {
  const typed = query.search.trim();
  const rows = moves
    .filter(
      (move) =>
        move.availableInChampions &&
        (!query.type || move.type === query.type) &&
        (!query.category || move.category === query.category) &&
        (!query.kind || move.kinds.includes(query.kind)) &&
        (!query.changedOnly || move.mainSeries !== undefined) &&
        (!typed || matchesSearch(source.searchText(move.id), typed)),
    )
    .map((move) => ({ move, name: source.name(move.id) }));
  return sortMoveRows(rows, source, query.sort, query.direction);
}
