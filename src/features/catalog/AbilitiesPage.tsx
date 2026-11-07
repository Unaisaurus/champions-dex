import { Search } from 'lucide-react';
import { useDeferredValue, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import { matchesSearch } from '@/domain/search';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { useTextSearchIndex } from '@/ui/useTextSearchIndex';
import { DexSections } from './DexSections';
import { useAddressQuery } from './useAddressQuery';
import { useReferences } from './useReferences';
import styles from './Catalog.module.css';

interface AbilityListQuery {
  search: string;
}
const readQuery = (params: URLSearchParams): AbilityListQuery => ({ search: params.get('q') ?? '' });
const writeQuery = ({ search }: AbilityListQuery) => new URLSearchParams(search ? { q: search } : {});

/** Every Ability in Champions, with what it does and how many Pokémon have it. */
export function AbilitiesPage() {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const { holders } = useReferences();
  const searchIndex = useTextSearchIndex('ability-names', data.abilities);
  const [query, update] = useAddressQuery(readQuery, writeQuery);
  const search = useDeferredValue(query.search).trim();

  const rows = useMemo(() => {
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    return data.abilities
      .filter((ability) => ability.availableInChampions)
      .filter((ability) => !search || matchesSearch(searchIndex.get(ability.id) ?? '', search))
      .map((ability) => ({
        ability,
        name: text.name('ability-names', ability.id),
        description: text.get('ability-descriptions', ability.id)?.text,
        count: holders.get(ability.id)?.length ?? 0,
      }))
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [data, text, holders, searchIndex, search]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h1>{t('abilities.title')}</h1>
          <DexSections />
        </div>
        <p className={styles.intro}>{t('abilities.intro')}</p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search size={18} aria-hidden="true" className={styles.searchIcon} />
          <input
            type="search"
            aria-label={t('abilities.search')}
            placeholder={t('abilities.search')}
            value={query.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>
      </div>
      <p className={styles.count} aria-live="polite">
        {t('abilities.count', { count: rows.length })}
      </p>

      {rows.length === 0 ? (
        <p className={styles.empty}>{t('abilities.noMatches')}</p>
      ) : (
        <ul className={styles.entryList}>
          {rows.map(({ ability, name, description, count }) => (
            <li key={ability.id}>
              <Link to={`/abilities/${ability.id}`} className={styles.entry}>
                <span className={styles.entryTop}>
                  <span className={styles.entryName}>{name}</span>
                  <span className={styles.entryCount}>{t('abilities.pokemonCount', { count })}</span>
                </span>
                {description && <span className={styles.entryDescription}>{description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
