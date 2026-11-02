/**
 * The Pokédex list: what to show and in which order, from a query that can be
 * kept in the page address (so the back button and shared links keep it).
 *
 * Two ways of listing:
 * - one card per Pokédex entry (default). An entry matches if it or any of its
 *   forms (Megas, Rotom's appliances…) matches, and the card then shows the
 *   form that matched: filtering Dragon shows Charizard as Mega Charizard X.
 * - every form on its own card (`showForms`), each judged on its own data.
 *
 * Species-level filters (generation, favourites) always look at the entry:
 * Mega Charizard X is a Generation 1 Pokémon here, not a Generation 6 one.
 */
import type { Form, Id, PokedexColor, Species } from '@/data/contracts';
import { POKEDEX_COLORS, STAT_IDS } from '@/data/contracts';
import { generationTags, type GenerationMode } from './generations';
import { matchesSearch, parseDexNumberQuery } from './search';

export const SORT_KEYS = ['dex', 'name', 'height', 'weight', ...STAT_IDS, 'total'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

/** Filter categories: curated lists, PokéAPI flags, and two form-based ones. */
export const CATEGORY_FILTERS = [
  'starter',
  'legendary',
  'mythical',
  'ultra-beast',
  'paradox',
  'fossil',
  'baby',
  'mega',
  'regional',
] as const;
export type CategoryFilter = (typeof CATEGORY_FILTERS)[number];

/** Choosing more types than this would never match anything (Pokémon have two at most). */
export const MAX_TYPE_FILTERS = 2;
export const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface PokedexQuery {
  search: string;
  sort: SortKey;
  direction: SortDirection;
  /** Any of these generations; empty = all. */
  generations: readonly number[];
  /** All of these types. */
  types: readonly Id[];
  /** Any of these Pokédex colours. */
  colors: readonly PokedexColor[];
  /** Any of these categories. */
  categories: readonly CategoryFilter[];
  favouritesOnly: boolean;
  /** List Megas and other forms on their own cards. */
  showForms: boolean;
  /** Can learn this move in Champions. */
  move: Id | null;
  /** Has this Ability in Champions. */
  ability: Id | null;
}

export const DEFAULT_QUERY: PokedexQuery = {
  search: '',
  sort: 'dex',
  direction: 'asc',
  generations: [],
  types: [],
  colors: [],
  categories: [],
  favouritesOnly: false,
  showForms: false,
  move: null,
  ability: null,
};

/** Numbers read best lowest-first for the Pokédex order and names, highest-first for stats. */
export function defaultDirection(sort: SortKey): SortDirection {
  return sort === 'dex' || sort === 'name' ? 'asc' : 'desc';
}

// ---------------------------------------------------------------------------
// The page address: ?q=…&sort=spe&gen=1,2&types=fire&…
// ---------------------------------------------------------------------------

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);
const oneOf = <T extends string>(values: readonly T[], value: string | null): T | undefined =>
  values.find((candidate) => candidate === value);
const unique = <T>(values: readonly T[]) => [...new Set(values)];

/** Reads a query from the address, ignoring anything malformed or unknown. */
export function queryFromParams(params: URLSearchParams): PokedexQuery {
  const sort = oneOf(SORT_KEYS, params.get('sort')) ?? DEFAULT_QUERY.sort;
  const id = (value: string | null) => (value && ID_PATTERN.test(value) ? value : null);
  return {
    search: params.get('q') ?? '',
    sort,
    direction: oneOf(['asc', 'desc'] as const, params.get('dir')) ?? defaultDirection(sort),
    generations: unique(
      list(params.get('gen'))
        .map(Number)
        .filter((n) => (GENERATIONS as readonly number[]).includes(n)),
    ).sort((a, b) => a - b),
    types: unique(list(params.get('types')).filter((t) => ID_PATTERN.test(t))).slice(0, MAX_TYPE_FILTERS),
    colors: unique(
      list(params.get('colors')).flatMap((c) => {
        const colour = oneOf(POKEDEX_COLORS, c);
        return colour ? [colour] : [];
      }),
    ),
    categories: unique(
      list(params.get('cat')).flatMap((c) => {
        const category = oneOf(CATEGORY_FILTERS, c);
        return category ? [category] : [];
      }),
    ),
    favouritesOnly: params.get('fav') === '1',
    showForms: params.get('forms') === '1',
    move: id(params.get('move')),
    ability: id(params.get('ability')),
  };
}

/** Writes a query to the address, leaving out everything that's at its default. */
export function paramsFromQuery(query: PokedexQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.search) params.set('q', query.search);
  if (query.sort !== DEFAULT_QUERY.sort) params.set('sort', query.sort);
  if (query.direction !== defaultDirection(query.sort)) params.set('dir', query.direction);
  if (query.generations.length) params.set('gen', query.generations.join(','));
  if (query.types.length) params.set('types', query.types.join(','));
  if (query.colors.length) params.set('colors', query.colors.join(','));
  if (query.categories.length) params.set('cat', query.categories.join(','));
  if (query.favouritesOnly) params.set('fav', '1');
  if (query.showForms) params.set('forms', '1');
  if (query.move) params.set('move', query.move);
  if (query.ability) params.set('ability', query.ability);
  return params;
}

/** How many filters are on (search, sorting and the forms toggle don't count). */
export function countActiveFilters(query: PokedexQuery): number {
  return (
    query.generations.length +
    query.types.length +
    query.colors.length +
    query.categories.length +
    Number(query.favouritesOnly) +
    Number(query.move !== null) +
    Number(query.ability !== null)
  );
}

