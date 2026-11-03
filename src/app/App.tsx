import { RouterProvider } from 'react-router';
import { GameDataProvider } from '@/data/GameDataProvider';
import { useTranslationDraftsSync } from '@/i18n/drafts';
import { useApplyTheme } from '@/state/settings';
import { useFavouritesSync, useStartupTasks } from '@/state/userData';
import { router } from './router';

function StartupTasks() {
  useStartupTasks();
  useFavouritesSync();
  useTranslationDraftsSync();
  return null;
}

export function App() {
  useApplyTheme();
  return (
    <GameDataProvider>
      <StartupTasks />
      <RouterProvider router={router} />
    </GameDataProvider>
  );
}
