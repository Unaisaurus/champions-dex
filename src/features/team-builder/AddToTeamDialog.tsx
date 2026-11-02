import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Form } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import type { Team } from '@/domain/team';
import { isTeamFull, newMember, nextTeamName } from '@/domain/teamEditing';
import { closeAddToTeam, useAddToTeam } from '@/state/addToTeam';
import { useTeamActions, useTeams } from '@/state/userData';
import { Button } from '@/ui/components/Button';
import { Modal } from '@/ui/components/Dialogs';
import { showToast } from '@/ui/toasts';
import { TeamSlots } from './TeamSlots';
import styles from './AddToTeamDialog.module.css';

/** "Add to team": pick one of your teams (or start a new one) for the Pokémon. Rendered once by the app shell. */
export function AddToTeamDialog() {
  const { t } = useTranslation();
  const { form, name } = useAddToTeam();
  return (
    <Modal open={form !== null} title={t('teamEditor.addTo.title', { name })} onClose={closeAddToTeam}>
      {/* Only while open, so your teams are only read when needed. */}
      {form !== null && <TeamChoices form={form} name={name} />}
    </Modal>
  );
}

function TeamChoices({ form, name }: { form: Form; name: string }) {
  const { t } = useTranslation();
  const data = useGameData();
  const teams = useTeams();
  const actions = useTeamActions();

  const add = async (team: Team | null) => {
    const member = newMember(form, data);
    closeAddToTeam();
    if (!member) return;
    let target = team;
    if (target) {
      const result = await actions.addMember(target.id, member);
      if (result !== 'added') {
        showToast(t(result === 'full' ? 'teamEditor.addTo.teamFull' : 'teamEditor.notFound'));
        return;
      }
    } else {
      const newName = nextTeamName(
        (teams ?? []).map((existing) => existing.name),
        (n) => t('teams.defaultName', { n }),
      );
      target = await actions.create(newName, member);
    }
    showToast(t('teamEditor.addTo.added', { name, team: target.name }), {
      label: t('teamEditor.addTo.openTeam'),
      to: `/teams/${target.id}?member=${member.id}`,
    });
  };

  return (
    <div className={styles.body}>
      {teams && teams.length > 0 ? (
        <ul className={styles.teams}>
          {teams.map((team) => {
            const full = isTeamFull(team, data.rules);
            return (
              <li key={team.id}>
                <button type="button" className={styles.team} disabled={full} onClick={() => void add(team)}>
                  <span className={styles.teamName}>{team.name}</span>
                  {full && <span className={styles.full}>{t('teamEditor.addTo.full')}</span>}
                  <TeamSlots team={team} size="sm" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.none}>{t('teamEditor.addTo.noTeams')}</p>
      )}
      <div className={styles.actions}>
        <Button onClick={closeAddToTeam}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={() => void add(null)}>
          <Plus size={18} aria-hidden="true" />
          {t('teamEditor.addTo.newTeam')}
        </Button>
      </div>
    </div>
  );
}
