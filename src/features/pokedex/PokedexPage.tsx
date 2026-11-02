import { Search } from 'lucide-react';
import { useDeferredValue, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import { matchesSearch, parseDexNumberQuery } from '@/domain/search';
import { Notice } from '@/ui/components/Notice';
import { PokemonCard } from '@/ui/components/PokemonCard';
import { useSearchIndex } from './useSearchIndex';
import styles from './PokedexPage.module.css';

/**
 * The Pokédex list. Stage 0 offers search; sorting and filters arrive in the
 * Pokédex stage. The search text is kept in the address (?q=…) so the back
 * button returns to the same results.
 */
export function PokedexPage() {
  const { t } = useTranslation();
  const data = useGameData();
  const index = useSearchIndex();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const trimmed = deferredQuery.trim();
    if (!trimmed) return data.championsEntries;
    const number = parseDexNumberQuery(trimmed);
    return data.championsEntries.filter((form) =>
      number !== null
        ? data.speciesById.get(form.speciesId)?.nationalDex === number
        : matchesSearch(index.get(form.id) ?? '', trimmed),
    );
  }, [data, index, deferredQuery]);

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
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setParams(value ? { q: value } : {}, { replace: true });
            }}
          />
        </div>
        <p className={styles.count} aria-live="polite">
          {t('pokedex.results', { count: results.length })}
        </p>
      </div>

      {results.length === 0 ? (
        <p className={styles.empty}>{t('pokedex.noResults', { query: query.trim() })}</p>
      ) : (
        <ul className={styles.grid}>
          {results.map((form) => {
            const species = data.speciesById.get(form.speciesId);
            return species ? (
              <li key={form.id}>
                <PokemonCard form={form} species={species} />
              </li>
            ) : null;
          })}
        </ul>
      )}
    </div>
  );
}
