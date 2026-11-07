import { useTranslation } from 'react-i18next';
import { SectionTabs } from '@/ui/components/SectionTabs';
import styles from './Calculator.module.css';

/** The calculator's title and its two views: damage and Speed tiers. */
export function CalcHeader({ intro }: { intro: string }) {
  const { t } = useTranslation();
  return (
    <header className={styles.header}>
      <div className={styles.headingRow}>
        <h1>{t('calc.title')}</h1>
        <SectionTabs
          label={t('calc.tabs.label')}
          tabs={[
            { to: '/calc', label: t('calc.tabs.damage'), end: true },
            { to: '/calc/speed', label: t('calc.tabs.speed') },
          ]}
        />
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
