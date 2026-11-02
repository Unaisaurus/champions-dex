import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isLanguageCode } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { useSettings } from '@/state/settings';
import { useBackupMeta, useSnapshot } from '@/state/userData';
import {
  BackupError,
  backupFileName,
  createBackup,
  readBackup,
  restoreBackup,
  type BackupFile,
  type RestoreMode,
} from '@/storage/backup';
import { db } from '@/storage/db';
import { Button } from '@/ui/components/Button';
import { ChoiceDialog } from '@/ui/components/Dialogs';
import styles from './SettingsPage.module.css';

function downloadJson(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BackupSection() {
  const { t } = useTranslation();
  const meta = useBackupMeta();
  const snapshot = useSnapshot();
  const [, setLanguage] = useLanguage();
  const applySettings = useSettings((state) => state.applyFromBackup);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const download = async () => {
    downloadJson(backupFileName(), await createBackup(db, meta()));
  };

  const openFile = async (file: File) => {
    setStatus(null);
    try {
      setPending(readBackup(JSON.parse(await file.text())));
    } catch (error) {
      const kind = error instanceof BackupError ? error.kind : 'notABackup';
      setStatus({ ok: false, message: t(`settings.backup.${kind}`) });
    }
  };

  const restore = async (backup: BackupFile, mode: RestoreMode) => {
    const summary = await restoreBackup(db, backup, mode, snapshot);
    if (mode === 'replace') {
      applySettings(backup.settings);
      if (isLanguageCode(backup.settings.language)) setLanguage(backup.settings.language);
    }
    setStatus({
      ok: true,
      message: t('settings.backup.restored', { added: summary.teamsAdded, updated: summary.teamsUpdated }),
    });
  };

  return (
    <section className={styles.section} aria-labelledby="settings-backup">
      <h2 id="settings-backup">{t('settings.backup.title')}</h2>
      <p className={styles.description}>{t('settings.backup.description')}</p>
      <div className={styles.row}>
        <Button variant="primary" onClick={() => void download()}>
          <Download size={18} aria-hidden="true" />
          {t('settings.backup.download')}
        </Button>
        <Button onClick={() => fileInput.current?.click()}>
          <Upload size={18} aria-hidden="true" />
          {t('settings.backup.restore')}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void openFile(file);
          }}
        />
      </div>
      <p className={status?.ok === false ? styles.statusError : styles.status} role="status">
        {status?.message}
      </p>
      <ChoiceDialog
        open={pending !== null}
        title={t('settings.backup.restore')}
        message={t('settings.backup.restoreQuestion', {
          teams: pending?.teams.length ?? 0,
          favourites: pending?.favourites.length ?? 0,
        })}
        choices={[
          {
            label: t('settings.backup.restoreMerge'),
            onChoose: () => pending && void restore(pending, 'merge'),
          },
          {
            label: t('settings.backup.restoreReplace'),
            variant: 'danger',
            onChoose: () => pending && void restore(pending, 'replace'),
          },
        ]}
        onClose={() => setPending(null)}
      />
    </section>
  );
}
