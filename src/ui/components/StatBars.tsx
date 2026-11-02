import { useTranslation } from 'react-i18next';
import { STAT_IDS, type Stats } from '@/data/contracts';
import styles from './StatBars.module.css';

/** Highest base stat the bar scale goes up to (Blissey's HP is 255). */
const SCALE_MAX = 255;

function band(value: number): string {
  if (value >= 130) return styles.top ?? '';
  if (value >= 100) return styles.high ?? '';
  if (value >= 70) return styles.mid ?? '';
  return styles.low ?? '';
}

/** Base stats as labelled bars plus the total. */
export function StatBars({ stats }: { stats: Stats }) {
  const { t } = useTranslation();
  const total = STAT_IDS.reduce((sum, stat) => sum + stats[stat], 0);
  return (
    <dl className={styles.table}>
      {STAT_IDS.map((stat) => (
        <div key={stat} className={styles.row}>
          <dt className={styles.label}>{t(`stats.${stat}`)}</dt>
          <dd className={styles.value}>{stats[stat]}</dd>
          <dd className={styles.track} aria-hidden="true">
            <span
              className={`${styles.bar} ${band(stats[stat])}`}
              style={{ width: `${Math.min(100, (stats[stat] / SCALE_MAX) * 100)}%` }}
            />
          </dd>
        </div>
      ))}
      <div className={`${styles.row} ${styles.totalRow}`}>
        <dt className={styles.label}>{t('stats.total')}</dt>
        <dd className={styles.value}>{total}</dd>
      </div>
    </dl>
  );
}
