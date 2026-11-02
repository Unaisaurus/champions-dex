import { CircleAlert, Plus, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import type { Team } from '@/domain/team';
import { memberLook } from '@/domain/teamEditing';
import { worstSeverity, type ValidationIssue } from '@/domain/validation';
import { useGameText } from '@/i18n/useGameText';
import { ArtImage } from '@/ui/components/ArtImage';
import { useFormLabels } from '@/ui/useFormLabels';
import styles from './TeamEditor.module.css';

/** The team's slots: pick a member to edit it, or the first free slot to add one. */
export function TeamMembersBar({
  team,
  selectedId,
  issuesByMember,
  onSelect,
  onAdd,
}: {
  team: Team;
  selectedId: string | null;
  issuesByMember: ReadonlyMap<string, readonly ValidationIssue[]>;
  onSelect(memberId: string): void;
  onAdd(): void;
}) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const free = Math.max(0, data.rules.teamSize - team.members.length);

  return (
    <nav className={styles.bar} aria-label={t('teamEditor.slotsLabel')}>
      <ol className={styles.slots}>
        {team.members.map((member) => {
          const look = memberLook(member, data);
          const form = data.formsById.get(member.formId);
          const speciesName = form ? text.name('pokemon-names', form.speciesId) : member.formId;
          const nickname = member.nickname.trim();
          // Under the name: the species (for nicknames) and the form ("Wash Rotom").
          const details = [nickname ? speciesName : null, labels.get(member.formId) ?? null]
            .filter(Boolean)
            .join(' · ');
          const item = member.itemId !== null ? data.itemsById.get(member.itemId) : undefined;
          // Info notes (empty move slots…) don't need a mark.
          const severity = worstSeverity(
            (issuesByMember.get(member.id) ?? []).filter((issue) => issue.severity !== 'info'),
          );
          return (
            <li key={member.id}>
              <button
                type="button"
                className={styles.slot}
                aria-current={member.id === selectedId ? 'true' : undefined}
                onClick={() => onSelect(member.id)}
              >
                <span className={styles.slotIcon}>
                  <ArtImage
                    keys={
                      member.shiny
                        ? [look?.art.iconShiny, look?.art.icon]
                        : [look?.art.icon, look?.art.official]
                    }
                    alt=""
                    width={64}
                    height={64}
                  />
                  {item && (
                    <span className={styles.slotItem}>
                      <ArtImage keys={[item.icon]} alt="" width={24} height={24} />
                    </span>
                  )}
                </span>
                <span className={styles.slotName}>{nickname || speciesName}</span>
                {details && <span className={styles.slotSpecies}>{details}</span>}
                {severity === 'error' && (
                  <span className={`${styles.slotMark} ${styles.markError}`}>
                    <CircleAlert size={16} aria-hidden="true" />
                    <span className="visually-hidden">{t('teamEditor.hasErrors')}</span>
                  </span>
                )}
                {severity === 'warning' && (
                  <span className={`${styles.slotMark} ${styles.markWarning}`}>
                    <TriangleAlert size={16} aria-hidden="true" />
                    <span className="visually-hidden">{t('teamEditor.hasWarnings')}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {Array.from({ length: free }, (_, index) => (
          <li key={`free-${index}`}>
            {index === 0 ? (
              <button type="button" className={`${styles.slot} ${styles.freeSlot}`} onClick={onAdd}>
                <span className={styles.addIcon}>
                  <Plus size={24} aria-hidden="true" />
                </span>
                <span className={styles.slotName}>{t('teamEditor.addPokemon')}</span>
              </button>
            ) : (
              <span className={`${styles.slot} ${styles.freeSlot} ${styles.emptySlot}`} aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
