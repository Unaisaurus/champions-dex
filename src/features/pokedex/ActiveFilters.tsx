import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { countActiveFilters, type PokedexQuery } from '@/domain/pokedex';
import { useGameText } from '@/i18n/useGameText';
import styles from './PokedexPage.module.css';

interface Removable {
  key: string;
  label: string;
  remove(): Partial<PokedexQuery>;
}

/** The filters that are on, each with a button to remove it. */
export function ActiveFilters({
  query,
  onChange,
  onClear,
}: {
  query: PokedexQuery;
  onChange(change: Partial<PokedexQuery>): void;
  onClear(): void;
}) {
  const { t } = useTranslation();
  const text = useGameText();
  if (countActiveFilters(query) === 0) return null;

  const items: Removable[] = [
    ...query.generations.map((n) => ({
      key: `gen-${n}`,
      label: t('terms.generationShort', { n }),
      remove: () => ({ generations: query.generations.filter((g) => g !== n) }),
    })),
    ...query.types.map((type) => ({
      key: `type-${type}`,
      label: text.name('type-names', type),
      remove: () => ({ types: query.types.filter((t2) => t2 !== type) }),
    })),
    ...query.colors.map((colour) => ({
      key: `colour-${colour}`,
      label: t(`colors.${colour}`),
      remove: () => ({ colors: query.colors.filter((c) => c !== colour) }),
    })),
    ...query.categories.map((category) => ({
      key: `cat-${category}`,
      label: t(`categories.${category}`),
      remove: () => ({ categories: query.categories.filter((c) => c !== category) }),
    })),
  ];
  if (query.favouritesOnly) {
    items.push({
      key: 'fav',
      label: t('pokedex.filters.favouritesOnly'),
      remove: () => ({ favouritesOnly: false }),
    });
  }
  if (query.move) {
    items.push({
      key: 'move',
      label: t('pokedex.filters.moveValue', { name: text.name('move-names', query.move) }),
      remove: () => ({ move: null }),
    });
  }
  if (query.ability) {
    items.push({
      key: 'ability',
      label: t('pokedex.filters.abilityValue', { name: text.name('ability-names', query.ability) }),
      remove: () => ({ ability: null }),
    });
  }

  return (
    <ul className={styles.active} aria-label={t('pokedex.filters.activeLabel')}>
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className={styles.activeChip}
            aria-label={t('pokedex.filters.remove', { name: item.label })}
            onClick={() => onChange(item.remove())}
          >
            {item.label}
            <X size={14} aria-hidden="true" />
          </button>
        </li>
      ))}
      <li>
        <button type="button" className={styles.clearLink} onClick={onClear}>
          {t('pokedex.filters.clearAll')}
        </button>
      </li>
    </ul>
  );
}
