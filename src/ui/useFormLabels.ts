import { useMemo } from 'react';
import type { Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { useGameText } from '@/i18n/useGameText';
import { allFormLabels } from './formLabels';

/** The label of every form in the current language ("Mega Meowstic (Female)"), or null for none. */
export function useFormLabels(): ReadonlyMap<Id, string | null> {
  const data = useGameData();
  const text = useGameText();
  return useMemo(() => allFormLabels(data, text), [data, text]);
}
