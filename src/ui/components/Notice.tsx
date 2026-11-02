import type { ReactNode } from 'react';
import styles from './Notice.module.css';

/** A quiet information strip, e.g. for the sample-data notice. */
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <p className={`${styles.notice} ${tone === 'warning' ? styles.warning : ''}`} role="note">
      {children}
    </p>
  );
}
