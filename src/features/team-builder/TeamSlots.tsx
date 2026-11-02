import { useGameData } from '@/data/useGameData';
import type { Team } from '@/domain/team';
import { useGameText } from '@/i18n/useGameText';
import { ArtImage } from '@/ui/components/ArtImage';
import styles from './TeamSlots.module.css';

/** The six team slots at a glance: a menu icon per member, empty rings for free slots. */
export function TeamSlots({ team }: { team: Team }) {
  const data = useGameData();
  const text = useGameText();
  const slots = Array.from({ length: data.rules.teamSize }, (_, index) => team.members[index] ?? null);
  return (
    <ol className={styles.slots}>
      {slots.map((member, index) => {
        const form = member ? data.formsById.get(member.formId) : undefined;
        return (
          <li key={member?.id ?? `empty-${index}`} className={styles.slot}>
            {member && (
              <ArtImage
                keys={member.shiny ? [form?.art.iconShiny, form?.art.icon] : [form?.art.icon]}
                alt={member.nickname || (form ? text.formTitle(form).title : member.formId)}
                width={40}
                height={40}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
