import type { Form, Id } from '@/data/contracts';
import type { GameText } from '@/i18n/useGameText';

/**
 * A form's name on its own: the form's name when it already says which
 * Pokémon it is ("Mega Charizard Y", "Wash Rotom"), otherwise the species
 * with the form in brackets ("Raichu (Alolan Form)").
 */
export function formDisplayName(form: Form, text: GameText, labels: ReadonlyMap<Id, string | null>): string {
  const species = text.name('pokemon-names', form.speciesId);
  const label = labels.get(form.id) ?? null;
  if (!label) return species;
  return label.toLocaleLowerCase().includes(species.toLocaleLowerCase()) ? label : `${species} (${label})`;
}
