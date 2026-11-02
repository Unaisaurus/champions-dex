import { CircleAlert, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { validationContextFrom } from '@/data/gameData';
import { useGameData } from '@/data/useGameData';
import type { Team } from '@/domain/team';
import { nextTeamName } from '@/domain/teamEditing';
import { validateTeam } from '@/domain/validation';
import { localeOf } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { activeMechanics } from '@/mechanics/registry';
import { useTeamActions, useTeams } from '@/state/userData';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog, PromptDialog } from '@/ui/components/Dialogs';
import { TeamSlots } from './TeamSlots';
import styles from './TeamsPage.module.css';

type DialogState = { kind: 'rename'; team: Team } | { kind: 'delete'; team: Team } | null;

/** All your teams: open one to edit it, or create, rename and delete them. */
export function TeamsPage() {
  const { t } = useTranslation();
  const [language] = useLanguage();
  const navigate = useNavigate();
  const teams = useTeams();
  const actions = useTeamActions();
  const [dialog, setDialog] = useState<DialogState>(null);
  const dateFormat = new Intl.DateTimeFormat(localeOf(language), { dateStyle: 'medium', timeStyle: 'short' });

  const createTeam = async () => {
    const name = nextTeamName(
      (teams ?? []).map((team) => team.name),
      (n) => t('teams.defaultName', { n }),
    );
    const team = await actions.create(name);
    navigate(`/teams/${team.id}`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h1>{t('teams.title')}</h1>
          <Button variant="primary" onClick={() => void createTeam()}>
            <Plus size={18} aria-hidden="true" />
            {t('teams.create')}
          </Button>
        </div>
        <p className={styles.intro}>{t('teams.intro')}</p>
      </header>

      {teams && teams.length === 0 && <p className={styles.empty}>{t('teams.empty')}</p>}

      {teams && teams.length > 0 && (
        <ul className={styles.list}>
          {teams.map((team) => (
            <li key={team.id} className={styles.team}>
              <Link to={`/teams/${team.id}`} className={styles.teamLink}>
                <h2 className={styles.teamName}>{team.name}</h2>
                <TeamSlots team={team} />
                <p className={styles.meta}>
                  {t('teams.members', { count: team.members.length })}
                  <span aria-hidden="true"> · </span>
                  <time dateTime={team.updatedAt}>{dateFormat.format(new Date(team.updatedAt))}</time>
                  <TeamStatus team={team} />
                </p>
              </Link>
              <div className={styles.actions}>
                <Button variant="quiet" onClick={() => setDialog({ kind: 'rename', team })}>
                  <Pencil size={17} aria-hidden="true" />
                  {t('common.rename')}
                </Button>
                <Button variant="quiet" onClick={() => setDialog({ kind: 'delete', team })}>
                  <Trash2 size={17} aria-hidden="true" />
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PromptDialog
        open={dialog?.kind === 'rename'}
        title={t('teams.renameTitle')}
        label={t('teams.nameLabel')}
        initialValue={dialog?.team.name ?? ''}
        confirmLabel={t('common.save')}
        onConfirm={(name) => dialog && void actions.rename(dialog.team.id, name)}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        title={t('common.delete')}
        message={t('teams.deleteConfirm', { name: dialog?.team.name ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={() => dialog && void actions.remove(dialog.team.id)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

/** How many problems the team checks found (errors first), if any. */
function TeamStatus({ team }: { team: Team }) {
  const { t } = useTranslation();
  const data = useGameData();
  const issues = useMemo(
    () => validateTeam(team, validationContextFrom(data), activeMechanics(data.rules)),
    [team, data],
  );
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  if (errors > 0) {
    return (
      <span className={`${styles.status} ${styles.error}`}>
        <CircleAlert size={15} aria-hidden="true" />
        {t('teams.errors', { count: errors })}
      </span>
    );
  }
  if (warnings > 0) {
    return (
      <span className={`${styles.status} ${styles.warning}`}>
        <TriangleAlert size={15} aria-hidden="true" />
        {t('teams.warnings', { count: warnings })}
      </span>
    );
  }
  return null;
}
