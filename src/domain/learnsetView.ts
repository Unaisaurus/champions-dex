/**
 * The learnset table on a Pokémon's page: which learnset a form uses, and the
 * filtering and sorting of its rows.
 */
import type { Form, Id, LearnMethod, LearnsetEntry, Move, MoveCategory } from '@/data/contracts';
import { matchesSearch } from './search';

/**
 * The form whose learnset applies: the form's own, else (Megas) the form that
 * Mega Evolves into it, else the form it borrows its data from.
 */
export function learnsetFormId(
  form: Form,
  hasLearnset: (formId: Id) => boolean,
  megaBaseOf: (formId: Id) => Id | undefined,
): Id | null {
  const candidates = [form.id, megaBaseOf(form.id), form.gameplayForm, form.parentEntry];
  return candidates.find((id): id is Id => !!id && hasLearnset(id)) ?? null;
}

export const MOVE_SORT_KEYS = ['name', 'type', 'category', 'power', 'accuracy', 'pp'] as const;
export type MoveSortKey = (typeof MOVE_SORT_KEYS)[number];

/** A tag to filter the learnset by: how a move was learned before, or new in Champions. */
export type LearnFilter = LearnMethod | 'new';

/** Every tag, in the order they're shown. */
export const LEARN_FILTERS: readonly LearnFilter[] = [
  'level-up',
  'machine',
  'tutor',
  'egg',
  'event',
  'pre-evolution',
  'form-change',
  'other',
  'new',
];

export interface LearnsetQuery {
  search: string;
  type: Id | null;
  category: MoveCategory | null;
  /** Moves with any of these tags (none chosen: every move). */
  methods: LearnFilter[];
  sort: MoveSortKey;
  direction: 'asc' | 'desc';
}

export const DEFAULT_LEARNSET_QUERY: LearnsetQuery = {
  search: '',
  type: null,
  category: null,
  methods: [],
  sort: 'name',
  direction: 'asc',
};

/** Names sort A–Z first; numbers highest first. */
export function defaultMoveDirection(sort: MoveSortKey): 'asc' | 'desc' {
  return sort === 'power' || sort === 'accuracy' || sort === 'pp' ? 'desc' : 'asc';
}

export interface LearnsetRow {
  entry: LearnsetEntry;
  move: Move;
  name: string;
}

export interface LearnsetViewSource {
  move(id: Id): Move | undefined;
  name(moveId: Id): string;
  /** Normalised names of the move in every language. */
  searchText(moveId: Id): string;
  compareNames(a: string, b: string): number;
  /** Position of a type in the usual type order. */
  typeOrder(type: Id): number;
}

const CATEGORY_ORDER: Record<MoveCategory, number> = { physical: 0, special: 1, status: 2 };

/** A move that never misses is the most accurate of all. */
const accuracyValue = (move: Move) => move.accuracy ?? 101;

function hasTag(entry: LearnsetEntry, tag: LearnFilter): boolean {
  return tag === 'new' ? entry.newInChampions : entry.methods.includes(tag);
}

/** True if the move has any of these tags (or no tags are chosen). */
export function hasAnyTag(entry: LearnsetEntry, tags: readonly LearnFilter[]): boolean {
  return tags.length === 0 || tags.some((tag) => hasTag(entry, tag));
}

/** Every tag of one learnset entry, in the order they're shown. */
export function tagsOf(entry: LearnsetEntry): LearnFilter[] {
  return LEARN_FILTERS.filter((tag) => hasTag(entry, tag));
}

/** The tags a move has in any of these learnsets (how anyone learned it), in the order they're shown. */
export function tagsOfMove(learnsets: Iterable<readonly LearnsetEntry[]>, move: Id): LearnFilter[] {
  const found = new Set<LearnFilter>();
  for (const entries of learnsets) {
    const entry = entries.find((candidate) => candidate.move === move);
    if (entry) for (const tag of tagsOf(entry)) found.add(tag);
  }
  return LEARN_FILTERS.filter((tag) => found.has(tag));
}

/** How many moves of a learnset have each tag; tags no move has are left out. */
export function learnFilterCounts(entries: readonly LearnsetEntry[]): Map<LearnFilter, number> {
  const counts = new Map<LearnFilter, number>();
  for (const tag of LEARN_FILTERS) {
    const count = entries.filter((entry) => hasTag(entry, tag)).length;
    if (count > 0) counts.set(tag, count);
  }
  return counts;
}

export function viewLearnset(
  entries: readonly LearnsetEntry[],
  source: LearnsetViewSource,
  query: LearnsetQuery,
): LearnsetRow[] {
  const rows: LearnsetRow[] = [];
  for (const entry of entries) {
    const move = source.move(entry.move);
    if (!move) continue;
    if (query.type && move.type !== query.type) continue;
    if (query.category && move.category !== query.category) continue;
    if (!hasAnyTag(entry, query.methods)) continue;
    if (query.search.trim() && !matchesSearch(source.searchText(move.id), query.search)) continue;
    rows.push({ entry, move, name: source.name(move.id) });
  }

  return sortMoveRows(rows, source, query.sort, query.direction);
}

/** Sorts move rows by a column; ties (and everything else) by name. */
export function sortMoveRows<T extends { move: Move; name: string }>(
  rows: T[],
  source: Pick<LearnsetViewSource, 'compareNames' | 'typeOrder'>,
  sort: MoveSortKey,
  direction: 'asc' | 'desc',
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  const byName = (a: T, b: T) => source.compareNames(a.name, b.name);
  const compare: Record<MoveSortKey, (a: T, b: T) => number> = {
    name: byName,
    type: (a, b) => source.typeOrder(a.move.type) - source.typeOrder(b.move.type),
    category: (a, b) => CATEGORY_ORDER[a.move.category] - CATEGORY_ORDER[b.move.category],
    power: (a, b) => (a.move.power ?? -1) - (b.move.power ?? -1),
    accuracy: (a, b) => accuracyValue(a.move) - accuracyValue(b.move),
    pp: (a, b) => a.move.pp - b.move.pp,
  };
  const primary = compare[sort];
  return rows.sort((a, b) => {
    // Moves without power (status moves) stay at the bottom when sorting by power.
    if (sort === 'power' && (a.move.power === null) !== (b.move.power === null)) {
      return a.move.power === null ? 1 : -1;
    }
    return primary(a, b) * sign || byName(a, b);
  });
}
