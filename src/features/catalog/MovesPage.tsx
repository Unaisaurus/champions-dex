import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from 'lucide-react';
import { useDeferredValue, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MOVE_KINDS, type MoveCategory, type MoveKind } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { MOVE_SORT_KEYS, defaultMoveDirection, type MoveSortKey } from '@/domain/learnsetView';
import { moveListFromParams, paramsFromMoveList, viewMoves } from '@/domain/moveList';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { ToggleChip } from '@/ui/components/ToggleChip';
import { TypeBadge } from '@/ui/components/TypeBadge';
import { useTextSearchIndex } from '@/ui/useTextSearchIndex';
import { DexSections } from './DexSections';
import { useAddressQuery } from './useAddressQuery';
import styles from './Catalog.module.css';

const CATEGORIES: readonly MoveCategory[] = ['physical', 'special', 'status'];

/** Every move in Champions: search by name in any language, filter, sort, and open one. */
export function MovesPage() {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const searchIndex = useTextSearchIndex('move-names', data.moves);
  const [query, update] = useAddressQuery(moveListFromParams, paramsFromMoveList);
  // Typing stays responsive while the list catches up.
  const deferred = useDeferredValue(query);

  const rows = useMemo(() => {
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    return viewMoves(
      data.moves,
      {
        name: (id) => text.name('move-names', id),
        searchText: (id) => searchIndex.get(id) ?? '',
        compareNames: (a, b) => collator.compare(a, b),
        typeOrder: (type) => data.types.types.indexOf(type),
      },
      deferred,
    );
  }, [data, text, searchIndex, deferred]);

  const sortBy = (sort: MoveSortKey) =>
    update(
      sort === query.sort
        ? { direction: query.direction === 'asc' ? 'desc' : 'asc' }
        : { sort, direction: defaultMoveDirection(sort) },
    );
  const columnLabel = (key: MoveSortKey) => t(`pokemon.moves.${key === 'name' ? 'move' : key}`);
  const ariaSort = (key: MoveSortKey) =>
    query.sort === key ? (query.direction === 'asc' ? 'ascending' : 'descending') : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h1>{t('moves.title')}</h1>
          <DexSections />
        </div>
        <p className={styles.intro}>{t('moves.intro')}</p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search size={18} aria-hidden="true" className={styles.searchIcon} />
          <input
            type="search"
            aria-label={t('moves.search')}
            placeholder={t('moves.search')}
            value={query.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>
        <select
          aria-label={t('pokemon.moves.type')}
          value={query.type ?? ''}
          onChange={(event) => update({ type: event.target.value || null })}
          className={styles.select}
        >
          <option value="">{t('pokemon.moves.allTypes')}</option>
          {data.types.types.map((type) => (
            <option key={type} value={type}>
              {text.name('type-names', type)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('moves.kind')}
          value={query.kind ?? ''}
          onChange={(event) => update({ kind: (event.target.value || null) as MoveKind | null })}
          className={styles.select}
        >
          <option value="">{t('moves.anyKind')}</option>
          {MOVE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`moves.kinds.${kind}`)}
            </option>
          ))}
        </select>
        <div className={styles.chips} role="group" aria-label={t('pokemon.moves.category')}>
          {CATEGORIES.map((category) => (
            <ToggleChip
              key={category}
              pressed={query.category === category}
              onToggle={() => update({ category: query.category === category ? null : category })}
              dot={`var(--category-${category})`}
            >
              {t(`moveCategories.${category}`)}
            </ToggleChip>
          ))}
          <ToggleChip
            pressed={query.changedOnly}
            onToggle={() => update({ changedOnly: !query.changedOnly })}
          >
            {t('moves.changedOnly')}
          </ToggleChip>
        </div>
      </div>

      <div className={styles.bar}>
        <p className={styles.count} aria-live="polite">
          {t('pokemon.moves.count', { count: rows.length })}
        </p>
        {/* On phones the column headers are hidden, so sorting moves here. */}
        <div className={styles.mobileSort}>
          <select
            aria-label={t('pokedex.sort.label')}
            value={query.sort}
            onChange={(event) => {
              const sort = event.target.value as MoveSortKey;
              update({ sort, direction: defaultMoveDirection(sort) });
            }}
            className={styles.select}
          >
            {MOVE_SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {columnLabel(key)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t(
              query.direction === 'asc' ? 'pokedex.sort.lowestFirst' : 'pokedex.sort.highestFirst',
            )}
            onClick={() => update({ direction: query.direction === 'asc' ? 'desc' : 'asc' })}
          >
            {query.direction === 'asc' ? (
              <ArrowUpNarrowWide size={18} aria-hidden="true" />
            ) : (
              <ArrowDownWideNarrow size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>{t('pokemon.moves.noMatches')}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {MOVE_SORT_KEYS.map((key) => (
                  <th key={key} scope="col" aria-sort={ariaSort(key)} className={styles[`col-${key}`]}>
                    <button type="button" onClick={() => sortBy(key)}>
                      {columnLabel(key)}
                      {query.sort === key && (query.direction === 'asc' ? ' ▲' : ' ▼')}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ move, name }) => (
                <tr key={move.id} className={styles.row}>
                  <th scope="row" className={styles['col-name']}>
                    <Link to={`/moves/${move.id}`} className={styles.rowLink}>
                      {name}
                    </Link>
                    {move.mainSeries && (
                      <span className={styles.changedBadge} title={t('pokemon.moves.changedTitle')}>
                        {t('pokemon.moves.changed')}
                      </span>
                    )}
                  </th>
                  <td className={styles['col-type']}>
                    <TypeBadge type={move.type} size="sm" />
                  </td>
                  <td className={styles['col-category']}>
                    <span className={styles.category} data-category={move.category}>
                      {t(`moveCategories.${move.category}`)}
                    </span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
