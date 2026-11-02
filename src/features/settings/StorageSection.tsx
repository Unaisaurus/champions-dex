import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localeOf } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { getStorageStatus, requestPersistentStorage, type StorageStatus } from '@/storage/persistence';
import { Button } from '@/ui/components/Button';
import styles from './SettingsPage.module.css';

export function StorageSection() {
  const { t } = useTranslation();
  const [language] = useLanguage();
  const [status, setStatus] = useState<StorageStatus | null>(null);

  useEffect(() => {
    void getStorageStatus().then(setStatus);
  }, []);

  const request = async () => {
    await requestPersistentStorage();
    setStatus(await getStorageStatus());
  };

  const formatSize = (bytes: number) =>
    new Intl.NumberFormat(localeOf(language), {
      style: 'unit',
      unit: 'megabyte',
      maximumFractionDigits: 1,
    }).format(bytes / 1_000_000);

  const message =
    status?.persisted === true
      ? t('settings.storage.persisted')
      : status?.persisted === false
        ? t('settings.storage.notPersisted')
        : t('settings.storage.unknown');

  return (
    <section className={styles.section} aria-labelledby="settings-storage">
      <h2 id="settings-storage">{t('settings.storage.title')}</h2>
      <p>{message}</p>
      {status?.persisted === false && (
        <div className={styles.row}>
          <Button onClick={() => void request()}>{t('settings.storage.request')}</Button>
        </div>
      )}
      {status?.usageBytes != null && (
        <p className={styles.muted}>{t('settings.storage.usage', { used: formatSize(status.usageBytes) })}</p>
      )}
      <p className={styles.muted}>{t('settings.storage.addressNote')}</p>
    </section>
  );
}
