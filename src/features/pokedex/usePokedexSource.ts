import { useMemo } from 'react';
import type { Form, Id } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { learnsetFormId } from '@/domain/learnsetView';
import type { PokedexSource } from '@/domain/pokedex';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { useSettings } from '@/state/settings';
import { useFavourites } from '@/state/userData';
import { useFormLabels } from '@/ui/useFormLabels';
import { useSearchIndex } from './useSearchIndex';

const NO_MOVES: ReadonlySet<Id> = new Set();

/** Connects the Pokédex list logic (domain/pokedex) to the loaded data, your favourites and settings. */
export function usePokedexSource(): PokedexSource {
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const searchIndex = useSearchIndex();
  const { favourites } = useFavourites();
  const generationMode = useSettings((state) => state.generationMode);

  const moveSets = useMemo(
    () =>
      new Map([...data.learnsetsByForm].map(([id, entries]) => [id, new Set(entries.map((e) => e.move))])),
    [data],
  );
  const megaBase = data.megaBase;
  // Every form that can Mega Evolve.
  const canMega = useMemo(() => new Set(megaBase.values()), [megaBase]);
  const collator = useMemo(
    () => new Intl.Collator(localeOf(text.language), { sensitivity: 'base', numeric: true }),
    [text.language],
  );

  return useMemo(() => {
    const movesOf = (form: Form): ReadonlySet<Id> => {
      const id = learnsetFormId(
        form,
        (formId) => moveSets.has(formId),
        (formId) => megaBase.get(formId),
      );
      return (id && moveSets.get(id)) || NO_MOVES;
    };
    return {
      entries: data.championsEntries,
      profilesOf: (id) => data.profilesByEntry.get(id) ?? [],
      species: (id) => data.speciesById.get(id),
      movesOf,
      canMegaEvolve: (form) => canMega.has(form.id),
      searchText: (id) => searchIndex.get(id) ?? '',
      displayName: (form) => {
        const title = text.name('pokemon-names', form.speciesId);
        const label = labels.get(form.id);
        return label ? `${title} ${label}` : title;
      },
      compareNames: (a, b) => collator.compare(a, b),
      favourites,
      generationMode,
    };
  }, [data, moveSets, megaBase, canMega, searchIndex, text, labels, collator, favourites, generationMode]);
}
