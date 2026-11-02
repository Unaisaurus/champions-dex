import type { Id } from '@/data/contracts';
import type { GameData } from '@/data/gameData';
import { HAND_MADE_TEXT } from '@/i18n/gameText';
import type { GameText } from '@/i18n/useGameText';

/**
 * Every name a form answers to in searches: its official names in ten
 * languages, its name and label in the current language, and the names in
 * your own translation files (Basque…), whatever language the interface is in.
 */
export function formSearchNames(
  formId: Id,
  speciesId: Id,
  data: GameData,
  text: GameText,
  labels: ReadonlyMap<Id, string | null>,
): string[] {
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
}
