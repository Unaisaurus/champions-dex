import type { Id } from '@/data/contracts';
import { useGameText } from '@/i18n/useGameText';
import { InfoTip } from './InfoTip';

/**
 * An Ability's name with what it does in a bubble (hover, tap or focus it).
 * Name and description come from the game text in the current language: your
 * Basque files replace the English ones as soon as they have the text.
 */
export function AbilityName({ id, className }: { id: Id; className?: string }) {
  const text = useGameText();
  const name = text.name('ability-names', id);
  const description = text.get('ability-descriptions', id)?.text;
  if (!description) return <span className={className}>{name}</span>;
  return (
    <InfoTip label={name} title={name} className={className}>
      {description}
    </InfoTip>
  );
}
