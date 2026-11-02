import { useGameData } from '@/data/useGameData';
import type { Team } from '@/domain/team';
import { memberLook } from '@/domain/teamEditing';
import { useGameText } from '@/i18n/useGameText';
import { ArtImage } from '@/ui/components/ArtImage';
import styles from './TeamSlots.module.css';

/** The six team slots at a glance: a menu icon per member, empty rings for free slots. */
export function TeamSlots({ team, size = 'md' }: { team: Team; size?: 'sm' | 'md' }) {
  const data = useGameData();
  const text = useGameText();
  const slots = Array.from({ length: data.rules.teamSize }, (_, index) => team.members[index] ?? null);
  const pixels = size === 'sm' ? 32 : 40;
  return (
    <ol className={`${styles.slots} ${size === 'sm' ? styles.small : ''}`}>
      {slots.map((member, index) => {
        const look = member ? memberLook(member, data) : undefined;
        return (
          <li key={member?.id ?? `empty-${index}`} className={styles.slot}>
            {member && (
              <ArtImage
                keys={member.shiny ? [look?.art.iconShiny, look?.art.icon] : [look?.art.icon]}
                alt={member.nickname || (look ? text.formTitle(look).title : member.formId)}
                width={pixels}
                height={pixels}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
