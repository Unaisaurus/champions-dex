import { FileUp, Upload } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useGameData } from '@/data/useGameData';
import type { ImportProblem } from '@/domain/showdown';
import { useTeamActions } from '@/state/userData';
import { Button } from '@/ui/components/Button';
import { Modal } from '@/ui/components/Dialogs';
import { showToast } from '@/ui/toasts';
import { readImport } from './readImport';
import { useShowdown } from './useShowdown';
import styles from './ImportExport.module.css';

/** Bring in teams: paste Showdown text or a team file's contents, or pick the file. */
export function ImportDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t('teamEditor.import.title')} onClose={onClose}>
      {open && <ImportBody onClose={onClose} />}
    </Modal>
  );
}

function ImportBody({ onClose }: { onClose(): void }) {
  const { t } = useTranslation();
  const data = useGameData();
  const navigate = useNavigate();
  const actions = useTeamActions();
  const { lookup } = useShowdown();
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const textId = useId();

  const preview = useMemo(
    () =>
      readImport(text, {
        data,
        lookup,
        aliases: data.aliases,
        defaultName: t('teamEditor.import.defaultName'),
      }),
    [text, data, lookup, t],
  );

  const save = async () => {
    const { teams } = preview;
    if (teams.length === 0) return;
    await actions.importTeams(teams);
    onClose();
    showToast(t('teamEditor.import.done', { count: teams.length }));
    if (teams.length === 1 && teams[0]) navigate(`/teams/${teams[0].id}`);
  };

  return (
    <div className={styles.body}>
      <p className={styles.hint}>{t('teamEditor.import.hint')}</p>
      <label htmlFor={textId} className="visually-hidden">
        {t('teamEditor.import.paste')}
      </label>
      <textarea
        id={textId}
        className={styles.text}
        value={text}
        rows={10}
        spellCheck={false}
        placeholder={t('teamEditor.import.paste')}
        onChange={(event) => setText(event.target.value)}
      />
      <div className={styles.fileRow}>
        <Button onClick={() => fileRef.current?.click()}>
          <FileUp size={17} aria-hidden="true" />
          {t('teamEditor.import.chooseFile')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void file.text().then(setText);
            event.target.value = '';
          }}
        />
      </div>

      <div className={styles.preview} aria-live="polite">
        {preview.error && preview.error !== 'empty' && (
          <p className={styles.error}>{t(`teamEditor.import.errors.${preview.error}`)}</p>
        )}
        {preview.teams.length > 0 && (
          <>
            <p className={styles.ready}>{t('teamEditor.import.ready', { count: preview.teams.length })}</p>
            <ul className={styles.found}>
              {preview.teams.map((team) => (
                <li key={team.id}>
                  <strong>{team.name}</strong> · {t('teams.members', { count: team.members.length })}
                </li>
              ))}
            </ul>
          </>
        )}
        {preview.problems.length > 0 && (
          <ul className={styles.problems}>
            {preview.problems.map((problem, index) => (
              <li key={`${problem.line}-${index}`}>
                <ProblemText problem={problem} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.actions}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={preview.teams.length === 0} onClick={() => void save()}>
          <Upload size={17} aria-hidden="true" />
          {t('teamEditor.import.import')}
        </Button>
      </div>
    </div>
  );
}

function ProblemText({ problem }: { problem: ImportProblem }) {
  const { t } = useTranslation();
  return (
    <>
      <span className={styles.line}>{t('teamEditor.import.line', { n: problem.line })}</span>{' '}
      {t(`teamEditor.import.problems.${problem.code}`, { value: problem.value ?? '' })}
    </>
  );
}
