/**
 * The lists the item and move fields offer, shared by the team builder and
 * the damage calculator so both offer exactly the same choices.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Form, Id, Item } from '@/data/contracts';
import { validationContextFrom } from '@/data/gameData';
import { useGameData } from '@/data/useGameData';
import { learnsetFor } from '@/domain/teamEditing';
import { localeOf } from '@/i18n/languages';
import { useGameText } from '@/i18n/useGameText';
import { megaFormWith } from '@/mechanics/mega';
import { ArtImage } from '@/ui/components/ArtImage';
import type { SearchSelectOption } from '@/ui/components/SearchSelect';
import { useTextSearchIndex } from '@/ui/useTextSearchIndex';
import { MoveOptionDetail } from './MoveOptionDetail';
import styles from './TeamEditor.module.css';

/**
 * Held items, searchable by name in any language. Mega Stones are only
 * offered to the Pokémon that can use them, and listed first. The saved item
 * stays in the list even if it isn't offered anymore (so it shows, with its warning).
 */
export function useItemOptions(formId: Id, savedItem: Id | null): SearchSelectOption[] {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  const searchIndex = useTextSearchIndex('item-names', data.items);

  return useMemo<SearchSelectOption[]>(() => {
    const ctx = validationContextFrom(data);
    const fitsMember = (item: Item) => megaFormWith(formId, item.id, ctx) !== null;
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    const option = (item: Item, own: boolean): SearchSelectOption & { own: boolean } => ({
      id: item.id,
      label: text.name('item-names', item.id),
      searchText: searchIndex.get(item.id),
      icon: <ArtImage keys={[item.icon]} alt="" width={28} height={28} className={styles.optionIcon} />,
      detail: own ? <span className={styles.optionTag}>{t('terms.megaEvolution')}</span> : undefined,
      own,
    });
    const usable = data.items
      .filter((item) => item.availableInChampions)
      .flatMap((item) => {
        if (item.megaEvolutions.length === 0) return [option(item, false)];
        return fitsMember(item) ? [option(item, true)] : [];
      })
      .sort((a, b) => Number(b.own) - Number(a.own) || collator.compare(a.label, b.label));
    if (savedItem !== null && !usable.some((entry) => entry.id === savedItem)) {
      const item = data.itemsById.get(savedItem);
      usable.unshift(
        item
          ? option(item, false)
          : {
              id: savedItem,
              label: savedItem,
              searchText: savedItem,
              icon: null,
              detail: undefined,
              own: false,
            },
      );
    }
    return usable.map(({ id, label, searchText, icon, detail }) => ({ id, label, searchText, icon, detail }));
  }, [data, text, t, searchIndex, formId, savedItem]);
}

/** The moves a form can learn in Champions, by name, with each one's type and power. */
export function useLearnableMoveOptions(form: Form): SearchSelectOption[] {
  const data = useGameData();
  const text = useGameText();
  const searchIndex = useTextSearchIndex('move-names', data.moves);

  return useMemo<SearchSelectOption[]>(() => {
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    return (learnsetFor(form, data) ?? [])
      .flatMap((entry) => {
        const move = data.movesById.get(entry.move);
        if (!move?.availableInChampions) return [];
        return [
          {
            id: move.id,
            label: text.name('move-names', move.id),
            searchText: searchIndex.get(move.id),
            detail: <MoveOptionDetail move={move} isNew={entry.newInChampions} />,
          },
        ];
      })
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [form, data, text, searchIndex]);
}

/**
 * The options for each move slot: the learnable moves minus those already in
 * the other slots. A slot keeps its own move even if it can't be learned
 * anymore (so it shows, with its warning).
 */
export function useMoveSlotOptions(
  learnable: readonly SearchSelectOption[],
  slots: readonly (Id | null)[],
): SearchSelectOption[][] {
  const text = useGameText();
  return useMemo(
    () =>
      slots.map((own, index) => {
        const others = new Set(slots.filter((move, i) => i !== index && move !== null));
        const options = learnable.filter((option) => !others.has(option.id));
        if (own !== null && !options.some((option) => option.id === own)) {
          options.unshift({ id: own, label: text.name('move-names', own) });
        }
        return options;
      }),
    [learnable, slots, text],
  );
}

/** Stat Alignments by name, each with what it raises and lowers. */
export function useAlignmentOptions(): { id: Id; name: string; label: string }[] {
  const { t } = useTranslation();
  const data = useGameData();
  const text = useGameText();
  return useMemo(() => {
    const collator = new Intl.Collator(localeOf(text.language), { sensitivity: 'base' });
    return data.alignments
      .map((entry) => {
        const name = text.name('alignment-names', entry.id);
        const neutral = !entry.raises || !entry.lowers || entry.raises === entry.lowers;
        const label = neutral
          ? t('teamEditor.member.alignmentNeutral', { name })
          : t('teamEditor.member.alignmentOption', {
              name,
              raises: t(`stats.${entry.raises}`),
              lowers: t(`stats.${entry.lowers}`),
            });
        return { id: entry.id, name, label };
      })
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [data.alignments, text, t]);
}
