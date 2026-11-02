import { useTranslation } from 'react-i18next';
import { DataLoadError } from './loader';
import styles from './DataScreens.module.css';

export function DataLoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <span className={styles.lens} aria-hidden="true" />
      <p>{t('data.loading')}</p>
    </div>
  );
}

export function DataErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const known = error instanceof DataLoadError ? error : null;
  const message = known
    ? t(`data.error.${known.kind}`, { file: known.file })
    : t('data.error.invalid', { file: 'manifest.json' });
  const details = known ? known.details : [String(error)];
  return (
    <div className={styles.screen} role="alert">
      <h1>{t('data.error.title')}</h1>
      <p className={styles.message}>{message}</p>
      {details.length > 0 && (
        <details className={styles.details}>
          <summary>{t('data.error.details')}</summary>
          <pre>{details.join('\n')}</pre>
        </details>
      )}
      <button type="button" className={styles.retry} onClick={onRetry}>
        {t('common.tryAgain')}
      </button>
    </div>
  );
}
