import type { Id } from '@/data/contracts';
import type { GameData } from '@/data/gameData';
import { useGameData } from '@/data/useGameData';
import { useGameText, type GameText } from '@/i18n/useGameText';
import { allFormLabels } from './formLabels';

/** Worked out once per language and data version, and shared by every component. */
const cache = new WeakMap<GameText, WeakMap<GameData, Map<Id, string | null>>>();

/** The label of every form in the current language ("Mega Meowstic (Female)"), or null for none. */
export function useFormLabels(): ReadonlyMap<Id, string | null> {
  const data = useGameData();
  const text = useGameText();
  let byData = cache.get(text);
  if (!byData) {
    byData = new WeakMap();
    cache.set(text, byData);
  }
  let labels = byData.get(data);
  if (!labels) {
    labels = allFormLabels(data, text);
    byData.set(data, labels);
  }
  return labels;
}
