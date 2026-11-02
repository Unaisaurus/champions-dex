import { LayoutGrid, Settings, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/ui/components/LanguageSwitcher';
import styles from './AppShell.module.css';

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.pokedex', Icon: LayoutGrid, end: true },
  { to: '/teams', labelKey: 'nav.teams', Icon: Users, end: false },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings, end: false },
] as const;

/** Header, navigation (top bar on wide screens, tab bar on phones) and the page area. */
export function AppShell() {
  const { t } = useTranslation();
  const navLinks = (className: string) =>
    NAV_ITEMS.map(({ to, labelKey, Icon, end }) => (
      <NavLink key={to} to={to} end={end} className={className}>
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
        <span>{t(labelKey)}</span>
      </NavLink>
    ));

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        {t('app.skipToContent')}
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <NavLink to="/" className={styles.brand} aria-label={t('app.name')}>
            <span className={styles.lens} aria-hidden="true" />
            <span className={styles.wordmark} aria-hidden="true">
              {t('app.name')}
            </span>
          </NavLink>
          <nav className={styles.topNav} aria-label={t('nav.label')}>
            {navLinks(styles.topLink ?? '')}
          </nav>
          <LanguageSwitcher />
        </div>
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <nav className={styles.tabBar} aria-label={t('nav.label')}>
        {navLinks(styles.tabLink ?? '')}
      </nav>
    </div>
  );
}
