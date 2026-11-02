import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localeOf } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { useRestoreBackup } from '@/state/userData';
import { db, type SnapshotRecord } from '@/storage/db';
import { listSnapshots } from '@/storage/snapshots';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/Dialogs';
import styles from './SettingsPage.module.css';

export function SnapshotsSection() {
  const { t } = useTranslation();
  const [language] = useLanguage();
  const restoreBackup = useRestoreBackup();
  const snapshots = useLiveQuery(() => listSnapshots(db), [], []);
  const [selected, setSelected] = useState<SnapshotRecord | null>(null);
  const dateFormat = new Intl.DateTimeFormat(localeOf(language), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className={styles.section} aria-labelledby="settings-snapshots">
      <h2 id="settings-snapshots">{t('settings.snapshots.title')}</h2>
      <p className={styles.description}>{t('settings.snapshots.description')}</p>
      {snapshots.length === 0 ? (
        <p className={styles.muted}>{t('settings.snapshots.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {snapshots.map((item) => (
            <li key={item.id} className={styles.listItem}>
              <div>
                <time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time>
                <p className={styles.muted}>
                  {t(`settings.snapshots.reason.${item.reason}`)}:{' '}
                  {t('settings.snapshots.summary', {
                    teams: item.backup.teams.length,
                    favourites: item.backup.favourites.length,
                  })}
                </p>
              </div>
              <Button variant="quiet" onClick={() => setSelected(item)}>
                {t('settings.snapshots.restore')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={selected !== null}
        title={t('settings.snapshots.restore')}
        message={t('settings.snapshots.restoreConfirm')}
        confirmLabel={t('settings.snapshots.restore')}
        danger
        onConfirm={() => selected && void restoreBackup(selected.backup, 'replace')}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
