import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useDataProblems, useGameData } from '@/data/useGameData';
import styles from './SettingsPage.module.css';

export function DataSection() {
  const { t } = useTranslation();
  const { manifest } = useGameData();
  const problems = useDataProblems();

  return (
    <section className={styles.section} aria-labelledby="settings-data">
      <h2 id="settings-data">{t('settings.data.title')}</h2>
      <dl className={styles.facts}>
        <div>
          <dt>{t('settings.data.version')}</dt>
          <dd>{manifest.dataVersion}</dd>
        </div>
        <div>
          <dt>{t('settings.data.gameVersion')}</dt>
          <dd>{manifest.game.version ?? t('common.unknown')}</dd>
        </div>
        <div>
          <dt>{t('settings.data.regulation')}</dt>
          <dd>{manifest.game.regulation ?? t('common.unknown')}</dd>
        </div>
        <div>
          <dt>{t('settings.data.sources')}</dt>
          <dd>
            {manifest.sources.map((source, index) => (
              <span key={source.id}>
                {index > 0 && ', '}
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.name}
                </a>
              </span>
            ))}
          </dd>
        </div>
      </dl>
      <Link to="/changelog" className={styles.link}>
        {t('settings.data.changelog')}
      </Link>
      <Link to="/artwork" className={styles.link}>
        {t('settings.data.artwork')}
      </Link>
      {problems.length === 0 ? (
        <p className={styles.muted}>{t('settings.data.healthy')}</p>
      ) : (
        <>
          <p className={styles.statusError}>{t('settings.data.problems', { count: problems.length })}</p>
          <ul className={styles.problems}>
            {problems.slice(0, 50).map((problem) => (
              <li key={`${problem.file}:${problem.message}`}>
                {problem.file}: {problem.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
