import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import type { TeamMember } from '@/domain/team';
import { memberLook } from '@/domain/teamEditing';
import { useGameText } from '@/i18n/useGameText';
import { useTeams } from '@/state/userData';
import { ArtImage } from '@/ui/components/ArtImage';
import { Button } from '@/ui/components/Button';
import { Modal } from '@/ui/components/Dialogs';
import { useFormLabels } from '@/ui/useFormLabels';
import styles from './Calculator.module.css';

/** Pick one of your team members to use in the calculator. */
export function TeamMemberDialog({
  open,
  title,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  onSelect(member: TeamMember): void;
  onClose(): void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="wide">
      {/* Only while open, so your teams are only read when needed. */}
      {open && <Teams onSelect={onSelect} onClose={onClose} />}
    </Modal>
  );
}

function Teams({ onSelect, onClose }: { onSelect(member: TeamMember): void; onClose(): void }) {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const teams = useTeams();
  const withMembers = (teams ?? []).filter((team) => team.members.length > 0);

  return (
    <div className={styles.dialogBody}>
      {teams === undefined ? (
        <p className={styles.muted}>{t('common.loading')}</p>
      ) : withMembers.length === 0 ? (
        <p className={styles.muted}>{t('calc.pokemon.noTeams')}</p>
      ) : (
        <ul className={styles.teamList}>
          {withMembers.map((team) => (
            <li key={team.id}>
              <h3 className={styles.teamName}>{team.name}</h3>
              <ul className={styles.memberList}>
                {team.members.map((member) => {
                  const look = memberLook(member, data);
                  const form = data.formsById.get(member.formId);
                  const species = form ? text.name('pokemon-names', form.speciesId) : member.formId;
                  const label = form ? (labels.get(form.id) ?? null) : null;
                  const item = member.itemId !== null ? data.itemsById.get(member.itemId) : undefined;
                  return (
                    <li key={member.id}>
                      <button
                        type="button"
                        className={styles.memberButton}
                        disabled={!form}
                        onClick={() => onSelect(member)}
                      >
                        <span className={styles.memberIcon}>
                          <ArtImage
                            keys={member.shiny ? [look?.art.iconShiny, look?.art.icon] : [look?.art.icon]}
                            alt=""
                            width={48}
                            height={48}
                          />
                          {item && (
                            <span className={styles.memberItem}>
                              <ArtImage keys={[item.icon]} alt="" width={22} height={22} />
                            </span>
                          )}
                        </span>
                        <span className={styles.memberText}>
                          <span className={styles.memberName}>{member.nickname.trim() || species}</span>
                          {(member.nickname.trim() || label) && (
                            <span className={styles.memberDetail}>
                              {[member.nickname.trim() ? species : null, label].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.dialogActions}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </div>
    </div>
  );
}
