import type { Form, Id } from '@/data/contracts';
import type { GameData } from '@/data/gameData';
import type { GameText } from '@/i18n/useGameText';

/**
 * Display labels for the forms shown together on a Pokémon page.
 *
 * - The game's own form name is used when it exists ("Mega Raichu X", "Female").
 * - A Mega Evolution without one borrows a sibling Mega's label (the game
 *   names only one of the two Mega Meowstic).
 * - Repeated labels get the form they come from added: "Mega Meowstic (Female)".
 * - Labels identical to the species name are dropped ("Rotom" on Rotom).
 */
export function formLabels(forms: readonly Form[], data: GameData, text: GameText): Map<Id, string | null> {
  const speciesName = (form: Form) => text.name('pokemon-names', form.speciesId);
  const own = (form: Form) => text.get('form-names', form.id)?.text ?? null;

  const base = new Map<Id, string | null>();
  for (const form of forms) {
    // Only Mega Evolutions borrow: a missing label on any other kind is left empty rather than guessed.
    const borrowed =
      form.kind === 'mega'
        ? forms
            .filter((other) => other.kind === 'mega')
            .map(own)
            .find(Boolean)
        : null;
    const label = own(form) ?? borrowed ?? null;
    base.set(form.id, label === speciesName(form) ? null : label);
  }

  const result = new Map<Id, string | null>();
  for (const form of forms) {
    const label = base.get(form.id) ?? null;
    const repeated =
      label !== null && forms.some((other) => other.id !== form.id && base.get(other.id) === label);
    if (!repeated || !form.megaStone) {
      result.set(form.id, label);
      continue;
    }
    const from = data.itemsById.get(form.megaStone)?.megaEvolutions.find((m) => m.to === form.id)?.from;
    const fromLabel = from ? own(data.formsById.get(from) ?? form) : null;
    result.set(form.id, fromLabel ? `${label} (${fromLabel})` : label);
  }
  return result;
}

/**
 * Labels for every form, worked out once per Pokédex entry group (the entry,
 * its profiles and its appearances), so lists and pages agree.
 */
export function allFormLabels(data: GameData, text: GameText): Map<Id, string | null> {
  const labels = new Map<Id, string | null>();
  const entries = data.forms.filter((form) => form.display === 'entry');
  for (const entry of entries) {
    const group = [
      entry,
      ...(data.profilesByEntry.get(entry.id) ?? []),
      ...(data.appearancesByEntry.get(entry.id) ?? []),
    ];
    for (const [id, label] of formLabels(group, data, text)) labels.set(id, label);
  }
  return labels;
}
