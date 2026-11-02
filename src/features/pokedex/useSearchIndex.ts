import { useMemo } from 'react';
import type { Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { buildSearchText } from '@/domain/search';
import { HAND_MADE_TEXT } from '@/i18n/gameText';
import { useGameText } from '@/i18n/useGameText';
import { useFormLabels } from '@/ui/useFormLabels';

/**
 * Search text for every Champions form: its official names in ten languages,
 * plus the names in your own translation files (Basque…), whatever language
 * the interface is in. An entry also answers to its appearances' names, so
 * "Polar" finds Vivillon.
 */
export function useSearchIndex(): ReadonlyMap<Id, string> {
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  return useMemo(() => {
    const namesOf = (formId: Id, speciesId: Id): string[] => {
      const names = [...(data.searchNames[formId] ?? []), text.name('pokemon-names', speciesId)];
      const label = labels.get(formId);
      if (label) names.push(label);
      for (const files of Object.values(HAND_MADE_TEXT)) {
        const species = files?.['pokemon-names']?.[speciesId];
        const form = files?.['form-names']?.[formId];
        if (species) names.push(species);
        if (form) names.push(form);
      }
      return names;
    };

    const index = new Map<Id, string>();
    for (const entry of data.championsEntries) {
      const names = namesOf(entry.id, entry.speciesId);
      for (const appearance of data.appearancesByEntry.get(entry.id) ?? []) {
        names.push(...namesOf(appearance.id, appearance.speciesId));
      }
      index.set(entry.id, buildSearchText(names));
      for (const profile of data.profilesByEntry.get(entry.id) ?? []) {
        index.set(profile.id, buildSearchText(namesOf(profile.id, profile.speciesId)));
      }
    }
    return index;
  }, [data, text, labels]);
}
