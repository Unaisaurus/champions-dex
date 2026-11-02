import { useMemo } from 'react';
import type { Id, TextDomain } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { createShowdownLookup, type EnglishNames, type ShowdownLookup } from '@/domain/showdown';
import { HAND_MADE_TEXT } from '@/i18n/gameText';
import { useGeneratedText } from '@/i18n/useGameText';

/**
 * English names (Showdown only understands English) and the lookup that turns
 * Showdown names back into IDs.
 */
export function useShowdown(): { names: EnglishNames; lookup: ShowdownLookup } {
  const data = useGameData();
  const { generated } = useGeneratedText();
  const english = generated.en;
  return useMemo(() => {
    const name = (domain: TextDomain) => (id: Id) =>
      HAND_MADE_TEXT.en?.[domain]?.[id] || english?.[domain]?.[id] || id;
    const names: EnglishNames = {
      pokemon: name('pokemon-names'),
      move: name('move-names'),
      item: name('item-names'),
      ability: name('ability-names'),
      alignment: name('alignment-names'),
    };
    return { names, lookup: createShowdownLookup(data, names) };
  }, [data, english]);
}
