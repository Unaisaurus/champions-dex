import { Search, SlidersHorizontal } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import {
  LIST_MODES,
  clearFilters,
  countActiveFilters,
  runPokedexQuery,
  sortValue,
  type PokedexQuery,
  type PokedexRow,
} from '@/domain/pokedex';
import { useGameText } from '@/i18n/useGameText';
import { Button } from '@/ui/components/Button';
import { Notice } from '@/ui/components/Notice';
import { PokemonCard } from '@/ui/components/PokemonCard';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { formatHeight, formatWeight } from '@/ui/format';
import { useFormLabels } from '@/ui/useFormLabels';
import { ActiveFilters } from './ActiveFilters';
import { FilterPanel } from './FilterPanel';
import { SortControl } from './SortControl';
import { useFilterOptions } from './useFilterOptions';
import { usePokedexQuery } from './usePokedexQuery';
import { usePokedexSource } from './usePokedexSource';
import styles from './PokedexPage.module.css';

const PANEL_KEY = 'champions-dex.pokedex.filtersOpen';
const PANEL_ID = 'pokedex-filters';
const RESULTS_ID = 'pokedex-results';

/** Whether the filter panel was left open, remembered for this browser tab only. */
function usePanelOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(PANEL_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(PANEL_KEY, open ? '1' : '0');
    } catch {
      // Storage may be unavailable (private browsing); the panel just starts closed.
    }
  }, [open]);
  return [open, setOpen];
}

/**
 * The Pokédex list, with search, filters and sorting. Everything you choose
 * is kept in the page address, so the back button returns to the same list.
 */
export function PokedexPage() {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const source = usePokedexSource();
  const options = useFilterOptions(source);
  const [query, update] = usePokedexQuery();
  const [panelOpen, setPanelOpen] = usePanelOpen();
  // Typing stays responsive while the list catches up.
  const deferredQuery = useDeferredValue(query);
  const rows = useMemo(() => runPokedexQuery(source, deferredQuery), [source, deferredQuery]);
  const active = countActiveFilters(query);
  const clear = () => update((current) => clearFilters(current));

  const extraFor = (row: PokedexRow, sort: PokedexQuery['sort']) => {
    const value = sortValue(row.form, sort);
    if (value === null) return undefined;
    if (sort === 'height') return formatHeight(value, text.language);
    if (sort === 'weight') return formatWeight(value, text.language);
    const name = sort === 'total' ? t('stats.total') : t(`stats.${sort}`);
    return `${name} ${value}`;
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{t('pokedex.title')}</h1>
        {data.manifest.sample && <Notice>{t('data.sampleNotice')}</Notice>}
      </header>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search size={20} aria-hidden="true" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            aria-label={t('pokedex.searchLabel')}
            placeholder={t('pokedex.searchPlaceholder')}
            value={query.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>
        <div className={styles.controls}>
          <Button
            variant="secondary"
            aria-expanded={panelOpen}
            aria-controls={PANEL_ID}
            onClick={() => setPanelOpen(!panelOpen)}
            className={styles.filtersButton}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            {t('pokedex.filters.title')}
            {active > 0 && (
              <span className={styles.badge} aria-label={t('pokedex.filters.activeCount', { count: active })}>
                {active}
              </span>
            )}
          </Button>
          <SortControl query={query} onChange={update} />
        </div>
      </div>

      {panelOpen && (
        <FilterPanel
          id={PANEL_ID}
          query={query}
          options={options}
          resultCount={rows.length}
          onChange={update}
          onClear={clear}
          onClose={() => {
            setPanelOpen(false);
            document.getElementById(RESULTS_ID)?.scrollIntoView?.({ block: 'start' });
          }}
        />
      )}
      <ActiveFilters query={query} onChange={update} onClear={clear} />

      <div className={styles.resultsBar} id={RESULTS_ID}>
        <p className={styles.count} aria-live="polite">
          {t('pokedex.results', { count: rows.length })}
        </p>
        <SegmentedControl
          label={t('pokedex.list.label')}
          value={query.listMode}
          onChange={(listMode) => update({ listMode })}
          options={LIST_MODES.map((mode) => ({ value: mode, label: t(`pokedex.list.${mode}`) }))}
        />
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p>
            {active === 0 && query.search.trim()
              ? t('pokedex.noResults', { query: query.search.trim() })
              : t('pokedex.noMatches')}
          </p>
          {active > 0 && <Button onClick={clear}>{t('pokedex.filters.clearAll')}</Button>}
        </div>
      ) : (
        <ul className={styles.grid}>
          {rows.map((row) => (
            <li key={row.form.id}>
              <PokemonCard
                form={row.form}
                species={row.species}
                subtitle={labels.get(row.form.id) ?? null}
                favouriteId={row.entry.id}
                extra={extraFor(row, deferredQuery.sort)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
