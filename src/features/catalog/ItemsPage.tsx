import { Search } from 'lucide-react';
import { useDeferredValue, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import { matchesSearch } from '@/domain/search';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { ArtImage } from '@/ui/components/ArtImage';
import { ToggleChip } from '@/ui/components/ToggleChip';
import { useTextSearchIndex } from '@/ui/useTextSearchIndex';
import { DexSections } from './DexSections';
import { useAddressQuery } from './useAddressQuery';
import styles from './Catalog.module.css';

/** The item groups the list can show, in this order. */
const ITEM_GROUPS = ['held', 'berry', 'mega-stone'] as const;
type ItemGroup = (typeof ITEM_GROUPS)[number];

interface ItemListQuery {
  search: string;
  group: ItemGroup | null;
}
const readQuery = (params: URLSearchParams): ItemListQuery => ({
  search: params.get('q') ?? '',
  group: ITEM_GROUPS.find((group) => group === params.get('group')) ?? null,
});
const writeQuery = ({ search, group }: ItemListQuery) => {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (group) params.set('group', group);
  return params;
};

/** Every item usable in Champions: held items, Berries and Mega Stones. */
export function ItemsPage() {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const searchIndex = useTextSearchIndex('item-names', data.items);
  const [query, update] = useAddressQuery(readQuery, writeQuery);
  const search = useDeferredValue(query.search).trim();

  const rows = useMemo(() => {
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    return data.items
      .filter((item) => item.availableInChampions)
      .filter((item) => !query.group || item.category === query.group)
      .filter((item) => !search || matchesSearch(searchIndex.get(item.id) ?? '', search))
      .map((item) => ({ item, name: text.name('item-names', item.id) }))
      .sort(
        (a, b) =>
          ITEM_GROUPS.indexOf(a.item.category as ItemGroup) -
            ITEM_GROUPS.indexOf(b.item.category as ItemGroup) || collator.compare(a.name, b.name),
      );
  }, [data, text, searchIndex, search, query.group]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h1>{t('items.title')}</h1>
          <DexSections />
        </div>
        <p className={styles.intro}>{t('items.intro')}</p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search size={18} aria-hidden="true" className={styles.searchIcon} />
          <input
            type="search"
            aria-label={t('items.search')}
            placeholder={t('items.search')}
            value={query.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>
        <div className={styles.chips} role="group" aria-label={t('items.groupLabel')}>
          {ITEM_GROUPS.map((group) => (
            <ToggleChip
              key={group}
              pressed={query.group === group}
              onToggle={() => update({ group: query.group === group ? null : group })}
            >
              {t(`items.groups.${group}`)}
            </ToggleChip>
          ))}
        </div>
      </div>
      <p className={styles.count} aria-live="polite">
        {t('items.count', { count: rows.length })}
      </p>

      {rows.length === 0 ? (
        <p className={styles.empty}>{t('items.noMatches')}</p>
      ) : (
        <ul className={styles.itemGrid}>
          {rows.map(({ item, name }) => (
            <li key={item.id}>
              <Link to={`/items/${item.id}`} className={styles.itemCard}>
                <ArtImage keys={[item.icon]} alt="" width={40} height={40} />
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{name}</span>
                  <span className={styles.itemGroup}>
                    {t(`items.kinds.${item.category}`, { defaultValue: item.category })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
