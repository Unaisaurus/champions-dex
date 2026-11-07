import { Calculator, LayoutGrid, Settings, Users } from 'lucide-react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, type Location } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AddToTeamDialog } from '@/features/team-builder/AddToTeamDialog';
import { LanguageSwitcher } from '@/ui/components/LanguageSwitcher';
import { Toasts } from '@/ui/components/Toasts';
import { UpdatePrompt } from './UpdatePrompt';
import styles from './AppShell.module.css';

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.pokedex', Icon: LayoutGrid, end: true },
  { to: '/teams', labelKey: 'nav.teams', Icon: Users, end: false },
  { to: '/calc', labelKey: 'nav.calculator', Icon: Calculator, end: false },
  { to: '/settings', labelKey: 'nav.settings', Icon: Settings, end: false },
] as const;

/** The Pokédex's pages: its lists (Pokémon, moves, Abilities, items) and what they open. */
const POKEDEX_PAGES = /^\/(?:$|pokemon\/|moves(?:\/|$)|abilities(?:\/|$)|items(?:\/|$))/;

/**
 * Where each page's scroll position is remembered: the Pokédex list by its
 * address (so coming back to the same list lands where you left it), every
 * other page by its place in the history (new pages open at the top; Back
 * returns to where you were).
 */
const scrollKey = (location: Location) =>
  location.pathname === '/' ? `${location.pathname}${location.search}` : location.key;

/** Header, navigation (top bar on wide screens, tab bar on phones) and the page area. */
export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const inPokedex = POKEDEX_PAGES.test(pathname);
  const navLinks = (className: string) =>
    NAV_ITEMS.map(({ to, labelKey, Icon, end }) => {
      const content = (
        <>
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
          <span>{t(labelKey)}</span>
        </>
      );
      // The Pokédex item stays lit on the Pokédex's other pages too.
      return to === '/' ? (
        <Link key={to} to={to} className={className} aria-current={inPokedex ? 'page' : undefined}>
          {content}
        </Link>
      ) : (
        <NavLink key={to} to={to} end={end} className={className}>
          {content}
        </NavLink>
      );
    });

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
      <AddToTeamDialog />
      <Toasts>
        <UpdatePrompt />
      </Toasts>
      <ScrollRestoration getKey={scrollKey} />
    </div>
  );
}
