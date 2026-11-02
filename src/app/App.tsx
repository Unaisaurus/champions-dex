import { RouterProvider } from 'react-router';
import { GameDataProvider } from '@/data/GameDataProvider';
import { useApplyTheme } from '@/state/settings';
import { useStartupTasks } from '@/state/userData';
import { router } from './router';

function StartupTasks() {
  useStartupTasks();
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
