import { createHashRouter } from 'react-router';
import { ArtworkPage } from '@/features/artwork/ArtworkPage';
import { AbilitiesPage } from '@/features/catalog/AbilitiesPage';
import { AbilityPage } from '@/features/catalog/AbilityPage';
import { ItemPage } from '@/features/catalog/ItemPage';
import { ItemsPage } from '@/features/catalog/ItemsPage';
import { MovePage } from '@/features/catalog/MovePage';
import { MovesPage } from '@/features/catalog/MovesPage';
import { ChangelogPage } from '@/features/changelog/ChangelogPage';
import { PokedexPage } from '@/features/pokedex/PokedexPage';
import { PokemonPage } from '@/features/pokemon-page/PokemonPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TeamEditorPage } from '@/features/team-builder/TeamEditorPage';
import { TeamsPage } from '@/features/team-builder/TeamsPage';
import { TranslationEditor } from '@/features/translations/TranslationEditor';
import { TranslationsPage } from '@/features/translations/TranslationsPage';
import { AppShell } from './AppShell';
import { CalculatorRoute, SpeedTiersRoute } from './LazyPages';
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
      { path: 'moves', element: <MovesPage /> },
      { path: 'moves/:moveId', element: <MovePage /> },
      { path: 'abilities', element: <AbilitiesPage /> },
      { path: 'abilities/:abilityId', element: <AbilityPage /> },
      { path: 'items', element: <ItemsPage /> },
      { path: 'items/:itemId', element: <ItemPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:teamId', element: <TeamEditorPage /> },
      { path: 'calc', element: <CalculatorRoute /> },
      { path: 'calc/speed', element: <SpeedTiersRoute /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'changelog', element: <ChangelogPage /> },
      { path: 'artwork', element: <ArtworkPage /> },
      { path: 'translations', element: <TranslationsPage /> },
      { path: 'translations/:language', element: <TranslationEditor /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