export function clearFilters(query: PokedexQuery): PokedexQuery {
  return {
    ...DEFAULT_QUERY,
    search: query.search,
    sort: query.sort,
    direction: query.direction,
    showForms: query.showForms,
  };
}

/** Adds or removes one value of a multi-choice filter. Types keep at most two, dropping the oldest. */
export function toggleValue<T>(values: readonly T[], value: T, max = Infinity): T[] {
  if (values.includes(value)) return values.filter((v) => v !== value);
  const next = [...values, value];
  return next.length > max ? next.slice(next.length - max) : next;
}

// ---------------------------------------------------------------------------
// Running a query
// ---------------------------------------------------------------------------

/** Everything the list needs to know about the game data and your data. */
export interface PokedexSource {
  /** Pokédex entries in National Dex order. */
  entries: readonly Form[];
  /** The forms shown on an entry's page besides the entry itself (Megas, Rotom forms…). */
  profilesOf(entryId: Id): readonly Form[];
  species(id: Id): Species | undefined;
  /** The moves a form can use in Champions (a Mega uses its base form's moves). */
  movesOf(form: Form): ReadonlySet<Id>;
  /** True if this form can Mega Evolve. */
  canMegaEvolve(form: Form): boolean;
  /** Normalised names of a form in every language (see domain/search). */
  searchText(formId: Id): string;
  /** The name shown on a card, for sorting by name. */
  displayName(form: Form): string;
  /** Compares two names in the current language. */
  compareNames(a: string, b: string): number;
  favourites: ReadonlySet<Id>;
  generationMode: GenerationMode;
}

export interface PokedexRow {
  /** The form shown on the card. */
  form: Form;
  /** The Pokédex entry it belongs to (the same form for plain entries). */
  entry: Form;
  species: Species;
}

/** The number a card is sorted by, or null when it has none (unknown height…). */
export function sortValue(form: Form, sort: SortKey): number | null {
  switch (sort) {
    case 'height':
      return form.heightDm;
    case 'weight':
      return form.weightHg;
    case 'total':
      return STAT_IDS.reduce((sum, stat) => sum + form.baseStats[stat], 0);
    case 'dex':
    case 'name':
      return null;
    default:
      return form.baseStats[sort];
  }
}

function hasCategory(form: Form, species: Species, category: CategoryFilter, source: PokedexSource) {
  switch (category) {
    case 'legendary':
      return species.isLegendary;
    case 'mythical':
      return species.isMythical;
    case 'baby':
      return species.isBaby;
    case 'mega':
      return form.kind === 'mega' || source.canMegaEvolve(form);
    case 'regional':
      return form.kind === 'regional';
    default:
      return species.categories.includes(category);
  }
}

export function runPokedexQuery(source: PokedexSource, query: PokedexQuery): PokedexRow[] {
  const search = query.search.trim();
  const dexNumber = search ? parseDexNumberQuery(search) : null;

  const entryMatches = (entry: Form) => {
    if (query.favouritesOnly && !source.favourites.has(entry.id)) return false;
    if (query.generations.length > 0) {
      const tags = generationTags(entry, source.generationMode);
      if (!tags.some((generation) => query.generations.includes(generation))) return false;
    }
    return true;
  };

  const formMatches = (form: Form, species: Species) => {
    if (search) {
      if (
        dexNumber !== null
          ? species.nationalDex !== dexNumber
          : !matchesSearch(source.searchText(form.id), search)
      ) {
        return false;
      }
    }
    if (!query.types.every((type) => form.types.includes(type))) return false;
    if (query.colors.length > 0 && !query.colors.includes(form.color ?? species.color)) return false;
    if (query.categories.length > 0 && !query.categories.some((c) => hasCategory(form, species, c, source))) {
      return false;
    }
    if (query.move && !source.movesOf(form).has(query.move)) return false;
    if (query.ability && !form.abilities.includes(query.ability)) return false;
    return true;
  };

  const rows: Array<PokedexRow & { order: number }> = [];
  source.entries.forEach((entry, entryIndex) => {
    const species = source.species(entry.speciesId);
    if (!species || !entryMatches(entry)) return;
    const group = [entry, ...source.profilesOf(entry.id)];
    if (query.showForms) {
      group.forEach((form, formIndex) => {
        if (formMatches(form, species))
          rows.push({ form, entry, species, order: entryIndex * 1000 + formIndex });
      });
    } else {
      const index = group.findIndex((form) => formMatches(form, species));
      const form = group[index];
      if (form) rows.push({ form, entry, species, order: entryIndex * 1000 + index });
    }
  });

  const direction = query.direction === 'asc' ? 1 : -1;
  if (query.sort === 'dex') {
    rows.sort((a, b) => (a.order - b.order) * direction);
  } else if (query.sort === 'name') {
    const names = new Map(rows.map((row) => [row, source.displayName(row.form)]));
    rows.sort(
      (a, b) => source.compareNames(names.get(a) ?? '', names.get(b) ?? '') * direction || a.order - b.order,
    );
  } else {
    const sort = query.sort;
    rows.sort((a, b) => {
      const va = sortValue(a.form, sort);
      const vb = sortValue(b.form, sort);
      // Unknown values go last whichever way the list is sorted.
      if (va === null || vb === null) return va === vb ? a.order - b.order : va === null ? 1 : -1;
      return (va - vb) * direction || a.order - b.order;
    });
  }
  return rows.map(({ form, entry, species }) => ({ form, entry, species }));
}
