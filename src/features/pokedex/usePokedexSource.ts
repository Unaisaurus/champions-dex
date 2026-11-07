import { useMemo } from 'react';
import type { Form, Id, LearnsetEntry } from '@/data/contracts';
import { useGameData } from '@/data/useGameData';
import { learnsetFormId } from '@/domain/learnsetView';
import type { PokedexSource } from '@/domain/pokedex';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { useSettings } from '@/state/settings';
import { useFavourites } from '@/state/userData';
import { useFormLabels } from '@/ui/useFormLabels';
import { useSearchIndex } from './useSearchIndex';

const NO_MOVES: ReadonlyMap<Id, LearnsetEntry> = new Map();

/** Connects the Pokédex list logic (domain/pokedex) to the loaded data, your favourites and settings. */
export function usePokedexSource(): PokedexSource {
  const data = useGameData();
  const text = useGameText();
  const labels = useFormLabels();
  const searchIndex = useSearchIndex();
  const { favourites } = useFavourites();
  const generationMode = useSettings((state) => state.generationMode);

  const learnsets = useMemo(
    () =>
      new Map(
        [...data.learnsetsByForm].map(([id, entries]) => [id, new Map(entries.map((e) => [e.move, e]))]),
      ),
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
    const learnsetOf = (form: Form): ReadonlyMap<Id, LearnsetEntry> => {
      const id = learnsetFormId(
        form,
        (formId) => learnsets.has(formId),
        (formId) => megaBase.get(formId),
      );
      return (id && learnsets.get(id)) || NO_MOVES;
    };
    return {
      entries: data.championsEntries,
      profilesOf: (id) => data.profilesByEntry.get(id) ?? [],
      species: (id) => data.speciesById.get(id),
      learnsetOf,
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
  }, [data, learnsets, megaBase, canMega, searchIndex, text, labels, collator, favourites, generationMode]);
}
