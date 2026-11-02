import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <h1>{t('notFound.title')}</h1>
      <Link to="/" className={styles.link}>
        {t('notFound.action')}
      </Link>
    </div>
  );
}
