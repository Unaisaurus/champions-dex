import type { Id } from '@/data/contracts';
import { useGameText } from '@/i18n/useGameText';
import styles from './TypeBadge.module.css';

const KNOWN_TYPES = new Set([
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
]);

/** A type label in the type's colour. Unknown future types get a neutral colour. */
export function TypeBadge({ type, size = 'md' }: { type: Id; size?: 'sm' | 'md' }) {
  const text = useGameText();
  const colour = KNOWN_TYPES.has(type) ? type : 'unknown';
  return (
    <span
      className={`${styles.badge} ${size === 'sm' ? styles.small : ''}`}
      style={{ background: `var(--type-${colour})`, color: `var(--type-${colour}-ink)` }}
    >
      {text.name('type-names', type)}
    </span>
  );
}

export function TypeList({ types, size }: { types: readonly Id[]; size?: 'sm' | 'md' }) {
  return (
    <span className={styles.list}>
      {types.map((type) => (
        <TypeBadge key={type} type={type} size={size} />
      ))}
    </span>
  );
}
