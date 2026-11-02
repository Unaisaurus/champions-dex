/**
 * Cross-file consistency checks: every ID that one file mentions must exist in
 * the file that defines it. The data updater runs these before writing data,
 * and the app runs them after loading and lists any problems under Settings.
 */
import type { CoreData, FamilyNode, Id } from './contracts';

export interface IntegrityProblem {
  file: string;
  message: string;
}

export function checkIntegrity(core: CoreData): IntegrityProblem[] {
  const problems: IntegrityProblem[] = [];
  const report = (file: string, message: string) => problems.push({ file, message });

  const ids = <T extends { id: Id }>(file: string, list: readonly T[]) => {
    const set = new Set<Id>();
    for (const entry of list) {
      if (set.has(entry.id)) report(file, `Duplicate ID "${entry.id}"`);
      set.add(entry.id);
    }
    return set;
  };
  const speciesIds = ids('species.json', core.species);
  const formIds = ids('forms.json', core.forms);
  const moveIds = ids('moves.json', core.moves);
  const abilityIds = ids('abilities.json', core.abilities);
  const itemIds = ids('items.json', core.items);
  ids('alignments.json', core.alignments);
  const familyIds = ids('families.json', core.families);
  const typeIds = new Set(core.types.types);
  const formsById = new Map(core.forms.map((form) => [form.id, form]));

  for (const species of core.species) {
    if (!familyIds.has(species.familyId)) {
      report('species.json', `${species.id}: unknown family "${species.familyId}"`);
    }
    for (const formId of species.forms) {
      const form = formsById.get(formId);
      if (!form) report('species.json', `${species.id}: unknown form "${formId}"`);
      else if (form.speciesId !== species.id) {
        report('species.json', `${species.id}: form "${formId}" belongs to "${form.speciesId}"`);
      }
    }
  }

  for (const form of core.forms) {
    const where = `${form.id}`;
    if (!speciesIds.has(form.speciesId))
      report('forms.json', `${where}: unknown species "${form.speciesId}"`);
    if (!core.species.some((species) => species.forms.includes(form.id))) {
      report('forms.json', `${where}: not listed in its species' forms`);
    }
    for (const type of form.types) {
      if (!typeIds.has(type)) report('forms.json', `${where}: unknown type "${type}"`);
    }
    for (const ability of form.abilities) {
      if (!abilityIds.has(ability)) report('forms.json', `${where}: unknown ability "${ability}"`);
    }
    if (form.megaStone && !itemIds.has(form.megaStone)) {
      report('forms.json', `${where}: unknown Mega Stone "${form.megaStone}"`);
    }
    if (form.parentEntry) {
      const parent = formsById.get(form.parentEntry);
      if (!parent) report('forms.json', `${where}: unknown parent entry "${form.parentEntry}"`);
      else if (parent.display !== 'entry')
        report('forms.json', `${where}: parent "${parent.id}" is not an entry`);
    }
    if (form.display !== 'entry' && !form.parentEntry) {
      report('forms.json', `${where}: ${form.display} forms need a parent entry`);
    }
    if (form.display === 'appearance' && (!form.gameplayForm || !formIds.has(form.gameplayForm))) {
      report('forms.json', `${where}: appearance variant without a valid gameplay form`);
    }
    const selectable = form.availability === 'champions' && !form.battleOnly && form.display !== 'appearance';
    if (selectable && !(form.id in core.learnsets)) {
      report('learnsets.json', `${where}: no learnset for a form usable in Champions`);
    }
  }

  for (const item of core.items) {
    for (const { from, to } of item.megaEvolutions) {
      if (!formIds.has(from)) report('items.json', `${item.id}: unknown form "${from}"`);
      if (!formIds.has(to)) report('items.json', `${item.id}: unknown Mega form "${to}"`);
    }
  }

  for (const [formId, entries] of Object.entries(core.learnsets)) {
    if (!formIds.has(formId)) report('learnsets.json', `Learnset for unknown form "${formId}"`);
    for (const entry of entries) {
      if (!moveIds.has(entry.move)) report('learnsets.json', `${formId}: unknown move "${entry.move}"`);
    }
  }

  for (const move of core.moves) {
    if (!typeIds.has(move.type)) report('moves.json', `${move.id}: unknown type "${move.type}"`);
  }

  for (const [attacking, row] of Object.entries(core.types.chart)) {
    if (!typeIds.has(attacking)) report('types.json', `Chart row for unknown type "${attacking}"`);
    for (const defending of Object.keys(row)) {
      if (!typeIds.has(defending)) report('types.json', `Chart entry for unknown type "${defending}"`);
    }
  }

  const visit = (familyId: Id, node: FamilyNode) => {
    if (!formIds.has(node.form)) report('families.json', `${familyId}: unknown form "${node.form}"`);
    node.children.forEach((child) => visit(familyId, child));
  };
  core.families.forEach((family) => family.roots.forEach((root) => visit(family.id, root)));

  for (const formId of Object.keys(core.searchNames)) {
    if (!formIds.has(formId)) report('search-names.json', `Names for unknown form "${formId}"`);
  }

  return problems;
}
