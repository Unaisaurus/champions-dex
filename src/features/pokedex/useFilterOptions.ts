import { useMemo } from 'react';
import type { TextDomain } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import {
  CATEGORY_FILTERS,
  DEFAULT_QUERY,
  runPokedexQuery,
  type CategoryFilter,
  type PokedexSource,
} from '@/domain/pokedex';
import { HAND_MADE_TEXT } from '@/i18n/gameText';
import { localeOf } from '@/i18n/languages';
import { useGameText, useGeneratedText } from '@/i18n/useGameText';
import type { SearchSelectOption } from '@/ui/components/SearchSelect';

export interface FilterOptions {
  moves: SearchSelectOption[];
  abilities: SearchSelectOption[];
  /** Categories with at least one Pokémon in Champions (the others would always be empty). */
  categories: CategoryFilter[];
}

/** The choices offered in the filter panel, named in the current language and searchable in all. */
export function useFilterOptions(source: PokedexSource): FilterOptions {
  const data = useGameData();
  const text = useGameText();
  const { generated } = useGeneratedText();

  return useMemo(() => {
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    // Every language's name for an ID, so "rayo" finds Thunderbolt in English too.
    const otherNames = (domain: TextDomain, id: string) =>
      [
        ...Object.values(generated).map((files) => files?.[domain]?.[id]),
        ...Object.values(HAND_MADE_TEXT).map((files) => files?.[domain]?.[id]),
      ]
        .filter(Boolean)
        .join(' ');
    const options = (ids: string[], domain: TextDomain) =>
      ids
        .map((id) => ({ id, label: text.name(domain, id), searchText: otherNames(domain, id) }))
        .sort((a, b) => collator.compare(a.label, b.label));

    return {
      moves: options(
        data.moves.filter((move) => move.availableInChampions).map((move) => move.id),
        'move-names',
      ),
      abilities: options(
        data.abilities.filter((ability) => ability.availableInChampions).map((ability) => ability.id),
        'ability-names',
      ),
      categories: CATEGORY_FILTERS.filter(
        (category) =>
          runPokedexQuery(source, { ...DEFAULT_QUERY, listMode: 'forms', categories: [category] }).length > 0,
      ),
    };
  }, [data, text, generated, source]);
}
