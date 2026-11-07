import { NavLink } from 'react-router';
import styles from './SectionTabs.module.css';

export interface SectionTab {
  to: string;
  label: string;
  /** Only the exact address counts as this tab (for a section's first page, such as `/`). */
  end?: boolean;
}

/** Links between the pages of one section, shown as tabs (the current one stands out). */
export function SectionTabs({ label, tabs }: { label: string; tabs: readonly SectionTab[] }) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={styles.tab}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
