import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { DataErrorScreen, DataLoadingScreen } from './DataScreens';
import { loadGameData, type LoadedGameData } from './loader';
import { GameDataContext } from './useGameData';

type LoadState =
  { status: 'loading' } | { status: 'ready'; loaded: LoadedGameData } | { status: 'error'; error: unknown };

/** Loads the game data once and shows a loading or error screen until it's ready. */
export function GameDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadGameData()
      .then((loaded) => {
        if (!cancelled) setState({ status: 'ready', loaded });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  if (state.status === 'loading') return <DataLoadingScreen />;
  if (state.status === 'error') return <DataErrorScreen error={state.error} onRetry={retry} />;
  return <GameDataContext.Provider value={state.loaded}>{children}</GameDataContext.Provider>;
}
