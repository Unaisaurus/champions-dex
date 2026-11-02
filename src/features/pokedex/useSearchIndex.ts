import { useMemo } from 'react';
import type { Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { buildSearchText } from '@/domain/search';
import { useGameText } from '@/i18n/useGameText';
import { formSearchNames } from '@/ui/searchNames';
import { useFormLabels } from '@/ui/useFormLabels';

/**
 * Search text for every Champions form (see formSearchNames). An entry also
 * answers to its appearances' names, so "Polar" finds Vivillon.
 */
export function useSearchIndex(): ReadonlyMap<Id, string> {
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  return useMemo(() => {
    const index = new Map<Id, string>();
    for (const entry of data.championsEntries) {
      const names = formSearchNames(entry.id, entry.speciesId, data, text, labels);
      for (const appearance of data.appearancesByEntry.get(entry.id) ?? []) {
        names.push(...formSearchNames(appearance.id, appearance.speciesId, data, text, labels));
      }
      index.set(entry.id, buildSearchText(names));
      for (const profile of data.profilesByEntry.get(entry.id) ?? []) {
        index.set(
          profile.id,
          buildSearchText(formSearchNames(profile.id, profile.speciesId, data, text, labels)),
        );
      }
    }
    return index;
  }, [data, text, labels]);
}
