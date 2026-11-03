import { useTranslation } from 'react-i18next';
import type { Move } from '@/data/contracts';
import { TypeBadge } from '@/ui/components/TypeBadge';
import styles from './TeamEditor.module.css';

/** Type and power in the move list. */
export function MoveOptionDetail({ move, isNew }: { move: Move; isNew: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={styles.optionDetail}>
      {isNew && <span className={styles.optionTag}>{t('pokemon.moves.new')}</span>}
      <span className={styles.optionPower}>{move.power ?? '—'}</span>
      <TypeBadge type={move.type} size="sm" />
    </span>
  );
}
