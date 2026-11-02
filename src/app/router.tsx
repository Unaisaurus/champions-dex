import { createHashRouter } from 'react-router';
import { PokedexPage } from '@/features/pokedex/PokedexPage';
import { PokemonPage } from '@/features/pokemon-page/PokemonPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TeamsPage } from '@/features/team-builder/TeamsPage';
import { TranslationsPage } from '@/features/translations/TranslationsPage';
import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';

/**
 * Pages of the app. Hash URLs (…/#/teams) work from any folder or static host
 * without server configuration.
 */
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <PokedexPage /> },
      { path: 'pokemon/:formId', element: <PokemonPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'translations', element: <TranslationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
