import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import styles from './Calculator.module.css';

/** The calculator's title and its two views: damage and Speed tiers. */
export function CalcHeader({ intro }: { intro: string }) {
  const { t } = useTranslation();
  return (
    <header className={styles.header}>
      <div className={styles.headingRow}>
        <h1>{t('calc.title')}</h1>
        <nav className={styles.tabs} aria-label={t('calc.tabs.label')}>
          <NavLink to="/calc" end className={styles.tab}>
            {t('calc.tabs.damage')}
          </NavLink>
          <NavLink to="/calc/speed" className={styles.tab}>
            {t('calc.tabs.speed')}
          </NavLink>
        </nav>
      </div>
      <p className={styles.intro}>{intro}</p>
    </header>
  );
}

/** Where the numbers come from, with the calculator's licence. */
export function CalcCredit() {
  const { t } = useTranslation();
  const base = import.meta.env.BASE_URL;
  return (
    <p className={styles.credit}>
      {t('calc.credit.prefix')}{' '}
      <a href="https://github.com/smogon/damage-calc" target="_blank" rel="noreferrer">
        {t('calc.credit.name')}
      </a>{' '}
      (
      <a href={`${base}licenses/smogon-damage-calc.txt`} target="_blank" rel="noreferrer">
        {t('calc.credit.licence')}
      </a>
      ).
    </p>
  );
}
