import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { SORT_KEYS, defaultDirection, type PokedexQuery, type SortKey } from '@/domain/pokedex';
import styles from './PokedexPage.module.css';

/** The sort menu and the direction button next to it. */
export function SortControl({
  query,
  onChange,
}: {
  query: PokedexQuery;
  onChange(change: Partial<PokedexQuery>): void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const label = (key: SortKey) =>
    key === 'dex' || key === 'name' || key === 'height' || key === 'weight' || key === 'total'
      ? t(`pokedex.sort.${key}`)
      : t(`stats.${key}`);
  const ascending = query.direction === 'asc';
  const directionLabel =
    query.sort === 'name'
      ? t(ascending ? 'pokedex.sort.aToZ' : 'pokedex.sort.zToA')
      : t(ascending ? 'pokedex.sort.lowestFirst' : 'pokedex.sort.highestFirst');

  return (
    <div className={styles.sort}>
      <label htmlFor={id} className={styles.sortLabel}>
        {t('pokedex.sort.label')}
      </label>
      <select
        id={id}
        className={styles.select}
        value={query.sort}
        onChange={(event) => {
          const sort = event.target.value as SortKey;
          onChange({ sort, direction: defaultDirection(sort) });
        }}
      >
        {SORT_KEYS.map((key) => (
          <option key={key} value={key}>
            {label(key)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={directionLabel}
        title={directionLabel}
        onClick={() => onChange({ direction: ascending ? 'desc' : 'asc' })}
      >
        {ascending ? (
          <ArrowUpNarrowWide size={20} aria-hidden="true" />
        ) : (
          <ArrowDownWideNarrow size={20} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
