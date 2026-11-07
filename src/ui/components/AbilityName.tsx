import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Id } from '@/data/contracts';
import { useGameText } from '@/i18n/useGameText';
import { InfoTip } from './InfoTip';
import styles from './InfoTip.module.css';

/**
 * An Ability's name with what it does in a bubble (hover, tap or focus it),
 * and a link to the Ability's page.
 * Name and description come from the game text in the current language: your
 * Basque files replace the English ones as soon as they have the text.
 */
export function AbilityName({ id, className }: { id: Id; className?: string }) {
  const { t } = useTranslation();
  const text = useGameText();
  const name = text.name('ability-names', id);
  const description = text.get('ability-descriptions', id)?.text;
  if (!description) return <span className={className}>{name}</span>;
  return (
    <InfoTip label={name} title={name} className={className}>
      {description}
      <Link to={`/abilities/${id}`} className={styles.more}>
        {t('abilities.more')}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </InfoTip>
  );
}
