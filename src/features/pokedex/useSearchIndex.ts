import { useMemo } from 'react';
import type { Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { buildSearchText } from '@/domain/search';
import { HAND_MADE_TEXT } from '@/i18n/gameText';
import { useGameText } from '@/i18n/useGameText';

/**
 * Search text for every Pokédex entry: its official names in ten languages,
 * plus the names in your own translation files (Basque…), whatever language
 * the interface is in.
 */
export function useSearchIndex(): ReadonlyMap<Id, string> {
  const data = useGameData();
  const text = useGameText();
  return useMemo(() => {
    const index = new Map<Id, string>();
    for (const form of data.championsEntries) {
      const names = [...(data.searchNames[form.id] ?? [])];
      const { title, subtitle } = text.formTitle(form);
      names.push(title);
      if (subtitle) names.push(subtitle);
      for (const files of Object.values(HAND_MADE_TEXT)) {
        const species = files?.['pokemon-names']?.[form.speciesId];
        const label = files?.['form-names']?.[form.id];
        if (species) names.push(species);
        if (label) names.push(label);
      }
      index.set(form.id, buildSearchText(names));
    }
    return index;
  }, [data, text]);
}
