import { createHashRouter } from 'react-router';
import { ArtworkPage } from '@/features/artwork/ArtworkPage';
import { ChangelogPage } from '@/features/changelog/ChangelogPage';
import { PokedexPage } from '@/features/pokedex/PokedexPage';
import { PokemonPage } from '@/features/pokemon-page/PokemonPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TeamEditorPage } from '@/features/team-builder/TeamEditorPage';
import { TeamsPage } from '@/features/team-builder/TeamsPage';
import { TranslationEditor } from '@/features/translations/TranslationEditor';
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
      { path: 'teams/:teamId', element: <TeamEditorPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'changelog', element: <ChangelogPage /> },
      { path: 'artwork', element: <ArtworkPage /> },
      { path: 'translations', element: <TranslationsPage /> },
      { path: 'translations/:language', element: <TranslationEditor /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
