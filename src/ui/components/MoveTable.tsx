import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import type { Id, Move, MoveCategory } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { MOVE_SORT_KEYS, defaultMoveDirection, type MoveSortKey } from '@/domain/learnsetView';
import { useGameText } from '@/i18n/useGameText';
import { SearchField } from './SearchField';
import { ToggleChip } from './ToggleChip';
import { TypeBadge } from './TypeBadge';
import styles from './MoveTable.module.css';

/*
 * The parts every move table shares (a Pokémon's learnset, the move list):
 * search with type and category filters, the count with sorting for phones,
 * and the table itself, with sortable columns. On phones each move becomes a
 * small card.
 */

const CATEGORIES: readonly MoveCategory[] = ['physical', 'special', 'status'];

/** What these parts read and change of a move table's query. */
export interface MoveTableQuery {
  search: string;
  type: Id | null;
  category: MoveCategory | null;
  sort: MoveSortKey;
  direction: 'asc' | 'desc';
}

interface QueryProps {
  query: MoveTableQuery;
  onChange(change: Partial<MoveTableQuery>): void;
}

/** A select styled like the move filters' own. */
export function FilterSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={styles.select} />;
}

/** Search, type and category. `selects` go after the type, `chips` after the categories. */
export function MoveFilters({
  query,
  onChange,
  searchLabel,
  selects,
  chips,
}: QueryProps & { searchLabel: string; selects?: ReactNode; chips?: ReactNode }) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  return (
    <div className={styles.filters}>
      <SearchField label={searchLabel} value={query.search} onChange={(search) => onChange({ search })} />
      <FilterSelect
        aria-label={t('pokemon.moves.type')}
        value={query.type ?? ''}
        onChange={(event) => onChange({ type: event.target.value || null })}
      >
        <option value="">{t('pokemon.moves.allTypes')}</option>
        {data.types.types.map((type) => (
          <option key={type} value={type}>
            {text.name('type-names', type)}
          </option>
        ))}
      </FilterSelect>
      {selects}
      <div className={styles.chips} role="group" aria-label={t('pokemon.moves.category')}>
        {CATEGORIES.map((category) => (
          <ToggleChip
            key={category}
            pressed={query.category === category}
            onToggle={() => onChange({ category: query.category === category ? null : category })}
            dot={`var(--category-${category})`}
          >
            {t(`moveCategories.${category}`)}
          </ToggleChip>
        ))}
        {chips}
      </div>
    </div>
  );
}

const columnKey = (key: MoveSortKey) => `pokemon.moves.${key === 'name' ? 'move' : key}`;

/** How many moves are listed, and sorting for phones, where the column headers are hidden. */
export function MoveSortBar({ count, query, onChange }: QueryProps & { count: number }) {
  const { t } = useTranslation();
  return (
    <div className={styles.bar}>
      <p className={styles.count} aria-live="polite">
        {t('pokemon.moves.count', { count })}
      </p>
      <div className={styles.mobileSort}>
        <FilterSelect
          aria-label={t('pokedex.sort.label')}
          value={query.sort}
          onChange={(event) => {
            const sort = event.target.value as MoveSortKey;
            onChange({ sort, direction: defaultMoveDirection(sort) });
          }}
        >
          {MOVE_SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(columnKey(key))}
            </option>
          ))}
        </FilterSelect>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t(query.direction === 'asc' ? 'pokedex.sort.lowestFirst' : 'pokedex.sort.highestFirst')}
          onClick={() => onChange({ direction: query.direction === 'asc' ? 'desc' : 'asc' })}
        >
          {query.direction === 'asc' ? (
            <ArrowUpNarrowWide size={18} aria-hidden="true" />
          ) : (
            <ArrowDownWideNarrow size={18} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

/** A move's category with its coloured dot ("● Physical"). */
export function CategoryLabel({ category }: { category: MoveCategory }) {
  const { t } = useTranslation();
  return (
    <span className={styles.category} data-category={category}>
      {t(`moveCategories.${category}`)}
    </span>
  );
}

/** "New" (new in Champions) or "Changed" (changed in Champions), next to a move's name. */
export function MoveBadge({ kind }: { kind: 'new' | 'changed' }) {
  const { t } = useTranslation();
  return kind === 'new' ? (
    <span className={`${styles.badge} ${styles.newBadge}`}>{t('pokemon.moves.new')}</span>
  ) : (
    <span className={`${styles.badge} ${styles.changedBadge}`} title={t('pokemon.moves.changedTitle')}>
      {t('pokemon.moves.changed')}
    </span>
  );
}

interface MoveTableProps<Row extends { move: Move }> extends QueryProps {
  rows: readonly Row[];
  /** The move's name: a link, or a button that opens details. */
  name(row: Row): ReactNode;
  /** More column headers, after the shared ones… */
  extraHead?: ReactNode;
  /** …and their cells (on phones they take a full line of the card). */
  extraCells?(row: Row): ReactNode;
  /** More rows under a move (its details when opened). */
  details?(row: Row): ReactNode;
}

/** The table: name, type, category, power, accuracy and PP, sorted by clicking a column. */
export function MoveTable<Row extends { move: Move }>({
  rows,
  query,
  onChange,
  name,
  extraHead,
  extraCells,
  details,
}: MoveTableProps<Row>) {
  const { t } = useTranslation();
  const sortBy = (sort: MoveSortKey) =>
    onChange(
      sort === query.sort
        ? { direction: query.direction === 'asc' ? 'desc' : 'asc' }
        : { sort, direction: defaultMoveDirection(sort) },
    );
  const ariaSort = (key: MoveSortKey) =>
    query.sort === key ? (query.direction === 'asc' ? 'ascending' : 'descending') : undefined;

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {MOVE_SORT_KEYS.map((key) => (
            <th key={key} scope="col" aria-sort={ariaSort(key)} className={styles[`col-${key}`]}>
              <button type="button" onClick={() => sortBy(key)}>
                {t(columnKey(key))}
                {query.sort === key && (query.direction === 'asc' ? ' ▲' : ' ▼')}
              </button>
            </th>
          ))}
          {extraHead}
        </tr>
      </thead>
      {rows.map((row) => {
        const { move } = row;
        return (
          <tbody key={move.id} className={styles.move}>
            <tr className={styles.row}>
              <th scope="row" className={styles['col-name']}>
                {name(row)}
                {move.mainSeries && <MoveBadge kind="changed" />}
              </th>
              <td className={styles['col-type']}>
                <TypeBadge type={move.type} size="sm" />
              </td>
              <td className={styles['col-category']}>
                <CategoryLabel category={move.category} />
              </td>
              <td className={styles['col-power']} data-label={t('pokemon.moves.power')}>
                {move.power ?? '—'}
              </td>
              <td
                className={styles['col-accuracy']}
                data-label={t('pokemon.moves.accuracy')}
                title={move.accuracy === null ? t('pokemon.moves.neverMisses') : undefined}
              >
                {move.accuracy ?? '—'}
              </td>
              <td className={styles['col-pp']} data-label={t('pokemon.moves.pp')}>
                {move.pp}
              </td>
              {extraCells?.(row)}
            </tr>
            {details?.(row)}
          </tbody>
        );
      })}
    </table>
  );
}
