import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Team } from '@/domain/team';
import { localeOf } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { useTeamActions, useTeams } from '@/state/userData';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog, PromptDialog } from '@/ui/components/Dialogs';
import { Notice } from '@/ui/components/Notice';
import { TeamSlots } from './TeamSlots';
import styles from './TeamsPage.module.css';

type DialogState = { kind: 'rename'; team: Team } | { kind: 'delete'; team: Team } | null;

/** Stage 0: create, rename and delete teams. The editor arrives in the team builder stage. */
export function TeamsPage() {
  const { t } = useTranslation();
  const [language] = useLanguage();
  const teams = useTeams();
  const actions = useTeamActions();
  const [dialog, setDialog] = useState<DialogState>(null);
  const dateFormat = new Intl.DateTimeFormat(localeOf(language), { dateStyle: 'medium', timeStyle: 'short' });

  const createTeam = () => void actions.create(t('teams.defaultName', { n: (teams?.length ?? 0) + 1 }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <h1>{t('teams.title')}</h1>
          <Button variant="primary" onClick={createTeam}>
            <Plus size={18} aria-hidden="true" />
            {t('teams.create')}
          </Button>
        </div>
        <p className={styles.intro}>{t('teams.intro')}</p>
        <Notice>{t('teams.editorLater')}</Notice>
      </header>

      {teams && teams.length === 0 && <p className={styles.empty}>{t('teams.empty')}</p>}

      {teams && teams.length > 0 && (
        <ul className={styles.list}>
          {teams.map((team) => (
            <li key={team.id} className={styles.team}>
              <div className={styles.teamText}>
                <h2 className={styles.teamName}>{team.name}</h2>
                <TeamSlots team={team} />
                <p className={styles.meta}>
                  {t('teams.members', { count: team.members.length })}
                  <span aria-hidden="true"> · </span>
                  <time dateTime={team.updatedAt}>{dateFormat.format(new Date(team.updatedAt))}</time>
                </p>
              </div>
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
