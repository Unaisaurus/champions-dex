import { RouterProvider } from 'react-router';
import { GameDataProvider } from '@/data/GameDataProvider';
import { useApplyTheme } from '@/state/settings';
import { useFavouritesSync, useStartupTasks } from '@/state/userData';
import { router } from './router';

function StartupTasks() {
  useStartupTasks();
  useFavouritesSync();
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
