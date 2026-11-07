import { useState, type ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { DataLoadingScreen } from '@/data/DataScreens';
import { GameDataProvider } from '@/data/GameDataProvider';
import { useTranslationDraftsSync } from '@/i18n/drafts';
import { useGameTextReady } from '@/i18n/useGameText';
import { useApplyTheme } from '@/state/settings';
import { useFavouritesSync, useStartupTasks } from '@/state/userData';
import { router } from './router';

function StartupTasks() {
  useStartupTasks();
  useFavouritesSync();
  useTranslationDraftsSync();
  return null;
}

/**
 * Keeps the loading screen up until the names in your language have arrived,
 * so the first screen never shows IDs ("charizard-mega-x"). Only the first
 * time: switching language later shows English names until the new ones come.
 */
function WaitForGameText({ children }: { children: ReactNode }) {
  const ready = useGameTextReady();
  const [shown, setShown] = useState(ready);
  if (ready && !shown) setShown(true);
  return shown || ready ? children : <DataLoadingScreen />;
}

export function App() {
  useApplyTheme();
  return (
    <GameDataProvider>
      <StartupTasks />
      <WaitForGameText>
        <RouterProvider router={router} />
      </WaitForGameText>
    </GameDataProvider>
  );
}
