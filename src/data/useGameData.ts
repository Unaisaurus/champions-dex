import { createContext, useContext } from 'react';
import type { GameData } from './gameData';
import type { IntegrityProblem } from './integrity';
import type { LoadedGameData } from './loader';

export const GameDataContext = createContext<LoadedGameData | null>(null);

function useLoaded(): LoadedGameData {
  const loaded = useContext(GameDataContext);
  if (!loaded) throw new Error('useGameData must be used inside <GameDataProvider>');
  return loaded;
}

/** The loaded game data. Only usable inside <GameDataProvider>, which waits for it to load. */
export function useGameData(): GameData {
  return useLoaded().data;
}

/** Problems found by the cross-file consistency checks (shown in Settings). */
export function useDataProblems(): IntegrityProblem[] {
  return useLoaded().problems;
}
